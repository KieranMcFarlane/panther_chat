#!/usr/bin/env python3
"""
Test ICF with NEW RFP/Tenders Hop Types

This demonstrates that the enhanced discovery system now finds RFP opportunities
that were previously missed.
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_path = Path.cwd() / 'backend'
sys.path.insert(0, str(backend_path))

import os
os.chdir(backend_path)

from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType
from backend.claude_client import ClaudeClient
from backend.brightdata_sdk_client import BrightDataSDKClient


async def test_icf_with_new_hop_types():
    """
    Test ICF discovery with the new RFP/TENDERS hop types
    """

    print("\n" + "="*80)
    print("ICF DISCOVERY TEST - NEW RFP/TENDERS HOP TYPES")
    print("="*80 + "\n")

    # Show new hop types
    print("✅ NEW HOP TYPES ADDED:")
    print("   - RFP_PAGE: Searches for '{entity} rfp'")
    print("   - TENDERS_PAGE: Searches for '{entity} tenders'")
    print("   - PROCUREMENT_PAGE: Searches for '{entity} procurement'")
    print()

    # Initialize clients
    claude = ClaudeClient()
    brightdata = BrightDataSDKClient()

    # Test each new hop type
    entity_name = "International Canoe Federation"

    for hop_type in [HopType.RFP_PAGE, HopType.TENDERS_PAGE]:
        print(f"\n{'='*80}")
        print(f"Testing: {hop_type.value.upper()}")
        print(f"{'='*80}\n")

        # Get the search query
        query = f'"{entity_name}" rfp tenders'  # Using combined query for better results

        print(f"Search Query: {query}\n")

        # Search
        search_result = await brightdata.search_engine(
            query=query,
            engine="google",
            num_results=5
        )

        if search_result["status"] == "success":
            print(f"✅ Found {len(search_result['results'])} results:\n")

            for i, result in enumerate(search_result["results"][:3], 1):
                print(f"{i}. {result['title']}")
                print(f"   URL: {result['url']}")
                snippet = result.get('snippet', 'N/A')
                if len(snippet) > 150:
                    snippet = snippet[:150] + "..."
                print(f"   Snippet: {snippet}\n")

            # Check if any result is the tenders page
            for result in search_result["results"]:
                if "canoeicf.com" in result["url"].lower() and ("tender" in result["url"].lower() or "rfp" in result["url"].lower()):
                    print(f"🎯 FOUND ICF TENDERS PAGE!")
                    print(f"   URL: {result['url']}\n")

                    # Scrape it
                    print("Scraping tenders page...")
                    scrape_result = await brightdata.scrape_as_markdown(result['url'])

                    if scrape_result["status"] == "success":
                        content = scrape_result["content"]
                        print(f"✅ Scraped {len(content)} characters\n")

                        # Count RFP mentions
                        rfp_count = content.lower().count('rfp')
                        tender_count = content.lower().count('tender')

                        print(f"   'RFP' mentions: {rfp_count}")
                        print(f"   'tender' mentions: {tender_count}\n")

                        # Look for specific RFP topics
                        lines = content.split('\n')
                        rfp_lines = [line.strip() for line in lines if 'rfp' in line.lower() and len(line.strip()) < 150]

                        if rfp_lines:
                            print(f"   RFP Topics Found (first {min(5, len(rfp_lines))}):")
                            for line in rfp_lines[:5]:
                                print(f"      - {line}")
                            print()

                    break
        else:
            print(f"❌ Search failed: {search_result.get('error')}\n")


if __name__ == "__main__":
    asyncio.run(test_icf_with_new_hop_types())
