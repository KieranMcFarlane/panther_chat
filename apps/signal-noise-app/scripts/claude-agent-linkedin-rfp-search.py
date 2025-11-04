#!/usr/bin/env python3
"""
Headless LinkedIn RFP Search using Claude Agent SDK + BrightData MCP

This script uses Claude Agent SDK to search LinkedIn for RFP opportunities
using BrightData MCP tools for web scraping and search.

Usage:
    python3 scripts/claude-agent-linkedin-rfp-search.py

Requirements:
    - Claude Agent SDK: pip install claude-agent-sdk
    - BrightData MCP server running on localhost:8014
    - ANTHROPIC_API_KEY environment variable
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

# Load environment variables from .env.local
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

# Load environment variables
env_path = Path(__file__).parent.parent / ".env.local"
load_dotenv(env_path)

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_DIR / "logs"
OUTPUT_FILE = OUTPUT_DIR / f"linkedin-rfp-search-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"

# Ensure output directory exists
OUTPUT_DIR.mkdir(exist_ok=True)


class LinkedInRFPSearcher:
    """Headless LinkedIn RFP searcher using Claude Agent SDK."""
    
    def __init__(self):
        self.client = None
        self.results = []
        
    async def __aenter__(self):
        """Async context manager entry."""
        await self.setup_client()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.client:
            await self.client.disconnect()
            
    async def setup_client(self):
        """Setup Claude SDK client with BrightData MCP integration."""
        options = ClaudeAgentOptions(
            # System prompt for RFP search expertise
            system_prompt={
                "type": "preset", 
                "preset": "claude_code",
                "append": """
You are an expert RFP (Request for Proposal) intelligence analyst specializing in the sports industry. 

Your task is to search LinkedIn and identify genuine RFP, tender, and procurement opportunities that match:
1. RFP/tender keywords: RFP, "request for proposal", Tender, ITT, RFQ, RFI, EOI
2. Digital/tech services: website, digital, "mobile app", apps, application, platform, "web app", CMS, API, Android, iOS
3. Sports industry context: sports, football, rugby, cricket, stadium, league, federation, club

For each opportunity found, extract:
- Organization name and location
- RFP title and description
- Deadline (if available)
- Estimated value (if available)
- Direct link to the opportunity
- Publication date

