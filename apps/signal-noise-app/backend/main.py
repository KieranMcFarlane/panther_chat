#!/usr/bin/env python3
"""
Signal Noise App - Main Entry Point
AI-powered dossier enrichment system with MCP server orchestration
Enhanced with Graphiti temporal knowledge graph capabilities
"""

import os
import sys
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Signal Noise App Backend - Graphiti Enhanced",
    description="AI-powered dossier enrichment system with temporal intelligence",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Graphiti service (lazy initialization)
graphiti_service = None


# =============================================================================
# Pydantic Models
# =============================================================================

class ChatRequest(BaseModel):
    message: str
    sessionId: Optional[str] = None
    context: Optional[Dict[str, Any]] = {}


class ChatResponse(BaseModel):
    response: str
    sessionId: Optional[str] = None
    timestamp: str


class RFPEpisodeInput(BaseModel):
    """Input for creating an RFP episode"""
    rfp_id: str = Field(..., description="Unique RFP identifier")
    organization: str = Field(..., description="Organization name")
    entity_type: str = Field(default="Entity", description="Entity type (Club, League, Person, etc.)")
    detected_at: str = Field(default_factory=lambda: datetime.now().isoformat(), description="Detection timestamp")
    title: Optional[str] = Field(None, description="RFP title")
    description: Optional[str] = Field(None, description="RFP description")
    source: Optional[str] = Field(None, description="Source (LinkedIn, Perplexity, etc.)")
    url: Optional[str] = Field(None, description="RFP URL")
    estimated_value: Optional[float] = Field(None, description="Estimated RFP value")
    category: Optional[str] = Field(None, description="RFP category")
    confidence_score: Optional[float] = Field(None, ge=0, le=1, description="Detection confidence")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class FitAnalysisRequest(BaseModel):
    """Request for temporal fit analysis"""
    entity_id: str = Field(..., description="Entity to analyze")
    rfp_id: str = Field(..., description="RFP identifier")
    rfp_category: Optional[str] = Field(None, description="RFP category")
    rfp_value: Optional[float] = Field(None, description="RFP estimated value")
    time_horizon: int = Field(default=90, ge=1, le=365, description="Days to look back")


class EpisodeResponse(BaseModel):
    """Response for episode creation"""
    episode_id: str
    organization: str
    timestamp: str
    status: str


# =============================================================================
# Lifecycle Events
# =============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global graphiti_service

    logger.info("🚀 Starting Signal Noise App Backend v2.0.0...")

    # Initialize Graphiti service
    try:
        from backend.graphiti_service import GraphitiService
        graphiti_service = GraphitiService()
        initialized = await graphiti_service.initialize()

        if initialized:
            logger.info("✅ Graphiti temporal service initialized")
        else:
            logger.warning("⚠️  Graphiti service initialization incomplete")
    except ImportError:
        logger.warning("⚠️  Graphiti service not available")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Graphiti: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global graphiti_service

    if graphiti_service:
        graphiti_service.close()
        logger.info("🔌 Graphiti service closed")


# =============================================================================
# Health & Status Endpoints
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
        "services": {
            "graphiti": graphiti_service is not None
        }
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Signal Noise App Backend API - Graphiti Enhanced",
        "version": "2.0.0",
        "status": "running",
        "features": [
            "temporal_knowledge_graph",
            "rfp_episode_tracking",
            "entity_timeline_analysis",
            "temporal_fit_scoring"
        ]
    }


@app.get("/api/status")
async def api_status():
    """API status endpoint"""
    return {
        "status": "operational",
        "endpoints": [
            "/health",
            "/api/chat",
            "/api/temporal/rfp-episode",
            "/api/temporal/entity/{entity_id}/timeline",
            "/api/temporal/analyze-fit",
            "/api/temporal/patterns",
            "/api/status"
        ],
        "timestamp": datetime.now().isoformat()
    }


