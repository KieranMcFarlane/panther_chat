#!/usr/bin/env python3
"""
Test LinkedIn profile extraction for decision makers.
"""
import asyncio
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
from dossier_data_collector import DossierDataCollector

# Load environment from project root
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


async def test_linkedin_extraction():
    """Test LinkedIn profile extraction with Coventry City."""
    print("🔍 Testing LinkedIn Profile Extraction for Coventry City FC")
    print("=" * 60)

    collector = DossierDataCollector()

    # Test with Coventry City leadership collection (includes LinkedIn search)
    result = await collector.collect_leadership(
        entity_id='coventry-city-fc',
        entity_name='Coventry City FC'
    )

    print('\n=== LEADERSHIP COLLECTION RESULTS ===')
    decision_makers = result.get('decision_makers', [])
    print(f'Decision makers found: {len(decision_makers)}')
    print()

    linkedin_count = 0
    for i, dm in enumerate(decision_makers, 1):
        name = dm.get('name', 'Unknown')
        role = dm.get('role', 'Unknown')
        linkedin = dm.get('linkedin_url', None)

        print(f'{i}. {name}')
        print(f'   Role: {role}')
        if linkedin:
            print(f'   LinkedIn: ✅ {linkedin}')
            linkedin_count += 1
        else:
            print(f'   LinkedIn: ❌ Not found')
        print()

    print('---')
    print(f'LinkedIn profiles found: {linkedin_count}/{len(decision_makers)}')
    print('Sources used:', result.get('sources_used', []))
    print('Total signals:', result.get('total_signals', 0))

    # Save updated dossier
    import json
    from pathlib import Path

    # Load existing premium dossier
    premium_path = Path(__file__).parent / 'data' / 'dossiers' / 'premium' / 'coventry-city-fc.json'
    if premium_path.exists():
        with open(premium_path, 'r') as f:
            dossier = json.load(f)

        # Update leadership_profile with LinkedIn URLs
        dossier['leadership_profile']['decision_makers'] = decision_makers

        # Save updated dossier
        with open(premium_path, 'w') as f:
            json.dump(dossier, f, indent=2)

        print(f'\n✅ Updated dossier saved to: {premium_path}')
        print(f'   Leadership profile now includes LinkedIn URLs')

    return result


if __name__ == '__main__':
    asyncio.run(test_linkedin_extraction())
