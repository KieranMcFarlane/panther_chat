#!/usr/bin/env python3
"""
🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM

Intelligent discovery with BrightData fallback for maximum quality & cost efficiency.

This system implements a 5-phase approach:
1. Perplexity intelligent discovery (LinkedIn-first)
2. BrightData targeted fallback (for Perplexity NONE results only)
3. Perplexity validation (for BrightData detections)
4. Competitive intelligence (high-value opportunities only)
5. Enhanced fit scoring and structured output

Author: RFP Detection System
Version: 1.0
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Load environment variables from project root
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('rfp_detection.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class RFPData:
    """Structured RFP opportunity data"""
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
    """Main RFP detection system using Perplexity-first approach"""
    
    def __init__(self):
        """Initialize the detector with required clients"""
        self.perplexity_available = self._check_perplexity_available()
        self.brightdata_available = self._check_brightdata_available()
        
        # Cost tracking
        self.perplexity_queries = {
            'discovery': 0,
            'validation': 0,
            'competitive_intel': 0
        }
        self.brightdata_queries = {
            'targeted_domain': 0,
            'broad_web': 0
        }
        
        # Quality metrics
        self.metrics = {
            'total_entities_checked': 0,
            'perplexity_detections': 0,
            'brightdata_detections': 0,
            'verified_rfps': 0,
            'rejected_rfps': 0,
            'placeholder_urls_rejected': 0,
            'expired_rfps_rejected': 0,
            'competitive_intel_gathered': 0
        }
        
        # Discovery breakdown
        self.discovery_breakdown = {
            'linkedin_posts': 0,
            'linkedin_jobs': 0,
            'tender_platforms': 0,
            'sports_news_sites': 0,
            'official_websites': 0
        }
        
        logger.info("🎯 Perplexity-First Hybrid RFP Detector initialized")
        logger.info(f"Perplexity available: {self.perplexity_available}")
        logger.info(f"BrightData available: {self.brightdata_available}")
    
    def _check_perplexity_available(self) -> bool:
        """Check if Perplexity MCP is available"""
        try:
            # Check for environment variable
            if not os.getenv('PERPLEXITY_API_KEY'):
                logger.warning("⚠️ PERPLEXITY_API_KEY not found")
                return False
            return True
        except Exception as e:
            logger.error(f"Error checking Perplexity availability: {e}")
            return False
    
    def _check_brightdata_available(self) -> bool:
        """Check if BrightData SDK is available"""
        try:
            from backend.brightdata_sdk_client import BrightDataSDKClient
            
            if not os.getenv('BRIGHTDATA_API_TOKEN'):
                logger.warning("⚠️ BRIGHTDATA_API_TOKEN not found")
                return False
            
            # Try to instantiate client
            client = BrightDataSDKClient()
            return True
        except Exception as e:
            logger.error(f"Error checking BrightData availability: {e}")
            return False
    
    async def _query_perplexity(self, prompt: str, mode: str = "discovery") -> Dict[str, Any]:
        """Query Perplexity MCP with structured prompt"""
        if not self.perplexity_available:
            logger.warning("Perplexity not available, returning empty result")
            return {"status": "NONE", "confidence": 1.0, "opportunities": [], "sources_checked": []}
        
        try:
            self.perplexity_queries[mode] += 1
            
            # Use Perplexity MCP via the available interface
            # This would be adapted to the actual MCP interface
            logger.info(f"Querying Perplexity ({mode})...")
            
            # Simulated response for now - would be actual MCP call
            response = {
                "status": "NONE",
                "confidence": 1.0,
                "opportunities": [],
                "sources_checked": []
            }
            
            return response
            
        except Exception as e:
            logger.error(f"Error querying Perplexity: {e}")
            return {"status": "ERROR", "error": str(e)}
    
    async def _query_brightdata_targeted(self, organization: str, organization_website: str, 
                                        tier: int) -> Dict[str, Any]:
        """Query BrightData with targeted tier-based approach"""
        if not self.brightdata_available:
            logger.warning("BrightData not available")
            return {"results": [], "tier": tier, "status": "unavailable"}
        
        try:
            from backend.brightdata_sdk_client import BrightDataSDKClient
            
            client = BrightDataSDKClient()
            results = []
            
            if tier == 1:
                # Known tender domains
                tender_urls = [
                    f"https://www.isportconnect.com/marketplace_categorie/tenders/{organization}",
                    f"{organization_website}/procurement" if organization_website else None,
                    f"{organization_website}/tenders" if organization_website else None,
                    f"{organization_website}/rfp" if organization_website else None
                ]
                
                for url in filter(None, tender_urls):
                    try:
                        content = await client.scrape_as_markdown(url)
                        if content.get('status') == 'success':
                            results.append({"url": url, "content": content.get('content', '')})
                    except:
                        continue
                
                self.brightdata_queries['targeted_domain'] += len(results)
            
            elif tier == 2:
                # Sports industry news domains
                news_domains = [
                    f"sportspro.com {organization} RFP tender partnership",
                    f"sportbusiness.com {organization} digital transformation",
                    f"insideworldfootball.com {organization} procurement"
                ]
                
                for query in news_domains:
                    try:
                        search_result = await client.search_engine(query, engine='google', num_results=3)
                        if search_result.get('status') == 'success':
                            results.extend(search_result.get('results', []))
                    except:
                        continue
                
                self.brightdata_queries['targeted_domain'] += len(news_domains)
            
            elif tier == 3:
                # LinkedIn targeted search
                linkedin_queries = [
                    f"site:linkedin.com/posts {organization} invites proposals RFP",
                    f"site:linkedin.com/jobs company:{organization} Project Manager Digital",
                    f"site:linkedin.com/company {organization} posts digital transformation"
                ]
                
                for query in linkedin_queries:
                    try:
                        search_result = await client.search_engine(query, engine='google', num_results=3)
                        if search_result.get('status') == 'success':
                            results.extend(search_result.get('results', []))
                    except:
                        continue
                
                self.brightdata_queries['targeted_domain'] += len(linkedin_queries)
            
            elif tier == 4:
                # Last resort - broad web search
                query = f"{organization} RFP digital transformation mobile app technology"
                try:
                    search_result = await client.search_engine(query, engine='google', num_results=5)
                    if search_result.get('status') == 'success':
                        results = search_result.get('results', [])
                except:
                    pass
                
                self.brightdata_queries['broad_web'] += 1
            
            return {"results": results, "tier": tier, "status": "success"}
            
        except Exception as e:
            logger.error(f"Error querying BrightData (tier {tier}): {e}")
            return {"results": [], "tier": tier, "status": "error", "error": str(e)}
    
    async def _validate_with_perplexity(self, organization: str, project_title: str, 
                                       url: str) -> Dict[str, Any]:
        """Validate BrightData detection with Perplexity"""
        validation_prompt = f"""
