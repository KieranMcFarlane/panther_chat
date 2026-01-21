#!/usr/bin/env python3
"""
FalkorDB + Graphiti + GraphRAG Test Script

This script demonstrates the complete GraphRAG pipeline using:
- FalkorDB: Graph database (Redis-compatible)
- Graphiti: Temporal knowledge graph framework
- OpenAI/Voyage: Embeddings for semantic search

Usage:
    python backend/test_graphiti_falkordb.py --full-test
    python backend/test_graphiti_falkordb.py --search "What RFPs exist?"
"""

import os
import sys
import asyncio
import argparse
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any

# Load environment variables
project_root = Path(__file__).parent.parent
for env_file in [project_root / '.env.local', project_root / '.env', Path('.env')]:
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)
        break

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import Graphiti with FalkorDB support
try:
    from graphiti_core import Graphiti
    from graphiti_core.driver.falkordb_driver import FalkorDriver
    from graphiti_core.nodes import EpisodeType
    GRAPHITI_AVAILABLE = True
except ImportError as e:
    logger.error(f"❌ Graphiti not available: {e}")
    logger.error("Install with: pip install 'graphiti-core[falkordb]'")
    sys.exit(1)

# Optional: Import custom embedder
try:
    from graphiti_core.llm_client.anthropic_client import AnthropicClient, LLMConfig
    from graphiti_core.embedder.voyage import VoyageEmbedder, VoyageAIConfig
    VOYAGE_AVAILABLE = True
except ImportError:
    VOYAGE_AVAILABLE = False


def get_falkordb_config() -> Dict[str, Any]:
    """Get FalkorDB configuration from environment"""
    # FalkorDB uses Redis protocol
    # Format: rediss://host:port (credentials from env vars)
    uri = os.getenv("FALKORDB_URI") or "redis://localhost:6379"
    username = os.getenv("FALKORDB_USER") or os.getenv("FALKORDB_USERNAME", "falkordb")
    password = os.getenv("FALKORDB_PASSWORD", "")
    database = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

    # Parse URI to get host and port
    import urllib.parse

    if uri.startswith("rediss://"):
        parsed = urllib.parse.urlparse(uri.replace("rediss://", "http://"))
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
    elif uri.startswith("redis://"):
        parsed = urllib.parse.urlparse(uri)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        if not username and parsed.username:
            username = parsed.username
        if not password and parsed.password:
            password = parsed.password
    else:
        host = "localhost"
        port = 6379

    return {
        "host": host,
        "port": port,
        "username": username,
        "password": password,
        "database": database
    }


