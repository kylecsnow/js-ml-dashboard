from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from utils import build_sythetic_demo_dataset


app = FastAPI()

# Add CORS middleware to allow requests from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8777"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
        raise HTTPException(status_code=500, detail=str(e))    


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