Verify this RFP/opportunity from {organization}:
Found: {project_title} at {url}

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
}}
"""
        
        return await self._query_perplexity(validation_prompt, mode="validation")
    
    async def _gather_competitive_intel(self, organization: str, sport: str) -> Dict[str, Any]:
        """Gather competitive intelligence for high-value opportunities"""
        intel_prompt = f"""
Analyze {organization}'s ({sport}) digital technology landscape:

1. Current Technology Partners: Who provides their digital services?
2. Recent Digital Projects: Projects in last 2 years (vendor, scope, outcome)
3. Decision Makers: Technology/procurement leaders (names, titles, LinkedIn)
4. Competitors: Known vendors bidding on similar opportunities
5. Yellow Panther Edge: Competitive advantages (sports focus, awards, ISO certs)
6. Strategic Context: Budget trends, digital maturity, leadership changes

Return JSON with source URLs.
"""
        
        result = await self._query_perplexity(intel_prompt, mode="competitive_intel")
        self.metrics['competitive_intel_gathered'] += 1
        return result
    
    def _calculate_fit_score(self, opportunity_data: Dict[str, Any]) -> int:
        """Calculate Yellow Panther fit score using enhanced algorithm"""
        base_score = 0
        
        # A. Service Alignment (50% weight)
        service_alignment = {
            'mobile app development': 50,
            'digital transformation project': 50,
            'web platform development': 40,
            'fan engagement platform': 45,
            'ticketing system integration': 35,
            'analytics/data platform': 30,
            'streaming/ott platform': 40
        }
        
        title_lower = opportunity_data.get('title', '').lower()
        description_lower = opportunity_data.get('description', '').lower()
        
        for service, points in service_alignment.items():
            if service in title_lower or service in description_lower:
                base_score += points
                break
        
        # B. Project Scope Match (30% weight)
        scope_keywords = {
            'end-to-end development': 30,
            'strategic partnership': 25,
            'implementation + ongoing support': 25,
            'integration with existing systems': 20,
            'consulting only': 10
        }
        
        for scope, points in scope_keywords.items():
            if scope in description_lower:
                base_score += points
                break
        
        # C. Yellow Panther Differentiators (20% weight)
        differentiator_points = 0
        
        if 'sports industry' in description_lower or 'sports' in opportunity_data.get('organization', '').lower():
            differentiator_points += 10
        
        if 'international federation' in description_lower or 'federation' in opportunity_data.get('organization', '').lower():
            differentiator_points += 8
        
        if 'premier league' in description_lower or 'top-tier' in description_lower:
            differentiator_points += 8
        
        if 'iso certification' in description_lower or 'iso' in description_lower:
            differentiator_points += 5
        
        if 'award-winning' in description_lower:
            differentiator_points += 5
        
        if 'uk' in opportunity_data.get('country', '').lower() or 'europe' in opportunity_data.get('country', '').lower():
            differentiator_points += 4
        
        base_score += differentiator_points
        
        return min(base_score, 100)
    
    async def process_entity(self, entity: Dict[str, Any]) -> Optional[RFPData]:
        """Process a single entity through the 5-phase system"""
        entity_id = entity.get('neo4j_id', 'unknown')
        organization = entity.get('name', 'Unknown Organization')
        sport = entity.get('sport', 'Unknown Sport')
        country = entity.get('country', 'Unknown')
        entity_type = entity.get('type', 'Unknown')
        
        print(f"[ENTITY-START] {self.metrics['total_entities_checked'] + 1} {organization}")
        self.metrics['total_entities_checked'] += 1
        
        # Phase 1: Perplexity Discovery
        print(f"[PERPLEXITY-DISCOVERY] {organization}")
        perplexity_result = await self._query_perplexity_discovery(organization, sport, entity_type)
        
        if perplexity_result['status'] in ['ACTIVE_RFP', 'PARTNERSHIP', 'INITIATIVE']:
            return self._process_perplexity_detection(organization, perplexity_result, entity)
        
        # Phase 1B: BrightData Fallback
        print(f"[BRIGHTDATA-FALLBACK] {organization}")
        brightdata_result = await self._query_brightdata_fallback(organization, sport, entity)
        
        if not brightdata_result['results']:
            print(f"[ENTITY-NONE] {organization}")
            return None
        
        # Phase 2: Perplexity Validation
        print(f"[PERPLEXITY-VALIDATION] {organization}")
        validated_result = await self._validate_brightdata_detection(organization, brightdata_result)
        
        if validated_result['validation_status'] != 'VERIFIED':
            print(f"[ENTITY-REJECTED] {organization} (Reason: {validated_result.get('rejection_reason', 'Unknown')})")
            self.metrics['rejected_rfps'] += 1
            return None
        
        # Phase 3: Competitive Intelligence (for high-value only)
        fit_score = self._calculate_fit_score(validated_result)
        
        competitive_intel = None
        if fit_score >= 80:
            print(f"[COMPETITIVE-INTEL] {organization} (Fit Score: {fit_score})")
            competitive_intel = await self._gather_competitive_intel(organization, sport)
        
        # Phase 4: Fit Scoring (already calculated)
        print(f"[FIT-SCORE] {organization}: {fit_score}")
        
        # Phase 5: Structure RFP data
        rfp_data = self._structure_rfp_data(
            organization, validated_result, fit_score, competitive_intel, 
            entity, 'brightdata_fallback'
        )
        
        self.metrics['verified_rfps'] += 1
        print(f"[ENTITY-VERIFIED] {organization}")
        
        return rfp_data
    
    async def _query_perplexity_discovery(self, organization: str, sport: str, entity_type: str) -> Dict[str, Any]:
        """Query Perplexity for intelligent discovery"""
        discovery_prompt = f"""
