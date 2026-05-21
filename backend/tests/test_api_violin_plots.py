import pandas as pd


def _mock_metadata():
    return {
        "estimators_by_output": {
            "y_out": {"inputs_numerical": ["x_in"]},
        }
    }


def _mock_dataset():
    return pd.DataFrame(
        {
            "y_out": [1.0, 2.0, 3.0],
            "x_in": [0.1, 0.2, 0.3],
        }
    )


def test_violin_plots_returns_plot_json_and_total_variables(client, monkeypatch):
    monkeypatch.setattr("routers.models.get_model_and_metadata", lambda model_name: _mock_metadata())
    monkeypatch.setattr(
        "routers.models.get_dataset_name_from_model",
        lambda model_name: "demo_dataset",
    )
    monkeypatch.setattr("routers.models.get_dataset", lambda dataset_name: _mock_dataset())

    response = client.post(
        "/api/violin-plots/demo_model",
        json={
            "box_plot_toggle": True,
            "data_points_toggle": True,
            "page": 1,
            "page_size": 10,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_variables"] == 2
    assert "plot_data" in payload
    assert len(payload["plot_data"]["data"]) == 2
    assert payload["plot_data"]["data"][0]["type"] == "violin"


def test_violin_plots_pagination_returns_one_trace(client, monkeypatch):
    monkeypatch.setattr("routers.models.get_model_and_metadata", lambda model_name: _mock_metadata())
    monkeypatch.setattr(
        "routers.models.get_dataset_name_from_model",
        lambda model_name: "demo_dataset",
    )
    monkeypatch.setattr("routers.models.get_dataset", lambda dataset_name: _mock_dataset())

    response = client.post(
        "/api/violin-plots/demo_model",
        json={
            "box_plot_toggle": False,
            "data_points_toggle": False,
            "page": 1,
            "page_size": 1,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_variables"] == 2
    assert len(payload["plot_data"]["data"]) == 1
