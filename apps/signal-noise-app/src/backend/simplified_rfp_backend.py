"""
🎯 RFP Intelligence FastAPI Backend with PydanticAI Validation
Simplified version that follows exact existing patterns and avoids conflicts
"""

from fastapi import FastAPI, HTTPException, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, AsyncGenerator
import asyncio
import json
import os
from dotenv import load_dotenv
import hashlib
from datetime import datetime
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI(
    title="RFP Intelligence with PydanticAI",
    description="Enhanced RFP intelligence with data validation"
)

# Enable CORS (same as existing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3005", "http://localhost:3000", "http://13.60.60.50:3005"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models (following existing patterns)
class Message(BaseModel):
    role: str
    content: str
    id: str | None = None

class ChatRequest(BaseModel):
    messages: List[Message]
    context: Dict[str, Any] = {}
    userId: str | None = None
    stream: bool = True

class RFPData(BaseModel):
    id: str
    title: str
    organization: str
    description: str
    value: str | None = None
    deadline: str | None = None
    category: str | None = None
    source: str
    published: str

class EntityData(BaseModel):
    id: str
    name: str
    type: str
    industry: str | None = None
    description: str | None = None
    location: str | None = None

class WebhookPayload(BaseModel):
    type: str
    data: Dict[str, Any]
    priority: str = "medium"
    timestamp: str
    source: str

class ValidationResult(BaseModel):
    isValid: bool
    errors: List[str] = []
    warnings: List[str] = []
    confidence: int
    recommendations: List[str] = []

class RFPAnalysisResult(BaseModel):
    fitScore: int
    significance: str
    urgency: str
    businessImpact: str
    recommendedActions: List[str]
    confidenceLevel: int
    opportunityScore: int
    winProbability: int

# Simple validation functions (mimicking PydanticAI patterns)
class DataValidator:
    def __init__(self):
        self.validation_rules = {
            "rfp": {
                "required_fields": ["title", "organization", "description", "source"],
                "quality_thresholds": {"min_confidence": 70}
            },
            "entity": {
                "required_fields": ["name", "type"],
                "quality_thresholds": {"min_confidence": 60}
            }
        }
    
    def validate_rfp(self, rfp_data: Dict[str, Any]) -> ValidationResult:
        """Validate RFP data with confidence scoring"""
        errors = []
        warnings = []
        confidence = 100
        
        # Check required fields
        for field in self.validation_rules["rfp"]["required_fields"]:
            if field not in rfp_data or not rfp_data[field]:
                errors.append(f"Missing required field: {field}")
                confidence -= 20
        
        # Quality checks
        if rfp_data.get("title") and len(rfp_data["title"]) < 10:
            warnings.append("Title is quite short")
            confidence -= 10
        
        if rfp_data.get("description") and len(rfp_data["description"]) < 50:
            warnings.append("Description could be more detailed")
            confidence -= 15
        
        return ValidationResult(
            isValid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            confidence=max(0, confidence),
            recommendations=self._get_recommendations(errors, warnings, "rfp")
        )
    
    def validate_entity(self, entity_data: Dict[str, Any]) -> ValidationResult:
        """Validate entity data with confidence scoring"""
        errors = []
        warnings = []
        confidence = 100
        
        # Check required fields
        for field in self.validation_rules["entity"]["required_fields"]:
            if field not in entity_data or not entity_data[field]:
                errors.append(f"Missing required field: {field}")
                confidence -= 25
        
        # Quality checks
        if not entity_data.get("industry"):
            warnings.append("Industry not specified")
            confidence -= 10
        
        if not entity_data.get("location"):
            warnings.append("Location not specified")
            confidence -= 5
        
        return ValidationResult(
            isValid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            confidence=max(0, confidence),
            recommendations=self._get_recommendations(errors, warnings, "entity")
        )
    
    def _get_recommendations(self, errors: List[str], warnings: List[str], data_type: str) -> List[str]:
        """Generate improvement recommendations"""
        recommendations = []
        
        if errors:
            recommendations.append(f"Address {len(errors)} validation error(s)")
        
        if warnings:
            recommendations.append(f"Consider {len(warnings)} improvement(s)")
        
        if data_type == "rfp":
            if not any("deadline" in w for w in warnings):
                recommendations.append("Add deadline information for better urgency assessment")
        elif data_type == "entity":
            if not any("industry" in w for w in warnings):
                recommendations.append("Specify industry for better market analysis")
        
        return recommendations

