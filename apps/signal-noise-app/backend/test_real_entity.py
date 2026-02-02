#!/usr/bin/env python3
"""
Real Entity Test - Hypothesis-Driven Discovery

Tests the hypothesis-driven discovery system with a real sports entity (Arsenal FC).

Usage:
    python backend/test_real_entity.py
"""

import asyncio
import sys
import logging
from pathlib import Path
from datetime import datetime, timezone

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_real_entity_discovery():
    """Test hypothesis-driven discovery with real entity"""
    from backend.hypothesis_manager import HypothesisManager, Hypothesis
    from backend.eig_calculator import EIGCalculator
    from backend.template_loader import TemplateLoader

    print("\n" + "="*60)
    print("Hypothesis-Driven Discovery - Real Entity Test")
    print("="*60)

    # Real entity: Arsenal FC
    entity_id = "arsenal-fc"
    entity_name = "Arsenal FC"

    print(f"\n🎯 Testing Entity: {entity_name}")
    print(f"   Entity ID: {entity_id}")

    # Load available templates
    print(f"\n📋 Loading templates...")
    loader = TemplateLoader()

    # Just use the template_id directly
    template_id = "tier_1_club_centralized_procurement"
    print(f"   Using template: {template_id}")

    # Initialize manager (in-memory mode)
    print(f"\n🔬 Initializing HypothesisManager...")
    manager = HypothesisManager(repository=None)  # In-memory mode

    # Initialize EIG calculator
    calculator = EIGCalculator()

    # Create hypotheses manually (simulating template loading)
    print(f"\n📝 Creating hypotheses for {entity_name}...")

    hypotheses = [
        Hypothesis(
            hypothesis_id=f"{entity_id}_crm_procurement",
            entity_id=entity_id,
            category="CRM Implementation",
            statement=f"{entity_name} is preparing CRM procurement",
            prior_probability=0.5,
            confidence=0.42,
            metadata={
                'pattern_name': 'CRM Manager',
                'template_id': template_id,
                'entity_name': entity_name
            }
        ),
        Hypothesis(
            hypothesis_id=f"{entity_id}_digital_transformation",
            entity_id=entity_id,
            category="Digital Transformation",
            statement=f"{entity_name} is undergoing digital transformation",
            prior_probability=0.5,
            confidence=0.65,
            metadata={
                'pattern_name': 'Digital Lead',
                'template_id': template_id,
                'entity_name': entity_name
            }
        ),
        Hypothesis(
            hypothesis_id=f"{entity_id}_c_suite_hiring",
            entity_id=entity_id,
            category="C-Suite Hiring",
            statement=f"{entity_name} is hiring CTO or CDO",
            prior_probability=0.5,
            confidence=0.50,
            metadata={
                'pattern_name': 'CTO Hire',
                'template_id': template_id,
                'entity_name': entity_name
            }
        ),
        Hypothesis(
            hypothesis_id=f"{entity_id}_data_analytics",
            entity_id=entity_id,
            category="Data Analytics",
            statement=f"{entity_name} is implementing data analytics platform",
            prior_probability=0.4,
            confidence=0.55,
            metadata={
                'pattern_name': 'Data Analyst',
                'template_id': template_id,
                'entity_name': entity_name
            }
        ),
        Hypothesis(
            hypothesis_id=f"{entity_id}_fan_engagement",
            entity_id=entity_id,
            category="Fan Engagement",
            statement=f"{entity_name} is seeking fan engagement platform",
            prior_probability=0.3,
            confidence=0.60,
            metadata={
                'pattern_name': 'Fan Platform',
                'template_id': template_id,
                'entity_name': entity_name
            }
        )
    ]

    # Cache hypotheses
    manager._hypotheses_cache[entity_id] = hypotheses

    print(f"✅ Created {len(hypotheses)} hypotheses")

    # Display initial state
    print(f"\n📊 Initial Hypothesis State:")
    print(f"{'Hypothesis':<40} {'Conf':<10} {'Category':<20} {'Status':<10}")
    print("-" * 80)

    for h in hypotheses:
        print(f"{h.statement[:40]:<40} {h.confidence:<10.2f} {h.category:<20} {h.status:<10}")

    # Calculate EIG for all hypotheses
    print(f"\n🧮 Calculating Expected Information Gain...")

    for h in hypotheses:
        h.expected_information_gain = calculator.calculate_eig(h)

    # Sort by EIG
    ranked = sorted(hypotheses, key=lambda h: h.expected_information_gain, reverse=True)

    print(f"\n🏆 Hypotheses Ranked by EIG:")
    print(f"{'Rank':<6} {'EIG':<10} {'Confidence':<12} {'Novelty':<10} {'Category':<20}")
    print("-" * 80)

    for i, h in enumerate(ranked, 1):
        # Calculate novelty (assuming no cluster state yet)
        novelty = 1.0  # Maximum novelty when no dampening
        info_value = calculator._get_information_value(h.category)

        print(f"{i:<6} {h.expected_information_gain:<10.3f} {h.confidence:<12.2f} {novelty:<10.2f} {h.category:<20}")

    # Simulate discovery iterations
    print(f"\n🔄 Simulating Discovery Iterations...")

    top_hypothesis = ranked[0]
    print(f"\nTop Hypothesis: {top_hypothesis.hypothesis_id}")
    print(f"  Statement: {top_hypothesis.statement}")
    print(f"  Initial EIG: {top_hypothesis.expected_information_gain:.3f}")
    print(f"  Initial Confidence: {top_hypothesis.confidence:.2f}")

    # Simulate 3 iterations
    iterations = [
        {"decision": "ACCEPT", "delta": 0.06, "source": "annual_report_2024"},
        {"decision": "ACCEPT", "delta": 0.04, "source": "job_posting_crm"},
        {"decision": "WEAK_ACCEPT", "delta": 0.02, "source": "press_release"}
    ]

    for i, iteration in enumerate(iterations, 1):
        print(f"\n--- Iteration {i} ---")

        updated = await manager.update_hypothesis(
            hypothesis_id=top_hypothesis.hypothesis_id,
            entity_id=entity_id,
            decision=iteration["decision"],
            confidence_delta=iteration["delta"],
            evidence_ref=iteration["source"]
        )

        print(f"  Decision: {iteration['decision']}")
        print(f"  Evidence: {iteration['source']}")
        print(f"  Confidence Delta: +{iteration['delta']:.2f}")
        print(f"  New Confidence: {updated.confidence:.2f}")
        print(f"  Iterations: {updated.iterations_attempted}")
        print(f"  ACCEPTs: {updated.iterations_accepted}")
        print(f"  WEAK_ACCEPTs: {updated.iterations_weak_accept}")

        # Check if promoted
        if updated.status == "PROMOTED":
            print(f"  ✅ PROMOTED! (high confidence with strong evidence)")

    # Final state
    print(f"\n📊 Final State:")
    print(f"  Final Confidence: {updated.confidence:.2f}")
    print(f"  Total Iterations: {updated.iterations_attempted}")
    print(f"  ACCEPTs: {updated.iterations_accepted}")
    print(f"  WEAK_ACCEPTs: {updated.iterations_weak_accept}")
    print(f"  Status: {updated.status}")

    # Calculate confidence band
    from backend.schemas import ConfidenceBand
    band = ConfidenceBand.EXPLORATORY
    if updated.confidence >= 0.30:
        band = ConfidenceBand.INFORMED
    if updated.confidence >= 0.60:
        band = ConfidenceBand.CONFIDENT
    if updated.confidence >= 0.80:
        band = ConfidenceBand.ACTIONABLE

    print(f"  Confidence Band: {band.value}")

    # Check actionable gate
    is_actionable = (updated.iterations_accepted >= 2)
    print(f"  Actionable: {is_actionable}")

    # Compare all hypotheses after discovery
    print(f"\n📊 All Hypotheses After Discovery:")
    print(f"{'Hypothesis':<40} {'Conf':<8} {'Iterations':<12} {'ACCEPTs':<8}")
    print("-" * 80)

    for h in hypotheses:
        print(f"{h.statement[:40]:<40} {h.confidence:<8.2f} {h.iterations_attempted:<12} {h.iterations_accepted:<8}")

    # Summary
    print(f"\n" + "="*60)
    print("Test Summary")
    print("="*60)
    print(f"Entity: {entity_name}")
    print(f"Hypotheses Tested: {len(hypotheses)}")
    print(f"Discovery Iterations: {len(iterations)}")
    print(f"Final Confidence: {updated.confidence:.2f}")
    print(f"Confidence Band: {band.value}")
    print(f"Status: {updated.status}")
    print(f"\n✅ Real entity test complete!")

    return True


async def main():
    """Run real entity test"""
    try:
        await test_real_entity_discovery()
    except Exception as e:
        logger.error(f"❌ Test failed: {e}", exc_info=True)
        print(f"\n❌ Test failed: {e}")
        return False


if __name__ == "__main__":
    asyncio.run(main())
