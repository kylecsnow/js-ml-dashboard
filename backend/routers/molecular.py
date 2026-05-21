import json
import logging
from typing import Any

import pandas as pd
from fastapi import APIRouter, Body, HTTPException

from molecule_viz import (
    create_plotly_molecular_space_map,
    process_molecular_space_map_data,
    smiles_to_base64,
)

logger = logging.getLogger(__name__)

router = APIRouter()


### TODO: finish this code!
@router.post("/api/molecular-design/{model_name}")
async def get_molecular_design_results(model_name: str) -> dict[str, Any]:

    print('calling backend function...')

    try:
        ### TODO: hardcode molecules for now --> generalize this later
        # mol_images_df, mol_images_data = get_cached_mol_results(num_rows_limit)
        # molgen_results = pd.read_excel("./datasets/vapor_pressure_train.xlsx")
        print("trying to get mol_images_df...")
        mol_images_df = pd.read_excel("./datasets/vapor_pressure_train.xlsx")
        mol_images_df = mol_images_df.rename(columns={"Smiles": "SMILES", "vapor_pressure(mmHg)": "vapor_pressure (mmHg)"})
        mol_images_df = mol_images_df[mol_images_df["vapor_pressure (mmHg)"] <= 1_000]
        mol_images_df["Group"] = "Candidates"
        # print(mol_images_df)
        mol_images_df = process_molecular_space_map_data(mol_images_df)
        # print("step...")

        print("successfully got mol_images_df!")
        # print(mol_images_df)

        molgen_results = json.loads(mol_images_df.to_json(orient="records"))
        # print("Molgen Results Dictionary (in `get_molecular_design_results`):", molgen_results)

        return {"molgen_results": molgen_results}

    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/display-molecule-image")
async def display_molecule_image(body: dict = Body(...)) -> dict[str, str]:
    smiles = body.get("smiles", [])

    print("selected point smiles...", smiles)

    try:
        img = smiles_to_base64(smiles)
        return {"molecule_image": img}

    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))


### TODO: finish this code!
@router.post("/api/molecular-space-map/{model_name}")
async def get_plotly_molecular_space_map(model_name: str, body: dict = Body(...)) -> dict[str, Any]:
    """Create a Plotly molecular space map"""
    molgen_results_dict = body.get("molgen_results", [])
    # color_property = body.get("color_property", [])

    ### TODO: hardcode colorprop for now --> generalize this later
    color_prop_options = ["vapor_pressure (mmHg)"]
    default_color_prop = color_prop_options[0] if color_prop_options else None

    print(default_color_prop)


    # If the frontend sends color_property as an array, extract the first value.
    # actual_color_property = color_property[0] if isinstance(color_property, list) and color_property else None

    # Convert the dictionary back to a Pandas DataFrame
    molgen_results_df = pd.DataFrame.from_dict(molgen_results_dict)
    print(molgen_results_df.head())


    try:
        print('making molecular space map...')
        molecular_space_map = create_plotly_molecular_space_map(molgen_results_df, color_property=default_color_prop)
        print('success!')

        plot_json = json.loads(molecular_space_map.to_json())

        return {"plot_data": plot_json}

    except Exception as e:
        logger.error(str(e))
        raise HTTPException(500, detail=f"Error creating Plotly molecular space map: {str(e)}")
