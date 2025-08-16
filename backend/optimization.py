import numpy as np
import matplotlib.pyplot as plt
from typing import List, Tuple, Callable, Optional


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
        self.acceptance_rate = 0.0
    

    def _check_constraints(self, formulation: np.ndarray) -> bool:
        """Check if a given formulation satisfies all constraints."""
        
        if not np.isclose(np.sum(formulation), 1.0, atol=1e-6):  # Check if ingredients sum to 1 (with small tolerance)
            return False
        
        # Check for non-negative ingredients
        if np.any(formulation < 0):
            return False
        
        # Check that ingreients fall within their bounds constraints
        ### TODO: Add more sophisticated constraint checking here
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
        ### TODO: Could make this more sophisticated with adaptive step sizes
        move_type = np.random.choice(['pairwise_swap', 'dirichlet_noise', 'single_adjust'])
        
        if move_type == 'pairwise_swap':
            return self._pairwise_swap(current)
        elif move_type == 'dirichlet_noise':
            return self._dirichlet_proposal(current)
        else:
            return self._single_ingredient_adjust(current)
    

    def _pairwise_swap(self, current: np.ndarray) -> np.ndarray:
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
        ### TODO: Could make locality_factor adaptive based on acceptance rate
        alpha = current * locality_factor + 1e-6  # Add small constant to avoid zeros
        return np.random.dirichlet(alpha)
    
    
    def _single_ingredient_adjust(self, current: np.ndarray) -> np.ndarray:
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
    

    def _evaluate_objective(self, formulation: np.ndarray) -> float:
        """Evaluate objective function for a formulation."""
        try:
            properties = self.surrogate_model(formulation)
            return self.objective_function(properties)
        except Exception as e:
            # TODO: Add proper error handling/logging
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
        
        current_obj = self._evaluate_objective(current)
        
        # Storage
        self.chain = []
        self.objectives = []
        n_accepted = 0
        
        best_formulation = current.copy()
        best_objective = current_obj
        
        # MCMC loop
        for i in range(n_iterations):
            # Propose new state
            proposed = self._propose_move(current)
            
            # Check constraints
            if not self._check_constraints(proposed):
                # Reject immediately if constraints violated
                self.chain.append(current.copy())
                self.objectives.append(current_obj)
                continue
            
            # Evaluate proposed state
            proposed_obj = self._evaluate_objective(proposed)
            
            # Metropolis-Hastings acceptance criterion
            # Accept if better, or with probability based on Boltzmann distribution
            delta = proposed_obj - current_obj
            accept_prob = min(1.0, np.exp(-delta / self.temperature))
            
            if np.random.random() < accept_prob:
                # Accept
                current = proposed
                current_obj = proposed_obj
                n_accepted += 1
                
                # Update best if needed
                if current_obj < best_objective:
                    best_formulation = current.copy()
                    best_objective = current_obj
            
            # Store state (accepted or rejected)
            self.chain.append(current.copy())
            self.objectives.append(current_obj)
            
            # Progress reporting
            if (i + 1) % 1000 == 0:
                acc_rate = n_accepted / (i + 1)
                print(f"Iteration {i+1}/{n_iterations}, "
                      f"Best objective: {best_objective:.4f}, "
                      f"Acceptance rate: {acc_rate:.3f}")
        
        # Calculate final acceptance rate
        self.acceptance_rate = n_accepted / n_iterations
        
        # TODO: Could add convergence diagnostics here
        
        return best_formulation, best_objective
    

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