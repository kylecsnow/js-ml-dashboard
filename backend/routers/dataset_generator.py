import logging
from typing import Any

import pandas as pd
from fastapi import APIRouter, Body, HTTPException

from utils import build_synthetic_demo_dataset

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/api/dataset-generator")
async def get_synthetic_demo_dataset(body: dict = Body(...)) -> dict[str, Any]:

    try:
        general_inputs = body.get("general_inputs", [])
        formulation_inputs = body.get("formulation_inputs", {})
        outputs = body.get("outputs", [])
        num_rows = body.get("num_rows", [])
        noise = body.get("noise", 0.05)
        output_format = body.get("output_format", "compact")
        min_ingredients_per_formulation = body.get("min_ingredients_per_formulation")
        max_ingredients_per_formulation = body.get("max_ingredients_per_formulation")

        ### TODO: maybe make a function for this operation, instead of explicitly repreating it a bunch of times? (for better readability?)
        general_inputs = {item["name"]: {"min": float(item["min"]), "max": float(item["max"]), "units": item["units"]} for item in general_inputs}
        formulation_inputs = {
            item["name"]: {
                "min": float(item["min"]),
                "max": float(item["max"]),
                "units": item["units"],
                "required": bool(item.get("required", False)),
            }
            for item in formulation_inputs
        }
        outputs = {item["name"]: {"min": float(item["min"]), "max": float(item["max"]), "units": item["units"]} for item in outputs}
        inputs = {
            "general": general_inputs,
            "formulation": formulation_inputs,
        }

        if formulation_inputs:
            n_ingredients = len(formulation_inputs)

            min_ingredients_per_formulation = (
                int(min_ingredients_per_formulation)
                if min_ingredients_per_formulation not in (None, "")
                else n_ingredients
            )
            max_ingredients_per_formulation = (
                int(max_ingredients_per_formulation)
                if max_ingredients_per_formulation not in (None, "")
                else n_ingredients
            )

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
            output_format=output_format,
            min_ingredients_per_formulation=min_ingredients_per_formulation,
            max_ingredients_per_formulation=max_ingredients_per_formulation,
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
                    "Group": [""] * len(formulation_inputs),
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
