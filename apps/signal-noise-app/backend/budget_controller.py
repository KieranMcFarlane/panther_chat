#!/usr/bin/env python3
"""
Budget Controller - Enforces exploration budget constraints

Implements strict budget control to prevent runaway exploration costs:
- Max iterations: 3 per category
- Cost cap: $0.50 per entity
- Time limit: 5 minutes per entity
- Early stopping: confidence > 0.85 for 3 consecutive runs, or 5+ evidence items

Author: Claude Code
Date: 2026-01-30
"""

import logging
import time
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class StoppingReason(Enum):
    """Exhaustive list of why exploration stopped"""
    # Budget exhaustion
    MAX_ITERATIONS_REACHED = "max_iterations_reached"
    COST_LIMIT_REACHED = "cost_limit_reached"
    TIME_LIMIT_REACHED = "time_limit_reached"

    # Early stopping (success)
    CONFIDENCE_THRESHOLD_MET = "confidence_threshold_met"
    EVIDENCE_COUNT_MET = "evidence_count_met"
    CONSECUTIVE_HIGH_CONFIDENCE = "consecutive_high_confidence"

    # Ralph Loop governance
    CATEGORY_SATURATED = "category_saturated"
    CONFIDENCE_SATURATED = "confidence_saturated"
    RALPH_LOOP_STOP = "ralph_loop_stop"
    RALPH_LOOP_LOCK_IN = "ralph_loop_lock_in"

    # Errors
    BRIGHTDATA_ERROR = "brightdata_error"
    CLAUDE_API_ERROR = "claude_api_error"
    RALPH_LOOP_ERROR = "ralph_loop_error"


@dataclass
class ExplorationBudget:
    """
    Budget configuration for bounded exploration

    Attributes:
        max_iterations_per_entity: Max iterations per entity (default: 26, optimal from calibration)
        max_iterations_per_category: Max iterations per category (default: 3)
        max_categories_total: Total categories to explore (default: 8)
        cost_cap_usd: Maximum cost per entity in USD (default: $0.50)
        time_limit_seconds: Max time per entity in seconds (default: 300 = 5 minutes)
        confidence_threshold: Early stop confidence (default: 0.85)
        consecutive_high_confidence: Consecutive runs above threshold (default: 3)
        evidence_count_threshold: Early stop evidence count (default: 5)

        Cost tracking:
        - claude_cost_per_call: Claude API cost per call (default: $0.03)
        - ralph_loop_cost_per_validation: Ralph Loop validation cost (default: $0.01)
        - brightdata_cost_per_scrape: BrightData scraping cost (default: $0.001)
    """
    # Iteration limits
    max_iterations_per_entity: int = 30  # Optimal from calibration (Arsenal: 21, PDF: ~25-30, avg: 30 provides buffer)
    max_iterations_per_category: int = 3
    max_categories_total: int = 8

    # Budget limits
    cost_cap_usd: float = 0.50
    time_limit_seconds: int = 300  # 5 minutes

    # Early stopping criteria
    confidence_threshold: float = 0.85
    consecutive_high_confidence: int = 3
    evidence_count_threshold: int = 5

    # Cost tracking
    claude_cost_per_call: float = 0.03
    ralph_loop_cost_per_validation: float = 0.01
    brightdata_cost_per_scrape: float = 0.001


@dataclass
class BudgetState:
    """
    Tracks current budget state during exploration

    Attributes:
        total_iterations: Total iterations across all categories
        iterations_per_category: Dict mapping category to iteration count
        total_cost_usd: Total cost accumulated so far
        start_time: Exploration start timestamp
        consecutive_high_confidence_count: Consecutive runs above threshold
        total_evidence_count: Total evidence items collected
        current_confidence: Current confidence score
    """
    total_iterations: int = 0
    iterations_per_category: Dict[str, int] = field(default_factory=dict)
    total_cost_usd: float = 0.0
    start_time: float = field(default_factory=time.time)
    consecutive_high_confidence_count: int = 0
    total_evidence_count: int = 0
    current_confidence: float = 0.20  # START_CONFIDENCE


