"""
Promotion Engine

Ralph-governed promotion logic with hard thresholds.

Core principle: Ralph Loop validates exploration results before promotion.
Only validated patterns are promoted to templates.

Promotion decisions:
- PROMOTE: 5+ observations, 80%+ confidence, pattern in 3+ entities
- PROMOTE_WITH_GUARD: 3+ observations, 70%+ confidence, pattern in 2+ entities
- KEEP_EXPLORING: <3 observations or low confidence
"""

import logging
from dataclasses import dataclass
from typing import Dict, List, Any, Literal, Optional
from datetime import datetime

from backend.promotion.acceptance_criteria import AcceptanceCriteria
from backend.exploration.exploration_log import ExplorationReport

logger = logging.getLogger(__name__)


@dataclass
class PromotionDecision:
    """
    Promotion decision with rationale

    Attributes:
        action: PROMOTE | PROMOTE_WITH_GUARD | KEEP_EXPLORING
        confidence: Confidence in this decision (0.0-1.0)
        rationale: Explanation for decision
        promoted_patterns: List of patterns to promote
        guard_patterns: List of patterns to promote with guard
        rejected_patterns: List of patterns to keep exploring
        metadata: Additional decision context
    """
    action: Literal["PROMOTE", "PROMOTE_WITH_GUARD", "KEEP_EXPLORING"]
    confidence: float
    rationale: str
    promoted_patterns: List[str]
    guard_patterns: List[str]
    rejected_patterns: List[str]
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "action": self.action,
            "confidence": self.confidence,
            "rationale": self.rationale,
            "promoted_patterns": self.promoted_patterns,
            "guard_patterns": self.guard_patterns,
            "rejected_patterns": self.rejected_patterns,
            "metadata": self.metadata
        }


