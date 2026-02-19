#!/usr/bin/env python3
"""
Hypothesis Persistence Layer for FalkorDB (Native)

Implements graph-based storage using native FalkorDB Python library.

Schema Design:
- Hypothesis nodes (RedisGraph nodes)
- Entity-Hypothesis relationships
- Cluster pattern frequencies (for dampening)

Usage:
    from backend.hypothesis_persistence_native import HypothesisRepository

    repo = HypothesisRepository()
    await repo.initialize()

    # Save hypothesis
    await repo.save_hypothesis(hypothesis)

    # Load hypotheses for entity
    hypotheses = await repo.get_hypotheses_for_entity("arsenal-fc")
"""

import os
import logging
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pathlib import Path

# Load environment
project_root = Path(__file__).parent.parent
for env_file in [project_root / '.env', Path('.env')]:
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)
        break

# Import native FalkorDB library
try:
    from falkordb import FalkorDB
    FALKORDB_AVAILABLE = True
except ImportError:
    FALKORDB_AVAILABLE = False
    logging.warning("⚠️ falkordb not installed. Run: pip install falkordb")

logger = logging.getLogger(__name__)


# Import Phase 5 components
try:
    from backend.batch_hypothesis_query import BatchHypothesisQuery, BatchConfig
    BATCH_AVAILABLE = True
except ImportError:
    BATCH_AVAILABLE = False
    logger.warning("Phase 5 batch query components not available")


# =============================================================================
# Native FalkorDB Repository
# =============================================================================

