#!/usr/bin/env python3
"""
Ralph Loop Governor - Real-time governance for exploration

Validates exploration decisions during execution (not just post-processing):
- Validates evidence + confidence with Ralph Loop API
- Returns decision: CONTINUE, STOP, or LOCK_IN
- Adjusts confidence using fixed math (no drift)
- Category saturation: 3 consecutive REJECTs → skip category
- Early stop: Confidence gain < 0.01 over 10 iterations → stop immediately

Author: Claude Code
Date: 2026-01-30
"""

import logging
import asyncio
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
import httpx

logger = logging.getLogger(__name__)


# =============================================================================
# FIXED CONSTANTS (NO DRIFT)
# =============================================================================

START_CONFIDENCE = 0.20
MAX_CONFIDENCE = 0.95
MIN_CONFIDENCE = 0.05

ACCEPT_DELTA = +0.06
WEAK_ACCEPT_DELTA = +0.02
REJECT_DELTA = 0.00


# =============================================================================
# RALPH DECISION TYPES
# =============================================================================

class RalphDecision(Enum):
    """Ralph Loop validation decision"""
    ACCEPT = "ACCEPT"
    WEAK_ACCEPT = "WEAK_ACCEPT"
    REJECT = "REJECT"


class ExplorationAction(Enum):
    """Action to take after Ralph Loop validation"""
    CONTINUE = "CONTINUE"  # Continue exploration
    STOP = "STOP"          # Stop exploration (budget exhausted, etc.)
    LOCK_IN = "LOCK_IN"    # Lock in pattern (high confidence, write to store)


@dataclass
class RalphValidationResult:
    """
    Result from Ralph Loop validation

    Attributes:
        decision: Ralph decision (ACCEPT/WEAK_ACCEPT/REJECT)
        action: Action to take (CONTINUE/STOP/LOCK_IN)
        confidence_adjustment: Delta to apply to confidence
        new_confidence: Updated confidence value
        category_saturated: Whether category is saturated (3 REJECTs)
        confidence_saturated: Whether confidence is saturated (<0.01 gain over 10)
        justification: Human-readable justification
        raw_response: Raw Ralph Loop API response
    """
    decision: RalphDecision
    action: ExplorationAction
    confidence_adjustment: float
    new_confidence: float
    category_saturated: bool
    confidence_saturated: bool
    justification: str
    raw_response: Optional[Dict[str, Any]] = None


