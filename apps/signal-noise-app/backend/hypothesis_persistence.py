#!/usr/bin/env python3
"""
Hypothesis Persistence Layer for FalkorDB

Implements graph-based storage for:
- Hypothesis nodes with full state tracking
- Hypothesis iteration logs (append-only audit trail)
- Cluster pattern frequencies (for dampening)
- Entity-Hypothesis relationships

Schema Design:

Nodes:
- (:Hypothesis) - First-class hypothesis objects
- (:Entity) - Sports entities (clubs, leagues, etc.)
- (:Cluster) - Entity clusters for dampening

Relationships:
- (:Entity)-[:HAS_HYPOTHESIS]->(:Hypothesis)
- (:Hypothesis)-[:IN_CATEGORY]->(:Category)
- (:Cluster)-[:HAS_PATTERN]->(:Pattern)

Usage:
    from backend.hypothesis_persistence import HypothesisRepository

    repo = HypothesisRepository()
    await repo.initialize()

    # Save hypothesis
    await repo.save_hypothesis(hypothesis)

    # Load hypotheses for entity
    hypotheses = await repo.get_hypotheses_for_entity("arsenal-fc")

    # Update cluster state
    await repo.update_cluster_pattern_frequency(cluster_id, pattern_name)
"""

import os
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import asdict
from pathlib import Path

# Load environment
project_root = Path(__file__).parent.parent
for env_file in [project_root / '.env', Path('.env')]:
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)
        break

# Try to import neo4j driver (FalkorDB compatible)
try:
    from neo4j import GraphDatabase, Driver
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False
    logging.warning("⚠️ neo4j not installed - FalkorDB persistence disabled")

logger = logging.getLogger(__name__)


# =============================================================================
# Schema Definition
# =============================================================================

HYPOTHESIS_SCHEMA = """
// Hypothesis nodes with full state tracking
CREATE CONSTRAINT hypothesis_id_unique IF NOT EXISTS FOR (h:Hypothesis) REQUIRE h.hypothesis_id IS UNIQUE;

// Entity nodes (should already exist)
CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE;

// Cluster nodes for pattern dampening
CREATE CONSTRAINT cluster_id_unique IF NOT EXISTS FOR (c:Cluster) REQUIRE c.cluster_id IS UNIQUE;

// Pattern nodes
CREATE CONSTRAINT pattern_name_unique IF NOT EXISTS FOR (p:Pattern) REQUIRE p.name IS UNIQUE;

// Indexes for performance
CREATE INDEX hypothesis_entity_idx IF NOT EXISTS FOR (h:Hypothesis) ON (h.entity_id);
CREATE INDEX hypothesis_status_idx IF NOT EXISTS FOR (h:Hypothesis) ON (h.status);
CREATE INDEX hypothesis_eig_idx IF NOT EXISTS FOR (h:Hypothesis) ON (h.expected_information_gain);
CREATE INDEX hypothesis_created_idx IF NOT EXISTS FOR (h:Hypothesis) ON (h.created_at);
"""


# =============================================================================
# Hypothesis Repository
# =============================================================================

