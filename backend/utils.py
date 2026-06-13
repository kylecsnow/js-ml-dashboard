import io
from pandas import DataFrame
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


### D-dimensional sigmoid function with the given set of D coefficients:
def sigmoid(input_row, coefs):
    value = 1 / (1 + np.exp(-1 * np.matmul(input_row, coefs)))
    return value


def wide_to_compact_format(df: DataFrame):
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

    ### TODO: this function should ideally catch duplicate ingredient name columns if they exist and consolidate them before converting to compact format (so you don't get "Ingredient A" and "Ingredient A.1" showing up in the compact format)
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


### TODO: get rid of this function someday?
# def sample_from_constrained_simplex(
#     n_dimensions: int,
#     constraints: Optional[List[Tuple[float, float]]] = None,
#     max_attempts: int = 1000
# ):
#     """
#     Generate a random point from an N-dimensional simplex with optional element-wise constraints.
    
#     Parameters:
#         n_dimensions (int): Number of dimensions for the simplex
#         constraints (List[Tuple[float, float]], optional): List of (min, max) constraints for each dimension.
#             Use None for unconstrained dimensions. Example: [(0.2, 0.4), None, (0, 0.5)]
#         max_attempts (int): Maximum number of attempts to find a valid solution
        
#     Returns:
#         numpy.ndarray: Array of N numbers between 0 and 1 that sum to 1 and satisfy constraints
        
#     Raises:
#         ValueError: If constraints are impossible to satisfy or if max_attempts is reached
#     """

#     if n_dimensions==0:
#         sample = np.array([])
#         return sample

#     # Initialize constraints if not provided
#     if constraints is None:
#         constraints = [None] * n_dimensions
#     elif len(constraints) != n_dimensions:
#         raise ValueError("Length of constraints must match n_dimensions.")
    
#     # Validate constraints
#     total_min = sum(c[0] for c in constraints if c is not None)
#     if total_min > 1:
#         raise ValueError("Sum of formulation lower bounds exceeds 1.")
    
#     for attempt in range(max_attempts):
#         try:
#             # Generate initial random sample
#             sample = np.random.random(n_dimensions)
#             sample = sample / np.sum(sample)  # Normalize to sum to 1
            
#             # Apply constraints iteratively
#             for _ in range(n_dimensions * 2):  # Allow multiple passes for adjustment
#                 modified = False
                
#                 # Adjust values to meet constraints
#                 for i, constraint in enumerate(constraints):
#                     if constraint is not None:
#                         min_val, max_val = constraint
#                         if sample[i] < min_val:
#                             deficit = min_val - sample[i]
#                             # Take deficit proportionally from unconstrained elements
#                             free_indices = [j for j, c in enumerate(constraints) 
#                                          if c is None or (j != i and sample[j] > c[0])]
#                             if not free_indices:
#                                 raise ValueError("Cannot satisfy minimum constraint.")
#                             weights = np.array([sample[j] for j in free_indices])
#                             weights = weights / weights.sum()
#                             for j, w in zip(free_indices, weights):
#                                 sample[j] -= deficit * w
#                             sample[i] = min_val
#                             modified = True
#                         elif sample[i] > max_val:
#                             excess = sample[i] - max_val
#                             # Distribute excess proportionally to unconstrained elements
#                             free_indices = [j for j, c in enumerate(constraints) 
#                                          if c is None or (j != i and sample[j] < c[1])]
#                             if not free_indices:
#                                 raise ValueError("Cannot satisfy maximum constraint.")
#                             sample[free_indices] += excess / len(free_indices)
#                             sample[i] = max_val
#                             modified = True
                
#                 # Normalize to sum to 1
#                 sample = sample / np.sum(sample)
                
#                 # Check if all constraints are satisfied
#                 constraints_satisfied = all(
#                     c is None or (c[0] <= v <= c[1])
#                     for c, v in zip(constraints, sample)
#                 )
                
#                 if constraints_satisfied and abs(sum(sample) - 1.0) < 1e-10:
#                     return sample
                
#                 if not modified:
#                     break
                    
#         except ValueError:
#             continue
            
#     raise ValueError(f"Could not find any valid formulation after {max_attempts} attempts. Please check that your formulations are not over-constrained. (Your lower & upper bounds might make it impossible to find a formulation where the ingredient quantities sum to 100%)")


# Smallest amount assigned to a present ingredient so that it is reliably
# counted as present (> 0) even when its lower bound is exactly 0.
_PRESENT_EPS = 1e-9


