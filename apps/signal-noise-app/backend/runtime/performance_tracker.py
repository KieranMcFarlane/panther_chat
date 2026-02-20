"""
Performance Tracker

Confidence adjustment tracking for runtime bindings.

Tracks:
- Usage count (how many times binding executed)
- Success rate (successful executions / total executions)
- Confidence adjustment (learned bias from -0.15 to +0.15)
- Moving average with decay factor (alpha=0.1)

Core principle: Bindings learn locally from performance.
"""

import logging
from dataclasses import dataclass
from typing import Dict, List, Any, Optional
from datetime import datetime

from backend.template_runtime_binding import RuntimeBinding, RuntimeBindingCache

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """
    Performance metrics for a binding

    Attributes:
        entity_id: Entity identifier
        template_id: Template identifier
        usage_count: Total executions
        successful_uses: Successful executions
        failed_uses: Failed executions
        success_rate: Success rate (0.0 to 1.0)
        confidence_adjustment: Learned bias (-1.0 to 1.0)
        last_execution: ISO timestamp of last execution
        last_success: ISO timestamp of last success
        last_failure: ISO timestamp of last failure
        trend: Performance trend (improving, stable, declining)
    """
    entity_id: str
    template_id: str
    usage_count: int
    successful_uses: int
    failed_uses: int
    success_rate: float
    confidence_adjustment: float
    last_execution: Optional[str]
    last_success: Optional[str]
    last_failure: Optional[str]
    trend: str = "stable"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "entity_id": self.entity_id,
            "template_id": self.template_id,
            "usage_count": self.usage_count,
            "successful_uses": self.successful_uses,
            "failed_uses": self.failed_uses,
            "success_rate": self.success_rate,
            "confidence_adjustment": self.confidence_adjustment,
            "last_execution": self.last_execution,
            "last_success": self.last_success,
            "last_failure": self.last_failure,
            "trend": self.trend
        }


