"""
Test Phase 1: Exploration System

Tests for:
- Canonical categories
- Exploration log entries
- Evidence store (immutable, append-only)
- Exploration coordinator
"""

import pytest
import json
import tempfile
import shutil
from pathlib import Path

from backend.exploration.canonical_categories import (
    ExplorationCategory,
    get_category_metadata,
    CATEGORY_METADATA
)
from backend.exploration.exploration_log import ExplorationLogEntry, ExplorationReport
from backend.exploration.evidence_store import EvidenceStore


class TestCanonicalCategories:
    """Test 8 canonical exploration categories"""

    def test_all_categories_exist(self):
        """Test all 8 categories are defined"""
        categories = [
            ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
            ExplorationCategory.OFFICIAL_SITE_RELIABILITY,
            ExplorationCategory.STRATEGIC_HIRE_INDICATORS,
            ExplorationCategory.PARTNERSHIP_SIGNALS,
            ExplorationCategory.OFFICIAL_DOMAIN_DISCOVERY,
            ExplorationCategory.SEMANTIC_FILTERING,
            ExplorationCategory.HISTORICAL_PATTERN_RECOGNITION,
            ExplorationCategory.CLUSTER_PATTERN_REPLICATION
        ]

        assert len(categories) == 8

    def test_category_metadata_complete(self):
        """Test all categories have metadata"""
        for category in ExplorationCategory:
            metadata = get_category_metadata(category)

            assert metadata.category == category
            assert len(metadata.exploration_methods) > 0
            assert len(metadata.confidence_indicators) > 0
            assert metadata.sample_size == 7
            assert metadata.repeatability_threshold == 3

    def test_jobs_board_category(self):
        """Test JOBS_BOARD_EFFECTIVENESS category"""
        metadata = get_category_metadata(ExplorationCategory.JOBS_BOARD_EFFECTIVENESS)

        assert "LinkedIn" in str(metadata.exploration_methods)
        assert any("CRM" in ind for ind in metadata.confidence_indicators)


