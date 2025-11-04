"""
BrightData LinkedIn Procurement Webhook Handler
Monitors LinkedIn for new RFP and procurement announcements
"""

import json
import hmac
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from pydantic import BaseModel
import logging
from dataclasses import dataclass
import asyncio
import aiohttp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LinkedIn Procurement Webhook Handler")

@dataclass
class LinkedInPost:
    """Structured LinkedIn post data"""
    post_id: str
    author_name: str
    author_company: str
    author_role: str
    content: str
    published_at: datetime
    engagement_count: int
    url: str
    hashtags: List[str]
    mentions: List[str]

@dataclass
class ProcurementSignal:
    """Detected procurement opportunity"""
    source_post: LinkedInPost
    signal_type: str  # 'rfp_announced', 'vendor_soliciting', 'procurement_team_hiring'
    sport_type: str
    estimated_value: Optional[str]
    urgency_level: str  # 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
    confidence_score: float
    organization_name: str
    contact_person: Optional[str]
    deadline: Optional[datetime]
    requirements: List[str]

class BrightDataWebhookPayload(BaseModel):
    """Expected webhook payload from BrightData"""
    webhook_id: str
    site_name: str
    page_url: str
    page_title: str
    content: str
    meta: Dict[str, Any]
    extracted_at: datetime
    signals: List[str]

class WebhookAuthenticator:
    """Secure webhook authentication using HMAC"""
    
    def __init__(self, secret_key: str):
        self.secret_key = secret_key.encode('utf-8')
    
    def verify_signature(self, payload: bytes, signature: str) -> bool:
        """Verify webhook signature using HMAC-SHA256"""
        expected_signature = hmac.new(
            self.secret_key,
            payload,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_signature, signature)

