#!/usr/bin/env python3
"""
Test BrightData SDK optimizations in hypothesis-driven discovery

Tests:
1. Multi-engine support (ENGINE_PREFERENCES)
2. Result count by hop type (NUM_RESULTS_BY_HOP)
3. URL scoring (_score_url)
4. High-value hops identification (HIGH_VALUE_HOPS)
5. Fallback query improvements
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from hypothesis_driven_discovery import (
    HIGH_VALUE_HOPS,
    ENGINE_PREFERENCES,
    NUM_RESULTS_BY_HOP,
    HopType,
    FALLBACK_QUERIES
)


def test_constants():
    """Test that optimization constants are properly defined"""
    print("Testing optimization constants...")

    # Test HIGH_VALUE_HOPS
    assert HopType.RFP_PAGE in HIGH_VALUE_HOPS, "RFP_PAGE should be high-value hop"
    assert HopType.TENDERS_PAGE in HIGH_VALUE_HOPS, "TENDERS_PAGE should be high-value hop"
    assert HopType.PROCUREMENT_PAGE in HIGH_VALUE_HOPS, "PROCUREMENT_PAGE should be high-value hop"
    assert HopType.DOCUMENT in HIGH_VALUE_HOPS, "DOCUMENT should be high-value hop"
    print("✅ HIGH_VALUE_HOPS defined correctly")

    # Test ENGINE_PREFERENCES
    assert HopType.RFP_PAGE in ENGINE_PREFERENCES, "RFP_PAGE should have engine preferences"
    assert ENGINE_PREFERENCES[HopType.RFP_PAGE] == ['google', 'bing'], \
        f"RFP_PAGE should prefer Google then Bing, got {ENGINE_PREFERENCES[HopType.RFP_PAGE]}"

    assert HopType.TENDERS_PAGE in ENGINE_PREFERENCES, "TENDERS_PAGE should have engine preferences"
    assert ENGINE_PREFERENCES[HopType.TENDERS_PAGE] == ['google', 'yandex'], \
        f"TENDERS_PAGE should prefer Google then Yandex, got {ENGINE_PREFERENCES[HopType.TENDERS_PAGE]}"

    assert HopType.PROCUREMENT_PAGE in ENGINE_PREFERENCES, "PROCUREMENT_PAGE should have engine preferences"
    assert ENGINE_PREFERENCES[HopType.PROCUREMENT_PAGE] == ['google', 'bing'], \
        f"PROCUREMENT_PAGE should prefer Google then Bing, got {ENGINE_PREFERENCES[HopType.PROCUREMENT_PAGE]}"

    print("✅ ENGINE_PREFERENCES defined correctly")

    # Test NUM_RESULTS_BY_HOP
    assert HopType.RFP_PAGE in NUM_RESULTS_BY_HOP, "RFP_PAGE should have result count"
    assert NUM_RESULTS_BY_HOP[HopType.RFP_PAGE] == 5, \
        f"RFP_PAGE should return 5 results, got {NUM_RESULTS_BY_HOP[HopType.RFP_PAGE]}"

    assert HopType.OFFICIAL_SITE in NUM_RESULTS_BY_HOP, "OFFICIAL_SITE should have result count"
    assert NUM_RESULTS_BY_HOP[HopType.OFFICIAL_SITE] == 1, \
        f"OFFICIAL_SITE should return 1 result, got {NUM_RESULTS_BY_HOP[HopType.OFFICIAL_SITE]}"

    print("✅ NUM_RESULTS_BY_HOP defined correctly")


def test_fallback_queries():
    """Test that fallback queries are procurement-specific"""
    print("\nTesting fallback query improvements...")

    # Test RFP_PAGE fallbacks
    rfp_fallbacks = FALLBACK_QUERIES[HopType.RFP_PAGE]
    assert '{entity} "vendor requirements"' in rfp_fallbacks, \
        "RFP_PAGE should include 'vendor requirements' fallback"
    assert '{entity} procurement rfp documents' in rfp_fallbacks, \
        "RFP_PAGE should include procurement RFP documents fallback"
    print(f"✅ RFP_PAGE has {len(rfp_fallbacks)} fallback queries (expected 6+)")

    # Test TENDERS_PAGE fallbacks
    tenders_fallbacks = FALLBACK_QUERIES[HopType.TENDERS_PAGE]
    assert '{entity} vendor registration portal' in tenders_fallbacks, \
        "TENDERS_PAGE should include 'vendor registration portal' fallback"
    assert '{entity} procurement opportunities' in tenders_fallbacks, \
        "TENDERS_PAGE should include 'procurement opportunities' fallback"
    print(f"✅ TENDERS_PAGE has {len(tenders_fallbacks)} fallback queries (expected 7+)")

    # Test PROCUREMENT_PAGE fallbacks
    procurement_fallbacks = FALLBACK_QUERIES[HopType.PROCUREMENT_PAGE]
    assert '{entity} procurement policy' in procurement_fallbacks, \
        "PROCUREMENT_PAGE should include 'procurement policy' fallback"
    assert '{entity} vendor information' in procurement_fallbacks, \
        "PROCUREMENT_PAGE should include 'vendor information' fallback"
    print(f"✅ PROCUREMENT_PAGE has {len(procurement_fallbacks)} fallback queries (expected 5+)")

    # Test CAREERS_PAGE fallbacks
    careers_fallbacks = FALLBACK_QUERIES[HopType.CAREERS_PAGE]
    assert '{entity} "procurement director" careers' in careers_fallbacks, \
        "CAREERS_PAGE should include 'procurement director' careers fallback"
    print(f"✅ CAREERS_PAGE has {len(careers_fallbacks)} fallback queries (expected 5+)")


def test_url_scoring():
    """Test URL scoring method (basic smoke test)"""
    print("\nTesting URL scoring method...")

    # Create a fake discovery instance to test _score_url method
    from hypothesis_driven_discovery import HypothesisDrivenDiscovery

    class FakeClaude:
        pass

    class FakeBrightData:
        pass

    discovery = HypothesisDrivenDiscovery(FakeClaude(), FakeBrightData())

    # Test high-value RFP URL
    score1 = discovery._score_url(
        url='https://arsenal.com/procurement/rfp-2024',
        hop_type=HopType.RFP_PAGE,
        entity_name='Arsenal FC',
        title='RFP Documents 2024',
        snippet='Official procurement documents and requirements'
    )
    assert score1 > 0.5, f"High-value RFP URL should score >0.5, got {score1}"
    print(f"✅ High-value RFP URL scored: {score1:.2f} (expected >0.5)")

    # Test low-value news URL
    score2 = discovery._score_url(
        url='https://arsenal.com/news/article-123',
        hop_type=HopType.RFP_PAGE,
        entity_name='Arsenal FC',
        title='Latest Match Results',
        snippet='Read about recent games'
    )
    assert score2 < 0.3, f"Low-value news URL should score <0.3, got {score2}"
    print(f"✅ Low-value news URL scored: {score2:.2f} (expected <0.3)")

    # Test procurement portal URL for TENDERS_PAGE
    score3 = discovery._score_url(
        url='https://arsenal.com/vendors/opportunities',
        hop_type=HopType.TENDERS_PAGE,
        entity_name='Arsenal FC',
        title='Vendor Registration Portal',
        snippet='Register as a supplier'
    )
    assert score3 > 0.4, f"Procurement portal URL should score >0.4, got {score3}"
    print(f"✅ Procurement portal URL scored: {score3:.2f} (expected >0.4)")


def main():
    """Run all tests"""
    print("="*60)
    print("BrightData SDK Optimization Tests")
    print("="*60)

    try:
        test_constants()
        test_fallback_queries()
        test_url_scoring()

        print("\n" + "="*60)
        print("✅ ALL TESTS PASSED")
        print("="*60)
        return 0
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        print("="*60)
        return 1
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        print("="*60)
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
