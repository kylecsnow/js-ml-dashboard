"""Typed contract for the LLM's chat replies.

The system prompt tells the model to answer with a single JSON object; these
models parse it so that type errors (min/max that must be strings, counts that
must be integers or null) fail loudly instead of surfacing as silent `.get()`
defaults in the endpoint.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


def _stringify_bound(value: Any) -> Any:
    if value is None or isinstance(value, str):
        return value
    return str(value)


class Descriptor(BaseModel):
    # No min_length on name: an empty name is a *gate* error (retried by the
    # LLM), not a 502 — the contract stays permissive, form_validation is strict.
    name: str = Field(max_length=120)
    min: str
    max: str
    units: str = ""

    @field_validator("min", "max", mode="before")
    @classmethod
    def _stringify_minmax(cls, value: Any) -> Any:
        return _stringify_bound(value)


class Ingredient(Descriptor):
    required: bool = False


class FormulationGroup(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(max_length=120)
    # Models often emit group_sum_min/max because the prompt talks about group sums.
    min: str = Field(validation_alias=AliasChoices("min", "group_sum_min"))
    max: str = Field(validation_alias=AliasChoices("max", "group_sum_max"))
    min_ingredients: Optional[int] = None
    max_ingredients: Optional[int] = None
    ingredients: list[Ingredient]

    @model_validator(mode="before")
    @classmethod
    def _accept_group_sum_aliases(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        value = dict(value)
        if "min" not in value and "group_sum_min" in value:
            value["min"] = value["group_sum_min"]
        if "max" not in value and "group_sum_max" in value:
            value["max"] = value["group_sum_max"]
        return value

    @field_validator("min", "max", mode="before")
    @classmethod
    def _stringify_minmax(cls, value: Any) -> Any:
        return _stringify_bound(value)


class FormUpdates(BaseModel):
    general_inputs: list[Descriptor] | None = None
    formulation_groups: list[FormulationGroup] | None = None
    outputs: list[Descriptor] | None = None
    num_rows: int | None = None
    noise: float | None = None
    filename: str | None = None
    min_ingredients_per_formulation: int | None = None
    max_ingredients_per_formulation: int | None = None

    def is_empty(self) -> bool:
        return all(
            value is None
            for value in (
                self.general_inputs,
                self.formulation_groups,
                self.outputs,
                self.num_rows,
                self.noise,
                self.filename,
                self.min_ingredients_per_formulation,
                self.max_ingredients_per_formulation,
            )
        )


class ChatReply(BaseModel):
    message: str
    form_changes_intended: bool = False
    form_updates: FormUpdates | None = None


def coerce_chat_reply_data(data: dict[str, Any]) -> dict[str, Any]:
    """Normalize common LLM key aliases before Pydantic validation."""
    updates = data.get("form_updates")
    if not isinstance(updates, dict):
        return data
    groups = updates.get("formulation_groups")
    if not isinstance(groups, list):
        return data
    coerced_groups = []
    for group in groups:
        if not isinstance(group, dict):
            coerced_groups.append(group)
            continue
        group = dict(group)
        if "min" not in group and "group_sum_min" in group:
            group["min"] = group.pop("group_sum_min")
        else:
            group.pop("group_sum_min", None)
        if "max" not in group and "group_sum_max" in group:
            group["max"] = group.pop("group_sum_max")
        else:
            group.pop("group_sum_max", None)
        coerced_groups.append(group)
    return {
        **data,
        "form_updates": {**updates, "formulation_groups": coerced_groups},
    }


def json_loads_object(text: str) -> dict[str, Any]:
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("expected a JSON object")
    return data


def payload_from_parse_error(exc: Exception) -> dict[str, Any]:
    """Recover the JSON object LangChain embeds in OUTPUT_PARSING_FAILURE."""
    llm_output = getattr(exc, "llm_output", None)
    if isinstance(llm_output, dict):
        return llm_output
    if isinstance(llm_output, str) and llm_output.strip():
        return json_loads_object(llm_output.strip())
    text = str(exc)
    marker = "from completion "
    if marker in text:
        blob = text.split(marker, 1)[1]
        if ". Got:" in blob:
            blob = blob.split(". Got:", 1)[0]
        return json_loads_object(blob.strip())
    raise ValueError("no JSON payload in parse error") from exc


def json_from_message_content(content: Any) -> dict[str, Any] | None:
    """Pull a JSON object out of an AIMessage.content value."""
    if isinstance(content, dict):
        return content
    if isinstance(content, str):
        text = content.strip()
        return json_loads_object(text) if text else None
    if not isinstance(content, list):
        return None
    text_parts: list[str] = []
    other_parts: list[str] = []
    for block in content:
        if isinstance(block, str):
            other_parts.append(block)
            continue
        if not isinstance(block, dict):
            continue
        piece = block.get("text")
        if not isinstance(piece, str):
            continue
        if block.get("type") == "text":
            text_parts.append(piece)
        else:
            other_parts.append(piece)
    for blob in ("".join(text_parts), "".join(other_parts)):
        blob = blob.strip()
        if not blob:
            continue
        try:
            return json_loads_object(blob)
        except (json.JSONDecodeError, ValueError):
            continue
    return None


def parse_chat_reply(raw: Any) -> ChatReply:
    """Parse a structured-output result, including LangChain include_raw dicts."""
    if isinstance(raw, ChatReply):
        return raw
    payload: Any = raw
    if isinstance(raw, dict) and "parsed" in raw and "raw" in raw:
        parsed = raw.get("parsed")
        if isinstance(parsed, ChatReply):
            return parsed
        if isinstance(parsed, dict):
            payload = parsed
        else:
            payload = json_from_message_content(
                getattr(raw.get("raw"), "content", None)
            )
            if payload is None and raw.get("parsing_error") is not None:
                payload = payload_from_parse_error(raw["parsing_error"])
    if isinstance(payload, ChatReply):
        return payload
    if not isinstance(payload, dict):
        raise ValueError("expected a JSON object")
    return ChatReply.model_validate(coerce_chat_reply_data(payload))
