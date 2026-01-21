#!/usr/bin/env python3
"""
FalkorDB MCP Server using FastMCP
A proper Model Context Protocol server for FalkorDB Cloud with stdio transport.

Usage:
    python backend/falkordb_mcp_server_fastmcp.py

Add to mcp-config.json:
    {
      "command": "python",
      "args": ["backend/falkordb_mcp_server_fastmcp.py"],
      "env": {
        "FALKORDB_URI": "${FALKORDB_URI}",
        "FALKORDB_USER": "${FALKORDB_USER}",
        "FALKORDB_PASSWORD": "${FALKORDB_PASSWORD}",
        "FALKORDB_DATABASE": "${FALKORDB_DATABASE}"
      }
    }
"""

import os
import sys
import logging
import re
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any

# Load environment
project_root = Path(__file__).parent.parent
for env_file in [project_root / '.env', Path('.env')]:
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)
        break

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# Import FalkorDB native client
try:
    from falkordb import FalkorDB
    FALKORDB_AVAILABLE = True
except ImportError:
    FALKORDB_AVAILABLE = False
    print("ERROR: falkordb not installed. Run: pip install falkordb", file=sys.stderr)
    sys.exit(1)

# Import FastMCP
try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("ERROR: mcp python-sdk not installed. Run: pip install mcp", file=sys.stderr)
    sys.exit(1)


# =============================================================================
# Database Connection
# =============================================================================

def get_falkordb_client():
    """Get FalkorDB Cloud client using native library"""
    uri = os.getenv("FALKORDB_URI")
    username = os.getenv("FALKORDB_USER", "falkordb")
    password = os.getenv("FALKORDB_PASSWORD")
    database = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

    if not uri:
        raise ValueError("FALKORDB_URI environment variable not set")

    # Parse host and port from URI
    parsed = urllib.parse.urlparse(uri.replace("rediss://", "http://"))
    host = parsed.hostname or "localhost"
    port = parsed.port or 6379

    try:
        db = FalkorDB(host=host, port=port, username=username, password=password)
        # Test connection
        g = db.select_graph(database)
        g.query("RETURN 1 AS test")
        return db, database
    except Exception as e:
        raise ConnectionError(f"Failed to connect to FalkorDB: {e}")


# =============================================================================
# MCP Server Initialization
# =============================================================================

mcp = FastMCP(
    name="FalkorDB GraphRAG",
    instructions=(
        "A Model Context Protocol server for FalkorDB Cloud knowledge graph. "
        "Provides tools for managing RFP episodes, searching entities, and querying sports intelligence data."
    )
)

# Global database connection (created on first use)
_db = None
_graph_name = None


def get_graph():
    """Get or create database connection and graph"""
    global _db, _graph_name
    if _db is None:
        _db, _graph_name = get_falkordb_client()
    return _db.select_graph(_graph_name)


# =============================================================================
# MCP Tools
# =============================================================================

@mcp.tool()
def add_rfp_episode(
    name: str,
    description: str,
    organization: str,
    rfp_type: str = "Business Opportunity",
    sport: Optional[str] = None,
    value: Optional[str] = None,
    priority: str = "MEDIUM",
    timeline: Optional[str] = None,
    source: str = "manual",
    contact_email: Optional[str] = None,
    source_url: Optional[str] = None,
    requirements: Optional[str] = None
) -> str:
    """
    Add an RFP episode to the knowledge graph (matches real schema).

    Args:
        name: Title/name of the RFP
        description: Full description of the RFP
        organization: Name of the organization issuing the RFP
        rfp_type: Type of RFP (e.g., Digital Platform, Analytics Platform, Mobile Platform)
        sport: Sport category (e.g., Tennis, Golf, Cricket)
        value: Estimated monetary value (e.g., "£800K-£1.5M")
        priority: Priority level (CRITICAL, HIGH, MEDIUM, LOW)
        timeline: Project timeline (e.g., "Q1-Q4 2026")
        source: Source of the RFP information
        contact_email: Contact email for inquiries
        source_url: URL where RFP was found
        requirements: Specific requirements for the RFP

    Returns:
        Confirmation message with episode details
    """
    try:
        g = get_graph()
        timestamp = int(datetime.now(timezone.utc).timestamp())
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Escape single quotes in Cypher strings
        esc = lambda s: s.replace("'", "\\'") if s else ""
        esc_opt = lambda s: s.replace("'", "\\'") if s else ""

        # Build properties list
        props = [
            f"name: '{esc(name)}'",
            f"description: '{esc(description)}'",
            f"organization: '{esc(organization)}'",
            f"type: '{esc(rfp_type)}'",
            f"source: '{esc(source)}'",
            f"priority: '{esc(priority)}'",
            f"createdDate: '{today}'",
            f"lastUpdated: '{today}'",
            f"yellowPantherPriority: 99",
            f"yellowPantherFit: 'MONITOR'",
            f"migration_status: 'completed'",
        ]

        if sport:
            props.append(f"sport: '{esc(sport)}'")
        if value:
            props.append(f"value: '{esc(value)}'")
        if timeline:
            props.append(f"timeline: '{esc(timeline)}'")
        if contact_email:
            props.append(f"contactEmail: '{esc(contact_email)}'")
        if source_url:
            props.append(f"sourceUrl: '{esc(source_url)}'")
        if requirements:
            props.append(f"requirements: '{esc(requirements)}'")

        # Create RFP node (standalone, matching real schema)
        g.query(f"""
            MERGE (rfp:RFP {{
                {', '.join(props)}
            }})
        """)

        return f"✅ RFP episode '{name}' added for {organization}"

    except Exception as e:
        return f"❌ Error adding RFP episode: {e}"


