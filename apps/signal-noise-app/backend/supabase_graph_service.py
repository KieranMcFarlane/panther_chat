#!/usr/bin/env python3
"""
Supabase Graph Service - Graph operations using Supabase PostgreSQL

Uses Supabase's PostgreSQL with graph queries instead of FalkorDB.
This works with your existing Supabase setup and has no network issues.
"""

import os
import sys
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

# Supabase (PostgreSQL) client
try:
    from supabase import create_client
except ImportError:
    print("❌ supabase not installed. Run: pip install supabase")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SupabaseGraphService:
    """
    Graph service using Supabase PostgreSQL
    Provides temporal intelligence without FalkorDB dependency
    """

    def __init__(self):
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError("Supabase credentials not found")

        self.client = create_client(supabase_url, supabase_key)
        logger.info("✅ Supabase graph service initialized")

    def execute_sql(self, sql: str, params: Dict = None) -> List[Dict]:
        """
        Execute raw SQL via Supabase RPC
        Note: This requires a PostgreSQL function to be created in Supabase
        """
        # For now, we'll work with cached_entities directly
        # In production, you'd create SQL functions in Supabase
        pass

    def get_entity_by_name(self, name: str) -> Optional[Dict]:
        """Get entity by name from cached_entities"""
        try:
            response = self.client.table('cached_entities') \
                .select('*') \
                .filter('properties->>name', 'ilike', f'%{name}%') \
                .limit(1) \
                .execute()

            if response.data:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Error fetching entity: {e}")
            return None

    def search_entities(self, query: str, limit: int = 20) -> List[Dict]:
        """Search entities by name or type"""
        try:
            response = self.client.table('cached_entities') \
                .select('*') \
                .or_(f'properties->>name.ilike.%{query}%,labels.ilike.%{query}%') \
                .limit(limit) \
                .execute()

            return response.data
        except Exception as e:
            logger.error(f"Error searching entities: {e}")
            return []

    def get_entities_by_type(self, entity_type: str, limit: int = 100) -> List[Dict]:
        """Get all entities of a specific type"""
        try:
            response = self.client.table('cached_entities') \
                .select('*') \
                .contains('labels', [entity_type]) \
                .limit(limit) \
                .execute()

            return response.data
        except Exception as e:
            logger.error(f"Error fetching by type: {e}")
            return []

    def get_entity_count(self) -> int:
        """Get total count of entities"""
        try:
            response = self.client.table('cached_entities') \
                .select('*', count='exact') \
                .execute()

            return response.count if hasattr(response, 'count') else len(response.data)
        except Exception as e:
            logger.error(f"Error getting count: {e}")
            return 0

    # ========================================================================
    # Temporal Intelligence Methods
    # ========================================================================

    def create_temporal_episode_table(self):
        """
        Create a table for temporal episodes if it doesn't exist.
        This would be done via a Supabase migration in production.
        """
        # In production, this would be a SQL migration:
        # CREATE TABLE temporal_episodes (
        #   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        #   entity_id TEXT NOT NULL,
        #   episode_type TEXT NOT NULL,
        #   timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        #   description TEXT,
        #   source TEXT,
        #   metadata JSONB,
        #   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        # );
        logger.info("Note: temporal_episodes table should be created via migration")

    def add_rfp_episode(self, rfp_data: Dict) -> Dict[str, Any]:
        """
        Add an RFP detection as a temporal episode
        Note: Requires temporal_episodes table to exist
        """
        # For now, store in a local structure or create the table first
        logger.info(f"Would create RFP episode: {rfp_data.get('rfp_id')}")
        return {
            'status': 'not_implemented',
            'message': 'Create temporal_episodes table first via migration'
        }

    def get_entity_timeline(self, entity_id: str, limit: int = 50) -> List[Dict]:
        """Get temporal history for an entity"""
        # This would query the temporal_episodes table
        logger.info(f"Timeline for {entity_id} (requires temporal_episodes table)")
        return []

    def analyze_temporal_fit(self, entity_id: str, rfp_id: str, **kwargs) -> Dict[str, Any]:
        """
        Analyze entity-RFP fit based on available data
        This is a simplified version that works without temporal tables
        """
        # Get the entity
        entity = self.get_entity_by_name(entity_id)

        if not entity:
            return {
                'entity_id': entity_id,
                'rfp_id': rfp_id,
                'fit_score': 0.0,
                'confidence': 0.0,
                'error': 'Entity not found'
            }

        props = entity.get('properties', {})

        # Simple scoring based on entity properties
        score = 0.5  # Base score
        factors = []
        recommendations = []

        # Check for relevant properties
        if props.get('type') == 'Club':
            score += 0.1
            factors.append({'factor': 'is_club', 'impact': 'positive'})

        if props.get('country') == 'United Kingdom':
            score += 0.1
            factors.append({'factor': 'uk_based', 'impact': 'positive'})

        if props.get('league'):
            recommendations.append(f"Active in {props.get('league')}")

        return {
            'entity_id': entity_id,
            'rfp_id': rfp_id,
            'fit_score': min(1.0, score),
            'confidence': 0.5,
            'key_factors': factors,
            'recommendations': recommendations,
            'analyzed_at': datetime.now(timezone.utc).isoformat()
        }


# ============================================================================
# SQL Migration for temporal_episodes table
# ============================================================================

TEMPORAL_EPISODES_SQL = """
-- Create temporal_episodes table for tracking events
CREATE TABLE IF NOT EXISTS temporal_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    episode_type TEXT NOT NULL, -- RFP_DETECTED, PARTNERSHIP_FORMED, etc.
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT,
    source TEXT,
    url TEXT,
    category TEXT,
    estimated_value NUMERIC,
    confidence_score NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_temporal_episodes_entity ON temporal_episodes(entity_id);
CREATE INDEX IF NOT EXISTS idx_temporal_episodes_timestamp ON temporal_episodes(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_temporal_episodes_type ON temporal_episodes(episode_type);

-- Create table for temporal fit analysis cache
CREATE TABLE IF NOT EXISTS temporal_fit_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id TEXT NOT NULL,
    rfp_id TEXT NOT NULL,
    fit_score NUMERIC NOT NULL,
    confidence NUMERIC NOT NULL,
    trend_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temporal_fit_entity_rfp ON temporal_fit_cache(entity_id, rfp_id);
"""


def create_migration_file():
    """Create a SQL migration file for Supabase"""
    migration_path = "migrations/add_temporal_intelligence.sql"
    with open(migration_path, 'w') as f:
        f.write(TEMPORAL_EPISODES_SQL)
    print(f"✅ Migration file created: {migration_path}")
    print("\nTo apply this migration:")
    print("1. Go to your Supabase dashboard: https://app.supabase.com")
    print("2. Navigate to SQL Editor")
    print(f"3. Run the contents of {migration_path}")


if __name__ == "__main__":
    import asyncio

    async def test():
        service = SupabaseGraphService()

        # Test basic operations
        count = service.get_entity_count()
        print(f"Total entities: {count}")

        # Search for something
        results = service.search_entities("Arsenal", limit=5)
        print(f"Search results for 'Arsenal': {len(results)}")

        if results:
            for r in results[:3]:
                props = r.get('properties', {})
                print(f"  - {props.get('name', 'Unknown')}: {r.get('labels', [])}")

        # Test fit analysis
        analysis = service.analyze_temporal_fit("Arsenal FC", "test-rfp-001")
        print(f"\nFit analysis: {analysis}")

    asyncio.run(test())
