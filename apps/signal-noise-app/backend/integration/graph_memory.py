"""
Graph Memory Abstraction Layer

Provides a unified interface for graph operations that works with:
- Mock data (for MVP testing)
- Real FalkorDB (when connectivity resolved)
- Neo4j Aura (fallback option)
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
import json
import logging

logger = logging.getLogger(__name__)


@dataclass
class GraphEntity:
    """Entity node in the graph"""
    entity_id: str
    name: str
    entity_type: str  # ORG, PERSON, etc.
    metadata: Dict[str, Any]
    created_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        return {
            'entity_id': self.entity_id,
            'name': self.name,
            'entity_type': self.entity_type,
            'metadata': self.metadata,
            'created_at': self.created_at.isoformat()
        }


@dataclass
class GraphSignal:
    """Signal edge/node in the graph"""
    signal_id: str
    entity_id: str
    signal_type: str
    content: str
    confidence: float
    evidence: List[str]
    source: str
    metadata: Dict[str, Any]
    created_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        return {
            'signal_id': self.signal_id,
            'entity_id': self.entity_id,
            'signal_type': self.signal_type,
            'content': self.content,
            'confidence': self.confidence,
            'evidence': self.evidence,
            'source': self.source,
            'metadata': self.metadata,
            'created_at': self.created_at.isoformat()
        }


class GraphMemory:
    """
    Graph memory abstraction layer

    Provides unified interface for graph operations with mock/real backend support.
    """

    def __init__(self, backend: str = "mock"):
        """
        Initialize graph memory

        Args:
            backend: "mock", "falkordb", or "neo4j"
        """
        self.backend = backend
        self._mock_entities: Dict[str, GraphEntity] = {}
        self._mock_signals: List[GraphSignal] = []

        if backend == "falkordb":
            logger.info("Using FalkorDB backend (when connectivity resolved)")
        elif backend == "neo4j":
            logger.info("Using Neo4j backend")
        else:
            logger.info("Using mock backend for MVP testing")

    async def add_entity(self, entity: GraphEntity) -> bool:
        """
        Add entity to graph

        Args:
            entity: GraphEntity to add

        Returns:
            True if successful
        """
        if self.backend == "mock":
            self._mock_entities[entity.entity_id] = entity
            logger.debug(f"Added entity (mock): {entity.entity_id}")
            return True

        # TODO: Implement real backend
        logger.warning(f"Backend {self.backend} not implemented, using mock")
        self._mock_entities[entity.entity_id] = entity
        return True

    async def add_signal(self, signal: GraphSignal) -> bool:
        """
        Add signal to graph

        Args:
            signal: GraphSignal to add

        Returns:
            True if successful
        """
        if self.backend == "mock":
            self._mock_signals.append(signal)
            logger.debug(f"Added signal (mock): {signal.signal_id}")
            return True

        # TODO: Implement real backend
        logger.warning(f"Backend {self.backend} not implemented, using mock")
        self._mock_signals.append(signal)
        return True

    async def get_entity(self, entity_id: str) -> Optional[GraphEntity]:
        """
        Get entity by ID

        Args:
            entity_id: Entity identifier

        Returns:
            GraphEntity or None
        """
        if self.backend == "mock":
            return self._mock_entities.get(entity_id)

        # TODO: Implement real backend
        return self._mock_entities.get(entity_id)

    async def get_entity_signals(
        self,
        entity_id: str,
        signal_types: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[GraphSignal]:
        """
        Get signals for an entity

        Args:
            entity_id: Entity identifier
            signal_types: Optional filter by signal types
            limit: Maximum signals to return

        Returns:
            List of GraphSignal objects
        """
        if self.backend == "mock":
            signals = [
                s for s in self._mock_signals
                if s.entity_id == entity_id
            ]

            if signal_types:
                signals = [s for s in signals if s.signal_type in signal_types]

            return signals[:limit]

        # TODO: Implement real backend
        signals = [s for s in self._mock_signals if s.entity_id == entity_id]
        return signals[:limit]

    async def get_all_entities(self) -> List[GraphEntity]:
        """
        Get all entities in the graph

        Returns:
            List of GraphEntity objects
        """
        if self.backend == "mock":
            return list(self._mock_entities.values())

        return list(self._mock_entities.values())

    async def search_entities(
        self,
        query: str,
        entity_type: Optional[str] = None
    ) -> List[GraphEntity]:
        """
        Search entities by name or metadata

        Args:
            query: Search query string
            entity_type: Optional entity type filter

        Returns:
            List of matching GraphEntity objects
        """
        if self.backend == "mock":
            entities = list(self._mock_entities.values())

            # Filter by entity type
            if entity_type:
                entities = [e for e in entities if e.entity_type == entity_type]

            # Simple text search
            query_lower = query.lower()
            entities = [
                e for e in entities
                if query_lower in e.name.lower() or
                   query_lower in str(e.metadata).lower()
            ]

            return entities

        return []

    async def get_entity_timeline(
        self,
        entity_id: str,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get entity timeline with signals

        Args:
            entity_id: Entity identifier
            days: Number of days to look back

        Returns:
            Timeline with signals sorted by date
        """
        signals = await self.get_entity_signals(entity_id)

        # Filter by date
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        recent_signals = [
            s for s in signals
            if s.created_at >= cutoff
        ]

        # Sort by date
        recent_signals.sort(key=lambda s: s.created_at, reverse=True)

        return [s.to_dict() for s in recent_signals]

    async def get_stats(self) -> Dict[str, int]:
        """
        Get graph statistics

        Returns:
            Statistics dictionary
        """
        return {
            'total_entities': len(self._mock_entities),
            'total_signals': len(self._mock_signals),
            'backend': self.backend
        }

    def clear_mock_data(self):
        """Clear all mock data (useful for testing)"""
        self._mock_entities.clear()
        self._mock_signals.clear()
        logger.info("Cleared mock data")


# Singleton instance for MVP
_graph_memory_instance: Optional[GraphMemory] = None


def get_graph_memory(backend: str = "mock") -> GraphMemory:
    """
    Get or create graph memory instance

    Args:
        backend: Backend type ("mock", "falkordb", "neo4j")

    Returns:
        GraphMemory instance
    """
    global _graph_memory_instance

    if _graph_memory_instance is None or _graph_memory_instance.backend != backend:
        _graph_memory_instance = GraphMemory(backend=backend)

    return _graph_memory_instance
