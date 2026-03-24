import numpy as np

from utils import get_dataset_name_from_model, sigmoid


def test_get_dataset_name_from_model():
    assert get_dataset_name_from_model("pharma-tablets_RF") == "pharma-tablets_dataset"


def test_sigmoid_scalar_behavior():
    row = np.array([0.0, 1.0])
    coefs = np.array([0.0, 0.0])
    assert sigmoid(row, coefs) == 0.5
