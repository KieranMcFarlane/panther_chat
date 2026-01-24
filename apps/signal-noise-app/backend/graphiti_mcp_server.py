#!/usr/bin/env python3
"""
Graphiti Intelligence MCP Server

Graph intelligence MCP tools replacing temporal-intelligence MCP.

Provides:
- query_entity: Get complete entity data with relationships
- query_subgraph: Get entity's neighborhood graph (depth-limited)
- find_related_signals: Find signals related to entity with filters
- request_schema_extension: Request schema extension (requires approval)

This is the sole graph interface for the intelligence layer, replacing:
- neo4j-mcp (moved functionality)
- falkordb-mcp (moved functionality)
- temporal-intelligence (replaced with graph intelligence)

Usage:
    python backend/graphiti_mcp_server.py

Environment Variables:
    FALKORDB_URI: FalkorDB connection URI
    FALKORDB_USER: FalkorDB username
    FALKORDB_PASSWORD: FalkorDB password
    FALKORDB_DATABASE: FalkorDB database name (default: sports_intelligence)
    SUPABASE_URL: Supabase API URL (optional, preferred for storage)
    SUPABASE_ANON_KEY: Supabase anonymous key
"""

import os
import sys
import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any

# Add parent directory to path for imports
sys.path.insert(0, str(os.path.dirname(os.path.abspath(__file__))))

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("❌ FastMCP not installed. Install with: pip install mcp")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastMCP server
mcp = FastMCP("graphiti-intelligence")

# Import graphiti service and schemas
try:
    from backend.graphiti_service import GraphitiService
    from backend.schemas import (
        Entity, Signal, Evidence, Relationship,
        SignalType, EntityType, SignalSubtype,
        SchemaExtensionRequest, create_entity_id
    )
except ImportError as e:
    logger.warning(f"⚠️ Could not import backend modules: {e}")
    GraphitiService = None


# =============================================================================
# Graph Intelligence Tools
# =============================================================================

@mcp.tool()
async def query_entity(entity_id: str) -> Dict[str, Any]:
    """
    Get complete entity data with relationships

    Args:
        entity_id: Entity identifier (e.g., "ac-milan-fc", "paolo-maldini")

    Returns:
        Entity data including:
        - id: Unique identifier
        - type: Entity type (ORG, PERSON, PRODUCT, INITIATIVE, VENUE)
        - name: Display name
        - metadata: Extensible key-value pairs
        - relationships: List of related entities and relationships
        - signals: Recent signals for this entity

    Example:
        query_entity("ac-milan-fc")
        → {
            "entity": {"id": "ac-milan-fc", "type": "ORG", "name": "AC Milan", ...},
            "relationships": [...],
            "signals": [...]
          }
    """
    if not GraphitiService:
        return {'error': 'GraphitiService not available'}

    try:
        service = GraphitiService()
        await service.initialize()

        result = await service.get_entity(entity_id)

        service.close()
        return result

    except Exception as e:
        logger.error(f"Error querying entity {entity_id}: {e}")
        return {'error': str(e), 'entity_id': entity_id}


@mcp.tool()
async def query_subgraph(entity_id: str, depth: int = 2) -> Dict[str, Any]:
    """
    Get entity's neighborhood graph (depth-limited)

    Args:
        entity_id: Entity identifier (e.g., "ac-milan-fc")
        depth: How many hops to traverse (default: 2, max: 3)

    Returns:
        Subgraph data including:
        - center_entity: The requested entity
        - entities: List of related entities
        - relationships: Relationships between entities
        - signals: Signals for all entities in subgraph
        - depth: Actual depth traversed

    Use cases:
    - "Who are AC Milan's partners and their partners?"
    - "What's the network around Paolo Maldini?"
    - "Show me the ecosystem around this entity"

    Example:
        query_subgraph("ac-milan-fc", depth=2)
        → {
            "center_entity": {"id": "ac-milan-fc", "name": "AC Milan", ...},
            "entities": [
                {"id": "tech-corp", "name": "Tech Corp", ...},
                {"id": "paolo-maldini", "name": "Paolo Maldini", ...}
            ],
            "relationships": [...],
            "signals": [...],
            "depth": 2
          }
    """
    if not GraphitiService:
        return {'error': 'GraphitiService not available'}

    # Limit depth to prevent excessive queries
    depth = min(max(1, depth), 3)

    try:
        service = GraphitiService()
        await service.initialize()

        result = await service.get_subgraph(entity_id, depth)

        service.close()
        return result

    except Exception as e:
        logger.error(f"Error querying subgraph for {entity_id}: {e}")
        return {'error': str(e), 'entity_id': entity_id, 'depth': depth}


