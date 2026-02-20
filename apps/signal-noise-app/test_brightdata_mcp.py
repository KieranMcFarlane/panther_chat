#!/usr/bin/env python3
"""
Test BrightData MCP Integration

Verifies that the BrightData MCP client properly connects via stdio transport
and can call tools successfully.
"""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from backend.brightdata_mcp_client import BrightDataMCPClient


async def test_mcp_connection():
    """Test 1: Verify MCP session initialization"""
    print("=" * 60)
    print("Test 1: MCP Connection")
    print("=" * 60)

    try:
        async with BrightDataMCPClient() as client:
            if client.session:
                print("✅ MCP session initialized successfully")
                print(f"   Session type: {type(client.session).__name__}")
                return True
            else:
                print("⚠️ MCP session not available (fallback mode)")
                print("   This means the mcp package is not installed")
                print("   Install with: pip install mcp")
                return False
    except Exception as e:
        print(f"❌ MCP connection failed: {e}")
        return False


async def test_search_engine():
    """Test 2: Test search_engine tool via MCP"""
    print("\n" + "=" * 60)
    print("Test 2: Search Engine")
    print("=" * 60)

    try:
        async with BrightDataMCPClient() as client:
            result = await client.search_engine(
                query="Arsenal FC CRM manager job",
                engine="google"
            )

            print(f"Status: {result.get('status')}")

            if result.get('status') == 'success':
                results = result.get('results', [])
                print(f"✅ Search successful: {len(results)} results found")

                # Show first result preview
                if results:
                    first = results[0]
                    print(f"   First result: {first.get('title', 'N/A')}")
                    print(f"   URL: {first.get('url', 'N/A')[:60]}...")
                return True
            elif result.get('status') == 'mock':
                print("⚠️ Mock response - MCP not properly connected")
                return False
            else:
                print(f"❌ Search failed: {result.get('error')}")
                return False

    except Exception as e:
        print(f"❌ Search test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_scrape_as_markdown():
    """Test 3: Test scrape_as_markdown tool via MCP"""
    print("\n" + "=" * 60)
    print("Test 3: Scrape as Markdown")
    print("=" * 60)

    try:
        async with BrightDataMCPClient() as client:
            result = await client.scrape_as_markdown("https://arsenal.com")

            print(f"Status: {result.get('status')}")

            if result.get('status') == 'success':
                content = result.get('content', '')
                word_count = result.get('metadata', {}).get('word_count', 0)

                print(f"✅ Scrape successful: {word_count} words")
                print(f"   Content preview: {content[:150]}...")
                return True
            elif result.get('status') == 'mock':
                print("⚠️ Mock response - MCP not properly connected")
                return False
            else:
                print(f"❌ Scrape failed: {result.get('error')}")
                return False

    except Exception as e:
        print(f"❌ Scrape test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_batch_scrape():
    """Test 4: Test scrape_batch tool via MCP"""
    print("\n" + "=" * 60)
    print("Test 4: Batch Scrape")
    print("=" * 60)

    try:
        async with BrightDataMCPClient() as client:
            urls = [
                "https://arsenal.com",
                "https://linkedin.com"
            ]

            result = await client.scrape_batch(urls)

            print(f"Status: {result.get('status')}")

            if result.get('status') == 'success':
                total = result.get('total_urls', 0)
                successful = result.get('successful', 0)

                print(f"✅ Batch scrape successful: {successful}/{total} URLs")
                return True
            elif result.get('status') == 'mock':
                print("⚠️ Mock response - MCP not properly connected")
                return False
            else:
                print(f"❌ Batch scrape failed: {result.get('error')}")
                return False

    except Exception as e:
        print(f"❌ Batch scrape test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_jobs_board_convenience():
    """Test 5: Test scrape_jobs_board convenience method"""
    print("\n" + "=" * 60)
    print("Test 5: Jobs Board Search (Convenience Method)")
    print("=" * 60)

    try:
        async with BrightDataMCPClient() as client:
            result = await client.scrape_jobs_board(
                entity_name="Arsenal FC",
                keywords=["CRM", "Data", "Digital"]
            )

            print(f"Status: {result.get('status')}")

            if result.get('status') == 'success':
                results = result.get('results', [])
                print(f"✅ Jobs board search successful: {len(results)} results")
                return True
            elif result.get('status') == 'mock':
                print("⚠️ Mock response - MCP not properly connected")
                return False
            else:
                print(f"❌ Jobs board search failed: {result.get('error')}")
                return False

    except Exception as e:
        print(f"❌ Jobs board test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("BrightData MCP Integration Test Suite")
    print("=" * 60)
    print(f"\nEnvironment Check:")
    print(f"  BRIGHTDATA_API_TOKEN: {'✅ Set' if os.getenv('BRIGHTDATA_API_TOKEN') else '❌ Not set'}")
    print(f"  BRIGHTDATA_PRO_MODE: {os.getenv('BRIGHTDATA_PRO_MODE', 'true')}")
    print()

    results = {
        "MCP Connection": await test_mcp_connection(),
        "Search Engine": await test_search_engine(),
        "Scrape as Markdown": await test_scrape_as_markdown(),
        "Batch Scrape": await test_batch_scrape(),
        "Jobs Board": await test_jobs_board_convenience(),
    }

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed! BrightData MCP integration is working.")
        return 0
    else:
        print("\n⚠️ Some tests failed. Check the output above for details.")
        print("\nTroubleshooting:")
        print("1. Ensure mcp package is installed: pip install mcp")
        print("2. Ensure @brightdata/mcp is installed: npx -y @brightdata/mcp")
        print("3. Ensure BRIGHTDATA_API_TOKEN is set in .env")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
