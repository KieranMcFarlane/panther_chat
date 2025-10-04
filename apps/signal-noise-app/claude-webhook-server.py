from fastapi import FastAPI, HTTPException, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Generator, AsyncGenerator
import asyncio
import json
import os
from dotenv import load_dotenv
from claude_agent_sdk import query
import httpx

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="Claude Agent Webhook Server")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3005", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    role: str
    content: str
    id: str | None = None

class ChatRequest(BaseModel):
    messages: List[Message]
    context: Dict[str, Any] = {}
    userId: str | None = None
    stream: bool = True

class MCPServer(BaseModel):
    command: str
    args: List[str] = []
    env: Dict[str, str] = {}

class MCPConfig(BaseModel):
    mcpServers: Dict[str, MCPServer] = {}

class ClaudeAgentManager:
    def __init__(self):
        self.session_cache = {}
        self.mcp_config = {}
    
    async def load_mcp_config(self):
        """Load MCP configuration from local file"""
        try:
            config_path = ".mcp.json"
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    self.mcp_config = config.get("mcpServers", {})
            else:
                # Default minimal MCP config
                self.mcp_config = {
                    "neo4j": {
                        "command": "node",
                        "args": ["neo4j-mcp-server.js"],
                        "env": {
                            "NEO4J_URI": os.getenv("NEO4J_URI", "neo4j+s://demo.databases.neo4j.io"),
                            "NEO4J_USERNAME": os.getenv("NEO4J_USERNAME", "neo4j"),
                            "NEO4J_PASSWORD": os.getenv("NEO4J_PASSWORD", ""),
                            "DATABASE": os.getenv("NEO4J_DATABASE", "neo4j")
                        }
                    }
                }
        except Exception as e:
            print(f"Failed to load MCP config: {e}")
            self.mcp_config = {}
    
    def get_api_config(self):
        """Get API configuration for Claude Agent SDK"""
        base_url = os.getenv("ANTHROPIC_BASE_URL")
        auth_token = os.getenv("ANTHROPIC_AUTH_TOKEN")
        
        if base_url and auth_token:
            print(f"Using custom API configuration: {base_url}")
            return {
                "baseUrl": base_url,
                "authToken": auth_token
            }
        else:
            print("Using standard Anthropic API configuration")
            return {}
    
    async def process_streaming_chat(
        self, 
        messages: List[Message], 
        context: Dict[str, Any] = {},
        user_id: str = None
    ) -> AsyncGenerator[str, None]:
        """Process chat with Claude Agent SDK and stream responses"""
        
        if not messages:
            raise ValueError("No messages provided")
        
        last_message = messages[-1]
        if last_message.role != 'user':
            raise ValueError("Last message must be from user")
        
        # Get session ID for continuity
        session_id = self.session_cache.get(user_id or 'default')
        
        # Ensure MCP config is loaded
        if not self.mcp_config:
            await self.load_mcp_config()
        
        try:
            # Configure Claude Agent SDK options
            options = {
                "mcpServers": self.mcp_config,
                "maxTurns": 5,
                "systemPrompt": {
                    "type": "preset",
                    "preset": "claude_code",
                    "append": self._get_system_prompt(context)
                },
                "settingSources": ["project"]
            }
            
            # Add custom API configuration if available
            api_config = self.get_api_config()
            if api_config:
                options.update(api_config)
            
            # Resume session if available
            if session_id:
                options["resume"] = session_id
            
            # Send initial status
            yield json.dumps({
                "type": "status",
                "status": "thinking",
                "message": "🤔 Processing your request..."
            }) + "\n"
            
            # Query Claude Agent SDK
            async for response in query(
                prompt=last_message.content,
                options=options
            ):
                # Store session ID for continuity
                if response.type == 'system' and response.subtype == 'init' and response.session_id:
                    if user_id:
                        self.session_cache[user_id] = response.session_id
                    yield json.dumps({
                        "type": "status",
                        "status": "connected", 
                        "message": "✅ Connected to sports intelligence database"
                    }) + "\n"
                
                # Handle assistant responses
                if response.type == 'assistant' and hasattr(response, 'message') and response.message.content:
                    text_content = ""
                    for content_block in response.message.content:
                        if content_block.type == 'text':
                            text_content += content_block.text
                    
                    if text_content:
                        yield json.dumps({
                            "type": "message",
                            "role": "assistant",
                            "content": text_content
                        }) + "\n"
                
                # Handle tool usage
                if response.type == 'tool_use':
                    yield json.dumps({
                        "type": "tool_use",
                        "tool": response.name,
                        "args": response.input
                    }) + "\n"
                
                # Handle tool results
                if response.type == 'tool_result':
                    yield json.dumps({
                        "type": "tool_result",
                        "tool": response.name,
                        "result": response.content
                    }) + "\n"
                
                # Handle completion
                if response.type == 'result' and response.subtype == 'success':
                    yield json.dumps({
                        "type": "status",
                        "status": "completed",
                        "message": "✅ Task completed"
                    }) + "\n"
                    break
                
                # Handle errors
                if response.type == 'result' and response.subtype == 'error':
                    yield json.dumps({
                        "type": "error",
                        "error": response.error or "Unknown error occurred"
                    }) + "\n"
                    break
        
        except Exception as e:
            yield json.dumps({
                "type": "error",
                "error": f"Agent error: {str(e)}"
            }) + "\n"
    
    def _get_system_prompt(self, context: Dict[str, Any]) -> str:
        """Generate system prompt based on context"""
        base_prompt = """You are a Sports Intelligence AI assistant with access to a Neo4j database containing 3,325+ sports entities. 

You help users analyze sports clubs, identify business opportunities, and find key decision makers. You have access to tools for:
- Querying the Neo4j sports database
- Web search and data scraping
- File system operations
- Memory/knowledge retrieval

Be helpful, professional, and provide actionable insights."""
        
        if context.get("projectType"):
            base_prompt += f"\n\nProject Context: Working with {context['projectType']} projects."
        
        if context.get("userRole"):
            base_prompt += f"\n\nUser Role: {context['userRole']}."
        
        return base_prompt

