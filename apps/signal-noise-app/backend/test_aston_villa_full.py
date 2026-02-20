#!/usr/bin/env python3
"""
Full System Test: Aston Villa FC
Tests complete temporal profiling system with all features
"""

import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from brightdata_sdk_client import BrightDataSDKClient
from claude_client import ClaudeClient
from linkedin_profiler import LinkedInProfiler
from schemas import EntityProfile, DossierQuestion, SweepConfig


class AstonVillaProfiler:
    """Complete profiling system for Aston Villa FC"""

    def __init__(self):
        self.brightdata = BrightDataSDKClient()
        self.claude = ClaudeClient()
        self.linkedin_profiler = LinkedInProfiler(self.brightdata)
        self.results = {
            "entity_id": "aston-villa-fc",
            "entity_name": "Aston Villa FC",
            "timestamp": datetime.now().isoformat(),
            "phases": {}
        }

    async def phase_1_linkedin_profiling(self) -> Dict[str, Any]:
        """Phase 1: Multi-pass LinkedIn profiling"""
        print("\n" + "="*80)
        print("PHASE 1: LinkedIn Multi-Pass Profiling")
        print("="*80)

        try:
            profiles_all_passes = []

            # Pass 1: Cached sweep
            print("\n🔄 Pass 1: Cached BrightData sweep...")
            pass1_profiles = await self.linkedin_profiler.profile_entity(
                entity_name="Aston Villa FC",
                pass_number=1,
                use_cached=True
            )
            profiles_all_passes.extend(pass1_profiles)
            print(f"✅ Pass 1: {len(pass1_profiles)} profiles")

            # Pass 2: Targeted deep dive
            print("\n🎯 Pass 2: Targeted deep dive...")
            pass2_profiles = await self.linkedin_profiler.profile_entity(
                entity_name="Aston Villa FC",
                pass_number=2,
                use_cached=False,
                previous_profiles=pass1_profiles
            )
            profiles_all_passes.extend(pass2_profiles)
            print(f"✅ Pass 2: {len(pass2_profiles)} profiles")

            # Extract decision makers (with error handling)
            print("\n👔 Extracting decision makers...")
            try:
                decision_makers = await self.linkedin_profiler.extract_decision_makers(
                    "Aston Villa FC",
                    pass1_profiles + pass2_profiles
                )
                print(f"✅ Decision makers: {len(decision_makers)} identified")
            except Exception as e:
                print(f"⚠️  Decision maker extraction error: {str(e)}")
                decision_makers = []

            # Store results
            phase_results = {
                "pass_1_profiles": len(pass1_profiles),
                "pass_2_profiles": len(pass2_profiles),
                "total_profiles": len(profiles_all_passes),
                "decision_makers": len(decision_makers),
                "key_executives": [
                    {
                        "name": dm.get("name", "Unknown")[:50] if isinstance(dm, dict) else str(dm)[:50],
                        "title": dm.get("title", "Unknown")[:50] if isinstance(dm, dict) else "N/A",
                        "department": dm.get("department", "Unknown") if isinstance(dm, dict) else "N/A"
                    }
                    for dm in decision_makers[:5]
                ] if decision_makers else []
            }

            self.results["phases"]["linkedin_profiling"] = phase_results
            self.results["linkedin_profiles"] = profiles_all_passes
            self.results["decision_makers"] = decision_makers

            return {
                "profiles": profiles_all_passes,
                "decision_makers": decision_makers
            }

        except Exception as e:
            print(f"\n❌ Error in Phase 1: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    async def phase_2_post_signals(self) -> Dict[str, Any]:
        """Phase 2: LinkedIn post signal detection"""
        print("\n" + "="*80)
        print("PHASE 2: LinkedIn Post Signal Detection")
        print("="*80)

        try:
            # Scrape posts
            print("\n📱 Scraping LinkedIn posts...")
            posts = await self.linkedin_profiler.scrape_linkedin_posts(
                entity_name="Aston Villa FC",
                max_posts=30
            )
            print(f"✅ Posts scraped: {len(posts)}")

            # Analyze signals
            signal_counts = {}
            for post in posts:
                for signal in post.get('signals', []):
                    signal_counts[signal] = signal_counts.get(signal, 0) + 1

            print(f"\n📊 Signal breakdown:")
            for signal, count in signal_counts.items():
                print(f"   - {signal}: {count} posts")

            # Detect opportunities
            print("\n💼 Detecting opportunities...")
            opportunities = await self.linkedin_profiler.scrape_company_posts_for_opportunities(
                entity_name="Aston Villa FC"
            )
            print(f"✅ Opportunities: {len(opportunities)} detected")

            # Analyze by type
            opp_types = {}
            for opp in opportunities:
                opp_type = opp.get('opportunity_type', 'UNKNOWN')
                opp_types[opp_type] = opp_types.get(opp_type, 0) + 1

            print(f"\n📈 Opportunity breakdown:")
            for opp_type, count in opp_types.items():
                print(f"   - {opp_type}: {count}")

            # Store results
            phase_results = {
                "posts_analyzed": len(posts),
                "signals_detected": signal_counts,
                "opportunities": len(opportunities),
                "high_confidence_opps": len([o for o in opportunities if o.get('confidence', 0) > 0.7]),
                "opportunity_types": opp_types,
                "top_opportunities": [
                    {
                        "type": o.get('opportunity_type', 'UNKNOWN'),
                        "confidence": o.get('confidence', 0),
                        "context": o.get('context', '')[:150]
                    }
                    for o in opportunities[:5]
                ]
            }

            self.results["phases"]["post_signals"] = phase_results
            self.results["linkedin_posts"] = posts
            self.results["opportunities"] = opportunities

            return {
                "posts": posts,
                "opportunities": opportunities
            }

        except Exception as e:
            print(f"\n❌ Error in Phase 2: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    async def phase_3_mutual_connections(self) -> Dict[str, Any]:
        """Phase 3: Mutual connections discovery"""
        print("\n" + "="*80)
        print("PHASE 3: Mutual Connections Discovery")
        print("="*80)

        try:
            # Yellow Panther LinkedIn profile
            yellow_panther_url = "https://www.linkedin.com/company/yellow-panther-ltd"

            # Get Aston Villa profiles
            print("\n🔍 Finding mutual connections...")
            villa_profiles = self.results.get("linkedin_profiles", [])

            if not villa_profiles:
                print("⚠️  No LinkedIn profiles found, will attempt search-based approach...")
                villa_profiles = []

            mutuals = await self.linkedin_profiler.scrape_mutual_connections(
                yellow_panther_profile_url=yellow_panther_url,
                target_entity_profiles=villa_profiles
            )

            total_connections = sum(len(conns) for conns in mutuals.values())
            print(f"✅ Mutual connections: {total_connections} across {len(mutuals)} entities")

            # Analyze strength
            strong_connections = []
            medium_connections = []
            for entity_id, connections in mutuals.items():
                for conn in connections:
                    if conn.get('strength') == 'STRONG':
                        strong_connections.append(conn)
                    elif conn.get('strength') == 'MEDIUM':
                        medium_connections.append(conn)

            print(f"🤝 Strong connections: {len(strong_connections)}")
            print(f"📈 Medium connections: {len(medium_connections)}")

            # Store results
            phase_results = {
                "entities_checked": len(mutuals),
                "total_connections": total_connections,
                "strong_connections": len(strong_connections),
                "medium_connections": len(medium_connections),
                "top_connections": [
                    {
                        "name": c.get('connection_name', 'Unknown')[:50],
                        "title": c.get('connection_title', 'Unknown')[:50],
                        "strength": c.get('strength', 'UNKNOWN'),
                        "context": c.get('context', '')[:100]
                    }
                    for c in (strong_connections + medium_connections)[:5]
                ]
            }

            self.results["phases"]["mutual_connections"] = phase_results
            self.results["mutual_connections"] = mutuals

            return {"mutuals": mutuals}

        except Exception as e:
            print(f"\n❌ Error in Phase 3: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    async def phase_4_strategic_positioning(self) -> Dict[str, Any]:
        """Phase 4: Generate strategic positioning recommendations"""
        print("\n" + "="*80)
        print("PHASE 4: Strategic Positioning Analysis")
        print("="*80)

        try:
            # Analyze detected signals
            opportunities = self.results.get("opportunities", [])
            posts = self.results.get("linkedin_posts", [])
            mutuals = self.results.get("mutual_connections", {})

            # Count signal types
            signal_counts = {}
            for post in posts:
                for signal in post.get('signals', []):
                    signal_counts[signal] = signal_counts.get(signal, 0) + 1

            opportunity_types = {}
            for opp in opportunities:
                opp_type = opp.get('opportunity_type', 'UNKNOWN')
                opportunity_types[opp_type] = opportunity_types.get(opp_type, 0) + 1

            print(f"\n📊 Signal Analysis:")
            print(f"   Posts signals: {signal_counts}")
            print(f"   Opportunity types: {opportunity_types}")
            print(f"   Mutual connections: {sum(len(c) for c in mutuals.values())}")

            # Determine optimal positioning
            positioning = self._determine_positioning_strategy(
                signal_counts,
                opportunity_types,
                mutuals
            )

            print(f"\n🎯 Recommended Positioning: {positioning['strategy']}")
            print(f"📧 Approach: {positioning['approach']}")
            print(f"⏰  Timing: {positioning['timing']}")
            print(f"📈 Expected Response Rate: {positioning['expected_response_rate']}")
            print(f"🚨 Urgency: {positioning['urgency']}")

            # Generate outreach recommendations
            outreach = self._generate_outreach_recommendations(
                positioning,
                opportunities[:5],
                list(mutuals.values())[:3] if mutuals else []
            )

            print(f"\n📧 Email Subject: {outreach['subject']}")
            print(f"✉️  Template Type: {outreach['template_type']}")

            # Store results
            phase_results = {
                "positioning_strategy": positioning,
                "outreach_recommendations": outreach,
                "signal_analysis": {
                    "signals": signal_counts,
                    "opportunities": opportunity_types,
                    "mutual_connection_count": sum(len(c) for c in mutuals.values())
                }
            }

            self.results["phases"]["strategic_positioning"] = phase_results
            self.results["positioning"] = positioning
            self.results["outreach"] = outreach

            return {
                "positioning": positioning,
                "outreach": outreach
            }

        except Exception as e:
            print(f"\n❌ Error in Phase 4: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    async def phase_5_save_results(self) -> None:
        """Phase 5: Save complete results to JSON"""
        print("\n" + "="*80)
        print("PHASE 5: Saving Results")
        print("="*80)

        try:
            # Create results directory
            results_dir = Path("aston_villa_profiling_results")
            results_dir.mkdir(exist_ok=True)

            # Save full results
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

            # Create serializable results
            serializable_results = self._make_serializable(self.results)

            # Save full results
            full_path = results_dir / f"aston_villa_full_results_{timestamp}.json"
            with open(full_path, 'w') as f:
                json.dump(serializable_results, f, indent=2)
            print(f"✅ Full results saved: {full_path}")

            # Save summary
            summary = self._generate_summary()
            summary_path = results_dir / f"aston_villa_summary_{timestamp}.json"
            with open(summary_path, 'w') as f:
                json.dump(summary, f, indent=2)
            print(f"✅ Summary saved: {summary_path}")

            # Save detailed report
            report = self._generate_detailed_report()
            report_path = results_dir / f"aston_villa_report_{timestamp}.md"
            with open(report_path, 'w') as f:
                f.write(report)
            print(f"✅ Detailed report saved: {report_path}")

            self.results["saved_paths"] = {
                "full_results": str(full_path),
                "summary": str(summary_path),
                "report": str(report_path)
            }

        except Exception as e:
            print(f"\n❌ Error saving results: {str(e)}")
            import traceback
            traceback.print_exc()

    async def run_complete_profiling(self):
        """Run all phases"""
        print("\n" + "🟤"*40)
        print("ASTON VILLA FC - COMPLETE PROFILING SYSTEM")
        print("🟤"*40)

        try:
            # Phase 1: LinkedIn Profiling
            await self.phase_1_linkedin_profiling()

            # Phase 2: Post Signals
            await self.phase_2_post_signals()

            # Phase 3: Mutual Connections
            await self.phase_3_mutual_connections()

            # Phase 4: Strategic Positioning
            await self.phase_4_strategic_positioning()

            # Phase 5: Save Results
            await self.phase_5_save_results()

            # Print final summary
            self._print_final_summary()

        except Exception as e:
            print(f"\n❌ Fatal error: {str(e)}")
            import traceback
            traceback.print_exc()

    def _determine_positioning_strategy(
        self,
        signals: Dict[str, int],
        opportunities: Dict[str, int],
        mutuals: Dict
    ) -> Dict[str, Any]:
        """Determine optimal positioning based on detected intelligence"""

        # Check for RFP signals (highest priority)
        if signals.get('RFP_SIGNAL', 0) > 0 or opportunities.get('RFP_SIGNAL', 0) > 0:
            return {
                "strategy": "SOLUTION_PROVIDER",
                "approach": "Response Mode",
                "timing": "Within 24 hours",
                "channel": "Email + LinkedIn + Phone",
                "expected_response_rate": "60%",
                "urgency": "HIGH",
                "rationale": "Active procurement detected - immediate RFP response required"
            }

        # Check for mutual connections (highest response rate)
        total_mutuals = sum(len(c) for c in mutuals.values())
        if total_mutuals > 0:
            strong_mutuals = sum(
                1 for conns in mutuals.values()
                for conn in conns
                if conn.get('strength') == 'STRONG'
            )
            if strong_mutuals > 0:
                return {
                    "strategy": "TRUSTED_ADVISOR",
                    "approach": "Referral Mode",
                    "timing": "ASAP (warm introduction)",
                    "channel": "Warm intro first, then email",
                    "expected_response_rate": "70%",
                    "urgency": "VARIES",
                    "rationale": f"Strong mutual connections available - use warm intro path"
                }

        # Check for budget announcements
        if opportunities.get('BUDGET_INDICATOR', 0) > 0:
            return {
                "strategy": "SOLUTION_PARTNER",
                "approach": "Strategic Mode",
                "timing": "Within 48 hours",
                "channel": "Email + LinkedIn comment",
                "expected_response_rate": "50%",
                "urgency": "HIGH",
                "rationale": "Budget allocation phase - position as ROI maximizer"
            }

        # Check for partnership seeking
        if opportunities.get('PARTNERSHIP_OPPORTUNITY', 0) > 0:
            return {
                "strategy": "INNOVATION_PARTNER",
                "approach": "Co-creation Mode",
                "timing": "Within 1 week",
                "channel": "LinkedIn respond + Email",
                "expected_response_rate": "40%",
                "urgency": "MEDIUM",
                "rationale": "Seeking partners - collaborative approach works best"
            }

        # Check for digital initiatives
        if signals.get('TECHNOLOGY_SIGNAL', 0) > 0 or opportunities.get('DIGITAL_INITIATIVE', 0) > 0:
            return {
                "strategy": "STRATEGIC_PARTNER",
                "approach": "Advisory Mode",
                "timing": "Within 2 weeks",
                "channel": "LinkedIn + Warm Intro + Email",
                "expected_response_rate": "35%",
                "urgency": "MEDIUM",
                "rationale": "Digital transformation journey - advisory positioning"
            }

        # Check for hiring signals
        if signals.get('HIRING_SIGNAL', 0) > 0 or opportunities.get('HIRING_SIGNAL', 0) > 0:
            return {
                "strategy": "CAPABILITY_PARTNER",
                "approach": "Collaboration Mode",
                "timing": "Within 2 weeks",
                "channel": "LinkedIn + Email",
                "expected_response_rate": "25%",
                "urgency": "LOW-MEDIUM",
                "rationale": "Team expansion - position as scalable platform"
            }

        # Default: Strategic advisory approach
        return {
            "strategy": "STRATEGIC_PARTNER",
            "approach": "Advisory Mode",
            "timing": "Within 2 weeks",
            "channel": "Email + LinkedIn",
            "expected_response_rate": "30%",
            "urgency": "LOW-MEDIUM",
            "rationale": "No urgent signals detected - strategic relationship building"
        }

    def _generate_outreach_recommendations(
        self,
        positioning: Dict[str, Any],
        opportunities: List[Dict],
        mutuals: List[List[Dict]]
    ) -> Dict[str, Any]:
        """Generate specific outreach recommendations"""

        strategy = positioning["strategy"]
        subject = ""
        body_template = ""
        template_type = ""

        if strategy == "SOLUTION_PROVIDER":
            template_type = "RFP_RESPONSE"
            subject = "Aston Villa FC [RFP Topic] Response"
            body_template = """
Hi [Name],

Saw your RFP for [system/topic].

Yellow Panther helped [Similar Club] achieve:
• 40% increase in fan engagement
• 35% reduction in ticket administration
• £2M revenue increase through personalization

Our platform maps directly to your requirements. Full RFP response attached.

Can we schedule a 30-minute call this week?

Best,
[Your Name]
            """.strip()

        elif strategy == "TRUSTED_ADVISOR":
            template_type = "MUTUAL_CONNECTION_WARM_INTRO"
            if mutuals and len(mutuals) > 0 and len(mutuals[0]) > 0:
                mutual_name = mutuals[0][0].get('connection_name', 'our mutual contact')
                subject = f"{mutual_name} Suggested I Reach Out"
            else:
                subject = "Connection Regarding Aston Villa FC"
            body_template = """
Hi [Name],

[Mutual Connection] suggested I connect given your role at Aston Villa.

They spoke highly of [specific achievement].

I'm at Yellow Panther - we [brief value prop for sports clubs].

No pressure, but open to a brief 15-min call to explore fit?

Best,
[Your Name]
            """.strip()

        elif strategy == "INNOVATION_PARTNER":
            template_type = "CO_CREATION_PROPOSAL"
            subject = "Co-Innovation Opportunity with Aston Villa FC"
            body_template = """
Hi [Name],

Saw your post about seeking technology partnerships!

We've successfully co-innovated with clubs:
• [Club 1]: Fan prediction AI (pilot → 40% improvement)
• [Club 2]: Dynamic pricing (pilot → 12% revenue increase)
• [Club 3]: Personalized content (pilot → 2x engagement)

Our model:
1. Discovery: Joint opportunity ID (2 weeks)
2. Pilot: Prove value (3 months)
3. Scale: Roll out successful (6-12 months)

Shared success: We invest in pilots, share in results.

Interested in exploring?

Best,
[Your Name]
            """.strip()

        elif strategy == "STRATEGIC_PARTNER":
            template_type = "DIGITAL_TRANSFORMATION_ADVISORY"
            subject = "Digital Transformation Insights for Aston Villa FC"
            body_template = """
Hi [Name],

Following Aston Villa's digital transformation journey - exciting vision!

We partnered with [Similar Club] on their modernization:
• Phase 1: Data foundation (90 days)
• Phase 2: AI-powered personalization (6 months)
• Phase 3: Real-time analytics (12 months)

ROI: 3.5x return in 24 months

Would you be interested in a 30-minute executive briefing?

Best,
[Your Name]
            """.strip()

        else:
            template_type = "GENERAL_VALUE_PROPOSITION"
            subject = "Sports Intelligence Platform for Aston Villa FC"
            body_template = """
Hi [Name],

I've been following Aston Villa's work in [specific area].

Yellow Panther helps clubs like Aston Villa:
• [Benefit 1]
• [Benefit 2]
• [Benefit 3]

Open to a brief call to explore how we could support your goals?

Best,
[Your Name]
            """.strip()

        return {
            "template_type": template_type,
            "subject": subject,
            "body_template": body_template,
            "key_talking_points": [
                "Relevant case study from similar club",
                "Specific ROI metrics",
                "Phased implementation approach",
                "Quick wins in Phase 1"
            ]
        }

    def _make_serializable(self, obj: Any) -> Any:
        """Convert objects to serializable format"""
        if isinstance(obj, dict):
            return {k: self._make_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._make_serializable(item) for item in obj]
        elif hasattr(obj, '__dict__'):
            return self._make_serializable(obj.__dict__)
        elif isinstance(obj, (datetime,)):
            return obj.isoformat()
        else:
            return obj

    def _generate_summary(self) -> Dict[str, Any]:
        """Generate executive summary"""
        mutuals = self.results.get("mutual_connections", {})
        strong_mutuals = sum(
            1 for conns in mutuals.values()
            for conn in conns
            if conn.get('strength') == 'STRONG'
        )

        return {
            "entity": {
                "id": self.results["entity_id"],
                "name": self.results["entity_name"],
                "timestamp": self.results["timestamp"]
            },
            "key_intelligence": {
                "linkedin_profiles": len(self.results.get("linkedin_profiles", [])),
                "decision_makers": len(self.results.get("decision_makers", [])),
                "opportunities": len(self.results.get("opportunities", [])),
                "mutual_connections": sum(len(c) for c in mutuals.values()),
                "strong_mutuals": strong_mutuals,
                "linkedin_posts_analyzed": len(self.results.get("linkedin_posts", []))
            },
            "positioning": self.results.get("positioning", {}),
            "recommended_actions": [
                f"Position as {self.results.get('positioning', {}).get('strategy', 'STRATEGIC_PARTNER')}",
                f"Engage via {self.results.get('positioning', {}).get('channel', 'Email + LinkedIn')}",
                f"Timing: {self.results.get('positioning', {}).get('timing', 'Within 2 weeks')}",
                f"Expected response rate: {self.results.get('positioning', {}).get('expected_response_rate', '30%')}"
            ]
        }

    def _generate_detailed_report(self) -> str:
        """Generate detailed markdown report"""
        positioning = self.results.get("positioning", {})
        opportunities = self.results.get("opportunities", [])
        mutuals = self.results.get("mutual_connections", {})
        decision_makers = self.results.get("decision_makers", [])

        report = f"""# Aston Villa FC - Complete Profiling Report

**Date**: {datetime.now().strftime("%B %d, %Y")}
**Entity**: Aston Villa FC
**Status**: ✅ PROFILING COMPLETE

---

## 🎯 Executive Summary

Aston Villa FC has been analyzed using the complete temporal profiling system.

### Positioning Recommendation

**Strategy**: {positioning.get('strategy', 'UNKNOWN')}
**Approach**: {positioning.get('approach', 'UNKNOWN')}
**Timing**: {positioning.get('timing', 'UNKNOWN')}
**Channel**: {positioning.get('channel', 'Unknown')}
**Expected Response Rate**: {positioning.get('expected_response_rate', 'Unknown')}

**Urgency**: {positioning.get('urgency', 'UNKNOWN')}

---

## 📊 Intelligence Summary

### LinkedIn Profiles
- Total Profiles: {len(self.results.get('linkedin_profiles', []))}
- Decision Makers: {len(decision_makers)}

### Key Decision Makers
"""

        for dm in decision_makers[:5]:
            name = dm.get('name', 'Unknown') if isinstance(dm, dict) else str(dm)
            title = dm.get('title', 'Unknown') if isinstance(dm, dict) else 'N/A'
            report += f"- **{name[:50]}** - {title[:50]}\n"

        report += f"""

### Opportunities Detected
- Total: {len(opportunities)}
- High Confidence (>0.7): {len([o for o in opportunities if o.get('confidence', 0) > 0.7])}

"""

        if opportunities:
            report += "**Top Opportunities**:\n\n"
            for opp in opportunities[:5]:
                report += f"{i+1}. **{opp.get('opportunity_type', 'UNKNOWN')}** (confidence: {opp.get('confidence', 0):.2f})\n"
                if opp.get('context'):
                    report += f"   - {opp.get('context', '')[:150]}...\n"

        report += f"""

### Mutual Connections
- Total Connections: {sum(len(c) for c in mutuals.values())}
- Strong: {sum(1 for conns in mutuals.values() for conn in conns if conn.get('strength') == 'STRONG')}
- Medium: {sum(1 for conns in mutuals.values() for conn in conns if conn.get('strength') == 'MEDIUM')}

---

## 📧 Outreach Template

### Subject
{positioning.get('subject', 'Aston Villa FC Partnership Opportunity')}

### Body Template
```
{self.results.get('outreach', {}).get('body_template', 'Template not available')}
```

---

## 🚀 Next Steps

1. {"Locate full RFP document" if positioning.get('strategy') == 'SOLUTION_PROVIDER' else 'Research current initiatives'}
2. Customize outreach with Aston Villa-specific case studies
3. Execute multi-channel outreach
4. Follow up according to sequence

---

**Generated by**: Yellow Panther Temporal Profiling System
**System Version**: 1.0 (BrightData-only architecture)
"""
        return report

    def _print_final_summary(self):
        """Print final summary to console"""
        print("\n" + "="*80)
        print("🎉 PROFILING COMPLETE - FINAL SUMMARY")
        print("="*80)

        print("\n📊 EXECUTIVE SUMMARY")
        print("-" * 80)
        print(f"Entity: {self.results['entity_name']}")
        print(f"ID: {self.results['entity_id']}")
        print(f"Completed: {self.results['timestamp']}")

        if self.results.get("phases", {}).get("linkedin_profiling"):
            linkedin = self.results["phases"]["linkedin_profiling"]
            print(f"\n👔 LinkedIn: {linkedin.get('total_profiles', 0)} profiles, {linkedin.get('decision_makers', 0)} decision makers")

        if self.results.get("phases", {}).get("post_signals"):
            signals = self.results["phases"]["post_signals"]
            print(f"📱 Posts: {signals.get('posts_analyzed', 0)} analyzed, {signals.get('opportunities', 0)} opportunities")

        if self.results.get("phases", {}).get("mutual_connections"):
            mutuals = self.results["phases"]["mutual_connections"]
            print(f"🤝 Mutuals: {mutuals.get('strong_connections', 0)} strong, {mutuals.get('medium_connections', 0)} medium")

        if self.results.get("positioning"):
            pos = self.results["positioning"]
            print(f"\n🎯 POSITIONING")
            print(f"   Strategy: {pos.get('strategy', 'UNKNOWN')}")
            print(f"   Approach: {pos.get('approach', 'UNKNOWN')}")
            print(f"   Timing: {pos.get('timing', 'UNKNOWN')}")
            print(f"   Channel: {pos.get('channel', 'Unknown')}")
            print(f"   Expected Response: {pos.get('expected_response_rate', 'Unknown')}")

        if self.results.get("saved_paths"):
            print(f"\n💾 Results saved:")
            print(f"   Full: {self.results['saved_paths']['full_results']}")
            print(f"   Summary: {self.results['saved_paths']['summary']}")
            print(f"   Report: {self.results['saved_paths']['report']}")

        print("\n" + "="*80)


async def main():
    """Main execution"""
    profiler = AstonVillaProfiler()
    await profiler.run_complete_profiling()


if __name__ == "__main__":
    asyncio.run(main())
