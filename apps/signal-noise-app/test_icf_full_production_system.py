#!/usr/bin/env python3
"""
Test ICF through FULL PRODUCTION SYSTEM with new RFP/Tenders hop types

This demonstrates the complete end-to-end flow:
1. Multi-pass orchestrator
2. Dossier-informed hypotheses
3. Hypothesis-driven discovery with new RFP hop types
4. Ralph Loop validation
5. Opportunity generation
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_path = Path.cwd() / 'backend'
sys.path.insert(0, str(backend_path))

import os
os.chdir(backend_path)

from backend.multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator


async def test_icf_full_production():
    """
    Test ICF through complete production system with NEW RFP HOP TYPES
    """

    print("\n" + "="*80)
    print("ICF FULL PRODUCTION SYSTEM TEST - WITH RFP/TENDERS HOP TYPES")
    print("="*80 + "\n")

    print("✅ NEW HOP TYPES ACTIVE:")
    print("   - RFP_PAGE: Searches for '{entity} rfp'")
    print("   - TENDERS_PAGE: Searches for '{entity} tenders'")
    print("   - PROCUREMENT_PAGE: Searches for '{entity} procurement'")
    print()

    # Initialize orchestrator
    orchestrator = MultiPassRFPOrchestrator()

    print("🚀 Starting full production discovery for International Canoe Federation...")
    print()

    try:
        # Run complete multi-pass discovery
        result = await orchestrator.discover_rfp_opportunities(
            entity_id='international-canoe-federation',
            entity_name='International Canoe Federation',
            max_passes=2  # 2-pass discovery for thorough testing
        )

        # Print results
        print("\n" + "="*80)
        print("DISCOVERY RESULTS")
        print("="*80 + "\n")

        print(f"Entity: {result.entity_name}")
        print(f"Entity ID: {result.entity_id}")
        print(f"Final Confidence: {result.final_confidence:.2f}")
        print()

        # Show opportunities found
        if result.opportunity_report:
            print(f"Total Opportunities: {result.opportunity_report.total_opportunities}")
            print(f"High-Priority Opportunities: {result.opportunity_report.high_priority_count}")
            print()

            if result.opportunity_report.opportunities:
                print("Opportunities Found:")
                for i, opp in enumerate(result.opportunity_report.opportunities, 1):
                    print(f"\n{i}. {opp['signal_type'].upper()}")
                    print(f"   Category: {opp['category']}")
                    print(f"   Confidence: {opp['confidence']:.2f}")
                    print(f"   Pass: {opp['pass']}")
                    print(f"   Evidence Count: {opp['evidence_count']}")
                    if opp.get('yp_service'):
                        print(f"   YP Service Match: {opp['yp_service']}")
                    print(f"   Recommended Action: {opp['recommended_action']}")
            else:
                print("❌ No opportunities found")
        else:
            print("❌ No opportunity report generated")

        # Show pass results
        print("\n" + "-"*80)
        print("PASS-BY-PASS BREAKDOWN")
        print("-"*80 + "\n")

        for pass_result in result.pass_results:
            print(f"Pass {pass_result.pass_number}:")
            print(f"  Strategy: {pass_result.strategy}")
            print(f"  Iterations: {len(pass_result.hops)}")
            print(f"  Confidence Delta: +{pass_result.confidence_delta:.2f}")
            print(f"  Validated Signals: {len(pass_result.validated_signals)}")
            print()

        # =======================================================================
        # CRITICAL VERIFICATION
        # =======================================================================

        print("="*80)
        print("VERIFICATION: Did we find the tenders page?")
        print("="*80 + "\n")

        # Check if any hop found the tenders page
        found_tenders = False
        for pass_result in result.pass_results:
            for hop in pass_result.hops:
                if hop.get('url') and 'canoeicf.com/tenders' in hop['url']:
                    print(f"✅ YES! Found tenders page in Pass {pass_result.pass_number}")
                    print(f"   URL: {hop['url']}")
                    print(f"   Hop Type: {hop['hop_type']}")
                    print(f"   Decision: {hop['decision']}")
                    print(f"   Evidence: {hop.get('evidence_found', 'N/A')[:100]}...")
                    found_tenders = True
                    break

        if not found_tenders:
            print("❌ Tenders page not found in any hop")
            print("\nThis means:")
            print("  - Either the search didn't return the tenders page in top results")
            print("  - Or the hop type wasn't selected by EIG scoring")
            print("  - Need to investigate further")

        print("\n" + "="*80)
        print("TEST COMPLETE")
        print("="*80 + "\n")

        return result

    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    result = asyncio.run(test_icf_full_production())

    if result:
        print("\n✅ Test completed successfully")
    else:
        print("\n❌ Test failed")
        sys.exit(1)
