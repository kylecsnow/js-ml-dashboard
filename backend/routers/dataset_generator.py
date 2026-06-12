import logging
from typing import Any

import pandas as pd
from fastapi import APIRouter, Body, HTTPException

from utils import build_synthetic_demo_dataset

logger = logging.getLogger(__name__)

router = APIRouter()


def _normalize_formulation_groups(raw_groups: list) -> list[dict]:
    """Normalize the incoming formulation_groups payload into a validated structure.

    Each returned group dict has: name, min, max, min_count, max_count, and an
    ordered list of ingredient dicts {name, min, max, units, required}.
    """
    groups: list[dict] = []
    seen_ingredient_names: set[str] = set()

    for group in raw_groups:
        ingredients_raw = group.get("ingredients", [])
        ingredients: list[dict] = []
        for item in ingredients_raw:
            name = item["name"]
            if name in seen_ingredient_names:
                raise ValueError(
                    f"Duplicate formulation ingredient name '{name}'. Ingredient names must be unique."
                )
            seen_ingredient_names.add(name)
            ingredients.append(
                {
                    "name": name,
                    "min": float(item["min"]),
                    "max": float(item["max"]),
                    "units": item.get("units", ""),
                    "required": bool(item.get("required", False)),
                }
            )

        group_size = len(ingredients)
        group_min = float(group["min"])
        group_max = float(group["max"])

        min_count_raw = group.get("min_ingredients")
        max_count_raw = group.get("max_ingredients")
        min_count = (
            1 if min_count_raw in (None, "") else int(min_count_raw)
        )
        max_count = (
            group_size if max_count_raw in (None, "") else int(max_count_raw)
        )

        groups.append(
            {
                "name": group.get("name", ""),
                "min": group_min,
                "max": group_max,
                "min_count": min_count,
                "max_count": max_count,
                "ingredients": ingredients,
            }
        )

    return groups


def _default_global_ingredient_counts(groups: list[dict]) -> tuple[int, int]:
    """Derive default global min/max present-ingredient counts from group constraints.

    Min is the sum of each group's minimum contribution: 0 if the group may be
    entirely absent (min_count 0 and no required ingredients), otherwise
    max(min_count, number of required ingredients). Clamped to at least 1 when
    there are ingredients. Max is the sum of each group's max_count.
    """
    default_min = 0
    default_max = 0
    for group in groups:
        n_required = sum(1 for i in group["ingredients"] if i.get("required", False))
        min_count = group["min_count"]
        max_count = group["max_count"]
        if min_count == 0 and n_required == 0:
            group_min_contrib = 0
        else:
            group_min_contrib = max(min_count, n_required)
        default_min += group_min_contrib
        default_max += max_count
    if default_min < 1 and default_max > 0:
        default_min = 1
    return default_min, default_max


