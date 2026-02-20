#!/usr/bin/env python3
"""
Multi-Layered RFP Discovery System - Test Demo

Demonstrates the integrated multi-pass discovery system with:
- Dossier-informed hypothesis generation
- Multi-pass context with temporal and graph intelligence
- Ralph Loop validation for each pass
- Evolving hypotheses across passes

Usage:
    python backend/test_multi_pass_integration.py
"""

import asyncio
import logging
from datetime import datetime, timezone

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_dossier_hypothesis_generation():
    """Test Phase 1: Dossier-Informed Hypothesis Generation"""
    print("\n" + "="*80)
    print("PHASE 1: Dossier-Informed Hypothesis Generation")
    print("="*80 + "\n")

    from dossier_generator import EntityDossierGenerator
    from dossier_hypothesis_generator import DossierHypothesisGenerator
    from claude_client import ClaudeClient

    # Initialize
    claude = ClaudeClient()
    dossier_gen = EntityDossierGenerator(claude)

    # Generate dossier (STANDARD tier for good baseline)
    print("📋 Generating entity dossier (STANDARD tier)...")
    dossier = await dossier_gen.generate_dossier(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=50
    )

    print(f"✅ Dossier generated: {len(dossier.sections)} sections")
    print(f"   Tier: {dossier.tier}")
    print(f"   Cost: ${dossier.total_cost_usd:.4f}")
    print(f"   Time: {dossier.generation_time_seconds:.1f}s")

    # Generate dossier-informed hypotheses
    print("\n🔍 Generating dossier-informed hypotheses...")
    hyp_gen = DossierHypothesisGenerator()
    hypotheses = await hyp_gen.generate_hypotheses_from_dossier(
        dossier=dossier,
        entity_id="arsenal-fc"
    )

    print(f"\n✅ Generated {len(hypotheses)} hypotheses from dossier:\n")

    for hyp in hypotheses[:5]:  # Show first 5
        print(f"  📊 {hyp.hypothesis_id}")
        print(f"     Statement: {hyp.statement}")
        print(f"     Confidence: {hyp.confidence:.2f}")
        print(f"     YP Service: {hyp.metadata.get('yp_capability', 'N/A')}")

        need = hyp.metadata.get('entity_need', {})
        if need:
            print(f"     Evidence: {need.get('evidence_text', 'N/A')[:80]}...")
        print()

    return dossier, hypotheses


async def test_multi_pass_context():
    """Test Phase 2: Multi-Pass Context Management"""
    print("\n" + "="*80)
    print("PHASE 2: Multi-Pass Context Management")
    print("="*80 + "\n")

    from multi_pass_context import MultiPassContext

    context_manager = MultiPassContext()

    # Test Pass 1 strategy
    print("🎯 Generating Pass 1 strategy...")
    strategy_1 = await context_manager.get_pass_strategy(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        pass_number=1,
        previous_results=[]
    )

    print(f"✅ Pass 1 Strategy:")
    print(f"   Description: {strategy_1.description}")
    print(f"   Focus areas: {', '.join(strategy_1.focus_areas[:3])}")
    print(f"   Hop types: {', '.join(strategy_1.hop_types)}")
    print(f"   Max iterations: {strategy_1.max_iterations}")
    print(f"   Depth limit: {strategy_1.depth_limit}")

    # Test temporal patterns
    print("\n📊 Loading temporal patterns...")
    temporal_patterns = await context_manager.get_temporal_patterns("arsenal-fc")

    print(f"✅ Temporal Patterns:")
    print(f"   RFP history: {len(temporal_patterns.rfp_history)} events")
    print(f"   Tech adoptions: {len(temporal_patterns.tech_adoptions)} events")
    if temporal_patterns.avg_rfp_frequency > 0:
        print(f"   Avg RFP frequency: {temporal_patterns.avg_rfp_frequency:.2f}/month")

    # Test graph context
    print("\n🕸️ Loading graph context...")
    graph_context = await context_manager.get_graph_context("arsenal-fc")

    print(f"✅ Graph Context:")
    print(f"   Partners: {len(graph_context.partners)}")
    print(f"   Competitors: {len(graph_context.competitors)}")
    print(f"   Technology stack: {len(graph_context.technology_stack)} items")
    print(f"   Network hypotheses: {len(graph_context.network_hypotheses)}")

    return context_manager


