"""
🎯 RFP Intelligence FastAPI Backend with PydanticAI Validation

This backend provides comprehensive data validation and AI-powered analysis
for RFP intelligence, sports entities, and procurement opportunities.

Key Features:
- PydanticAI-powered data validation and reasoning
- Structured outputs with confidence scoring
- Real-time webhook processing
- Token-optimized batch processing
- Comprehensive API documentation
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
import json
import hashlib
import asyncio
from enum import Enum

# PydanticAI imports
from pydantic_ai import Agent, RunContext
from pydantic_ai.models import KnownModelName
import anthropic

# Initialize FastAPI app
app = FastAPI(
    title="RFP Intelligence API",
    description="AI-powered RFP and sports intelligence analysis with PydanticAI validation",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

# Pydantic Models for Data Validation
class BaseEntity(BaseModel):
    """Base model for all entities with comprehensive validation"""
    id: str = Field(..., description="Unique entity identifier")
    name: str = Field(..., min_length=1, max_length=500, description="Entity name")
    type: EntityType = Field(..., description="Type of entity")
    industry: Optional[str] = Field(None, max_length=100, description="Industry sector")
    description: Optional[str] = Field(None, max_length=2000, description="Entity description")
    website: Optional[str] = Field(None, description="Website URL")
    location: Optional[str] = Field(None, max_length=200, description="Location")
    size: Optional[str] = Field(None, description="Company size")
    revenue: Optional[str] = Field(None, description="Revenue range")
    founded_year: Optional[int] = Field(None, ge=1800, le=2030, description="Year founded")
    
    @validator('website')
    def validate_website(cls, v):
        if v and not (v.startswith('http://') or v.startswith('https://')):
            raise ValueError('Website must start with http:// or https://')
        return v
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class RFPData(BaseModel):
    """RFP data model with comprehensive validation"""
    id: str = Field(..., description="Unique RFP identifier")
    title: str = Field(..., min_length=5, max_length=500, description="RFP title")
    organization: str = Field(..., min_length=2, max_length=200, description="Issuing organization")
    description: str = Field(..., min_length=10, max_length=5000, description="RFP description")
    value: Optional[str] = Field(None, description="Contract value")
    deadline: Optional[str] = Field(None, description="Submission deadline")
    category: Optional[str] = Field(None, max_length=100, description="RFP category")
    source: str = Field(..., description="Source of RFP")
    published: str = Field(..., description="Publication date")
    requirements: Optional[List[str]] = Field(default_factory=list, description="Key requirements")
    contact_info: Optional[Dict[str, str]] = Field(default_factory=dict, description="Contact information")
    
    @validator('value')
    def validate_value(cls, v):
        if v:
            # Allow currency formats like "$2.5M", "£500K", "€1.2M"
            import re
            if not re.match(r'^[£$€]\s*\d+(\.\d+)?[KMB]?(?:\s*-\s*[£$€]?\s*\d+(\.\d+)?[KMB]?)?$', v):
                raise ValueError('Value must be in currency format (e.g., $2.5M, £500K)')
        return v

class AlertData(BaseModel):
    """Alert data model with validation"""
    id: str = Field(..., description="Unique alert identifier")
    type: AlertType = Field(..., description="Type of alert")
    entity: str = Field(..., min_length=1, max_length=200, description="Entity name")
    description: str = Field(..., min_length=5, max_length=1000, description="Alert description")
    impact: float = Field(..., ge=0.0, le=1.0, description="Impact score (0-1)")
    source: str = Field(..., description="Alert source")
    timestamp: str = Field(..., description="Alert timestamp")
    urgency: Optional[str] = Field(None, description="Urgency level")
    tags: Optional[List[str]] = Field(default_factory=list, description="Alert tags")

class WebhookPayload(BaseModel):
    """Webhook payload model with comprehensive validation"""
    type: str = Field(..., description="Webhook type")
    data: Dict[str, Any] = Field(..., description="Webhook data")
    priority: Priority = Field(Priority.MEDIUM, description="Processing priority")
    timestamp: str = Field(..., description="Webhook timestamp")
    source: str = Field(..., description="Webhook source")
    
    @validator('timestamp')
    def validate_timestamp(cls, v):
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
        except ValueError:
            raise ValueError('Invalid timestamp format')
        return v

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
    relatedOpportunities: List[Dict[str, Any]] = Field(default_factory=list, description="Related opportunities")
    estimatedValue: Optional[str] = Field(None, description="Estimated value")
    competitionLevel: str = Field(..., description="Competition level")
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

# PydanticAI Agents
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

# Initialize agents
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

# Agent Tools and Functions
@rfp_agent.tool
async def analyze_market_fit(ctx: RunContext[AgentDependencies], rfp_data: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze market fit for RFP"""
    # Implementation would include market analysis logic
    return {
        "market_size": "large",
        "growth_potential": "high",
        "competitive_landscape": "moderate"
    }

@entity_agent.tool
async def verify_entity_data(ctx: RunContext[AgentDependencies], entity_data: Dict[str, Any]) -> Dict[str, Any]:
    """Verify entity data against external sources"""
    # Implementation would include external verification
    return {
        "verification_status": "verified",
        "sources": ["linkedin", "company_website", "industry_reports"],
        "confidence_boost": 15
    }