async def initialize_graphiti_with_falkordb() -> Graphiti:
    """Initialize Graphiti with FalkorDB driver"""
    config = get_falkordb_config()

    logger.info(f"🔗 Connecting to FalkorDB at {config['host']}:{config['port']}")
    logger.info(f"   Database: {config['database']}")

    # Create FalkorDB driver - expects uri, user, password format
    uri = os.getenv("FALKORDB_URI")
    driver = FalkorDriver(
        uri=uri,
        user=config['username'],
        password=config['password']
    )

    # Check for custom embedder configuration
    openai_key = os.getenv("OPENAI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    voyage_key = os.getenv("VOYAGE_API_KEY")

    if VOYAGE_AVAILABLE and anthropic_key and voyage_key:
        logger.info("🤖 Using Anthropic LLM + Voyage embeddings")
        llm_client = AnthropicClient(
            config=LLMConfig(
                api_key=anthropic_key,
                model="claude-sonnet-4-5-latest"
            )
        )
        embedder = VoyageEmbedder(
            config=VoyageAIConfig(
                api_key=voyage_key,
                embedding_model="voyage-3"
            )
        )
        graphiti = Graphiti(
            graph_driver=driver,
            llm_client=llm_client,
            embedder=embedder
        )
    else:
        if openai_key:
            logger.info("🤖 Using OpenAI embeddings")
        else:
            logger.warning("⚠️  No OPENAI_API_KEY set - embeddings may fail")
        graphiti = Graphiti(graph_driver=driver)

    try:
        await graphiti.build_indices_and_constraints()
        logger.info("✅ Graphiti + FalkorDB initialized successfully")
    except Exception as e:
        logger.warning(f"⚠️  Index creation note: {e}")

    return graphiti


async def add_sample_episodes(graphiti: Graphiti) -> List[str]:
    """Add sample RFP episodes to the knowledge graph"""
    logger.info("📝 Adding sample RFP episodes...")

    episodes = [
        {
            "name": "Manchester United Digital Transformation RFP",
            "episode_body": """
            Manchester United Football Club has issued a Request for Proposal (RFP)
            for a comprehensive digital transformation project. The RFP seeks solutions
            for: fan engagement platform, mobile app modernization, and data analytics
            infrastructure. Estimated value: £2.5 million. Category: Technology/Digital.
            Contact: digital.projects@manutd.co.uk. Deadline: March 2025.
            """,
            "source": EpisodeType.text,
            "source_description": "LinkedIn RFP Detection",
            "reference_time": datetime.now(timezone.utc),
            "group_id": "rfp_tracking"
        },
        {
            "name": "Liverpool FC Stadium Expansion",
            "episode_body": """
            Liverpool FC issued an RFP for Anfield stadium expansion services.
            The project includes architectural design, construction management, and
            vendor coordination for expanding the Anfield Road stand capacity.
            Estimated value: £80 million. Category: Infrastructure/Construction.
            Published: December 2024.
            """,
            "source": EpisodeType.text,
            "source_description": "Perplexity Market Intelligence",
            "reference_time": datetime.now(timezone.utc),
            "group_id": "rfp_tracking"
        },
        {
            "name": "Premier League AI Analytics Partnership",
            "episode_body": """
            The Premier League has announced a partnership opportunity for AI-powered
            match analytics and real-time player tracking systems. The RFP covers
            computer vision infrastructure, ML model development, and broadcast
            integration services. Estimated value: £15 million over 3 years.
            Category: Sports Technology/AI.
            """,
            "source": EpisodeType.text,
            "source_description": "BrightData Web Monitoring",
            "reference_time": datetime.now(timezone.utc),
            "group_id": "rfp_tracking"
        },
        {
            "name": "Arsenal CRM System Upgrade",
            "episode_body": """
            Arsenal FC is seeking proposals for a complete CRM system upgrade to
            enhance ticket holder management and fan loyalty programs. The scope
            includes data migration, API integration with existing ticketing systems,
            and mobile app integration. Estimated value: £1.2 million.
            Category: Technology/CRM.
            """,
            "source": EpisodeType.text,
            "source_description": "LinkedIn RFP Detection",
            "reference_time": datetime.now(timezone.utc),
            "group_id": "rfp_tracking"
        },
        {
            "name": "Chelsea FC Content Management RFP",
            "episode_body": """
            Chelsea Football Club seeks a modern content management system for
            their digital platforms including web, mobile app, and streaming services.
            Requirements include multi-language support, video hosting, and
            real-time match updates. Estimated value: £3.5 million.
            Category: Technology/Content.
            """,
            "source": EpisodeType.text,
            "source_description": "Direct RFP Detection",
            "reference_time": datetime.now(timezone.utc),
            "group_id": "rfp_tracking"
        }
    ]

    episode_uuids = []
    for i, episode in enumerate(episodes, 1):
        try:
            result = await graphiti.add_episode(**episode)
            episode_uuids.append(result.uuid)
            logger.info(f"   [{i}/{len(episodes)}] Added: {episode['name']}")
            logger.info(f"      Entities: {len(result.nodes)} | Relationships: {len(result.edges)}")
        except Exception as e:
            logger.error(f"   ❌ Failed to add episode: {e}")

    logger.info(f"✅ Added {len(episode_uuids)} episodes to FalkorDB knowledge graph")
    return episode_uuids


async def perform_rag_search(
    graphiti: Graphiti,
    query: str,
    num_results: int = 5,
    center_node_uuid: Optional[str] = None
) -> List[Any]:
    """Perform RAG search across the FalkorDB knowledge graph"""
    logger.info(f"🔍 Searching for: '{query}'")

    try:
        results = await graphiti.search(
            query=query,
            num_results=num_results,
            center_node_uuid=center_node_uuid
        )

        logger.info(f"✅ Found {len(results)} relevant results")
        return results

    except Exception as e:
        logger.error(f"❌ Search failed: {e}")
        return []


def format_search_results(results: List[Any]) -> str:
    """Format search results for display"""
    if not results:
        return "No results found."

    output = []
    for i, edge in enumerate(results, 1):
        output.append(f"\n{'='*80}")
        output.append(f"Result {i}:")
        output.append(f"  Fact: {edge.fact}")

        if hasattr(edge, 'valid_at') and edge.valid_at:
            output.append(f"  Valid From: {edge.valid_at}")

        if hasattr(edge, 'invalid_at') and edge.invalid_at:
            output.append(f"  Valid Until: {edge.invalid_at}")

        if hasattr(edge, 'episodes') and edge.episodes:
            output.append(f"  Episodes: {len(edge.episodes)} mention(s)")

        if hasattr(edge, 'uuid'):
            output.append(f"  UUID: {edge.uuid}")

    return "\n".join(output)


async def test_falkordb_connection():
    """Test basic FalkorDB connection"""
    config = get_falkordb_config()

    logger.info("=" * 80)
    logger.info("FALKORDB CONNECTION TEST")
    logger.info("=" * 80)

    try:
        from falkordb import FalkorDB

        logger.info(f"🔗 Connecting to FalkorDB at {config['host']}:{config['port']}")

        db = FalkorDB(
            host=config['host'],
            port=config['port'],
            username=config['username'],
            password=config['password']
        )

        logger.info("✅ FalkorDB connection successful")

        # Test graph operations
        g = db.select_graph(config['database'])
        result = g.query("RETURN 1 AS test")
        logger.info(f"✅ Graph query test successful: {config['database']}")

        return True
    except Exception as e:
        logger.error(f"❌ FalkorDB connection failed: {e}")
        return False


async def test_full_workflow():
    """Test the complete GraphRAG workflow with FalkorDB"""
    logger.info("=" * 80)
    logger.info("GRAPHRAG FULL WORKFLOW TEST (FALKORDB)")
    logger.info("=" * 80)

    graphiti = None
    try:
        # Test FalkorDB connection first
        if not await test_falkordb_connection():
            logger.error("❌ FalkorDB connection failed - aborting test")
            return

        # Initialize Graphiti with FalkorDB
        graphiti = await initialize_graphiti_with_falkordb()

        # Add sample data
        await add_sample_episodes(graphiti)

        # Wait for embeddings to be processed
        logger.info("⏳ Waiting for embeddings to process...")
        await asyncio.sleep(3)

        # Perform various searches
        test_queries = [
            "What RFPs have been issued by football clubs?",
            "Which clubs are looking for digital transformation?",
            "What is the estimated value of technology projects?",
            "Tell me about stadium infrastructure projects",
            "What AI and analytics opportunities exist?"
        ]

        logger.info("\n" + "=" * 80)
        logger.info("RAG SEARCH TESTS")
        logger.info("=" * 80)

        for query in test_queries:
            logger.info(f"\n🔍 Query: {query}")
            results = await perform_rag_search(graphiti, query, num_results=3)
            print(format_search_results(results))

        logger.info("\n" + "=" * 80)
        logger.info("✅ Full workflow test completed successfully!")
        logger.info("=" * 80)

    except Exception as e:
        logger.error(f"❌ Workflow test failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if graphiti:
            await graphiti.close()
            logger.info("🔌 Connection closed")


async def search_only(query: str, num_results: int = 5):
    """Perform only the search operation"""
    graphiti = None
    try:
        graphiti = await initialize_graphiti_with_falkordb()
        results = await perform_rag_search(graphiti, query, num_results)
        print(format_search_results(results))
    finally:
        if graphiti:
            await graphiti.close()


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='FalkorDB + Graphiti + GraphRAG Test Script'
    )
    parser.add_argument(
        '--search', '-s',
        help='Perform a RAG search query'
    )
    parser.add_argument(
        '--num-results', '-n',
        type=int,
        default=5,
        help='Number of results to return (default: 5)'
    )
    parser.add_argument(
        '--full-test', '-f',
        action='store_true',
        help='Run full workflow test (add episodes + search)'
    )
    parser.add_argument(
        '--test-connection', '-c',
        action='store_true',
        help='Test FalkorDB connection only'
    )

    args = parser.parse_args()

    if args.test_connection:
        await test_falkordb_connection()
    elif args.search:
        await search_only(args.search, args.num_results)
    elif args.full_test:
        await test_full_workflow()
    else:
        # Default: run full test
        await test_full_workflow()


if __name__ == '__main__':
    asyncio.run(main())
