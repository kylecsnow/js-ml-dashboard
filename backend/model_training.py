# from catboost import CatBoostRegressor
import matplotlib.pyplot as plt
from ngboost import NGBRegressor
import numpy as np
import pandas as pd
from scipy.stats import boxcox
from scipy.special import inv_boxcox
from sklearn.base import clone
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import KFold, learning_curve
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_absolute_error, root_mean_squared_error
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from xgboost import XGBRegressor


def is_within_uncertainty_range(y_test, y_pred_test_lower_bound, y_pred_test_upper_bound):
    return (y_test >= y_pred_test_lower_bound) & (y_test <= y_pred_test_upper_bound)


def calculate_data_fraction_within_uncertainty_bounds(y_test, y_pred_test_lower_bound, y_pred_test_upper_bound):
    num_samples_within_uncertainty_bounds = is_within_uncertainty_range(y_test, y_pred_test_lower_bound, y_pred_test_upper_bound).sum()
    num_samples = len(y_test)
    data_fraction_within_uncertainty_bounds = num_samples_within_uncertainty_bounds / num_samples
    return data_fraction_within_uncertainty_bounds


def train_and_evaluate_estimator(estimator, train_df, test_df, inputs, target, data_transform=None, verbose=True):

    X = train_df[inputs]
    X_test = test_df[inputs]

    if data_transform=="log":
        y = train_df[target].apply(np.log)
        y_test = test_df[target].apply(np.log)
    elif data_transform=="boxcox":
        y, best_lambda = boxcox(train_df[target])
        y_test = boxcox(test_df[target], lmbda=best_lambda)
    elif data_transform is None:
        y = train_df[target].to_numpy()
        y_test = test_df[target].to_numpy()

    estimator.fit(X, y)
    
    if isinstance(estimator, NGBRegressor):
        y_pred_train_dist = estimator.pred_dist(X)
        y_pred_test_dist = estimator.pred_dist(X_test)
        
        if data_transform=="log":
            mu_train = y_pred_train_dist.loc
            sigma_train = y_pred_train_dist.scale
            y_pred_train = np.exp(mu_train + sigma_train**2 / 2)
            y_pred_train_variance = (np.exp(sigma_train**2) - 1) * np.exp(2*mu_train + sigma_train**2)
            y_pred_train_uncertainty = np.sqrt(y_pred_train_variance)
            y = np.exp(y)

            mu_test = y_pred_test_dist.loc
            sigma_test = y_pred_test_dist.scale
            y_pred_test = np.exp(mu_test + sigma_test**2 / 2)
            y_pred_test_variance = (np.exp(sigma_test**2) - 1) * np.exp(2*mu_test + sigma_test**2)
            y_pred_test_uncertainty = np.sqrt(y_pred_test_variance)
            y_test = np.exp(y_test)

        elif data_transform=="boxcox":
            mu_train = y_pred_train_dist.loc
            sigma_train = y_pred_train_dist.scale
            y_pred_train = inv_boxcox(mu_train, best_lambda)
            derivative = (best_lambda * mu_train + 1) ** (1 / best_lambda - 1)  # Calculate the derivative of the inverse Box-Cox function at mu_transformed
            y_pred_train_uncertainty = sigma_train * derivative  # Propagate the uncertainty via the delta method
            y = inv_boxcox(y, best_lambda)

            mu_test = y_pred_test_dist.loc
            sigma_test = y_pred_test_dist.scale
            y_pred_test = inv_boxcox(mu_test, best_lambda)
            derivative = (best_lambda * mu_test + 1) ** (1 / best_lambda - 1)  # Calculate the derivative of the inverse Box-Cox function at mu_transformed
            y_pred_test_uncertainty = sigma_test * derivative  # Propagate the uncertainty via the delta method
            y_test = inv_boxcox(y_test, best_lambda)

        elif data_transform is None:
            y_pred_train = y_pred_train_dist.loc
            y_pred_train_uncertainty = y_pred_train_dist.scale
            y_pred_test = y_pred_test_dist.loc
            y_pred_test_uncertainty = y_pred_test_dist.scale
    
    else:
        y_pred_train = estimator.predict(X)
        y_pred_test = estimator.predict(X_test)
        if data_transform=="log":
            y = np.exp(y)
            y_test = np.exp(y_test)
            y_pred_train = np.exp(y_pred_train)
            y_pred_test = np.exp(y_pred_test)
        elif data_transform=="boxcox":
            y = inv_boxcox(y, best_lambda)
            y_test = inv_boxcox(y_test, best_lambda)
            y_pred_train = inv_boxcox(y_pred_train, best_lambda)
            y_pred_test = inv_boxcox(y_pred_test, best_lambda)
        y_pred_train_uncertainty = None
        y_pred_test_uncertainty = None
    
    if y_pred_test_uncertainty is not None:
        y_pred_test_lower_bound = y_pred_test - y_pred_test_uncertainty
        y_pred_test_upper_bound = y_pred_test + y_pred_test_uncertainty
        test_coverage_fraction = calculate_data_fraction_within_uncertainty_bounds(y_test, y_pred_test_lower_bound, y_pred_test_upper_bound)
    else:
        test_coverage_fraction = None


    # compute k and R^2_0
    reg = LinearRegression(fit_intercept=False)  # enforce zero y-intercept
    reg.fit(y_test.reshape(-1, 1), y_pred_test.reshape(-1, 1))
    k = reg.coef_[0][0]
    r2_0 = reg.score(y_test.reshape(-1, 1), y_pred_test.reshape(-1, 1))

    ### TODO: currently this handles Regression problems only; need to add support for Classification problems
    metrics = {
        "train": {
            "R^2": r2_score(y, y_pred_train),
            "MAE": mean_absolute_error(y, y_pred_train),
            "RMSE": root_mean_squared_error(y, y_pred_train),
        },
        "test": {
            "R^2": r2_score(y_test, y_pred_test),
            "MAE": mean_absolute_error(y_test, y_pred_test),
            "RMSE": root_mean_squared_error(y_test, y_pred_test),
            "Coverage Fraction": test_coverage_fraction,
            "k": k,
            "R^2_0": r2_0,
        },
    }

    if verbose:
        print(f"Train R^2:  {metrics['train']['R^2']}")
        print(f"Train MAE:  {metrics['train']['MAE']}")
        print(f"Train RMSE:  {metrics['train']['RMSE']}")
        print()
        print(f"Test R^2:  {metrics['test']['R^2']}")
        print(f"Test MAE:  {metrics['test']['MAE']}")
        print(f"Test RMSE:  {metrics['test']['RMSE']}")

    results = {
        "target": target,
        "estimator": estimator,
        "inputs_numerical": inputs,
        "metrics": metrics,
        "y_train": y,
        "y_pred_train": y_pred_train,
        "y_pred_train_uncertainty": y_pred_train_uncertainty,
        "y_test": y_test,
        "y_pred_test": y_pred_test,
        "y_pred_test_uncertainty": y_pred_test_uncertainty,
    }

    return results


