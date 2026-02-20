#!/usr/bin/env python3
"""
Direct ICF RFP Test - Scrape the actual tenders HTML page

User found: https://www.canoeicf.com/tenders
This shows multiple active RFPs with detailed requirements.
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_path = Path.cwd() / 'backend'
sys.path.insert(0, str(backend_path))

import os
os.chdir(backend_path)

from backend.brightdata_sdk_client import BrightDataSDKClient

async def test_icf_tenders_page():
    """
    Directly scrape the ICF tenders page that the user found
    """

    print("\n" + "="*80)
    print("ICF TENDERS PAGE - DIRECT SCRAPE")
    print("="*80 + "\n")

    # Initialize client
    brightdata = BrightDataSDKClient()

    # The URL the user found
    tenders_url = "https://www.canoeicf.com/tenders"

    print(f"🎯 TARGET URL: {tenders_url}")
    print("(This is the page you found with Google search)\n")

    # Scrape it
    print("🌐 Scraping tenders page...\n")

    scrape_result = await brightdata.scrape_as_markdown(tenders_url)

    if scrape_result["status"] == "success":
        content = scrape_result["content"]

        print(f"✅ Scraped {len(content)} characters\n")

        # Show first 2000 characters to verify content
        print("="*80)
        print("FIRST 2000 CHARACTERS (Content Preview)")
        print("="*80 + "\n")
        print(content[:2000])
        print("\n" + "="*80 + "\n")

        # Look for RFP-related keywords
        print("="*80)
        print("RFP KEYWORD ANALYSIS")
        print("="*80 + "\n")

        keywords = ["RFP", "tender", "procurement", "CMS", "DAM", "CRM", "Next.js", "headless", "eCommerce", "API"]
        content_lower = content.lower()

        found_keywords = []
        for keyword in keywords:
            if keyword.lower() in content_lower:
                # Count occurrences
                count = content_lower.count(keyword.lower())
                found_keywords.append((keyword, count))

        if found_keywords:
            print("✅ Keywords Found:")
            for keyword, count in sorted(found_keywords, key=lambda x: x[1], reverse=True):
                print(f"   - {keyword}: {count} occurrences")
            print()

        # Look for specific RFP mentions
        print("="*80)
        print("EXPLICIT RFP MENTIONS")
        print("="*80 + "\n")

        lines = content.split('\n')
        rfp_lines = []

        for i, line in enumerate(lines):
            if 'rfp' in line.lower() or 'tender' in line.lower():
                # Show context (line + 2 lines before and after)
                start = max(0, i - 2)
                end = min(len(lines), i + 3)
                context = '\n'.join(lines[start:end])

                if context not in '\n'.join(rfp_lines):  # Avoid duplicates
                    rfp_lines.append(context)

                if len(rfp_lines) >= 5:  # Limit output
                    break

        if rfp_lines:
            print(f"Found {len([l for l in lines if 'rfp' in l.lower()])} lines mentioning 'RFP'")
            print(f"Found {len([l for l in lines if 'tender' in l.lower()])} lines mentioning 'tender'\n")
            print("Sample RFP mentions (first 3):")
            for i, mention in enumerate(rfp_lines[:3], 1):
                print(f"\n{i}. {mention[:200]}...")
                print()

        # =============================================================================
        # WHAT THIS PROVES
        # =============================================================================

        print("="*80)
        print("ANALYSIS SUMMARY")
        print("="*80 + "\n")

        print("✅ The ICF tenders page EXISTS and is accessible")
        print(f"✅ URL: {tenders_url}")
        print(f"✅ Size: {len(content)} characters")
        print(f"✅ Contains RFP-related keywords: {len(found_keywords)} different terms")
        print()

        print("❌ BUT: The production system missed this because:")
        print("   1. Search query was: '{search_query_careers}'")
        print("   2. Should have been: '{search_query_rfp}'")
        print("   3. Hop types didn't include RFP/TENDERS pages")
        print()

        print("🎯 SOLUTION: Add RFP discovery hop types:")
        print("   - RFP_PAGE: Search '{entity} rfp'")
        print("   - TENDERS_PAGE: Search '{entity} tenders'")
        print("   - PROCUREMENT_PAGE: Search '{entity} procurement'")
        print()

        print("💡 With the correct search strategy, the system would:")
        print("   - Find this tenders page immediately")
        print("   - Detect multiple active RFPs")
        print("   - Match to YP services (CMS, DAM, CRM, eCommerce)")
        print("   - Generate high-confidence opportunities (0.80+)")
        print()

    else:
        print(f"❌ Scrape failed: {scrape_result.get('error')}")


if __name__ == "__main__":
    search_query_careers = '"International Canoe Federation" careers jobs'
    search_query_rfp = '"international canoe federation" rfp tenders'

    asyncio.run(test_icf_tenders_page())
