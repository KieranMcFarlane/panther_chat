#!/usr/bin/env python3
"""
Temporal Intelligence MCP Server

Exposes temporal intelligence tools via the Model Context Protocol.
This allows all MCP clients (Claude Agent SDK, CopilotKit, etc.) to access
temporal analysis capabilities.

Tools:
- get_entity_timeline: Get temporal history for an entity
- analyze_temporal_fit: Analyze RFP fit based on temporal patterns
- get_temporal_patterns: Get aggregate patterns across all entities
- create_rfp_episode: Record RFP detection as temporal episode
- record_outcome: Record RFP outcome (closes the feedback loop)

Usage:
    python backend/temporal_mcp_server.py

Environment Variables:
    FASTAPI_URL: URL of the FastAPI backend (default: http://localhost:8000)
    SUPABASE_URL: Supabase project URL
    SUPABASE_ANON_KEY: Supabase anonymous key

Part of: Close the Loop - Temporal Intelligence for RFP Detection
"""

import os
import sys
import logging
import asyncio
import json
from typing import Optional, Any, Dict
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Environment configuration
FASTAPI_URL = os.getenv("FASTAPI_URL", "http://localhost:8000")
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

# =============================================================================
# MCP Server Implementation
# =============================================================================

async def call_temporal_api(
    endpoint: str,
    method: str = "GET",
    data: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Call the FastAPI temporal endpoint

    Args:
        endpoint: API endpoint path
        method: HTTP method
        data: Request body data

    Returns:
        API response
    """
    import httpx

    url = f"{FASTAPI_URL}{endpoint}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if method == "POST":
                response = await client.post(url, json=data)
            else:
                response = await client.get(url)

            response.raise_for_status()
            return response.json()

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e.response.status_code} - {e.response.text}")
        return {
            "error": f"HTTP {e.response.status_code}",
            "message": e.response.text
        }
    except Exception as e:
        logger.error(f"API call error: {e}")
        return {
            "error": "api_call_failed",
            "message": str(e)
        }


# =============================================================================
# Tool Implementations
# =============================================================================

async def get_entity_timeline(
    entity_id: str,
    limit: int = 50
) -> Dict[str, Any]:
    """
    Get temporal history of an entity

    Returns all episodes associated with an entity:
    - RFP detections
    - Partnership changes
    - Executive changes
    - Technology adoptions
    - Outcomes (won/lost)

    Args:
        entity_id: Entity identifier (name or neo4j_id)
        limit: Maximum number of events to return

    Returns:
        Entity timeline with events
    """
    logger.info(f"Getting timeline for entity: {entity_id}")

    result = await call_temporal_api(
        f"/api/temporal/entity/{entity_id}/timeline",
        method="GET"
    )

    return {
        "entity_id": entity_id,
        "events": result.get("events", [])[:limit],
        "event_count": len(result.get("events", [])[:limit]),
        "timestamp": datetime.utcnow().isoformat()
    }


async def analyze_temporal_fit(
    entity_id: str,
    rfp_id: str,
    rfp_category: Optional[str] = None,
    rfp_value: Optional[float] = None,
    time_horizon: int = 90
) -> Dict[str, Any]:
    """
    Analyze RFP fit based on temporal patterns

    Analyzes historical patterns to determine fit:
    - Recent RFP engagement history
    - Category matching
    - Trend analysis
    - Confidence scoring
    - Recommendations

    Args:
        entity_id: Entity to analyze
        rfp_id: RFP identifier
        rfp_category: RFP category for matching
        rfp_value: Estimated RFP value
        time_horizon: Days to look back

    Returns:
        Fit analysis with scores and recommendations
    """
    logger.info(f"Analyzing temporal fit: {entity_id} -> {rfp_id}")

    data = {
        "entity_id": entity_id,
        "rfp_id": rfp_id,
        "time_horizon": time_horizon
    }

    if rfp_category:
        data["rfp_category"] = rfp_category
    if rfp_value:
        data["rfp_value"] = rfp_value

    result = await call_temporal_api(
        "/api/temporal/analyze-fit",
        method="POST",
        data=data
    )

    return result


async def get_temporal_patterns(
    entity_type: Optional[str] = None,
    time_horizon: int = 365
) -> Dict[str, Any]:
    """
    Get aggregate temporal patterns across all entities

    Returns:
    - Episode counts by type
    - Most active entities
    - Overall statistics
    - Trend analysis

    Args:
        entity_type: Filter by entity type (optional)
        time_horizon: Days to look back

    Returns:
        Aggregate patterns data
    """
    logger.info(f"Getting temporal patterns (horizon: {time_horizon} days)")

    params = []
    if entity_type:
        params.append(f"entity_type={entity_type}")
    params.append(f"time_horizon={time_horizon}")

    query_string = "&".join(params) if params else f"time_horizon={time_horizon}"

    result = await call_temporal_api(
        f"/api/temporal/patterns?{query_string}",
        method="GET"
    )

    return result


async def create_rfp_episode(
    rfp_id: str,
    organization: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    source: Optional[str] = None,
    url: Optional[str] = None,
    category: Optional[str] = None,
    confidence_score: Optional[float] = None,
    estimated_value: Optional[float] = None
) -> Dict[str, Any]:
    """
    Record RFP detection as a temporal episode

    Creates a temporal episode in the knowledge graph tracking:
    - When the RFP was detected
    - Which organization it relates to
    - Source, category, confidence, etc.

    Args:
        rfp_id: Unique RFP identifier
        organization: Organization name
        title: RFP title
        description: RFP description
        source: Detection source (LinkedIn, Perplexity, etc.)
        url: RFP URL
        category: RFP category
        confidence_score: Detection confidence (0-1)
        estimated_value: Estimated RFP value

    Returns:
        Created episode data
    """
    logger.info(f"Creating RFP episode: {rfp_id} for {organization}")

    data = {
        "rfp_id": rfp_id,
        "organization": organization,
        "entity_type": "Club"
    }

    if title:
        data["title"] = title
    if description:
        data["description"] = description
    if source:
        data["source"] = source
    if url:
        data["url"] = url
    if category:
        data["category"] = category
    if confidence_score is not None:
        data["confidence_score"] = confidence_score
    if estimated_value is not None:
        data["estimated_value"] = estimated_value

    result = await call_temporal_api(
        "/api/temporal/rfp-episode",
        method="POST",
        data=data
    )

    return result


async def record_outcome(
    rfp_id: str,
    entity_id: str,
    entity_name: str,
    status: str,
    value_actual: Optional[float] = None,
    loss_reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    Record RFP outcome (closes the feedback loop!)

    Updates entity intelligence scores:
    - Won RFPs: +10 to intelligence score
    - Lost RFPs: -5 to intelligence score

    Args:
        rfp_id: RFP identifier
        entity_id: Entity identifier
        entity_name: Entity display name
        status: Outcome status (won, lost, withdrew, etc.)
        value_actual: Actual value (if won)
        loss_reason: Why we lost (if lost)

    Returns:
        Outcome recording result
    """
    logger.info(f"Recording outcome: {rfp_id} = {status}")

    # Import here to avoid circular dependency
    from backend.outcome_service import OutcomeService

    service = OutcomeService()
    result = await service.record_outcome(
        rfp_id=rfp_id,
        entity_id=entity_id,
        entity_name=entity_name,
        status=status,
        value_actual=value_actual
    )

    return result


# =============================================================================
# Phase 2: New Temporal Query Tools
# =============================================================================

async def query_episodes(
    entities: list[str],
    from_time: str,
    to_time: str,
    episode_types: Optional[list[str]] = None,
    max_results: int = 100
) -> Dict[str, Any]:
    """
    Query episodes within time bounds using Graphiti's retrieve_episodes()

    Uses Graphiti's bi-temporal query capabilities to fetch episodes
    that were valid within the specified time window.

    Args:
        entities: List of entity names to query
        from_time: ISO timestamp start of time window (e.g., "2020-01-01T00:00:00Z")
        to_time: ISO timestamp end of time window (e.g., "2020-12-31T23:59:59Z")
        episode_types: Optional filter by episode types (RFP_DETECTED, PARTNERSHIP_FORMED, etc.)
        max_results: Maximum number of episodes to return

    Returns:
        Episodes with entities, relationships, and temporal metadata
    """
    logger.info(f"Querying episodes for {entities} from {from_time} to {to_time}")

    # Import Graphiti service
    from backend.graphiti_service import GraphitiService

    service = GraphitiService()
    try:
        await service.initialize()
        result = await service.query_episodes(
            entities=entities,
            from_time=from_time,
            to_time=to_time,
            episode_types=episode_types,
            limit=max_results
        )
        return result
    finally:
        service.close()


async def get_entity_state_at_time(
    entity_id: str,
    at_time: str
) -> Dict[str, Any]:
    """
    Resolve entity state at specific timestamp

    Collapses all active episodes at the given time into a state snapshot.
    Uses Graphiti's valid_at/valid_before bi-temporal model.

    Args:
        entity_id: Entity identifier (name or neo4j_id)
        at_time: ISO timestamp to resolve state at (e.g., "2020-03-15T10:30:00Z")

    Returns:
        Entity state including relationships, affiliations, and properties
    """
    logger.info(f"Getting state for {entity_id} at {at_time}")

    # Import Graphiti service
    from backend.graphiti_service import GraphitiService

    service = GraphitiService()
    try:
        await service.initialize()
        result = await service.get_entity_state_at_time(entity_id, at_time)
        return result
    finally:
        service.close()


async def compute_entity_diff(
    entity_id: str,
    from_time: str,
    to_time: str
) -> Dict[str, Any]:
    """
    Detect structural changes between time periods

    Compares entity state at two points in time to identify:
    - New relationships formed
    - Old relationships ended
    - Property changes
    - Confidence deltas

    Args:
        entity_id: Entity identifier (name or neo4j_id)
        from_time: Start time ISO timestamp (e.g., "2019-01-01T00:00:00Z")
        to_time: End time ISO timestamp (e.g., "2023-12-31T23:59:59Z")

    Returns:
        Change summary with before/after comparison
    """
    logger.info(f"Computing diff for {entity_id} from {from_time} to {to_time}")

    # Import Graphiti service
    from backend.graphiti_service import GraphitiService

    service = GraphitiService()
    try:
        await service.initialize()
        result = await service.compute_entity_diff(entity_id, from_time, to_time)
        return result
    finally:
        service.close()


async def build_temporal_narrative(
    entities: list[str],
    from_time: str,
    to_time: str,
    episode_types: Optional[list[str]] = None,
    max_tokens: int = 2000
) -> Dict[str, Any]:
    """
    Compress episodes into token-bounded narrative for Claude

    Converts raw episode data into human-readable timeline:
    - Groups by episode type (transfers, RFPs, partnerships)
    - Time-ordered bullet points
    - Truncates at max_tokens
    - Includes confidence scores

    Args:
        entities: List of entity names to query
        from_time: ISO timestamp start of time window
        to_time: ISO timestamp end of time window
        episode_types: Optional filter by episode types
        max_tokens: Maximum tokens in narrative (default: 2000)

    Returns:
        Compressed narrative text with metadata
    """
    logger.info(f"Building narrative for {entities} from {from_time} to {to_time} (max_tokens: {max_tokens})")

    # Import services
    from backend.graphiti_service import GraphitiService
    from backend.narrative_builder import build_narrative_from_episodes

    # Fetch episodes
    service = GraphitiService()
    try:
        await service.initialize()
        episodes_result = await service.query_episodes(
            entities=entities,
            from_time=from_time,
            to_time=to_time,
            episode_types=episode_types,
            limit=500  # Fetch more, will truncate in narrative
        )
    finally:
        service.close()

    # Build narrative
    episodes = episodes_result.get('episodes', [])
    narrative_result = build_narrative_from_episodes(
        episodes=episodes,
        max_tokens=max_tokens,
        group_by_type=True
    )

    # Add query metadata
    narrative_result['query'] = {
        'entities': entities,
        'from_time': from_time,
        'to_time': to_time,
        'episode_types': episode_types
    }

    return narrative_result


# =============================================================================
# MCP Server using stdio protocol
# =============================================================================

async def main():
    """
    Main MCP server loop

    Reads JSON-RPC messages from stdin and writes responses to stdout.
    Implements the Model Context Protocol for tool discovery and execution.
    """
    logger.info("🧠 Temporal Intelligence MCP Server starting...")
    logger.info(f"FastAPI URL: {FASTAPI_URL}")

    # Tool registry
    tools = {
        "get_entity_timeline": {
            "name": "get_entity_timeline",
            "description": "Get temporal history of an entity including RFPs, partnerships, changes, and other events over time",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "entity_id": {
                        "type": "string",
                        "description": "Entity identifier (name or neo4j_id)"
                    },
                    "limit": {
                        "type": "number",
                        "description": "Number of events to return (default: 50)",
                        "default": 50
                    }
                },
                "required": ["entity_id"]
            }
        },
        "analyze_temporal_fit": {
            "name": "analyze_temporal_fit",
            "description": "Analyze how well an entity fits an RFP opportunity based on their temporal patterns, past RFP history, and trends",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "entity_id": {
                        "type": "string",
                        "description": "Entity to analyze (name or neo4j_id)"
                    },
                    "rfp_id": {
                        "type": "string",
                        "description": "RFP identifier"
                    },
                    "rfp_category": {
                        "type": "string",
                        "description": "RFP category (optional)"
                    },
                    "rfp_value": {
                        "type": "number",
                        "description": "Estimated RFP value (optional)"
                    },
                    "time_horizon": {
                        "type": "number",
                        "description": "Days to look back (default: 90)",
                        "default": 90
                    }
                },
                "required": ["entity_id", "rfp_id"]
            }
        },
        "get_temporal_patterns": {
            "name": "get_temporal_patterns",
            "description": "Get aggregate temporal patterns across all entities including top active entities, RFP trends, and episode statistics",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "entity_type": {
                        "type": "string",
                        "description": "Filter by entity type (optional)"
                    },
                    "time_horizon": {
                        "type": "number",
                        "description": "Days to look back (default: 365)",
                        "default": 365
                    }
                }
            }
        },
        "create_rfp_episode": {
            "name": "create_rfp_episode",
            "description": "Record an RFP detection as a temporal episode for tracking and future analysis",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "rfp_id": {
                        "type": "string",
                        "description": "Unique RFP identifier"
                    },
                    "organization": {
                        "type": "string",
                        "description": "Organization name"
                    },
                    "title": {
                        "type": "string",
                        "description": "RFP title"
                    },
                    "description": {
                        "type": "string",
                        "description": "RFP description"
                    },
                    "source": {
                        "type": "string",
                        "description": "Detection source"
                    },
                    "url": {
                        "type": "string",
                        "description": "RFP URL"
                    },
                    "category": {
                        "type": "string",
                        "description": "RFP category"
                    },
                    "confidence_score": {
                        "type": "number",
                        "description": "Detection confidence (0-1)"
                    },
                    "estimated_value": {
                        "type": "number",
                        "description": "Estimated RFP value"
                    }
                },
                "required": ["rfp_id", "organization"]
            }
        },
        "record_outcome": {
            "name": "record_outcome",
            "description": "Record RFP outcome to close the feedback loop (won/lost RFPs update entity intelligence scores)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "rfp_id": {
                        "type": "string",
                        "description": "RFP identifier"
                    },
                    "entity_id": {
                        "type": "string",
                        "description": "Entity identifier"
                    },
                    "entity_name": {
                        "type": "string",
                        "description": "Entity display name"
                    },
                    "status": {
                        "type": "string",
                        "description": "Outcome status (won, lost, withdrew, etc.)",
                        "enum": ["detected", "analyzing", "contacted", "quoting", "submitted", "won", "lost", "withdrew", "on_hold"]
                    },
                    "value_actual": {
                        "type": "number",
                        "description": "Actual value (if won)"
                    },
                    "loss_reason": {
                        "type": "string",
                        "description": "Why we lost (if lost)"
                    }
                },
                "required": ["rfp_id", "entity_id", "entity_name", "status"]
            }
        },
        # Phase 2: New Temporal Query Tools
        "query_episodes": {
            "name": "query_episodes",
            "description": "Query episodes within time bounds using Graphiti's bi-temporal retrieval. Returns episodes with entities, relationships, and temporal metadata.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "entities": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of entity names to query"
                    },
                    "from_time": {
                        "type": "string",
                        "description": "ISO timestamp start of time window (e.g., 2020-01-01T00:00:00Z)"
                    },
                    "to_time": {
                        "type": "string",
                        "description": "ISO timestamp end of time window (e.g., 2020-12-31T23:59:59Z)"
                    },
                    "episode_types": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional filter by episode types (RFP_DETECTED, PARTNERSHIP_FORMED, etc.)"
                    },
                    "max_results": {
                        "type": "number",
                        "description": "Maximum number of episodes to return (default: 100)",
                        "default": 100
                    }
                },
                "required": ["entities", "from_time", "to_time"]
            }
        },
        "get_entity_state_at_time": {
            "name": "get_entity_state_at_time",
            "description": "Resolve entity state at specific timestamp. Returns snapshot of relationships, affiliations, and properties at that point in time using Graphiti's bi-temporal model.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "entity_id": {
                        "type": "string",
                        "description": "Entity identifier (name or neo4j_id)"
                    },
                    "at_time": {
                        "type": "string",
                        "description": "ISO timestamp to resolve state at (e.g., 2020-03-15T10:30:00Z)"
                    }
                },
                "required": ["entity_id", "at_time"]
            }
        },
        "compute_entity_diff": {
            "name": "compute_entity_diff",
            "description": "Detect structural changes between two time periods. Compares entity state to identify new/ended relationships, property changes, and confidence deltas.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "entity_id": {
                        "type": "string",
                        "description": "Entity identifier (name or neo4j_id)"
                    },
                    "from_time": {
                        "type": "string",
                        "description": "Start time ISO timestamp (e.g., 2019-01-01T00:00:00Z)"
                    },
                    "to_time": {
                        "type": "string",
                        "description": "End time ISO timestamp (e.g., 2023-12-31T23:59:59Z)"
                    }
                },
                "required": ["entity_id", "from_time", "to_time"]
            }
        },
        "build_temporal_narrative": {
            "name": "build_temporal_narrative",
            "description": "Compress episodes into token-bounded narrative for Claude. Groups by episode type, time-ordered bullets, truncates at max_tokens. Use for timeline queries.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "entities": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of entity names to query"
                    },
                    "from_time": {
                        "type": "string",
                        "description": "ISO timestamp start of time window"
                    },
                    "to_time": {
                        "type": "string",
                        "description": "ISO timestamp end of time window"
                    },
                    "episode_types": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional filter by episode types"
                    },
                    "max_tokens": {
                        "type": "number",
                        "description": "Maximum tokens in narrative (default: 2000)",
                        "default": 2000
                    }
                },
                "required": ["entities", "from_time", "to_time"]
            }
        }
    }

    # Handler mapping
    handlers = {
        "get_entity_timeline": get_entity_timeline,
        "analyze_temporal_fit": analyze_temporal_fit,
        "get_temporal_patterns": get_temporal_patterns,
        "create_rfp_episode": create_rfp_episode,
        "record_outcome": record_outcome,
        # Phase 2: New temporal query tools
        "query_episodes": query_episodes,
        "get_entity_state_at_time": get_entity_state_at_time,
        "compute_entity_diff": compute_entity_diff,
        "build_temporal_narrative": build_temporal_narrative
    }

    # Read from stdin, write to stdout
    import sys

    logger.info("✅ Temporal MCP Server ready, waiting for messages...")

    for line in sys.stdin:
        if not line.strip():
            continue

        try:
            message = json.loads(line)
            response = await handle_message(message, tools, handlers)
            print(json.dumps(response), flush=True)

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            print(json.dumps({
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": "Parse error"
                }
            }), flush=True)
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            print(json.dumps({
                "jsonrpc": "2.0",
                "id": message.get("id") if isinstance(message, dict) else None,
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }), flush=True)


