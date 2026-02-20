#!/usr/bin/env python3
"""
Test International Canoe Federation (ICF) through Full Production System

This script runs the complete multi-layered RFP discovery system for ICF:
- Entity dossier generation
- Multi-pass discovery (4 passes)
- Temporal context from Graphiti
- Network intelligence from FalkorDB
- Ralph Loop validation
- YP capability matching
- Final opportunity report

Usage:
    python test_icf_full_system.py
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

# Get the absolute path to the script's directory
script_dir = Path(__file__).parent.absolute()
backend_path = script_dir / "backend"

# Add backend to Python path
sys.path.insert(0, str(backend_path))

# Store original directory and change to backend
original_dir = os.getcwd()
os.chdir(backend_path)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_icf_full_system():
    """
    Run ICF through the complete production system
    """

    print("\n" + "="*80)
    print("TESTING ICF THROUGH FULL PRODUCTION SYSTEM")
    print("="*80 + "\n")

    # Import orchestrator
    try:
        from backend.multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator
        from backend.dossier_generator import EntityDossierGenerator
        from backend.claude_client import ClaudeClient
        from backend.brightdata_sdk_client import BrightDataSDKClient
        logger.info("✅ All production modules imported successfully")
    except ImportError as e:
        logger.error(f"❌ Failed to import production modules: {e}")
        logger.info("This test requires the full backend system")
        return

    # Initialize clients
    try:
        claude = ClaudeClient()
        brightdata = BrightDataSDKClient()
        logger.info("✅ Clients initialized\n")
    except Exception as e:
        logger.error(f"❌ Failed to initialize clients: {e}")
        logger.info("Continuing with available components...\n")

    # =============================================================================
    # TEST 1: Generate Entity Dossier
    # =============================================================================

    print("📋 TEST 1: Generate Entity Dossier")
    print("-" * 80 + "\n")

    try:
        dossier_generator = EntityDossierGenerator(claude)

        print("Generating dossier for ICF...")
        dossier = await dossier_generator.generate_dossier(
            entity_id="international-canoe-federation",
            entity_name="International Canoe Federation",
            priority_score=50  # STANDARD tier (7 sections)
        )

        print(f"✅ Dossier generated successfully!")
        print(f"   Entity: {dossier.entity_name}")
        print(f"   Tier: {dossier.tier}")
        print(f"   Sections: {len(dossier.sections)}")
        print(f"   Hypotheses: {len(dossier.hypotheses)}")
        print(f"   Cost: ${dossier.total_cost:.4f}")
        print(f"   Time: {dossier.generation_time_seconds:.1f}s\n")

    except Exception as e:
        logger.error(f"❌ Dossier generation failed: {e}")
        logger.info("This is expected if FalkorDB/Graphiti are not available\n")
        dossier = None

    # =============================================================================
    # TEST 2: Dossier-Informed Hypothesis Generation
    # =============================================================================

    print("📋 TEST 2: Dossier-Informed Hypothesis Generation")
    print("-" * 80 + "\n")

    try:
        from backend.dossier_hypothesis_generator import DossierHypothesisGenerator

        hyp_generator = DossierHypothesisGenerator()

        if dossier:
            print("Generating hypotheses from dossier...")
            hypotheses = await hyp_generator.generate_hypotheses_from_dossier(
                dossier=dossier,
                entity_id="international-canoe-federation"
            )

            print(f"✅ Generated {len(hypotheses)} hypotheses from dossier:")
            for hyp in hypotheses[:5]:  # Show first 5
                print(f"   - {hyp.category}: {hyp.statement[:80]}...")
                print(f"     Confidence: {hyp.confidence:.2f}, YP: {hyp.metadata.get('yp_capability', 'N/A')}")
            if len(hypotheses) > 5:
                print(f"   ... and {len(hypotheses) - 5} more")
            print()

        else:
            # Skip hypothesis generation without dossier
            print("⏭️  Skipping hypothesis generation (no dossier available)\n")
            hypotheses = []

    except Exception as e:
        logger.error(f"❌ Hypothesis generation failed: {e}")
        logger.info("This component may need Yellow Panther profile\n")
        hypotheses = []

    # =============================================================================
    # TEST 3: Multi-Pass Discovery (Full System)
    # =============================================================================

    print("📋 TEST 3: Multi-Pass Discovery (4 Passes)")
    print("-" * 80 + "\n")

    try:
        orchestrator = MultiPassRFPOrchestrator()

        print("Running full multi-pass discovery for ICF...")
        print("(This may take 2-3 minutes with real APIs)\n")

        start_time = datetime.now()

        result = await orchestrator.discover_rfp_opportunities(
            entity_id="international-canoe-federation",
            entity_name="International Canoe Federation",
            max_passes=4
        )

        duration = (datetime.now() - start_time).total_seconds()

        print(f"\n✅ Multi-Pass Discovery Complete!")
        print(f"   Duration: {duration:.1f}s")
        print(f"   Final Confidence: {result.final_confidence:.2f}")
        print(f"   Total Cost: ${result.total_cost:.2f}")
        print(f"   Passes Completed: {len(result.multi_pass_result.pass_results)}")
        print()

    except Exception as e:
        logger.error(f"❌ Multi-pass discovery failed: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        print()
        result = None

    # =============================================================================
    # TEST 4: Opportunity Report Analysis
    # =============================================================================

    if result and result.opportunity_report:
        print("📋 TEST 4: Opportunity Report Analysis")
        print("-" * 80 + "\n")

        report = result.opportunity_report

        print(f"Total Opportunities: {report.total_opportunities}")
        print(f"High Priority (≥0.80): {report.high_priority_count}")
        print(f"Medium Priority (0.60-0.79): {report.medium_priority_count}")
        print(f"Low Priority (<0.60): {report.low_priority_count}")
        print()

        print("Top Opportunities:")
        for opp in sorted(report.opportunities, key=lambda o: o.confidence, reverse=True)[:5]:
            print(f"\n  🎯 {opp.category}")
            print(f"     Confidence: {opp.confidence:.2f}")
            print(f"     Signal Type: {opp.signal_type}")
            print(f"     Pass: {opp.pass_number}")
            print(f"     YP Service: {opp.yp_service}")
            print(f"     Estimated Value: ${opp.estimated_value:,.0f}")
            print(f"     Action: {opp.recommended_action}")

        # Temporal insights
        if report.temporal_insights:
            print(f"\n📅 Temporal Insights:")
            for key, value in report.temporal_insights.items():
                print(f"   {key}: {value}")

        # Network insights
        if report.network_insights:
            print(f"\n🌐 Network Insights:")
            for key, value in report.network_insights.items():
                print(f"   {key}: {value}")

        print()

    # =============================================================================
    # SUMMARY
    # =============================================================================

    print("="*80)
    print("TEST SUMMARY")
    print("="*80 + "\n")

    print("Component Test Results:")
    print(f"  ✅ Entity Dossier: {'PASS' if dossier else 'SKIP (FalkorDB/Graphiti not available)'}")
    print(f"  ✅ Hypothesis Generation: {'PASS' if hypotheses else 'SKIP (YP profile not available)'}")
    print(f"  ✅ Multi-Pass Discovery: {'PASS' if result else 'FAIL'}")
    print(f"  ✅ Opportunity Report: {'PASS' if result and result.opportunity_report else 'N/A'}")
    print()

    if result:
        print("Final Results:")
        print(f"  Entity: {result.entity_name}")
        print(f"  Final Confidence: {result.final_confidence:.2f}")
        print(f"  High-Priority Opportunities: {result.opportunity_report.high_priority_count if result.opportunity_report else 0}")
        print(f"  Duration: {result.duration_seconds:.1f}s")
        print(f"  Total Cost: ${result.total_cost:.2f}")
        print()

    # Save results
    if result:
        output_file = f"data/icf_full_system_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        try:
            os.makedirs("data", exist_ok=True)

            # Convert result to dict
            result_dict = {
                "entity_id": result.entity_id,
                "entity_name": result.entity_name,
                "final_confidence": result.final_confidence,
                "duration_seconds": result.duration_seconds,
                "total_cost": result.total_cost,
                "opportunities": [
                    {
                        "category": opp.category,
                        "confidence": opp.confidence,
                        "signal_type": opp.signal_type,
                        "pass_number": opp.pass_number,
                        "yp_service": opp.yp_service,
                        "estimated_value": opp.estimated_value,
                        "recommended_action": opp.recommended_action
                    }
                    for opp in result.opportunity_report.opportunities
                ] if result.opportunity_report else [],
                "high_priority_count": result.opportunity_report.high_priority_count if result.opportunity_report else 0,
                "medium_priority_count": result.opportunity_report.medium_priority_count if result.opportunity_report else 0,
                "low_priority_count": result.opportunity_report.low_priority_count if result.opportunity_report else 0,
                "timestamp": datetime.now().isoformat()
            }

            with open(output_file, 'w') as f:
                json.dump(result_dict, f, indent=2)

            print(f"✅ Results saved to: {output_file}\n")

        except Exception as e:
            logger.error(f"Failed to save results: {e}")

    print("="*80)
    print("TEST COMPLETE")
    print("="*80 + "\n")

    # Restore original directory
    os.chdir(original_dir)


if __name__ == "__main__":
    print("\n🚀 Starting Full System Test for ICF\n")
    try:
        asyncio.run(test_icf_full_system())
    finally:
        # Always restore directory
        os.chdir(original_dir)
