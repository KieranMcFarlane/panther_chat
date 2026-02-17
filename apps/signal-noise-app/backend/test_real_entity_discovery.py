#!/usr/bin/env python3
"""
Real Entity Discovery Test with Question-First Hypotheses
"""

import asyncio
import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from brightdata_sdk_client import BrightDataSDKClient
from entity_type_dossier_questions import generate_hypothesis_batch


async def test_real_entity():
    """Test discovery with a real sports entity"""

    # Test entity - Manchester United (lots of procurement activity)
    entity_id = 'manchester-united'
    entity_name = 'Manchester United'
    entity_type = 'SPORT_CLUB'

    print('=' * 80)
    print(f'REAL ENTITY DISCOVERY TEST: {entity_name}')
    print('=' * 80)
    print(f'Entity ID: {entity_id}')
    print(f'Entity Type: {entity_type}')
    print(f'Started: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")} UTC')

    if not os.getenv('BRIGHTDATA_API_TOKEN'):
        print('\n⚠️  BRIGHTDATA_API_TOKEN not set - skipping real scraping')
        return None

    # Step 1: Generate question-first hypotheses
    print('\n' + '=' * 80)
    print('STEP 1: Generate Question-First Hypotheses')
    print('=' * 80)

    hypotheses = generate_hypothesis_batch(
        entity_type=entity_type,
        entity_name=entity_name,
        entity_id=entity_id,
        max_questions=5
    )

    print(f'\n📋 Generated {len(hypotheses)} hypotheses:\n')

    hypothesis_list = []
    for hyp in hypotheses:
        print(f'📋 {hyp["statement"]}')
        print(f'   Confidence: {hyp["confidence"]:.2f}')
        print(f'   YP Services: {", ".join(hyp["metadata"]["yp_service_fit"])}')
        print(f'   Budget: {hyp["metadata"]["budget_range"]}')

        # Show RFP keywords
        for signal in hyp['metadata']['next_signals']:
            if 'RFP keywords' in signal or 'rfp' in signal.lower():
                print(f'   RFP Terms: {signal[:120]}...')
                break
        print()

        hypothesis_list.append(hyp)

    # Step 2: Run targeted discovery searches
    print('=' * 80)
    print('STEP 2: Targeted Discovery with RFP Synonyms')
    print('=' * 80)

    brightdata = BrightDataSDKClient()

    # Build targeted searches from hypotheses
    targeted_searches = []

    # Extract RFP keywords and create targeted searches
    for hyp in hypothesis_list[:3]:
        for signal in hyp['metadata']['next_signals']:
            if 'RFP keywords' in signal:
                keywords = signal.split(':')[1].strip()
                targeted_searches.append(f'"{entity_name}" {keywords}')
                break

    # Add job posting searches
    for hyp in hypothesis_list[:2]:
        for signal in hyp['metadata']['next_signals']:
            if 'Job postings:' in signal:
                job_titles = signal.split(':')[1].strip()
                targeted_searches.append(f'"{entity_name}" {job_titles}')
                break

    # Add site-specific search
    targeted_searches.append(f'site:manutd.com tender OR procurement OR vendor OR supplier OR "request for proposal"')

    print(f'\n🔍 Running {len(targeted_searches)} targeted searches...')
    print('(Limiting to 5 for cost control)\n')

    all_results = []
    rfp_count = 0

    for i, query in enumerate(targeted_searches[:5], 1):
        print(f'Search {i}/{min(len(targeted_searches), 5)}: {query[:80]}...')

        try:
            result = await brightdata.search_engine(
                query=query,
                engine='google',
                num_results=5
            )

            if result.get('status') == 'success':
                results = result.get('results', [])
                print(f'  ✅ Found {len(results)} results')
                all_results.extend(results)

                # Check for procurement signals
                for r in results:
                    text = f'{r.get("title", "")} {r.get("snippet", "")}'.lower()
                    rfp_terms = ['rfp', 'request for proposal', 'tender', 'itt', 'eoi',
                                  'procurement', 'vendor portal', 'supplier portal']

                    if any(term in text for term in rfp_terms):
                        if rfp_count < 3:  # Limit output
                            print(f'  🎯 PROCUREMENT SIGNAL: {r.get("title", "")[:70]}')
                        rfp_count += 1
            else:
                print(f'  ❌ Failed: {result.get("message", "Unknown")}')

        except Exception as e:
            print(f'  ❌ Error: {e}')

        print()

    # Step 3: Summary
    print('=' * 80)
    print('DISCOVERY SUMMARY')
    print('=' * 80)
    print(f'Entity: {entity_name}')
    print(f'Entity Type: {entity_type}')
    print(f'Hypotheses Generated: {len(hypotheses)}')
    print(f'Searches Run: {min(len(targeted_searches), 5)}')
    print(f'Total Results: {len(all_results)}')
    print(f'Procurement Signals: {rfp_count}')

    # YP Service Opportunity Summary
    print(f'\n📊 YP Service Opportunities:')

    yp_services = {}
    for hyp in hypotheses:
        for service in hyp['metadata']['yp_service_fit']:
            yp_services[service] = yp_services.get(service, 0) + 1

    for service, count in yp_services.items():
        print(f'  • {service}: {count} hypothesis(es)')

    print('\n' + '=' * 80)
    print('✅ Real Entity Discovery Test Complete')
    print('=' * 80)

    return {
        'entity_id': entity_id,
        'entity_name': entity_name,
        'hypotheses': len(hypotheses),
        'searches_run': min(len(targeted_searches), 5),
        'results': len(all_results),
        'procurement_signals': rfp_count
    }


if __name__ == '__main__':
    asyncio.run(test_real_entity())
