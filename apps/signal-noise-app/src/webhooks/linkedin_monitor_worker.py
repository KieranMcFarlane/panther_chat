"""
LinkedIn Procurement Monitor Worker
Continuous monitoring of LinkedIn for procurement opportunities using BrightData
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging
from dataclasses import dataclass
import os
from enum import Enum

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MonitorStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"

@dataclass
class LinkedInSearchQuery:
    """LinkedIn search query configuration"""
    keywords: List[str]
    location: Optional[str] = None
    company_size: Optional[str] = None
    industry: Optional[str] = None
    post_type: str = "posts"  # posts, articles, people
    time_range: str = "week"  # day, week, month
    
class LinkedInMonitorWorker:
    """Worker to continuously monitor LinkedIn for procurement opportunities"""
    
    def __init__(self, brightdata_config: Dict[str, str]):
        self.brightdata_config = brightdata_config
        self.status = MonitorStatus.ACTIVE
        
        # Key LinkedIn procurement search patterns
        self.search_queries = [
            LinkedInSearchQuery(
                keywords=[
                    "request for proposal", "rfp", "tender", "procurement", 
                    "digital transformation", "technology upgrade"
                ],
                industry="sports",
                time_range="day"
            ),
            LinkedInSearchQuery(
                keywords=[
                    "consultancy services", "professional services", 
                    "implementation partner", "system integrator"
                ],
                industry="sports",
                time_range="week"
            ),
            LinkedInSearchQuery(
                keywords=[
                    "stadium technology", "fan engagement", "ticketing system",
                    "competition management", "data analytics"
                ],
                time_range="day"
            ),
            LinkedInSearchQuery(
                keywords=[
                    "football technology", "soccer software", "rugby analytics",
                    "cricket data", "sports intelligence"
                ],
                time_range="day"
            )
        ]
        
        # BrightData zones for LinkedIn monitoring
        self.brightdata_zones = [
            "linkedin_posts_monitor",
            "linkedin_articles_monitor", 
            "linkedin_companies_monitor"
        ]
        
        self.last_check_times = {}
        self.detected_rfps = []
        
    async def start_monitoring(self):
        """Start continuous LinkedIn monitoring"""
        logger.info("🚀 Starting LinkedIn Procurement Monitor Worker")
        
        while self.status == MonitorStatus.ACTIVE:
            try:
                await self._monitoring_cycle()
                
                # Wait between monitoring cycles
                await asyncio.sleep(300)  # 5 minutes
                
            except Exception as e:
                logger.error(f"Monitoring cycle error: {str(e)}")
                self.status = MonitorStatus.ERROR
                await asyncio.sleep(60)  # Wait 1 minute before retry
                
    async def _monitoring_cycle(self):
        """Single monitoring cycle through all search queries"""
        
        for query in self.search_queries:
            try:
                logger.info(f"🔍 Searching LinkedIn for: {', '.join(query.keywords)}")
                
                # Execute LinkedIn search via BrightData
                results = await self._search_linkedin(query)
                
                if results:
                    # Process results for RFP patterns
                    rfp_signals = await self._analyze_results(results, query)
                    
                    if rfp_signals:
                        await self._process_rfp_signals(rfp_signals, query)
                
                # Rate limiting between queries
                await asyncio.sleep(2)
                
            except Exception as e:
                logger.error(f"Query execution error: {str(e)}")
                continue
                
        logger.info(f"✅ Monitoring cycle completed - {len(self.detected_rfps)} total RFPs detected")
        
    async def _search_linkedin(self, query: LinkedInSearchQuery) -> List[Dict[str, Any]]:
        """Execute LinkedIn search using BrightData"""
        
        brightdata_query = {
            "search_term": " AND ".join(query.keywords),
            "search_type": query.post_type,
            "location": query.location,
            "time_range": query.time_range,
            "limit": 50,
            "include_engagement": True,
            "include_author_info": True
        }
        
        # Add specific filters for sports/procurement
        if query.industry == "sports":
            brightdata_query["industry_filters"] = [
                "Sports", "Entertainment", "Recreation", "Leisure"
            ]
        
        # Execute via BrightData LinkedIn scraping API
        async with aiohttp.ClientSession() as session:
            url = f"{self.brightdata_config['api_url']}/linkedin/search"
            
            headers = {
                "Authorization": f"Bearer {self.brightdata_config['token']}",
                "Content-Type": "application/json"
            }
            
            try:
                async with session.post(url, json=brightdata_query, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("results", [])
                    else:
                        logger.error(f"BrightData API error: {response.status}")
                        return []
                        
            except Exception as e:
                logger.error(f"LinkedIn search error: {str(e)}")
                return []
    
    async def _analyze_results(self, results: List[Dict], query: LinkedInSearchQuery) -> List[Dict[str, Any]]:
        """Analyze LinkedIn results for procurement signals"""
        
        rfp_signals = []
        
        for result in results:
            # Filter by time - only process recent posts
            post_time = datetime.fromisoformat(result.get("published_at", ""))
            if post_time < datetime.now() - timedelta(days=7):
                continue
            
            # Check for procurement indicators
            content = result.get("content", "").lower()
            author_role = result.get("author_role", "").lower()
            author_company = result.get("author_company", "")
            
            # Scoring system for procurement probability
            score = await self._calculate_procurement_score(content, author_role, author_company)
            
            if score >= 0.7:  # High confidence procurement signal
                rfp_signals.append({
                    "post": result,
                    "confidence_score": score,
                    "search_query": query.keywords,
                    "detected_at": datetime.now()
                })
        
        return rfp_signals
    
    async def _calculate_procurement_score(self, content: str, author_role: str, author_company: str) -> float:
        """Calculate probability this is a procurement opportunity"""
        
        score = 0.0
        
        # Procurement keywords (0.4 weight)
        procurement_keywords = [
            "request for proposal", "rfp", "tender", "procurement",
            "vendor selection", "consultant", "professional services",
            "implementation", "digital transformation", "technology upgrade"
        ]
        
        keyword_matches = sum(1 for kw in procurement_keywords if kw in content)
        score += min(0.4, keyword_matches * 0.1)
        
        # Sports/industry keywords (0.3 weight)
        sports_keywords = [
            "football", "soccer", "rugby", "cricket", "stadium", "club",
            "team", "league", "federation", "sports", "arena"
        ]
        
        sports_matches = sum(1 for sk in sports_keywords if sk in content)
        score += min(0.3, sports_matches * 0.15)
        
        # Author credibility (0.2 weight)
        credible_roles = [
            "procurement", "operations", "it", "technology", "director",
            "manager", "chief", "head of"
        ]
        
        if any(role in author_role for role in credible_roles):
            score += 0.2
        
        # Company indicators (0.1 weight)
        if author_company and any(size in author_company.lower() 
                                for size in ["group", "corp", "ltd", "llc", "plc"]):
            score += 0.1
        
        return min(1.0, score)
    
    async def _process_rfp_signals(self, signals: List[Dict[str, Any]], query: LinkedInSearchQuery):
        """Process detected RFP signals"""
        
        for signal in signals:
            try:
                post = signal["post"]
                
                # Create structured RFP data
                rfp_data = await self._create_rfp_record(post, signal["confidence_score"])
                
                if rfp_data:
                    # Store in knowledge base
                    await self._store_rfp_detection(rfp_data)
                    
                    # Trigger webhook notification
                    await self._trigger_procurement_notification(rfp_data)
                    
                    self.detected_rfps.append(rfp_data)
                    
                    logger.info(f"✅ New RFP detected: {rfp_data['organization']} (Score: {rfp_data['opportunity_score']})")
                    
            except Exception as e:
                logger.error(f"Error processing RFP signal: {str(e)}")
    
    async def _create_rfp_record(self, post: Dict[str, Any], confidence: float) -> Optional[Dict[str, Any]]:
        """Create structured RFP record from LinkedIn post"""
        
        content = post.get("content", "")
        
        # Extract organization
        organization = post.get("author_company", "Unknown Organization")
        
        # Determine sport type
        content_lower = content.lower()
        sport_type = "multi-sport"
        
        sport_mapping = {
            "football": ["football", "soccer", "premier league"],
            "rugby": ["rugby", "six nations"],
            "cricket": ["cricket", "t20"],
            "tennis": ["tennis", "wimbledon"],
            "basketball": ["basketball", "nba"],
            "golf": ["golf", "pga"]
        }
        
        for sport, keywords in sport_mapping.items():
            if any(kw in content_lower for kw in keywords):
                sport_type = sport
                break
        
        # Estimate value range
        estimated_value = "£100K-£500K"
        if any(indicator in content_lower for indicator in ["million", "large", "major", "significant"]):
            estimated_value = "£500K-£1M"
        
        # Determine urgency
        urgency = "MEDIUM"
        if any(word in content_lower for word in ["urgent", "immediately", "asap", "deadline"]):
            urgency = "CRITICAL"
        elif any(word in content_lower for word in ["soon", "quickly", "priority"]):
            urgency = "HIGH"
        
        # Calculate opportunity score
        opportunity_score = min(100, confidence * 100)
        
        rfp_data = {
            "id": f"monitor_{post.get('post_id', 'unknown')}_{datetime.now().strftime('%Y%m%d')}",
            "title": f"LinkedIn Procurement Signal - {sport_type}",
            "organization": organization,
            "sport": sport_type,
            "procurement_type": "Digital Services",
            "description": content[:500] + "..." if len(content) > 500 else content,
            "deadline": None,  # Requires additional analysis
            "value_estimate": estimated_value,
            "opportunity_score": int(opportunity_score),
            "priority_level": urgency,
            "status": "DISCOVERED",
            "requirements": [],  # Would need NLP extraction
            "urgency": urgency,
            "contact_info": {
                "name": post.get("author_name", "Unknown"),
                "email": "linkedin_search_required",
                "organization": organization,
                "department": "Digital Services"
            },
            "yellow_panther_fit": int(opportunity_score),
            "source": "monitor_linkedin",
            "discovered_at": datetime.now().isoformat(),
            "confidence_score": confidence,
            "detection_details": {
                "source_url": post.get("url", ""),
                "author_profile": post.get("author_profile_url", ""),
                "engagement_metrics": post.get("engagement", {}),
                "detection_method": "continuous_monitoring"
            }
        }
        
        return rfp_data
    
    async def _store_rfp_detection(self, rfp_data: Dict[str, Any]):
        """Store RFP detection in Neo4j knowledge graph"""
        
        # This would integrate with the existing Neo4j MCP service
        logger.info(f"💾 Storing RFP in knowledge graph: {rfp_data['id']}")
    
    async def _trigger_procurement_notification(self, rfp_data: Dict[str, Any]):
        """Trigger real-time notification for new RFP detection"""
        
        notification_data = {
            "type": "rfp_monitor_detection",
            "priority": rfp_data["priority_level"],
            "organization": rfp_data["organization"],
            "opportunity_score": rfp_data["opportunity_score"],
            "sport": rfp_data["sport"],
            "detection_method": "linkedin_monitor",
            "discovered_at": rfp_data["discovered_at"]
        }
        
        # Send to notification system (Slack, email, dashboard)
        logger.info(f"🔔 Notification triggered: {rfp_data['organization']}")
    
    def pause_monitoring(self):
        """Pause monitoring worker"""
        self.status = MonitorStatus.PAUSED
        logger.info("⏸️ LinkedIn monitoring paused")
    
    def resume_monitoring(self):
        """Resume monitoring worker"""
        self.status = MonitorStatus.ACTIVE
        logger.info("▶️ LinkedIn monitoring resumed")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current monitoring status"""
        return {
            "status": self.status,
            "total_rfps_detected": len(self.detected_rfps),
            "search_queries_active": len(self.search_queries),
            "last_update": datetime.now().isoformat()
        }
    
    def get_recent_detections(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get most recent RFP detections"""
        return self.detected_rfps[-limit:]

# Global monitor instance
linkedin_monitor: Optional[LinkedInMonitorWorker] = None

async def start_linkedin_monitor():
    """Start LinkedIn monitoring service"""
    global linkedin_monitor
    
    brightdata_config = {
        "token": os.getenv("BRIGHTDATA_TOKEN"),
        "zone": os.getenv("BRIGHTDATA_ZONE"),  
        "api_url": os.getenv("BRIGHTDATA_API_URL", "https://api.brightdata.com")
    }
    
    linkedin_monitor = LinkedInMonitorWorker(brightdata_config)
    
    # Start monitoring in background task
    asyncio.create_task(linkedin_monitor.start_monitoring())
    
    logger.info("🎯 LinkedIn Procurement Monitor started successfully")

# CLI to run the monitor
if __name__ == "__main__":
    async def main():
        await start_linkedin_monitor()
        
        # Keep the monitor running
        try:
            while True:
                await asyncio.sleep(60)
                
                # Print status every hour
                if datetime.now().minute == 0:
                    status = linkedin_monitor.get_status()
                    logger.info(f"📊 Monitor Status: {status}")
                    
        except KeyboardInterrupt:
            logger.info("🛑 Shutting down LinkedIn monitor...")
    
    asyncio.run(main())