def _fill_remaining_room(room: np.ndarray, remaining: float) -> np.ndarray:
    """Randomly distribute ``remaining`` mass across items, each capped by ``room``.

    The allocation always sums to ``remaining`` provided ``0 <= remaining <= sum(room)``
    (within numerical tolerance). A per-item lower bound derived from the room still
    available downstream guarantees feasibility regardless of the random order.
    """
    k = len(room)
    alloc = np.zeros(k)
    if k == 0:
        return alloc

    order = np.random.permutation(k)
    room_ordered = room[order]

    # Suffix sums of the remaining room after each position in ``order``.
    suffix_sums = np.zeros(k + 1)
    for idx in range(k - 1, -1, -1):
        suffix_sums[idx] = suffix_sums[idx + 1] + room_ordered[idx]

    rem = float(remaining)
    for pos in range(k):
        remaining_room_after = suffix_sums[pos + 1]
        lo = max(0.0, rem - remaining_room_after)
        hi = min(room_ordered[pos], rem)
        amount = lo if hi <= lo else float(np.random.uniform(lo, hi))
        alloc[order[pos]] = amount
        rem -= amount

    return alloc


def _allocate_present(
    present_indices: np.ndarray,
    target: float,
    mins: np.ndarray,
    maxs: np.ndarray,
    n: int,
) -> Optional[np.ndarray]:
    """Allocate ``target`` mass across a fixed set of present ingredients.

    Returns a length-``n`` vector (zeros for absent ingredients) summing to
    ``target`` with each present ingredient inside ``[min, max]``, or ``None`` if
    the present set cannot accommodate ``target``.
    """
    vec = np.zeros(n)
    if len(present_indices) == 0:
        return vec if abs(target) < 1e-12 else None

    # Floor zero lower bounds so present ingredients are strictly positive.
    base = np.maximum(mins[present_indices], _PRESENT_EPS)
    base_sum = float(base.sum())
    remaining = target - base_sum
    if remaining < -1e-9:
        return None

    room = maxs[present_indices] - base
    if room.sum() < remaining - 1e-9:
        return None

    add = _fill_remaining_room(room, max(0.0, remaining))
    vec[present_indices] = base + add
    return vec


def _sample_constrained_simplex(
    target: float,
    mins: np.ndarray,
    maxs: np.ndarray,
    required: np.ndarray,
    min_count: int,
    max_count: int,
    attempts: int = 300,
) -> Optional[np.ndarray]:
    """Sample ``n`` non-negative amounts summing to ``target``.

    Present (non-zero) ingredients stay within ``[min, max]``; required ingredients
    are always present; the number of present ingredients lies in ``[min_count, max_count]``.
    Returns ``None`` if no feasible allocation is found within ``attempts`` tries.
    """
    n = len(mins)
    if target <= 1e-12:
        # An absent group/region contributes nothing.
        return np.zeros(n)

    required_indices = [i for i in range(n) if required[i]]
    optional_indices = [i for i in range(n) if not required[i]]
    n_required = len(required_indices)

    lo_count = max(int(min_count), n_required, 1)
    hi_count = min(int(max_count), n)
    if lo_count > hi_count:
        return None

    for _ in range(attempts):
        n_present = np.random.randint(lo_count, hi_count + 1)
        n_optional = n_present - n_required
        if n_optional < 0 or n_optional > len(optional_indices):
            continue
        if n_optional > 0:
            chosen = list(
                np.random.choice(optional_indices, size=n_optional, replace=False)
            )
        else:
            chosen = []
        present_indices = np.array(required_indices + chosen, dtype=int)
        vec = _allocate_present(present_indices, target, mins, maxs, n)
        if vec is not None:
            return vec

    return None


