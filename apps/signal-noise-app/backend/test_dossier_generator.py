#!/usr/bin/env python3
"""
Dossier Generator Verification Tests

Tests for entity dossier generation system:
- Unit tests for section generation
- Integration tests for complete dossiers
- Cost validation tests
- API endpoint tests
"""

import asyncio
import pytest
from datetime import datetime, timezone
from dossier_generator import EntityDossierGenerator
from dossier_templates import get_prompt_template, list_all_templates
from schemas import EntityDossier, DossierSection, DossierTier


# =============================================================================
# Test 1: Unit Test Section Generation
# =============================================================================

@pytest.mark.asyncio
async def test_core_information_section_generation():
    """Test that core information section is generated correctly"""
    from claude_client import ClaudeClient

    claude = ClaudeClient()
    generator = EntityDossierGenerator(claude)

    # Mock entity data
    entity_data = {
        "entity_name": "Arsenal FC",
        "founded": "1886",
        "stadium": "Emirates Stadium",
        "employees": "600",
        "website": "https://arsenal.com",
        "league": "Premier League"
    }

    # Generate section
    section = await generator._generate_section(
        section_id="core_information",
        entity_data=entity_data,
        model="haiku"
    )

    # Assertions
    assert section is not None
    assert section.id == "core_information"
    assert section.generated_by == "haiku"
    assert len(section.content) > 0
    assert section.confidence >= 0.0
    assert isinstance(section.generated_at, datetime)


@pytest.mark.asyncio
async def test_digital_maturity_section_generation():
    """Test that digital maturity section uses Sonnet model"""
    from claude_client import ClaudeClient

    claude = ClaudeClient()
    generator = EntityDossierGenerator(claude)

    entity_data = {"entity_name": "Arsenal FC"}

    section = await generator._generate_section(
        section_id="digital_maturity",
        entity_data=entity_data,
        model="sonnet"
    )

    assert section.id == "digital_maturity"
    assert section.generated_by == "sonnet"
    assert len(section.metrics) > 0  # Should have maturity scores


@pytest.mark.asyncio
async def test_strategic_analysis_section_generation():
    """Test that strategic analysis section uses Opus model"""
    from claude_client import ClaudeClient

    claude = ClaudeClient()
    generator = EntityDossierGenerator(claude)

    entity_data = {"entity_name": "Arsenal FC"}

    section = await generator._generate_section(
        section_id="strategic_analysis",
        entity_data=entity_data,
        model="opus"
    )

    assert section.id == "strategic_analysis"
    assert section.generated_by == "opus"
    assert len(section.insights) > 0  # Should have strategic insights


# =============================================================================
# Test 2: Integration Test Complete Dossier
# =============================================================================

@pytest.mark.asyncio
async def test_basic_tier_dossier_generation():
    """Test Basic tier dossier generation (3 sections)"""
    from claude_client import ClaudeClient

    claude = ClaudeClient()
    generator = EntityDossierGenerator(claude)

    dossier = await generator.generate_dossier(
        entity_id="test-entity-basic",
        entity_name="Test Entity Basic",
        entity_type="CLUB",
        priority_score=15  # Basic tier
    )

    assert dossier.tier == "BASIC"
    assert len(dossier.sections) == 3
    assert dossier.total_cost_usd < 0.001  # Should be ~$0.0004
    assert dossier.generation_time_seconds < 10

    # Check section IDs
    section_ids = [s.id for s in dossier.sections]
    assert "core_information" in section_ids
    assert "quick_actions" in section_ids
    assert "contact_information" in section_ids


@pytest.mark.asyncio
async def test_standard_tier_dossier_generation():
    """Test Standard tier dossier generation (7 sections)"""
    from claude_client import ClaudeClient

    claude = ClaudeClient()
    generator = EntityDossierGenerator(claude)

    dossier = await generator.generate_dossier(
        entity_id="test-entity-standard",
        entity_name="Test Entity Standard",
        entity_type="CLUB",
        priority_score=35  # Standard tier
    )

    assert dossier.tier == "STANDARD"
    assert len(dossier.sections) == 7
    assert dossier.total_cost_usd < 0.01  # Should be ~$0.0095
    assert dossier.generation_time_seconds < 20


@pytest.mark.asyncio
async def test_premium_tier_dossier_generation():
    """Test Premium tier dossier generation (11 sections)"""
    from claude_client import ClaudeClient

    claude = ClaudeClient()
    generator = EntityDossierGenerator(claude)

    dossier = await generator.generate_dossier(
        entity_id="test-entity-premium",
        entity_name="Test Entity Premium",
        entity_type="CLUB",
        priority_score=99  # Premium tier
    )

    assert dossier.tier == "PREMIUM"
    assert len(dossier.sections) == 11
    assert dossier.total_cost_usd < 0.06  # Should be ~$0.057
    assert dossier.generation_time_seconds < 35


# =============================================================================
# Test 3: Model Distribution Verification
# =============================================================================

