#!/usr/bin/env python3
"""
FalkorDB Cloud MCP Server
Custom MCP server that wraps FalkorDB Cloud (Redis protocol) for GraphRAG operations

This server provides MCP tools for:
- Adding RFP episodes to the knowledge graph
- Searching for entities and relationships
- Retrieving entity history and timelines

Usage:
    python backend/falkordb_mcp_server.py
"""

import os
import sys
import json
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Load environment
project_root = Path(__file__).parent.parent
for env_file in [project_root / '.env', Path('.env')]:
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)
        break

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import FalkorDB
try:
    from falkordb import FalkorDB
    FALKORDB_AVAILABLE = True
except ImportError:
    FALKORDB_AVAILABLE = False
    logger.error("❌ falkordb not available")

# OpenAI for embeddings
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = os.getenv("OPENAI_API_KEY") is not None
except ImportError:
    OPENAI_AVAILABLE = False


# =============================================================================
# Database Connection
# =============================================================================

def get_falkordb_client() -> Optional[FalkorDB]:
    """Get FalkorDB Cloud client"""
    if not FALKORDB_AVAILABLE:
        return None

    uri = os.getenv("FALKORDB_URI")
    username = os.getenv("FALKORDB_USER", "falkordb")
    password = os.getenv("FALKORDB_PASSWORD")
    database = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

    if not uri:
        return None

    # Parse host and port from URI
    import urllib.parse
    parsed = urllib.parse.urlparse(uri.replace("rediss://", "http://"))
    host = parsed.hostname or "localhost"
    port = parsed.port or 6379

    try:
        db = FalkorDB(host=host, port=port, username=username, password=password)
        # Test connection
        g = db.select_graph(database)
        g.query("RETURN 1 AS test")
        logger.info(f"✅ Connected to FalkorDB: {host}:{port}")
        return db
    except Exception as e:
        logger.error(f"❌ Failed to connect to FalkorDB: {e}")
        return None


def get_openai_client():
    """Get OpenAI client for embeddings"""
    if not OPENAI_AVAILABLE:
        return None

    try:
        return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    except Exception as e:
        logger.error(f"❌ Failed to create OpenAI client: {e}")
        return None


# =============================================================================
# Embeddings
# =============================================================================

async def get_embedding(text: str) -> Optional[List[float]]:
    """Get OpenAI embedding for text"""
    client = get_openai_client()
    if not client:
        return None

    try:
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"❌ Embedding failed: {e}")
        return None


# =============================================================================
# MCP Server
# =============================================================================