class BudgetController:
    """
    Enforces budget constraints during exploration

    Prevents infinite loops and cost overruns by checking:
    1. Max iterations per category (default: 3)
    2. Total cost cap (default: $0.50)
    3. Time limit (default: 5 minutes)
    4. Early stopping conditions (confidence, evidence)

    Usage:
        budget = ExplorationBudget()
        controller = BudgetController(budget)

        # Check if we can continue
        can_continue, reason = controller.can_continue_exploration("Digital Infrastructure")
        if not can_continue:
            print(f"Cannot continue: {reason}")

        # Record iteration
        controller.record_iteration(
            category="Digital Infrastructure",
            claude_calls=1,
            ralph_validations=1,
            brightdata_scrapes=2,
            evidence_count=1,
            confidence=0.75
        )
    """

    def __init__(self, budget_config: ExplorationBudget):
        """
        Initialize budget controller

        Args:
            budget_config: Budget configuration
        """
        self.config = budget_config
        self.state = BudgetState()

        logger.info(
            f"💰 BudgetController initialized "
            f"(max_iterations: {self.config.max_iterations_per_category}/category, "
            f"cost_cap: ${self.config.cost_cap_usd:.2f}, "
            f"time_limit: {self.config.time_limit_seconds}s)"
        )

    def can_continue_exploration(
        self,
        category: str,
        current_confidence: Optional[float] = None
    ) -> tuple[bool, Optional[StoppingReason]]:
        """
        Check if exploration can continue within budget

        Args:
            category: Category being explored
            current_confidence: Current confidence score (optional)

        Returns:
            (can_continue, stopping_reason) tuple
            - can_continue: True if exploration can continue
            - stopping_reason: None if can continue, else StoppingReason enum
        """
        # Check 0: Entity-level iteration cap (checked FIRST - takes precedence over category math)
        if self.state.total_iterations >= self.config.max_iterations_per_entity:
            logger.info(
                f"💰 Entity-level iteration cap reached "
                f"({self.state.total_iterations} >= {self.config.max_iterations_per_entity})"
            )
            return False, StoppingReason.MAX_ITERATIONS_REACHED

        # Check 1: Max iterations per category
        iterations_in_category = self.state.iterations_per_category.get(category, 0)
        if iterations_in_category >= self.config.max_iterations_per_category:
            logger.debug(f"💰 Max iterations reached for {category} ({iterations_in_category})")
            return False, StoppingReason.MAX_ITERATIONS_REACHED

        # Check 2: Total cost cap
        if self.state.total_cost_usd >= self.config.cost_cap_usd:
            logger.warning(f"💰 Cost cap reached (${self.state.total_cost_usd:.3f} >= ${self.config.cost_cap_usd:.2f})")
            return False, StoppingReason.COST_LIMIT_REACHED

        # Check 3: Time limit
        elapsed_time = time.time() - self.state.start_time
        if elapsed_time >= self.config.time_limit_seconds:
            logger.warning(f"💰 Time limit reached ({elapsed_time:.1f}s >= {self.config.time_limit_seconds}s)")
            return False, StoppingReason.TIME_LIMIT_REACHED

        # Check 4: Confidence threshold (early stopping)
        if current_confidence is not None:
            if current_confidence >= self.config.confidence_threshold:
                self.state.consecutive_high_confidence_count += 1

                if self.state.consecutive_high_confidence_count >= self.config.consecutive_high_confidence:
                    logger.info(
                        f"💰 Confidence threshold met "
                        f"({current_confidence:.3f} >= {self.config.confidence_threshold:.3f} "
                        f"for {self.state.consecutive_high_confidence_count} consecutive runs)"
                    )
                    return False, StoppingReason.CONSECUTIVE_HIGH_CONFIDENCE
            else:
                self.state.consecutive_high_confidence_count = 0

        # Check 5: Evidence count threshold
        if self.state.total_evidence_count >= self.config.evidence_count_threshold:
            logger.info(f"💰 Evidence count threshold met ({self.state.total_evidence_count} >= {self.config.evidence_count_threshold})")
            return False, StoppingReason.EVIDENCE_COUNT_MET

        # All checks passed - can continue
        return True, None

    def record_iteration(
        self,
        category: str,
        claude_calls: int = 0,
        ralph_validations: int = 0,
        brightdata_scrapes: int = 0,
        evidence_count: int = 0,
        confidence: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Record iteration cost and update state

        Args:
            category: Category explored
            claude_calls: Number of Claude API calls
            ralph_validations: Number of Ralph Loop validations
            brightdata_scrapes: Number of BrightData scrapes
            evidence_count: Number of evidence items collected
            confidence: Current confidence score

        Returns:
            Dict with cost breakdown
        """
        # Calculate iteration cost
        claude_cost = claude_calls * self.config.claude_cost_per_call
        ralph_cost = ralph_validations * self.config.ralph_loop_cost_per_validation
        brightdata_cost = brightdata_scrapes * self.config.brightdata_cost_per_scrape
        total_cost = claude_cost + ralph_cost + brightdata_cost

        # Update state
        self.state.total_iterations += 1
        self.state.iterations_per_category[category] = \
            self.state.iterations_per_category.get(category, 0) + 1
        self.state.total_cost_usd += total_cost
        self.state.total_evidence_count += evidence_count

        if confidence is not None:
            self.state.current_confidence = confidence

        # Log cost
        logger.debug(
            f"💰 Iteration cost: ${total_cost:.4f} "
            f"(Claude: ${claude_cost:.4f}, Ralph: ${ralph_cost:.4f}, BrightData: ${brightdata_cost:.4f}) "
            f"| Total: ${self.state.total_cost_usd:.3f}"
        )

        return {
            "iteration_cost_usd": total_cost,
            "claude_cost_usd": claude_cost,
            "ralph_cost_usd": ralph_cost,
            "brightdata_cost_usd": brightdata_cost,
            "total_cost_usd": self.state.total_cost_usd,
            "iterations_in_category": self.state.iterations_per_category[category],
            "total_evidence_count": self.state.total_evidence_count
        }

    def get_remaining_budget(self) -> Dict[str, Any]:
        """
        Get remaining budget

        Returns:
            Dict with remaining budget metrics
        """
        elapsed_time = time.time() - self.state.start_time
        remaining_time = max(0, self.config.time_limit_seconds - elapsed_time)
        remaining_cost = max(0, self.config.cost_cap_usd - self.state.total_cost_usd)

        return {
            "remaining_cost_usd": remaining_cost,
            "remaining_time_seconds": remaining_time,
            "cost_utilization_percent": (self.state.total_cost_usd / self.config.cost_cap_usd) * 100,
            "time_utilization_percent": (elapsed_time / self.config.time_limit_seconds) * 100,
            "total_iterations": sum(self.state.iterations_per_category.values()),
            "total_evidence_count": self.state.total_evidence_count,
            "current_confidence": self.state.current_confidence
        }

    def get_summary(self) -> Dict[str, Any]:
        """
        Get budget summary

        Returns:
            Dict with complete budget state
        """
        elapsed_time = time.time() - self.state.start_time

        return {
            "config": {
                "max_iterations_per_category": self.config.max_iterations_per_category,
                "cost_cap_usd": self.config.cost_cap_usd,
                "time_limit_seconds": self.config.time_limit_seconds,
                "confidence_threshold": self.config.confidence_threshold,
                "evidence_count_threshold": self.config.evidence_count_threshold
            },
            "state": {
                "iterations_per_category": self.state.iterations_per_category,
                "total_cost_usd": self.state.total_cost_usd,
                "elapsed_time_seconds": elapsed_time,
                "total_evidence_count": self.state.total_evidence_count,
                "current_confidence": self.state.current_confidence,
                "consecutive_high_confidence_count": self.state.consecutive_high_confidence_count
            }
        }


# =============================================================================
# Convenience Functions
# =============================================================================

def create_default_budget() -> ExplorationBudget:
    """Create default budget configuration"""
    return ExplorationBudget()


def create_budget_from_config(config_dict: Dict[str, Any]) -> ExplorationBudget:
    """
    Create budget configuration from dict

    Args:
        config_dict: Configuration dict (from JSON file)

    Returns:
        ExplorationBudget instance
    """
    # Support both flat and nested config structures
    iteration_limits = config_dict.get("iteration_limits", {})

    return ExplorationBudget(
        max_iterations_per_entity=config_dict.get("max_iterations_per_entity") or
                                  iteration_limits.get("max_iterations_per_entity", 26),
        max_iterations_per_category=config_dict.get("max_iterations_per_category") or
                                      iteration_limits.get("max_per_category", 3),
        max_categories_total=config_dict.get("max_categories_total") or
                               iteration_limits.get("max_categories_total", 8),
        cost_cap_usd=config_dict.get("cost_cap_usd", 0.50),
        time_limit_seconds=config_dict.get("time_limit_seconds", 300),
        confidence_threshold=config_dict.get("confidence_threshold", 0.85),
        consecutive_high_confidence=config_dict.get("consecutive_high_confidence", 3),
        evidence_count_threshold=config_dict.get("evidence_count_threshold", 5),
        claude_cost_per_call=config_dict.get("claude_cost_per_call", 0.03),
        ralph_loop_cost_per_validation=config_dict.get("ralph_loop_cost_per_validation", 0.01),
        brightdata_cost_per_scrape=config_dict.get("brightdata_cost_per_scrape", 0.001)
    )


if __name__ == "__main__":
    # Test budget controller
    import asyncio

    budget = ExplorationBudget()
    controller = BudgetController(budget)

    # Simulate exploration
    category = "Digital Infrastructure & Stack"

    for i in range(5):
        can_continue, reason = controller.can_continue_exploration(category, current_confidence=0.7 + (i * 0.05))

        print(f"\nIteration {i+1}:")
        print(f"  Can continue: {can_continue}")
        print(f"  Reason: {reason}")

        if can_continue:
            cost_info = controller.record_iteration(
                category=category,
                claude_calls=1,
                ralph_validations=1,
                brightdata_scrapes=2,
                evidence_count=1,
                confidence=0.7 + (i * 0.05)
            )
            print(f"  Cost: ${cost_info['iteration_cost_usd']:.4f}")
            print(f"  Total cost: ${cost_info['total_cost_usd']:.3f}")
        else:
            break

    print("\n" + "="*60)
    print("Budget Summary:")
    import json
    print(json.dumps(controller.get_summary(), indent=2))