def gibbs_sample_formulation_space(
    n_ingredients: int,
    constraints: Optional[List[Tuple[float, float]]] = None,
    n_samples: int = 100,
    burn_in: int = 100,
    min_ingredients_per_formulation: Optional[int] = None,
    max_ingredients_per_formulation: Optional[int] = None,
    required: Optional[List[bool]] = None,
):
    """
    Generate samples of ingredient formulations using Gibbs sampling.

    NOTE: This is the original MCMC-based sampler. It does NOT support ingredient
    groups. It is retained for reference/experimentation; the app now uses
    `group_aware_sample_formulation_space` instead. Prefer that function for new
    work unless you specifically need the Markov-chain (transfer/activate/deactivate)
    sampling behaviour here.

    Parameters:
    - n_ingredients: number of ingredients
    - constraints: list of (min, max) tuples for each ingredient, or None for unconstrained
    - n_samples: number of samples to generate
    - burn_in: number of initial samples to discard
    - min_ingredients_per_formulation: minimum number of ingredients that must be used (non-zero quantity) in each formulation
    - max_ingredients_per_formulation: maximum number of ingredients that can be used (non-zero quantity) in each formulation
    - required: per-ingredient flags; when True, the ingredient must be present in every formulation
      and its amount must stay within [min, max] (cannot be zero). When False (default), an
      ingredient may be omitted (zero) even if it has a positive lower bound.

    Returns:
    - samples: array of shape (n_samples, n_ingredients)
    """

    if constraints is None:
        constraints = [None] * n_ingredients
    elif len(constraints) != n_ingredients:
        raise ValueError(f"Length of formulation constraints (provided: {len(constraints)}) must equal n_ingredients (provided: {n_ingredients}).")

    if required is None:
        required = [False] * n_ingredients
    elif len(required) != n_ingredients:
        raise ValueError(
            f"Length of required flags (provided: {len(required)}) must equal n_ingredients (provided: {n_ingredients})."
        )

    required = np.array(required, dtype=bool)
    required_indices = np.where(required)[0]
    n_required = len(required_indices)

    # Set default values for number of allowed ingredients per formulation
    if min_ingredients_per_formulation is None:
        min_ingredients_per_formulation = n_ingredients
    if max_ingredients_per_formulation is None:
        max_ingredients_per_formulation = n_ingredients

    if n_required > max_ingredients_per_formulation:
        raise ValueError(
            f"Number of required ingredients ({n_required}) cannot exceed "
            f"max_ingredients_per_formulation ({max_ingredients_per_formulation})."
        )
    if min_ingredients_per_formulation < n_required:
        min_ingredients_per_formulation = n_required

    # Validate ingredient count constraints
    if min_ingredients_per_formulation > max_ingredients_per_formulation:
        raise ValueError(f"min_ingredients_per_formulation (provided: {min_ingredients_per_formulation}) cannot be greater than max_ingredients_per_formulation (provided: {max_ingredients_per_formulation})")
    if min_ingredients_per_formulation < 1:
        raise ValueError("min_ingredients_per_formulation must be at least 1.")
    if max_ingredients_per_formulation > n_ingredients:
        raise ValueError(f"max_ingredients_per_formulation (provided: {max_ingredients_per_formulation}) cannot exceed n_ingredients (provided: {n_ingredients}).")


    ### TODO: [IN-PROGRESS] - trying to update the synthetic demo generator (reason: ...)
    # Extract mins and maxs, treating None constraints as (0, 1)
    mins = []
    maxs = []
    
    for constraint in constraints:
        if constraint is not None:
            min_val, max_val = constraint
            mins.append(min_val)
            maxs.append(max_val)
        else:
            mins.append(0.0)
            maxs.append(1.0)
    
    mins = np.array(mins)
    maxs = np.array(maxs)

    if n_required > 0:
        required_min_sum = float(np.sum(mins[required_indices]))
        if required_min_sum > 1:
            raise ValueError(
                f"Sum of lower bounds for required ingredients ({required_min_sum:.3f}) exceeds 1.0."
            )
        if np.any(mins[required_indices] <= 0):
            raise ValueError(
                "Required formulation ingredients must have a lower bound greater than 0."
            )
    
    # Validate that max ingredient count allows for a feasible solution
    # Check if we can satisfy the minimum number of ingredients
    min_possible_sum = sum(sorted(mins)[:min_ingredients_per_formulation])
    if min_possible_sum > 1:
        raise ValueError(f"Cannot satisfy min_ingredients_per_formulation={min_ingredients_per_formulation}: minimum sum of {min_ingredients_per_formulation} smallest min constraints ({min_possible_sum:.3f}) exceeds 1.0")
    
    # Initialize with a valid starting point
    def select_present_indices(n_present: int) -> np.ndarray:
        """Pick which ingredients are present, always including required ones."""
        optional_indices = [i for i in range(n_ingredients) if not required[i]]
        n_optional_to_activate = n_present - n_required
        if n_optional_to_activate > 0:
            if n_optional_to_activate > len(optional_indices):
                raise ValueError(
                    "Cannot satisfy ingredient-count constraints with the given required ingredients."
                )
            extra_indices = np.random.choice(
                optional_indices, size=n_optional_to_activate, replace=False
            )
            return np.concatenate([required_indices, extra_indices])
        return required_indices.copy()

    def initialize_formulation():
        current = np.zeros(n_ingredients)
        
        # Randomly select how many ingredients to use
        n_present = np.random.randint(min_ingredients_per_formulation, max_ingredients_per_formulation + 1)
        present_indices = select_present_indices(n_present)
        
        # Set present ingredients to their minimum values
        for i in present_indices:
            current[i] = mins[i]
        
        # Calculate remaining amount to distribute
        remaining = 1.0 - np.sum(current)
        
        # Distribute remaining amount among present ingredients within their constraints
        if remaining > 1e-12:
            max_attempts = 10000
            for attempt in range(max_attempts):
                # Calculate room for more for each present ingredient
                room = np.array([maxs[i] - current[i] for i in present_indices])
                total_room = np.sum(room)
                
                if total_room <= 1e-12:
                    # No room to add more, try different ingredient selection
                    if attempt < max_attempts - 1:
                        current = np.zeros(n_ingredients)
                        present_indices = select_present_indices(n_present)
                        for i in present_indices:
                            current[i] = mins[i]
                        remaining = 1.0 - np.sum(current)
                        continue
                    else:
                        raise ValueError("Could not find valid initial formulation. Please re-try; this sometimes occurs due to the randomness involved in searching for a 'valid' formulation in a complex, high-dimensional space. This often gets more difficult when certain ingredients have very narrow upper and lower bound ranges. If re-trying many times does not resolve the issue, you may need to expand ranges for some ingredients and try again.")
                
                # Distribute proportionally to available room, but don't exceed remaining
                if total_room >= remaining:
                    # We have enough room, distribute proportionally
                    weights = room / total_room
                    for idx, i in enumerate(present_indices):
                        add_amount = weights[idx] * remaining
                        current[i] += add_amount
                    break
                else:
                    # Fill up all available room and try again with different selection
                    for idx, i in enumerate(present_indices):
                        current[i] = maxs[i]
                    if attempt < max_attempts - 1:
                        current = np.zeros(n_ingredients)
                        present_indices = select_present_indices(n_present)
                        for i in present_indices:
                            current[i] = mins[i]
                        remaining = 1.0 - np.sum(current)
                        continue
                    else:
                        raise ValueError("Could not find valid initial formulation. Please re-try; this sometimes occurs due to the randomness involved in searching for a 'valid' formulation in a complex, high-dimensional space. This often gets more difficult when certain ingredients have very narrow upper and lower bound ranges. If re-trying many times does not resolve the issue, you may need to expand ranges for some ingredients and try again.")
        
        return current
    
    current = initialize_formulation()
    
    # Verify initial formulation is valid
    assert abs(np.sum(current) - 1) < 1e-10, f"Initial formulation doesn't sum to 1: {np.sum(current)}" 
    
    # Collect samples
    samples = []
    for t in range(n_samples + burn_in):
        # Perform several Gibbs steps per iteration for better mixing
        for _ in range(n_ingredients * 2):  # More steps for better mixing with activation/deactivation
            
            # Randomly choose between different types of moves
            move_type = np.random.choice(['transfer', 'activate', 'deactivate'], p=[0.6, 0.2, 0.2])
            
            present_ingredients = [i for i in range(n_ingredients) if current[i] > 1e-12]
            absent_ingredients = [i for i in range(n_ingredients) if current[i] <= 1e-12]
            
            if move_type == 'transfer' and len(present_ingredients) >= 2:
                # Transfer between two present ingredients
                i, j = np.random.choice(present_ingredients, 2, replace=False)
                
                # For present ingredients, they must stay within [min, max] or go to 0
                # Calculate valid range for transfer
                delta_min = max(mins[i] - current[i], current[j] - maxs[j])
                delta_max = min(maxs[i] - current[i], current[j] - mins[j])
                
                if delta_max > delta_min:
                    delta = np.random.uniform(delta_min, delta_max)
                    
                    # Update formulation
                    current[i] += delta
                    current[j] -= delta
                    
                    # Keep ingredient bounds valid during transfer; dedicated
                    # "deactivate" moves handle dropping ingredients to zero.
                    if current[j] < mins[j] + 1e-12:
                        deficit = mins[j] - current[j]
                        current[j] = mins[j]
                        current[i] -= deficit
            
            elif move_type == 'activate' and len(absent_ingredients) > 0 and len(present_ingredients) < max_ingredients_per_formulation:
                # Activate an absent ingredient
                i = np.random.choice(absent_ingredients)
                
                # Find present ingredients to take from
                candidates = [j for j in present_ingredients if current[j] > mins[j] + 1e-12]
                if candidates:
                    j = np.random.choice(candidates)
                    
                    # Calculate how much we need to activate ingredient i
                    min_to_activate = mins[i]
                    max_available_from_j = current[j] - mins[j]
                    
                    if max_available_from_j >= min_to_activate:
                        # We can activate ingredient i
                        # Take the minimum required plus some random additional amount
                        max_additional = min(maxs[i] - mins[i], max_available_from_j - min_to_activate)
                        additional = np.random.uniform(0, max_additional) if max_additional > 0 else 0
                        transfer_amount = min_to_activate + additional
                        
                        current[i] = transfer_amount
                        current[j] -= transfer_amount
                        
                        # Keep ingredient bounds valid during activation transfer.
                        if current[j] < mins[j] + 1e-12:
                            deficit = mins[j] - current[j]
                            current[j] = mins[j]
                            current[i] -= deficit
            
            elif move_type == 'deactivate' and len(present_ingredients) > min_ingredients_per_formulation:
                # Deactivate an present ingredient (required ingredients cannot be deactivated)
                deactivatable = [j for j in present_ingredients if not required[j]]
                if not deactivatable:
                    continue
                i = np.random.choice(deactivatable)
                
                # Transfer all of this ingredient's amount to other present ingredients
                amount_to_redistribute = current[i]
                other_present = [j for j in present_ingredients if j != i]
                
                if other_present and amount_to_redistribute > 1e-12:
                    # Calculate room available in other present ingredients
                    room = np.array([maxs[j] - current[j] for j in other_present])
                    total_room = np.sum(room)
                    
                    if total_room >= amount_to_redistribute:
                        # Distribute proportionally among ingredients with room
                        if total_room > 0:
                            weights = room / total_room
                            for idx, j in enumerate(other_present):
                                add_amount = weights[idx] * amount_to_redistribute
                                current[j] += add_amount
                        current[i] = 0.0
                    else:
                        # Not enough room in current present ingredients
                        # Try to activate a new ingredient to take the excess
                        if len(absent_ingredients) > 0:
                            k = np.random.choice(absent_ingredients)
                            if maxs[k] >= mins[k] + amount_to_redistribute - total_room:
                                # Fill up existing present ingredients
                                for idx, j in enumerate(other_present):
                                    current[j] = maxs[j]
                                # Put remainder in new ingredient
                                remaining = amount_to_redistribute - total_room
                                current[k] = mins[k] + remaining
                                current[i] = 0.0
        
        # Correct tiny floating-point drift without globally scaling all ingredients.
        # Global normalization can violate lower/upper ingredient bounds.
        total = np.sum(current)
        if abs(total - 1.0) > 1e-10:
            diff = 1.0 - total

            if diff > 0:
                candidates = [i for i in range(n_ingredients) if current[i] > 1e-12 and current[i] < maxs[i] - 1e-12]
                if candidates:
                    i = max(candidates, key=lambda idx: maxs[idx] - current[idx])
                    current[i] += diff
            else:
                candidates = [i for i in range(n_ingredients) if current[i] > mins[i] + 1e-12]
                if candidates:
                    i = max(candidates, key=lambda idx: current[idx] - mins[idx])
                    current[i] += diff

        # Final cleanup for numerical noise
        current[np.abs(current) < 1e-14] = 0.0

        # Enforce per-ingredient bounds before storing sample.
        if np.any(current < -1e-12):
            raise ValueError("Sampling produced a negative ingredient quantity.")
        if np.any(current > maxs + 1e-12):
            raise ValueError("Sampling produced an ingredient above its max bound.")
        in_between_zero_and_min = (current > 1e-12) & (current < mins - 1e-12)
        if np.any(in_between_zero_and_min):
            raise ValueError("Sampling produced an ingredient below its min bound. Please re-try; this sometimes occurs due to the randomness involved in searching for a 'valid' formulation in a complex, high-dimensional space. This can get more difficult with more complex, higher-dimensional spaces. If re-trying many times does not resolve the issue, you may need to expand the upper & lower bound ranges on some of your ingredients and/or raise the max # of ingredients allowed per formulation, then try again.")

        if np.any(required & (current <= 1e-12)):
            raise ValueError(
                "Sampling omitted a required ingredient. Please retry or adjust formulation bounds."
            )
        if np.any(required & (current < mins - 1e-12)):
            raise ValueError(
                "Sampling produced a required ingredient below its min bound. "
                "Please retry or adjust formulation bounds."
            )

        # Enforce present ingredient count rules before storing sample.
        present_count = np.sum(current > 1e-12)
        if present_count < min_ingredients_per_formulation or present_count > max_ingredients_per_formulation:
            raise ValueError(
                "Sampling violated ingredient-count constraints. "
                "Please retry or adjust formulation bounds."
            )
        
        # Only keep samples after burn-in
        if t >= burn_in:
            samples.append(current.copy())
    
    return np.array(samples)


