"""Dataset-generator chat: search, then a structured reply, then form validation.

Provider-agnostic LangGraph: search (optional web_search) → reply (ChatReply
JSON) → validate. Groq cannot mix tool use with structured output, so search
and reply stay separate LLM calls regardless of provider.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, TypedDict

from fastapi import HTTPException
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from pydantic import ValidationError

from .chemistry_search import (
    format_sources_for_finalization,
    prepare_cited_sources_for_display,
    search_chemistry_sources,
)
from .form_contracts import (
    ChatReply,
    FormUpdates,
    parse_chat_reply,
    payload_from_parse_error,
)
from .form_validation import validate_form_updates

_payload_from_parse_error = payload_from_parse_error

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER = "groq"
DEFAULT_MODELS = {
    "groq": "openai/gpt-oss-120b",
    "openai": "gpt-4.1-mini",
}
_PROVIDER_API_KEYS = {
    "groq": "GROQ_API_KEY",
    "openai": "OPENAI_API_KEY",
}
MAX_HISTORY_MESSAGES = 2
MAX_HISTORY_CHARS = 1_200
MAX_SEARCH_TOKENS = 256
MAX_REPLY_TOKENS = 2_048
MAX_SOURCES = 3
MAX_VALIDATION_ATTEMPTS = 3
MAX_VALIDATION_ERRORS_NOTED = 2
REASONING_EFFORT = "low"

SYSTEM_PROMPT = """\
You are an expert assistant that helps scientists and engineers set up synthetic \
datasets for formulation-based chemistry and materials science ML problems. You are \
embedded in a web application that has a "Dataset Generator" form.

### The form
1. **General Inputs** — continuous process variables a human directly controls \
(temperature, time, speed, pressure). Each has: name, min, max, units.
2. **Formulation Inputs** — the ingredients of a mixture, organized into **Groups** \
(functional roles like "Monomer", "Photoinitiator", "Filler"). Ingredient fractions \
are weight/volume/mole fractions that sum to 1 across the formulation. Each group \
has: name; group SUM min/max (each 0..1); optional min_ingredients/max_ingredients \
(how many of its ingredients may be present); and its ingredients (name, min 0..1, \
max 0..1, required). `required: true` means the ingredient appears in every \
formulation (min must be > 0); the default `required: false` allows omission.
3. **Outputs** — the response variables to predict/optimize. Each has: name, min, \
max, units.
4. **Settings** — num_rows, noise, filename, plus optional global \
min_ingredients_per_formulation / max_ingredients_per_formulation.

### Judging what to generate
- When setting up a new problem, populate ALL three sections (General Inputs, \
Formulation Inputs, Outputs) in one response, unless the problem genuinely has none \
of a type.
- A property that depends on composition (e.g. viscosity, tensile strength) is an \
Output — never a General Input. Anything that goes INTO the mixture is a \
Formulation Input.
- Match the user's granularity: specific chemicals stay specific; generic names \
stay generic. Keep about 10 ingredients, soft ceiling 20, in 2-5 role groups.
- Give every variable a realistic domain-based min/max. Never change num_rows or \
noise unless the user directly asks.
- Group maxes must be able to sum to 1.0. If most of the mixture is a bulk \
phase (water, milk, solvent, base resin), include that group. Keep minority \
ingredients at realistic maxes; do not inflate them to fake a complete \
formulation.
- For "start over" / domain change: remove ALL existing variables first.

### Citing sources
- Cite sources you relied on inline as markdown links: [short title](url). Only \
cite URLs from the allowed list; never invent citations; citing none is fine.
- Do NOT add your own Sources/References section.

