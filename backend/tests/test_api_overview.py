import plotly.graph_objects as go


class DummyEstimator:
    pass


def _mock_overview_payload():
    return {
        "estimators_by_output": {
            "y_strength": {
                "inputs_numerical": ["x_temp", "x_pressure"],
                "estimator": DummyEstimator(),
            }
        }
    }


def test_model_overview_returns_expected_shape(client, monkeypatch):
    monkeypatch.setattr("routers.models.get_model_and_metadata", lambda model_name: _mock_overview_payload())
    monkeypatch.setattr(
        "routers.models.get_dataset_name_from_model",
        lambda model_name: "demo_dataset",
    )
    monkeypatch.setattr(
        "routers.models.create_parity_plot",
        lambda data, title, width, height: go.Figure(
            data=[go.Scatter(x=[1, 2], y=[1, 2])]
        ),
    )
    monkeypatch.setattr(
        "routers.models.create_residual_plot",
        lambda data, width, height: go.Figure(
            data=[go.Scatter(x=[1, 2], y=[0.1, -0.1])]
        ),
    )

    response = client.get("/api/overview/demo_model")
    assert response.status_code == 200
    payload = response.json()

    assert payload["dataset_name"] == "demo_dataset"
    assert payload["model_outputs"] == ["y_strength"]
    assert "y_strength" in payload["estimators_by_output"]

    output_data = payload["estimators_by_output"]["y_strength"]
    assert output_data["inputs_numerical"] == ["x_temp", "x_pressure"]
    assert output_data["estimator_type"].endswith(".DummyEstimator")
    assert output_data["parity_plot_data"]["data"]
    assert output_data["residual_plot_data"]["data"]


def test_model_overview_returns_500_on_plot_failure(client, monkeypatch):
    monkeypatch.setattr("routers.models.get_model_and_metadata", lambda model_name: _mock_overview_payload())
    monkeypatch.setattr(
        "routers.models.get_dataset_name_from_model",
        lambda model_name: "demo_dataset",
    )

    def _raise(*args, **kwargs):
        raise RuntimeError("plot generation failed")

    monkeypatch.setattr("routers.models.create_parity_plot", _raise)

    response = client.get("/api/overview/demo_model")
    assert response.status_code == 500
    assert response.json()["detail"] == "plot generation failed"
