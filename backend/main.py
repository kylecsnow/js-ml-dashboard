import argparse
import logging
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

_backend_dir = Path(__file__).resolve().parent
load_dotenv(_backend_dir.parent / ".env")

from routers import chat, dataset_generator, meta, models, molecular, schemas, shap

app = FastAPI()
app.include_router(chat.router)
app.include_router(meta.router)
app.include_router(models.router)
app.include_router(shap.router)
app.include_router(molecular.router)
app.include_router(dataset_generator.router)
app.include_router(schemas.router)

# Add CORS middleware to allow requests from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8777"],
    # allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the FastAPI application.")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the FastAPI app on.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    uvicorn.run("main:app", host="0.0.0.0", port=args.port, reload=True)
