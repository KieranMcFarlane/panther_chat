"""
Test Phase 4: Inference System

Tests for:
- Pattern replication
- Inference validation
"""

import pytest
import tempfile
import shutil
from pathlib import Path

from backend.inference.pattern_replication import (
    PatternReplicationEngine,
    ReplicatedPattern,
    ReplicationResult
)
from backend.inference.inference_validator import (
    InferenceValidator,
    InferenceValidation
)
from backend.exploration.exploration_log import ExplorationReport, ExplorationLogEntry
from backend.exploration.canonical_categories import ExplorationCategory
from backend.template_runtime_binding import RuntimeBinding, RuntimeBindingCache
from backend.runtime.execution_engine import ExecutionResult


class TestReplicatedPattern:
    """Test replicated pattern dataclass"""

    def test_pattern_creation(self):
        """Test creating replicated pattern"""
        pattern = ReplicatedPattern(
            pattern_name="test_pattern",
            source_entities=["entity1", "entity2"],
            success_rate=0.8,
            confidence=0.85,
            target_entities=["entity3", "entity4"],
            confidence_discount=-0.1
        )

        assert pattern.pattern_name == "test_pattern"
        assert len(pattern.source_entities) == 2
        assert pattern.effective_confidence == 0.75  # 0.85 - 0.1

    def test_confidence_discount_bounds(self):
        """Test confidence discount is bounded"""
        pattern = ReplicatedPattern(
            pattern_name="test",
            source_entities=["e1"],
            success_rate=0.5,
            confidence=0.05,  # Very low
            target_entities=["e2"],
            confidence_discount=-0.1
        )

        # Should not go below 0.0
        assert pattern.effective_confidence >= 0.0

    def test_confidence_upper_bound(self):
        """Test confidence doesn't exceed 1.0"""
        pattern = ReplicatedPattern(
            pattern_name="test",
            source_entities=["e1"],
            success_rate=1.0,
            confidence=0.95,
            target_entities=["e2"],
            confidence_discount=0.2  # Would exceed 1.0
        )

        # Should not exceed 1.0
        assert pattern.effective_confidence <= 1.0


