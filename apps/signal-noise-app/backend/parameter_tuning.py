"""
Parameter Tuning Framework for Hypothesis-Driven Discovery

Provides automated parameter optimization using grid search and
Bayesian optimization to maximize discovery effectiveness.

Features:
- Configurable parameter dataclass
- Grid search optimization
- Bayesian optimization (optional)
- Hold-out validation
- Objective function with configurable rewards

Part of Phase 6: Production Rollout
"""

import logging
import itertools
import json
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime
from copy import deepcopy

logger = logging.getLogger(__name__)


@dataclass
class ParameterConfig:
    """
    Configurable discovery parameters.

    All tunable parameters for the hypothesis-driven discovery system.
    """

    # EIG category multipliers
    c_suite_multiplier: float = 1.5
    digital_multiplier: float = 1.3
    commercial_multiplier: float = 1.1
    default_multiplier: float = 1.0

    # Confidence deltas
    accept_delta: float = 0.06
    weak_accept_delta: float = 0.02
    reject_delta: float = 0.0

    # Novelty decay
    novelty_decay_factor: float = 1.0
    novelty_decay_rate: float = 0.1

    # Execution limits
    max_iterations: int = 30
    max_depth: int = 7  # Increased from 3 based on validation analysis
    min_confidence: float = 0.0
    max_confidence: float = 1.0

    # Cluster dampening
    saturation_threshold: float = 0.70
    min_cluster_size: int = 5
    pattern_frequency_threshold: int = 3

    # Cache settings
    cache_ttl_minutes: int = 60
    cache_size_mb: int = 100

    # Cost control
    max_cost_per_entity_usd: float = 2.0
    cost_safety_margin: float = 0.9  # Stop at 90% of budget

    # Actionable gate
    actionable_min_accepts: int = 2
    actionable_min_categories: int = 2

    # Exploration vs exploitation
    exploration_bonus: float = 0.1  # Bonus for novel categories
    exploitation_bonus: float = 0.05  # Bonus for proven categories

    def get_eig_multipliers(self) -> Dict[str, float]:
        """Get EIG category multipliers as dict"""
        return {
            "C-SUITE": self.c_suite_multiplier,
            "DIGITAL": self.digital_multiplier,
            "COMMERCIAL": self.commercial_multiplier,
            "DEFAULT": self.default_multiplier
        }

    def get_confidence_deltas(self) -> Dict[str, float]:
        """Get confidence deltas as dict"""
        return {
            "ACCEPT": self.accept_delta,
            "WEAK_ACCEPT": self.weak_accept_delta,
            "REJECT": self.reject_delta
        }

    def validate(self) -> bool:
        """Validate parameter values are within reasonable bounds"""
        checks = [
            (0.0 <= self.c_suite_multiplier <= 10.0, "c_suite_multiplier out of range"),
            (0.0 <= self.digital_multiplier <= 10.0, "digital_multiplier out of range"),
            (0.0 <= self.commercial_multiplier <= 10.0, "commercial_multiplier out of range"),
            (0.0 <= self.accept_delta <= 1.0, "accept_delta out of range"),
            (0.0 <= self.weak_accept_delta <= 1.0, "weak_accept_delta out of range"),
            (1 <= self.max_iterations <= 100, "max_iterations out of range"),
            (1 <= self.max_depth <= 10, "max_depth out of range"),
            (0.0 <= self.saturation_threshold <= 1.0, "saturation_threshold out of range"),
            (0 <= self.min_cluster_size <= 100, "min_cluster_size out of range"),
            (1 <= self.cache_ttl_minutes <= 1440, "cache_ttl_minutes out of range"),
            (10 <= self.cache_size_mb <= 10000, "cache_size_mb out of range"),
            (0.0 <= self.max_cost_per_entity_usd <= 100.0, "max_cost_per_entity_usd out of range"),
            (1 <= self.actionable_min_accepts <= 10, "actionable_min_accepts out of range"),
            (1 <= self.actionable_min_categories <= 10, "actionable_min_categories out of range"),
        ]

        for valid, msg in checks:
            if not valid:
                logger.error(f"Parameter validation failed: {msg}")
                return False

        return True

    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict) -> 'ParameterConfig':
        """Create from dictionary"""
        return cls(**data)

    def save(self, filepath: str) -> None:
        """Save to JSON file"""
        with open(filepath, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)
        logger.info(f"Saved config to {filepath}")

    @classmethod
    def load(cls, filepath: str) -> 'ParameterConfig':
        """Load from JSON file"""
        with open(filepath, 'r') as f:
            data = json.load(f)
        config = cls.from_dict(data)
        logger.info(f"Loaded config from {filepath}")
        return config


