#!/usr/bin/env python3
"""Simple test: Verify PDF optimization is integrated"""

import asyncio
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

async def test_pdf_integration():
    """Test that PDF optimization is properly integrated"""
    from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType
    from brightdata_sdk_client import BrightDataSDKClient

    print("\n" + "="*60)
    print("TEST: PDF Integration Verification")
    print("="*60 + "\n")

    # Initialize
    brightdata = BrightDataSDKClient()
    discovery = HypothesisDrivenDiscovery(None, brightdata)

    # Test 1: Verify primary query exists for DOCUMENT hop type
    print("Test 1: Primary query for DOCUMENT hop type")
    print("-" * 40)

    # Create a fake state to test _get_url_for_hop
    class FakeState:
        def __init__(self):
            self.entity_name = "Test Entity"

    import inspect
    source = inspect.getsource(discovery._get_url_for_hop)

    has_document_query = 'HopType.DOCUMENT' in source and 'filetype:pdf' in source
    has_optimized_search = '_search_pdfs_optimized' in source

    if has_document_query:
        print("  ✅ DOCUMENT primary query added")
    else:
        print("  ❌ DOCUMENT primary query MISSING")

    if has_optimized_search:
        print("  ✅ Optimized search method exists")
    else:
        print("  ❌ Optimized search method MISSING")

    # Test 2: Verify optimized PDF search works
    print("\nTest 2: Optimized PDF search functionality")
    print("-" * 40)

    entity_name = "International Canoe Federation"
    url = await discovery._search_pdfs_optimized(entity_name)

    if url:
        print(f"  ✅ Found PDF URL")
        print(f"     URL: {url[:60]}...")
    else:
        print("  ❌ No PDF URL found")

    # Test 3: Verify DOCUMENT hop type uses optimized search
    print("\nTest 3: DOCUMENT hop type integration")
    print("-" * 40)

    state = FakeState()

    # This should use the optimized search internally
    url = await discovery._get_url_for_hop(HopType.DOCUMENT, state)

    if url:
        print(f"  ✅ DOCUMENT hop returned URL")
        print(f"     URL: {url[:60]}...")

        # Verify it's the same as optimized search
        direct_url = await discovery._search_pdfs_optimized(state.entity_name)
        if url == direct_url:
            print("  ✅ Matches optimized search result")
        else:
            print("  ⚠️  Different from optimized search (fallback used)")
    else:
        print("  ❌ DOCUMENT hop returned None")

    # Summary
    print("\n" + "="*60)
    all_passed = has_document_query and has_optimized_search and url
    if all_passed:
        print("✅ ALL TESTS PASSED")
        print("="*60 + "\n")
        return True
    else:
        print("❌ SOME TESTS FAILED")
        print("="*60 + "\n")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_pdf_integration())
    exit_code = 0 if result else 1
    exit(exit_code)