Focus on recent, active opportunities from legitimate sports organizations, venues, and events.
"""
            },
            
            # MCP server configuration for BrightData (using our existing server)
            mcp_servers={
                "brightdata": {
                    "type": "stdio",
                    "command": "node",
                    "args": [str(PROJECT_DIR / "src" / "mcp-brightdata-server.js")],
                    "env": {
                        "BRIGHTDATA_TOKEN": os.getenv("BRIGHTDATA_API_TOKEN", ""),
                        "BRIGHTDATA_ZONE": os.getenv("BRIGHTDATA_ZONE", "linkedin_posts_monitor")
                    }
                }
            },
            
            # Tools we want to use (mapping to our BrightData MCP server)
            allowed_tools=[
                "mcp__brightdata__search_engine",
                "mcp__brightdata__scrape_as_markdown", 
                "mcp__brightdata__scrape_batch"
            ],
            
            # Permission settings
            permission_mode="bypassPermissions",  # Safe for headless operation
            
            # Working directory
            cwd=str(PROJECT_DIR),
            
            # Environment variables
            env={
                "ANTHROPIC_API_KEY": os.getenv("ANTHROPIC_API_KEY", ""),
                "BRIGHTDATA_TOKEN": os.getenv("BRIGHTDATA_API_TOKEN", ""),
                "BRIGHTDATA_ZONE": os.getenv("BRIGHTDATA_ZONE", "linkedin_posts_monitor")
            },
            
              
            # Custom stderr handler for logging
            stderr=self._log_message
        )
        
        self.client = ClaudeSDKClient(options)
        
    def _log_message(self, message: str):
        """Custom logging handler."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message.strip()}")
        
    async def search_linkedin_rfps(self) -> List[Dict[str, Any]]:
        """Main search method for LinkedIn RFP opportunities."""
        print("🔍 Starting LinkedIn RFP search using Claude Agent SDK...")
        
        try:
            # Connect to Claude
            await self.client.connect()
            print("✅ Connected to Claude Agent SDK")
            
            # Primary search query for LinkedIn RFPs
            search_prompt = """
Search LinkedIn for RFP and tender opportunities in the sports industry. 

Execute these search queries using BrightData search tools:

1. site:linkedin.com (RFP OR "request for proposal" OR tender OR ITT OR RFQ OR RFI OR EOI) (website OR digital OR "mobile app" OR apps OR application OR platform OR "web app" OR CMS OR API OR Android OR iOS) (sports OR football OR rugby OR cricket OR stadium OR league OR federation OR club)

2. site:linkedin.com (digital transformation OR technology upgrade OR software implementation) (sports OR stadium OR arena OR venue) (RFP OR tender OR procurement)

For each relevant result found:
1. Scrape the full LinkedIn post/content as markdown
2. Extract key information (organization, title, deadline, value, description)
3. Verify it's a genuine RFP/tender opportunity
4. Include the LinkedIn URL

Focus on opportunities from the last 6 months. Return results in JSON format with full details.
"""
            
            print("📤 Sending search query to Claude...")
            await self.client.query(search_prompt)
            
            # Process responses
            results = []
            async for message in self.client.receive_response():
                if hasattr(message, 'type'):
                    if message.type == 'assistant':
                        print("🤖 Processing Claude response...")
                        # Extract content from assistant messages
                        if hasattr(message, 'content'):
                            for content_block in message.content:
                                if hasattr(content_block, 'text'):
                                    print(f"📝 Response: {content_block.text[:200]}...")
                                    
                    elif message.type == 'result':
                        print("✅ Search completed")
                        if hasattr(message, 'result'):
                            print(f"📊 Final result: {message.result}")
                            # Try to parse JSON results
                            try:
                                parsed_results = self._extract_json_from_result(message.result)
                                if parsed_results:
                                    results.extend(parsed_results)
                            except Exception as e:
                                print(f"⚠️  Could not parse results as JSON: {e}")
                                
                    elif message.type == 'stream_event':
                        # Real-time updates
                        if hasattr(message, 'event') and hasattr(message.event, 'delta'):
                            print(f"⚡ {message.event.delta.text[:100]}...")
                            
            self.results = results
            return results
            
        except Exception as e:
            print(f"❌ Error during search: {e}")
            return []
            
    def _extract_json_from_result(self, result_text: str) -> List[Dict[str, Any]]:
        """Extract JSON array from Claude's response text."""
        try:
            # Look for JSON array in the response
            start_idx = result_text.find('[')
            end_idx = result_text.rfind(']') + 1
            
            if start_idx != -1 and end_idx != 0:
                json_str = result_text[start_idx:end_idx]
                return json.loads(json_str)
            else:
                # Try to parse the entire response as JSON
                return json.loads(result_text)
        except json.JSONDecodeError:
            print("⚠️  No valid JSON found in response")
            return []
            
    async def save_results(self):
        """Save search results to JSON file."""
        if not self.results:
            print("⚠️  No results to save")
            return
            
        output_data = {
            "search_metadata": {
                "timestamp": datetime.now().isoformat(),
                "source": "LinkedIn via Claude Agent SDK + BrightData MCP",
                "total_results": len(self.results),
                "search_type": "RFP and tender opportunities"
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
    print("🚀 LinkedIn RFP Search - Claude Agent SDK + BrightData MCP")
    print("=" * 60)
    
    # Check environment
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("❌ ANTHROPIC_API_KEY environment variable required")
        sys.exit(1)
        
    # Check BrightData credentials
    if not os.getenv("BRIGHTDATA_API_TOKEN"):
        print("⚠️  BRIGHTDATA_API_TOKEN not set. LinkedIn search may not work.")
        print("   Set it with: export BRIGHTDATA_API_TOKEN=your_token_here")
    
    if not os.getenv("BRIGHTDATA_ZONE"):
        print("⚠️  BRIGHTDATA_ZONE not set. Using default: linkedin_posts_monitor")
        os.environ["BRIGHTDATA_ZONE"] = "linkedin_posts_monitor"
    
    # Run the search
    async with LinkedInRFPSearcher() as searcher:
        results = await searcher.search_linkedin_rfps()
        await searcher.save_results()
        
    print("\n✅ LinkedIn RFP search completed!")
    print(f"📁 Results saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    asyncio.run(main())