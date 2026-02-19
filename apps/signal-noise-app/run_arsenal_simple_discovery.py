#!/usr/bin/env python3
"""
Simple Arsenal FC Discovery Test with Signal Classification

This script performs a streamlined discovery on Arsenal FC and demonstrates
the new signal classification system.
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
from backend.ralph_loop import classify_signal, recalculate_hypothesis_state
from backend.schemas import RalphDecisionType, SignalClass, Signal, Evidence


async def scrape_and_classify():
    """Scrape Arsenal FC and classify signals"""

    print("\n" + "="*70)
    print("ARSENAL FC DISCOVERY WITH SIGNAL CLASSIFICATION")
    print("="*70)
    print(f"Start Time: {datetime.now(timezone.utc).isoformat()}\n")

    # Initialize clients
    print("🔧 Initializing clients...")
    claude = ClaudeClient()
    brightdata = BrightDataSDKClient()

    # Define search queries for Arsenal FC procurement signals
    search_queries = [
        ('Arsenal FC CRM "Head of"', 'CAPABILITY - Leadership role for CRM'),
        ('Arsenal FC "ticketing system" procurement', 'PROCUREMENT - Ticketing procurement'),
        ('Arsenal FC "data analytics" platform', 'CAPABILITY - Analytics capability'),
        ('Arsenal FC "digital transformation" partnership', 'PROCUREMENT - Digital initiatives'),
        ('Arsenal FC "CRM system" "salesforce" OR "hubspot"', 'CAPABILITY - CRM platforms'),
        ('Arsenal FC tender RFP "software"', 'VALIDATED_RFP - Official tender'),
        ('Arsenal FC "vendor management" system', 'PROCUREMENT - Vendor systems'),
    ]

    all_raw_signals = []
    classified_signals = {
        'CAPABILITY': [],
        'PROCUREMENT_INDICATOR': [],
        'VALIDATED_RFP': []
    }

    print(f"\n🔍 Running {len(search_queries)} searches...\n")

    for i, (query, description) in enumerate(search_queries, 1):
        print(f"[{i}/{len(search_queries)}] {description}")
        print(f"   Query: {query}")

        try:
            # Search using BrightData
            search_result = await brightdata.search_engine(query, num_results=3)

            if search_result.get('status') == 'success':
                results = search_result.get('results', [])
                print(f"   ✅ Found {len(results)} results")

                for result in results[:3]:  # Limit to 3 per query
                    url = result.get('url', '')
                    title = result.get('title', '')
                    snippet = result.get('snippet', '')

                    # Create a simulated signal
                    # In real system, Ralph Loop would classify these
                    # Here we simulate based on query type

                    raw_signal = {
                        'query': query,
                        'description': description,
                        'url': url,
                        'title': title,
                        'snippet': snippet[:200] if snippet else ''
                    }

                    # Simulate Ralph Loop decision based on query content
                    if 'CAPABILITY' in description:
                        decision = RalphDecisionType.WEAK_ACCEPT
                        confidence = 0.55
                    elif 'VALIDATED_RFP' in description:
                        decision = RalphDecisionType.ACCEPT
                        confidence = 0.78
                    else:
                        decision = RalphDecisionType.ACCEPT
                        confidence = 0.65

                    # Classify the signal
                    signal_class = classify_signal(decision, confidence, url)

                    if signal_class:
                        classified_signals[signal_class.value].append({
                            **raw_signal,
                            'decision': decision.value,
                            'confidence': confidence,
                            'class': signal_class.value
                        })
                        print(f"      → {signal_class.value}: {title[:50]}...")
            else:
                print(f"   ❌ Search failed")

        except Exception as e:
            print(f"   ⚠️  Error: {e}")

        await asyncio.sleep(0.5)  # Rate limiting

    # Print classification summary
    print(f"\n" + "="*70)
    print("CLASSIFICATION SUMMARY")
    print("="*70)

    for signal_class, signals in classified_signals.items():
        print(f"\n{signal_class}: {len(signals)} signals")
        for s in signals[:3]:
            print(f"   - {s['title'][:60]}...")
        if len(signals) > 3:
            print(f"   ... and {len(signals) - 3} more")

    # Calculate hypothesis states
    print(f"\n" + "="*70)
    print("HYPOTHESIS STATE CALCULATION")
    print("="*70)

    # Group signals by category (based on keywords in title/description)
    categories = {
        'CRM_UPGRADE': ['CRM', 'salesforce', 'hubspot'],
        'ANALYTICS_PLATFORM': ['analytics', 'data'],
        'TICKETING_SYSTEM': ['ticketing', 'membership'],
        'DIGITAL_TRANSFORMATION': ['digital', 'transformation'],
        'VENDOR_MANAGEMENT': ['vendor', 'procurement'],
    }

    hypothesis_states = {}

    for category, keywords in categories.items():
        cat_capability = []
        cat_indicators = []
        cat_rfps = []

        # Group signals by category
        for signal in classified_signals['CAPABILITY']:
            if any(kw.lower() in signal['title'].lower() or kw.lower() in signal['description'].lower() for kw in keywords):
                cat_capability.append(signal)

        for signal in classified_signals['PROCUREMENT_INDICATOR']:
            if any(kw.lower() in signal['title'].lower() or kw.lower() in signal['description'].lower() for kw in keywords):
                cat_indicators.append(signal)

        for signal in classified_signals['VALIDATED_RFP']:
            if any(kw.lower() in signal['title'].lower() or kw.lower() in signal['description'].lower() for kw in keywords):
                cat_rfps.append(signal)

        # Only create state if we have signals
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
            print(f"   Signals: {len(cat_capability)} capability, {len(cat_indicators)} indicator, {len(cat_rfps)} RFP")

    # Save to database
    print(f"\n" + "="*70)
    print("SAVING TO DATABASE")
    print("="*70)

    try:
        from backend.hypothesis_persistence_native import get_hypothesis_repository

        repo = await get_hypothesis_repository()
        if await repo.initialize():
            for category, state in hypothesis_states.items():
                saved = await repo.save_hypothesis_state(state)
                status = "✅" if saved else "❌"
                print(f"{status} Saved: {category} -> {state.state}")

            # Verify by reading back
            print(f"\n📖 Verification - Reading back from database:")
            for category in hypothesis_states.keys():
                retrieved = await repo.get_hypothesis_state("arsenal-fc", category)
                if retrieved:
                    print(f"   ✅ {category}: maturity={retrieved.maturity_score:.2f}, "
                          f"activity={retrieved.activity_score:.2f}, state={retrieved.state}")
        else:
            print("⚠️  Could not connect to database")
    except Exception as e:
        print(f"⚠️  Database error: {e}")

    # Save results to file
    output_file = Path(__file__).parent / "arsenal_fc_discovery_results.json"
    output_data = {
        'entity_id': 'arsenal-fc',
        'entity_name': 'Arsenal FC',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'total_signals': sum(len(s) for s in classified_signals.values()),
        'capability_count': len(classified_signals['CAPABILITY']),
        'procurement_indicator_count': len(classified_signals['PROCUREMENT_INDICATOR']),
        'validated_rfp_count': len(classified_signals['VALIDATED_RFP']),
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

    # Final summary
    print(f"\n" + "="*70)
    print("FINAL SUMMARY")
    print("="*70)

    state_counts = {'MONITOR': 0, 'WARM': 0, 'ENGAGE': 0, 'LIVE': 0}
    for state in hypothesis_states.values():
        state_counts[state.state] += 1

    print(f"\nCategories Analyzed: {len(hypothesis_states)}")
    print(f"   MONITOR: {state_counts['MONITOR']}")
    print(f"   WARM: {state_counts['WARM']}")
    print(f"   ENGAGE: {state_counts['ENGAGE']}")
    print(f"   LIVE: {state_counts['LIVE']}")

    print(f"\n📁 Results saved to: {output_file}")
    print(f"   End Time: {datetime.now(timezone.utc).isoformat()}")
    print("="*70 + "\n")

    return output_data


if __name__ == "__main__":
    try:
        results = asyncio.run(scrape_and_classify())
        print(f"\n✅ Discovery complete!")
        print(f"   Total Signals Classified: {results['total_signals']}")
        print(f"   Hypothesis States: {len(results['hypothesis_states'])}")
    except Exception as e:
        print(f"\n❌ Discovery failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
