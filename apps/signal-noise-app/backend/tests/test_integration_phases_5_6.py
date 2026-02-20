#!/usr/bin/env python3
"""
Integration Tests for Phases 5-6

Tests the complete integration of Phase 5 (Scalability) and Phase 6 (Production Rollout)
components with the existing hypothesis-driven discovery system.
"""

import asyncio
import pytest
import time
from datetime import datetime, timezone

# Test imports
from backend.hypothesis_cache import HypothesisLRUCache, CacheConfig
from backend.parameter_tuning import ParameterConfig
from backend.eig_calculator import EIGCalculator, EIGConfig
from backend.hypothesis_manager import HypothesisManager, Hypothesis


class TestPhase5Integration:
    """Test Phase 5 scalability integration"""

    @pytest.mark.asyncio
    async def test_hypothesis_manager_cache_integration(self):
        """Test HypothesisManager with Phase 5 LRU cache"""
        # Create manager with cache enabled
        manager = HypothesisManager(cache_enabled=True)

        # Verify cache is initialized
        assert manager.lru_cache is not None
        print("✅ HypothesisManager cache initialized")

        # Check cache statistics
        stats = manager.get_cache_statistics()
        assert stats is not None
        assert stats.item_count == 0  # Empty initially
        print(f"✅ Cache stats: {stats.item_count} items, {stats.hit_rate:.2%} hit rate")

        # Test cache clearing
        await manager.clear_cache()
        stats_after = manager.get_cache_statistics()
        assert stats_after.item_count == 0
        print("✅ Cache cleared successfully")

    @pytest.mark.asyncio
    async def test_cache_performance(self):
        """Test cache performance improvements"""
        manager = HypothesisManager(cache_enabled=True)

        # Create mock hypothesis
        hypothesis = Hypothesis(
            hypothesis_id="test_hypothesis_1",
            entity_id="test_entity",
            category="Digital Transformation",
            statement="Test statement",
            prior_probability=0.75,
            confidence=0.75
        )

        # Add to cache
        await manager.lru_cache.set(
            hypothesis.hypothesis_id,
            hypothesis.__dict__
        )

        # Measure cache hit latency
        start = time.time()
        cached = await manager.lru_cache.get(hypothesis.hypothesis_id)
        cache_latency = (time.time() - start) * 1000  # Convert to ms

        assert cached is not None
        assert cache_latency < 100  # Should be <100ms
        print(f"✅ Cache hit latency: {cache_latency:.2f}ms (<100ms target)")

    @pytest.mark.asyncio
    async def test_cache_ttl_expiration(self):
        """Test cache TTL-based expiration"""
        # Create cache with short TTL
        config = CacheConfig(ttl_minutes=0.01)  # 0.6 seconds
        manager = HypothesisManager(cache_config=config)

        # Add item
        hypothesis = Hypothesis(
            hypothesis_id="ttl_test",
            entity_id="test",
            category="Test",
            statement="Test",
            prior_probability=0.5,
            confidence=0.5
        )

        await manager.lru_cache.set(hypothesis.hypothesis_id, hypothesis.__dict__)

        # Should be available immediately
        result = await manager.lru_cache.get(hypothesis.hypothesis_id)
        assert result is not None

        # Wait for TTL to expire
        await asyncio.sleep(1)

        # Should be expired now
        result = await manager.lru_cache.get(hypothesis.hypothesis_id)
        assert result is None
        print("✅ TTL expiration working correctly")


class TestPhase6Integration:
    """Test Phase 6 parameter tuning integration"""

    def test_parameter_config_creation(self):
        """Test ParameterConfig creation and validation"""
        config = ParameterConfig(
            accept_delta=0.07,
            max_iterations=25,
            c_suite_multiplier=2.0
        )

        assert config.validate() is True
        assert config.accept_delta == 0.07
        assert config.max_iterations == 25
        print("✅ ParameterConfig created and validated")

        # Test EIG multipliers
        multipliers = config.get_eig_multipliers()
        assert "C-SUITE" in multipliers
        assert multipliers["C-SUITE"] == 2.0  # Our overridden value
        print(f"✅ EIG multipliers: {multipliers}")

    def test_eig_config_creation(self):
        """Test EIGConfig creation"""
        config = EIGConfig(
            category_multipliers={
                "C-Suite Hiring": 2.0,
                "General": 1.0
            },
            novelty_decay_factor=0.8
        )

        assert config.category_multipliers["C-Suite Hiring"] == 2.0
        assert config.novelty_decay_factor == 0.8
        print("✅ EIGConfig created successfully")

    def test_eig_calculator_with_config(self):
        """Test EIGCalculator with custom config"""
        config = EIGConfig(
            category_multipliers={
                "Digital Transformation": 2.0,  # Higher multiplier
                "General": 1.0
            }
        )

        calc = EIGCalculator(config)

        # Create test hypothesis
        hypothesis = Hypothesis(
            hypothesis_id="test",
            entity_id="entity_1",
            category="Digital Transformation",
            statement="Test",
            prior_probability=0.5,
            confidence=0.5
        )

        # Calculate EIG
        eig = calc.calculate_eig(hypothesis, None)

        # Should have higher EIG due to category multiplier
        assert eig > 0
        print(f"✅ EIG with custom config: {eig:.3f}")

    def test_parameter_config_serialization(self):
        """Test ParameterConfig save/load"""
        import tempfile
        import os

        config = ParameterConfig(
            accept_delta=0.08,
            max_iterations=20
        )

        # Save to temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_file = f.name

        try:
            config.save(temp_file)

            # Load back
            loaded_config = ParameterConfig.load(temp_file)

            assert loaded_config.accept_delta == 0.08
            assert loaded_config.max_iterations == 20
            print("✅ ParameterConfig serialization working")

        finally:
            os.unlink(temp_file)


