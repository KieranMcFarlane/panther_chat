#!/usr/bin/env python3
"""
Premier League Club Comparison Discovery

Tests the signal classification system on multiple Premier League clubs
to demonstrate cross-entity intelligence and comparison capabilities.
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
from backend.schemas import RalphDecisionType, SignalClass
from backend.hypothesis_persistence_native import get_hypothesis_repository


# Premier League clubs to analyze
CLUBS = [
    {
        'entity_id': 'chelsea-fc',
        'entity_name': 'Chelsea FC',
        'search_keywords': {
            'crm': ['Chelsea FC CRM "Head of"', 'Chelsea "CRM system" salesforce'],
            'analytics': ['Chelsea FC "data analytics" platform', 'Chelsea "analytics partner"'],
            'ticketing': ['Chelsea FC "ticketing system" procurement', 'Chelsea "season ticket" technology'],
        }
    },
    {
        'entity_id': 'liverpool-fc',
        'entity_name': 'Liverpool FC',
        'search_keywords': {
            'crm': ['Liverpool FC CRM "Head of"', 'Liverpool "CRM system" salesforce'],
            'analytics': ['Liverpool FC "data analytics" platform', 'Liverpool "analytics partner"'],
            'ticketing': ['Liverpool FC "ticketing system" procurement', 'Liverpool "season ticket" technology'],
        }
    },
    {
        'entity_id': 'manchester-city-fc',
        'entity_name': 'Manchester City FC',
        'search_keywords': {
            'crm': ['Man City CRM "Head of"', 'Manchester City "CRM system"'],
            'analytics': ['Man City "data analytics" platform', 'Manchester City "analytics partner"'],
            'ticketing': ['Man City "ticketing system" procurement', 'Manchester City "season ticket" technology'],
        }
    }
]


async def discover_club(club, brightdata):
    """Discover signals for a single club"""

    entity_id = club['entity_id']
    entity_name = club['entity_name']
    keywords = club['search_keywords']

    print(f"\n{'='*70}")
    print(f"DISCOVERING: {entity_name}")
    print('='*70)

    all_signals = []
    classified_signals = {
        'CAPABILITY': [],
        'PROCUREMENT_INDICATOR': [],
        'VALIDATED_RFP': []
    }

    # Flatten search queries
    search_queries = []
    for category, queries in keywords.items():
        for query in queries:
            search_queries.append((query, f"{category.upper()} - {query[:30]}..."))

    print(f"Running {len(search_queries)} searches...\n")

    for i, (query, description) in enumerate(search_queries, 1):
        print(f"[{i}/{len(search_queries)}] {description}")

        try:
            search_result = await brightdata.search_engine(query, num_results=3)

            if search_result.get('status') == 'success':
                results = search_result.get('results', [])
                print(f"   ✅ Found {len(results)} results")

                for result in results[:3]:
                    url = result.get('url', '')
                    title = result.get('title', '')

                    # Simulate classification based on description
                    if 'CAPABILITY -' in description:
                        decision = RalphDecisionType.WEAK_ACCEPT
                        confidence = 0.55
                    elif 'PROCUREMENT -' in description:
                        decision = RalphDecisionType.ACCEPT
                        confidence = 0.65
                    else:
                        decision = RalphDecisionType.ACCEPT
                        confidence = 0.60

                    signal_class = classify_signal(decision, confidence, url)

                    if signal_class:
                        signal = {
                            'title': title,
                            'url': url,
                            'decision': decision.value,
                            'confidence': confidence,
                            'class': signal_class.value,
                            'category': description.split(' - ')[0] if ' - ' in description else 'GENERAL'
                        }
                        classified_signals[signal_class.value].append(signal)
                        all_signals.append(signal)
                        print(f"      → {signal_class.value}: {title[:40]}...")
            else:
                print(f"   ❌ Search failed")

        except Exception as e:
            print(f"   ⚠️  Error: {e}")

        await asyncio.sleep(0.5)

    return all_signals, classified_signals


def calculate_hypothesis_states(entity_id, classified_signals):
    """Calculate hypothesis states for a club"""

    categories = {
        'CRM_UPGRADE': ['CRM', 'salesforce'],
        'ANALYTICS_PLATFORM': ['analytics', 'data'],
        'TICKETING_SYSTEM': ['ticketing', 'season ticket'],
    }

    hypothesis_states = {}

    for category, keywords in categories.items():
        cat_capability = []
        cat_indicators = []
        cat_rfps = []

        for signal in classified_signals['CAPABILITY']:
            if any(kw.lower() in signal['title'].lower() for kw in keywords):
                cat_capability.append(signal)

        for signal in classified_signals['PROCUREMENT_INDICATOR']:
            if any(kw.lower() in signal['title'].lower() for kw in keywords):
                cat_indicators.append(signal)

        for signal in classified_signals['VALIDATED_RFP']:
            if any(kw.lower() in signal['title'].lower() for kw in keywords):
                cat_rfps.append(signal)

        if cat_capability or cat_indicators or cat_rfps:
            state = recalculate_hypothesis_state(
                entity_id=entity_id,
                category=category,
                capability_signals=cat_capability,
                procurement_indicators=cat_indicators,
                validated_rfps=cat_rfps
            )
            hypothesis_states[category] = state

    return hypothesis_states


async def main():
    """Run comparison discovery across clubs"""

    print("\n" + "="*70)
    print("PREMIER LEAGUE CLUB COMPARISON")
    print("Temporal Sports Procurement Prediction Engine")
    print("="*70)
    print(f"Start Time: {datetime.now(timezone.utc).isoformat()}")

    # Initialize clients
    print("\n🔧 Initializing clients...")
    claude = ClaudeClient()
    brightdata = BrightDataSDKClient()

    # Store results for all clubs
    all_results = {}

    # Discover each club
    for club in CLUBS:
        signals, classified = await discover_club(club, brightdata)

        # Calculate hypothesis states
        hypothesis_states = calculate_hypothesis_states(club['entity_id'], classified)

        # Store results
        all_results[club['entity_id']] = {
            'entity_name': club['entity_name'],
            'total_signals': len(signals),
            'capability_count': len(classified['CAPABILITY']),
            'procurement_indicator_count': len(classified['PROCUREMENT_INDICATOR']),
            'validated_rfp_count': len(classified['VALIDATED_RFP']),
            'hypothesis_states': {
                cat: {
                    'maturity_score': state.maturity_score,
                    'activity_score': state.activity_score,
                    'state': state.state
                }
                for cat, state in hypothesis_states.items()
            }
        }

        # Print summary for this club
        print(f"\n📊 {club['entity_name']} Summary:")
        print(f"   Total Signals: {len(signals)}")
        print(f"   Categories: {len(hypothesis_states)}")

        for category, state in hypothesis_states.items():
            state_emoji = {'MONITOR': '👁️', 'WARM': '🌡️', 'ENGAGE': '🤝', 'LIVE': '🔥'}.get(state.state, '❓')
            print(f"      {state_emoji} {category}: {state.state} (M: {state.maturity_score:.2f}, A: {state.activity_score:.2f})")

    # Save to database
    print(f"\n" + "="*70)
    print("SAVING TO DATABASE")
    print("="*70)

    try:
        repo = await get_hypothesis_repository()
        if await repo.initialize():
            for entity_id, results in all_results.items():
                for category, state_data in results['hypothesis_states'].items():
                    from backend.schemas import HypothesisState
                    state = HypothesisState(
                        entity_id=entity_id,
                        category=category,
                        maturity_score=state_data['maturity_score'],
                        activity_score=state_data['activity_score'],
                        state=state_data['state']
                    )
                    saved = await repo.save_hypothesis_state(state)
                    status = "✅" if saved else "❌"
                    print(f"{status} {entity_id}/{category}: {state_data['state']}")
        else:
            print("⚠️  Could not connect to database")
    except Exception as e:
        print(f"⚠️  Database error: {e}")

    # Print comparison matrix
    print(f"\n" + "="*70)
    print("CLUB COMPARISON MATRIX")
    print("="*70)

    # Get all unique categories
    all_categories = set()
    for results in all_results.values():
        all_categories.update(results['hypothesis_states'].keys())

    # Print table header
    print(f"\n{'Category':<25} ", end="")
    for club_id, results in all_results.items():
        print(f"| {results['entity_name']:<15} ", end="")
    print()
    print("-" * (25 + 17 * len(CLUBS)))

    # Print each category
    for category in sorted(all_categories):
        print(f"{category:<25} ", end="")

        for club_id, results in all_results.items():
            states = results['hypothesis_states']
            if category in states:
                state = states[category]['state']
                emoji = {'MONITOR': '👁️', 'WARM': '🌡️', 'ENGAGE': '🤝', 'LIVE': '🔥'}.get(state, '❓')
                print(f"| {emoji} {state:<12} ", end="")
            else:
                print(f"| {'—':<15} ", end="")
        print()

    # Print aggregate summary
    print(f"\n" + "="*70)
    print("AGGREGATE SUMMARY")
    print("="*70)

    for entity_id, results in all_results.items():
        state_counts = {'MONITOR': 0, 'WARM': 0, 'ENGAGE': 0, 'LIVE': 0}
        for state in results['hypothesis_states'].values():
            state_counts[state['state']] += 1

        print(f"\n{results['entity_name']}:")
        print(f"   Categories: {len(results['hypothesis_states'])}")
        print(f"   👁️ MONITOR: {state_counts['MONITOR']}")
        print(f"   🌡️ WARM: {state_counts['WARM']}")
        print(f"   🤝 ENGAGE: {state_counts['ENGAGE']}")
        print(f"   🔥 LIVE: {state_counts['LIVE']}")

        # Calculate overall "Procurement Temperature"
        if state_counts['ENGAGE'] >= 2:
            temperature = "HOT 🔥"
        elif state_counts['ENGAGE'] >= 1 or state_counts['WARM'] >= 2:
            temperature = "WARM 🌡️"
        else:
            temperature = "COOL ❄️"
        print(f"   Overall: {temperature}")

    # Save results to file
    output_file = Path(__file__).parent / "premier_league_comparison_results.json"
    with open(output_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'clubs': all_results
        }, f, indent=2)

    print(f"\n📁 Results saved to: {output_file}")
    print(f"   End Time: {datetime.now(timezone.utc).isoformat()}")
    print("="*70 + "\n")


if __name__ == "__main__":
    try:
        asyncio.run(main())
        print("\n✅ Club comparison complete!")
    except Exception as e:
        print(f"\n❌ Discovery failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
