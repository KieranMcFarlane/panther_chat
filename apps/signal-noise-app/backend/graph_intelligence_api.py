"""
FastAPI Backend for Graph Intelligence MVP

Exposes MVP pipeline operations as REST API endpoints for CopilotKit integration.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

# Import MVP components
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from integration.mvp_pipeline import MVPPipeline
from mcp_tools.graph_tools import (
    query_entity,
    search_entities,
    get_entity_signals,
    run_intelligence_batch,
    get_system_stats,
    list_signal_types
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Graph Intelligence MVP API",
    description="Backend API for sports intelligence graph system",
    version="1.0.0"
)


# =============================================================================
# Request/Response Models
# =============================================================================

class EntityQueryRequest(BaseModel):
    entity_id: str = Field(..., description="Entity identifier")
    include_timeline: bool = Field(default=False, description="Include signal timeline")
    timeline_days: int = Field(default=30, description="Days to look back")


class EntitySearchRequest(BaseModel):
    query: str = Field(..., description="Search query")
    entity_type: Optional[str] = Field(None, description="Filter by entity type")
    limit: int = Field(default=10, description="Maximum results")


class EntitySignalsRequest(BaseModel):
    entity_id: str = Field(..., description="Entity identifier")
    signal_types: Optional[List[str]] = Field(None, description="Filter by signal types")
    days: int = Field(default=30, description="Days to look back")
    limit: int = Field(default=20, description="Maximum signals")


class IntelligenceBatchRequest(BaseModel):
    batch_size: int = Field(default=5, description="Number of entities to process")


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/")
async def root():
    """API health check"""
    return {
        "service": "Graph Intelligence MVP API",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "query_entity": "/query-entity",
            "search_entities": "/search-entities",
            "get_entity_signals": "/entity-signals",
            "run_batch": "/run-batch",
            "stats": "/stats",
            "signal_types": "/signal-types"
        }
    }


@app.post("/query-entity")
async def query_entity_endpoint(request: EntityQueryRequest) -> Dict[str, Any]:
    """
    Query an entity from the knowledge graph

    Args:
        request: EntityQueryRequest

    Returns:
        Entity data with optional timeline
    """
    try:
        result = await query_entity(
            entity_id=request.entity_id,
            include_timeline=request.include_timeline,
            timeline_days=request.timeline_days
        )

        if not result.get('found'):
            raise HTTPException(status_code=404, detail=f"Entity '{request.entity_id}' not found")

        return {
            "success": True,
            "data": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying entity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search-entities")
async def search_entities_endpoint(request: EntitySearchRequest) -> Dict[str, Any]:
    """
    Search for entities in the knowledge graph

    Args:
        request: EntitySearchRequest

    Returns:
        List of matching entities
    """
    try:
        results = await search_entities(
            query=request.query,
            entity_type=request.entity_type,
            limit=request.limit
        )

        return {
            "success": True,
            "query": request.query,
            "count": len(results),
            "results": results
        }

    except Exception as e:
        logger.error(f"Error searching entities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/entity-signals")
async def get_entity_signals_endpoint(request: EntitySignalsRequest) -> Dict[str, Any]:
    """
    Get signals for a specific entity

    Args:
        request: EntitySignalsRequest

    Returns:
        List of signals
    """
    try:
        signals = await get_entity_signals(
            entity_id=request.entity_id,
            signal_types=request.signal_types,
            days=request.days,
            limit=request.limit
        )

        return {
            "success": True,
            "entity_id": request.entity_id,
            "count": len(signals),
            "signals": signals
        }

    except Exception as e:
        logger.error(f"Error getting entity signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run-batch")
async def run_intelligence_batch_endpoint(request: IntelligenceBatchRequest) -> Dict[str, Any]:
    """
    Run the intelligence pipeline batch processing

    Args:
        request: IntelligenceBatchRequest

    Returns:
        Pipeline results
    """
    try:
        result = await run_intelligence_batch(batch_size=request.batch_size)

        return {
            "success": True,
            "data": result
        }

    except Exception as e:
        logger.error(f"Error running intelligence batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stats")
async def get_system_stats_endpoint() -> Dict[str, Any]:
    """
    Get system statistics

    Returns:
        System statistics
    """
    try:
        stats = await get_system_stats()

        return {
            "success": True,
            "stats": stats
        }

    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/signal-types")
async def list_signal_types_endpoint() -> Dict[str, Any]:
    """
    List available signal types

    Returns:
        List of signal types
    """
    try:
        signal_types = await list_signal_types()

        return {
            "success": True,
            "signal_types": signal_types
        }

    except Exception as e:
        logger.error(f"Error listing signal types: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Startup/Shutdown
# =============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize graph memory on startup"""
    logger.info("🚀 Graph Intelligence MVP API starting up...")
    logger.info("✅ Ready to process requests")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Graph Intelligence MVP API shutting down...")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
