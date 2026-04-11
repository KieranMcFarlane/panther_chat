#!/usr/bin/env python3
"""
Graphiti temporal knowledge graph service
Handles entity tracking, episodes, and temporal relationship management

This service provides:
- Temporal episode tracking for RFPs
- Entity timeline history
- Temporal fit analysis based on historical patterns
- GraphRAG-enhanced entity understanding

Usage:
    from backend.graphiti_service import GraphitiService

    service = GraphitiService()
    await service.initialize()
    await service.add_rfp_episode(rfp_data)
"""

import os
import sys
import json
import logging
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path

# Load environment variables from .env.local
project_root = Path(__file__).parent.parent
env_files = [
    project_root / '.env.local',
    project_root / '.env',
    Path('.env.local'),
    Path('.env')
]

for env_file in env_files:
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file)
            break
        except ImportError:
            # Fallback: manual parsing
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key.strip()] = value.strip()
            break

# Try to import neo4j driver (FalkorDB compatible)
try:
    from neo4j import GraphDatabase, Driver
except ImportError:
    print("⚠️ neo4j not installed - FalkorDB features disabled")
    GraphDatabase = None
    Driver = None

# Try to import Supabase client
try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logging.warning("⚠️  Supabase client not available - temporal features will use native Cypher")

# Try to import Graphiti (optional - graceful degradation if not available)
try:
    from graphiti_core import Graphiti
    from graphiti_core.nodes import EpisodeType
    GRAPHITI_AVAILABLE = True
except ImportError:
    GRAPHITI_AVAILABLE = False
    logging.warning("⚠️  Graphiti not available - temporal features will use native Cypher")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class EpisodeSourceType(str, Enum):
    """Types of temporal episodes"""
    RFP_DETECTED = "RFP_DETECTED"
    RFP_RESPONDED = "RFP_RESPONDED"
    PARTNERSHIP_FORMED = "PARTNERSHIP_FORMED"
    PARTNERSHIP_ENDED = "PARTNERSHIP_ENDED"
    EXECUTIVE_CHANGE = "EXECUTIVE_CHANGE"
    TECHNOLOGY_ADOPTED = "TECHNOLOGY_ADOPTED"
    ACHIEVEMENT_UNLOCKED = "ACHIEVEMENT_UNLOCKED"
    LEAGUE_PROMOTION = "LEAGUE_PROMOTION"
    LEAGUE_RELEGATION = "LEAGUE_RELEGATION"
    VENUE_CHANGE = "VENUE_CHANGE"
    SPONSORSHIP = "SPONSORSHIP"
    OTHER = "OTHER"


@dataclass
class RFPEpisodeInput:
    """Input data for creating an RFP episode"""
    rfp_id: str
    organization: str
    entity_type: str  # Club, League, Person, etc.
    detected_at: str  # ISO timestamp
    title: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None  # LinkedIn, Perplexity, etc.
    url: Optional[str] = None
    estimated_value: Optional[float] = None
    category: Optional[str] = None
    confidence_score: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class TemporalEvent:
    """A temporal event in an entity's timeline"""
    timestamp: str
    event_type: str
    description: str
    impact_score: float
    source: Optional[str] = None
    related_entities: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class FitAnalysisRequest:
    """Request for temporal fit analysis"""
    entity_id: str
    rfp_id: str
    rfp_category: Optional[str] = None
    rfp_value: Optional[float] = None
    time_horizon: Optional[int] = 90  # days to look back


@dataclass
class FitAnalysisResult:
    """Result of temporal fit analysis"""
    entity_id: str
    rfp_id: str
    fit_score: float
    confidence: float
    trend_analysis: Dict[str, Any]
    key_factors: List[Dict[str, Any]]
    recommendations: List[str]
    analyzed_at: str


