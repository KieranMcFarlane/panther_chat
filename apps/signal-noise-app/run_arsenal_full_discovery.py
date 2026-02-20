#!/usr/bin/env python3
"""
Full Discovery Run on Arsenal FC with Signal Classification

This script runs a complete hypothesis-driven discovery on Arsenal FC
and demonstrates the new signal classification (CAPABILITY, PROCUREMENT_INDICATOR, VALIDATED_RFP).
"""

import asyncio
import sys
import os
import json
from datetime import datetime, timezone
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

# Load environment
from dotenv import load_dotenv
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

from backend.claude_client import ClaudeClient
from backend.brightdata_sdk_client import BrightDataSDKClient
from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
from backend.ralph_loop import classify_signal, recalculate_hypothesis_state
from backend.schemas import RalphDecisionType, SignalClass
from backend.hypothesis_persistence_native import get_hypothesis_repository
from backend.hypothesis_manager import HypothesisManager


async def run_arsenal_discovery():
    """Run full discovery on Arsenal FC"""

    print("\n" + "="*70)
    print("FULL DISCOVERY: ARSENAL FC")
    print("Temporal Sports Procurement Prediction Engine")
    print("="*70)
    print(f"Start Time: {datetime.now(timezone.utc).isoformat()}\n")

    # Initialize clients
    print("🔧 Initializing clients...")
    claude = ClaudeClient()
    brightdata = BrightDataSDKClient()

    # Create discovery instance
    discovery = HypothesisDrivenDiscovery(
        claude_client=claude,
        brightdata_client=brightdata
    )

    # Use a simple test template for discovery
    # Define basic hypotheses manually
    from backend.hypothesis_manager import Hypothesis

    base_hypotheses = [
        Hypothesis(
            hypothesis_id="arsenal-fc-crm-upgrade",
            entity_id="arsenal-fc",
            category="CRM_UPGRADE",
            text="Arsenal FC is planning a CRM system upgrade or implementation",
            status="ACTIVE",
            confidence=0.50,
            priority=0.5
        ),
        Hypothesis(
            hypothesis_id="arsenal-fc-analytics-platform",
            entity_id="arsenal-fc",
            category="ANALYTICS_PLATFORM",
            text="Arsenal FC is implementing or upgrading their fan analytics platform",
            status="ACTIVE",
            confidence=0.50,
            priority=0.5
        ),
        Hypothesis(
            hypothesis_id="arsenal-fc-ticketing-system",
            entity_id="arsenal-fc",
            category="TICKETING_SYSTEM",
            text="Arsenal FC is procuring a new ticketing or membership system",
            status="ACTIVE",
            confidence=0.50,
            priority=0.5
        ),
        Hypothesis(
            hypothesis_id="arsenal-fc-digital-transformation",
            entity_id="arsenal-fc",
            category="DIGITAL_TRANSFORMATION",
            text="Arsenal FC is undergoing a digital transformation initiative",
            status="ACTIVE",
            confidence=0.50,
            priority=0.5
        ),
    ]

    # Run discovery
    print(f"\n🚀 Starting discovery on Arsenal FC")
    print(f"   Hypotheses: {len(base_hypotheses)}")
    print(f"   Max Iterations: 15")
    print(f"   Max Depth: 3\n")

    # Use run_discovery_with_dossier_context which doesn't require template_id
    result = await discovery.run_discovery_with_dossier_context(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        dossier_hypotheses=[
            {
                'category': h.category,
                'text': h.text,
                'confidence': h.confidence
            }
            for h in base_hypotheses
        ],
        max_iterations=15,
        max_depth=3,
        max_cost_usd=5.00
    )

    # Print results
    print("\n" + "="*70)
    print("DISCOVERY RESULTS")
    print("="*70)

    print(f"\n📊 Final Confidence: {result.final_confidence:.2%}")
    print(f"   Total Cost: ${result.total_cost:.2f}")
    print(f"   Iterations: {result.iteration_count}")

    # Classify validated signals
    validated_signals = result.validated_signals if hasattr(result, 'validated_signals') else []

    print(f"\n📈 Validated Signals: {len(validated_signals)}")

    # Group signals by classification
    capability_signals = []
    procurement_indicators = []
    validated_rfps = []

    for signal in validated_signals:
        # Determine signal class
        if hasattr(signal, 'decision'):
            decision = signal.decision if isinstance(signal.decision, RalphDecisionType) else RalphDecisionType.ACCEPT
        else:
            decision = RalphDecisionType.ACCEPT

        confidence = getattr(signal, 'confidence', 0.5)
        source_url = getattr(signal, 'source_url', None)

        signal_class = classify_signal(decision, confidence, source_url)

        signal_info = {
            'id': getattr(signal, 'id', 'unknown'),
            'type': getattr(signal, 'type', 'UNKNOWN'),
            'subtype': getattr(signal, 'subtype', 'UNKNOWN'),
            'confidence': confidence,
            'text': getattr(signal, 'text', ''),
        }

        if signal_class == SignalClass.CAPABILITY:
            capability_signals.append(signal_info)
        elif signal_class == SignalClass.PROCUREMENT_INDICATOR:
            procurement_indicators.append(signal_info)
        elif signal_class == SignalClass.VALIDATED_RFP:
            validated_rfps.append(signal_info)

    # Print classified signals
    print(f"\n" + "-"*70)
    print(f"CAPABILITY Signals: {len(capability_signals)}")
    if capability_signals:
        for s in capability_signals[:5]:  # Show first 5
            print(f"   ✅ [{s['subtype']}] {s['text'][:70]}... (conf: {s['confidence']:.2f})")
        if len(capability_signals) > 5:
            print(f"   ... and {len(capability_signals) - 5} more")

    print(f"\nPROCUREMENT_INDICATOR Signals: {len(procurement_indicators)}")
    if procurement_indicators:
        for s in procurement_indicators[:5]:
            print(f"   🎯 [{s['subtype']}] {s['text'][:70]}... (conf: {s['confidence']:.2f})")
        if len(procurement_indicators) > 5:
            print(f"   ... and {len(procurement_indicators) - 5} more")

    print(f"\nVALIDATED_RFP Signals: {len(validated_rfps)}")
    if validated_rfps:
        for s in validated_rfps:
            print(f"   🔥 [{s['subtype']}] {s['text'][:70]}... (conf: {s['confidence']:.2f})")

    # Calculate hypothesis states per category
    print(f"\n" + "-"*70)
    print("HYPOTHESIS STATES")
    print("-"*70)

    # Group signals by category
    categories = set()
    for s in capability_signals + procurement_indicators + validated_rfps:
        if s['subtype'] != 'UNKNOWN':
            categories.add(s['subtype'])

    hypothesis_states = {}

    for category in sorted(categories):
        cat_capability = [s for s in capability_signals if s['subtype'] == category]
        cat_indicators = [s for s in procurement_indicators if s['subtype'] == category]
        cat_rfps = [s for s in validated_rfps if s['subtype'] == category]

        if cat_capability or cat_indicators or cat_rfps:
            state = recalculate_hypothesis_state(
                entity_id="arsenal-fc",
                category=category,
                capability_signals=cat_capability,
                procurement_indicators=cat_indicators,
                validated_rfps=cat_rfps
            )
            hypothesis_states[category] = state

            # Print state
            state_emoji = {
                'MONITOR': '👁️',
                'WARM': '🌡️',
                'ENGAGE': '🤝',
                'LIVE': '🔥'
            }.get(state.state, '❓')

            print(f"\n{state_emoji} {category}")
            print(f"   Maturity: {state.maturity_score:.2f} ({int(state.maturity_score * 100)}%)")
            print(f"   Activity: {state.activity_score:.2f} ({int(state.activity_score * 100)}%)")
            print(f"   State: {state.state}")

            # Signal breakdown
            if cat_capability:
                print(f"   └─ {len(cat_capability)} capability signals")
            if cat_indicators:
                print(f"   └─ {len(cat_indicators)} procurement indicators")
            if cat_rfps:
                print(f"   └─ {len(cat_rfps)} validated RFPs")

    # Save to persistence
    print(f"\n" + "-"*70)
    print("SAVING TO DATABASE")
    print("-"*70)

    try:
        repo = await get_hypothesis_repository()
        if await repo.initialize():
            for category, state in hypothesis_states.items():
                saved = await repo.save_hypothesis_state(state)
                status = "✅" if saved else "❌"
                print(f"{status} Saved: {category} -> {state.state}")
        else:
            print("⚠️  Could not connect to database")
    except Exception as e:
        print(f"⚠️  Database error: {e}")

    # Summary
    print(f"\n" + "="*70)
    print("SUMMARY")
    print("="*70)

    # Count states by level
    state_counts = {'MONITOR': 0, 'WARM': 0, 'ENGAGE': 0, 'LIVE': 0}
    for state in hypothesis_states.values():
        state_counts[state.state] += 1

    print(f"\nCategories Analyzed: {len(hypothesis_states)}")
    print(f"   MONITOR: {state_counts['MONITOR']}")
    print(f"   WARM: {state_counts['WARM']}")
    print(f"   ENGAGE: {state_counts['ENGAGE']}")
    print(f"   LIVE: {state_counts['LIVE']}")

    print(f"\n💡 Key Insights:")
    if state_counts['LIVE'] > 0:
        print(f"   - {state_counts['LIVE']} category(s) in LIVE state (active procurement)")
    if state_counts['ENGAGE'] > 0:
        print(f"   - {state_counts['ENGAGE']} category(s) in ENGAGE state (sales ready)")
    if state_counts['WARM'] > 0:
        print(f"   - {state_counts['WARM']} category(s) in WARM state (monitoring)")

    # Save results to file
    output_file = Path(__file__).parent / "arsenal_fc_discovery_results.json"
    output_data = {
        'entity_id': 'arsenal-fc',
        'entity_name': 'Arsenal FC',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'final_confidence': result.final_confidence if hasattr(result, 'final_confidence') else 0.0,
        'total_cost': result.total_cost if hasattr(result, 'total_cost') else 0.0,
        'iteration_count': result.iteration_count if hasattr(result, 'iteration_count') else 0,
        'capability_signals_count': len(capability_signals),
        'procurement_indicators_count': len(procurement_indicators),
        'validated_rfps_count': len(validated_rfps),
        'hypothesis_states': {
            cat: {
                'maturity_score': state.maturity_score,
                'activity_score': state.activity_score,
                'state': state.state,
                'last_updated': state.last_updated.isoformat()
            }
            for cat, state in hypothesis_states.items()
        }
    }

    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)

    print(f"\n📁 Results saved to: {output_file}")
    print(f"   End Time: {datetime.now(timezone.utc).isoformat()}")
    print("="*70 + "\n")

    return output_data


if __name__ == "__main__":
    try:
        results = asyncio.run(run_arsenal_discovery())
        print(f"\n✅ Discovery complete!")
        print(f"   Final Confidence: {results['final_confidence']:.2%}")
        print(f"   Categories: {len(results['hypothesis_states'])}")
    except Exception as e:
        print(f"\n❌ Discovery failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