class TestPatternReplicationEngine:
    """Test pattern replication engine"""

    def setup_method(self):
        """Setup temporary cache"""
        self.temp_dir = tempfile.mkdtemp()
        self.cache_path = Path(self.temp_dir) / "test_cache.json"
        self.cache = RuntimeBindingCache(str(self.cache_path))
        self.engine = PatternReplicationEngine(binding_cache=self.cache)

    def teardown_method(self):
        """Cleanup temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_extract_patterns_from_exploration(self):
        """Test extracting patterns from exploration report"""
        # Create exploration report
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
                entity_sample=["e1", "e2", "e3"],
                category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
                patterns_observed=["repeatable_pattern"],
                confidence_signals=[0.8]
            )
            report.add_entry(entry)

        # Extract patterns
        patterns = self.engine.extract_patterns_from_exploration(report)

        assert len(patterns) > 0
        assert patterns[0].pattern_name == "repeatable_pattern"
        assert len(patterns[0].source_entities) == 3

    def test_replicate_to_entities(self):
        """Test replicating patterns to target entities"""
        import asyncio

        # Create pattern
        pattern = ReplicatedPattern(
            pattern_name="test_pattern",
            source_entities=["source1"],
            success_rate=0.8,
            confidence=0.85,
            target_entities=["target1", "target2"],
            confidence_discount=-0.1
        )

        # Replicate
        results = asyncio.run(self.engine.replicate_to_entities(
            patterns=[pattern],
            target_entities=["target1", "target2"],
            cluster_id="test_cluster",
            template_id="test_template"
        ))

        assert len(results) == 2  # One per target entity

    def test_confidence_discount_applied(self):
        """Test confidence discount is applied to bindings"""
        import asyncio

        pattern = ReplicatedPattern(
            pattern_name="test_pattern",
            source_entities=["source1"],
            success_rate=0.8,
            confidence=0.8,
            target_entities=["target1"],
            confidence_discount=-0.15
        )

        asyncio.run(self.engine.replicate_to_entities(
            patterns=[pattern],
            target_entities=["target1"],
            cluster_id="test_cluster",
            template_id="test_template"
        ))

        # Check binding has discount applied
        binding = self.cache.get_binding("target1")
        assert binding is not None
        assert binding.confidence_adjustment == -0.15

    def test_get_replication_summary(self):
        """Test getting replication summary"""
        results = [
            ReplicationResult(
                pattern_name="pattern1",
                target_entity="entity1",
                success=True,
                signals_found=2,
                confidence_before=0.8,
                confidence_after=0.7,
                validated_at="2026-01-29T00:00:00"
            ),
            ReplicationResult(
                pattern_name="pattern1",
                target_entity="entity2",
                success=False,
                signals_found=0,
                confidence_before=0.8,
                confidence_after=0.8,
                validated_at="2026-01-29T00:00:00"
            )
        ]

        summary = self.engine.get_replication_summary(results)

        assert summary["total_replications"] == 2
        assert summary["successful"] == 1
        assert summary["failed"] == 1
        assert summary["success_rate"] == 0.5


class TestInferenceValidator:
    """Test inference validation"""

    def setup_method(self):
        """Setup temporary cache"""
        self.temp_dir = tempfile.mkdtemp()
        self.cache_path = Path(self.temp_dir) / "test_cache.json"
        self.cache = RuntimeBindingCache(str(self.cache_path))

        execution_engine = ExecutionEngine(binding_cache=self.cache)
        self.validator = InferenceValidator(
            binding_cache=self.cache,
            execution_engine=execution_engine
        )

    def teardown_method(self):
        """Cleanup temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_validate_with_no_binding(self):
        """Test validation returns NEEDS_MORE_DATA when no binding"""
        import asyncio

        pattern = ReplicatedPattern(
            pattern_name="test_pattern",
            source_entities=["source1"],
            success_rate=0.8,
            confidence=0.85,
            target_entities=["target1"]
        )

        validation = asyncio.run(self.validator.validate_replicated_pattern(
            pattern=pattern,
            target_entity_id="nonexistent",
            target_entity_name="Nonexistent",
            template_id="test_template"
        ))

        assert validation.validation_status == "NEEDS_MORE_DATA"
        assert "No binding found" in validation.rationale

    def test_validate_creates_binding(self):
        """Test validation creates binding if needed"""
        import asyncio

        # Create binding first
        binding = RuntimeBinding(
            template_id="test_template",
            entity_id="target1",
            entity_name="Target Entity"
        )

        self.cache.set_binding(binding)

        pattern = ReplicatedPattern(
            pattern_name="test_pattern",
            source_entities=["source1"],
            success_rate=0.8,
            confidence=0.85,
            target_entities=["target1"]
        )

        # This will execute the binding
        validation = asyncio.run(self.validator.validate_replicated_pattern(
            pattern=pattern,
            target_entity_id="target1",
            target_entity_name="Target Entity",
            template_id="test_template"
        ))

        assert validation is not None
        assert validation.target_entity == "target1"

    def test_validate_batch(self):
        """Test validating batch of patterns and entities"""
        import asyncio

        # Create bindings
        for i in range(3):
            binding = RuntimeBinding(
                template_id="test_template",
                entity_id=f"entity_{i}",
                entity_name=f"Entity {i}"
            )
            self.cache.set_binding(binding)

        patterns = [
            ReplicatedPattern(
                pattern_name="pattern1",
                source_entities=["source1"],
                success_rate=0.8,
                confidence=0.85,
                target_entities=["entity_0", "entity_1", "entity_2"]
            )
        ]

        target_entities = [(f"entity_{i}", f"Entity {i}") for i in range(3)]

        # Validate batch
        results = asyncio.run(self.validator.validate_batch(
            patterns=patterns,
            target_entities=target_entities,
            template_id="test_template"
        ))

        assert len(results) == 3  # One validation per entity

    def test_get_validation_summary(self):
        """Test getting validation summary"""
        validations = [
            InferenceValidation(
                pattern_name="pattern1",
                target_entity="entity1",
                validation_status="VALID",
                confidence_before=0.8,
                confidence_after=0.75,
                signals_found=2,
                execution_result=None,
                validated_at="2026-01-29T00:00:00",
                rationale="Validation successful"
            ),
            InferenceValidation(
                pattern_name="pattern1",
                target_entity="entity2",
                validation_status="INVALID",
                confidence_before=0.8,
                confidence_after=0.8,
                signals_found=0,
                execution_result=None,
                validated_at="2026-01-29T00:00:00",
                rationale="No signals found"
            ),
            InferenceValidation(
                pattern_name="pattern1",
                target_entity="entity3",
                validation_status="NEEDS_MORE_DATA",
                confidence_before=0.8,
                confidence_after=0.8,
                signals_found=1,
                execution_result=None,
                validated_at="2026-01-29T00:00:00",
                rationale="Need more data"
            )
        ]

        summary = self.validator.get_validation_summary(validations)

        assert summary["total_validations"] == 3
        assert summary["valid"] == 1
        assert summary["invalid"] == 1
        assert summary["needs_more_data"] == 1


class TestConfidenceDiscount:
    """Test confidence discount for replicated patterns"""

    def test_default_discount(self):
        """Test default confidence discount is -0.1"""
        engine = PatternReplicationEngine()
        assert engine.confidence_discount == -0.1

    def test_custom_discount(self):
        """Test custom confidence discount"""
        engine = PatternReplicationEngine(confidence_discount=-0.2)
        assert engine.confidence_discount == -0.2

    def test_applied_to_pattern(self):
        """Test discount is applied to replicated pattern"""
        pattern = ReplicatedPattern(
            pattern_name="test",
            source_entities=["e1"],
            success_rate=0.8,
            confidence=0.9,
            target_entities=["e2"],
            confidence_discount=-0.1
        )

        assert pattern.effective_confidence == 0.8  # 0.9 - 0.1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
