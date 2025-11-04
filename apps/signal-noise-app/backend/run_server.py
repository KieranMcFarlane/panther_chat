#!/usr/bin/env python3
"""
Simple server script to run the Signal Noise App
"""

import uvicorn
from backend.main import app

if __name__ == "__main__":
    print("🚀 Starting Signal Noise App...")
    print("📍 API will be available at: http://localhost:8000")
    print("📚 API docs will be at: http://localhost:8000/docs")
    print("🔍 Health check at: http://localhost:8000/health")
    print("=" * 50)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
