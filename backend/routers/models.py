import json
import logging
from typing import Any

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from fastapi import APIRouter, Body, HTTPException
from plotly.subplots import make_subplots

from modeling import create_parity_plot, create_residual_plot
from utils import get_dataset, get_dataset_name_from_model, get_model_and_metadata

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/overview/{model_name}")
async def get_model_overview(model_name: str) -> dict[str, Any]:
    try:
        model_and_metadata = get_model_and_metadata(model_name)
        dataset_name = get_dataset_name_from_model(model_name)
        # dataset = get_dataset(dataset_name)
        estimators_by_output = model_and_metadata["estimators_by_output"]

        serializable_estimators = {}
        for output, data in estimators_by_output.items():

            parity_plot_fig = create_parity_plot(data, title=f"Parity Plot - {output}", width=600, height=600)
            parity_plot_json = json.loads(parity_plot_fig.to_json())
            residual_plot_fig = create_residual_plot(data, width=600, height=600)
            residual_plot_json = json.loads(residual_plot_fig.to_json())

            serializable_estimators[output] = {
                "inputs_numerical": data["inputs_numerical"],

                # Get the type name as a string
                # "estimator_type": type(data["estimator"]).__name__,
                # If you want the full module path, use this instead:
                "estimator_type": f"{type(data['estimator']).__module__}.{type(data['estimator']).__name__}",

                "parity_plot_data": parity_plot_json,
                "residual_plot_data": residual_plot_json,
            }


        model_overview_data = {
            "dataset_name": dataset_name,
            "model_outputs": list(estimators_by_output.keys()),
            "estimators_by_output": serializable_estimators,
            # "estimator_results_by_output":
        }

        return model_overview_data

    except Exception as e:
        logger.error(str(e))  # Log the error
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/violin-plots/{model_name}")
async def get_violin_plots(model_name: str, body: dict = Body(...)) -> dict[str, Any]:
    box_plot_toggle = body.get("box_plot_toggle", [])
    data_points_toggle = body.get("data_points_toggle", [])
    page = body.get("page", 1)
    page_size = body.get("page_size", 10)  # Ensure this matches your frontend

    try:
        model_and_metadata = get_model_and_metadata(model_name)
        dataset_name = get_dataset_name_from_model(model_name)
        dataset = get_dataset(dataset_name)

        # logger.debug(
        #     f"Retrieved training dataset for model. [model_name={model_name}, dataset_name={dataset_name}]"
        # )

        # TODO: eventually this needs to distinguish between real-valued outputs and categorical outputs
        outputs = list(model_and_metadata["estimators_by_output"].keys())
        # outputs_reals = outputs

        # TODO: eventually this needs to distinguish between real-valued inputs and categorical inputs
        all_estimator_inputs = set()
        for output in outputs:
            all_estimator_inputs = all_estimator_inputs.union(
                set(model_and_metadata["estimators_by_output"][output]["inputs_numerical"])
            )
        inputs = list(all_estimator_inputs)
        # inputs_reals = inputs
        all_variables = outputs + inputs

        # Calculate which variables to show based on pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        variables_to_show = all_variables[start_idx:end_idx]

        # Create figure with only the paginated variables
        fig = go.Figure()
        fig = make_subplots(rows=len(variables_to_show), cols=1)

        for i, item in enumerate(variables_to_show):
            fig.add_trace(
                go.Violin(
                    x=dataset[item],  # Use the full dataset for the selected variable
                    box_visible=box_plot_toggle,
                    meanline_visible=True,
                    opacity=0.9,
                    y0=item,
                    name=item,
                    points="all" if data_points_toggle else None,
                    pointpos=0,
                ),
                row=i + 1,
                col=1,
            )

        fig.update_layout(height=200 * len(variables_to_show))
        plot_json = json.loads(fig.to_json())
        return {
            "plot_data": plot_json,
            "total_variables": len(all_variables)  # Add total count for frontend pagination
        }

    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/correlation-heatmap/{model_name}/{correlation_type}")
