"""Pydantic models for dataset-generator chat golden-set cases.

Scorers grade only the Expect keys that are set.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

SectionName = Literal["general_inputs", "formulation_groups", "outputs"]
FormKey = Literal[
    "general_inputs",
    "formulation_groups",
    "outputs",
    "num_rows",
    "noise",
    "filename",
    "min_ingredients_per_formulation",
    "max_ingredients_per_formulation",
]
HistoryRole = Literal["user", "assistant"]


class HistoryMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: HistoryRole
    content: str = Field(min_length=1)


class Expect(BaseModel):
    """Checks for one case. Scorers skip unset fields."""

    model_config = ConfigDict(extra="forbid")

    form_changes_intended: bool | None = None
    has_form_updates: bool | None = None
    search_called: bool | None = None
    num_rows: int | None = None
    untouched_keys: list[FormKey] | None = None
    require_sections: list[SectionName] | None = None
    group_count: tuple[int, int] | None = None
    ingredient_count: tuple[int, int] | None = None
    must_pass_validator: bool | None = None
    require_citations: bool | None = None
    citations_subset: bool | None = None
    require_ingredient_names: list[str] | None = None
    require_group_name_substrings: list[str] | None = None
    require_existing_group_names: list[str] | None = None
    require_existing_ingredient_names: list[str] | None = None
    require_existing_general_input_names: list[str] | None = None
    require_existing_output_names: list[str] | None = None
    min_ingredients_in_groups: dict[str, int] | None = None
    min_groups: int | None = None
    min_general_inputs: int | None = None
    min_outputs: int | None = None
    formulation_groups_empty: bool | None = None
    require_numeric_message: bool | None = None

    @field_validator("group_count", "ingredient_count", mode="before")
    @classmethod
    def _count_range(cls, value: Any) -> Any:
        if value is None:
            return value
        if not isinstance(value, (list, tuple)) or len(value) != 2:
            raise ValueError("must be a [low, high] pair")
        low, high = int(value[0]), int(value[1])
        if low > high:
            raise ValueError("low must be <= high")
        return (low, high)


class GoldenCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    user_message: str = Field(min_length=1)
    form_state: dict[str, Any] = Field(default_factory=dict)
    history: list[HistoryMessage] = Field(default_factory=list)
    expect: Expect
    tags: list[str] = Field(default_factory=list)


def load_golden_set(path: Path) -> list[GoldenCase]:
    cases: list[GoldenCase] = []
    seen: set[str] = set()
    for line_no, line in enumerate(path.read_text().splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}:{line_no}: invalid JSONL") from exc
        try:
            case = GoldenCase.model_validate(payload)
        except Exception as exc:
            raise ValueError(f"{path}:{line_no}: {exc}") from exc
        if case.id in seen:
            raise ValueError(f"{path}:{line_no}: duplicate id {case.id!r}")
        seen.add(case.id)
        cases.append(case)
    return cases
