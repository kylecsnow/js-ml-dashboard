import io
from matplotlib.figure import Figure
import numpy as np
import os
import pandas as pd
import pickle
from PIL import Image
from typing import Any, List, Tuple, Optional


PROJECT_ROOT_DIR = os.path.abspath(__file__)


# TODO: someday, may want to implement MLflow for model tracking & retreival, rather than pickling locally
def get_dataset_name_from_model(model_name: str) -> str:
    dataset_name = f"{model_name.split('_')[0]}_dataset"
    return dataset_name


def get_dataset(dataset_name: str) -> pd.DataFrame:
    datasets_path = os.path.join(
        os.path.dirname(PROJECT_ROOT_DIR), "datasets"
    )
    dataset_path = os.path.join(datasets_path, f"{dataset_name}.pkl")

    with open(dataset_path, "rb") as f:
        dataset = pickle.load(f)

    return dataset


def get_model_and_metadata(model_name: str) -> dict[str, Any]:
    models_path = os.path.join(os.path.dirname(PROJECT_ROOT_DIR), "models")
    model_path = os.path.join(models_path, f"{model_name}.pkl")

    with open(model_path, "rb") as f:
        model_and_metadata = pickle.load(f)

    return model_and_metadata


def fig2img(
    fig: Figure, dpi: str | float = "figure", bbox_inches: str | None = None
) -> Image.Image:
    """Convert a Matplotlib figure to a PIL Image and return it"""
    buf = io.BytesIO()
    fig.savefig(buf, dpi=dpi, bbox_inches=bbox_inches)
    buf.seek(0)
    img = Image.open(buf)
    return img


def wide_to_compact_format(df):
    """
    Convert formulation data from wide format to compact format.
    
    Parameters:
    df (pandas.DataFrame): Input DataFrame in wide format where:
        - Each row is a formulation
        - Each column is an ingredient with its weight percentage
    
    Returns:
    pandas.DataFrame: Transformed DataFrame in compact format with columns:
        - component-1_identifier, component-1_amount, component-2_identifier, component-2_amount, etc.
    """
    # Create an empty list to store the transformed rows
    compact_rows = []
    
    # Iterate through each formulation (row)
    for idx, row in df.iterrows():
        # Get non-zero ingredients and their percentages
        ingredients = row[row > 0]
        
        # Create a new row with alternating ingredient names and percentages
        new_row = {}
        for i, (ingredient_name, percentage) in enumerate(ingredients.items(), 1):
            new_row[f'component-{0+i}_identifier'] = ingredient_name
            new_row[f'component-{0+i}_amount'] = percentage
            
        compact_rows.append(new_row)
    
    # Convert to DataFrame
    result_df = pd.DataFrame(compact_rows)
    
    return result_df


