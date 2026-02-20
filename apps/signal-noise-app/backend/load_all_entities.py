"""
Load All Entities from FalkorDB

Prepares all 3,400+ entities for template discovery bootstrap.
One-time operation per quarterly bootstrap.
"""

import asyncio
import json
import logging
from typing import List, Dict
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class EntityLoader:
    """Load all entities from FalkorDB for template discovery"""

    def __init__(self, falkordb_uri: str = None, falkordb_user: str = None, falkordb_password: str = None, falkordb_database: str = None):
        self.falkordb_uri = falkordb_uri or "bolt://localhost:7687"
        self.falkordb_user = falkordb_user or "falkordb"
        self.falkordb_password = falkordb_password or ""
        self.falkordb_database = falkordb_database or "sports_intelligence"

    async def load_all_entities(self) -> List[Dict]:
        """
        Load all entities from FalkorDB

        Returns:
            List of entity dicts with attributes for clustering
        """
        logger.info("📊 Loading all entities from FalkorDB...")

        # Check if URI is a cloud instance (contains "cloud" or uses rediss://)
        is_cloud = "cloud" in self.falkordb_uri or self.falkordb_uri.startswith("rediss://")

        if is_cloud:
            logger.warning(f"⚠️  Cloud FalkorDB detected, using local file fallback")
            logger.info(f"💡 To use cloud instance, ensure network connectivity to: {self.falkordb_uri}")
            return await self._load_from_fallback()

        try:
            from falkordb import FalkorDB
            import urllib.parse

            # Parse host and port from URI
            parsed = urllib.parse.urlparse(self.falkordb_uri.replace("rediss://", "http://"))
            host = parsed.hostname or "localhost"
            port = parsed.port or 6379

            logger.info(f"Connecting to FalkorDB at {host}:{port}...")

            # Create FalkorDB connection with SSL
            driver = FalkorDB(
                host=host,
                port=port,
                username=self.falkordb_user,
                password=self.falkordb_password,
                ssl=True
            )

            # Select graph database
            graph = driver.select_graph(self.falkordb_database)

            # Test connection
            logger.info("Testing connection...")
            test_result = graph.query("RETURN 1 AS test")
            logger.info("✅ Connection successful")

            entities = []

            # Query all Entity nodes
            logger.info("Querying entities...")
            query = """
            MATCH (e:Entity)
            WHERE e.entity_id IS NOT NULL
            RETURN
                e.entity_id as entity_id,
                e.name as name,
                e.sport as sport,
                e.country as country,
                e.league_or_competition as league_or_competition,
                e.ownership_type as ownership_type,
                e.org_type as org_type,
                e.estimated_revenue_band as estimated_revenue_band,
                e.digital_maturity as digital_maturity,
                e.description as description
            """

            result = graph.query(query)

            for record in result:
                entity = {
                    "entity_id": record.get("entity_id"),
                    "name": record.get("name"),
                    "sport": record.get("sport", "unknown"),
                    "country": record.get("country", "unknown"),
                    "league_or_competition": record.get("league_or_competition"),
                    "ownership_type": record.get("ownership_type", "unknown"),
                    "org_type": record.get("org_type", "club"),
                    "estimated_revenue_band": record.get("estimated_revenue_band", "unknown"),
                    "digital_maturity": record.get("digital_maturity", "unknown"),
                    "description": record.get("description", "")
                }

                # Skip entities without required fields
                if entity["entity_id"] and entity["name"]:
                    entities.append(entity)

            logger.info(f"✅ Loaded {len(entities)} entities from FalkorDB")
            # Note: FalkorDB connection doesn't need explicit close in this version
            return entities

        except Exception as e:
            logger.error(f"❌ Failed to load entities from FalkorDB: {e}")
            logger.info("💡 Attempting to load from local file fallback...")
            return await self._load_from_fallback()

    async def _load_from_fallback(self) -> List[Dict]:
        """Load entities from fallback file (converted_entities.json)"""
        import json

        fallback_file = "data/converted_entities.json"

        try:
            with open(fallback_file, 'r') as f:
                entities_raw = json.load(f)

            logger.info(f"📂 Loaded {len(entities_raw)} entities from {fallback_file}")

            # Map fields to expected schema
            entities = []
            for e in entities_raw:
                entity = {
                    "entity_id": e.get("name", "").lower().replace(" ", "_"),
                    "name": e.get("name", ""),
                    "sport": e.get("sport", "unknown"),
                    "country": e.get("country", "unknown"),
                    "league_or_competition": e.get("level", ""),
                    "ownership_type": "unknown",
                    "org_type": e.get("type", "club").lower(),
                    "estimated_revenue_band": "unknown",
                    "digital_maturity": "unknown",
                    "description": e.get("description", "")
                }

                if entity["name"]:
                    entities.append(entity)

            logger.info(f"✅ Mapped {len(entities)} entities to schema")
            return entities

        except Exception as e:
            logger.error(f"❌ Fallback loading also failed: {e}")
            raise

    async def save_entities_to_file(
        self,
        entities: List[Dict],
        output_file: str = "data/all_entities.json"
    ):
        """Save entities to JSON file for bootstrap"""

        # Create data directory if needed
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Save with metadata
        data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "entity_count": len(entities),
                "source": "FalkorDB",
                "purpose": "Template discovery bootstrap"
            },
            "entities": entities
        }

        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)

        logger.info(f"💾 Saved {len(entities)} entities to {output_file}")
        logger.info(f"📁 File size: {output_path.stat().st_size / 1024:.1f} KB")

    async def load_from_file(
        self,
        input_file: str = "data/all_entities.json"
    ) -> List[Dict]:
        """Load entities from previously saved file"""

        logger.info(f"📂 Loading entities from {input_file}...")

        with open(input_file, 'r') as f:
            data = json.load(f)

        entities = data.get("entities", [])
        metadata = data.get("metadata", {})

        logger.info(f"✅ Loaded {len(entities)} entities from file")
        logger.info(f"📅 Original generation: {metadata.get('generated_at')}")

        return entities


async def main():
    """CLI for loading entities"""

    import argparse

    parser = argparse.ArgumentParser(description="Load all entities from FalkorDB")
    parser.add_argument("--output", default="data/all_entities.json", help="Output JSON file")
    parser.add_argument("--falkordb-uri", default="bolt://localhost:7687", help="FalkorDB URI")
    parser.add_argument("--falkordb-user", default="falkordb", help="FalkorDB user")
    parser.add_argument("--falkordb-password", required=True, help="FalkorDB password")
    parser.add_argument("--falkordb-database", default="sports_intelligence", help="FalkorDB database name")

    args = parser.parse_args()

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Load entities
    loader = EntityLoader(
        falkordb_uri=args.falkordb_uri,
        falkordb_user=args.falkordb_user,
        falkordb_password=args.falkordb_password,
        falkordb_database=args.falkordb_database
    )

    entities = await loader.load_all_entities()
    await loader.save_entities_to_file(entities, args.output)

    logger.info("✅ Entity loading complete!")


if __name__ == "__main__":
    asyncio.run(main())
