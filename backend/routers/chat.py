import json
import logging
import os
from typing import Any

from fastapi import APIRouter, Body, HTTPException
from groq import Groq
from pydantic import ValidationError

from chemistry_search import (
    filter_cited_sources,
    format_sources_for_prompt,
    search_chemistry_sources,
)
from form_contracts import ChatReply
from form_validation import validate_form_updates

logger = logging.getLogger(__name__)

router = APIRouter()

CHAT_MODEL = "openai/gpt-oss-120b"
MAX_TOOL_CALLS = 3
MAX_CORRECTION_ATTEMPTS = 2
MAX_VALIDATION_ERRORS_NOTED = 2

# The form schema is machine-validated by form_validation (which reuses the
# dataset generator's validators), so the prompt only needs to carry the
# judgment the model must exercise: what to generate, when to search, and
# when to change the form at all.
DATASET_GENERATOR_CHAT_SYSTEM_PROMPT = """\
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
Output — never a General Input. Anything that goes INTO the mixture (monomers, \
additives, photoinitiators, fillers, solvents...) is a Formulation Input.
- Match the user's granularity: if they name a specific chemical or product \
("Irganox 819"), add other specific real ones from the same field (e.g. "TPO") and \
never a vaguer role name; if they use generic names ("Monomer A"), incremental \
generics are fine ("Monomer B"); if they name nothing, use specific real chemicals \
commonly used in the domain.
- Only include ingredients genuinely used in the user's application domain (e.g. \
surfactants belong in detergents, not DLP 3D printing resins). Where formulators \
routinely choose among alternatives, include 2-3 specific examples; where one \
choice dominates, one ingredient is fine. Keep the set representative — about 10 \
ingredients is a good starting point, with a soft ceiling of 20.
- Organize ingredients into 2-5 groups by functional role; every ingredient \
belongs to exactly one group.
- Give every variable a realistic, domain-based min/max range — do not copy the \
same 0-100 defaults onto every output (e.g. tensile strength MPa ~ 5-90, UV \
exposure seconds ~ 5-120, curing temperature degC ~ 20-200, viscosity cP ~ \
100-10000 — tailor each to the system and units you chose).
- Never change num_rows or noise unless the user directly asks.
- For "start over", "start from scratch", "delete everything", or a domain change: \
remove ALL existing variables first, then add the new ones. If the intent is \
ambiguous, ask a clarifying question before changing anything.

### Web search tool
- Call `web_search` with one focused query when the user asks you to search, look \
up, or find information, or before stating specific facts (loadings, concentration \
or property ranges, ingredient roles, alternatives) that you are not confident \
about.
- Do NOT call it for pure form edits, settings changes, or chit-chat.

### Citing sources
- Cite sources you relied on inline as markdown links: [short title](url). Only \
cite URLs the tool returned; never invent citations; citing none is fine when \
nothing is relevant.
- Do NOT add your own "Sources", "References", or "Citations" section anywhere — \
the application automatically displays the sources you cite inline.

### Behavior
- Informational questions ("what does X do?", "is this reasonable?", "tell me more \
about X") are conversational: set form_changes_intended to false and return no \
form_updates.
- Set form_changes_intended to true ONLY when the user asked to add, remove, \
modify, or set up form variables.
- The application replaces each category's contents wholesale, so when changing a \
category return its FULL new list (existing items plus/minus the change) — never a \
partial list or a delta.
- "Make X required / always included" → required: true with min > 0; "optional / \
may be omitted" → required: false. New ingredients default to required: false.

### Response
Respond with a single JSON object:
{"message": "<your reply>", "form_changes_intended": true|false, "form_updates": {...}|null}

In form_updates, include only the keys that should change:
- general_inputs / outputs: [{"name", "min", "max", "units"}] — min and max are \
STRINGS.
- formulation_groups: [{"name", "min", "max", "min_ingredients", "max_ingredients", \
"ingredients": [{"name", "min", "max", "required"}]}] — group min/max and \
ingredient min/max are STRINGS in [0, 1] (5% is "0.05", not "5"); \
min_ingredients/max_ingredients are integers or null.
- num_rows (integer), noise (float), filename (string), \
min_ingredients_per_formulation / max_ingredients_per_formulation (integers or null).

Every name (variable or group) is a clean label: no parentheses, no units embedded \
in the name (units go in the "units" field), and one specificity level per \
ingredient (specific OR generic, never both).

The application validates proposed updates (bounds, group-sum feasibility, count \
consistency, name hygiene) and returns the exact errors to you if any fail, so you \
do not need to audit those rules yourself — just be careful.
"""

WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": (
            "Search the web for chemistry/formulation facts to ground a claim. "
            "Call it when the user asks you to search or look something up, or "
            "before stating specific facts (loadings, typical ranges, roles, "
            "alternatives) you are not confident about. Do not call it for pure "
            "form edits, settings changes, or chit-chat."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "One focused search query (noun phrase).",
                }
            },
            "required": ["query"],
        },
    },
}


def _normalize_num(val: Any) -> str:
    """Normalize a numeric value so '0', '0.0', and 0 all compare equal."""
    try:
        return str(float(val))
    except (ValueError, TypeError):
        return str(val)


def _normalize_descriptors(
    items: list[dict] | None,
) -> list[tuple[str, str, str, str]]:
    """Convert descriptor dicts to canonical tuples for comparison."""
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
    """Normalize an optional integer count; None and '' both map to ''."""
    if val in (None, ""):
        return ""
    return _normalize_num(val)


def _normalize_formulation_groups(items: list[dict] | None) -> list[tuple]:
    """Convert formulation group dicts to canonical tuples for comparison."""
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


def _strip_unchanged_updates(
    form_state: dict,
    form_updates: dict,
    raw_updates: dict | None = None,
) -> dict | None:
    """Remove form_updates keys whose values match form_state.

    ``raw_updates`` is the LLM's raw JSON for form_updates (before Pydantic
    defaults were applied); it is the only way to distinguish "the model
    explicitly set this key" from "the model omitted it", which matters for the
    two nullable count fields (an explicit null means "reset to derived
    default"). Returns the pruned dict, or None if nothing actually changed.
    """
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
        current = form_state.get(key, [])
        if _normalize_descriptors(current) != _normalize_descriptors(incoming):
            cleaned[key] = incoming

    if "formulation_groups" in raw and raw.get("formulation_groups") is not None:
        incoming = form_updates.get("formulation_groups")
        if incoming is not None:
            current = form_state.get("formulation_groups", [])
            if _normalize_formulation_groups(current) != _normalize_formulation_groups(incoming):
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
        incoming_val = raw[key]  # may be None == explicit reset
        inc_norm = "" if incoming_val is None else _normalize_num(incoming_val)
        current_val = form_state.get(key)
        cur_norm = "" if current_val is None else _normalize_num(current_val)
        if inc_norm != cur_norm:
            cleaned[key] = incoming_val

    return cleaned if cleaned else None


def _extract_json_object(text: str) -> str:
    """Return the first balanced top-level JSON object in ``text``.

    Tolerates prose or markdown fences around the JSON (we can no longer
    force JSON mode when tools are enabled).
    """
    start = text.find("{")
    if start == -1:
        raise ValueError("no JSON object found in response")
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    raise ValueError("unbalanced JSON object in response")


def _parse_reply(raw: str | None) -> tuple[ChatReply, dict | None]:
    """Parse and type-check the LLM's JSON response.

    Returns the validated ``ChatReply`` plus the raw ``form_updates`` dict
    exactly as the model emitted it (including any explicit ``null`` values),
    so downstream code can tell an omitted key from a key set to null.
    """
    if not raw:
        raise HTTPException(
            status_code=502,
            detail="The LLM returned an empty response. Please try again.",
        )
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        try:
            data = json.loads(_extract_json_object(raw))
        except (ValueError, json.JSONDecodeError) as exc:
            raise HTTPException(
                status_code=502,
                detail="The LLM returned an invalid JSON response. Please try again.",
            ) from exc
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=502,
            detail="The LLM returned a malformed response (expected a JSON object). Please try again.",
        )
    raw_updates = data.get("form_updates")
    raw_updates = raw_updates if isinstance(raw_updates, dict) else None
    try:
        reply = ChatReply.model_validate(data)
    except ValidationError as exc:
        first = exc.errors()[0] if exc.errors() else {}
        raise HTTPException(
            status_code=502,
            detail=(
                "The LLM returned a malformed response "
                f"({first.get('loc', '')}: {first.get('msg', 'invalid field')}). "
                "Please try again."
            ),
        ) from exc
    return reply, raw_updates


def _extract_query(arguments: str | None) -> str:
    if not arguments:
        return ""
    try:
        data = json.loads(arguments)
        query = data.get("query", "") if isinstance(data, dict) else ""
    except json.JSONDecodeError:
        query = arguments
    return str(query).strip()


def _run_web_search(query: str) -> list[dict[str, str]]:
    """Execute the web_search tool: search and format the results block."""
    if not query:
        return []
    try:
        return search_chemistry_sources([query])
    except Exception as exc:  # tool failure must not kill the chat
        logger.warning("web_search tool failed for %r: %s", query, exc)
        return []