class RalphLoopGovernor:
    """
    Ralph Loop Governor for real-time exploration governance

    Validates exploration decisions during execution:
    1. Calls Ralph Loop API after each category iteration
    2. Returns decision (CONTINUE/STOP/LOCK_IN)
    3. Adjusts confidence using fixed math
    4. Tracks category saturation (3 consecutive REJECTs)
    5. Tracks confidence saturation (<0.01 gain over 10 iterations)

    Usage:
        governor = RalphLoopGovernor(api_url="http://localhost:8001")

        result = await governor.validate_exploration_decision(
            entity_name="Arsenal FC",
            category="Digital Infrastructure",
            evidence="CRM Manager hiring",
            current_confidence=0.75,
            source_url="https://arsenal.com/jobs"
        )

        if result.action == ExplorationAction.CONTINUE:
            print("Continue exploration")
        elif result.action == ExplorationAction.LOCK_IN:
            print("Lock in pattern")
    """

    def __init__(
        self,
        api_url: str = "http://localhost:8001",
        timeout_seconds: int = 30,
        max_retries: int = 3
    ):
        """
        Initialize Ralph Loop Governor

        Args:
            api_url: Ralph Loop API base URL
            timeout_seconds: Request timeout
            max_retries: Max retry attempts
        """
        self.api_url = api_url.rstrip("/")
        self.timeout = timeout_seconds
        self.max_retries = max_retries

        # Track state
        self.category_reject_streaks: Dict[str, int] = {}
        self.confidence_history: List[float] = []

        logger.info(f"🔁 RalphLoopGovernor initialized (API: {self.api_url})")

    async def validate_exploration_decision(
        self,
        entity_name: str,
        category: str,
        evidence: str,
        current_confidence: float,
        source_url: str,
        previous_evidences: Optional[List[str]] = None
    ) -> RalphValidationResult:
        """
        Validate exploration decision with Ralph Loop

        Args:
            entity_name: Entity being explored
            category: Category being explored
            evidence: Evidence found
            current_confidence: Current confidence score
            source_url: Source URL
            previous_evidences: List of previous evidence texts

        Returns:
            RalphValidationResult with decision and action
        """
        logger.debug(f"🔁 Validating {category} for {entity_name}")

        # Call Ralph Loop API
        try:
            ralph_decision, justification = await self._call_ralph_loop_api(
                entity_name=entity_name,
                category=category,
                evidence=evidence,
                current_confidence=current_confidence,
                source_url=source_url,
                previous_evidences=previous_evidences or []
            )
        except Exception as e:
            logger.error(f"❌ Ralph Loop API call failed: {e}")
            # Fail open: continue with no adjustment
            return RalphValidationResult(
                decision=RalphDecision.WEAK_ACCEPT,
                action=ExplorationAction.CONTINUE,
                confidence_adjustment=0.0,
                new_confidence=current_confidence,
                category_saturated=False,
                confidence_saturated=False,
                justification=f"Ralph Loop API unavailable: {str(e)}",
                raw_response=None
            )

        # Calculate confidence adjustment
        raw_delta, category_multiplier, applied_delta = self._calculate_confidence_adjustment(
            decision=ralph_decision,
            category=category
        )

        # Update confidence
        new_confidence = self._apply_confidence_adjustment(
            current_confidence=current_confidence,
            applied_delta=applied_delta
        )

        # Track category rejection streak
        if ralph_decision == RalphDecision.REJECT:
            self.category_reject_streaks[category] = self.category_reject_streaks.get(category, 0) + 1
        else:
            self.category_reject_streaks[category] = 0

        category_saturated = self.category_reject_streaks.get(category, 0) >= 3

        # Track confidence history for saturation check
        self.confidence_history.append(new_confidence)
        confidence_saturated = self._check_confidence_saturation()

        # Determine action
        action = self._determine_action(
            decision=ralph_decision,
            new_confidence=new_confidence,
            category_saturated=category_saturated,
            confidence_saturated=confidence_saturated
        )

        # Build result
        result = RalphValidationResult(
            decision=ralph_decision,
            action=action,
            confidence_adjustment=applied_delta,
            new_confidence=new_confidence,
            category_saturated=category_saturated,
            confidence_saturated=confidence_saturated,
            justification=justification,
            raw_response=None
        )

        logger.info(
            f"🔁 Ralph Loop: {ralph_decision.value} | "
            f"Confidence: {current_confidence:.3f} → {new_confidence:.3f} | "
            f"Action: {action.value}"
        )

        return result

    async def _call_ralph_loop_api(
        self,
        entity_name: str,
        category: str,
        evidence: str,
        current_confidence: float,
        source_url: str,
        previous_evidences: List[str]
    ) -> tuple[RalphDecision, str]:
        """
        Call Ralph Loop API for validation

        Args:
            entity_name: Entity being explored
            category: Category being explored
            evidence: Evidence found
            current_confidence: Current confidence
            source_url: Source URL
            previous_evidences: Previous evidences

        Returns:
            (RalphDecision, justification)
        """
        # Prepare request payload
        payload = {
            "entity_name": entity_name,
            "category": category,
            "evidence": evidence,
            "current_confidence": current_confidence,
            "source_url": source_url,
            "previous_evidences": previous_evidences[:10]  # Send last 10 for context
        }

        # Call API with retry
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for attempt in range(self.max_retries):
                try:
                    response = await client.post(
                        f"{self.api_url}/api/validate-exploration",
                        json=payload
                    )
                    response.raise_for_status()

                    data = response.json()

                    # Parse decision
                    decision_str = data.get("decision", "WEAK_ACCEPT").upper()
                    decision = RalphDecision[decision_str]

                    justification = data.get("justification", "No justification provided")

                    return decision, justification

                except httpx.HTTPStatusError as e:
                    logger.warning(f"⚠️ Ralph Loop API HTTP error (attempt {attempt+1}/{self.max_retries}): {e}")
                    if attempt == self.max_retries - 1:
                        raise
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff

                except Exception as e:
                    logger.warning(f"⚠️ Ralph Loop API error (attempt {attempt+1}/{self.max_retries}): {e}")
                    if attempt == self.max_retries - 1:
                        raise
                    await asyncio.sleep(2 ** attempt)

        # Should not reach here
        raise RuntimeError("Failed to call Ralph Loop API after max retries")

    def _calculate_confidence_adjustment(
        self,
        decision: RalphDecision,
        category: str
    ) -> tuple[float, float, float]:
        """
        Calculate confidence adjustment with fixed math (no drift)

        Args:
            decision: Ralph decision
            category: Category being explored

        Returns:
            (raw_delta, category_multiplier, applied_delta)
        """
        # Get raw delta
        if decision == RalphDecision.ACCEPT:
            raw_delta = ACCEPT_DELTA
        elif decision == RalphDecision.WEAK_ACCEPT:
            raw_delta = WEAK_ACCEPT_DELTA
        else:  # REJECT
            raw_delta = REJECT_DELTA

        # Calculate category multiplier
        # Note: In full implementation, we'd track accepted_signals_per_category
        # For now, use default multiplier
        category_multiplier = 1.0  # 1 / (1 + accepted_signals_in_category)

        # Calculate applied delta
        applied_delta = raw_delta * category_multiplier

        return raw_delta, category_multiplier, applied_delta

    def _apply_confidence_adjustment(
        self,
        current_confidence: float,
        applied_delta: float
    ) -> float:
        """
        Apply confidence adjustment with clamping

        Args:
            current_confidence: Current confidence
            applied_delta: Delta to apply

        Returns:
            New confidence (clamped to [MIN_CONFIDENCE, MAX_CONFIDENCE])
        """
        new_confidence = current_confidence + applied_delta
        return max(MIN_CONFIDENCE, min(MAX_CONFIDENCE, new_confidence))

    def _check_confidence_saturation(self) -> bool:
        """
        Check if confidence is saturated

        Confidence increases by < 0.01 over 10 iterations → CONFIDENCE_SATURATED

        Returns:
            True if saturated
        """
        if len(self.confidence_history) < 10:
            return False

        recent_10 = self.confidence_history[-10:]
        increase = recent_10[-1] - recent_10[0]

        return increase < 0.01

    def _determine_action(
        self,
        decision: RalphDecision,
        new_confidence: float,
        category_saturated: bool,
        confidence_saturated: bool
    ) -> ExplorationAction:
        """
        Determine action based on decision and state

        Args:
            decision: Ralph decision
            new_confidence: New confidence value
            category_saturated: Whether category is saturated
            confidence_saturated: Whether confidence is saturated

        Returns:
            ExplorationAction to take
        """
        # Check saturation conditions first
        if category_saturated:
            return ExplorationAction.STOP  # Skip this category

        if confidence_saturated:
            return ExplorationAction.STOP  # Stop exploration entirely

        # High confidence: lock in
        if new_confidence >= 0.85:
            return ExplorationAction.LOCK_IN

        # Low confidence with REJECT: stop this category
        if decision == RalphDecision.REJECT and new_confidence < 0.50:
            return ExplorationAction.STOP

        # Otherwise: continue
        return ExplorationAction.CONTINUE

    async def lock_in_pattern(
        self,
        entity_name: str,
        category: str,
        evidence: List[str],
        final_confidence: float,
        patterns_found: List[str]
    ) -> bool:
        """
        Lock in validated pattern (write to evidence store)

        Args:
            entity_name: Entity being explored
            category: Category explored
            evidence: List of evidence items
            final_confidence: Final confidence score
            patterns_found: Patterns discovered

        Returns:
            True if pattern locked in successfully
        """
        logger.info(f"🔒 Locking in pattern for {entity_name} in {category}")

        # TODO: Implement evidence store write
        # For now, just log
        logger.info(f"  Entity: {entity_name}")
        logger.info(f"  Category: {category}")
        logger.info(f"  Evidence: {len(evidence)} items")
        logger.info(f"  Final Confidence: {final_confidence:.3f}")
        logger.info(f"  Patterns: {patterns_found}")

        return True

    def reset_state(self):
        """Reset governor state (for new entity exploration)"""
        self.category_reject_streaks.clear()
        self.confidence_history.clear()

        logger.debug("🔁 RalphLoopGovernor state reset")


