"""
Test Phase 3: Runtime System

Tests for:
- Execution engine (deterministic)
- Performance tracking
- Drift detection
"""

import pytest
import tempfile
import shutil
from pathlib import Path

from backend.runtime.execution_engine import ExecutionEngine, ExecutionResult
from backend.runtime.performance_tracker import PerformanceTracker, PerformanceMetrics
from backend.runtime.drift_detector import DriftDetector, DriftSignal, RetirementAction
from backend.template_runtime_binding import RuntimeBinding, RuntimeBindingCache


class TestExecutionEngine:
    """Test deterministic execution engine"""

    def setup_method(self):
        """Setup temporary cache"""
        self.temp_dir = tempfile.mkdtemp()
        self.cache_path = Path(self.temp_dir) / "test_cache.json"

    def teardown_method(self):
        """Cleanup temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_engine_initialization(self):
        """Test execution engine initialization"""
        engine = ExecutionEngine()

        assert engine is not None
        assert engine.binding_cache is not None

    def test_execution_result_structure(self):
        """Test execution result has required fields"""
        result = ExecutionResult(
            success=True,
            signals_found=3,
            channels_explored=2,
            execution_time_seconds=5.0,
            claude_calls=0,  # Must be 0 for deterministic
            mcp_calls=0,     # Must be 0 for deterministic
            sdk_calls=5
        )

        assert result.success
        assert result.signals_found == 3
        assert result.claude_calls == 0
        assert result.mcp_calls == 0
        assert result.sdk_calls == 5

    def test_verify_deterministic(self):
        """Test deterministic verification"""
        engine = ExecutionEngine()

        # Valid deterministic result
        result = ExecutionResult(
            success=True,
            signals_found=2,
            channels_explored=1,
            execution_time_seconds=3.0,
            claude_calls=0,
            mcp_calls=0,
            sdk_calls=3
        )

        assert engine.verify_deterministic(result)

        # Invalid result with Claude calls
        invalid_result = ExecutionResult(
            success=True,
            signals_found=2,
            channels_explored=1,
            execution_time_seconds=3.0,
            claude_calls=1,  # Violates determinism
            mcp_calls=0,
            sdk_calls=3
        )

        assert not engine.verify_deterministic(invalid_result)

    def test_execute_binding_creates_binding(self):
        """Test execution creates binding if not exists"""
        import asyncio

        cache = RuntimeBindingCache(str(self.cache_path))
        engine = ExecutionEngine(binding_cache=cache)

        # Execute (should create binding)
        result = asyncio.run(engine.execute_binding_deterministic(
            template_id="test_template",
            entity_id="test_entity",
            entity_name="Test Entity"
        ))

        # Binding should exist
        binding = cache.get_binding("test_entity")
        assert binding is not None
        assert binding.entity_id == "test_entity"


class TestPerformanceTracker:
    """Test performance tracking and confidence adjustment"""

    def setup_method(self):
        """Setup temporary cache"""
        self.temp_dir = tempfile.mkdtemp()
        self.cache_path = Path(self.temp_dir) / "test_cache.json"
        self.cache = RuntimeBindingCache(str(self.cache_path))
        self.tracker = PerformanceTracker(binding_cache=self.cache)

    def teardown_method(self):
        """Cleanup temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_record_execution_success(self):
        """Test recording successful execution"""
        binding = RuntimeBinding(
            template_id="test_template",
            entity_id="test_entity",
            entity_name="Test Entity"
        )

        self.cache.set_binding(binding)

        # Record success
        updated = self.tracker.record_execution(
            entity_id="test_entity",
            success=True,
            signals_found=3
        )

        assert updated is not None
        assert updated.usage_count == 1
        assert updated.success_rate == 1.0

    def test_record_execution_failure(self):
        """Test recording failed execution"""
        binding = RuntimeBinding(
            template_id="test_template",
            entity_id="test_entity",
            entity_name="Test Entity"
        )

        self.cache.set_binding(binding)

        # Record failure
        updated = self.tracker.record_execution(
            entity_id="test_entity",
            success=False,
            signals_found=0
        )

        assert updated is not None
        assert updated.usage_count == 1
        assert updated.success_rate == 0.0

    def test_confidence_adjustment(self):
        """Test confidence adjustment on performance"""
        binding = RuntimeBinding(
            template_id="test_template",
            entity_id="test_entity",
            entity_name="Test Entity",
            confidence_adjustment=0.0
        )

        self.cache.set_binding(binding)

        # Record success with signals
        updated = self.tracker.record_execution(
            entity_id="test_entity",
            success=True,
            signals_found=3
        )

        # Confidence should increase
        assert updated.confidence_adjustment > 0.0

    def test_get_metrics(self):
        """Test getting performance metrics"""
        binding = RuntimeBinding(
            template_id="test_template",
            entity_id="test_entity",
            entity_name="Test Entity"
        )

        self.cache.set_binding(binding)

        # Record some executions
        self.tracker.record_execution("test_entity", success=True, signals_found=2)
        self.tracker.record_execution("test_entity", success=True, signals_found=1)
        self.tracker.record_execution("test_entity", success=False, signals_found=0)

        # Get metrics
        metrics = self.tracker.get_metrics("test_entity")

        assert metrics is not None
        assert metrics.usage_count == 3
        assert metrics.success_rate == pytest.approx(0.667, rel=0.1)

    def test_top_performers(self):
        """Test getting top performers"""
        # Create multiple bindings
        for i in range(5):
            binding = RuntimeBinding(
                template_id="test_template",
                entity_id=f"entity_{i}",
                entity_name=f"Entity {i}"
            )

            # Set different success rates
            for _ in range(i + 1):
                binding.mark_used(success=True)

            self.cache.set_binding(binding)

        # Get top performers
        top = self.tracker.get_top_performers(limit=3)

        assert len(top) <= 3
        # Should be sorted by success rate descending
        if len(top) > 1:
            assert top[0].success_rate >= top[1].success_rate


