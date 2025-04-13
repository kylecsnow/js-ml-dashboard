from fastapi import Body, FastAPI, HTTPException, status
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
from sklearn.ensemble import BaseEnsemble
import uvicorn
import argparse
import logging

from utils import fig2img, get_dataset_name_from_model, get_dataset, get_model_and_metadata, build_sythetic_demo_dataset
from molecule_viz import create_plotly_molecular_space_map, process_molecular_space_map_data, smiles_to_base64
from modeling import create_parity_plot, create_residual_plot


app = FastAPI()

# Add CORS middleware to allow requests from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8777"],  # Your Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)  # Set the logging level to INFO or DEBUG
logger = logging.getLogger(__name__)


### TODO: validate that this is even doing what you want it to do.....
@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {
        "status": "healthy",
        "service": "js-ml-dashboard"
    }


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


@app.get("/api/overview/{model_name}")
async def get_model_overview(model_name: str):
    try:
        model_and_metadata = get_model_and_metadata(model_name)
        dataset_name = get_dataset_name_from_model(model_name)
        # dataset = get_dataset(dataset_name)
        estimators_by_output = model_and_metadata["estimators_by_output"]


        # print(estimators_by_output)



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



        # print(serializable_estimators)


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


@app.post("/api/violin-plots/{model_name}")
async def get_violin_plots(model_name: str, body: dict = Body(...)):
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


@app.get("/api/variable-options/{model_name}")
async def get_variable_options(model_name: str):
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
@app.post("/api/scatter-plots/{model_name}")
async def get_scatter_plot(model_name: str, body: dict = Body(...)):
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


@app.get("/api/output-variable-options/{model_name}")
async def get_output_variable_options(model_name: str):
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


@app.post("/api/shap-summary-plots/{model_name}")
async def get_shap_summary_plot(model_name: str, body: dict = Body(...)):
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
        if isinstance(estimator, BaseEnsemble) or "GBRegressor" in str(type(estimator)) or "GBClassifier" in str(type(estimator)) or "BoostRegressor" in str(type(estimator) or "BoostClassifier" in str(type(estimator))):
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
        # else:
            
        shap_values = explainer(dataset[inputs])
        fig = shap.summary_plot(
            shap_values,
            features=dataset[inputs],
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


@app.get("/api/sample-options/{model_name}")
async def get_sample_options(model_name: str):
    try:
        dataset_name = get_dataset_name_from_model(model_name)
        dataset = get_dataset(dataset_name)

        dataset_sample_index_options = dataset.index.tolist()
        dataset_sample_index_options = [str(item) for item in dataset_sample_index_options]

        return {"sample_options": dataset_sample_index_options}
    
    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/shap-waterfall-plots/{model_name}")
async def get_shap_waterfall_plot(model_name: str, body: dict = Body(...)):
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
        if isinstance(estimator, BaseEnsemble) or "GBRegressor" in str(type(estimator)) or "GBClassifier" in str(type(estimator)) or "BoostRegressor" in str(type(estimator) or "BoostClassifier" in str(type(estimator))):
            explainer = shap.TreeExplainer(estimator)
        ### TODO: write some code for handling torch Neural Networks (KernelExplainer) 
        # elif:
        ### TODO: write some code for LinearExplainer... or will KernelExplainer work for linear models...?
        # elif:
        ### SOMEDAY: write some code for handling "everything else"... if model is un-recognized, display an Error.
        # else:
        
        shap_values = explainer(dataset[inputs])

        fig = shap.waterfall_plot(
            shap_values[selected_sample],
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


### TODO: finish this code!
@app.post("/api/molecular-design/{model_name}")
async def get_molecular_design_results(model_name: str):
    
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



@app.post("/api/display-molecule-image")
async def display_molecule_image(body: dict = Body(...)):
    smiles = body.get("smiles", [])

    print("selected point smiles...", smiles)

    try:
        img = smiles_to_base64(smiles)
        return {"molecule_image": img}
    
    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))



### TODO: finish this code!
@app.post("/api/molecular-space-map/{model_name}")
async def get_plotly_molecular_space_map(model_name: str, body: dict = Body(...)):
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




@app.post("/api/dataset-generator")
async def get_synthetic_demo_dataset(body: dict = Body(...)):

    try:
        general_inputs = body.get("general_inputs", [])
        formulation_inputs = body.get("formulation_inputs", {})
        outputs = body.get("outputs", [])
        num_rows = body.get("num_rows", [])

        ### TODO: maybe make a function for this operation, instead of explicitly repreating it a bunch of times? (for better readability?)
        general_inputs = {item["name"]: {"min": float(item["min"]), "max": float(item["max"]), "units": item["units"]} for item in general_inputs}
        formulation_inputs = {item["name"]: {"min": float(item["min"]), "max": float(item["max"]), "units": item["units"]} for item in formulation_inputs}
        outputs = {item["name"]: {"min": float(item["min"]), "max": float(item["max"]), "units": item["units"]} for item in outputs}
        inputs = {
            "general": general_inputs,
            "formulation": formulation_inputs,
        }

        synthetic_demo_data_df, synthetic_demo_coefs_df = build_sythetic_demo_dataset(inputs=inputs, outputs=outputs, num_rows=num_rows)
        csv_string = synthetic_demo_data_df.to_csv()
        return {"csv_string": csv_string}
            
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
        
    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))
    

# Add this function to parse command line arguments
def parse_args():
    parser = argparse.ArgumentParser(description="Run the FastAPI application.")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the FastAPI app on.")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    uvicorn.run("main:app", host="0.0.0.0", port=args.port, reload=True)
