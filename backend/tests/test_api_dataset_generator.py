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


def test_dataset_generator_enforces_formulation_ingredient_count_bounds(client):
    body = {
        "general_inputs": [],
        "formulation_inputs": [
            {"name": "UDMA", "min": 0.1, "max": 0.6, "units": ""},
            {"name": "IBOA", "min": 0.05, "max": 0.8, "units": ""},
            {"name": "HDDA", "min": 0.05, "max": 0.8, "units": ""},
            {"name": "GCMA", "min": 0.05, "max": 0.8, "units": ""},
            {"name": "Irganox819", "min": 0.0005, "max": 0.02, "units": ""},
        ],
        "outputs": [
            {"name": "modulus", "min": 100.0, "max": 10000.0, "units": "MPa"},
        ],
        "num_rows": 75,
        "noise": 0.01,
        "min_ingredients_per_formulation": 3,
        "max_ingredients_per_formulation": 5,
    }

    response = client.post("/api/dataset-generator", json=body)
    assert response.status_code == 200
    data = response.json()
    csv_rows = [row for row in data["csv_string"].splitlines() if row.strip()]

    # Header + at least one data row
    assert len(csv_rows) > 1

    header = csv_rows[0].split(",")
    ingredient_columns = {"UDMA", "IBOA", "HDDA", "GCMA", "Irganox819"}
    ingredient_indices = [idx for idx, col in enumerate(header) if col in ingredient_columns]
    assert len(ingredient_indices) == 5

    for row in csv_rows[1:]:
        fields = row.split(",")
        active_count = sum(float(fields[idx]) > 0.0 for idx in ingredient_indices)
        assert active_count >= 3
        assert active_count <= 5