class HypothesisRepository:
    """
    Repository for hypothesis persistence using native FalkorDB

    Uses RedisGraph (FalkorDB) with native Python library.
    """

    def __init__(self, uri: str = None, username: str = None, password: str = None):
        """
        Initialize hypothesis repository

        Args:
            uri: FalkorDB URI (default: from FALKORDB_URI env var)
            username: FalkorDB username (default: from FALKORDB_USER env var)
            password: FalkorDB password (default: from FALKORDB_PASSWORD env var)
        """
        if not FALKORDB_AVAILABLE:
            raise ImportError("falkordb library not available. Install with: pip install falkordb")

        self.uri = uri or os.getenv("FALKORDB_URI")
        self.username = username or os.getenv("FALKORDB_USER", "falkordb")
        self.password = password or os.getenv("FALKORDB_PASSWORD", "")
        self.database = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

        self.db: Optional[FalkorDB] = None
        self.graph = None

        logger.info(f"🔬 HypothesisRepository (Native) initialized (graph: {self.database})")

    async def initialize(self) -> bool:
        """
        Initialize repository and create graph

        Returns:
            True if successful
        """
        try:
            # Parse URI to get host and port
            import urllib.parse
            # Handle both redis:// and rediss:// (SSL)
            uri_to_parse = self.uri.replace("redis://", "http://").replace("rediss://", "http://")
            parsed = urllib.parse.urlparse(uri_to_parse)
            host = parsed.hostname or "localhost"
            port = parsed.port or 6379

            # Connect to FalkorDB
            # Note: FalkorDB Cloud uses plain Redis protocol, not rediss:// (SSL)
            # The URI format is misleading - it's redis:// not rediss://
            self.db = FalkorDB(
                host=host,
                port=port,
                username=self.username,
                password=self.password,
                ssl=False  # FalkorDB Cloud uses plain Redis, not SSL
            )

            # Select graph
            self.graph = self.db.select_graph(self.database)

            # Test connection
            result = self.graph.query("RETURN 1 AS test")
            result.result_set  # Consume result properly

            # Create indexes
            await self._create_indexes()

            logger.info("✅ HypothesisRepository (Native) initialized")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to initialize HypothesisRepository: {e}")
            return False

    async def close(self):
        """Close database connection"""
        # Note: FalkorDB doesn't have an explicit close method
        # Connection is managed automatically
        logger.info("🔬 HypothesisRepository closed")

    def _is_connected(self) -> bool:
        """
        Check if database connection is active

        Returns:
            True if graph object exists and is connected
        """
        return self.graph is not None

    async def _create_indexes(self):
        """Create indexes for performance"""
        try:
            # Create index on Hypothesis.hypothesis_id
            self.graph.query("""
                CREATE INDEX IF NOT EXISTS FOR (h:Hypothesis) ON (h.hypothesis_id)
            """)

            # Create index on Hypothesis.entity_id
            self.graph.query("""
                CREATE INDEX IF NOT EXISTS FOR (h:Hypothesis) ON (h.entity_id)
            """)

            # Create index on Hypothesis.status
            self.graph.query("""
                CREATE INDEX IF NOT EXISTS FOR (h:Hypothesis) ON (h.status)
            """)

            logger.debug("✅ Indexes created")

        except Exception as e:
            logger.warning(f"Index creation warning: {e}")

    # -------------------------------------------------------------------------
    # Hypothesis CRUD Operations
    # -------------------------------------------------------------------------

    async def save_hypothesis(self, hypothesis) -> bool:
        """
        Save hypothesis to database (create or update)

        Args:
            hypothesis: Hypothesis object

        Returns:
            True if saved successfully, False otherwise (but doesn't raise)
        """
        try:
            # Check connection first
            if not self._is_connected():
                logger.warning(f"⚠️ FalkorDB not connected, skipping hypothesis save: {hypothesis.hypothesis_id}")
                return False

            # Convert hypothesis to dict for JSON storage
            # Convert hypothesis to dict for JSON storage
            data = {
                'hypothesis_id': hypothesis.hypothesis_id,
                'entity_id': hypothesis.entity_id,
                'category': hypothesis.category,
                'statement': hypothesis.statement,
                'prior_probability': hypothesis.prior_probability,
                'iterations_attempted': hypothesis.iterations_attempted,
                'iterations_accepted': hypothesis.iterations_accepted,
                'iterations_weak_accept': hypothesis.iterations_weak_accept,
                'iterations_rejected': hypothesis.iterations_rejected,
                'iterations_no_progress': hypothesis.iterations_no_progress,
                'confidence': hypothesis.confidence,
                'reinforced_count': hypothesis.reinforced_count,
                'weakened_count': hypothesis.weakened_count,
                'last_delta': hypothesis.last_delta,
                'status': hypothesis.status,
                'created_at': hypothesis.created_at.isoformat(),
                'last_updated': hypothesis.last_updated.isoformat(),
                'promoted_at': hypothesis.promoted_at.isoformat() if hypothesis.promoted_at else None,
                'degraded_at': hypothesis.degraded_at.isoformat() if hypothesis.degraded_at else None,
                'saturated_at': hypothesis.saturated_at.isoformat() if hypothesis.saturated_at else None,
                'killed_at': hypothesis.killed_at.isoformat() if hypothesis.killed_at else None,
                'expected_information_gain': hypothesis.expected_information_gain,
                'metadata': json.dumps(hypothesis.metadata) if hypothesis.metadata else None
            }

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

            # falkordb expects dict params, not kwargs
            self.graph.query(query, data)

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
            # Check connection first
            if not self._is_connected():
                logger.warning(f"⚠️ FalkorDB not connected, cannot get hypothesis: {hypothesis_id}")
                return None

            query = """
            MATCH (h:Hypothesis {hypothesis_id: $hypothesis_id})
            RETURN h
            """
            result = self.graph.query(query, {'hypothesis_id': hypothesis_id})
            records = list(result.result_set)

            if records and len(records) > 0:
                return self._record_to_hypothesis(records[0][0])

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
            List of Hypothesis objects (empty list if not connected)
        """
        from backend.hypothesis_manager import Hypothesis

        try:
            # Check connection first
            if not self._is_connected():
                logger.warning(f"⚠️ FalkorDB not connected, cannot get hypotheses for entity: {entity_id}")
                return []

            query = """
            MATCH (h:Hypothesis {entity_id: $entity_id})
            RETURN h
            ORDER BY h.created_at DESC
            """
            result = self.graph.query(query, {'entity_id': entity_id})
            records = list(result.result_set)

            hypotheses = []
            for record in records:
                hypothesis = self._record_to_hypothesis(record[0])
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
            List of Hypothesis objects (empty list if not connected)
        """
        from backend.hypothesis_manager import Hypothesis

        try:
            # Check connection first
            if not self._is_connected():
                logger.warning(f"⚠️ FalkorDB not connected, cannot get active hypotheses")
                return []

            if entity_id:
                query = """
                MATCH (h:Hypothesis {entity_id: $entity_id, status: $status})
                RETURN h
                ORDER BY h.expected_information_gain DESC
                """
                result = self.graph.query(query, {'entity_id': entity_id, 'status': status})
            else:
                query = """
                MATCH (h:Hypothesis {status: $status})
                RETURN h
                ORDER BY h.expected_information_gain DESC
                """
                result = self.graph.query(query, {'status': status})

            records = list(result.result_set)

            hypotheses = []
            for record in records:
                hypothesis = self._record_to_hypothesis(record[0])
                if hypothesis:
                    hypotheses.append(hypothesis)

            return hypotheses

        except Exception as e:
            logger.error(f"❌ Failed to get active hypotheses: {e}")
            return []

    # -------------------------------------------------------------------------
    # HypothesisState Persistence (Temporal Sports Procurement Prediction Engine)
    # -------------------------------------------------------------------------

    async def save_hypothesis_state(self, hypothesis_state) -> bool:
        """
        Save or update hypothesis state to FalkorDB

        Args:
            hypothesis_state: HypothesisState object with entity_id, category, scores

        Returns:
            True if successful, False otherwise
        """
        try:
            if not self._is_connected():
                logger.warning("⚠️ FalkorDB not connected, cannot save hypothesis state")
                return False

            # Create unique state_id
            state_id = f"{hypothesis_state.entity_id}_{hypothesis_state.category}_state"

            query = """
            MERGE (h:HypothesisState {state_id: $state_id})
            SET h.entity_id = $entity_id,
                h.category = $category,
                h.maturity_score = $maturity_score,
                h.activity_score = $activity_score,
                h.state = $state,
                h.last_updated = $last_updated
            RETURN h
            """

            params = {
                'state_id': state_id,
                'entity_id': hypothesis_state.entity_id,
                'category': hypothesis_state.category,
                'maturity_score': hypothesis_state.maturity_score,
                'activity_score': hypothesis_state.activity_score,
                'state': hypothesis_state.state,
                'last_updated': hypothesis_state.last_updated.isoformat()
            }

            result = self.graph.query(query, params)
            # Check if result has any records
            records = list(result.result_set)
            return len(records) > 0

        except Exception as e:
            logger.error(f"❌ Failed to save hypothesis state: {e}")
            return False

    async def get_hypothesis_state(self, entity_id: str, category: str) -> Optional[Any]:
        """
        Get hypothesis state for specific entity and category

        Args:
            entity_id: Entity identifier
            category: Hypothesis category

        Returns:
            HypothesisState object or None if not found
        """
        try:
            if not self._is_connected():
                logger.warning("⚠️ FalkorDB not connected, cannot get hypothesis state")
                return None

            state_id = f"{entity_id}_{category}_state"

            query = """
            MATCH (h:HypothesisState {state_id: $state_id})
            RETURN h
            """

            result = self.graph.query(query, {'state_id': state_id})
            records = list(result.result_set)

            if not records:
                return None

            # FalkorDB returns Node objects - access via .properties
            node = records[0][0]
            if hasattr(node, 'properties'):
                record = node.properties
            elif hasattr(node, '_properties'):
                record = node._properties
            else:
                # Fallback: try to access as dict
                record = dict(node) if hasattr(node, '__iter__') else {}

            from backend.schemas import HypothesisState

            return HypothesisState(
                entity_id=record.get('entity_id', entity_id),
                category=record.get('category', category),
                maturity_score=float(record.get('maturity_score', 0.0)),
                activity_score=float(record.get('activity_score', 0.0)),
                state=record.get('state', 'MONITOR'),
                last_updated=datetime.fromisoformat(record.get('last_updated', datetime.now(timezone.utc).isoformat()))
            )

        except Exception as e:
            logger.error(f"❌ Failed to get hypothesis state: {e}")
            return None

    async def get_all_hypothesis_states(self, entity_id: str) -> Dict[str, Any]:
        """
        Get all hypothesis states for an entity

        Args:
            entity_id: Entity identifier

        Returns:
            Dict mapping category -> HypothesisState
        """
        try:
            if not self._is_connected():
                logger.warning("⚠️ FalkorDB not connected, cannot get hypothesis states")
                return {}

            query = """
            MATCH (h:HypothesisState {entity_id: $entity_id})
            RETURN h
            ORDER BY h.category
            """

            result = self.graph.query(query, {'entity_id': entity_id})
            records = list(result.result_set)

            from backend.schemas import HypothesisState

            states = {}
            for record in records:
                node = record[0]
                # Handle FalkorDB Node objects
                if hasattr(node, 'properties'):
                    r = node.properties
                elif hasattr(node, '_properties'):
                    r = node._properties
                else:
                    r = dict(node) if hasattr(node, '__iter__') else {}

                state = HypothesisState(
                    entity_id=r.get('entity_id', entity_id),
                    category=r.get('category', ''),
                    maturity_score=float(r.get('maturity_score', 0.0)),
                    activity_score=float(r.get('activity_score', 0.0)),
                    state=r.get('state', 'MONITOR'),
                    last_updated=datetime.fromisoformat(r.get('last_updated', datetime.now(timezone.utc).isoformat()))
                )
                states[state.category] = state

            return states

        except Exception as e:
            logger.error(f"❌ Failed to get hypothesis states: {e}")
            return {}

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
            True if saved successfully, False otherwise (but doesn't raise)
        """
        try:
            # Check connection first
            if not self._is_connected():
                logger.warning(f"FalkorDB not connected, skipping cluster pattern update: {cluster_id}/{pattern_name}")
                return False

            # Use a simple hash-based approach for pattern frequencies
            # Use a simple hash-based approach for pattern frequencies
            # Store as cluster:{cluster_id}:pattern:{pattern_name}
            key = f"cluster:{cluster_id}:pattern:{pattern_name}"

            if frequency is None:
                # Increment existing frequency
                current = self._get_pattern_frequency_from_db(key)
                frequency = (current or 0) + 1

            # Store in graph as a node with properties
            query = """
            MERGE (p:Pattern {
                id: $id,
                cluster_id: $cluster_id,
                pattern_name: $pattern_name,
                frequency: $frequency
            })
            SET p.last_updated = $last_updated
            """
            from datetime import datetime

            # falkordb expects dict params, not kwargs
            params = {
                'id': key,
                'cluster_id': cluster_id,
                'pattern_name': pattern_name,
                'frequency': frequency,
                'last_updated': datetime.now(timezone.utc).isoformat()
            }
            self.graph.query(query, params)

            logger.debug(f"💾 Updated cluster pattern: {cluster_id}/{pattern_name} = {frequency}")
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
            Dict mapping pattern_name -> frequency (empty dict if not connected)
        """
        try:
            # Check connection first
            if not self._is_connected():
                logger.warning(f"⚠️ FalkorDB not connected, cannot get cluster pattern frequencies: {cluster_id}")
                return {}

            query = """
            MATCH (p:Pattern {cluster_id: $cluster_id})
            RETURN p.pattern_name AS pattern, p.frequency AS frequency
            """
            result = self.graph.query(query, {'cluster_id': cluster_id})
            records = list(result.result_set)

            frequencies = {}
            for record in records:
                pattern = record[0]
                freq = record[1]
                if isinstance(freq, (int, float)):
                    frequencies[pattern] = int(freq)
                else:
                    frequencies[pattern] = int(freq) if freq else 1

            return frequencies

        except Exception as e:
            logger.error(f"❌ Failed to get cluster pattern frequencies: {e}")
            return {}

    def _get_pattern_frequency_from_db(self, key: str) -> Optional[int]:
        """Helper to get pattern frequency from database"""
        try:
            # Check connection first
            if not self._is_connected():
                return None

            query = """
            MATCH (p:Pattern {id: $id})
            RETURN p.frequency AS frequency
            """
            result = self.graph.query(query, {'id': key})
            records = list(result.result_set)

            if records and len(records) > 0:
                freq = records[0][0]
                return int(freq) if isinstance(freq, (int, float)) else None

            return None

        except Exception:
            return None

    # -------------------------------------------------------------------------
    # Helper Methods
    # -------------------------------------------------------------------------

    def _record_to_hypothesis(self, record: Dict):
        """Convert Neo4j/FalkorDB record to Hypothesis object"""
        from backend.hypothesis_manager import Hypothesis

        try:
            # Parse metadata JSON if present
            metadata = record.get('metadata')
            if isinstance(metadata, str):
                metadata = json.loads(metadata)

            # Parse datetime fields
            for field in ['created_at', 'last_updated', 'promoted_at', 'degraded_at', 'saturated_at', 'killed_at']:
                if record.get(field) and isinstance(record[field], str):
                    try:
                        record[field] = datetime.fromisoformat(record[field].replace('Z', '+00:00'))
                    except:
                        record[field] = None

            # Add metadata back
            record['metadata'] = metadata if metadata else {}

            return Hypothesis(**record)

        except Exception as e:
            logger.error(f"❌ Failed to convert record to hypothesis: {e}")
            return None

    # =========================================================================
    # Phase 5 Batch Query Methods
    # =========================================================================

    async def get_hypotheses_batch(
        self,
        entity_ids: List[str],
        template_id: Optional[str] = None
    ) -> Dict[str, List]:
        """
        Batch query hypotheses for multiple entities (Phase 5 optimization)

        Args:
            entity_ids: List of entity IDs
            template_id: Optional template filter

        Returns:
            Dict mapping entity_id to list of hypotheses
        """
        if not BATCH_AVAILABLE:
            logger.warning("⚠️ Batch query not available, falling back to sequential")
            results = {}
            for entity_id in entity_ids:
                hypotheses = await self.get_hypotheses_for_entity(entity_id)
                if template_id:
                    hypotheses = [h for h in hypotheses if h.metadata.get('template_id') == template_id]
                results[entity_id] = hypotheses
            return results

        try:
            batch = BatchHypothesisQuery(self)
            return await batch.get_hypotheses_batch(entity_ids, template_id)
        except Exception as e:
            logger.error(f"❌ Batch query failed: {e}")
            # Fallback to sequential
            results = {}
            for entity_id in entity_ids:
                hypotheses = await self.get_hypotheses_for_entity(entity_id)
                if template_id:
                    hypotheses = [h for h in hypotheses if h.metadata.get('template_id') == template_id]
                results[entity_id] = hypotheses
            return results

    async def update_confidences_batch(
        self,
        updates: List[Dict[str, float]]
    ) -> int:
        """
        Batch update hypothesis confidences using UNWIND (Phase 5 optimization)

        Args:
            updates: List of {hypothesis_id, confidence_delta} dicts

        Returns:
            Number of hypotheses successfully updated
        """
        if not BATCH_AVAILABLE:
            logger.warning("⚠️ Batch update not available, falling back to sequential")
            count = 0
            for update in updates:
                hypothesis_id = update.get('hypothesis_id')
                delta = update.get('confidence_delta', 0.0)
                hypothesis = await self.get_hypothesis(hypothesis_id)
                if hypothesis:
                    hypothesis.confidence = max(0.0, min(1.0, hypothesis.confidence + delta))
                    hypothesis.last_updated = datetime.now(timezone.utc)
                    await self.save_hypothesis(hypothesis)
                    count += 1
            return count

        try:
            batch = BatchHypothesisQuery(self)
            return await batch.update_confidences_batch(updates)
        except Exception as e:
            logger.error(f"❌ Batch update failed: {e}")
            # Fallback to sequential
            count = 0
            for update in updates:
                hypothesis_id = update.get('hypothesis_id')
                delta = update.get('confidence_delta', 0.0)
                hypothesis = await self.get_hypothesis(hypothesis_id)
                if hypothesis:
                    hypothesis.confidence = max(0.0, min(1.0, hypothesis.confidence + delta))
                    hypothesis.last_updated = datetime.now(timezone.utc)
                    await self.save_hypothesis(hypothesis)
                    count += 1
            return count

    async def create_hypotheses_batch(
        self,
        hypotheses: List
    ) -> int:
        """
        Batch create hypotheses using UNWIND (Phase 5 optimization)

        Args:
            hypotheses: List of Hypothesis objects to create

        Returns:
            Number of hypotheses successfully created
        """
        if not BATCH_AVAILABLE:
            logger.warning("⚠️ Batch create not available, falling back to sequential")
            count = 0
            for hypothesis in hypotheses:
                success = await self.save_hypothesis(hypothesis)
                if success:
                    count += 1
            return count

        try:
            batch = BatchHypothesisQuery(self)
            return await batch.create_hypotheses_batch(hypotheses)
        except Exception as e:
            logger.error(f"❌ Batch create failed: {e}")
            # Fallback to sequential
            count = 0
            for hypothesis in hypotheses:
                success = await self.save_hypothesis(hypothesis)
                if success:
                    count += 1
            return count


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
    # Test HypothesisRepository with native FalkorDB
    import asyncio

    async def test():
        print("=== Testing HypothesisRepository (Native FalkorDB) ===")

        repo = HypothesisRepository()

        if await repo.initialize():
            print("✅ Repository initialized")

            # Test saving hypothesis
            from backend.hypothesis_manager import Hypothesis

            h = Hypothesis(
                hypothesis_id="test_native_1",
                entity_id="test-entity",
                category="Test Category",
                statement="Test entity is preparing test procurement",
                prior_probability=0.5,
                confidence=0.6
            )

            if await repo.save_hypothesis(h):
                print("✅ Hypothesis saved")

            # Test loading hypothesis
            loaded = await repo.get_hypothesis("test_native_1")
            if loaded:
                print(f"✅ Hypothesis loaded: {loaded.hypothesis_id}")
                print(f"   Confidence: {loaded.confidence}")

            # Test cluster pattern frequency
            await repo.update_cluster_pattern_frequency("test_cluster_native", "Strategic Hire")
            frequencies = await repo.get_cluster_pattern_frequencies("test_cluster_native")
            print(f"✅ Cluster frequencies: {frequencies}")

            await repo.close()

        print("\n✅ HypothesisRepository test complete")

    asyncio.run(test())
