from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path
import plotly.express as px
import uvicorn

from utils import get_dataset_name_from_model, get_dataset, get_model_and_metadata


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


@app.get("/api/correlation-heatmap/{model_name}/{selected_variables}")
async def get_correlation_heatmap(model_name: str, selected_variables: str):  
    try:
        return {"plot_data": "nothing yet..."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
