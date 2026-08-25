"""Deterministic validation of LLM-proposed form updates.

The rules the model used to be asked to self-audit in the system prompt are
enforced here in code instead. ``validate_form_updates`` merges the proposed
update over the current form state and runs the same checks the dataset
generator endpoint already runs (``routers.dataset_generator``), plus the
name-hygiene checks that endpoint does not enforce.

Failures are reported as a list of human-readable strings — the endpoint feeds
them back to the model for a bounded correction attempt.
"""

from __future__ import annotations

import re
from typing import Any

from form_contracts import FormUpdates
from routers.dataset_generator import (
    _default_global_ingredient_counts,
    _normalize_formulation_groups,
    _validate_formulation_groups,
)

_PARENTHETICAL_RE = re.compile(r"[\(\)]")


def _descriptor_dict(item: Any) -> dict[str, Any]:
    """Coerce a Descriptor/Ingredient (pydantic model or dict) to the dict
    shape ``routers.dataset_generator`` validators expect."""
    if hasattr(item, "model_dump"):
        data = item.model_dump()
    else:
        data = dict(item)
    return {
        "name": (data.get("name") or "").strip(),
        "min": data.get("min", ""),
        "max": data.get("max", ""),
        "units": data.get("units", "") or "",
        "required": bool(data.get("required", False)),
    }


def _check_names(groups: list[dict], descriptors: list[dict], field: str) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    for item in descriptors:
        name = item.get("name", "").strip()
        if not name:
            errors.append(f"{field}: an item has an empty name.")
            continue
        if name in seen:
            errors.append(f"{field}: duplicate name '{name}'.")
        seen.add(name)
        if _PARENTHETICAL_RE.search(name):
            errors.append(
                f"{field}: name '{name}' contains parentheses — names must be clean; "
                "put any detail in the units field or a different variable."
            )
    for group in groups:
        gname = group.get("name", "")
        if _PARENTHETICAL_RE.search(gname):
            errors.append(
                f"formulation_groups: group name '{gname}' contains parentheses — "
                "group names must be clean."
            )
        ing_seen: set[str] = set()
        for ing in group.get("ingredients", []):
            iname = ing.get("name", "").strip()
            if not iname:
                errors.append("formulation_groups: an ingredient has an empty name.")
                continue
            if iname in ing_seen:
                errors.append(f"formulation_groups: duplicate ingredient name '{iname}'.")
            ing_seen.add(iname)
    return errors


def validate_form_updates(form_state: dict, updates: FormUpdates) -> list[str]:
    """Validate an LLM-proposed update against the merged form state.

    Returns a list of human-readable error strings; empty list means the
    update is valid and safe to send to the frontend / dataset generator.
    """
    errors: list[str] = []

    state = dict(form_state or {})
    if updates.general_inputs is not None:
        state["general_inputs"] = updates.general_inputs
    if updates.formulation_groups is not None:
        state["formulation_groups"] = updates.formulation_groups
    if updates.outputs is not None:
        state["outputs"] = updates.outputs
    if updates.min_ingredients_per_formulation is not None:
        state["min_ingredients_per_formulation"] = updates.min_ingredients_per_formulation
    if updates.max_ingredients_per_formulation is not None:
        state["max_ingredients_per_formulation"] = updates.max_ingredients_per_formulation

    general_inputs = [
        _descriptor_dict(item) for item in (state.get("general_inputs") or [])
    ]
    outputs = [_descriptor_dict(item) for item in (state.get("outputs") or [])]

    for field, items in (("general_inputs", general_inputs), ("outputs", outputs)):
        for item in items:
            try:
                lo, hi = float(item["min"]), float(item["max"])
            except (TypeError, ValueError):
                errors.append(
                    f"{field}: '{item.get('name')}' has a non-numeric min or max "
                    f"({item.get('min')!r}, {item.get('max')!r}) — bounds must be numbers."
                )
                continue
            if lo > hi:
                errors.append(
                    f"{field}: '{item['name']}' lower bound ({lo}) exceeds its upper bound ({hi})."
                )

    groups_in = state.get("formulation_groups")
    raw_groups = []
    for group in groups_in or []:
        g = dict(group) if not hasattr(group, "model_dump") else group.model_dump()
        g["ingredients"] = [_descriptor_dict(i) for i in (g.get("ingredients") or [])]
        raw_groups.append(g)

    # Name hygiene applies regardless of whether the update touches groups.
    errors.extend(_check_names(raw_groups, general_inputs, "general_inputs"))
    errors.extend(_check_names(raw_groups, outputs, "outputs"))
    for group in raw_groups:
        for ing in group["ingredients"]:
            if _PARENTHETICAL_RE.search(ing.get("name", "")):
                errors.append(
                    f"formulation_groups: ingredient '{ing['name']}' contains parentheses — "
                    "names must be clean."
                )

    if not raw_groups:
        return errors

    try:
        normalized = _normalize_formulation_groups(raw_groups)
    except (KeyError, ValueError) as exc:
        errors.append(f"formulation_groups: {exc}")
        return errors

    total_ingredients = sum(len(g["ingredients"]) for g in normalized)

    raw_min = state.get("min_ingredients_per_formulation")
    raw_max = state.get("max_ingredients_per_formulation")
    default_min, default_max = _default_global_ingredient_counts(normalized)
    global_min = int(raw_min) if raw_min not in (None, "") else default_min
    global_max = int(raw_max) if raw_max not in (None, "") else default_max

    try:
        _validate_formulation_groups(
            normalized, global_min, global_max, total_ingredients
        )
    except ValueError as exc:
        errors.append(str(exc))

    return errors
