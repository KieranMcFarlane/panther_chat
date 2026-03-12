"""
🎯 RFP Intelligence FastAPI Backend with PydanticAI Validation
Enhanced version of claude-webhook-server.py with comprehensive data validation

This integrates seamlessly with the existing CopilotKit + Claude Agent SDK architecture
while adding PydanticAI validation for data reliability and structured outputs.
"""

from fastapi import FastAPI, HTTPException, StreamingResponse, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Generator, AsyncGenerator, Optional, Union
from enum import Enum
import asyncio
import json
import os
from dotenv import load_dotenv
from claude_agent_sdk import query
import httpx
import hashlib
from datetime import datetime

# PydanticAI imports
from pydantic_ai import Agent, RunContext
from pydantic_ai.models import KnownModelName
import anthropic

# Load environment variables from .env file
load_dotenv()

app = FastAPI(
    title="RFP Intelligence with PydanticAI Validation",
    description="Enhanced Claude Agent webhook server with comprehensive data validation"
)

# Enable CORS for Next.js frontend (same as existing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3005", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enums for structured data
class EntityType(str, Enum):
    COMPANY = "company"
    PERSON = "person"
    ORGANIZATION = "organization"
    VENUE = "venue"
    LEAGUE = "league"
    TEAM = "team"

class AlertType(str, Enum):
    PROMOTION = "promotion"
    NEW_ROLE = "new_role"
    ORGANIZATION_CHANGE = "organization_change"
    PROCUREMENT_OPPORTUNITY = "procurement_opportunity"
    MARKET_UPDATE = "market_update"

class Priority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

# Enhanced Pydantic Models (following existing patterns)
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

# RFP-specific models with validation
class BaseEntity(BaseModel):
    """Base entity model with comprehensive validation"""
    id: str = Field(..., description="Unique entity identifier")
    name: str = Field(..., min_length=1, max_length=500, description="Entity name")
    type: EntityType = Field(..., description="Type of entity")
    industry: Optional[str] = Field(None, max_length=100, description="Industry sector")
    description: Optional[str] = Field(None, max_length=2000, description="Entity description")
    website: Optional[str] = Field(None, description="Website URL")
    location: Optional[str] = Field(None, max_length=200, description="Location")
    size: Optional[str] = Field(None, description="Company size")
    revenue: Optional[str] = Field(None, description="Revenue range")
    
    @validator('website')
    def validate_website(cls, v):
        if v and not (v.startswith('http://') or v.startswith('https://')):
            raise ValueError('Website must start with http:// or https://')
        return v

class RFPData(BaseModel):
    """RFP data model with validation"""
    id: str = Field(..., description="Unique RFP identifier")
    title: str = Field(..., min_length=5, max_length=500, description="RFP title")
    organization: str = Field(..., min_length=2, max_length=200, description="Issuing organization")
    description: str = Field(..., min_length=10, max_length=5000, description="RFP description")
    value: Optional[str] = Field(None, description="Contract value")
    deadline: Optional[str] = Field(None, description="Submission deadline")
    category: Optional[str] = Field(None, max_length=100, description="RFP category")
    source: str = Field(..., description="Source of RFP")
    published: str = Field(..., description="Publication date")

class AlertData(BaseModel):
    """Alert data model with validation"""
    id: str = Field(..., description="Unique alert identifier")
    type: AlertType = Field(..., description="Type of alert")
    entity: str = Field(..., min_length=1, max_length=200, description="Entity name")
    description: str = Field(..., min_length=5, max_length=1000, description="Alert description")
    impact: float = Field(..., ge=0.0, le=1.0, description="Impact score (0-1)")
    source: str = Field(..., description="Alert source")
    timestamp: str = Field(..., description="Alert timestamp")

class WebhookPayload(BaseModel):
    """Enhanced webhook payload with validation"""
    type: str = Field(..., description="Webhook type")
    data: Dict[str, Any] = Field(..., description="Webhook data")
    priority: Priority = Field(Priority.MEDIUM, description="Processing priority")
    timestamp: str = Field(..., description="Webhook timestamp")
    source: str = Field(..., description="Webhook source")