def compact_to_wide_format(df):
    """
    Convert formulation data from compact format to wide format.
    
    Parameters:
    df (pandas.DataFrame): Input DataFrame in compact format where:
        - Each row is a formulation
        - Columns alternate between ingredient names and weight percentages
    
    Returns:
    pandas.DataFrame: Transformed DataFrame in wide format where:
        - Each row is a formulation
        - Each column is an ingredient with its weight percentage
    """
    # Create a list to store the transformed rows
    wide_rows = []
    
    # Get all unique ingredients across all formulations
    ingredient_columns = [col for col in df.columns if 'Name' in col]
    all_ingredients = set()
    for col in ingredient_columns:
        all_ingredients.update(df[col].dropna().unique())
    
    # Process each formulation
    for idx, row in df.iterrows():
        # Create a dictionary with all ingredients initialized to 0
        formulation = {ingredient: 0 for ingredient in all_ingredients}
        
        # Fill in the actual values
        for i in range(1, len(df.columns) // 2 + 1):
            name_col = f'component-{0+i}_identifier'
            weight_col = f'component-{0+i}_amount'
            
            if name_col in df.columns and pd.notna(row[name_col]):
                ingredient_name = row[name_col]
                formulation[ingredient_name] = row[weight_col]
        
        wide_rows.append(formulation)
    
    # Convert to DataFrame
    result_df = pd.DataFrame(wide_rows)
    
    # Sort columns alphabetically for consistency
    result_df = result_df.reindex(sorted(result_df.columns), axis=1)
    
    return result_df


def sample_from_constrained_simplex(
    n_dimensions: int,
    constraints: Optional[List[Tuple[float, float]]] = None,
    max_attempts: int = 1000
):
    """
    Generate a random point from an N-dimensional simplex with optional element-wise constraints.
    
    Parameters:
        n_dimensions (int): Number of dimensions for the simplex
        constraints (List[Tuple[float, float]], optional): List of (min, max) constraints for each dimension.
            Use None for unconstrained dimensions. Example: [(0.2, 0.4), None, (0, 0.5)]
        max_attempts (int): Maximum number of attempts to find a valid solution
        
    Returns:
        numpy.ndarray: Array of N numbers between 0 and 1 that sum to 1 and satisfy constraints
        
    Raises:
        ValueError: If constraints are impossible to satisfy or if max_attempts is reached
    """

    if n_dimensions==0:
        sample = np.array([])
        return sample

    # Initialize constraints if not provided
    if constraints is None:
        constraints = [None] * n_dimensions
    elif len(constraints) != n_dimensions:
        raise ValueError("Length of constraints must match n_dimensions")
    
    # Validate constraints
    total_min = sum(c[0] for c in constraints if c is not None)
    if total_min > 1:
        raise ValueError("Sum of minimum constraints exceeds 1")
    
    for attempt in range(max_attempts):
        try:
            # Generate initial random sample
            sample = np.random.random(n_dimensions)
            sample = sample / np.sum(sample)  # Normalize to sum to 1
            
            # Apply constraints iteratively
            for _ in range(n_dimensions * 2):  # Allow multiple passes for adjustment
                modified = False
                
                # Adjust values to meet constraints
                for i, constraint in enumerate(constraints):
                    if constraint is not None:
                        min_val, max_val = constraint
                        if sample[i] < min_val:
                            deficit = min_val - sample[i]
                            # Take deficit proportionally from unconstrained elements
                            free_indices = [j for j, c in enumerate(constraints) 
                                         if c is None or (j != i and sample[j] > c[0])]
                            if not free_indices:
                                raise ValueError("Cannot satisfy minimum constraint")
                            weights = np.array([sample[j] for j in free_indices])
                            weights = weights / weights.sum()
                            for j, w in zip(free_indices, weights):
                                sample[j] -= deficit * w
                            sample[i] = min_val
                            modified = True
                        elif sample[i] > max_val:
                            excess = sample[i] - max_val
                            # Distribute excess proportionally to unconstrained elements
                            free_indices = [j for j, c in enumerate(constraints) 
                                         if c is None or (j != i and sample[j] < c[1])]
                            if not free_indices:
                                raise ValueError("Cannot satisfy maximum constraint")
                            sample[free_indices] += excess / len(free_indices)
                            sample[i] = max_val
                            modified = True
                
                # Normalize to sum to 1
                sample = sample / np.sum(sample)
                
                # Check if all constraints are satisfied
                constraints_satisfied = all(
                    c is None or (c[0] <= v <= c[1])
                    for c, v in zip(constraints, sample)
                )
                
                if constraints_satisfied and abs(sum(sample) - 1.0) < 1e-10:
                    return sample
                
                if not modified:
                    break
                    
        except ValueError:
            continue
            
    raise ValueError(f"Could not find valid solution after {max_attempts} attempts")


### D-dimensional sigmoid function with the given set of D coefficients:
def sigmoid(input_row, coefs):
    value = 1 / (1 + np.exp(-1 * np.matmul(input_row, coefs)))
    return value


def build_sythetic_demo_dataset(inputs=5, outputs=1, num_rows=10, noise=0, coefs=None, output_format="compact"):

    ### TODO: allow user to add noise to the response functions (using the `noise` argument)
    
    if isinstance(inputs, int):
        num_inputs = inputs
    else:
        general_inputs = inputs["general"]
        formulation_inputs = inputs["formulation"]
        num_general_inputs = len(general_inputs)
        num_formulation_inputs = len(formulation_inputs)
        all_inputs = list(general_inputs) + list(formulation_inputs)
        num_inputs = len(all_inputs)
        if inputs["formulation"]:
            formulation_constraints = [(formulation_inputs[input_]["min"], formulation_inputs[input_]["max"]) for input_ in formulation_inputs]


    if isinstance(outputs, int):
        num_outputs = outputs
    else:
        num_outputs = len(outputs)  


    # Randomly set coefficients for the response function, if not set by the user   
    if coefs==None:
        coefs = np.array([[np.random.uniform(-1, 1) for i in range(num_inputs)] for k in range(num_outputs)])


    # Create pandas DataFrame for the response function coefficients & name the columns
    coefs_df = pd.DataFrame(coefs)
    if isinstance(inputs, int):
        coefs_df = coefs_df.rename(columns={i: f"x_{i+1}" for i in range(len(coefs_df.T))})
        coefs_df = coefs_df.rename(index={k: f"y_{k+1}" for k in range(len(coefs_df))})
    else:
        coefs_df = coefs_df.rename(columns={i: list(all_inputs)[i] for i in range(len(coefs_df.T))})
        coefs_df = coefs_df.rename(index={k: list(outputs)[k] for k in range(len(coefs_df))})


    # Generate input values
    if isinstance(inputs, int):
        num_inputs = inputs
        X = np.array([[np.random.uniform(-2, 2) for i in range(num_inputs)] for j in range(num_rows)])
    else:
        X_general = np.array([[np.random.uniform(-2, 2) for i in range(num_general_inputs)] for j in range(num_rows)])
        if inputs["formulation"]:
            X_formulation = np.array([sample_from_constrained_simplex(n_dimensions=num_formulation_inputs, constraints=formulation_constraints) for j in range(num_rows)])
            X = np.concatenate((X_general, X_formulation), axis=1)
        else:
            X = X_general


    # Generate output values
    y = list()
    for k in range(num_outputs):
        y.append(list())
        for row in X:
            y[k].append(sigmoid(row, coefs[k]))

    y = np.array(y)

    
    # Create pandas DataFrame for the generated data & name the columns
    data_df = pd.DataFrame()

    for i in range(num_inputs):
        if isinstance(inputs, int):
            data_df[f"x_{i+1}"] = X[:, i]
        else:
            data_df[all_inputs[i]] = X[:, i]
    
    for k in range(num_outputs):
        if isinstance(outputs, int):
            data_df[f"y_{k+1}"] = y[k]
        else:
            data_df[list(outputs)[k]] = y[k]


    ### TODO: clean this section up
    #################################
    if isinstance(inputs, int):
        pass
    else:
        df_scaled = data_df.copy()

        for col in df_scaled.columns:
            if col in general_inputs:
                scaled_col = (df_scaled[col].to_numpy() + 2) / 4
            else:
                scaled_col = df_scaled[col]
            df_scaled[col] = scaled_col

        all_columns = dict()
        # all_columns.update(all_inputs)
        all_columns.update(general_inputs)
        all_columns.update(formulation_inputs)
        all_columns.update(outputs)

        for col in all_columns:
            if col in general_inputs or col in outputs:
                df_scaled[col] = df_scaled[col] * (all_columns[col]["max"] - all_columns[col]["min"]) + all_columns[col]["min"]

        # concatenate column names with user's specified units, with a hyphen in between (but don't add hyphen if no units were specified)
        column_renaming = {col: f'{col}-{all_columns[col]["units"]}' for col in general_inputs if all_columns[col]["units"] != ""}
        column_renaming.update({col: f'{col}-{all_columns[col]["units"]}' for col in outputs if all_columns[col]["units"] != ""})
        df_scaled = df_scaled.rename(column_renaming, axis=1)
        coefs_df = coefs_df.rename(column_renaming, axis=0)
        coefs_df = coefs_df.rename(column_renaming, axis=1)

        data_df = df_scaled

        if output_format == "compact":
            formulation_column_headers = list(formulation_inputs.keys())
            formulation_df = data_df[formulation_column_headers] * 100
            formulation_df = wide_to_compact_format(formulation_df)
            data_df = data_df.drop(labels=formulation_column_headers, axis=1)
            data_df = pd.concat([data_df, formulation_df], axis=1)
        elif output_format == "wide":
            pass
        else:
            raise ValueError("argument `output_format` must be either 'compact' or 'wide'.")
    #################################
    
    return data_df, coefs_df
