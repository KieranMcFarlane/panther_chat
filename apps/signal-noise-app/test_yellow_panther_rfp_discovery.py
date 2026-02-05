#!/usr/bin/env python3
"""
Yellow Panther RFP Discovery Test Script

Demonstrates how to use the hypothesis-driven discovery system
to find RFPs and digital transformation opportunities for Yellow Panther.

Usage:
    python test_yellow_panther_rfp_discovery.py

Expected Output:
    - RFP opportunities for target entities
    - Confidence scores for each opportunity
    - Detailed signals and evidence
"""

import asyncio
import sys
from datetime import datetime

sys.path.insert(0, '.')

from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
from backend.claude_client import ClaudeClient
from backend.brightdata_sdk_client import BrightDataSDKClient


async def test_yellow_panther_rfp_discovery():
    """Test RFP discovery with Yellow Panther template"""

    print('=' * 80)
    print('🎯 YELLOW PANTHER RFP DISCOVERY TEST')
    print('=' * 80)
    print(f'Test Time: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print()

    # Initialize clients
    claude = ClaudeClient()
    brightdata = BrightDataSDKClient()
    discovery = HypothesisDrivenDiscovery(claude, brightdata)

    # Test entities (Premier League clubs)
    test_entities = [
        ("arsenal-fc", "Arsenal FC"),
        ("chelsea-fc", "Chelsea FC"),
        ("manchester-united-fc", "Manchester United")
    ]

    print(f'📋 Monitoring {len(test_entities)} entities for RFP opportunities...')
    print(f'📝 Template: yellow_panther_agency')
    print(f'🔍 Max iterations: 10 (fast mode)')
    print()

    opportunities = []

    for entity_id, entity_name in test_entities:
        print('-' * 80)
        print(f'🔍 Analyzing: {entity_name}')
        print('-' * 80)

        try:
            # Run discovery with Yellow Panther template
            result = await discovery.run_discovery(
                entity_id=entity_id,
                entity_name=entity_name,
                template_id="yellow_panther_agency",
                max_iterations=10,
                max_depth=2
            )

            # Check if RFP opportunity detected
            confidence = result.get('final_confidence', 0)
            band = result.get('band', 'UNKNOWN')

            print(f'\n📊 Results for {entity_name}:')
            print(f'   Confidence: {confidence:.3f} ({band})')
            print(f'   Iterations: {result.get("iteration_count", 0)}')
            print(f'   Signals: {len(result.get("validated_signals", []))}')
            print(f'   Cost: ${result.get("total_cost", 0):.2f}')

            # Show top signals
            signals = result.get('validated_signals', [])
            if signals:
                print(f'\n   Top Signals:')
                for i, signal in enumerate(signals[:3], 1):
                    signal_type = signal.get('type', 'UNKNOWN')
                    confidence = signal.get('confidence', 0)
                    print(f'   {i}. {signal_type} (confidence: {confidence:.2f})')

            # Check if opportunity threshold met
            if confidence >= 0.70:
                print(f'\n   ✅ HIGH PRIORITY RFP OPPORTUNITY!')
                opportunities.append({
                    'entity': entity_name,
                    'confidence': confidence,
                    'band': band,
                    'signals': len(signals),
                    'recommended_action': 'Immediate outreach'
                })
            elif confidence >= 0.50:
                print(f'\n   ⚠️  MEDIUM PRIORITY - Monitor weekly')
                opportunities.append({
                    'entity': entity_name,
                    'confidence': confidence,
                    'band': band,
                    'signals': len(signals),
                    'recommended_action': 'Add to watchlist'
                })
            else:
                print(f'\n   📊 Low priority - continue monitoring')

        except Exception as e:
            print(f'\n   ❌ Error: {e}')

        print()

    # Generate summary report
    print('=' * 80)
    print('📈 YELLOW PANTHER RFP OPPORTUNITY SUMMARY')
    print('=' * 80)
    print()

    if opportunities:
        print(f'✅ Found {len(opportunities)} RFP opportunities:\n')

        # Sort by confidence (descending)
        opportunities.sort(key=lambda x: x['confidence'], reverse=True)

        for i, opp in enumerate(opportunities, 1):
            confidence = opp['confidence']
            entity = opp['entity']
            action = opp['recommended_action']

            if confidence >= 0.70:
                print(f'{i}. 🚨 {entity} - {confidence:.2f} (HIGH PRIORITY)')
            else:
                print(f'{i}. ⚠️  {entity} - {confidence:.2f} (MEDIUM)')

            print(f'   Signals: {opp["signals"]}')
            print(f'   Action: {action}')
            print()

        # Recommendations
        print('💡 Recommendations:')
        print('-' * 80)

        high_priority = [o for o in opportunities if o['confidence'] >= 0.70]
        medium_priority = [o for o in opportunities if 0.50 <= o['confidence'] < 0.70]

        if high_priority:
            print(f'\n✅ High Priority ({len(high_priority)}):')
            for opp in high_priority:
                print(f'  • {opp["entity"]} - Prepare proposal immediately')

        if medium_priority:
            print(f'\n⚠️  Medium Priority ({len(medium_priority)}):')
            for opp in medium_priority:
                print(f'  • {opp["entity"]} - Monitor weekly for changes')

    else:
        print('No RFP opportunities detected in this run.')
        print('Continue monitoring these entities weekly.')

    print()
    print('=' * 80)
    print('✅ TEST COMPLETE')
    print('=' * 80)
    print()
    print('Next Steps:')
    print('1. Review high-priority opportunities')
    print('2. Prepare proposals for entities with confidence ≥ 0.70')
    print('3. Add medium-priority entities to weekly monitoring schedule')
    print('4. Expand monitoring to more entities (Premier League, La Liga, etc.)')


async def test_single_entity():
    """Test RFP discovery for a single entity (faster testing)"""

    print('=' * 80)
    print('🎯 YELLOW PANTHER RFP DISCOVERY - SINGLE ENTITY TEST')
    print('=' * 80)
    print()

    # Initialize clients
    claude = ClaudeClient()
    brightdata = BrightDataSDKClient()
    discovery = HypothesisDrivenDiscovery(claude, brightdata)

    # Test with Arsenal FC
    entity_id = "arsenal-fc"
    entity_name = "Arsenal FC"

    print(f'🔍 Analyzing: {entity_name}')
    print(f'📝 Template: yellow_panther_agency')
    print(f'🔍 Max iterations: 10')
    print()

    result = await discovery.run_discovery(
        entity_id=entity_id,
        entity_name=entity_name,
        template_id="yellow_panther_agency",
        max_iterations=10,
        max_depth=2
    )

    # Detailed results
    print('=' * 80)
    print('📊 DETAILED RESULTS')
    print('=' * 80)
    print()

    confidence = result.get('final_confidence', 0)
    band = result.get('band', 'UNKNOWN')

    print(f'Entity: {entity_name}')
    print(f'Final Confidence: {confidence:.3f}')
    print(f'Confidence Band: {band}')
    print(f'Iterations: {result.get("iteration_count", 0)}')
    print(f'Total Cost: ${result.get("total_cost", 0):.2f}')
    print(f'Discovery Method: {result.get("discovery_method", "unknown")}')
    print()

    # Show all validated signals
    signals = result.get('validated_signals', [])
    print(f'Validated Signals ({len(signals)} total):')
    print('-' * 80)

    for i, signal in enumerate(signals, 1):
        signal_type = signal.get('type', 'UNKNOWN')
        confidence = signal.get('confidence', 0)
        first_seen = signal.get('first_seen', 'Unknown')

        print(f'{i}. {signal_type}')
        print(f'   Confidence: {confidence:.2f}')
        print(f'   First Seen: {first_seen}')

        # Show evidence count
        evidence = signal.get('evidence', [])
        if evidence:
            print(f'   Evidence: {len(evidence)} sources')

    print()

    # Verdict
    print('=' * 80)
    print('💡 OPPORTITY VERDICT')
    print('=' * 80)
    print()

    if confidence >= 0.70:
        print('✅ HIGH PRIORITY RFP OPPORTUNITY!')
        print()
        print('Recommended Actions:')
        print('  1. Prepare proposal for Yellow Panther services')
        print('  2. Research entity\'s current technology stack')
        print('  3. Identify key stakeholders for outreach')
        print('  4. Tailor proposal to detected signals')
        print()
        print('Estimated Value: £100K - £500K')
        print('Timeline: RFP expected in 1-3 months')

    elif confidence >= 0.50:
        print('⚠️  MEDIUM PRIORITY OPPORTUNITY')
        print()
        print('Recommended Actions:')
        print('  1. Add to weekly monitoring schedule')
        print('  2. Monitor job board for related roles')
        print('  3. Track press releases for digital initiatives')
        print('  4. Prepare for potential RFP in 3-6 months')

    else:
        print('📊 LOW PRIORITY - CONTINUE MONITORING')
        print()
        print('Current Status:')
        print('  - No immediate RFP opportunity detected')
        print('  - Entity shows some digital capability')
        print('  - Continue monthly monitoring')

    print()
    print('=' * 80)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Test Yellow Panther RFP discovery')
    parser.add_argument(
        '--entity',
        type=str,
        help='Test specific entity (e.g., arsenal-fc)'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Test all Premier League entities (slower)'
    )

    args = parser.parse_args()

    if args.entity:
        # Test single entity
        asyncio.run(test_single_entity())
    else:
        # Test multiple entities
        asyncio.run(test_yellow_panther_rfp_discovery())