# PydanticAI Output Models
class RFPAnalysisResult(BaseModel):
    """Structured RFP analysis result"""
    fitScore: int = Field(..., ge=0, le=100, description="Fit score (0-100)")
    significance: str = Field(..., description="Significance level")
    urgency: str = Field(..., description="Urgency level")
    businessImpact: str = Field(..., description="Business impact assessment")
    recommendedActions: List[str] = Field(..., description="Recommended actions")
    riskAssessment: str = Field(..., description="Risk assessment")
    opportunityScore: int = Field(..., ge=0, le=100, description="Opportunity score (0-100)")
    confidenceLevel: int = Field(..., ge=0, le=100, description="Confidence level (0-100)")
    strategicImplications: List[str] = Field(..., description="Strategic implications")
    tacticalRecommendations: List[str] = Field(..., description="Tactical recommendations")
    timingConsiderations: str = Field(..., description="Timing considerations")
    winProbability: int = Field(..., ge=0, le=100, description="Win probability (0-100)")

class EntityEnrichmentResult(BaseModel):
    """Structured entity enrichment result"""
    entityId: str = Field(..., description="Entity ID")
    enrichedData: Dict[str, Any] = Field(..., description="Enriched data")
    confidenceScore: int = Field(..., ge=0, le=100, description="Confidence score")
    dataSource: str = Field(..., description="Data source")
    enrichmentTimestamp: str = Field(..., description="Enrichment timestamp")
    verifiedFields: List[str] = Field(..., description="Verified fields")
    missingFields: List[str] = Field(..., description="Missing fields")
    suggestions: List[str] = Field(..., description="Data improvement suggestions")

class ValidationResult(BaseModel):
    """Data validation result"""
    isValid: bool = Field(..., description="Whether data passed validation")
    errors: List[str] = Field(default_factory=list, description="Validation errors")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")
    confidence: int = Field(..., ge=0, le=100, description="Overall confidence score")
    recommendations: List[str] = Field(default_factory=list, description="Improvement recommendations")

# PydanticAI Agent Dependencies (following existing patterns)
class AgentDependencies:
    """Dependencies for PydanticAI agents"""
    def __init__(self):
        self.validation_rules = self._load_validation_rules()
        self.industry_context = self._load_industry_context()
    
    def _load_validation_rules(self) -> Dict[str, Any]:
        return {
            "required_fields": {
                "company": ["name", "industry", "location"],
                "person": ["name", "role", "company"],
                "rfp": ["title", "organization", "description", "deadline"]
            },
            "quality_thresholds": {
                "min_confidence": 70,
                "completeness_threshold": 80
            }
        }
    
    def _load_industry_context(self) -> Dict[str, Any]:
        return {
            "sports_industry": {
                "key_segments": ["professional_teams", "leagues", "venues", "sports_tech"],
                "procurement_patterns": ["seasonal_planning", "event_based", "technology_upgrades"],
                "decision_makers": ["COO", "CTO", "CFO", "Director of Operations"]
            }
        }

# Initialize PydanticAI agents
deps = AgentDependencies()

rfp_agent = Agent(
    'anthropic:claude-3-5-sonnet-20241022',
    deps_type=AgentDependencies,
    output_type=RFPAnalysisResult,
    instructions="""You are an expert RFP analyst specializing in sports industry opportunities. 
    Analyze RFPs for fit, significance, and strategic value. Provide structured assessment with confidence scoring."""
)

entity_agent = Agent(
    'anthropic:claude-3-5-sonnet-20241022',
    deps_type=AgentDependencies,
    output_type=EntityEnrichmentResult,
    instructions="""You are a business intelligence expert specializing in entity data enrichment. 
    Validate, enhance, and verify entity information with high confidence scoring."""
)

validation_agent = Agent(
    'anthropic:claude-3-5-sonnet-20241022',
    deps_type=AgentDependencies,
    output_type=ValidationResult,
    instructions="""You are a data validation expert. Ensure data quality, completeness, and reliability 
    for RFP intelligence and sports industry data."""
)