@dataclass
class TuningResult:
    """Result of parameter tuning"""
    best_config: ParameterConfig
    best_score: float
    all_results: List[Dict[str, Any]] = field(default_factory=list)
    tuning_duration_seconds: float = 0.0
    iterations_completed: int = 0


class ParameterTuner:
    """
    Automated parameter tuning for hypothesis-driven discovery.

    Uses grid search or Bayesian optimization to find optimal
    parameter configurations based on validation data.
    """

    def __init__(self, validation_data: List[Dict]):
        """
        Initialize parameter tuner.

        Args:
            validation_data: Historical data for validation
        """
        self.validation_data = validation_data
        self.current_config = ParameterConfig()

        logger.info(f"Initialized ParameterTuner with {len(validation_data)} validation samples")

    def grid_search(
        self,
        param_ranges: Dict[str, Tuple[float, float, float]],
        n_samples: int = 10,
        validation_split: float = 0.8
    ) -> TuningResult:
        """
        Exhaustive grid search over parameter space.

        Args:
            param_ranges: Dict mapping parameter names to (min, max, step) tuples
            n_samples: Number of samples per parameter
            validation_split: Fraction of data to use for validation (rest for training)

        Returns:
            TuningResult with best configuration
        """
        logger.info("Starting grid search parameter tuning")
        start_time = datetime.now()

        # Split data into train/validation
        split_idx = int(len(self.validation_data) * validation_split)
        train_data = self.validation_data[:split_idx]
        validation_data = self.validation_data[split_idx:]

        # Generate parameter combinations
        param_names = list(param_ranges.keys())
        param_values = []

        for param_name, (min_val, max_val, step) in param_ranges.items():
            values = []
            current = min_val
            while current <= max_val:
                values.append(current)
                current += step
            param_values.append(values)

        # Cartesian product of all parameter combinations
        combinations = list(itertools.product(*param_values))

        logger.info(f"Testing {len(combinations)} parameter combinations")

        best_score = float('-inf')
        best_config = None
        all_results = []

        for i, combination in enumerate(combinations):
            # Create config from combination
            config_dict = self.current_config.to_dict()
            for param_name, value in zip(param_names, combination):
                config_dict[param_name] = value
            config = ParameterConfig.from_dict(config_dict)

            # Validate config
            if not config.validate():
                continue

            # Calculate score on validation data
            score = self._calculate_score(config, validation_data, train_data)

            all_results.append({
                "config": config_dict,
                "score": score
            })

            # Track best
            if score > best_score:
                best_score = score
                best_config = config
                logger.info(f"New best score: {score:.4f} at iteration {i+1}")

        duration = (datetime.now() - start_time).total_seconds()

        result = TuningResult(
            best_config=best_config,
            best_score=best_score,
            all_results=all_results,
            tuning_duration_seconds=duration,
            iterations_completed=len(combinations)
        )

        logger.info(
            f"Grid search completed: best_score={best_score:.4f}, "
            f"iterations={len(combinations)}, duration={duration:.2f}s"
        )

        return result

    def bayesian_optimization(
        self,
        param_ranges: Dict[str, Tuple[float, float]],
        n_iterations: int = 50,
        validation_split: float = 0.8
    ) -> TuningResult:
        """
        Smart Bayesian optimization (requires scikit-optimize).

        Args:
            param_ranges: Dict mapping parameter names to (min, max) tuples
            n_iterations: Number of optimization iterations
            validation_split: Fraction of data for validation

        Returns:
            TuningResult with best configuration
        """
        try:
            from skopt import gp_minimize
            from skopt.space import Real
        except ImportError:
            logger.warning("scikit-optimize not installed, falling back to grid search")
            # Convert to grid search format
            grid_ranges = {}
            for param_name, (min_val, max_val) in param_ranges.items():
                step = (max_val - min_val) / 10  # 10 steps
                grid_ranges[param_name] = (min_val, max_val, step)
            return self.grid_search(grid_ranges, n_samples=10, validation_split=validation_split)

        logger.info("Starting Bayesian optimization parameter tuning")
        start_time = datetime.now()

        # Split data
        split_idx = int(len(self.validation_data) * validation_split)
        train_data = self.validation_data[:split_idx]
        validation_data = self.validation_data[split_idx:]

        # Define search space
        dimensions = []
        param_names = []
        for param_name, (min_val, max_val) in param_ranges.items():
            dimensions.append(Real(min_val, max_val, name=param_name))
            param_names.append(param_name)

        # Define objective function (negative because we minimize)
        def objective(params):
            config_dict = self.current_config.to_dict()
            for param_name, value in zip(param_names, params):
                config_dict[param_name] = value
            config = ParameterConfig.from_dict(config_dict)

            if not config.validate():
                return 1e6  # Penalize invalid configs

            score = self._calculate_score(config, validation_data, train_data)
            return -score  # Minimize negative score = maximize score

        # Run optimization
        result = gp_minimize(
            objective,
            dimensions,
            n_calls=n_iterations,
            random_state=42
        )

        # Extract best config
        best_config_dict = self.current_config.to_dict()
        for param_name, value in zip(param_names, result.x):
            best_config_dict[param_name] = value
        best_config = ParameterConfig.from_dict(best_config_dict)

        duration = (datetime.now() - start_time).total_seconds()

        tuning_result = TuningResult(
            best_config=best_config,
            best_score=-result.fun,
            tuning_duration_seconds=duration,
            iterations_completed=n_iterations
        )

        logger.info(
            f"Bayesian optimization completed: best_score={-result.fun:.4f}, "
            f"iterations={n_iterations}, duration={duration:.2f}s"
        )

        return tuning_result

    def _calculate_score(
        self,
        config: ParameterConfig,
        validation_data: List[Dict],
        train_data: List[Dict]
    ) -> float:
        """
        Calculate score for a configuration on validation data.

        Scoring:
        - Correct actionable prediction: +10
        - Correct non-actionable prediction: +5
        - Cost savings: +5 per $0.01 saved
        - Cost overspend: -10 per $0.01 overspent
        """
        total_score = 0.0

        for sample in validation_data:
            # Simulate discovery with config
            simulated = self._simulate_discovery(sample, config)

            # Calculate reward
            reward = 0.0

            # Accuracy rewards
            actual_actionable = sample.get("actual_actionable", False)
            predicted_actionable = simulated.get("actionable", False)

            if predicted_actionable == actual_actionable:
                if actual_actionable:
                    reward += 10  # Correct actionable
                else:
                    reward += 5  # Correct non-actionable
            else:
                reward -= 5  # Incorrect prediction

            # Cost rewards
            actual_cost = sample.get("actual_cost_usd", 1.0)
            predicted_cost = simulated.get("cost_usd", 1.0)
            cost_diff = actual_cost - predicted_cost

            if cost_diff > 0:
                reward += cost_diff * 500  # Savings: $0.01 saved = +0.05 reward
            else:
                reward += cost_diff * 1000  # Overspend: $0.01 overspent = -0.10 reward

            total_score += reward

        # Average score
        avg_score = total_score / len(validation_data) if validation_data else 0.0

        return avg_score

    def _simulate_discovery(
        self,
        sample: Dict,
        config: ParameterConfig
    ) -> Dict:
        """
        Simulate discovery process with given config.

        Simplified simulation for parameter tuning.
        """
        # This is a simplified simulation
        # In production, this would run actual discovery with the config

        entity_id = sample.get("entity_id", "test")
        cost_so_far = 0.0
        confidence = 0.0
        iterations = 0
        accept_count = 0
        categories_with_accept = set()

        # Simulate iterations
        while iterations < config.max_iterations and cost_so_far < config.max_cost_per_entity_usd:
            iterations += 1

            # Simulate hypothesis test
            if sample.get("has_signal", False):
                # Simulate ACCEPT decision
                if iterations % 3 == 0:  # Every 3rd iteration
                    confidence += config.accept_delta
                    accept_count += 1
                    categories_with_accept.add("test_category")

            # Simulate cost
            cost_so_far += 0.03  # $0.03 per iteration

            # Check if actionable
            if (accept_count >= config.actionable_min_accepts and
                len(categories_with_accept) >= config.actionable_min_categories and
                confidence >= 0.8):
                break

        actionable = (
            accept_count >= config.actionable_min_accepts and
            len(categories_with_accept) >= config.actionable_min_categories and
            confidence >= 0.8
        )

        return {
            "entity_id": entity_id,
            "actionable": actionable,
            "cost_usd": cost_so_far,
            "confidence": confidence,
            "iterations": iterations
        }

    def validate_config(
        self,
        config: ParameterConfig,
        test_data: List[Dict] = None
    ) -> Dict:
        """
        Validate configuration on held-out test set.

        Args:
            config: ParameterConfig to validate
            test_data: Optional test data (uses validation data if None)

        Returns:
            Dict with validation metrics
        """
        test_data = test_data or self.validation_data

        logger.info(f"Validating config on {len(test_data)} test samples")

        total_score = 0.0
        correct_actionable = 0
        correct_non_actionable = 0
        incorrect = 0
        total_cost = 0.0

        for sample in test_data:
            simulated = self._simulate_discovery(sample, config)

            actual_actionable = sample.get("actual_actionable", False)
            predicted_actionable = simulated.get("actionable", False)

            if predicted_actionable == actual_actionable:
                if actual_actionable:
                    correct_actionable += 1
                else:
                    correct_non_actionable += 1
            else:
                incorrect += 1

            total_cost += simulated.get("cost_usd", 0.0)

        accuracy = (correct_actionable + correct_non_actionable) / len(test_data) if test_data else 0.0
        avg_cost = total_cost / len(test_data) if test_data else 0.0

        metrics = {
            "accuracy": accuracy,
            "correct_actionable": correct_actionable,
            "correct_non_actionable": correct_non_actionable,
            "incorrect": incorrect,
            "avg_cost_usd": avg_cost,
            "total_cost_usd": total_cost
        }

        logger.info(f"Validation results: {metrics}")
        return metrics


def get_default_param_ranges() -> Dict[str, Tuple[float, float, float]]:
    """
    Get default parameter ranges for grid search.

    Returns:
        Dict mapping parameter names to (min, max, step) tuples
    """
    return {
        "accept_delta": (0.01, 0.15, 0.01),
        "weak_accept_delta": (0.005, 0.05, 0.005),
        "c_suite_multiplier": (1.0, 3.0, 0.1),
        "digital_multiplier": (1.0, 2.5, 0.1),
        "commercial_multiplier": (1.0, 2.0, 0.1),
        "max_iterations": (10, 50, 5),
        "saturation_threshold": (0.5, 0.9, 0.05),
    }


def get_bayesian_param_ranges() -> Dict[str, Tuple[float, float]]:
    """
    Get parameter ranges for Bayesian optimization.

    Returns:
        Dict mapping parameter names to (min, max) tuples
    """
    return {
        "accept_delta": (0.01, 0.15),
        "weak_accept_delta": (0.005, 0.05),
        "c_suite_multiplier": (1.0, 3.0),
        "digital_multiplier": (1.0, 2.5),
        "commercial_multiplier": (1.0, 2.0),
        "max_iterations": (10, 50),
        "saturation_threshold": (0.5, 0.9),
    }
