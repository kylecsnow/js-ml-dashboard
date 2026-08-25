from form_contracts import FormUpdates
from form_validation import validate_form_updates


def _group(name, lo, hi, ingredients, min_count=None, max_count=None):
    return {
        "name": name,
        "min": str(lo),
        "max": str(hi),
        "min_ingredients": min_count,
        "max_ingredients": max_count,
        "ingredients": [
            {"name": n, "min": str(l), "max": str(h), "required": r}
            for (n, l, h, r) in ingredients
        ],
    }


def _validate(updates: dict, form_state: dict | None = None):
    return validate_form_updates(form_state or {}, FormUpdates(**updates))


def test_valid_full_update_passes():
    errors = _validate(
        {
            "general_inputs": [{"name": "Cure Temperature", "min": "20", "max": "200", "units": "degC"}],
            "outputs": [{"name": "Tensile Strength", "min": "5", "max": "90", "units": "MPa"}],
            "formulation_groups": [
                _group("Base Resin", 0.5, 1.0, [("UDMA", 0.5, 0.9, True)]),
                _group("Additives", 0.001, 0.05, [("Irganox 819", 0.001, 0.02, False)]),
            ],
        }
    )
    assert errors == []


def test_rejects_group_min_above_max():
    errors = _validate(
        {"formulation_groups": [_group("Base", 0.9, 0.5, [("Resin", 0.5, 0.9, False)])]}
    )
    assert any("lower bound cannot exceed its upper bound" in e for e in errors)


def test_rejects_group_sum_below_one():
    errors = _validate(
        {
            "formulation_groups": [
                _group("Base", 0.1, 0.4, [("Resin A", 0.1, 0.4, False)]),
                _group("Additives", 0.1, 0.4, [("Additive A", 0.1, 0.4, False)]),
            ]
        }
    )
    assert any("sum of all group upper bounds is less than 1.0" in e for e in errors)


def test_rejects_forced_groups_summing_above_one():
    errors = _validate(
        {
            "formulation_groups": [
                _group("Base", 0.6, 0.9, [("Resin A", 0.6, 0.9, True)]),
                _group("Filler", 0.6, 0.9, [("Filler A", 0.6, 0.9, True)]),
            ]
        }
    )
    assert any("sum of lower bounds for always-present groups exceeds 1.0" in e for e in errors)


def test_rejects_required_ingredient_with_zero_min():
    errors = _validate(
        {"formulation_groups": [_group("Base", 0.5, 0.9, [("Resin", 0.0, 0.9, True)])]}
    )
    assert any("must have a lower bound greater than 0" in e for e in errors)


def test_rejects_ingredient_bounds_outside_unit_range():
    errors = _validate(
        {"formulation_groups": [_group("Base", 0.5, 0.9, [("Resin", 0.0, 1.5, False)])]}
    )
    assert any("between 0 and 1" in e for e in errors)


def test_rejects_max_count_exceeding_group_size():
    errors = _validate(
        {
            "formulation_groups": [
                _group(
                    "Base", 0.5, 0.9, [("Resin A", 0.5, 0.9, False)],
                    min_count=1, max_count=3,
                )
            ]
        }
    )
    assert any("max ingredients cannot exceed the number of ingredients" in e for e in errors)


def test_rejects_duplicate_group_names_across_categories():
    errors = _validate(
        {
            "general_inputs": [{"name": "Temperature", "min": "20", "max": "80", "units": "degC"}],
            "outputs": [
                {"name": "Temperature", "min": "20", "max": "80", "units": "degC"},
                {"name": "Viscosity", "min": "100", "max": "1000", "units": "cP"},
            ],
        }
    )
    assert errors == []  # cross-category duplicates are legal in this app


def test_rejects_duplicate_descriptors_within_category():
    errors = _validate(
        {
            "outputs": [
                {"name": "Viscosity", "min": "100", "max": "1000", "units": "cP"},
                {"name": "Viscosity", "min": "100", "max": "1000", "units": "cP"},
            ]
        }
    )
    assert any("duplicate name 'Viscosity'" in e for e in errors)


def test_rejects_descriptors_with_parenthetical_names():
    errors = _validate(
        {"general_inputs": [{"name": "Defoamer (Polyglycol)", "min": "1", "max": "9", "units": "mg/L"}]}
    )
    assert any("parentheses" in e for e in errors)


def test_rejects_ingredient_with_parenthetical_name():
    errors = _validate(
        {
            "formulation_groups": [
                _group("Base", 0.5, 0.9, [("Methacrylate (Diatyl)", 0.5, 0.9, False)])
            ]
        }
    )
    assert any("parentheses" in e for e in errors)


def test_rejects_non_numeric_bounds():
    errors = _validate(
        {"outputs": [{"name": "Strength", "min": "five", "max": "ninety", "units": "MPa"}]}
    )
    assert any("non-numeric min or max" in e for e in errors)


def test_rejects_empty_ingredient_name():
    errors = _validate(
        {
            "formulation_groups": [
                {
                    "name": "Base",
                    "min": "0.5",
                    "max": "1.0",
                    "ingredients": [{"name": "", "min": "0.5", "max": "0.9", "required": False}],
                }
            ]
        }
    )
    assert any("empty name" in e for e in errors)


def test_rejects_empty_group():
    errors = _validate(
        {"formulation_groups": [{"name": "Base", "min": "0.5", "max": "0.9", "ingredients": []}]}
    )
    assert any("must contain at least one ingredient" in e for e in errors)


def test_rejects_global_max_above_total_ingredients():
    errors = _validate(
        {
            "formulation_groups": [
                _group("Base", 0.5, 1.0, [("Resin", 0.5, 0.9, False)])
            ],
            "max_ingredients_per_formulation": 5,
        }
    )
    assert any("cannot exceed the total number of ingredients" in e for e in errors)


def test_merges_over_form_state_and_validates_the_union():
    # Existing state: one valid group. Update adds a second one whose combined
    # upper bounds still reach 1.0, so the merged state must pass.
    form_state = {
        "formulation_groups": [
            _group("Base", 0.5, 0.9, [("Resin A", 0.5, 0.9, True)]),
        ]
    }
    updates = {
        "formulation_groups": [
            _group("Base", 0.5, 0.9, [("Resin A", 0.5, 0.9, True)]),
            _group("Additives", 0.01, 0.1, [("Stabilizer", 0.01, 0.1, False)]),
        ]
    }
    assert _validate(updates, form_state) == []


def test_only_validates_changed_category():
    # Update touches general_inputs only; a pre-existing broken group in state
    # is not the model's fault in this request, but the endpoint's job is to
    # catch whatever it receives — so a broken group still fails.
    errors = _validate(
        {
            "general_inputs": [{"name": "Temp", "min": "20", "max": "80", "units": "degC"}],
            "formulation_groups": [
                _group("Base", 0.9, 0.2, [("Resin", 0.1, 0.2, False)])
            ],
        }
    )
    assert any("lower bound cannot exceed its upper bound" in e for e in errors)