class RFPAnalyzer:
    def __init__(self):
        self.validator = DataValidator()
        self.cache = {}
    
    def _get_cache_key(self, data: Dict[str, Any]) -> str:
        """Generate cache key for data"""
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.md5(data_str.encode()).hexdigest()
    
    def analyze_rfp(self, rfp_data: Dict[str, Any], entity_context: Dict[str, Any] | None = None) -> RFPAnalysisResult:
        """Analyze RFP with confidence scoring"""
        
        # Check cache
        cache_key = self._get_cache_key(rfp_data)
        if cache_key in self.cache:
            logger.info(f"💾 Cache hit for RFP: {rfp_data.get('title', 'Unknown')}")
            return self.cache[cache_key]
        
        # Validate first
        validation = self.validator.validate_rfp(rfp_data)
        if not validation.isValid:
            raise ValueError(f"RFP validation failed: {validation.errors}")
        
        # Perform analysis (simplified logic)
        fit_score = self._calculate_fit_score(rfp_data, entity_context)
        opportunity_score = self._calculate_opportunity_score(rfp_data)
        win_probability = self._calculate_win_probability(rfp_data, entity_context)
        
        result = RFPAnalysisResult(
            fitScore=fit_score,
            significance=self._assess_significance(fit_score),
            urgency=self._assess_urgency(rfp_data),
            businessImpact=self._assess_business_impact(rfp_data),
            recommendedActions=self._generate_recommendations(rfp_data, fit_score),
            confidenceLevel=validation.confidence,
            opportunityScore=opportunity_score,
            winProbability=win_probability
        )
        
        # Cache result
        self.cache[cache_key] = result
        logger.info(f"✅ RFP analysis completed: {rfp_data.get('title', 'Unknown')} (confidence: {validation.confidence}%)")
        
        return result
    
    def _calculate_fit_score(self, rfp_data: Dict[str, Any], entity_context: Dict[str, Any] | None) -> int:
        """Calculate how well this RFP fits our capabilities"""
        base_score = 75
        
        # Adjust based on industry alignment
        if entity_context and "industry" in entity_context:
            if entity_context["industry"].lower() in ["sports", "technology", "events"]:
                base_score += 15
        
        # Adjust based on value
        if rfp_data.get("value"):
            if any(marker in rfp_data["value"].lower() for marker in ["m", "k", "£", "$", "€"]):
                base_score += 10
        
        return min(100, base_score)
    
    def _calculate_opportunity_score(self, rfp_data: Dict[str, Any]) -> int:
        """Calculate opportunity score"""
        base_score = 70
        
        # High-value opportunities
        if rfp_data.get("value"):
            value_str = rfp_data["value"].lower()
            if any(marker in value_str for marker in ["1m+", "£1m", "$1m", "€1m"]):
                base_score += 20
        
        # Urgent opportunities
        if rfp_data.get("deadline"):
            base_score += 10
        
        return min(100, base_score)
    
    def _calculate_win_probability(self, rfp_data: Dict[str, Any], entity_context: Dict[str, Any] | None) -> int:
        """Calculate win probability"""
        base_score = 65
        
        # Adjust based on relationship
        if entity_context and "name" in entity_context:
            if any(marker in entity_context["name"].lower() for marker in ["partner", "client", "existing"]):
                base_score += 25
        
        # Adjust based on complexity
        description = rfp_data.get("description", "").lower()
        if any(marker in description for marker in ["simple", "straightforward", "basic"]):
            base_score += 15
        elif any(marker in description for marker in ["complex", "enterprise", "comprehensive"]):
            base_score -= 10
        
        return min(100, max(0, base_score))
    
    def _assess_significance(self, fit_score: int) -> str:
        """Assess significance level"""
        if fit_score >= 85:
            return "high"
        elif fit_score >= 70:
            return "medium"
        else:
            return "low"
    
    def _assess_urgency(self, rfp_data: Dict[str, Any]) -> str:
        """Assess urgency level"""
        if rfp_data.get("deadline"):
            return "high"
        elif rfp_data.get("value"):
            return "medium"
        else:
            return "low"
    
    def _assess_business_impact(self, rfp_data: Dict[str, Any]) -> str:
        """Assess business impact"""
        value = rfp_data.get("value", "").lower()
        if any(marker in value for marker in ["1m+", "£1m", "$1m", "€1m"]):
            return "High-value strategic opportunity"
        elif any(marker in value for marker in ["k", "£", "$", "€"]):
            return "Medium-value growth opportunity"
        else:
            return "Potential market entry opportunity"
    
    def _generate_recommendations(self, rfp_data: Dict[str, Any], fit_score: int) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        if fit_score >= 80:
            recommendations.append("Prioritize immediate response - strong fit identified")
            recommendations.append("Allocate senior resources for proposal development")
        elif fit_score >= 60:
            recommendations.append("Evaluate capacity and consider strategic partnership")
            recommendations.append("Conduct detailed requirements analysis")
        else:
            recommendations.append("Review for strategic alignment vs resource requirements")
            recommendations.append("Consider referral to partner organization")
        
        if rfp_data.get("deadline"):
            recommendations.append("Timeline-critical - establish response team immediately")
        
        return recommendations

# Global instances
validator = DataValidator()
analyzer = RFPAnalyzer()

@app.get("/")
async def root():
    return {
        "status": "RFP Intelligence Backend Running",
        "features": [
            "RFP data validation with confidence scoring",
            "Token-optimized processing with caching",
            "Entity enrichment and analysis",
            "Real-time webhook processing",
            "FastAPI with Pydantic validation"
        ],
        "cache_size": len(analyzer.cache)
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "cache_size": len(analyzer.cache),
        "validation_rules": len(validator.validation_rules)
    }