class LinkedInProcurementDetector:
    """Detects procurement patterns in LinkedIn content"""
    
    # Procurement keywords and patterns
    PROCUREMENT_KEYWORDS = [
        'request for proposal', 'rfp', 'tender', 'procurement', 'vendor selection',
        'digital transformation', 'technology upgrade', 'software implementation',
        'consultancy services', 'professional services', 'implementation partner',
        'system integrator', 'digital strategy', 'technology adoption'
    ]
    
    SPORTS_KEYWORDS = [
        'football', 'soccer', 'rugby', 'cricket', 'tennis', 'basketball', 'golf',
        'stadium', 'arena', 'club', 'team', 'federation', 'league', 'sports',
        'premier league', 'championship', 'world cup', 'season'
    ]
    
    VALUE_INDICATORS = [
        'million', 'm', '£', '$', 'investment', 'budget', 'million pounds',
        'large scale', 'enterprise', 'major', 'significant'
    ]
    
    URGENCY_KEYWORDS = {
        'CRITICAL': ['urgent', 'deadline', 'immediately', 'asap', 'critical', 'pressing'],
        'HIGH': ['soon', 'quickly', 'priority', 'important', 'fast track'],
        'MEDIUM': ['looking for', 'interested in', 'seeking', 'evaluating'],
        'LOW': ['considering', 'planning', 'future', 'exploring', 'researching']
    }
    
    def detect_procurement_signals(self, post: LinkedInPost) -> List[ProcurementSignal]:
        """Identify procurement opportunities in LinkedIn posts"""
        signals = []
        content_lower = post.content.lower()
        
        # Check for procurement + sports combination
        has_procurement = any(keyword in content_lower for keyword in self.PROCUREMENT_KEYWORDS)
        has_sports = any(keyword in content_lower for keyword in self.SPORTS_KEYWORDS)
        
        if not (has_procurement and has_sports):
            return signals
        
        # Analyze content for procurement signals
        signal_type = self._determine_signal_type(content_lower, post.author_role)
        sport_type = self._extract_sport_type(content_lower, post.content)
        urgency = self._assess_urgency(content_lower)
        confidence = self._calculate_confidence(post, content_lower)
        
        if confidence < 0.6:  # Minimum confidence threshold
            return signals
        
        # Estimate value if possible
        estimated_value = self._estimate_value(content_lower, post.author_company)
        
        # Extract organization and contact details
        organization_name = post.author_company or self._extract_organization(content_lower)
        contact_person = post.author_name
        deadline = self._extract_deadline(content_lower)
        requirements = self._extract_requirements(content_lower)
        
        signals.append(ProcurementSignal(
            source_post=post,
            signal_type=signal_type,
            sport_type=sport_type,
            estimated_value=estimated_value,
            urgency_level=urgency,
            confidence_score=confidence,
            organization_name=organization_name,
            contact_person=contact_person,
            deadline=deadline,
            requirements=requirements
        ))
        
        return signals
    
    def _determine_signal_type(self, content: str, author_role: str) -> str:
        """Determine the type of procurement signal"""
        if 'rfp' in content or 'request for proposal' in content:
            return 'rfp_announced'
        elif any(word in content for word in ['hiring', 'recruiting', 'role', 'position']):
            return 'procurement_team_hiring'
        else:
            return 'vendor_soliciting'
    
    def _extract_sport_type(self, content: str, full_content: str) -> str:
        """Extract specific sport type from content"""
        sport_mapping = {
            'football': ['football', 'soccer', 'premier league', 'championship'],
            'rugby': ['rugby', 'six nations', 'premiership rugby'],
            'cricket': ['cricket', 'Pending', 't20'],
            'tennis': ['tennis', 'wimbledon', 'roland garros'],
            'basketball': ['basketball', 'nba'],
            'golf': ['golf', 'pga', 'european tour']
        }
        
        for sport, keywords in sport_mapping.items():
            if any(keyword in content for keyword in keywords):
                return sport
        
        return 'multi-sport'
    
    def _assess_urgency(self, content: str) -> str:
        """Assess urgency level based on content"""
        for urgency, keywords in self.URGENCY_KEYWORDS.items():
            if any(keyword in content for keyword in keywords):
                return urgency
        return 'MEDIUM'
    
    def _calculate_confidence(self, post: LinkedInPost, content: str) -> float:
        """Calculate confidence score for procurement signal"""
        confidence = 0.0
        
        # Author credibility factors
        if post.author_role and any(role in post.author_role.lower() 
                                  for role in ['procurement', 'it', 'operations', 'director', 'manager']):
            confidence += 0.3
        
        # Content indicators
        procurement_count = sum(1 for keyword in self.PROCUREMENT_KEYWORDS if keyword in content)
        confidence += min(0.3, procurement_count * 0.1)
        
        # Engagement indicators
        if post.engagement_count > 50:
            confidence += 0.2
        
        # Company size indicators
        if any(indicator in content for indicator in self.VALUE_INDICATORS):
            confidence += 0.2
        
        return min(1.0, confidence)
    
    def _estimate_value(self, content: str, company: str) -> Optional[str]:
        """Estimate procurement value from content"""
        if 'million' in content:
            if '2m' in content or 'two million' in content:
                return '£2M'
            elif '1m' in content or 'one million' in content:
                return '£1M'
            else:
                return '£1M-£2M'
        
        # Default ranges based on company type
        if any(size in company.lower() for size in ['large', 'enterprise', 'corporate']):
            return '£500K-£1M'
        elif any(size in company.lower() for size in ['group', 'holding']):
            return '£1M-£2M'
        
        return '£100K-£500K'
    
    def _extract_organization(self, content: str) -> str:
        """Extract organization name from content"""
        # Simple extraction - would be enhanced with NLP
        org_indicators = ['at', 'from', '@']
        for indicator in org_indicators:
            if indicator in content:
                parts = content.split(indicator)
                if len(parts) > 1:
                    possible_org = parts[1].split()[0:3]
                    if possible_org:
                        return ' '.join(possible_org)
        return 'Unknown Organization'
    
    def _extract_deadline(self, content: str) -> Optional[datetime]:
        """Extract deadline from content"""
        deadline_keywords = ['deadline', 'due date', 'submission', 'by']
        for keyword in deadline_keywords:
            if keyword in content:
                # This would be enhanced with date parsing
                # For now, return None - requires actual implementation
                return None
        return None
    
    def _extract_requirements(self, content: str) -> List[str]:
        """Extract technical requirements from content"""
        requirements = []
        
        tech_keywords = [
            'cloud', 'saas', 'api', 'integration', 'analytics', 'dashboard',
            'mobile', 'web', 'database', 'security', 'compliance', 'ai', 'ml'
        ]
        
        for keyword in tech_keywords:
            if keyword in content:
                requirements.append(keyword)
        
        return requirements[:5]  # Limit to top 5 requirements