### Behavior
- Informational questions: form_changes_intended false and form_updates null.
- Set form_changes_intended true ONLY when the user asked to add, remove, modify, \
or set up form variables.
- When changing a category, return its FULL new list — never a partial delta.
- New ingredients default to required: false.
- Names are clean labels: no units in the name. Parentheses are allowed only \
as part of a chemical name, with no space before '('. Do not add annotations \
like "TPO (photoinitiator)".
- min/max values are STRINGS. Ingredient/group fractions are in [0, 1] \
("0.05" not "5"). Group objects use the keys min and max for those group-sum \
bounds (not group_sum_min / group_sum_max). In form_updates include only keys \
that should change.

Respond as JSON matching the schema: message, form_changes_intended, form_updates.
"""

SEARCH_PROMPT = """\
Decide whether this request needs a web search. Call web_search once when the \
user asks to look something up, or before stating chemistry facts you are not \
confident about (roles, typical concentrations, alternatives). Do not search \
for pure form edits, settings changes, or chit-chat. If no search is needed, \
reply with OK and nothing else.
"""


class ChatState(TypedDict, total=False):
    user_message: str
    history: list[dict[str, str]]
    form_state: dict[str, Any]
    sources: list[dict[str, str]]
    reply: ChatReply
    raw_updates: dict[str, Any] | None
    pending_updates: dict[str, Any] | None
    validation_errors: list[str]
    validation_error_log: list[str]
    attempts: int


@tool
def web_search(query: str) -> str:
    """Search the web for chemistry and formulation facts."""
    sources = search_chemistry_sources([query])[:MAX_SOURCES]
    if not sources:
        return "No sources found."
    return json.dumps(sources)


def chat_provider() -> str:
    """Return the configured chat provider. Defaults to Groq."""
    return (os.environ.get("CHAT_PROVIDER") or DEFAULT_PROVIDER).strip().lower()


def chat_model() -> str:
    """Return CHAT_MODEL if set, otherwise the selected provider's default."""
    override = (os.environ.get("CHAT_MODEL") or "").strip()
    if override:
        return override
    return DEFAULT_MODELS.get(chat_provider(), "")


def chat_api_key_error() -> str | None:
    """Return a configuration error if the selected provider is unusable."""
    provider = chat_provider()
    key_name = _PROVIDER_API_KEYS.get(provider)
    if key_name is None:
        known = ", ".join(sorted(_PROVIDER_API_KEYS))
        return f"Unknown CHAT_PROVIDER {provider!r}. Supported: {known}."
    if not os.environ.get(key_name):
        return f"{key_name} environment variable is not set."
    return None


def _chat_llm(**kwargs: Any) -> Any:
    provider = chat_provider()
    common = {
        "model": chat_model(),
        "temperature": kwargs.get("temperature", 0.2),
        "max_tokens": kwargs["max_tokens"],
    }
    if provider == "groq":
        return ChatGroq(
            **common,
            reasoning_effort=REASONING_EFFORT,
            groq_api_key=os.environ.get("GROQ_API_KEY"),
        )
    if provider == "openai":
        return ChatOpenAI(
            **common,
            api_key=os.environ.get("OPENAI_API_KEY"),
        )
    raise RuntimeError(
        chat_api_key_error() or f"Unknown CHAT_PROVIDER {provider!r}."
    )


def _search_llm() -> Any:
    return _chat_llm(temperature=0.0, max_tokens=MAX_SEARCH_TOKENS).bind_tools(
        [web_search]
    )


def _reply_llm() -> Any:
    return _chat_llm(max_tokens=MAX_REPLY_TOKENS)


def _is_capacity_error(exc: Exception) -> bool:
    status = getattr(exc, "status_code", None)
    if status in {413, 429}:
        return True
    text = str(exc).lower()
    return (
        "rate_limit" in text
        or "tokens per minute" in text
        or "payload too large" in text
    )


_RETRY_IN_PATTERN = re.compile(r"try again in ([\dhms.]+)", re.IGNORECASE)