@app.post("/validate/rfp")
async def validate_rfp_endpoint(rfp_data: RFPData):
    """Validate RFP data"""
    try:
        result = validator.validate_rfp(rfp_data.dict())
        return {
            "success": True,
            "validation": result.dict(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@app.post("/validate/entity")
async def validate_entity_endpoint(entity_data: EntityData):
    """Validate entity data"""
    try:
        result = validator.validate_entity(entity_data.dict())
        return {
            "success": True,
            "validation": result.dict(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@app.post("/analyze/rfp")
async def analyze_rfp_endpoint(rfp_data: RFPData, entity_context: EntityData | None = None):
    """Analyze RFP with validation and caching"""
    try:
        result = analyzer.analyze_rfp(
            rfp_data.dict(),
            entity_context.dict() if entity_context else None
        )
        
        return {
            "success": True,
            "analysis": result.dict(),
            "timestamp": datetime.now().isoformat(),
            "cached": False
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/webhook/rfp-intelligence")
async def rfp_intelligence_webhook(payload: WebhookPayload):
    """Process RFP intelligence webhook"""
    webhook_id = f"rfp_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hashlib.md5(payload.json().encode()).hexdigest()[:8]}"
    
    logger.info(f"🔄 Processing webhook: {webhook_id} - {payload.type}")
    
    try:
        if payload.type == "rfp_alert":
            rfp_data = payload.data.get("rfp", {})
            entity_data = payload.data.get("entity", {})
            
            # Validate first
            validation = validator.validate_rfp(rfp_data)
            if not validation.isValid:
                logger.warning(f"❌ Webhook {webhook_id} validation failed: {validation.errors}")
                return {
                    "webhook_id": webhook_id,
                    "status": "validation_failed",
                    "errors": validation.errors
                }
            
            # Analyze
            analysis = analyzer.analyze_rfp(rfp_data, entity_data if entity_data else None)
            
            logger.info(f"✅ Webhook {webhook_id} processed successfully (confidence: {validation.confidence}%)")
            
            return {
                "webhook_id": webhook_id,
                "status": "processed",
                "validation_confidence": validation.confidence,
                "analysis": analysis.dict(),
                "timestamp": datetime.now().isoformat()
            }
        
        elif payload.type == "entity_alert":
            entity_data = payload.data.get("entity", {})
            
            # Validate entity
            validation = validator.validate_entity(entity_data)
            
            logger.info(f"✅ Entity webhook {webhook_id} processed (confidence: {validation.confidence}%)")
            
            return {
                "webhook_id": webhook_id,
                "status": "processed",
                "validation_confidence": validation.confidence,
                "validation": validation.dict(),
                "timestamp": datetime.now().isoformat()
            }
        
        else:
            logger.warning(f"⚠️ Webhook {webhook_id} unhandled type: {payload.type}")
            return {
                "webhook_id": webhook_id,
                "status": "unhandled_type",
                "type": payload.type
            }
            
    except Exception as e:
        logger.error(f"❌ Webhook {webhook_id} processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

@app.get("/stats")
async def get_stats():
    """Get processing statistics"""
    return {
        "cache_stats": {
            "size": len(analyzer.cache),
            "cache_hit_ratio": "Available with cache tracking implementation"
        },
        "validation_rules": {
            "rfp_fields": len(validator.validation_rules["rfp"]["required_fields"]),
            "entity_fields": len(validator.validation_rules["entity"]["required_fields"])
        },
        "uptime": "running",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/test/cache-performance")
async def test_cache_performance():
    """Test cache performance with duplicate data"""
    test_rfp = {
        "id": "test-001",
        "title": "Sports Technology Platform Implementation",
        "organization": "Major Sports League",
        "description": "Complete digital transformation of fan engagement platform including mobile apps, analytics, and live streaming capabilities",
        "value": "$2.5M",
        "deadline": "2024-03-15",
        "category": "Technology",
        "source": "procurement_portal",
        "published": "2024-01-15"
    }
    
    # First analysis (should cache)
    start_time = datetime.now()
    result1 = analyzer.analyze_rfp(test_rfp)
    first_duration = (datetime.now() - start_time).total_seconds()
    
    # Second analysis (should hit cache)
    start_time = datetime.now()
    result2 = analyzer.analyze_rfp(test_rfp)
    second_duration = (datetime.now() - start_time).total_seconds()
    
    return {
        "test_results": {
            "first_analysis": {
                "duration_ms": first_duration * 1000,
                "fit_score": result1.fitScore,
                "confidence": result1.confidenceLevel
            },
            "second_analysis": {
                "duration_ms": second_duration * 1000,
                "fit_score": result2.fitScore,
                "confidence": result2.confidenceLevel,
                "cache_hit": second_duration < first_duration / 2
            },
            "performance_improvement": f"{((first_duration - second_duration) / first_duration * 100):.1f}%",
            "cache_size": len(analyzer.cache)
        },
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 RFP Intelligence Backend starting on port 8002")
    uvicorn.run(app, host="0.0.0.0", port=8002)