async def get_correlation_heatmap(model_name: str, correlation_type: str) -> dict[str, Any]:

    try:
        model_and_metadata = get_model_and_metadata(model_name)

        # TODO: may want to do some validation here...?
        # if model_path not in model_paths_list:
        #     my_df = pd.DataFrame([])
        #     return px.imshow(my_df)

        dataset_name = get_dataset_name_from_model(model_name)
        dataset = get_dataset(dataset_name)

        train_df = dataset.copy()

        # logger.debug(
        #     f"Retrieved training dataset for model. [model_name={model_name}, dataset_name={dataset_name}]"
        # )

        # TODO: eventually this needs to distinguish between real-valued outputs and categorical outputs
        outputs = list(model_and_metadata["estimators_by_output"].keys())
        outputs_reals = outputs

        # TODO: eventually this needs to distinguish between real-valued inputs and categorical inputs
        all_estimator_inputs = set()
        for output in outputs:
            all_estimator_inputs = all_estimator_inputs.union(
                set(model_and_metadata["estimators_by_output"][output]["inputs_numerical"])
            )
        inputs = list(all_estimator_inputs)
        # inputs_reals = inputs

        img = None

        if correlation_type == "input-input":
            input_to_input_correlations = train_df[inputs].corr(
                "pearson"
            )  # TODO: does this work when including categorical inputs?
            img = input_to_input_correlations

        elif correlation_type == "input-output":
            input_to_output_correlations = (
                train_df[inputs + outputs_reals]
                .corr("pearson")[outputs_reals]
                .drop(labels=outputs_reals)
            )
            img = input_to_output_correlations

        elif correlation_type == "output-output":
            output_to_output_correlations = train_df[outputs_reals].corr("pearson")[
                outputs_reals
            ]
            img = output_to_output_correlations

        fig = px.imshow(
            img=img,
            color_continuous_scale="RdBu_r",
            range_color=(-1, 1),
            aspect="auto",
            text_auto=True,
        )

        plot_json = json.loads(fig.to_json())

        return {"plot_data": plot_json}

    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/variable-options/{model_name}")
async def get_variable_options(model_name: str) -> dict[str, list[str]]:
    try:
        model_and_metadata = get_model_and_metadata(model_name=model_name)
        outputs = list(model_and_metadata["estimators_by_output"].keys())
        all_estimator_inputs = set()
        for output in outputs:
            all_estimator_inputs = all_estimator_inputs.union(
                set(model_and_metadata["estimators_by_output"][output]["inputs_numerical"])
            )
        all_estimator_inputs = list(all_estimator_inputs)
        variable_options = all_estimator_inputs + outputs
        return {"variable_options": variable_options}

    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))


### TODO: eventually, consider breaking these page-specific functions out into some other .py files?
@router.post("/api/scatter-plots/{model_name}")
async def get_scatter_plot(model_name: str, body: dict = Body(...)) -> dict[str, Any]:
    selected_variables = body.get("selected_variables", [])

    try:
        dataset_name = get_dataset_name_from_model(model_name)
        dataset = get_dataset(dataset_name)

        # logger.debug(
        #     f"Retrieved training dataset for model. [model_name={model_name}, dataset_name={dataset_name}]"
        # )

        if len(selected_variables) == 1:
            fig = px.histogram(
                dataset,
                x=selected_variables[0],
                marginal="rug",
            )

        elif len(selected_variables) == 2:
            fig = px.scatter(
                dataset,
                x=selected_variables[0],
                y=selected_variables[1],
            )

        elif len(selected_variables) == 3:
            fig = px.scatter_3d(
                dataset,
                x=selected_variables[0],
                y=selected_variables[1],
                z=selected_variables[2],
            )
            fig.update_layout(
                margin=dict(r=0, l=0, b=0, t=0),
            )

        else:
            fig = pd.DataFrame([])
            fig = px.imshow(fig)

        plot_json = json.loads(fig.to_json())

        return {"plot_data": plot_json}

    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/output-variable-options/{model_name}")
async def get_output_variable_options(model_name: str) -> dict[str, list[str]]:
    try:
        model_and_metadata = get_model_and_metadata(model_name=model_name)
        outputs = list(model_and_metadata["estimators_by_output"].keys())
        all_estimator_inputs = set()
        for output in outputs:
            all_estimator_inputs = all_estimator_inputs.union(
                set(model_and_metadata["estimators_by_output"][output]["inputs_numerical"])
            )
        return {"output_variable_options": outputs}

    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))
