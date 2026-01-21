#!/usr/bin/env python3
"""
Import extracted Supabase data into FalkorDB Cloud
Uses Redis protocol with GRAPH.QUERY commands

Usage:
    python backend/falkordb_cloud_import.py --input backend/falkordb_export.json
    python backend/falkordb_cloud_import.py --input backend/falkordb_export.json --verify
"""

import os
import sys
import json
import logging
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
import urllib.parse

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

# Try to import redis client for FalkorDB Cloud
try:
    import redis
except ImportError:
    print("❌ redis not installed. Run: pip install redis")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FalkorDBCloudImporter:
    """Import entities and relationships into FalkorDB Cloud using Redis protocol"""

    def __init__(self):
        # Parse the Redis URI
        redis_uri = os.getenv("FALKORDB_URI") or os.getenv("NEO4J_URI", "redis://localhost:6379")
        self.password = os.getenv("FALKORDB_PASSWORD") or os.getenv("NEO4J_PASSWORD", "")
        self.graph_name = os.getenv("FALKORDB_DATABASE") or os.getenv("NEO4J_DATABASE", "sports_intelligence")

        # Parse host and port from URI
        # Handle special FalkorDB Cloud format: rediss://hostname:port
        if redis_uri.startswith("rediss://") or redis_uri.startswith("redis://"):
            parsed = urllib.parse.urlparse(redis_uri)
            host = parsed.hostname
            port = parsed.port or 6379  # Use default if no port specified
            ssl = parsed.scheme == "rediss"
        elif "falkordb.net" in redis_uri:
            # Extract host from FalkorDB Cloud URI
            parsed = urllib.parse.urlparse(redis_uri)
            host = parsed.hostname or redis_uri.split("//")[1].split(":")[0]
            port = parsed.port or 6379
            ssl = parsed.scheme == "rediss"
        else:
            host = "localhost"
            port = 6379
            ssl = False

        # Extract instance ID if present
        if "instance-" in host:
            self.instance_id = host.split(".")[0]
        else:
            self.instance_id = "local"

        self.client: Optional[redis.Redis] = None
        self._connect(host, port, ssl)

    def _connect(self, host: str, port: int, ssl: bool):
        """Establish connection to FalkorDB Cloud"""
        try:
            # For FalkorDB Cloud, use username='default' when password is provided
            # FalkorDB Cloud AUTH requires: redis.Redis(username='falkordb', password='...')
            username = os.getenv("FALKORDB_USER") or os.getenv("NEO4J_USERNAME", "default")

            self.client = redis.Redis(
                host=host,
                port=port,
                username=username,
                password=self.password if self.password else None,
                ssl=ssl,
                ssl_cert_reqs=None,
                decode_responses=True
            )

            # Test connection
            self.client.ping()
            logger.info(f"✅ Connected to FalkorDB Cloud: {host}:{port} (SSL: {ssl})")

            # Test FalkorDB module
            info = self.client.execute_command("MODULE", "LIST")
            has_graph = any("graph" in str(module).lower() for module in info)
            if has_graph:
                logger.info("✅ FalkorDB Graph module is available")
            else:
                logger.warning("⚠️  FalkorDB Graph module not detected")

        except Exception as e:
            logger.error(f"❌ Failed to connect to FalkorDB Cloud: {e}")
            raise

    def test_connection(self) -> bool:
        """Test the FalkorDB connection"""
        try:
            # Test Redis connection
            self.client.ping()

            # Test Graph module
            result = self.client.execute_command("GRAPH.QUERY", self.graph_name, "RETURN 1", "--compact")
            return True
        except Exception as e:
            logger.error(f"❌ Connection test failed: {e}")
            return False

    def execute_cypher(self, query: str, params: Dict[str, Any] = None) -> List:
        """
        Execute a Cypher query via Redis GRAPH.QUERY

        Args:
            query: Cypher query string
            params: Query parameters (will be substituted)

        Returns:
            Query results
        """
        # Substitute parameters into query
        if params:
            for key, value in params.items():
                placeholder = f"${key}"
                if isinstance(value, str):
                    query = query.replace(placeholder, f"'{value}'")
                elif isinstance(value, bool):
                    query = query.replace(placeholder, "true" if value else "false")
                elif value is None:
                    query = query.replace(placeholder, "null")
                else:
                    query = query.replace(placeholder, str(value))

        try:
            result = self.client.execute_command(
                "GRAPH.QUERY",
                self.graph_name,
                query,
                "--compact"
            )

            # Result format: [[metadata], [results]]
            if result and len(result) > 1:
                return result[1]
            return []
        except Exception as e:
            logger.error(f"Query failed: {e}")
            logger.debug(f"Query was: {query}")
            raise

    async def import_entities(
        self,
        entities: List[Dict[str, Any]],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Import entities as nodes to FalkorDB Cloud

        Args:
            entities: List of entity dictionaries
            batch_size: Number of entities to process per batch

        Returns:
            Import statistics
        """
        logger.info(f"📥 Importing {len(entities)} entities to FalkorDB Cloud...")

        stats = {
            'total': len(entities),
            'success': 0,
            'failed': 0,
            'errors': []
        }

        for i, entity in enumerate(entities):
            try:
                await self._import_single_entity(entity)
                stats['success'] += 1

                if stats['success'] % 100 == 0:
                    logger.info(f"   Imported {stats['success']}/{stats['total']} entities...")

            except Exception as e:
                stats['failed'] += 1
                stats['errors'].append({
                    'entity_id': entity.get('neo4j_id', 'unknown'),
                    'error': str(e)
                })

                if stats['failed'] <= 5:  # Log first few errors
                    logger.warning(f"Failed to import entity: {e}")

        logger.info(f"✅ Entity import complete: {stats['success']} success, {stats['failed']} failed")
        return stats

    async def _import_single_entity(self, entity: Dict[str, Any]):
        """Import a single entity node"""
        labels = entity.get('labels', ['Entity'])
        props = entity.get('properties', {})
        neo4j_id = entity.get('neo4j_id')

        if not neo4j_id:
            raise ValueError("Entity missing neo4j_id")

        # Build label string
        label_str = ':'.join(labels) if labels else 'Entity'

        # Build properties string - filter out complex nested objects
        all_props = {'neo4j_id': neo4j_id}

        # Add simple properties only (skip complex nested dicts)
        for key, value in props.items():
            # Skip complex nested objects and lists
            if isinstance(value, (dict, list)):
                continue
            # Skip properties with nested structures in their string representation
            if isinstance(value, str) and ('{' in value or 'low' in value or 'high' in value):
                continue
            all_props[key] = value

        if entity.get('badge_s3_url'):
            all_props['badge_s3_url'] = entity['badge_s3_url']

        # Build property assignment string
        prop_strs = []
        for key, value in all_props.items():
            if isinstance(value, str):
                # Escape single quotes and backslashes
                escaped_value = value.replace("\\", "\\\\").replace("'", "\\'")
                prop_strs.append(f"n.{key} = '{escaped_value}'")
            elif isinstance(value, bool):
                prop_strs.append(f"n.{key} = {str(value).lower()}")
            elif isinstance(value, (int, float)):
                prop_strs.append(f"n.{key} = {value}")
            elif value is None:
                prop_strs.append(f"n.{key} = null")
            else:
                # Skip other complex types
                continue

        prop_assignment = ", ".join(prop_strs)

        # Create MERGE query
        query = f"""
        MERGE (n:{label_str} {{neo4j_id: '{neo4j_id}'}})
        SET {prop_assignment}
        RETURN n
        """

        self.execute_cypher(query)

    async def import_relationships(
        self,
        relationships: List[Dict[str, Any]],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Import relationships to FalkorDB Cloud

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

        for i, rel in enumerate(relationships):
            try:
                await self._import_single_relationship(rel)
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

    async def _import_single_relationship(self, relationship: Dict[str, Any]):
        """Import a single relationship"""
        from_id = relationship.get('from_neo4j_id')
        to_id = relationship.get('to_neo4j_id')
        rel_type = relationship.get('relationship_type', 'RELATED_TO')
        props = relationship.get('properties', {})

        if not from_id or not to_id:
            raise ValueError("Relationship missing from_neo4j_id or to_neo4j_id")

        # Build property assignments
        prop_strs = []
        for key, value in props.items():
            if isinstance(value, str):
                escaped_value = value.replace("'", "\\'")
                prop_strs.append(f"r.{key} = '{escaped_value}'")
            elif isinstance(value, bool):
                prop_strs.append(f"r.{key} = {str(value).lower()}")
            elif isinstance(value, (int, float)):
                prop_strs.append(f"r.{key} = {value}")
            elif value is None:
                prop_strs.append(f"r.{key} = null")
            else:
                prop_strs.append(f"r.{key} = '{str(value)}'")

        prop_assignment = ", ".join(prop_strs) if prop_strs else ""

        # Create MATCH and MERGE query
        if prop_assignment:
            query = f"""
            MATCH (from {{neo4j_id: '{from_id}'}})
            MATCH (to {{neo4j_id: '{to_id}'}})
            MERGE (from)-[r:{rel_type}]->(to)
            SET {prop_assignment}
            RETURN r
            """
        else:
            query = f"""
            MATCH (from {{neo4j_id: '{from_id}'}})
            MATCH (to {{neo4j_id: '{to_id}'}})
            MERGE (from)-[r:{rel_type}]->(to)
            RETURN r
            """

        self.execute_cypher(query)

    def verify_import(self) -> Dict[str, Any]:
        """Verify the import by counting nodes and relationships"""
        logger.info("🔍 Verifying import...")

        try:
            # Count nodes
            node_result = self.execute_cypher("MATCH (n) RETURN count(n) as count")
            total_nodes = int(node_result[0][0]) if node_result else 0

            # Count relationships
            rel_result = self.execute_cypher("MATCH ()-[r]->() RETURN count(r) as count")
            total_rels = int(rel_result[0][0]) if rel_result else 0

            # Count by label
            label_result = self.execute_cypher("""
                MATCH (n)
                RETURN labels(n)[0] as label, count(n) as count
                ORDER BY count DESC
            """)
            nodes_by_label = {}
            for row in label_result:
                if len(row) >= 2:
                    nodes_by_label[row[0]] = int(row[1])

            return {
                'total_nodes': total_nodes,
                'total_relationships': total_rels,
                'nodes_by_label': nodes_by_label,
                'graph_name': self.graph_name
            }

        except Exception as e:
            logger.error(f"Verification failed: {e}")
            return {
                'total_nodes': 0,
                'total_relationships': 0,
                'error': str(e)
            }

    def close(self):
        """Close the database connection"""
        if self.client:
            self.client.close()
            logger.info("🔌 FalkorDB connection closed")


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Import entities into FalkorDB Cloud from Supabase export'
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
        '--verify',
        action='store_true',
        help='Verify import after completion'
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
        importer = FalkorDBCloudImporter()

        # Test connection
        if not importer.test_connection():
            print("❌ FalkorDB connection test failed")
            sys.exit(1)

        # Import entities
        if not args.relationships_only:
            entity_stats = await importer.import_entities(entities)
            print(f"\n✅ Entity import: {entity_stats['success']} success, {entity_stats['failed']} failed")

        # Import relationships
        if not args.nodes_only:
            rel_stats = await importer.import_relationships(relationships)
            print(f"✅ Relationship import: {rel_stats['success']} success, {rel_stats['failed']} failed")

        # Verify
        if args.verify:
            verification = importer.verify_import()
            print(f"\n📊 Import verification:")
            print(f"   Total nodes: {verification['total_nodes']}")
            print(f"   Total relationships: {verification['total_relationships']}")
            print(f"   Nodes by label: {verification.get('nodes_by_label', {})}")

        importer.close()
        print("\n✅ Import complete!")

    except Exception as e:
        logger.error(f"❌ Import failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
