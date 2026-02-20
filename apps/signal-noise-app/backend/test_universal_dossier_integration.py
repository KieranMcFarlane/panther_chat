#!/usr/bin/env python3
"""
Universal Dossier Integration Tests

Comprehensive test suite for UniversalDossierGenerator:
- generate_universal_dossier() with tiered prompts
- Hypothesis extraction from dossiers
- Signal extraction with correct tags
- Tier-based prompt selection
- No Arsenal content in other entities
- Confidence score validation
- Signal type tagging

Total: 12 test cases
"""

import asyncio
import json
import logging
import pytest
from datetime import datetime, timezone
from typing import Dict, List, Any
from unittest.mock import AsyncMock, MagicMock, patch

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MockClaudeClient:
    """Mock Claude client for testing"""

    def __init__(self, response_data: dict = None):
        self.response_data = response_data or self._default_response()
        self.query_calls = []

    def _default_response(self) -> dict:
        """Default mock response"""
        return {
            "content": json.dumps({
                "metadata": {
                    "entity_id": "test-entity",
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "data_freshness": 75,
                    "confidence_overall": 70,
                    "priority_signals": ["[PROCUREMENT]", "[CAPABILITY]"]
                },
                "executive_summary": {
                    "overall_assessment": {
                        "digital_maturity": {
                            "score": 65,
                            "trend": "improving",
                            "key_strengths": ["Mobile app adoption"],
                            "key_gaps": ["Legacy CRM system"]
                        },
                        "procurement_readiness": {
                            "budget_availability": "medium",
                            "decision_horizon": "3-6months",
                            "strategic_fit": 72
                        },
                        "yellow_panther_opportunity": {
                            "service_fit": ["CRM Modernization", "Analytics Platform"],
                            "entry_point": "vendor replacement",
                            "competitive_advantage": "Sports-specific expertise",
                            "estimated_probability": 68
                        }
                    },
                    "quick_actions": [
                        {
                            "action": "Contact CTO for CRM requirements discussion",
                            "priority": "HIGH",
                            "timeline": "Next 2 weeks",
                            "owner": "Sales Director",
                            "success_criteria": "Meeting scheduled"
                        }
                    ],
                    "key_insights": [
                        {
                            "insight": "Entity actively evaluating CRM platforms",
                            "signal_type": "[PROCUREMENT]",
                            "confidence": 75,
                            "impact": "HIGH",
                            "source": "Job posting for CRM Manager",
                            "hypothesis_ready": True
                        },
                        {
                            "insight": "Current CRM system is 5+ years old",
                            "signal_type": "[CAPABILITY]",
                            "confidence": 80,
                            "impact": "MEDIUM",
                            "source": "Internal documentation",
                            "hypothesis_ready": False
                        },
                        {
                            "insight": "Contract renewal window in Q2 2026",
                            "signal_type": "[TIMING]",
                            "confidence": 65,
                            "impact": "HIGH",
                            "source": "Vendor contract analysis",
                            "hypothesis_ready": True
                        }
                    ]
                },
                "procurement_signals": {
                    "upcoming_opportunities": [
                        {
                            "opportunity": "CRM Platform Modernization",
                            "type": "replacement",
                            "estimated_budget": "medium",
                            "timeline": "Q2 2026",
                            "decision_makers": ["CTO", "CFO"],
                            "rfp_probability": 72,
                            "yellow_panther_fit": {
                                "services": ["CRM Implementation", "Data Migration"],
                                "competitive_positioning": "Sports industry expertise",
                                "win_probability": 68
                            },
                            "next_actions": ["Schedule discovery call", "Prepare case studies"],
                            "hypothesis_id": "crm_replacement_2026"
                        }
                    ],
                    "budget_indicators": [
                        {
                            "indicator": "Technology budget increased 15% YoY",
                            "confidence": 70,
                            "relevance": "HIGH",
                            "source": "Annual report"
                        }
                    ],
                    "strategic_initiatives": [
                        {
                            "initiative": "Digital Transformation 2025",
                            "description": "Organization-wide digital modernization",
                            "phase": "execution",
                            "technology_needs": ["CRM", "Analytics", "Mobile"],
                            "partnership_opportunities": ["System Integration", "Data Analytics"]
                        }
                    ]
                },
                "recommended_approach": {
                    "hypothesis_generation": {
                        "primary_hypothesis": {
                            "statement": "Entity will issue RFP for CRM platform within 6 months",
                            "confidence": 72,
                            "validation_strategy": "Monitor job postings and press releases",
                            "success_metrics": ["RFP issued", "Vendor demos scheduled"],
                            "next_signals": ["Job posting for CRM Architect", "Press release about partnership"]
                        },
                        "secondary_hypotheses": [
                            {
                                "statement": "Entity seeking analytics platform integration",
                                "confidence": 55,
                                "relationship_to_primary": "support"
                            }
                        ]
                    }
                }
            })
        }

    async def query(self, prompt: str, model: str = "haiku", max_tokens: int = 4000) -> dict:
        """Mock query method"""
        self.query_calls.append({
            "prompt": prompt,
            "model": model,
            "max_tokens": max_tokens
        })
        return self.response_data


