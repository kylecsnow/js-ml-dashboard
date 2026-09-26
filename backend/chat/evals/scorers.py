"""Score one golden-set result.

Scorers grade only the expect keys that are set. Each score is 0.0 or 1.0.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Mapping
from typing import Any

from pydantic import ValidationError

from chat.chemistry_search import (
    _normalize_url,
    extract_cited_urls,
    filter_cited_sources,
)
from chat.evals.schema import Expect, GoldenCase
from chat.form_contracts import FormUpdates
from chat.form_validation import validate_form_updates

_DIGIT_RE = re.compile(r"\d")

Scorer = Callable[[Any, dict[str, Any], dict[str, Any]], bool]


def _expect_map(case: Any, result: Mapping[str, Any]) -> dict[str, Any]:
    expect = getattr(case, "expect", None)
    if expect is None and isinstance(case, Mapping):
        expect = case.get("expect")
    if expect is None:
        expect = result.get("expect")
    if isinstance(expect, Expect):
        return expect.model_dump(exclude_none=True)
    if isinstance(expect, Mapping):
        return {key: value for key, value in expect.items() if value is not None}
    return {}


def _applied(result: Mapping[str, Any]) -> dict[str, Any]:
    applied = result.get("applied_updates")
    return applied if isinstance(applied, dict) else {}


def _merged_form(result: Mapping[str, Any]) -> dict[str, Any]:
    form_state = dict(result.get("form_state") or {})
    form_state.update(_applied(result))
    return form_state


def _items(form: Mapping[str, Any], key: str) -> list[dict[str, Any]]:
    value = form.get(key) or []
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _names(items: list[dict[str, Any]]) -> list[str]:
    names: list[str] = []
    for item in items:
        name = item.get("name")
        if isinstance(name, str) and name.strip():
            names.append(name.strip())
    return names


def _name_set(items: list[dict[str, Any]]) -> set[str]:
    return {name.casefold() for name in _names(items)}


def _groups(form: Mapping[str, Any]) -> list[dict[str, Any]]:
    return _items(form, "formulation_groups")


def _ingredient_names(form: Mapping[str, Any]) -> list[str]:
    names: list[str] = []
    for group in _groups(form):
        names.extend(_names(group.get("ingredients") or []))
    return names


def _ingredient_name_set(form: Mapping[str, Any]) -> set[str]:
    return {name.casefold() for name in _ingredient_names(form)}


def _in_range(count: int, bounds: Any) -> bool:
    low, high = bounds
    return int(low) <= count <= int(high)


def _contains_all(haystack: set[str], required: list[str]) -> bool:
    return all(name.casefold() in haystack for name in required)


def _reply_message(result: Mapping[str, Any]) -> str:
    reply = result.get("reply") or {}
    if isinstance(reply, Mapping) and isinstance(reply.get("message"), str):
        return reply["message"]
    message = result.get("message")
    return message if isinstance(message, str) else ""


def _retrieved_urls(result: Mapping[str, Any]) -> set[str]:
    urls: set[str] = set()
    for source in result.get("retrieved_sources") or []:
        if isinstance(source, Mapping) and source.get("url"):
            urls.add(_normalize_url(str(source["url"])))
    return urls


def _resolved_cited_sources(result: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    """Prefer runner-populated cited_sources; else use the UI citation parser."""
    cited = result.get("cited_sources")
    if isinstance(cited, list) and cited:
        return [item for item in cited if isinstance(item, Mapping)]
    retrieved = result.get("retrieved_sources") or []
    if not isinstance(retrieved, list):
        retrieved = []
    return filter_cited_sources(_reply_message(result), retrieved)


def _score_form_changes_intended(
    expected: Any, result: dict[str, Any], _form: dict[str, Any]
) -> bool:
    return result.get("form_changes_intended") is bool(expected)


def _score_has_form_updates(
    expected: Any, result: dict[str, Any], _form: dict[str, Any]
) -> bool:
    return bool(_applied(result)) is bool(expected)


def _score_search_called(
    expected: Any, result: dict[str, Any], _form: dict[str, Any]
) -> bool:
    return bool(result.get("search_called")) is bool(expected)


def _score_num_rows(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    return form.get("num_rows") == expected


def _score_untouched_keys(
    expected: Any, result: dict[str, Any], _form: dict[str, Any]
) -> bool:
    applied = _applied(result)
    return all(key not in applied for key in expected)


def _score_require_sections(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    return all(len(_items(form, section)) > 0 for section in expected)


def _score_group_count(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    return _in_range(len(_groups(form)), expected)


def _score_ingredient_count(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    return _in_range(len(_ingredient_names(form)), expected)


def _score_must_pass_validator(
    expected: Any, result: dict[str, Any], _form: dict[str, Any]
) -> bool:
    applied = _applied(result)
    if not applied:
        return not bool(expected)
    try:
        updates = FormUpdates.model_validate(applied)
    except ValidationError:
        return not bool(expected)
    errors = validate_form_updates(result.get("form_state") or {}, updates)
    passed = not errors
    return passed is bool(expected)


def _score_require_citations(
    expected: Any, result: dict[str, Any], _form: dict[str, Any]
) -> bool:
    cited = bool(_resolved_cited_sources(result)) or bool(
        extract_cited_urls(_reply_message(result))
    )
    return cited is bool(expected)


def _score_citations_subset(
    expected: Any, result: dict[str, Any], _form: dict[str, Any]
) -> bool:
    cited = extract_cited_urls(_reply_message(result))
    for source in _resolved_cited_sources(result):
        url = source.get("url")
        if url:
            cited.add(_normalize_url(str(url)))
    allowed = _retrieved_urls(result)
    subset = not cited or cited <= allowed
    return subset is bool(expected)


def _score_require_ingredient_names(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    return _contains_all(_ingredient_name_set(form), list(expected))


def _score_require_group_name_substrings(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    group_names = [name.casefold() for name in _names(_groups(form))]
    return all(
        any(needle.casefold() in name for name in group_names) for needle in expected
    )


def _score_require_existing_group_names(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    return _contains_all(_name_set(_groups(form)), list(expected))


def _score_require_existing_ingredient_names(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    return _contains_all(_ingredient_name_set(form), list(expected))


def _score_require_existing_general_input_names(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    return _contains_all(_name_set(_items(form, "general_inputs")), list(expected))


def _score_require_existing_output_names(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    return _contains_all(_name_set(_items(form, "outputs")), list(expected))


def _score_min_ingredients_in_groups(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    groups_by_name = {name.casefold(): group for name, group in (
        (group.get("name", ""), group) for group in _groups(form)
    ) if isinstance(name, str)}
    for group_name, minimum in dict(expected).items():
        group = groups_by_name.get(str(group_name).casefold())
        if group is None:
            return False
        if len(_names(group.get("ingredients") or [])) < int(minimum):
            return False
    return True


def _score_min_groups(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    return len(_groups(form)) >= int(expected)


def _score_min_general_inputs(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    return len(_items(form, "general_inputs")) >= int(expected)


def _score_min_outputs(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    return len(_items(form, "outputs")) >= int(expected)


def _score_formulation_groups_empty(
    expected: Any, _result: dict[str, Any], form: dict[str, Any]
) -> bool:
    return (len(_groups(form)) == 0) is bool(expected)


def _score_require_numeric_message(
    expected: Any, result: dict[str, Any], _form: dict[str, Any]
) -> bool:
    has_digit = bool(_DIGIT_RE.search(_reply_message(result)))
    return has_digit is bool(expected)


_SCORERS: dict[str, Scorer] = {
    "form_changes_intended": _score_form_changes_intended,
    "has_form_updates": _score_has_form_updates,
    "search_called": _score_search_called,
    "num_rows": _score_num_rows,
    "untouched_keys": _score_untouched_keys,
    "require_sections": _score_require_sections,
    "group_count": _score_group_count,
    "ingredient_count": _score_ingredient_count,
    "must_pass_validator": _score_must_pass_validator,
    "require_citations": _score_require_citations,
    "citations_subset": _score_citations_subset,
    "require_ingredient_names": _score_require_ingredient_names,
    "require_group_name_substrings": _score_require_group_name_substrings,
    "require_existing_group_names": _score_require_existing_group_names,
    "require_existing_ingredient_names": _score_require_existing_ingredient_names,
    "require_existing_general_input_names": _score_require_existing_general_input_names,
    "require_existing_output_names": _score_require_existing_output_names,
    "min_ingredients_in_groups": _score_min_ingredients_in_groups,
    "min_groups": _score_min_groups,
    "min_general_inputs": _score_min_general_inputs,
    "min_outputs": _score_min_outputs,
    "formulation_groups_empty": _score_formulation_groups_empty,
    "require_numeric_message": _score_require_numeric_message,
}


def score_case(case: GoldenCase | Mapping[str, Any], result: dict[str, Any]) -> dict[str, float]:
    form = _merged_form(result)
    scores: dict[str, float] = {}
    for name, expected in _expect_map(case, result).items():
        scorer = _SCORERS.get(name)
        if scorer is None:
            continue
        scores[name] = 1.0 if scorer(expected, result, form) else 0.0
    return scores
