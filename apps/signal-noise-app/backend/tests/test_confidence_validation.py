#!/usr/bin/env python3
"""
Unit tests for Ralph Loop confidence validation feature

Tests Claude's ability to assess and adjust scraper-assigned confidence scores
based on evidence quality.
"""

import pytest
import sys
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas import Signal, SignalType, ConfidenceValidation
from ralph_loop import RalphLoop, RalphLoopConfig


@pytest.fixture
def mock_claude_client():
    """Mock Claude client"""
    mock = AsyncMock()
    return mock


@pytest.fixture
def mock_graphiti_service():
    """Mock Graphiti service"""
    mock = AsyncMock()
    mock.find_related_signals = AsyncMock(return_value=[])
    mock.upsert_signal = AsyncMock()
    return mock


@pytest.fixture
def ralph_loop(mock_claude_client, mock_graphiti_service):
    """Create RalphLoop instance with confidence validation enabled"""
    config = RalphLoopConfig(
        enable_confidence_validation=True,
        max_confidence_adjustment=0.15,
        confidence_review_threshold=0.2
    )
    return RalphLoop(mock_claude_client, mock_graphiti_service, config)


@pytest.mark.asyncio
async def test_confidence_adjusted_down(ralph_loop, mock_claude_client):
    """Test Claude reduces overconfident scores when evidence is weak"""
    signal = Signal(
        id="test-overconfident",
        type=SignalType.RFP_DETECTED,
        confidence=0.95,  # Too high for weak evidence
        entity_id="test-entity",
        first_seen=datetime.now(timezone.utc),
        metadata={
            'evidence': [
                {"source": "Blog", "credibility_score": 0.3, "date": "2026-01-27"},
                {"source": "Forum", "credibility_score": 0.2, "date": "2026-01-27"},
                {"source": "Tweet", "credibility_score": 0.1, "date": "2026-01-27"}
            ]
        }
    )

    # Mock Claude response with adjusted confidence
    mock_claude_client.query.return_value = '''
    {
      "validated": [
        {
          "signal_id": "test-overconfident",
          "original_confidence": 0.95,
          "validated_confidence": 0.80,
          "confidence_rationale": "Low credibility sources (avg 0.2), reducing confidence to match evidence quality",
          "requires_manual_review": false
        }
      ],
      "rejected": []
    }
    '''

    validated = await ralph_loop._pass2_claude_validation([signal], "test-entity")

    assert len(validated) == 1
    assert validated[0].confidence == 0.80
    assert validated[0].confidence_validation.original_confidence == 0.95
    assert abs(validated[0].confidence_validation.adjustment - (-0.15)) < 0.01
    assert "Low credibility" in validated[0].confidence_validation.rationale
    assert validated[0].confidence_validation.requires_manual_review == False


@pytest.mark.asyncio
async def test_confidence_no_adjustment(ralph_loop, mock_claude_client):
    """Test Claude leaves appropriate confidence unchanged"""
    signal = Signal(
        id="test-appropriate",
        type=SignalType.RFP_DETECTED,
        confidence=0.85,  # Appropriate for evidence quality
        entity_id="test-entity",
        first_seen=datetime.now(timezone.utc),
        metadata={
            'evidence': [
                {"source": "Official Press Release", "credibility_score": 0.95, "date": "2026-01-27"},
                {"source": "LinkedIn Company Page", "credibility_score": 0.9, "date": "2026-01-27"},
                {"source": "News Article", "credibility_score": 0.8, "date": "2026-01-27"}
            ]
        }
    )

    # Mock Claude response with no adjustment
    mock_claude_client.query.return_value = '''
    {
      "validated": [
        {
          "signal_id": "test-appropriate",
          "original_confidence": 0.85,
          "validated_confidence": 0.85,
          "confidence_rationale": "Confidence aligns well with high-credibility evidence, no adjustment needed",
          "requires_manual_review": false
        }
      ],
      "rejected": []
    }
    '''

    validated = await ralph_loop._pass2_claude_validation([signal], "test-entity")

    assert len(validated) == 1
    assert validated[0].confidence == 0.85
    assert validated[0].confidence_validation.adjustment == 0.0


@pytest.mark.asyncio
async def test_confidence_adjusted_up(ralph_loop, mock_claude_client):
    """Test Claude increases underconfident scores when evidence is strong"""
    signal = Signal(
        id="test-underconfident",
        type=SignalType.RFP_DETECTED,
        confidence=0.70,  # Too low for strong evidence
        entity_id="test-entity",
        first_seen=datetime.now(timezone.utc),
        metadata={
            'evidence': [
                {"source": "Official Statement", "credibility_score": 1.0, "date": "2026-01-27"},
                {"source": "SEC Filing", "credibility_score": 1.0, "date": "2026-01-27"},
                {"source": "Press Release", "credibility_score": 0.95, "date": "2026-01-27"}
            ]
        }
    )

    # Mock Claude response with increased confidence
    mock_claude_client.query.return_value = '''
    {
      "validated": [
        {
          "signal_id": "test-underconfident",
          "original_confidence": 0.70,
          "validated_confidence": 0.85,
          "confidence_rationale": "Multiple official sources with highest credibility, increasing confidence",
          "requires_manual_review": false
        }
      ],
      "rejected": []
    }
    '''

    validated = await ralph_loop._pass2_claude_validation([signal], "test-entity")

    assert len(validated) == 1
    assert validated[0].confidence == 0.85
    assert abs(validated[0].confidence_validation.adjustment - 0.15) < 0.01