class HypothesisRepository:
    """
    Repository for hypothesis persistence in FalkorDB

    Provides CRUD operations for hypotheses with audit trail support.
    """

    def __init__(self, uri: str = None, username: str = None, password: str = None):
        """
        Initialize hypothesis repository

        Args:
            uri: FalkorDB URI (default: from FALKORDB_URI env var)
            username: FalkorDB username (default: from FALKORDB_USER env var)
            password: FalkorDB password (default: from FALKORDB_PASSWORD env var)
        """
        if not NEO4J_AVAILABLE:
            raise ImportError("neo4j driver not available. Install with: pip install neo4j")

        self.uri = uri or os.getenv("FALKORDB_URI") or os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.username = username or os.getenv("FALKORDB_USER") or os.getenv("NEO4J_USER", "neo4j")
        self.password = password or os.getenv("FALKORDB_PASSWORD") or os.getenv("NEO4J_PASSWORD", "")

        self.driver: Optional[Driver] = None
        self.graph_name = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

        logger.info(f"🔬 HypothesisRepository initialized (graph: {self.graph_name})")

    async def initialize(self) -> bool:
        """
        Initialize repository and create schema

        Returns:
            True if successful
        """
        try:
            self.driver = GraphDatabase.driver(
                self.uri,
                auth=(self.username, self.password)
            )

            # Test connection
            with self.driver.session(database=self.graph_name) as session:
                session.run("RETURN 1 AS test")

            # Create schema
            await self._create_schema()

            logger.info("✅ HypothesisRepository initialized")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to initialize HypothesisRepository: {e}")
            return False

    async def close(self):
        """Close database connection"""
        if self.driver:
            self.driver.close()
            logger.info("🔬 HypothesisRepository closed")

    async def _create_schema(self):
        """Create database schema (constraints, indexes)"""
        with self.driver.session(database=self.graph_name) as session:
            # Split schema into individual statements
            statements = [s.strip() for s in HYPOTHESIS_SCHEMA.split(';') if s.strip()]

            for statement in statements:
                try:
                    session.run(statement)
                except Exception as e:
                    # Ignore if already exists
                    if "already exists" not in str(e):
                        logger.warning(f"Schema creation warning: {e}")

            logger.info("✅ Database schema created")

    # -------------------------------------------------------------------------
    # Hypothesis CRUD Operations
    # -------------------------------------------------------------------------

    async def save_hypothesis(self, hypothesis) -> bool:
        """
        Save hypothesis to database (create or update)

        Args:
            hypothesis: Hypothesis object

        Returns:
            True if successful
        """
        try:
            with self.driver.session(database=self.graph_name) as session:
                # MERGE hypothesis node
                query = """
                MERGE (h:Hypothesis {hypothesis_id: $hypothesis_id})
                SET
                    h.entity_id = $entity_id,
                    h.category = $category,
                    h.statement = $statement,
                    h.prior_probability = $prior_probability,
                    h.iterations_attempted = $iterations_attempted,
                    h.iterations_accepted = $iterations_accepted,
                    h.iterations_weak_accept = $iterations_weak_accept,
                    h.iterations_rejected = $iterations_rejected,
                    h.iterations_no_progress = $iterations_no_progress,
                    h.confidence = $confidence,
                    h.reinforced_count = $reinforced_count,
                    h.weakened_count = $weakened_count,
                    h.last_delta = $last_delta,
                    h.status = $status,
                    h.created_at = $created_at,
                    h.last_updated = $last_updated,
                    h.promoted_at = $promoted_at,
                    h.degraded_at = $degraded_at,
                    h.saturated_at = $saturated_at,
                    h.killed_at = $killed_at,
                    h.expected_information_gain = $expected_information_gain,
                    h.metadata = $metadata
                RETURN h
                """

                session.run(
                    query,
                    hypothesis_id=hypothesis.hypothesis_id,
                    entity_id=hypothesis.entity_id,
                    category=hypothesis.category,
                    statement=hypothesis.statement,
                    prior_probability=hypothesis.prior_probability,
                    iterations_attempted=hypothesis.iterations_attempted,
                    iterations_accepted=hypothesis.iterations_accepted,
                    iterations_weak_accept=hypothesis.iterations_weak_accept,
                    iterations_rejected=hypothesis.iterations_rejected,
                    iterations_no_progress=hypothesis.iterations_no_progress,
                    confidence=hypothesis.confidence,
                    reinforced_count=hypothesis.reinforced_count,
                    weakened_count=hypothesis.weakened_count,
                    last_delta=hypothesis.last_delta,
                    status=hypothesis.status,
                    created_at=hypothesis.created_at.isoformat(),
                    last_updated=hypothesis.last_updated.isoformat(),
                    promoted_at=hypothesis.promoted_at.isoformat() if hypothesis.promoted_at else None,
                    degraded_at=hypothesis.degraded_at.isoformat() if hypothesis.degraded_at else None,
                    saturated_at=hypothesis.saturated_at.isoformat() if hypothesis.saturated_at else None,
                    killed_at=hypothesis.killed_at.isoformat() if hypothesis.killed_at else None,
                    expected_information_gain=hypothesis.expected_information_gain,
                    metadata=hypothesis.metadata
                )

                logger.debug(f"💾 Saved hypothesis: {hypothesis.hypothesis_id}")
                return True

        except Exception as e:
            logger.error(f"❌ Failed to save hypothesis: {e}")
            return False

    async def get_hypothesis(self, hypothesis_id: str):
        """
        Get hypothesis by ID

        Args:
            hypothesis_id: Hypothesis identifier

        Returns:
            Hypothesis object or None
        """
        from backend.hypothesis_manager import Hypothesis

        try:
            with self.driver.session(database=self.graph_name) as session:
                query = """
                MATCH (h:Hypothesis {hypothesis_id: $hypothesis_id})
                RETURN h
                """
                result = session.run(query, hypothesis_id=hypothesis_id)
                record = result.single()

                if record:
                    return self._record_to_hypothesis(record["h"])

                return None

        except Exception as e:
            logger.error(f"❌ Failed to get hypothesis: {e}")
            return None

    async def get_hypotheses_for_entity(self, entity_id: str) -> List:
        """
        Get all hypotheses for entity

        Args:
            entity_id: Entity identifier

        Returns:
            List of Hypothesis objects
        """
        from backend.hypothesis_manager import Hypothesis

        try:
            with self.driver.session(database=self.graph_name) as session:
                query = """
                MATCH (h:Hypothesis {entity_id: $entity_id})
                RETURN h
                ORDER BY h.created_at DESC
                """
                results = session.run(query, entity_id=entity_id)

                hypotheses = []
                for record in results:
                    hypothesis = self._record_to_hypothesis(record["h"])
                    if hypothesis:
                        hypotheses.append(hypothesis)

                return hypotheses

        except Exception as e:
            logger.error(f"❌ Failed to get hypotheses for entity: {e}")
            return []

    async def get_active_hypotheses(self, entity_id: str = None, status: str = "ACTIVE") -> List:
        """
        Get active hypotheses

        Args:
            entity_id: Optional entity filter
            status: Status filter (default: "ACTIVE")

        Returns:
            List of Hypothesis objects
        """
        from backend.hypothesis_manager import Hypothesis

        try:
            with self.driver.session(database=self.graph_name) as session:
                if entity_id:
                    query = """
                    MATCH (h:Hypothesis {entity_id: $entity_id, status: $status})
                    RETURN h
                    ORDER BY h.expected_information_gain DESC
                    """
                    results = session.run(query, entity_id=entity_id, status=status)
                else:
                    query = """
                    MATCH (h:Hypothesis {status: $status})
                    RETURN h
                    ORDER BY h.expected_information_gain DESC
                    """
                    results = session.run(query, status=status)

                hypotheses = []
                for record in results:
                    hypothesis = self._record_to_hypothesis(record["h"])
                    if hypothesis:
                        hypotheses.append(hypothesis)

                return hypotheses

        except Exception as e:
            logger.error(f"❌ Failed to get active hypotheses: {e}")
            return []

    # -------------------------------------------------------------------------
    # Cluster Pattern Persistence
    # -------------------------------------------------------------------------

    async def update_cluster_pattern_frequency(
        self,
        cluster_id: str,
        pattern_name: str,
        frequency: int = None
    ) -> bool:
        """
        Update cluster pattern frequency for dampening

        Args:
            cluster_id: Cluster identifier
            pattern_name: Pattern name
            frequency: Optional frequency (increments by 1 if not provided)

        Returns:
            True if successful
        """
        try:
            with self.driver.session(database=self.graph_name) as session:
                if frequency is None:
                    # Increment existing frequency
                    query = """
                    MERGE (c:Cluster {cluster_id: $cluster_id})
                    MERGE (c)-[:HAS_PATTERN]->(p:Pattern {name: $pattern_name})
                    ON CREATE SET p.frequency = 1
                    ON MATCH SET p.frequency = p.frequency + 1
                    RETURN p.frequency AS frequency
                    """
                    session.run(query, cluster_id=cluster_id, pattern_name=pattern_name)
                else:
                    # Set specific frequency
                    query = """
                    MERGE (c:Cluster {cluster_id: $cluster_id})
                    MERGE (c)-[:HAS_PATTERN]->(p:Pattern {name: $pattern_name})
                    SET p.frequency = $frequency
                    """
                    session.run(query, cluster_id=cluster_id, pattern_name=pattern_name, frequency=frequency)

                logger.debug(f"💾 Updated cluster pattern: {cluster_id}/{pattern_name}")
                return True

        except Exception as e:
            logger.error(f"❌ Failed to update cluster pattern: {e}")
            return False

    async def get_cluster_pattern_frequencies(self, cluster_id: str) -> Dict[str, int]:
        """
        Get all pattern frequencies for cluster

        Args:
            cluster_id: Cluster identifier

        Returns:
            Dict mapping pattern_name -> frequency
        """
        try:
            with self.driver.session(database=self.graph_name) as session:
                query = """
                MATCH (c:Cluster {cluster_id: $cluster_id})-[:HAS_PATTERN]->(p:Pattern)
                RETURN p.name AS pattern, p.frequency AS frequency
                """
                results = session.run(query, cluster_id=cluster_id)

                frequencies = {}
                for record in results:
                    frequencies[record["pattern"]] = record["frequency"]

                return frequencies

        except Exception as e:
            logger.error(f"❌ Failed to get cluster pattern frequencies: {e}")
            return {}

    # -------------------------------------------------------------------------
    # Helper Methods
    # -------------------------------------------------------------------------

    def _record_to_hypothesis(self, record: Dict):
        """Convert Neo4j record to Hypothesis object"""
        from backend.hypothesis_manager import Hypothesis

        try:
            # Parse datetime fields
            for field in ['created_at', 'last_updated', 'promoted_at', 'degraded_at', 'saturated_at', 'killed_at']:
                if record.get(field) and isinstance(record[field], str):
                    record[field] = datetime.fromisoformat(record[field].replace('Z', '+00:00'))

            return Hypothesis(**record)

        except Exception as e:
            logger.error(f"❌ Failed to convert record to hypothesis: {e}")
            return None


