#!/usr/bin/env python3
"""
Simplified LinkedIn RFP Search using BrightData API directly
This version bypasses the Claude Agent SDK compatibility issues and demonstrates
the core RFP search functionality using BrightData's search API directly.
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
import httpx
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / ".env.local"
load_dotenv(env_path)

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_DIR / "logs"
OUTPUT_FILE = OUTPUT_DIR / f"linkedin-rfp-search-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"

# Ensure output directory exists
OUTPUT_DIR.mkdir(exist_ok=True)


class LinkedInRFPSearcher:
    """LinkedIn RFP searcher using BrightData API directly."""
    
    def __init__(self):
        self.brightdata_token = os.getenv("BRIGHTDATA_API_TOKEN")
        self.results = []
        
    async def search_brightdata(self, query: str, engine: str = "google") -> Dict[str, Any]:
        """Search using BrightData SERP API."""
        if not self.brightdata_token:
            raise Exception("BRIGHTDATA_API_TOKEN not configured")
            
        url = f"https://api.brightdata.com/serp/{engine}"
        params = {
            "query": query,
            "num_results": "10",
            "api_key": self.brightdata_token,
            "country": "us",
            "language": "en"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            if response.status_code != 200:
                raise Exception(f"BrightData API error: {response.status_code}")
            return response.json()
    
    async def scrape_content(self, url: str) -> str:
        """Scrape content using BrightData scraping API."""
        if not self.brightdata_token:
            raise Exception("BRIGHTDATA_API_TOKEN not configured")
            
        scrape_url = "https://api.brightdata.com/scrape"
        params = {
            "url": url,
            "format": "markdown",
            "api_key": self.brightdata_token,
            "country": "us",
            "language": "en"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(scrape_url, params=params)
            if response.status_code != 200:
                return f"Failed to scrape: {response.status_code}"
            data = response.json()
            return data.get("content", "No content available")
    
    def is_rfp_related(self, text: str) -> bool:
        """Check if content contains RFP-related keywords."""
        rfp_keywords = [
            "rfp", "request for proposal", "tender", "itt", "rfq", 
            "rfi", "eoi", "procurement", "bid deadline", "submission",
            "vendor", "supplier", "contract opportunity", "solicitation"
        ]
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in rfp_keywords)
    
    def extract_rfp_info(self, title: str, description: str, content: str = "") -> Dict[str, Any]:
        """Extract structured RFP information from text."""
        # Basic pattern matching for common RFP fields
        info = {
            "title": title,
            "description": description,
            "organization": "Unknown Organization",
            "deadline": None,
            "value": None,
            "source": "LinkedIn",
            "publication_date": datetime.now().strftime("%Y-%m-%d"),
            "is_rfp": self.is_rfp_related(f"{title} {description}")
        }
        
        # Try to extract organization from title/description
        org_patterns = [
            r"([A-Z][a-z]+ (?:FC|United|City|Arsenal|Chelsea|Liverpool|Manchester|Tottenham|Leicester|Everton|Wolves|Newcastle|Aston Villa|West Ham|Crystal Palace|Bournemouth|Brentford|Fulham|Nottingham Forest|Southampton|Leeds|Sheffield|Burnley|Luton|Brighton|Hove|Albion))",
            r"([A-Z][a-z]+ (?:Stadium|Arena|Venue|Center|Centre))",
            r"((?:Premier League|EFL|FA|UEFA|FIFA|NFL|NBA|MLB|NHL|MLS))",
        ]
        
        combined_text = f"{title} {description}"
        for pattern in org_patterns:
            import re
            match = re.search(pattern, combined_text)
            if match:
                info["organization"] = match.group(1)
                break
                
        return info
    
    async def search_linkedin_rfps(self) -> List[Dict[str, Any]]:
        """Main search method for LinkedIn RFP opportunities."""
        print("🔍 Starting LinkedIn RFP search using BrightData API...")
        
        if not self.brightdata_token:
            print("❌ BRIGHTDATA_API_TOKEN not configured")
            return []
        
        # Search queries for RFP opportunities
        search_queries = [
            'site:linkedin.com (RFP OR "request for proposal" OR tender OR ITT OR RFQ OR RFI OR EOI) (website OR digital OR "mobile app" OR apps OR application OR platform OR "web app" OR CMS OR API OR Android OR iOS) (sports OR football OR rugby OR cricket OR stadium OR league OR federation OR club)',
            'site:linkedin.com (digital transformation OR technology upgrade OR software implementation) (sports OR stadium OR arena OR venue) (RFP OR tender OR procurement)',
            'site:linkedin.com ("sports technology" OR "sports digital" OR "stadium technology") (RFP OR tender OR procurement OR vendor OR supplier)'
        ]
        
        all_results = []
        
        for i, query in enumerate(search_queries, 1):
            print(f"📝 Running search {i}/{len(search_queries)}...")
            print(f"   Query: {query[:100]}...")
            
            try:
                search_results = await self.search_brightdata(query)
                
                if "organic_results" in search_results:
                    print(f"   Found {len(search_results['organic_results'])} results")
                    
                    for result in search_results["organic_results"]:
                        # Extract basic RFP information
                        rfp_info = self.extract_rfp_info(
                            result.get("title", ""),
                            result.get("description", "")
                        )
                        
                        # Add URL
                        rfp_info["url"] = result.get("link", "")
                        
                        # Only include if it looks like an RFP
                        if rfp_info["is_rfp"]:
                            print(f"   ✅ Found RFP: {rfp_info['title'][:50]}...")
                            all_results.append(rfp_info)
                        
                else:
                    print("   ⚠️  No organic results found")
                    
            except Exception as e:
                print(f"   ❌ Search failed: {e}")
                continue
        
        self.results = all_results
        print(f"📊 Total RFP opportunities found: {len(all_results)}")
        return all_results
    
    async def save_results(self):
        """Save search results to JSON file."""
        if not self.results:
            print("⚠️  No results to save")
            return
            
        output_data = {
            "search_metadata": {
                "timestamp": datetime.now().isoformat(),
                "source": "LinkedIn via BrightData API (Direct)",
                "total_results": len(self.results),
                "search_type": "RFP and tender opportunities",
                "method": "Direct API integration"
            },
            "configuration": {
                "brightdata_token": f"{self.brightdata_token[:10]}..." if self.brightdata_token else None,
                "search_engines": ["google"],
                "target_sites": ["linkedin.com"]
            },
            "results": self.results
        }
        
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
            
        print(f"💾 Results saved to: {OUTPUT_FILE}")
        print(f"📊 Found {len(self.results)} RFP opportunities")
        
        # Print summary
        for i, result in enumerate(self.results[:5], 1):  # Show first 5
            org = result.get('organization', 'Unknown Organization')
            title = result.get('title', 'Untitled RFP')
            value = result.get('value', 'Value not specified')
            print(f"  {i}. {org} - {title} ({value})")
            
        if len(self.results) > 5:
            print(f"  ... and {len(self.results) - 5} more opportunities")


async def main():
    """Main execution function."""
    print("🚀 LinkedIn RFP Search - Direct BrightData API")
    print("=" * 50)
    
    # Check environment
    if not os.getenv("BRIGHTDATA_API_TOKEN"):
        print("❌ BRIGHTDATA_API_TOKEN environment variable required")
        print("   Check your .env.local file")
        sys.exit(1)
    
    print(f"✅ BrightData token configured: {os.getenv('BRIGHTDATA_API_TOKEN')[:10]}...")
    
    # Run the search
    searcher = LinkedInRFPSearcher()
    results = await searcher.search_linkedin_rfps()
    await searcher.save_results()
        
    print("\n✅ LinkedIn RFP search completed!")
    print(f"📁 Results saved to: {OUTPUT_FILE}")
    
    # Show sample integration with existing systems
    if results:
        print(f"\n🔗 Integration Examples:")
        print(f"   - Supabase: These results can be stored in your rfp_opportunities table")
        print(f"   - Neo4j: Create relationships between sports entities and opportunities")
        print(f"   - Notifications: Trigger real-time alerts for new RFPs")
        print(f"   - Email Campaigns: Auto-generate outreach for relevant opportunities")


if __name__ == "__main__":
    asyncio.run(main())