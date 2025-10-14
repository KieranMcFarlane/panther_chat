#!/usr/bin/env python3
"""
Pydantic-AI Validation Service
Provides actual Pydantic validation using pydantic-ai framework
Communicates with the main TypeScript application via HTTP API
"""

from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from pydantic import BaseModel, Field, ValidationError, HttpUrl, validator
import json
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Pydantic-AI Validation Service", version="1.0.0")

# Enhanced Pydantic Models for Webhook Validation
class WebhookPayloadModel(BaseModel):
    """Enhanced webhook payload model with Pydantic validation"""
    source: str = Field(..., description="Source of the webhook data")
    content: str = Field(..., min_length=1, max_length=5000, description="Main content")
    url: Optional[HttpUrl] = Field(None, description="Optional URL reference")
    keywords: List[str] = Field(..., min_items=1, max_items=50, description="Keywords extracted")
    timestamp: datetime = Field(..., description="Timestamp of the data")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence score")
    entity_id: Optional[str] = Field(None, description="Associated entity ID")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

    class Config:
        # Validate source field against allowed values
        validate_assignment = True
        extra = "forbid"

    @validator('source')
    def validate_source(cls, v):
        allowed_sources = ['linkedin', 'news', 'web', 'procurement', 'api', 'job_postings']
        if v not in allowed_sources:
            raise ValueError(f"Source must be one of: {allowed_sources}")
        return v

    @validator('keywords')
    def validate_keywords(cls, v):
        # Remove empty strings and validate keyword quality
        keywords = [kw.strip() for kw in v if kw.strip()]
        if len(keywords) != len(v):
            raise ValueError("Keywords cannot be empty strings")
        
        # Check for minimum keyword length
        if any(len(kw) < 2 for kw in keywords):
            raise ValueError("All keywords must be at least 2 characters long")
        
        return keywords

class KeywordMineModel(BaseModel):
    """Enhanced keyword mine model with Pydantic validation"""
    entity_name: str = Field(..., min_length=1, max_length=200, description="Entity name")
    entity_type: str = Field(..., description="Type of entity")
    keywords: List[str] = Field(..., min_items=1, max_items=50, description="Keywords to monitor")
    alert_threshold: float = Field(..., ge=0.0, le=100.0, description="Alert threshold percentage")
    priority_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Priority score")
    monitoring_sources: List[Dict[str, Any]] = Field(default_factory=list, description="Monitoring sources")
    is_active: bool = Field(True, description="Whether the mine is active")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    @validator('entity_type')
    def validate_entity_type(cls, v):
        allowed_types = ['Entity', 'Organization', 'Person', 'RFP', 'Opportunity']
        if v not in allowed_types:
            raise ValueError(f"Entity type must be one of: {allowed_types}")
        return v

    @validator('keywords')
    def validate_keywords(cls, v):
        keywords = [kw.strip().lower() for kw in v if kw.strip()]
        if len(set(keywords)) != len(keywords):
            raise ValueError("Keywords must be unique")
        return keywords

class AnalysisResultModel(BaseModel):
    """Enhanced analysis result model with Pydantic validation"""
    entity_id: str = Field(..., description="Entity identifier")
    entity_name: str = Field(..., description="Entity name")
    analysis_type: str = Field(..., description="Type of analysis performed")
    business_impact: str = Field(..., description="Business impact assessment")
    urgency_score: float = Field(..., ge=0.0, le=100.0, description="Urgency score (0-100)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence level")
    recommendations: List[str] = Field(..., min_items=0, description="Generated recommendations")
    keywords_matched: List[str] = Field(..., min_items=0, description="Keywords that matched")
    analysis_metadata: Dict[str, Any] = Field(..., description="Analysis metadata")
    timestamp: datetime = Field(..., description="Analysis timestamp")

    @validator('analysis_type')
    def validate_analysis_type(cls, v):
        allowed_types = ['opportunity', 'threat', 'partnership', 'procurement', 'market_analysis']
        if v not in allowed_types:
            raise ValueError(f"Analysis type must be one of: {allowed_types}")
        return v

    @validator('urgency_score')
    def validate_urgency_score(cls, v):
        if v < 0 or v > 100:
            raise ValueError("Urgency score must be between 0 and 100")
        return v

