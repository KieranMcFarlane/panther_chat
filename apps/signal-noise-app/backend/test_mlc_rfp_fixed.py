#!/usr/bin/env python3
"""
Test Major League Cricket RFP Discovery - Improved

This test specifically searches for the ACE Digital Transformation RFP
that was missed in the initial test.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone

# Load environment variables
from dotenv import load_dotenv
backend_env = os.path.join(os.path.dirname(__file__), '.env')
parent_env = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(backend_env)
load_dotenv(parent_env, override=True)

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def print_section(title: str):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


async def test_mlc_rfp_with_correct_searches():
    """Test MLC RFP with proper search terms"""
    print_section("MAJOR LEAGUE CRICKET RFP DISCOVERY - IMPROVED")

    from brightdata_sdk_client import BrightDataSDKClient
    from entity_type_dossier_questions import get_entity_aliases

    if not os.getenv('BRIGHTDATA_API_TOKEN'):
        print("⚠️  BRIGHTDATA_API_TOKEN not set - skipping real scraping")
        return None

    brightdata = BrightDataSDKClient()

    # Get entity aliases
    entity_id = "major-league-cricket"
    entity_name = "Major League Cricket"
    aliases = get_entity_aliases(entity_id, entity_name)

    print(f"\n📊 Entity: {entity_name}")
    print(f"   ID: {entity_id}")
    print(f"   Aliases: {', '.join(aliases)}")

    # The RFP searches that should have been run
    rfp_searches = [
        '"Major League Cricket" RFP digital transformation',
        '"American Cricket Enterprises" RFP',
        '"American Cricket Enterprises" "Request for Proposal"',
        '"ACE" cricket RFP digital transformation',
        'site:majorleaguecricket.com RFP OR "Request for Proposal"',
        'site:majorleaguecricket.com ACE digital',
        'site:majorleaguecricket.com news "digital transformation"',
    ]

    print(f"\n🔍 Running {len(rfp_searches)} targeted RFP searches:\n")

    for i, query in enumerate(rfp_searches, 1):
        print(f"Search {i}/{len(rfp_searches)}: {query}")

        try:
            result = await brightdata.search_engine(
                query=query,
                engine='google',
                num_results=10  # Get more results for RFP searches
            )

            if result.get('status') == 'success':
                results = result.get('results', [])
                print(f"   ✅ Found {len(results)} results")

                # Check for RFP indicators
                for r in results:
                    title = r.get('title', '')
                    url = r.get('url', '')
                    snippet = r.get('snippet', '')

                    is_rfp = any(term in title.lower() or term in snippet.lower()
                              for term in ['rfp', 'request for proposal', 'digital transformation', 'ace'])

                    if is_rfp or 'majorleaguecricket.com' in url or 'ace' in url.lower():
                        print(f"   🎯 POTENTIAL RFP:")
                        print(f"      Title: {title[:100]}")
                        print(f"      URL: {url}")
                        print(f"      Snippet: {snippet[:150]}")
                        print()

                print()
            else:
                print(f"   ❌ Failed: {result.get('message', 'Unknown')}")
                print()

        except Exception as e:
            print(f"   ❌ Error: {e}")
            print()

    # Now try to scrape the majorleaguecricket.com news page
    print_section("SCRAPE MLC NEWS PAGE")

    scrape_urls = [
        'https://www.majorleaguecricket.com/news',
        'https://www.majorleaguecricket.com/',
        'https://www.majorleaguecricket.com/news/241',  # Based on user's findings
    ]

    for url in scrape_urls:
        print(f"\n🔍 Scraping: {url}")

        try:
            result = await brightdata.scrape_as_markdown(url=url)

            if result.get('status') == 'success':
                content = result.get('content', '')
                print(f"   Content length: {len(content)} chars")

                # Look for RFP mentions
                if 'rfp' in content.lower() or 'request for proposal' in content.lower():
                    print(f"   ✅ RFP FOUND in scraped content!")

                    # Show lines containing RFP
                    lines = content.split('\n')
                    for j, line in enumerate(lines):
                        if 'rfp' in line.lower() or 'request for proposal' in line.lower():
                            print(f"      Line {j}: {line[:200]}")
                else:
                    print(f"   No RFP found (checking for ACE/Digital Transformation...)")

                if 'ace' in content.lower() or 'digital transformation' in content.lower():
                    print(f"   ✅ ACE or Digital Transformation mentioned")

                if 'american cricket enterprises' in content.lower():
                    print(f"   ✅ American Cricket Enterprises mentioned")

            else:
                print(f"   ❌ Scrape failed: {result.get('message', 'Unknown')}")

        except Exception as e:
            print(f"   ❌ Error: {e}")


async def test_ace_specific_search():
    """Test ACE-specific RFP search"""
    print_section("ACE DIGITAL TRANSFORMATION RFP - DIRECT SEARCH")

    from brightdata_sdk_client import BrightDataSDKClient

    if not os.getenv('BRIGHTDATA_API_TOKEN'):
        print("⚠️  BRIGHTDATA_API_TOKEN not set")
        return None

    brightdata = BrightDataSDKClient()

    # Based on the user's findings, the RFP should contain:
    rfp_keywords = [
        "ACE ISSUES RFP FOR DIGITAL TRANSFORMATION",
        "ACE digital transformation RFP cricket",
        "American Cricket Enterprises digital transformation",
        "Johnny Grave ACE RFP",  # CEO contact mentioned in RFP
    ]

    print(f"\n🔍 Searching for ACE RFP with specific keywords:\n")

    for keyword in rfp_keywords:
        query = f'"{keyword}"'
        print(f"   Query: {query}")

        try:
            result = await brightdata.search_engine(
                query=query,
                engine='google',
                num_results=10
            )

            if result.get('status') == 'success':
                results = result.get('results', [])
                print(f"   ✅ {len(results)} results")

                for r in results[:3]:
                    title = r.get('title', '')
                    url = r.get('url', '')
                    print(f"      - {title[:90]}")
                    print(f"        {url}")
            else:
                print(f"   ❌ Failed: {result.get('message', 'Unknown')}")

        except Exception as e:
            print(f"   ❌ Error: {e}")

        print()


async def main():
    print("\n" + "=" * 80)
    print("  MAJOR LEAGUE CRICKET RFP - IMPROVED DISCOVERY TEST")
    print("=" * 80)
    print(f"  Started: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print(f"  Testing searches that would find the ACE Digital Transformation RFP")

    await test_mlc_rfp_with_correct_searches()
    await test_ace_specific_search()

    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print("\n📋 Key Learnings:")
    print("   1. Entity is 'American Cricket Enterprises (ACE)' not 'Major League Cricket'")
    print("   2. RFP was issued in September 2025, deadline October 2025")
    print("   3. Search terms must include: RFP, ACE, digital transformation")
    print("   4. LinkedIn post found but content wasn't scraped")
    print("   5. majorleaguecricket.com returns empty (JS-rendered/bot-protected)")
    print("\n💡 Required Fixes:")
    print("   • Add 'RFP' to next_signals search keywords")
    print("   • Use entity aliases (ACE for MLC)")
    print("   • Use site-specific searches for official domains")
    print("   • Increase result count for high-value hops")
    print("   • Add 'Request for Proposal' as alternative to 'RFP'")


if __name__ == "__main__":
    exit(asyncio.run(main()))
