from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import matplotlib
import matplotlib.pyplot as plt
from pathlib import Path
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import shap
import uvicorn

from utils import fig2img, get_dataset_name_from_model, get_dataset, get_model_and_metadata


app = FastAPI()

# Add CORS middleware to allow requests from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3700"],  # Your Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

### Keeping models & datasets contained in the backend directory for the following reasons:
# 1. Separation of Concerns: The frontend's public directory is meant for static assets that need to be directly served to the client (like images, fonts, etc.). ML models and datasets should be handled by your Python backend.
# 2. Security: Keeping models in frontend/public means they're directly accessible to anyone who knows the URL. Moving them to the backend lets you control access through your API endpoints.
# 3. Performance: Pickle files can be large. There's no need to include them in your frontend bundle or make them available for direct download.
# 4. Maintainability: Your Python backend will be handling all the model loading and inference, so it makes more sense to keep the models close to the code that uses them.
@app.get("/api/models")
async def list_models():
    models_dir = Path(__file__).parent / "models"  # Use relative path from main.py
    model_files = [f.name.split(".pkl")[0] for f in models_dir.glob("*.pkl")]
    return {"models": model_files}


@app.post("/api/violin-plots/{model_name}")
async def get_violin_plots(model_name: str, body: dict = Body(...)):
    box_plot_toggle = body.get("box_plot_toggle", [])
    data_points_toggle = body.get("data_points_toggle", [])

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
                set(model_and_metadata["estimators_by_output"][output]["inputs_reals"])
            )
        inputs = list(all_estimator_inputs)
        # inputs_reals = inputs

        fig = go.Figure()
        fig = make_subplots(rows=len(inputs + outputs))

        for i, item in enumerate(inputs + outputs):
            fig.add_trace(
                go.Violin(
                    x=dataset[item],
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

        fig.update_layout(height=200 * len(inputs + outputs))

        plot_json = json.loads(fig.to_json())
        return {"plot_data": plot_json}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/correlation-heatmap/{model_name}/{correlation_type}")
async def get_correlation_heatmap(model_name: str, correlation_type: str):  

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
                set(model_and_metadata["estimators_by_output"][output]["inputs_reals"])
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
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/variable-options/{model_name}")
async def get_variable_options(model_name: str):
    try:
        model_and_metadata = get_model_and_metadata(model_name=model_name)
        outputs = list(model_and_metadata["estimators_by_output"].keys())
        all_estimator_inputs = set()
        for output in outputs:
            all_estimator_inputs = all_estimator_inputs.union(
                set(model_and_metadata["estimators_by_output"][output]["inputs_reals"])
            )
        all_estimator_inputs = list(all_estimator_inputs)
        variable_options = all_estimator_inputs + outputs
        return {"variable_options": variable_options}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


### TODO: eventually, consider breaking these page-specific functions out into some other .py files?
@app.post("/api/scatter-plots/{model_name}")
async def get_scatter_plot(model_name: str, body: dict = Body(...)):
    selected_variables = body.get("selected_variables", [])

    try:
        dataset_name = get_dataset_name_from_model(model_name)
        dataset = get_dataset(dataset_name)

        # logger.debug(
        #     f"Retrieved training dataset for model. [model_name={model_name}, dataset_name={dataset_name}]"
        # )

        style = {
            "height": "40rem",
        }

        if len(selected_variables) == 2:
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
            style = {
                "height": "40rem",
                "border": "1px solid black",  # only add a border if making a 3D scatterplot
            }

        else:
            fig = pd.DataFrame([])
            fig = px.imshow(fig)

        # graph_container = dcc.Graph(
        #     figure=fig,
        #     style=style,
        # )
        plot_json = json.loads(fig.to_json())
        
        return {"plot_data": plot_json}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/output-variable-options/{model_name}")
async def get_output_variable_options(model_name: str):
    try:
        model_and_metadata = get_model_and_metadata(model_name=model_name)
        outputs = list(model_and_metadata["estimators_by_output"].keys())
        all_estimator_inputs = set()
        for output in outputs:
            all_estimator_inputs = all_estimator_inputs.union(
                set(model_and_metadata["estimators_by_output"][output]["inputs_reals"])
            )
        return {"output_variable_options": outputs}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


### TODO: finish this code!
@app.post("/api/shap-summary-plots/{model_name}")
async def get_shap_summary_plot(model_name: str, body: dict = Body(...)):
    try:



        selected_output = body.get("selected_output", [])

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
        inputs = estimators_by_output[selected_output]["inputs_reals"]
        # inputs_reals = inputs

        matplotlib.use("agg")
        plt.figure()
        explainer = shap.Explainer(estimator)
        shap_values = explainer(dataset[inputs])
        fig = shap.summary_plot(
            shap_values,
            features=dataset[inputs],
            feature_names=inputs,
            plot_size=(12, 8),
            show=False,
        )
        fig = plt.gcf()

        print(type(fig2img(fig, dpi=150)))

        fig = px.imshow(fig2img(fig, dpi=150))
        fig.update_layout(
            showlegend=False,
            xaxis=dict(visible=False),
            yaxis=dict(visible=False),
            hovermode=False,
        )


        # TODO: finish this part
        plot_json = json.loads(fig.to_json())
        
        return {"plot_data": plot_json}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


### TODO: finish this code!
@app.get("/api/molecular-design/{model_name}")
async def get_molecular_design(model_name: str):
    try:
        # model_and_metadata = get_model_and_metadata(model_name=model_name)
        # outputs = list(model_and_metadata["estimators_by_output"].keys())
        # all_estimator_inputs = set()
        # for output in outputs:
        #     all_estimator_inputs = all_estimator_inputs.union(
        #         set(model_and_metadata["estimators_by_output"][output]["inputs_reals"])
        #     )
        # all_estimator_inputs = list(all_estimator_inputs)
        # variable_options = all_estimator_inputs + outputs
        # return {"variable_options": variable_options}
        return {""}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