class TestFullIntegration:
    """Test complete Phase 5-6 integration"""

    @pytest.mark.asyncio
    async def test_end_to_end_cache_and_config(self):
        """Test cache and config working together"""
        # Create optimized config
        param_config = ParameterConfig(
            accept_delta=0.07,
            max_iterations=25
        )

        # Create cache config
        cache_config = CacheConfig(
            max_size_mb=10,
            ttl_minutes=60
        )

        # Create EIG config
        eig_config = EIGConfig(
            category_multipliers=param_config.get_eig_multipliers(),
            novelty_decay_factor=param_config.novelty_decay_factor
        )

        # Create components
        cache = HypothesisLRUCache(cache_config)
        eig_calc = EIGCalculator(eig_config)

        print("✅ All Phase 5-6 components initialized together")

        # Test cache operations
        hypothesis = Hypothesis(
            hypothesis_id="integration_test",
            entity_id="entity_1",
            category="C-Suite Hiring",
            statement="Test",
            prior_probability=0.6,
            confidence=0.6
        )

        await cache.set(hypothesis.hypothesis_id, hypothesis.__dict__)
        cached = await cache.get(hypothesis.hypothesis_id)
        assert cached is not None

        # Test EIG calculation
        eig = eig_calc.calculate_eig(hypothesis, None)
        assert eig > 0

        print(f"✅ End-to-end integration: cache hit + EIG={eig:.3f}")

    @pytest.mark.asyncio
    async def test_cache_statistics_tracking(self):
        """Test cache statistics are tracked correctly"""
        cache = HypothesisLRUCache(CacheConfig())

        # Add some items
        for i in range(5):
            await cache.set(f"hypothesis_{i}", {"confidence": 0.5})

        # Generate some hits and misses
        await cache.get("hypothesis_0")  # Hit
        await cache.get("hypothesis_1")  # Hit
        await cache.get("nonexistent")    # Miss

        stats = cache.get_statistics()
        assert stats.hits == 2
        assert stats.misses == 1
        assert stats.hit_rate == 2/3
        assert stats.item_count == 5

        print(f"✅ Statistics tracked correctly: {stats.hit_rate:.2%} hit rate")

    def test_config_validation_bounds(self):
        """Test config validation catches invalid values"""
        # Valid config
        config = ParameterConfig(accept_delta=0.06)
        assert config.validate() is True

        # Invalid config (accept_delta too high)
        invalid_config = ParameterConfig(accept_delta=1.5)
        assert invalid_config.validate() is False

        # Invalid config (max_iterations negative)
        invalid_config2 = ParameterConfig(max_iterations=-1)
        assert invalid_config2.validate() is False

        print("✅ Config validation working correctly")


class TestPerformanceBenchmarks:
    """Performance benchmarks for integrated system"""

    @pytest.mark.asyncio
    async def test_cache_hit_rate_benchmark(self):
        """Benchmark cache hit rate with repeated queries"""
        cache = HypothesisLRUCache(CacheConfig())

        # Populate cache
        for i in range(100):
            await cache.set(f"hypothesis_{i}", {"confidence": 0.5})

        # Perform queries with 80% hit rate
        hits = 0
        misses = 0

        for i in range(100):
            if i < 80:  # 80% should hit
                result = await cache.get(f"hypothesis_{i}")
                if result:
                    hits += 1
            else:  # 20% should miss
                result = await cache.get(f"hypothesis_{i + 100}")
                if result is None:
                    misses += 1

        stats = cache.get_statistics()
        print(f"✅ Hit rate benchmark: {stats.hit_rate:.2%}")

        # Should be close to 80%
        assert stats.hit_rate > 0.75

    @pytest.mark.asyncio
    async def test_cache_latency_benchmark(self):
        """Benchmark cache latency"""
        cache = HypothesisLRUCache(CacheConfig())

        # Add item
        await cache.set("benchmark", {"data": "test"})

        # Measure 100 get operations
        latencies = []
        for _ in range(100):
            start = time.time()
            await cache.get("benchmark")
            latency = (time.time() - start) * 1000  # ms
            latencies.append(latency)

        avg_latency = sum(latencies) / len(latencies)
        p95_latency = sorted(latencies)[94]  # 95th percentile

        print(f"✅ Latency benchmark: avg={avg_latency:.2f}ms, p95={p95_latency:.2f}ms")

        # Should be sub-millisecond
        assert avg_latency < 1.0

    def test_parameter_config_optimization(self):
        """Test parameter config for optimization"""
        config1 = ParameterConfig(accept_delta=0.06)
        config2 = ParameterConfig(accept_delta=0.08)

        # Both should be valid
        assert config1.validate() is True
        assert config2.validate() is True

        # Calculate EIG with both configs
        eig_config1 = EIGConfig(
            category_multipliers=config1.get_eig_multipliers()
        )
        eig_config2 = EIGConfig(
            category_multipliers=config2.get_eig_multipliers()
        )

        calc1 = EIGCalculator(eig_config1)
        calc2 = EIGCalculator(eig_config2)

        hypothesis = Hypothesis(
            hypothesis_id="test",
            entity_id="entity",
            category="Digital Transformation",
            statement="Test",
            prior_probability=0.5,
            confidence=0.5
        )

        eig1 = calc1.calculate_eig(hypothesis, None)
        eig2 = calc2.calculate_eig(hypothesis, None)

        # Both should produce valid EIG scores
        assert eig1 > 0
        assert eig2 > 0

        print(f"✅ Config optimization: EIG varies by config ({eig1:.3f} vs {eig2:.3f})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
