"""
Quick model evaluation script.

Trains NGBoost and scikit-learn RandomForest regressors on a CSV dataset,
computes k-fold cross-validated performance metrics (R², RMSE, MAE) for
train and test splits, and produces parity plots for each output variable.

Usage:
  1. Set FILENAME to your CSV file (expected in ~/Downloads/).
  2. Set OUTPUT_COLUMNS to the list of target column names.
  3. Optionally adjust K_FOLDS.
  4. Run:  python quick_demo_eval.py
"""

import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import KFold
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
from ngboost import NGBRegressor

from utils import compact_to_wide_format

# ──────────────────────────────────────────────
#  USER SETTINGS — edit these before each run
# ──────────────────────────────────────────────
FILENAME = "drilling_fluid_formulations_v4.csv"
OUTPUT_COLUMNS = [
    "Filtration Loss-mL/30 min",
    "Shear Stress at 3 rpm-Pa",
    "Shear Stress at 300 rpm-Pa",
    "Shear Stress at 600 rpm-Pa",
]
K_FOLDS = 5

# Set True if the CSV uses compact formulation format
# (component-N_identifier / component-N_amount column pairs).
COMPACT_FORMAT = True

# Columns to drop entirely (e.g. IDs, labels not useful as features).
DROP_COLUMNS = ["Formulation_ID"]
# ──────────────────────────────────────────────

DOWNLOADS_DIR = os.path.expanduser("~/Downloads")


def load_data(
    filename: str,
    output_columns: list[str],
    compact_format: bool,
    drop_columns: list[str],
) -> tuple[pd.DataFrame, pd.DataFrame]:
    path = os.path.join(DOWNLOADS_DIR, filename)
    df = pd.read_csv(path)
    print(f"Loaded {path}  —  {df.shape[0]} rows × {df.shape[1]} columns")

    missing = [c for c in output_columns if c not in df.columns]
    if missing:
        raise ValueError(
            f"Output columns not found in CSV: {missing}\nAvailable: {list(df.columns)}"
        )

    Y = df[output_columns]

    if compact_format:
        component_cols = [c for c in df.columns if c.startswith("component-")]
        other_input_cols = [
            c for c in df.columns
            if c not in output_columns
            and c not in drop_columns
            and c not in component_cols
        ]
        wide_df = compact_to_wide_format(df[component_cols])
        X = pd.concat(
            [df[other_input_cols].reset_index(drop=True), wide_df.reset_index(drop=True)],
            axis=1,
        )
    else:
        X = df.drop(columns=output_columns + drop_columns, errors="ignore")

    print(f"Inputs  ({X.shape[1]}): {list(X.columns)}")
    print(f"Outputs ({len(output_columns)}): {output_columns}")
    return X, Y


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    return {
        "R²": r2_score(y_true, y_pred),
        "RMSE": np.sqrt(mean_squared_error(y_true, y_pred)),
        "MAE": mean_absolute_error(y_true, y_pred),
    }


def run_cv(
    X: np.ndarray,
    y: np.ndarray,
    model_factory,
    k: int,
) -> tuple[dict, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Run k-fold CV, returning aggregated metrics and per-point predictions."""
    kf = KFold(n_splits=k, shuffle=True, random_state=42)

    train_actuals, train_preds = [], []
    test_actuals, test_preds = [], []
    fold_train_metrics: list[dict] = []
    fold_test_metrics: list[dict] = []

    for fold, (train_idx, test_idx) in enumerate(kf.split(X), start=1):
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        model = model_factory()
        model.fit(X_train, y_train)

        pred_train = model.predict(X_train)
        pred_test = model.predict(X_test)

        fold_train_metrics.append(compute_metrics(y_train, pred_train))
        fold_test_metrics.append(compute_metrics(y_test, pred_test))

        train_actuals.append(y_train)
        train_preds.append(pred_train)
        test_actuals.append(y_test)
        test_preds.append(pred_test)

    avg = lambda metrics_list, key: np.mean([m[key] for m in metrics_list])
    std = lambda metrics_list, key: np.std([m[key] for m in metrics_list])

    summary = {}
    for split_name, mlist in [("Train", fold_train_metrics), ("Test", fold_test_metrics)]:
        for key in ["R²", "RMSE", "MAE"]:
            summary[f"{split_name} {key}"] = f"{avg(mlist, key):.3f} ± {std(mlist, key):.3f}"

    return (
        summary,
        np.concatenate(train_actuals),
        np.concatenate(train_preds),
        np.concatenate(test_actuals),
        np.concatenate(test_preds),
    )


def parity_plot(
    train_actual, train_pred, test_actual, test_pred,
    title: str, ax: plt.Axes, test_metrics: dict,
):
    ax.scatter(train_actual, train_pred, c="gray", alpha=0.4, s=20, label="Train")
    ax.scatter(test_actual, test_pred, c="#1f77b4", alpha=0.7, s=28, label="Test")

    all_vals = np.concatenate([train_actual, train_pred, test_actual, test_pred])
    lo, hi = all_vals.min(), all_vals.max()
    margin = (hi - lo) * 0.05
    ax.plot([lo - margin, hi + margin], [lo - margin, hi + margin], "k--", lw=1)
    ax.set_xlim(lo - margin, hi + margin)
    ax.set_ylim(lo - margin, hi + margin)

    metrics_text = "Test Set Metrics\n" + "\n".join(
        f"{key}: {test_metrics[f'Test {key}']}" for key in ["R²", "RMSE", "MAE"]
    )
    ax.text(
        0.97, 0.03, metrics_text, transform=ax.transAxes,
        fontsize=7, verticalalignment="bottom", horizontalalignment="right",
        bbox=dict(boxstyle="round,pad=0.4", facecolor="white", alpha=0.8),
    )

    ax.set_xlabel("Actual")
    ax.set_ylabel("Predicted")
    ax.set_title(title)
    ax.legend(loc="upper left", fontsize=8)
    ax.set_aspect("equal", adjustable="box")


def main():
    X, Y = load_data(FILENAME, OUTPUT_COLUMNS, COMPACT_FORMAT, DROP_COLUMNS)
    X_np = X.to_numpy(dtype=float)

    models = {
        "RandomForest": lambda: RandomForestRegressor(n_estimators=200, random_state=42),
        "NGBoost": lambda: NGBRegressor(verbose=False, random_state=42),
    }

    n_outputs = Y.shape[1]
    n_models = len(models)
    fig, axes = plt.subplots(
        n_outputs, n_models,
        figsize=(6 * n_models, 5.5 * n_outputs),
        squeeze=False,
    )

    for row, out_col in enumerate(OUTPUT_COLUMNS):
        y = Y[out_col].to_numpy(dtype=float)
        print(f"\n{'='*60}")
        print(f"  Output: {out_col}")
        print(f"{'='*60}")

        for col, (model_name, factory) in enumerate(models.items()):
            print(f"\n  ── {model_name} ({K_FOLDS}-fold CV) ──")
            summary, tr_a, tr_p, te_a, te_p = run_cv(X_np, y, factory, K_FOLDS)

            for metric, value in summary.items():
                print(f"    {metric:12s}  {value}")

            parity_plot(
                tr_a, tr_p, te_a, te_p,
                title=f"{out_col} — {model_name}",
                ax=axes[row, col],
                test_metrics=summary,
            )

    fig.tight_layout()
    plot_name = f"parity_plot_{FILENAME.split('.csv')[0]}.png"
    plot_path = os.path.join(DOWNLOADS_DIR, plot_name)
    plt.savefig(plot_path, dpi=150)
    print(f"\nParity plot saved to {plot_path}")


if __name__ == "__main__":
    main()
