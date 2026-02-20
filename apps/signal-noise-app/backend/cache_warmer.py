"""
Cache Warming Strategy for Hypothesis System

Implements proactive cache population to improve hit rates
and reduce query latency for commonly accessed data.

Strategies:
- Recent entity access patterns
- Cluster hotspots (high discovery activity)
- Template popularity
- Background periodic warming

Part of Phase 5: Scalable Schema
"""

import asyncio
import logging
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import Counter

logger = logging.getLogger(__name__)


@dataclass
class WarmingConfig:
    """Configuration for cache warming"""
    # Warming intervals (minutes)
    recent_window_hours: int = 24
    background_interval_minutes: int = 15

    # Warming limits
    recent_entity_limit: int = 100
    cluster_hotspot_limit: int = 50
    template_popularity_limit: int = 10

    # Enable/disable strategies
    enable_recent_warming: bool = True
    enable_cluster_warming: bool = True
    enable_template_warming: bool = True
    enable_background_warming: bool = True


@dataclass
class WarmingStatistics:
    """Statistics for cache warming operations"""
    total_warmed: int = 0
    recent_entities_warmed: int = 0
    cluster_hotspots_warmed: int = 0
    template_popularity_warmed: int = 0
    last_warming_time: Optional[datetime] = None
    warming_frequency: Dict[str, int] = field(default_factory=dict)

    def reset(self):
        """Reset statistics"""
        self.total_warmed = 0
        self.recent_entities_warmed = 0
        self.cluster_hotspots_warmed = 0
        self.template_popularity_warmed = 0
        self.warming_frequency.clear()


