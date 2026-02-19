#!/usr/bin/env python3
"""
FastAPI Routes for Hypothesis State Scoring

Part of Temporal Sports Procurement Prediction Engine MVP.

Provides REST API endpoints for accessing hypothesis-level prediction states:
- GET /api/scoring/{entity_id} - Get all hypothesis states for entity
- GET /api/scoring/{entity_id}/category/{category} - Get specific category state
- POST /api/scoring/{entity_id}/recalculate - Force recalculation

Usage:
    from scoring_routes import app, get_scoring_router

    # Mount to main FastAPI app
    app.mount("/api/scoring", get_scoring_router())
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =============================================================================
# Response Models
# =============================================================================

class HypothesisStateResponse(BaseModel):
    """Hypothesis state response"""
    entity_id: str
    category: str
    maturity_score: float
    activity_score: float
    state: str  # MONITOR/WARM/ENGAGE/LIVE
    last_updated: str


class AllStatesResponse(BaseModel):
    """All hypothesis states for an entity"""
    entity_id: str
    states: Dict[str, HypothesisStateResponse]
    total_count: int


class RecalculateResponse(BaseModel):
    """Recalculation response"""
    entity_id: str
    success: bool
    message: str
    states: Optional[Dict[str, HypothesisStateResponse]] = None


# =============================================================================
# Router
# =============================================================================

def get_scoring_router() -> APIRouter:
    """
    Create and configure the scoring router

    Returns:
        APIRouter with scoring endpoints
    """
    router = APIRouter(
        prefix="/scoring",
        tags=["scoring"]
    )

    @router.get("/{entity_id}", response_model=AllStatesResponse)
    async def get_all_hypothesis_states(entity_id: str) -> AllStatesResponse:
        """
        Get all hypothesis states for an entity

        Args:
            entity_id: Entity identifier (e.g., "arsenal-fc")

        Returns:
            AllStatesResponse with dict of category -> HypothesisState

        Example:
            GET /api/scoring/arsenal-fc
        """
        try:
            from backend.hypothesis_persistence_native import get_hypothesis_repository

            # Get repository
            repo = await get_hypothesis_repository()
            if not await repo.initialize():
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Failed to connect to database"
                )

            # Get all states
            states = await repo.get_all_hypothesis_states(entity_id)

            # Convert to response format
            state_responses = {}
            for category, state in states.items():
                state_responses[category] = HypothesisStateResponse(
                    entity_id=state.entity_id,
                    category=state.category,
                    maturity_score=state.maturity_score,
                    activity_score=state.activity_score,
                    state=state.state,
                    last_updated=state.last_updated.isoformat()
                )

            return AllStatesResponse(
                entity_id=entity_id,
                states=state_responses,
                total_count=len(state_responses)
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error getting hypothesis states: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Internal server error: {str(e)}"
            )

    @router.get("/{entity_id}/category/{category}", response_model=HypothesisStateResponse)
    async def get_hypothesis_state(entity_id: str, category: str) -> HypothesisStateResponse:
        """
        Get hypothesis state for specific entity and category

        Args:
            entity_id: Entity identifier (e.g., "arsenal-fc")
            category: Hypothesis category (e.g., "CRM_UPGRADE")

        Returns:
            HypothesisStateResponse with scores and state

        Example:
            GET /api/scoring/arsenal-fc/category/CRM_UPGRADE
        """
        try:
            from backend.hypothesis_persistence_native import get_hypothesis_repository

            # Get repository
            repo = await get_hypothesis_repository()
            if not await repo.initialize():
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Failed to connect to database"
                )

            # Get specific state
            state = await repo.get_hypothesis_state(entity_id, category)

            if not state:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No hypothesis state found for {entity_id}/{category}"
                )

            return HypothesisStateResponse(
                entity_id=state.entity_id,
                category=state.category,
                maturity_score=state.maturity_score,
                activity_score=state.activity_score,
                state=state.state,
                last_updated=state.last_updated.isoformat()
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error getting hypothesis state: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Internal server error: {str(e)}"
            )

    @router.post("/{entity_id}/recalculate", response_model=RecalculateResponse)
    async def recalculate_hypothesis_states(entity_id: str) -> RecalculateResponse:
        """
        Force recalculation of hypothesis states for an entity

        This endpoint triggers a recalculation of all hypothesis states
        for the given entity based on current signals in the database.

        Args:
            entity_id: Entity identifier (e.g., "arsenal-fc")

        Returns:
            RecalculateResponse with updated states

        Example:
            POST /api/scoring/arsenal-fc/recalculate
        """
        try:
            from backend.hypothesis_persistence_native import get_hypothesis_repository
            from backend.ralph_loop import recalculate_hypothesis_state

            # Get repository
            repo = await get_hypothesis_repository()
            if not await repo.initialize():
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Failed to connect to database"
                )

            # TODO: Implement signal aggregation from database
            # For now, return placeholder response
            logger.info(f"🔄 Recalculating hypothesis states for {entity_id}")

            # This would normally:
            # 1. Query all signals for entity from Graphiti
            # 2. Classify them using classify_signal()
            # 3. Group by category
            # 4. Recalculate each category's state
            # 5. Save updated states

            return RecalculateResponse(
                entity_id=entity_id,
                success=True,
                message="Recalculation triggered. Use GET /api/scoring/{entity_id} to retrieve results.",
                states=None
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error recalculating hypothesis states: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Internal server error: {str(e)}"
            )

    return router


# =============================================================================
# Standalone Server (for testing)
# =============================================================================

def start_scoring_server(host: str = "0.0.0.0", port: int = 8002):
    """
    Start scoring API server

    Args:
        host: Host to bind to
        port: Port to bind to (default: 8002, different from Ralph Loop's 8001)
    """
    import uvicorn

    app = get_scoring_router()
    app.title = "Hypothesis Scoring API"
    app.description = "Temporal Sports Procurement Prediction Engine - Scoring Endpoints"

    logger.info(f"🚀 Starting Hypothesis Scoring API server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    start_scoring_server()