# Global agent manager
agent_manager = ClaudeAgentManager()

@app.on_event("startup")
async def startup_event():
    """Initialize the agent manager"""
    await agent_manager.load_mcp_config()
    
    # Show API configuration
    base_url = os.getenv("ANTHROPIC_BASE_URL")
    auth_token = os.getenv("ANTHROPIC_AUTH_TOKEN")
    
    if base_url and auth_token:
        print(f"🔗 Using custom API: {base_url}")
        print(f"🔑 Auth token: {auth_token[:20]}...")
    else:
        print("📡 Using standard Anthropic API")
    
    print("🚀 Claude Agent webhook server started on port 8001")

@app.get("/")
async def root():
    return {"status": "Claude Agent Webhook Server Running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "mcp_servers": len(agent_manager.mcp_config)}

@app.post("/webhook/chat")
async def chat_webhook(request: ChatRequest):
    """Handle CopilotKit chat requests via webhook"""
    
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided")
    
    async def generate_response():
        async for chunk in agent_manager.process_streaming_chat(
            messages=request.messages,
            context=request.context,
            user_id=request.userId
        ):
            yield chunk
        
        # Send final completion signal
        yield json.dumps({
            "type": "stream_end"
        }) + "\n"
    
    if request.stream:
        return StreamingResponse(
            generate_response(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*"
            }
        )
    else:
        # Non-streaming mode - collect all responses
        response_parts = []
        async for chunk in agent_manager.process_streaming_chat(
            messages=request.messages,
            context=request.context,
            user_id=request.userId
        ):
            response_parts.append(chunk)
        
        return {"response": "".join(response_parts)}

@app.post("/webhook/config")
async def update_config(config: MCPConfig):
    """Update MCP configuration"""
    agent_manager.mcp_config = config.mcpServers
    return {"status": "updated", "servers": list(config.mcpServers.keys())}

@app.get("/config/mcp")
async def get_mcp_config():
    """Get current MCP configuration"""
    return {"mcpServers": agent_manager.mcp_config}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)