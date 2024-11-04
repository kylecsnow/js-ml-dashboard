from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import uvicorn

app = FastAPI()

# Add CORS middleware to allow requests from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your Next.js dev server
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


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
