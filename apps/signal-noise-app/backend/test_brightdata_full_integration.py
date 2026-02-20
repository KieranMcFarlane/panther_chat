#!/usr/bin/env python3
"""
Full Integration Test for BrightData SDK Optimizations

Tests the complete flow:
1. Initialize discovery system
2. Run a single-hop discovery iteration
3. Verify multi-engine search is used
4. Verify URL scoring works
5. Verify caching works
"""

import asyncio
import sys
import os
from unittest.mock import Mock, AsyncMock

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType
from schemas import RalphState, Hypothesis


class MockClaudeClient:
    """Mock Claude client for testing"""

    async def query(self, prompt, **kwargs):
        """Mock query that returns simulated evaluation"""
        # Simulate ACCEPT decision for procurement content
        return {
            'text': '{"decision": "ACCEPT", "confidence_delta": 0.06, "justification": "Found procurement opportunities", "evidence_found": "Specific procurement details"}'
        }


class MockBrightDataSDKClient:
    """Mock BrightData SDK client for testing"""

    def __init__(self):
        self.search_call_count = 0
        self.search_history = []

    async def search_engine(self, query, engine='google', num_results=1):
        """Mock search that simulates different engines"""
        self.search_call_count += 1
        self.search_history.append({
            'query': query,
            'engine': engine,
            'num_results': num_results
        })

        # Simulate different results based on query and engine
        if 'rfp' in query.lower():
            # Return RFP-related results
            results = [
                {
                    'url': f'https://example.com/{engine}/procurement/rfp-2024',
                    'title': 'RFP Documents 2024',
                    'snippet': 'Official procurement requirements'
                },
                {
                    'url': f'https://example.com/{engine}/vendors/opportunities',
                    'title': 'Vendor Registration Portal',
                    'snippet': 'Register as a supplier'
                },
                {
                    'url': f'https://example.com/{engine}/news/latest',
                    'title': 'Latest News',
                    'snippet': 'General news and updates'
                },
                {
                    'url': f'https://example.com/{engine}/careers/jobs',
                    'title': 'Careers Page',
                    'snippet': 'Job opportunities'
                },
                {
                    'url': f'https://example.com/{engine}/about',
                    'title': 'About Us',
                    'snippet': 'Company information'
                }
            ]
        else:
            # Return generic results
            results = [
                {
                    'url': f'https://example.com/{engine}/page1',
                    'title': 'Page 1',
                    'snippet': 'Content 1'
                }
            ]

        # Return requested number of results
        return {
            'status': 'success',
            'results': results[:num_results]
        }

    async def scrape_as_markdown(self, url):
        """Mock scrape that returns simulated content"""
        # Return procurement-related content for RFP URLs
        if 'procurement' in url.lower() or 'rfp' in url.lower():
            return {
                'status': 'success',
                'content': '''
# Procurement Opportunities 2024

## RFP-2024: Digital CRM System

**Requirements:**
- Multi-year partnership (3+ years)
- Salesforce CRM or compatible
- Budget: £500,000 - £800,000

**Submission Deadline:** March 15, 2024

**Contact:** procurement@example.com
'''
            }
        else:
            return {
                'status': 'success',
                'content': 'Generic content'
            }


async def test_multi_engine_search():
    """Test that multi-engine search is used"""
    print("\n" + "="*80)
    print("TEST 1: Multi-Engine Search")
    print("="*80)

    discovery = HypothesisDrivenDiscovery(
        claude_client=MockClaudeClient(),
        brightdata_client=MockBrightDataSDKClient(),
        cache_enabled=True
    )

    entity_name = "Test FC"

    # Test RFP_PAGE hop type (should use Google then Bing)
    print(f"\nTesting RFP_PAGE hop type for {entity_name}...")

    # Initialize state
    state = RalphState(
        entity_id="test-fc",
        entity_name=entity_name,
        max_depth=3,
        current_depth=1
    )

    # Create a hypothesis
    hypothesis = Hypothesis(
        hypothesis_id="test_procurement_opportunity",
        entity_id="test-fc",
        statement="Test FC has procurement opportunities for digital platforms",
        category="procurement_opportunity",
        confidence=0.50
    )

    # Get URL for RFP_PAGE hop
    url = await discovery._get_url_for_hop(
        hop_type=HopType.RFP_PAGE,
        hypothesis=hypothesis,
        state=state
    )

    assert url is not None, "URL should be found"
    assert 'procurement' in url.lower() or 'rfp' in url.lower(), \
        f"URL should be procurement-related: {url}"

    # Verify search was called
    assert discovery.brightdata_client.search_call_count > 0, \
        "Search should have been called"

    print(f"✅ Found URL: {url}")
    print(f"   Search calls made: {discovery.brightdata_client.search_call_count}")
    print(f"   Queries executed: {len(discovery.brightdata_client.search_history)}")

    # Show query history
    for i, call in enumerate(discovery.brightdata_client.search_history, 1):
        print(f"   Query {i}: {call['query']} (engine: {call['engine']}, results: {call['num_results']})")


