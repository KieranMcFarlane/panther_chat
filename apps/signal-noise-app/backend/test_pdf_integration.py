#!/usr/bin/env python3
"""Test PDF optimization integration"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

def test_integration():
    """Test that PDF optimization is integrated"""
    from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType
    import inspect

    print("\n" + "="*60)
    print("PDF Integration Verification")
    print("="*60)

    # Test 1: Check primary query
    print("\n[1/3] Primary query for DOCUMENT hop type...")
    source = inspect.getsource(HypothesisDrivenDiscovery._get_url_for_hop)

    has_document = 'HopType.DOCUMENT' in source
    has_filetype = 'filetype:pdf' in source
    has_optimized = '_search_pdfs_optimized' in source

    if has_document and has_filetype:
        print("    ✅ PASS")
    else:
        print("    ❌ FAIL - Missing DOCUMENT or filetype:pdf")
        return False

    if has_optimized:
        print("    ✅ PASS")
    else:
        print("    ❌ FAIL - Missing _search_pdfs_optimized method")
        return False

    # Test 2: Check integration in _get_url_for_hop
    print("\n[2/3] Integration in _get_url_for_hop...")
    source = inspect.getsource(HypothesisDrivenDiscovery._get_url_for_hop)

    has_special_handling = 'hop_type == HopType.DOCUMENT' in source
    has_call_to_optimized = 'await self._search_pdfs_optimized' in source
    has_fallback = 'Fall through to standard search' in source

    if has_special_handling:
        print("    ✅ PASS - Special DOCUMENT handling present")
    else:
        print("    ❌ FAIL - No special DOCUMENT handling")
        return False

    if has_call_to_optimized:
        print("    ✅ PASS - Calls optimized search method")
    else:
        print("    ❌ FAIL - Doesn't call optimized search")
        return False

    if has_fallback:
        print("    ✅ PASS - Has fallback to standard search")
    else:
        print("    ⚠️  WARNING - No explicit fallback message")

    # Summary
    print("\n" + "="*60)
    print("✅ ALL INTEGRATION TESTS PASSED")
    print("="*60 + "\n")
    return True

if __name__ == "__main__":
    import sys
    sys.exit(0 if test_integration() else 1)
