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
import logging
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
        # Database configuration - prefer Supabase for temporal tracking
        self.supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")
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

        logger.info(f"🔗 Initializing GraphitiService (Supabase: {self.use_supabase})")

    async def initialize(self) -> bool:
        """
        Initialize the service and build indices/constraints

        Returns:
            True if initialization successful
        """
        try:
            # Initialize FalkorDB driver if available
            if GraphDatabase and self.falkordb_uri:
                self.driver = GraphDatabase.driver(
                    self.falkordb_uri,
                    auth=(self.falkordb_user, self.falkordb_password)
                )
                self.driver.verify_connectivity()
                logger.info("✅ FalkorDB connection established")
            elif self.use_supabase:
                logger.info("✅ Using Supabase for temporal tracking")
            else:
                logger.warning("⚠️  No database connection available")

            return True

        except Exception as e:
            logger.error(f"❌ Failed to initialize GraphitiService: {e}")
            # Still return True if Supabase is available
            return self.use_supabase

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
            raise RuntimeError("Service not initialized - no Supabase or FalkorDB connection")

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

        # Use upsert to handle duplicates
        self.supabase_client.table('rfp_tracking').upsert(rfp_tracking_data).execute()

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
            raise RuntimeError("Service not initialized - no Supabase or FalkorDB connection")

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
            raise RuntimeError("Service not initialized - no Supabase or FalkorDB connection")

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
            raise RuntimeError("Service not initialized - no Supabase or FalkorDB connection")

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
