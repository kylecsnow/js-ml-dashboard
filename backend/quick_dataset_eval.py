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
from sklearn.linear_model import Ridge
from sklearn.model_selection import RepeatedKFold
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
from sklearn.preprocessing import OrdinalEncoder, OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from ngboost import NGBRegressor
from catboost import CatBoostRegressor


# ──────────────────────────────────────────────
#  USER SETTINGS — edit these before each run
# ──────────────────────────────────────────────
FILE_DIR = os.path.expanduser("~/Downloads")

# FILENAME = "drilling_fluid_formulations_v4.csv"

# FILENAME = "cyanoacrylate_formulations.csv"
# FILENAME = "cyanoacrylate_formulations_AGED_ROWS_REMOVED.csv"
FILENAME = "cyanoacrylate_formulations_OUTLIERS_AND_AGED_ROWS_REMOVED.csv"

# FILENAME = "stimchem_corrosion_formulations.csv"

# OUTPUT_COLUMNS = [
#     "Filtration Loss-mL/30 min",
#     "Shear Stress at 3 rpm-Pa",
#     "Shear Stress at 300 rpm-Pa",
#     "Shear Stress at 600 rpm-Pa",
# ]
OUTPUT_COLUMNS = [
    "Viscosity",
    "Set time",
    # "Tensile strength",
]
# OUTPUT_COLUMNS = [
#     "Corrosion Loss (lb/ft2)",
# ]


# Columns to drop entirely (e.g. IDs, labels not useful as features).
# DROP_COLUMNS = ["Formulation_ID"]

DROP_COLUMNS = ["Sample_ID", "Formulation", "Lot# or Study#", "Tensile strength"]
# DROP_COLUMNS = ["Sample_ID", "Formulation", "Lot# or Study#", "Tensile strength", "Time"]

# DROP_COLUMNS = ["Formulation_ID", "Acid Blend"]


K_FOLDS = 5
NUM_TRIALS = 5


# Set True if the CSV uses compact formulation format
# (component-N_identifier / component-N_amount column pairs).
COMPACT_FORMAT = True

# ──────────────────────────────────────────────



def detect_categorical_columns(df: pd.DataFrame) -> tuple[list[str], list[str]]:
    """Auto-detect categorical vs numerical columns.

    Categorical columns are identified by:
      - dtype 'object' or 'category'
      - (numeric columns with very few unique values could be added, but this
        risks misclassifying actual numeric features)

    Returns:
        (categorical_columns, numerical_columns)
    """
    categorical_cols = []
    numerical_cols = []
    for col in df.columns:
        if df[col].dtype in ["object", "category"]:
            categorical_cols.append(col)
        else:
            numerical_cols.append(col)
    return categorical_cols, numerical_cols


def encode_categoricals(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    categorical_cols: list[str],
) -> tuple[np.ndarray, np.ndarray, OrdinalEncoder | None]:
    """Apply ordinal encoding to categorical columns.

    Ordinal encoding is preferred for tree-based models (RF, NGBoost, CatBoost)
    because trees can learn arbitrary splits on the encoded values without
    needing one-hot explosion.

    Returns:
        (X_train_encoded, X_test_encoded, fitted_encoder)
    """
    if not categorical_cols:
        return X_train.to_numpy(dtype=float), X_test.to_numpy(dtype=float), None

    numerical_cols = [c for c in X_train.columns if c not in categorical_cols]

    encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    encoder.fit(X_train[categorical_cols])

    cat_train = encoder.transform(X_train[categorical_cols])
    cat_test = encoder.transform(X_test[categorical_cols])

    num_train = X_train[numerical_cols].to_numpy(dtype=float)
    num_test = X_test[numerical_cols].to_numpy(dtype=float)

    X_train_enc = np.hstack([num_train, cat_train]) if numerical_cols else cat_train
    X_test_enc = np.hstack([num_test, cat_test]) if numerical_cols else cat_test

    return X_train_enc, X_test_enc, encoder


def make_linear_preprocessor(
    categorical_cols: list[str],
    numerical_cols: list[str],
) -> ColumnTransformer:
    """Create a preprocessing pipeline for linear models.

    Linear models need:
      - One-hot encoding for categoricals (not ordinal, since coefficients
        would incorrectly imply magnitude relationships)
      - Standard scaling for numerical features (important for regularization)
    """
    transformers = []
    if numerical_cols:
        transformers.append(("num", StandardScaler(), numerical_cols))
    if categorical_cols:
        transformers.append((
            "cat",
            OneHotEncoder(handle_unknown="ignore", sparse_output=False),
            categorical_cols,
        ))
    return ColumnTransformer(transformers, remainder="drop")