class ReasoningTaskModel(BaseModel):
    """Enhanced reasoning task model with Pydantic validation"""
    task_id: str = Field(..., description="Unique task identifier")
    entity_id: str = Field(..., description="Associated entity")
    task_type: str = Field(..., description="Type of reasoning task")
    input_data: Dict[str, Any] = Field(..., description="Input data for reasoning")
    status: str = Field(..., description="Task status")
    result: Optional[Dict[str, Any]] = Field(None, description="Task result")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    processing_time_ms: Optional[int] = Field(None, ge=0, description="Processing time in milliseconds")
    created_at: datetime = Field(..., description="Task creation time")
    completed_at: Optional[datetime] = Field(None, description="Task completion time")

    @validator('task_type')
    def validate_task_type(cls, v):
        allowed_types = ['entity_analysis', 'business_impact', 'recommendation', 'context_enrichment']
        if v not in allowed_types:
            raise ValueError(f"Task type must be one of: {allowed_types}")
        return v

    @validator('status')
    def validate_status(cls, v):
        allowed_statuses = ['pending', 'processing', 'completed', 'failed']
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of: {allowed_statuses}")
        return v

# Validation Endpoints
@app.post("/validate/webhook", response_model=Dict[str, Any])
async def validate_webhook_payload(request: Request):
    """Validate webhook payload using Pydantic models"""
    try:
        data = await request.json()
        
        # Validate using Pydantic model
        validated_payload = WebhookPayloadModel(**data)
        
        # Return validated data with success response
        return {
            "status": "valid",
            "validated_data": validated_payload.dict(),
            "validation_metadata": {
                "source": validated_payload.source,
                "content_length": len(validated_payload.content),
                "keyword_count": len(validated_payload.keywords),
                "has_confidence": validated_payload.confidence is not None,
                "has_url": validated_payload.url is not None
            }
        }
    
    except ValidationError as e:
        logger.error(f"Validation error: {e}")
        return JSONResponse(
            status_code=400,
            content={
                "status": "invalid",
                "error": "Pydantic validation failed",
                "validation_errors": [
                    {
                        "field": ".".join(str(x) for x in error["loc"]),
                        "message": error["msg"],
                        "type": error["type"]
                    } for error in e.errors()
                ]
            }
        )
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "error": "Internal validation service error",
                "message": str(e)
            }
        )

@app.post("/validate/keyword-mine", response_model=Dict[str, Any])
async def validate_keyword_mine(request: Request):
    """Validate keyword mine data using Pydantic models"""
    try:
        data = await request.json()
        
        # Validate using Pydantic model
        validated_mine = KeywordMineModel(**data)
        
        return {
            "status": "valid",
            "validated_data": validated_mine.dict(),
            "validation_metadata": {
                "entity_name": validated_mine.entity_name,
                "entity_type": validated_mine.entity_type,
                "keyword_count": len(validated_mine.keywords),
                "priority_score": validated_mine.priority_score,
                "is_active": validated_mine.is_active
            }
        }
    
    except ValidationError as e:
        return JSONResponse(
            status_code=400,
            content={
                "status": "invalid",
                "error": "Pydantic validation failed",
                "validation_errors": [
                    {
                        "field": ".".join(str(x) for x in error["loc"]),
                        "message": error["msg"],
                        "type": error["type"]
                    } for error in e.errors()
                ]
            }
        )

@app.post("/validate/analysis-result", response_model=Dict[str, Any])
async def validate_analysis_result(request: Request):
    """Validate analysis result using Pydantic models"""
    try:
        data = await request.json()
        
        # Validate using Pydantic model
        validated_result = AnalysisResultModel(**data)
        
        return {
            "status": "valid",
            "validated_data": validated_result.dict(),
            "validation_metadata": {
                "entity_id": validated_result.entity_id,
                "analysis_type": validated_result.analysis_type,
                "urgency_score": validated_result.urgency_score,
                "confidence": validated_result.confidence,
                "recommendation_count": len(validated_result.recommendations)
            }
        }
    
    except ValidationError as e:
        return JSONResponse(
            status_code=400,
            content={
                "status": "invalid",
                "error": "Pydantic validation failed",
                "validation_errors": [
                    {
                        "field": ".".join(str(x) for x in error["loc"]),
                        "message": error["msg"],
                        "type": error["type"]
                    } for error in e.errors()
                ]
            }
        )