class PromotionEngine:
    """
    Ralph-governed promotion engine

    Enforces hard thresholds for promotion decisions.
    """

    def __init__(
        self,
        acceptance_criteria: Optional[AcceptanceCriteria] = None
    ):
        """
        Initialize promotion engine

        Args:
            acceptance_criteria: Optional custom criteria (uses defaults if not provided)
        """
        self.acceptance_criteria = acceptance_criteria or AcceptanceCriteria()

        logger.info(
            f"🚀 PromotionEngine initialized "
            f"(promote: {self.acceptance_criteria.MIN_OBSERVATIONS_PROMOTE}+ obs, "
            f"guard: {self.acceptance_criteria.MIN_OBSERVATIONS_GUARD}+ obs)"
        )

    async def evaluate_promotion(
        self,
        exploration_report: ExplorationReport,
        template: Dict[str, Any],
        ralph_validation: Optional[Dict[str, Any]] = None
    ) -> PromotionDecision:
        """
        Evaluate whether exploration results warrant promotion

        Args:
            exploration_report: Exploration results from coordinator
            template: Template metadata
            ralph_validation: Optional Ralph Loop validation results

        Returns:
            PromotionDecision with action and rationale
        """
        logger.info(
            f"🔍 Evaluating promotion for {exploration_report.template_id} "
            f"({exploration_report.total_observations} observations)"
        )

        # Extract metrics
        total_observations = exploration_report.total_observations
        average_confidence = exploration_report.average_confidence
        entities_with_pattern = exploration_report.entities_with_pattern
        entity_sample_size = exploration_report.entity_sample_size

        # Get repeatable patterns
        repeatable_patterns = exploration_report.get_repeatable_patterns(
            min_entities=self.acceptance_criteria.MIN_ENTITIES_FOR_PATTERN
        )

        # Apply acceptance criteria
        action = self.acceptance_criteria.evaluate(
            total_observations=total_observations,
            average_confidence=average_confidence,
            entities_with_pattern=entities_with_pattern,
            entity_sample_size=entity_sample_size
        )

        # Build rationale
        rationale = self._build_rationale(
            action=action,
            total_observations=total_observations,
            average_confidence=average_confidence,
            entities_with_pattern=entities_with_pattern,
            entity_sample_size=entity_sample_size,
            repeatable_patterns=repeatable_patterns
        )

        # Categorize patterns
        promoted_patterns = []
        guard_patterns = []
        rejected_patterns = []

        if action == "PROMOTE":
            promoted_patterns = repeatable_patterns

        elif action == "PROMOTE_WITH_GUARD":
            guard_patterns = repeatable_patterns

        else:  # KEEP_EXPLORING
            rejected_patterns = exploration_report.unique_patterns

        # Create decision
        decision = PromotionDecision(
            action=action,
            confidence=self._calculate_decision_confidence(
                action, average_confidence, len(repeatable_patterns)
            ),
            rationale=rationale,
            promoted_patterns=promoted_patterns,
            guard_patterns=guard_patterns,
            rejected_patterns=rejected_patterns,
            metadata={
                "total_observations": total_observations,
                "average_confidence": average_confidence,
                "entities_with_pattern": entities_with_pattern,
                "entity_sample_size": entity_sample_size,
                "repeatable_patterns": repeatable_patterns,
                "exploration_report_id": exploration_report.template_id,
                "evaluated_at": datetime.now().isoformat()
            }
        )

        logger.info(
            f"✅ Promotion decision: {action} "
            f"(confidence: {decision.confidence:.2%}, "
            f"patterns: {len(promoted_patterns) + len(guard_patterns)})"
        )

        return decision

    def _build_rationale(
        self,
        action: str,
        total_observations: int,
        average_confidence: float,
        entities_with_pattern: int,
        entity_sample_size: int,
        repeatable_patterns: List[str]
    ) -> str:
        """
        Build rationale for promotion decision

        Args:
            action: Promotion action
            total_observations: Total observations
            average_confidence: Average confidence
            entities_with_pattern: Entities showing pattern
            entity_sample_size: Total entities in sample
            repeatable_patterns: Patterns found in multiple entities

        Returns:
            Rationale string
        """
        entity_coverage = (
            entities_with_pattern / entity_sample_size
            if entity_sample_size > 0 else 0.0
        )

        if action == "PROMOTE":
            return (
                f"✅ PROMOTE: {total_observations} observations (threshold: {self.acceptance_criteria.MIN_OBSERVATIONS_PROMOTE}+), "
                f"{average_confidence:.1%} confidence (threshold: {self.acceptance_criteria.MIN_CONFIDENCE_PROMOTE:.1%}), "
                f"{entities_with_pattern}/{entity_sample_size} entities with pattern (threshold: {self.acceptance_criteria.MIN_ENTITIES_FOR_PATTERN}+), "
                f"{len(repeatable_patterns)} repeatable patterns"
            )

        elif action == "PROMOTE_WITH_GUARD":
            return (
                f"⚠️ PROMOTE_WITH_GUARD: {total_observations} observations (threshold: {self.acceptance_criteria.MIN_OBSERVATIONS_GUARD}+), "
                f"{average_confidence:.1%} confidence (threshold: {self.acceptance_criteria.MIN_CONFIDENCE_GUARD:.1%}), "
                f"{entities_with_pattern}/{entity_sample_size} entities with pattern, "
                f"{len(repeatable_patterns)} repeatable patterns. "
                f"Promote with guard: monitor performance closely"
            )

        else:  # KEEP_EXPLORING
            return (
                f"❌ KEEP_EXPLORING: {total_observations} observations (insufficient for guard threshold: {self.acceptance_criteria.MIN_OBSERVATIONS_GUARD}+), "
                f"{average_confidence:.1%} confidence, "
                f"{entities_with_pattern}/{entity_sample_size} entities with pattern. "
                f"Need more data before promotion"
            )

    def _calculate_decision_confidence(
        self,
        action: str,
        average_confidence: float,
        repeatable_count: int
    ) -> float:
        """
        Calculate confidence in promotion decision

        Args:
            action: Promotion action
            average_confidence: Average exploration confidence
            repeatable_count: Number of repeatable patterns

        Returns:
            Decision confidence (0.0-1.0)
        """
        if action == "PROMOTE":
            # High confidence for full promotion
            base = 0.9
            bonus = min(0.1, repeatable_count * 0.02)
            return base + bonus

        elif action == "PROMOTE_WITH_GUARD":
            # Moderate confidence for guard promotion
            base = 0.7
            bonus = min(0.1, repeatable_count * 0.03)
            return base + bonus

        else:  # KEEP_EXPLORING
            # Low confidence for keep exploring
            return 0.5


# =============================================================================
# Convenience Functions
# =============================================================================

async def evaluate_promotion(
    exploration_report: ExplorationReport,
    template: Dict[str, Any],
    acceptance_criteria: Optional[AcceptanceCriteria] = None
) -> PromotionDecision:
    """
    Convenience function to evaluate promotion

    Args:
        exploration_report: Exploration results
        template: Template metadata
        acceptance_criteria: Optional custom criteria

    Returns:
        PromotionDecision
    """
    engine = PromotionEngine(acceptance_criteria)
    return await engine.evaluate_promotion(exploration_report, template)
