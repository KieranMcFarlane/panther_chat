"""
Test Phase 2: Promotion System

Tests for:
- Acceptance criteria (hard thresholds)
- Promotion engine
- Template versioning
- Promotion log
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from dataclasses import dataclass, field

from backend.promotion.acceptance_criteria import AcceptanceCriteria
from backend.promotion.promotion_engine import PromotionEngine, PromotionDecision
from backend.promotion.template_updater import TemplateRegistry, TemplateVersion
from backend.promotion.promotion_log import PromotionLog, PromotionLogEntry
from backend.exploration.exploration_log import ExplorationReport, ExplorationLogEntry
from backend.exploration.canonical_categories import ExplorationCategory


class TestAcceptanceCriteria:
    """Test hard acceptance thresholds"""

    def test_promote_threshold(self):
        """Test 5+ observations → PROMOTE"""
        criteria = AcceptanceCriteria()

        decision = criteria.evaluate(
            total_observations=5,
            average_confidence=0.85,
            entities_with_pattern=4,
            entity_sample_size=7
        )

        assert decision == "PROMOTE"

    def test_guard_threshold(self):
        """Test 3+ observations → PROMOTE_WITH_GUARD"""
        criteria = AcceptanceCriteria()

        decision = criteria.evaluate(
            total_observations=3,
            average_confidence=0.75,
            entities_with_pattern=2,
            entity_sample_size=7
        )

        assert decision == "PROMOTE_WITH_GUARD"

    def test_keep_exploring(self):
        """Test <3 observations → KEEP_EXPLORING"""
        criteria = AcceptanceCriteria()

        decision = criteria.evaluate(
            total_observations=2,
            average_confidence=0.6,
            entities_with_pattern=1,
            entity_sample_size=7
        )

        assert decision == "KEEP_EXPLORING"

    def test_low_confidence_rejection(self):
        """Test low confidence even with 5+ observations"""
        criteria = AcceptanceCriteria()

        decision = criteria.evaluate(
            total_observations=5,
            average_confidence=0.5,  # Below 0.7 guard threshold
            entities_with_pattern=3,
            entity_sample_size=7
        )

        assert decision == "KEEP_EXPLORING"

    def test_high_confidence_promotes(self):
        """Test high confidence promotes even with 3 observations"""
        criteria = AcceptanceCriteria()

        decision = criteria.evaluate(
            total_observations=3,
            average_confidence=0.85,  # Above 0.8 promote threshold
            entities_with_pattern=3,
            entity_sample_size=7
        )

        assert decision == "PROMOTE"


class TestPromotionEngine:
    """Test Ralph-governed promotion engine"""

    def test_evaluate_promotion_promote(self):
        """Test promotion with high confidence"""
        engine = PromotionEngine()

        # Create exploration report
        report = ExplorationReport(
            cluster_id="test_cluster",
            template_id="test_template",
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        # Add entries with high confidence
        for i in range(5):
            entry = ExplorationLogEntry(
                cluster_id="test_cluster",
                template_id="test_template",
                entity_sample=["e1", "e2", "e3", "e4"],
                category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
                patterns_observed=["pattern1"],
                confidence_signals=[0.85]
            )
            report.add_entry(entry)

        # Evaluate
        import asyncio
        decision = asyncio.run(engine.evaluate_promotion(
            exploration_report=report,
            template={"name": "test_template"}
        ))

        assert decision.action == "PROMOTE"
        assert decision.confidence >= 0.9
        assert len(decision.promoted_patterns) > 0

    def test_evaluate_promotion_guard(self):
        """Test guard promotion with moderate confidence"""
        engine = PromotionEngine()

        # Create exploration report
        report = ExplorationReport(
            cluster_id="test_cluster",
            template_id="test_template",
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        # Add entries with moderate confidence
        for i in range(3):
            entry = ExplorationLogEntry(
                cluster_id="test_cluster",
                template_id="test_template",
                entity_sample=["e1", "e2"],
                category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
                patterns_observed=["pattern1"],
                confidence_signals=[0.75]
            )
            report.add_entry(entry)

        # Evaluate
        import asyncio
        decision = asyncio.run(engine.evaluate_promotion(
            exploration_report=report,
            template={"name": "test_template"}
        ))

        assert decision.action == "PROMOTE_WITH_GUARD"
        assert len(decision.guard_patterns) > 0

    def test_evaluate_promotion_keep_exploring(self):
        """Test keep exploring with low observations"""
        engine = PromotionEngine()

        # Create exploration report
        report = ExplorationReport(
            cluster_id="test_cluster",
            template_id="test_template",
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        # Add only 2 entries
        for i in range(2):
            entry = ExplorationLogEntry(
                cluster_id="test_cluster",
                template_id="test_template",
                entity_sample=["e1"],
                category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
                patterns_observed=["pattern1"],
                confidence_signals=[0.6]
            )
            report.add_entry(entry)

        # Evaluate
        import asyncio
        decision = asyncio.run(engine.evaluate_promotion(
            exploration_report=report,
            template={"name": "test_template"}
        ))

        assert decision.action == "KEEP_EXPLORING"
        assert len(decision.rejected_patterns) > 0


class TestTemplateVersioning:
    """Test immutable template versioning"""

    def setup_method(self):
        """Setup temporary registry"""
        self.temp_dir = tempfile.mkdtemp()
        self.registry_path = Path(self.temp_dir) / "test_registry.json"
        self.registry = TemplateRegistry(str(self.registry_path))

    def teardown_method(self):
        """Cleanup temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_create_first_version(self):
        """Test creating first version (v1)"""
        template = {"name": "test_template", "patterns": []}

        version = self.registry.create_version(
            base_template_id="tpl_test",
            template=template,
            promoted_from="exploration_1",
            promotion_decision={"action": "PROMOTE"}
        )

        assert version.version_id == "tpl_test_v1"
        assert version.parent_version is None
        assert version.verify_hash()

    def test_create_second_version(self):
        """Test creating second version (v2)"""
        template = {"name": "test_template", "patterns": []}

        # Create v1
        v1 = self.registry.create_version(
            base_template_id="tpl_test",
            template=template,
            promoted_from="exploration_1",
            promotion_decision={"action": "PROMOTE"}
        )

        # Create v2
        template["patterns"] = ["new_pattern"]
        v2 = self.registry.create_version(
            base_template_id="tpl_test",
            template=template,
            promoted_from="exploration_2",
            promotion_decision={"action": "PROMOTE"}
        )

        assert v2.version_id == "tpl_test_v2"
        assert v2.parent_version == "tpl_test_v1"

    def test_version_lineage(self):
        """Test version lineage tracking"""
        template = {"name": "test", "patterns": []}

        # Create version chain
        self.registry.create_version("tpl_test", template, "exp1", {"action": "PROMOTE"})
        self.registry.create_version("tpl_test", template, "exp2", {"action": "PROMOTE"})
        v3 = self.registry.create_version("tpl_test", template, "exp3", {"action": "PROMOTE"})

        # Get lineage
        lineage = self.registry.get_lineage(v3.version_id)

        assert len(lineage) == 2  # v1 and v2

    def test_get_latest_version(self):
        """Test getting latest version"""
        template = {"name": "test", "patterns": []}

        self.registry.create_version("tpl_test", template, "exp1", {"action": "PROMOTE"})
        self.registry.create_version("tpl_test", template, "exp2", {"action": "PROMOTE"})

        latest = self.registry.get_latest_version("tpl_test")

        assert latest.version_id == "tpl_test_v2"

    def test_version_immutability(self):
        """Test version hash immutability"""
        template = {"name": "test", "patterns": ["pattern1"]}

        version = self.registry.create_version(
            base_template_id="tpl_test",
            template=template,
            promoted_from="exploration_1",
            promotion_decision={"action": "PROMOTE"}
        )

        # Verify hash
        assert version.verify_hash()

        # Store hash
        original_hash = version.version_hash

        # Recalculate hash should match
        recalculated = version._calculate_hash()
        assert original_hash == recalculated


