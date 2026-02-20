#!/usr/bin/env python3
"""
Test Structured Context Builder for Claude Evaluation

This test verifies that the EvaluationContext dataclass and
_build_evaluation_context() method work correctly.
"""

import asyncio
import logging
from datetime import datetime, timezone

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_context_builder():
    """Test the context builder with mock hypothesis"""
    from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType, EvaluationContext
    from hypothesis_manager import Hypothesis

    # Create mock hypothesis
    hypothesis = Hypothesis(
        hypothesis_id="test_multi_year_partnership",
        entity_id="test-entity",
        category="Partnerships",
        statement="Test Entity is preparing procurement related to multi_year_partnership",
        prior_probability=0.15,
        confidence=0.45,
        iterations_attempted=3,
        iterations_accepted=1,
        iterations_weak_accept=1,
        iterations_no_progress=1,
        last_delta=0.05,  # >= 0.04 for ACCEPT
        metadata={
            'pattern_name': 'multi_year_partnership',
            'template_id': 'tier_1_club_centralized_procurement',
            'entity_name': 'Test Entity FC',
            'early_indicators': [
                "Press release: 'multi-year partnership'",
                "Official site: 'strategic partnership announcement'"
            ],
            'keywords': ['multi-year', 'partnership', 'strategic partnership'],
            'category': 'Partnerships'
        }
    )

    # Create a mock discovery instance (we only need the context builder method)
    class MockDiscovery:
        pass

    # Import the builder function
    from hypothesis_driven_discovery import HypothesisDrivenDiscovery

    # Create instance with None clients (we're only testing the builder)
    discovery = HypothesisDrivenDiscovery(
        claude_client=None,
        brightdata_client=None,
        cache_enabled=False
    )

    # Test building context
    logger.info("Testing _build_evaluation_context()...")

    context = discovery._build_evaluation_context(
        hypothesis=hypothesis,
        hop_type=HopType.PRESS_RELEASE,
        content="Sample content for testing",
        entity_name="Test Entity FC"
    )

    # Verify all fields are populated
    assert isinstance(context, EvaluationContext), "Context should be EvaluationContext instance"
    assert context.hypothesis_statement == hypothesis.statement, "Statement mismatch"
    assert context.hypothesis_category == "Partnerships", "Category mismatch"
    assert context.pattern_name == "multi_year_partnership", "Pattern name mismatch"
    assert len(context.early_indicators) >= 2, f"Expected at least 2 early indicators, got {len(context.early_indicators)}"
    assert len(context.keywords) >= 3, f"Expected at least 3 keywords, got {len(context.keywords)}"
    assert context.current_confidence == 0.45, f"Confidence mismatch: {context.current_confidence}"
    assert context.iterations_attempted == 3, f"Iterations mismatch: {context.iterations_attempted}"
    assert context.last_decision == "ACCEPT", f"Last decision should be ACCEPT, got {context.last_decision}"
    assert len(context.recent_history) == 3, f"Expected 3 history items, got {len(context.recent_history)}"
    assert context.hop_type == HopType.PRESS_RELEASE, "Hop type mismatch"
    assert len(context.channel_guidance) > 0, "Channel guidance should not be empty"
    assert context.entity_name == "Test Entity FC", "Entity name mismatch"
    assert context.min_evidence_strength == "specific_detail", "Evidence strength mismatch"
    assert context.temporal_requirements == "last_12_months", "Temporal requirements mismatch"

    # Test formatting helper
    formatted = discovery._format_early_indicators(context.early_indicators)
    assert "Press release: 'multi-year partnership'" in formatted, "Early indicator not formatted"

    # Test fallback result
    fallback = discovery._fallback_result()
    assert fallback['decision'] == 'NO_PROGRESS', "Fallback decision should be NO_PROGRESS"
    assert fallback['confidence_delta'] == 0.0, "Fallback delta should be 0.0"

    logger.info("✅ All context builder tests passed!")

    # Print sample context for inspection
    print("\n=== Sample EvaluationContext ===")
    print(f"Hypothesis: {context.hypothesis_statement}")
    print(f"Pattern: {context.pattern_name}")
    print(f"Category: {context.hypothesis_category}")
    print(f"Current Confidence: {context.current_confidence:.2f}")
    print(f"Iterations: {context.iterations_attempted}")
    print(f"Last Decision: {context.last_decision}")
    print(f"History: {', '.join(context.recent_history)}")
    print(f"Channel: {context.hop_type.value}")
    print(f"Early Indicators ({len(context.early_indicators)}):")
    for indicator in context.early_indicators:
        print(f"  - {indicator}")
    print(f"Keywords: {', '.join(context.keywords)}")
    print(f"\nChannel Guidance:\n{context.channel_guidance}")
    print(f"\nEvidence Requirements: {context.min_evidence_strength}, {context.temporal_requirements}")


if __name__ == "__main__":
    asyncio.run(test_context_builder())