def _validate_formulation_groups(
    groups: list[dict],
    global_min: int,
    global_max: int,
    total_ingredients: int,
) -> None:
    """Validate group bounds, per-group counts, and global/group reconciliation."""
    for group in groups:
        size = len(group["ingredients"])
        if size == 0:
            raise ValueError(
                f"Group '{group['name'] or '(unnamed)'}' must contain at least one ingredient."
            )
        if not (0.0 <= group["min"] <= 1.0) or not (0.0 <= group["max"] <= 1.0):
            raise ValueError("Group bounds must all have values between 0 and 1.")
        if group["min"] > group["max"]:
            raise ValueError(
                f"Group '{group['name'] or '(unnamed)'}' lower bound cannot exceed its upper bound."
            )
        if group["min_count"] < 0:
            raise ValueError("Group min ingredients cannot be negative.")
        if group["min_count"] > group["max_count"]:
            raise ValueError(
                f"Group '{group['name'] or '(unnamed)'}' min ingredients cannot exceed max ingredients."
            )
        if group["max_count"] > size:
            raise ValueError(
                f"Group '{group['name'] or '(unnamed)'}' max ingredients cannot exceed the number of ingredients in the group."
            )
        for ingredient in group["ingredients"]:
            if not (0.0 <= ingredient["min"] <= 1.0) or not (0.0 <= ingredient["max"] <= 1.0):
                raise ValueError(
                    "Formulation Input bounds must all have values between 0 and 1."
                )
            if ingredient["min"] > ingredient["max"]:
                raise ValueError(
                    f"Ingredient '{ingredient['name']}' lower bound cannot exceed its upper bound."
                )
            if ingredient["required"] and ingredient["min"] <= 0:
                raise ValueError(
                    f"Required formulation ingredient '{ingredient['name']}' must have a lower bound greater than 0."
                )

    # A group is always present if it forces at least one ingredient.
    def _is_forced(group: dict) -> bool:
        return group["min_count"] > 0 or any(i["required"] for i in group["ingredients"])

    if sum(g["max"] for g in groups) < 1.0 - 1e-9:
        raise ValueError(
            "The sum of all group upper bounds is less than 1.0, so ingredient amounts cannot sum to 100%."
        )
    forced_lower_sum = sum(g["min"] for g in groups if _is_forced(g))
    if forced_lower_sum > 1.0 + 1e-9:
        raise ValueError(
            "The sum of lower bounds for always-present groups exceeds 1.0; no feasible formulation exists."
        )

    if global_min < 1:
        raise ValueError("min_ingredients_per_formulation must be at least 1.")
    if global_min > global_max:
        raise ValueError(
            f"min_ingredients_per_formulation (provided: {global_min}) cannot be greater than "
            f"max_ingredients_per_formulation (provided: {global_max})."
        )
    if global_max > total_ingredients:
        raise ValueError(
            f"max_ingredients_per_formulation (provided: {global_max}) cannot exceed the total number of ingredients (provided: {total_ingredients})."
        )

    # Forced groups must contribute at least their min_count present ingredients.
    forced_min_total = sum(
        max(g["min_count"], sum(1 for i in g["ingredients"] if i["required"]))
        for g in groups
        if _is_forced(g)
    )
    if forced_min_total > global_max:
        raise ValueError(
            f"The minimum number of ingredients forced by groups ({forced_min_total}) exceeds "
            f"max_ingredients_per_formulation ({global_max})."
        )
    if sum(g["max_count"] for g in groups) < global_min:
        raise ValueError(
            f"The total of all group max ingredient counts is less than "
            f"min_ingredients_per_formulation ({global_min})."
        )


