import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import plotly.express as px


def create_parity_plot(model_results, title="Model Prediction Parity Plot", log_x=False, log_y=False, axis_range=None, width=800, height=600):
    
    y_test = model_results["y_test"]
    y_pred_test = model_results["y_pred_test"]
    y_pred_test_uncertainty = model_results["y_pred_test_uncertainty"]
    r2 = model_results["metrics"]["test"]["R^2"]
    rmse = model_results["metrics"]["test"]["RMSE"]
    mae = model_results["metrics"]["test"]["MAE"]
    uncertainty_coverage = model_results["metrics"]["test"]["Coverage Fraction"]
    r2_0 = model_results["metrics"]["test"]["R^2_0"]
    k = model_results["metrics"]["test"]["k"]

    df = pd.DataFrame({
        "Actual": y_test,
        "Predicted": y_pred_test,
        "Uncertainty": y_pred_test_uncertainty,
    })

    if axis_range==None:
        min_val = min(df['Actual'].min(), df['Predicted'].min())
        max_val = max(df['Actual'].max(), df['Predicted'].max())
        padding = (max_val - min_val) * 0.05
        axis_min = min_val - padding
        axis_max = max_val + padding
    else:
        axis_min = axis_range[0]
        axis_max = axis_range[1]
    
    # determine whether or not plot will include error bars for uncertainty estimates
    if y_pred_test_uncertainty is not None:
        error_y = "Uncertainty"
    else:
        error_y = None

    # Create scatterplot
    fig = px.scatter(
        df, x='Actual', y='Predicted',
        title=f"<span style='font-size: 20px'>{title}</span><br><span style='font-size: 14px'>R² = {r2:.4f}, RMSE = {rmse:.2f}, MAE = {mae:.2f},<br>Uncertainty Coverage = {(uncertainty_coverage * 100 if uncertainty_coverage is not None else np.NaN):.2f}%, k = {k:.4f}, R²_0 = {r2_0:.4f}</span>",
        template='plotly_white',
        opacity=0.7,
        error_y=error_y,
        width=width, height=height,
        log_x=log_x,
        log_y=log_y,
    )

    fig.update_traces(marker=dict(size=8))
    
    # Add diagonal line
    fig.add_shape(
        type='line',
        x0=axis_min, y0=axis_min,
        x1=axis_max, y1=axis_max,
        line=dict(color='gray', dash='dash', width=2)
    )

    fig.update_layout(
        xaxis=dict(
            range=[axis_min, axis_max],
            constrain='domain',
            showline=True,
        ),
        yaxis=dict(
            range=[axis_min, axis_max],
            constrain='domain',
            scaleanchor='x',
            scaleratio=1,
            showline=True,
        ),
        margin=dict(l=80, r=80, t=100, b=80),
        title=dict(
            x=0.5,  # Center the title
            xanchor='center',  # Anchor point for centering
            y=0.95  # Adjust vertical position if needed
        )
    )
    
    # Add grid lines
    fig.update_xaxes(showgrid=True, gridwidth=1, gridcolor='lightgray')
    fig.update_yaxes(showgrid=True, gridwidth=1, gridcolor='lightgray')
    
    return fig


def create_residual_plot(model_results, title="Standardized Residual Plot", log_x=False, x_axis_range=None, width=800, height=600):
    y_pred_test = model_results["y_pred_test"]
    y_test = model_results["y_test"]
    r2 = model_results["metrics"]["test"]["R^2"]
    rmse = model_results["metrics"]["test"]["RMSE"]
    mae = model_results["metrics"]["test"]["MAE"]

    residuals = y_pred_test - y_test
    std_residuals = residuals / np.std(residuals)  # not subtracting by the mean here, because we want to be able to preserve the ability to fully visaulize any bias present in the model.

    df = pd.DataFrame({
        "Predictions": y_pred_test,
        "Standardized Residuals": std_residuals,
    })

    if x_axis_range==None:
        x_min_val = df['Predictions'].min()
        x_max_val = df['Predictions'].max()
        x_padding = (x_max_val - x_min_val) * 0.05
        x_axis_min = x_min_val - x_padding
        x_axis_max = x_max_val + x_padding
    else:
        x_axis_min = x_axis_range[0]
        x_axis_max = x_axis_range[1]
    
    fig = px.scatter(
        df, x='Predictions', y='Standardized Residuals',
        title=f"{title}<br>R² = {r2:.4f}, RMSE = {rmse:.2f}, MAE = {mae:.2f}",
        template='plotly_white',
        opacity=0.7,
        log_x=log_x,
        width=width, height=height
    )

    fig.update_traces(marker=dict(size=10))
    
    # Add horizontal line at y = 0 (i.e. the zero-residual line)
    fig.add_shape(
        type='line',
        x0=x_axis_min, y0=0,
        x1=x_axis_max, y1=0,
        line=dict(color='gray', dash='dash', width=2)
    )

    if x_axis_range is not None:
        fig.update_layout(
            xaxis=dict(
                range=[x_axis_min, x_axis_max],
                constrain='domain',
                showline=True,
            ),
        )

    fig.update_xaxes(showgrid=True, gridwidth=1, gridcolor='lightgray')
    fig.update_yaxes(showgrid=True, gridwidth=1, gridcolor='lightgray')
    
    return fig


def get_estimator_type_from_estimator(estimator):
    estimator_type = str(type(estimator)).split("<class '")[-1].split("'>")[0]
    estimator_type = f"{estimator_type.split('.')[0]} {estimator_type.split('.')[-1]}"
    return estimator_type


def plot_loss_curve(loss_history, title="Training Loss Curve", figsize=(10, 6)):
    """Plot the loss curve from training history"""
    plt.figure(figsize=figsize)
    plt.plot(loss_history)
    plt.title(title)
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.grid(True)
    plt.yscale('log')
    plt.show()