def generate_learning_curve_data(
    estimator,
    X,
    y,
    train_sizes=np.linspace(0.1, 1.0, 10),
    cv=KFold(n_splits=5, shuffle=True),
    scoring="r2",
    n_jobs=-1,
    verbose=1,
):
    
    estimator = clone(estimator)  # use the same model type & hyperparameters as given, but don't copy the "state" of the trained model
      
    train_sizes, train_scores, val_scores = learning_curve(
        estimator,
        X=X,
        y=y,
        train_sizes=train_sizes,
        cv=cv,
        scoring=scoring,
        verbose=verbose,
        n_jobs=n_jobs,
    )

    learning_curve_data = {
        "train_sizes": train_sizes,
        "train_scores": train_scores,
        "val_scores": val_scores,
    }

    return learning_curve_data


def create_learning_curve_plot(learning_curve_data, title="Learning Curve", y_lim=None):

    train_sizes = learning_curve_data["train_sizes"]
    train_scores = learning_curve_data["train_scores"]
    val_scores = learning_curve_data["val_scores"]
    
    train_mean = np.mean(train_scores, axis=1)
    train_std = np.std(train_scores, axis=1)
    val_mean = np.mean(val_scores, axis=1)
    val_std = np.std(val_scores, axis=1)

    # Plot curve
    plt.figure(figsize=(8, 6))
    plt.plot(train_sizes, train_mean, 'o-', color="blue", label="Training Score")
    plt.fill_between(train_sizes, train_mean - train_std, train_mean + train_std, alpha=0.2, color="blue")
    plt.plot(train_sizes, val_mean, 'o-', color="red", label="Validation Score")
    plt.fill_between(train_sizes, val_mean - val_std, val_mean + val_std, alpha=0.2, color="red")
    
    if y_lim is not None:
        plt.ylim(y_lim)

    plt.xlabel("Training Set Size")
    plt.ylabel("Score")
    plt.title(title)
    plt.legend(loc="best")
    plt.grid()

    plt.show()