# Adapted from backend/utils.py — compact_to_wide_format
def compact_to_wide_format(df: pd.DataFrame) -> pd.DataFrame:
    """Pivot component-N_identifier / component-N_amount pairs into one
    column per unique ingredient, filled with the corresponding amounts."""
    wide_rows = []
    for _, row in df.iterrows():
        formulation: dict[str, float] = {}
        for i in range(1, len(df.columns) // 2 + 1):
            name_col = f"component-{i}_identifier"
            weight_col = f"component-{i}_amount"
            if name_col in df.columns and pd.notna(row[name_col]):
                formulation[row[name_col]] = row[weight_col]
        wide_rows.append(formulation)
    result = pd.DataFrame(wide_rows).fillna(0)
    return result.reindex(sorted(result.columns), axis=1)


def load_data(
    filename: str,
    output_columns: list[str],
    compact_format: bool,
    drop_columns: list[str],
) -> tuple[pd.DataFrame, pd.DataFrame, list[str], list[str]]:
    """Load CSV and return inputs, outputs, and column type info.

    Returns:
        (X, Y, categorical_cols, numerical_cols)
    """
    path = os.path.join(FILE_DIR, filename)
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

    categorical_cols, numerical_cols = detect_categorical_columns(X)

    print(f"Inputs  ({X.shape[1]}): {list(X.columns)}")
    if categorical_cols:
        print(f"  → Categorical ({len(categorical_cols)}): {categorical_cols}")
        print(f"  → Numerical   ({len(numerical_cols)}): {numerical_cols}")
    print(f"Outputs ({len(output_columns)}): {output_columns}")
    return X, Y, categorical_cols, numerical_cols


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    return {
        "R²": r2_score(y_true, y_pred),
        "RMSE": np.sqrt(mean_squared_error(y_true, y_pred)),
        "MAE": mean_absolute_error(y_true, y_pred),
    }


def run_cv(
    X: pd.DataFrame,
    y: np.ndarray,
    model_factory,
    k: int,
    n_repeats: int,
    categorical_cols: list[str],
    use_catboost: bool = False,
    use_linear: bool = False,
) -> tuple[dict, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Run repeated k-fold CV, returning aggregated metrics and per-point predictions.

    Encoding is performed within each fold to prevent data leakage.
    - CatBoost: receives categorical indices directly
    - Linear models: one-hot encoding + standard scaling via Pipeline
    - Tree models: ordinal encoding (no scaling needed)
    """
    rkf = RepeatedKFold(n_splits=k, n_repeats=n_repeats)

    train_actuals, train_preds = [], []
    test_actuals, test_preds = [], []
    fold_train_metrics: list[dict] = []
    fold_test_metrics: list[dict] = []

    numerical_cols = [c for c in X.columns if c not in categorical_cols]

    for fold, (train_idx, test_idx) in enumerate(rkf.split(X), start=1):
        X_train_df = X.iloc[train_idx]
        X_test_df = X.iloc[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        if use_catboost:
            cat_indices = [X.columns.get_loc(c) for c in categorical_cols]
            X_train_enc = X_train_df.to_numpy()
            X_test_enc = X_test_df.to_numpy()
            model = model_factory(cat_features=cat_indices)
            model.fit(X_train_enc, y_train)
            pred_train = model.predict(X_train_enc)
            pred_test = model.predict(X_test_enc)
        elif use_linear:
            preprocessor = make_linear_preprocessor(categorical_cols, numerical_cols)
            model = Pipeline([
                ("preprocess", preprocessor),
                ("regressor", model_factory()),
            ])
            model.fit(X_train_df, y_train)
            pred_train = model.predict(X_train_df)
            pred_test = model.predict(X_test_df)
        else:
            X_train_enc, X_test_enc, _ = encode_categoricals(
                X_train_df, X_test_df, categorical_cols
            )
            model = model_factory()
            model.fit(X_train_enc, y_train)
            pred_train = model.predict(X_train_enc)
            pred_test = model.predict(X_test_enc)

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
    print(f"\nRunning evaluations on dataset: {os.path.join(FILE_DIR, FILENAME)}...\n")
    X, Y, categorical_cols, numerical_cols = load_data(
        FILENAME, OUTPUT_COLUMNS, COMPACT_FORMAT, DROP_COLUMNS
    )

    models = {
        "RandomForest": (
            lambda **kw: RandomForestRegressor(n_estimators=200),
            {"use_catboost": False, "use_linear": False},
        ),
        "NGBoost": (
            lambda **kw: NGBRegressor(verbose=False),
            {"use_catboost": False, "use_linear": False},
        ),
        "CatBoost": (
            lambda cat_features=None, **kw: CatBoostRegressor(
                iterations=500,
                learning_rate=0.1,
                depth=6,
                cat_features=cat_features,
                verbose=False,
            ),
            {"use_catboost": True, "use_linear": False},
        ),
        "Ridge": (
            lambda **kw: Ridge(alpha=1.0),
            {"use_catboost": False, "use_linear": True},
        ),
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

        for col, (model_name, (factory, flags)) in enumerate(models.items()):
            print(f"\n  ── {model_name} ({K_FOLDS}-fold CV × {NUM_TRIALS} trials) ──")
            summary, tr_a, tr_p, te_a, te_p = run_cv(
                X, y, factory, K_FOLDS, NUM_TRIALS, categorical_cols, **flags
            )

            for metric, value in summary.items():
                print(f"    {metric:12s}  {value}")

            parity_plot(
                tr_a, tr_p, te_a, te_p,
                title=f"{out_col} — {model_name}",
                ax=axes[row, col],
                test_metrics=summary,
            )

    fig.tight_layout()
    plot_name = f"PARITY_PLOT_{FILENAME.split('.csv')[0]}.png"
    plot_path = os.path.join(FILE_DIR, plot_name)
    plt.savefig(plot_path, dpi=150)
    print(f"\nParity plot saved to {plot_path}")


if __name__ == "__main__":
    main()