class CacheWarmer:
    """
    Proactive cache warming to improve hit rates.

    Monitors access patterns and preloads likely queries
    into the cache to reduce latency.
    """

    def __init__(self, cache, repository, config: WarmingConfig = None):
        """
        Initialize cache warmer.

        Args:
            cache: HypothesisLRUCache instance
            repository: HypothesisRepository instance
            config: Warming configuration
        """
        self.cache = cache
        self.repo = repository
        self.config = config or WarmingConfig()
        self.stats = WarmingStatistics()
        self._background_task = None
        self._running = False

        logger.info("Initialized CacheWarmer")

    async def warm_recent_entities(
        self,
        limit: int = None,
        time_window_hours: int = None
    ) -> int:
        """
        Warm cache for recently accessed entities.

        Args:
            limit: Maximum number of entities to warm
            time_window_hours: Lookback window in hours

        Returns:
            Number of hypotheses warmed
        """
        if not self.config.enable_recent_warming:
            return 0

        limit = limit or self.config.recent_entity_limit
        time_window_hours = time_window_hours or self.config.recent_window_hours

        logger.info(f"Warming recent entities: limit={limit}, window={time_window_hours}h")

        try:
            # Get recent entities from cache access patterns
            stats = self.cache.get_statistics()
            top_accessed = stats.access_frequency

            # Filter to most recently accessed
            recent_entities = list(top_accessed.keys())[:limit]

            # Prefetch hypotheses for these entities
            if recent_entities:
                warmed = await self.cache.prefetch(recent_entities, self.repo)
                self.stats.recent_entities_warmed += warmed
                self.stats.total_warmed += warmed

                logger.info(f"Warmed {warmed} recent entities")
                return warmed

            return 0

        except Exception as e:
            logger.error(f"Failed to warm recent entities: {e}")
            return 0

    async def warm_cluster_hotspots(
        self,
        cluster_id: Optional[str] = None,
        limit: int = None
    ) -> int:
        """
        Warm entities with high discovery activity in a cluster.

        Args:
            cluster_id: Optional cluster ID (uses most active if None)
            limit: Maximum number of entities to warm

        Returns:
            Number of hypotheses warmed
        """
        if not self.config.enable_cluster_warming:
            return 0

        limit = limit or self.config.cluster_hotspot_limit

        logger.info(f"Warming cluster hotspots: cluster={cluster_id}, limit={limit}")

        try:
            # Find most active cluster if not specified
            if not cluster_id:
                cluster_id = await self._find_most_active_cluster()

            if not cluster_id:
                logger.warning("No active cluster found")
                return 0

            # Get entities in cluster with high activity
            hot_entities = await self._get_cluster_hot_entities(cluster_id, limit)

            # Prefetch hypotheses
            if hot_entities:
                warmed = await self.cache.prefetch(hot_entities, self.repo)
                self.stats.cluster_hotspots_warmed += warmed
                self.stats.total_warmed += warmed

                logger.info(f"Warmed {warmed} cluster hotspot entities")
                return warmed

            return 0

        except Exception as e:
            logger.error(f"Failed to warm cluster hotspots: {e}")
            return 0

    async def warm_template_popularity(
        self,
        limit: int = None
    ) -> int:
        """
        Warm most-used templates.

        Args:
            limit: Maximum number of templates to warm

        Returns:
            Number of hypotheses warmed
        """
        if not self.config.enable_template_warming:
            return 0

        limit = limit or self.config.template_popularity_limit

        logger.info(f"Warming template popularity: limit={limit}")

        try:
            # Get most popular templates
            popular_templates = await self._get_popular_templates(limit)

            if not popular_templates:
                logger.warning("No popular templates found")
                return 0

            # Get recent entities for each template
            total_warmed = 0
            for template_id in popular_templates:
                # Get entities that used this template recently
                entities = await self._get_entities_for_template(template_id, limit=10)

                if entities:
                    warmed = await self.cache.prefetch(entities, self.repo)
                    total_warmed += warmed

            self.stats.template_popularity_warmed += total_warmed
            self.stats.total_warmed += total_warmed

            logger.info(f"Warmed {total_warmed} template popularity hypotheses")
            return total_warmed

        except Exception as e:
            logger.error(f"Failed to warm template popularity: {e}")
            return 0

    async def warm_all_strategies(
        self,
        recent_limit: int = None,
        cluster_limit: int = None,
        template_limit: int = None
    ) -> Dict[str, int]:
        """
        Execute all warming strategies.

        Args:
            recent_limit: Limit for recent entity warming
            cluster_limit: Limit for cluster warming
            template_limit: Limit for template warming

        Returns:
            Dict with results from each strategy
        """
        logger.info("Executing all warming strategies")

        results = {}

        # Warm recent entities
        recent_count = await self.warm_recent_entities(limit=recent_limit)
        results["recent_entities"] = recent_count

        # Warm cluster hotspots
        cluster_count = await self.warm_cluster_hotspots(limit=cluster_limit)
        results["cluster_hotspots"] = cluster_count

        # Warm template popularity
        template_count = await self.warm_template_popularity(limit=template_limit)
        results["template_popularity"] = template_count

        total = sum(results.values())
        self.stats.last_warming_time = datetime.now()

        logger.info(f"All warming strategies completed: {total} total")
        return results

    async def start_background_warming(
        self,
        interval_minutes: int = None
    ) -> None:
        """
        Start background warming task.

        Args:
            interval_minutes: Warming interval in minutes
        """
        if not self.config.enable_background_warming:
            logger.info("Background warming disabled")
            return

        if self._running:
            logger.warning("Background warming already running")
            return

        interval_minutes = interval_minutes or self.config.background_interval_minutes
        self._running = True

        logger.info(f"Starting background warming: interval={interval_minutes}min")

        async def warming_loop():
            while self._running:
                try:
                    # Execute all strategies
                    await self.warm_all_strategies()

                    # Wait for next interval
                    await asyncio.sleep(interval_minutes * 60)

                except Exception as e:
                    logger.error(f"Background warming error: {e}")
                    await asyncio.sleep(60)  # Wait 1 minute before retry

        self._background_task = asyncio.create_task(warming_loop())

    async def stop_background_warming(self) -> None:
        """Stop background warming task"""
        if not self._running:
            return

        logger.info("Stopping background warming")
        self._running = False

        if self._background_task:
            self._background_task.cancel()
            try:
                await self._background_task
            except asyncio.CancelledError:
                pass

    def get_statistics(self) -> WarmingStatistics:
        """Get warming statistics"""
        return self.stats

    async def _find_most_active_cluster(self) -> Optional[str]:
        """Find cluster with highest discovery activity"""
        try:
            # Query for most active cluster based on recent hypotheses
            driver = self.repo.driver
            async with driver.session(database=self.repo.database) as session:
                query = """
                MATCH (h:Hypothesis)-[:ABOUT_ENTITY]->(e:Entity)
                WHERE h.last_tested_timestamp > datetime() - duration('P1D')
                RETURN e.cluster_id AS cluster_id, count(h) AS activity
                ORDER BY activity DESC
                LIMIT 1
                """

                result = await session.run(query)
                record = await result.single()

                if record:
                    return record["cluster_id"]

                return None

        except Exception as e:
            logger.error(f"Failed to find active cluster: {e}")
            return None

    async def _get_cluster_hot_entities(
        self,
        cluster_id: str,
        limit: int
    ) -> List[str]:
        """Get most active entities in a cluster"""
        try:
            driver = self.repo.driver
            async with driver.session(database=self.repo.database) as session:
                query = """
                MATCH (h:Hypothesis)-[:ABOUT_ENTITY]->(e:Entity {cluster_id: $cluster_id})
                WHERE h.state = 'ACTIVE'
                RETURN e.id AS entity_id, count(h) AS hypothesis_count
                ORDER BY hypothesis_count DESC
                LIMIT $limit
                """

                result = await session.run(query, cluster_id=cluster_id, limit=limit)
                entities = []
                async for record in result:
                    entities.append(record["entity_id"])

                return entities

        except Exception as e:
            logger.error(f"Failed to get cluster hot entities: {e}")
            return []

    async def _get_popular_templates(self, limit: int) -> List[str]:
        """Get most popular templates"""
        try:
            driver = self.repo.driver
            async with driver.session(database=self.repo.database) as session:
                query = """
                MATCH (h:Hypothesis)
                WHERE h.last_tested_timestamp > datetime() - duration('P7D')
                RETURN h.template_id AS template_id, count(h) AS usage_count
                ORDER BY usage_count DESC
                LIMIT $limit
                """

                result = await session.run(query, limit=limit)
                templates = []
                async for record in result:
                    templates.append(record["template_id"])

                return templates

        except Exception as e:
            logger.error(f"Failed to get popular templates: {e}")
            return []

    async def _get_entities_for_template(
        self,
        template_id: str,
        limit: int
    ) -> List[str]:
        """Get entities that recently used a template"""
        try:
            driver = self.repo.driver
            async with driver.session(database=self.repo.database) as session:
                query = """
                MATCH (h:Hypothesis {template_id: $template_id})-[:ABOUT_ENTITY]->(e:Entity)
                WHERE h.last_tested_timestamp > datetime() - duration('P3D')
                RETURN DISTINCT e.id AS entity_id
                LIMIT $limit
                """

                result = await session.run(query, template_id=template_id, limit=limit)
                entities = []
                async for record in result:
                    entities.append(record["entity_id"])

                return entities

        except Exception as e:
            logger.error(f"Failed to get entities for template: {e}")
            return []


async def measure_warming_impact(
    warmer: CacheWarmer,
    test_queries: List[str],
    before_warming: bool = True
) -> Dict[str, float]:
    """
    Measure cache hit rate before/after warming.

    Args:
        warmer: CacheWarmer instance
        test_queries: List of hypothesis IDs to query
        before_warming: True for before warming, False for after

    Returns:
        Dict with hit rate and latency metrics
    """
    cache = warmer.cache
    stats = cache.get_statistics()

    # Execute test queries
    start = datetime.now()
    for query_id in test_queries:
        await cache.get(query_id)

    duration = (datetime.now() - start).total_seconds()

    # Get updated stats
    new_stats = cache.get_statistics()
    hits_during_test = new_stats.hits - stats.hits
    total_during_test = hits_during_test + (new_stats.misses - stats.misses)
    hit_rate = hits_during_test / total_during_test if total_during_test > 0 else 0.0

    return {
        "hit_rate": hit_rate,
        "avg_latency_ms": (duration / len(test_queries)) * 1000,
        "total_duration_seconds": duration
    }
