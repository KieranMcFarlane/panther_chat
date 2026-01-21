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