def group_aware_sample_formulation_space(
    n_ingredients: int,
    constraints: Optional[List[Tuple[float, float]]] = None,
    n_samples: int = 100,
    burn_in: int = 100,
    min_ingredients_per_formulation: Optional[int] = None,
    max_ingredients_per_formulation: Optional[int] = None,
    required: Optional[List[bool]] = None,
    group_index: Optional[List[int]] = None,
    group_constraints: Optional[List[Tuple[float, float]]] = None,
    group_min_counts: Optional[List[int]] = None,
    group_max_counts: Optional[List[int]] = None,
):
    """
    Generate samples of ingredient formulations using a hierarchical (group-aware) sampler.

    Parameters:
    - n_ingredients: number of ingredients
    - constraints: list of (min, max) tuples for each ingredient, or None for unconstrained
    - n_samples: number of samples to generate
    - burn_in: retained for backwards compatibility (unused; samples are drawn independently)
    - min_ingredients_per_formulation: minimum number of ingredients used (non-zero) per formulation (global)
    - max_ingredients_per_formulation: maximum number of ingredients used (non-zero) per formulation (global)
    - required: per-ingredient flags; when True, the ingredient must be present in every formulation
      and its amount must stay within [min, max] (cannot be zero). When False (default), an
      ingredient may be omitted (zero) even if it has a positive lower bound.
    - group_index: per-ingredient group id (0..n_groups-1). When None, all ingredients form a
      single implicit group spanning the whole formulation.
    - group_constraints: list of (min, max) bounds on the SUM of each group's ingredient amounts.
      Group bounds are CONDITIONAL: they apply only when the group is present (at least one of its
      ingredients is present). A group whose total is 0 (entirely absent) is always allowed unless
      the group is forced present (has a required ingredient or a positive group_min_count).
    - group_min_counts / group_max_counts: min/max number of present ingredients per group.

    Returns:
    - samples: array of shape (n_samples, n_ingredients)
    """

    if constraints is None:
        constraints = [None] * n_ingredients
    elif len(constraints) != n_ingredients:
        raise ValueError(f"Length of formulation constraints (provided: {len(constraints)}) must equal n_ingredients (provided: {n_ingredients}).")

    if required is None:
        required = [False] * n_ingredients
    elif len(required) != n_ingredients:
        raise ValueError(
            f"Length of required flags (provided: {len(required)}) must equal n_ingredients (provided: {n_ingredients})."
        )

    required = np.array(required, dtype=bool)

    # Extract per-ingredient mins and maxs, treating None constraints as (0, 1).
    mins = []
    maxs = []
    for constraint in constraints:
        if constraint is not None:
            min_val, max_val = constraint
            mins.append(min_val)
            maxs.append(max_val)
        else:
            mins.append(0.0)
            maxs.append(1.0)
    mins = np.array(mins, dtype=float)
    maxs = np.array(maxs, dtype=float)

    # Resolve global ingredient-count defaults.
    if min_ingredients_per_formulation is None:
        min_ingredients_per_formulation = n_ingredients
    if max_ingredients_per_formulation is None:
        max_ingredients_per_formulation = n_ingredients
    global_min = int(min_ingredients_per_formulation)
    global_max = int(max_ingredients_per_formulation)

    # Resolve grouping. No groups => one implicit group spanning all ingredients,
    # which reproduces the original (single-simplex) behaviour.
    implicit_single_group = group_index is None
    if implicit_single_group:
        group_index = [0] * n_ingredients
        if group_constraints is None:
            group_constraints = [(0.0, 1.0)]

    if len(group_index) != n_ingredients:
        raise ValueError(
            f"Length of group_index (provided: {len(group_index)}) must equal n_ingredients (provided: {n_ingredients})."
        )

    n_groups = (max(group_index) + 1) if n_ingredients > 0 else 0
    members = [
        np.array([i for i in range(n_ingredients) if group_index[i] == g], dtype=int)
        for g in range(n_groups)
    ]

    if group_constraints is None:
        group_constraints = [(0.0, 1.0)] * n_groups
    group_lowers = np.array([gc[0] for gc in group_constraints], dtype=float)
    group_uppers = np.array([gc[1] for gc in group_constraints], dtype=float)

    if implicit_single_group:
        group_min_counts = [global_min]
        group_max_counts = [global_max]
    if group_min_counts is None:
        group_min_counts = [0] * n_groups
    if group_max_counts is None:
        group_max_counts = [len(members[g]) for g in range(n_groups)]
    group_min_counts = [int(c) for c in group_min_counts]
    group_max_counts = [int(c) for c in group_max_counts]

    n_required_in_group = [int(required[members[g]].sum()) for g in range(n_groups)]
    forced_present = [
        (group_min_counts[g] > 0) or (n_required_in_group[g] > 0)
        for g in range(n_groups)
    ]

    # ---- Feasibility validation (raised as ValueError -> HTTP 400 upstream) ----
    if n_ingredients > 0:
        if float(np.sum(group_uppers)) < 1.0 - 1e-9:
            raise ValueError(
                f"Sum of group upper bounds ({float(np.sum(group_uppers)):.3f}) is less than 1.0, "
                "so ingredient amounts cannot sum to 100%."
            )
        forced_lower_sum = float(
            np.sum([group_lowers[g] for g in range(n_groups) if forced_present[g]])
        )
        if forced_lower_sum > 1.0 + 1e-9:
            raise ValueError(
                f"Sum of lower bounds for always-present groups ({forced_lower_sum:.3f}) exceeds 1.0."
            )

    for g in range(n_groups):
        size = len(members[g])
        if group_min_counts[g] > group_max_counts[g]:
            raise ValueError(
                f"Group {g}: min ingredient count ({group_min_counts[g]}) cannot exceed max ({group_max_counts[g]})."
            )
        if group_max_counts[g] > size:
            raise ValueError(
                f"Group {g}: max ingredient count ({group_max_counts[g]}) cannot exceed the number of ingredients in the group ({size})."
            )
        req_idx = members[g][required[members[g]]]
        if len(req_idx) > 0:
            if np.any(mins[req_idx] <= 0):
                raise ValueError(
                    "Required formulation ingredients must have a lower bound greater than 0."
                )
            if float(np.sum(mins[req_idx])) > group_uppers[g] + 1e-9:
                raise ValueError(
                    f"Group {g}: sum of required ingredient lower bounds "
                    f"({float(np.sum(mins[req_idx])):.3f}) exceeds the group's upper bound "
                    f"({group_uppers[g]:.3f})."
                )

    if global_min < 1 and n_ingredients > 0:
        raise ValueError("min_ingredients_per_formulation must be at least 1.")
    if global_min > global_max:
        raise ValueError(
            f"min_ingredients_per_formulation (provided: {global_min}) cannot be greater than "
            f"max_ingredients_per_formulation (provided: {global_max})."
        )
    if global_max > n_ingredients:
        raise ValueError(
            f"max_ingredients_per_formulation (provided: {global_max}) cannot exceed n_ingredients (provided: {n_ingredients})."
        )

    optional_groups = [g for g in range(n_groups) if not forced_present[g]]
    forced_groups = [g for g in range(n_groups) if forced_present[g]]

    def choose_present_groups() -> Optional[List[int]]:
        """Pick which groups are present this formulation (forced + random optional)."""
        present = list(forced_groups)
        shuffled = list(optional_groups)
        np.random.shuffle(shuffled)
        for g in shuffled:
            if np.random.rand() < 0.5:
                present.append(g)

        # Ensure enough capacity to reach a total of 1.0; add optional groups if short.
        leftover = [g for g in shuffled if g not in present]
        while float(np.sum(group_uppers[present])) < 1.0 - 1e-9 and leftover:
            present.append(leftover.pop())

        # If the present lower bounds overshoot 1.0, drop optional groups (largest lower first).
        droppable = sorted(
            [g for g in present if not forced_present[g]],
            key=lambda g: group_lowers[g],
            reverse=True,
        )
        di = 0
        while float(np.sum(group_lowers[present])) > 1.0 + 1e-9 and di < len(droppable):
            present.remove(droppable[di])
            di += 1

        if not present:
            return None
        if float(np.sum(group_lowers[present])) > 1.0 + 1e-9:
            return None
        if float(np.sum(group_uppers[present])) < 1.0 - 1e-9:
            return None
        return sorted(present)

    def choose_counts(present: List[int], attempts: int = 200) -> Optional[dict]:
        """Pick a per-group present count whose sum lands in the global window."""
        for _ in range(attempts):
            counts = {}
            ok = True
            for g in present:
                lo = max(1, group_min_counts[g], n_required_in_group[g])
                hi = group_max_counts[g]
                if lo > hi:
                    ok = False
                    break
                counts[g] = int(np.random.randint(lo, hi + 1))
            if not ok:
                return None
            total = sum(counts.values())
            if global_min <= total <= global_max:
                return counts
        return None

    def generate_one_sample() -> np.ndarray:
        max_attempts = 5000
        for _ in range(max_attempts):
            present = choose_present_groups()
            if present is None:
                continue
            counts = choose_counts(present)
            if counts is None:
                continue

            # Sample group totals summing to 1 with each present total in [L_g, U_g].
            totals = _allocate_present(
                np.arange(len(present)),
                1.0,
                group_lowers[present],
                group_uppers[present],
                len(present),
            )
            if totals is None:
                continue

            vec = np.zeros(n_ingredients)
            ok = True
            for idx, g in enumerate(present):
                member_idx = members[g]
                local = _sample_constrained_simplex(
                    target=float(totals[idx]),
                    mins=mins[member_idx],
                    maxs=maxs[member_idx],
                    required=required[member_idx],
                    min_count=counts[g],
                    max_count=counts[g],
                )
                if local is None:
                    ok = False
                    break
                vec[member_idx] = local
            if not ok:
                continue

            if abs(float(vec.sum()) - 1.0) > 1e-7:
                continue
            return vec

        raise ValueError(
            "Could not find a valid formulation. Please re-try; this sometimes occurs due to the "
            "randomness involved in searching for a 'valid' formulation in a complex, "
            "high-dimensional space. This often gets more difficult when ingredients or groups have "
            "very narrow bound ranges. If re-trying many times does not resolve the issue, you may "
            "need to widen some ingredient or group bounds and/or relax min/max ingredient counts, "
            "then try again."
        )

    if n_ingredients == 0:
        return np.zeros((n_samples, 0))

    samples = []
    for _ in range(n_samples):
        current = generate_one_sample()
        current[np.abs(current) < 1e-14] = 0.0

        # Defensive post-checks (construction should already guarantee these).
        if np.any(current < -1e-12):
            raise ValueError("Sampling produced a negative ingredient quantity.")
        if np.any(current > maxs + 1e-12):
            raise ValueError("Sampling produced an ingredient above its max bound.")
        if np.any(required & (current <= 1e-12)):
            raise ValueError(
                "Sampling omitted a required ingredient. Please retry or adjust formulation bounds."
            )
        for g in range(n_groups):
            group_sum = float(current[members[g]].sum())
            if group_sum > 1e-12:
                if group_sum < group_lowers[g] - 1e-9 or group_sum > group_uppers[g] + 1e-9:
                    raise ValueError(
                        "Sampling violated a group sum bound. Please retry or adjust group bounds."
                    )

        samples.append(current.copy())

    return np.array(samples)