@mcp.tool()
async def find_related_signals(
    entity_id: str,
    signal_type: Optional[str] = None,
    min_confidence: float = 0.7,
    time_horizon_days: int = 365
) -> List[Dict[str, Any]]:
    """
    Find signals related to entity with filters

    Args:
        entity_id: Entity identifier (e.g., "ac-milan-fc")
        signal_type: Optional filter by signal type (e.g., "RFP_DETECTED", "TECHNOLOGY_ADOPTED")
        min_confidence: Minimum confidence threshold (default: 0.7, range: 0.0-1.0)
        time_horizon_days: Days to look back (default: 365, max: 1825)

    Returns:
        List of signals matching criteria, each with:
        - id: Signal identifier
        - type: Signal type
        - subtype: Optional signal subtype
        - confidence: Confidence score (0.0-1.0)
        - first_seen: ISO timestamp when first detected
        - entity_id: Related entity
        - metadata: Additional signal data

    Use cases:
    - "What RFP activity has AC Milan had in the last 90 days?"
    - "Show me high-confidence technology adoption signals"
    - "What's happening with this entity recently?"

    Example:
        find_related_signals("ac-milan-fc", signal_type="RFP_DETECTED", min_confidence=0.8, time_horizon_days=90)
        → [
            {
                "id": "signal_ac-milan-fc_rfp_detected_20240115120000",
                "type": "RFP_DETECTED",
                "subtype": "AI_PLATFORM_REWRITE",
                "confidence": 0.85,
                "first_seen": "2024-01-15T12:00:00Z",
                "entity_id": "ac-milan-fc",
                ...
            },
            ...
          ]
    """
    if not GraphitiService:
        return [{'error': 'GraphitiService not available'}]

    # Validate parameters
    min_confidence = max(0.0, min(1.0, min_confidence))
    time_horizon_days = min(max(1, time_horizon_days), 1825)  # Max 5 years

    try:
        service = GraphitiService()
        await service.initialize()

        result = await service.find_related_signals(
            entity_id=entity_id,
            signal_type=signal_type,
            min_confidence=min_confidence,
            time_horizon_days=time_horizon_days
        )

        service.close()
        return result

    except Exception as e:
        logger.error(f"Error finding signals for {entity_id}: {e}")
        return [{'error': str(e), 'entity_id': entity_id}]


