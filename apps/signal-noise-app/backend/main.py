#!/usr/bin/env python3
"""
Signal Noise App - Main Entry Point
AI-powered dossier enrichment system with MCP server orchestration
"""

import os
import sys
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Signal Noise App Backend",
    description="AI-powered dossier enrichment system with MCP server orchestration",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ChatRequest(BaseModel):
    message: str
    sessionId: Optional[str] = None
    context: Optional[Dict[str, Any]] = {}

class ChatResponse(BaseModel):
    response: str
    sessionId: Optional[str] = None
    timestamp: str

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Signal Noise App Backend API",
        "version": "1.0.0",
        "status": "running"
    }

# Chat endpoint
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

# API status endpoint
@app.get("/api/status")
async def api_status():
    return {
        "status": "operational",
        "endpoints": [
            "/health",
            "/api/chat",
            "/api/status"
        ],
        "timestamp": datetime.now().isoformat()
    }

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
