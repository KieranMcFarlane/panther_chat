#!/usr/bin/env python3
"""
Signal Noise App - Main Entry Point
AI-powered dossier enrichment system with MCP server orchestration
"""

import uvicorn
from backend.main import app

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