# Enhanced Claude Agent Manager (following existing patterns)
class ClaudeAgentManager:
    def __init__(self):
        self.session_cache = {}
        self.mcp_config = {}
        self.token_optimization_cache = {}  # Add token optimization
        
    async def load_mcp_config(self):
        """Load MCP configuration from local file (same as existing)"""
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
        """Get API configuration for Claude Agent SDK (same as existing)"""
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
    
    def _get_checksum(self, data: Dict[str, Any]) -> str:
        """Generate checksum for token optimization"""
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.md5(data_str.encode()).hexdigest()
    
    def _check_cache(self, data_type: str, data: Dict[str, Any]) -> Optional[Any]:
        """Check if we have cached results for this data"""
        checksum = self._get_checksum(data)
        cache_key = f"{data_type}:{checksum}"
        return self.token_optimization_cache.get(cache_key)
    
    def _cache_result(self, data_type: str, data: Dict[str, Any], result: Any):
        """Cache result for future use"""
        checksum = self._get_checksum(data)
        cache_key = f"{data_type}:{checksum}"
        self.token_optimization_cache[cache_key] = result
    
    async def process_streaming_chat(
        self, 
        messages: List[Message], 
        context: Dict[str, Any] = {},
        user_id: str = None
    ) -> AsyncGenerator[str, None]:
        """Process chat with Claude Agent SDK and stream responses (same as existing)"""
        
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
                        "message": "✅ Connected to sports intelligence database with PydanticAI validation"
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
                        "message": "✅ Task completed with validated results"
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
    
    async def validate_rfp_data(self, rfp_data: Dict[str, Any]) -> ValidationResult:
        """Validate RFP data using PydanticAI"""
        try:
            result = await validation_agent.run(
                f"Validate RFP data quality and completeness",
                deps=deps,
                data=rfp_data,
                data_type="rfp"
            )
            return result.output
        except Exception as e:
            return ValidationResult(
                isValid=False,
                errors=[f"Validation failed: {str(e)}"],
                confidence=0
            )
    
    async def analyze_rfp_with_validation(self, rfp_data: Dict[str, Any], entity_context: Optional[Dict[str, Any]] = None) -> RFPAnalysisResult:
        """Analyze RFP with PydanticAI validation and token optimization"""
        
        # Check cache first
        cache_key = f"rfp_analysis:{json.dumps(rfp_data, sort_keys=True)}"
        cached_result = self._check_cache("rfp_analysis", rfp_data)
        if cached_result:
            print(f"💾 Cache hit for RFP analysis: {rfp_data.get('title', 'Unknown')}")
            return cached_result
        
        # Validate data first
        validation_result = await self.validate_rfp_data(rfp_data)
        if not validation_result.isValid:
            raise ValueError(f"RFP data validation failed: {validation_result.errors}")
        
        # Analyze with PydanticAI
        try:
            result = await rfp_agent.run(
                f"Analyze RFP opportunity: {rfp_data.get('title', 'Unknown RFP')}",
                deps=deps,
                rfp_data=rfp_data,
                entity_context=entity_context
            )
            
            # Cache the result
            self._cache_result("rfp_analysis", rfp_data, result.output)
            print(f"✅ RFP analysis completed and cached: {rfp_data.get('title', 'Unknown')}")
            
            return result.output
        except Exception as e:
            raise Exception(f"RFP analysis failed: {str(e)}")
    
    async def enrich_entity_with_validation(self, entity_data: Dict[str, Any]) -> EntityEnrichmentResult:
        """Enrich entity data with PydanticAI validation"""
        
        # Check cache first
        cached_result = self._check_cache("entity_enrichment", entity_data)
        if cached_result:
            print(f"💾 Cache hit for entity enrichment: {entity_data.get('name', 'Unknown')}")
            return cached_result
        
        try:
            result = await entity_agent.run(
                f"Enrich and verify entity data: {entity_data.get('name', 'Unknown Entity')}",
                deps=deps,
                entity_data=entity_data
            )
            
            # Cache the result
            self._cache_result("entity_enrichment", entity_data, result.output)
            print(f"✅ Entity enrichment completed and cached: {entity_data.get('name', 'Unknown')}")
            
            return result.output
        except Exception as e:
            raise Exception(f"Entity enrichment failed: {str(e)}")
    
    def _get_system_prompt(self, context: Dict[str, Any]) -> str:
        """Enhanced system prompt with PydanticAI validation context"""
        base_prompt = """You are a Sports Intelligence AI assistant with access to a Neo4j database containing 3,325+ sports entities. 

You help users analyze sports clubs, identify business opportunities, and find key decision makers. You have access to tools for:
- Querying the Neo4j sports database
- Web search and data scraping
- File system operations
- Memory/knowledge retrieval
- PydanticAI validation for data reliability and structured outputs

All data is validated using PydanticAI to ensure accuracy and reliability. Be helpful, professional, and provide actionable insights."""
        
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
    
    print("🚀 Enhanced RFP Intelligence webhook server started on port 8002")
    print("🎯 PydanticAI validation enabled for data reliability")

@app.get("/")
async def root():
    return {
        "status": "Enhanced RFP Intelligence Server Running",
        "features": [
            "Claude Agent SDK integration",
            "PydanticAI data validation",
            "Token-optimized processing",
            "RFP analysis with confidence scoring",
            "Entity enrichment and verification"
        ]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "mcp_servers": len(agent_manager.mcp_config),
        "pydanticai_agents": 3,
        "cache_size": len(agent_manager.token_optimization_cache)
    }

