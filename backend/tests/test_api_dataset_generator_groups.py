"""Tests for ingredient-group support in the dataset generator."""

import csv

import numpy as np

from routers.dataset_generator import _default_global_ingredient_counts
from utils import build_synthetic_demo_dataset


def _build_grouped(formulation, groups, **kwargs):
    inputs = {"general": {}, "formulation": formulation}
    outputs = {"y": {"min": 0.0, "max": 1.0, "units": ""}}
    return build_synthetic_demo_dataset(
        inputs=inputs,
        outputs=outputs,
        noise=0.0,
        output_format="wide",
        formulation_groups=groups,
        **kwargs,
    )


def test_group_sum_bounds_and_counts_respected_wide_format():
    np.random.seed(0)
    formulation = {
        "A": {"min": 0.1, "max": 0.3, "units": "", "required": False},
        "B": {"min": 0.1, "max": 0.3, "units": "", "required": False},
        "C": {"min": 0.05, "max": 0.5, "units": "", "required": False},
        "D": {"min": 0.05, "max": 0.5, "units": "", "required": False},
    }
    groups = [
        {"min": 0.2, "max": 0.4, "min_count": 1, "max_count": 2, "ingredients": ["A", "B"]},
        {"min": 0.6, "max": 0.8, "min_count": 1, "max_count": 2, "ingredients": ["C", "D"]},
    ]

    df, _ = _build_grouped(
        formulation,
        groups,
        num_rows=200,
        min_ingredients_per_formulation=2,
        max_ingredients_per_formulation=4,
    )

    g1 = df[["A", "B"]].sum(axis=1)
    g2 = df[["C", "D"]].sum(axis=1)
    assert (g1 >= 0.2 - 1e-9).all() and (g1 <= 0.4 + 1e-9).all()
    assert (g2 >= 0.6 - 1e-9).all() and (g2 <= 0.8 + 1e-9).all()

    # Whole formulation always sums to 1.
    assert np.allclose(df[["A", "B", "C", "D"]].sum(axis=1), 1.0, atol=1e-6)

    # Per-group present counts within [min_count, max_count].
    c1 = (df[["A", "B"]] > 0).sum(axis=1)
    c2 = (df[["C", "D"]] > 0).sum(axis=1)
    assert (c1 >= 1).all() and (c1 <= 2).all()
    assert (c2 >= 1).all() and (c2 <= 2).all()

    # Global present count within [min, max].
    total_present = c1 + c2
    assert (total_present >= 2).all() and (total_present <= 4).all()


def test_optional_group_can_be_absent_but_required_group_always_present():
    np.random.seed(1)
    formulation = {
        "Base": {"min": 0.5, "max": 1.0, "units": "", "required": True},
        "X": {"min": 0.05, "max": 0.3, "units": "", "required": False},
        "Y": {"min": 0.05, "max": 0.3, "units": "", "required": False},
    }
    groups = [
        {"min": 0.5, "max": 1.0, "min_count": 1, "max_count": 1, "ingredients": ["Base"]},
        {"min": 0.1, "max": 0.4, "min_count": 0, "max_count": 2, "ingredients": ["X", "Y"]},
    ]

    df, _ = _build_grouped(
        formulation,
        groups,
        num_rows=300,
        min_ingredients_per_formulation=1,
        max_ingredients_per_formulation=3,
    )

    # Required ingredient -> its group is always present.
    assert (df["Base"] > 0).all()

    optional_sum = df[["X", "Y"]].sum(axis=1)
    absent = optional_sum < 1e-9
    present = optional_sum >= 1e-9

    # The optional group is sometimes entirely absent and sometimes present.
    assert absent.any()
    assert present.any()

    # When present, the group sum honors its CONDITIONAL bounds (never below 0.1).
    assert (optional_sum[present] >= 0.1 - 1e-9).all()
    assert (optional_sum[present] <= 0.4 + 1e-9).all()

    assert np.allclose(df[["Base", "X", "Y"]].sum(axis=1), 1.0, atol=1e-6)


def test_grouped_api_populates_group_column(client):
    body = {
        "general_inputs": [],
        "formulation_groups": [
            {
                "name": "Resins",
                "min": 0.5,
                "max": 0.9,
                "min_ingredients": 1,
                "max_ingredients": 2,
                "ingredients": [
                    {"name": "UDMA", "min": 0.1, "max": 0.8, "units": "", "required": False},
                    {"name": "IBOA", "min": 0.1, "max": 0.8, "units": "", "required": False},
                ],
            },
            {
                "name": "Additives",
                "min": 0.1,
                "max": 0.5,
                "min_ingredients": 1,
                "max_ingredients": 1,
                "ingredients": [
                    {"name": "Irganox819", "min": 0.05, "max": 0.5, "units": "", "required": False},
                ],
            },
        ],
        "outputs": [
            {"name": "modulus", "min": 100.0, "max": 10000.0, "units": "MPa"},
        ],
        "num_rows": 25,
        "noise": 0.01,
    }

    response = client.post("/api/dataset-generator", json=body)
    assert response.status_code == 200
    data = response.json()

    assert "components_csv_string" in data
    rows = list(csv.reader(data["components_csv_string"].splitlines()))
    assert rows[0] == ["id", "Group", "SMILES"]
    assert rows[1] == ["UDMA", "Resins", ""]
    assert rows[2] == ["IBOA", "Resins", ""]
    assert rows[3] == ["Irganox819", "Additives", ""]


