"""
🎯 RFP Intelligence FastAPI Backend with Validation
Simplified version that follows exact existing patterns with data validation
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
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
    description="RFP intelligence with comprehensive data validation and analysis"
)

# Enable CORS (same as existing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3005", "http://localhost:3000", "http://13.60.60.50:3005"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enums for structured data
class EntityType(str):
    COMPANY = "company"
    PERSON = "person"
    ORGANIZATION = "organization"
    VENUE = "venue"
    LEAGUE = "league"
    TEAM = "team"

class AlertType(str):
    PROMOTION = "promotion"
    NEW_ROLE = "new_role"
    ORGANIZATION_CHANGE = "organization_change"
    PROCUREMENT_OPPORTUNITY = "procurement_opportunity"
    MARKET_UPDATE = "market_update"

class Priority(str):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

# Enhanced Pydantic Models with comprehensive validation
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
            import re
            if not re.match(r'^[£$€]\s*\d+(\.\d+)?[KMB]?(?:\s*-\s*[£$€]?\s*\d+(\.\d+)?[KMB]?)?$', v):
                raise ValueError('Value must be in currency format (e.g., $2.5M, £500K)')
        return v

class EntityData(BaseModel):
    """Entity data model with validation"""
    id: str = Field(..., description="Unique entity identifier")
    name: str = Field(..., min_length=1, max_length=500, description="Entity name")
    type: str = Field(..., description="Type of entity")
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

class AlertData(BaseModel):
    """Alert data model with validation"""
    id: str = Field(..., description="Unique alert identifier")
    type: str = Field(..., description="Type of alert")
    entity: str = Field(..., min_length=1, max_length=200, description="Entity name")
    description: str = Field(..., min_length=5, max_length=1000, description="Alert description")
    impact: float = Field(..., ge=0.0, le=1.0, description="Impact score (0-1)")
    source: str = Field(..., description="Alert source")
    timestamp: str = Field(..., description="Alert timestamp")
    urgency: Optional[str] = Field(None, description="Urgency level")
    tags: Optional[List[str]] = Field(default_factory=list, description="Alert tags")

class WebhookPayload(BaseModel):
    """Enhanced webhook payload with validation"""
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

# Output Models with confidence scoring
class ValidationResult(BaseModel):
    """Comprehensive data validation result"""
    isValid: bool = Field(..., description="Whether data passed validation")
    errors: List[str] = Field(default_factory=list, description="Validation errors")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")
    confidence: int = Field(..., ge=0, le=100, description="Overall confidence score")
    recommendations: List[str] = Field(default_factory=list, description="Improvement recommendations")
    completeness_score: int = Field(..., ge=0, le=100, description="Data completeness score")
    quality_score: int = Field(..., ge=0, le=100, description="Data quality score")

class RFPAnalysisResult(BaseModel):
    """Comprehensive RFP analysis result"""
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
    estimatedValue: Optional[str] = Field(None, description="Estimated value")
    competitionLevel: str = Field(..., description="Competition level")
    marketAlignment: int = Field(..., ge=0, le=100, description="Market alignment score")

class EntityEnrichmentResult(BaseModel):
    """Comprehensive entity enrichment result"""
    entityId: str = Field(..., description="Entity ID")
    enrichedData: Dict[str, Any] = Field(..., description="Enriched data")
    confidenceScore: int = Field(..., ge=0, le=100, description="Confidence score")
    dataSource: str = Field(..., description="Data source")
    enrichmentTimestamp: str = Field(..., description="Enrichment timestamp")
    verifiedFields: List[str] = Field(..., description="Verified fields")
    missingFields: List[str] = Field(..., description="Missing fields")
    suggestions: List[str] = Field(..., description="Data improvement suggestions")
    trustLevel: str = Field(..., description="Trust level")
    crossReferenceCount: int = Field(..., ge=0, description="Number of cross-references found")

# Advanced Validation and Analysis Engine
class RFPIntelligenceEngine:
    """Advanced RFP Intelligence engine with validation and analysis"""
    
    def __init__(self):
        self.validation_rules = self._load_validation_rules()
        self.industry_context = self._load_industry_context()
        self.cache = {}  # Token optimization cache
        self.processing_stats = {
            "total_processed": 0,
            "cache_hits": 0,
            "validation_failures": 0
        }
    
    def _load_validation_rules(self) -> Dict[str, Any]:
        return {
            "rfp": {
                "required_fields": ["title", "organization", "description", "source", "published"],
                "quality_fields": ["value", "deadline", "category", "requirements"],
                "quality_thresholds": {
                    "min_confidence": 70,
                    "completeness_threshold": 80,
                    "title_min_length": 10,
                    "description_min_length": 50
                }
            },
            "entity": {
                "required_fields": ["name", "type"],
                "quality_fields": ["industry", "location", "description", "website"],
                "quality_thresholds": {
                    "min_confidence": 60,
                    "completeness_threshold": 70
                }
            }
        }
    
    def _load_industry_context(self) -> Dict[str, Any]:
        return {
            "sports_industry": {
                "key_segments": ["professional_teams", "leagues", "venues", "sports_tech", "sports_marketing"],
                "procurement_patterns": ["seasonal_planning", "event_based", "technology_upgrades", "fan_engagement"],
                "decision_makers": ["COO", "CTO", "CFO", "Director of Operations", "VP of Technology"],
                "high_value_categories": ["technology", "digital_transformation", "fan_experience", "data_analytics"],
                "seasonal_timing": ["Q1", "Q2", "Q3", "Q4"],
                "competitive_factors": ["innovation", "reliability", "scalability", "integration"]
            }
        }
    
    def _get_checksum(self, data: Dict[str, Any]) -> str:
        """Generate checksum for token optimization"""
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.md5(data_str.encode()).hexdigest()
    
    def _check_cache(self, data_type: str, data: Dict[str, Any]) -> Optional[Any]:
        """Check if we have cached results for this data"""
        checksum = self._get_checksum(data)
        cache_key = f"{data_type}:{checksum}"
        if cache_key in self.cache:
            self.processing_stats["cache_hits"] += 1
            return self.cache[cache_key]
        return None
    
    def _cache_result(self, data_type: str, data: Dict[str, Any], result: Any):
        """Cache result for future use"""
        checksum = self._get_checksum(data)
        cache_key = f"{data_type}:{checksum}"
        self.cache[cache_key] = result
        # Limit cache size
        if len(self.cache) > 1000:
            # Remove oldest 10% of entries
            keys_to_remove = list(self.cache.keys())[:100]
            for key in keys_to_remove:
                del self.cache[key]
    
    def validate_rfp_comprehensive(self, rfp_data: Dict[str, Any]) -> ValidationResult:
        """Comprehensive RFP validation with quality scoring"""
        errors = []
        warnings = []
        recommendations = []
        
        # Required field validation
        required_fields = self.validation_rules["rfp"]["required_fields"]
        for field in required_fields:
            if field not in rfp_data or not rfp_data[field]:
                errors.append(f"Missing required field: {field}")
        
        # Quality field validation
        quality_fields = self.validation_rules["rfp"]["quality_fields"]
        missing_quality = []
        for field in quality_fields:
            if field not in rfp_data or not rfp_data[field]:
                missing_quality.append(field)
                warnings.append(f"Missing quality field: {field}")
        
        # Content quality checks
        title = rfp_data.get("title", "")
        description = rfp_data.get("description", "")
        
        if len(title) < self.validation_rules["rfp"]["quality_thresholds"]["title_min_length"]:
            warnings.append("Title is quite short - could be more descriptive")
        
        if len(description) < self.validation_rules["rfp"]["quality_thresholds"]["description_min_length"]:
            warnings.append("Description lacks detail - more information needed")
        
        # Industry-specific validation
        if rfp_data.get("category", "").lower() in self.industry_context["sports_industry"]["high_value_categories"]:
            recommendations.append("High-value sports industry category detected - prioritize review")
        
        # Calculate scores
        total_fields = len(required_fields) + len(quality_fields)
        completed_fields = total_fields - len(errors) - len(missing_quality)
        completeness_score = int((completed_fields / total_fields) * 100)
        
        quality_score = 100
        quality_score -= len(errors) * 25
        quality_score -= len(warnings) * 10
        quality_score = max(0, quality_score)
        
        confidence = int((completeness_score + quality_score) / 2)
        
        # Generate recommendations
        if errors:
            recommendations.append(f"Address {len(errors)} validation error(s) immediately")
        if warnings:
            recommendations.append(f"Consider {len(warnings)} quality improvement(s)")
        if completeness_score < 80:
            recommendations.append("Add more complete information for better analysis")
        
        return ValidationResult(
            isValid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            confidence=confidence,
            recommendations=recommendations,
            completeness_score=completeness_score,
            quality_score=quality_score
        )
    
    def analyze_rfp_advanced(self, rfp_data: Dict[str, Any], entity_context: Optional[Dict[str, Any]] = None) -> RFPAnalysisResult:
        """Advanced RFP analysis with sports industry expertise"""
        
        # Check cache first
        cache_key_data = {"rfp": rfp_data, "context": entity_context}
        cached_result = self._check_cache("rfp_analysis", cache_key_data)
        if cached_result:
            logger.info(f"💾 Cache hit for RFP analysis: {rfp_data.get('title', 'Unknown')}")
            return cached_result
        
        self.processing_stats["total_processed"] += 1
        
        # Validate first
        validation = self.validate_rfp_comprehensive(rfp_data)
        if not validation.isValid:
            self.processing_stats["validation_failures"] += 1
            raise ValueError(f"RFP validation failed: {validation.errors}")
        
        # Advanced analysis
        fit_score = self._calculate_advanced_fit_score(rfp_data, entity_context)
        opportunity_score = self._calculate_opportunity_score(rfp_data)
        win_probability = self._calculate_win_probability(rfp_data, entity_context)
        market_alignment = self._calculate_market_alignment(rfp_data)
        
        result = RFPAnalysisResult(
            fitScore=fit_score,
            significance=self._assess_significance(fit_score, opportunity_score),
            urgency=self._assess_urgency(rfp_data),
            businessImpact=self._assess_business_impact(rfp_data, fit_score),
            recommendedActions=self._generate_strategic_recommendations(rfp_data, fit_score, entity_context),
            riskAssessment=self._assess_risks(rfp_data, entity_context),
            opportunityScore=opportunity_score,
            confidenceLevel=validation.confidence,
            strategicImplications=self._generate_strategic_implications(rfp_data, fit_score),
            tacticalRecommendations=self._generate_tactical_recommendations(rfp_data),
            timingConsiderations=self._assess_timing(rfp_data),
            winProbability=win_probability,
            estimatedValue=rfp_data.get("value"),
            competitionLevel=self._assess_competition(rfp_data),
            marketAlignment=market_alignment
        )
        
        # Cache result
        self._cache_result("rfp_analysis", cache_key_data, result)
        logger.info(f"✅ RFP analysis completed: {rfp_data.get('title', 'Unknown')} (confidence: {validation.confidence}%)")
        
        return result
    
    def _calculate_advanced_fit_score(self, rfp_data: Dict[str, Any], entity_context: Optional[Dict[str, Any]]) -> int:
        """Advanced fit score calculation with industry expertise"""
        base_score = 70
        
        # Industry alignment
        category = rfp_data.get("category", "").lower()
        if any(segment in category for segment in self.industry_context["sports_industry"]["key_segments"]):
            base_score += 15
        
        # Technology focus
        description = rfp_data.get("description", "").lower()
        tech_keywords = ["digital", "technology", "platform", "software", "analytics", "data", "ai", "cloud"]
        tech_score = sum(1 for keyword in tech_keywords if keyword in description)
        base_score += min(tech_score * 3, 20)
        
        # Entity relationship strength
        if entity_context:
            if entity_context.get("industry", "").lower() in ["sports", "technology", "entertainment"]:
                base_score += 10
            if entity_context.get("type", "").lower() in ["company", "organization"]:
                base_score += 5
        
        # Value consideration
        value = rfp_data.get("value", "").lower()
        if any(marker in value for marker in ["1m", "2m", "3m", "5m+"]):
            base_score += 10
        elif any(marker in value for marker in ["500k", "750k"]):
            base_score += 5
        
        return min(100, base_score)
    
    def _calculate_opportunity_score(self, rfp_data: Dict[str, Any]) -> int:
        """Calculate opportunity score with market context"""
        base_score = 65
        
        # High-value indicators
        category = rfp_data.get("category", "").lower()
        if category in self.industry_context["sports_industry"]["high_value_categories"]:
            base_score += 20
        
        # Strategic timing
        description = rfp_data.get("description", "").lower()
        strategic_keywords = ["transformation", "modernization", "innovation", "upgrade", "expansion"]
        strategic_score = sum(1 for keyword in strategic_keywords if keyword in description)
        base_score += min(strategic_score * 5, 15)
        
        return min(100, base_score)
    
    def _calculate_win_probability(self, rfp_data: Dict[str, Any], entity_context: Optional[Dict[str, Any]]) -> int:
        """Calculate win probability with competitive analysis"""
        base_score = 60
        
        # Entity advantages
        if entity_context:
            if "sports" in entity_context.get("industry", "").lower():
                base_score += 20
            if entity_context.get("description"):
                base_score += 10
        
        # Complexity assessment
        description = rfp_data.get("description", "").lower()
        complexity_indicators = ["complex", "enterprise", "comprehensive", "end-to-end"]
        if any(indicator in description for indicator in complexity_indicators):
            base_score -= 10
        
        return min(100, max(0, base_score))
    
    def _calculate_market_alignment(self, rfp_data: Dict[str, Any]) -> int:
        """Calculate market alignment score"""
        base_score = 70
        
        # Sports industry alignment
        category = rfp_data.get("category", "").lower()
        if any(keyword in category for keyword in ["sports", "fan", "venue", "team", "league"]):
            base_score += 20
        
        # Technology alignment
        description = rfp_data.get("description", "").lower()
        tech_alignment = ["platform", "digital", "technology", "software", "analytics"]
        alignment_score = sum(1 for keyword in tech_alignment if keyword in description)
        base_score += min(alignment_score * 3, 10)
        
        return min(100, base_score)
    
    def _assess_significance(self, fit_score: int, opportunity_score: int) -> str:
        """Assess significance based on multiple factors"""
        combined_score = (fit_score + opportunity_score) / 2
        if combined_score >= 85:
            return "strategic"
        elif combined_score >= 70:
            return "high"
        elif combined_score >= 55:
            return "medium"
        else:
            return "low"
    
    def _assess_urgency(self, rfp_data: Dict[str, Any]) -> str:
        """Assess urgency level"""
        if rfp_data.get("deadline"):
            return "immediate"
        elif rfp_data.get("value"):
            return "high"
        elif "urgent" in rfp_data.get("description", "").lower():
            return "high"
        else:
            return "medium"
    
    def _assess_business_impact(self, rfp_data: Dict[str, Any], fit_score: int) -> str:
        """Assess business impact"""
        value = rfp_data.get("value", "").lower()
        if any(marker in value for marker in ["3m+", "5m", "£3m", "$3m", "€3m"]):
            return "Transformative revenue opportunity with strategic market positioning"
        elif any(marker in value for marker in ["1m", "2m", "£1m", "$1m", "€1m"]):
            return "Significant growth opportunity with market expansion potential"
        elif fit_score >= 80:
            return "Strong strategic fit with excellent partnership potential"
        else:
            return "Moderate opportunity with learning and market entry value"
    
    def _generate_strategic_recommendations(self, rfp_data: Dict[str, Any], fit_score: int, entity_context: Optional[Dict[str, Any]]) -> List[str]:
        """Generate strategic recommendations"""
        recommendations = []
        
        if fit_score >= 85:
            recommendations.append("Prioritize as Tier 1 opportunity - allocate executive resources")
            recommendations.append("Initiate customer discovery meetings immediately")
        elif fit_score >= 70:
            recommendations.append("Evaluate capacity and resource allocation requirements")
            recommendations.append("Conduct competitive analysis and market positioning review")
        else:
            recommendations.append("Assess partnership opportunities and collaboration potential")
            recommendations.append("Consider strategic learning value vs resource investment")
        
        # Industry-specific recommendations
        category = rfp_data.get("category", "").lower()
        if "technology" in category:
            recommendations.append("Leverage technical expertise and innovation capabilities")
        if "fan" in category or "venue" in category:
            recommendations.append("Highlight user experience and engagement capabilities")
        
        return recommendations
    
    def _assess_risks(self, rfp_data: Dict[str, Any], entity_context: Optional[Dict[str, Any]]) -> str:
        """Assess risks associated with the RFP"""
        risks = []
        
        # Timeline risks
        if not rfp_data.get("deadline"):
            risks.append("Unclear timeline")
        
        # Scope risks
        description = rfp_data.get("description", "").lower()
        if any(word in description for word in ["comprehensive", "end-to-end", "enterprise-wide"]):
            risks.append("Large scope may require significant resources")
        
        # Competition risks
        if rfp_data.get("value", "").lower():
            risks.append("High-value opportunity likely to attract strong competition")
        
        if not risks:
            return "Low risk - well-defined opportunity with clear requirements"
        elif len(risks) == 1:
            return f"Moderate risk: {risks[0]}"
        else:
            return f"High risk: {', '.join(risks)}"
    
    def _generate_strategic_implications(self, rfp_data: Dict[str, Any], fit_score: int) -> List[str]:
        """Generate strategic implications"""
        implications = []
        
        category = rfp_data.get("category", "").lower()
        if "technology" in category:
            implications.append("Establish technology leadership position in sports industry")
        if "fan" in category:
            implications.append("Expand fan engagement capabilities and market reach")
        if "data" in category or "analytics" in category:
            implications.append("Build data-driven decision making capabilities")
        
        if fit_score >= 80:
            implications.append("Create long-term strategic partnership opportunity")
        
        return implications
    
    def _generate_tactical_recommendations(self, rfp_data: Dict[str, Any]) -> List[str]:
        """Generate tactical recommendations"""
        recommendations = []
        
        # Immediate actions
        if rfp_data.get("deadline"):
            recommendations.append("Establish response timeline with key milestones")
        
        # Team formation
        category = rfp_data.get("category", "").lower()
        if "technology" in category:
            recommendations.append("Assemble technical solution architecture team")
        if "digital" in category:
            recommendations.append("Include user experience and design expertise")
        
        # Research needs
        organization = rfp_data.get("organization", "")
        recommendations.append(f"Research {organization}'s current challenges and strategic objectives")
        
        return recommendations
    
    def _assess_timing(self, rfp_data: Dict[str, Any]) -> str:
        """Assess timing considerations"""
        if rfp_data.get("deadline"):
            return f"Timeline-critical - deadline: {rfp_data['deadline']}"
        elif "immediate" in rfp_data.get("description", "").lower():
            return "Urgent response required - competitive opportunity"
        else:
            return "Standard response timeline - allow for thorough preparation"
    
    def _assess_competition(self, rfp_data: Dict[str, Any]) -> str:
        """Assess competition level"""
        value = rfp_data.get("value", "").lower()
        if any(marker in value for marker in ["3m+", "5m"]):
            return "High - major contracts attract premium competitors"
        elif any(marker in value for marker in ["1m", "2m"]):
            return "Medium - significant opportunity attracts qualified competition"
        else:
            return "Low to moderate - specialized requirements may limit competition"

# Global engine instance
intelligence_engine = RFPIntelligenceEngine()

@app.get("/")
async def root():
    return {
        "status": "RFP Intelligence Backend Running",
        "features": [
            "Advanced RFP data validation with confidence scoring",
            "Token-optimized processing with intelligent caching",
            "Sports industry expertise and market analysis",
            "Comprehensive risk assessment and strategic recommendations",
            "Real-time webhook processing with validation"
        ],
        "cache_size": len(intelligence_engine.cache),
        "processing_stats": intelligence_engine.processing_stats
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "cache_size": len(intelligence_engine.cache),
        "validation_rules": len(intelligence_engine.validation_rules),
        "processing_stats": intelligence_engine.processing_stats
    }

@app.post("/validate/rfp")
async def validate_rfp_endpoint(rfp_data: RFPData):
    """Comprehensive RFP validation with confidence scoring"""
    try:
        result = intelligence_engine.validate_rfp_comprehensive(rfp_data.dict())
        return {
            "success": True,
            "validation": result.dict(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@app.post("/analyze/rfp")
async def analyze_rfp_endpoint(rfp_data: RFPData, entity_context: Optional[EntityData] = None):
    """Advanced RFP analysis with sports industry expertise"""
    try:
        result = intelligence_engine.analyze_rfp_advanced(
            rfp_data.dict(),
            entity_context.dict() if entity_context else None
        )
        
        return {
            "success": True,
            "analysis": result.dict(),
            "timestamp": datetime.now().isoformat(),
            "cache_hit": intelligence_engine.processing_stats["cache_hits"] > 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/webhook/rfp-intelligence")
async def rfp_intelligence_webhook(payload: WebhookPayload):
    """Advanced RFP intelligence webhook processing"""
    webhook_id = f"rfp_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hashlib.md5(payload.json().encode()).hexdigest()[:8]}"
    
    logger.info(f"🔄 Processing webhook: {webhook_id} - {payload.type}")
    
    try:
        if payload.type == "rfp_alert":
            rfp_data = payload.data.get("rfp", {})
            entity_data = payload.data.get("entity", {})
            
            # Convert to proper models
            try:
                rfp_model = RFPData(**rfp_data)
                entity_model = EntityData(**entity_data) if entity_data else None
                
                # Comprehensive validation
                validation = intelligence_engine.validate_rfp_comprehensive(rfp_data)
                if not validation.isValid:
                    logger.warning(f"❌ Webhook {webhook_id} validation failed: {validation.errors}")
                    return {
                        "webhook_id": webhook_id,
                        "status": "validation_failed",
                        "errors": validation.errors,
                        "warnings": validation.warnings
                    }
                
                # Advanced analysis
                analysis = intelligence_engine.analyze_rfp_advanced(rfp_data, entity_data if entity_data else None)
                
                logger.info(f"✅ Webhook {webhook_id} processed successfully (confidence: {validation.confidence}%)")
                
                return {
                    "webhook_id": webhook_id,
                    "status": "processed",
                    "validation": validation.dict(),
                    "analysis": analysis.dict(),
                    "processing_stats": intelligence_engine.processing_stats,
                    "timestamp": datetime.now().isoformat()
                }
                
            except Exception as validation_error:
                logger.error(f"❌ Webhook {webhook_id} validation error: {str(validation_error)}")
                return {
                    "webhook_id": webhook_id,
                    "status": "validation_error",
                    "error": str(validation_error)
                }
        
        elif payload.type == "entity_alert":
            entity_data = payload.data.get("entity", {})
            
            # Entity validation and processing would go here
            logger.info(f"✅ Entity webhook {webhook_id} processed")
            
            return {
                "webhook_id": webhook_id,
                "status": "processed",
                "message": "Entity alert processed successfully",
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
    """Get comprehensive processing statistics"""
    cache_hit_rate = 0
    if intelligence_engine.processing_stats["total_processed"] > 0:
        cache_hit_rate = (intelligence_engine.processing_stats["cache_hits"] / intelligence_engine.processing_stats["total_processed"]) * 100
    
    return {
        "cache_stats": {
            "size": len(intelligence_engine.cache),
            "hit_rate": f"{cache_hit_rate:.1f}%",
            "total_processed": intelligence_engine.processing_stats["total_processed"],
            "cache_hits": intelligence_engine.processing_stats["cache_hits"],
            "validation_failures": intelligence_engine.processing_stats["validation_failures"]
        },
        "validation_rules": {
            "rfp_fields": len(intelligence_engine.validation_rules["rfp"]["required_fields"]),
            "entity_fields": len(intelligence_engine.validation_rules["entity"]["required_fields"])
        },
        "industry_context": {
            "sports_segments": len(intelligence_engine.industry_context["sports_industry"]["key_segments"]),
            "procurement_patterns": len(intelligence_engine.industry_context["sports_industry"]["procurement_patterns"])
        },
        "uptime": "running",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/test/comprehensive-analysis")
async def test_comprehensive_analysis():
    """Test comprehensive RFP analysis capabilities"""
    test_rfp = {
        "id": "test-sports-tech-001",
        "title": "Professional Sports Team Digital Transformation Platform",
        "organization": "Premier Sports League",
        "description": "Complete digital transformation including fan engagement platform, real-time analytics, ticketing integration, and mobile applications for 30+ teams. Must include AI-powered personalization, multi-language support, and seamless integration with existing stadium systems.",
        "value": "$3.5M",
        "deadline": "2024-04-15",
        "category": "Technology",
        "source": "procurement_portal",
        "published": "2024-01-20",
        "requirements": [
            "Cloud-native architecture",
            "AI-powered recommendations",
            "Real-time analytics dashboard",
            "Mobile app development",
            "Multi-stadium deployment"
        ]
    }
    
    test_entity = {
        "id": "entity-sports-tech-001",
        "name": "SportsTech Solutions Inc",
        "type": "company",
        "industry": "Sports Technology",
        "description": "Leading provider of sports technology solutions with 15+ years experience",
        "location": "London, UK"
    }
    
    # Run analysis
    start_time = datetime.now()
    result = intelligence_engine.analyze_rfp_advanced(test_rfp, test_entity)
    processing_time = (datetime.now() - start_time).total_seconds()
    
    # Test cache performance
    start_time = datetime.now()
    cached_result = intelligence_engine.analyze_rfp_advanced(test_rfp, test_entity)
    cached_processing_time = (datetime.now() - start_time).total_seconds()
    
    performance_improvement = ((processing_time - cached_processing_time) / processing_time * 100) if processing_time > 0 else 0
    
    return {
        "test_results": {
            "analysis": result.dict(),
            "performance": {
                "first_analysis_ms": processing_time * 1000,
                "cached_analysis_ms": cached_processing_time * 1000,
                "performance_improvement": f"{performance_improvement:.1f}%",
                "cache_working": cached_processing_time < processing_time / 2
            },
            "validation": {
                "fit_score": result.fitScore,
                "confidence": result.confidenceLevel,
                "opportunity_score": result.opportunityScore,
                "market_alignment": result.marketAlignment
            }
        },
        "processing_stats": intelligence_engine.processing_stats,
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Advanced RFP Intelligence Backend starting on port 8002")
    logger.info(f"🎯 Sports industry expertise loaded: {len(intelligence_engine.industry_context['sports_industry'])} categories")
    uvicorn.run(app, host="0.0.0.0", port=8002)