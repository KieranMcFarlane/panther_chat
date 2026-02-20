"""
Digital Discovery API Routes

FastAPI endpoints for automated digital transformation discovery.
Integrates with DigitalDiscoveryAgent for scalable entity analysis.

API Endpoints:
- POST /api/digital-discovery/single - Discover single entity
- POST /api/digital-discovery/batch - Discover multiple entities
- GET /api/digital-discovery/status - Get discovery service status
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from backend.digital_discovery_agent import (
    DigitalDiscoveryAgent,
    BatchDigitalDiscovery,
    DiscoveryResult,
    DiscoverySignal,
    Stakeholder,
    TechnologyStack
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/digital-discovery")

# Global agent instance
discovery_agent: Optional[DigitalDiscoveryAgent] = None
batch_discovery: Optional[BatchDigitalDiscovery] = None


class SingleDiscoveryRequest(BaseModel):
    """Request model for single entity discovery"""
    entity_name: str = Field(..., description="Entity display name (e.g., 'Manchester United FC')")
    entity_id: str = Field(..., description="Unique entity ID (e.g., 'manchester-united-fc')")
    template_id: Optional[str] = Field(None, description="Discovery template to guide search")
    max_iterations: int = Field(4, ge=1, le=10, description="Max search iterations")
    depth: str = Field("standard", description="Discovery depth: 'standard', 'deep', or 'quick'")


class BatchDiscoveryRequest(BaseModel):
    """Request model for batch entity discovery"""
    entities: List[Dict[str, str]] = Field(
        ...,
        description="List of entities to discover. Each dict must have 'name' and 'id' keys"
    )
    max_concurrent: int = Field(5, ge=1, le=20, description="Max concurrent discoveries")


class DiscoveryStatusResponse(BaseModel):
    """Status response for discovery service"""
    status: str
    agent_active: bool
    total_discoveries: int = 0
    last_discovery: Optional[str] = None
    uptime_seconds: float = 0.0


def _get_agent() -> DigitalDiscoveryAgent:
    """Get or create discovery agent singleton"""
    global discovery_agent

    if discovery_agent is None:
        discovery_agent = DigitalDiscoveryAgent()
        logger.info("✅ Digital Discovery Agent initialized")

    return discovery_agent


def _get_batch_discovery() -> BatchDigitalDiscovery:
    """Get or create batch discovery singleton"""
    global batch_discovery

    if batch_discovery is None:
        batch_discovery = BatchDigitalDiscovery()
        logger.info("✅ Batch Digital Discovery initialized")

    return batch_discovery


@router.post("/single", response_model=DiscoveryResult)
async def discover_single_entity(request: SingleDiscoveryRequest):
    """
    Discover digital transformation signals for a single entity.

    **Usage**:
    ```bash
    curl -X POST "http://localhost:8000/api/digital-discovery/single" \\
      -H "Content-Type: application/json" \\
      -d '{
        "entity_name": "Manchester United FC",
        "entity_id": "manchester-united-fc",
        "template_id": "tier_1_club_centralized_procurement",
        "max_iterations": 4
      }'
    ```

    **Response**:
    - entity_id: Unique identifier
    - confidence: 0.0-1.0 confidence score
    - band: EXPLORATORY, INFORMED, CONFIDENT, or ACTIONABLE
    - signals: List of detected signals
    - stakeholders: Identified contacts
    - technology_stack: Confirmed deployments
    - recommendations: Sales approach and deal size estimate

    **Typical Response Time**: 3-5 minutes
    """
    logger.info(f"🚀 Single discovery requested for {request.entity_name}")

    try:
        agent = _get_agent()
        result = await agent.discover_entity(
            entity_name=request.entity_name,
            entity_id=request.entity_id,
            template_id=request.template_id,
            max_iterations=request.max_iterations,
            depth=request.depth
        )

        logger.info(f"✅ Discovery complete for {request.entity_name}: {result.confidence:.2f} ({result.band})")

        return result

    except Exception as e:
        logger.error(f"❌ Discovery failed for {request.entity_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch", response_model=Dict[str, Any])
async def discover_multiple_entities(request: BatchDiscoveryRequest):
    """
    Discover digital transformation signals for multiple entities in parallel.

    **Usage**:
    ```bash
    curl -X POST "http://localhost:8000/api/digital-discovery/batch" \\
      -H "Content-Type: application/json" \\
      -d '{
        "entities": [
          {"name": "Arsenal FC", "id": "arsenal-fc"},
          {"name": "Chelsea FC", "id": "chelsea-fc"},
          {"name": "Liverpool FC", "id": "liverpool-fc"}
        ],
        "max_concurrent": 3
      }'
    ```

    **Response**:
    - results: Array of DiscoveryResult objects
    - summary: Batch statistics including:
      - total_entities
      - high_priority_count
      - confident_count
      - actionable_count
      - average_confidence
      - duration_seconds
      - estimated_pipeline_value

    **Typical Response Time**: 5-15 minutes for 3 entities (parallel)

    **Concurrency**: Processes up to 5 entities simultaneously (configurable)
    """
    logger.info(f"🚀 Batch discovery requested for {len(request.entities)} entities (max concurrent: {request.max_concurrent})")

    try:
        batch = _get_batch_discovery()
        results = await batch.discover_entities(
            entities=request.entities,
            max_concurrent=request.max_concurrent
        )

        summary = batch._generate_summary(results, 0.0)

        response = {
            "results": results,
            "summary": summary,
            "timestamp": datetime.now().isoformat()
        }

        logger.info(f"✅ Batch discovery complete: {len(results)}/{len(request.entities)} successful")
        logger.info(f"   High priority: {summary['high_priority_count']}, Actionable: {summary['actionable_count']}")

        return response

    except Exception as e:
        logger.error(f"❌ Batch discovery failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", response_model=DiscoveryStatusResponse)
async def get_discovery_status():
    """
    Get discovery service status and statistics.

    **Usage**:
    ```bash
    curl "http://localhost:8000/api/digital-discovery/status"
    ```

    **Response**:
    - status: Service status
    - agent_active: Whether agent is initialized
    - total_discoveries: Total completed discoveries
    - last_discovery: Timestamp of last discovery
    - uptime_seconds: Service uptime

    This endpoint provides health check and usage statistics for monitoring.
    """
    global discovery_agent, batch_discovery

    return DiscoveryStatusResponse(
        status="active",
        agent_active=discovery_agent is not None,
        total_discoveries=0,  # TODO: Track from database
        last_discovery=None,
        uptime_seconds=0.0
    )


@router.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {"status": "healthy", "service": "digital-discovery"}


# Error handlers
@router.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled exceptions"""
    logger.error(f"❌ Unhandled exception: {exc}")
    raise HTTPException(status_code=500, detail=str(exc))


@router.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    """HTTP exception handler"""
    logger.warning(f"⚠️ HTTP exception: {exc.status_code} - {exc.detail}")
    return {
        "status": "error",
        "code": exc.status_code,
        "detail": exc.detail,
        "path": str(request.url.path)
    }