@mcp.tool()
def search_rfps(
    query: str,
    sport: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 10
) -> str:
    """
    Search for RFPs in the knowledge graph.

    Args:
        query: Search query (keywords, phrases)
        sport: Filter by sport (e.g., Tennis, Golf, Cricket)
        category: Filter by RFP type/category
        limit: Maximum number of results (default: 10)

    Returns:
        List of matching RFPs with details
    """
    try:
        g = get_graph()

        # Build WHERE conditions for standalone RFP nodes
        conditions = []

        if sport:
            esc_sport = sport.replace("'", "\\'")
            conditions.append(f"rfp.sport = '{esc_sport}'")

        if category:
            esc_cat = category.replace("'", "\\'")
            conditions.append(f"rfp.type CONTAINS '{esc_cat}'")

        # Add keyword search from query - search in name, description, organization
        if query and len(query) > 2:
            keywords = query.lower().split()
            keyword_conditions = []
            for kw in keywords[:3] if len(query) > 2 else []:
                if len(kw) > 2:
                    keyword_conditions.append(f"toLower(rfp.name) CONTAINS '{kw}'")
                    keyword_conditions.append(f"toLower(rfp.description) CONTAINS '{kw}'")
                    keyword_conditions.append(f"toLower(rfp.organization) CONTAINS '{kw}'")
            if keyword_conditions:
                conditions.append(f"({' OR '.join(keyword_conditions[:5])})")

        where_clause = " AND ".join(conditions) if conditions else "true"

        cypher = f"""
            MATCH (rfp:RFP)
            WHERE {where_clause}
            RETURN rfp.name as name,
                   rfp.description as description,
                   rfp.organization as organization,
                   rfp.sport as sport,
                   rfp.type as type,
                   rfp.value as value,
                   rfp.source as source,
                   rfp.priority as priority,
                   rfp.timeline as timeline
            ORDER BY rfp.yellowPantherPriority DESC
            LIMIT {limit}
        """

        result = g.query(cypher)

        if not result.result_set:
            return f"No RFPs found matching query: '{query}'"

        output = [f"📊 Found {len(result.result_set)} RFP(s):\n"]

        for row in result.result_set:
            name = row[0] or "Unnamed RFP"
            description = row[1] or ""
            organization = row[2] or "Unknown"
            sport_val = row[3] or "N/A"
            rfp_type = row[4] or "N/A"
            value = row[5] or "Not specified"
            source = row[6] or "Unknown"
            priority = row[7] or "N/A"
            timeline = row[8] or "N/A"

            output.append(f"\n🔹 {name}")
            output.append(f"   Organization: {organization}")
            output.append(f"   Sport: {sport_val} | Type: {rfp_type}")
            if description:
                preview = description[:80] + "..." if len(description) > 80 else description
                output.append(f"   Description: {preview}")
            if value and value != "Not specified":
                output.append(f"   Value: {value}")
            if timeline and timeline != "N/A":
                output.append(f"   Timeline: {timeline}")
            if priority and priority != "N/A":
                output.append(f"   Priority: {priority}")

        return "\n".join(output)

    except Exception as e:
        return f"❌ Error searching RFPs: {e}"


