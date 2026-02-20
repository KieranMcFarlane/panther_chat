"""
EPRB Integration

Complete EPRB (Exploratory → Promoted → Runtime Bindings) workflow integration.

This module ties together all EPRB phases into a cohesive workflow:
1. Exploration (7 entities, 8 categories)
2. Promotion (Ralph-governed, hard thresholds)
3. Runtime (deterministic execution)
4. Inference (cross-entity pattern replication)

Usage:
    from backend.eprb_integration import EPRBOrchestrator

    orchestrator = EPRBOrchestrator()

    # Run full EPRB workflow
    result = await orchestrator.run_full_workflow(
        cluster_id="top_tier_club_global",
        template_id="tpl_top_tier_club_v1",
        entity_sample=["arsenal", "chelsea", "liverpool", ...],
        target_entities=[...]  # 3,393 remaining entities
    )
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from backend.exploration.exploration_coordinator import ExplorationCoordinator
from backend.exploration.evidence_store import EvidenceStore
from backend.promotion.promotion_engine import PromotionEngine
from backend.promotion.template_updater import TemplateRegistry
from backend.promotion.promotion_log import PromotionLog, log_promotion_decision
from backend.runtime.execution_engine import ExecutionEngine
from backend.runtime.performance_tracker import PerformanceTracker
from backend.runtime.drift_detector import DriftDetector
from backend.inference.pattern_replication import PatternReplicationEngine
from backend.inference.inference_validator import InferenceValidator

logger = logging.getLogger(__name__)


class EPRBOrchestrator:
    """
    Complete EPRB workflow orchestrator

    Manages the full lifecycle:
    1. Exploration → 2. Promotion → 3. Runtime → 4. Inference
    """

    def __init__(self):
        """Initialize EPRB orchestrator with all components"""
        # Phase 1: Exploration
        self.evidence_store = EvidenceStore()
        self.exploration_coordinator = ExplorationCoordinator(
            evidence_store=self.evidence_store
        )

        # Phase 2: Promotion
        self.promotion_engine = PromotionEngine()
        self.template_registry = TemplateRegistry()
        self.promotion_log = PromotionLog()

        # Phase 3: Runtime
        self.execution_engine = ExecutionEngine()
        self.performance_tracker = PerformanceTracker()
        self.drift_detector = DriftDetector()

        # Phase 4: Inference
        self.pattern_replication = PatternReplicationEngine()
        self.inference_validator = InferenceValidator()

        logger.info("🚀 EPRBOrchestrator initialized with all phases")

    async def run_full_workflow(
        self,
        cluster_id: str,
        template_id: str,
        template: Dict[str, Any],
        entity_sample: List[str],  # 7 representative entities
        target_entities: Optional[List[str]] = None,  # Remaining 3,393 entities
        categories: Optional[List] = None  # All 8 categories
    ) -> Dict[str, Any]:
        """
        Run complete EPRB workflow

        Args:
            cluster_id: Cluster to explore
            template_id: Template to test
            template: Template metadata
            entity_sample: 7 representative entities for exploration
            target_entities: Remaining entities for inference (optional)
            categories: Categories to explore (default: all 8)

        Returns:
            Dictionary with workflow results
        """
        logger.info(f"🚀 Starting full EPRB workflow for {template_id}")

        workflow_result = {
            "cluster_id": cluster_id,
            "template_id": template_id,
            "started_at": datetime.now().isoformat(),
            "phases": {}
        }

        # =====================================================================
        # PHASE 1: EXPLORATION (7 entities, 8 categories)
        # =====================================================================
        logger.info("🔍 Phase 1: Exploration")

        exploration_report = await self.exploration_coordinator.run_exploration_cycle(
            cluster_id=cluster_id,
            template_id=template_id,
            entity_sample=entity_sample,
            categories=categories
        )

        workflow_result["phases"]["exploration"] = {
            "status": "complete",
            "total_entries": len(exploration_report.entries),
            "total_observations": exploration_report.total_observations,
            "average_confidence": exploration_report.average_confidence,
            "repeatable_patterns": exploration_report.get_repeatable_patterns()
        }

        logger.info(f"✅ Phase 1 complete: {exploration_report.total_observations} observations")

        # =====================================================================
        # PHASE 2: PROMOTION (Ralph-governed, hard thresholds)
        # =====================================================================
        logger.info("🚀 Phase 2: Promotion")

        promotion_decision = await self.promotion_engine.evaluate_promotion(
            exploration_report=exploration_report,
            template=template
        )

        # Log promotion decision
        log_entry = log_promotion_decision(
            cluster_id=cluster_id,
            template_id=template_id,
            exploration_report_id=template_id,
            decision=promotion_decision.to_dict()
        )

        workflow_result["phases"]["promotion"] = {
            "status": "complete",
            "action": promotion_decision.action,
            "confidence": promotion_decision.confidence,
            "promoted_patterns": promotion_decision.promoted_patterns,
            "guard_patterns": promotion_decision.guard_patterns
        }

        # Create new template version if promoted
        if promotion_decision.action in ["PROMOTE", "PROMOTE_WITH_GUARD"]:
            new_version = self.template_registry.create_version(
                base_template_id=template_id,
                template=template,
                promoted_from=f"exploration_report_{template_id}",
                promotion_decision=promotion_decision.to_dict()
            )

            workflow_result["phases"]["promotion"]["new_version_id"] = new_version.version_id

        logger.info(f"✅ Phase 2 complete: {promotion_decision.action}")

        # =====================================================================
        # PHASE 3: RUNTIME (deterministic execution on 7 explored entities)
        # =====================================================================
        logger.info("⚙️ Phase 3: Runtime Execution")

        runtime_results = []

        for entity_id in entity_sample:
            result = await self.execution_engine.execute_binding_deterministic(
                template_id=template_id,
                entity_id=entity_id,
                entity_name=entity_id  # TODO: Get actual entity name
            )

            # Record performance
            self.performance_tracker.record_execution(
                entity_id=entity_id,
                success=result.success,
                signals_found=result.signals_found
            )

            # Check for drift
            drift_result = self.drift_detector.detect_drift(entity_id)

            runtime_results.append({
                "entity_id": entity_id,
                "success": result.success,
                "signals_found": result.signals_found,
                "drift_detected": drift_result.drift_detected if drift_result else False
            })

        workflow_result["phases"]["runtime"] = {
            "status": "complete",
            "entities_executed": len(runtime_results),
            "total_signals": sum(r["signals_found"] for r in runtime_results),
            "results": runtime_results
        }

        logger.info(f"✅ Phase 3 complete: {len(runtime_results)} entities executed")

        # =====================================================================
        # PHASE 4: INFERENCE (pattern replication to 3,393 entities)
        # =====================================================================
        if target_entities:
            logger.info("🔁 Phase 4: Inference")

            # Extract patterns from exploration
            patterns = self.pattern_replication.extract_patterns_from_exploration(
                exploration_report
            )

            # Replicate to target entities
            replication_results = await self.pattern_replication.replicate_to_entities(
                patterns=patterns,
                target_entities=target_entities,
                cluster_id=cluster_id,
                template_id=template_id
            )

            # Validate sample of replicated patterns
            validation_sample = target_entities[:10]  # Validate first 10
            target_entity_tuples = [(e, e) for e in validation_sample]  # (id, name)

            validation_results = await self.inference_validator.validate_batch(
                patterns=patterns,
                target_entities=target_entity_tuples,
                template_id=template_id
            )

            workflow_result["phases"]["inference"] = {
                "status": "complete",
                "patterns_replicated": len(patterns),
                "target_entities": len(target_entities),
                "replication_success": len([r for r in replication_results if r.success]),
                "validation_valid": len([v for v in validation_results if v.validation_status == "VALID"]),
                "validation_invalid": len([v for v in validation_results if v.validation_status == "INVALID"])
            }

            logger.info(f"✅ Phase 4 complete: {len(target_entities)} entities inferred")

        workflow_result["completed_at"] = datetime.now().isoformat()

        logger.info(f"🎉 Full EPRB workflow complete for {template_id}")

        return workflow_result


# =============================================================================
# Convenience Functions
# =============================================================================

async def run_eprb_workflow(
    cluster_id: str,
    template_id: str,
    template: Dict[str, Any],
    entity_sample: List[str],
    target_entities: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Convenience function to run full EPRB workflow

    Args:
        cluster_id: Cluster to explore
        template_id: Template to test
        template: Template metadata
        entity_sample: 7 representative entities
        target_entities: Remaining entities for inference (optional)

    Returns:
        Dictionary with complete workflow results
    """
    orchestrator = EPRBOrchestrator()
    return await orchestrator.run_full_workflow(
        cluster_id=cluster_id,
        template_id=template_id,
        template=template,
        entity_sample=entity_sample,
        target_entities=target_entities
    )
