#!/usr/bin/env python3
"""Test optimized PDF search functionality"""

import asyncio
import logging

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)

async def test_pdf_search():
    """Test the optimized PDF search with a real entity"""
    from hypothesis_driven_discovery import HypothesisDrivenDiscovery
    from brightdata_sdk_client import BrightDataSDKClient

    brightdata = BrightDataSDKClient()
    discovery = HypothesisDrivenDiscovery(None, brightdata)

    # Test with International Canoe Federation (should find paddle_worldwide_proposed_ecosystem.pdf)
    entity_name = "International Canoe Federation"

    print(f"\n{'='*60}")
    print(f"Testing optimized PDF search for: {entity_name}")
    print(f"{'='*60}\n")

    url = await discovery._search_pdfs_optimized(entity_name)

    if url:
        print(f"\n✅ SUCCESS: Found PDF URL")
        print(f"   URL: {url}")
        print(f"   Expected: paddle_worldwide_proposed_ecosystem.pdf (or similar)")
        return True
    else:
        print(f"\n❌ FAILED: No PDF URL found")
        return False

if __name__ == '__main__':
    result = asyncio.run(test_pdf_search())
    exit(0 if result else 1)