class TestExplorationLogEntry:
    """Test immutable exploration log entries"""

    def test_entry_creation(self):
        """Test creating log entry"""
        entry = ExplorationLogEntry(
            cluster_id="test_cluster",
            template_id="test_template",
            entity_sample=["entity1", "entity2"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
            hypothesis="Test hypothesis",
            exploration_method="Claude Code",
            patterns_observed=["pattern1", "pattern2"],
            confidence_signals=[0.8, 0.9]
        )

        assert entry.cluster_id == "test_cluster"
        assert entry.entry_hash  # Hash calculated automatically
        assert len(entry.patterns_observed) == 2
        assert entry.get_average_confidence() == pytest.approx(0.85)

    def test_entry_immutability(self):
        """Test entry has hash for immutability"""
        entry = ExplorationLogEntry(
            cluster_id="test",
            template_id="test",
            entity_sample=["e1"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        original_hash = entry.entry_hash

        # Verify hash can be recalculated
        recalculated = entry._calculate_hash()
        assert recalculated == original_hash

    def test_hash_chain_verification(self):
        """Test hash chain verification"""
        entry1 = ExplorationLogEntry(
            cluster_id="test",
            template_id="test",
            entity_sample=["e1"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        entry2 = ExplorationLogEntry(
            cluster_id="test",
            template_id="test",
            entity_sample=["e2"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
            previous_hash=entry1.entry_hash
        )

        # Verify chain
        assert entry2.verify_hash_chain(entry1.entry_hash)

    def test_broken_hash_chain(self):
        """Test broken hash chain detection"""
        entry1 = ExplorationLogEntry(
            cluster_id="test",
            template_id="test",
            entity_sample=["e1"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        entry2 = ExplorationLogEntry(
            cluster_id="test",
            template_id="test",
            entity_sample=["e2"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
            previous_hash="wrong_hash"
        )

        # Detect broken chain
        assert not entry2.verify_hash_chain(entry1.entry_hash)


class TestExplorationReport:
    """Test exploration report aggregation"""

    def test_report_aggregation(self):
        """Test aggregating multiple entries"""
        report = ExplorationReport(
            cluster_id="test_cluster",
            template_id="test_template",
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        # Add entries
        entry1 = ExplorationLogEntry(
            cluster_id="test_cluster",
            template_id="test_template",
            entity_sample=["e1", "e2"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
            patterns_observed=["pattern1", "pattern2"],
            confidence_signals=[0.8, 0.9]
        )

        entry2 = ExplorationLogEntry(
            cluster_id="test_cluster",
            template_id="test_template",
            entity_sample=["e1", "e2"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
            patterns_observed=["pattern1"],
            confidence_signals=[0.7]
        )

        report.add_entry(entry1)
        report.add_entry(entry2)

        assert report.total_observations == 3
        assert len(report.unique_patterns) == 2
        assert report.average_confidence == pytest.approx(0.8, rel=0.1)

    def test_repeatable_patterns(self):
        """Test detecting repeatable patterns"""
        report = ExplorationReport(
            cluster_id="test_cluster",
            template_id="test_template",
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        # Add entries with repeatable pattern
        for i in range(5):
            entry = ExplorationLogEntry(
                cluster_id="test_cluster",
                template_id="test_template",
                entity_sample=["e1", "e2"],
                category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
                patterns_observed=["repeatable_pattern"],
                confidence_signals=[0.8]
            )
            report.add_entry(entry)

        repeatable = report.get_repeatable_patterns(min_entities=3)
        assert "repeatable_pattern" in repeatable

    def test_promotion_thresholds(self):
        """Test promotion threshold evaluation"""
        report = ExplorationReport(
            cluster_id="test_cluster",
            template_id="test_template",
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        # Add 5 observations
        for i in range(5):
            entry = ExplorationLogEntry(
                cluster_id="test_cluster",
                template_id="test_template",
                entity_sample=["e1", "e2", "e3"],
                category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
                patterns_observed=["pattern"],
                confidence_signals=[0.8]
            )
            report.add_entry(entry)

        assert report.meets_promotion_threshold(min_observations=5)
        assert report.meets_guard_threshold(min_observations=3)


class TestEvidenceStore:
    """Test append-only evidence store"""

    def setup_method(self):
        """Setup temporary evidence store"""
        self.temp_dir = tempfile.mkdtemp()
        self.store_path = Path(self.temp_dir) / "test_evidence.jsonl"
        self.store = EvidenceStore(str(self.store_path))

    def teardown_method(self):
        """Cleanup temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_append_entry(self):
        """Test appending entry to store"""
        entry = ExplorationLogEntry(
            cluster_id="test_cluster",
            template_id="test_template",
            entity_sample=["e1"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
            patterns_observed=["pattern1"],
            confidence_signals=[0.8]
        )

        success = self.store.append(entry)

        assert success
        assert entry.entry_id in self.store._index

    def test_retrieve_entry(self):
        """Test retrieving entry from store"""
        entry = ExplorationLogEntry(
            cluster_id="test_cluster",
            template_id="test_template",
            entity_sample=["e1"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        self.store.append(entry)

        retrieved = self.store.get(entry.entry_id)

        assert retrieved is not None
        assert retrieved.entry_id == entry.entry_id
        assert retrieved.cluster_id == "test_cluster"

    def test_query_by_cluster(self):
        """Test querying entries by cluster"""
        # Add entries for different clusters
        entry1 = ExplorationLogEntry(
            cluster_id="cluster_A",
            template_id="template1",
            entity_sample=["e1"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        entry2 = ExplorationLogEntry(
            cluster_id="cluster_B",
            template_id="template1",
            entity_sample=["e2"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        self.store.append(entry1)
        self.store.append(entry2)

        # Query for cluster_A
        results = self.store.query(cluster_id="cluster_A")

        assert len(results) == 1
        assert results[0].cluster_id == "cluster_A"

    def test_persistence(self):
        """Test entries persist across store instances"""
        entry = ExplorationLogEntry(
            cluster_id="test_cluster",
            template_id="test_template",
            entity_sample=["e1"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
            patterns_observed=["pattern1"],
            confidence_signals=[0.8]
        )

        self.store.append(entry)

        # Create new store instance (should load from disk)
        new_store = EvidenceStore(str(self.store_path))

        retrieved = new_store.get(entry.entry_id)

        assert retrieved is not None
        assert retrieved.cluster_id == "test_cluster"

    def test_hash_chain_integrity(self):
        """Test hash chain integrity verification"""
        entry1 = ExplorationLogEntry(
            cluster_id="test",
            template_id="test",
            entity_sample=["e1"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        entry2 = ExplorationLogEntry(
            cluster_id="test",
            template_id="test",
            entity_sample=["e2"],
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
        )

        self.store.append(entry1)
        self.store.append(entry2)

        # Verify integrity
        stats = self.store.verify_integrity()

        assert stats["integrity_verified"]
        assert stats["total_entries"] == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
