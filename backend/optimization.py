import numpy as np
import matplotlib.pyplot as plt
from typing import List, Tuple, Callable, Optional


### TODO: still needs thorough testing and enhancements to be robust for real-world formulations usage
### TODO: investigate if/how this works for multi-objective optimization
class FormulationMCMC:
    """
    MCMC optimizer for chemical formulations with sum-to-1 constraint.
    Uses Metropolis-Hastings algorithm with Boltzmann distribution.
    """
    
    def __init__(
        self, 
        ingredient_names: List[str],
        surrogate_model: Callable,
        objective_function: Callable,
        temperature: float = 1.0,
        bounds: Optional[dict] = None
    ):
        """
        Args:
            ingredient_names: List of ingredient names
            surrogate_model: Function that takes mass fractions and returns predicted properties
            objective_function: Function that takes predicted properties and returns cost (lower = better)
            temperature: Temperature parameter T for Boltzmann distribution
            bounds: Dict of {ingredient_name: (min_fraction, max_fraction)}
        """
        self.ingredient_names = ingredient_names
        self.n_ingredients = len(ingredient_names)
        self.surrogate_model = surrogate_model
        self.objective_function = objective_function
        self.temperature = temperature
        self.bounds = bounds or {}
        
        # Storage for results
        self.chain = []
        self.objectives = []
        self.predictions = []
        self.acceptance_rate = 0.0
    

    def _check_constraints(self, formulation: np.ndarray) -> bool:
        """Check if a given formulation satisfies all constraints."""
        
        if not np.isclose(np.sum(formulation), 1.0, atol=1e-6):  # Check if ingredients sum to 1 (with small tolerance)
            return False
        
        # Check for non-negative ingredients
        if np.any(formulation < 0):
            return False
        
        # Check that ingreients fall within their bounds constraints
        ### SOMEDAY: Add more sophisticated constraint checking here
        for i, ingredient in enumerate(self.ingredient_names):
            if ingredient in self.bounds:
                min_val, max_val = self.bounds[ingredient]
                if formulation[i] < min_val or formulation[i] > max_val:
                    return False
        
        return True


    def _propose_move(self, current: np.ndarray) -> np.ndarray:
        """
        Propose new formulation using constraint-respecting moves.
        Uses a mix of different proposal types.
        """
        ### SOMEDAY: Could make this more sophisticated with adaptive step sizes
        move_type = np.random.choice([
            'pairwise_transfer', 'dirichlet_noise', 'single_adjust',
            'add_ingredient', 
            'remove_ingredient',
            'swap_ingredients',
        ])
        
        if move_type == 'pairwise_transfer':
            return self._pairwise_quantity_transfer(current)
        elif move_type == 'dirichlet_noise':
            return self._dirichlet_proposal(current)
        ### TODO: finish implementing these move types and then uncomment them from the above np.random.choice list
        elif move_type == 'add_ingredient':
            return self._add_ingredient(current)
        elif move_type == 'remove_ingredient':
            return self._remove_ingredient(current)
        elif move_type == 'swap_ingredients':
            return self._swap_ingredients(current)
        elif move_type == 'single_adjust':
            return self._adjust_ingredient_and_rebalance_others(current)
    

    def _pairwise_quantity_transfer(self, current: np.ndarray) -> np.ndarray:
        """
        Transfer mass between two random ingredients. Tranfser amount is always in
        terms of amount transferred from i to j, although trasferred value can be negative.
        """
        new = current.copy()
        
        # Pick two different ingredients
        i, j = np.random.choice(self.n_ingredients, 2, replace=False)
        
        # Determine maximum transferable amount
        max_transfer_amount = min(current[i], 1.0 - current[j])  # Don't go negative or over 1
        
        if max_transfer_amount > 1e-6:  # Only if a meaningful transfer amount is possible
            transfer_amount = np.random.uniform(-max_transfer_amount, max_transfer_amount)  # transfer can go in either direction (more of i, or less of i)
            new[i] -= transfer_amount
            new[j] += transfer_amount
        
        return new
    
    
    def _dirichlet_proposal(self, current: np.ndarray, locality_factor: float = 100.0) -> np.ndarray:
        """
        Propose new formulation from Dirichlet distribution centered on current.
        Higher locality_factor = proposals closer to current formulation.
        This type of proposed move can change any number of ingredient quantities at once,
        and can change ingredients with quantities of exactly zero to have non-zero values,
        but it can never set any non-zero ingredient quantities back to exactly zero.
        """
        ### SOMEDAY: Could make locality_factor adaptive based on acceptance rate
        alpha = current * locality_factor + 1e-6  # Add small constant to avoid zeros
        return np.random.dirichlet(alpha)
    
    
    def _adjust_ingredient_and_rebalance_others(self, current: np.ndarray) -> np.ndarray:
        """Adjust one ingredient and renormalize others proportionally."""
        new = current.copy()
        
        # Pick random ingredient and new value
        i = np.random.randint(self.n_ingredients)
        max_val = min(0.95, current[i] + 0.1)  # Don't let one ingredient dominate
        min_val = max(0.0, current[i] - 0.1)
        
        new_val = np.random.uniform(min_val, max_val)
        old_val = current[i]
        
        # Adjust and renormalize
        new[i] = new_val
        remaining_sum = 1.0 - new_val
        old_remaining_sum = 1.0 - old_val
        
        if old_remaining_sum > 1e-6:  # Avoid division by zero
            scale_factor = remaining_sum / old_remaining_sum
            for j in range(self.n_ingredients):
                if j != i:
                    new[j] *= scale_factor
        
        return new
    

    def _add_ingredient(self, current: np.ndarray) -> np.ndarray:
        """
        Add a new ingredient to the formulation by:
        1. Finding ingredients currently at 0 (not in formulation)
        2. Randomly selecting one to add with a small positive value
        3. Rebalancing all existing ingredients proportionally to maintain sum=1
        4. Checking that all constraints are still satisfied
        """
        new = current.copy()
        
        # Find ingredients that are currently exactly zero
        zero_indices = np.where(current < 1e-8)[0]  # Using small epsilon to account for numerical precision
        
        if len(zero_indices) == 0:
            # No ingredients to add (all are already in use)
            return current  # Return unchanged
        
        # Randomly select one zero ingredient to add
        ingredient_to_add = np.random.choice(zero_indices)
        
        ### SOMEDAY: stop hard-coding these min and max values...?
        # Determine the amount of the new ingredient to add (small fraction, respecting bounds)
        min_add_amount = 0.0001  # Minimum meaningful amount to add
        max_add_amount = 0.2   # Maximum to avoid too dramatic changes
        
        # Check if this ingredient has bounds constraints
        ingredient_name = self.ingredient_names[ingredient_to_add]
        if ingredient_name in self.bounds:
            min_bound, max_bound = self.bounds[ingredient_name]
            min_add_amount = max(min_add_amount, min_bound)
            max_add_amount = min(max_add_amount, max_bound)
        
        # Make sure we don't exceed what's available to redistribute
        current_sum = np.sum(current)
        ### SOMEDAY: stop hard-coding the factor of 0.3...?
        available_to_redistribute = min(max_add_amount, current_sum * 0.3)  # Don't take more than 30% from existing
        
        if available_to_redistribute < min_add_amount:
            # Can't add meaningful amount while respecting constraints
            return current
        
        # Choose amount to add
        add_amount = np.random.uniform(min_add_amount, available_to_redistribute)
        
        # Add the new ingredient
        new[ingredient_to_add] = add_amount
        
        # Calculate how much we need to scale down existing ingredients
        remaining_sum = 1.0 - add_amount
        current_existing_sum = current_sum  # Should be 1.0, but let's be safe
        
        if current_existing_sum > 1e-8:  # Avoid division by zero
            scale_factor = remaining_sum / current_existing_sum
            
            # Scale down all existing (non-zero) ingredients proportionally
            for i in range(self.n_ingredients):
                if i != ingredient_to_add and current[i] > 1e-8:
                    new[i] = current[i] * scale_factor
        
        # Verify constraints are still satisfied for all ingredients
        for i, ingredient in enumerate(self.ingredient_names):
            if ingredient in self.bounds:
                min_val, max_val = self.bounds[ingredient]
                if new[i] < min_val or new[i] > max_val:
                    # Constraint violation - return unchanged formulation
                    return current
        
        return new



    def _remove_ingredient(self, current: np.ndarray) -> np.ndarray:
        """
        Remove an existing ingredient from the formulation by:
        1. Finding ingredients currently > 0 (in the formulation)
        2. Checking which ones can be removed without violating constraints
        3. Randomly selecting one to remove (set to 0)
        4. Rebalancing all remaining ingredients proportionally to maintain sum=1
        5. Checking that all constraints are still satisfied
        """
        new = current.copy()
        
        # Find ingredients that are currently non-zero (can potentially be removed)
        nonzero_indices = np.where(current > 1e-8)[0]  # Using small epsilon for numerical precision
        
        if len(nonzero_indices) <= 1:
            # Need at least 2 ingredients to remove one (can't have empty formulation)
            return current  # Return unchanged
        
        # Check which ingredients can actually be removed given bounds constraints
        removable_indices = []
        for idx in nonzero_indices:
            ingredient_name = self.ingredient_names[idx]
            
            # Check if this ingredient has a minimum bound constraint
            can_remove = True
            if ingredient_name in self.bounds:
                min_bound, max_bound = self.bounds[ingredient_name]
                if min_bound > 1e-8:  # If minimum bound is > 0, can't remove this ingredient
                    can_remove = False
            
            if can_remove:
                removable_indices.append(idx)
        
        if len(removable_indices) == 0:
            # No ingredients can be removed without violating constraints
            return current
        
        # Randomly select one removable ingredient
        ingredient_to_remove = np.random.choice(removable_indices)
        
        # Store the amount being removed
        removed_amount = current[ingredient_to_remove]
        
        # Remove the ingredient (set to 0)
        new[ingredient_to_remove] = 0.0
        
        # Calculate current sum of remaining ingredients
        remaining_sum = np.sum(new)  # This should be 1.0 - removed_amount
        
        if remaining_sum > 1e-8:  # Avoid division by zero
            # Scale up all remaining ingredients proportionally to maintain sum=1
            scale_factor = 1.0 / remaining_sum
            
            for i in range(self.n_ingredients):
                if i != ingredient_to_remove and current[i] > 1e-8:
                    new[i] = new[i] * scale_factor
        else:
            # Edge case: removing the last ingredient would leave empty formulation
            # This shouldn't happen due to our check above, but just in case
            return current
        
        # Verify constraints are still satisfied for all ingredients
        for i, ingredient in enumerate(self.ingredient_names):
            if ingredient in self.bounds:
                min_val, max_val = self.bounds[ingredient]
                if new[i] < min_val or new[i] > max_val:
                    # Constraint violation - return unchanged formulation
                    return current
        
        return new
    
    

    def _swap_ingredients(self, current: np.ndarray) -> np.ndarray:
        """
        Swap one ingredient for another by:
        1. Finding ingredients currently in the formulation (> 0)
        2. Finding ingredients not in the formulation (= 0) that can be added
        3. Randomly selecting one to remove and one to add
        4. Transferring the exact quantity from removed ingredient to new ingredient
        5. Checking that all constraints are still satisfied
        
        This preserves all other ingredient quantities exactly.
        """
        new = current.copy()
        
        # Find ingredients currently in the formulation (can be swapped out)
        active_indices = np.where(current > 1e-8)[0]
        
        # Find ingredients not in the formulation (can be swapped in)
        inactive_indices = np.where(current < 1e-8)[0]
        
        if len(active_indices) == 0 or len(inactive_indices) == 0:
            # Need at least one active and one inactive ingredient to swap
            return current
        
        # Check which inactive ingredients can actually be swapped in given bounds constraints
        swappable_in_indices = []
        for idx in inactive_indices:
            ingredient_name = self.ingredient_names[idx]
            
            # Check if this ingredient can be added (no minimum bound violations)
            can_swap_in = True
            if ingredient_name in self.bounds:
                min_bound, max_bound = self.bounds[ingredient_name]
                # We'll need to check if the quantity we're swapping in fits bounds
                # For now, just check if the ingredient can have non-zero values
                if min_bound < 0:  # Invalid bound
                    can_swap_in = False
            
            if can_swap_in:
                swappable_in_indices.append(idx)
        
        if len(swappable_in_indices) == 0:
            # No ingredients can be swapped in without violating constraints
            return current
        
        # Check which active ingredients can actually be swapped out given bounds constraints
        swappable_out_indices = []
        for idx in active_indices:
            ingredient_name = self.ingredient_names[idx]
            
            # Check if this ingredient can be removed (no minimum bound > 0)
            can_swap_out = True
            if ingredient_name in self.bounds:
                min_bound, max_bound = self.bounds[ingredient_name]
                if min_bound > 1e-8:  # If minimum bound is > 0, can't remove this ingredient
                    can_swap_out = False
            
            if can_swap_out:
                swappable_out_indices.append(idx)
        
        if len(swappable_out_indices) == 0:
            # No ingredients can be swapped out without violating constraints
            return current
        
        # Randomly select ingredients to swap
        ingredient_to_remove = np.random.choice(swappable_out_indices)
        ingredient_to_add = np.random.choice(swappable_in_indices)
        
        # Get the quantity to transfer
        quantity_to_transfer = current[ingredient_to_remove]
        
        # Check if the new ingredient can accept this quantity given its bounds
        ingredient_to_add_name = self.ingredient_names[ingredient_to_add]
        if ingredient_to_add_name in self.bounds:
            min_bound, max_bound = self.bounds[ingredient_to_add_name]
            if quantity_to_transfer < min_bound or quantity_to_transfer > max_bound:
                # The quantity to transfer would violate bounds for the new ingredient
                return current
        
        # Perform the swap
        new[ingredient_to_remove] = 0.0
        new[ingredient_to_add] = quantity_to_transfer
        
        # Final constraint verification (should pass, but let's be safe)
        if not self._check_constraints(new):
            return current
        
        return new
    
    

    def _evaluate_objective(self, formulation: np.ndarray) -> float:
        """Evaluate objective function for a formulation."""
        try:
            ### TODO: right now, this is set up as if the surrogate model's only input variables must come from the formulation's composition 
            ### (i.e. no other variables like temperature, pressure, etc). Eventually, need to extend support for non-compositional variables.
            predicted_properties = self.surrogate_model(formulation)
            objective_value = self.objective_function(predicted_properties)
            return predicted_properties, objective_value
        except Exception as e:
            ### SOMEDAY: Add proper error handling/logging...(???)
            print(f"Error evaluating formulation: {e}")
            return float('inf')  # Return very bad objective
    

    def _generate_valid_initial_formulation(self) -> np.ndarray:
        """Generate a random formulation that satisfies all constraints."""
        max_attempts = 1000
        
        for attempt in range(max_attempts):
            # Start with uniform distribution
            formulation = np.ones(self.n_ingredients) / self.n_ingredients
            
            # Apply bounds constraints first
            for i, ingredient in enumerate(self.ingredient_names):
                if ingredient in self.bounds:
                    min_val, max_val = self.bounds[ingredient]
                    # Set to a random value within bounds
                    formulation[i] = np.random.uniform(min_val, max_val)
            
            # Renormalize the unconstrained ingredients
            constrained_sum = 0
            unconstrained_indices = []
            
            for i, ingredient in enumerate(self.ingredient_names):
                if ingredient in self.bounds:
                    constrained_sum += formulation[i]
                else:
                    unconstrained_indices.append(i)
            
            remaining_mass = 1.0 - constrained_sum
            
            if remaining_mass > 0 and len(unconstrained_indices) > 0:
                # Distribute remaining mass among unconstrained ingredients
                unconstrained_fractions = np.random.dirichlet(np.ones(len(unconstrained_indices)))  # get vector values that sum to 1
                for j, idx in enumerate(unconstrained_indices):
                    formulation[idx] = unconstrained_fractions[j] * remaining_mass  # multiply by the remaining mass (some value between 0 and 1) to "normalize"; the values of this vector will sum to the remaining mass.
                
                if self._check_constraints(formulation):
                    return formulation
        
        raise ValueError(f"Could not generate valid initial formulation after {max_attempts} attempts. "
                        "Check if bounds constraints are feasible.")


    ### TODO: (DO THIS ONE!!!) need to make sure this process returns a set of candidates are de-duplicated and sorted by objective value
    ### TODO: need to thoroughly understand this `optimize` function and make sure it's working as expected
    ### TODO: needs to return set of candidates with individual predictions from the surrogate model for each candidate
    def optimize(
        self, 
        initial_formulation: Optional[np.ndarray] = None,
        n_iterations: int = 10000,
        burn_in: int = 1000,
    ) -> Tuple[np.ndarray, float]:
        """
        Run MCMC optimization.
        
        Args:
            initial_formulation: Starting point (if None, uses random valid formulation)
            n_iterations: Total number of MCMC steps
            burn_in: Number of initial steps to discard
            
        Returns:
            best_formulation, best_objective
        """
        # Initialize
        if initial_formulation is None:
            current = self._generate_valid_initial_formulation()
        else:
            current = initial_formulation.copy()
            
        if not self._check_constraints(current):
            raise ValueError("Initial formulation violates constraints")
        
        current_predictions, current_objective = self._evaluate_objective(current)
        
        # Storage
        self.chain = []
        self.objectives = []
        n_accepted = 0
        
        best_formulation = current.copy()
        best_objective = current_objective
        
        # MCMC loop
        for i in range(n_iterations):
            # Propose new state
            proposed = self._propose_move(current)
            
            # Check constraints
            if not self._check_constraints(proposed):
                # Reject immediately if constraints violated
                self.chain.append(current.copy())
                self.objectives.append(current_objective)
                self.predictions.append(current_predictions)
                continue
            
            # Evaluate proposed state
            proposed_predictions, proposed_objective = self._evaluate_objective(proposed)
            
            # Metropolis-Hastings acceptance criterion
            # Accept if better, or with probability based on Boltzmann distribution
            delta = proposed_objective - current_objective
            accept_prob = min(1.0, np.exp(-delta / self.temperature))
            
            if np.random.random() < accept_prob:
                # Accept
                current = proposed
                current_objective = proposed_objective
                current_predictions = proposed_predictions
                n_accepted += 1
                
                # Update best if needed
                if current_objective < best_objective:
                    best_formulation = current.copy()
                    best_objective = current_objective
            
            # Store state (accepted or rejected)
            self.chain.append(current.copy())
            self.objectives.append(current_objective)
            self.predictions.append(current_predictions)
            
            # Progress reporting
            if (i + 1) % 1000 == 0:
                acc_rate = n_accepted / (i + 1)
                print(f"Iteration {i+1}/{n_iterations}, "
                      f"Best objective: {best_objective:.4f}, "
                      f"Acceptance rate: {acc_rate:.3f}")
        
        # Calculate final acceptance rate
        self.acceptance_rate = n_accepted / n_iterations
        
        ### SOMEDAY: Could add convergence diagnostics here
        
        return best_formulation, best_objective
    

    ### TODO: thoroughly review this and understand if it's necessary here... or should this be split out into a separate function somewhere else entirely?
    ### (currently, yes, it is needed if you want to run the notebook code that tests the FormulationMCMC class by plotting the results, bc the plotting depends on this function)
    ### (but long-term, this code should probably go somewhere else, and we should change how things are evaluated in that other notebook)
    def plot_results(self):
        """Plot optimization progress and formulation evolution."""
        if not self.chain:
            print("No results to plot. Run optimize() first.")
            return
        
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8))
        
        # Plot objective function evolution
        ax1.plot(self.objectives)
        ax1.set_xlabel('Iteration')
        ax1.set_ylabel('Objective Value')
        ax1.set_title('MCMC Optimization Progress')
        ax1.grid(True)
        
        # Plot ingredient fractions over time
        chain_array = np.array(self.chain)
        for i, ingredient in enumerate(self.ingredient_names[:5]):  # Show only first 5
            ax2.plot(chain_array[:, i], label=ingredient, alpha=0.7)
        
        ax2.set_xlabel('Iteration')
        ax2.set_ylabel('Mass Fraction')
        ax2.set_title('Ingredient Evolution (First 5 Ingredients)')
        ax2.legend()
        ax2.grid(True)
        
        plt.tight_layout()
        plt.show()
