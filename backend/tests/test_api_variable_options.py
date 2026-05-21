import pandas as pd


def test_variable_options_returns_union_of_inputs_and_outputs(client, monkeypatch):
    mock_metadata = {
        "estimators_by_output": {
            "y1": {"inputs_numerical": ["x1", "x2"]},
            "y2": {"inputs_numerical": ["x2", "x3"]},
        }
    }

    monkeypatch.setattr("routers.models.get_model_and_metadata", lambda model_name: mock_metadata)

    response = client.get("/api/variable-options/demo_model")
    assert response.status_code == 200
    payload = response.json()
    assert "variable_options" in payload

    options = payload["variable_options"]
    assert set(options) == {"x1", "x2", "x3", "y1", "y2"}


def test_output_variable_options_returns_outputs_only(client, monkeypatch):
    mock_metadata = {
        "estimators_by_output": {
            "y1": {"inputs_numerical": ["x1", "x2"]},
            "y2": {"inputs_numerical": ["x2", "x3"]},
        }
    }

    monkeypatch.setattr("routers.models.get_model_and_metadata", lambda model_name: mock_metadata)

    response = client.get("/api/output-variable-options/demo_model")
    assert response.status_code == 200
    assert response.json()["output_variable_options"] == ["y1", "y2"]


def test_variable_options_returns_500_when_model_lookup_fails(client, monkeypatch):
    def _raise(*args, **kwargs):
        raise RuntimeError("model lookup failed")

    monkeypatch.setattr("routers.models.get_model_and_metadata", _raise)

    response = client.get("/api/variable-options/bad_model")
    assert response.status_code == 500
    assert response.json()["detail"] == "model lookup failed"


def test_scatter_plot_two_variables_returns_plot_json(client, monkeypatch):
    dataset = pd.DataFrame(
        {
            "x1": [1.0, 2.0, 3.0],
            "x2": [10.0, 20.0, 30.0],
            "y1": [0.1, 0.2, 0.3],
        }
    )

    monkeypatch.setattr("routers.models.get_dataset_name_from_model", lambda model_name: "demo")
    monkeypatch.setattr("routers.models.get_dataset", lambda dataset_name: dataset)

    response = client.post(
        "/api/scatter-plots/demo_model",
        json={"selected_variables": ["x1", "x2"]},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "plot_data" in payload
    assert payload["plot_data"]["data"]