def _capacity_error_detail(exc: Exception) -> str:
    text = str(exc)
    retry_in = _RETRY_IN_PATTERN.search(text)
    wait = f"Try again in {retry_in.group(1)}." if retry_in else "Try again shortly."
    if "tokens per day" in text.lower():
        return f"The model provider is rate-limited: daily token limit reached. {wait}"
    return f"The model provider is rate-limited. {wait}"


def _raise_llm_error(exc: Exception) -> None:
    if _is_capacity_error(exc):
        logger.warning("Chat LLM rate-limited: %s", exc)
        raise HTTPException(
            status_code=429,
            detail=_capacity_error_detail(exc),
        ) from exc
    logger.error("Chat LLM error: %s", exc)
    raise HTTPException(
        status_code=502,
        detail="The LLM returned an invalid JSON response. Please try again.",
    ) from exc


def compact_history(history: list) -> list[dict[str, str]]:
    compacted: list[dict[str, str]] = []
    remaining = MAX_HISTORY_CHARS
    for entry in reversed(history[-MAX_HISTORY_MESSAGES:]):
        if not isinstance(entry, dict):
            continue
        role = entry.get("role")
        content = entry.get("content")
        if role not in {"user", "assistant"} or not isinstance(content, str):
            continue
        if remaining <= 0:
            break
        compacted.append({"role": role, "content": content[:remaining]})
        remaining -= len(content)
    return list(reversed(compacted))


def _history_messages(history: list[dict[str, str]]) -> list[BaseMessage]:
    messages: list[BaseMessage] = []
    for entry in history:
        if entry["role"] == "assistant":
            messages.append(AIMessage(content=entry["content"]))
        else:
            messages.append(HumanMessage(content=entry["content"]))
    return messages


def _normalize_num(val: Any) -> str:
    try:
        return str(float(val))
    except (ValueError, TypeError):
        return str(val)


def _normalize_descriptors(
    items: list[dict] | None,
) -> list[tuple[str, str, str, str]]:
    return [
        (
            d.get("name", ""),
            _normalize_num(d.get("min", "")),
            _normalize_num(d.get("max", "")),
            d.get("units", ""),
        )
        for d in (items or [])
    ]


def _normalize_count(val: Any) -> str:
    if val in (None, ""):
        return ""
    return _normalize_num(val)


def _normalize_formulation_groups(items: list[dict] | None) -> list[tuple]:
    normalized: list[tuple] = []
    for group in items or []:
        ingredients = tuple(
            (
                ing.get("name", ""),
                _normalize_num(ing.get("min", "")),
                _normalize_num(ing.get("max", "")),
                bool(ing.get("required", False)),
            )
            for ing in group.get("ingredients", [])
        )
        normalized.append(
            (
                group.get("name", ""),
                _normalize_num(group.get("min", "")),
                _normalize_num(group.get("max", "")),
                _normalize_count(group.get("min_ingredients")),
                _normalize_count(group.get("max_ingredients")),
                ingredients,
            )
        )
    return normalized


def strip_unchanged_updates(
    form_state: dict,
    form_updates: dict,
    raw_updates: dict | None = None,
) -> dict | None:
    """Drop form_updates keys whose values already match form_state."""
    if not form_updates:
        return None
    raw = raw_updates if raw_updates is not None else form_updates
    cleaned: dict[str, Any] = {}

    for key in ("general_inputs", "outputs"):
        if key not in raw or raw.get(key) is None:
            continue
        incoming = form_updates.get(key)
        if incoming is None:
            continue
        if _normalize_descriptors(form_state.get(key, [])) != _normalize_descriptors(
            incoming
        ):
            cleaned[key] = incoming

    if "formulation_groups" in raw and raw.get("formulation_groups") is not None:
        incoming = form_updates.get("formulation_groups")
        if incoming is not None and _normalize_formulation_groups(
            form_state.get("formulation_groups", [])
        ) != _normalize_formulation_groups(incoming):
            cleaned["formulation_groups"] = incoming

    for key in ("num_rows", "noise", "filename"):
        if key not in raw:
            continue
        incoming = form_updates.get(key)
        if incoming is None:
            continue
        if _normalize_num(incoming) != _normalize_num(form_state.get(key)):
            cleaned[key] = incoming

    for key in ("min_ingredients_per_formulation", "max_ingredients_per_formulation"):
        if key not in raw:
            continue
        incoming_val = raw[key]
        inc_norm = "" if incoming_val is None else _normalize_num(incoming_val)
        current_val = form_state.get(key)
        cur_norm = "" if current_val is None else _normalize_num(current_val)
        if inc_norm != cur_norm:
            cleaned[key] = incoming_val

    return cleaned if cleaned else None