def test_grouped_api_rejects_infeasible_group_upper_bounds(client):
    # Two groups whose upper bounds sum to less than 1.0 cannot reach 100%.
    body = {
        "general_inputs": [],
        "formulation_groups": [
            {
                "name": "G1",
                "min": 0.1,
                "max": 0.3,
                "ingredients": [
                    {"name": "A", "min": 0.05, "max": 0.3, "units": "", "required": False},
                ],
            },
            {
                "name": "G2",
                "min": 0.1,
                "max": 0.3,
                "ingredients": [
                    {"name": "B", "min": 0.05, "max": 0.3, "units": "", "required": False},
                ],
            },
        ],
        "outputs": [
            {"name": "y", "min": 0.0, "max": 1.0, "units": ""},
        ],
        "num_rows": 10,
        "noise": 0.0,
    }

    response = client.post("/api/dataset-generator", json=body)
    assert response.status_code == 400


def test_grouped_api_rejects_group_max_count_exceeding_group_size(client):
    body = {
        "general_inputs": [],
        "formulation_groups": [
            {
                "name": "G1",
                "min": 0.0,
                "max": 1.0,
                "min_ingredients": 1,
                "max_ingredients": 5,  # only 2 ingredients in the group
                "ingredients": [
                    {"name": "A", "min": 0.1, "max": 0.9, "units": "", "required": False},
                    {"name": "B", "min": 0.1, "max": 0.9, "units": "", "required": False},
                ],
            },
        ],
        "outputs": [
            {"name": "y", "min": 0.0, "max": 1.0, "units": ""},
        ],
        "num_rows": 10,
        "noise": 0.0,
    }

    response = client.post("/api/dataset-generator", json=body)
    assert response.status_code == 400


def test_default_global_ingredient_counts_from_groups():
    """Min/max defaults follow per-group counts, not total ingredient count."""
    groups = [
        {
            "min_count": 3,
            "max_count": 3,
            "ingredients": [
                {"required": True},
                {"required": True},
                {"required": True},
            ],
        },
        {"min_count": 1, "max_count": 1, "ingredients": [{"required": True}]},
        {"min_count": 1, "max_count": 3, "ingredients": [{}, {}, {}]},
        {"min_count": 1, "max_count": 3, "ingredients": [{}, {}, {}]},
        {"min_count": 1, "max_count": 2, "ingredients": [{}, {}]},
    ]
    assert _default_global_ingredient_counts(groups) == (7, 12)


def test_grouped_api_omitted_global_counts_use_group_defaults(client):
    body = {
        "general_inputs": [],
        "formulation_groups": [
            {
                "name": "Resins",
                "min": 0.5,
                "max": 0.9,
                "min_ingredients": 1,
                "max_ingredients": 2,
                "ingredients": [
                    {"name": "UDMA", "min": 0.1, "max": 0.8, "units": "", "required": False},
                    {"name": "IBOA", "min": 0.1, "max": 0.8, "units": "", "required": False},
                ],
            },
            {
                "name": "Additives",
                "min": 0.1,
                "max": 0.5,
                "min_ingredients": 1,
                "max_ingredients": 1,
                "ingredients": [
                    {"name": "Irganox819", "min": 0.05, "max": 0.5, "units": "", "required": False},
                ],
            },
        ],
        "outputs": [
            {"name": "modulus", "min": 100.0, "max": 10000.0, "units": "MPa"},
        ],
        "num_rows": 25,
        "noise": 0.01,
    }

    response = client.post("/api/dataset-generator", json=body)
    assert response.status_code == 200


def test_legacy_formulation_inputs_still_supported(client):
    # Requests without formulation_groups are treated as a single implicit group.
    body = {
        "general_inputs": [],
        "formulation_inputs": [
            {"name": "UDMA", "min": 0.1, "max": 0.6, "units": ""},
            {"name": "IBOA", "min": 0.05, "max": 0.8, "units": ""},
            {"name": "HDDA", "min": 0.05, "max": 0.8, "units": ""},
        ],
        "outputs": [
            {"name": "modulus", "min": 100.0, "max": 10000.0, "units": "MPa"},
        ],
        "num_rows": 20,
        "noise": 0.01,
        "min_ingredients_per_formulation": 2,
        "max_ingredients_per_formulation": 3,
    }

    response = client.post("/api/dataset-generator", json=body)
    assert response.status_code == 200
    data = response.json()
    assert "csv_string" in data

    # Legacy path leaves the Group column blank.
    rows = list(csv.reader(data["components_csv_string"].splitlines()))
    assert rows[0] == ["id", "Group", "SMILES"]
    assert rows[1] == ["UDMA", "", ""]
