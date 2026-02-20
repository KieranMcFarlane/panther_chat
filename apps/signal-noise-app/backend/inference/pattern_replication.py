"""
Pattern Replication Engine

Cross-entity pattern transfer with confidence discount.

Process:
1. Extract proven patterns from 7 explored entities
2. Group by pattern type (e.g., jobs board effectiveness)
3. Calculate statistics (success rate, confidence)
4. Apply to target entities with confidence discount (-0.1)
5. Validate with sample execution

Core principle: Learn from 7, apply to 3,393.
"""

import logging
from dataclasses import dataclass
from typing import Dict, List, Any, Optional
from datetime import datetime

from backend.template_runtime_binding import RuntimeBinding, RuntimeBindingCache
from backend.exploration.exploration_log import ExplorationReport

logger = logging.getLogger(__name__)


@dataclass
class ReplicatedPattern:
    """
    Pattern replicated from source to target entities

    Attributes:
        pattern_name: Name of pattern
        source_entities: Entities where pattern was discovered
        success_rate: Success rate in source entities
        confidence: Average confidence in source entities
        target_entities: Entities to apply pattern to
        confidence_discount: Discount applied to confidence (default: -0.1)
    """
    pattern_name: str
    source_entities: List[str]
    success_rate: float
    confidence: float
    target_entities: List[str]
    confidence_discount: float = -0.1

    @property
    def effective_confidence(self) -> float:
        """Get confidence after discount"""
        effective = self.confidence + self.confidence_discount
        return max(0.0, min(1.0, effective))


@dataclass
class ReplicationResult:
    """
    Result from pattern replication

    Attributes:
        pattern_name: Pattern that was replicated
        target_entity: Entity pattern was applied to
        success: Whether replication was successful
        signals_found: Number of signals found
        confidence_before: Confidence before replication
        confidence_after: Confidence after replication
        validated_at: ISO timestamp
    """
    pattern_name: str
    target_entity: str
    success: bool
    signals_found: int
    confidence_before: float
    confidence_after: float
    validated_at: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "pattern_name": self.pattern_name,
            "target_entity": self.target_entity,
            "success": self.success,
            "signals_found": self.signals_found,
            "confidence_before": self.confidence_before,
            "confidence_after": self.confidence_after,
            "validated_at": self.validated_at
        }


