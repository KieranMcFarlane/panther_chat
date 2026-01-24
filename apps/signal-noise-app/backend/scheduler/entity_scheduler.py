"""
Entity Scheduler for MVP Thin Vertical Slice

Dynamic entity prioritization for continuous ingestion.

MVP Scope:
- Single source (LinkedIn or News, pick one)
- Basic prioritization (signal freshness)
- Returns batches for scraping
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
import asyncio
import logging

logger = logging.getLogger(__name__)


@dataclass
class EntityPriority:
    """Entity priority score"""
    entity_id: str
    entity_name: str
    priority_score: float
    freshness_score: float
    last_scraped: Optional[datetime]
    scrape_count: int


class EntityScheduler:
    """
    Dynamic entity prioritization for continuous ingestion

    MVP Implementation:
    - Simple priority scoring based on signal freshness
    - Returns entities sorted by priority
    - Integrates with existing Graphiti service

    Priority factors (simplified for MVP):
    - Signal freshness (recent signals = higher priority)
    - RFP density (more RFPs = higher priority)
    """

    def __init__(self, graphiti_service=None):
        """
        Initialize entity scheduler

        Args:
            graphiti_service: Existing GraphitiService instance
                            (None for testing without database)
        """
        self.graphiti = graphiti_service
        self.freshness_window = timedelta(days=7)

    async def get_next_batch(
        self,
        batch_size: int = 10,  # Smaller batches for MVP
        min_priority: float = 0.3
    ) -> List[str]:
        """
        Get next batch of entities to scrape

        MVP: Returns entities sorted by priority score

        Args:
            batch_size: Number of entities to return
            min_priority: Minimum priority threshold

        Returns:
            List of entity IDs sorted by priority
        """
        # Get all entities that need scraping
        all_entities = await self._get_scrapeable_entities()

        if not all_entities:
            logger.warning("No scrapeable entities found")
            return []

        # Calculate priority scores
        prioritized = await self.prioritize_entities(all_entities)

        # Filter by minimum priority
        qualified = [e for e in prioritized if e.priority_score >= min_priority]

        if not qualified:
            logger.warning(f"No entities meet minimum priority {min_priority}")
            return []

        # Return top batch (entity IDs only)
        return [e.entity_id for e in qualified[:batch_size]]

    async def prioritize_entities(
        self,
        entity_ids: List[str]
    ) -> List[EntityPriority]:
        """
        Calculate priority scores for entities

        MVP Implementation: Simplified scoring based on freshness

        Args:
            entity_ids: List of entity IDs to prioritize

        Returns:
            List of EntityPriority objects sorted by score (descending)
        """
        priorities = []

        for entity_id in entity_ids:
            try:
                # Get entity signals from Graphiti
                signals = await self._get_entity_signals(entity_id)

                # Calculate freshness score
                recent_signals = [
                    s for s in signals
                    if self._is_recent(s.get('timestamp'))
                ]
                freshness_score = len(recent_signals) / max(len(signals), 1)

                # Calculate RFP density
                rfp_signals = [
                    s for s in signals
                    if s.get('type') == 'RFP_DETECTED'
                ]
                rfp_density = len(rfp_signals) / max(len(signals), 1)

                # Combined priority score (simplified for MVP)
                priority_score = (
                    0.7 * freshness_score +
                    0.3 * rfp_density
                )

                priorities.append(EntityPriority(
                    entity_id=entity_id,
                    entity_name=signals[0].get('entity_name', entity_id) if signals else entity_id,
                    priority_score=priority_score,
                    freshness_score=freshness_score,
                    last_scraped=signals[-1].get('timestamp') if signals else None,
                    scrape_count=len(signals)
                ))

            except Exception as e:
                logger.error(f"Error prioritizing {entity_id}: {e}")
                continue

        # Sort by priority score (descending)
        priorities.sort(key=lambda e: e.priority_score, reverse=True)
        return priorities

    async def _get_scrapeable_entities(self) -> List[str]:
        """
        Get all entities that need scraping

        MVP: Returns entities from existing graph or test entities

        Returns:
            List of entity IDs
        """
        if self.graphiti:
            try:
                # Query Graphiti for entities
                entities = await self._query_graphiti_entities()
                return entities
            except Exception as e:
                logger.error(f"Error querying Graphiti: {e}")

        # Fallback: Return test entities for MVP
        return self._get_test_entities()

    async def _query_graphiti_entities(self) -> List[str]:
        """Query Graphiti for existing entities"""
        # This would integrate with the existing graphiti_service
        # For MVP, return a few test entities
        return [
            "ac_milan",
            "manchester_united",
            "liverpool_fc",
            "fc_barcelona"
        ]

    def _get_test_entities(self) -> List[str]:
        """Get test entities for MVP (when no graph available)"""
        return [
            "ac_milan",
            "manchester_united",
            "liverpool_fc",
            "fc_barcelona",
            "real_madrid",
            "bayern_munich",
            "psg",
            "juventus",
            "chelsea_fc",
            "arsenal_fc"
        ]

    async def _get_entity_signals(self, entity_id: str) -> List[Dict[str, Any]]:
        """
        Get signals for an entity

        MVP: Returns mock signals for testing

        Args:
            entity_id: Entity identifier

        Returns:
            List of signal dictionaries
        """
        if self.graphiti:
            try:
                # Query Graphiti for entity signals
                return await self.graphiti.get_entity_signals(
                    entity_id=entity_id,
                    time_horizon_days=7
                )
            except Exception as e:
                logger.error(f"Error getting signals for {entity_id}: {e}")

        # Fallback: Return mock signals for MVP testing
        return self._get_mock_signals(entity_id)

    def _get_mock_signals(self, entity_id: str) -> List[Dict[str, Any]]:
        """Generate mock signals for MVP testing"""
        import random

        # Generate 5-15 random signals
        num_signals = random.randint(5, 15)
        signals = []

        # Bias towards recent signals (higher freshness score)
        for i in range(num_signals):
            # More recent signals (0-7 days) for higher priority
            days_ago = random.randint(0, 7) if i < num_signals // 2 else random.randint(0, 30)
            timestamp = datetime.now(timezone.utc) - timedelta(days=days_ago)

            signals.append({
                'entity_id': entity_id,
                'entity_name': entity_id.replace('_', ' ').title(),
                'type': random.choice([
                    'RFP_DETECTED',
                    'EXECUTIVE_CHANGE',
                    'PARTNERSHIP_FORMED',
                    'NEW_HIRE_CLUSTER',
                    'TECHNOLOGY_ADOPTED'
                ]),
                'content': f'Sample signal {i+1} for {entity_id}',
                'timestamp': timestamp,
                'confidence': round(random.uniform(0.5, 0.95), 2)
            })

        return signals

    def _is_recent(self, timestamp: Optional[datetime]) -> bool:
        """Check if a signal is recent (within freshness window)"""
        if not timestamp:
            return False

        if isinstance(timestamp, str):
            try:
                timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            except:
                return False

        age = datetime.now(timezone.utc) - timestamp
        return age <= self.freshness_window

    async def mark_queried(self, entity_id: str):
        """
        Mark entity as recently queried (boosts priority)

        MVP: Placeholder for cache integration
        """
        # TODO: Integrate with hot-path cache when implemented
        logger.debug(f"Marked {entity_id} as queried")