async def handle_message(
    message: Dict[str, Any],
    tools: Dict[str, Dict],
    handlers: Dict[str, callable]
) -> Dict[str, Any]:
    """Handle incoming JSON-RPC message"""

    # Initialize response
    response = {
        "jsonrpc": "2.0",
        "id": message.get("id")
    }

    # Handle initialization
    if message.get("method") == "initialize":
        response["result"] = {
            "protocolVersion": "2024-11-05",
            "serverInfo": {
                "name": "temporal-intelligence-mcp",
                "version": "1.0.0"
            },
            "capabilities": {
                "tools": {}
            }
        }
        return response

    # Handle tools/list
    if message.get("method") == "tools/list":
        response["result"] = {
            "tools": [
                {
                    "name": name,
                    "description": tool["description"],
                    "inputSchema": tool["inputSchema"]
                }
                for name, tool in tools.items()
            ]
        }
        return response

    # Handle tools/call
    if message.get("method") == "tools/call":
        params = message.get("params", {})
        tool_name = params.get("name")
        arguments = params.get("arguments", {})

        if tool_name not in handlers:
            response["error"] = {
                "code": -32601,
                "message": f"Unknown tool: {tool_name}"
            }
            return response

        try:
            # Call the handler
            result = await handlers[tool_name](**arguments)
            response["result"] = {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(result, indent=2, default=str)
                    }
                ]
            }
        except Exception as e:
            response["error"] = {
                "code": -32603,
                "message": str(e)
            }

        return response

    # Unknown method
    response["error"] = {
        "code": -32601,
        "message": f"Unknown method: {message.get('method')}"
    }
    return response


if __name__ == "__main__":
    asyncio.run(main())
