#!/usr/bin/env python3
"""
Full System Test: International Canoe Federation (ICF)
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
from temporal_sweep_scheduler import TemporalSweepScheduler
from schemas import EntityProfile, DossierQuestion, SweepConfig


class ICFProfiler:
    """Complete profiling system for International Canoe Federation"""

    def __init__(self):
        self.brightdata = BrightDataSDKClient()
        self.claude = ClaudeClient()
        self.linkedin_profiler = LinkedInProfiler(self.brightdata)
        self.sweep_scheduler = TemporalSweepScheduler(
            self.claude,
            self.brightdata,
            self.linkedin_profiler
        )
        self.results = {
            "entity_id": "international-canoe-federation",
            "entity_name": "International Canoe Federation",
            "timestamp": datetime.now().isoformat(),
            "phases": {}
        }

    async def phase_1_dossier_generation(self) -> Dict[str, Any]:
        """Phase 1: Generate dossier and extract questions"""
        print("\n" + "="*80)
        print("PHASE 1: Dossier Generation & Question Extraction")
        print("="*80)

        try:
            # Import here to avoid import issues
            from dossier_generator import DossierGenerator
            from dossier_question_extractor import DossierQuestionExtractor

            dossier_gen = DossierGenerator(self.claude, self.brightdata)
            question_extractor = DossierQuestionExtractor(self.claude)

            # Generate initial dossier
            print("\n📄 Generating dossier for International Canoe Federation...")
            dossier = await dossier_gen.generate_dossier(
                entity_id="international-canoe-federation",
                entity_name="International Canoe Federation",
                entity_type="ORG",
                sections=[
                    "core_information",
                    "digital_presence",
                    "technology_stack",
                    "leadership_structure",
                    "procurement_process",
                    "strategic_priorities"
                ]
            )

            # Extract questions
            print("\n❓ Extracting intelligence questions...")
            questions = await question_extractor.extract_questions_from_dossier(
                dossier.sections,
                entity_name="International Canoe Federation",
                max_per_section=5
            )

            # Prioritize questions
            print("\n🎯 Prioritizing questions by EIG...")
            prioritized = question_extractor.prioritize_questions(questions)

            # Store results
            phase_results = {
                "dossier_sections": len(dossier.sections),
                "total_questions": len(questions),
                "high_priority_questions": len([q for q in prioritized if q.priority >= 8]),
                "question_types": self._count_question_types(questions),
                "top_questions": [
                    {
                        "text": q.question_text[:100],
                        "type": q.question_type.value,
                        "priority": q.priority,
                        "confidence": q.confidence
                    }
                    for q in prioritized[:5]
                ]
            }

            self.results["phases"]["dossier_generation"] = phase_results
            self.results["dossier"] = dossier
            self.results["questions"] = questions

            print(f"\n✅ Dossier: {len(dossier.sections)} sections")
            print(f"✅ Questions: {len(questions)} extracted")
            print(f"✅ High priority: {phase_results['high_priority_questions']} questions")

            return {
                "dossier": dossier,
                "questions": prioritized
            }

        except Exception as e:
            print(f"\n❌ Error in Phase 1: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    async def phase_2_linkedin_profiling(self) -> Dict[str, Any]:
        """Phase 2: Multi-pass LinkedIn profiling"""
        print("\n" + "="*80)
        print("PHASE 2: LinkedIn Multi-Pass Profiling")
        print("="*80)

        try:
            profiles_all_passes = []

            # Pass 1: Cached sweep
            print("\n🔄 Pass 1: Cached BrightData sweep...")
            pass1_profiles = await self.linkedin_profiler.profile_entity(
                entity_name="International Canoe Federation",
                pass_number=1,
                use_cached=True
            )
            profiles_all_passes.extend(pass1_profiles)
            print(f"✅ Pass 1: {len(pass1_profiles)} profiles")

            # Pass 2: Targeted deep dive
            print("\n🎯 Pass 2: Targeted deep dive...")
            pass2_profiles = await self.linkedin_profiler.profile_entity(
                entity_name="International Canoe Federation",
                pass_number=2,
                use_cached=False,
                previous_profiles=pass1_profiles
            )
            profiles_all_passes.extend(pass2_profiles)
            print(f"✅ Pass 2: {len(pass2_profiles)} profiles")

            # Extract decision makers
            print("\n👔 Extracting decision makers...")
            decision_makers = await self.linkedin_profiler.extract_decision_makers(
                pass1_profiles + pass2_profiles
            )
            print(f"✅ Decision makers: {len(decision_makers)} identified")

            # Store results
            phase_results = {
                "pass_1_profiles": len(pass1_profiles),
                "pass_2_profiles": len(pass2_profiles),
                "total_profiles": len(profiles_all_passes),
                "decision_makers": len(decision_makers),
                "key_executives": [
                    {
                        "name": dm.get("name", "Unknown")[:50],
                        "title": dm.get("title", "Unknown")[:50],
                        "department": dm.get("department", "Unknown")
                    }
                    for dm in decision_makers[:3]
                ]
            }

            self.results["phases"]["linkedin_profiling"] = phase_results
            self.results["linkedin_profiles"] = profiles_all_passes
            self.results["decision_makers"] = decision_makers

            return {
                "profiles": profiles_all_passes,
                "decision_makers": decision_makers
            }

        except Exception as e:
            print(f"\n❌ Error in Phase 2: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    async def phase_3_post_signals(self) -> Dict[str, Any]:
        """Phase 3: LinkedIn post signal detection"""
        print("\n" + "="*80)
        print("PHASE 3: LinkedIn Post Signal Detection")
        print("="*80)

        try:
            # Scrape posts
            print("\n📱 Scraping LinkedIn posts...")
            posts = await self.linkedin_profiler.scrape_linkedin_posts(
                entity_name="International Canoe Federation",
                max_posts=20
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
                entity_name="International Canoe Federation"
            )
            print(f"✅ Opportunities: {len(opportunities)} detected")

            # Store results
            phase_results = {
                "posts_analyzed": len(posts),
                "signals_detected": signal_counts,
                "opportunities": len(opportunities),
                "high_confidence_opps": len([o for o in opportunities if o.get('confidence', 0) > 0.7]),
                "opportunity_types": self._count_opportunity_types(opportunities),
                "top_opportunities": [
                    {
                        "type": o.get('opportunity_type', 'UNKNOWN'),
                        "confidence": o.get('confidence', 0),
                        "context": o.get('context', '')[:100]
                    }
                    for o in opportunities[:3]
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
            print(f"\n❌ Error in Phase 3: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    async def phase_4_mutual_connections(self) -> Dict[str, Any]:
        """Phase 4: Mutual connections discovery"""
        print("\n" + "="*80)
        print("PHASE 4: Mutual Connections Discovery")
        print("="*80)

        try:
            # Yellow Panther LinkedIn profile
            yellow_panther_url = "https://www.linkedin.com/company/yellow-panther-ltd"

            # Get ICF profiles
            print("\n🔍 Finding mutual connections...")
            icf_profiles = self.results.get("linkedin_profiles", [])

            if not icf_profiles:
                print("⚠️  No LinkedIn profiles found, using fallback search...")
                # Use empty list - will trigger search-based approach
                icf_profiles = []

            mutuals = await self.linkedin_profiler.scrape_mutual_connections(
                yellow_panther_profile_url=yellow_panther_url,
                target_entity_profiles=icf_profiles
            )

            total_connections = sum(len(conns) for conns in mutuals.values())
            print(f"✅ Mutual connections: {total_connections} across {len(mutuals)} entities")

            # Analyze strength
            strong_connections = []
            for entity_id, connections in mutuals.items():
                for conn in connections:
                    if conn.get('strength') == 'STRONG':
                        strong_connections.append(conn)

            print(f"🤝 Strong connections: {len(strong_connections)}")

            # Store results
            phase_results = {
                "entities_checked": len(mutuals),
                "total_connections": total_connections,
                "strong_connections": len(strong_connections),
                "medium_connections": sum(
                    1 for conns in mutuals.values()
                    for conn in conns
                    if conn.get('strength') == 'MEDIUM'
                ),
                "top_connections": [
                    {
                        "name": c.get('connection_name', 'Unknown')[:50],
                        "title": c.get('connection_title', 'Unknown')[:50],
                        "strength": c.get('strength', 'UNKNOWN')
                    }
                    for c in strong_connections[:5]
                ]
            }

            self.results["phases"]["mutual_connections"] = phase_results
            self.results["mutual_connections"] = mutuals

            return {"mutuals": mutuals}

        except Exception as e:
            print(f"\n❌ Error in Phase 4: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    async def phase_5_temporal_sweep(self) -> Dict[str, Any]:
        """Phase 5: Multi-pass temporal sweep"""
        print("\n" + "="*80)
        print("PHASE 5: Multi-Pass Temporal Sweep")
        print("="*80)

        try:
            sweep_results = []
            previous_profile = None
            previous_questions = None

            # Pass 1: Quick sweep
            print("\n⚡ Pass 1: Quick sweep (cached)...")
            config1 = SweepConfig(
                linkedin_enabled=True,
                discovery_enabled=True,
                dossier_sections=["core_information", "digital_presence"],
                max_hypotheses=10,
                max_depth=2
            )

            result1 = await self.sweep_scheduler.execute_sweep(
                entity_id="international-canoe-federation",
                entity_name="International Canoe Federation",
                entity_type="ORG",
                pass_number=1,
                previous_profile=previous_profile,
                previous_questions=previous_questions,
                custom_config=config1
            )
            sweep_results.append(result1)
            previous_profile = result1.entity_profile
            previous_questions = result1.questions_answered
            print(f"✅ Pass 1 complete - Confidence: {result1.entity_profile.confidence_score:.2f}")

            # Pass 2: Standard sweep
            print("\n🔍 Pass 2: Standard sweep...")
            config2 = SweepConfig(
                linkedin_enabled=True,
                discovery_enabled=True,
                dossier_sections=[
                    "core_information", "digital_presence", "technology_stack",
                    "leadership_structure", "procurement_process"
                ],
                max_hypotheses=20,
                max_depth=2
            )

            result2 = await self.sweep_scheduler.execute_sweep(
                entity_id="international-canoe-federation",
                entity_name="International Canoe Federation",
                entity_type="ORG",
                pass_number=2,
                previous_profile=previous_profile,
                previous_questions=previous_questions,
                custom_config=config2
            )
            sweep_results.append(result2)
            previous_profile = result2.entity_profile
            previous_questions = result2.questions_answered
            print(f"✅ Pass 2 complete - Confidence: {result2.entity_profile.confidence_score:.2f}")

            # Pass 3: Deep sweep
            print("\n🎯 Pass 3: Deep sweep...")
            config3 = SweepConfig(
                linkedin_enabled=True,
                discovery_enabled=True,
                dossier_sections=[
                    "core_information", "digital_presence", "technology_stack",
                    "leadership_structure", "procurement_process", "strategic_priorities",
                    "digital_maturity", "challenges", "recommendations"
                ],
                max_hypotheses=30,
                max_depth=3
            )

            result3 = await self.sweep_scheduler.execute_sweep(
                entity_id="international-canoe-federation",
                entity_name="International Canoe Federation",
                entity_type="ORG",
                pass_number=3,
                previous_profile=previous_profile,
                previous_questions=previous_questions,
                custom_config=config3
            )
            sweep_results.append(result3)
            print(f"✅ Pass 3 complete - Confidence: {result3.entity_profile.confidence_score:.2f}")

            # Store results
            phase_results = {
                "passes_completed": len(sweep_results),
                "confidence_progression": [
                    {
                        "pass": i + 1,
                        "confidence": r.entity_profile.confidence_score,
                        "questions_answered": len(r.questions_answered)
                    }
                    for i, r in enumerate(sweep_results)
                ],
                "final_confidence": sweep_results[-1].entity_profile.confidence_score,
                "total_questions_answered": len(sweep_results[-1].questions_answered),
                "confidence_delta": sweep_results[-1].entity_profile.confidence_score - sweep_results[0].entity_profile.confidence_score
            }

            self.results["phases"]["temporal_sweep"] = phase_results
            self.results["sweep_results"] = sweep_results

            return {"sweeps": sweep_results}

        except Exception as e:
            print(f"\n❌ Error in Phase 5: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    async def phase_6_strategic_positioning(self) -> Dict[str, Any]:
        """Phase 6: Generate strategic positioning recommendations"""
        print("\n" + "="*80)
        print("PHASE 6: Strategic Positioning Analysis")
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

            # Generate outreach recommendations
            outreach = self._generate_outreach_recommendations(
                positioning,
                opportunities[:3],
                list(mutuals.values())[:2] if mutuals else []
            )

            print(f"\n📧 Email Subject: {outreach['subject']}")
            print(f"✉️  Template: {outreach['template_type']}")

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
            print(f"\n❌ Error in Phase 6: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    async def phase_7_save_results(self) -> None:
        """Phase 7: Save complete results to JSON"""
        print("\n" + "="*80)
        print("PHASE 7: Saving Results")
        print("="*80)

        try:
            # Create results directory
            results_dir = Path("icf_profiling_results")
            results_dir.mkdir(exist_ok=True)

            # Save full results (with objects converted)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

            # Create serializable results
            serializable_results = self._make_serializable(self.results)

            # Save full results
            full_path = results_dir / f"icf_full_results_{timestamp}.json"
            with open(full_path, 'w') as f:
                json.dump(serializable_results, f, indent=2)
            print(f"✅ Full results saved: {full_path}")

            # Save summary
            summary = self._generate_summary()
            summary_path = results_dir / f"icf_summary_{timestamp}.json"
            with open(summary_path, 'w') as f:
                json.dump(summary, f, indent=2)
            print(f"✅ Summary saved: {summary_path}")

            self.results["saved_paths"] = {
                "full_results": str(full_path),
                "summary": str(summary_path)
            }

        except Exception as e:
            print(f"\n❌ Error saving results: {str(e)}")
            import traceback
            traceback.print_exc()

    async def run_complete_profiling(self):
        """Run all phases"""
        print("\n" + "🚀"*40)
        print("INTERNATIONAL CANOE FEDERATION - COMPLETE PROFILING SYSTEM")
        print("🚀"*40)

        try:
            # Phase 1: Dossier & Questions
            await self.phase_1_dossier_generation()

            # Phase 2: LinkedIn Profiling
            await self.phase_2_linkedin_profiling()

            # Phase 3: Post Signals
            await self.phase_3_post_signals()

            # Phase 4: Mutual Connections
            await self.phase_4_mutual_connections()

            # Phase 5: Temporal Sweep
            await self.phase_5_temporal_sweep()

            # Phase 6: Strategic Positioning
            await self.phase_6_strategic_positioning()

            # Phase 7: Save Results
            await self.phase_7_save_results()

            # Print final summary
            self._print_final_summary()

        except Exception as e:
            print(f"\n❌ Fatal error: {str(e)}")
            import traceback
            traceback.print_exc()

    def _count_question_types(self, questions: List[DossierQuestion]) -> Dict[str, int]:
        """Count questions by type"""
        type_counts = {}
        for q in questions:
            qtype = q.question_type.value
            type_counts[qtype] = type_counts.get(qtype, 0) + 1
        return type_counts

    def _count_opportunity_types(self, opportunities: List[Dict]) -> Dict[str, int]:
        """Count opportunities by type"""
        type_counts = {}
        for opp in opportunities:
            opp_type = opp.get('opportunity_type', 'UNKNOWN')
            type_counts[opp_type] = type_counts.get(opp_type, 0) + 1
        return type_counts

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
            subject = "International Canoe Federation [RFP Topic] Response"
            body_template = """
