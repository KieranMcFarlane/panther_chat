"""
Hypothesis LRU Cache with TTL and Memory Limits

Implements an in-memory LRU cache for hypothesis data with:
- Time-based invalidation (TTL)
- Memory usage tracking and limits
- Thread-safe operations
- Access frequency tracking
- Statistics collection

Part of Phase 5: Scalable Schema
"""

import time
import threading
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from collections import OrderedDict
from functools import wraps
import logging

logger = logging.getLogger(__name__)


@dataclass
class CacheConfig:
    """Configuration for the hypothesis cache"""
    max_size_mb: int = 100  # Maximum cache size in MB
    ttl_minutes: int = 60   # Time-to-live for cache entries
    prefetch_enabled: bool = True  # Enable prefetching
    statistics_enabled: bool = True  # Enable statistics collection
    cleanup_interval_seconds: int = 300  # How often to clean expired entries


@dataclass
class CacheStatistics:
    """Cache performance statistics"""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    size_bytes: int = 0
    item_count: int = 0
    access_frequency: Dict[str, int] = field(default_factory=dict)

    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate"""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

    @property
    def size_mb(self) -> float:
        """Get cache size in MB"""
        return self.size_bytes / (1024 * 1024)


class HypothesisLRUCache:
    """
    Thread-safe LRU cache with TTL for hypothesis data.

    Features:
    - LRU eviction when memory limit reached
    - TTL-based invalidation
    - Access frequency tracking
    - Statistics collection
    - Thread-safe operations
    """

    def __init__(self, config: CacheConfig = None):
        """Initialize the cache with configuration"""
        self.config = config or CacheConfig()
        self._cache: OrderedDict[str, Dict] = OrderedDict()
        self._timestamps: Dict[str, float] = {}
        self._access_count: Dict[str, int] = {}
        self._stats = CacheStatistics()
        self._lock = threading.RLock()
        self._max_size_bytes = self.config.max_size_mb * 1024 * 1024

        logger.info(
            f"Initialized HypothesisLRUCache: "
            f"max_size={self.config.max_size_mb}MB, "
            f"ttl={self.config.ttl_minutes}min"
        )

    async def get(self, hypothesis_id: str) -> Optional[Dict]:
        """
        Get hypothesis from cache.

        Args:
            hypothesis_id: Unique hypothesis identifier

        Returns:
            Cached hypothesis data if exists and valid, None otherwise
        """
        with self._lock:
            # Check if exists
            if hypothesis_id not in self._cache:
                if self.config.statistics_enabled:
                    self._stats.misses += 1
                return None

            # Check TTL
            timestamp = self._timestamps.get(hypothesis_id, 0)
            age_seconds = time.time() - timestamp
            ttl_seconds = self.config.ttl_minutes * 60

            if age_seconds > ttl_seconds:
                # Expired
                self._remove_entry(hypothesis_id)
                if self.config.statistics_enabled:
                    self._stats.misses += 1
                logger.debug(f"Cache entry expired: {hypothesis_id}")
                return None

            # Cache hit - move to end (most recently used)
            self._cache.move_to_end(hypothesis_id)

            # Update access statistics
            if self.config.statistics_enabled:
                self._stats.hits += 1
                self._access_count[hypothesis_id] = self._access_count.get(hypothesis_id, 0) + 1
                self._stats.access_frequency[hypothesis_id] = self._access_count[hypothesis_id]

            return self._cache[hypothesis_id].copy()

    async def set(self, hypothesis_id: str, data: Dict) -> None:
        """
        Store hypothesis in cache.

        Args:
            hypothesis_id: Unique hypothesis identifier
            data: Hypothesis data to cache
        """
        with self._lock:
            # Calculate size
            import sys
            data_size = sys.getsizeof(data)

            # Check if updating existing entry
            if hypothesis_id in self._cache:
                # Remove old size
                old_size = sys.getsizeof(self._cache[hypothesis_id])
                self._stats.size_bytes -= old_size

            # Check if we need to evict
            while (self._stats.size_bytes + data_size) > self._max_size_bytes and self._cache:
                # Evict least recently used
                lru_id, lru_data = self._cache.popitem(last=False)
                lru_size = sys.getsizeof(lru_data)
                self._stats.size_bytes -= lru_size
                self._stats.item_count -= 1
                self._stats.evictions += 1

                # Clean up metadata
                self._timestamps.pop(lru_id, None)
                self._access_count.pop(lru_id, None)

                logger.debug(f"Evicted LRU entry: {lru_id}")

            # Add new entry
            self._cache[hypothesis_id] = data
            self._timestamps[hypothesis_id] = time.time()
            self._access_count[hypothesis_id] = 0
            self._stats.size_bytes += data_size
            self._stats.item_count += 1

            # Move to end (most recently used)
            self._cache.move_to_end(hypothesis_id)

    async def get_batch(self, hypothesis_ids: List[str]) -> Dict[str, Dict]:
        """
        Get multiple hypotheses from cache.

        Args:
            hypothesis_ids: List of hypothesis identifiers

        Returns:
            Dict mapping hypothesis_id to cached data (only cache hits)
        """
        results = {}
        for hypothesis_id in hypothesis_ids:
            data = await self.get(hypothesis_id)
            if data:
                results[hypothesis_id] = data
        return results

    async def prefetch(self, hypothesis_ids: List[str], repo) -> int:
        """
        Prefetch hypotheses into cache.

        Args:
            hypothesis_ids: List of hypothesis identifiers to prefetch
            repo: HypothesisRepository to load from

        Returns:
            Number of hypotheses successfully prefetched
        """
        if not self.config.prefetch_enabled:
            return 0

        prefetched = 0
        for hypothesis_id in hypothesis_ids:
            # Skip if already in cache
            if hypothesis_id in self._cache:
                continue

            try:
                # Load from repository
                hypothesis = await repo.get_hypothesis(hypothesis_id)
                if hypothesis:
                    # Convert to dict for caching
                    from dataclasses import asdict
                    await self.set(hypothesis_id, asdict(hypothesis))
                    prefetched += 1
            except Exception as e:
                logger.warning(f"Failed to prefetch {hypothesis_id}: {e}")

        logger.info(f"Prefetched {prefetched}/{len(hypothesis_ids)} hypotheses")
        return prefetched

    async def invalidate(self, hypothesis_id: str) -> bool:
        """
        Invalidate a specific cache entry.

        Args:
            hypothesis_id: Hypothesis identifier to invalidate

        Returns:
            True if entry was invalidated, False if not found
        """
        with self._lock:
            if hypothesis_id not in self._cache:
                return False

            self._remove_entry(hypothesis_id)
            logger.debug(f"Invalidated cache entry: {hypothesis_id}")
            return True

    async def clear(self) -> None:
        """Clear all cache entries"""
        with self._lock:
            self._cache.clear()
            self._timestamps.clear()
            self._access_count.clear()
            self._stats.size_bytes = 0
            self._stats.item_count = 0
            logger.info("Cache cleared")

    def get_statistics(self) -> CacheStatistics:
        """
        Get current cache statistics.

        Returns:
            CacheStatistics object with current metrics
        """
        with self._lock:
            # Create a copy to avoid external modification
            stats = CacheStatistics(
                hits=self._stats.hits,
                misses=self._stats.misses,
                evictions=self._stats.evictions,
                size_bytes=self._stats.size_bytes,
                item_count=self._stats.item_count,
                access_frequency=self._stats.access_frequency.copy()
            )
            return stats

    def _remove_entry(self, hypothesis_id: str) -> None:
        """Remove entry from cache and update stats (must be called with lock held)"""
        if hypothesis_id in self._cache:
            data = self._cache.pop(hypothesis_id)
            size = len(str(data))  # Approximate size
            self._stats.size_bytes -= size
            self._stats.item_count -= 1

            # Clean up metadata
            self._timestamps.pop(hypothesis_id, None)
            self._access_count.pop(hypothesis_id, None)
            self._stats.access_frequency.pop(hypothesis_id, None)

    async def cleanup_expired(self) -> int:
        """
        Remove expired entries from cache.

        Returns:
            Number of entries removed
        """
        with self._lock:
            current_time = time.time()
            ttl_seconds = self.config.ttl_minutes * 60
            expired = []

            for hypothesis_id, timestamp in self._timestamps.items():
                age_seconds = current_time - timestamp
                if age_seconds > ttl_seconds:
                    expired.append(hypothesis_id)

            for hypothesis_id in expired:
                self._remove_entry(hypothesis_id)

            if expired:
                logger.info(f"Cleaned up {len(expired)} expired cache entries")

            return len(expired)

    def get_top_accessed(self, limit: int = 10) -> List[tuple[str, int]]:
        """
        Get most frequently accessed hypotheses.

        Args:
            limit: Maximum number of results

        Returns:
            List of (hypothesis_id, access_count) tuples sorted by frequency
        """
        with self._lock:
            sorted_items = sorted(
                self._access_count.items(),
                key=lambda x: x[1],
                reverse=True
            )
            return sorted_items[:limit]


def cached(cache: HypothesisLRUCache, ttl_minutes: int = None):
    """
    Decorator for caching function results.

    Args:
        cache: HypothesisLRUCache instance
        ttl_minutes: Optional TTL override (uses cache config if not specified)

    Usage:
        @cached(cache)
        async def get_hypothesis(hypothesis_id: str):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key from function arguments
            key_parts = [func.__name__] + [str(arg) for arg in args] + [
                f"{k}={v}" for k, v in sorted(kwargs.items())
            ]
            cache_key = ":".join(key_parts)

            # Try cache
            cached_result = await cache.get(cache_key)
            if cached_result is not None:
                return cached_result

            # Call function
            result = await func(*args, **kwargs)

            # Cache result
            if result is not None:
                await cache.set(cache_key, result)

            return result

        return wrapper
    return decorator
