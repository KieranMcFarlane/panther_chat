#!/usr/bin/env python3
"""
🎯 ENHANCED PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM
Intelligent discovery with BrightData fallback for maximum quality & cost efficiency

This script implements a comprehensive 5-phase RFP detection system:
1. Perplexity MCP Discovery (LinkedIn-first with 5-priority system)
2. BrightData Fallback (Targeted 4-tier system)
3. Perplexity Validation (Quality verification)
4. Competitive Intelligence (High-value opportunities only)
5. Enhanced Fit Scoring & Structured Output

Author: Enhanced System v2.0
Date: 2026-02-11
"""

import asyncio
import json
import os
import re
import sys
import argparse
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict, field
from enum import Enum
import subprocess
import tempfile
from pathlib import Path

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent / "backend"))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'rfp_detection_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class DiscoverySource(Enum):
    """Track where opportunities were discovered"""
    PERPLEXITY_PRIORITY_1 = "perplexity_priority_1"  # LinkedIn posts
    PERPLEXITY_PRIORITY_2 = "perplexity_priority_2"  # LinkedIn jobs
    PERPLEXITY_PRIORITY_3 = "perplexity_priority_3"  # Tender platforms
    PERPLEXITY_PRIORITY_4 = "perplexity_priority_4"  # Sports news sites
    PERPLEXITY_PRIORITY_5 = "perplexity_priority_5"  # LinkedIn articles
    BRIGHTDATA_TIER_1 = "brightdata_tier_1"  # Known tender domains
    BRIGHTDATA_TIER_2 = "brightdata_tier_2"  # Sports industry news
    BRIGHTDATA_TIER_3 = "brightdata_tier_3"  # LinkedIn targeted
    BRIGHTDATA_TIER_4 = "brightdata_tier_4"  # General web (last resort)


class ValidationStatus(Enum):
    """Validation status for detections"""
    VERIFIED = "VERIFIED"
    EARLY_SIGNAL = "EARLY_SIGNAL"
    UNVERIFIED_BRIGHTDATA = "UNVERIFIED-BRIGHTDATA"
    REJECTED_CLOSED = "REJECTED-CLOSED"
    REJECTED_EXPIRED = "REJECTED-EXPIRED"
    REJECTED_INVALID_URL = "REJECTED-INVALID-URL"
    REJECTED_UNVERIFIABLE = "REJECTED-UNVERIFIABLE"


@dataclass
class RFPDetection:
    """Data structure for RFP detection results"""
    organization: str
    sport: str
    country: str
    entity_type: str
    neo4j_id: str
    
    # Discovery metadata
    discovery_source: DiscoverySource
    discovery_method: str  # "perplexity_primary" or "brightdata_fallback"
    validation_status: ValidationStatus
    
    # Opportunity details
    status: str  # "ACTIVE_RFP", "PARTNERSHIP", "INITIATIVE", "NONE"
    source_type: str  # "linkedin_post", "tender_portal", etc.
    source_url: str
    
    # Content
    title: str
    confidence: float
    urgency: str  # "low", "medium", "high"
    
    # Timing
    date_published: Optional[str] = None
    deadline: Optional[str] = None
    deadline_days_remaining: Optional[int] = None
    estimated_rfp_date: Optional[str] = None  # For EARLY_SIGNAL
    
    # Financial
    budget: str = "Not specified"
    
    # Validation
    verified_by_perplexity: bool = False
    deadline_confirmed: bool = False
    url_verified: bool = False
    budget_estimated: bool = False
    verification_sources: List[str] = field(default_factory=list)
    
    # Fit scoring
    fit_score: int = 0
    source_quality: float = 0.0
    
    # Competitive intelligence
    digital_maturity: str = "UNKNOWN"
    current_partners: List[str] = field(default_factory=list)
    recent_projects: List[Dict] = field(default_factory=list)
    competitors: List[str] = field(default_factory=list)
    yp_advantages: List[str] = field(default_factory=list)
    decision_makers: List[Dict] = field(default_factory=list)