@router.post("/api/dataset-generator")
async def get_synthetic_demo_dataset(body: dict = Body(...)) -> dict[str, Any]:

    try:
        general_inputs = body.get("general_inputs", [])
        raw_formulation_groups = body.get("formulation_groups")
        legacy_formulation_inputs = body.get("formulation_inputs", [])
        outputs = body.get("outputs", [])
        num_rows = body.get("num_rows", [])
        noise = body.get("noise", 0.05)
        output_format = body.get("output_format", "compact")
        min_ingredients_per_formulation = body.get("min_ingredients_per_formulation")
        max_ingredients_per_formulation = body.get("max_ingredients_per_formulation")

        general_inputs = {item["name"]: {"min": float(item["min"]), "max": float(item["max"]), "units": item["units"]} for item in general_inputs}
        outputs = {item["name"]: {"min": float(item["min"]), "max": float(item["max"]), "units": item["units"]} for item in outputs}

        # Determine whether the request uses the new grouped structure or the
        # legacy flat formulation_inputs list (which is treated as a single
        # implicit group spanning all ingredients).
        use_groups = raw_formulation_groups is not None
        if use_groups:
            normalized_groups = _normalize_formulation_groups(raw_formulation_groups)
        elif legacy_formulation_inputs:
            normalized_groups = _normalize_formulation_groups(
                [
                    {
                        "name": "",
                        "min": 0.0,
                        "max": 1.0,
                        "ingredients": legacy_formulation_inputs,
                    }
                ]
            )
        else:
            normalized_groups = []

        # Flatten ingredients (preserving group order) into the dict shape the
        # dataset builder expects, plus a parallel (ingredient -> group name) map.
        formulation_inputs: dict[str, dict] = {}
        ingredient_group_names: list[str] = []
        for group in normalized_groups:
            for ingredient in group["ingredients"]:
                formulation_inputs[ingredient["name"]] = {
                    "min": ingredient["min"],
                    "max": ingredient["max"],
                    "units": ingredient["units"],
                    "required": ingredient["required"],
                }
                ingredient_group_names.append(group["name"])

        inputs = {
            "general": general_inputs,
            "formulation": formulation_inputs,
        }

        formulation_groups_for_builder = None
        if formulation_inputs:
            n_ingredients = len(formulation_inputs)

            if use_groups:
                default_global_min, default_global_max = _default_global_ingredient_counts(
                    normalized_groups
                )
            else:
                default_global_min = n_ingredients
                default_global_max = n_ingredients

            min_ingredients_per_formulation = (
                int(min_ingredients_per_formulation)
                if min_ingredients_per_formulation not in (None, "")
                else default_global_min
            )
            max_ingredients_per_formulation = (
                int(max_ingredients_per_formulation)
                if max_ingredients_per_formulation not in (None, "")
                else default_global_max
            )

            if use_groups:
                _validate_formulation_groups(
                    normalized_groups,
                    min_ingredients_per_formulation,
                    max_ingredients_per_formulation,
                    n_ingredients,
                )
                formulation_groups_for_builder = [
                    {
                        "min": group["min"],
                        "max": group["max"],
                        "min_count": group["min_count"],
                        "max_count": group["max_count"],
                        "ingredients": [i["name"] for i in group["ingredients"]],
                    }
                    for group in normalized_groups
                ]
            else:
                # Legacy single-group behaviour: reconcile global counts as before.
                if min_ingredients_per_formulation < 1:
                    raise ValueError("min_ingredients_per_formulation must be at least 1.")
                if min_ingredients_per_formulation > max_ingredients_per_formulation:
                    raise ValueError(
                        f"min_ingredients_per_formulation (provided: {min_ingredients_per_formulation}) cannot be greater than max_ingredients_per_formulation (provided: {max_ingredients_per_formulation})."
                    )
                if max_ingredients_per_formulation > n_ingredients:
                    raise ValueError(
                        f"max_ingredients_per_formulation (provided: {max_ingredients_per_formulation}) cannot exceed n_ingredients (provided: {n_ingredients})."
                    )

                n_required = sum(1 for spec in formulation_inputs.values() if spec["required"])
                if n_required > max_ingredients_per_formulation:
                    raise ValueError(
                        f"Number of required ingredients ({n_required}) cannot exceed "
                        f"max_ingredients_per_formulation ({max_ingredients_per_formulation})."
                    )
                if min_ingredients_per_formulation < n_required:
                    min_ingredients_per_formulation = n_required
                for name, spec in formulation_inputs.items():
                    if spec["required"] and spec["min"] <= 0:
                        raise ValueError(
                            f"Required formulation ingredient '{name}' must have a lower bound greater than 0."
                        )
        else:
            min_ingredients_per_formulation = None
            max_ingredients_per_formulation = None

        if output_format not in ("compact", "wide"):
            raise ValueError("output_format must be either 'compact' or 'wide'.")

        synthetic_demo_data_df, synthetic_demo_coefs_df = build_synthetic_demo_dataset(
            inputs=inputs,
            outputs=outputs,
            num_rows=num_rows,
            noise=noise,
            coefs=None,
            output_format=output_format,
            min_ingredients_per_formulation=min_ingredients_per_formulation,
            max_ingredients_per_formulation=max_ingredients_per_formulation,
            formulation_groups=formulation_groups_for_builder,
        )
        synthetic_demo_data_df["Formulation_ID"] = synthetic_demo_data_df.index + 1
        ordered_columns = ["Formulation_ID"] + [
            col for col in synthetic_demo_data_df.columns if col != "Formulation_ID"
        ]
        synthetic_demo_data_df = synthetic_demo_data_df[ordered_columns]
        csv_string = synthetic_demo_data_df.to_csv(index=None)
        response_payload: dict[str, Any] = {"csv_string": csv_string}

        if formulation_inputs:
            components_df = pd.DataFrame(
                {
                    "id": list(formulation_inputs.keys()),
                    "Group": ingredient_group_names,
                    "SMILES": [""] * len(formulation_inputs),
                }
            )
            response_payload["components_csv_string"] = (
                components_df.to_csv(index=None)
            )

        return response_payload

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))
