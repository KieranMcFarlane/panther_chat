#!/usr/bin/env python3
"""
Binding Feedback Processor

Closes the feedback loop by updating runtime bindings based on:
1. RFP outcomes (won/lost/false_positive) - high weight
2. Ralph Loop validations (validated/rejected) - low weight

Core principle: Dual-weighted feedback
- Human-recorded outcomes: ±0.10 to ±0.20 (high confidence)
- Automated validations: ±0.02 to ±0.03 (low confidence)

Usage:
    from backend.binding_feedback_processor import BindingFeedbackProcessor
    
    processor = BindingFeedbackProcessor()
    
    # Process RFP outcome
    await processor.process_outcome_feedback(
        rfp_id="arsenal-crm-001",
        entity_id="arsenal",
        outcome="won",
        pattern_id="CRM platform upgrade"
    )
    
    # Process Ralph Loop validation
    await processor.process_ralph_loop_feedback(
        entity_id="arsenal",
        signal_id="signal-123",
        pattern_id="CRM platform upgrade",
        validation_result="validated"
    )
"""

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class PatternFeedback:
    """Single feedback event for a pattern"""
    timestamp: str
    source: str  # "outcome" | "ralph_loop"
    adjustment: float
    confidence_before: float
    confidence_after: float
    metadata: Dict[str, Any]


@dataclass
class FeedbackResult:
    """Result from feedback processing"""
    success: bool
    entity_id: str
    binding_updated: bool
    confidence_delta: float
    new_confidence: float
    lifecycle_transition: Optional[str] = None
    rediscovery_triggered: bool = False
    error: Optional[str] = None


