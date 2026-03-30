import pandas as pd
import pytest


def _mock_metadata():
    return {
        "estimators_by_output": {
            "y1": {"inputs_numerical": ["x1", "x2"]},
        }
    }


def _mock_dataset():
    return pd.DataFrame(
        {
            "x1": [1.0, 2.0, 3.0, 4.0],
            "x2": [2.0, 4.0, 6.0, 8.0],
            "y1": [0.5, 1.0, 1.5, 2.0],
        }
    )


@pytest.mark.parametrize(
    "correlation_type",
    ["input-input", "input-output", "output-output"],
)
def test_correlation_heatmap_returns_plot_for_supported_types(
    client, monkeypatch, correlation_type
):
    monkeypatch.setattr("main.get_model_and_metadata", lambda model_name: _mock_metadata())
    monkeypatch.setattr("main.get_dataset_name_from_model", lambda model_name: "demo")
    monkeypatch.setattr("main.get_dataset", lambda dataset_name: _mock_dataset())

    response = client.get(f"/api/correlation-heatmap/demo_model/{correlation_type}")
    assert response.status_code == 200
    payload = response.json()
    assert "plot_data" in payload
    assert payload["plot_data"]["data"]
    assert payload["plot_data"]["data"][0]["type"] == "heatmap"


def test_correlation_heatmap_returns_500_on_dataset_error(client, monkeypatch):
    monkeypatch.setattr("main.get_model_and_metadata", lambda model_name: _mock_metadata())
    monkeypatch.setattr("main.get_dataset_name_from_model", lambda model_name: "demo")

    def _raise(*args, **kwargs):
        raise RuntimeError("dataset load failed")

    monkeypatch.setattr("main.get_dataset", _raise)

    response = client.get("/api/correlation-heatmap/demo_model/input-input")
    assert response.status_code == 500
    assert response.json()["detail"] == "dataset load failed"