class RFPTargetingService:
    """Service to determine if procurement signal matches Yellow Panther targeting"""
    
    YELLOW_PANTHER_CAPABILITIES = [
        'digital transformation', 'data analytics', 'dashboard development',
        'api integration', 'cloud migration', 'mobile applications',
        'business intelligence', 'automated reporting', 'performance analytics'
    ]
    
    SPORTS_SPECIALIZATIONS = [
        'stadium technology', 'fan engagement', 'ticket systems',
        'membership management', 'competition management', 'player data',
        'performance tracking', 'media management', 'sponsorship analytics'
    ]
    
    def assess_yellow_panther_fit(self, signal: ProcurementSignal) -> Dict[str, Any]:
        """Assess how well the opportunity fits Yellow Panther"""
        
        fit_score = 0
        match_factors = []
        
        # Sport type alignment
        if signal.sport_type in ['football', 'rugby', 'cricket', 'multi-sport']:
            fit_score += 20
            match_factors.append('Strong sports industry alignment')
        
        # Capability matching
        capability_matches = sum(1 for req in signal.requirements 
                               for cap in self.YELLOW_PANTHER_CAPABILITIES
                               if req in cap)
        
        if capability_matches > 0:
            fit_score += min(30, capability_matches * 10)
            match_factors.append(f'{capability_matches} capability overlaps')
        
        # Value range alignment
        if signal.estimated_value and 'M' in signal.estimated_value:
            fit_score += 25
            match_factors.append('High-value opportunity')
        elif 'K' in signal.estimated_value:
            fit_score += 15
            match_factors.append('Mid-range opportunity')
        
        # Urgency factor
        if signal.urgency_level == 'CRITICAL':
            fit_score += 15
            match_factors.append('High urgency - immediate attention needed')
        elif signal.urgency_level == 'HIGH':
            fit_score += 10
            match_factors.append('Time-sensitive opportunity')
        
        # Confidence factor
        fit_score += signal.confidence_score * 10
        
        return {
            'fit_score': min(100, fit_score),
            'priority': 'HIGH' if fit_score >= 70 else 'MEDIUM' if fit_score >= 50 else 'LOW',
            'match_factors': match_factors,
            'recommendation': self._get_recommendation(fit_score)
        }
    
    def _get_recommendation(self, fit_score: int) -> str:
        """Generate recommendation based on fit score"""
        if fit_score >= 80:
            return 'Systematic & comprehensive proposal'
        elif fit_score >= 60:
            return 'Proactive outreach with capability brief'
        elif fit_score >= 40:
            return 'Monitor & engage when appropriate'
        else:
            return 'Archive - not aligned with capabilities'

# Initialize services
authenticator = WebhookAuthenticator("brightdata_secret_key_here")  # Change in production
detector = LinkedInProcurementDetector()
targeting_service = RFPTargetingService()

@app.post("/webhook/brightdata/linkedin")
async def linkedin_procurement_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """Main webhook endpoint for LinkedIn procurement monitoring"""
    
    try:
        # Verify webhook signature
        payload = await request.body()
        signature = request.headers.get("X-Brightdata-Signature", "")
        
        if not authenticator.verify_signature(payload, signature):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
        
        # Parse webhook payload
        webhook_data = BrightDataWebhookPayload(**json.loads(payload))
        
        # Validate LinkedIn content
        if not _is_linkedin_content(webhook_data):
            return {"status": "ignored", "reason": "Not LinkedIn content"}
        
        # Convert to LinkedIn post
        linkedin_post = _convert_to_linkedin_post(webhook_data)
        
        # Process in background
        background_tasks.add_task(process_procurement_signal, linkedin_post)
        
        return {"status": "accepted", "message": "Processing procurement signals"}
        
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal processing error")

async def process_procurement_signal(post: LinkedInPost):
    """Background task to process LinkedIn procurement signals"""
    
    logger.info(f"Processing LinkedIn post: {post.post_id}")
    
    try:
        # Detect procurement signals
        signals = detector.detect_procurement_signals(post)
        
        if not signals:
            logger.info(f"No procurement signals detected in post {post.post_id}")
            return
        
        # Process each signal
        for signal in signals:
            # Assess Yellow Panther fit
            targeting_assessment = targeting_service.assess_yellow_panther_fit(signal)
            
            # Only process high/medium priority signals
            if targeting_assessment['priority'] in ['HIGH', 'MEDIUM']:
                await _handle_procurement_opportunity(signal, targeting_assessment)
        
        logger.info(f"Processed {len(signals)} procurement signals from post {post.post_id}")
        
    except Exception as e:
        logger.error(f"Error processing procurement signal: {str(e)}")