class PatternReplicationEngine:
    """
    Replicates patterns across entities in same cluster

    Enables learning from 7 entities to apply to 3,393.
    """

    def __init__(
        self,
        binding_cache: Optional[RuntimeBindingCache] = None,
        confidence_discount: float = -0.1
    ):
        """
        Initialize pattern replication engine

        Args:
            binding_cache: Optional binding cache
            confidence_discount: Confidence discount for replicated patterns (default: -0.1)
        """
        self.binding_cache = binding_cache or RuntimeBindingCache()
        self.confidence_discount = confidence_discount

        logger.info(
            f"🔁 PatternReplicationEngine initialized "
            f"(confidence_discount: {confidence_discount:+.1f})"
        )

    def extract_patterns_from_exploration(
        self,
        exploration_report: ExplorationReport
    ) -> List[ReplicatedPattern]:
        """
        Extract proven patterns from exploration report

        Args:
            exploration_report: Exploration results from 7 entities

        Returns:
            List of ReplicatedPattern to apply to other entities
        """
        logger.info(
            f"🔍 Extracting patterns from {exploration_report.template_id} "
            f"({exploration_report.total_observations} observations)"
        )

        patterns = []

        # Get repeatable patterns (found in 3+ entities)
        repeatable_patterns = exploration_report.get_repeatable_patterns(min_entities=3)

        for pattern_name in repeatable_patterns:
            # Calculate pattern statistics
            pattern_count = exploration_report.pattern_frequency.get(pattern_name, 0)
            pattern_confidence = exploration_report.average_confidence

            # Create replicated pattern
            pattern = ReplicatedPattern(
                pattern_name=pattern_name,
                source_entities=exploration_report.entity_sample,
                success_rate=exploration_report.entity_coverage,
                confidence=pattern_confidence,
                target_entities=[],  # Will be set during replication
                confidence_discount=self.confidence_discount
            )

            patterns.append(pattern)

        logger.info(f"✅ Extracted {len(patterns)} proven patterns")

        return patterns

    async def replicate_to_entities(
        self,
        patterns: List[ReplicatedPattern],
        target_entities: List[str],
        cluster_id: str,
        template_id: str
    ) -> List[ReplicationResult]:
        """
        Replicate patterns to target entities

        Args:
            patterns: Patterns to replicate
            target_entities: Entities to apply patterns to
            cluster_id: Cluster identifier
            template_id: Template identifier

        Returns:
            List of ReplicationResult
        """
        logger.info(
            f"🔁 Replicating {len(patterns)} patterns to "
            f"{len(target_entities)} target entities"
        )

        results = []

        for pattern in patterns:
            # Set target entities for this pattern
            pattern.target_entities = target_entities

            for entity_id in target_entities:
                logger.debug(
                    f"🔁 Replicating {pattern.pattern_name} to {entity_id} "
                    f"(confidence: {pattern.effective_confidence:.2f})"
                )

                # Get or create binding
                binding = self.binding_cache.get_binding(entity_id)

                if not binding:
                    # Create new binding for target entity
                    binding = RuntimeBinding(
                        template_id=template_id,
                        entity_id=entity_id,
                        entity_name=entity_id,  # TODO: Get actual entity name
                        discovered_domains=[],
                        discovered_channels={},
                        enriched_patterns={},
                        confidence_adjustment=pattern.confidence_discount,
                        state="EXPLORING"
                    )

                # Track confidence before
                confidence_before = binding.get_effective_confidence(pattern.confidence)

                # TODO: Validate with sample execution
                # This would use ExecutionEngine to test the pattern
                success = True  # Placeholder
                signals_found = 0  # Placeholder

                # Update binding if successful
                if success:
                    # Add enriched pattern
                    if pattern.pattern_name not in binding.enriched_patterns:
                        binding.enriched_patterns[pattern.pattern_name] = []

                    binding.enriched_patterns[pattern.pattern_name].append(
                        f"Replicated from {pattern.source_entities}"
                    )

                    # Apply confidence discount
                    binding.adjust_confidence(pattern.confidence_discount)

                    # Save binding
                    self.binding_cache.set_binding(binding)

                # Track confidence after
                confidence_after = binding.get_effective_confidence(pattern.confidence)

                # Create replication result
                result = ReplicationResult(
                    pattern_name=pattern.pattern_name,
                    target_entity=entity_id,
                    success=success,
                    signals_found=signals_found,
                    confidence_before=confidence_before,
                    confidence_after=confidence_after,
                    validated_at=datetime.now().isoformat()
                )

                results.append(result)

        # Log summary
        successful = len([r for r in results if r.success])
        logger.info(
            f"✅ Replication complete: {successful}/{len(results)} successful"
        )

        return results

    def get_replication_summary(
        self,
        results: List[ReplicationResult]
    ) -> Dict[str, Any]:
        """
        Get summary of replication results

        Args:
            results: Replication results

        Returns:
            Summary dictionary
        """
        total = len(results)
        successful = len([r for r in results if r.success])
        failed = total - successful

        total_signals = sum(r.signals_found for r in results)

        avg_confidence_delta = 0.0
        if results:
            confidence_delta_sum = sum(
                r.confidence_after - r.confidence_before
                for r in results
            )
            avg_confidence_delta = confidence_delta_sum / total

        return {
            "total_replications": total,
            "successful": successful,
            "failed": failed,
            "success_rate": successful / total if total > 0 else 0.0,
            "total_signals_found": total_signals,
            "average_confidence_delta": avg_confidence_delta
        }


# =============================================================================
# Convenience Functions
# =============================================================================

async def replicate_patterns(
    exploration_report: ExplorationReport,
    target_entities: List[str],
    cluster_id: str,
    template_id: str
) -> List[ReplicationResult]:
    """
    Convenience function to replicate patterns

    Args:
        exploration_report: Exploration results
        target_entities: Entities to replicate to
        cluster_id: Cluster identifier
        template_id: Template identifier

    Returns:
        List of ReplicationResult
    """
    engine = PatternReplicationEngine()

    # Extract patterns
    patterns = engine.extract_patterns_from_exploration(exploration_report)

    # Replicate to targets
    return await engine.replicate_to_entities(
        patterns=patterns,
        target_entities=target_entities,
        cluster_id=cluster_id,
        template_id=template_id
    )