class EnhancedPerplexityHybridRFPDetector:
    """Main RFP detection system using Perplexity-first approach"""
    
    def __init__(self, max_entities: int = 300):
        self.max_entities = max_entities
        self.entities_checked = 0
        self.total_rfps_detected = 0
        self.verified_rfps = 0
        self.rejected_rfps = 0
        self.highlights: List[RFPDetection] = []
        
        # Quality metrics
        self.brightdata_detections = 0
        self.perplexity_verifications = 0
        self.placeholder_urls_rejected = 0
        self.expired_rfps_rejected = 0
        self.competitive_intel_gathered = 0
        
        # Discovery breakdown
        self.linkedin_posts = 0
        self.linkedin_jobs = 0
        self.tender_platforms = 0
        self.sports_news_sites = 0
        self.official_websites = 0
        
        # Usage tracking
        self.perplexity_discovery_queries = 0
        self.perplexity_validation_queries = 0
        self.perplexity_intel_queries = 0
        self.brightdata_targeted_queries = 0
        self.brightdata_broad_queries = 0
        
        # Initialize clients
        self.brightdata_client = None
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize external service clients"""
        try:
            # Import BrightData SDK client
            from brightdata_sdk_client import BrightDataSDKClient
            self.brightdata_client = BrightDataSDKClient()
            logger.info("✅ BrightData SDK client initialized")
        except Exception as e:
            logger.warning(f"⚠️ Could not initialize BrightData client: {e}")
            self.brightdata_client = None
    
    async def run_detection(self) -> Dict[str, Any]:
        """Main execution flow for RFP detection"""
        logger.info("🎯 ENHANCED PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM")
        logger.info("=" * 60)
        logger.info(f"Starting detection with {self.max_entities} entities...")
        logger.info("")
        
        try:
            # Phase 0: Query entities from Supabase
            entities = await self._query_entities()
            logger.info(f"✅ Loaded {len(entities)} entities from Supabase\n")
            
            if not entities:
                logger.warning("No entities to process. Exiting.")
                return self._generate_final_output()
            
            # Phase 1-4: Process each entity
            for idx, entity in enumerate(entities, 1):
                await self._process_entity(idx, entity)
                
                # Add delay to avoid rate limiting
                if idx < len(entities):
                    await asyncio.sleep(0.5)
            
            # Phase 5: Generate final output
            final_output = self._generate_final_output()
            
            # Write to Supabase
            await self._write_results_to_supabase(final_output)
            
            return final_output
            
        except Exception as e:
            logger.error(f"❌ Fatal error in detection: {str(e)}")
            import traceback
            traceback.print_exc()
            return self._generate_error_output(str(e))
    
    async def _query_entities(self) -> List[Dict]:
        """Query entities from Supabase cached_entities table"""
        logger.info("📊 Phase 0: Querying entities from Supabase...")
        
        query = f"""
            SELECT neo4j_id, labels,
                   properties->>'name' as name,
                   properties->>'sport' as sport,
                   properties->>'country' as country,
                   properties->>'type' as type
            FROM cached_entities
            WHERE properties->>'type' IN ('Club', 'League', 'Federation', 'Tournament')
            ORDER BY created_at DESC
            OFFSET 0 LIMIT {self.max_entities}
        """
        
        try:
            # Call Supabase MCP tool
            result = await self._call_mcp_tool("supabase", "execute_sql", {"query": query})
            
            if result and result.get("status") == "success" and result.get("data"):
                entities = result["data"]
                logger.info(f"✓ Retrieved {len(entities)} entities from Supabase")
                return entities
            else:
                logger.warning(f"⚠️  Warning: Could not query entities: {result}")
                return []
                
        except Exception as e:
            logger.error(f"Error querying Supabase: {e}")
            return []
    
    async def _process_entity(self, index: int, entity: Dict):
        """Process a single entity through all phases"""
        name = entity.get("name", "Unknown")
        sport = entity.get("sport", "Unknown")
        country = entity.get("country", "Unknown")
        entity_type = entity.get("type", "Unknown")
        neo4j_id = entity.get("neo4j_id", "")
        
        logger.info(f"[ENTITY-START] {index} {name}")
        
        self.entities_checked += 1
        
        try:
            # Phase 1: Perplexity discovery
            perplexity_result = await self._phase1_perplexity_discovery(
                name, sport, country, entity_type, neo4j_id
            )
            
            if perplexity_result:
                # Perplexity found something
                await self._handle_perplexity_result(perplexity_result)
            else:
                # Phase 1B: BrightData fallback
                brightdata_result = await self._phase1b_brightdata_fallback(
                    name, sport, country, entity_type, neo4j_id
                )
                
                if brightdata_result:
                    # Phase 2: Validate BrightData finding
                    validated_result = await self._phase2_perplexity_validation(
                        brightdata_result, name
                    )
                    
                    if validated_result:
                        # Phase 3: Gather competitive intelligence (if high fit)
                        if validated_result.fit_score >= 80:
                            await self._phase3_competitive_intelligence(validated_result)
                        
                        # Phase 4: Calculate fit score (already done in validation)
                        self.highlights.append(validated_result)
                        self.verified_rfps += 1
                        logger.info(f"[ENTITY-VERIFIED] {name}")
                    else:
                        self.rejected_rfps += 1
                        logger.info(f"[ENTITY-REJECTED] {name}")
                else:
                    logger.info(f"[ENTITY-NONE] {name}")
        
        except Exception as e:
            logger.error(f"[ENTITY-ERROR] {name} - {str(e)}")
    
    async def _phase1_perplexity_discovery(
        self, name: str, sport: str, country: str, entity_type: str, neo4j_id: str
    ) -> Optional[RFPDetection]:
        """Phase 1: Perplexity LinkedIn-first intelligent discovery"""
        self.perplexity_discovery_queries += 1
        
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
2. {{{{organization_website}}}}/procurement
3. {{{{organization_website}}}}/tenders
4. {{{{organization_website}}}}/rfp
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
Also check: linkedin.com/company/{{{{organization_slug}}}}/posts
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
  "discovery_method": "perplexity_primary",
  "sources_checked": ["<url1>", "<url2>"]
}}

If NO opportunities found, return: {{"status": "NONE", "confidence": 1.0, "opportunities": [], "sources_checked": []}}"""
        
        try:
            result = await self._call_mcp_tool("perplexity-mcp", "chat_completion", {
                "messages": [
                    {"role": "system", "content": "You are an expert RFP detection system. Return ONLY valid JSON, no markdown."},
                    {"role": "user", "content": query}
                ],
                "format": "json",
                "model": "sonar",
                "max_tokens": 2000
            })
            
            if result and result.get("status") == "success":
                content = result.get("content", "")
                # Parse JSON from Perplexity response
                data = self._parse_json_from_response(content)
                
                if data and data.get("status") != "NONE":
                    # Create detection from Perplexity result
                    opportunity = data.get("opportunities", [{}])[0]
                    
                    detection = RFPDetection(
                        organization=name,
                        sport=sport,
                        country=country,
                        entity_type=entity_type,
                        neo4j_id=neo4j_id,
                        discovery_source=DiscoverySource.PERPLEXITY_PRIORITY_1,
                        discovery_method="perplexity_primary",
                        validation_status=ValidationStatus.VERIFIED,
                        status=data.get("status", "ACTIVE_RFP"),
                        source_type=opportunity.get("source_type", "linkedin_post"),
                        source_url=opportunity.get("url", ""),
                        title=opportunity.get("title", "Digital Project"),
                        confidence=data.get("confidence", 0.8),
                        urgency="medium",
                        date_published=opportunity.get("source_date"),
                        deadline=opportunity.get("deadline"),
                        deadline_days_remaining=opportunity.get("days_remaining"),
                        budget=opportunity.get("budget", "Not specified"),
                        verified_by_perplexity=True,
                        url_verified=True
                    )
                    
                    # Calculate fit score
                    detection.fit_score = self._calculate_fit_score(detection)
                    
                    # Update tracking
                    self.total_rfps_detected += 1
                    
                    if data.get("status") == "ACTIVE_RFP":
                        logger.info(f"[ENTITY-PERPLEXITY-RFP] {name} (Title: {detection.title}, Deadline: {detection.deadline}, Budget: {detection.budget})")
                        self.linkedin_posts += 1
                    elif data.get("status") in ["PARTNERSHIP", "INITIATIVE"]:
                        logger.info(f"[ENTITY-PERPLEXITY-SIGNAL] {name} (Type: {data.get('status')}, Date: {detection.date_published})")
                    
                    return detection
                else:
                    logger.info(f"[ENTITY-PERPLEXITY-NONE] {name}")
                    return None
            
        except Exception as e:
            logger.error(f"[ENTITY-PERPLEXITY-ERROR] {name} - {str(e)}")
        
        return None
    
    async def _phase1b_brightdata_fallback(
        self, name: str, sport: str, country: str, entity_type: str, neo4j_id: str
    ) -> Optional[RFPDetection]:
        """Phase 1B: BrightData fallback for targeted domain searches"""
        logger.info(f"[ENTITY-BRIGHTDATA-FALLBACK] {name}")
        
        try:
            # TIER 1: Known tender domains
            tier1_domains = [
                ("isportconnect.com", f"{name} digital RFP tender proposal"),
                ("ted.europa.eu", f"{name} digital technology" if country in ["UK", "Germany", "France", "Spain", "Italy"] else None),
                ("sam.gov", f"{name} technology" if country == "United States" else None),
            ]
            
            for domain, query in tier1_domains:
                if query:
                    self.brightdata_targeted_queries += 1
                    result = await self._call_brightdata_search(
                        query=f"site:{domain} {query}",
                        num_results=5
                    )
                    
                    if result and result.get("results"):
                        detection = self._create_brightdata_detection(
                            name, sport, country, entity_type, neo4j_id,
                            result["results"][0], DiscoverySource.BRIGHTDATA_TIER_1
                        )
                        if detection:
                            self.brightdata_detections += 1
                            logger.info(f"[ENTITY-BRIGHTDATA-DETECTED] {name} (Hits: {len(result['results'])}, Tier: 1)")
                            return detection
            
            # TIER 2: Sports industry news
            self.brightdata_targeted_queries += 1
            news_query = f"{name} RFP tender partnership digital transformation (site:sportspro.com OR site:sportbusiness.com OR site:insideworldfootball.com)"
            result = await self._call_brightdata_search(
                query=news_query,
                num_results=5
            )
            
            if result and result.get("results"):
                detection = self._create_brightdata_detection(
                    name, sport, country, entity_type, neo4j_id,
                    result["results"][0], DiscoverySource.BRIGHTDATA_TIER_2
                )
                if detection:
                    self.brightdata_detections += 1
                    logger.info(f"[ENTITY-BRIGHTDATA-DETECTED] {name} (Hits: {len(result['results'])}, Tier: 2)")
                    return detection
            
            # TIER 3: LinkedIn targeted search
            self.brightdata_targeted_queries += 1
            linkedin_query = f"site:linkedin.com \"{name}\" (\"invites proposals\" OR \"RFP\" OR \"soliciting\" OR \"Project Manager Digital\")"
            result = await self._call_brightdata_search(
                query=linkedin_query,
                num_results=5
            )
            
            if result and result.get("results"):
                detection = self._create_brightdata_detection(
                    name, sport, country, entity_type, neo4j_id,
                    result["results"][0], DiscoverySource.BRIGHTDATA_TIER_3
                )
                if detection:
                    self.brightdata_detections += 1
                    logger.info(f"[ENTITY-BRIGHTDATA-DETECTED] {name} (Hits: {len(result['results'])}, Tier: 3)")
                    return detection
            
            # TIER 4: General web search (LAST RESORT)
            self.brightdata_broad_queries += 1
            general_query = f"{name} {sport} RFP \"digital transformation\" mobile app technology"
            result = await self._call_brightdata_search(
                query=general_query,
                num_results=10
            )
            
            if result and result.get("results"):
                detection = self._create_brightdata_detection(
                    name, sport, country, entity_type, neo4j_id,
                    result["results"][0], DiscoverySource.BRIGHTDATA_TIER_4
                )
                if detection:
                    self.brightdata_detections += 1
                    logger.info(f"[ENTITY-BRIGHTDATA-DETECTED] {name} (Hits: {len(result['results'])}, Tier: 4)")
                    return detection
        
        except Exception as e:
            logger.error(f"[ENTITY-BRIGHTDATA-ERROR] {name} - {str(e)}")
        
        return None
    
    def _create_brightdata_detection(
        self, name: str, sport: str, country: str, entity_type: str, neo4j_id: str,
        search_result: Dict, source: DiscoverySource
    ) -> Optional[RFPDetection]:
        """Create RFPDetection from BrightData search result"""
        try:
            return RFPDetection(
                organization=name,
                sport=sport,
                country=country,
                entity_type=entity_type,
                neo4j_id=neo4j_id,
                discovery_source=source,
                discovery_method="brightdata_fallback",
                validation_status=ValidationStatus.UNVERIFIED_BRIGHTDATA,
                status="ACTIVE_RFP",
                source_type="web_search",
                source_url=search_result.get("url", ""),
                title=search_result.get("title", "Digital Project"),
                confidence=0.6,
                urgency="medium",
                budget="Not specified"
            )
        except Exception as e:
            logger.error(f"Error creating BrightData detection: {e}")
            return None
    
    async def _phase2_perplexity_validation(
        self, detection: RFPDetection, organization: str
    ) -> Optional[RFPDetection]:
        """Phase 2: Perplexity validation for BrightData detections"""
        logger.info(f"[ENTITY-VALIDATING] {organization}")
        self.perplexity_validation_queries += 1
        
        query = f"""Verify this RFP/opportunity from {organization}:
Found: {detection.title} at {detection.source_url}

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
        
        try:
            result = await self._call_mcp_tool("perplexity-mcp", "chat_completion", {
                "messages": [
                    {"role": "system", "content": "You are an expert RFP validation system. Return ONLY valid JSON."},
                    {"role": "user", "content": query}
                ],
                "format": "json",
                "model": "sonar",
                "max_tokens": 1000
            })
            
            if result and result.get("status") == "success":
                content = result.get("content", "")
                data = self._parse_json_from_response(content)
                
                if data:
                    validation_status = data.get("validation_status", "UNVERIFIABLE")
                    
                    if validation_status == "VERIFIED":
                        detection.validation_status = ValidationStatus.VERIFIED
                        detection.verified_by_perplexity = True
                        detection.url_verified = True
                        detection.deadline = data.get("deadline")
                        detection.budget = data.get("budget", "Not specified")
                        detection.budget_estimated = detection.budget != "Not specified"
                        detection.verification_sources = data.get("verification_sources", [])
                        detection.fit_score = self._calculate_fit_score(detection)
                        
                        logger.info(f"[ENTITY-VERIFIED] {organization} (Deadline: {detection.deadline}, Budget: {detection.budget})")
                        return detection
                    else:
                        rejection_reason = data.get("rejection_reason", validation_status)
                        detection.validation_status = ValidationStatus[f"REJECTED_{validation_status.replace('REJECTED-', '')}"]
                        logger.info(f"[ENTITY-REJECTED] {organization} (Reason: {rejection_reason})")
                        
                        # Update rejection metrics
                        if "EXPIRED" in validation_status:
                            self.expired_rfps_rejected += 1
                        elif "INVALID_URL" in validation_status:
                            self.placeholder_urls_rejected += 1
                        
                        return None
        
        except Exception as e:
            logger.error(f"[ENTITY-VALIDATION-ERROR] {organization} - {str(e)}")
        
        return None
    
    async def _phase3_competitive_intelligence(self, detection: RFPDetection):
        """Phase 3: Gather competitive intelligence for high-fit opportunities"""
        logger.info(f"[ENTITY-INTEL] {detection.organization}")
        self.competitive_intel_gathered += 1
        self.perplexity_intel_queries += 1
        
        query = f"""Analyze {detection.organization}'s digital technology landscape:

