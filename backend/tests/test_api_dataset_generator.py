def test_dataset_generator_returns_csv_string(client):
    body = {
        "general_inputs": [
            {"name": "temp", "min": 0.0, "max": 100.0, "units": "C"},
        ],
        "formulation_inputs": [],
        "outputs": [
            {"name": "yield_", "min": 0.0, "max": 1.0, "units": ""},
        ],
        "num_rows": 12,
        "noise": 0.01,
    }
    response = client.post("/api/dataset-generator", json=body)
    assert response.status_code == 200
    data = response.json()
    assert "csv_string" in data
    assert "temp" in data["csv_string"]
    assert "yield_" in data["csv_string"]
    assert data["csv_string"].count("\n") >= 13