# =============================================================================
# Convenience Functions
# =============================================================================

async def get_hypothesis_repository() -> HypothesisRepository:
    """
    Get hypothesis repository instance

    Returns:
        Initialized HypothesisRepository
    """
    repo = HypothesisRepository()
    await repo.initialize()
    return repo


if __name__ == "__main__":
    # Test HypothesisRepository
    import asyncio

    async def test():
        print("=== Testing HypothesisRepository ===")

        repo = HypothesisRepository()

        if await repo.initialize():
            print("✅ Repository initialized")

            # Test saving hypothesis
            from backend.hypothesis_manager import Hypothesis

            h = Hypothesis(
                hypothesis_id="test_hypothesis_1",
                entity_id="test-entity",
                category="Test Category",
                statement="Test entity is preparing test procurement",
                prior_probability=0.5,
                confidence=0.6
            )

            if await repo.save_hypothesis(h):
                print("✅ Hypothesis saved")

            # Test loading hypothesis
            loaded = await repo.get_hypothesis("test_hypothesis_1")
            if loaded:
                print(f"✅ Hypothesis loaded: {loaded.hypothesis_id}")
                print(f"   Confidence: {loaded.confidence}")

            # Test cluster pattern frequency
            await repo.update_cluster_pattern_frequency("test_cluster", "Strategic Hire")
            frequencies = await repo.get_cluster_pattern_frequencies("test_cluster")
            print(f"✅ Cluster frequencies: {frequencies}")

            await repo.close()

        print("\n✅ HypothesisRepository test complete")

    asyncio.run(test())