@pytest.mark.asyncio
async def test_confidence_flagged_for_review(ralph_loop, mock_claude_client):
    """Test large adjustments trigger manual review flag"""
    signal = Signal(
        id="test-extreme",
        type=SignalType.RFP_DETECTED,
        confidence=0.95,  # Very overconfident
        entity_id="test-entity",
        first_seen=datetime.now(timezone.utc),
        metadata={
            'evidence': [
                {"source": "Rumor Blog", "credibility_score": 0.1, "date": "2026-01-27"},
                {"source": "Unverified Forum", "credibility_score": 0.1, "date": "2026-01-27"},
                {"source": "Anonymous Tweet", "credibility_score": 0.1, "date": "2026-01-27"}
            ]
        }
    )

    # Mock Claude response with large adjustment and review flag
    mock_claude_client.query.return_value = '''
    {
      "validated": [
        {
          "signal_id": "test-extreme",
          "original_confidence": 0.95,
          "validated_confidence": 0.70,
          "confidence_rationale": "Extreme mismatch between confidence and very weak evidence, requires human review",
          "requires_manual_review": true
        }
      ],
      "rejected": []
    }
    '''

    validated = await ralph_loop._pass2_claude_validation([signal], "test-entity")

    assert len(validated) == 1
    assert validated[0].confidence_validation.requires_manual_review == True
    assert abs(validated[0].confidence_validation.adjustment - (-0.25)) < 0.01


@pytest.mark.asyncio
async def test_confidence_validation_disabled():
    """Test confidence validation can be disabled via config"""
    config = RalphLoopConfig(enable_confidence_validation=False)
    mock_claude = AsyncMock()
    mock_graphiti = AsyncMock()

    ralph = RalphLoop(mock_claude, mock_graphiti, config)

    signal = Signal(
        id="test-disabled",
        type=SignalType.RFP_DETECTED,
        confidence=0.95,
        entity_id="test-entity",
        first_seen=datetime.now(timezone.utc)
    )

    # Mock Claude response without confidence fields
    mock_claude.query.return_value = '''
    {
      "validated": ["test-disabled"],
      "rejected": []
    }
    '''

    validated = await ralph._pass2_claude_validation([signal], "test-entity")

    assert len(validated) == 1
    assert validated[0].confidence == 0.95  # Unchanged
    assert validated[0].confidence_validation is None  # No validation object


@pytest.mark.asyncio
async def test_multiple_signals_confidence_validation(ralph_loop, mock_claude_client):
    """Test confidence validation across multiple signals"""
    signals = [
        Signal(
            id="signal-1",
            type=SignalType.RFP_DETECTED,
            confidence=0.95,
            entity_id="test-entity",
            first_seen=datetime.now(timezone.utc),
            metadata={'evidence': [{"source": "Weak", "credibility_score": 0.2}]}
        ),
        Signal(
            id="signal-2",
            type=SignalType.RFP_DETECTED,
            confidence=0.85,
            entity_id="test-entity",
            first_seen=datetime.now(timezone.utc),
            metadata={'evidence': [{"source": "Strong", "credibility_score": 0.9}]}
        ),
        Signal(
            id="signal-3",
            type=SignalType.PARTNERSHIP_FORMED,
            confidence=0.5,  # Below threshold, should be rejected
            entity_id="test-entity",
            first_seen=datetime.now(timezone.utc)
        )
    ]

    # Mock Claude response
    mock_claude_client.query.return_value = '''
    {
      "validated": [
        {
          "signal_id": "signal-1",
          "original_confidence": 0.95,
          "validated_confidence": 0.80,
          "confidence_rationale": "Reducing due to weak evidence",
          "requires_manual_review": false
        },
        {
          "signal_id": "signal-2",
          "original_confidence": 0.85,
          "validated_confidence": 0.85,
          "confidence_rationale": "Confidence appropriate for evidence quality",
          "requires_manual_review": false
        }
      ],
      "rejected": [
        {
          "signal_id": "signal-3",
          "reason": "Confidence too low for validation threshold"
        }
      ]
    }
    '''

    validated = await ralph_loop._pass2_claude_validation(signals, "test-entity")

    assert len(validated) == 2
    assert validated[0].id == "signal-1"
    assert validated[0].confidence == 0.80
    assert validated[1].id == "signal-2"
    assert validated[1].confidence == 0.85


@pytest.mark.asyncio
async def test_evidence_formatting_for_claude(ralph_loop):
    """Test evidence formatting includes credibility details"""
    evidence = [
        {
            "source": "LinkedIn",
            "credibility_score": 0.8,
            "date": "2026-01-27",
            "url": "https://linkedin.com/job/123",
            "extracted_text": "Looking for AI platform"
        },
        {
            "source": "Crunchbase",
            "credibility_score": 0.9,
            "date": "2026-01-26",
            "url": "https://crunchbase.com/xyz"
        }
    ]

    formatted = ralph_loop._format_evidence_for_claude(evidence)

    assert "LinkedIn" in formatted
    assert "0.80" in formatted
    assert "2026-01-27" in formatted
    assert "https://linkedin.com/job/123" in formatted
    assert "Looking for AI platform" in formatted
    assert "Crunchbase" in formatted


def test_confidence_validation_to_dict():
    """Test ConfidenceValidation serialization"""
    validation = ConfidenceValidation(
        original_confidence=0.95,
        validated_confidence=0.80,
        adjustment=-0.15,
        rationale="Weak evidence",
        requires_manual_review=False
    )

    result = validation.to_dict()

    assert result['original_confidence'] == 0.95
    assert result['validated_confidence'] == 0.80
    assert result['adjustment'] == -0.15
    assert result['rationale'] == "Weak evidence"
    assert result['requires_manual_review'] == False
    assert 'validation_timestamp' in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