class PerformanceTracker:
    """
    Tracks and adjusts binding performance

    Provides:
    - Usage tracking
    - Success rate calculation
    - Confidence adjustment
    - Trend detection
    """

    def __init__(self, binding_cache: Optional[RuntimeBindingCache] = None):
        """
        Initialize performance tracker

        Args:
            binding_cache: Optional binding cache
        """
        self.binding_cache = binding_cache or RuntimeBindingCache()

        logger.info("📊 PerformanceTracker initialized")

    def record_execution(
        self,
        entity_id: str,
        success: bool,
        signals_found: int = 0
    ) -> Optional[RuntimeBinding]:
        """
        Record execution and update binding performance

        Args:
            entity_id: Entity identifier
            success: Whether execution was successful
            signals_found: Number of signals found

        Returns:
            Updated RuntimeBinding if found, None otherwise
        """
        binding = self.binding_cache.get_binding(entity_id)

        if not binding:
            logger.warning(f"⚠️ No binding found for {entity_id}")
            return None

        # Mark as used (updates usage count and success rate)
        binding.mark_used(success=success)

        # Adjust confidence based on performance
        self._adjust_confidence(binding, success, signals_found)

        # Save updated binding
        self.binding_cache.set_binding(binding)

        logger.info(
            f"📊 Recorded execution for {entity_id}: "
            f"success={success}, "
            f"usage_count={binding.usage_count}, "
            f"success_rate={binding.success_rate:.2%}, "
            f"confidence_adjustment={binding.confidence_adjustment:+.2f}"
        )

        return binding

    def _adjust_confidence(
        self,
        binding: RuntimeBinding,
        success: bool,
        signals_found: int
    ):
        """
        Adjust confidence based on performance

        Args:
            binding: Runtime binding to adjust
            success: Whether execution was successful
            signals_found: Number of signals found
        """
        # Base adjustment
        if success and signals_found > 0:
            # Success with signals: boost confidence
            adjustment = 0.1  # Max boost per execution
        elif success:
            # Success but no signals: small boost
            adjustment = 0.05
        else:
            # Failure: reduce confidence
            adjustment = -0.05

        # Apply adjustment with bounds
        binding.adjust_confidence(adjustment, max_adjustment=0.15)

    def get_metrics(self, entity_id: str) -> Optional[PerformanceMetrics]:
        """
        Get performance metrics for binding

        Args:
            entity_id: Entity identifier

        Returns:
            PerformanceMetrics if binding found, None otherwise
        """
        binding = self.binding_cache.get_binding(entity_id)

        if not binding:
            return None

        # Calculate trend
        trend = self._calculate_trend(binding)

        return PerformanceMetrics(
            entity_id=binding.entity_id,
            template_id=binding.template_id,
            usage_count=binding.usage_count,
            successful_uses=int(binding.usage_count * binding.success_rate),
            failed_uses=int(binding.usage_count * (1 - binding.success_rate)),
            success_rate=binding.success_rate,
            confidence_adjustment=binding.confidence_adjustment,
            last_execution=binding.last_used,
            trend=trend
        )

    def _calculate_trend(self, binding: RuntimeBinding) -> str:
        """
        Calculate performance trend

        Args:
            binding: Runtime binding

        Returns:
            Trend: improving | stable | declining
        """
        if binding.usage_count < 5:
            return "stable"  # Not enough data

        # Simple trend: compare recent success rate to overall
        # For more sophisticated analysis, could use sliding window
        if binding.success_rate >= 0.8:
            return "improving"
        elif binding.success_rate <= 0.5:
            return "declining"
        else:
            return "stable"

    def get_top_performers(
        self,
        template_id: Optional[str] = None,
        limit: int = 10
    ) -> List[PerformanceMetrics]:
        """
        Get top-performing bindings

        Args:
            template_id: Optional template filter
            limit: Maximum results

        Returns:
            List of PerformanceMetrics sorted by success rate
        """
        bindings = self.binding_cache.list_bindings(template_id=template_id)

        metrics = [
            self.get_metrics(b.entity_id)
            for b in bindings
            if self.get_metrics(b.entity_id)
        ]

        # Sort by success rate descending
        metrics.sort(key=lambda m: m.success_rate, reverse=True)

        return metrics[:limit]

    def get_underperformers(
        self,
        template_id: Optional[str] = None,
        min_usage_count: int = 5,
        limit: int = 10
    ) -> List[PerformanceMetrics]:
        """
        Get underperforming bindings

        Args:
            template_id: Optional template filter
            min_usage_count: Minimum usage count to consider
            limit: Maximum results

        Returns:
            List of PerformanceMetrics sorted by success rate ascending
        """
        bindings = self.binding_cache.list_bindings(template_id=template_id)

        metrics = [
            self.get_metrics(b.entity_id)
            for b in bindings
            if self.get_metrics(b.entity_id)
            and b.usage_count >= min_usage_count
        ]

        # Sort by success rate ascending (worst first)
        metrics.sort(key=lambda m: m.success_rate)

        return metrics[:limit]


# =============================================================================
# Convenience Functions
# =============================================================================

def record_performance(
    entity_id: str,
    success: bool,
    signals_found: int = 0
) -> Optional[RuntimeBinding]:
    """
    Convenience function to record performance

    Args:
        entity_id: Entity identifier
        success: Whether execution was successful
        signals_found: Number of signals found

    Returns:
        Updated RuntimeBinding if found
    """
    tracker = PerformanceTracker()
    return tracker.record_execution(entity_id, success, signals_found)


def get_performance_metrics(entity_id: str) -> Optional[PerformanceMetrics]:
    """
    Convenience function to get performance metrics

    Args:
        entity_id: Entity identifier

    Returns:
        PerformanceMetrics if found
    """
    tracker = PerformanceTracker()
    return tracker.get_metrics(entity_id)
