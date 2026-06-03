"""Direct unit tests for the legacy MCMC `gibbs_sample_formulation_space` sampler.

This sampler does not support ingredient groups. The app uses
`group_aware_sample_formulation_space` instead; these tests keep the Gibbs
implementation from silently regressing.
"""

import numpy as np
import pytest

from utils import gibbs_sample_formulation_space


def _five_ingredient_constraints():
    return [
        (0.1, 0.6),
        (0.05, 0.8),
        (0.05, 0.8),
        (0.05, 0.8),
        (0.0005, 0.02),
    ]


def test_gibbs_samples_sum_to_one():
    np.random.seed(1)
    constraints = _five_ingredient_constraints()

    samples = gibbs_sample_formulation_space(
        n_ingredients=5,
        constraints=constraints,
        n_samples=50,
        burn_in=20,
        min_ingredients_per_formulation=3,
        max_ingredients_per_formulation=5,
    )

    assert samples.shape == (50, 5)
    assert np.allclose(samples.sum(axis=1), 1.0, atol=1e-6)


def test_gibbs_enforces_present_ingredient_count_bounds():
    np.random.seed(1)
    constraints = _five_ingredient_constraints()

    samples = gibbs_sample_formulation_space(
        n_ingredients=5,
        constraints=constraints,
        n_samples=75,
        burn_in=30,
        min_ingredients_per_formulation=3,
        max_ingredients_per_formulation=5,
    )

    present_counts = np.sum(samples > 0.0, axis=1)
    assert (present_counts >= 3).all()
    assert (present_counts <= 5).all()


def test_gibbs_enforces_required_ingredients():
    np.random.seed(2)
    constraints = [
        (0.4, 0.85),  # required carrier
        (0.02, 0.35),
        (0.02, 0.35),
        (0.02, 0.35),
    ]
    required = [True, False, False, False]

    samples = gibbs_sample_formulation_space(
        n_ingredients=4,
        constraints=constraints,
        n_samples=80,
        burn_in=25,
        min_ingredients_per_formulation=2,
        max_ingredients_per_formulation=4,
        required=required,
    )

    carrier = samples[:, 0]
    assert (carrier > 0.0).all()
    assert (carrier >= constraints[0][0] - 1e-12).all()
    assert (carrier <= constraints[0][1] + 1e-12).all()

    # Optional ingredients may still be omitted.
    assert (samples[:, 1] == 0.0).any()


def test_gibbs_enforces_per_ingredient_bounds():
    np.random.seed(3)
    constraints = _five_ingredient_constraints()

    samples = gibbs_sample_formulation_space(
        n_ingredients=5,
        constraints=constraints,
        n_samples=100,
        burn_in=40,
        min_ingredients_per_formulation=3,
        max_ingredients_per_formulation=5,
    )

    for j, (lo, hi) in enumerate(constraints):
        col = samples[:, j]
        assert (col <= hi + 1e-12).all()
        present_mask = col > 0.0
        assert (col[present_mask] >= lo - 1e-12).all()


def test_gibbs_rejects_required_ingredient_with_zero_lower_bound():
    with pytest.raises(ValueError, match="lower bound greater than 0"):
        gibbs_sample_formulation_space(
            n_ingredients=2,
            constraints=[(0.0, 0.8), (0.1, 0.9)],
            n_samples=5,
            burn_in=0,
            required=[True, False],
        )


def test_gibbs_rejects_infeasible_min_present_count():
    with pytest.raises(ValueError, match="Cannot satisfy min_ingredients_per_formulation"):
        gibbs_sample_formulation_space(
            n_ingredients=3,
            constraints=[(0.4, 0.5), (0.4, 0.5), (0.4, 0.5)],
            n_samples=5,
            burn_in=0,
            min_ingredients_per_formulation=3,
            max_ingredients_per_formulation=3,
        )
