import csv

### TODO: will we need to remove this import (only needed for the `test_dataset_generator_enforces_ingredient_count_bounds_wide` function) once the the UI supports users exporting in wide format vs. compact format?
from utils import build_synthetic_demo_dataset


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


def test_dataset_generator_enforces_ingredient_count_bounds_compact_format(client):
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

    # build_synthetic_demo_dataset uses compact formulation columns (component-k_amount), not wide ingredient names
    reader = csv.reader(data["csv_string"].splitlines())
    rows = [r for r in reader if any(cell.strip() for cell in r)]
    assert len(rows) > 1

    header = rows[0]
    amount_col_names = tuple(f"component-{k}_amount" for k in range(1, 6))
    for name in amount_col_names:
        assert name in header
    amount_col_indices = [header.index(name) for name in amount_col_names]

    for row in rows[1:]:
        active_count = 0
        for idx in amount_col_indices:
            if idx >= len(row):
                continue
            cell = row[idx].strip()
            if not cell:
                continue
            if float(cell) > 0.0:
                active_count += 1
        assert active_count >= 3
        assert active_count <= 5


def test_dataset_generator_returns_components_csv_when_present(client):
    body = {
        "general_inputs": [],
        "formulation_inputs": [
            {"name": "UDMA", "min": 0.1, "max": 0.6, "units": ""},
            {"name": "IBOA", "min": 0.05, "max": 0.8, "units": ""},
        ],
        "outputs": [
            {"name": "yield_", "min": 0.0, "max": 1.0, "units": ""},
        ],
        "num_rows": 12,
        "noise": 0.01,
    }
    response = client.post("/api/dataset-generator", json=body)
    assert response.status_code == 200
    data = response.json()

    assert "components_csv_string" in data

    reader = csv.reader(data["components_csv_string"].splitlines())
    rows = list(reader)

    assert rows[0] == ["id", "Group", "SMILES"]
    assert rows[1] == ["UDMA", "", ""]
    assert rows[2] == ["IBOA", "", ""]


### TODO: will we need to update this test once the the UI supports users exporting in wide format vs. compact format?
def test_dataset_generator_enforces_ingredient_count_bounds_wide_format():
    inputs = {
        "general": {},
        "formulation": {
            "UDMA": {"min": 0.1, "max": 0.6, "units": ""},
            "IBOA": {"min": 0.05, "max": 0.8, "units": ""},
            "HDDA": {"min": 0.05, "max": 0.8, "units": ""},
            "GCMA": {"min": 0.05, "max": 0.8, "units": ""},
            "Irganox819": {"min": 0.0005, "max": 0.02, "units": ""},
        },
    }
    outputs = {
        "modulus": {"min": 100.0, "max": 10000.0, "units": "MPa"},
    }
    ingredient_names = list(inputs["formulation"].keys())

    data_df, _ = build_synthetic_demo_dataset(
        inputs=inputs,
        outputs=outputs,
        num_rows=75,
        noise=0.01,
        output_format="wide",
        min_ingredients_per_formulation=3,
        max_ingredients_per_formulation=5,
    )

    for _, row in data_df.iterrows():
        active_count = sum(row[name] > 0.0 for name in ingredient_names)
        assert active_count >= 3, (
            f"Row has {active_count} active ingredients (min allowed: 3)"
        )
        assert active_count <= 5, (
            f"Row has {active_count} active ingredients (max allowed: 5)"
        )
