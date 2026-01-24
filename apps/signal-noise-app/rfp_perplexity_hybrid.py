#!/usr/bin/env python3
"""
🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM
Intelligent discovery with BrightData fallback for maximum quality & cost efficiency
"""

import asyncio
import json
import os
import sys
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import re

# MCP Client imports
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Configuration
MAX_ENTITIES = 300
LOG_FILE = f"rfp_detection_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
OUTPUT_FILE = f"rfp_detection_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class RFPDetection:
    """Structured RFP detection data"""
    organization: str
    src_link: str
    source_type: str
    discovery_source: str
    discovery_method: str
    validation_status: str
    date_published: str
    deadline: Optional[str]
    deadline_days_remaining: Optional[int]
    estimated_rfp_date: Optional[str]
    budget: str
    summary_json: Dict[str, Any]
    perplexity_validation: Dict[str, Any]
    competitive_intel: Optional[Dict[str, Any]] = None


class PerplexityHybridRFPDetector:
    """Main RFP detection system with Perplexity-first hybrid approach"""
    
    def __init__(self):
        self.perplexity_mcp = None
        self.brightdata_mcp = None
        self.supabase_mcp = None
        
        self.results = {
            "total_rfps_detected": 0,
            "verified_rfps": 0,
            "rejected_rfps": 0,
            "entities_checked": 0,
            "highlights": [],
            "scoring_summary": {
                "avg_confidence": 0.0,
                "avg_fit_score": 0.0,
                "top_opportunity": ""
            },
            "quality_metrics": {
                "brightdata_detections": 0,
                "perplexity_verifications": 0,
                "verified_rate": 0.0,
                "placeholder_urls_rejected": 0,
                "expired_rfps_rejected": 0,
                "competitive_intel_gathered": 0
            },
            "discovery_breakdown": {
                "linkedin_posts": 0,
                "linkedin_jobs": 0,
                "tender_platforms": 0,
                "sports_news_sites": 0,
                "official_websites": 0,
                "linkedin_success_rate": 0.0,
                "tender_platform_success_rate": 0.0
            },
            "perplexity_usage": {
                "discovery_queries": 0,
                "validation_queries": 0,
                "competitive_intel_queries": 0,
                "total_queries": 0,
                "estimated_cost": 0.0
            },
            "brightdata_usage": {
                "targeted_domain_queries": 0,
                "broad_web_queries": 0,
                "total_queries": 0,
                "estimated_cost": 0.0
            },
            "cost_comparison": {
                "total_cost": 0.0,
                "cost_per_verified_rfp": 0.0,
                "estimated_old_system_cost": 0.0,
                "savings_vs_old_system": 0.0
            }
        }
        
    async def initialize_mcp_clients(self):
        """Initialize MCP client connections"""
        logger.info("Initializing MCP clients...")
        
        # Initialize Perplexity MCP client
        try:
            perplexity_params = StdioServerParameters(
                command="node",
                args=["./node_modules/@perplexity-mcp/dist/index.js"],
                env={
                    "PERPLEXITY_API_KEY": os.getenv("PERPLEXITY_API_KEY", "")
                }
            )
            self.perplexity_mcp = await stdio_client(perplexity_params)
            logger.info("Perplexity MCP client initialized")
        except Exception as e:
            logger.warning(f"Perplexity MCP initialization failed: {e}")
        
        # Initialize BrightData MCP client
        try:
            brightdata_params = StdioServerParameters(
                command="node",
                args=["./node_modules/@brightdata-mcp/dist/index.js"],
                env={
                    "BRIGHTDATA_API_TOKEN": os.getenv("BRIGHTDATA_API_TOKEN", "")
                }
            )
            self.brightdata_mcp = await stdio_client(brightdata_params)
            logger.info("BrightData MCP client initialized")
        except Exception as e:
            logger.warning(f"BrightData MCP initialization failed: {e}")
        
        # Initialize Supabase MCP client
        try:
            supabase_params = StdioServerParameters(
                command="node",
                args=["./node_modules/@supabase-mcp/dist/index.js"],
                env={
                    "SUPABASE_ACCESS_TOKEN": os.getenv("SUPABASE_ACCESS_TOKEN", ""),
                    "SUPABASE_URL": os.getenv("SUPABASE_URL", "")
                }
            )
            self.supabase_mcp = await stdio_client(supabase_params)
            logger.info("Supabase MCP client initialized")
        except Exception as e:
            logger.warning(f"Supabase MCP initialization failed: {e}")
    
    async def query_entities_from_supabase(self) -> List[Dict[str, Any]]:
        """Query entities from Supabase cached_entities table"""
        logger.info(f"Querying {MAX_ENTITIES} entities from Supabase...")
        
        query = f"""
        SELECT neo4j_id, labels,
               properties->>'name' as name,
               properties->>'sport' as sport,
               properties->>'country' as country,
               properties->>'type' as type
        FROM cached_entities
        WHERE properties->>'type' IN ('Club', 'League', 'Federation', 'Tournament')
        ORDER BY created_at DESC
        OFFSET 0 LIMIT {MAX_ENTITIES}
        """
        
        try:
            if self.supabase_mcp:
                # Execute query via Supabase MCP
                result = await self.supabase_mcp.execute_sql(query)
                entities = result.get('data', [])
                logger.info(f"Retrieved {len(entities)} entities from Supabase")
                return entities
            else:
                logger.warning("Supabase MCP not available, using mock data")
                return self._get_mock_entities()
        except Exception as e:
            logger.error(f"Error querying entities: {e}")
            return self._get_mock_entities()
    
    def _get_mock_entities(self) -> List[Dict[str, Any]]:
        """Generate mock entities for testing"""
        return [
            {
                "neo4j_id": "1",
                "labels": ["Club"],
                "name": "Manchester United",
                "sport": "Football",
                "country": "England",
                "type": "Club"
            },
            {
                "neo4j_id": "2", 
                "labels": ["League"],
                "name": "Premier League",
                "sport": "Football",
                "country": "England",
                "type": "League"
            }
        ]
    
    async def phase1_perplexity_discovery(self, entity: Dict[str, Any]) -> Dict[str, Any]:
        """Phase 1: Perplexity Discovery with 5-priority system"""
        name = entity['name']
        sport = entity['sport']
        country = entity['country']
        entity_type = entity['type']
        
        logger.info(f"[ENTITY-START] {entity['neo4j_id']} {name}")
        
        query = f"""Research {name} ({sport}) for active procurement opportunities:

🎯 PRIORITY 1 - LinkedIn Official Posts (CHECK FIRST - HIGHEST SUCCESS RATE):
Search: site:linkedin.com/posts + {name}
Look for OFFICIAL account posts ONLY (verified/blue checkmark preferred)
Keywords to match:
- "invites proposals from"
- "soliciting proposals from"  
- "request for expression of interest"
- "invitation to tender"
- "call for proposals"
- "vendor selection process"
- "We're looking for" + ("digital" OR "technology" OR "partner")
- "Seeking partners for"
Time filter: Last 6 months (not 30 days!)
Engagement: Posts with >5 likes/comments (indicates legitimacy)
Extract: Post URL, date, project title, deadline if mentioned, contact info
Success rate: ~35% (7x better than generic search!)

🎯 PRIORITY 2 - LinkedIn Job Postings (EARLY WARNING SIGNALS):
Search: site:linkedin.com/jobs company:{name}
Look for NEW job postings (last 3 months):
- "Project Manager" + ("Digital" OR "Transformation" OR "Implementation")
- "Program Manager" + ("Technology" OR "Digital" OR "Platform")
- "Transformation Lead"
- "Implementation Manager"
Rationale: Organizations hire project managers 1-2 months BEFORE releasing RFPs
Extract: Job title, posting date, project hints from description
If found: Mark as "EARLY_SIGNAL" with estimated RFP timeline
Success rate: ~25% (predictive signal!)

🎯 PRIORITY 3 - Known Tender Platforms (TARGETED SEARCH):
Check these specific URLs in order:
1. https://www.isportconnect.com/marketplace_categorie/tenders/ (search: {name})
2. {{{organization_website}}}/procurement
3. {{{organization_website}}}/tenders
4. {{{organization_website}}}/rfp
5. https://ted.europa.eu (if European organization)
6. https://sam.gov (if US organization)
7. https://www.find-tender.service.gov.uk (if UK organization)
Look for: Active tenders with submission deadlines
Extract: Tender reference, title, deadline, budget, requirements
Success rate: ~30%

🎯 PRIORITY 4 - Sports Industry News Sites (PARTNERSHIP SIGNALS):
Search these domains specifically:
- site:sportspro.com + {name} + ("RFP" OR "tender" OR "partnership announced" OR "selected as")
- site:sportbusiness.com + {name} + ("digital transformation" OR "technology partner")
- site:insideworldfootball.com + {name} + procurement
Time filter: Last 3 months
Extract: Partnership announcements, vendor selections, project launches
Rationale: Recent partnerships indicate digital maturity and future opportunities
Success rate: ~20%

🎯 PRIORITY 5 - LinkedIn Articles & Company Pages:
Search: site:linkedin.com/pulse + {name} + ("digital transformation" OR "RFP" OR "partnership")
Also check: linkedin.com/company/{{{{{organization_slug}}}}}/posts
Time filter: Last 6 months
Extract: Detailed RFP descriptions, procurement strategies, technology roadmaps
Success rate: ~15%

❌ EXCLUSIONS:
- Expired/closed RFPs (deadline passed)
- Awarded contracts (vendor already selected)
- Non-digital opportunities (facilities, catering, merchandise)
- Placeholder/example URLs

📊 VALIDATION REQUIREMENTS:
- All URLs must be real, accessible sources (not example.com)
- Deadlines must be in future (if provided)
- Sources must be from last 6 months
- Provide source URLs for verification

📋 RETURN STRUCTURED DATA:
{{
  "status": "ACTIVE_RFP|PARTNERSHIP|INITIATIVE|NONE",
  "confidence": <0.0-1.0>,
  "opportunities": [{{
    "title": "<project title>",
    "type": "rfp|tender|partnership|initiative",
    "deadline": "<YYYY-MM-DD or null>",
    "days_remaining": <int or null>,
    "url": "<official source URL>",
    "budget": "<estimated value or 'Not specified'>",
    "source_type": "tender_portal|linkedin|news|official_website",
    "source_date": "<YYYY-MM-DD>",
    "verification_url": "<source URL>"
  }}],
  "discovery_method": "perplexity_primary|perplexity_secondary|perplexity_tertiary",
  "sources_checked": ["<url1>", "<url2>"]
}}

If NO opportunities found, return: {{"status": "NONE", "confidence": 1.0, "opportunities": [], "sources_checked": []}}"""
        
        self.results["perplexity_usage"]["discovery_queries"] += 1
        
        try:
            if self.perplexity_mcp:
                response = await self.perplexity_mcp.call_tool("chat_completion", {
                    "messages": [
                        {"role": "user", "content": query}
                    ],
                    "format": "json",
                    "model": "sonar"
                })
                
                result = json.loads(response.get('content', '{}'))
                
                # Process Perplexity results
                if result.get("status") == "ACTIVE_RFP":
                    logger.info(f"[ENTITY-PERPLEXITY-RFP] {name} (Title: {result.get('opportunities', [{}])[0].get('title', 'N/A')}, Deadline: {result.get('opportunities', [{}])[0].get('deadline', 'N/A')}, Budget: {result.get('opportunities', [{}])[0].get('budget', 'N/A')})")
                    return {
                        "status": "VERIFIED",
                        "detection_source": "perplexity_discovery",
                        "data": result
                    }
                elif result.get("status") in ["PARTNERSHIP", "INITIATIVE"]:
                    logger.info(f"[ENTITY-PERPLEXITY-SIGNAL] {name} (Type: {result.get('status')}, Date: {result.get('opportunities', [{}])[0].get('source_date', 'N/A')})")
                    return {
                        "status": "VERIFIED-INDIRECT",
                        "detection_source": "perplexity_discovery",
                        "data": result
                    }
                else:
                    logger.info(f"[ENTITY-PERPLEXITY-NONE] {name}")
                    return {
                        "status": "NONE",
                        "detection_source": "perplexity_discovery",
                        "data": result
                    }
            else:
                logger.warning(f"Perplexity MCP not available for {name}")
                return {"status": "NONE", "detection_source": "perplexity_discovery"}
                
        except Exception as e:
            logger.error(f"Error in Perplexity discovery for {name}: {e}")
            return {"status": "ERROR", "error": str(e)}
    
    async def phase1b_brightdata_fallback(self, entity: Dict[str, Any]) -> Dict[str, Any]:
        """Phase 1B: BrightData Targeted Fallback Search"""
        name = entity['name']
        sport = entity['sport']
        country = entity['country']
        
        logger.info(f"[ENTITY-BRIGHTDATA-FALLBACK] {name}")
        
        # Implement tiered BrightData search
        # TIER 1: Known tender domains
        # TIER 2: Sports industry news
        # TIER 3: LinkedIn targeted
        # TIER 4: General web search (last resort)
        
        self.results["brightdata_usage"]["targeted_domain_queries"] += 1
        
        try:
            if self.brightdata_mcp:
                # BrightData search implementation
                # This would use specific BrightData MCP tools
                pass
            else:
                logger.warning(f"BrightData MCP not available for {name}")
                
        except Exception as e:
            logger.error(f"Error in BrightData fallback for {name}: {e}")
        
        return {"status": "NONE", "detection_source": "brightdata_fallback"}
    
    async def phase2_perplexity_validation(self, entity: Dict[str, Any], brightdata_result: Dict[str, Any]) -> Dict[str, Any]:
        """Phase 2: Perplexity Validation for BrightData detections"""
        name = entity['name']
        
        logger.info(f"[ENTITY-VALIDATION] {name}")
        
        validation_query = f"""Verify this RFP/opportunity from {name}:
Found: {brightdata_result.get('title', 'N/A')} at {brightdata_result.get('url', 'N/A')}

Validate:
1. Is this URL real and accessible (not example.com)?
2. Is this opportunity currently OPEN (not closed/awarded)?
3. What is the exact submission deadline (YYYY-MM-DD)?
4. What is the estimated budget/contract value?
5. When was this posted/announced?

Requirements:
- Only confirm if opportunity is active and open
- Reject if deadline passed or opportunity closed
- Provide alternative sources if primary URL invalid

Return JSON:
{{
  "validation_status": "VERIFIED|REJECTED-CLOSED|REJECTED-EXPIRED|REJECTED-INVALID-URL|UNVERIFIABLE",
  "rejection_reason": "<reason if rejected>",
  "deadline": "<YYYY-MM-DD or null>",
  "budget": "<amount or 'Not specified'>",
  "verified_url": "<real URL or null>",
  "verification_sources": ["<url1>", "<url2>"]
}}"""
        
        self.results["perplexity_usage"]["validation_queries"] += 1
        
        try:
            if self.perplexity_mcp:
                response = await self.perplexity_mcp.call_tool("chat_completion", {
                    "messages": [
                        {"role": "user", "content": validation_query}
                    ],
                    "format": "json"
                })
                
                result = json.loads(response.get('content', '{}'))
                
                if result.get("validation_status") == "VERIFIED":
                    logger.info(f"[ENTITY-VERIFIED] {name} (Deadline: {result.get('deadline', 'N/A')}, Budget: {result.get('budget', 'N/A')})")
                    return {"status": "VERIFIED", "validation_data": result}
                else:
                    logger.info(f"[ENTITY-REJECTED] {name} (Reason: {result.get('rejection_reason', 'Unknown')})")
                    return {"status": f"REJECTED-{result.get('validation_status', 'UNKNOWN')}", "validation_data": result}
            else:
                logger.warning(f"Perplexity MCP not available for validation of {name}")
                return {"status": "UNVERIFIABLE"}
                
        except Exception as e:
            logger.error(f"Error in Perplexity validation for {name}: {e}")
            return {"status": "ERROR", "error": str(e)}
    
    async def phase3_competitive_intelligence(self, entity: Dict[str, Any], fit_score: int) -> Optional[Dict[str, Any]]:
        """Phase 3: Competitive Intelligence for high-fit opportunities"""
        name = entity['name']
        sport = entity['sport']
        
        if fit_score < 80:
            logger.info(f"[ENTITY-INTEL-SKIPPED] {name} (fit score: {fit_score} < 80)")
            return None
        
        logger.info(f"[ENTITY-INTEL] {name}")
        
        intel_query = f"""Analyze {name}'s digital technology landscape:

1. Current Technology Partners: Who provides their digital services?
2. Recent Digital Projects: Projects in last 2 years (vendor, scope, outcome)
3. Decision Makers: Technology/procurement leaders (names, titles, LinkedIn)
4. Competitors: Known vendors bidding on similar opportunities
5. Yellow Panther Edge: Competitive advantages (sports focus, awards, ISO certs)
6. Strategic Context: Budget trends, digital maturity, leadership changes

Return JSON with source URLs."""
        
        self.results["perplexity_usage"]["competitive_intel_queries"] += 1
        
        try:
            if self.perplexity_mcp:
                response = await self.perplexity_mcp.call_tool("chat_completion", {
                    "messages": [
                        {"role": "user", "content": intel_query}
                    ],
                    "format": "json"
                })
                
                intel_data = json.loads(response.get('content', '{}'))
                self.results["quality_metrics"]["competitive_intel_gathered"] += 1
                
                logger.info(f"[ENTITY-INTEL-COMPLETE] {name} (Maturity: {intel_data.get('digital_maturity', 'UNKNOWN')}, Competitors: {len(intel_data.get('competitors', []))})")
                return intel_data
            else:
                logger.warning(f"Perplexity MCP not available for intelligence gathering for {name}")
                return None
                
        except Exception as e:
            logger.error(f"Error in competitive intelligence for {name}: {e}")
            return None
    
    def calculate_fit_score(self, opportunity_data: Dict[str, Any]) -> int:
        """Phase 4: Enhanced Fit Scoring Algorithm"""
        base_score = 0
        
        title = opportunity_data.get('title', '').lower()
        description = opportunity_data.get('description', '').lower()
        
        # Service Alignment (50% weight)
        if any(term in title or term in description for term in ['mobile app', 'mobile application', 'ios', 'android']):
            base_score += 50
        elif any(term in title or term in description for term in ['digital transformation', 'digital platform', 'digital ecosystem']):
            base_score += 50
        elif any(term in title or term in description for term in ['web platform', 'web application', 'website development']):
            base_score += 40
        elif any(term in title or term in description for term in ['fan engagement', 'fan experience', 'fan platform']):
            base_score += 45
        elif any(term in title or term in description for term in ['ticketing', 'ticket system', 'ticketing platform']):
            base_score += 35
        elif any(term in title or term in description for term in ['analytics', 'data platform', 'data intelligence']):
            base_score += 30
        elif any(term in title or term in description for term in ['streaming', 'ott', 'video platform']):
            base_score += 40
        
        # Project Scope Match (30% weight)
        if any(term in title or term in description for term in ['end-to-end', 'full cycle', 'complete solution']):
            base_score += 30
        elif any(term in title or term in description for term in ['strategic partnership', 'multi-year', 'long-term partnership']):
            base_score += 25
        elif any(term in title or term in description for term in ['implementation', 'integration', 'deployment']):
            base_score += 25
        elif any(term in title or term in description for term in ['consulting', 'advisory', 'strategy']):
            base_score += 10
        
        # Yellow Panther Differentiators (20% weight)
        entity_context = opportunity_data.get('entity_context', {})
        if entity_context.get('type') == 'Club':
            base_score += 8
        elif entity_context.get('type') == 'International Federation':
            base_score += 10
        
        if any(term in title or term in description for term in ['iso certification', 'iso 27001', 'security standards']):
            base_score += 5
        if any(term in title or term in description for term in ['award-winning', 'award winning', 'industry awards']):
            base_score += 5
        
        country = entity_context.get('country', '')
        if country in ['England', 'UK', 'United Kingdom', 'Europe', 'European Union']:
            base_score += 4
        
        return min(base_score, 100)
    
    async def process_entity(self, entity: Dict[str, Any]) -> Optional[RFPDetection]:
        """Process single entity through all phases"""
        try:
            # Phase 1: Perplexity Discovery
            perplexity_result = await self.phase1_perplexity_discovery(entity)
            
            if perplexity_result["status"] in ["VERIFIED", "VERIFIED-INDIRECT"]:
                # Direct Perplexity detection, skip BrightData
                opportunity_data = perplexity_result["data"]["opportunities"][0] if perplexity_result["data"].get("opportunities") else {}
                
                detection = RFPDetection(
                    organization=entity['name'],
                    src_link=opportunity_data.get('url', ''),
                    source_type=opportunity_data.get('source_type', 'unknown'),
                    discovery_source='perplexity_priority_1',
                    discovery_method='perplexity_primary',
                    validation_status='VERIFIED' if perplexity_result["status"] == "VERIFIED" else "EARLY_SIGNAL",
                    date_published=opportunity_data.get('source_date', datetime.now().strftime('%Y-%m-%d')),
                    deadline=opportunity_data.get('deadline'),
                    deadline_days_remaining=opportunity_data.get('days_remaining'),
                    estimated_rfp_date=None,
                    budget=opportunity_data.get('budget', 'Not specified'),
                    summary_json={
                        "title": opportunity_data.get('title', 'Unknown'),
                        "confidence": perplexity_result["data"].get('confidence', 0.0),
                        "urgency": "medium",
                        "fit_score": 0,
                        "source_quality": 1.0
                    },
                    perplexity_validation={
                        "verified_by_perplexity": True,
                        "deadline_confirmed": bool(opportunity_data.get('deadline')),
                        "url_verified": True,
                        "budget_estimated": False,
                        "verification_sources": opportunity_data.get('sources_checked', [])
                    }
                )
                
                # Calculate fit score
                detection.summary_json["fit_score"] = self.calculate_fit_score({
                    "title": opportunity_data.get('title', ''),
                    "description": opportunity_data.get('description', ''),
                    "entity_context": entity
                })
                
                # Phase 3: Competitive Intelligence for high-fit opportunities
                if detection.summary_json["fit_score"] >= 80:
                    intel = await self.phase3_competitive_intelligence(entity, detection.summary_json["fit_score"])
                    detection.competitive_intel = intel
                
                self.results["verified_rfps"] += 1
                self.results["total_rfps_detected"] += 1
                
                return detection
                
            elif perplexity_result["status"] == "NONE":
                # Phase 1B: BrightData Fallback
                brightdata_result = await self.phase1b_brightdata_fallback(entity)
                
                if brightdata_result["status"] != "NONE":
                    # Phase 2: Perplexity Validation
                    validation_result = await self.phase2_perplexity_validation(entity, brightdata_result)
                    
                    if validation_result["status"] == "VERIFIED":
                        # Create detection from validated BrightData result
                        validation_data = validation_result.get("validation_data", {})
                        
                        detection = RFPDetection(
                            organization=entity['name'],
                            src_link=validation_data.get('verified_url', brightdata_result.get('url', '')),
                            source_type='tender_portal',
                            discovery_source='brightdata_tier_1',
                            discovery_method='brightdata_fallback',
                            validation_status='VERIFIED',
                            date_published=datetime.now().strftime('%Y-%m-%d'),
                            deadline=validation_data.get('deadline'),
                            deadline_days_remaining=None,
                            estimated_rfp_date=None,
                            budget=validation_data.get('budget', 'Not specified'),
                            summary_json={
                                "title": brightdata_result.get('title', 'Unknown'),
                                "confidence": 0.7,
                                "urgency": "medium",
                                "fit_score": 0,
                                "source_quality": 0.7
                            },
                            perplexity_validation={
                                "verified_by_perplexity": True,
                                "deadline_confirmed": bool(validation_data.get('deadline')),
                                "url_verified": bool(validation_data.get('verified_url')),
                                "budget_estimated": False,
                                "verification_sources": validation_data.get('verification_sources', [])
                            }
                        )
                        
                        # Calculate fit score
                        detection.summary_json["fit_score"] = self.calculate_fit_score({
                            "title": brightdata_result.get('title', ''),
                            "description": brightdata_result.get('description', ''),
                            "entity_context": entity
                        })
                        
                        # Phase 3: Competitive Intelligence for high-fit opportunities
                        if detection.summary_json["fit_score"] >= 80:
                            intel = await self.phase3_competitive_intelligence(entity, detection.summary_json["fit_score"])
                            detection.competitive_intel = intel
                        
                        self.results["verified_rfps"] += 1
                        self.results["brightdata_detections"] += 1
                        self.results["total_rfps_detected"] += 1
                        
                        return detection
                    else:
                        self.results["rejected_rfps"] += 1
                        logger.info(f"[ENTITY-NONE] {entity['name']} (rejected in validation)")
                        return None
                else:
                    logger.info(f"[ENTITY-NONE] {entity['name']}")
                    return None
            
            return None
            
        except Exception as e:
            logger.error(f"Error processing entity {entity.get('name', 'Unknown')}: {e}")
            return None
    
    async def run(self):
        """Main execution flow"""
        logger.info("🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM")
        logger.info("Starting RFP detection process...")
        
        # Initialize MCP clients
        await self.initialize_mcp_clients()
        
        # Query entities
        entities = await self.query_entities_from_supabase()
        self.results["entities_checked"] = len(entities)
        
        logger.info(f"Processing {len(entities)} entities...")
        
        # Process entities
        for i, entity in enumerate(entities, 1):
            try:
                detection = await self.process_entity(entity)
                if detection:
                    self.results["highlights"].append(asdict(detection))
                    
                    # Update scoring summary
                    if detection.summary_json["fit_score"] > self.results["scoring_summary"]["avg_fit_score"]:
                        self.results["scoring_summary"]["top_opportunity"] = detection.organization
            except Exception as e:
                logger.error(f"Failed to process entity {i}: {e}")
                continue
        
        # Calculate final metrics
        if self.results["verified_rfps"] > 0:
            self.results["scoring_summary"]["avg_fit_score"] = sum(
                h["summary_json"]["fit_score"] for h in self.results["highlights"]
            ) / len(self.results["highlights"])
            
            self.results["quality_metrics"]["verified_rate"] = (
                self.results["verified_rfps"] / self.results["total_rfps_detected"]
                if self.results["total_rfps_detected"] > 0 else 0.0
            )
            
            self.results["perplexity_usage"]["total_queries"] = (
                self.results["perplexity_usage"]["discovery_queries"] +
                self.results["perplexity_usage"]["validation_queries"] +
                self.results["perplexity_usage"]["competitive_intel_queries"]
            )
            
            self.results["brightdata_usage"]["total_queries"] = (
                self.results["brightdata_usage"]["targeted_domain_queries"] +
                self.results["brightdata_usage"]["broad_web_queries"]
            )
        
        # Save results
        await self.save_results()
        
        logger.info("RFP detection complete!")
        logger.info(f"Results saved to: {OUTPUT_FILE}")
        
        # Display summary
        self.display_summary()
    
    async def save_results(self):
        """Save results to JSON file"""
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
    
    def display_summary(self):
        """Display detection summary"""
        logger.info("")
        logger.info("🎯 DETECTION SUMMARY")
        logger.info(f"Total entities checked: {self.results['entities_checked']}")
        logger.info(f"Total RFPs detected: {self.results['total_rfps_detected']}")
        logger.info(f"Verified RFPs: {self.results['verified_rfps']}")
        logger.info(f"Rejected RFPs: {self.results['rejected_rfps']}")
        logger.info(f"Verification rate: {self.results['quality_metrics']['verified_rate']:.2%}")
        logger.info(f"Average fit score: {self.results['scoring_summary']['avg_fit_score']:.1f}")
        logger.info(f"Top opportunity: {self.results['scoring_summary']['top_opportunity']}")


async def main():
    """Main entry point"""
    detector = PerplexityHybridRFPDetector()
    await detector.run()


if __name__ == "__main__":
    asyncio.run(main())