# Existing CopilotKit endpoints
@app.post("/webhook/chat")
async def chat_webhook(request: ChatRequest):
    """Handle CopilotKit chat requests via webhook (same as existing)"""
    
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

# Enhanced RFP Intelligence endpoints
@app.post("/rfp/analyze")
async def analyze_rfp_endpoint(rfp_data: RFPData, entity_context: Optional[BaseEntity] = None):
    """Analyze RFP with PydanticAI validation"""
    try:
        result = await agent_manager.analyze_rfp_with_validation(
            rfp_data.dict(), 
            entity_context.dict() if entity_context else None
        )
        
        return {
            "success": True,
            "analysis": result.dict(),
            "timestamp": datetime.now().isoformat(),
            "validation_confidence": result.confidenceLevel
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RFP analysis failed: {str(e)}")

@app.post("/entity/enrich")
async def enrich_entity_endpoint(entity_data: BaseEntity):
    """Enrich entity data with PydanticAI validation"""
    try:
        result = await agent_manager.enrich_entity_with_validation(entity_data.dict())
        
        return {
            "success": True,
            "enrichment": result.dict(),
            "timestamp": datetime.now().isoformat(),
            "confidence_score": result.confidenceScore
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Entity enrichment failed: {str(e)}")

@app.post("/webhook/rfp-intelligence")
async def rfp_intelligence_webhook(payload: WebhookPayload, background_tasks: BackgroundTasks):
    """Enhanced webhook processing with PydanticAI validation"""
    webhook_id = f"rfp_webhook_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hashlib.md5(payload.json().encode()).hexdigest()[:8]}"
    
    # Add background processing with validation
    background_tasks.add_task(process_rfp_webhook_background, webhook_id, payload)
    
    return {
        "webhook_id": webhook_id,
        "status": "queued",
        "message": "RFP Intelligence webhook received and queued for PydanticAI processing",
        "timestamp": datetime.now().isoformat()
    }

async def process_rfp_webhook_background(webhook_id: str, payload: WebhookPayload):
    """Background webhook processing with PydanticAI validation"""
    try:
        print(f"🔄 Processing RFP Intelligence webhook: {webhook_id}")
        
        # Process based on webhook type
        if payload.type == "rfp_alert":
            rfp_data = RFPData(**payload.data.get("rfp", {}))
            entity_data = BaseEntity(**payload.data.get("entity", {}))
            
            analysis_result = await agent_manager.analyze_rfp_with_validation(
                rfp_data.dict(),
                entity_data.dict()
            )
            
            print(f"✅ Webhook {webhook_id} processed: RFP analysis complete with confidence {analysis_result.confidenceLevel}%")
            
        elif payload.type == "entity_alert":
            entity_data = BaseEntity(**payload.data.get("entity", {}))
            
            enrichment_result = await agent_manager.enrich_entity_with_validation(entity_data.dict())
            
            print(f"✅ Webhook {webhook_id} processed: Entity enrichment complete with confidence {enrichment_result.confidenceScore}%")
            
        else:
            print(f"⚠️ Webhook {webhook_id} unhandled type: {payload.type}")
            
    except Exception as e:
        print(f"❌ Webhook {webhook_id} processing failed: {str(e)}")

@app.post("/validate/data")
async def validate_data_endpoint(data: Dict[str, Any], data_type: str):
    """Validate any data using PydanticAI"""
    try:
        result = await agent_manager.validate_rfp_data(data)
        return {
            "validation": result.dict(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@app.get("/stats")
async def get_stats():
    """Get processing statistics and cache metrics"""
    return {
        "cache_stats": {
            "size": len(agent_manager.token_optimization_cache),
            "cached_analyses": len([k for k in agent_manager.token_optimization_cache.keys() if "rfp_analysis" in k]),
            "cached_enrichments": len([k for k in agent_manager.token_optimization_cache.keys() if "entity_enrichment" in k])
        },
        "mcp_config": len(agent_manager.mcp_config),
        "active_sessions": len(agent_manager.session_cache),
        "uptime": "running"
    }

# Existing config endpoints
@app.post("/webhook/config")
async def update_config(config: MCPConfig):
    """Update MCP configuration (same as existing)"""
    agent_manager.mcp_config = config.mcpServers
    return {"status": "updated", "servers": list(config.mcpServers.keys())}

@app.get("/config/mcp")
async def get_mcp_config():
    """Get current MCP configuration (same as existing)"""
    return {"mcpServers": agent_manager.mcp_config}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)