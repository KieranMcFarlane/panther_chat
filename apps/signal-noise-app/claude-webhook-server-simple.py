#!/usr/bin/env python3
"""
FastAPI Webhook Server for CopilotKit integration
Simplified version without claude-agent-sdk dependency
"""

import os
import json
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx
from pydantic import BaseModel

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="Claude Webhook Server", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[Dict[str, Any]] = None
    userId: Optional[str] = None
    stream: bool = True

class ClaudeWebhookServer:
    def __init__(self):
        self.api_base_url = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
        self.api_key = os.getenv("ANTHROPIC_AUTH_TOKEN")
        self.neo4j_uri = os.getenv("NEO4J_URI")
        self.neo4j_username = os.getenv("NEO4J_USERNAME")
        self.neo4j_password = os.getenv("NEO4J_PASSWORD")
        
        if not self.api_key:
            raise ValueError("ANTHROPIC_AUTH_TOKEN environment variable is required")
    
    def get_api_config(self):
        """Get API configuration for custom endpoints"""
        config = {}
        if self.api_base_url:
            config["api_url"] = self.api_base_url
        return config
    
    async def call_claude_api(self, messages: List[Dict], stream: bool = False):
        """Call Claude API directly with custom configuration"""
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01"
        }
        
        # Convert messages to Claude format
        claude_messages = []
        for msg in messages:
            if msg["role"] == "user":
                claude_messages.append({
                    "role": "user",
                    "content": msg["content"]
                })
            elif msg["role"] == "assistant":
                claude_messages.append({
                    "role": "assistant", 
                    "content": msg["content"]
                })
        
        payload = {
            "model": "claude-3-sonnet-20240229",
            "max_tokens": 4096,
            "messages": claude_messages,
            "stream": stream
        }
        
        url = f"{self.api_base_url}/v1/messages"
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            if stream:
                async with client.stream("POST", url, headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        error_text = await response.text()
                        raise HTTPException(status_code=response.status_code, detail=error_text)
                    
                    async def generate_stream():
                        async for chunk in response.aiter_lines():
                            if chunk.strip():
                                yield f"data: {chunk}\n\n"
                        yield "data: [DONE]\n\n"
                    
                    return StreamingResponse(
                        generate_stream(),
                        media_type="text/event-stream",
                        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
                    )
            else:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code != 200:
                    error_text = response.text
                    raise HTTPException(status_code=response.status_code, detail=error_text)
                
                return response.json()

# Initialize server
server = ClaudeWebhookServer()

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Claude Webhook Server is running",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "api_base_url": server.api_base_url
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "api_base_url": server.api_base_url,
        "mcp_servers": 0  # Simplified version
    }

@app.post("/webhook/chat")
async def webhook_chat(request: ChatRequest):
    """Main webhook endpoint for CopilotKit"""
    try:
        # Convert messages to dict format
        messages = [msg.dict() for msg in request.messages]
        
        # Call Claude API
        result = await server.call_claude_api(messages, request.stream)
        
        return result
        
    except Exception as e:
        print(f"Error in webhook_chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/webhook/chat/no-stream")
async def webhook_chat_no_stream(request: ChatRequest):
    """Non-streaming webhook endpoint"""
    try:
        # Convert messages to dict format
        messages = [msg.dict() for msg in request.messages]
        
        # Call Claude API without streaming
        result = await server.call_claude_api(messages, stream=False)
        
        return result
        
    except Exception as e:
        print(f"Error in webhook_chat_no_stream: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "claude-webhook-server-simple:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
        log_level="info"
    )