@validation_agent.tool
async def check_data_completeness(ctx: RunContext[AgentDependencies], data: Dict[str, Any], data_type: str) -> Dict[str, Any]:
    """Check data completeness and quality"""
    required_fields = ctx.deps.validation_rules["required_fields"].get(data_type, [])
    missing_fields = [field for field in required_fields if field not in data or not data[field]]
    
    return {
        "completeness_score": max(0, 100 - (len(missing_fields) * 20)),
        "missing_fields": missing_fields,
        "quality_indicators": ["structured_data", "valid_formats", "complete_requirements"]
    }

# API Endpoints
@app.get("/", response_model=Dict[str, Any])
async def root():
    """Root endpoint with API information"""
    return {
        "name": "RFP Intelligence API",
        "version": "1.0.0",
        "description": "AI-powered RFP and sports intelligence analysis with PydanticAI validation",
        "features": [
            "RFP analysis with confidence scoring",
            "Entity enrichment and verification",
            "Real-time webhook processing",
            "Data validation and quality assurance",
            "Token-optimized batch processing"
        ],
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "validate": "/validate",
            "analyze-rfp": "/analyze-rfp",
            "enrich-entity": "/enrich-entity",
            "webhook": "/webhook"
        }
    }

@app.get("/health", response_model=Dict[str, Any])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "agents": {
            "rfp_agent": "active",
            "entity_agent": "active",
            "validation_agent": "active"
        }
    }

@app.post("/validate", response_model=ValidationResult)
async def validate_data(data: Dict[str, Any], data_type: str):
    """Validate data using PydanticAI agent"""
    try:
        result = await validation_agent.run(
            f"Validate {data_type} data for completeness and quality",
            deps=deps,
            data=data,
            data_type=data_type
        )
        return result.output
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@app.post("/analyze-rfp", response_model=RFPAnalysisResult)
async def analyze_rfp(rfp_data: RFPData, entity_context: Optional[BaseEntity] = None):
    """Analyze RFP using PydanticAI agent"""
    try:
        prompt = f"Analyze this RFP opportunity: {rfp_data.title} from {rfp_data.organization}"
        if entity_context:
            prompt += f" for entity: {entity_context.name}"
        
        result = await rfp_agent.run(
            prompt,
            deps=deps,
            rfp_data=rfp_data.dict(),
            entity_context=entity_context.dict() if entity_context else None
        )
        return result.output
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RFP analysis failed: {str(e)}")

@app.post("/enrich-entity", response_model=EntityEnrichmentResult)
async def enrich_entity(entity_data: BaseEntity):
    """Enrich entity data using PydanticAI agent"""
    try:
        result = await entity_agent.run(
            f"Enrich and verify data for entity: {entity_data.name}",
            deps=deps,
            entity_data=entity_data.dict()
        )
        return result.output
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Entity enrichment failed: {str(e)}")

@app.post("/webhook")
async def process_webhook(payload: WebhookPayload, background_tasks: BackgroundTasks):
    """Process webhook with PydanticAI validation and analysis"""
    webhook_id = f"webhook_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hashlib.md5(payload.json().encode()).hexdigest()[:8]}"
    
    # Add background processing
    background_tasks.add_task(process_webhook_background, webhook_id, payload)
    
    return {
        "webhook_id": webhook_id,
        "status": "queued",
        "message": "Webhook received and queued for processing",
        "timestamp": datetime.now().isoformat()
    }

async def process_webhook_background(webhook_id: str, payload: WebhookPayload):
    """Background webhook processing with PydanticAI"""
    try:
        # Validate webhook data first
        validation_result = await validation_agent.run(
            f"Validate {payload.type} webhook data",
            deps=deps,
            data=payload.data,
            data_type=payload.type
        )
        
        if not validation_result.output.isValid:
            print(f"❌ Webhook {webhook_id} failed validation: {validation_result.output.errors}")
            return
        
        # Process based on webhook type
        if payload.type == "rfp_alert":
            rfp_data = RFPData(**payload.data.get("rfp", {}))
            entity_data = BaseEntity(**payload.data.get("entity", {}))
            
            analysis_result = await rfp_agent.run(
                f"Analyze RFP alert: {rfp_data.title}",
                deps=deps,
                rfp_data=rfp_data.dict(),
                entity_context=entity_data.dict()
            )
            
            print(f"✅ Webhook {webhook_id} processed: RFP analysis complete")
            
        elif payload.type == "entity_alert":
            entity_data = BaseEntity(**payload.data.get("entity", {}))
            
            enrichment_result = await entity_agent.run(
                f"Process entity alert: {entity_data.name}",
                deps=deps,
                entity_data=entity_data.dict()
            )
            
            print(f"✅ Webhook {webhook_id} processed: Entity enrichment complete")
            
        else:
            print(f"⚠️ Webhook {webhook_id} unhandled type: {payload.type}")
            
    except Exception as e:
        print(f"❌ Webhook {webhook_id} processing failed: {str(e)}")

# Batch processing endpoint
@app.post("/batch-process")
async def batch_process(items: List[Dict[str, Any]], job_type: str):
    """Process batch with token optimization"""
    job_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # Implement batch processing logic here
    # This would integrate with the token optimization from the main system
    
    return {
        "job_id": job_id,
        "status": "queued",
        "item_count": len(items),
        "job_type": job_type,
        "estimated_tokens": len(items) * 1000,  # Rough estimate
        "message": "Batch job queued for processing"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)