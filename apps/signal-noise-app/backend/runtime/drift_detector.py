"""
Drift Detector

Automatic retirement detection for runtime bindings.

Drift signals:
- Success rate drops below 50% (over last 10 executions)
- Confidence adjustment < -0.3 (significant degradation)
- No signals found in 5 consecutive executions
- Entity domain changed (404 errors)

Retirement actions:
- 2+ signals → RETIRE (automatic)
- 1 signal → MONITOR (flag for review)
- 0 signals → HEALTHY (continue execution)
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Any, Optional, Literal
from datetime import datetime

from backend.template_runtime_binding import RuntimeBinding, RuntimeBindingCache

logger = logging.getLogger(__name__)


class DriftSignal(Enum):
    """Types of drift signals"""
    LOW_SUCCESS_RATE = "LOW_SUCCESS_RATE"
    """Success rate below 50% over last 10 executions"""

    NEGATIVE_CONFIDENCE = "NEGATIVE_CONFIDENCE"
    """Confidence adjustment < -0.3"""

    NO_SIGNALS_STREAK = "NO_SIGNALS_STREAK"
    """No signals found in 5 consecutive executions"""

    DOMAIN_CHANGED = "DOMAIN_CHANGED"
    """Entity domain changed (404 errors)"""


class RetirementAction(Enum):
    """Actions to take on drift detection"""
    RETIRE = "RETIRE"
    """Automatic retirement (2+ signals found historically)"""

    MONITOR = "MONITOR"
    """Flag for review (1 signal found historically)"""

    HEALTHY = "HEALTHY"
    """Continue execution (no drift or 0 signals historically)"""


@dataclass
class DriftDetectionResult:
    """
    Result from drift detection

    Attributes:
        entity_id: Entity identifier
        drift_detected: Whether drift was detected
        drift_signals: List of drift signals found
        recommended_action: RETIRE | MONITOR | HEALTHY
        rationale: Explanation for recommendation
        detected_at: ISO timestamp of detection
    """
    entity_id: str
    drift_detected: bool
    drift_signals: List[DriftSignal]
    recommended_action: RetirementAction
    rationale: str
    detected_at: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "entity_id": self.entity_id,
            "drift_detected": self.drift_detected,
            "drift_signals": [s.value for s in self.drift_signals],
            "recommended_action": self.recommended_action.value,
            "rationale": self.rationale,
            "detected_at": self.detected_at
        }


class DriftDetector:
    """
    Detects performance drift in runtime bindings

    Automatically retires bindings that show significant degradation.
    """

    def __init__(
        self,
        binding_cache: Optional[RuntimeBindingCache] = None,
        success_rate_threshold: float = 0.5,
        confidence_threshold: float = -0.3,
        no_signals_threshold: int = 5
    ):
        """
        Initialize drift detector

        Args:
            binding_cache: Optional binding cache
            success_rate_threshold: Success rate below this triggers drift (default: 0.5)
            confidence_threshold: Confidence below this triggers drift (default: -0.3)
            no_signals_threshold: Consecutive executions with no signals (default: 5)
        """
        self.binding_cache = binding_cache or RuntimeBindingCache()
        self.success_rate_threshold = success_rate_threshold
        self.confidence_threshold = confidence_threshold
        self.no_signals_threshold = no_signals_threshold

        logger.info(
            f"🔍 DriftDetector initialized "
            f"(success_rate<{success_rate_threshold:.1%}, "
            f"confidence<{confidence_threshold:+.1f}, "
            f"no_signals>={no_signals_threshold})"
        )

    def detect_drift(self, entity_id: str) -> Optional[DriftDetectionResult]:
        """
        Detect performance drift for binding

        Args:
            entity_id: Entity identifier

        Returns:
            DriftDetectionResult if binding found, None otherwise
        """
        binding = self.binding_cache.get_binding(entity_id)

        if not binding:
            logger.warning(f"⚠️ No binding found for {entity_id}")
            return None

        logger.debug(f"🔍 Detecting drift for {entity_id}")

        drift_signals = []

        # Check 1: Low success rate
        if binding.usage_count >= 10:
            if binding.success_rate < self.success_rate_threshold:
                drift_signals.append(DriftSignal.LOW_SUCCESS_RATE)
                logger.warning(
                    f"⚠️ Drift detected: {entity_id} success rate {binding.success_rate:.1%} "
                    f"< {self.success_rate_threshold:.1%}"
                )

        # Check 2: Negative confidence
        if binding.confidence_adjustment < self.confidence_threshold:
            drift_signals.append(DriftSignal.NEGATIVE_CONFIDENCE)
            logger.warning(
                f"⚠️ Drift detected: {entity_id} confidence {binding.confidence_adjustment:+.2f} "
                f"< {self.confidence_threshold:+.2f}"
            )

        # Check 3: No signals streak (would need tracking in binding)
        # TODO: Track consecutive no-signal executions in binding

        # Check 4: Domain changed (would need error tracking)
        # TODO: Track 404 errors in binding

        # Determine action
        if drift_signals:
            drift_detected = True
            recommended_action = self._determine_action(binding)
            rationale = self._build_rationale(drift_signals, binding)
        else:
            drift_detected = False
            recommended_action = RetirementAction.HEALTHY
            rationale = "No drift detected, binding is healthy"

        result = DriftDetectionResult(
            entity_id=entity_id,
            drift_detected=drift_detected,
            drift_signals=drift_signals,
            recommended_action=recommended_action,
            rationale=rationale,
            detected_at=datetime.now().isoformat()
        )

        logger.info(
            f"✅ Drift detection complete for {entity_id}: "
            f"drift={drift_detected}, action={recommended_action.value}"
        )

        return result

    def _determine_action(self, binding: RuntimeBinding) -> RetirementAction:
        """
        Determine retirement action based on historical performance

        Args:
            binding: Runtime binding to evaluate

        Returns:
            RetirementAction
        """
        # TODO: Track historical signal count in binding
        # For now, use simple heuristic based on usage and success rate

        if binding.usage_count >= 10 and binding.success_rate < 0.3:
            # Severe degradation: retire
            return RetirementAction.RETIRE
        elif binding.usage_count >= 5 and binding.success_rate < 0.5:
            # Moderate degradation: monitor
            return RetirementAction.MONITOR
        else:
            # Mild or no degradation: healthy
            return RetirementAction.HEALTHY

    def _build_rationale(
        self,
        drift_signals: List[DriftSignal],
        binding: RuntimeBinding
    ) -> str:
        """
        Build rationale for drift detection result

        Args:
            drift_signals: List of drift signals detected
            binding: Runtime binding

        Returns:
            Rationale string
        """
        signal_descriptions = []

        for signal in drift_signals:
            if signal == DriftSignal.LOW_SUCCESS_RATE:
                signal_descriptions.append(
                    f"Success rate {binding.success_rate:.1%} below threshold {self.success_rate_threshold:.1%}"
                )
            elif signal == DriftSignal.NEGATIVE_CONFIDENCE:
                signal_descriptions.append(
                    f"Confidence {binding.confidence_adjustment:+.2f} below threshold {self.confidence_threshold:+.2f}"
                )
            elif signal == DriftSignal.NO_SIGNALS_STREAK:
                signal_descriptions.append(
                    f"No signals found in {self.no_signals_threshold}+ consecutive executions"
                )
            elif signal == DriftSignal.DOMAIN_CHANGED:
                signal_descriptions.append(
                    "Entity domain changed (404 errors detected)"
                )

        if not signal_descriptions:
            return "No drift signals detected"

        return "; ".join(signal_descriptions)

    def execute_retirement(self, entity_id: str) -> bool:
        """
        Execute retirement action for binding

        Args:
            entity_id: Entity identifier

        Returns:
            True if retirement successful
        """
        # Detect drift first
        result = self.detect_drift(entity_id)

        if not result:
            logger.warning(f"⚠️ Cannot retire {entity_id}: binding not found")
            return False

        if result.recommended_action == RetirementAction.RETIRE:
            # Mark binding as retired
            binding = self.binding_cache.get_binding(entity_id)

            if binding:
                binding.state = "RETIRED"
                binding.retired_at = datetime.now().isoformat()

                self.binding_cache.set_binding(binding)

                logger.info(f"🗑️ Retired binding for {entity_id}")
                return True

        elif result.recommended_action == RetirementAction.MONITOR:
            # Mark binding for monitoring
            binding = self.binding_cache.get_binding(entity_id)

            if binding:
                # TODO: Add monitoring state to binding
                logger.warning(f"⚠️ Flagged {entity_id} for monitoring: {result.rationale}")

        return False


# =============================================================================
# Convenience Functions
# =============================================================================

def detect_drift(entity_id: str) -> Optional[DriftDetectionResult]:
    """
    Convenience function to detect drift

    Args:
        entity_id: Entity identifier

    Returns:
        DriftDetectionResult if found
    """
    detector = DriftDetector()
    return detector.detect_drift(entity_id)


def retire_if_drift_detected(entity_id: str) -> bool:
    """
    Convenience function to detect drift and retire if needed

    Args:
        entity_id: Entity identifier

    Returns:
        True if retired
    """
    detector = DriftDetector()
    result = detector.detect_drift(entity_id)

    if result and result.recommended_action == RetirementAction.RETIRE:
        return detector.execute_retirement(entity_id)

    return False