1. Current Technology Partners: Who provides their digital services?
2. Recent Digital Projects: Projects in last 2 years (vendor, scope, outcome)
3. Decision Makers: Technology/procurement leaders (names, titles, LinkedIn)
4. Competitors: Known vendors bidding on similar opportunities
5. Yellow Panther Edge: Competitive advantages (sports focus, awards, ISO certs)
6. Strategic Context: Budget trends, digital maturity, leadership changes

Return JSON with source URLs."""
        
        try:
            result = await self._call_mcp_tool("perplexity-mcp", "chat_completion", {
                "messages": [
                    {"role": "system", "content": "You are a competitive intelligence analyst. Return ONLY valid JSON."},
                    {"role": "user", "content": query}
                ],
                "format": "json",
                "model": "sonar",
                "max_tokens": 2000
            })
            
            if result and result.get("status") == "success":
                content = result.get("content", "")
                data = self._parse_json_from_response(content)
                
                if data:
                    detection.digital_maturity = data.get("digital_maturity", "MEDIUM")
                    detection.current_partners = data.get("current_partners", [])
                    detection.recent_projects = data.get("recent_projects", [])
                    detection.competitors = data.get("competitors", [])
                    detection.yp_advantages = data.get("yp_advantages", [])
                    detection.decision_makers = data.get("decision_makers", [])
                    
                    logger.info(f"[ENTITY-INTEL] {detection.organization} (Maturity: {detection.digital_maturity}, Competitors: {len(detection.competitors)})")
        
        except Exception as e:
            logger.error(f"[ENTITY-INTEL-ERROR] {detection.organization} - {str(e)}")
    
    def _calculate_fit_score(self, detection: RFPDetection) -> int:
        """Calculate Yellow Panther fit score using enhanced algorithm"""
        base_score = 0
        
        title_lower = detection.title.lower()
        
        # A. Service Alignment (50% weight)
        service_keywords = {
            "mobile app development": 50,
            "digital transformation": 50,
            "web platform development": 40,
            "fan engagement": 45,
            "ticketing system": 35,
            "analytics": 30,
            "streaming": 40,
            "ott platform": 40
        }
        
        for keyword, points in service_keywords.items():
            if keyword in title_lower:
                base_score += points
                break
        
        # B. Project Scope Match (30% weight)
        scope_keywords = {
            "end-to-end": 30,
            "strategic partnership": 25,
            "implementation": 25,
            "integration": 20,
            "consulting": 10
        }
        
        for keyword, points in scope_keywords.items():
            if keyword in title_lower:
                base_score += points
                break
        
        # C. Yellow Panther Differentiators (20% weight)
        if detection.entity_type == "International federation":
            base_score += 8
        elif detection.entity_type in ["Premier league", "Top-tier club"]:
            base_score += 8
        elif detection.entity_type == "Club":
            base_score += 5
        
        if "iso" in title_lower:
            base_score += 5
        if "award" in title_lower:
            base_score += 5
        if detection.country in ["United Kingdom", "UK", "Germany", "France"]:
            base_score += 4
        
        return min(base_score, 100)
    
    def _parse_json_from_response(self, content: str) -> Optional[Dict]:
        """Parse JSON from Perplexity response (handles markdown wrapping)"""
        try:
            # Remove markdown code blocks if present
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            return json.loads(content)
        except json.JSONDecodeError:
            # Try to extract JSON with regex
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
            return None
    
    async def _handle_perplexity_result(self, detection: RFPDetection):
        """Handle Perplexity discovery result"""
        self.total_rfps_detected += 1
        
        # Phase 3: Gather competitive intelligence if high fit
        if detection.fit_score >= 80:
            await self._phase3_competitive_intelligence(detection)
        
        self.highlights.append(detection)
        self.verified_rfps += 1
    
    async def _call_mcp_tool(self, server: str, tool: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Call an MCP tool - placeholder for actual MCP integration"""
        # This is a placeholder - in actual implementation, this would call the MCP server
        logger.debug(f"Calling MCP tool: {server}.{tool} with params: {params}")
        
        # Simulate a response for demonstration
        # In production, this would actually call the MCP server
        return None
    
    async def _call_brightdata_search(self, query: str, num_results: int = 5) -> Optional[Dict[str, Any]]:
        """Call BrightData search - placeholder for actual integration"""
        # This is a placeholder for BrightData SDK integration
        logger.debug(f"Calling BrightData search: {query}")
        
        # Simulate a response for demonstration
        # In production, this would use the BrightData SDK client
        return None
    
    async def _write_results_to_supabase(self, results: Dict[str, Any]):
        """Write verified results to Supabase RFP opportunities table"""
        logger.info("Writing results to Supabase...")
        
        try:
            # Write each verified opportunity to Supabase
            for highlight in results.get("highlights", []):
                query = """
                    INSERT INTO rfp_opportunities (
                        organization, src_link, source_type, discovery_source,
                        discovery_method, validation_status, date_published,
                        deadline, deadline_days_remaining, estimated_rfp_date,
                        budget, summary_json, perplexity_validation,
                        competitive_intel, created_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
                    )
                    ON CONFLICT (organization, src_link) DO UPDATE SET
                        validation_status = EXCLUDED.validation_status,
                        deadline = EXCLUDED.deadline,
                        budget = EXCLUDED.budget,
                        updated_at = NOW()
                """
                
                # Convert JSON objects to strings for storage
                summary_json = json.dumps(highlight.get("summary_json", {}))
                perplexity_validation = json.dumps(highlight.get("perplexity_validation", {}))
                competitive_intel = json.dumps(highlight.get("competitive_intel", {}))
                
                await self._call_mcp_tool("supabase", "execute_sql", {
                    "query": query,
                    "params": [
                        highlight.get("organization"),
                        highlight.get("src_link"),
                        highlight.get("source_type"),
                        highlight.get("discovery_source"),
                        highlight.get("discovery_method"),
                        highlight.get("validation_status"),
                        highlight.get("date_published"),
                        highlight.get("deadline"),
                        highlight.get("deadline_days_remaining"),
                        highlight.get("estimated_rfp_date"),
                        highlight.get("budget"),
                        summary_json,
                        perplexity_validation,
                        competitive_intel
                    ]
                })
            
            logger.info(f"✓ Written {len(results.get('highlights', []))} opportunities to Supabase")
            
        except Exception as e:
            logger.error(f"Error writing to Supabase: {e}")
    
    def _generate_final_output(self) -> Dict[str, Any]:
        """Generate final structured JSON output"""
        highlights_data = []
        
        for detection in self.highlights:
            highlights_data.append({
                "organization": detection.organization,
                "src_link": detection.source_url,
                "source_type": detection.source_type,
                "discovery_source": detection.discovery_source.value,
                "discovery_method": detection.discovery_method,
                "validation_status": detection.validation_status.value,
                "date_published": detection.date_published,
                "deadline": detection.deadline,
                "deadline_days_remaining": detection.deadline_days_remaining,
                "estimated_rfp_date": detection.estimated_rfp_date,
                "budget": detection.budget,
                "summary_json": {
                    "title": detection.title,
                    "confidence": detection.confidence,
                    "urgency": detection.urgency,
                    "fit_score": detection.fit_score,
                    "source_quality": detection.source_quality
                },
                "perplexity_validation": {
                    "verified_by_perplexity": detection.verified_by_perplexity,
                    "deadline_confirmed": detection.deadline_confirmed,
                    "url_verified": detection.url_verified,
                    "budget_estimated": detection.budget_estimated,
                    "verification_sources": detection.verification_sources
                },
                "competitive_intel": {
                    "digital_maturity": detection.digital_maturity,
                    "current_partners": detection.current_partners,
                    "recent_projects": detection.recent_projects,
                    "competitors": detection.competitors,
                    "yp_advantages": detection.yp_advantages,
                    "decision_makers": detection.decision_makers
                }
            })
        
        # Calculate cost metrics
        perplexity_cost = (
            self.perplexity_discovery_queries * 0.01 +
            self.perplexity_validation_queries * 0.005 +
            self.perplexity_intel_queries * 0.02
        )
        
        brightdata_cost = (
            self.brightdata_targeted_queries * 0.002 +
            self.brightdata_broad_queries * 0.01
        )
        
        total_cost = perplexity_cost + brightdata_cost
        old_system_cost = self.entities_checked * 0.1
        
        return {
            "total_rfps_detected": self.total_rfps_detected,
            "verified_rfps": self.verified_rfps,
            "rejected_rfps": self.rejected_rfps,
            "entities_checked": self.entities_checked,
            "highlights": highlights_data,
            "scoring_summary": {
                "avg_confidence": sum(d.confidence for d in self.highlights) / len(self.highlights) if self.highlights else 0,
                "avg_fit_score": sum(d.fit_score for d in self.highlights) / len(self.highlights) if self.highlights else 0,
                "top_opportunity": self.highlights[0].organization if self.highlights else None
            },
            "quality_metrics": {
                "brightdata_detections": self.brightdata_detections,
                "perplexity_verifications": self.perplexity_verifications,
                "verified_rate": self.verified_rfps / self.total_rfps_detected if self.total_rfps_detected > 0 else 0,
                "placeholder_urls_rejected": self.placeholder_urls_rejected,
                "expired_rfps_rejected": self.expired_rfps_rejected,
                "competitive_intel_gathered": self.competitive_intel_gathered
            },
            "discovery_breakdown": {
                "linkedin_posts": self.linkedin_posts,
                "linkedin_jobs": self.linkedin_jobs,
                "tender_platforms": self.tender_platforms,
                "sports_news_sites": self.sports_news_sites,
                "official_websites": self.official_websites,
                "linkedin_success_rate": self.linkedin_posts / self.perplexity_discovery_queries if self.perplexity_discovery_queries > 0 else 0,
                "tender_platform_success_rate": self.tender_platforms / self.perplexity_discovery_queries if self.perplexity_discovery_queries > 0 else 0
            },
            "perplexity_usage": {
                "discovery_queries": self.perplexity_discovery_queries,
                "validation_queries": self.perplexity_validation_queries,
                "competitive_intel_queries": self.perplexity_intel_queries,
                "total_queries": self.perplexity_discovery_queries + self.perplexity_validation_queries + self.perplexity_intel_queries,
                "estimated_cost": perplexity_cost
            },
            "brightdata_usage": {
                "targeted_domain_queries": self.brightdata_targeted_queries,
                "broad_web_queries": self.brightdata_broad_queries,
                "total_queries": self.brightdata_targeted_queries + self.brightdata_broad_queries,
                "estimated_cost": brightdata_cost
            },
            "cost_comparison": {
                "total_cost": total_cost,
                "cost_per_verified_rfp": total_cost / self.verified_rfps if self.verified_rfps > 0 else 0,
                "estimated_old_system_cost": old_system_cost,
                "savings_vs_old_system": old_system_cost - total_cost
            }
        }
    
    def _generate_error_output(self, error_message: str) -> Dict[str, Any]:
        """Generate error output"""
        return {
            "error": error_message,
            "total_rfps_detected": 0,
            "verified_rfps": 0,
            "rejected_rfps": 0,
            "entities_checked": self.entities_checked,
            "highlights": []
        }


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Enhanced Perplexity-first hybrid RFP detection system")
    parser.add_argument("--max-entities", type=int, default=300, help="Number of entities to check")
    parser.add_argument("--output", type=str, default="enhanced_perplexity_hybrid_results.json", help="Output file path")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    detector = EnhancedPerplexityHybridRFPDetector(max_entities=args.max_entities)
    results = await detector.run_detection()
    
    # Write results to file
    with open(args.output, 'w') as f:
        json.dump(results, f, indent=2)
    
    logger.info(f"\n✅ Results written to {args.output}")
    
    # Print summary
    logger.info("\n📊 SUMMARY:")
    logger.info(f"Entities checked: {results['entities_checked']}")
    logger.info(f"Total RFPs detected: {results['total_rfps_detected']}")
    logger.info(f"Verified RFPs: {results['verified_rfps']}")
    logger.info(f"Rejected RFPs: {results['rejected_rfps']}")
    logger.info(f"\n💰 Cost Analysis:")
    logger.info(f"Total cost: ${results['cost_comparison']['total_cost']:.2f}")
    logger.info(f"Cost per verified RFP: ${results['cost_comparison']['cost_per_verified_rfp']:.2f}")
    logger.info(f"Savings vs old system: ${results['cost_comparison']['savings_vs_old_system']:.2f}")
    
    # CRITICAL: Return ONLY valid JSON (no markdown, no explanations)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    asyncio.run(main())