async def _handle_procurement_opportunity(
    signal: ProcurementSignal, 
    assessment: Dict[str, Any]
):
    """Handle a detected procurement opportunity"""
    
    logger.info(f"🔍 HIGH PRIORITY RFP DETECTED: {signal.organization_name}")
    
    # Create RFP record
    rfp_data = {
        "id": f"webhook_{signal.source_post.post_id}_{datetime.now().strftime('%Y%m%d')}",
        "title": f"{signal.signal_type.replace('_', ' ').title()} - {signal.sport_type}",
        "organization": signal.organization_name,
        "sport": signal.sport_type,
        "procurement_type": "Digital Services",
        "description": signal.source_post.content[:500] + "...",
        "deadline": signal.deadline.isoformat() if signal.deadline else None,
        "value_estimate": signal.estimated_value or "£100K-£500K",
        "opportunity_score": assessment['fit_score'],
        "priority_level": signal.urgency_level,
        "status": "DISCOVERED",
        "requirements": signal.requirements,
        "urgency": signal.urgency_level,
        "contact_info": {
            "name": signal.contact_person,
            "email": "search_required",  # Would need LinkedIn scraping
            "organization": signal.organization_name,
            "department": "Digital Services"
        },
        "yellow_panther_fit": assessment['fit_score'],
        "source": "webhook_linkedin",
        "discovered_at": datetime.now().isoformat(),
        "confidence_score": signal.confidence_score,
        "webhook_source": {
            "post_url": signal.source_post.url,
            "author": signal.source_post.author_name,
            "detection_method": "brighdata_webhook"
        }
    }
    
    # Store in Neo4j (would integrate with existing MCP)
    await _store_rfp_in_knowledge_graph(rfp_data)
    
    # Send real-time notification
    await _send_real_time_notification(signal, assessment)
    
    logger.info(f"✅ RFP processed: {signal.organization_name} (Score: {assessment['fit_score']})")

async def _store_rfp_in_knowledge_graph(rfp_data: Dict[str, Any]):
    """Store RFP data in Neo4j knowledge graph"""
    # This would integrate with the existing Neo4j MCP service
    logger.info(f"Storing RFP in knowledge graph: {rfp_data['id']}")

async def _send_real_time_notification(signal: ProcurementSignal, assessment: Dict[str, Any]):
    """Send real-time notification for high-priority RFPs"""
    
    if assessment['priority'] == 'HIGH':
        notification = {
            "type": "rfp_detected",
            "priority": "HIGH",
            "organization": signal.organization_name,
            "fit_score": assessment['fit_score'],
            "estimated_value": signal.estimated_value,
            "urgency": signal.urgency_level,
            "recommendation": assessment['recommendation'],
            "post_url": signal.source_post.url,
            "detected_at": datetime.now().isoformat()
        }
        
        logger.info(f"🚨 HIGH PRIORITY RFP NOTIFICATION: {signal.organization_name}")
        # Would send to Slack, email, or dashboard notification system

def _is_linkedin_content(data: BrightDataWebhookPayload) -> bool:
    """Check if webhook data is from LinkedIn"""
    return (
        'linkedin.com' in data.page_url or
        'LinkedIn' in data.page_title or
        data.site_name == 'linkedin'
    )

def _convert_to_linkedin_post(data: BrightDataWebhookPayload) -> LinkedInPost:
    """Convert BrightData webhook to LinkedInPost object"""
    
    # Extract author information from meta data
    author_name = data.meta.get('author', 'Unknown')
    author_company = data.meta.get('company', '')
    author_role = data.meta.get('role', '')
    
    # Extract engagement metrics
    engagement_count = data.meta.get('engagement_count', 0)
    
    # Extract hashtags and mentions
    hashtags = data.meta.get('hashtags', [])
    mentions = data.meta.get('mentions', [])
    
    return LinkedInPost(
        post_id=data.meta.get('post_id', f"linkedin_{data.extracted_at.timestamp()}"),
        author_name=author_name,
        author_company=author_company,
        author_role=author_role,
        content=data.content,
        published_at=data.extracted_at,
        engagement_count=engagement_count,
        url=data.page_url,
        hashtags=hashtags,
        mentions=mentions
    )

@app.get("/webhook/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "LinkedIn Procurement Webhook Handler",
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)

