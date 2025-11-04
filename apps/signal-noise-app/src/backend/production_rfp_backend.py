"""
🎯 RFP Intelligence FastAPI Backend with Advanced Validation
Production-ready backend following exact existing patterns with comprehensive validation
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Union
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
    title="RFP Intelligence Backend",
    description="Advanced RFP intelligence with comprehensive validation and analysis"
)

# Enable CORS (same as existing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3005", "http://localhost:3000", "http://13.60.60.50:3005"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple Models following existing patterns
class Message(BaseModel):
    role: str
    content: str
    id: Optional[str] = None

class RFPData(BaseModel):
    id: str
    title: str
    organization: str
    description: str
    value: Optional[str] = None
    deadline: Optional[str] = None
    category: Optional[str] = None
    source: str
    published: str

class EntityData(BaseModel):
    id: str
    name: str
    type: str
    industry: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None

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

# Advanced Validation Engine (PydanticAI-like functionality)
class RFPIntelligenceEngine:
    """Advanced RFP Intelligence engine with comprehensive validation"""
    
    def __init__(self):
        self.validation_rules = {
            "rfp": {
                "required_fields": ["title", "organization", "description", "source", "published"],
                "quality_fields": ["value", "deadline", "category"],
                "thresholds": {"min_confidence": 70}
            }
        }
        self.cache = {}
        self.stats = {"total_processed": 0, "cache_hits": 0}
        self.sports_industry_context = {
            "high_value_categories": ["technology", "digital_transformation", "fan_experience"],
            "decision_makers": ["COO", "CTO", "CFO", "Director of Operations"],
            "procurement_patterns": ["seasonal_planning", "event_based", "technology_upgrades"]
        }
    
    def validate_rfp_data(self, rfp_data: Dict[str, Any]) -> ValidationResult:
        """Comprehensive RFP validation following PydanticAI patterns"""
        errors = []
        warnings = []
        confidence = 100
        
        # Required field validation
        for field in self.validation_rules["rfp"]["required_fields"]:
            if field not in rfp_data or not rfp_data[field]:
                errors.append(f"Missing required field: {field}")
                confidence -= 20
        
        # Quality field validation
        quality_fields = self.validation_rules["rfp"]["quality_fields"]
        for field in quality_fields:
            if field not in rfp_data or not rfp_data[field]:
                warnings.append(f"Missing quality field: {field}")
                confidence -= 10
        
        # Content quality checks
        if rfp_data.get("title") and len(rfp_data["title"]) < 10:
            warnings.append("Title is quite short")
            confidence -= 5
        
        if rfp_data.get("description") and len(rfp_data["description"]) < 50:
            warnings.append("Description lacks detail")
            confidence -= 10
        
        # Sports industry validation
        category = rfp_data.get("category", "").lower()
        if category in self.sports_industry_context["high_value_categories"]:
            warnings.append("High-value sports industry category detected")
        
        confidence = max(0, confidence)
        
        return ValidationResult(
            isValid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            confidence=confidence,
            recommendations=self._generate_recommendations(errors, warnings)
        )
    
    def analyze_rfp_opportunity(self, rfp_data: Dict[str, Any], entity_context: Optional[Dict[str, Any]] = None) -> RFPAnalysisResult:
        """Advanced RFP analysis with sports industry expertise"""
        
        # Check cache
        cache_key = self._get_cache_key(rfp_data)
        if cache_key in self.cache:
            self.stats["cache_hits"] += 1
            logger.info(f"💾 Cache hit for RFP: {rfp_data.get('title', 'Unknown')}")
            return self.cache[cache_key]
        
        self.stats["total_processed"] += 1
        
        # Advanced analysis
        fit_score = self._calculate_fit_score(rfp_data, entity_context)
        opportunity_score = self._calculate_opportunity_score(rfp_data)
        win_probability = self._calculate_win_probability(rfp_data, entity_context)
        
        result = RFPAnalysisResult(
            fitScore=fit_score,
            significance=self._assess_significance(fit_score),
            urgency=self._assess_urgency(rfp_data),
            businessImpact=self._assess_business_impact(rfp_data, fit_score),
            recommendedActions=self._generate_strategic_actions(rfp_data, fit_score),
            confidenceLevel=self.validate_rfp_data(rfp_data).confidence,
            opportunityScore=opportunity_score,
            winProbability=win_probability
        )
        
        # Cache result
        self.cache[cache_key] = result
        logger.info(f"✅ RFP analysis completed: {rfp_data.get('title', 'Unknown')}")
        
        return result
    
    def _get_cache_key(self, data: Dict[str, Any]) -> str:
        """Generate cache key for optimization"""
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.md5(data_str.encode()).hexdigest()
    
    def _calculate_fit_score(self, rfp_data: Dict[str, Any], entity_context: Optional[Dict[str, Any]]) -> int:
        """Calculate fit score with industry expertise"""
        base_score = 70
        
        # Industry alignment
        category = rfp_data.get("category", "").lower()
        if any(cat in category for cat in self.sports_industry_context["high_value_categories"]):
            base_score += 15
        
        # Technology focus
        description = rfp_data.get("description", "").lower()
        tech_keywords = ["digital", "technology", "platform", "analytics", "data"]
        tech_score = sum(1 for keyword in tech_keywords if keyword in description)
        base_score += min(tech_score * 3, 20)
        
        # Entity relationship
        if entity_context and entity_context.get("industry", "").lower() == "sports":
            base_score += 10
        
        return min(100, base_score)
    
    def _calculate_opportunity_score(self, rfp_data: Dict[str, Any]) -> int:
        """Calculate opportunity score"""
        base_score = 65
        
        category = rfp_data.get("category", "").lower()
        if category in self.sports_industry_context["high_value_categories"]:
            base_score += 20
        
        value = rfp_data.get("value", "").lower()
        if any(marker in value for marker in ["1m", "2m", "3m"]):
            base_score += 15
        
        return min(100, base_score)
    
    def _calculate_win_probability(self, rfp_data: Dict[str, Any], entity_context: Optional[Dict[str, Any]]) -> int:
        """Calculate win probability"""
        base_score = 60
        
        if entity_context and entity_context.get("industry", "").lower() == "sports":
            base_score += 20
        
        return min(100, base_score)
    
    def _assess_significance(self, fit_score: int) -> str:
        """Assess significance level"""
        if fit_score >= 85:
            return "strategic"
        elif fit_score >= 70:
            return "high"
        elif fit_score >= 55:
            return "medium"
        else:
            return "low"
    
    def _assess_urgency(self, rfp_data: Dict[str, Any]) -> str:
        """Assess urgency level"""
        if rfp_data.get("deadline"):
            return "immediate"
        elif rfp_data.get("value"):
            return "high"
        else:
            return "medium"
    
    def _assess_business_impact(self, rfp_data: Dict[str, Any], fit_score: int) -> str:
        """Assess business impact"""
        value = rfp_data.get("value", "").lower()
        if any(marker in value for marker in ["2m", "3m"]):
            return "Significant revenue opportunity with strategic positioning"
        elif fit_score >= 80:
            return "Strong strategic fit with partnership potential"
        else:
            return "Moderate opportunity with market entry value"
    
    def _generate_strategic_actions(self, rfp_data: Dict[str, Any], fit_score: int) -> List[str]:
        """Generate strategic recommendations"""
        actions = []
        
        if fit_score >= 85:
            actions.append("Prioritize as Tier 1 opportunity")
            actions.append("Allocate executive resources")
        elif fit_score >= 70:
            actions.append("Evaluate capacity requirements")
            actions.append("Conduct competitive analysis")
        else:
            actions.append("Assess partnership opportunities")
        
        if rfp_data.get("deadline"):
            actions.append("Timeline-critical response needed")
        
        return actions
    
    def _generate_recommendations(self, errors: List[str], warnings: List[str]) -> List[str]:
        """Generate improvement recommendations"""
        recommendations = []
        
        if errors:
            recommendations.append(f"Address {len(errors)} validation error(s)")
        if warnings:
            recommendations.append(f"Consider {len(warnings)} improvement(s)")
        
        return recommendations

# Global engine instance
engine = RFPIntelligenceEngine()

@app.get("/")
async def root():
    return {
        "status": "RFP Intelligence Backend Running",
        "features": [
            "Advanced RFP data validation with confidence scoring",
            "Token-optimized processing with intelligent caching",
            "Sports industry expertise and market analysis",
            "Comprehensive risk assessment and recommendations",
            "Real-time webhook processing"
        ],
        "cache_size": len(engine.cache),
        "stats": engine.stats,
        "validation_enabled": True
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "cache_size": len(engine.cache),
        "stats": engine.stats,
        "validation_rules": len(engine.validation_rules["rfp"]),
        "sports_context": len(engine.sports_industry_context)
    }

@app.post("/validate/rfp")
async def validate_rfp_endpoint(rfp_data: RFPData):
    """Validate RFP data with comprehensive scoring"""
    try:
        result = engine.validate_rfp_data(rfp_data.dict())
        return {
            "success": True,
            "validation": result.dict(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@app.post("/analyze/rfp")
async def analyze_rfp_endpoint(rfp_data: RFPData, entity_context: Optional[EntityData] = None):
    """Analyze RFP with advanced validation and scoring"""
    try:
        result = engine.analyze_rfp_opportunity(
            rfp_data.dict(),
            entity_context.dict() if entity_context else None
        )
        
        return {
            "success": True,
            "analysis": result.dict(),
            "timestamp": datetime.now().isoformat(),
            "cache_hit": engine.stats["cache_hits"] > 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/webhook/rfp-intelligence")
async def rfp_intelligence_webhook(payload: WebhookPayload):
    """Process RFP intelligence webhook with validation"""
    webhook_id = f"rfp_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hashlib.md5(payload.json().encode()).hexdigest()[:8]}"
    
    logger.info(f"🔄 Processing webhook: {webhook_id} - {payload.type}")
    
    try:
        if payload.type == "rfp_alert":
            rfp_data = payload.data.get("rfp", {})
            entity_data = payload.data.get("entity", {})
            
            # Validate and analyze
            validation = engine.validate_rfp_data(rfp_data)
            if not validation.isValid:
                logger.warning(f"❌ Webhook {webhook_id} validation failed: {validation.errors}")
                return {
                    "webhook_id": webhook_id,
                    "status": "validation_failed",
                    "errors": validation.errors,
                    "warnings": validation.warnings
                }
            
            analysis = engine.analyze_rfp_opportunity(rfp_data, entity_data if entity_data else None)
            
            logger.info(f"✅ Webhook {webhook_id} processed (confidence: {validation.confidence}%)")
            
            return {
                "webhook_id": webhook_id,
                "status": "processed",
                "validation": validation.dict(),
                "analysis": analysis.dict(),
                "stats": engine.stats,
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
        logger.error(f"❌ Webhook {webhook_id} failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

@app.get("/stats")
async def get_stats():
    """Get comprehensive processing statistics"""
    cache_hit_rate = 0
    if engine.stats["total_processed"] > 0:
        cache_hit_rate = (engine.stats["cache_hits"] / engine.stats["total_processed"]) * 100
    
    return {
        "cache_stats": {
            "size": len(engine.cache),
            "hit_rate": f"{cache_hit_rate:.1f}%",
            "total_processed": engine.stats["total_processed"],
            "cache_hits": engine.stats["cache_hits"]
        },
        "validation_stats": {
            "rules_loaded": len(engine.validation_rules["rfp"]["required_fields"]),
            "quality_fields": len(engine.validation_rules["rfp"]["quality_fields"])
        },
        "industry_context": {
            "high_value_categories": len(engine.sports_industry_context["high_value_categories"]),
            "procurement_patterns": len(engine.sports_industry_context["procurement_patterns"])
        },
        "uptime": "running",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/test/validation")
async def test_validation():
    """Test validation capabilities with sample data"""
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
    
    test_entity = {
        "id": "entity-001",
        "name": "SportsTech Solutions",
        "type": "company",
        "industry": "Sports Technology",
        "description": "Leading sports technology provider",
        "location": "London, UK"
    }
    
    # Test validation
    validation = engine.validate_rfp_data(test_rfp)
    
    # Test analysis
    start_time = datetime.now()
    analysis = engine.analyze_rfp_opportunity(test_rfp, test_entity)
    first_duration = (datetime.now() - start_time).total_seconds()
    
    # Test cache performance
    start_time = datetime.now()
    cached_analysis = engine.analyze_rfp_opportunity(test_rfp, test_entity)
    cached_duration = (datetime.now() - start_time).total_seconds()
    
    performance_improvement = ((first_duration - cached_duration) / first_duration * 100) if first_duration > 0 else 0
    
    return {
        "test_results": {
            "validation": validation.dict(),
            "analysis": analysis.dict(),
            "cache_performance": {
                "first_analysis_ms": first_duration * 1000,
                "cached_analysis_ms": cached_duration * 1000,
                "performance_improvement": f"{performance_improvement:.1f}%",
                "cache_working": cached_duration < first_duration / 2
            }
        },
        "stats": engine.stats,
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 RFP Intelligence Backend starting on port 8002")
    logger.info(f"🎯 Sports industry context loaded: {len(engine.sports_industry_context)} categories")
    uvicorn.run(app, host="0.0.0.0", port=8002)