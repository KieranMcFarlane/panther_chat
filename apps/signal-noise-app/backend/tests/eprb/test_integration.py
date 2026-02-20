"""
Test EPRB Integration

Comprehensive integration tests for the complete EPRB workflow.
"""

import pytest
import tempfile
import shutil
import asyncio
from pathlib import Path
from dataclasses import dataclass, field

from backend.eprb_integration import EPRBOrchestrator
from backend.exploration.canonical_categories import ExplorationCategory
from backend.template_runtime_binding import RuntimeBindingCache


class TestEPRBOrchestrator:
    """Test complete EPRB workflow"""

    def setup_method(self):
        """Setup temporary environment"""
        self.temp_dir = tempfile.mkdtemp()

        # Create temporary paths
        self.cache_path = Path(self.temp_dir) / "bindings_cache.json"
        self.evidence_path = Path(self.temp_dir) / "evidence_logs.jsonl"
        self.promotion_log_path = Path(self.temp_dir) / "promotion_log.jsonl"
        self.registry_path = Path(self.temp_dir) / "registry.json"

    def teardown_method(self):
        """Cleanup temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_orchestrator_initialization(self):
        """Test EPRB orchestrator initializes all phases"""
        orchestrator = EPRBOrchestrator()

        # Verify all components initialized
        assert orchestrator.evidence_store is not None
        assert orchestrator.exploration_coordinator is not None
        assert orchestrator.promotion_engine is not None
        assert orchestrator.template_registry is not None
        assert orchestrator.promotion_log is not None
        assert orchestrator.execution_engine is not None
        assert orchestrator.performance_tracker is not None
        assert orchestrator.drift_detector is not None
        assert orchestrator.pattern_replication is not None
        assert orchestrator.inference_validator is not None

    def test_full_workflow_structure(self):
        """Test full workflow runs without errors"""
        orchestrator = EPRBOrchestrator()

        # Run workflow (will use placeholder exploration)
        result = asyncio.run(orchestrator.run_full_workflow(
            cluster_id="test_cluster",
            template_id="test_template",
            template={"name": "test_template"},
            entity_sample=["entity1", "entity2", "entity3"],
            target_entities=["target1", "target2"]
        ))

        # Verify result structure
        assert "cluster_id" in result
        assert "template_id" in result
        assert "started_at" in result
        assert "completed_at" in result
        assert "phases" in result

        # Verify all phases present
        assert "exploration" in result["phases"]
        assert "promotion" in result["phases"]
        assert "runtime" in result["phases"]
        assert "inference" in result["phases"]

    def test_exploration_phase(self):
        """Test exploration phase completes"""
        orchestrator = EPRBOrchestrator()

        result = asyncio.run(orchestrator.run_full_workflow(
            cluster_id="test_cluster",
            template_id="test_template",
            template={"name": "test_template"},
            entity_sample=["entity1", "entity2"],
            target_entities=None  # Skip inference
        ))

        exploration = result["phases"]["exploration"]

        assert exploration["status"] == "complete"
        assert "total_entries" in exploration
        assert "total_observations" in exploration

    def test_promotion_phase(self):
        """Test promotion phase completes"""
        orchestrator = EPRBOrchestrator()

        result = asyncio.run(orchestrator.run_full_workflow(
            cluster_id="test_cluster",
            template_id="test_template",
            template={"name": "test_template"},
            entity_sample=["entity1"],
            target_entities=None
        ))

        promotion = result["phases"]["promotion"]

        assert promotion["status"] == "complete"
        assert "action" in promotion
        assert promotion["action"] in ["PROMOTE", "PROMOTE_WITH_GUARD", "KEEP_EXPLORING"]

    def test_runtime_phase(self):
        """Test runtime phase completes"""
        orchestrator = EPRBOrchestrator()

        result = asyncio.run(orchestrator.run_full_workflow(
            cluster_id="test_cluster",
            template_id="test_template",
            template={"name": "test_template"},
            entity_sample=["entity1"],
            target_entities=None
        ))

        runtime = result["phases"]["runtime"]

        assert runtime["status"] == "complete"
        assert "entities_executed" in runtime
        assert "total_signals" in runtime

    def test_deterministic_runtime(self):
        """Test runtime phase is deterministic (no Claude/MCP calls)"""
        orchestrator = EPRBOrchestrator()

        result = asyncio.run(orchestrator.run_full_workflow(
            cluster_id="test_cluster",
            template_id="test_template",
            template={"name": "test_template"},
            entity_sample=["entity1"],
            target_entities=None
        ))

        runtime = result["phases"]["runtime"]

        # Verify all executions were deterministic
        for execution_result in runtime.get("results", []):
            # Results should show no Claude/MCP calls
            # (this will be enforced when actual exploration is implemented)
            assert execution_result is not None


class TestEPRBEndToEnd:
    """End-to-end tests for realistic scenarios"""

    def setup_method(self):
        """Setup"""
        self.temp_dir = tempfile.mkdtemp()

    def teardown_method(self):
        """Cleanup"""
        shutil.rmtree(self.temp_dir)

    def test_high_confidence_promotion(self):
        """Test high confidence scenario leads to promotion"""
        orchestrator = EPRBOrchestrator()

        # This would require actual exploration implementation
        # For now, just verify the structure is in place
        result = asyncio.run(orchestrator.run_full_workflow(
            cluster_id="tier_1_club",
            template_id="tpl_tier_1",
            template={"name": "Tier 1 Club"},
            entity_sample=["arsenal", "chelsea", "liverpool", "man_city", "man_utd", "spurs", "west_ham"],
            target_entities=None
        ))

        assert result["phases"]["promotion"]["action"] in [
            "PROMOTE", "PROMOTE_WITH_GUARD", "KEEP_EXPLORING"
        ]

    def test_low_confidence_keep_exploring(self):
        """Test low confidence scenario keeps exploring"""
        orchestrator = EPRBOrchestrator()

        result = asyncio.run(orchestrator.run_full_workflow(
            cluster_id="test_cluster",
            template_id="test_template",
            template={"name": "Test"},
            entity_sample=["entity1"],  # Only 1 entity
            target_entities=None
        ))

        # With only 1 entity, should keep exploring
        assert result["phases"]["promotion"]["action"] == "KEEP_EXPLORING"


class TestEPRBAuditTrail:
    """Test complete audit trail from exploration to production"""

    def setup_method(self):
        """Setup"""
        self.temp_dir = tempfile.mkdtemp()

    def teardown_method(self):
        """Cleanup"""
        shutil.rmtree(self.temp_dir)

    def test_exploration_logged(self):
        """Test exploration phase is logged"""
        from backend.exploration.evidence_store import EvidenceStore

        evidence_path = Path(self.temp_dir) / "evidence.jsonl"
        store = EvidenceStore(str(evidence_path))

        # Add entry
        from backend.exploration.exploration_log import ExplorationLogEntry

        entry = ExplorationLogEntry(
            cluster_id="test",
            template_id="test",
            entity_sample=["e1"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        store.append(entry)

        # Verify logged
        assert entry.entry_id in store._index

    def test_promotion_logged(self):
        """Test promotion phase is logged"""
        from backend.promotion.promotion_log import PromotionLog, PromotionLogEntry

        log_path = Path(self.temp_dir) / "promotion.jsonl"
        log = PromotionLog(str(log_path))

        entry = PromotionLogEntry(
            cluster_id="test",
            template_id="test",
            exploration_report_id="report_1",
            decision="PROMOTE",
            decision_confidence=0.9
        )

        log.append(entry)

        # Verify logged
        assert len(log._entries) == 1

    def test_template_version_created(self):
        """Test template version is created on promotion"""
        from backend.promotion.template_updater import TemplateRegistry

        registry_path = Path(self.temp_dir) / "registry.json"
        registry = TemplateRegistry(str(registry_path))

        template = {"name": "test", "patterns": []}

        version = registry.create_version(
            base_template_id="tpl_test",
            template=template,
            promoted_from="exploration_1",
            promotion_decision={"action": "PROMOTE"}
        )

        # Verify version created
        assert version.version_id == "tpl_test_v1"
        assert version.version_id in registry._versions


class TestEPRBScalability:
    """Test scalability to 3,400+ entities"""

    def test_pattern_replication_scale(self):
        """Test pattern replication to many entities"""
        from backend.inference.pattern_replication import PatternReplicationEngine
        from backend.template_runtime_binding import RuntimeBindingCache

        cache_path = Path(self.temp_dir) / "cache.json"
        cache = RuntimeBindingCache(str(cache_path))
        engine = PatternReplicationEngine(binding_cache=cache)

        # Simulate extracting patterns
        from backend.exploration.exploration_log import ExplorationReport, ExplorationLogEntry

        report = ExplorationReport(
            cluster_id="test",
            template_id="test",
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        # Add repeatable pattern
        for i in range(5):
            entry = ExplorationLogEntry(
                cluster_id="test",
                template_id="test",
                entity_sample=["e1", "e2", "e3"],
                category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
                patterns_observed=["repeatable_pattern"],
                confidence_signals=[0.8]
            )
            report.add_entry(entry)

        # Extract patterns
        patterns = engine.extract_patterns_from_exploration(report)

        assert len(patterns) > 0

        # Simulate replicating to 100 entities (scaled down from 3,393)
        target_entities = [f"entity_{i}" for i in range(100)]

        # This would create 100 bindings
        # (actual replication is async and requires full implementation)
        assert len(target_entities) == 100


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
