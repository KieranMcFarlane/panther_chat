"""
Inference Validator

Validates replicated patterns on target entities.

Process:
1. Extract proven patterns from 7 explored entities
2. Apply to target entities with confidence discount
3. Validate with sample execution (deterministic only)
4. Promote binding if validation successful

Core principle: Validate before production use.
"""

import logging
from dataclasses import dataclass
from typing import Dict, List, Any, Optional, Literal
from datetime import datetime

from backend.template_runtime_binding import RuntimeBinding, RuntimeBindingCache
from backend.inference.pattern_replication import ReplicatedPattern, ReplicationResult
from backend.runtime.execution_engine import ExecutionEngine, ExecutionResult

logger = logging.getLogger(__name__)


@dataclass
class InferenceValidation:
    """
    Validation result for replicated pattern

    Attributes:
        pattern_name: Pattern that was validated
        target_entity: Entity pattern was applied to
        validation_status: VALID | INVALID | NEEDS_MORE_DATA
        confidence_before: Confidence before validation
        confidence_after: Confidence after validation
        signals_found: Number of signals found during validation
        execution_result: Full execution result
        validated_at: ISO timestamp
        rationale: Explanation for validation decision
    """
    pattern_name: str
    target_entity: str
    validation_status: Literal["VALID", "INVALID", "NEEDS_MORE_DATA"]
    confidence_before: float
    confidence_after: float
    signals_found: int
    execution_result: ExecutionResult
    validated_at: str
    rationale: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "pattern_name": self.pattern_name,
            "target_entity": self.target_entity,
            "validation_status": self.validation_status,
            "confidence_before": self.confidence_before,
            "confidence_after": self.confidence_after,
            "signals_found": self.signals_found,
            "validated_at": self.validated_at,
            "rationale": self.rationale
        }