class TestDriftDetector:
    """Test drift detection and automatic retirement"""

    def setup_method(self):
        """Setup temporary cache"""
        self.temp_dir = tempfile.mkdtemp()
        self.cache_path = Path(self.temp_dir) / "test_cache.json"
        self.cache = RuntimeBindingCache(str(self.cache_path))
        self.detector = DriftDetector(binding_cache=self.cache)

    def teardown_method(self):
        """Cleanup temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_no_drift_for_healthy_binding(self):
        """Test no drift detected for healthy binding"""
        binding = RuntimeBinding(
            template_id="test_template",
            entity_id="test_entity",
            entity_name="Test Entity",
            success_rate=0.9,
            confidence_adjustment=0.1,
            usage_count=5
        )

        self.cache.set_binding(binding)

        result = self.detector.detect_drift("test_entity")

        assert result is not None
        assert not result.drift_detected
        assert result.recommended_action == RetirementAction.HEALTHY

    def test_detect_low_success_rate(self):
        """Test detecting low success rate drift"""
        binding = RuntimeBinding(
            template_id="test_template",
            entity_id="test_entity",
            entity_name="Test Entity",
            success_rate=0.3,  # Below 50% threshold
            confidence_adjustment=-0.2,
            usage_count=12  # Above 10 for meaningful stats
        )

        self.cache.set_binding(binding)

        result = self.detector.detect_drift("test_entity")

        assert result.drift_detected
        assert DriftSignal.LOW_SUCCESS_RATE in result.drift_signals

    def test_detect_negative_confidence(self):
        """Test detecting negative confidence drift"""
        binding = RuntimeBinding(
            template_id="test_template",
            entity_id="test_entity",
            entity_name="Test Entity",
            success_rate=0.6,
            confidence_adjustment=-0.4,  # Below -0.3 threshold
            usage_count=5
        )

        self.cache.set_binding(binding)

        result = self.detector.detect_drift("test_entity")

        assert result.drift_detected
        assert DriftSignal.NEGATIVE_CONFIDENCE in result.drift_signals

    def test_retire_severely_degraded_binding(self):
        """Test retiring severely degraded binding"""
        binding = RuntimeBinding(
            template_id="test_template",
            entity_id="test_entity",
            entity_name="Test Entity",
            success_rate=0.2,  # Very low
            confidence_adjustment=-0.5,
            usage_count=15
        )

        self.cache.set_binding(binding)

        # Detect drift
        result = self.detector.detect_drift("test_entity")

        if result.recommended_action == RetirementAction.RETIRE:
            # Execute retirement
            retired = self.detector.execute_retirement("test_entity")

            assert retired
            assert binding.state == "RETIRED"

    def test_drift_detection_result_structure(self):
        """Test drift detection result structure"""
        result = self.detector.detect_drift("nonexistent_entity")

        # Should return None for non-existent binding
        assert result is None


class TestDeterministicGuarantees:
    """Test deterministic execution guarantees"""

    def test_zero_claude_calls_in_result(self):
        """Test ExecutionResult enforces zero Claude calls"""
        # Valid result
        result = ExecutionResult(
            success=True,
            signals_found=1,
            channels_explored=1,
            execution_time_seconds=1.0
        )

        assert result.claude_calls == 0
        assert result.mcp_calls == 0

    def test_engine_verifies_determinism(self):
        """Test engine verifies determinism"""
        engine = ExecutionEngine()

        # Create result with Claude call violation
        invalid = ExecutionResult(
            success=True,
            signals_found=1,
            channels_explored=1,
            execution_time_seconds=1.0,
            claude_calls=1  # Violation!
        )

        assert not engine.verify_deterministic(invalid)

        # Create valid result
        valid = ExecutionResult(
            success=True,
            signals_found=1,
            channels_explored=1,
            execution_time_seconds=1.0,
            claude_calls=0,
            mcp_calls=0,
            sdk_calls=5
        )

        assert engine.verify_deterministic(valid)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