# =============================================================================
# Convenience Functions
# =============================================================================

async def validate_with_ralph_loop(
    entity_name: str,
    category: str,
    evidence: str,
    current_confidence: float,
    source_url: str,
    api_url: str = "http://localhost:8001"
) -> RalphValidationResult:
    """
    Convenience function to validate with Ralph Loop

    Args:
        entity_name: Entity being explored
        category: Category being explored
        evidence: Evidence found
        current_confidence: Current confidence
        source_url: Source URL
        api_url: Ralph Loop API URL

    Returns:
        RalphValidationResult
    """
    governor = RalphLoopGovernor(api_url=api_url)
    return await governor.validate_exploration_decision(
        entity_name=entity_name,
        category=category,
        evidence=evidence,
        current_confidence=current_confidence,
        source_url=source_url
    )


if __name__ == "__main__":
    # Test Ralph Loop Governor
    import asyncio

    async def test():
        governor = RalphLoopGovernor(api_url="http://localhost:8001")

        result = await governor.validate_exploration_decision(
            entity_name="Arsenal FC",
            category="Digital Infrastructure & Stack",
            evidence="Looking for CRM Manager to lead digital transformation",
            current_confidence=0.75,
            source_url="https://arsenal.com/jobs/crm-manager"
        )

        print(f"\nDecision: {result.decision.value}")
        print(f"Action: {result.action.value}")
        print(f"Confidence: {result.new_confidence:.3f}")
        print(f"Justification: {result.justification}")
        print(f"Category Saturated: {result.category_saturated}")
        print(f"Confidence Saturated: {result.confidence_saturated}")

    asyncio.run(test())
