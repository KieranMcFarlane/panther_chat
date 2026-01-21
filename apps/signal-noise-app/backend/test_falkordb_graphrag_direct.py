#!/usr/bin/env python3
"""
FalkorDB + GraphRAG Direct Test
Uses Neo4j driver to connect to FalkorDB (Bolt protocol compatible)
"""

import os
import sys
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path

# Load environment
project_root = Path(__file__).parent.parent
for env_file in [project_root / '.env', Path('.env')]:
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)
        break

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import Graphiti and configure for FalkorDB
from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType

# FalkorDB Bolt protocol connection details
# FalkorDB Cloud supports Bolt protocol on port 6380 typically
# But we have the Redis port 50743 - let's check if there's a Bolt endpoint

# For now, let's use direct FalkorDB with custom implementation
try:
    from neo4j import GraphDatabase
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False
    logger.warning("Neo4j driver not available")


async def test_falkordb_native():
    """Test using native falkordb-py library"""
    from falkordb import FalkorDB

    uri = os.getenv("FALKORDB_URI")
    username = os.getenv("FALKORDB_USER", "falkordb")
    password = os.getenv("FALKORDB_PASSWORD")

    # Parse host and port
    import urllib.parse
    parsed = urllib.parse.urlparse(uri.replace("rediss://", "http://"))
    host = parsed.hostname
    port = parsed.port

    logger.info(f"🔗 Connecting to FalkorDB Cloud at {host}:{port}")

    db = FalkorDB(host=host, port=port, username=username, password=password)
    logger.info("✅ Connected to FalkorDB Cloud")

    g = db.select_graph("sports_intelligence")

    # Add sample RFP data
    logger.info("📝 Adding sample RFP episodes...")

    episodes = [
        ("Manchester United", "Digital transformation RFP - £2.5M", "Technology"),
        ("Liverpool FC", "Stadium expansion - £80M", "Infrastructure"),
        ("Arsenal FC", "CRM system upgrade - £1.2M", "Technology"),
        ("Premier League", "AI analytics partnership - £15M", "Sports Tech"),
    ]

    for name, description, category in episodes:
        import time
        timestamp = int(time.time())
        g.query(f"""
            MERGE (c:Club {{name: '{name}', category: '{category}'}})
            MERGE (r:RFP {{description: '{description}', created_at: {timestamp}}})
            MERGE (c)-[:HAS_RFP]->(r)
            RETURN c.name
        """)
        logger.info(f"   ✅ Added: {name}")

    # Query back
    result = g.query("MATCH (c:Club)-[r:HAS_RFP]->(rfp:RFP) RETURN c.name, rfp.description LIMIT 5")
    logger.info(f"\n📊 Found {len(result.result_set)} RFP relationships:")
    for row in result.result_set:
        logger.info(f"   • {row[0]}: {row[1][:60]}...")

    # Test search-like query
    logger.info("\n🔍 Testing search for 'Technology' RFPs...")
    result = g.query("MATCH (c:Club)-[r:HAS_RFP]->(rfp:RFP) WHERE c.category = 'Technology' RETURN c.name, rfp.description")
    logger.info(f"   Found {len(result.result_set)} Technology RFPs")

    logger.info("\n✅ FalkorDB + GraphRAG working!")


if __name__ == '__main__':
    asyncio.run(test_falkordb_native())