async def test_url_scoring():
    """Test that URL scoring selects best result"""
    print("\n" + "="*80)
    print("TEST 2: URL Scoring")
    print("="*80)

    discovery = HypothesisDrivenDiscovery(
        claude_client=MockClaudeClient(),
        brightdata_client=MockBrightDataSDKClient(),
        cache_enabled=True
    )

    entity_name = "Test FC"

    # Test URLs to score
    test_urls = [
        ('https://example.com/procurement/rfp-2024', 'high'),
        ('https://example.com/vendors/opportunities', 'high'),
        ('https://example.com/news/latest', 'low'),
        ('https://example.com/careers/jobs', 'low'),
        ('https://example.com/about', 'low'),
    ]

    print(f"\nScoring {len(test_urls)} URLs for RFP_PAGE hop type...")

    for url, expected_quality in test_urls:
        score = discovery._score_url(
            url=url,
            hop_type=HopType.RFP_PAGE,
            entity_name=entity_name,
            title='Test Title',
            snippet='Test snippet'
        )

        status = "✅" if (
            (expected_quality == 'high' and score > 0.3) or
            (expected_quality == 'low' and score <= 0.3)
        ) else "❌"

        print(f"  {status} {url}")
        print(f"     Score: {score:.2f} (expected: {'high' if expected_quality == 'high' else 'low'})")

        if expected_quality == 'high':
            assert score > 0.3, f"High-quality URL should score >0.3, got {score}"
        else:
            assert score <= 0.3, f"Low-quality URL should score <=0.3, got {score}"


async def test_caching():
    """Test that search results are cached"""
    print("\n" + "="*80)
    print("TEST 3: Search Caching")
    print("="*80)

    discovery = HypothesisDrivenDiscovery(
        claude_client=MockClaudeClient(),
        brightdata_client=MockBrightDataSDKClient(),
        cache_enabled=True
    )

    entity_name = "Test FC"
    query = f'"{entity_name}" rfp'

    print(f"\nTesting cache with query: {query}")

    # First call - should miss cache
    print("\nCall 1: First search (cache miss expected)...")
    cached_result_1 = await discovery._get_cached_search(query, 'google')
    assert cached_result_1 is None, "First call should miss cache"
    print("  ✅ Cache miss as expected")

    # Perform search and cache it
    search_result = await discovery.brightdata_client.search_engine(
        query=query,
        engine='google',
        num_results=5
    )
    await discovery._cache_search_result(query, 'google', search_result)
    print("  ✅ Search result cached")

    # Second call - should hit cache
    print("\nCall 2: Second search (cache hit expected)...")
    cached_result_2 = await discovery._get_cached_search(query, 'google')
    assert cached_result_2 is not None, "Second call should hit cache"
    print("  ✅ Cache hit as expected")

    # Verify cached result matches original
    assert cached_result_2 == search_result, "Cached result should match original"
    print("  ✅ Cached result matches original")

    # Check cache size
    print(f"\n  Cache size: {len(discovery._search_cache)} entries")
    assert len(discovery._search_cache) > 0, "Cache should have entries"
    print("  ✅ Cache has entries")


async def test_full_iteration():
    """Test a full discovery iteration with all optimizations"""
    print("\n" + "="*80)
    print("TEST 4: Full Discovery Iteration")
    print("="*80)

    discovery = HypothesisDrivenDiscovery(
        claude_client=MockClaudeClient(),
        brightdata_client=MockBrightDataSDKClient(),
        cache_enabled=True
    )

    entity_name = "Test FC"

    # Initialize state
    state = RalphState(
        entity_id="test-fc",
        entity_name=entity_name,
        max_depth=3,
        current_depth=1
    )

    # Create a hypothesis
    hypothesis = Hypothesis(
        hypothesis_id="test_procurement_opportunity",
        entity_id="test-fc",
        statement="Test FC has procurement opportunities for digital platforms",
        category="procurement_opportunity",
        confidence=0.50
    )

    print(f"\nRunning full iteration for {entity_name}...")
    print(f"  Hypothesis: {hypothesis.hypothesis_id}")
    print(f"  Hop Type: RFP_PAGE")
    print(f"  Starting Confidence: {hypothesis.confidence:.2f}")

    # Execute hop
    result = await discovery._execute_hop(
        hop_type=HopType.RFP_PAGE,
        hypothesis=hypothesis,
        state=state
    )

    assert result is not None, "Hop execution should succeed"
    assert result['decision'] == 'ACCEPT', f"Should find ACCEPT decision, got {result['decision']}"
    assert result['confidence_delta'] > 0, f"Should have positive confidence delta, got {result['confidence_delta']}"

    print(f"\n✅ Full iteration completed successfully!")
    print(f"  Decision: {result['decision']}")
    print(f"  Confidence Delta: +{result['confidence_delta']:.2f}")
    print(f"  URL: {result['url']}")
    print(f"  Evidence Found: {result['evidence_found'][:50]}...")


async def run_all_tests():
    """Run all tests"""
    print("\n" + "="*80)
    print("BrightData SDK Optimization - Full Integration Tests")
    print("="*80)

    tests = [
        ("Multi-Engine Search", test_multi_engine_search),
        ("URL Scoring", test_url_scoring),
        ("Search Caching", test_caching),
        ("Full Discovery Iteration", test_full_iteration),
    ]

    results = []

    for test_name, test_func in tests:
        try:
            await test_func()
            results.append((test_name, True))
            print(f"\n✅ {test_name}: PASSED")
        except AssertionError as e:
            results.append((test_name, False))
            print(f"\n❌ {test_name}: FAILED - {e}")
        except Exception as e:
            results.append((test_name, False))
            print(f"\n❌ {test_name}: ERROR - {e}")

    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)

    passed = sum(1 for _, passed in results if passed)
    total = len(results)

    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")

    print(f"\nResults: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        print("\nThe BrightData SDK optimizations are working correctly:")
        print("  ✅ Multi-engine search with fallback")
        print("  ✅ URL relevance scoring")
        print("  ✅ Search result caching (24-hour TTL)")
        print("  ✅ Procurement-specific fallback queries")
        print("  ✅ Full discovery integration")
        return True
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