Research {organization} ({sport}) for active procurement opportunities:

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
2. {{organization_website}}/procurement
3. {{organization_website}}/tenders
4. {{organization_website}}/rfp
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
Also check: linkedin.com/company/{{organization_slug}}/posts
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

If NO opportunities found, return: {{"status": "NONE", "confidence": 1.0, "opportunities": [], "sources_checked": []}}
"""
        
        return await self._query_perplexity(discovery_prompt, mode="discovery")
    
    async def _query_brightdata_fallback(self, organization: str, sport: str, entity: Dict[str, Any]) -> Dict[str, Any]:
        """Query BrightData fallback with tiered approach"""
        organization_website = entity.get('website', '')
        country = entity.get('country', '')
        
        # Try Tier 1 first (known tender domains)
        result = await self._query_brightdata_targeted(organization, organization_website, tier=1)
        if result.get('results'):
            self.metrics['brightdata_detections'] += 1
            self.discovery_breakdown['tender_platforms'] += len(result['results'])
            return result
        
        # Try Tier 2 (sports industry news)
        result = await self._query_brightdata_targeted(organization, organization_website, tier=2)
        if result.get('results'):
            self.metrics['brightdata_detections'] += 1
            self.discovery_breakdown['sports_news_sites'] += len(result['results'])
            return result
        
        # Try Tier 3 (LinkedIn targeted)
        result = await self._query_brightdata_targeted(organization, organization_website, tier=3)
        if result.get('results'):
            self.metrics['brightdata_detections'] += 1
            self.discovery_breakdown['linkedin_posts'] += len(result['results'])
            return result
        
        # Try Tier 4 (broad web search - last resort)
        result = await self._query_brightdata_targeted(organization, organization_website, tier=4)
        if result.get('results'):
            self.metrics['brightdata_detections'] += 1
        
        return result
    
    async def _validate_brightdata_detection(self, organization: str, brightdata_result: Dict[str, Any]) -> Dict[str, Any]:
        """Validate BrightData detection with Perplexity"""
        results = brightdata_result.get('results', [])
        
        if not results:
            return {"validation_status": "NO_RESULTS"}
        
        # Validate first result
        first_result = results[0]
        url = first_result.get('url', first_result.get('link', ''))
        title = first_result.get('title', 'Unknown Project')
        
        validation_result = await self._validate_with_perplexity(organization, title, url)
        
        if validation_result.get('validation_status') == 'VERIFIED':
            # Enhance result with validation data
            first_result['validated'] = True
            first_result['verified_url'] = validation_result.get('verified_url', url)
            first_result['deadline'] = validation_result.get('deadline')
            first_result['budget'] = validation_result.get('budget', 'Not specified')
            first_result['verification_sources'] = validation_result.get('verification_sources', [])
        
        return {
            **first_result,
            "validation_status": validation_result.get('validation_status', 'UNVERIFIABLE'),
            "rejection_reason": validation_result.get('rejection_reason')
        }
    
    def _process_perplexity_detection(self, organization: str, perplexity_result: Dict[str, Any], 
                                     entity: Dict[str, Any]) -> Optional[RFPData]:
        """Process successful Perplexity detection"""
        opportunities = perplexity_result.get('opportunities', [])
        
        if not opportunities:
            return None
        
        # Process first opportunity
        opportunity = opportunities[0]
        
        # Calculate fit score
        fit_score = self._calculate_fit_score(opportunity)
        
        # Structure RFP data
        rfp_data = self._structure_rfp_data(
            organization, opportunity, fit_score, None, entity, 'perplexity_discovery'
        )
        
        self.metrics['perplexity_detections'] += 1
        self.metrics['verified_rfps'] += 1
        
        detection_type = perplexity_result.get('status', 'UNKNOWN')
        print(f"[ENTITY-PERPLEXITY-{detection_type}] {organization} (Title: {opportunity.get('title')}, Deadline: {opportunity.get('deadline')}, Budget: {opportunity.get('budget')})")
        
        return rfp_data
    
    def _structure_rfp_data(self, organization: str, opportunity: Dict[str, Any], 
                          fit_score: int, competitive_intel: Optional[Dict[str, Any]], 
                          entity: Dict[str, Any], discovery_method: str) -> RFPData:
        """Structure RFP data according to specification"""
        
        # Extract opportunity details
        title = opportunity.get('title', 'Unknown Project')
        url = opportunity.get('url', opportunity.get('verified_url', ''))
        deadline = opportunity.get('deadline')
        budget = opportunity.get('budget', 'Not specified')
        source_type = opportunity.get('source_type', 'unknown')
        source_date = opportunity.get('source_date', datetime.now().strftime('%Y-%m-%d'))
        confidence = opportunity.get('confidence', 0.8)
        
        # Calculate deadline days remaining
        deadline_days_remaining = None
        if deadline:
            try:
                deadline_date = datetime.strptime(deadline, '%Y-%m-%d')
                deadline_days_remaining = (deadline_date - datetime.now()).days
            except:
                pass
        
        # Determine discovery source
        if discovery_method == 'perplexity_discovery':
            discovery_source = f"perplexity_priority_{self._determine_perplexity_priority(source_type)}"
        else:
            discovery_source = f"brightdata_tier_{opportunity.get('tier', 4)}"
        
        # Determine validation status
        validation_status = opportunity.get('validation_status', 'VERIFIED')
        if opportunity.get('validated', False):
            validation_status = 'VERIFIED'
        elif 'EARLY_SIGNAL' in opportunity.values():
            validation_status = 'EARLY_SIGNAL'
        
        # Build summary JSON
        summary_json = {
            "title": title,
            "confidence": confidence,
            "urgency": self._calculate_urgency(deadline_days_remaining),
            "fit_score": fit_score,
            "source_quality": self._calculate_source_quality(source_type)
        }
        
        # Build Perplexity validation
        perplexity_validation = {
            "verified_by_perplexity": discovery_method == 'perplexity_discovery',
            "deadline_confirmed": deadline is not None,
            "url_verified": url and not url.startswith('http://example.com'),
            "budget_estimated": budget != 'Not specified',
            "verification_sources": opportunity.get('verification_sources', [url])
        }
        
        # Build competitive intelligence
        competitive_intel_data = None
        if competitive_intel:
            competitive_intel_data = {
                "digital_maturity": competitive_intel.get('digital_maturity', 'MEDIUM'),
                "current_partners": competitive_intel.get('current_partners', []),
                "recent_projects": competitive_intel.get('recent_projects', []),
                "competitors": competitive_intel.get('competitors', []),
                "yp_advantages": competitive_intel.get('yp_advantages', []),
                "decision_makers": competitive_intel.get('decision_makers', [])
            }
        
        return RFPData(
            organization=organization,
            src_link=url,
            source_type=source_type,
            discovery_source=discovery_source,
            discovery_method=discovery_method,
            validation_status=validation_status,
            date_published=source_date,
            deadline=deadline,
            deadline_days_remaining=deadline_days_remaining,
            estimated_rfp_date=opportunity.get('estimated_rfp_date'),
            budget=budget,
            summary_json=summary_json,
            perplexity_validation=perplexity_validation,
            competitive_intel=competitive_intel_data
        )
    
    def _determine_perplexity_priority(self, source_type: str) -> str:
        """Determine which Perplexity priority level detected the opportunity"""
        if source_type == 'linkedin':
            return '1'
        elif source_type in ['tender_portal', 'official_website']:
            return '3'
        elif source_type == 'news':
            return '4'
        else:
            return '5'
    
    def _calculate_urgency(self, deadline_days_remaining: Optional[int]) -> str:
        """Calculate urgency level based on deadline"""
        if deadline_days_remaining is None:
            return 'medium'
        elif deadline_days_remaining <= 7:
            return 'high'
        elif deadline_days_remaining <= 30:
            return 'medium'
        else:
            return 'low'
    
    def _calculate_source_quality(self, source_type: str) -> float:
        """Calculate source quality score"""
        quality_scores = {
            'tender_portal': 0.95,
            'linkedin': 0.85,
            'official_website': 0.90,
            'news': 0.70,
            'unknown': 0.50
        }
        return quality_scores.get(source_type, 0.50)
    
    async def run_detection(self, entity_limit: int = 300) -> Dict[str, Any]:
        """Run the complete RFP detection system"""
        logger.info(f"Starting RFP detection for {entity_limit} entities")
        
        # Fetch entities from Supabase
        entities = await self._fetch_entities(entity_limit)
        
        if not entities:
            logger.error("No entities found in database")
            return self._generate_empty_output()
        
        logger.info(f"Processing {len(entities)} entities")
        
        # Process each entity
        verified_rfps = []
        
        for entity in entities:
            try:
                rfp_data = await self.process_entity(entity)
                
                if rfp_data:
                    verified_rfps.append(rfp_data)
                    
            except Exception as e:
                logger.error(f"Error processing entity {entity.get('name', 'Unknown')}: {e}")
                continue
        
        # Generate final output
        output = self._generate_final_output(verified_rfps)
        
        # Write to Supabase
        await self._write_to_supabase(verified_rfps)
        
        return output
    
    async def _fetch_entities(self, limit: int) -> List[Dict[str, Any]]:
        """Fetch entities from Supabase"""
        try:
            # This would use the actual MCP interface
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
            
            # Simulated entity data for now
            entities = [
                {
                    'neo4j_id': 'entity1',
                    'name': 'Arsenal FC',
                    'sport': 'Football',
                    'country': 'UK',
                    'type': 'Club',
                    'website': 'https://arsenal.com'
                },
                {
                    'neo4j_id': 'entity2',
                    'name': 'Manchester United',
                    'sport': 'Football',
                    'country': 'UK',
                    'type': 'Club',
                    'website': 'https://manutd.com'
                }
            ]
            
            return entities
            
        except Exception as e:
            logger.error(f"Error fetching entities: {e}")
            return []
    
    async def _write_to_supabase(self, rfp_data_list: List[RFPData]):
        """Write verified RFPs to Supabase"""
        try:
            # This would use the actual MCP interface
            logger.info(f"Writing {len(rfp_data_list)} verified RFPs to Supabase")
            
            # Simulated write operation
            for rfp_data in rfp_data_list:
                logger.info(f"Writing RFP for {rfp_data.organization} to Supabase")
                
        except Exception as e:
            logger.error(f"Error writing to Supabase: {e}")
    
    def _generate_final_output(self, verified_rfps: List[RFPData]) -> Dict[str, Any]:
        """Generate final structured JSON output"""
        
        # Convert RFPData objects to dictionaries
        highlights = []
        total_confidence = 0
        total_fit_score = 0
        
        for rfp in verified_rfps:
            rfp_dict = asdict(rfp)
            highlights.append(rfp_dict)
            total_confidence += rfp.summary_json.get('confidence', 0)
            total_fit_score += rfp.summary_json.get('fit_score', 0)
        
        # Calculate averages
        avg_confidence = total_confidence / len(verified_rfps) if verified_rfps else 0
        avg_fit_score = total_fit_score / len(verified_rfps) if verified_rfps else 0
        
        # Find top opportunity
        top_opportunity = max(verified_rfps, key=lambda x: x.summary_json.get('fit_score', 0), default=None)
        top_opportunity_name = top_opportunity.organization if top_opportunity else "None"
        
        # Calculate costs
        perplexity_cost = self._calculate_perplexity_cost()
        brightdata_cost = self._calculate_brightdata_cost()
        total_cost = perplexity_cost + brightdata_cost
        
        # Estimated old system cost (for comparison)
        old_system_cost = len(verified_rfps) * 10.0  # Assume old system cost $10 per RFP
        
        return {
            "total_rfps_detected": self.metrics['perplexity_detections'] + self.metrics['brightdata_detections'],
            "verified_rfps": self.metrics['verified_rfps'],
            "rejected_rfps": self.metrics['rejected_rfps'],
            "entities_checked": self.metrics['total_entities_checked'],
            "highlights": highlights,
            "scoring_summary": {
                "avg_confidence": round(avg_confidence, 2),
                "avg_fit_score": round(avg_fit_score, 2),
                "top_opportunity": top_opportunity_name
            },
            "quality_metrics": {
                "brightdata_detections": self.metrics['brightdata_detections'],
                "perplexity_verifications": self.perplexity_queries.get('validation', 0),
                "verified_rate": round(self.metrics['verified_rfps'] / max(1, self.metrics['total_entities_checked']), 2),
                "placeholder_urls_rejected": self.metrics['placeholder_urls_rejected'],
                "expired_rfps_rejected": self.metrics['expired_rfps_rejected'],
                "competitive_intel_gathered": self.metrics['competitive_intel_gathered']
            },
            "discovery_breakdown": {
                "linkedin_posts": self.discovery_breakdown['linkedin_posts'],
                "linkedin_jobs": self.discovery_breakdown['linkedin_jobs'],
                "tender_platforms": self.discovery_breakdown['tender_platforms'],
                "sports_news_sites": self.discovery_breakdown['sports_news_sites'],
                "official_websites": self.discovery_breakdown['official_websites'],
                "linkedin_success_rate": round(self.discovery_breakdown['linkedin_posts'] / max(1, self.metrics['total_entities_checked']), 2),
                "tender_platform_success_rate": round(self.discovery_breakdown['tender_platforms'] / max(1, self.metrics['total_entities_checked']), 2)
            },
            "perplexity_usage": {
                "discovery_queries": self.perplexity_queries['discovery'],
                "validation_queries": self.perplexity_queries['validation'],
                "competitive_intel_queries": self.perplexity_queries['competitive_intel'],
                "total_queries": sum(self.perplexity_queries.values()),
                "estimated_cost": perplexity_cost
            },
            "brightdata_usage": {
                "targeted_domain_queries": self.brightdata_queries['targeted_domain'],
                "broad_web_queries": self.brightdata_queries['broad_web'],
                "total_queries": sum(self.brightdata_queries.values()),
                "estimated_cost": brightdata_cost
            },
            "cost_comparison": {
                "total_cost": round(total_cost, 2),
                "cost_per_verified_rfp": round(total_cost / max(1, len(verified_rfps)), 2),
                "estimated_old_system_cost": round(old_system_cost, 2),
                "savings_vs_old_system": round(old_system_cost - total_cost, 2)
            }
        }
    
    def _generate_empty_output(self) -> Dict[str, Any]:
        """Generate output for empty results"""
        return {
            "total_rfps_detected": 0,
            "verified_rfps": 0,
            "rejected_rfps": 0,
            "entities_checked": 0,
            "highlights": [],
            "scoring_summary": {
                "avg_confidence": 0,
                "avg_fit_score": 0,
                "top_opportunity": "None"
            },
            "quality_metrics": {
                "brightdata_detections": 0,
                "perplexity_verifications": 0,
                "verified_rate": 0,
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
                "linkedin_success_rate": 0,
                "tender_platform_success_rate": 0
            },
            "perplexity_usage": {
                "discovery_queries": 0,
                "validation_queries": 0,
                "competitive_intel_queries": 0,
                "total_queries": 0,
                "estimated_cost": 0
            },
            "brightdata_usage": {
                "targeted_domain_queries": 0,
                "broad_web_queries": 0,
                "total_queries": 0,
                "estimated_cost": 0
            },
            "cost_comparison": {
                "total_cost": 0,
                "cost_per_verified_rfp": 0,
                "estimated_old_system_cost": 0,
                "savings_vs_old_system": 0
            }
        }
    
    def _calculate_perplexity_cost(self) -> float:
        """Calculate estimated Perplexity API costs"""
        # Perplexity costs approximately $0.01 per query
        total_queries = sum(self.perplexity_queries.values())
        return total_queries * 0.01
    
    def _calculate_brightdata_cost(self) -> float:
        """Calculate estimated BrightData API costs"""
        # BrightData costs approximately $0.002 per targeted query, $0.01 per broad query
        targeted_cost = self.brightdata_queries['targeted_domain'] * 0.002
        broad_cost = self.brightdata_queries['broad_web'] * 0.01
        return targeted_cost + broad_cost


async def main():
    """Main execution function"""
    try:
        detector = PerplexityHybridRFPDetector()
        result = await detector.run_detection(entity_limit=300)
        
        # CRITICAL: Return ONLY valid JSON (no markdown, no explanations)
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        logger.error(f"Fatal error in main execution: {e}")
        error_output = {
            "error": str(e),
            "total_rfps_detected": 0,
            "verified_rfps": 0,
            "entities_checked": 0
        }
        print(json.dumps(error_output, indent=2))


if __name__ == "__main__":
    asyncio.run(main())