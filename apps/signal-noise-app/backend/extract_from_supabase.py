#!/usr/bin/env python3
"""
Extract entities and relationships from Supabase cached_entities
Rebuild graph structure for FalkorDB import

Usage:
    python backend/extract_from_supabase.py
    python backend/extract_from_supabase.py --output entities.json
    python backend/extract_from_supabase.py --batch-size 50
"""

import os
import sys
import json
import logging
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
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
            logger = logging.getLogger(__name__)
            logger.info(f"Loaded environment from {env_file}")
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

# Try to import supabase, provide helpful error if not installed
try:
    from supabase import create_client
except ImportError:
    print("❌ supabase-py not installed. Run: pip install supabase")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class GraphNode:
    """Represents a graph node to be imported into FalkorDB"""
    neo4j_id: str
    labels: List[str]
    properties: Dict[str, Any]
    badge_s3_url: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class GraphRelationship:
    """Represents a graph relationship to be imported into FalkorDB"""
    from_neo4j_id: str
    to_neo4j_id: str
    relationship_type: str
    properties: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SupabaseExtractor:
    """Extract entities and relationships from Supabase cached_entities"""

    def __init__(self):
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError(
                "Supabase credentials not found. Set NEXT_PUBLIC_SUPABASE_URL "
                "and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
            )

        self.client = create_client(supabase_url, supabase_key)
        logger.info(f"✅ Supabase client initialized: {supabase_url[:30]}...")

    async def extract_all_entities(self, batch_size: int = 100) -> List[GraphNode]:
        """
        Extract all entities from cached_entities table

        Args:
            batch_size: Number of entities to fetch per request

        Returns:
            List of GraphNode objects
        """
        all_entities = []
        offset = 0
        total_count = 0

        logger.info(f"📊 Starting extraction with batch_size={batch_size}")

        while True:
            try:
                response = self.client.table('cached_entities') \
                    .select('*') \
                    .range(offset, offset + batch_size - 1) \
                    .execute()

                if not response.data:
                    break

                batch = response.data
                all_entities.extend(batch)
                total_count += len(batch)
                offset += batch_size

                logger.info(f"📦 Extracted {total_count} entities so far (batch size: {len(batch)})")

                if len(batch) < batch_size:
                    break

            except Exception as e:
                logger.error(f"❌ Error extracting batch at offset {offset}: {e}")
                break

        logger.info(f"✅ Extraction complete: {total_count} entities total")
        return self._parse_entities(all_entities)

    def _parse_entities(self, raw_entities: List[Dict]) -> List[GraphNode]:
        """Parse raw Supabase entities into GraphNode objects"""
        nodes = []

        for entity in raw_entities:
            try:
                # Get labels - handle both string and list formats
                labels = entity.get('labels', ['Entity'])
                if isinstance(labels, str):
                    labels = [labels]
                elif not isinstance(labels, list):
                    labels = ['Entity']

                # Get properties
                properties = entity.get('properties', {})
                if isinstance(properties, str):
                    try:
                        properties = json.loads(properties)
                    except json.JSONDecodeError:
                        properties = {}

                # Get neo4j_id
                neo4j_id = entity.get('neo4j_id') or str(entity.get('id', ''))
                if not neo4j_id:
                    logger.warning(f"⚠️  Entity missing neo4j_id, skipping: {properties.get('name', 'Unknown')}")
                    continue

                node = GraphNode(
                    neo4j_id=neo4j_id,
                    labels=labels,
                    properties=properties,
                    badge_s3_url=entity.get('badge_s3_url')
                )
                nodes.append(node)

            except Exception as e:
                logger.warning(f"⚠️  Error parsing entity: {e}")
                continue

        return nodes

    def rebuild_relationships(self, entities: List[GraphNode]) -> List[GraphRelationship]:
        """
        Reconstruct relationships from entity properties

        Looks for common relationship patterns in properties:
        - plays_for_club, works_at, competes_in, etc.
        """
        relationships = []

        # Create a lookup map for entities by name
        entity_map = {}
        for entity in entities:
            name = entity.properties.get('name')
            if name:
                entity_map[name.lower()] = entity

        logger.info(f"🔗 Rebuilding relationships from {len(entities)} entities...")

        for entity in entities:
            props = entity.properties

            # Common relationship patterns to extract
            relationship_patterns = {
                'plays_for_club': 'PLAYS_FOR',
                'club': 'PLAYS_FOR',
                'team': 'PLAYS_FOR',
                'works_at': 'WORKS_AT',
                'employer': 'WORKS_AT',
                'competes_in': 'COMPETES_IN',
                'league': 'COMPETES_IN',
                'stadium': 'PLAYS_AT',
                'venue': 'PLAYS_AT',
                'manager': 'MANAGED_BY',
                'coach': 'COACHED_BY',
                'owner': 'OWNED_BY',
                'parent_organization': 'PART_OF',
                'founded_by': 'FOUNDED_BY',
            }

            for prop_name, rel_type in relationship_patterns.items():
                prop_value = props.get(prop_name)
                if not prop_value:
                    continue

                # Handle list of values
                if isinstance(prop_value, list):
                    values = prop_value
                else:
                    values = [prop_value]

                for value in values:
                    if not value or not isinstance(value, str):
                        continue

                    # Find target entity by name
                    target_entity = entity_map.get(value.lower())
                    if target_entity:
                        relationship = GraphRelationship(
                            from_neo4j_id=entity.neo4j_id,
                            to_neo4j_id=target_entity.neo4j_id,
                            relationship_type=rel_type,
                            properties={
                                'source_property': prop_name,
                                'extracted_at': datetime.now().isoformat()
                            }
                        )
                        relationships.append(relationship)

        logger.info(f"✅ Rebuilt {len(relationships)} relationships")
        return relationships

    async def export_to_json(self, output_path: str, batch_size: int = 100):
        """
        Extract entities and relationships, export to JSON file

        Args:
            output_path: Path to output JSON file
            batch_size: Number of entities to fetch per request
        """
        logger.info(f"🚀 Starting export to {output_path}")

        # Extract entities
        entities = await self.extract_all_entities(batch_size)

        # Rebuild relationships
        relationships = self.rebuild_relationships(entities)

        # Prepare export data
        export_data = {
            'metadata': {
                'exported_at': datetime.now().isoformat(),
                'total_entities': len(entities),
                'total_relationships': len(relationships),
                'source': 'Supabase cached_entities',
                'destination': 'FalkorDB'
            },
            'entities': [e.to_dict() for e in entities],
            'relationships': [r.to_dict() for r in relationships]
        }

        # Write to file
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(export_data, f, indent=2)

        logger.info(f"✅ Export complete: {output_path}")
        logger.info(f"   - Entities: {len(entities)}")
        logger.info(f"   - Relationships: {len(relationships)}")

        return export_data


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Extract entities from Supabase for FalkorDB import'
    )
    parser.add_argument(
        '--output', '-o',
        default='backend/falkordb_export.json',
        help='Output JSON file path (default: backend/falkordb_export.json)'
    )
    parser.add_argument(
        '--batch-size', '-b',
        type=int,
        default=100,
        help='Batch size for Supabase queries (default: 100)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Count entities without exporting'
    )

    args = parser.parse_args()

    try:
        extractor = SupabaseExtractor()

        if args.dry_run:
            # Just count entities
            entities = await extractor.extract_all_entities(args.batch_size)
            print(f"\n✅ Dry run: Found {len(entities)} entities")
        else:
            # Full export
            await extractor.export_to_json(args.output, args.batch_size)
            print(f"\n✅ Export complete: {args.output}")

    except Exception as e:
        logger.error(f"❌ Export failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