class MCDropoutNN(nn.Module):
    def __init__(self, input_size, hidden_size, output_size, dropout_rate=0.1):
        super(MCDropoutNN, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.dropout = nn.Dropout(dropout_rate)
        self.fc2 = nn.Linear(hidden_size, output_size)
        
    def forward(self, x):
        x = F.relu(self.fc1(x))
        x = self.dropout(x)  # Apply dropout even during inference
        x = self.fc2(x)
        return x
    
    def predict(self, x, num_samples=100):
        """Make predictions with uncertainty estimates using MC Dropout"""
        self.train()  # Set model to training mode to enable dropout
        
        sampled_predictions = []
        for _ in range(num_samples):
            y_pred = self(x)
            sampled_predictions.append(y_pred)
            
        # Stack predictions
        predictions = torch.stack(sampled_predictions)
        
        # Calculate mean and standard deviation
        mean = predictions.mean(dim=0)
        std = predictions.std(dim=0)
        
        return mean, std


def train_NN_model(model, train_loader, num_epochs=1000, lr=0.01):
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    
    train_loss_history = []

    for epoch in range(num_epochs):

        train_loss = 0.0
        for inputs, targets in train_loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()

        avg_train_loss = train_loss / len(train_loader)
        train_loss_history.append(avg_train_loss)

        if epoch % 100 == 0 or epoch + 1 == num_epochs:
            print(f"Epoch {epoch} - Loss: {avg_train_loss}")
    
    return model, train_loss_history


def inverse_transform_BNN_results(trained_model, y_train_pred_mean, y_train_pred_std, y_test_pred_mean, y_test_pred_std, inputs, target, y_train, y_test, y_scaler, best_lambda):   
    
    # invert StandardScaler
    y_train_pred_mean = y_scaler.inverse_transform(y_train_pred_mean.detach().numpy())
    y_train_pred_std = y_scaler.inverse_transform(y_train_pred_std.detach().numpy())
    y_test_pred_mean = y_scaler.inverse_transform(y_test_pred_mean.detach().numpy())
    y_test_pred_std = y_scaler.inverse_transform(y_test_pred_std.detach().numpy())
    
    # Convert back to original scale via the Delta Method
    mu_train = y_train_pred_mean
    sigma_train = y_train_pred_std
    y_train_pred = inv_boxcox(mu_train, best_lambda)
    derivative = (best_lambda * mu_train + 1) ** (1 / best_lambda - 1)  # Calculate the derivative of the inverse Box-Cox function at mu_transformed
    y_train_pred_uncertainty = np.abs(sigma_train * derivative)  # Propagate the uncertainty via the delta method
    
    mu_test = y_test_pred_mean
    sigma_test = y_test_pred_std
    y_test_pred = inv_boxcox(mu_test, best_lambda)
    derivative = (best_lambda * mu_test + 1) ** (1 / best_lambda - 1)  # Calculate the derivative of the inverse Box-Cox function at mu_transformed
    y_test_pred_uncertainty = np.abs(sigma_test * derivative)  # Propagate the uncertainty via the delta method
    
    y_train_pred = y_train_pred.flatten()
    y_train_pred_uncertainty = y_train_pred_uncertainty.flatten()
    y_test_pred = y_test_pred.flatten()
    y_test_pred_uncertainty = y_test_pred_uncertainty.flatten()
    
    y_pred_test_lower_bound = y_test_pred - y_test_pred_uncertainty
    y_pred_test_upper_bound = y_test_pred + y_test_pred_uncertainty
    test_coverage_fraction = calculate_data_fraction_within_uncertainty_bounds(y_test, y_pred_test_lower_bound, y_pred_test_upper_bound)
    
    # compute k and R^2_0
    reg = LinearRegression(fit_intercept=False)  # enforce zero y-intercept
    reg.fit(y_test.reshape(-1, 1), y_test_pred.reshape(-1, 1))
    k = reg.coef_[0][0]
    r2_0 = reg.score(y_test.reshape(-1, 1), y_test_pred.reshape(-1, 1))
    
    metrics = {
        "train": {
            "R^2": r2_score(y_train, y_train_pred.flatten()),
            "MAE": mean_absolute_error(y_train, y_train_pred.flatten()),
            "RMSE": root_mean_squared_error(y_train, y_train_pred.flatten()),
        },
        "test": {
            "R^2": r2_score(y_test, y_test_pred.flatten()),
            "MAE": mean_absolute_error(y_test, y_test_pred.flatten()),
            "RMSE": root_mean_squared_error(y_test, y_test_pred.flatten()),
            "Coverage Fraction": test_coverage_fraction,
            "k": k,
            "R^2_0": r2_0,
        },
    }
    
    print(f"Train R^2:  {metrics['train']['R^2']}")
    print(f"Train MAE:  {metrics['train']['MAE']}")
    print(f"Train RMSE:  {metrics['train']['RMSE']}")
    print()
    print(f"Test R^2:  {metrics['test']['R^2']}")
    print(f"Test MAE:  {metrics['test']['MAE']}")
    print(f"Test RMSE:  {metrics['test']['RMSE']}")
    print(f"Test Uncertainty Coverage:  {metrics['test']['Coverage Fraction'] * 100:.2f}%")
    
    results = {
        "target": target,
        "estimator": trained_model,
        "inputs_numerical": inputs,
        "metrics": metrics,
        "y_train": y_train,
        "y_pred_train": y_train_pred,
        "y_pred_train_uncertainty": y_train_pred_uncertainty,
        "y_test": y_test,
        "y_pred_test": y_test_pred,
        "y_pred_test_uncertainty": y_test_pred_uncertainty,
    }

    return results


def get_feature_importances(model_results):
    
    estimator = model_results["estimator"]
    
    if isinstance(estimator, NGBRegressor):
        feat_imps_df = pd.DataFrame()
        feat_imps_df["Feature"] = model_results["inputs_numerical"]
        feat_imps_df["Importance (mean)"] = estimator.feature_importances_[0]
        feat_imps_df["Importance (variance)"] = estimator.feature_importances_[1]
        feat_imps_df = feat_imps_df.sort_values(by="Importance (mean)", ascending=False)
    # elif isinstance(estimator, (RandomForestRegressor, CatBoostRegressor, XGBRegressor, NGBRegressor)):
    elif isinstance(estimator, (RandomForestRegressor, XGBRegressor, NGBRegressor)):
        feat_imps_df = pd.DataFrame()
        feat_imps_df["Feature"] = model_results["inputs_numerical"]
        feat_imps_df["Importance"] = estimator.feature_importances_
        feat_imps_df = feat_imps_df.sort_values(by="Importance", ascending=False)
    else:
        print("Feature importances are not supported for this model type.")
        return None
    
    return feat_imps_df