@mcp.tool()
def get_entity_timeline(
    entity_name: str,
    limit: int = 20
) -> str:
    """
    Get the timeline of events for a specific entity (organization, club, etc.).

    Args:
        entity_name: Name of the entity (organization, club, etc.)
        limit: Maximum number of events to return

    Returns:
        Timeline of RFPs and events for the entity
    """
    try:
        g = get_graph()
        esc_entity = entity_name.replace("'", "\\'")

        # Query RFPs by organization name (standalone RFP nodes)
        cypher = f"""
            MATCH (rfp:RFP)
            WHERE rfp.organization CONTAINS '{esc_entity}'
            RETURN rfp.name as name,
                   rfp.description as description,
                   rfp.type as type,
                   rfp.sport as sport,
                   rfp.value as value,
                   rfp.priority as priority,
                   rfp.timeline as timeline,
                   rfp.createdDate as created_date,
                   rfp.yellowPantherPriority as yp_priority
            ORDER BY yp_priority DESC, rfp.createdDate DESC
            LIMIT {limit}
        """

        result = g.query(cypher)

        if not result.result_set:
            return f"No timeline found for entity: '{entity_name}'"

        output = [f"📅 Timeline for {entity_name}:\n"]

        for row in result.result_set:
            name = row[0] or "Unnamed RFP"
            description = row[1] or ""
            rfp_type = row[2] or "RFP"
            sport = row[3] or ""
            value = row[4] or ""
            priority = row[5] or ""
            timeline = row[6] or ""
            created_date = row[7]

            # Format date
            if created_date:
                date_str = created_date
            else:
                date_str = "Unknown"

            output.append(f"\n📍 {date_str} - {rfp_type}")
            output.append(f"   {name}")
            if sport:
                output.append(f"   Sport: {sport}")
            if value:
                output.append(f"   Value: {value}")
            if priority:
                output.append(f"   Priority: {priority}")
            if timeline:
                output.append(f"   Timeline: {timeline}")
            if description:
                preview = description[:100] + "..." if len(description) > 100 else description
                output.append(f"   {preview}")

        return "\n".join(output)

    except Exception as e:
        return f"❌ Error getting timeline: {e}"


@mcp.tool()
def query_graph(
    cypher: str
) -> str:
    """
    Execute a raw Cypher query against the FalkorDB knowledge graph.

    Args:
        cypher: Valid Cypher query string

    Returns:
        Query results in formatted text
    """
    try:
        g = get_graph()
        result = g.query(cypher)

        if not result.result_set:
            return "Query returned no results."

        output = [f"📊 Query Results ({len(result.result_set)} rows):\n"]

        # Get column names if available
        if hasattr(result, 'keys') and result.keys:
            headers = result.keys()
            output.append("   " + " | ".join(headers))
            output.append("   " + "-+-".join(["-" * len(h) for h in headers]))

        for row in result.result_set:
            row_str = " | ".join(str(val) if val is not None else "NULL" for val in row)
            output.append(f"   {row_str}")

        return "\n".join(output)

    except Exception as e:
        return f"❌ Query error: {e}"


@mcp.tool()
def list_graphs() -> str:
    """
    List all available graphs in the FalkorDB database.

    Returns:
        List of graph names
    """
    try:
        db, _ = get_falkordb_client()

        # FalkorDB doesn't have a direct list graphs command
        # Return the configured database
        graph_name = os.getenv("FALKORDB_DATABASE", "sports_intelligence")
        return f"📊 Available Graph: {graph_name}"

    except Exception as e:
        return f"❌ Error listing graphs: {e}"


@mcp.tool()
def add_entity_relationship(
    from_entity: str,
    to_entity: str,
    relationship_type: str,
    properties: Optional[str] = None
) -> str:
    """
    Add or update a relationship between two entities.

    Args:
        from_entity: Name of the source entity
        to_entity: Name of the target entity
        relationship_type: Type of relationship (e.g., PARTNER_OF, COMPETES_WITH)
        properties: Optional JSON string of properties

    Returns:
        Confirmation message
    """
    try:
        g = get_graph()
        timestamp = int(datetime.now(timezone.utc).timestamp())

        esc = lambda s: s.replace("'", "\\'") if s else ""

        # Create nodes and relationship
        g.query(f"""
            MERGE (a:Entity {{name: '{esc(from_entity)}', updated_at: {timestamp}}})
            MERGE (b:Entity {{name: '{esc(to_entity)}', updated_at: {timestamp}}})
            MERGE (a)-[r:{esc(relationship_type).upper().replace(' ', '_')}]->(b)
        """)

        return f"✅ Relationship added: {from_entity} -[{relationship_type}]-> {to_entity}"

    except Exception as e:
        return f"❌ Error adding relationship: {e}"


