#!/usr/bin/env python3
"""
Test MCP Integration with Hypothesis-Driven Discovery

Validates that MCP evidence patterns, source priorities, and confidence scoring
are properly integrated into the hypothesis-driven discovery system.

Test cases:
1. MCP evidence pattern matching
2. MCP source priority scoring
3. MCP confidence calculation
4. Channel blacklist management
5. MCP-guided hop selection
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.taxonomy.mcp_evidence_patterns import (
    match_evidence_type,
    get_evidence_type,
    get_high_value_evidence_types,
    calculate_total_confidence,
    count_signals_by_type
)
from backend.sources.mcp_source_priorities import (
    MCP_SOURCE_PRIORITIES,
    get_source_config,
    map_evidence_to_source,
    ChannelBlacklist,
    calculate_channel_score,
    get_primary_sources,
    get_forbidden_sources
)
from backend.confidence.mcp_scorer import (
    MCPScorer,
    Signal,
    calculate_mcp_confidence_from_matches
)


def test_mcp_evidence_pattern_matching():
    """Test MCP evidence pattern matching"""
    print("\n=== Test 1: MCP Evidence Pattern Matching ===\n")

    test_cases = [
        {
            "content": "NTT Data multi-year partnership for digital transformation",
            "expected_type": "multi_year_partnership",
            "expected_signal": "ACCEPT",
            "min_confidence": 0.15
        },
        {
            "content": "Arsenal deploys customer experience systems (July 2025)",
            "expected_type": "recent_deployment",
            "expected_signal": "ACCEPT",
            "min_confidence": 0.12
        },
        {
            "content": "Arsenal uses SAP Hybris for e-commerce since 2017",
            "expected_type": "confirmed_platform",
            "expected_signal": "ACCEPT",
            "min_confidence": 0.10
        },
        {
            "content": "John Maguire - Head of Operational Technology",
            "expected_type": "technology_leadership",
            "expected_signal": "WEAK_ACCEPT",
            "min_confidence": 0.03
        },
        {
            "content": "Bespoke IBM CRM system installed in 2013",
            "expected_type": "legacy_system",
            "expected_signal": "WEAK_ACCEPT",
            "min_confidence": 0.02
        }
    ]

    passed = 0
    failed = 0

    for i, test in enumerate(test_cases, 1):
        print(f"Test Case {i}: {test['content'][:60]}...")
        matches = match_evidence_type(test['content'])

        if not matches:
            print(f"  ❌ FAIL: No matches found (expected {test['expected_type']})")
            failed += 1
            continue

        match = matches[0]
        type_match = match['type'] == test['expected_type']
        signal_match = match['signal'] == test['expected_signal']
        confidence_match = match['total_confidence'] >= test['min_confidence']

        if type_match and signal_match and confidence_match:
            print(f"  ✅ PASS: {match['type']} ({match['signal']}, +{match['total_confidence']:.2f})")
            passed += 1
        else:
            print(f"  ❌ FAIL:")
            print(f"     Type: {match['type']} vs {test['expected_type']} ({'✓' if type_match else '✗'})")
            print(f"     Signal: {match['signal']} vs {test['expected_signal']} ({'✓' if signal_match else '✗'})")
            print(f"     Confidence: {match['total_confidence']:.2f} vs {test['min_confidence']:.2f} ({'✓' if confidence_match else '✗'})")
            failed += 1

    print(f"\nTest 1 Results: {passed}/{len(test_cases)} passed")
    return passed == len(test_cases)


def test_mcp_source_priorities():
    """Test MCP source priority configuration"""
    print("\n=== Test 2: MCP Source Priorities ===\n")

    # Test primary sources
    primary = get_primary_sources()
    print(f"Primary sources (confidence >= 1.0): {len(primary)}")
    for source in primary:
        config = get_source_config(source)
        print(f"  • {source.value}: {config.confidence_multiplier}x, {config.productivity*100:.0f}% productivity")

    # Test forbidden sources
    forbidden = get_forbidden_sources()
    print(f"\nForbidden sources (confidence < 0.3): {len(forbidden)}")
    for source in forbidden:
        config = get_source_config(source)
        print(f"  • {source.value}: {config.confidence_multiplier}x - {config.notes}")

    # Test evidence → source mapping
    print("\nEvidence → Source mapping:")
    test_evidence_types = [
        "multi_year_partnership",
        "recent_deployment",
        "confirmed_platform",
        "technology_leadership",
        "legacy_system"
    ]

    for evidence_type in test_evidence_types:
        source = map_evidence_to_source(evidence_type)
        if source:
            config = get_source_config(source)
            print(f"  {evidence_type} → {source.value} ({config.confidence_multiplier}x)")
        else:
            print(f"  {evidence_type} → None (no mapping)")

    # Validate expected mappings
    expected_mappings = {
        "multi_year_partnership": "partnership_announcements",
        "recent_deployment": "tech_news_articles",
        "confirmed_platform": "press_releases",
        "technology_leadership": "leadership_job_postings",
        "legacy_system": "tech_news_articles"
    }

    passed = 0
    failed = 0

    for evidence_type, expected_source in expected_mappings.items():
        source = map_evidence_to_source(evidence_type)
        if source and source.value == expected_source:
            print(f"\n✅ {evidence_type} correctly maps to {expected_source}")
            passed += 1
        else:
            print(f"\n❌ {evidence_type} incorrectly maps to {source.value if source else None} (expected {expected_source})")
            failed += 1

    print(f"\nTest 2 Results: {passed}/{len(expected_mappings)} mappings correct")
    return failed == 0


def test_channel_blacklist():
    """Test channel blacklist management"""
    print("\n=== Test 3: Channel Blacklist Management ===\n")

    from backend.sources.mcp_source_priorities import SourceType

    blacklist = ChannelBlacklist()

    # Test failure tracking
    print("Testing failure tracking:")
    source = SourceType.LINKEDIN_JOBS_OPERATIONAL
    config = get_source_config(source)

    print(f"  Source: {source.value}")
    print(f"  Blacklist threshold: {config.blacklist_threshold}")

    for i in range(config.blacklist_threshold + 1):
        blacklist.record_failure(source)
        failures = blacklist.get_failure_count(source)
        exhaustion = blacklist.get_exhaustion_rate(source)
        is_blacklisted = blacklist.is_blacklisted(source)

        print(f"    Failure {i+1}: {failures} failures, {exhaustion:.2f} exhausted, blacklisted: {is_blacklisted}")

    # Validate blacklist behavior
    if blacklist.is_blacklisted(source):
        print(f"\n✅ PASS: {source.value} correctly blacklisted after {config.blacklist_threshold} failures")
    else:
        print(f"\n❌ FAIL: {source.value} not blacklisted after {config.blacklist_threshold} failures")
        return False

    # Test success tracking
    print("\nTesting success tracking:")
    source2 = SourceType.TECH_NEWS_ARTICLES
    blacklist.record_success(source2)

    # Success should not affect blacklist status
    if not blacklist.is_blacklisted(source2):
        print(f"✅ PASS: {source2.value} not blacklisted after success")
        return True
    else:
        print(f"❌ FAIL: {source2.value} incorrectly blacklisted after success")
        return False


def test_mcp_confidence_scoring():
    """Test MCP confidence calculation"""
    print("\n=== Test 4: MCP Confidence Scoring ===\n")

    scorer = MCPScorer()

    # Add Arsenal FC signals (should reach 0.90 confidence)
    print("Adding Arsenal FC signals:")

    scorer.add_signal(
        signal_type=Signal.ACCEPT,
        evidence_type="multi_year_partnership",
        evidence="NTT Data multi-year digital transformation partnership",
        metadata={"multi_year": True, "partner": "NTT Data"}
    )
    print("  1. Multi-year partnership (ACCEPT)")

    scorer.add_signal(
        signal_type=Signal.ACCEPT,
        evidence_type="recent_deployment",
        evidence="Arsenal deploys customer experience systems (July 2025)",
        metadata={"recent_months": 6, "deployment_date": "2025-07"}
    )
    print("  2. Recent deployment (ACCEPT)")

    scorer.add_signal(
        signal_type=Signal.ACCEPT,
        evidence_type="confirmed_platform",
        evidence="Arsenal uses SAP Hybris for e-commerce (since 2017)",
        metadata={"platform_age_years": 7, "platform": "SAP Hybris"}
    )
    print("  3. Confirmed platform (ACCEPT)")

    scorer.add_signal(
        signal_type=Signal.WEAK_ACCEPT,
        evidence_type="technology_leadership",
        evidence="John Maguire - Head of Operational Technology"
    )
    print("  4. Technology leadership (WEAK_ACCEPT)")

    scorer.add_signal(
        signal_type=Signal.WEAK_ACCEPT,
        evidence_type="legacy_system",
        evidence="Bespoke IBM CRM system installed (2013)",
        metadata={"platform_age_years": 12, "system": "IBM CRM"}
    )
    print("  5. Legacy system (WEAK_ACCEPT)")

    # Calculate confidence
    confidence = scorer.calculate_confidence()
    summary = scorer.get_signal_summary()

    print(f"\nConfidence Breakdown:")
    for component, value in summary['confidence_breakdown'].items():
        if component != 'total':
            print(f"  {component}: +{value:.2f}")

    print(f"\nTotal Confidence: {summary['confidence_breakdown']['total']:.2f}")
    print(f"Expected: 0.90")

    # Validate against expected
    expected = 0.90
    tolerance = 0.05

    if abs(confidence - expected) <= tolerance:
        print(f"\n✅ PASS: Confidence {confidence:.2f} within ±{tolerance} of expected {expected:.2f}")
        return True
    else:
        print(f"\n❌ FAIL: Confidence {confidence:.2f} outside ±{tolerance} of expected {expected:.2f}")
        return False


def test_channel_scoring():
    """Test MCP-guided channel scoring"""
    print("\n=== Test 5: MCP-Guided Channel Scoring ===\n")

    from backend.sources.mcp_source_priorities import SourceType

    blacklist = ChannelBlacklist()
    base_eig = 0.8  # Typical EIG score

    # Score all sources
    print(f"Scoring channels (base EIG: {base_eig:.2f}):\n")

    source_types = [
        SourceType.PARTNERSHIP_ANNOUNCEMENTS,
        SourceType.TECH_NEWS_ARTICLES,
        SourceType.PRESS_RELEASES,
        SourceType.LEADERSHIP_JOB_POSTINGS,
        SourceType.LINKEDIN_JOBS_OPERATIONAL,
        SourceType.OFFICIAL_SITE_HOMEPAGE,
        SourceType.APP_STORES
    ]

    scores = {}
    for source in source_types:
        score = calculate_channel_score(source, blacklist, base_eig)
        scores[source] = score
        config = get_source_config(source)

        print(f"  {source.value:30s}: {score:.3f} ({config.confidence_multiplier}x multiplier, {config.productivity*100:.0f}% productivity)")

    # Validate ordering
    sorted_sources = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    print(f"\nRanking:")
    for i, (source, score) in enumerate(sorted_sources, 1):
        print(f"  {i}. {source.value}: {score:.3f}")

    # Check that primary sources are ranked highest
    top_3 = [s for s, _ in sorted_sources[:3]]
    primary_count = sum(1 for s in top_3 if s in get_primary_sources())

    if primary_count >= 2:
        print(f"\n✅ PASS: Primary sources dominate top 3 ({primary_count}/3)")
        return True
    else:
        print(f"\n❌ FAIL: Primary sources underrepresented in top 3 ({primary_count}/3)")
        return False


def run_all_tests():
    """Run all MCP integration tests"""
    print("="*70)
    print("MCP INTEGRATION TEST SUITE")
    print("="*70)

    results = {}

    results['evidence_patterns'] = test_mcp_evidence_pattern_matching()
    results['source_priorities'] = test_mcp_source_priorities()
    results['channel_blacklist'] = test_channel_blacklist()
    results['confidence_scoring'] = test_mcp_confidence_scoring()
    results['channel_scoring'] = test_channel_scoring()

    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name.replace('_', ' ').title()}: {status}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
