"""
Acceptance Criteria

Hard thresholds for promotion decisions.

These are NON-NEGOTIABLE thresholds that govern exploration → promotion decisions.

Thresholds:
- 5+ observations → PROMOTE (full promotion)
- 3+ observations → PROMOTE_WITH_GUARD (conditional promotion)
- <3 observations → KEEP_EXPLORING (insufficient data)
"""

from dataclasses import dataclass
from typing import Literal


@dataclass
class AcceptanceCriteria:
    """
    Hard acceptance thresholds for promotion

    Attributes:
        MIN_OBSERVATIONS_PROMOTE: Minimum observations for full promotion (default: 5)
        MIN_OBSERVATIONS_GUARD: Minimum observations for guard promotion (default: 3)
        MIN_CONFIDENCE_PROMOTE: Minimum confidence for full promotion (default: 0.8)
        MIN_CONFIDENCE_GUARD: Minimum confidence for guard promotion (default: 0.7)
        MIN_ENTITIES_FOR_PATTERN: Pattern must appear in >= 3 entities (default: 3)
        MIN_ENTITY_COVERAGE: Minimum % of entities with pattern (default: 0.3)
    """
    MIN_OBSERVATIONS_PROMOTE: int = 5
    """5+ observations across 7 entities → PROMOTE"""

    MIN_OBSERVATIONS_GUARD: int = 3
    """3+ observations across 7 entities → PROMOTE_WITH_GUARD"""

    MIN_CONFIDENCE_PROMOTE: float = 0.8
    """80% confidence for full promotion"""

    MIN_CONFIDENCE_GUARD: float = 0.7
    """70% confidence for guard promotion"""

    MIN_ENTITIES_FOR_PATTERN: int = 3
    """Pattern must appear in >= 3 of 7 entities"""

    MIN_ENTITY_COVERAGE: float = 0.3
    """Minimum 30% of entities must show pattern"""

    def evaluate(
        self,
        total_observations: int,
        average_confidence: float,
        entities_with_pattern: int,
        entity_sample_size: int
    ) -> Literal["PROMOTE", "PROMOTE_WITH_GUARD", "KEEP_EXPLORING"]:
        """
        Evaluate whether exploration meets promotion criteria

        Args:
            total_observations: Total observations across all entities
            average_confidence: Average confidence score (0.0-1.0)
            entities_with_pattern: Number of entities showing pattern
            entity_sample_size: Total entities in sample (default: 7)

        Returns:
            Promotion decision: PROMOTE | PROMOTE_WITH_GUARD | KEEP_EXPLORING
        """
        # Calculate entity coverage
        entity_coverage = entities_with_pattern / entity_sample_size if entity_sample_size > 0 else 0.0

        # Check observation thresholds
        if total_observations >= self.MIN_OBSERVATIONS_PROMOTE:
            # Full promotion path
            if (
                average_confidence >= self.MIN_CONFIDENCE_PROMOTE and
                entities_with_pattern >= self.MIN_ENTITIES_FOR_PATTERN and
                entity_coverage >= self.MIN_ENTITY_COVERAGE
            ):
                return "PROMOTE"
            elif (
                average_confidence >= self.MIN_CONFIDENCE_GUARD and
                entities_with_pattern >= 2  # Slightly relaxed for guard
            ):
                return "PROMOTE_WITH_GUARD"

        elif total_observations >= self.MIN_OBSERVATIONS_GUARD:
            # Guard promotion path
            if (
                average_confidence >= self.MIN_CONFIDENCE_GUARD and
                entities_with_pattern >= 2
            ):
                return "PROMOTE_WITH_GUARD"

        # Default: keep exploring
        return "KEEP_EXPLORING"


# Default acceptance criteria instance
DEFAULT_ACCEPTANCE_CRITERIA = AcceptanceCriteria()