class FalkorDBMCPServer:
    """MCP Server for FalkorDB Cloud"""

    def __init__(self):
        self.db = get_falkordb_client()
        self.graph_name = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

    # -------------------------------------------------------------------------
    # Tools
    # -------------------------------------------------------------------------

    async def add_episode(self, name: str, episode_body: str, source: str = "text",
                       source_description: str = "", group_id: str = "default") -> Dict[str, Any]:
        """Add an episode to the knowledge graph"""
        if not self.db:
            return {"error": "Database not connected"}

        try:
            g = self.db.select_graph(self.graph_name)
            timestamp = int(datetime.now(timezone.utc).timestamp())

            # Create episode node and link to entities
            # Simple pattern: extract entity names (capitalized words)
            import re
            entities = list(set(re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*', episode_body)))

            # Create the episode
            escaped_body = episode_body.replace("'", "\\'")
            g.query(f"""
                CREATE (e:Episode {{
                    name: '{name}',
                    content: '{escaped_body}',
                    source: '{source}',
                    source_description: '{source_description}',
                    group_id: '{group_id}',
                    created_at: {timestamp}
                }})
                RETURN e
            """)

            # Link to mentioned entities
            for entity_name in entities[:5]:  # Limit to prevent overwhelming
                escaped_entity = entity_name.replace("'", "\\'")
                g.query(f"""
                    MERGE (ent:Entity {{name: '{escaped_entity}', last_seen: {timestamp}}})
                    MERGE (e:Episode)-[:MENTIONS]->(ent)
                """)

            return {
                "message": f"Episode '{name}' added successfully",
                "episode_name": name,
                "entities_found": entities,
                "timestamp": timestamp
            }

        except Exception as e:
            logger.error(f"❌ add_episode failed: {e}")
            return {"error": str(e)}

    async def search_nodes(self, query: str, max_nodes: int = 10,
                         entity_type: Optional[str] = None) -> Dict[str, Any]:
        """Search for entities using semantic search"""
        if not self.db:
            return {"error": "Database not connected"}

        # Get embedding for query
        embedding = await get_embedding(query)
        if not embedding:
            # Fallback to keyword search
            return await self._keyword_search(query, max_nodes, entity_type)

        # For now, use keyword search with enhanced matching
        return await self._keyword_search(query, max_nodes, entity_type)

    async def _keyword_search(self, query: str, max_nodes: int, entity_type: Optional[str]) -> Dict[str, Any]:
        """Fallback keyword search in entities"""
        try:
            g = self.db.select_graph(self.graph_name)

            # Build Cypher query with keyword matching
            keywords = query.lower().split()
            keyword_clauses = [f"toLower(n.name) CONTAINS '{kw}'" for kw in keywords if len(kw) > 2]

            if not keyword_clauses:
                keyword_clauses = ["true"]

            keyword_filter = " OR ".join(keyword_clauses[:3])

            entity_filter = f"AND n:{entity_type}" if entity_type else ""

            cypher = f"""
                MATCH (n:Entity)
                WHERE {keyword_filter} {entity_filter}
                RETURN n.name,
                       n.description,
                       labels(n)[0] as type,
                       n.last_seen as last_seen
                LIMIT {max_nodes}
            """

            result = g.query(cypher)

            nodes = []
            for row in result.result_set:
                nodes.append({
                    "name": row[0],
                    "description": row[1] if len(row) > 1 else "",
                    "type": row[2],
                    "last_seen": row[3]
                })

            return {
                "message": f"Found {len(nodes)} entities",
                "nodes": nodes,
                "query": query
            }

        except Exception as e:
            logger.error(f"❌ search_nodes failed: {e}")
            return {"error": str(e)}

    async def get_rfps(self, club: Optional[str] = None, category: Optional[str] = None,
                     limit: int = 10) -> Dict[str, Any]:
        """Get RFPs from the knowledge graph"""
        if not self.db:
            return {"error": "Database not connected"}

        try:
            g = self.db.select_graph(self.graph_name)

            # Build query
            conditions = []
            if club:
                conditions.append(f"c.name CONTAINS '{club}'")
            if category:
                conditions.append(f"rfp.category = '{category}'")

            where_clause = " AND ".join(conditions) if conditions else "true"

            cypher = f"""
                MATCH (c:Club)-[r:HAS_RFP]->(rfp:RFP)
                WHERE {where_clause}
                RETURN c.name as club,
                       rfp.description as description,
                       rfp.category as category,
                       rfp.created_at as created_at,
                       rfp.estimated_value as value
                ORDER BY rfp.created_at DESC
                LIMIT {limit}
            """

            result = g.query(cypher)

            rfps = []
            for row in result.result_set:
                rfps.append({
                    "club": row[0],
                    "description": row[1],
                    "category": row[2],
                    "created_at": row[3],
                    "value": row[4]
                })

            return {
                "message": f"Found {len(rfps)} RFPs",
                "rfps": rfps
            }

        except Exception as e:
            logger.error(f"❌ get_rfps failed: {e}")
            return {"error": str(e)}

    async def get_entity_timeline(self, entity_name: str, limit: int = 20) -> Dict[str, Any]:
        """Get timeline for an entity"""
        if not self.db:
            return {"error": "Database not connected"}

        try:
            g = self.db.select_graph(self.graph_name)

            cypher = f"""
                MATCH (e:Entity {{name: '{entity_name}'}})-[r:HAS_EPISODE]->(ep:Episode)
                RETURN ep.name,
                       ep.content,
                       ep.source,
                       ep.created_at
                ORDER BY ep.created_at DESC
                LIMIT {limit}
            """

            result = g.query(cypher)

            events = []
            for row in result.result_set:
                events.append({
                    "name": row[0],
                    "content": row[1],
                    "source": row[2],
                    "created_at": row[3]
                })

            return {
                "entity": entity_name,
                "events": events,
                "count": len(events)
            }

        except Exception as e:
            logger.error(f"❌ get_entity_timeline failed: {e}")
            return {"error": str(e)}

    async def add_rfp(self, organization: str, title: str, description: str,
                     category: str, estimated_value: Optional[float] = None,
                     source: str = "unknown") -> Dict[str, Any]:
        """Add an RFP to the knowledge graph"""
        if not self.db:
            return {"error": "Database not connected"}

        try:
            g = self.db.select_graph(self.graph_name)
            timestamp = int(datetime.now(timezone.utc).timestamp())

            # Create club if not exists
            g.query(f"""
                MERGE (c:Club {{name: '{organization}', created_at: {timestamp}}})
            """)

            # Create RFP
            value_clause = f", estimated_value: {estimated_value}" if estimated_value else ""
            g.query(f"""
                MERGE (rfp:RFP {{
                    title: '{title}',
                    description: '{description}',
                    category: '{category}',
                    source: '{source}',
                    created_at: {timestamp}
                    {value_clause}
                }})
                MERGE (c)-[:HAS_RFP]->(rfp)
                RETURN c.name, rfp.title
            """)

            return {
                "message": f"RFP '{title}' added for {organization}",
                "organization": organization,
                "title": title,
                "category": category
            }

        except Exception as e:
            logger.error(f"❌ add_rfp failed: {e}")
            return {"error": str(e)}


# =============================================================================
# HTTP Server (for testing)
# =============================================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="FalkorDB MCP Server")

server = FalkorDBMCPServer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/episode")
async def api_add_episode(request: Dict[str, Any]) -> Dict[str, Any]:
    """Add an episode"""
    return await server.add_episode(
        name=request.get("name"),
        episode_body=request.get("episode_body"),
        source=request.get("source", "text"),
        source_description=request.get("source_description", ""),
        group_id=request.get("group_id", "default")
    )


@app.post("/search")
async def api_search(request: Dict[str, Any]) -> Dict[str, Any]:
    """Search entities"""
    return await server.search_nodes(
        query=request.get("query", ""),
        max_nodes=request.get("max_nodes", 10),
        entity_type=request.get("entity_type")
    )


@app.get("/rfps")
async def api_get_rfps(
    club: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 10
) -> Dict[str, Any]:
    """Get RFPs"""
    return await server.get_rfps(club=club, category=category, limit=limit)


@app.get("/entity/{entity_name}/timeline")
async def api_get_timeline(entity_name: str, limit: int = 20) -> Dict[str, Any]:
    """Get entity timeline"""
    return await server.get_entity_timeline(entity_name=entity_name, limit=limit)


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check"""
    return {
        "status": "healthy",
        "database": "connected" if server.db else "disconnected",
        "openai": "available" if OPENAI_AVAILABLE else "unavailable",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


def run_server():
    """Run the HTTP server"""
    port = int(os.getenv("PORT", "8001"))
    logger.info(f"🚀 Starting FalkorDB MCP Server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    run_server()