def _append_tool_round(
    messages: list[dict], message: Any
) -> list[tuple[str, list[dict[str, str]]]]:
    """Append the assistant tool-call message and execute each web_search call.

    Returns the (query, sources) pairs so the caller can accumulate sources.
    """
    calls = [
        call
        for call in (message.tool_calls or [])
        if call.function.name == "web_search"
    ][:MAX_TOOL_CALLS]

    messages.append(
        {
            "role": "assistant",
            "content": message.content,
            "tool_calls": [
                {
                    "id": call.id,
                    "type": "function",
                    "function": {
                        "name": call.function.name,
                        "arguments": call.function.arguments,
                    },
                }
                for call in calls
            ],
        }
    )

    pairs: list[tuple[str, list[dict[str, str]]]] = []
    for call in calls:
        query = _extract_query(call.function.arguments)
        sources = _run_web_search(query)
        pairs.append((query, sources))
        block = format_sources_for_prompt(sources)
        messages.append(
            {
                "role": "tool",
                "tool_call_id": call.id,
                "content": block
                or "No sources were found for that query. Answer from general knowledge and do not invent links.",
            }
        )
    return pairs


def _validation_feedback(errors: list[str]) -> str:
    shown = errors[:MAX_VALIDATION_ERRORS_NOTED]
    more = f" (+{len(errors) - len(shown)} more)" if len(errors) > len(shown) else ""
    return (
        "Your proposed form_updates were rejected by the application's validator:"
        f"\n- " + "\n- ".join(shown) + more
        + "\nReturn the same JSON schema with corrected, valid form_updates."
    )


@router.post("/api/chat/dataset-generator")
async def chat_dataset_generator(body: dict = Body(...)) -> dict[str, Any]:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY environment variable is not set.",
        )

    user_message: str = body.get("message", "")
    conversation_history: list = body.get("conversation_history", [])
    form_state: dict = body.get("form_state", {})

    if not user_message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    current_state_block = (
        "\n\n### Current form state:\n```json\n"
        + json.dumps(form_state, indent=2)
        + "\n```"
    )

    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": DATASET_GENERATOR_CHAT_SYSTEM_PROMPT + current_state_block,
        },
    ]
    for entry in conversation_history:
        messages.append({"role": entry["role"], "content": entry["content"]})
    messages.append({"role": "user", "content": user_message})

    client = Groq(api_key=api_key)

    all_sources: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    def _add_sources(sources: list[dict[str, str]]) -> None:
        for source in sources:
            url = source.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_sources.append(source)

    reply: ChatReply | None = None
    correction_attempts = 0
    while True:
        try:
            completion = client.chat.completions.create(
                model=CHAT_MODEL,
                messages=messages,
                temperature=0.2,
                tools=[WEB_SEARCH_TOOL],
                tool_choice="auto",
            )
        except Exception as e:
            logger.error(f"Chat endpoint error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

        choice = completion.choices[0]
        if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
            for _query, sources in _append_tool_round(messages, choice.message):
                _add_sources(sources)
            continue

        reply, raw_updates = _parse_reply(choice.message.content)

        if (
            reply.form_changes_intended
            and reply.form_updates is not None
            and not reply.form_updates.is_empty()
        ):
            errors = validate_form_updates(form_state, reply.form_updates)
            if not errors:
                break
            if correction_attempts < MAX_CORRECTION_ATTEMPTS:
                correction_attempts += 1
                messages.append({"role": "assistant", "content": choice.message.content})
                messages.append({"role": "user", "content": _validation_feedback(errors)})
                continue
            # Out of correction attempts: keep the message, drop the invalid
            # update, and tell the user why instead of shipping a broken form.
            logger.warning(
                "Form updates failed validation after %d correction attempts: %s",
                correction_attempts,
                errors,
            )
            note_errors = errors[:MAX_VALIDATION_ERRORS_NOTED]
            reply.message += (
                " (I couldn't apply the form changes automatically because they "
                "didn't pass validation: " + "; ".join(note_errors) + ")"
            )
            reply.form_updates = None
            break
        break

    if reply is None:  # pragma: no cover - defensive
        raise HTTPException(status_code=502, detail="No response from the LLM.")

    form_updates: dict | None = None
    if reply.form_changes_intended and reply.form_updates is not None:
        # Keep only keys the LLM actually provided that differ from form_state.
        form_updates = _strip_unchanged_updates(
            form_state,
            reply.form_updates.model_dump(exclude_none=True),
            raw_updates=raw_updates,
        )

    result: dict[str, Any] = {"message": reply.message}
    if form_updates is not None:
        result["form_updates"] = form_updates

    # Surface the sources the assistant actually cited inline, not every hit.
    cited_sources = filter_cited_sources(reply.message, all_sources)
    if cited_sources:
        result["sources"] = cited_sources

    return result