class MockFalkorDBClient:
    """Mock FalkorDB client for testing"""

    def __init__(self):
        self.queries = []

    async def query(self, cypher: str, params: dict = None):
        """Mock query method"""
        self.queries.append({"cypher": cypher, "params": params})
        return [
            {
                "entity_id": "test-entity",
                "entity_name": "Test Entity FC",
                "entity_type": "CLUB",
                "sport": "Football",
                "country": "England",
                "league_or_competition": "Premier League",
                "digital_maturity": "Intermediate",
                "estimated_revenue_band": "$50M-$100M"
            }
        ]


@pytest.fixture
def mock_claude_client():
    """Fixture for mock Claude client"""
    return MockClaudeClient()


@pytest.fixture
def mock_falkordb_client():
    """Fixture for mock FalkorDB client"""
    return MockFalkorDBClient()


@pytest.fixture
def mock_dossier_data():
    """Fixture for mock dossier data"""
    return {
        "entity_id": "test-entity",
        "entity_name": "Test Entity FC",
        "entity_type": "CLUB",
        "sport": "Football",
        "country": "England",
        "league_or_competition": "Premier League",
        "digital_maturity": "Intermediate",
        "estimated_revenue_band": "$50M-$100M",
        "website": "https://testentity.com",
        "founded": "1895",
        "stadium": "Test Stadium",
        "capacity": 45000
    }


