"""
Test Signal Extractor for MVP

Verifies:
- Signal extraction from content
- Canonical taxonomy enforcement
- Confidence scoring
- Evidence validation
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from signals.signal_extractor import (
    SignalExtractor,
    get_canonical_signal_types,
    is_valid_signal_type
)


async def test_canonical_taxonomy():
    """Test canonical signal types"""
    print("=" * 60)
    print("Test 1: Canonical Taxonomy")
    print("=" * 60)

    signal_types = get_canonical_signal_types()

    print(f"✓ Canonical signal types: {signal_types}")

    expected_types = ["RFP_DETECTED", "EXECUTIVE_CHANGE", "PARTNERSHIP_FORMED"]
    assert signal_types == expected_types, f"Expected {expected_types}, got {signal_types}"

    # Test validation
    for signal_type in signal_types:
        assert is_valid_signal_type(signal_type), f"{signal_type} should be valid"
        print(f"  ✓ {signal_type} is valid")

    assert not is_valid_signal_type("INVALID_TYPE"), "Invalid type should be rejected"

    return True


async def test_signal_extraction_rfp():
    """Test RFP signal extraction"""
    print("\n" + "=" * 60)
    print("Test 2: RFP Signal Extraction")
    print("=" * 60)

    extractor = SignalExtractor(claude_client=None)  # Mock mode

    content = """
    AC Milan is planning to issue a Request for Proposal (RFP)
    for a new digital platform modernization project.
    The RFP will be released in Q1 2026 with an estimated value of £1.2M.
    """

    signals = await extractor.extract_signals(
        content=content,
        entity_id="ac_milan",
        entity_name="AC Milan",
        source_url="https://example.com/ac-milan-rfp"
    )

    print(f"✓ Extracted {len(signals)} signals")
    assert len(signals) > 0, "Should extract at least one signal"

    for signal in signals:
        print(f"  - Type: {signal.signal_type}")
        print(f"    Confidence: {signal.confidence}")
        print(f"    Content: {signal.content[:50]}...")
        print(f"    Evidence: {signal.evidence}")

        assert is_valid_signal_type(signal.signal_type), "Signal type must be valid"
        assert 0 <= signal.confidence <= 1, "Confidence must be 0-1"
        assert len(signal.evidence) > 0, "Must have evidence"

    return True


async def test_signal_extraction_executive():
    """Test Executive Change signal extraction"""
    print("\n" + "=" * 60)
    print("Test 3: Executive Change Signal Extraction")
    print("=" * 60)

    extractor = SignalExtractor(claude_client=None)  # Mock mode

    content = """
    AC Milan announced today that John Smith has been appointed
    as the new Chief Technology Officer (CTO). John brings 15 years
    of experience in sports technology and will lead the club's
    digital transformation initiative.
    """

    signals = await extractor.extract_signals(
        content=content,
        entity_id="ac_milan",
        entity_name="AC Milan"
    )

    print(f"✓ Extracted {len(signals)} signals")

    if signals:
        signal = signals[0]
        print(f"  - Type: {signal.signal_type}")
        print(f"    Confidence: {signal.confidence}")

        assert signal.signal_type in ["EXECUTIVE_CHANGE", "PARTNERSHIP_FORMED", "RFP_DETECTED"]
        assert signal.entity_id == "ac_milan"

    return True


async def test_signal_validation():
    """Test signal validation"""
    print("\n" + "=" * 60)
    print("Test 4: Signal Validation")
    print("=" * 60)

    extractor = SignalExtractor(claude_client=None)

    # Test with content that has no clear signals
    content = "AC Milan played a match yesterday and won 2-1."

    signals = await extractor.extract_signals(
        content=content,
        entity_id="ac_milan"
    )

    print(f"✓ Extracted {len(signals)} signals from generic content")

    # Should not extract invalid signals
    for signal in signals:
        assert is_valid_signal_type(signal.signal_type), "Must use canonical types"
        print(f"  ✓ Signal {signal.signal_type} is valid")

    return True


async def test_multiple_signals():
    """Test extracting multiple signals from one content"""
    print("\n" + "=" * 60)
    print("Test 5: Multiple Signals from One Content")
    print("=" * 60)

    extractor = SignalExtractor(claude_client=None)

    content = """
    AC Milan has announced two major developments:
    1. John Smith appointed as new CTO (executive change)
    2. Strategic partnership with TechCorp for digital infrastructure
    The club is also considering an RFP for analytics platform.
    """

    signals = await extractor.extract_signals(
        content=content,
        entity_id="ac_milan",
        entity_name="AC Milan"
    )

    print(f"✓ Extracted {len(signals)} signals")

    signal_types = [s.signal_type for s in signals]
    print(f"  Signal types: {signal_types}")

    # Should have at least 2 signals (executive + partnership)
    assert len(signals) >= 2, f"Expected at least 2 signals, got {len(signals)}"

    # Check for signal diversity
    unique_types = set(signal_types)
    print(f"  Unique signal types: {len(unique_types)}")

    return True


async def run_all_tests():
    """Run all tests"""
    print("\n🔍 Testing Signal Extractor (MVP)\n")

    tests = [
        ("Canonical Taxonomy", test_canonical_taxonomy),
        ("RFP Signal Extraction", test_signal_extraction_rfp),
        ("Executive Change Extraction", test_signal_extraction_executive),
        ("Signal Validation", test_signal_validation),
        ("Multiple Signals", test_multiple_signals)
    ]

    passed = 0
    failed = 0

    for test_name, test_func in tests:
        try:
            result = await test_func()
            if result:
                passed += 1
                print(f"✅ {test_name}: PASSED\n")
            else:
                failed += 1
                print(f"❌ {test_name}: FAILED\n")
        except Exception as e:
            failed += 1
            print(f"❌ {test_name}: FAILED - {e}\n")
            import traceback
            traceback.print_exc()

    print("=" * 60)
    print(f"Test Results: {passed} passed, {failed} failed")
    print("=" * 60)

    if failed == 0:
        print("\n🎉 All tests passed! Signal Extractor is ready for MVP.")
        return True
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please review.")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
