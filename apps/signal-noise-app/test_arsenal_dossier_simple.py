#!/usr/bin/env python3
"""
Generate enhanced dossier for Arsenal FC - Simple version
"""

import asyncio
import sys
import os
import json
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

import logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')


async def generate_dossier():
    """Generate dossier for Arsenal FC"""
    print("=" * 80)
    print("GENERATING ENHANCED DOSSIER FOR ARSENAL FC")
    print("=" * 80)
    print()

    from dossier_generator import UniversalDossierGenerator
    from claude_client import ClaudeClient

    try:
        # Initialize
        claude = ClaudeClient()
        generator = UniversalDossierGenerator(claude)

        # Generate dossier
        dossier = await generator.generate_universal_dossier(
            entity_id="arsenal-fc",
            entity_name="Arsenal FC",
            priority_score=70,  # STANDARD tier
            entity_type="CLUB"
        )

        # Print summary
        metadata = dossier.get('metadata', {})
        print("✅ Dossier Generated Successfully!")
        print()
        print(f"Entity ID: {metadata.get('entity_id', 'N/A')}")
        print(f"Tier: {metadata.get('tier', 'N/A')}")
        print(f"Generation Time: {dossier.get('generation_time_seconds', 0):.2f}s")
        print(f"Hypotheses: {metadata.get('hypothesis_count', 0)}")
        print(f"Signals: {metadata.get('signal_count', 0)}")
        print()

        # Show executive summary key metrics
        exec_summary = dossier.get('executive_summary', {})
        if exec_summary:
            assessment = exec_summary.get('overall_assessment', {})
            digital_maturity = assessment.get('digital_maturity', {})

            if digital_maturity:
                score = digital_maturity.get('score', 0)
                print(f"📊 Digital Maturity Score: {score}/100")

                # Check for contextual fields
                if 'meaning' in digital_maturity:
                    print(f"   Meaning: {digital_maturity.get('meaning', 'N/A')}")
                if 'why' in digital_maturity:
                    print(f"   Why: {digital_maturity.get('why', 'N/A')}")
                if 'benchmark' in digital_maturity:
                    print(f"   Benchmark: {digital_maturity.get('benchmark', 'N/A')}")
                if 'action' in digital_maturity:
                    print(f"   Action: {digital_maturity.get('action', 'N/A')}")
                print()

        # Check for outreach strategy
        if 'outreach_strategy' in dossier:
            print("🎯 Outreach Strategy: INCLUDED ✅")
            print()
        else:
            print("⚠️ Outreach Strategy: Not found (may need to be added to prompt)")
            print()

        # Save full dossier
        output_file = Path(__file__).parent / "arsenal_fc_dossier.json"
        print(f"💾 Saving full dossier to: {output_file}")

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(dossier, f, indent=2, ensure_ascii=False, default=str)

        print("✅ Dossier saved!")
        print()
        print("=" * 80)
        print("Open the JSON file to see the complete enhanced dossier structure")
        print("=" * 80)

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(generate_dossier())
    sys.exit(0 if success else 1)