Hi [Name],

Saw your RFP for [system/topic].

Yellow Panther helped [Similar Federation] achieve:
• [Metric 1 - e.g., 40% increase in engagement]
• [Metric 2 - e.g., 35% reduction in admin costs]
• [Metric 3 - e.g., £2M revenue increase]

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
                subject = "Connection Regarding [Topic]"
            body_template = """
Hi [Name],

[Mutual Connection] suggested I connect given your work on [topic/role].

They spoke highly of your [specific achievement].

I'm at Yellow Panther - we [brief value prop].

No pressure, but open to a brief 15-min call to explore fit?

Best,
[Your Name]
            """.strip()

        elif strategy == "STRATEGIC_PARTNER":
            template_type = "DIGITAL_TRANSFORMATION_ADVISORY"
            subject = "Digital Transformation Insights for Sports Federations"
            body_template = """
Hi [Name],

Following your digital transformation journey at ICF - exciting vision!

We partnered with [Similar Federation] on their modernization:
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
            subject = "Sports Federation Intelligence Platform"
            body_template = """
Hi [Name],

I've been following ICF's work in [specific area].

Yellow Panther helps sports federations:
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
                "Relevant case study from similar federation",
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
        return {
            "entity": {
                "id": self.results["entity_id"],
                "name": self.results["entity_name"],
                "timestamp": self.results["timestamp"]
            },
            "overall_confidence": self.results.get("sweep_results", [{}])[-1].get("entity_profile", {}).get("confidence_score", 0) if self.results.get("sweep_results") else 0,
            "key_intelligence": {
                "decision_makers": len(self.results.get("decision_makers", [])),
                "opportunities": len(self.results.get("opportunities", [])),
                "mutual_connections": sum(len(c) for c in self.results.get("mutual_connections", {}).values()),
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

        if self.results.get("phases", {}).get("dossier_generation"):
            dossier = self.results["phases"]["dossier_generation"]
            print(f"\n📄 Dossier: {dossier.get('dossier_sections', 0)} sections, {dossier.get('total_questions', 0)} questions")

        if self.results.get("phases", {}).get("linkedin_profiling"):
            linkedin = self.results["phases"]["linkedin_profiling"]
            print(f"👔 LinkedIn: {linkedin.get('decision_makers', 0)} decision makers identified")

        if self.results.get("phases", {}).get("post_signals"):
            signals = self.results["phases"]["post_signals"]
            print(f"📱 Posts: {signals.get('posts_analyzed', 0)} analyzed, {signals.get('opportunities', 0)} opportunities")

        if self.results.get("phases", {}).get("mutual_connections"):
            mutuals = self.results["phases"]["mutual_connections"]
            print(f"🤝 Mutuals: {mutuals.get('strong_connections', 0)} strong connections")

        if self.results.get("phases", {}).get("temporal_sweep"):
            sweep = self.results["phases"]["temporal_sweep"]
            print(f"\n⚡ Confidence: {sweep.get('final_confidence', 0):.2f}")
            print(f"📈 Delta: +{sweep.get('confidence_delta', 0):.2f} across {sweep.get('passes_completed', 0)} passes")

        if self.results.get("positioning"):
            pos = self.results["positioning"]
            print(f"\n🎯 POSITIONING")
            print(f"   Strategy: {pos.get('strategy', 'UNKNOWN')}")
            print(f"   Approach: {pos.get('approach', 'UNKNOWN')}")
            print(f"   Timing: {pos.get('timing', 'UNKNOWN')}")
            print(f"   Channel: {pos.get('channel', 'UNKNOWN')}")
            print(f"   Expected Response: {pos.get('expected_response_rate', 'UNKNOWN')}")

        if self.results.get("saved_paths"):
            print(f"\n💾 Results saved:")
            print(f"   Full: {self.results['saved_paths']['full_results']}")
            print(f"   Summary: {self.results['saved_paths']['summary']}")

        print("\n" + "="*80)


async def main():
    """Main execution"""
    profiler = ICFProfiler()
    await profiler.run_complete_profiling()


if __name__ == "__main__":
    asyncio.run(main())