class BindingFeedbackProcessor:
    """
    Processes RFP outcomes and Ralph Loop validations into binding updates.
    
    Key features:
    - Dual-weighted feedback (outcome = 1.0x, ralph_loop = 0.2x)
    - Pattern-level confidence adjustments
    - Lifecycle state transitions
    - Feedback history tracking
    - Re-discovery triggering for degraded bindings
    """
    
    # Confidence adjustment weights
    OUTCOME_WIN_MIN = 0.10
    OUTCOME_WIN_MAX = 0.15
    OUTCOME_LOSS_MIN = -0.10
    OUTCOME_LOSS_MAX = -0.05
    OUTCOME_FALSE_POSITIVE_MIN = -0.20
    OUTCOME_FALSE_POSITIVE_MAX = -0.15
    
    RALPH_LOOP_VALIDATED = 0.02
    RALPH_LOOP_REJECTED = -0.03
    
    # Lifecycle thresholds
    PROMOTION_MIN_USAGE = 3
    PROMOTION_MIN_SUCCESS_RATE = 0.65
    RETIREMENT_MAX_CONFIDENCE = 0.35
    RETIREMENT_MIN_SUCCESS_RATE = 0.35
    
    # Re-discovery triggers
    REDISCOVERY_CONFIDENCE_THRESHOLD = 0.40
    REDISCOVERY_AGE_DAYS = 90
    
    def __init__(
        self,
        bindings_dir: Optional[Path] = None,
        feedback_log_path: Optional[Path] = None,
        rediscovery_queue_dir: Optional[Path] = None
    ):
        """
        Initialize feedback processor
        
        Args:
            bindings_dir: Directory containing runtime bindings
            feedback_log_path: Path to feedback log (JSONL)
            rediscovery_queue_dir: Directory for rediscovery queue
        """
        self.bindings_dir = bindings_dir or Path("data/runtime_bindings")
        self.feedback_log_path = feedback_log_path or Path("data/feedback_history.jsonl")
        self.rediscovery_queue_dir = rediscovery_queue_dir or Path("data/rediscovery_queue")
        
        # Create directories if needed
        self.bindings_dir.mkdir(parents=True, exist_ok=True)
        self.feedback_log_path.parent.mkdir(parents=True, exist_ok=True)
        self.rediscovery_queue_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info("✅ BindingFeedbackProcessor initialized")
        logger.info(f"   Bindings dir: {self.bindings_dir}")
        logger.info(f"   Feedback log: {self.feedback_log_path}")
        logger.info(f"   Rediscovery queue: {self.rediscovery_queue_dir}")
    
    async def process_outcome_feedback(
        self,
        rfp_id: str,
        entity_id: str,
        outcome: str,  # "won" | "lost" | "false_positive"
        pattern_id: Optional[str] = None,
        value_actual: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> FeedbackResult:
        """
        Process human-recorded RFP outcome
        
        Confidence adjustments:
        - won: +0.10 to +0.15 (boost pattern that led to win)
        - lost: -0.10 to -0.05 (mild penalty)
        - false_positive: -0.20 to -0.15 (strong penalty)
        
        Args:
            rfp_id: RFP identifier
            entity_id: Entity identifier
            outcome: Outcome type ("won" | "lost" | "false_positive")
            pattern_id: Pattern identifier (if known)
            value_actual: Actual RFP value (for won outcomes)
            metadata: Additional context
        
        Returns:
            FeedbackResult with update status
        """
        logger.info(f"📊 Processing outcome feedback: {rfp_id} = {outcome}")
        
        try:
            # Load binding
            binding = self._load_binding(entity_id)
            if not binding:
                return FeedbackResult(
                    success=False,
                    entity_id=entity_id,
                    binding_updated=False,
                    confidence_delta=0.0,
                    new_confidence=0.0,
                    error="Binding not found"
                )
            
            # Determine adjustment based on outcome
            if outcome == "won":
                adjustment = self._calculate_win_adjustment(value_actual)
            elif outcome == "lost":
                adjustment = self._calculate_loss_adjustment()
            elif outcome == "false_positive":
                adjustment = self._calculate_false_positive_adjustment()
            else:
                return FeedbackResult(
                    success=False,
                    entity_id=entity_id,
                    binding_updated=False,
                    confidence_delta=0.0,
                    new_confidence=0.0,
                    error=f"Unknown outcome type: {outcome}"
                )
            
            # Apply feedback
            result = await self._apply_feedback(
                binding=binding,
                adjustment=adjustment,
                source="outcome",
                pattern_id=pattern_id,
                metadata={
                    "rfp_id": rfp_id,
                    "outcome": outcome,
                    "value_actual": value_actual,
                    **(metadata or {})
                }
            )
            
            logger.info(
                f"✅ Outcome feedback applied: {entity_id} "
                f"({adjustment:+.2f} → {result.new_confidence:.2f})"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Failed to process outcome feedback: {e}")
            return FeedbackResult(
                success=False,
                entity_id=entity_id,
                binding_updated=False,
                confidence_delta=0.0,
                new_confidence=0.0,
                error=str(e)
            )
    
    async def process_ralph_loop_feedback(
        self,
        entity_id: str,
        signal_id: str,
        pattern_id: str,
        validation_result: str,  # "validated" | "rejected"
        confidence: float,
        metadata: Optional[Dict[str, Any]] = None
    ) -> FeedbackResult:
        """
        Process automated Ralph Loop validation
        
        Confidence adjustments:
        - validated: +0.02 (mild boost)
        - rejected: -0.03 (mild penalty)
        
        Args:
            entity_id: Entity identifier
            signal_id: Signal identifier
            pattern_id: Pattern identifier
            validation_result: Validation result ("validated" | "rejected")
            confidence: Validation confidence score
            metadata: Additional context
        
        Returns:
            FeedbackResult with update status
        """
        logger.info(f"🔍 Processing Ralph Loop feedback: {signal_id} = {validation_result}")
        
        try:
            # Load binding
            binding = self._load_binding(entity_id)
            if not binding:
                return FeedbackResult(
                    success=False,
                    entity_id=entity_id,
                    binding_updated=False,
                    confidence_delta=0.0,
                    new_confidence=0.0,
                    error="Binding not found"
                )
            
            # Determine adjustment based on validation result
            if validation_result == "validated":
                adjustment = self.RALPH_LOOP_VALIDATED
            elif validation_result == "rejected":
                adjustment = self.RALPH_LOOP_REJECTED
            else:
                return FeedbackResult(
                    success=False,
                    entity_id=entity_id,
                    binding_updated=False,
                    confidence_delta=0.0,
                    new_confidence=0.0,
                    error=f"Unknown validation result: {validation_result}"
                )
            
            # Apply feedback
            result = await self._apply_feedback(
                binding=binding,
                adjustment=adjustment,
                source="ralph_loop",
                pattern_id=pattern_id,
                metadata={
                    "signal_id": signal_id,
                    "validation_result": validation_result,
                    "validation_confidence": confidence,
                    **(metadata or {})
                }
            )
            
            logger.info(
                f"✅ Ralph Loop feedback applied: {entity_id} "
                f"({adjustment:+.2f} → {result.new_confidence:.2f})"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Failed to process Ralph Loop feedback: {e}")
            return FeedbackResult(
                success=False,
                entity_id=entity_id,
                binding_updated=False,
                confidence_delta=0.0,
                new_confidence=0.0,
                error=str(e)
            )
    
    async def _apply_feedback(
        self,
        binding: Dict[str, Any],
        adjustment: float,
        source: str,
        pattern_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> FeedbackResult:
        """
        Apply feedback adjustment to binding
        
        Args:
            binding: Runtime binding dict
            adjustment: Confidence adjustment
            source: Feedback source ("outcome" | "ralph_loop")
            pattern_id: Pattern identifier (if specific pattern)
            metadata: Additional context
        
        Returns:
            FeedbackResult
        """
        entity_id = binding["entity_id"]
        
        # Track confidence before
        confidence_before = self._get_binding_confidence(binding, pattern_id)
        
        # Apply adjustment to pattern or overall binding
        if pattern_id and "patterns" in binding:
            # Pattern-level adjustment
            if pattern_id in binding["patterns"]:
                binding["patterns"][pattern_id]["confidence"] = max(
                    0.0,
                    min(1.0, binding["patterns"][pattern_id]["confidence"] + adjustment)
                )
                
                # Add feedback history to pattern
                if "feedback_history" not in binding["patterns"][pattern_id]:
                    binding["patterns"][pattern_id]["feedback_history"] = []
                
                binding["patterns"][pattern_id]["feedback_history"].append({
                    "timestamp": datetime.now().isoformat(),
                    "source": source,
                    "adjustment": adjustment,
                    "confidence_before": confidence_before,
                    "confidence_after": binding["patterns"][pattern_id]["confidence"],
                    "metadata": metadata or {}
                })
        else:
            # Overall binding adjustment
            binding["confidence_adjustment"] = max(
                -1.0,
                min(1.0, binding.get("confidence_adjustment", 0.0) + adjustment)
            )
            
            # Add feedback history to binding
            if "feedback_history" not in binding:
                binding["feedback_history"] = []
            
            binding["feedback_history"].append({
                "timestamp": datetime.now().isoformat(),
                "source": source,
                "adjustment": adjustment,
                "confidence_before": confidence_before,
                "confidence_after": self._get_binding_confidence(binding, None),
                "metadata": metadata or {}
            })
        
        # Update outcome tracking
        if source == "outcome":
            binding["outcomes_seen"] = binding.get("outcomes_seen", 0) + 1
            if metadata and "outcome" in metadata:
                outcome_type = metadata["outcome"]
                if outcome_type == "won":
                    binding["wins"] = binding.get("wins", 0) + 1
                elif outcome_type == "lost":
                    binding["losses"] = binding.get("losses", 0) + 1
                elif outcome_type == "false_positive":
                    binding["false_positives"] = binding.get("false_positives", 0) + 1
        
        # Update usage and success rate
        binding["usage_count"] = binding.get("usage_count", 0) + 1
        if adjustment > 0:
            # Positive feedback = success
            alpha = 0.1
            new_success_rate = 1.0
            binding["success_rate"] = (
                alpha * new_success_rate + 
                (1 - alpha) * binding.get("success_rate", 0.0)
            )
        
        # Track timestamp
        binding["last_feedback_at"] = datetime.now().isoformat()
        binding["last_used"] = datetime.now().isoformat()
        
        # Get confidence after
        confidence_after = self._get_binding_confidence(binding, pattern_id)
        
        # Check for lifecycle transitions
        lifecycle_transition = self._check_lifecycle_transition(binding)
        if lifecycle_transition:
            binding["state"] = lifecycle_transition
            if lifecycle_transition == "PROMOTED":
                binding["promoted_at"] = datetime.now().isoformat()
            elif lifecycle_transition == "RETIRED":
                binding["retired_at"] = datetime.now().isoformat()
        
        # Check if re-discovery needed
        rediscovery_triggered = self._check_rediscovery_needed(binding)
        
        # Save updated binding
        self._save_binding(binding)
        
        # Log feedback to JSONL
        self._log_feedback({
            "entry_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "entity_id": entity_id,
            "pattern_id": pattern_id,
            "source": source,
            "adjustment": adjustment,
            "confidence_before": confidence_before,
            "confidence_after": confidence_after,
            "metadata": metadata or {}
        })
        
        # Trigger re-discovery if needed
        if rediscovery_triggered:
            self._trigger_rediscovery(binding)
        
        return FeedbackResult(
            success=True,
            entity_id=entity_id,
            binding_updated=True,
            confidence_delta=adjustment,
            new_confidence=confidence_after,
            lifecycle_transition=lifecycle_transition,
            rediscovery_triggered=rediscovery_triggered
        )
    
    def _calculate_win_adjustment(self, value_actual: Optional[float]) -> float:
        """Calculate confidence adjustment for won RFP"""
        # Higher value = higher adjustment
        if value_actual and value_actual > 100000:
            return self.OUTCOME_WIN_MAX
        return self.OUTCOME_WIN_MIN
    
    def _calculate_loss_adjustment(self) -> float:
        """Calculate confidence adjustment for lost RFP"""
        # Mild penalty for loss (could be pricing, not signal quality)
        import random
        return random.uniform(self.OUTCOME_LOSS_MIN, self.OUTCOME_LOSS_MAX)
    
    def _calculate_false_positive_adjustment(self) -> float:
        """Calculate confidence adjustment for false positive"""
        # Strong penalty for false positive
        import random
        return random.uniform(self.OUTCOME_FALSE_POSITIVE_MIN, self.OUTCOME_FALSE_POSITIVE_MAX)
    
    def _get_binding_confidence(
        self,
        binding: Dict[str, Any],
        pattern_id: Optional[str] = None
    ) -> float:
        """Get current confidence for binding or pattern"""
        if pattern_id and "patterns" in binding and pattern_id in binding["patterns"]:
            return binding["patterns"][pattern_id].get("confidence", 0.5)
        
        # Calculate average pattern confidence
        if "patterns" in binding and binding["patterns"]:
            confidences = [
                p.get("confidence", 0.5) 
                for p in binding["patterns"].values()
            ]
            return sum(confidences) / len(confidences)
        
        return binding.get("confidence_adjustment", 0.0)
    
    def _check_lifecycle_transition(self, binding: Dict[str, Any]) -> Optional[str]:
        """Check if binding should transition lifecycle state"""
        current_state = binding.get("state", "EXPLORING")
        usage_count = binding.get("usage_count", 0)
        success_rate = binding.get("success_rate", 0.0)
        
        # Check for promotion
        if current_state == "EXPLORING":
            if (usage_count >= self.PROMOTION_MIN_USAGE and 
                success_rate >= self.PROMOTION_MIN_SUCCESS_RATE):
                return "PROMOTED"
        
        # Check for retirement
        confidence = self._get_binding_confidence(binding, None)
        if (confidence < self.RETIREMENT_MAX_CONFIDENCE or 
            success_rate < self.RETIREMENT_MIN_SUCCESS_RATE):
            return "RETIRED"
        
        return None
    
    def _check_rediscovery_needed(self, binding: Dict[str, Any]) -> bool:
        """Check if binding needs re-discovery"""
        confidence = self._get_binding_confidence(binding, None)
        
        if confidence < self.REDISCOVERY_CONFIDENCE_THRESHOLD:
            return True
        
        return False
    
    def _load_binding(self, entity_id: str) -> Optional[Dict[str, Any]]:
        """Load runtime binding from file"""
        binding_path = self.bindings_dir / f"{entity_id}.json"
        
        if not binding_path.exists():
            logger.warning(f"⚠️  Binding not found: {binding_path}")
            return None
        
        try:
            with open(binding_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"❌ Failed to load binding: {e}")
            return None
    
    def _save_binding(self, binding: Dict[str, Any]) -> None:
        """Save runtime binding to file"""
        binding_path = self.bindings_dir / f"{binding['entity_id']}.json"
        
        try:
            with open(binding_path, 'w') as f:
                json.dump(binding, f, indent=2)
            logger.debug(f"💾 Saved binding: {binding_path}")
        except Exception as e:
            logger.error(f"❌ Failed to save binding: {e}")
    
    def _log_feedback(self, feedback_entry: Dict[str, Any]) -> None:
        """Append feedback entry to JSONL log"""
        try:
            with open(self.feedback_log_path, 'a') as f:
                f.write(json.dumps(feedback_entry) + '\n')
        except Exception as e:
            logger.error(f"❌ Failed to log feedback: {e}")
    
    def _trigger_rediscovery(self, binding: Dict[str, Any]) -> None:
        """Add binding to re-discovery queue"""
        queue_entry = {
            "entity_id": binding["entity_id"],
            "entity_name": binding.get("entity_name", ""),
            "reason": "confidence_degraded",
            "current_confidence": self._get_binding_confidence(binding, None),
            "current_state": binding.get("state", "EXPLORING"),
            "last_feedback": binding.get("last_feedback_at", ""),
            "queued_at": datetime.now().isoformat(),
            "priority": "high" if binding.get("state") == "PROMOTED" else "medium"
        }
        
        queue_path = self.rediscovery_queue_dir / f"{binding['entity_id']}.json"
        
        try:
            with open(queue_path, 'w') as f:
                json.dump(queue_entry, f, indent=2)
            logger.warning(f"🔄 Re-discovery queued: {binding['entity_id']}")
        except Exception as e:
            logger.error(f"❌ Failed to queue re-discovery: {e}")


# =============================================================================
# Convenience Functions
# =============================================================================

async def record_win(
    rfp_id: str,
    entity_id: str,
    pattern_id: str,
    value_actual: Optional[float] = None
) -> FeedbackResult:
    """
    Convenience function to record a WON outcome
    
    Args:
        rfp_id: RFP identifier
        entity_id: Entity identifier
        pattern_id: Pattern that led to win
        value_actual: Actual RFP value
    
    Returns:
        FeedbackResult
    """
    processor = BindingFeedbackProcessor()
    return await processor.process_outcome_feedback(
        rfp_id=rfp_id,
        entity_id=entity_id,
        outcome="won",
        pattern_id=pattern_id,
        value_actual=value_actual
    )


async def record_loss(
    rfp_id: str,
    entity_id: str,
    pattern_id: str
) -> FeedbackResult:
    """
    Convenience function to record a LOST outcome
    
    Args:
        rfp_id: RFP identifier
        entity_id: Entity identifier
        pattern_id: Pattern that led to loss
    
    Returns:
        FeedbackResult
    """
    processor = BindingFeedbackProcessor()
    return await processor.process_outcome_feedback(
        rfp_id=rfp_id,
        entity_id=entity_id,
        outcome="lost",
        pattern_id=pattern_id
    )


async def record_false_positive(
    rfp_id: str,
    entity_id: str,
    pattern_id: str
) -> FeedbackResult:
    """
    Convenience function to record a FALSE POSITIVE
    
    Args:
        rfp_id: RFP identifier
        entity_id: Entity identifier
        pattern_id: Pattern that was false positive
    
    Returns:
        FeedbackResult
    """
    processor = BindingFeedbackProcessor()
    return await processor.process_outcome_feedback(
        rfp_id=rfp_id,
        entity_id=entity_id,
        outcome="false_positive",
        pattern_id=pattern_id
    )