def build_synthetic_demo_dataset(
    inputs=5,
    outputs=1,
    num_rows=10,
    noise=0,
    coefs=None,
    output_format="compact",
    min_ingredients_per_formulation: Optional[int] = None,
    max_ingredients_per_formulation: Optional[int] = None,
    formulation_groups: Optional[List[dict]] = None,
):

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
            ingredient_names = list(formulation_inputs)
            formulation_constraints = [
                (formulation_inputs[input_]["min"], formulation_inputs[input_]["max"])
                for input_ in ingredient_names
            ]
            formulation_required = [
                formulation_inputs[input_].get("required", False)
                for input_ in ingredient_names
            ]

            # Build the group structure for the sampler. When no groups are
            # supplied, the sampler treats all ingredients as one implicit group.
            formulation_group_index = None
            formulation_group_constraints = None
            formulation_group_min_counts = None
            formulation_group_max_counts = None
            if formulation_groups is not None:
                name_to_idx = {name: i for i, name in enumerate(ingredient_names)}
                formulation_group_index = [0] * len(ingredient_names)
                formulation_group_constraints = []
                formulation_group_min_counts = []
                formulation_group_max_counts = []
                for g, group in enumerate(formulation_groups):
                    formulation_group_constraints.append(
                        (float(group["min"]), float(group["max"]))
                    )
                    group_size = len(group["ingredients"])
                    min_count = group.get("min_count")
                    max_count = group.get("max_count")
                    formulation_group_min_counts.append(
                        1 if min_count is None else int(min_count)
                    )
                    formulation_group_max_counts.append(
                        group_size if max_count is None else int(max_count)
                    )
                    for name in group["ingredients"]:
                        formulation_group_index[name_to_idx[name]] = g


    if isinstance(outputs, int):
        num_outputs = outputs
    else:
        num_outputs = len(outputs)  


    # Randomly set coefficients for the response function, if not set by the user   
    if coefs is None:
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
            # X_formulation = gibbs_sample_formulation_space(  # old way of doing this before Groups support was added
            X_formulation = group_aware_sample_formulation_space(
                n_ingredients=num_formulation_inputs,
                constraints=formulation_constraints,
                n_samples=num_rows,
                min_ingredients_per_formulation=min_ingredients_per_formulation,
                max_ingredients_per_formulation=max_ingredients_per_formulation,
                required=formulation_required,
                group_index=formulation_group_index,
                group_constraints=formulation_group_constraints,
                group_min_counts=formulation_group_min_counts,
                group_max_counts=formulation_group_max_counts,
            )
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

    if noise > 0:
        y = y + np.random.normal(0, noise, y.shape)

    # Create pandas DataFrame for the generated data & name the columns
    data_df = pd.DataFrame()

    for k in range(num_outputs):
        if isinstance(outputs, int):
            data_df[f"y_{k+1}"] = y[k]
        else:
            data_df[list(outputs)[k]] = y[k]

    for i in range(num_inputs):
        if isinstance(inputs, int):
            data_df[f"x_{i+1}"] = X[:, i]
        else:
            data_df[all_inputs[i]] = X[:, i]


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