class InferenceValidator:
    """
    Validates replicated patterns on target entities

    Ensures patterns work before promoting to production.
    """

    def __init__(
        self,
        binding_cache: Optional[RuntimeBindingCache] = None,
        execution_engine: Optional[ExecutionEngine] = None
    ):
        """
        Initialize inference validator

        Args:
            binding_cache: Optional binding cache
            execution_engine: Optional execution engine for validation
        """
        self.binding_cache = binding_cache or RuntimeBindingCache()
        self.execution_engine = execution_engine or ExecutionEngine()

        logger.info("✅ InferenceValidator initialized")

    async def validate_replicated_pattern(
        self,
        pattern: ReplicatedPattern,
        target_entity_id: str,
        target_entity_name: str,
        template_id: str
    ) -> InferenceValidation:
        """
        Validate replicated pattern on target entity

        Args:
            pattern: Pattern to validate
            target_entity_id: Target entity identifier
            target_entity_name: Target entity name
            template_id: Template identifier

        Returns:
            InferenceValidation result
        """
        logger.info(
            f"✅ Validating {pattern.pattern_name} on {target_entity_name} "
            f"(confidence: {pattern.effective_confidence:.2f})"
        )

        # Get binding
        binding = self.binding_cache.get_binding(target_entity_id)

        if not binding:
            logger.warning(f"⚠️ No binding found for {target_entity_id}")
            return InferenceValidation(
                pattern_name=pattern.pattern_name,
                target_entity=target_entity_id,
                validation_status="NEEDS_MORE_DATA",
                confidence_before=0.0,
                confidence_after=0.0,
                signals_found=0,
                execution_result=None,
                validated_at=datetime.now().isoformat(),
                rationale="No binding found for target entity"
            )

        # Track confidence before
        confidence_before = binding.get_effective_confidence(pattern.confidence)

        # Execute binding for validation
        execution_result = await self.execution_engine.execute_binding_deterministic(
            template_id=template_id,
            entity_id=target_entity_id,
            entity_name=target_entity_name
        )

        # Determine validation status
        if not execution_result.success:
            validation_status = "INVALID"
            rationale = f"Execution failed: {execution_result.error}"
        elif execution_result.signals_found == 0:
            validation_status = "NEEDS_MORE_DATA"
            rationale = "No signals found during validation"
        elif execution_result.signals_found >= 2:
            validation_status = "VALID"
            rationale = f"Found {execution_result.signals_found} signals, validation successful"
        else:  # Exactly 1 signal
            validation_status = "NEEDS_MORE_DATA"
            rationale = "Found 1 signal, need more data for confidence"

        # Track confidence after
        confidence_after = binding.get_effective_confidence(pattern.confidence)

        # Update binding state if valid
        if validation_status == "VALID":
            binding.state = "PROMOTED"
            binding.promoted_at = datetime.now().isoformat()
            self.binding_cache.set_binding(binding)

            logger.info(f"✅ Promoted binding for {target_entity_id} to PROMOTED state")

        # Create validation result
        validation = InferenceValidation(
            pattern_name=pattern.pattern_name,
            target_entity=target_entity_id,
            validation_status=validation_status,
            confidence_before=confidence_before,
            confidence_after=confidence_after,
            signals_found=execution_result.signals_found,
            execution_result=execution_result,
            validated_at=datetime.now().isoformat(),
            rationale=rationale
        )

        logger.info(
            f"✅ Validation complete: {validation_status} "
            f"({execution_result.signals_found} signals)"
        )

        return validation

    async def validate_batch(
        self,
        patterns: List[ReplicatedPattern],
        target_entities: List[tuple[str, str]],  # [(entity_id, entity_name), ...]
        template_id: str
    ) -> List[InferenceValidation]:
        """
        Validate multiple patterns on multiple entities

        Args:
            patterns: Patterns to validate
            target_entities: List of (entity_id, entity_name) tuples
            template_id: Template identifier

        Returns:
            List of InferenceValidation results
        """
        logger.info(
            f"✅ Validating {len(patterns)} patterns on "
            f"{len(target_entities)} entities"
        )

        results = []

        for pattern in patterns:
            for entity_id, entity_name in target_entities:
                # Validate this pattern on this entity
                validation = await self.validate_replicated_pattern(
                    pattern=pattern,
                    target_entity_id=entity_id,
                    target_entity_name=entity_name,
                    template_id=template_id
                )

                results.append(validation)

        # Log summary
        valid = len([v for v in results if v.validation_status == "VALID"])
        invalid = len([v for v in results if v.validation_status == "INVALID"])
        needs_data = len([v for v in results if v.validation_status == "NEEDS_MORE_DATA"])

        logger.info(
            f"✅ Batch validation complete: "
            f"{valid} valid, {invalid} invalid, {needs_data} need more data"
        )

        return results

    def get_validation_summary(
        self,
        validations: List[InferenceValidation]
    ) -> Dict[str, Any]:
        """
        Get summary of validation results

        Args:
            validations: Validation results

        Returns:
            Summary dictionary
        """
        total = len(validations)
        valid = len([v for v in validations if v.validation_status == "VALID"])
        invalid = len([v for v in validations if v.validation_status == "INVALID"])
        needs_data = len([v for v in validations if v.validation_status == "NEEDS_MORE_DATA"])

        total_signals = sum(v.signals_found for v in validations)

        return {
            "total_validations": total,
            "valid": valid,
            "invalid": invalid,
            "needs_more_data": needs_data,
            "validation_rate": valid / total if total > 0 else 0.0,
            "total_signals_found": total_signals
        }


# =============================================================================
# Convenience Functions
# =============================================================================

async def validate_inference(
    pattern: ReplicatedPattern,
    target_entity_id: str,
    target_entity_name: str,
    template_id: str
) -> InferenceValidation:
    """
    Convenience function to validate single pattern

    Args:
        pattern: Pattern to validate
        target_entity_id: Target entity identifier
        target_entity_name: Target entity name
        template_id: Template identifier

    Returns:
        InferenceValidation result
    """
    validator = InferenceValidator()
    return await validator.validate_replicated_pattern(
        pattern=pattern,
        target_entity_id=target_entity_id,
        target_entity_name=target_entity_name,
        template_id=template_id
    )