class GraphitiService:
    """
    Service for temporal knowledge graph operations

    Uses Graphiti when available, falling back to native Cypher
    implementations for temporal tracking.
    """

    def __init__(self):
        # Database configuration - backend writes must prefer service-role credentials.
        self.supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        self.supabase_key = (
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_ANON_KEY")
            or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        )
        self.use_supabase = bool(self.supabase_url and self.supabase_key and SUPABASE_AVAILABLE)

        # FalkorDB configuration (optional - for graph queries)
        self.falkordb_uri = os.getenv("FALKORDB_URI") or os.getenv("NEO4J_URI")
        self.falkordb_user = os.getenv("FALKORDB_USER") or os.getenv("NEO4J_USER", "neo4j")
        self.falkordb_password = os.getenv("FALKORDB_PASSWORD") or os.getenv("NEO4J_PASSWORD", "")

        # Supabase client
        self.supabase_client = None
        if self.use_supabase:
            self.supabase_client = create_client(self.supabase_url, self.supabase_key)

        # Neo4j/FalkorDB driver
        self.driver: Optional[Driver] = None

        # Graph name
        self.graph_name = "sports_intelligence"

        # Initialization flag
        self.initialized = False

        logger.info(f"🔗 Initializing GraphitiService (Supabase: {self.use_supabase})")

    @staticmethod
    def _get_neo4j_driver_uri(uri: Optional[str]) -> Optional[str]:
        """
        Return a Neo4j-driver-compatible URI, or None for Falkor redis schemes.
        """
        if not uri:
            return None

        parsed = urllib.parse.urlparse(uri)
        if parsed.scheme in {"redis", "rediss"}:
            return None

        return uri

    async def initialize(self) -> bool:
        """
        Initialize the service and build indices/constraints

        Returns:
            True if initialization successful
        """
        try:
            # Initialize FalkorDB driver if available
            driver_uri = self._get_neo4j_driver_uri(self.falkordb_uri)

            if GraphDatabase and driver_uri:
                self.driver = GraphDatabase.driver(
                    driver_uri,
                    auth=(self.falkordb_user, self.falkordb_password)
                )
                self.driver.verify_connectivity()
                logger.info("✅ FalkorDB connection established")
                self.initialized = True
            elif self.falkordb_uri and not driver_uri:
                logger.info("ℹ️ Skipping Neo4j driver init for FalkorDB redis URI; using Supabase/native fallbacks")
                self.initialized = self.use_supabase
            elif self.use_supabase:
                logger.info("✅ Using Supabase for temporal tracking")
                self.initialized = True
            else:
                logger.warning("⚠️  No database connection available")
                self.initialized = True  # Still mark as initialized for limited functionality

            return True

        except Exception as e:
            logger.error(f"❌ Failed to initialize GraphitiService: {e}")
            # Still return True if Supabase is available
            self.initialized = self.use_supabase
            return self.initialized

    async def _build_temporal_indices(self):
        """Build indices for temporal queries (No-op for Supabase)"""
        if not self.driver:
            return

        indices = [
            "CREATE INDEX entity_name_index IF NOT EXISTS FOR (n:Entity) ON (n.name)",
            "CREATE INDEX episode_timestamp_index IF NOT EXISTS FOR (e:Episode) ON (e.timestamp)",
            "CREATE INDEX episode_entity_index IF NOT EXISTS FOR (e:Episode) ON (e.entity_id)",
            "CREATE INDEX episode_type_index IF NOT EXISTS FOR (e:Episode) ON (e.episode_type)",
        ]

        with self.driver.session(database=self.graph_name) as session:
            for index_query in indices:
                try:
                    session.run(index_query)
                except Exception as e:
                    logger.debug(f"Index creation note: {e}")

        logger.info("✅ Temporal indices created")

    async def add_rfp_episode(self, rfp_data: Dict) -> Dict[str, Any]:
        """
        Add RFP detection as a temporal episode with entity tracking

        Args:
            rfp_data: Dictionary containing RFP information

        Returns:
            Created episode data
        """
        if self.use_supabase and self.supabase_client:
            return await self._add_rfp_episode_supabase(rfp_data)

        if not self.driver:
            logger.warning("⚠️ No temporal backend available - RFP episode not stored")
            return {
                'episode_id': 'temp',
                'organization': rfp_data.get('organization'),
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'status': 'not_stored'
            }

        # Fallback to FalkorDB implementation
        return await self._add_rfp_episode_falkordb(rfp_data)

    async def _add_rfp_episode_supabase(self, rfp_data: Dict) -> Dict[str, Any]:
        """Add RFP episode using Supabase"""
        rfp_id = rfp_data.get('rfp_id')
        organization = rfp_data.get('organization')
        entity_type = rfp_data.get('entity_type', 'Entity')
        detected_at = rfp_data.get('detected_at', datetime.now(timezone.utc).isoformat())
        title = rfp_data.get('title')
        description = rfp_data.get('description', f"RFP detected: {title or 'Unknown'}")

        # Insert into temporal_episodes
        episode_data = {
            'entity_id': organization.lower().replace(' ', '-'),
            'entity_name': organization,
            'entity_type': entity_type,
            'episode_type': EpisodeSourceType.RFP_DETECTED,
            'timestamp': detected_at,
            'description': description,
            'source': rfp_data.get('source'),
            'url': rfp_data.get('url'),
            'category': rfp_data.get('category'),
            'estimated_value': rfp_data.get('estimated_value'),
            'confidence_score': rfp_data.get('confidence_score'),
            'metadata': rfp_data.get('metadata', {})
        }

        self.supabase_client.table('temporal_episodes').insert(episode_data).execute()

        # Also track in rfp_tracking table
        rfp_tracking_data = {
            'rfp_id': rfp_id,
            'title': title,
            'description': description,
            'organization': organization,
            'source': rfp_data.get('source'),
            'url': rfp_data.get('url'),
            'category': rfp_data.get('category'),
            'estimated_value': rfp_data.get('estimated_value'),
            'detection_confidence': rfp_data.get('confidence_score'),
            'metadata': rfp_data.get('metadata', {})
        }

        # Use conflict-aware upsert so repeat runs are idempotent on rfp_id.
        rfp_tracking_table = self.supabase_client.table('rfp_tracking')
        try:
            rfp_tracking_table.upsert(rfp_tracking_data, on_conflict='rfp_id').execute()
        except TypeError:
            # Backward compatibility for clients without explicit on_conflict support.
            rfp_tracking_table.upsert(rfp_tracking_data).execute()

        logger.info(f"✅ Created RFP episode: {rfp_id} for {organization} (Supabase)")

        return {
            'episode_id': f"rfp_{rfp_id}",
            'organization': organization,
            'timestamp': detected_at,
            'status': 'created'
        }

    async def _add_rfp_episode_falkordb(self, rfp_data: Dict) -> Dict[str, Any]:
        """Add RFP episode using FalkorDB (fallback)"""
        rfp_id = rfp_data.get('rfp_id')
        organization = rfp_data.get('organization')
        entity_type = rfp_data.get('entity_type', 'Entity')
        detected_at = rfp_data.get('detected_at', datetime.now(timezone.utc).isoformat())
        description = rfp_data.get('description', f"RFP detected: {rfp_data.get('title', 'Unknown')}")

        # Find or create the entity node
        with self.driver.session(database=self.graph_name) as session:
            # First, find the entity by name
            entity_result = session.run("""
                MATCH (n {name: $organization})
                RETURN n
                LIMIT 1
            """, organization=organization)

            entity = entity_result.single()

            if not entity:
                # Create entity if not found
                session.run("""
                    CREATE (n:{entity_type} {{
                        name: $organization,
                        created_at: datetime()
                    }})
                    RETURN n
                """.format(entity_type=entity_type), organization=organization)

            # Create the episode
            episode_query = """
                MATCH (e {name: $organization})
                CREATE (ep:Episode {
                    episode_id: $episode_id,
                    episode_type: $episode_type,
                    timestamp: datetime($timestamp),
                    description: $description,
                    source: $source,
                    url: $url,
                    estimated_value: $estimated_value,
                    category: $category,
                    confidence_score: $confidence_score,
                    metadata: $metadata,
                    created_at: datetime()
                })
                CREATE (e)-[:HAS_EPISODE]->(ep)
                RETURN ep
            """

            episode_result = session.run(episode_query, {
                'organization': organization,
                'episode_id': f"rfp_{rfp_id}",
                'episode_type': EpisodeSourceType.RFP_DETECTED,
                'timestamp': detected_at,
                'description': description,
                'source': rfp_data.get('source'),
                'url': rfp_data.get('url'),
                'estimated_value': rfp_data.get('estimated_value'),
                'category': rfp_data.get('category'),
                'confidence_score': rfp_data.get('confidence_score'),
                'metadata': rfp_data.get('metadata', {})
            })

            episode = episode_result.single()

        logger.info(f"✅ Created RFP episode: {rfp_id} for {organization} (FalkorDB)")

        return {
            'episode_id': f"rfp_{rfp_id}",
            'organization': organization,
            'timestamp': detected_at,
            'status': 'created'
        }

    async def persist_unified_rfp(self, rfp_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Persist a validated RFP into the shared unified RFP table when available.

        Falls back to the RFP tracking table if the unified table is unavailable.
        """
        if not self.supabase_client:
            return {
                'rfp_id': rfp_data.get('rfp_id'),
                'status': 'skipped',
                'reason': 'supabase_unavailable',
            }

        unified_payload = {
            'title': rfp_data.get('title') or 'Validated RFP signal',
            'organization': rfp_data.get('organization'),
            'description': rfp_data.get('description'),
            'location': rfp_data.get('location'),
            'source': rfp_data.get('source', 'ai-detected'),
            'source_url': rfp_data.get('source_url'),
            'category': rfp_data.get('category'),
            'status': rfp_data.get('status', 'detected'),
            'priority': rfp_data.get('priority', 'medium'),
            'priority_score': rfp_data.get('priority_score', 5),
            'confidence_score': rfp_data.get('confidence_score'),
            'confidence': rfp_data.get('confidence'),
            'yellow_panther_fit': rfp_data.get('yellow_panther_fit'),
            'entity_id': rfp_data.get('entity_id'),
            'entity_name': rfp_data.get('entity_name'),
            'entity_type': rfp_data.get('entity_type'),
            'estimated_value': rfp_data.get('estimated_value'),
            'requirements': rfp_data.get('requirements'),
            'agent_notes': rfp_data.get('agent_notes'),
            'contact_info': rfp_data.get('contact_info'),
            'competition_info': rfp_data.get('competition_info'),
            'metadata': {
                **(rfp_data.get('metadata') or {}),
                'rfp_id': rfp_data.get('rfp_id'),
            },
            'tags': rfp_data.get('tags'),
            'keywords': rfp_data.get('keywords'),
        }

        try:
            result = self.supabase_client.table('rfp_opportunities_unified').insert(unified_payload).execute()
            inserted = result.data[0] if getattr(result, 'data', None) else {}
            return {
                'rfp_id': rfp_data.get('rfp_id'),
                'status': 'inserted',
                'record_id': inserted.get('id'),
            }
        except Exception as exc:
            logger.warning(f"⚠️ Failed to write unified RFP table, falling back to rfp_tracking: {exc}")
            fallback_payload = {
                'rfp_id': rfp_data.get('rfp_id'),
                'title': rfp_data.get('title'),
                'description': rfp_data.get('description'),
                'organization': rfp_data.get('organization'),
                'source': rfp_data.get('source', 'ai-detected'),
                'url': rfp_data.get('source_url'),
                'category': rfp_data.get('category'),
                'estimated_value': rfp_data.get('estimated_value'),
                'detection_confidence': rfp_data.get('confidence_score'),
                'metadata': rfp_data.get('metadata', {}),
            }
            try:
                self.supabase_client.table('rfp_tracking').upsert(fallback_payload).execute()
                return {
                    'rfp_id': rfp_data.get('rfp_id'),
                    'status': 'fallback_tracking',
                }
            except Exception as fallback_exc:  # noqa: BLE001
                message = str(fallback_exc)
                # Duplicate/conflict writes are expected under idempotent replays.
                if "409" in message or "23505" in message or "duplicate" in message.lower():
                    logger.info(
                        "ℹ️ rfp_tracking conflict treated as idempotent success for %s: %s",
                        rfp_data.get('rfp_id'),
                        fallback_exc,
                    )
                    return {
                        'rfp_id': rfp_data.get('rfp_id'),
                        'status': 'fallback_tracking_existing',
                    }
                raise

    async def persist_pipeline_record_supabase(self, envelope: Dict[str, Any]) -> Dict[str, Any]:
        """
        Persist pipeline run envelope to Supabase with idempotency guard.
        """
        if not self.use_supabase or not self.supabase_client:
            raise RuntimeError("Supabase client not available for pipeline persistence")

        idempotency_key = str(envelope.get("idempotency_key") or "").strip()
        entity_id = str(envelope.get("entity_id") or "").strip()
        if not idempotency_key or not entity_id:
            raise ValueError("idempotency_key and entity_id are required")

        existing = (
            self.supabase_client.table("temporal_episodes")
            .select("id")
            .eq("entity_id", entity_id)
            .eq("episode_type", "PIPELINE_PERSISTENCE")
            .contains("metadata", {"idempotency_key": idempotency_key})
            .limit(1)
            .execute()
        )
        if existing.data:
            return {"status": "existing", "idempotency_key": idempotency_key, "backend": "supabase"}

        now_iso = datetime.now(timezone.utc).isoformat()
        full_payload = envelope.get("payload") if isinstance(envelope.get("payload"), dict) else {}
        payload_for_episode = dict(full_payload)
        # Keep temporal episode metadata compact; large artifacts are stored in entity_dossiers.
        payload_for_episode.pop("dossier", None)
        payload_for_episode.pop("discovery_result", None)

        payload = {
            "entity_id": entity_id,
            "entity_name": str(envelope.get("entity_id") or ""),
            "entity_type": "PIPELINE_RUN",
            "episode_type": "PIPELINE_PERSISTENCE",
            "timestamp": now_iso,
            "discovery_date": now_iso,
            "description": f"Pipeline persistence checkpoint: {envelope.get('phase')}",
            "source": "pipeline_orchestrator",
            "url": None,
            "confidence_score": None,
            "metadata": {
                "idempotency_key": idempotency_key,
                "run_id": envelope.get("run_id"),
                "phase": envelope.get("phase"),
                "record_type": envelope.get("record_type"),
                "record_id": envelope.get("record_id"),
                "payload": payload_for_episode,
            },
        }
        self.supabase_client.table("temporal_episodes").insert(payload).execute()
        await self._upsert_entity_dossier_from_pipeline_payload(
            entity_id=entity_id,
            run_payload=full_payload,
        )
        return {"status": "inserted", "idempotency_key": idempotency_key, "backend": "supabase"}

    async def _upsert_entity_dossier_from_pipeline_payload(
        self,
        *,
        entity_id: str,
        run_payload: Dict[str, Any],
    ) -> None:
        """
        Persist phase-0 dossier snapshots so the entity browser dossier view can load
        directly from Supabase after pipeline completion.
        """
        if not isinstance(run_payload, dict):
            return
        dossier = run_payload.get("dossier")
        if not isinstance(dossier, dict) or not dossier:
            return

        metadata = dossier.get("metadata") if isinstance(dossier.get("metadata"), dict) else {}
        sections = dossier.get("sections") if isinstance(dossier.get("sections"), list) else []
        generated_at = datetime.now(timezone.utc).isoformat()
        raw_priority = dossier.get("priority_score")
        if raw_priority is None:
            raw_priority = metadata.get("priority_score")
        if raw_priority is None:
            raw_priority = metadata.get("tier_score")
        try:
            priority_score = int(raw_priority)
        except (TypeError, ValueError):
            priority_score = 50
        tier = str(dossier.get("tier") or metadata.get("tier") or "BASIC").strip().upper() or "BASIC"
        entity_type = str(
            dossier.get("entity_type")
            or run_payload.get("entity_type")
            or "CLUB"
        ).strip().upper() or "CLUB"
        canonical_entity_id = str(
            dossier.get("canonical_entity_id")
            or metadata.get("canonical_entity_id")
            or run_payload.get("canonical_entity_id")
            or ""
        ).strip() or None

        record = {
            "entity_id": entity_id,
            "canonical_entity_id": canonical_entity_id,
            "entity_name": str(
                dossier.get("entity_name")
                or run_payload.get("entity_name")
                or entity_id
            ),
            "entity_type": entity_type,
            "priority_score": priority_score,
            "tier": tier,
            "dossier_data": dossier,
            "sections": sections,
            "generated_at": generated_at,
            "total_cost_usd": float(dossier.get("total_cost_usd") or metadata.get("total_cost_usd") or 0.0),
            "generation_time_seconds": float(
                dossier.get("generation_time_seconds") or metadata.get("generation_time_seconds") or 0.0
            ),
            "cache_status": "FRESH",
            "updated_at": generated_at,
            "created_at": generated_at,
        }
        # Upsert avoids race conditions and duplicate key insert failures across retries/workers.
        conflict_key = "canonical_entity_id" if canonical_entity_id else "entity_id"
        self.supabase_client.table("entity_dossiers").upsert(record, on_conflict=conflict_key).execute()

    async def persist_pipeline_record_falkordb(self, envelope: Dict[str, Any]) -> Dict[str, Any]:
        """
        Persist pipeline run envelope to FalkorDB with idempotency guard.
        """
        idempotency_key = str(envelope.get("idempotency_key") or "").strip()
        entity_id = str(envelope.get("entity_id") or "").strip()
        if not idempotency_key or not entity_id:
            raise ValueError("idempotency_key and entity_id are required")

        query = """
        MERGE (p:PipelinePersistenceRecord {idempotency_key: $idempotency_key})
        SET p.entity_id = $entity_id,
            p.run_id = $run_id,
            p.phase = $phase,
            p.record_type = $record_type,
            p.record_id = $record_id,
            p.payload_json = $payload_json,
            p.persisted_at = $persisted_at
        RETURN p.idempotency_key AS idempotency_key
        """
        params = {
            "idempotency_key": idempotency_key,
            "entity_id": entity_id,
            "run_id": str(envelope.get("run_id") or ""),
            "phase": str(envelope.get("phase") or ""),
            "record_type": str(envelope.get("record_type") or ""),
            "record_id": str(envelope.get("record_id") or ""),
            "payload_json": json.dumps(
                envelope.get("payload") if isinstance(envelope.get("payload"), dict) else {},
                default=str,
            ),
            "persisted_at": datetime.now(timezone.utc).isoformat(),
        }

        if self.driver:
            with self.driver.session(database=self.graph_name) as session:
                session.run(query, params)
            return {"status": "merged", "idempotency_key": idempotency_key, "backend": "falkordb_neo4j_driver"}

        if not self.falkordb_uri:
            raise RuntimeError("FalkorDB URI not configured for pipeline persistence")

        try:
            from falkordb import FalkorDB  # type: ignore
        except Exception as error:  # noqa: BLE001
            raise RuntimeError("falkordb package not available for pipeline persistence") from error

        parsed = urllib.parse.urlparse(
            self.falkordb_uri.replace("rediss://", "http://").replace("redis://", "http://")
        )
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        client = FalkorDB(
            host=host,
            port=port,
            username=self.falkordb_user,
            password=self.falkordb_password,
            ssl=False,
        )
        graph = client.select_graph(self.graph_name)
        graph.query(query, params)
        return {"status": "merged", "idempotency_key": idempotency_key, "backend": "falkordb_native"}

    @staticmethod
    def _safe_iso_datetime(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            normalized = str(value).replace("Z", "+00:00")
            parsed = datetime.fromisoformat(normalized)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except Exception:
            return None

    @staticmethod
    def _humanize_service_label(service_code: Optional[str]) -> str:
        label = str(service_code or "").strip().replace("_", " ").lower()
        return label or "signal"

    @staticmethod
    def _safe_float(value: Any, default: float = 0.0) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return default
        return numeric if numeric == numeric else default

    def _select_homepage_insight_candidate(
        self,
        *,
        entity_name: str,
        dossier: Dict[str, Any],
        validated_signals: List[Dict[str, Any]],
        episodes: List[Dict[str, Any]],
        scores: Dict[str, Any],
        discovery_result: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        sales_readiness = str(scores.get("sales_readiness") or "").strip().upper()
        active_probability_value = self._safe_float(scores.get("active_probability"))
        discovery_confidence = discovery_result.get("final_confidence") if isinstance(discovery_result, dict) else None
        discovery_confidence_value = self._safe_float(discovery_confidence)

        def _question_lookup_key(question: Dict[str, Any]) -> str:
            return str(
                question.get("question_id")
                or question.get("question_text")
                or question.get("question")
                or ""
            ).strip().lower()

        def _build_question_first_candidate() -> Optional[Dict[str, Any]]:
            question_first = dossier.get("question_first") if isinstance(dossier.get("question_first"), dict) else {}
            answers = question_first.get("answers") if isinstance(question_first.get("answers"), list) else []
            dossier_promotions = question_first.get("dossier_promotions") if isinstance(question_first.get("dossier_promotions"), list) else []
            questions = dossier.get("questions") if isinstance(dossier.get("questions"), list) else []
            if not answers and not dossier_promotions:
                return None

            question_index: Dict[str, Dict[str, Any]] = {}
            for question in questions:
                if isinstance(question, dict):
                    question_index[_question_lookup_key(question)] = question

            selected_promotion = None
            if dossier_promotions:
                eligible_promotions = [
                    item for item in dossier_promotions
                    if isinstance(item, dict) and self._safe_float(item.get("confidence")) >= 0.7 and str(item.get("evidence_url") or "").strip()
                ]
                if eligible_promotions:
                    selected_promotion = sorted(
                        eligible_promotions,
                        key=lambda item: (
                            self._safe_float(item.get("confidence")),
                            len(str(item.get("answer") or "")),
                        ),
                        reverse=True,
                    )[0]

            validated_answers: List[Dict[str, Any]] = []
            for answer in answers:
                if not isinstance(answer, dict):
                    continue
                validation_state = str(answer.get("validation_state") or "").strip().lower()
                confidence_value = self._safe_float(answer.get("confidence"))
                if validation_state == "validated" and confidence_value >= 0.7:
                    validated_answers.append(answer)

            if not selected_promotion and not validated_answers:
                return None

            if selected_promotion:
                promoted_question_id = str(selected_promotion.get("question_id") or "").strip().lower()
                selected_answer = next(
                    (
                        answer for answer in validated_answers
                        if str(answer.get("question_id") or answer.get("question_text") or "").strip().lower() == promoted_question_id
                    ),
                    {
                        "question_id": selected_promotion.get("question_id"),
                        "question_text": selected_promotion.get("question_text"),
                        "answer": selected_promotion.get("answer"),
                        "confidence": selected_promotion.get("confidence"),
                        "validation_state": "validated",
                        "evidence_url": selected_promotion.get("evidence_url"),
                        "signal_type": selected_promotion.get("signal_type"),
                    },
                )
            else:
                selected_answer = sorted(
                    validated_answers,
                    key=lambda item: (
                        self._safe_float(item.get("confidence")),
                        1 if bool(item.get("search_hit")) else 0,
                    ),
                    reverse=True,
                )[0]

            selected_question = question_index.get(
                str(selected_answer.get("question_id") or selected_answer.get("question_text") or "").strip().lower()
            ) or {}
            service_fit = selected_question.get("yp_service_fit") if isinstance(selected_question.get("yp_service_fit"), list) else []
            service_code = service_fit[0] if service_fit else "question_first"
            service_label = self._humanize_service_label(service_code)
            question_text = str(
                selected_answer.get("question_text")
                or selected_question.get("question")
                or selected_question.get("question_text")
                or f"Question-first evidence for {entity_name}"
            ).strip()
            answer_text = str(selected_answer.get("answer") or question_text).strip()
            question_first_answers = question_first.get("answers") or []
            confidence_value = max(
                self._safe_float(selected_answer.get("confidence")),
                active_probability_value,
                discovery_confidence_value,
            )

            return {
                "signal_basis": "question_first",
                "signal_statement": answer_text,
                "title": f"{entity_name}: {service_label} opportunity signal",
                "suggested_action": str(
                    selected_question.get("yp_advantage")
                    or f"Review {service_label} evidence and prepare outreach."
                ).strip(),
                "why_it_matters": f"Question-first BrightData evidence validated a {service_label} trigger.",
                "confidence": round(min(0.99, confidence_value), 4),
                "selected_signal": None,
                "selected_episode": episodes[0] if episodes and isinstance(episodes[0], dict) else None,
                "source_signal_id": str(selected_answer.get("question_id") or selected_answer.get("evidence_url") or selected_answer.get("id") or ""),
                "source_episode_id": str((episodes[0].get("episode_id") if episodes and isinstance(episodes[0], dict) else "") or ""),
                "question_first_answer": selected_answer,
                "question_first_question": selected_question,
                "question_first_promotion": selected_promotion,
                "question_first_summary": {
                    "questions_answered": int(question_first.get("questions_answered") or len(question_first_answers) or 0),
                    "validated_answers": len(validated_answers),
                    "promoted_answers": len(dossier_promotions),
                    "service_fit": service_fit,
                },
            }

        def _build_validated_signal_candidate() -> Optional[Dict[str, Any]]:
            if not validated_signals:
                return None

            def _signal_sort_key(signal: Dict[str, Any]) -> tuple[int, float]:
                signal_type = str(signal.get("type") or signal.get("signal_type") or "").upper()
                confidence_value = self._safe_float(signal.get("confidence"))
                return (1 if signal_type == "RFP_DETECTED" else 0, confidence_value)

            selected_signal = sorted(
                [signal for signal in validated_signals if isinstance(signal, dict)],
                key=_signal_sort_key,
                reverse=True,
            )[0]
            selected_episode = episodes[0] if episodes and isinstance(episodes[0], dict) else None
            signal_type = str(selected_signal.get("type") or selected_signal.get("signal_type") or "").upper()
            signal_statement = str(
                selected_signal.get("statement")
                or selected_signal.get("text")
                or selected_signal.get("title")
                or (selected_episode or {}).get("description")
                or dossier.get("summary")
                or f"Fresh pipeline evidence for {entity_name}"
            ).strip()
            if len(signal_statement) > 180:
                signal_statement = f"{signal_statement[:177].rstrip()}..."

            confidence_value = max(
                self._safe_float(selected_signal.get("confidence")),
                active_probability_value,
                discovery_confidence_value,
            )

            if signal_type == "RFP_DETECTED":
                title = f"{entity_name}: validated opportunity signal"
                suggested_action = f"Review the latest opportunity window for {entity_name} and prepare outreach."
                why_it_matters = "Graphiti linked the newest evidence to a live opportunity window."
            else:
                title = f"{entity_name}: fresh validated signal"
                suggested_action = f"Monitor {entity_name} for the next Graphiti pass and related evidence."
                why_it_matters = "Graphiti grounded this insight in validated pipeline evidence."

            return {
                "signal_basis": "validated_signal",
                "signal_statement": signal_statement,
                "title": title,
                "suggested_action": suggested_action,
                "why_it_matters": why_it_matters,
                "confidence": round(min(0.99, confidence_value), 4),
                "selected_signal": selected_signal,
                "selected_episode": selected_episode,
                "source_signal_id": str(selected_signal.get("id") or selected_signal.get("signal_id") or ""),
                "source_episode_id": str((selected_episode or {}).get("episode_id") or (selected_episode or {}).get("id") or ""),
            }

        def _build_sales_readiness_candidate() -> Optional[Dict[str, Any]]:
            if not (sales_readiness == "LIVE" or active_probability_value >= 0.8):
                return None

            selected_episode = episodes[0] if episodes and isinstance(episodes[0], dict) else None
            signal_statement = str(
                (selected_episode or {}).get("description")
                or dossier.get("summary")
                or f"Strong pipeline movement detected for {entity_name}"
            ).strip()
            if len(signal_statement) > 180:
                signal_statement = f"{signal_statement[:177].rstrip()}..."

            return {
                "signal_basis": "sales_readiness",
                "signal_statement": signal_statement,
                "title": f"{entity_name}: strong pipeline movement",
                "suggested_action": f"Prioritise follow-up while the {entity_name} signal remains fresh.",
                "why_it_matters": "Graphiti linked the newest evidence to a live opportunity window.",
                "confidence": round(min(0.99, max(active_probability_value, discovery_confidence_value)), 4),
                "selected_signal": None,
                "selected_episode": selected_episode,
                "source_signal_id": "",
                "source_episode_id": str((selected_episode or {}).get("episode_id") or (selected_episode or {}).get("id") or ""),
            }

        for candidate_builder in (_build_validated_signal_candidate, _build_question_first_candidate, _build_sales_readiness_candidate):
            candidate = candidate_builder()
            if candidate:
                return candidate

        return None

    def _build_homepage_insight_record(
        self,
        *,
        run_result: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        artifacts = run_result.get("artifacts") if isinstance(run_result.get("artifacts"), dict) else {}
        dossier = artifacts.get("dossier") if isinstance(artifacts.get("dossier"), dict) else {}
        discovery_result = artifacts.get("discovery_result") if isinstance(artifacts.get("discovery_result"), dict) else {}
        validated_signals = artifacts.get("validated_signals") if isinstance(artifacts.get("validated_signals"), list) else []
        episodes = artifacts.get("episodes") if isinstance(artifacts.get("episodes"), list) else []
        scores = run_result.get("scores") if isinstance(run_result.get("scores"), dict) else {}
        phase_results = run_result.get("phase_details_by_phase") if isinstance(run_result.get("phase_details_by_phase"), dict) else run_result.get("phases")
        if not isinstance(phase_results, dict):
            phase_results = {}

        entity_id = str(run_result.get("entity_id") or dossier.get("entity_id") or "").strip() or "unknown-entity"
        entity_name = str(run_result.get("entity_name") or dossier.get("entity_name") or entity_id).strip() or entity_id
        entity_type = str(run_result.get("entity_type") or dossier.get("entity_type") or "ENTITY").strip().upper() or "ENTITY"
        completed_at = str(run_result.get("completed_at") or datetime.now(timezone.utc).isoformat())
        completed_dt = self._safe_iso_datetime(completed_at) or datetime.now(timezone.utc)
        materialized_at = datetime.now(timezone.utc)
        discovery_confidence = getattr(discovery_result, "final_confidence", None)
        if discovery_confidence is None and isinstance(discovery_result, dict):
            discovery_confidence = discovery_result.get("final_confidence")

        candidate = self._select_homepage_insight_candidate(
            entity_name=entity_name,
            dossier=dossier,
            validated_signals=validated_signals,
            episodes=episodes,
            scores=scores,
            discovery_result={
                "final_confidence": discovery_confidence,
            },
        )
        if candidate is None:
            return None

        selected_signal = candidate.get("selected_signal") if isinstance(candidate.get("selected_signal"), dict) else None
        selected_episode = candidate.get("selected_episode") if isinstance(candidate.get("selected_episode"), dict) else None
        signal_statement = str(candidate.get("signal_statement") or f"Fresh pipeline evidence for {entity_name}").strip()
        if len(signal_statement) > 180:
            signal_statement = f"{signal_statement[:177].rstrip()}..."
        confidence = self._safe_float(candidate.get("confidence"))
        signal_basis = str(candidate.get("signal_basis") or "context_refresh").strip()
        sales_readiness = str(scores.get("sales_readiness") or "").strip().upper()
        active_probability = scores.get("active_probability")
        active_probability_value = self._safe_float(active_probability)

        entity_type_lower = entity_type.lower()
        if entity_type_lower in {"club", "team"}:
            canonical_type = "team"
        elif entity_type_lower in {"league"}:
            canonical_type = "league"
        elif entity_type_lower in {"federation"}:
            canonical_type = "federation"
        elif entity_type_lower in {"rights_holder", "rightsholder"}:
            canonical_type = "rights_holder"
        else:
            canonical_type = "organisation"

        freshness = "recent"
        age_hours = (materialized_at - completed_dt).total_seconds() / 3600.0
        if age_hours <= 24:
            freshness = "new"
        elif age_hours > 72:
            freshness = "stale"

        title = str(candidate.get("title") or f"{entity_name}: pipeline context refreshed").strip()
        suggested_action = str(candidate.get("suggested_action") or f"Monitor {entity_name} for the next validated signal.").strip()
        why_it_matters = str(candidate.get("why_it_matters") or "This is the latest materialized context from the Graphiti pipeline.").strip()

        related_relationships: List[Dict[str, Any]] = []
        dossier_relationships = dossier.get("relationships") if isinstance(dossier.get("relationships"), list) else []
        for relationship in dossier_relationships:
            if not isinstance(relationship, dict):
                continue
            target_name = str(
                relationship.get("target_name")
                or relationship.get("name")
                or relationship.get("entity_name")
                or ""
            ).strip()
            if not target_name:
                continue
            related_relationships.append({
                "type": str(relationship.get("type") or "related_to"),
                "target_id": str(relationship.get("target_id") or relationship.get("id") or target_name.lower().replace(" ", "-")),
                "target_name": target_name,
                "direction": str(relationship.get("direction") or "outbound"),
            })

        if not related_relationships and selected_signal:
            related_entities = selected_signal.get("related_entities")
            if isinstance(related_entities, list):
                for target in related_entities:
                    if isinstance(target, str) and target.strip():
                        related_relationships.append({
                            "type": "related_to",
                            "target_id": target.lower().replace(" ", "-"),
                            "target_name": target.strip(),
                            "direction": "bidirectional",
                        })

        evidence: List[Dict[str, Any]] = []
        if signal_basis == "question_first":
            question_first_answer = candidate.get("question_first_answer") if isinstance(candidate.get("question_first_answer"), dict) else {}
            evidence.append({
                "type": "note",
                "id": str(question_first_answer.get("question_id") or f"{entity_id}:{run_result.get('run_id') or 'run'}:question-first"),
                "snippet": signal_statement,
                "source": str(question_first_answer.get("evidence_url") or "question_first_runner"),
            })
        if selected_episode:
            evidence.append({
                "type": "episode",
                "id": str(selected_episode.get("episode_id") or selected_episode.get("id") or f"{entity_id}:{run_result.get('run_id') or 'run'}"),
                "snippet": str(
                    selected_episode.get("description")
                    or selected_episode.get("summary")
                    or signal_statement
                ),
                "source": str(selected_episode.get("source") or "pipeline_orchestrator"),
            })
        if selected_signal:
            evidence.append({
                "type": "note",
                "id": str(selected_signal.get("id") or selected_signal.get("signal_id") or f"{entity_id}:{run_result.get('run_id') or 'run'}:signal"),
                "snippet": signal_statement,
                "source": str(selected_signal.get("source") or "graphiti_pipeline"),
            })
        if not evidence:
            evidence.append({
                "type": "note",
                "id": f"{entity_id}:{run_result.get('run_id') or 'run'}:context",
                "snippet": signal_statement,
                "source": "graphiti_pipeline",
            })

        insight_id = f"{run_result.get('run_id') or 'run'}:{entity_id}"
        return {
            "insight_id": insight_id,
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": canonical_type,
            "sport": str(dossier.get("sport") or run_result.get("sport") or "unknown").strip() or "unknown",
            "league": str(dossier.get("league") or run_result.get("league") or "").strip() or None,
            "title": title,
            "summary": signal_statement,
            "why_it_matters": why_it_matters,
            "confidence": confidence,
            "freshness": freshness,
            "evidence": evidence,
            "relationships": related_relationships,
            "suggested_action": suggested_action,
            "detected_at": completed_at,
            "source_run_id": str(run_result.get("run_id") or ""),
            "source_signal_id": str((selected_signal or {}).get("id") or (selected_signal or {}).get("signal_id") or ""),
            "source_episode_id": str((selected_episode or {}).get("episode_id") or (selected_episode or {}).get("id") or ""),
            "materialized_at": materialized_at.isoformat(),
            "updated_at": materialized_at.isoformat(),
            "source_objective": str(run_result.get("objective") or run_result.get("effective_objective") or ""),
            "raw_payload": {
                "run_id": run_result.get("run_id"),
                "entity_id": entity_id,
                "entity_name": entity_name,
                "objective": run_result.get("objective"),
                "sales_readiness": scores.get("sales_readiness"),
                "active_probability": scores.get("active_probability"),
                "validated_signal_count": len(validated_signals),
                "episode_count": len(episodes),
                "signal_basis": signal_basis,
                "signal_quality": confidence,
                "question_first_question_id": str((candidate.get("question_first_question") or {}).get("question_id") or ""),
                "question_first_validation_state": str((candidate.get("question_first_answer") or {}).get("validation_state") or ""),
                "phase_status": {phase: details.get("status") for phase, details in phase_results.items() if isinstance(details, dict)},
            },
        }

    async def materialize_homepage_insight(self, run_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Materialize a homepage-ready insight from the latest pipeline run.

        The homepage reads this persisted feed instead of traversing Graphiti on demand.
        """
        if not self.use_supabase or not self.supabase_client:
            return {
                "status": "skipped",
                "reason": "supabase_unavailable",
            }

        insight_record = self._build_homepage_insight_record(run_result=run_result)
        if not insight_record:
            return {
                "status": "skipped",
                "reason": "insufficient_signal_quality",
            }
        self.supabase_client.table("homepage_graphiti_insights").upsert(
            insight_record,
            on_conflict="insight_id",
        ).execute()
        return {
            "status": "materialized",
            "insight_id": insight_record["insight_id"],
            "entity_id": insight_record["entity_id"],
            "entity_name": insight_record["entity_name"],
            "materialized_at": insight_record["materialized_at"],
        }

    async def add_discovery_episode(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        episode_type: str,
        description: str,
        source: str = "discovery",
        url: Optional[str] = None,
        confidence: float = 0.5,
        evidence_date: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Add a discovery result as a temporal episode

        This stores any discovered signal/evidence as a temporal episode that
        contributes to the entity's temporal intelligence profile.

        Args:
            entity_id: Entity identifier
            entity_name: Human-readable entity name
            entity_type: Type of entity
            episode_type: Type of episode (RFP_DETECTED, CRM_ANALYTICS, etc.)
            description: Description of the discovery
            source: Source of the discovery
            url: URL where discovery was made
            confidence: Confidence score (0-1)
            evidence_date: When the evidence was originally published (ISO format string)
                           If None, defaults to discovery_date (now)
            metadata: Additional metadata

        Returns:
            Created episode data
        """
        discovery_date = datetime.now(timezone.utc).isoformat()
        metadata = metadata or {}

        # Use evidence_date if provided, otherwise default to discovery_date
        episode_timestamp = evidence_date if evidence_date else discovery_date

        if self.use_supabase and self.supabase_client:
            # Store in Supabase with separate discovery_date and evidence_date
            episode_data = {
                'entity_id': entity_id.lower().replace(' ', '-'),
                'entity_name': entity_name,
                'entity_type': entity_type,
                'episode_type': episode_type,
                'timestamp': episode_timestamp,  # This is evidence_date for temporal analysis
                'discovery_date': discovery_date,  # When we discovered it
                'description': description,
                'source': source,
                'url': url,
                'confidence_score': confidence,
                'metadata': {
                    **metadata,
                    'has_evidence_date': evidence_date is not None
                }
            }

            self.supabase_client.table('temporal_episodes').insert(episode_data).execute()

            logger.info(f"✅ Created discovery episode: {episode_type} for {entity_name} (evidence_date: {episode_timestamp[:10]}, discovery_date: {discovery_date[:10]})")

            return {
                'episode_id': f"{entity_id}_{episode_type}_{int(datetime.now(timezone.utc).timestamp())}",
                'entity_id': entity_id,
                'timestamp': episode_timestamp,
                'discovery_date': discovery_date,
                'status': 'created'
            }

        # Fallback to FalkorDB
        if not self.driver:
            logger.warning("⚠️ No database available - episode not stored")
            return {
                'episode_id': 'temp',
                'timestamp': episode_timestamp,
                'status': 'not_stored'
            }

        with self.driver.session(database=self.graph_name) as session:
            # Find or create entity
            entity_result = session.run("""
                MATCH (n {name: $entity_id})
                RETURN n
                LIMIT 1
            """, entity_id=entity_id)

            entity = entity_result.single()

            if not entity:
                # Create entity if not found
                session.run("""
                    CREATE (n:{entity_type} {{
                        name: $entity_id,
                        display_name: $entity_name,
                        created_at: datetime()
                    }})
                    RETURN n
                """.format(entity_type=entity_type),
                entity_id=entity_id,
                entity_name=entity_name
            )

            # Create episode with timestamp (evidence_date)
            episode_id = f"{entity_id}_{episode_type}_{int(datetime.now(timezone.utc).timestamp())}"
            episode_query = """
                MATCH (e {name: $entity_id})
                CREATE (ep:Episode {
                    episode_id: $episode_id,
                    episode_type: $episode_type,
                    timestamp: datetime($timestamp),
                    discovery_date: datetime($discovery_date),
                    description: $description,
                    source: $source,
                    url: $url,
                    confidence_score: $confidence,
                    metadata: $metadata,
                    created_at: datetime()
                })
                CREATE (e)-[:HAS_EPISODE]->(ep)
                RETURN ep
            """

            session.run(episode_query, {
                'entity_id': entity_id,
                'episode_id': episode_id,
                'episode_type': episode_type,
                'timestamp': episode_timestamp,
                'discovery_date': discovery_date,
                'description': description,
                'source': source,
                'url': url,
                'confidence': confidence,
                'metadata': {
                    **metadata,
                    'has_evidence_date': evidence_date is not None
                }
            })

            logger.info(f"✅ Created discovery episode: {episode_type} for {entity_name} (FalkorDB)")

            return {
                'episode_id': episode_id,
                'entity_id': entity_id,
                'timestamp': episode_timestamp,
                'discovery_date': discovery_date,
                'status': 'created'
            }

    async def get_entity_timeline(
        self,
        entity_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get temporal history of an entity

        Args:
            entity_id: Entity identifier (name or neo4j_id)
            limit: Maximum number of events to return

        Returns:
            List of temporal events
        """
        if self.use_supabase and self.supabase_client:
            # Query temporal_episodes for the entity
            response = self.supabase_client.table('temporal_episodes') \
                .select('*') \
                .or_(f'entity_id.eq.{entity_id},entity_name.ilike.%{entity_id}%') \
                .order('timestamp', desc=True) \
                .limit(limit) \
                .execute()

            events = []
            for episode in response.data:
                events.append({
                    'timestamp': episode.get('timestamp'),
                    'event_type': episode.get('episode_type'),
                    'description': episode.get('description'),
                    'source': episode.get('source'),
                    'metadata': episode.get('metadata', {})
                })

            return events

        if not self.driver:
            logger.warning("⚠️ No temporal backend available - returning empty timeline")
            return []

        with self.driver.session(database=self.graph_name) as session:
            # Query episodes for the entity
            result = session.run("""
                MATCH (e {name: $entity_id})-[:HAS_EPISODE]->(ep:Episode)
                RETURN ap
                ORDER BY ap.timestamp DESC
                LIMIT $limit
            """, entity_id=entity_id, limit=limit)

            events = []
            for record in result:
                episode = record['ap']
                events.append({
                    'timestamp': episode.get('timestamp'),
                    'event_type': episode.get('episode_type'),
                    'description': episode.get('description'),
                    'source': episode.get('source'),
                    'metadata': episode.get('metadata', {})
                })

        return events

    async def analyze_temporal_fit(
        self,
        entity_id: str,
        rfp_id: str,
        rfp_category: Optional[str] = None,
        rfp_value: Optional[float] = None,
        time_horizon: int = 90
    ) -> Dict[str, Any]:
        """
        Analyze fit score based on temporal patterns

        Args:
            entity_id: Entity to analyze
            rfp_id: RFP identifier
            rfp_category: Category of the RFP
            rfp_value: Estimated value of the RFP
            time_horizon: Days to look back for pattern analysis

        Returns:
            Fit analysis with scores and recommendations
        """
        if self.use_supabase and self.supabase_client:
            # Check cache first
            cache_response = self.supabase_client.table('temporal_fit_cache') \
                .select('*') \
                .filter('entity_id', 'eq', entity_id) \
                .filter('rfp_id', 'eq', rfp_id) \
                .execute()

            if cache_response.data:
                cached = cache_response.data[0]
                try:
                    cached_at = datetime.fromisoformat(cached.get('updated_at', '').replace('Z', '+00:00'))
                    if datetime.now(timezone.utc) - cached_at.replace(tzinfo=timezone.utc) < timedelta(hours=24):
                        logger.info(f"✅ Using cached fit analysis for {entity_id}")
                        return {
                            'entity_id': entity_id,
                            'rfp_id': rfp_id,
                            'fit_score': float(cached.get('fit_score', 0.5)),
                            'confidence': float(cached.get('confidence', 0.5)),
                            'trend_analysis': cached.get('trend_data', {}),
                            'key_factors': cached.get('key_factors', []),
                            'recommendations': cached.get('recommendations', []),
                            'analyzed_at': cached.get('updated_at'),
                            'cached': True
                        }
                except:
                    pass  # Cache check failed, continue with analysis

            # Get recent RFP episodes for the entity
            time_threshold = datetime.now(timezone.utc) - timedelta(days=time_horizon)
            response = self.supabase_client.table('temporal_episodes') \
                .select('*') \
                .filter('entity_id', 'eq', entity_id.lower().replace(' ', '-')) \
                .filter('timestamp', 'gt', time_threshold.isoformat()) \
                .filter('episode_type', 'eq', 'RFP_DETECTED') \
                .execute()

            episodes = response.data
            rfp_count = len(episodes)

            # Calculate fit score based on patterns
            base_score = 0.5

            # Boost for recent RFP activity
            if rfp_count > 0:
                base_score += min(0.2, rfp_count * 0.05)

            # Category matching (if provided)
            category_boost = 0
            if rfp_category:
                for episode in episodes:
                    ep_category = episode.get('category')
                    if ep_category == rfp_category:
                        category_boost += 0.1
                base_score += min(0.3, category_boost)

            # Confidence based on data quality
            confidence = 0.7 if rfp_count >= 3 else 0.5

            # Generate key factors
            key_factors = []
            if rfp_count > 0:
                key_factors.append({
                    'factor': 'recent_rfp_activity',
                    'value': rfp_count,
                    'impact': 'positive' if rfp_count >= 2 else 'neutral'
                })
            if category_boost > 0:
                key_factors.append({
                    'factor': 'category_match',
                    'value': category_boost,
                    'impact': 'positive'
                })

            # Generate recommendations
            recommendations = []
            if rfp_count == 0:
                recommendations.append("No prior RFP history - consider outreach strategy")
            elif rfp_count >= 3:
                recommendations.append("Strong RFP engagement history - high priority target")
            if category_boost > 0.2:
                recommendations.append(f"Previous success in {rfp_category} category")

            result = {
                'entity_id': entity_id,
                'rfp_id': rfp_id,
                'fit_score': min(1.0, base_score),
                'confidence': confidence,
                'trend_analysis': {
                    'rfp_count_last_90_days': rfp_count,
                    'time_horizon_days': time_horizon,
                    'trend': 'increasing' if rfp_count >= 2 else 'stable'
                },
                'key_factors': key_factors,
                'recommendations': recommendations,
                'analyzed_at': datetime.now(timezone.utc).isoformat(),
                'cached': False
            }

            # Cache the result
            try:
                self.supabase_client.table('temporal_fit_cache').insert({
                    'entity_id': entity_id,
                    'rfp_id': rfp_id,
                    'rfp_category': rfp_category,
                    'fit_score': result['fit_score'],
                    'confidence': result['confidence'],
                    'trend_data': result['trend_analysis'],
                    'key_factors': result['key_factors'],
                    'recommendations': result['recommendations'],
                    'time_horizon_days': time_horizon
                }).execute()
            except:
                pass  # Cache insert failed, but result is still valid

            return result

        if not self.driver:
            logger.warning("⚠️ No temporal backend available - returning neutral fit analysis")
            return {
                'entity_id': entity_id,
                'rfp_id': rfp_id,
                'fit_score': 0.5,
                'confidence': 0.0,
                'trend_analysis': {
                    'rfp_count_last_90_days': 0,
                    'time_horizon_days': time_horizon,
                    'trend': 'unknown'
                },
                'key_factors': [],
                'recommendations': ['Temporal backend unavailable; run with Supabase or FalkorDB for fit analysis.'],
                'analyzed_at': datetime.now(timezone.utc).isoformat(),
                'cached': False
            }

        # Fallback to FalkorDB
        with self.driver.session(database=self.graph_name) as session:
            # Get recent RFP episodes for the entity
            result = session.run(f"""
                MATCH (e {{name: $entity_id}})-[:HAS_EPISODE]->(ap:Episode)
                WHERE ap.timestamp > datetime() - duration('P{{time_horizon}}D')
                    AND ap.episode_type = 'RFP_DETECTED'
                RETURN ap
                ORDER BY ap.timestamp DESC
            """, entity_id=entity_id, time_horizon=time_horizon)

            episodes = list(result)

            # Calculate fit score based on patterns
            rfp_count = len(episodes)

            # Base score calculation
            base_score = 0.5

            # Boost for recent RFP activity
            if rfp_count > 0:
                base_score += min(0.2, rfp_count * 0.05)

            # Category matching (if provided)
            category_boost = 0
            if rfp_category:
                for episode in episodes:
                    ep_category = episode['ap'].get('category')
                    if ep_category == rfp_category:
                        category_boost += 0.1
                base_score += min(0.3, category_boost)

            # Confidence based on data quality
            confidence = 0.7 if rfp_count >= 3 else 0.5

            # Generate key factors
            key_factors = []
            if rfp_count > 0:
                key_factors.append({
                    'factor': 'recent_rfp_activity',
                    'value': rfp_count,
                    'impact': 'positive' if rfp_count >= 2 else 'neutral'
                })
            if category_boost > 0:
                key_factors.append({
                    'factor': 'category_match',
                    'value': category_boost,
                    'impact': 'positive'
                })

            # Generate recommendations
            recommendations = []
            if rfp_count == 0:
                recommendations.append("No prior RFP history - consider outreach strategy")
            elif rfp_count >= 3:
                recommendations.append("Strong RFP engagement history - high priority target")
            if category_boost > 0.2:
                recommendations.append(f"Previous success in {rfp_category} category")

            return {
                'entity_id': entity_id,
                'rfp_id': rfp_id,
                'fit_score': min(1.0, base_score),
                'confidence': confidence,
                'trend_analysis': {
                    'rfp_count_last_90_days': rfp_count,
                    'time_horizon_days': time_horizon,
                    'trend': 'increasing' if rfp_count >= 2 else 'stable'
                },
                'key_factors': key_factors,
                'recommendations': recommendations,
                'analyzed_at': datetime.now(timezone.utc).isoformat()
            }

    async def find_similar_entities(
        self,
        entity_id: str,
        entity_type: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Find entities with similar temporal patterns

        Args:
            entity_id: Entity identifier
            entity_type: Optional filter by entity type
            limit: Maximum number of similar entities to return

        Returns:
            List of similar entities with similarity scores
        """
        if self.use_supabase and self.supabase_client:
            # Get the target entity's episode types
            target_response = self.supabase_client.table('temporal_episodes') \
                .select('episode_type') \
                .eq('entity_id', entity_id.lower().replace(' ', '-')) \
                .execute()

            target_types = set()
            for row in target_response.data:
                target_types.add(row.get('episode_type'))

            # Find entities with overlapping episode types
            if not target_types:
                return []

            # Build query for entities with similar patterns
            query = self.supabase_client.table('temporal_episodes') \
                .select('entity_id, entity_name, entity_type, episode_type') \
                .in_('episode_type', list(target_types)) \
                .neq('entity_id', entity_id.lower().replace(' ', '-')) \
                .execute()

            # Count similarity by episode type overlap
            entity_scores = {}
            for row in query.data:
                eid = row.get('entity_id')
                if eid not in entity_scores:
                    entity_scores[eid] = {
                        'entity_id': eid,
                        'entity_name': row.get('entity_name', eid),
                        'entity_type': row.get('entity_type'),
                        'overlap_count': 0,
                        'episode_types': set()
                    }
                entity_scores[eid]['episode_types'].add(row.get('episode_type'))
                entity_scores[eid]['overlap_count'] += 1

            # Calculate similarity score
            results = []
            for eid, data in entity_scores.items():
                similarity = len(data['overlap_count']) / max(len(target_types), 1)
                results.append({
                    'entity_id': data['entity_id'],
                    'name': data['entity_name'],
                    'type': data['entity_type'],
                    'similarity_score': similarity,
                    'shared_patterns': list(data['episode_types'])
                })

            # Sort by similarity and return top results
            results.sort(key=lambda x: x['similarity_score'], reverse=True)
            return results[:limit]

        # Fallback to FalkorDB
        if not self.driver:
            return []

        with self.driver.session(database=self.graph_name) as session:
            # Get target entity's episode types
            target_result = session.run("""
                MATCH (e {name: $entity_id})-[:HAS_EPISODE]->(ap:Episode)
                RETURN DISTINCT ap.episode_type as episode_type
            """, entity_id=entity_id)

            target_types = set(record['episode_type'] for record in target_result)

            if not target_types:
                return []

            # Find entities with similar patterns
            type_list = list(target_types)
            cypher = f"""
                MATCH (e)-[:HAS_EPISODE]->(ap:Episode)
                WHERE ap.episode_type IN {type_list}
                AND e.name <> $entity_id
                RETURN e.name as entity_name, e.type as entity_type,
                       count(ap) as overlap_count,
                       collect(DISTINCT ap.episode_type) as episode_types
                ORDER BY overlap_count DESC
                LIMIT $limit
            """

            result = session.run(cypher, entity_id=entity_id, limit=limit)

            similar_entities = []
            for record in result:
                overlap_count = record['overlap_count']
                shared_types = record['episode_types']
                similarity = overlap_count / len(target_types)

                similar_entities.append({
                    'entity_id': record['entity_name'].lower().replace(' ', '-'),
                    'name': record['entity_name'],
                    'type': record.get('entity_type', 'Entity'),
                    'similarity_score': similarity,
                    'shared_patterns': shared_types
                })

            return similar_entities

    async def get_temporal_patterns(
        self,
        entity_type: Optional[str] = None,
        time_horizon: int = 365
    ) -> Dict[str, Any]:
        """
        Get aggregate temporal patterns across entities

        Args:
            entity_type: Filter by entity type
            time_horizon: Days to look back

        Returns:
            Aggregate patterns and statistics
        """
        if self.use_supabase and self.supabase_client:
            # Get episode counts by type
            time_threshold = datetime.now(timezone.utc) - timedelta(days=time_horizon)

            type_response = self.supabase_client.table('temporal_episodes') \
                .select('episode_type') \
                .filter('timestamp', 'gt', time_threshold.isoformat()) \
                .execute()

            episode_counts = {}
            for row in type_response.data:
                et = row.get('episode_type')
                episode_counts[et] = episode_counts.get(et, 0) + 1

            # Get most active entities
            entity_response = self.supabase_client.table('temporal_episodes') \
                .select('entity_name') \
                .filter('timestamp', 'gt', time_threshold.isoformat()) \
                .execute()

            entity_counts = {}
            for row in entity_response.data:
                en = row.get('entity_name')
                entity_counts[en] = entity_counts.get(en, 0) + 1

            top_entities = [
                {'name': name, 'count': count}
                for name, count in sorted(entity_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            ]

            return {
                'time_horizon_days': time_horizon,
                'episode_types': episode_counts,
                'top_entities': top_entities,
                'total_episodes': sum(episode_counts.values())
            }

        if not self.driver:
            logger.warning("⚠️ No temporal backend available - returning empty temporal patterns")
            return {
                'time_horizon_days': time_horizon,
                'episode_types': {},
                'top_entities': [],
                'total_episodes': 0,
            }

        # Fallback to FalkorDB
        with self.driver.session(database=self.graph_name) as session:
            # Get episode counts by type
            type_result = session.run(f"""
                MATCH (e)-[:HAS_EPISODE]->(ap:Episode)
                WHERE ap.timestamp > datetime() - duration('P{{time_horizon}}D')
                RETURN ap.episode_type as episode_type, count(ap) as count
                ORDER BY count DESC
            """)

            episode_types = {record['episode_type']: record['count'] for record in type_result}

            # Get most active entities
            entity_result = session.run(f"""
                MATCH (e)-[:HAS_EPISODE]->(ap:Episode)
                WHERE ap.timestamp > datetime() - duration('P{{time_horizon}}D')
                RETURN e.name as entity_name, count(ap) as episode_count
                ORDER BY episode_count DESC
                LIMIT 10
            """)

            top_entities = [
                {'name': record['entity_name'], 'count': record['episode_count']}
                for record in entity_result
            ]

        return {
            'time_horizon_days': time_horizon,
            'episode_types': episode_types,
            'top_entities': top_entities,
            'total_episodes': sum(episode_types.values())
        }

    # =============================================================================
    # Phase 1: New Graphiti Query Methods
    # =============================================================================

    async def query_episodes(
        self,
        entities: list[str],
        from_time: str,
        to_time: str,
        episode_types: list[str] = None,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Query episodes within time bounds using Graphiti's retrieve_episodes()

        Uses Graphiti's bi-temporal query capabilities to fetch episodes
        that were valid within the specified time window.

        Args:
            entities: List of entity names to query
            from_time: ISO timestamp start of time window
            to_time: ISO timestamp end of time window
            episode_types: Optional filter by episode types
            limit: Maximum number of episodes to return

        Returns:
            Episodes with entities, relationships, and temporal metadata
        """
        if not self.initialized:
            await self.initialize()

        logger.info(f"Querying episodes for {entities} from {from_time} to {to_time}")

        # Try Graphiti first if available
        if GRAPHITI_AVAILABLE and self.graphiti_client:
            try:
                from datetime import datetime

                # Parse time bounds
                from_dt = datetime.fromisoformat(from_time.replace('Z', '+00:00'))
                to_dt = datetime.fromisoformat(to_time.replace('Z', '+00:00'))

                # Use Graphiti's search with temporal filters
                from graphiti_core import SearchFilters

                filters = SearchFilters(
                    entity_labels=entities,
                    valid_after=from_dt,
                    valid_before=to_dt
                )

                # Search for episodes
                results = await self.graphiti_client.search(
                    query=f"Episodes for {', '.join(entities)}",
                    search_filter=filters
                )

                episodes = []
                for episode in results[:limit]:
                    episodes.append({
                        'episode_id': str(episode.uuid) if hasattr(episode, 'uuid') else None,
                        'content': episode.content if hasattr(episode, 'content') else str(episode),
                        'entities': entities,
                        'created_at': episode.created_at.isoformat() if hasattr(episode, 'created_at') else None,
                        'valid_at': episode.valid_at.isoformat() if hasattr(episode, 'valid_at') else None,
                    })

                return {
                    'episodes': episodes,
                    'count': len(episodes),
                    'time_bounds': {'from': from_time, 'to': to_time},
                    'source': 'graphiti'
                }

            except Exception as e:
                logger.warning(f"Graphiti query failed, falling back: {e}")

        # Fallback to Supabase
        if self.supabase:
            try:
                query = self.supabase.table('episodes').select('*')

                # Apply time filters
                query = query.gte('timestamp', from_time).lte('timestamp', to_time)

                # Apply entity filter
                if entities:
                    query = query.in_('entity_name', entities)

                # Apply episode type filter
                if episode_types:
                    query = query.in_('episode_type', episode_types)

                query = query.limit(limit)
                response = query.execute()

                return {
                    'episodes': response.data,
                    'count': len(response.data),
                    'time_bounds': {'from': from_time, 'to': to_time},
                    'source': 'supabase'
                }

            except Exception as e:
                logger.error(f"Supabase query failed: {e}")

        # Fallback to FalkorDB
        if not self.driver:
            raise RuntimeError("Service not initialized - no database connection")

        with self.driver.session(database=self.graph_name) as session:
            # Build Cypher query
            entity_filter = ""
            if entities:
                entity_list = "', '".join(entities)
                entity_filter = f"AND e.name IN ['{entity_list}']"

            type_filter = ""
            if episode_types:
                type_list = "', '".join(episode_types)
                type_filter = f"AND ap.episode_type IN ['{type_list}']"

            from_dt = datetime.fromisoformat(from_time.replace('Z', '+00:00'))
            to_dt = datetime.fromisoformat(to_time.replace('Z', '+00:00'))

            cypher = f"""
                MATCH (e)-[:HAS_EPISODE]->(ap:Episode)
                WHERE ap.timestamp >= datetime('{from_dt.isoformat()}')
                AND ap.timestamp <= datetime('{to_dt.isoformat()}')
                {entity_filter}
                {type_filter}
                RETURN e.name as entity_name, ap
                ORDER BY ap.timestamp DESC
                LIMIT {limit}
            """

            result = session.run(cypher)

            episodes = []
            for record in result:
                episode_node = record['ap']
                episodes.append({
                    'entity_name': record['entity_name'],
                    'episode_type': episode_node.get('episode_type'),
                    'timestamp': episode_node.get('timestamp').isoformat() if episode_node.get('timestamp') else None,
                    'content': episode_node.get('content'),
                    'metadata': episode_node.get('metadata', {})
                })

        return {
            'episodes': episodes,
            'count': len(episodes),
            'time_bounds': {'from': from_time, 'to': to_time},
            'source': 'falkordb'
        }

    # =============================================================================
    # Semantic + Temporal Episode Clustering
    # =============================================================================

    CLUSTER_WINDOW_DAYS = 45
    SEMANTIC_SIMILARITY_THRESHOLD = 0.78

    async def find_or_create_episode(
        self,
        entity_id: str,
        entity_name: str,
        episode_type: str,
        description: str,
        signal_date: str,
        signal_confidence: float,
        source: str = "discovery",
        url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Find or create an episode using semantic + temporal clustering.

        Compresses signals into episodes using THREE conditions:
        1. Time window: abs(date_diff) < 45 days
        2. Semantic similarity: embedding_similarity > 0.78
        3. Category match: same episode_type

        Otherwise: Create new episode

        Args:
            entity_id: Entity identifier
            entity_name: Human-readable entity name
            episode_type: Type of episode (RFP_DETECTED, CRM_ANALYTICS, etc.)
            description: Description of the signal/episode
            signal_date: ISO timestamp of when the signal occurred
            signal_confidence: Confidence score (0-1)
            source: Source of the signal
            url: Source URL
            metadata: Additional metadata

        Returns:
            Dict with episode_id, created (bool), and merged (bool) flags
        """
        if not self.initialized:
            await self.initialize()

        signal_dt = datetime.fromisoformat(signal_date.replace('Z', '+00:00'))
        window_start = signal_dt - timedelta(days=self.CLUSTER_WINDOW_DAYS)
        window_end = signal_dt + timedelta(days=self.CLUSTER_WINDOW_DAYS)

        logger.debug(f"Looking for episodes within {self.CLUSTER_WINDOW_DAYS} days of {signal_date[:10]}")

        # Query existing episodes within time window and same type
        candidates = await self.query_episodes(
            entities=[entity_name],
            episode_types=[episode_type],
            from_time=window_start.isoformat(),
            to_time=window_end.isoformat(),
            limit=20
        )

        # Find matching episode using semantic similarity
        best_match = None
        best_similarity = 0.0

        for candidate in candidates.get('episodes', []):
            candidate_description = candidate.get('description', '')
            candidate_date = candidate.get('timestamp', '')

            # Skip if candidate has no description
            if not candidate_description:
                continue

            # Calculate semantic similarity
            similarity = await self._calculate_semantic_similarity(
                description,
                candidate_description
            )

            if similarity > best_similarity and similarity >= self.SEMANTIC_SIMILARITY_THRESHOLD:
                best_match = candidate
                best_similarity = similarity

        if best_match:
            # Merge into existing episode
            episode_id = best_match.get('episode_id')
            logger.info(f"🔄 Merging signal into existing episode {episode_id} (similarity: {best_similarity:.2f})")

            # Update episode metadata to include this signal
            await self._merge_signal_to_episode(
                episode_id=episode_id,
                signal_date=signal_date,
                signal_confidence=signal_confidence,
                source=source,
                url=url
            )

            return {
                'episode_id': episode_id,
                'created': False,
                'merged': True,
                'similarity': best_similarity
            }

        # No match found - create new episode
        logger.info(f"✨ Creating new episode for {entity_name} (type: {episode_type})")

        result = await self.add_discovery_episode(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type="ORG",
            episode_type=episode_type,
            description=description,
            source=source,
            url=url,
            confidence=signal_confidence,
            evidence_date=signal_date,
            metadata=metadata
        )

        return {
            'episode_id': result.get('episode_id'),
            'created': True,
            'merged': False
        }

    async def _calculate_semantic_similarity(
        self,
        text1: str,
        text2: str
    ) -> float:
        """
        Calculate semantic similarity between two texts using embeddings.

        Uses Claude embeddings to capture meaning, allowing
        "Hiring Head of CRM" to cluster with procurement signals
        but NOT with "stadium sponsorship" even if same day.

        Args:
            text1: First text
            text2: Second text

        Returns:
            Cosine similarity score (0-1)
        """
        try:
            from claude_client import ClaudeClient

            claude = ClaudeClient()

            # Generate embeddings
            embedding1 = await claude.get_embedding(text1)
            embedding2 = await claude.get_embedding(text2)

            if not embedding1 or not embedding2:
                logger.warning("Failed to generate embeddings for similarity calculation")
                return 0.0

            # Calculate cosine similarity
            similarity = self._cosine_similarity(embedding1, embedding2)
            return similarity

        except Exception as e:
            logger.warning(f"Error calculating semantic similarity: {e}")
            return 0.0

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        import math

        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = math.sqrt(sum(a * a for a in vec1))
        magnitude2 = math.sqrt(sum(b * b for b in vec2))

        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0

        return dot_product / (magnitude1 * magnitude2)

    async def _merge_signal_to_episode(
        self,
        episode_id: str,
        signal_date: str,
        signal_confidence: float,
        source: str,
        url: Optional[str] = None
    ) -> bool:
        """
        Merge a new signal into an existing episode.

        Updates the episode's metadata to include the new signal
        and potentially updates confidence score.

        Args:
            episode_id: Episode identifier
            signal_date: Date of the signal
            signal_confidence: Confidence score
            source: Source of signal
            url: Source URL

        Returns:
            True if merge successful
        """
        if not self.driver:
            return False

        try:
            with self.driver.session() as session:
                # Add signal to episode's signal list in metadata
                result = session.run("""
                    MATCH (ep:Episode {episode_id: $episode_id})
                    RETURN ep
                """, episode_id=episode_id)

                episode = result.single()

                if not episode:
                    logger.warning(f"Episode {episode_id} not found for merging")
                    return False

                episode_node = episode.get('ep')
                metadata = episode_node.get('metadata', {})
                signals = metadata.get('signals', [])

                # Add new signal
                signals.append({
                    'date': signal_date,
                    'confidence': signal_confidence,
                    'source': source,
                    'url': url
                })

                # Update metadata
                metadata['signals'] = signals
                metadata['signal_count'] = len(signals)
                metadata['last_updated'] = datetime.now(timezone.utc).isoformat()

                # Update episode
                session.run("""
                    MATCH (ep:Episode {episode_id: $episode_id})
                    SET ep.metadata = $metadata
                    RETURN ep
                """, episode_id=episode_id, metadata=metadata)

                logger.debug(f"Merged signal into episode {episode_id}")
                return True

        except Exception as e:
            logger.warning(f"Error merging signal to episode: {e}")
            return False

    async def get_entity_state_at_time(
        self,
        entity_id: str,
        at_time: str
    ) -> Dict[str, Any]:
        """
        Resolve entity state at specific timestamp

        Collapses all active episodes at the given time into a state snapshot.
        Uses Graphiti's valid_at/valid_before bi-temporal model.

        Args:
            entity_id: Entity identifier (name or neo4j_id)
            at_time: ISO timestamp to resolve state at

        Returns:
            Entity state including relationships, affiliations, and properties
        """
        if not self.initialized:
            await self.initialize()

        logger.info(f"Getting state for {entity_id} at {at_time}")

        # Parse time
        at_dt = datetime.fromisoformat(at_time.replace('Z', '+00:00'))

        # Try Graphiti first
        if GRAPHITI_AVAILABLE and self.graphiti_client:
            try:
                from graphiti_core import SearchFilters

                # Get all episodes valid at this time
                filters = SearchFilters(
                    entity_labels=[entity_id],
                    valid_after=at_dt,
                    valid_before=at_dt
                )

                results = await self.graphiti_client.search(
                    query=f"State of {entity_id}",
                    search_filter=filters
                )

                # Aggregate state from episodes
                state = {
                    'entity_id': entity_id,
                    'at_time': at_time,
                    'episodes': [],
                    'relationships': [],
                    'properties': {},
                    'source': 'graphiti'
                }

                for episode in results:
                    state['episodes'].append({
                        'content': episode.content if hasattr(episode, 'content') else str(episode),
                        'valid_at': episode.valid_at.isoformat() if hasattr(episode, 'valid_at') else None,
                    })

                return state

            except Exception as e:
                logger.warning(f"Graphiti state query failed, falling back: {e}")

        # Fallback to Supabase
        if self.supabase:
            try:
                # Get entity
                entity_result = self.supabase.table('entities').select('*').eq('name', entity_id).execute()

                if not entity_result.data:
                    return {'error': f'Entity {entity_id} not found', 'source': 'supabase'}

                entity = entity_result.data[0]

                # Get active relationships at time
                rels_result = self.supabase.table('relationships').select('*').eq('source_entity', entity_id).execute()

                # Get episodes at time
                eps_result = self.supabase.table('episodes').select('*').eq('entity_name', entity_id).lte('timestamp', at_time).execute()

                return {
                    'entity_id': entity_id,
                    'at_time': at_time,
                    'entity': entity,
                    'relationships': rels_result.data,
                    'episodes': eps_result.data,
                    'source': 'supabase'
                }

            except Exception as e:
                logger.error(f"Supabase state query failed: {e}")

        # Fallback to FalkorDB
        if not self.driver:
            raise RuntimeError("Service not initialized - no database connection")

        with self.driver.session(database=self.graph_name) as session:
            # Get entity and state at time
            cypher = f"""
                MATCH (e {{name: '{entity_id}'}})
                OPTIONAL MATCH (e)-[r]->(other)
                WHERE r.valid_from <= datetime('{at_dt.isoformat()}')
                AND (r.valid_until IS NULL OR r.valid_until >= datetime('{at_dt.isoformat()}'))
                RETURN e, r, other
            """

            result = session.run(cypher)

            relationships = []
            entity_data = None

            for record in result:
                if not entity_data and record['e']:
                    node = record['e']
                    entity_data = {
                        'name': node.get('name'),
                        'type': node.get('type'),
                        'properties': dict(node)
                    }

                if record['r']:
                    rel = record['r']
                    relationships.append({
                        'type': rel.type,
                        'target': record['other'].get('name') if record['other'] else None,
                        'valid_from': rel.get('valid_from').isoformat() if rel.get('valid_from') else None,
                        'valid_until': rel.get('valid_until').isoformat() if rel.get('valid_until') else None,
                    })

        return {
            'entity_id': entity_id,
            'at_time': at_time,
            'entity': entity_data,
            'relationships': relationships,
            'source': 'falkordb'
        }

    async def compute_entity_diff(
        self,
        entity_id: str,
        from_time: str,
        to_time: str
    ) -> Dict[str, Any]:
        """
        Detect structural changes between time periods

        Compares entity state at two points in time to identify:
        - New relationships formed
        - Old relationships ended
        - Property changes
        - Confidence deltas

        Args:
            entity_id: Entity identifier
            from_time: Start time ISO timestamp
            to_time: End time ISO timestamp

        Returns:
            Change summary with before/after comparison
        """
        if not self.initialized:
            await self.initialize()

        logger.info(f"Computing diff for {entity_id} from {from_time} to {to_time}")

        # Get state at both times
        state_before = await self.get_entity_state_at_time(entity_id, from_time)
        state_after = await self.get_entity_state_at_time(entity_id, to_time)

        # Handle errors
        if 'error' in state_before or 'error' in state_after:
            return {
                'error': 'Failed to get entity states for comparison',
                'state_before': state_before,
                'state_after': state_after
            }

        # Extract relationships
        rels_before = {r['target']: r for r in state_before.get('relationships', [])}
        rels_after = {r['target']: r for r in state_after.get('relationships', [])}

        # Find new relationships
        new_relationships = [
            {'target': target, 'rel': rel}
            for target, rel in rels_after.items()
            if target not in rels_before
        ]

        # Find ended relationships
        ended_relationships = [
            {'target': target, 'rel': rel}
            for target, rel in rels_before.items()
            if target not in rels_after
        ]

        # Find changed relationships
        changed_relationships = []
        for target in rels_before:
            if target in rels_after:
                rel_before = rels_before[target]
                rel_after = rels_after[target]
                if rel_before != rel_after:
                    changed_relationships.append({
                        'target': target,
                        'before': rel_before,
                        'after': rel_after
                    })

        # Compare properties
        entity_before = state_before.get('entity', {})
        entity_after = state_after.get('entity', {})

        property_changes = []
        for key in set(list(entity_before.get('properties', {}).keys()) + list(entity_after.get('properties', {}).keys())):
            val_before = entity_before.get('properties', {}).get(key)
            val_after = entity_after.get('properties', {}).get(key)
            if val_before != val_after:
                property_changes.append({
                    'property': key,
                    'before': val_before,
                    'after': val_after
                })

        # Compare episodes
        eps_before = state_before.get('episodes', [])
        eps_after = state_after.get('episodes', [])

        new_episodes = len(eps_after) - len(eps_before)

        return {
            'entity_id': entity_id,
            'time_range': {'from': from_time, 'to': to_time},
            'changes': {
                'new_relationships': new_relationships,
                'ended_relationships': ended_relationships,
                'changed_relationships': changed_relationships,
                'property_changes': property_changes,
                'new_episodes': new_episodes
            },
            'summary': {
                'total_changes': len(new_relationships) + len(ended_relationships) + len(changed_relationships) + len(property_changes),
                'relationships_added': len(new_relationships),
                'relationships_removed': len(ended_relationships),
                'relationships_changed': len(changed_relationships),
                'properties_changed': len(property_changes)
            }
        }

    # =============================================================================
    # Phase 1: Entity/Signal/Evidence Methods (New Graph Intelligence Schema)
    # =============================================================================

    async def upsert_entity(self, entity: 'Entity') -> Dict[str, Any]:
        """
        Create or update an Entity in the graph

        Args:
            entity: Entity object from schemas.py

        Returns:
            Created/updated entity data
        """
        from backend.schemas import Entity

        if not self.driver and not self.use_supabase:
            raise RuntimeError("Service not initialized - no database connection")

        # Prefer Supabase for entity storage
        if self.use_supabase and self.supabase_client:
            entity_data = {
                'id': entity.id,
                'type': entity.type.value,
                'name': entity.name,
                'metadata': entity.metadata,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }

            # Use upsert to handle duplicates
            result = self.supabase_client.table('entities').upsert(entity_data).execute()

            logger.info(f"✅ Upserted entity: {entity.id} (Supabase)")
            return {'entity_id': entity.id, 'source': 'supabase', 'status': 'upserted'}

        # Fallback to FalkorDB
        if not self.driver:
            raise RuntimeError("Service not initialized - no database connection")

        with self.driver.session(database=self.graph_name) as session:
            # Create or merge entity node
            cypher = """
                MERGE (e:Entity {id: $entity_id})
                SET e.type = $entity_type,
                    e.name = $name,
                    e.metadata = $metadata,
                    e.updated_at = datetime()
                RETURN e
            """

            session.run(cypher, {
                'entity_id': entity.id,
                'entity_type': entity.type.value,
                'name': entity.name,
                'metadata': entity.metadata
            })

            logger.info(f"✅ Upserted entity: {entity.id} (FalkorDB)")
            return {'entity_id': entity.id, 'source': 'falkordb', 'status': 'upserted'}

    async def get_entity(self, entity_id: str) -> Dict[str, Any]:
        """
        Get complete entity data with relationships

        Args:
            entity_id: Entity identifier

        Returns:
            Entity data with relationships
        """
        if not self.driver and not self.use_supabase:
            raise RuntimeError("Service not initialized - no database connection")

        # Prefer Supabase
        if self.use_supabase and self.supabase_client:
            result = self.supabase_client.table('entities').select('*').eq('id', entity_id).execute()

            if not result.data:
                return {'error': f'Entity {entity_id} not found', 'source': 'supabase'}

            entity = result.data[0]

            # Get relationships
            rels_result = self.supabase_client.table('relationships').select('*').or_(f'from_entity.eq.{entity_id},to_entity.eq.{entity_id}').execute()

            return {
                'entity': entity,
                'relationships': rels_result.data,
                'source': 'supabase'
            }

        # Fallback to FalkorDB
        if not self.driver:
            raise RuntimeError("Service not initialized - no database connection")

        with self.driver.session(database=self.graph_name) as session:
            # Get entity
            entity_result = session.run("""
                MATCH (e:Entity {id: $entity_id})
                RETURN e
            """, entity_id=entity_id)

            entity_record = entity_result.single()

            if not entity_record:
                return {'error': f'Entity {entity_id} not found', 'source': 'falkordb'}

            entity_node = entity_record['e']

            # Get relationships
            rel_result = session.run("""
                MATCH (e:Entity {id: $entity_id})-[r]-(other:Entity)
                RETURN r, other
            """, entity_id=entity_id)

            relationships = []
            for record in rel_result:
                rel = record['r']
                other = record['other']
                relationships.append({
                    'type': rel.type,
                    'from_entity': entity_id,
                    'to_entity': other.get('id') if other else None,
                    'confidence': rel.get('confidence'),
                    'valid_from': rel.get('valid_from').isoformat() if rel.get('valid_from') else None,
                    'valid_until': rel.get('valid_until').isoformat() if rel.get('valid_until') else None
                })

            return {
                'entity': dict(entity_node),
                'relationships': relationships,
                'source': 'falkordb'
            }

    async def upsert_signal(self, signal: 'Signal') -> Dict[str, Any]:
        """
        Create or update a Signal (requires Ralph Loop validation)

        Args:
            signal: Signal object from schemas.py

        Returns:
            Created/updated signal data
        """
        if not self.driver and not self.use_supabase:
            raise RuntimeError("Service not initialized - no database connection")

        # Prefer Supabase
        if self.use_supabase and self.supabase_client:
            signal_data = {
                'id': signal.id,
                'type': signal.type.value,
                'subtype': signal.subtype.value if signal.subtype else None,
                'confidence': signal.confidence,
                'first_seen': signal.first_seen.isoformat(),
                'entity_id': signal.entity_id,
                'metadata': signal.metadata,
                'validated': signal.validated,
                'validation_pass': signal.validation_pass
            }

            result = self.supabase_client.table('signals').upsert(signal_data).execute()

            logger.info(f"✅ Upserted signal: {signal.id} (Supabase)")
            return {'signal_id': signal.id, 'source': 'supabase', 'status': 'upserted'}

        # Fallback to FalkorDB
        if not self.driver:
            raise RuntimeError("Service not initialized - no database connection")

        with self.driver.session(database=self.graph_name) as session:
            cypher = """
                MERGE (s:Signal {id: $signal_id})
                SET s.type = $signal_type,
                    s.subtype = $subtype,
                    s.confidence = $confidence,
                    s.first_seen = datetime($first_seen),
                    s.entity_id = $entity_id,
                    s.metadata = $metadata,
                    s.validated = $validated,
                    s.validation_pass = $validation_pass
                RETURN s
            """

            session.run(cypher, {
                'signal_id': signal.id,
                'signal_type': signal.type.value,
                'subtype': signal.subtype.value if signal.subtype else None,
                'confidence': signal.confidence,
                'first_seen': signal.first_seen.isoformat(),
                'entity_id': signal.entity_id,
                'metadata': signal.metadata,
                'validated': signal.validated,
                'validation_pass': signal.validation_pass
            })

            logger.info(f"✅ Upserted signal: {signal.id} (FalkorDB)")
            return {'signal_id': signal.id, 'source': 'falkordb', 'status': 'upserted'}

    async def link_evidence(self, evidence: 'Evidence') -> Dict[str, Any]:
        """
        Link evidence to a signal

        Args:
            evidence: Evidence object from schemas.py

        Returns:
            Created evidence data
        """
        if not self.driver and not self.use_supabase:
            raise RuntimeError("Service not initialized - no database connection")

        # Prefer Supabase
        if self.use_supabase and self.supabase_client:
            evidence_data = {
                'id': evidence.id,
                'source': evidence.source,
                'date': evidence.date.isoformat(),
                'signal_id': evidence.signal_id,
                'url': evidence.url,
                'extracted_text': evidence.extracted_text,
                'metadata': evidence.metadata,
                'credibility_score': evidence.credibility_score
            }

            result = self.supabase_client.table('evidence').insert(evidence_data).execute()

            logger.info(f"✅ Linked evidence: {evidence.id} to signal {evidence.signal_id} (Supabase)")
            return {'evidence_id': evidence.id, 'source': 'supabase', 'status': 'created'}

        # Fallback to FalkorDB
        if not self.driver:
            raise RuntimeError("Service not initialized - no database connection")

        with self.driver.session(database=self.graph_name) as session:
            cypher = """
                MATCH (s:Signal {id: $signal_id})
                CREATE (e:Evidence {
                    id: $evidence_id,
                    source: $source,
                    date: datetime($date),
                    url: $url,
                    extracted_text: $extracted_text,
                    metadata: $metadata,
                    credibility_score: $credibility_score
                })
                CREATE (s)-[:HAS_EVIDENCE]->(e)
                RETURN e
            """

            session.run(cypher, {
                'signal_id': evidence.signal_id,
                'evidence_id': evidence.id,
                'source': evidence.source,
                'date': evidence.date.isoformat(),
                'url': evidence.url,
                'extracted_text': evidence.extracted_text,
                'metadata': evidence.metadata,
                'credibility_score': evidence.credibility_score
            })

            logger.info(f"✅ Linked evidence: {evidence.id} to signal {evidence.signal_id} (FalkorDB)")
            return {'evidence_id': evidence.id, 'source': 'falkordb', 'status': 'created'}

    async def create_relationship(self, relationship: 'Relationship') -> Dict[str, Any]:
        """
        Create a relationship between two entities

        Args:
            relationship: Relationship object from schemas.py

        Returns:
            Created relationship data
        """
        if not self.driver and not self.use_supabase:
            raise RuntimeError("Service not initialized - no database connection")

        # Prefer Supabase
        if self.use_supabase and self.supabase_client:
            rel_data = {
                'id': relationship.id,
                'type': relationship.type.value,
                'from_entity': relationship.from_entity,
                'to_entity': relationship.to_entity,
                'confidence': relationship.confidence,
                'valid_from': relationship.valid_from.isoformat(),
                'valid_until': relationship.valid_until.isoformat() if relationship.valid_until else None,
                'metadata': relationship.metadata
            }

            result = self.supabase_client.table('relationships').insert(rel_data).execute()

            logger.info(f"✅ Created relationship: {relationship.id} (Supabase)")
            return {'relationship_id': relationship.id, 'source': 'supabase', 'status': 'created'}

        # Fallback to FalkorDB
        if not self.driver:
            raise RuntimeError("Service not initialized - no database connection")

        with self.driver.session(database=self.graph_name) as session:
            cypher = f"""
                MATCH (from:Entity {{id: $from_entity}})
                MATCH (to:Entity {{id: $to_entity}})
                CREATE (from)-[r:{relationship.type.value} {{
                    id: $rel_id,
                    confidence: $confidence,
                    valid_from: datetime($valid_from),
                    valid_until: $valid_until,
                    metadata: $metadata
                }}]->(to)
                RETURN r
            """

            session.run(cypher, {
                'from_entity': relationship.from_entity,
                'to_entity': relationship.to_entity,
                'rel_id': relationship.id,
                'confidence': relationship.confidence,
                'valid_from': relationship.valid_from.isoformat(),
                'valid_until': relationship.valid_until.isoformat() if relationship.valid_until else None,
                'metadata': relationship.metadata
            })

            logger.info(f"✅ Created relationship: {relationship.id} (FalkorDB)")
            return {'relationship_id': relationship.id, 'source': 'falkordb', 'status': 'created'}

    async def get_subgraph(self, entity_id: str, depth: int = 2) -> Dict[str, Any]:
        """
        Get entity's neighborhood graph (depth-limited)

        Args:
            entity_id: Entity identifier
            depth: How many hops to traverse (default: 2)

        Returns:
            Subgraph with entities, relationships, and signals
        """
        if not self.driver and not self.use_supabase:
            raise RuntimeError("Service not initialized - no database connection")

        # Prefer Supabase
        if self.use_supabase and self.supabase_client:
            # Get entity
            entity_result = self.supabase_client.table('entities').select('*').eq('id', entity_id).execute()

            if not entity_result.data:
                return {'error': f'Entity {entity_id} not found', 'source': 'supabase'}

            # Get direct relationships (depth 1)
            rels_result = self.supabase_client.table('relationships').select('*').or_(f'from_entity.eq.{entity_id},to_entity.eq.{entity_id}').execute()

            # Get related entity IDs
            related_ids = []
            for rel in rels_result.data:
                if rel['from_entity'] == entity_id:
                    related_ids.append(rel['to_entity'])
                if rel['to_entity'] == entity_id:
                    related_ids.append(rel['from_entity'])

            # Get related entities
            entities_result = self.supabase_client.table('entities').select('*').in_('id', related_ids[:50]).execute() if related_ids else {'data': []}

            # Get signals for all entities
            all_entity_ids = [entity_id] + related_ids
            signals_result = self.supabase_client.table('signals').select('*').in_('entity_id', all_entity_ids[:50]).execute()

            return {
                'center_entity': entity_result.data[0] if entity_result.data else None,
                'entities': entities_result.data,
                'relationships': rels_result.data,
                'signals': signals_result.data,
                'depth': depth,
                'source': 'supabase'
            }

        # Fallback to FalkorDB
        if not self.driver:
            raise RuntimeError("Service not initialized - no database connection")

        with self.driver.session(database=self.graph_name) as session:
            # Variable-length path query for subgraph
            cypher = f"""
                MATCH (center:Entity {{id: $entity_id}})
                OPTIONAL MATCH path = (center)-[r*1..{depth}]-(related:Entity)
                OPTIONAL MATCH (center)-[:HAS_SIGNAL]->(s:Signal)
                RETURN center, collect(DISTINCT related) as entities,
                       collect(DISTINCT r) as relationships,
                       collect(DISTINCT s) as signals
            """

            result = session.run(cypher, entity_id=entity_id)
            record = result.single()

            if not record:
                return {'error': f'Entity {entity_id} not found', 'source': 'falkordb'}

            return {
                'center_entity': dict(record['center']) if record['center'] else None,
                'entities': [dict(e) for e in record.get('entities', [])],
                'relationships': [dict(r) for r in record.get('relationships', [])],
                'signals': [dict(s) for s in record.get('signals', [])],
                'depth': depth,
                'source': 'falkordb'
            }

    async def find_related_signals(
        self,
        entity_id: str,
        signal_type: Optional[str] = None,
        min_confidence: float = 0.7,
        time_horizon_days: int = 365
    ) -> List[Dict[str, Any]]:
        """
        Find signals related to entity with filters

        Args:
            entity_id: Entity identifier
            signal_type: Optional filter by signal type
            min_confidence: Minimum confidence threshold (default: 0.7)
            time_horizon_days: Days to look back (default: 365)

        Returns:
            List of related signals with evidence
        """
        if not self.driver and not self.use_supabase:
            raise RuntimeError("Service not initialized - no database connection")

        time_threshold = datetime.now(timezone.utc) - timedelta(days=time_horizon_days)

        # Prefer Supabase
        if self.use_supabase and self.supabase_client:
            query = self.supabase_client.table('signals') \
                .select('*') \
                .eq('entity_id', entity_id) \
                .gte('first_seen', time_threshold.isoformat()) \
                .gte('confidence', min_confidence) \
                .order('first_seen', desc=True)

            if signal_type:
                query = query.eq('type', signal_type)

            result = query.limit(100).execute()

            return result.data

        # Fallback to FalkorDB
        if not self.driver:
            raise RuntimeError("Service not initialized - no database connection")

        with self.driver.session(database=self.graph_name) as session:
            cypher = """
                MATCH (e:Entity {id: $entity_id})-[:HAS_SIGNAL]->(s:Signal)
                WHERE s.first_seen >= datetime($time_threshold)
                AND s.confidence >= $min_confidence
            """

            params = {
                'entity_id': entity_id,
                'time_threshold': time_threshold.isoformat(),
                'min_confidence': min_confidence
            }

            if signal_type:
                cypher += "\nAND s.type = $signal_type"
                params['signal_type'] = signal_type

            cypher += "\nRETURN s ORDER BY s.first_seen DESC LIMIT 100"

            result = session.run(cypher, params)

            signals = []
            for record in result:
                signal_node = record['s']
                signals.append(dict(signal_node))

            return signals

    # =============================================================================
    # Schema Extension Mechanism (Approval workflow for SignalSubtype)
    # =============================================================================

    async def request_schema_extension(
        self,
        request: 'SchemaExtensionRequest'
    ) -> Dict[str, Any]:
        """
        Request schema extension (requires approval)

        Args:
            request: SchemaExtensionRequest from schemas.py

        Returns:
            Extension request status
        """
        from backend.schemas import SchemaExtensionStatus

        if not self.use_supabase or not self.supabase_client:
            logger.warning("⚠️ Schema extensions require Supabase")
            return {'error': 'Schema extensions require Supabase', 'status': 'failed'}

        # Check if extension already exists
        existing = self.supabase_client.table('pending_extensions') \
            .select('*') \
            .eq('field', request.field) \
            .eq('node', request.node) \
            .execute()

        if existing.data:
            return {
                'message': f'Extension request for {request.field} already exists',
                'existing': existing.data[0],
                'status': 'duplicate'
            }

        # Auto-approve if confidence > 0.9 and matches pattern
        status = SchemaExtensionStatus.PENDING
        if request.confidence > 0.9 and self._validate_extension_pattern(request):
            status = SchemaExtensionStatus.APPROVED
            logger.info(f"✅ Auto-approved schema extension: {request.field}")

        # Store request
        extension_data = {
            'node': request.node,
            'field': request.field,
            'value': request.value,
            'rationale': request.rationale,
            'requested_by': request.requested_by,
            'confidence': request.confidence,
            'status': status.value,
            'created_at': datetime.now(timezone.utc).isoformat()
        }

        result = self.supabase_client.table('pending_extensions').insert(extension_data).execute()

        return {
            'extension_id': result.data[0]['id'] if result.data else None,
            'field': request.field,
            'status': status.value,
            'auto_approved': status == SchemaExtensionStatus.APPROVED,
            'source': 'supabase'
        }

    def _validate_extension_pattern(self, request: 'SchemaExtensionRequest') -> bool:
        """
        Validate extension request matches approved patterns

        Auto-approve if:
        - Node is 'SignalSubtype'
        - Field name is UPPER_SNAKE_CASE
        - Value is descriptive (not empty)
        - Rationale provided (> 20 chars)
        """
        if request.node != 'SignalSubtype':
            return False

        # Check field name pattern (UPPER_SNAKE_CASE)
        if not request.field.replace('_', '').isupper():
            return False

        # Check value is descriptive
        if len(request.value) < 5:
            return False

        # Check rationale is substantive
        if len(request.rationale) < 20:
            return False

        return True

    async def get_pending_extensions(self) -> List[Dict[str, Any]]:
        """Get all pending schema extension requests"""
        if not self.use_supabase or not self.supabase_client:
            return []

        result = self.supabase_client.table('pending_extensions') \
            .select('*') \
            .eq('status', 'PENDING') \
            .order('created_at', desc=True) \
            .execute()

        return result.data

    async def approve_extension(self, extension_id: str, approved_by: str = "admin") -> Dict[str, Any]:
        """
        Approve a pending schema extension

        Args:
            extension_id: Extension request ID
            approved_by: Who is approving this

        Returns:
            Updated extension request
        """
        from backend.schemas import SchemaExtensionStatus

        if not self.use_supabase or not self.supabase_client:
            return {'error': 'Schema extensions require Supabase'}

        result = self.supabase_client.table('pending_extensions') \
            .update({'status': SchemaExtensionStatus.APPROVED.value, 'approved_by': approved_by}) \
            .eq('id', extension_id) \
            .execute()

        if not result.data:
            return {'error': f'Extension {extension_id} not found'}

        logger.info(f"✅ Approved schema extension: {extension_id} by {approved_by}")

        return {
            'extension_id': extension_id,
            'status': SchemaExtensionStatus.APPROVED.value,
            'approved_by': approved_by,
            'source': 'supabase'
        }

    def close(self):
        """Close the database connection"""
        if self.driver:
            self.driver.close()
            logger.info("🔌 GraphitiService connection closed")


# Convenience functions for standalone usage
async def create_rfp_episode(rfp_data: Dict) -> Dict[str, Any]:
    """Convenience function to create an RFP episode"""
    service = GraphitiService()
    try:
        await service.initialize()
        return await service.add_rfp_episode(rfp_data)
    finally:
        service.close()


async def get_timeline(entity_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Convenience function to get entity timeline"""
    service = GraphitiService()
    try:
        await service.initialize()
        return await service.get_entity_timeline(entity_id, limit)
    finally:
        service.close()


if __name__ == "__main__":
    # Test the service
    import asyncio

    async def test():
        service = GraphitiService()
        try:
            initialized = await service.initialize()
            if initialized:
                print("✅ GraphitiService initialized successfully")

                # Test adding an RFP episode
                test_rfp = {
                    'rfp_id': 'test-001',
                    'organization': 'Test Club FC',
                    'entity_type': 'Club',
                    'detected_at': datetime.now(timezone.utc).isoformat(),
                    'description': 'Test RFP for digital transformation',
                    'source': 'test',
                    'category': 'Technology',
                    'confidence_score': 0.9
                }

                result = await service.add_rfp_episode(test_rfp)
                print(f"✅ Created episode: {result}")

                # Test temporal analysis
                analysis = await service.analyze_temporal_fit('Test Club FC', 'test-001')
                print(f"✅ Fit analysis: {analysis}")

        except Exception as e:
            print(f"❌ Test failed: {e}")
        finally:
            service.close()

    asyncio.run(test())