@pytest.mark.asyncio
async def test_model_cascade_distribution():
    """Verify that models are used according to cascade strategy"""
    from claude_client import ClaudeClient

    claude = ClaudeClient()
    generator = EntityDossierGenerator(claude)

    # Generate Premium dossier (all sections)
    dossier = await generator.generate_dossier(
        entity_id="test-model-distribution",
        entity_name="Test Model Distribution",
        entity_type="CLUB",
        priority_score=99
    )

    # Count sections by model
    model_counts = {}
    for section in dossier.sections:
        model_counts[section.generated_by] = model_counts.get(section.generated_by, 0) + 1

    # Verify distribution (approximately)
    # Haiku: 5 sections (45%)
    # Sonnet: 4 sections (36%)
    # Opus: 2 sections (18%)
    assert "haiku" in model_counts
    assert "sonnet" in model_counts
    assert "opus" in model_counts

    # Haiku should have most sections
    assert model_counts["haiku"] >= 4


# =============================================================================
# Test 4: Template System
# =============================================================================

def test_template_retrieval():
    """Test that templates can be retrieved correctly"""
    # List all templates
    all_templates = list_all_templates()

    assert "haiku" in all_templates
    assert "sonnet" in all_templates
    assert "opus" in all_templates

    # Check template counts
    assert len(all_templates["haiku"]) == 5  # core_info, quick_actions, contact, news, performance
    assert len(all_templates["sonnet"]) == 4  # digital_maturity, leadership, ai_assessment, challenges
    assert len(all_templates["opus"]) == 2   # strategic_analysis, connections


def test_get_specific_template():
    """Test retrieving specific templates"""
    # Get Haiku template
    haiku_template = get_prompt_template("core_info_template", "haiku")
    assert "Extract core information" in haiku_template
    assert "{entity_name}" in haiku_template

    # Get Sonnet template
    sonnet_template = get_prompt_template("digital_maturity_template", "sonnet")
    assert "digital maturity" in sonnet_template

    # Get Opus template
    opus_template = get_prompt_template("strategic_analysis_template", "opus")
    assert "strategic analysis" in opus_template


# =============================================================================
# Test 5: Fallback Section Creation
# =============================================================================

def test_fallback_section_creation():
    """Test that fallback sections are created on error"""
    from claude_client import ClaudeClient

    claude = ClaudeClient()
    generator = EntityDossierGenerator(claude)

    fallback = generator._create_fallback_section("core_information", "haiku")

    assert fallback.id == "core_information"
    assert fallback.generated_by == "haiku"
    assert len(fallback.content) > 0
    assert "generation failed" in fallback.content[0].lower()


# =============================================================================
# Test 6: Tier Determination
# =============================================================================

def test_tier_determination():
    """Test that priority scores map to correct tiers"""
    from claude_client import ClaudeClient

    claude = ClaudeClient()
    generator = EntityDossierGenerator(claude)

    # Basic tier (0-20)
    assert generator._determine_tier(0) == "BASIC"
    assert generator._determine_tier(20) == "BASIC"

    # Standard tier (21-50)
    assert generator._determine_tier(21) == "STANDARD"
    assert generator._determine_tier(50) == "STANDARD"

    # Premium tier (51-100)
    assert generator._determine_tier(51) == "PREMIUM"
    assert generator._determine_tier(100) == "PREMIUM"


# =============================================================================
# Test 7: Cost Estimation
# =============================================================================

def test_cost_estimation():
    """Test that section costs are estimated correctly"""
    from claude_client import ClaudeClient

    claude = ClaudeClient()
    generator = EntityDossierGenerator(claude)

    # Haiku should be cheapest
    haiku_cost = generator._estimate_section_cost("haiku", 1000)
    sonnet_cost = generator._estimate_section_cost("sonnet", 1000)
    opus_cost = generator._estimate_section_cost("opus", 1000)

    print(f"Costs - Haiku: ${haiku_cost:.6f}, Sonnet: ${sonnet_cost:.6f}, Opus: ${opus_cost:.6f}")

    assert haiku_cost < sonnet_cost < opus_cost

    # Haiku: ~$0.00025 per 1000 tokens
    assert haiku_cost < 0.001

    # Sonnet: ~$0.003 per 1000 tokens
    assert sonnet_cost < 0.01

    # Opus: ~$0.015 per 1000 tokens (allow margin for calculation)
    assert opus_cost < 0.05


# =============================================================================
# Run Tests
# =============================================================================

if __name__ == "__main__":
    print("Running Dossier Generator Tests...")
    print("=" * 60)

    # Run synchronous tests
    print("\n1. Template Retrieval Tests...")
    test_template_retrieval()
    test_get_specific_template()
    print("   ✅ Template tests passed")

    print("\n2. Fallback Section Tests...")
    test_fallback_section_creation()
    print("   ✅ Fallback tests passed")

    print("\n3. Tier Determination Tests...")
    test_tier_determination()
    print("   ✅ Tier tests passed")

    print("\n4. Cost Estimation Tests...")
    test_cost_estimation()
    print("   ✅ Cost tests passed")

    # Run async tests
    print("\n5. Async Generation Tests...")
    asyncio.run(test_core_information_section_generation())
    print("   ✅ Core information section test passed")

    asyncio.run(test_basic_tier_dossier_generation())
    print("   ✅ Basic tier dossier test passed")

    print("\n" + "=" * 60)
    print("✅ All tests passed!")
