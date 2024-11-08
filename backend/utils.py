import os
import pandas as pd
import pickle
from typing import Any


PROJECT_ROOT_DIR = os.path.abspath(__file__)


# TODO: somday, may want to implement MLflow for model tracking & retreival, rather than pickling locally
def get_dataset_name_from_model(model_name: str) -> str:
    dataset_name = f"{model_name.split('_')[0]}_dataset"
    return dataset_name


def get_dataset(dataset_name: str) -> pd.DataFrame:
    datasets_path = os.path.join(
        os.path.dirname(PROJECT_ROOT_DIR), "datasets"
    )
    dataset_path = os.path.join(datasets_path, f"{dataset_name}.pkl")

    with open(dataset_path, "rb") as f:
        dataset = pickle.load(f)

    return dataset


def get_model_and_metadata(model_name: str) -> dict[str, Any]:
    models_path = os.path.join(os.path.dirname(PROJECT_ROOT_DIR), "models")
    model_path = os.path.join(models_path, f"{model_name}.pkl")

    with open(model_path, "rb") as f:
        model_and_metadata = pickle.load(f)

    return model_and_metadata