class TestPromotionLog:
    """Test promotion audit trail"""

    def setup_method(self):
        """Setup temporary log"""
        self.temp_dir = tempfile.mkdtemp()
        self.log_path = Path(self.temp_dir) / "test_promotion_log.jsonl"
        self.log = PromotionLog(str(self.log_path))

    def teardown_method(self):
        """Cleanup temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_append_log_entry(self):
        """Test appending promotion log entry"""
        entry = PromotionLogEntry(
            cluster_id="test_cluster",
            template_id="test_template",
            exploration_report_id="report_1",
            decision="PROMOTE",
            decision_confidence=0.9,
            decision_rationale="High confidence",
            promoted_patterns=["pattern1"],
            guard_patterns=[],
            rejected_patterns=[]
        )

        success = self.log.append(entry)

        assert success
        assert len(self.log._entries) == 1

    def test_query_by_decision(self):
        """Test querying log by decision type"""
        # Add multiple entries
        entry1 = PromotionLogEntry(
            cluster_id="cluster_A",
            template_id="template1",
            exploration_report_id="report_1",
            decision="PROMOTE",
            decision_confidence=0.9,
            decision_rationale="High confidence"
        )

        entry2 = PromotionLogEntry(
            cluster_id="cluster_B",
            template_id="template2",
            exploration_report_id="report_2",
            decision="KEEP_EXPLORING",
            decision_confidence=0.5,
            decision_rationale="Low confidence"
        )

        self.log.append(entry1)
        self.log.append(entry2)

        # Query for PROMOTE decisions
        results = self.log.query(decision="PROMOTE")

        assert len(results) == 1
        assert results[0].decision == "PROMOTE"

    def test_promotion_history(self):
        """Test getting promotion history for template"""
        # Add entries for same template
        entry1 = PromotionLogEntry(
            cluster_id="cluster_A",
            template_id="template1",
            exploration_report_id="report_1",
            decision="KEEP_EXPLORING",
            decision_confidence=0.5
        )

        entry2 = PromotionLogEntry(
            cluster_id="cluster_A",
            template_id="template1",
            exploration_report_id="report_2",
            decision="PROMOTE",
            decision_confidence=0.9
        )

        self.log.append(entry1)
        self.log.append(entry2)

        # Get history
        history = self.log.get_promotion_history("template1")

        assert len(history) == 2
        assert history[0].decision == "KEEP_EXPLORING"
        assert history[1].decision == "PROMOTE"

    def test_log_persistence(self):
        """Test log persists across instances"""
        entry = PromotionLogEntry(
            cluster_id="test_cluster",
            template_id="test_template",
            exploration_report_id="report_1",
            decision="PROMOTE",
            decision_confidence=0.9
        )

        self.log.append(entry)

        # Create new log instance
        new_log = PromotionLog(str(self.log_path))

        assert len(new_log._entries) == 1
        assert new_log._entries[0].decision == "PROMOTE"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