def merge_form_update_dicts(
    previous: dict[str, Any] | None,
    incoming: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Keep previous keys that a retry omitted.

    A correction that only resends the rejected section must not wipe the rest.
    Explicit incoming values, including empty lists, overwrite. ``None`` or an
    empty incoming dict means the model dropped the update; do not resurrect it.
    """
    if not incoming:
        return incoming
    if not previous:
        return dict(incoming)
    merged = {key: value for key, value in previous.items() if value is not None}
    for key, value in incoming.items():
        if value is not None:
            merged[key] = value
    return merged


def _execute_search(query: str) -> list[dict[str, str]]:
    try:
        return search_chemistry_sources([query])[:MAX_SOURCES]
    except Exception as exc:
        logger.warning("web_search failed for %r: %s", query, exc)
        return []


def search_node(state: ChatState) -> dict[str, Any]:
    messages: list[BaseMessage] = [
        SystemMessage(content=SEARCH_PROMPT),
        *_history_messages(state.get("history") or []),
        HumanMessage(content=state["user_message"]),
    ]
    try:
        result = _search_llm().invoke(messages)
    except Exception as exc:
        _raise_llm_error(exc)

    sources: list[dict[str, str]] = []
    seen: set[str] = set()
    for call in getattr(result, "tool_calls", None) or []:
        if call.get("name") != "web_search":
            continue
        query = str((call.get("args") or {}).get("query") or "").strip()
        if not query:
            continue
        for source in _execute_search(query):
            url = source.get("url", "")
            if url and url not in seen:
                seen.add(url)
                sources.append(source)
            if len(sources) >= MAX_SOURCES:
                break
        break
    return {
        "sources": sources,
        "attempts": 0,
        "validation_errors": [],
        "validation_error_log": [],
        "pending_updates": None,
    }


def reply_node(state: ChatState) -> dict[str, Any]:
    form_json = json.dumps(state.get("form_state") or {}, separators=(",", ":"))
    system = (
        SYSTEM_PROMPT
        + "\n\n### Current form state:\n```json\n"
        + form_json
        + "\n```"
        + format_sources_for_finalization(state.get("sources") or [])
    )
    messages: list[BaseMessage] = [
        SystemMessage(content=system),
        *_history_messages(state.get("history") or []),
        HumanMessage(content=state["user_message"]),
    ]
    errors = state.get("validation_errors") or []
    if errors:
        shown = errors[:MAX_VALIDATION_ERRORS_NOTED]
        retry_note = (
            "The application's validator rejected these form_updates:\n- "
            + "\n- ".join(shown)
            + "\nFix only the rejected fields and return the FULL previous "
            "form_updates with those fixes. Do not drop general_inputs, "
            "formulation_groups, or outputs that were already proposed."
        )
        previous = state.get("pending_updates") or state.get("raw_updates")
        if previous:
            retry_note += (
                "\n\nPrevious form_updates:\n```json\n"
                + json.dumps(previous, separators=(",", ":"))
                + "\n```"
            )
        messages.append(HumanMessage(content=retry_note))

    try:
        raw = (
            _reply_llm()
            .with_structured_output(ChatReply, method="json_mode", include_raw=True)
            .invoke(messages)
        )
        reply = parse_chat_reply(raw)
    except HTTPException:
        raise
    except Exception as exc:
        if _is_capacity_error(exc):
            _raise_llm_error(exc)
        try:
            reply = parse_chat_reply(payload_from_parse_error(exc))
        except Exception as recover_exc:
            logger.warning("Could not recover ChatReply from parse error: %s", recover_exc)
            if isinstance(exc, ValidationError) and exc.errors():
                err0 = exc.errors()[0]
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "The LLM returned a malformed response "
                        f"({err0.get('loc', '')}: {err0.get('msg', 'invalid field')}). "
                        "Please try again."
                    ),
                ) from exc
            _raise_llm_error(exc)

    raw_updates = None
    if reply.form_updates is not None:
        raw_updates = reply.form_updates.model_dump(exclude_unset=True)
    if (
        state.get("validation_errors")
        and reply.form_changes_intended
        and raw_updates
    ):
        previous = state.get("pending_updates") or state.get("raw_updates")
        merged = merge_form_update_dicts(previous, raw_updates)
        if merged and merged != raw_updates:
            try:
                reply.form_updates = FormUpdates.model_validate(merged)
                raw_updates = reply.form_updates.model_dump(exclude_unset=True)
            except ValidationError:
                logger.warning("Could not merge retry form_updates over previous attempt")
    return {
        "reply": reply,
        "raw_updates": raw_updates,
        "pending_updates": raw_updates,
        "attempts": int(state.get("attempts") or 0) + 1,
    }


def validate_node(state: ChatState) -> dict[str, Any]:
    reply = state["reply"]
    if (
        not reply.form_changes_intended
        or reply.form_updates is None
        or reply.form_updates.is_empty()
    ):
        return {"validation_errors": []}

    errors = validate_form_updates(state.get("form_state") or {}, reply.form_updates)
    if not errors:
        return {"validation_errors": []}

    log = list(state.get("validation_error_log") or [])
    log.extend(errors)

    if int(state.get("attempts") or 0) < MAX_VALIDATION_ATTEMPTS:
        return {"validation_errors": errors, "validation_error_log": log}

    note = errors[:MAX_VALIDATION_ERRORS_NOTED]
    reply.message += (
        " (I couldn't apply the form changes automatically because they "
        "didn't pass validation: " + "; ".join(note) + ")"
    )
    reply.form_updates = None
    return {
        "reply": reply,
        "raw_updates": None,
        "pending_updates": None,
        "validation_errors": [],
        "validation_error_log": log,
    }


def _should_retry(state: ChatState) -> str:
    if state.get("validation_errors"):
        return "reply"
    return END


def build_graph() -> Any:
    graph = StateGraph(ChatState)
    graph.add_node("search", search_node)
    graph.add_node("reply", reply_node)
    graph.add_node("validate", validate_node)
    graph.add_edge(START, "search")
    graph.add_edge("search", "reply")
    graph.add_edge("reply", "validate")
    graph.add_conditional_edges("validate", _should_retry, {"reply": "reply", END: END})
    return graph.compile()


_GRAPH = None


def run_dataset_generator_chat(
    user_message: str,
    conversation_history: list,
    form_state: dict,
) -> dict[str, Any]:
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_graph()

    state = _GRAPH.invoke(
        {
            "user_message": user_message,
            "history": compact_history(conversation_history or []),
            "form_state": form_state or {},
        }
    )
    reply: ChatReply = state["reply"]
    form_updates = None
    if reply.form_changes_intended and reply.form_updates is not None:
        form_updates = strip_unchanged_updates(
            form_state or {},
            reply.form_updates.model_dump(exclude_none=True),
            raw_updates=state.get("raw_updates"),
        )

    display_message, cited_sources = prepare_cited_sources_for_display(
        reply.message, state.get("sources") or []
    )
    result: dict[str, Any] = {"message": display_message}
    if form_updates is not None:
        result["form_updates"] = form_updates
    if cited_sources:
        result["sources"] = cited_sources
    return result