async def test_ralph_loop_validation():
    """Test Phase 3: Ralph Loop Signal Validation"""
    print("\n" + "="*80)
    print("PHASE 3: Ralph Loop Signal Validation")
    print("="*80 + "\n")

    from ralph_loop import RalphLoop
    from claude_client import ClaudeClient
    from graphiti_service import GraphitiService
    from schemas import Signal, SignalType, Evidence

    # Initialize services
    claude = ClaudeClient()
    graphiti = GraphitiService()
    await graphiti.initialize()

    ralph = RalphLoop(claude, graphiti)

    # Create test signals
    print("📝 Creating test signals...")

    raw_signals = [
        {
            "id": "test-signal-001",
            "type": "RFP_DETECTED",
            "confidence": 0.85,
            "entity_id": "arsenal-fc",
            "evidence": [
                {
                    "source": "LinkedIn",
                    "credibility_score": 0.8,
                    "extracted_text": "Arsenal FC seeking React Developer for web platform rebuild",
                    "url": "https://linkedin.com/jobs/123",
                    "date": datetime.now(timezone.utc).isoformat()
                },
                {
                    "source": "Arsenal Careers",
                    "credibility_score": 0.9,
                    "extracted_text": "React Developer role to lead digital transformation initiative",
                    "url": "https://arsenal.com/careers/456",
                    "date": datetime.now(timezone.utc).isoformat()
                },
                {
                    "source": "Press Release",
                    "credibility_score": 0.85,
                    "extracted_text": "Arsenal announces major digital transformation investment",
                    "url": "https://arsenal.com/press/digital",
                    "date": datetime.now(timezone.utc).isoformat()
                }
            ],
            "metadata": {
                "category": "Web Development",
                "keywords": ["react", "digital transformation", "web platform"]
            }
        },
        {
            "id": "test-signal-002",
            "type": "JOB_POSTING",
            "confidence": 0.65,
            "entity_id": "arsenal-fc",
            "evidence": [
                {
                    "source": "LinkedIn",
                    "credibility_score": 0.75,
                    "extracted_text": "Mobile Developer position available",
                    "url": "https://linkedin.com/jobs/789",
                    "date": datetime.now(timezone.utc).isoformat()
                }
            ],
            "metadata": {
                "category": "Mobile Development",
                "keywords": ["mobile", "app"]
            }
        }
    ]

    print(f"  Created {len(raw_signals)} test signals")

    # Run Ralph Loop validation
    print("\n🔁 Running Ralph Loop validation...")

    validated_signals = await ralph.validate_signals(
        raw_signals=raw_signals,
        entity_id="arsenal-fc"
    )

    print(f"\n✅ Ralph Loop Results:")
    print(f"   Validated signals: {len(validated_signals)}/{len(raw_signals)}")

    for signal in validated_signals:
        print(f"\n  📊 {signal.id}")
        print(f"     Type: {signal.type.value}")
        print(f"     Confidence: {signal.confidence:.2f}")
        print(f"     Validated: {signal.validated}")
        print(f"     Pass: {signal.validation_pass}")

    graphiti.close()

    return validated_signals


async def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("MULTI-LAYERED RFP DISCOVERY SYSTEM - INTEGRATION TEST")
    print("="*80)
    print(f"\nTest started at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")

    try:
        # Phase 1: Dossier hypothesis generation
        dossier, hypotheses = await test_dossier_hypothesis_generation()

        # Phase 2: Multi-pass context
        context_manager = await test_multi_pass_context()

        # Phase 3: Ralph Loop validation
        validated_signals = await test_ralph_loop_validation()

        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED")
        print("="*80)

        print("\n📊 Summary:")
        print(f"   Dossier sections: {len(dossier.sections)}")
        print(f"   Dossier-informed hypotheses: {len(hypotheses)}")
        print(f"   Validated signals: {len(validated_signals)}")
        print(f"   High confidence signals: {len([s for s in validated_signals if s.confidence > 0.7])}")

        print(f"\nTest completed at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")

    except Exception as e:
        logger.error(f"❌ Test failed: {e}", exc_info=True)
        print("\n❌ Test failed - see logs for details")


if __name__ == "__main__":
    asyncio.run(main())
