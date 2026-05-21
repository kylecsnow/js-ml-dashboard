import json
import logging
from typing import Any

import matplotlib
import matplotlib.pyplot as plt
import plotly.express as px
import shap
from fastapi import APIRouter, Body, HTTPException
from sklearn.ensemble import BaseEnsemble

from utils import fig2img, get_dataset, get_dataset_name_from_model, get_model_and_metadata

logger = logging.getLogger(__name__)

router = APIRouter()

# SHAP TreeExplainer cost scales with n_samples; Next.js dev rewrites default to a ~30s proxy timeout,
# so large training sets otherwise cause ECONNRESET. Summary plots do not need every row. We've changed
# the timeout limit in `next.config.mjs`, but still helpful to limit # of samples here to be safe.
MAX_SHAP_SUMMARY_SAMPLES = 400


@router.post("/api/shap-summary-plots/{model_name}")
async def get_shap_summary_plot(model_name: str, body: dict = Body(...)) -> dict[str, Any]:
    try:
        selected_output = body.get("selected_output", [])
        print("selected output is...: ", selected_output)

        model_and_metadata = get_model_and_metadata(model_name)
        dataset_name = get_dataset_name_from_model(model_name)
        dataset = get_dataset(dataset_name)

        # logger.debug(
        #     f"Retrieved training dataset for model. [model_name={model_name}, dataset_name={dataset_name}]"
        # )

        estimators_by_output = model_and_metadata["estimators_by_output"]
        estimator = estimators_by_output[selected_output]["estimator"]

        # TODO: eventually this needs to distinguish between real-valued outputs and categorical outputs
        # outputs = model_and_metadata["outputs_reals"]
        # outputs_reals = outputs

        # TODO: eventually this needs to distinguish between real-valued inputs and categorical inputs
        inputs = estimators_by_output[selected_output]["inputs_numerical"]
        # inputs_reals = inputs

        matplotlib.use("agg")
        plt.figure()

        ### TODO: need to add some code so this can auto-determine which Explainer to use based on the model type; if something is un-recognized, display an Error
        ### TODO: clean this line of code up; can probably do it much more elegantly than this overly verbose code...?
        est_type = str(type(estimator))
        if (
            isinstance(estimator, BaseEnsemble)
            or "GBRegressor" in est_type
            or "GBClassifier" in est_type
            or "BoostRegressor" in est_type
            or "BoostClassifier" in est_type
        ):
            explainer = shap.TreeExplainer(estimator)
        ### TODO: write some code for handling torch Neural Networks (KernelExplainer)
        # elif:
        # else:
            # try:
                # explainer = shap.KernelExplainer(predict_fn, background)
            # except:

        ### TODO: write some code for LinearExplainer... or will KernelExplainer work for linear models...?
        # elif:
        ### SOMEDAY: write some code for handling "everything else"... if model is un-recognized, display an Error.
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported model type for SHAP summary plots (TreeExplainer).",
            )

        X = dataset[inputs]
        if len(X) > MAX_SHAP_SUMMARY_SAMPLES:
            X = X.sample(n=MAX_SHAP_SUMMARY_SAMPLES, random_state=42)
        shap_values = explainer(X)
        fig = shap.summary_plot(
            shap_values,
            features=X,
            feature_names=inputs,
            plot_size=(12, 8),
            show=False,
        )
        fig = plt.gcf()
        fig = px.imshow(fig2img(fig, dpi=200))
        fig.update_layout(
            showlegend=False,
            xaxis=dict(visible=False),
            yaxis=dict(visible=False),
            hovermode=False,
        )

        plot_json = json.loads(fig.to_json())

        return {"plot_data": plot_json}

    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/sample-options/{model_name}")
async def get_sample_options(model_name: str) -> dict[str, list[str]]:
    try:
        dataset_name = get_dataset_name_from_model(model_name)
        dataset = get_dataset(dataset_name)

        dataset_sample_index_options = dataset.index.tolist()
        dataset_sample_index_options = [str(item) for item in dataset_sample_index_options]

        return {"sample_options": dataset_sample_index_options}

    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/shap-waterfall-plots/{model_name}")
async def get_shap_waterfall_plot(model_name: str, body: dict = Body(...)) -> dict[str, Any]:
    try:
        selected_output = body.get("selected_output", [])
        selected_sample = body.get("selected_sample", [])

        # TODO: someday, get this to not require the selected sample to be referred to by an integer value?
        selected_sample = int(selected_sample[0])

        model_and_metadata = get_model_and_metadata(model_name)
        dataset_name = get_dataset_name_from_model(model_name)
        dataset = get_dataset(dataset_name)

        # logger.debug(
        #     f"Retrieved training dataset for model. [model_name={model_name}, dataset_name={dataset_name}]"
        # )

        estimators_by_output = model_and_metadata["estimators_by_output"]
        estimator = estimators_by_output[selected_output]["estimator"]

        # TODO: eventually this needs to distinguish between real-valued outputs and categorical outputs
        # outputs = model_and_metadata["outputs_reals"]
        # outputs_reals = outputs

        # TODO: eventually this needs to distinguish between real-valued inputs and categorical inputs
        inputs = estimators_by_output[selected_output]["inputs_numerical"]
        # inputs_reals = inputs

        matplotlib.use("agg")
        plt.figure()

        ### TODO: need to add some code so this can auto-determine which Explainer to use based on the model type; if something is un-recognized, display an Error
        ### TODO: clean this line of code up; can probably do it much more elegantly than this overly verbose code...?
        est_type = str(type(estimator))
        if (
            isinstance(estimator, BaseEnsemble)
            or "GBRegressor" in est_type
            or "GBClassifier" in est_type
            or "BoostRegressor" in est_type
            or "BoostClassifier" in est_type
        ):
            explainer = shap.TreeExplainer(estimator)
        ### TODO: write some code for handling torch Neural Networks (KernelExplainer)
        # elif:
        ### TODO: write some code for LinearExplainer... or will KernelExplainer work for linear models...?
        # elif:
        ### SOMEDAY: write some code for handling "everything else"... if model is un-recognized, display an Error.
        # else:


        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported model type for SHAP waterfall plots (TreeExplainer).",
            )

        X_one = dataset[inputs].iloc[[selected_sample]]
        shap_values = explainer(X_one)


        fig = shap.waterfall_plot(
            shap_values[0],
        )
        fig = plt.gcf()

        fig = px.imshow(fig2img(fig, dpi=150, bbox_inches="tight"))
        fig.update_layout(
            showlegend=False,
            xaxis=dict(visible=False),
            yaxis=dict(visible=False),
            hovermode=False,
        )

        plot_json = json.loads(fig.to_json())

        return {"plot_data": plot_json}

    except Exception as e:
        logger.error(str(e))  # Log the error with function name
        raise HTTPException(status_code=500, detail=str(e))
