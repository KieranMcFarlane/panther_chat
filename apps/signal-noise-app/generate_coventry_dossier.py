#!/usr/bin/env python3
"""
Generate dossier for Coventry City FC and display results
"""

import asyncio
import json
import sys
sys.path.insert(0, ".")

async def generate_dossier():
    from backend.dossier_data_collector import DossierDataCollector
    from backend.dossier_generator import EntityDossierGenerator
    from backend.claude_client import ClaudeClient

    print("="*80)
    print("GENERATING DOSSIER: Coventry City FC")
    print("="*80)
    print()

    # Initialize
    claude = ClaudeClient()
    generator = EntityDossierGenerator(claude)
    collector = DossierDataCollector()

    entity_id = "coventry-city-fc"
    entity_name = "Coventry City FC"

    print("Step 1: Collecting leadership data...")
    leadership = await collector.collect_leadership(entity_id, entity_name)
    dms = leadership.get("decision_makers", [])
    print(f"  ✓ Found {len(dms)} decision makers")
    print()

    print("Step 2: Generating dossier...")
    dossier = await generator.generate_dossier(entity_id, entity_name)

    print(f"  ✓ Dossier generated!")
    print(f"  - Tier: {dossier.tier if hasattr(dossier, 'tier') else 'N/A'}")
    print(f"  - Sections: {len(dossier.sections) if hasattr(dossier, 'sections') else 'N/A'}")
    print()

    print("="*80)
    print("DOSSIER CONTENTS")
    print("="*80)
    print()

    # Display leadership section
    print("📋 KEY DECISION MAKERS:")
    for dm in dms[:6]:
        name = dm.get("name", "Unknown")
        role = dm.get("role", "Unknown")
        linkedin = dm.get("linkedin_url", "")
        confidence = dm.get("confidence", 0)
        linkedin_badge = "✅" if linkedin else "❌"
        print(f"  • {name}")
        print(f"    Role: {role}")
        print(f"    Confidence: {confidence}% {linkedin_badge}")
        if linkedin:
            print(f"    LinkedIn: {linkedin}")
        print()

    print("="*80)
    print("FULL RESULTS")
    print("="*80)
    print()

    results = {
        "entity_id": entity_id,
        "entity_name": entity_name,
        "status": "success",
        "leadership": {
            "count": len(dms),
            "decision_makers": dms
        },
        "sources_used": leadership.get("sources_used", []),
        "fresh_signals": leadership.get("fresh_signals_count", 0),
        "dossier_tier": str(dossier.tier) if hasattr(dossier, 'tier') else "N/A",
        "sections_count": len(dossier.sections) if hasattr(dossier, 'sections') else 0
    }

    print(json.dumps(results, indent=2, default=str))
    print()

    print("="*80)
    print("URLS TO VIEW")
    print("="*80)
    print()
    print("Frontend Dossier Page:")
    print(f"  http://localhost:3005/entity-browser/{entity_id}/dossier?generate=true")
    print()

if __name__ == "__main__":
    asyncio.run(generate_dossier())
