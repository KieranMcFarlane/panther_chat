"""
Unit Tests for Hypothesis Cache

Tests the LRU cache implementation with TTL and memory limits.
"""

import asyncio
import pytest
import time
from backend.hypothesis_cache import (
    HypothesisLRUCache,
    CacheConfig,
    CacheStatistics,
    cached
)


@pytest.fixture
def cache_config():
    """Default cache configuration for testing"""
    return CacheConfig(
        max_size_mb=1,  # Small for testing
        ttl_minutes=1,  # 1 minute TTL
        prefetch_enabled=True,
        statistics_enabled=True
    )


@pytest.fixture
def cache(cache_config):
    """Cache instance for testing"""
    return HypothesisLRUCache(cache_config)


@pytest.mark.asyncio
async def test_cache_set_and_get(cache):
    """Test basic set and get operations"""
    hypothesis_id = "test_hypothesis_1"
    data = {
        "hypothesis_id": hypothesis_id,
        "entity_id": "entity_1",
        "confidence": 0.8
    }

    # Set
    await cache.set(hypothesis_id, data)

    # Get
    result = await cache.get(hypothesis_id)

    assert result is not None
    assert result["hypothesis_id"] == hypothesis_id
    assert result["confidence"] == 0.8


@pytest.mark.asyncio
async def test_cache_miss(cache):
    """Test cache miss returns None"""
    result = await cache.get("nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_cache_ttl(cache):
    """Test TTL-based invalidation"""
    # Create cache with short TTL
    config = CacheConfig(ttl_minutes=0.01)  # 0.6 seconds
    short_cache = HypothesisLRUCache(config)

    hypothesis_id = "test_hypothesis_1"
    data = {"hypothesis_id": hypothesis_id, "confidence": 0.8}

    # Set
    await short_cache.set(hypothesis_id, data)

    # Immediate get should work
    result = await short_cache.get(hypothesis_id)
    assert result is not None

    # Wait for TTL to expire
    await asyncio.sleep(1)

    # Should be expired now
    result = await short_cache.get(hypothesis_id)
    assert result is None


@pytest.mark.asyncio
async def test_cache_lru_eviction():
    """Test LRU eviction when memory limit reached"""
    # Create very small cache
    config = CacheConfig(max_size_mb=0.001)  # 1 KB
    small_cache = HypothesisLRUCache(config)

    # Add items until eviction happens
    for i in range(100):
        hypothesis_id = f"hypothesis_{i}"
        data = {
            "hypothesis_id": hypothesis_id,
            "data": "x" * 100  # 100 bytes
        }
        await small_cache.set(hypothesis_id, data)

    # Check that eviction occurred
    stats = small_cache.get_statistics()
    assert stats.evictions > 0


@pytest.mark.asyncio
async def test_cache_statistics(cache):
    """Test statistics tracking"""
    # Add some items
    await cache.set("hypothesis_1", {"confidence": 0.8})
    await cache.set("hypothesis_2", {"confidence": 0.6})

    # Hit
    await cache.get("hypothesis_1")

    # Miss
    await cache.get("nonexistent")

    # Check stats
    stats = cache.get_statistics()
    assert stats.hits == 1
    assert stats.misses == 1
    assert stats.hit_rate == 0.5
    assert stats.item_count == 2


@pytest.mark.asyncio
async def test_cache_batch_get(cache):
    """Test batch get operation"""
    # Add multiple items
    hypothesis_ids = []
    for i in range(5):
        hypothesis_id = f"hypothesis_{i}"
        hypothesis_ids.append(hypothesis_id)
        await cache.set(hypothesis_id, {"confidence": 0.5 + i * 0.1})

    # Batch get
    results = await cache.get_batch(hypothesis_ids + ["nonexistent"])

    assert len(results) == 5
    assert "hypothesis_0" in results
    assert "nonexistent" not in results


@pytest.mark.asyncio
async def test_cache_invalidation(cache):
    """Test manual cache invalidation"""
    hypothesis_id = "test_hypothesis_1"
    await cache.set(hypothesis_id, {"confidence": 0.8})

    # Invalidate
    result = await cache.invalidate(hypothesis_id)
    assert result is True

    # Should be gone
    data = await cache.get(hypothesis_id)
    assert data is None


@pytest.mark.asyncio
async def test_cache_clear(cache):
    """Test clearing all cache entries"""
    # Add items
    await cache.set("hypothesis_1", {"confidence": 0.8})
    await cache.set("hypothesis_2", {"confidence": 0.6})

    # Clear
    await cache.clear()

    # Check stats
    stats = cache.get_statistics()
    assert stats.item_count == 0


@pytest.mark.asyncio
async def test_cache_cleanup_expired(cache):
    """Test automatic cleanup of expired entries"""
    # Create cache with short TTL
    config = CacheConfig(ttl_minutes=0.01)
    short_cache = HypothesisLRUCache(config)

    # Add items
    for i in range(10):
        await short_cache.set(f"hypothesis_{i}", {"confidence": 0.5})

    # Wait for expiry
    await asyncio.sleep(1)

    # Cleanup
    removed = await short_cache.cleanup_expired()
    assert removed == 10


@pytest.mark.asyncio
async def test_cache_top_accessed(cache):
    """Test tracking most accessed items"""
    # Add items with varying access frequency
    await cache.set("hypothesis_1", {"confidence": 0.8})
    await cache.set("hypothesis_2", {"confidence": 0.6})
    await cache.set("hypothesis_3", {"confidence": 0.4})

    # Access with different frequencies
    for _ in range(10):
        await cache.get("hypothesis_1")

    for _ in range(5):
        await cache.get("hypothesis_2")

    for _ in range(2):
        await cache.get("hypothesis_3")

    # Get top accessed
    top = cache.get_top_accessed(limit=3)

    assert len(top) == 3
    assert top[0][0] == "hypothesis_1"
    assert top[0][1] == 10
    assert top[1][0] == "hypothesis_2"
    assert top[1][1] == 5


@pytest.mark.asyncio
async def test_cached_decorator():
    """Test @cached decorator"""
    cache = HypothesisLRUCache(CacheConfig(ttl_minutes=1))

    # Define function with decorator
    @cached(cache)
    async def get_hypothesis(hypothesis_id: str):
        # Simulate expensive operation
        await asyncio.sleep(0.1)
        return {"hypothesis_id": hypothesis_id, "computed": True}

    # First call - should compute
    start = time.time()
    result1 = await get_hypothesis("test_1")
    duration1 = time.time() - start

    # Second call - should hit cache
    start = time.time()
    result2 = await get_hypothesis("test_1")
    duration2 = time.time() - start

    assert result1["computed"] is True
    assert result2["computed"] is True
    assert duration2 < duration1  # Cache hit should be faster


@pytest.mark.asyncio
async def test_cache_concurrent_access(cache):
    """Test thread-safe concurrent access"""
    hypothesis_id = "concurrent_test"

    # Concurrent sets
    tasks = []
    for i in range(100):
        data = {"hypothesis_id": hypothesis_id, "value": i}
        tasks.append(cache.set(hypothesis_id, data))

    await asyncio.gather(*tasks)

    # Should have last value
    result = await cache.get(hypothesis_id)
    assert result is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
