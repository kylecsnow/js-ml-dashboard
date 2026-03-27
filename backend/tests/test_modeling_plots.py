import numpy as np

from modeling import create_parity_plot, create_residual_plot


def _sample_model_results():
    return {
        "y_test": np.array([1.0, 2.0, 3.0, 4.0]),
        "y_pred_test": np.array([1.1, 1.9, 3.2, 3.8]),
        "y_pred_test_uncertainty": np.array([0.2, 0.1, 0.15, 0.2]),
        "metrics": {
            "test": {
                "R^2": 0.91,
                "RMSE": 0.22,
                "MAE": 0.18,
                "Coverage Fraction": 0.75,
                "R^2_0": 0.88,
                "k": 0.99,
            }
        },
    }


def test_create_parity_plot_returns_scatter_with_diagonal():
    fig = create_parity_plot(_sample_model_results(), width=500, height=400)

    assert fig.data
    assert fig.layout.width == 500
    assert fig.layout.height == 400
    assert fig.layout.shapes
    assert fig.layout.shapes[0]["type"] == "line"


def test_create_residual_plot_returns_scatter_with_zero_line():
    fig = create_residual_plot(_sample_model_results(), x_axis_range=(0.5, 4.5))

    assert fig.data
    assert fig.layout.shapes
    assert fig.layout.shapes[0]["type"] == "line"
    assert list(fig.layout.xaxis.range) == [0.5, 4.5]
