#!/usr/bin/env python3
"""
Import extracted Supabase data into FalkorDB
Creates nodes and relationships using Cypher

Usage:
    python backend/import_to_falkordb.py --input backend/falkordb_export.json
    python backend/import_to_falkordb.py --input backend/falkordb_export.json --nodes-only
    python backend/import_to_falkordb.py --input backend/falkordb_export.json --relationships-only
"""

import os
import sys
import json
import logging
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path

# Try to import neo4j driver
try:
    from neo4j import GraphDatabase, Driver
except ImportError:
    print("❌ neo4j not installed. Run: pip install neo4j")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FalkorDBImporter:
    """Import entities and relationships into FalkorDB"""

    def __init__(self):
        self.uri = os.getenv("FALKORDB_URI") or os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.user = os.getenv("FALKORDB_USER") or os.getenv("NEO4J_USER", "neo4j")
        self.password = os.getenv("FALKORDB_PASSWORD") or os.getenv("NEO4J_PASSWORD", "")
        self.database = os.getenv("FALKORDB_DATABASE") or os.getenv("NEO4J_DATABASE", "neo4j")

        self.driver: Optional[Driver] = None
        self._connect()

    def _connect(self):
        """Establish connection to FalkorDB"""
        try:
            self.driver = GraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password)
            )
            # Verify connectivity
            self.driver.verify_connectivity()
            logger.info(f"✅ Connected to FalkorDB: {self.uri}")
        except Exception as e:
            logger.error(f"❌ Failed to connect to FalkorDB: {e}")
            raise

    def test_connection(self) -> bool:
        """Test the FalkorDB connection"""
        try:
            with self.driver.session(database=self.database) as session:
                result = session.run("RETURN 1 as test")
                record = result.single()
                return record and record["test"] == 1
        except Exception as e:
            logger.error(f"❌ Connection test failed: {e}")
            return False

    def initialize_database(self):
        """Initialize database with constraints and indexes"""
        logger.info("🔧 Initializing database constraints and indexes...")

        constraints_queries = [
            # Unique constraint for neo4j_id
            """
            CREATE CONSTRAINT entity_neo4j_id_unique
            IF NOT EXISTS
            FOR (n:Entity)
            REQUIRE n.neo4j_id IS UNIQUE
            """,
            # Unique constraint for name on commonly used labels
            """
            CREATE CONSTRAINT club_name_unique
            IF NOT EXISTS
            FOR (n:Club)
            REQUIRE n.name IS UNIQUE
            """,
            """
            CREATE CONSTRAINT league_name_unique
            IF NOT EXISTS
            FOR (n:League)
            REQUIRE n.name IS UNIQUE
            """,
            """
            CREATE CONSTRAINT person_name_unique
            IF NOT EXISTS
            FOR (n:Person)
            REQUIRE n.name IS UNIQUE
            """,
        ]

        index_queries = [
            # Indexes for common search fields
            "CREATE INDEX entity_name_index IF NOT EXISTS FOR (n:Entity) ON (n.name)",
            "CREATE INDEX entity_type_index IF NOT EXISTS FOR (n:Entity) ON (n.type)",
            "CREATE INDEX entity_sport_index IF NOT EXISTS FOR (n:Entity) ON (n.sport)",
            "CREATE INDEX entity_country_index IF NOT EXISTS FOR (n:Entity) ON (n.country)",
        ]

        with self.driver.session(database=self.database) as session:
            for query in constraints_queries:
                try:
                    session.run(query)
                except Exception as e:
                    logger.warning(f"⚠️  Could not create constraint: {e}")

            for query in index_queries:
                try:
                    session.run(query)
                except Exception as e:
                    logger.warning(f"⚠️  Could not create index: {e}")

        logger.info("✅ Database initialization complete")

    async def import_entities(
        self,
        entities: List[Dict[str, Any]],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Import entities as nodes to FalkorDB

        Args:
            entities: List of entity dictionaries
            batch_size: Number of entities to process per batch

        Returns:
            Import statistics
        """
        logger.info(f"📥 Importing {len(entities)} entities...")

        stats = {
            'total': len(entities),
            'success': 0,
            'failed': 0,
            'errors': []
        }

        # Process in batches
        for i in range(0, len(entities), batch_size):
            batch = entities[i:i + batch_size]

            with self.driver.session(database=self.database) as session:
                for entity in batch:
                    try:
                        await self._import_single_entity(session, entity)
                        stats['success'] += 1

                        if stats['success'] % 100 == 0:
                            logger.info(f"   Imported {stats['success']}/{stats['total']} entities...")

                    except Exception as e:
                        stats['failed'] += 1
                        stats['errors'].append({
                            'entity_id': entity.get('neo4j_id', 'unknown'),
                            'error': str(e)
                        })

        logger.info(f"✅ Entity import complete: {stats['success']} success, {stats['failed']} failed")
        return stats

    async def _import_single_entity(self, session, entity: Dict[str, Any]):
        """Import a single entity node"""
        labels = entity.get('labels', ['Entity'])
        props = entity.get('properties', {})
        neo4j_id = entity.get('neo4j_id')

        if not neo4j_id:
            raise ValueError("Entity missing neo4j_id")

        # Build label string for Cypher
        label_str = ':'.join(labels) if labels else 'Entity'

        # Add neo4j_id to properties
        all_props = {**props, 'neo4j_id': neo4j_id}

        # Add badge_s3_url if present
        if entity.get('badge_s3_url'):
            all_props['badge_s3_url'] = entity['badge_s3_url']

        # Create MERGE query
        query = f"""
        MERGE (n:{label_str} {{neo4j_id: $neo4j_id}})
        SET n = $properties
        RETURN n
        """

        session.run(query, neo4j_id=neo4j_id, properties=all_props)

    async def import_relationships(
        self,
        relationships: List[Dict[str, Any]],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Import relationships to FalkorDB

        Args:
            relationships: List of relationship dictionaries
            batch_size: Number of relationships to process per batch

        Returns:
            Import statistics
        """
        logger.info(f"🔗 Importing {len(relationships)} relationships...")

        stats = {
            'total': len(relationships),
            'success': 0,
            'failed': 0,
            'errors': []
        }

        for i in range(0, len(relationships), batch_size):
            batch = relationships[i:i + batch_size]

            with self.driver.session(database=self.database) as session:
                for rel in batch:
                    try:
                        await self._import_single_relationship(session, rel)
                        stats['success'] += 1

                        if stats['success'] % 100 == 0:
                            logger.info(f"   Imported {stats['success']}/{stats['total']} relationships...")

                    except Exception as e:
                        stats['failed'] += 1
                        stats['errors'].append({
                            'from': rel.get('from_neo4j_id', 'unknown'),
                            'to': rel.get('to_neo4j_id', 'unknown'),
                            'error': str(e)
                        })

        logger.info(f"✅ Relationship import complete: {stats['success']} success, {stats['failed']} failed")
        return stats

    async def _import_single_relationship(self, session, relationship: Dict[str, Any]):
        """Import a single relationship"""
        from_id = relationship.get('from_neo4j_id')
        to_id = relationship.get('to_neo4j_id')
        rel_type = relationship.get('relationship_type', 'RELATED_TO')
        props = relationship.get('properties', {})

        if not from_id or not to_id:
            raise ValueError("Relationship missing from_neo4j_id or to_neo4j_id")

        # Create MATCH and MERGE query
        query = f"""
        MATCH (from {{neo4j_id: $from_id}})
        MATCH (to {{neo4j_id: $to_id}})
        MERGE (from)-[r:{rel_type}]->(to)
        SET r = $properties
        RETURN r
        """

        session.run(query, from_id=from_id, to_id=to_id, properties=props)

    def verify_import(self) -> Dict[str, Any]:
        """Verify the import by counting nodes and relationships"""
        logger.info("🔍 Verifying import...")

        with self.driver.session(database=self.database) as session:
            # Count nodes by label
            node_counts = session.run("""
                MATCH (n)
                RETURN labels(n) as labels, count(n) as count
                ORDER BY count DESC
            """).data()

            # Count relationships by type
            rel_counts = session.run("""
                MATCH ()-[r]->()
                RETURN type(r) as type, count(r) as count
                ORDER BY count DESC
            """).data()

            # Total counts
            total_nodes = session.run("MATCH (n) RETURN count(n) as count").single()["count"]
            total_rels = session.run("MATCH ()-[r]->() RETURN count(r) as count").single()["count"]

        return {
            'total_nodes': total_nodes,
            'total_relationships': total_rels,
            'nodes_by_label': node_counts,
            'relationships_by_type': rel_counts
        }

    def close(self):
        """Close the database connection"""
        if self.driver:
            self.driver.close()
            logger.info("🔌 FalkorDB connection closed")


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Import entities into FalkorDB from Supabase export'
    )
    parser.add_argument(
        '--input', '-i',
        required=True,
        help='Input JSON file path from extract_from_supabase.py'
    )
    parser.add_argument(
        '--nodes-only',
        action='store_true',
        help='Only import nodes, skip relationships'
    )
    parser.add_argument(
        '--relationships-only',
        action='store_true',
        help='Only import relationships, skip nodes'
    )
    parser.add_argument(
        '--batch-size', '-b',
        type=int,
        default=100,
        help='Batch size for imports (default: 100)'
    )
    parser.add_argument(
        '--verify',
        action='store_true',
        help='Verify import after completion'
    )
    parser.add_argument(
        '--skip-init',
        action='store_true',
        help='Skip database initialization (constraints/indexes)'
    )

    args = parser.parse_args()

    # Check input file exists
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"❌ Input file not found: {args.input}")
        sys.exit(1)

    # Load export data
    logger.info(f"📂 Loading export data from {args.input}")
    with open(input_path) as f:
        export_data = json.load(f)

    entities = export_data.get('entities', [])
    relationships = export_data.get('relationships', [])
    metadata = export_data.get('metadata', {})

    logger.info(f"📊 Export contains: {len(entities)} entities, {len(relationships)} relationships")
    logger.info(f"   Exported at: {metadata.get('exported_at', 'unknown')}")

    try:
        importer = FalkorDBImporter()

        # Test connection
        if not importer.test_connection():
            print("❌ FalkorDB connection test failed")
            sys.exit(1)

        # Initialize database
        if not args.skip_init:
            importer.initialize_database()

        # Import entities
        if not args.relationships_only:
            entity_stats = await importer.import_entities(entities, args.batch_size)
            print(f"\n✅ Entity import: {entity_stats['success']} success, {entity_stats['failed']} failed")

        # Import relationships
        if not args.nodes_only:
            rel_stats = await importer.import_relationships(relationships, args.batch_size)
            print(f"✅ Relationship import: {rel_stats['success']} success, {rel_stats['failed']} failed")

        # Verify
        if args.verify:
            verification = importer.verify_import()
            print(f"\n📊 Import verification:")
            print(f"   Total nodes: {verification['total_nodes']}")
            print(f"   Total relationships: {verification['total_relationships']}")

        importer.close()
        print("\n✅ Import complete!")

    except Exception as e:
        logger.error(f"❌ Import failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