# =============================================================================
# Chat Endpoint
# =============================================================================

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """Main chat endpoint for Claude Agent integration"""
    try:
        logger.info(f"Received message: {request.message[:100]}...")

        # Extract context information
        context = request.context or {}
        user_id = context.get("userId", "default")
        system_prompt = context.get("systemPrompt", "You are a helpful AI assistant.")

        # Here you would integrate with the Claude Agent SDK
        # For now, return a simple response
        response_text = f"I received your message: '{request.message}'. User ID: {user_id}. System prompt: {system_prompt[:50]}..."

        return ChatResponse(
            response=response_text,
            sessionId=request.sessionId or f"session_{datetime.now().timestamp()}",
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# =============================================================================
# Temporal Intelligence Endpoints
# =============================================================================

@app.post("/api/temporal/rfp-episode", response_model=EpisodeResponse)
async def add_rfp_episode(rfp_data: RFPEpisodeInput):
    """
    Add RFP as temporal episode with entity tracking

    Creates a temporal episode in the knowledge graph tracking:
    - When the RFP was detected
    - Which organization it relates to
    - Source, category, confidence, etc.
    """
    if not graphiti_service:
        raise HTTPException(status_code=503, detail="Temporal service not available")

    try:
        result = await graphiti_service.add_rfp_episode(rfp_data.dict())
        return EpisodeResponse(**result)
    except Exception as e:
        logger.error(f"Error creating RFP episode: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create episode: {str(e)}")


@app.get("/api/temporal/entity/{entity_id}/timeline")
async def get_entity_timeline(
    entity_id: str,
    limit: int = 50
):
    """
    Get entity's temporal history

    Returns all episodes associated with an entity:
    - RFP detections
    - Partnership changes
    - Executive changes
    - Technology adoptions
    """
    if not graphiti_service:
        raise HTTPException(status_code=503, detail="Temporal service not available")

    try:
        events = await graphiti_service.get_entity_timeline(entity_id, limit)
        return {
            "entity_id": entity_id,
            "event_count": len(events),
            "events": events,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting timeline: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get timeline: {str(e)}")


@app.post("/api/temporal/analyze-fit")
async def analyze_temporal_fit(request: FitAnalysisRequest):
    """
    Analyze RFP fit based on temporal patterns

    Analyzes historical patterns to determine fit:
    - Recent RFP engagement history
    - Category matching
    - Trend analysis
    - Confidence scoring
    - Recommendations
    """
    if not graphiti_service:
        raise HTTPException(status_code=503, detail="Temporal service not available")

    try:
        result = await graphiti_service.analyze_temporal_fit(
            entity_id=request.entity_id,
            rfp_id=request.rfp_id,
            rfp_category=request.rfp_category,
            rfp_value=request.rfp_value,
            time_horizon=request.time_horizon
        )
        return result
    except Exception as e:
        logger.error(f"Error analyzing fit: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze fit: {str(e)}")


@app.get("/api/temporal/patterns")
async def get_temporal_patterns(
    entity_type: Optional[str] = None,
    time_horizon: int = 365
):
    """
    Get aggregate temporal patterns across all entities

    Returns:
    - Episode counts by type
    - Most active entities
    - Overall statistics
    """
    if not graphiti_service:
        raise HTTPException(status_code=503, detail="Temporal service not available")

    try:
        patterns = await graphiti_service.get_temporal_patterns(entity_type, time_horizon)
        return patterns
    except Exception as e:
        logger.error(f"Error getting patterns: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get patterns: {str(e)}")


# =============================================================================
# Database Management Endpoints
# =============================================================================

@app.post("/api/admin/sync-from-supabase")
async def sync_from_supabase():
    """
    Trigger sync from Supabase to FalkorDB

    Extracts entities from Supabase cached_entities and imports to FalkorDB.
    This is a long-running operation.
    """
    # This would typically be a background task
    return {
        "status": "not_implemented",
        "message": "Use backend/extract_from_supabase.py and backend/import_to_falkordb.py directly"
    }


# =============================================================================
# Error Handlers
# =============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "timestamp": datetime.now().isoformat()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """General exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "timestamp": datetime.now().isoformat()
        }
    )


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Signal Noise App Backend...")
    logger.info("🚀 Server will be available at: http://localhost:8000")
    logger.info("📚 API docs will be at: http://localhost:8000/docs")
    logger.info("🔍 Health check at: http://localhost:8000/health")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )
