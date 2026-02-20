#!/usr/bin/env python3
"""
Generate enhanced dossier for Arsenal FC

This script generates a real dossier with:
- Multi-source intelligence collection (official site, jobs, press, LinkedIn)
- Contextual score explanations
- Outreach strategy with conversation trees
"""

import asyncio
import sys
import os
import json
from pathlib import Path
from datetime import datetime

# Add backend to path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

# Silence some logging for cleaner output
import logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')


async def generate_enhanced_dossier():
    """Generate enhanced dossier for Arsenal FC"""
    print("=" * 80)
    print("ENHANCED DOSSIER GENERATION FOR ARSENAL FC")
    print("=" * 80)
    print()

    # Import after adding to path
    from dossier_generator import UniversalDossierGenerator
    from claude_client import ClaudeClient

    try:
        # Initialize generator
        print("🔧 Initializing dossier generator...")
        claude = ClaudeClient()
        generator = UniversalDossierGenerator(claude)
        print("✅ Generator initialized\n")

        # Generate dossier (STANDARD tier = includes outreach_strategy)
        print("🚀 Generating dossier for Arsenal FC (STANDARD tier)...")
        print("   This includes: multi-source intelligence + outreach strategy\n")

        dossier = await generator.generate_universal_dossier(
            entity_id="arsenal-fc",
            entity_name="Arsenal FC",
            priority_score=70,  # STANDARD tier (includes outreach_strategy)
            entity_type="CLUB"
        )

        print("✅ Dossier generation complete!\n")

        # Display results
        print("=" * 80)
        print("DOSSIER SUMMARY")
        print("=" * 80)
        print()

        # Basic info from metadata
        metadata = dossier.get('metadata', {})
        print(f"Entity ID: {metadata.get('entity_id', dossier.get('entity_id', 'N/A'))}")
        print(f"Generated At: {metadata.get('generated_at', 'N/A')}")
        print(f"Tier: {metadata.get('tier', 'N/A')}")
        print(f"Priority Score: {metadata.get('priority_score', 'N/A')}")
        print(f"Generation Time: {dossier.get('generation_time_seconds', 0):.2f}s")
        print(f"Hypotheses Extracted: {metadata.get('hypothesis_count', 0)}")
        print(f"Signals Extracted: {metadata.get('signal_count', 0)}")
        print()

        # Check for outreach strategy
        outreach_section = next((s for s in sections if s.get('id') == 'outreach_strategy'), None)
        if outreach_section:
            print("=" * 80)
            print("OUTREACH STRATEGY SECTION")
            print("=" * 80)
            print()

            content = outreach_section.get('content', {})

            # Connection Intelligence
            connection = content.get('connection_intelligence', {})
            if connection:
                print("🤝 Connection Intelligence:")
                print(f"   Approach Type: {connection.get('approach_type', 'N/A').upper()}")
                mutuals = connection.get('mutual_connections', [])
                if mutuals:
                    print(f"   Mutual Connections: {', '.join(mutuals[:3])}")
                print()

            # Conversation Trees
            trees = content.get('conversation_trees', [])
            if trees:
                print(f"💬 Conversation Trees: {len(trees)} scenarios")
                for i, tree in enumerate(trees[:2], 1):  # Show first 2
                    print()
                    print(f"   Scenario {i}: {tree.get('scenario', 'Unknown')}")

                    opening = tree.get('opening_message', {})
                    if opening:
                        print(f"   Subject: {opening.get('subject_line', 'N/A')}")
                        body = opening.get('body', '')
                        if body:
                            preview = body[:150] + "..." if len(body) > 150 else body
                            print(f"   Opening: {preview}")

                    branches = tree.get('response_branches', [])
                    if branches:
                        print(f"   Response Branches: {len(branches)}")
                        for branch in branches[:3]:
                            resp_type = branch.get('response_type', 'unknown')
                            prob = branch.get('probability', 0)
                            print(f"      - {resp_type.upper()}: {prob}% likely")

                    anti_patterns = tree.get('anti_patterns', [])
                    if anti_patterns:
                        print(f"   Anti-Patterns: {len(anti_patterns)} warnings")
                print()

            # Recommended Approach
            recommended = content.get('recommended_approach', {})
            if recommended:
                print("🎯 Recommended Approach:")
                print(f"   Channel: {recommended.get('primary_channel', 'N/A')}")
                print(f"   Messaging: {recommended.get('messaging_angle', 'N/A')}")
                print(f"   Timing: {recommended.get('timing', 'N/A')}")
                print(f"   Confidence: {recommended.get('confidence', 0)}/100")
                explanation = recommended.get('confidence_explanation', '')
                if explanation:
                    print(f"   Explanation: {explanation[:200]}...")

                next_actions = recommended.get('next_actions', [])
                if next_actions:
                    print(f"   Next Actions:")
                    for action in next_actions[:3]:
                        print(f"      - {action}")
                print()

        # Executive Summary with Score Context
        exec_summary = dossier.get('executive_summary', {})
        if exec_summary:
            print("=" * 80)
            print("EXECUTIVE SUMMARY (WITH SCORE CONTEXT)")
            print("=" * 80)
            print()

            # Digital Maturity
            assessment = exec_summary.get('overall_assessment', {})
            digital_maturity = assessment.get('digital_maturity', {})

            if digital_maturity:
                score = digital_maturity.get('score', 0)
                trend = digital_maturity.get('trend', 'N/A')
                strengths = digital_maturity.get('key_strengths', [])
                gaps = digital_maturity.get('key_gaps', [])

                print(f"📊 Digital Maturity Score: {score}/100")
                print(f"   Trend: {trend.upper()}")
                if strengths:
                    print(f"   Strengths: {', '.join(strengths[:3])}")
                if gaps:
                    print(f"   Gaps: {', '.join(gaps[:3])}")
                print()

        # Save to file
        output_file = Path(__file__).parent / "arsenal_fc_enhanced_dossier.json"
        print("=" * 80)
        print(f"💾 Saving full dossier to: {output_file}")

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(dossier, f, indent=2, ensure_ascii=False, default=str)

        print("✅ Dossier saved!")
        print()

        print("=" * 80)
        print("✨ ENHANCED DOSSIER GENERATION COMPLETE!")
        print("=" * 80)
        print()
        print("Key Features Demonstrated:")
        print("  ✅ Multi-source intelligence (official site, jobs, press, LinkedIn)")
        print("  ✅ Contextual score explanations (meaning, why, benchmark, action)")
        print("  ✅ Outreach strategy with conversation trees")
        print("  ✅ Connection intelligence and recommended approach")
        print("  ✅ Anti-pattern warnings for sales")
        print()

        return True

    except Exception as e:
        print(f"❌ Error generating dossier: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Main entry point"""
    success = await generate_enhanced_dossier()
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
