#!/usr/bin/env python3
"""
Entity Fetcher - Fetch entity from FalkorDB by ID for discovery

Usage:
    from backend.run_entity_discovery import fetch_entity_from_falkordb

    entity = await fetch_entity_from_falkordb("international-canoe-federation")
    # Returns: Entity(id, name, type, metadata, priority_tier)
"""

import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass

# Load environment
project_root = Path(__file__).parent
for env_file in [project_root / '.env', Path('.env')]:
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)
        break

# Import FalkorDB native client
try:
    from falkordb import FalkorDB
    FALKORDB_AVAILABLE = True
except ImportError:
    FALKORDB_AVAILABLE = False
    print("ERROR: falkordb not installed. Run: pip install falkordb")
    raise ImportError("falkordb required")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class Entity:
    """Entity from FalkorDB"""
    id: str
    name: str
    type: str  # ORG, PERSON, PRODUCT, INITIATIVE, VENUE
    metadata: Dict[str, Any]
    priority_tier: Optional[str] = None  # Calculated from metadata

    def __post_init__(self):
        """Calculate priority tier from metadata"""
        if self.metadata and 'priority' in self.metadata:
            priority = self.metadata['priority']

            # Map priority (0-100) to tier
            if priority >= 80:
                self.priority_tier = "PREMIUM"  # 51-100
            elif priority >= 50:
                self.priority_tier = "STANDARD"  # 21-50
            else:
                self.priority_tier = "BASIC"  # 0-20


def get_falkordb_client():
    """Get FalkorDB client using native library"""
    uri = os.getenv("FALKORDB_URI")
    username = os.getenv("FALKORDB_USER", "falkordb")
    password = os.getenv("FALKORDB_PASSWORD")
    database = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

    if not uri:
        raise ValueError("FALKORDB_URI environment variable not set")

    # Parse host and port from URI
    import urllib.parse
    parsed = urllib.parse.urlparse(uri.replace("rediss://", "http://"))
    host = parsed.hostname or "localhost"
    port = parsed.port or 6379

    try:
        db = FalkorDB(host=host, port=port, username=username, password=password, ssl=True)
        # Test connection
        g = db.select_graph(database)
        g.query("RETURN 1 AS test")
        return db, database
    except Exception as e:
        raise ConnectionError(f"Failed to connect to FalkorDB: {e}")


async def fetch_entity_from_falkordb(entity_id: str) -> Optional[Entity]:
    """
    Fetch entity from FalkorDB by ID

    Args:
        entity_id: Entity ID (e.g., "international-canoe-federation")

    Returns:
        Entity object or None if not found

    Example:
        entity = await fetch_entity_from_falkordb("international-canoe-federation")
        # Returns: Entity(
        #     id="international-canoe-federation",
        #     name="International Canoe Federation",
        #     type="ORG",
        #     metadata={...},
        #     priority_tier="PREMIUM"
        # )
    """
    if not FALKORDB_AVAILABLE:
        logger.error("FalkorDB not available")
        return None

    logger.info(f"Fetching entity: {entity_id}")

    try:
        db, database = get_falkordb_client()
        g = db.select_graph(database)

        # Query entity by ID
        query = f"MATCH (e:Entity {{id:'{entity_id}'}}) RETURN e"
        result = g.query(query).single()

        if not result:
            logger.warning(f"Entity not found: {entity_id}")
            return None

        # Extract entity properties
        entity_data = {
            'id': result['id'],
            'name': result.get('name', ''),
            'type': result.get('type', 'ORG'),
        'metadata': result.get('metadata', {})
        }

        # Create Entity object (will calculate priority_tier in __post_init__)
        entity = Entity(**entity_data)

        logger.info(f"✓ Fetched entity: {entity.name} (type: {entity.type}, priority: {entity.priority_tier})")
        return entity

    except Exception as e:
        logger.error(f"Error fetching entity: {e}")
        return None


if __name__ == "__main__":
    import asyncio

    async def main():
        """Test fetching an entity"""
        entity_id = "international-canoe-federation"
        entity = await fetch_entity_from_falkordb(entity_id)

        if entity:
            print(f"""
Entity Found:
  ID: {entity.id}
  Name: {entity.name}
  Type: {entity.type}
  Priority Tier: {entity.priority_tier}
  Metadata: {entity.metadata}
            """)
        else:
            print(f"Entity not found: {entity_id}")

    asyncio.run(main())
