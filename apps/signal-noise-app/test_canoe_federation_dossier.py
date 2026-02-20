#!/usr/bin/env python3
"""
Generate enhanced dossier for International Canoe Federation

Tests the enhanced dossier system with:
- Multi-source intelligence (official site, jobs, press, LinkedIn)
- Contextual score explanations
- Outreach strategy with conversation trees
"""

import asyncio
import sys
import json
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

import logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')


async def generate_dossier():
    """Generate dossier for International Canoe Federation"""
    print("=" * 80)
    print("GENERATING ENHANCED DOSSIER FOR INTERNATIONAL CANOE FEDERATION")
    print("=" * 80)
    print()

    from dossier_generator import UniversalDossierGenerator
    from claude_client import ClaudeClient

    try:
        # Initialize
        claude = ClaudeClient()
        generator = UniversalDossierGenerator(claude)

        # Entity details
        entity_id = "international-canoe-federation"
        entity_name = "International Canoe Federation"
        entity_type = "ORG"

        print(f"🔧 Generating dossier for: {entity_name}")
        print(f"   Entity ID: {entity_id}")
        print(f"   Type: {entity_type}")
        print(f"   Priority Score: 70 (STANDARD tier with outreach strategy)")
        print()

        # Generate dossier
        dossier = await generator.generate_universal_dossier(
            entity_id=entity_id,
            entity_name=entity_name,
            priority_score=70,  # STANDARD tier (includes outreach_strategy)
            entity_type=entity_type
        )

        # Print summary
        metadata = dossier.get('metadata', {})
        print("✅ Dossier Generated Successfully!")
        print()
        print("=" * 80)
        print("DOSSIER SUMMARY")
        print("=" * 80)
        print(f"Entity ID: {metadata.get('entity_id', 'N/A')}")
        print(f"Tier: {metadata.get('tier', 'N/A')}")
        print(f"Generation Time: {dossier.get('generation_time_seconds', 0):.2f}s")
        print(f"Hypotheses: {metadata.get('hypothesis_count', 0)}")
        print(f"Signals: {metadata.get('signal_count', 0)}")
        print()

        # Executive Summary with Score Context
        exec_summary = dossier.get('executive_summary', {})
        if exec_summary:
            print("=" * 80)
            print("EXECUTIVE SUMMARY")
            print("=" * 80)
            print()

            assessment = exec_summary.get('overall_assessment', {})

            # Digital Maturity with Context
            digital_maturity = assessment.get('digital_maturity', {})
            if digital_maturity:
                score = digital_maturity.get('score', 0)
                trend = digital_maturity.get('trend', 'N/A')

                print(f"📊 Digital Maturity Score: {score}/100 ({trend.upper()})")

                # Check for contextual fields
                if 'meaning' in digital_maturity:
                    print(f"   💡 What This Means: {digital_maturity.get('meaning', 'N/A')}")
                if 'why' in digital_maturity:
                    print(f"   🔍 Why This Score: {digital_maturity.get('why', 'N/A')}")
                if 'benchmark' in digital_maturity:
                    print(f"   📈 Benchmark: {digital_maturity.get('benchmark', 'N/A')}")
                if 'action' in digital_maturity:
                    print(f"   ⚡ Action: {digital_maturity.get('action', 'N/A')}")

                # Fallback to strengths/gaps if no context
                if 'meaning' not in digital_maturity:
                    strengths = digital_maturity.get('key_strengths', [])
                    gaps = digital_maturity.get('key_gaps', [])
                    if strengths:
                        print(f"   ✨ Strengths: {', '.join(strengths[:3])}")
                    if gaps:
                        print(f"   ⚠️  Gaps: {', '.join(gaps[:3])}")
                print()

            # Procurement Readiness
            procurement = assessment.get('procurement_readiness', {})
            if procurement:
                budget = procurement.get('budget_availability', 'N/A')
                horizon = procurement.get('decision_horizon', 'N/A')
                fit = procurement.get('strategic_fit', 0)
                print(f"💰 Procurement Readiness:")
                print(f"   Budget: {budget.upper()}")
                print(f"   Decision Horizon: {horizon}")
                print(f"   Strategic Fit: {fit}/100")
                print()

        # Quick Actions
        quick_actions = exec_summary.get('quick_actions', [])
        if quick_actions:
            print("⚡ Quick Actions:")
            for i, action in enumerate(quick_actions[:3], 1):
                action_text = action.get('action', 'N/A')
                priority = action.get('priority', 'N/A')
                timeline = action.get('timeline', 'N/A')
                print(f"   {i}. [{priority}] {action_text} ({timeline})")
            print()

        # Key Insights
        key_insights = exec_summary.get('key_insights', [])
        if key_insights:
            print("💡 Key Insights:")
            for insight in key_insights[:3]:
                insight_text = insight.get('insight', 'N/A')
                signal_type = insight.get('signal_type', 'N/A')
                confidence = insight.get('confidence', 0)
                preview = insight_text[:120] + "..." if len(insight_text) > 120 else insight_text
                print(f"   • {signal_type} {preview} (confidence: {confidence}%)")
            print()

        # Outreach Strategy (NEW FEATURE)
        outreach = dossier.get('outreach_strategy')
        if outreach:
            print("=" * 80)
            print("🎯 OUTREACH STRATEGY (NEW)")
            print("=" * 80)
            print()

            connection = outreach.get('connection_intelligence', {})
            if connection:
                approach = connection.get('approach_type', 'N/A')
                print(f"🤝 Approach Type: {approach.upper()}")

                starters = connection.get('conversation_starters', [])
                if starters:
                    print(f"💬 Conversation Starters: {len(starters)}")
                    for i, starter in enumerate(starters[:2], 1):
                        topic = starter.get('topic', 'N/A')
                        relevance = starter.get('relevance', 'N/A')
                        print(f"   {i}. {topic[:80]}...")
                        print(f"      Relevance: {relevance[:80]}...")

                providers = connection.get('current_providers', [])
                if providers:
                    print(f"\n🏢 Current Providers: {len(providers)}")
                    for provider in providers[:2]:
                        name = provider.get('provider', 'N/A')
                        service = provider.get('service', 'N/A')
                        print(f"   • {name} - {service}")
                print()

            # Conversation Trees
            trees = outreach.get('conversation_trees', [])
            if trees:
                print("=" * 80)
                print("💬 CONVERSATION TREES")
                print("=" * 80)
                print()

                for i, tree in enumerate(trees[:2], 1):
                    print(f"Scenario {i}: {tree.get('scenario', 'Unknown')}")
                    print()

                    opening = tree.get('opening_message', {})
                    if opening:
                        subject = opening.get('subject_line', 'N/A')
                        body = opening.get('body', '')
                        rate = opening.get('expected_response_rate', 0)

                        print(f"   Subject: {subject}")
                        preview = body[:150] + "..." if len(body) > 150 else body
                        print(f"   Opening: {preview}")
                        print(f"   Expected Response Rate: {rate}%")
                        print()

                    branches = tree.get('response_branches', [])
                    if branches:
                        print(f"   Response Branches:")
                        for branch in branches[:3]:
                            resp_type = branch.get('response_type', 'unknown').upper()
                            prob = branch.get('probability', 0)
                            print(f"      • {resp_type}: {prob}% likely")

                            followup = branch.get('follow_up_strategy', {})
                            if followup:
                                channel = followup.get('channel', 'N/A')
                                timing = followup.get('timing', 'N/A')
                                print(f"        → Follow-up via {channel} ({timing})")
                        print()

                    anti_patterns = tree.get('anti_patterns', [])
                    if anti_patterns:
                        print(f"   ⚠️  Anti-Patterns: {len(anti_patterns)}")
                        for pattern in anti_patterns[:2]:
                            print(f"      • {pattern}")
                    print()

            # Recommended Approach
            recommended = outreach.get('recommended_approach', {})
            if recommended:
                print("=" * 80)
                print("🎯 RECOMMENDED APPROACH")
                print("=" * 80)
                print()

                channel = recommended.get('primary_channel', 'N/A')
                angle = recommended.get('messaging_angle', 'N/A')
                timing = recommended.get('timing', 'N/A')
                confidence = recommended.get('confidence', 0)
                explanation = recommended.get('confidence_explanation', 'N/A')

                print(f"   Channel: {channel}")
                print(f"   Messaging: {angle}")
                print(f"   Timing: {timing}")
                print(f"   Confidence: {confidence}/100")
                print(f"   Explanation: {explanation[:200]}...")

                next_actions = recommended.get('next_actions', [])
                if next_actions:
                    print(f"\n   Next Actions:")
                    for action in next_actions[:3]:
                        print(f"      • {action}")
                print()

        else:
            print("⚠️  Outreach Strategy: Not included in this generation")
            print("   (Will be added to prompt template for next run)")
            print()

        # Save full dossier
        output_file = Path(__file__).parent / "icf_dossier.json"
        print("=" * 80)
        print(f"💾 Saving full dossier to: {output_file}")

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(dossier, f, indent=2, ensure_ascii=False, default=str)

        print("✅ Dossier saved!")
        print()
        print("=" * 80)
        print("✨ ENHANCED DOSSIER GENERATION COMPLETE!")
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
