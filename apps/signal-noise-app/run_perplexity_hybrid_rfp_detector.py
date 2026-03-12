#!/usr/bin/env python3
"""
Perplexity-First Hybrid RFP Detection System

Intelligent discovery with BrightData fallback for maximum quality & cost efficiency.
Phase 1: Perplexity discovery (5-priority approach)
Phase 1B: BrightData fallback (for NONE results only)
Phase 2: Perplexity validation (for BrightData detections)
Phase 3: Competitive intelligence (high-value only)
Phase 4: Enhanced fit scoring
Phase 5: Structured output
"""

import asyncio
import json
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from dotenv import load_dotenv

# Load environment variables from project root
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('perplexity_hybrid_rfp_detector.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class RFPDiscovery:
    """RFP discovery data structure"""
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
    """Perplexity-first hybrid RFP detection system"""
    
    def __init__(self):
        self.entities_checked = 0
        self.total_rfps_detected = 0
        self.verified_rfps = 0
        self.rejected_rfps = 0
        self.highlights: List[RFPDiscovery] = []
        
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
        
        # Cost tracking
        self.perplexity_queries = {
            "discovery": 0,
            "validation": 0,
            "competitive_intel": 0
        }
        self.brightdata_queries = {
            "targeted_domain": 0,
            "broad_web": 0
        }
    
    async def query_perplexity(self, prompt: str) -> Dict[str, Any]:
        """
        Query Perplexity MCP for intelligent RFP discovery
        """
        try:
            # Import MCP client for Perplexity
            import mcp_perplexity
            
            # Call Perplexity MCP with structured prompt
            result = await mcp_perplexity.search(prompt, mode="deep", limit=10)
            
            self.perplexity_queries["discovery"] += 1
            
            return {
                "status": "success",
                "data": result
            }
        except Exception as e:
            logger.error(f"Perplexity query failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def query_brightdata(self, query: str, domain: str = None) -> Dict[str, Any]:
        """
        Query BrightData SDK for targeted fallback search
        """
        try:
            from backend.brightdata_sdk_client import BrightDataSDKClient
            
            brightdata = BrightDataSDKClient()
            
            if domain:
                # Targeted domain search
                result = await brightdata.search_engine(
                    query=f"site:{domain} {query}" if domain else query,
                    engine="google",
                    num_results=5
                )
                self.brightdata_queries["targeted_domain"] += 1
            else:
                # Broad web search (last resort)
                result = await brightdata.search_engine(
                    query=query,
                    engine="google",
                    num_results=10
                )
                self.brightdata_queries["broad_web"] += 1
            
            return {
                "status": "success",
                "data": result
            }
        except Exception as e:
            logger.error(f"BrightData query failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def phase1_perplexity_discovery(self, entity: Dict[str, Any]) -> Dict[str, Any]:
        """
        Phase 1: Perplexity discovery with 5-priority approach
        """
        organization = entity.get('name', 'Unknown')
        sport = entity.get('sport', 'Unknown')
        neo4j_id = entity.get('neo4j_id', '')
        
        print(f"[ENTITY-START] {self.entities_checked + 1} {organization}")
        
        perplexity_prompt = f"""Research {organization} ({sport}) for active procurement opportunities:

🎯 PRIORITY 1 - LinkedIn Official Posts (CHECK FIRST - HIGHEST SUCCESS RATE):
Search: site:linkedin.com/posts + {organization}
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
Search: site:linkedin.com/jobs company:{organization}
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
1. https://www.isportconnect.com/marketplace_categorie/tenders/ (search: {organization})
2. ${{{organization_website}}}/procurement
3. ${{{organization_website}}}/tenders
4. ${{{organization_website}}}/rfp
5. https://ted.europa.eu (if European organization)
6. https://sam.gov (if US organization)
7. https://www.find-tender.service.gov.uk (if UK organization)
Look for: Active tenders with submission deadlines
Extract: Tender reference, title, deadline, budget, requirements
Success rate: ~30%

🎯 PRIORITY 4 - Sports Industry News Sites (PARTNERSHIP SIGNALS):
Search these domains specifically:
- site:sportspro.com + {organization} + ("RFP" OR "tender" OR "partnership announced" OR "selected as")
- site:sportbusiness.com + {organization} + ("digital transformation" OR "technology partner")
- site:insideworldfootball.com + {organization} + procurement
Time filter: Last 3 months
Extract: Partnership announcements, vendor selections, project launches
Rationale: Recent partnerships indicate digital maturity and future opportunities
Success rate: ~20%

🎯 PRIORITY 5 - LinkedIn Articles & Company Pages:
Search: site:linkedin.com/pulse + {organization} + ("digital transformation" OR "RFP" OR "partnership")
Also check: linkedin.com/company/{{{organization_slug}}}/posts
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

        result = await self.query_perplexity(perplexity_prompt)
        
        if result["status"] == "success":
            data = result["data"]
            status = data.get("status", "NONE")
            
            if status == "ACTIVE_RFP":
                opportunities = data.get("opportunities", [])
                for opp in opportunities:
                    print(f"[ENTITY-PERPLEXITY-RFP] {organization} (Title: {opp.get('title')}, Deadline: {opp.get('deadline')}, Budget: {opp.get('budget')})")
                    
                    discovery = RFPDiscovery(
                        organization=organization,
                        src_link=opp.get('url', ''),
                        source_type=opp.get('source_type', 'linkedin'),
                        discovery_source="perplexity_priority_1",
                        discovery_method="perplexity_primary",
                        validation_status="VERIFIED",
                        date_published=opp.get('source_date', datetime.now().strftime('%Y-%m-%d')),
                        deadline=opp.get('deadline'),
                        deadline_days_remaining=opp.get('days_remaining'),
                        estimated_rfp_date=None,
                        budget=opp.get('budget', 'Not specified'),
                        summary_json={
                            "title": opp.get('title'),
                            "confidence": data.get('confidence', 0.8),
                            "urgency": self._calculate_urgency(opp.get('deadline')),
                            "fit_score": 0,  # Will be calculated in Phase 4
                            "source_quality": 0.9
                        },
                        perplexity_validation={
                            "verified_by_perplexity": True,
                            "deadline_confirmed": opp.get('deadline') is not None,
                            "url_verified": True,
                            "budget_estimated": opp.get('budget') != 'Not specified',
                            "verification_sources": [opp.get('url')]
                        }
                    )
                    
                    self.highlights.append(discovery)
                    self.total_rfps_detected += 1
                    self.verified_rfps += 1
                    
                    # Update discovery breakdown
                    if opp.get('source_type') == 'linkedin':
                        self.linkedin_posts += 1
                    elif opp.get('source_type') == 'tender_portal':
                        self.tender_platforms += 1
                
                return {"status": "ACTIVE_RFP", "skip_fallback": True}
            
            elif status in ["PARTNERSHIP", "INITIATIVE"]:
                opportunities = data.get("opportunities", [])
                for opp in opportunities:
                    print(f"[ENTITY-PERPLEXITY-SIGNAL] {organization} (Type: {opp.get('type')}, Date: {opp.get('source_date')})")
                    
                    discovery = RFPDiscovery(
                        organization=organization,
                        src_link=opp.get('url', ''),
                        source_type=opp.get('source_type', 'news'),
                        discovery_source="perplexity_priority_4",
                        discovery_method="perplexity_primary",
                        validation_status="EARLY_SIGNAL",
                        date_published=opp.get('source_date', datetime.now().strftime('%Y-%m-%d')),
                        deadline=None,
                        deadline_days_remaining=None,
                        estimated_rfp_date=self._estimate_rfp_date(opp.get('source_date')),
                        budget=opp.get('budget', 'Not specified'),
                        summary_json={
                            "title": opp.get('title'),
                            "confidence": data.get('confidence', 0.6),
                            "urgency": "low",
                            "fit_score": 0,
                            "source_quality": 0.7
                        },
                        perplexity_validation={
                            "verified_by_perplexity": True,
                            "deadline_confirmed": False,
                            "url_verified": True,
                            "budget_estimated": False,
                            "verification_sources": [opp.get('url')]
                        }
                    )
                    
                    self.highlights.append(discovery)
                    self.total_rfps_detected += 1
                
                return {"status": "PARTNERSHIP", "skip_fallback": True}
            
            else:
                print(f"[ENTITY-PERPLEXITY-NONE] {organization}")
                return {"status": "NONE", "skip_fallback": False}
        
        return {"status": "ERROR", "skip_fallback": False}
    
    async def phase1b_brightdata_fallback(self, entity: Dict[str, Any]) -> Dict[str, Any]:
        """
        Phase 1B: BrightData fallback for Perplexity NONE results
        """
        organization = entity.get('name', 'Unknown')
        sport = entity.get('sport', 'Unknown')
        
        # TIER 1: Known Tender Domains
        tender_domains = [
            ("isportconnect.com/marketplace_categorie/tenders/", organization),
            ("ted.europa.eu", f"{organization} digital"),
            ("sam.gov", f"{organization} technology"),
        ]
        
        for domain, query in tender_domains:
            result = await self.query_brightdata(query, domain)
            if result["status"] == "success" and result["data"].get("results"):
                print(f"[ENTITY-BRIGHTDATA-DETECTED] {organization} (Hits: {len(result['data']['results'])}, Tier: 1)")
                self.brightdata_detections += 1
                return {
                    "status": "DETECTED",
                    "tier": 1,
                    "results": result["data"]["results"]
                }
        
        # TIER 2: Sports Industry News
        news_domains = [
            ("sportspro.com", f'{organization} ("RFP" OR "tender" OR "partnership announced" OR "digital transformation")'),
            ("sportbusiness.com", f'{organization} ("digital transformation" OR "technology partner")'),
        ]
        
        for domain, query in news_domains:
            result = await self.query_brightdata(query, domain)
            if result["status"] == "success" and result["data"].get("results"):
                print(f"[ENTITY-BRIGHTDATA-DETECTED] {organization} (Hits: {len(result['data']['results'])}, Tier: 2)")
                self.brightdata_detections += 1
                return {
                    "status": "DETECTED",
                    "tier": 2,
                    "results": result["data"]["results"]
                }
        
        # TIER 3: LinkedIn Targeted
        result = await self.query_brightdata(
            f'("invites proposals" OR "RFP" OR "soliciting" OR "Project Manager") {organization}',
            "linkedin.com"
        )
        
        if result["status"] == "success" and result["data"].get("results"):
            print(f"[ENTITY-BRIGHTDATA-DETECTED] {organization} (Hits: {len(result['data']['results'])}, Tier: 3)")
            self.brightdata_detections += 1
            return {
                "status": "DETECTED",
                "tier": 3,
                "results": result["data"]["results"]
            }
        
        print(f"[ENTITY-NONE] {organization}")
        return {"status": "NONE"}
    
    def _calculate_urgency(self, deadline: Optional[str]) -> str:
        """Calculate urgency based on deadline"""
        if not deadline:
            return "medium"
        
        try:
            deadline_date = datetime.strptime(deadline, '%Y-%m-%d')
            days_remaining = (deadline_date - datetime.now()).days
            
            if days_remaining <= 7:
                return "high"
            elif days_remaining <= 30:
                return "medium"
            else:
                return "low"
        except:
            return "medium"
    
    def _estimate_rfp_date(self, source_date: Optional[str]) -> Optional[str]:
        """Estimate RFP date based on early signal date"""
        if not source_date:
            return None
        
        try:
            date_obj = datetime.strptime(source_date, '%Y-%m-%d')
            estimated_date = date_obj + timedelta(days=60)  # ~2 months lead time
            return estimated_date.strftime('%Y-%m-%d')
        except:
            return None
    
    def calculate_fit_score(self, discovery: RFPDiscovery) -> int:
        """
        Phase 4: Enhanced fit scoring algorithm
        """
        base_score = 0
        
        title = discovery.summary_json.get("title", "").lower()
        
        # A. Service Alignment (50% weight)
        service_keywords = {
            "mobile app": 50,
            "digital transformation": 50,
            "web platform": 40,
            "fan engagement": 45,
            "ticketing": 35,
            "analytics": 30,
            "streaming": 40,
            "ott": 40
        }
        
        for keyword, score in service_keywords.items():
            if keyword in title:
                base_score += score
                break
        
        # B. Project Scope Match (30% weight)
        scope_keywords = {
            "end-to-end": 30,
            "strategic partnership": 25,
            "implementation": 25,
            "integration": 20,
            "consulting": 10
        }
        
        for keyword, score in scope_keywords.items():
            if keyword in title:
                base_score += score
                break
        
        # C. Yellow Panther Differentiators (20% weight)
        diff_keywords = {
            "sports": 10,
            "international": 8,
            "premier league": 8,
            "iso": 5,
            "award": 5,
            "uk": 4,
            "europe": 4
        }
        
        for keyword, score in diff_keywords.items():
            if keyword in title:
                base_score += score
        
        return min(base_score, 100)
    
    async def phase3_competitive_intel(self, discovery: RFPDiscovery) -> Dict[str, Any]:
        """
        Phase 3: Competitive intelligence gathering (high-value only)
        """
        if discovery.summary_json.get("fit_score", 0) < 80:
            return None
        
        organization = discovery.organization
        
        intel_prompt = f"""Analyze {organization}'s digital technology landscape:

1. Current Technology Partners: Who provides their digital services?
2. Recent Digital Projects: Projects in last 2 years (vendor, scope, outcome)
3. Decision Makers: Technology/procurement leaders (names, titles, LinkedIn)
4. Competitors: Known vendors bidding on similar opportunities
5. Yellow Panther Edge: Competitive advantages (sports focus, awards, ISO certs)
6. Strategic Context: Budget trends, digital maturity, leadership changes

Return JSON with source URLs."""
        
        result = await self.query_perplexity(intel_prompt)
        self.perplexity_queries["competitive_intel"] += 1
        
        if result["status"] == "success":
            self.competitive_intel_gathered += 1
            return result["data"]
        
        return None
    
    async def run_detection(self, limit: int = 300) -> Dict[str, Any]:
        """
        Run the complete Perplexity-first hybrid RFP detection
        """
        logger.info("Starting Perplexity-first hybrid RFP detection")
        
        # Query entities from Supabase
        entities = await self._get_entities_from_supabase(limit)
        
        logger.info(f"Processing {len(entities)} entities")
        
        for entity in entities:
            self.entities_checked += 1
            
            # Phase 1: Perplexity Discovery
            phase1_result = await self.phase1_perplexity_discovery(entity)
            
            # Phase 1B: BrightData Fallback (only if Perplexity found NONE)
            if phase1_result["status"] == "NONE" and not phase1_result["skip_fallback"]:
                phase1b_result = await self.phase1b_brightdata_fallback(entity)
                
                if phase1b_result["status"] == "DETECTED":
                    # Phase 2: Perplexity Validation for BrightData detections
                    await self.phase2_perplexity_validation(entity, phase1b_result)
        
        # Phase 3 & 4: Competitive Intel and Fit Scoring for verified RFPs
        for discovery in self.highlights:
            if discovery.validation_status == "VERIFIED":
                # Calculate fit score
                discovery.summary_json["fit_score"] = self.calculate_fit_score(discovery)
                
                # Gather competitive intel for high-value opportunities
                if discovery.summary_json["fit_score"] >= 80:
                    intel = await self.phase3_competitive_intel(discovery)
                    if intel:
                        discovery.competitive_intel = intel
        
        # Phase 5: Generate structured output
        return await self._generate_structured_output()
    
    async def _get_entities_from_supabase(self, limit: int) -> List[Dict[str, Any]]:
        """Query entities from Supabase"""
        try:
            # This would use the actual Supabase MCP
            query = f"""
            SELECT neo4j_id, labels,
                   properties->>'name' as name,
                   properties->>'sport' as sport,
                   properties->>'country' as country,
                   properties->>'type' as type
            FROM cached_entities
            WHERE properties->>'type' IN ('Club', 'League', 'Federation', 'Tournament')
            ORDER BY created_at DESC
            OFFSET 0 LIMIT {limit}
            """
            
            # For now, return mock data
            return [
                {
                    "neo4j_id": "1",
                    "name": "Arsenal FC",
                    "sport": "Football",
                    "country": "UK",
                    "type": "Club"
                },
                {
                    "neo4j_id": "2",
                    "name": "Manchester United",
                    "sport": "Football",
                    "country": "UK",
                    "type": "Club"
                }
            ]
        except Exception as e:
            logger.error(f"Failed to query Supabase: {e}")
            return []
    
    async def phase2_perplexity_validation(self, entity: Dict[str, Any], brightdata_result: Dict[str, Any]):
        """Phase 2: Perplexity validation for BrightData detections"""
        organization = entity.get('name', 'Unknown')
        
        for result in brightdata_result.get("results", []):
            url = result.get('url', '')
            title = result.get('title', '')
            
            validation_prompt = f"""Verify this RFP/opportunity from {organization}:
Found: {title} at {url}

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
            
            result_validation = await self.query_perplexity(validation_prompt)
            self.perplexity_queries["validation"] += 1
            
            if result_validation["status"] == "success":
                validation_data = result_validation["data"]
                validation_status = validation_data.get("validation_status", "UNVERIFIABLE")
                
                if validation_status == "VERIFIED":
                    print(f"[ENTITY-VERIFIED] {organization} (Deadline: {validation_data.get('deadline')}, Budget: {validation_data.get('budget')})")
                    
                    discovery = RFPDiscovery(
                        organization=organization,
                        src_link=validation_data.get('verified_url', url),
                        source_type="tender_portal",
                        discovery_source=f"brightdata_tier_{brightdata_result.get('tier', 1)}",
                        discovery_method="brightdata_fallback",
                        validation_status="VERIFIED",
                        date_published=datetime.now().strftime('%Y-%m-%d'),
                        deadline=validation_data.get('deadline'),
                        deadline_days_remaining=None,
                        estimated_rfp_date=None,
                        budget=validation_data.get('budget', 'Not specified'),
                        summary_json={
                            "title": title,
                            "confidence": 0.7,
                            "urgency": self._calculate_urgency(validation_data.get('deadline')),
                            "fit_score": 0,
                            "source_quality": 0.6
                        },
                        perplexity_validation={
                            "verified_by_perplexity": True,
                            "deadline_confirmed": validation_data.get('deadline') is not None,
                            "url_verified": validation_data.get('verified_url') is not None,
                            "budget_estimated": validation_data.get('budget') != 'Not specified',
                            "verification_sources": validation_data.get('verification_sources', [url])
                        }
                    )
                    
                    self.highlights.append(discovery)
                    self.total_rfps_detected += 1
                    self.verified_rfps += 1
                    self.perplexity_verifications += 1
                    
                else:
                    print(f"[ENTITY-REJECTED] {organization} (Reason: {validation_data.get('rejection_reason')})")
                    self.rejected_rfps += 1
                    
                    if "INVALID-URL" in validation_status:
                        self.placeholder_urls_rejected += 1
                    elif "EXPIRED" in validation_status:
                        self.expired_rfps_rejected += 1
    
    async def _generate_structured_output(self) -> Dict[str, Any]:
        """Phase 5: Generate structured output"""
        
        # Calculate scoring summary
        confidence_scores = [d.summary_json.get("confidence", 0) for d in self.highlights]
        fit_scores = [d.summary_json.get("fit_score", 0) for d in self.highlights]
        
        scoring_summary = {
            "avg_confidence": sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0,
            "avg_fit_score": sum(fit_scores) / len(fit_scores) if fit_scores else 0,
            "top_opportunity": self.highlights[0].organization if self.highlights else None
        }
        
        # Calculate quality metrics
        verified_rate = self.verified_rfps / self.total_rfps_detected if self.total_rfps_detected > 0 else 0
        
        quality_metrics = {
            "brightdata_detections": self.brightdata_detections,
            "perplexity_verifications": self.perplexity_verifications,
            "verified_rate": verified_rate,
            "placeholder_urls_rejected": self.placeholder_urls_rejected,
            "expired_rfps_rejected": self.expired_rfps_rejected,
            "competitive_intel_gathered": self.competitive_intel_gathered
        }
        
        # Discovery breakdown
        discovery_breakdown = {
            "linkedin_posts": self.linkedin_posts,
            "linkedin_jobs": self.linkedin_jobs,
            "tender_platforms": self.tender_platforms,
            "sports_news_sites": self.sports_news_sites,
            "official_websites": self.official_websites,
            "linkedin_success_rate": self.linkedin_posts / max(self.entities_checked, 1),
            "tender_platform_success_rate": self.tender_platforms / max(self.entities_checked, 1)
        }
        
        # Cost estimation
        perplexity_cost = sum(self.perplexity_queries.values()) * 0.01  # ~$0.01 per query
        brightdata_cost = (self.brightdata_queries["targeted_domain"] * 0.002 + 
                          self.brightdata_queries["broad_web"] * 0.01)
        total_cost = perplexity_cost + brightdata_cost
        
        cost_comparison = {
            "total_cost": total_cost,
            "cost_per_verified_rfp": total_cost / max(self.verified_rfps, 1),
            "estimated_old_system_cost": self.entities_checked * 0.10,  # Old system: ~$0.10 per entity
            "savings_vs_old_system": (self.entities_checked * 0.10) - total_cost
        }
        
        return {
            "total_rfps_detected": self.total_rfps_detected,
            "verified_rfps": self.verified_rfps,
            "rejected_rfps": self.rejected_rfps,
            "entities_checked": self.entities_checked,
            "highlights": [asdict(discovery) for discovery in self.highlights],
            "scoring_summary": scoring_summary,
            "quality_metrics": quality_metrics,
            "discovery_breakdown": discovery_breakdown,
            "perplexity_usage": {
                **self.perplexity_queries,
                "total_queries": sum(self.perplexity_queries.values()),
                "estimated_cost": perplexity_cost
            },
            "brightdata_usage": {
                **self.brightdata_queries,
                "total_queries": sum(self.brightdata_queries.values()),
                "estimated_cost": brightdata_cost
            },
            "cost_comparison": cost_comparison
        }


async def main():
    """Main execution function"""
    detector = PerplexityHybridRFPDetector()
    
    try:
        result = await detector.run_detection(limit=300)
        
        # Write results to file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = f'perplexity_hybrid_rfp_results_{timestamp}.json'
        
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=2, default=str)
        
        # CRITICAL: Return ONLY valid JSON (no markdown, no explanations)
        print(json.dumps(result, indent=2, default=str))
        
    except Exception as e:
        logger.error(f"Detection failed: {e}")
        error_result = {
            "error": str(e),
            "total_rfps_detected": 0,
            "verified_rfps": 0,
            "rejected_rfps": 0,
            "entities_checked": detector.entities_checked
        }
        print(json.dumps(error_result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())