@mcp.tool()
async def upsert_signal(
    entity_id: str,
    signal_type: str,
    confidence: float,
    evidence: List[Dict[str, Any]],
    signal_subtype: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Create or update signal with evidence (VALIDATION REQUIRED)

    ⚠️ IMPORTANT: This tool should only be called from Ralph Loop validation,
    not directly by Claude agents. Signals must pass Ralph Loop validation
    (minimum 3 evidence, confidence >= 0.7) before being written to Graphiti.

    Args:
        entity_id: Entity identifier (e.g., "ac-milan-fc")
        signal_type: Signal type (e.g., "RFP_DETECTED", "TECHNOLOGY_ADOPTED")
        confidence: Confidence score (0.0-1.0)
        evidence: List of evidence items (minimum 3 required for validation)
        signal_subtype: Optional signal subtype (e.g., "AI_PLATFORM_REWRITE")
        metadata: Optional additional signal metadata

    Evidence format:
        [
            {
                "source": "LinkedIn",
                "url": "https://linkedin.com/job/123",
                "date": "2024-01-15T12:00:00Z",
                "extracted_text": "...",
                "credibility_score": 0.8
            },
            ...
        ]

    Returns:
        Created signal data with validation status

    Validation requirements:
    - Minimum 3 pieces of evidence
    - Confidence >= 0.7
    - Average evidence credibility >= 0.6

    Example:
        upsert_signal(
            entity_id="ac-milan-fc",
            signal_type="RFP_DETECTED",
            confidence=0.85,
            evidence=[...],  # 3+ evidence items
            signal_subtype="AI_PLATFORM_REWRITE"
        )
    """
    if not GraphitiService:
        return {'error': 'GraphitiService not available'}

    try:
        # Import validation helper
        from backend.schemas import validate_signal_minimums

        service = GraphitiService()
        await service.initialize()

        # Create signal
        from datetime import timezone
        signal_id = f"signal_{entity_id}_{signal_type.lower()}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        signal = Signal(
            id=signal_id,
            type=SignalType[signal_type] if signal_type in SignalType.__members__ else SignalType.RFP_DETECTED,
            subtype=SignalSubtype[signal_subtype] if signal_subtype and signal_subtype in SignalSubtype.__members__ else None,
            confidence=confidence,
            first_seen=datetime.now(timezone.utc),
            entity_id=entity_id,
            metadata=metadata or {}
        )

        # Create evidence objects
        evidence_objects = []
        for i, ev in enumerate(evidence):
            ev_id = f"evidence_{signal_id}_{i}"
            evidence_obj = Evidence(
                id=ev_id,
                source=ev.get('source', 'unknown'),
                date=datetime.fromisoformat(ev.get('date', datetime.now(timezone.utc).isoformat())),
                signal_id=signal_id,
                url=ev.get('url'),
                extracted_text=ev.get('extracted_text'),
                credibility_score=ev.get('credibility_score', 0.5)
            )
            evidence_objects.append(evidence_obj)

        # Validate signal meets minimums
        validation = validate_signal_minimums(signal, evidence_objects)

        if not validation.passed:
            service.close()
            return {
                'error': 'Signal validation failed',
                'signal_id': signal_id,
                'validation': validation.dict(),
                'reasons': validation.rejection_reasons
            }

        # Mark signal as validated
        signal.validated = True
        signal.validation_pass = 3  # Final pass

        # Write signal to graph
        await service.upsert_signal(signal)

        # Link evidence
        for ev in evidence_objects:
            await service.link_evidence(ev)

        service.close()

        logger.info(f"✅ Upserted validated signal: {signal_id}")

        return {
            'signal_id': signal_id,
            'status': 'created',
            'validated': True,
            'evidence_count': len(evidence_objects),
            'confidence': confidence,
            'validation': validation.dict()
        }

    except Exception as e:
        logger.error(f"Error upserting signal: {e}")
        return {'error': str(e), 'entity_id': entity_id}


@mcp.tool()
async def request_schema_extension(
    node: str,
    field: str,
    value: str,
    rationale: str,
    confidence: float = 0.5
) -> Dict[str, Any]:
    """
    Request schema extension (requires approval)

    Requests a new SignalSubtype to be added to the schema. This is the
    only way to extend the fixed schema. Requests must be approved before
    the new subtype becomes available.

    Args:
        node: Node type (must be "SignalSubtype" - only Signal supports extensions)
        field: New subtype name (e.g., "BLOCKCHAIN_ADOPTION")
        value: Display value (e.g., "Blockchain Adoption")
        rationale: Why this subtype is needed
        confidence: Confidence in this extension (0.0-1.0)

    Returns:
        Extension request status

    Auto-approval rules:
    - Node is "SignalSubtype"
    - Field name is UPPER_SNAKE_CASE
    - Confidence > 0.9
    - Rationale > 20 characters
    - Value is descriptive (> 5 characters)

    Otherwise, manual approval is required.

    Example:
        request_schema_extension(
            node="SignalSubtype",
            field="BLOCKCHAIN_ADOPTION",
            value="Blockchain Adoption",
            rationale="Track NFT ticketing and blockchain-based fan engagement initiatives",
            confidence=0.85
        )
        → {
            "extension_id": "ext-123",
            "field": "BLOCKCHAIN_ADOPTION",
            "status": "PENDING",
            "auto_approved": false
          }
    """
    if not GraphitiService:
        return {'error': 'GraphitiService not available'}

    try:
        service = GraphitiService()
        await service.initialize()

        request = SchemaExtensionRequest(
            node=node,
            field=field,
            value=value,
            rationale=rationale,
            confidence=confidence,
            requested_by="mcp_tool"
        )

        result = await service.request_schema_extension(request)

        service.close()
        return result

    except Exception as e:
        logger.error(f"Error requesting schema extension: {e}")
        return {'error': str(e), 'field': field}


# =============================================================================
# Server Lifecycle
# =============================================================================

@mcp.resource("graphiti://health")
async def health_check() -> str:
    """Health check endpoint for the graphiti-intelligence MCP server"""
    try:
        if not GraphitiService:
            return "❌ GraphitiService not available"

        service = GraphitiService()
        initialized = await service.initialize()
        service.close()

        if initialized:
            return "✅ Graphiti Intelligence MCP server is healthy"
        else:
            return "⚠️ GraphitiService initialization failed"

    except Exception as e:
        return f"❌ Health check failed: {e}"


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    # Log startup
    logger.info("🚀 Starting Graphiti Intelligence MCP Server...")

    # Check environment variables
    falkordb_uri = os.getenv("FALKORDB_URI") or os.getenv("NEO4J_URI")
    falkordb_user = os.getenv("FALKORDB_USER") or os.getenv("NEO4J_USER", "neo4j")
    falkordb_password = os.getenv("FALKORDB_PASSWORD") or os.getenv("NEO4J_PASSWORD")

    if not falkordb_uri:
        logger.warning("⚠️ FALKORDB_URI not set - server may have limited functionality")

    if not falkordb_password:
        logger.warning("⚠️ FALKORDB_PASSWORD not set - server may have limited functionality")

    # Run server
    logger.info("✅ Graphiti Intelligence MCP Server ready")
    mcp.run()