@mcp.tool()
def get_graph_stats() -> str:
    """
    Get statistics about the knowledge graph.

    Returns:
        Summary of nodes, relationships, and data distribution
    """
    try:
        g = get_graph()

        # Count nodes by type
        stats = []

        node_counts = g.query("""
            MATCH (n)
            RETURN labels(n)[0] as type, count(n) as count
            ORDER BY count DESC
        """)

        total_nodes = 0
        for row in node_counts.result_set:
            node_type = row[0] or "Unknown"
            count = row[1]
            total_nodes += count
            stats.append(f"   {node_type}: {count}")

        # Count relationships by type
        rel_counts = g.query("""
            MATCH ()-[r]->()
            RETURN type(r) as type, count(r) as count
            ORDER BY count DESC
        """)

        rel_stats = []
        total_rels = 0
        for row in rel_counts.result_set:
            rel_type = row[0] or "Unknown"
            count = row[1]
            total_rels += count
            rel_stats.append(f"   {rel_type}: {count}")

        output = [
            "📊 FalkorDB Knowledge Graph Statistics",
            f"\n📍 Nodes (total: {total_nodes}):"
        ]
        output.extend(stats)
        output.append(f"\n🔗 Relationships (total: {total_rels}):")
        output.extend(rel_stats)

        return "\n".join(output)

    except Exception as e:
        return f"❌ Error getting stats: {e}"


@mcp.tool()
def search_entities(
    query: str,
    entity_type: Optional[str] = None,
    limit: int = 10
) -> str:
    """
    Search for entities in the knowledge graph using keyword matching.

    Args:
        query: Search query for entity names
        entity_type: Optional filter by entity type (RFP, Entity, SportsClub, Person, etc.)
        limit: Maximum results to return

    Returns:
        List of matching entities with details
    """
    try:
        g = get_graph()

        # Build keyword search - search in name, organization, description
        keywords = query.lower().split()
        keyword_clauses = []
        for kw in keywords[:4] if len(query) > 2 else []:
            if len(kw) > 2:
                keyword_clauses.append(f"toLower(n.name) CONTAINS '{kw}'")
                keyword_clauses.append(f"toLower(n.organization) CONTAINS '{kw}'")
                keyword_clauses.append(f"toLower(n.description) CONTAINS '{kw}'")

        if not keyword_clauses:
            keyword_clauses = ["true"]

        keyword_filter = " OR ".join(keyword_clauses[:6])
        type_filter = f"AND n:{entity_type}" if entity_type else ""

        cypher = f"""
            MATCH (n)
            WHERE {keyword_filter} {type_filter}
            RETURN labels(n)[0] as type,
                   n.name as name,
                   n.description as description,
                   n.organization as organization,
                   n.sport as sport,
                   n.type as rfp_type
            ORDER BY n.yellowPantherPriority DESC
            LIMIT {limit}
        """

        result = g.query(cypher)

        if not result.result_set:
            return f"No entities found matching: '{query}'"

        output = [f"🔍 Found {len(result.result_set)} entity(ies):\n"]

        for row in result.result_set:
            ent_type = row[0] or "Unknown"
            name = row[1] or "Unnamed"
            description = row[2] or ""
            organization = row[3] or ""
            sport = row[4] or ""
            rfp_type = row[5] or ""

            output.append(f"\n📍 [{ent_type}] {name}")

            if sport:
                output.append(f"   Sport: {sport}")
            if organization:
                output.append(f"   Organization: {organization}")
            if rfp_type:
                output.append(f"   Type: {rfp_type}")
            if description:
                preview = description[:80] + "..." if len(description) > 80 else description
                output.append(f"   {preview}")

        return "\n".join(output)

    except Exception as e:
        return f"❌ Error searching entities: {e}"


# =============================================================================
# Server Entry Point
# =============================================================================

if __name__ == "__main__":
    # Test connection on startup
    try:
        get_graph()
    except Exception as e:
        print(f"ERROR: Failed to connect to FalkorDB: {e}", file=sys.stderr)
        sys.exit(1)

    # Run the MCP server with stdio transport
    mcp.run()
