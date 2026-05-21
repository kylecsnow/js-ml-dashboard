from pathlib import Path

from fastapi import APIRouter, status

_BACKEND_DIR = Path(__file__).resolve().parent.parent

router = APIRouter()


### TODO: validate that this is even doing what you want it to do.....
@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "js-ml-dashboard"
    }


### Keeping models & datasets contained in the backend directory for the following reasons:
# 1. Separation of Concerns: The frontend's public directory is meant for static assets that need to be directly served to the client (like images, fonts, etc.). ML models and datasets should be handled by your Python backend.
# 2. Security: Keeping models in frontend/public means they're directly accessible to anyone who knows the URL. Moving them to the backend lets you control access through your API endpoints.
# 3. Performance: Pickle files can be large. There's no need to include them in your frontend bundle or make them available for direct download.
# 4. Maintainability: Your Python backend will be handling all the model loading and inference, so it makes more sense to keep the models close to the code that uses them.
@router.get("/api/models")
async def list_models() -> dict[str, list[str]]:
    models_dir = _BACKEND_DIR / "models"
    model_files = [f.name.split(".pkl")[0] for f in models_dir.glob("*.pkl")]
    return {"models": model_files}