@app.post("/validate/reasoning-task", response_model=Dict[str, Any])
async def validate_reasoning_task(request: Request):
    """Validate reasoning task using Pydantic models"""
    try:
        data = await request.json()
        
        # Validate using Pydantic model
        validated_task = ReasoningTaskModel(**data)
        
        return {
            "status": "valid",
            "validated_data": validated_task.dict(),
            "validation_metadata": {
                "task_id": validated_task.task_id,
                "task_type": validated_task.task_type,
                "status": validated_task.status,
                "processing_time_ms": validated_task.processing_time_ms
            }
        }
    
    except ValidationError as e:
        return JSONResponse(
            status_code=400,
            content={
                "status": "invalid",
                "error": "Pydantic validation failed",
                "validation_errors": [
                    {
                        "field": ".".join(str(x) for x in error["loc"]),
                        "message": error["msg"],
                        "type": error["type"]
                    } for error in e.errors()
                ]
            }
        )

@app.get("/health", response_model=Dict[str, Any])
async def health_check():
    """Health check endpoint for the validation service"""
    return {
        "status": "healthy",
        "service": "Pydantic-AI Validation Service",
        "version": "1.0.0",
        "features": [
            "Pydantic validation for webhook payloads",
            "Keyword mine validation",
            "Analysis result validation",
            "Reasoning task validation",
            "Enhanced error reporting"
        ],
        "supported_models": [
            "WebhookPayloadModel",
            "KeywordMineModel", 
            "AnalysisResultModel",
            "ReasoningTaskModel"
        ],
        "timestamp": datetime.utcnow().isoformat()
    }

# Advanced validation endpoint with enhanced features
@app.post("/validate/advanced", response_model=Dict[str, Any])
async def advanced_validation(request: Request):
    """Advanced validation with enhanced business logic"""
    try:
        data = await request.json()
        validation_type = data.get("type", "webhook")
        payload = data.get("data", {})
        
        # Route to appropriate validator
        if validation_type == "webhook":
            model = WebhookPayloadModel
        elif validation_type == "keyword_mine":
            model = KeywordMineModel
        elif validation_type == "analysis_result":
            model = AnalysisResultModel
        elif validation_type == "reasoning_task":
            model = ReasoningTaskModel
        else:
            raise ValueError(f"Unknown validation type: {validation_type}")
        
        # Validate with enhanced business logic
        validated_data = model(**payload)
        
        # Perform additional business logic validation
        warnings = []
        enhancements = {}
        
        if validation_type == "webhook":
            # Enhanced webhook validation
            if len(validated_data.content) > 3000:
                warnings.append("Content is quite long, may impact processing performance")
            
            if len(validated_data.keywords) > 20:
                warnings.append("Large number of keywords may reduce matching accuracy")
            
            # Calculate keyword quality score
            avg_keyword_length = sum(len(kw) for kw in validated_data.keywords) / len(validated_data.keywords)
            enhancements["keyword_quality_score"] = min(avg_keyword_length / 10, 1.0)
            
            # Content sentiment estimation (basic)
            positive_words = ["opportunity", "partnership", "success", "growth", "innovation"]
            negative_words = ["risk", "challenge", "issue", "problem", "concern"]
            
            positive_count = sum(1 for word in positive_words if word in validated_data.content.lower())
            negative_count = sum(1 for word in negative_words if word in validated_data.content.lower())
            
            if positive_count > negative_count:
                enhancements["sentiment"] = "positive"
            elif negative_count > positive_count:
                enhancements["sentiment"] = "negative"
            else:
                enhancements["sentiment"] = "neutral"
        
        return {
            "status": "valid",
            "validation_type": validation_type,
            "validated_data": validated_data.dict(),
            "warnings": warnings,
            "enhancements": enhancements,
            "validation_metadata": {
                "model_used": model.__name__,
                "validation_timestamp": datetime.utcnow().isoformat(),
                "enhanced_features_enabled": True
            }
        }
    
    except ValidationError as e:
        return JSONResponse(
            status_code=400,
            content={
                "status": "invalid",
                "error": "Pydantic validation failed",
                "validation_errors": [
                    {
                        "field": ".".join(str(x) for x in error["loc"]),
                        "message": error["msg"],
                        "type": error["type"]
                    } for error in e.errors()
                ]
            }
        )

if __name__ == "__main__":
    print("🐍 Starting Pydantic-AI Validation Service...")
    print("📊 Available validation endpoints:")
    print("   POST /validate/webhook - Validate webhook payloads")
    print("   POST /validate/keyword-mine - Validate keyword mines")
    print("   POST /validate/analysis-result - Validate analysis results")
    print("   POST /validate/reasoning-task - Validate reasoning tasks")
    print("   POST /validate/advanced - Advanced validation with business logic")
    print("   GET /health - Health check")
    print("\n🚀 Service starting on http://localhost:8001")
    
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")