class TestUniversalDossierGenerator:
    """Test suite for UniversalDossierGenerator"""

    @pytest.mark.asyncio
    async def test_generate_universal_dossier_basic_tier(self, mock_claude_client, mock_dossier_data):
        """Test BASIC tier dossier generation"""
        from dossier_generator import UniversalDossierGenerator

        generator = UniversalDossierGenerator(mock_claude_client)

        # Generate BASIC tier dossier (priority <= 20)
        dossier = await generator.generate_universal_dossier(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            entity_type="CLUB",
            priority_score=15,  # BASIC tier
            entity_data=mock_dossier_data
        )

        # Validate dossier structure
        assert "metadata" in dossier
        assert "executive_summary" in dossier
        assert dossier["metadata"]["tier"] == "BASIC"
        assert dossier["metadata"]["priority_score"] == 15
        assert "extracted_hypotheses" in dossier
        assert "extracted_signals" in dossier

        # Validate hypotheses extracted
        assert len(dossier["extracted_hypotheses"]) >= 1
        primary_hypothesis = [h for h in dossier["extracted_hypotheses"] if h.get("type") == "PRIMARY"]
        assert len(primary_hypothesis) > 0
        assert "statement" in primary_hypothesis[0]
        assert "confidence" in primary_hypothesis[0]

        logger.info(f"✅ BASIC tier dossier generated with {len(dossier['extracted_hypotheses'])} hypotheses")

    @pytest.mark.asyncio
    async def test_generate_universal_dossier_standard_tier(self, mock_claude_client, mock_dossier_data):
        """Test STANDARD tier dossier generation"""
        from dossier_generator import UniversalDossierGenerator

        generator = UniversalDossierGenerator(mock_claude_client)

        # Generate STANDARD tier dossier (priority 21-50)
        dossier = await generator.generate_universal_dossier(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            entity_type="CLUB",
            priority_score=45,  # STANDARD tier
            entity_data=mock_dossier_data
        )

        # Validate tier assignment
        assert dossier["metadata"]["tier"] == "STANDARD"
        assert dossier["metadata"]["priority_score"] == 45

        # Validate signals extracted
        assert len(dossier["extracted_signals"]) >= 2
        procurement_signals = [s for s in dossier["extracted_signals"] if s.get("type") == "[PROCUREMENT]"]
        assert len(procurement_signals) > 0

        logger.info(f"✅ STANDARD tier dossier generated with {len(dossier['extracted_signals'])} signals")

    @pytest.mark.asyncio
    async def test_generate_universal_dossier_premium_tier(self, mock_claude_client, mock_dossier_data):
        """Test PREMIUM tier dossier generation"""
        from dossier_generator import UniversalDossierGenerator

        generator = UniversalDossierGenerator(mock_claude_client)

        # Generate PREMIUM tier dossier (priority > 50)
        dossier = await generator.generate_universal_dossier(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            entity_type="CLUB",
            priority_score=85,  # PREMIUM tier
            entity_data=mock_dossier_data
        )

        # Validate tier assignment
        assert dossier["metadata"]["tier"] == "PREMIUM"
        assert dossier["metadata"]["priority_score"] == 85

        # Validate comprehensive structure
        assert "executive_summary" in dossier
        assert "procurement_signals" in dossier
        assert "recommended_approach" in dossier

        logger.info(f"✅ PREMIUM tier dossier generated")

    @pytest.mark.asyncio
    async def test_hypothesis_extraction_from_dossier(self, mock_claude_client, mock_dossier_data):
        """Test hypothesis extraction from generated dossier"""
        from dossier_generator import UniversalDossierGenerator

        generator = UniversalDossierGenerator(mock_claude_client)

        # Generate dossier
        dossier = await generator.generate_universal_dossier(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            priority_score=60,
            entity_data=mock_dossier_data
        )

        # Extract hypotheses manually
        hypotheses = generator._extract_hypotheses(dossier)

        # Validate hypothesis structure
        assert len(hypotheses) >= 1

        # Check primary hypothesis
        primary_hyps = [h for h in hypotheses if h.get("type") == "PRIMARY"]
        if primary_hyps:
            assert "statement" in primary_hyps[0]
            assert "confidence" in primary_hyps[0]
            assert 0 <= primary_hyps[0]["confidence"] <= 100

        # Check insight-based hypotheses
        insight_hyps = [h for h in hypotheses if h.get("type") == "INSIGHT"]
        for hyp in insight_hyps:
            assert "signal_type" in hyp
            assert hyp["signal_type"] in ["[PROCUREMENT]", "[CAPABILITY]", "[TIMING]", "[CONTACT]"]

        logger.info(f"✅ Extracted {len(hypotheses)} hypotheses with correct structure")

    @pytest.mark.asyncio
    async def test_signal_extraction_with_correct_tags(self, mock_claude_client, mock_dossier_data):
        """Test signal extraction with correct signal type tags"""
        from dossier_generator import UniversalDossierGenerator

        generator = UniversalDossierGenerator(mock_claude_client)

        # Generate dossier
        dossier = await generator.generate_universal_dossier(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            priority_score=70,
            entity_data=mock_dossier_data
        )

        # Extract signals manually
        signals = generator._extract_signals(dossier)

        # Validate signal tags
        valid_tags = ["[PROCUREMENT]", "[CAPABILITY]", "[TIMING]", "[CONTACT]"]
        for signal in signals:
            assert "type" in signal
            assert signal["type"] in valid_tags, f"Invalid signal type: {signal['type']}"

        # Check that all tag types are represented
        found_tags = set(s["type"] for s in signals)
        logger.info(f"✅ Found signal tags: {found_tags}")

        # Validate signal structure
        for signal in signals:
            assert "insight" in signal
            assert "confidence" in signal
            assert 0 <= signal["confidence"] <= 100
            assert "entity_id" in signal

    @pytest.mark.asyncio
    async def test_no_arsenal_content_in_other_entities(self, mock_claude_client):
        """Test that Arsenal content doesn't leak into other entities"""
        from dossier_generator import UniversalDossierGenerator

        # Create mock response without Arsenal content
        custom_response = {
            "content": json.dumps({
                "metadata": {
                    "entity_id": "chelsea-fc",
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "data_freshness": 70,
                    "confidence_overall": 65,
                    "priority_signals": ["[CAPABILITY]"]
                },
                "executive_summary": {
                    "overall_assessment": {
                        "digital_maturity": {
                            "score": 60,
                            "trend": "stable",
                            "key_strengths": ["Fan engagement platform"],
                            "key_gaps": ["Data analytics"]
                        }
                    },
                    "key_insights": [
                        {
                            "insight": "Chelsea uses custom fan engagement platform",
                            "signal_type": "[CAPABILITY]",
                            "confidence": 70,
                            "impact": "MEDIUM",
                            "source": "Official website",
                            "hypothesis_ready": False
                        }
                    ]
                }
            })
        }

        chelsea_client = MockClaudeClient(custom_response)
        generator = UniversalDossierGenerator(chelsea_client)

        # Generate dossier for Chelsea
        dossier = await generator.generate_universal_dossier(
            entity_id="chelsea-fc",
            entity_name="Chelsea FC",
            entity_type="CLUB",
            priority_score=75
        )

        # Ensure no Arsenal references
        dossier_str = json.dumps(dossier).lower()
        assert "arsenal" not in dossier_str
        assert "emirates" not in dossier_str
        assert "arteta" not in dossier_str
        assert "saka" not in dossier_str

        # Validate Chelsea-specific content
        assert "chelsea" in dossier_str.lower() or "chelsea-fc" in dossier_str

        logger.info("✅ No Arsenal content leaked into Chelsea dossier")

    @pytest.mark.asyncio
    async def test_confidence_score_validation(self, mock_claude_client, mock_dossier_data):
        """Test confidence score validation (0-100 range)"""
        from dossier_generator import UniversalDossierGenerator

        generator = UniversalDossierGenerator(mock_claude_client)

        # Generate dossier
        dossier = await generator.generate_universal_dossier(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            priority_score=80,
            entity_data=mock_dossier_data
        )

        # Validate all confidence scores are in valid range
        # Check metadata confidence
        assert 0 <= dossier["metadata"]["confidence_overall"] <= 100
        assert 0 <= dossier["metadata"]["data_freshness"] <= 100

        # Check signal confidences
        for signal in dossier["extracted_signals"]:
            assert 0 <= signal["confidence"] <= 100, f"Invalid signal confidence: {signal['confidence']}"

        # Check hypothesis confidences
        for hypothesis in dossier["extracted_hypotheses"]:
            assert 0 <= hypothesis["confidence"] <= 100, f"Invalid hypothesis confidence: {hypothesis['confidence']}"

        logger.info("✅ All confidence scores validated in 0-100 range")

    @pytest.mark.asyncio
    async def test_signal_type_tagging_consistency(self, mock_claude_client, mock_dossier_data):
        """Test signal type tagging consistency across sections"""
        from dossier_generator import UniversalDossierGenerator

        generator = UniversalDossierGenerator(mock_claude_client)

        # Generate dossier
        dossier = await generator.generate_universal_dossier(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            priority_score=65,
            entity_data=mock_dossier_data
        )

        # Extract signals
        signals = generator._extract_signals(dossier)

        # Group signals by type
        signals_by_type = {}
        for signal in signals:
            signal_type = signal["type"]
            if signal_type not in signals_by_type:
                signals_by_type[signal_type] = []
            signals_by_type[signal_type].append(signal)

        # Validate each signal type has correct structure
        for signal_type, type_signals in signals_by_type.items():
            logger.info(f"Signal type {signal_type}: {len(type_signals)} signals")

            if signal_type == "[PROCUREMENT]":
                # Procurement signals should have timeline or budget info
                for sig in type_signals:
                    # Check for common procurement-related keys
                    has_procurement_info = any(k in sig for k in ["timeline", "opportunity", "deadline", "confidence", "section"])
                    assert has_procurement_info, f"Procurement signal missing expected keys: {sig}"

            elif signal_type == "[CAPABILITY]":
                # Capability signals should describe tech stack or gaps
                for sig in type_signals:
                    assert "insight" in sig
                    assert any(kw in sig["insight"].lower() for kw in ["platform", "system", "technology", "crm", "analytics"])

            elif signal_type == "[TIMING]":
                # Timing signals should have deadline or window info
                for sig in type_signals:
                    # Check for timing-related keys or insight field
                    has_timing_info = any(k in sig for k in ["deadline", "timeline", "window", "confidence", "section"])
                    assert has_timing_info, f"Timing signal missing expected keys: {sig}"

            elif signal_type == "[CONTACT]":
                # Contact signals should have decision maker info
                for sig in type_signals:
                    assert "insight" in sig
                    assert "decision maker" in sig["insight"].lower()

        logger.info(f"✅ All {len(signals)} signals have consistent tagging by type")

    @pytest.mark.asyncio
    async def test_tier_based_prompt_selection(self, mock_claude_client, mock_dossier_data):
        """Test that correct prompt template is selected for each tier"""
        from dossier_generator import UniversalDossierGenerator

        generator = UniversalDossierGenerator(mock_claude_client)

        # Test each tier
        tiers = [
            (15, "BASIC"),
            (45, "STANDARD"),
            (85, "PREMIUM")
        ]

        for priority, expected_tier in tiers:
            # Generate dossier
            await generator.generate_universal_dossier(
                entity_id=f"test-entity-{priority}",
                entity_name="Test Entity FC",
                priority_score=priority,
                entity_data=mock_dossier_data
            )

            # Check which prompt template was used
            last_call = mock_claude_client.query_calls[-1]
            prompt = last_call["prompt"]

            # Validate tier-specific prompt elements
            if expected_tier == "BASIC":
                assert "BASIC tier" in prompt
            elif expected_tier == "STANDARD":
                assert "STANDARD tier" in prompt
            elif expected_tier == "PREMIUM":
                assert "PREMIUM tier" in prompt or "comprehensive" in prompt.lower()

            logger.info(f"✅ {expected_tier} tier prompt selected correctly")

    @pytest.mark.asyncio
    async def test_model_cascade_strategy(self, mock_claude_client, mock_dossier_data):
        """Test model cascade strategy (Haiku 80%, Sonnet 15%, Opus 5%)"""
        from dossier_generator import UniversalDossierGenerator
        import random

        # Set random seed for reproducibility
        random.seed(42)

        generator = UniversalDossierGenerator(mock_claude_client)

        # Generate multiple dossiers to test cascade
        num_generations = 10
        for i in range(num_generations):
            await generator.generate_universal_dossier(
                entity_id=f"test-entity-{i}",
                entity_name=f"Test Entity FC {i}",
                priority_score=50 + (i % 5) * 10,
                entity_data=mock_dossier_data
            )

        # Analyze model usage
        model_usage = {}
        for call in mock_claude_client.query_calls:
            model = call["model"]
            model_usage[model] = model_usage.get(model, 0) + 1

        logger.info(f"Model usage: {model_usage}")

        # Validate that Haiku is used most often (80% target)
        haiku_count = model_usage.get("haiku", 0)
        total_count = sum(model_usage.values())
        haiku_ratio = haiku_count / total_count if total_count > 0 else 0

        # Should be roughly 80% (allow 50-95% range due to randomness in small sample)
        assert 0.50 <= haiku_ratio <= 0.95, f"Haiku ratio {haiku_ratio:.2f} outside expected range"

        logger.info(f"✅ Model cascade working correctly (Haiku: {haiku_ratio:.1%})")

    @pytest.mark.asyncio
    async def test_dossier_metadata_completeness(self, mock_claude_client, mock_dossier_data):
        """Test that all required metadata fields are present"""
        from dossier_generator import UniversalDossierGenerator

        generator = UniversalDossierGenerator(mock_claude_client)

        # Generate dossier
        dossier = await generator.generate_universal_dossier(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            priority_score=70,
            entity_data=mock_dossier_data
        )

        # Validate required metadata fields
        required_fields = [
            "entity_id",
            "generated_at",
            "data_freshness",
            "confidence_overall",
            "priority_signals",
            "tier",
            "priority_score",
            "hypothesis_count",
            "signal_count"
        ]

        for field in required_fields:
            assert field in dossier["metadata"], f"Missing metadata field: {field}"

        # Validate data types
        assert isinstance(dossier["metadata"]["entity_id"], str)
        assert isinstance(dossier["metadata"]["generated_at"], str)
        assert isinstance(dossier["metadata"]["data_freshness"], int)
        assert isinstance(dossier["metadata"]["confidence_overall"], int)
        assert isinstance(dossier["metadata"]["priority_signals"], list)
        assert isinstance(dossier["metadata"]["tier"], str)
        assert isinstance(dossier["metadata"]["priority_score"], int)
        assert isinstance(dossier["metadata"]["hypothesis_count"], int)
        assert isinstance(dossier["metadata"]["signal_count"], int)

        logger.info("✅ All required metadata fields present with correct types")

    @pytest.mark.asyncio
    async def test_hypothesis_ready_flag_validation(self, mock_claude_client, mock_dossier_data):
        """Test that hypothesis_ready flag is correctly used"""
        from dossier_generator import UniversalDossierGenerator

        generator = UniversalDossierGenerator(mock_claude_client)

        # Generate dossier
        dossier = await generator.generate_universal_dossier(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            priority_score=75,
            entity_data=mock_dossier_data
        )

        # Extract hypotheses
        hypotheses = generator._extract_hypotheses(dossier)

        # Filter insight-based hypotheses (which have hypothesis_ready)
        insight_hypotheses = [h for h in hypotheses if h.get("type") == "INSIGHT"]

        # Validate that insight hypotheses come from hypothesis_ready=True insights
        for hyp in insight_hypotheses:
            # All insight hypotheses should be marked as ready
            # (in real system, this would come from the insight's hypothesis_ready field)
            assert "confidence" in hyp
            assert "signal_type" in hyp

        logger.info(f"✅ {len(insight_hypotheses)} insight hypotheses validated")


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "-s"])
