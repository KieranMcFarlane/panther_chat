#!/usr/bin/env python3
"""
Temporal Sweep Scheduler

Automates multi-pass temporal sweeps with progressive refinement.

Schedule:
- Pass 1 (Day 0): Quick cached sweep
- Pass 2 (Day 7): Standard sweep + questions
- Pass 3 (Day 14): Deep sweep with LinkedIn API
- Pass 4+ (Monthly): Monitoring sweeps

Each pass:
1. Executes sweep with configured data sources
2. Generates/updates entity profile
3. Tracks changes from previous version
4. Answers high-priority questions
5. Returns sweep results with metrics
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from schemas import (
    EntityProfile, ProfileChange, ProfileChangeType,
    SweepConfig, SweepResult, SweepType,
    DossierQuestion, DossierQuestionStatus, DossierQuestionType
)
from linkedin_profiler import LinkedInProfiler
from dossier_generator import EntityDossierGenerator
from dossier_question_extractor import DossierQuestionExtractor
from hypothesis_driven_discovery import HypothesisDrivenDiscovery
from claude_client import ClaudeClient
from brightdata_sdk_client import BrightDataSDKClient

logger = logging.getLogger(__name__)


class TemporalSweepScheduler:
    """
    Schedule and execute multi-pass temporal sweeps

    Progressive refinement strategy:
    - Each pass learns from previous passes
    - Questions guide discovery
    - Profile evolution tracked
    - Cost optimized via tiered sweeps
    """

    def __init__(
        self,
        claude_client: ClaudeClient,
        brightdata_client: BrightDataSDKClient,
        falkordb_client=None
    ):
        """
        Initialize sweep scheduler

        Args:
            claude_client: Claude client for AI operations
            brightdata_client: BrightData SDK client
            falkordb_client: Optional FalkorDB client
        """
        self.claude = claude_client
        self.brightdata = brightdata_client
        self.falkordb = falkordb_client

        # Initialize components
        self.linkedin_profiler = LinkedInProfiler(brightdata_client)
        self.dossier_generator = EntityDossierGenerator(claude_client, falkordb_client)
        self.question_extractor = DossierQuestionExtractor(claude_client)
        self.discovery = HypothesisDrivenDiscovery(claude_client, brightdata_client)

        # Default sweep schedules (can be customized per entity)
        self.default_sweep_schedule = {
            1: SweepConfig(
                pass_number=1,
                sweep_type=SweepType.QUICK,
                interval_hours=0,  # Immediate
                data_sources=["cache"],
                sections_to_generate=["core_information", "quick_actions", "contact_information"],
                linkedin_enabled=False,
                max_cost_usd=0.0005,
                max_duration_seconds=30
            ),
            2: SweepConfig(
                pass_number=2,
                sweep_type=SweepType.STANDARD,
                interval_hours=168,  # 7 days
                data_sources=["cache", "fresh"],
                sections_to_generate=[
                    "core_information", "quick_actions", "contact_information",
                    "recent_news", "current_performance", "leadership", "digital_maturity"
                ],
                linkedin_enabled=False,
                max_cost_usd=0.010,
                max_duration_seconds=60
            ),
            3: SweepConfig(
                pass_number=3,
                sweep_type=SweepType.DEEP,
                interval_hours=336,  # 14 days
                data_sources=["cache", "api", "fresh"],
                sections_to_generate=[
                    "core_information", "quick_actions", "contact_information",
                    "recent_news", "current_performance", "leadership",
                    "digital_maturity", "ai_reasoner_assessment",
                    "challenges_opportunities", "strategic_analysis"
                ],
                linkedin_enabled=True,
                max_cost_usd=0.050,
                max_duration_seconds=120
            ),
            4: SweepConfig(
                pass_number=4,
                sweep_type=SweepType.MONITORING,
                interval_hours=720,  # 30 days
                data_sources=["cache", "fresh"],
                sections_to_generate=[
                    "core_information", "quick_actions", "contact_information",
                    "recent_news", "current_performance", "leadership", "digital_maturity"
                ],
                linkedin_enabled=True,
                max_cost_usd=0.015,
                max_duration_seconds=90
            )
        }

    async def execute_sweep(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str = "CLUB",
        priority_score: int = 50,
        pass_number: int = 1,
        previous_profile: Optional[EntityProfile] = None,
        previous_questions: Optional[List[DossierQuestion]] = None,
        custom_config: Optional[SweepConfig] = None
    ) -> SweepResult:
        """
        Execute a single temporal sweep pass

        Args:
            entity_id: Unique entity identifier
            entity_name: Entity display name
            entity_type: Entity type (CLUB, LEAGUE, etc.)
            priority_score: Priority score (0-100)
            pass_number: Which sweep pass (1, 2, 3, 4+)
            previous_profile: Profile from previous pass
            previous_questions: Questions from previous pass
            custom_config: Optional custom sweep config

        Returns:
            SweepResult with profile, changes, metrics
        """
        started_at = datetime.now(timezone.utc)
        logger.info(f"Starting sweep pass {pass_number} for {entity_name}")

        # Get sweep config
        config = custom_config or self.default_sweep_schedule.get(
            pass_number,
            self.default_sweep_schedule[4]  # Default to monitoring
        )

        # Initialize profile
        if previous_profile:
            profile = EntityProfile(
                entity_id=entity_id,
                entity_name=entity_name,
                profile_version=previous_profile.profile_version + 1,
                previous_version=previous_profile.profile_version,
                sweep_pass=pass_number,
                confidence_score=previous_profile.confidence_score,
                questions_answered=previous_profile.questions_answered,
                questions_total=previous_profile.questions_total
            )
        else:
            profile = EntityProfile(
                entity_id=entity_id,
                entity_name=entity_name,
                profile_version=1,
                sweep_pass=pass_number
            )

        total_cost = 0.0
        changes = []
        questions_answered = 0
        questions_generated = 0

        # Step 1: Generate dossier sections
        logger.info(f"Generating {len(config.sections_to_generate)} sections for pass {pass_number}")
        dossier = await self.dossier_generator.generate_dossier(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            priority_score=priority_score
        )
        total_cost += dossier.total_cost_usd

        # Step 2: Extract questions from dossier
        logger.info("Extracting questions from dossier")
        question_extractor = DossierQuestionExtractor(self.claude)
        new_questions = await question_extractor.extract_questions_from_dossier(
            dossier.sections,
            entity_name,
            max_per_section=3
        )
        questions_generated = len(new_questions)

        # Merge with previous questions
        all_questions = self._merge_questions(previous_questions or [], new_questions)

        # Step 3: Answer high-priority questions via discovery
        logger.info("Running question-guided discovery")
        prioritized_questions = question_extractor.prioritize_questions(all_questions, max_count=10)

        if prioritized_questions:
            discovery_result = await self._run_question_guided_discovery(
                entity_id,
                entity_name,
                prioritized_questions[:5],  # Answer top 5 questions
                config
            )
            total_cost += discovery_result.get('cost_usd', 0.0)

            # Update questions with answers
            for q in all_questions:
                if q.question_id in discovery_result.get('answers', {}):
                    q.answers = discovery_result['answers'][q.question_id]
                    q.status = DossierQuestionStatus.ANSWERED
                    q.confidence = discovery_result.get('confidences', {}).get(q.question_id, 0.0)
                    q.answered_at = datetime.now(timezone.utc)
                    questions_answered += 1

        # Step 4: LinkedIn profiling (if enabled)
        if config.linkedin_enabled:
            logger.info("Running LinkedIn profiling")
            linkedin_profiles = await self.linkedin_profiler.profile_entity(
                entity_name,
                pass_number=pass_number,
                previous_profiles=previous_profile.linkedin_profiles if previous_profile else None
            )
            profile.linkedin_profiles = [lp.to_dict() for lp in linkedin_profiles]

            # Extract decision makers
            decision_makers = await self.linkedin_profiler.extract_decision_makers(
                linkedin_profiles,
                entity_name
            )
            profile.decision_makers = decision_makers

            # Step 4a: Scrape LinkedIn posts for signals
            logger.info("Scraping LinkedIn posts for signal detection")
            linkedin_posts = await self.linkedin_profiler.scrape_linkedin_posts(
                entity_name,
                max_posts=20
            )
            profile.linkedin_posts = linkedin_posts

            # Step 4b: Scrape company posts for opportunities
            logger.info("Scraping company posts for opportunities")
            opportunities = await self.linkedin_profiler.scrape_company_posts_for_opportunities(
                entity_name
            )
            profile.opportunities_detected = opportunities

            # Step 4c: Find mutual connections (if Yellow Panther profile available)
            # In production, pass Yellow Panther's LinkedIn profile URL
            yellow_panther_url = "https://linkedin.com/company/yellow-panther"  # Placeholder
            if linkedin_profiles:
                logger.info("Finding mutual connections with Yellow Panther")
                mutuals = await self.linkedin_profiler.scrape_mutual_connections(
                    yellow_panther_url,
                    linkedin_profiles
                )
                profile.mutual_connections = mutuals

        # Step 5: Update profile with discoveries
        profile.outstanding_questions = [q for q in all_questions if q.status == DossierQuestionStatus.PENDING]
        profile.answered_questions = [q for q in all_questions if q.status == DossierQuestionStatus.ANSWERED]
        profile.questions_total = len(all_questions)
        profile.questions_answered = questions_answered
        profile.profile_updated_at = datetime.now(timezone.utc)

        # Step 6: Detect changes from previous profile
        if previous_profile:
            changes = self._detect_changes(previous_profile, profile)

        completed_at = datetime.now(timezone.utc)
        duration_seconds = (completed_at - started_at).total_seconds()

        # Create sweep result
        result = SweepResult(
            sweep_config=config,
            entity_profile=profile,
            profile_changes=changes,
            questions_answered=questions_answered,
            questions_generated=questions_generated,
            cost_usd=total_cost,
            duration_seconds=duration_seconds,
            started_at=started_at,
            completed_at=completed_at
        )

        logger.info(f"Sweep pass {pass_number} complete: {questions_answered} questions answered, ${total_cost:.4f}, {duration_seconds:.0f}s")
        return result

    async def schedule_sweeps(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str = "CLUB",
        priority_score: int = 50,
        num_passes: int = 4
    ) -> List[SweepResult]:
        """
        Execute multiple sweep passes sequentially

        Args:
            entity_id: Unique entity identifier
            entity_name: Entity display name
            entity_type: Entity type
            priority_score: Priority score
            num_passes: Number of passes to execute (1-4)

        Returns:
            List of sweep results from all passes
        """
        logger.info(f"Scheduling {num_passes} sweep passes for {entity_name}")

        results = []
        current_profile = None
        current_questions = None

        for pass_num in range(1, num_passes + 1):
            # Check if we should wait (based on interval)
            if pass_num > 1:
                interval_hours = self.default_sweep_schedule[pass_num].interval_hours
                logger.info(f"Waiting {interval_hours}h before pass {pass_num}")
                await asyncio.sleep(interval_hours * 3600)  # In production, use proper scheduling

            # Execute sweep
            result = await self.execute_sweep(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                priority_score=priority_score,
                pass_number=pass_num,
                previous_profile=current_profile,
                previous_questions=current_questions
            )
            results.append(result)

            # Update for next pass
            current_profile = result.entity_profile
            current_questions = current_profile.outstanding_questions + current_profile.answered_questions

        logger.info(f"Completed {len(results)} sweep passes for {entity_name}")
        return results

    def _merge_questions(
        self,
        previous_questions: List[DossierQuestion],
        new_questions: List[DossierQuestion]
    ) -> List[DossierQuestion]:
        """
        Merge previous questions with new questions

        - Keep answered questions from previous
        - Update pending questions if they've been answered
        - Add new questions
        - Deprioritize irrelevant questions
        """
        # Create lookup
        question_map = {}

        # Add previous questions
        for q in previous_questions:
            question_map[q.question_id] = q

        # Update/add new questions
        for q in new_questions:
            if q.question_id in question_map:
                # Update existing question if new answer has higher confidence
                existing = question_map[q.question_id]
                if q.confidence > existing.confidence:
                    question_map[q.question_id] = q
            else:
                # Add new question
                question_map[q.question_id] = q

        return list(question_map.values())

    async def _run_question_guided_discovery(
        self,
        entity_id: str,
        entity_name: str,
        questions: List[DossierQuestion],
        config: SweepConfig
    ) -> Dict[str, Any]:
        """
        Run discovery guided by dossier questions

        Args:
            entity_id: Entity ID
            entity_name: Entity name
            questions: Questions to answer
            config: Sweep config

        Returns:
            Discovery results with answers and confidences
        """
        # In production, this would integrate with hypothesis_driven_discovery
        # For now, return mock results

        answers = {}
        confidences = {}

        for question in questions:
            # Use question's search strategy
            search_strategy = question.search_strategy

            # Execute search (simplified)
            try:
                if search_strategy.get('search_queries'):
                    query = search_strategy['search_queries'][0]
                    results = await self.brightdata.search_engine(query, engine='google', num_results=3)

                    if results.get('status') == 'success':
                        # Extract answer from results
                        answer_text = '\n'.join([
                            f"- {r.get('title', '')}: {r.get('snippet', '')}"
                            for r in results.get('results', [])
                        ])
                        answers[question.question_id] = [answer_text]
                        confidences[question.question_id] = 0.7

            except Exception as e:
                logger.error(f"Error answering question {question.question_id}: {e}")

        return {
            'answers': answers,
            'confidences': confidences,
            'cost_usd': 0.001  # Simplified cost tracking
        }

    def _detect_changes(
        self,
        old_profile: EntityProfile,
        new_profile: EntityProfile
    ) -> List[ProfileChange]:
        """
        Detect changes between profile versions

        Args:
            old_profile: Previous profile
            new_profile: New profile

        Returns:
            List of profile changes
        """
        changes = []

        # Confidence change
        conf_delta = new_profile.confidence_score - old_profile.confidence_score
        if abs(conf_delta) > 0.01:
            change_type = ProfileChangeType.CONFIDENCE_INCREASED if conf_delta > 0 else ProfileChangeType.CONFIDENCE_DECREASED
            changes.append(ProfileChange(
                change_id=f"conf_change_{new_profile.entity_id}_{new_profile.profile_version}",
                entity_id=new_profile.entity_id,
                from_version=old_profile.profile_version,
                to_version=new_profile.profile_version,
                change_type=change_type,
                description=f"Confidence changed from {old_profile.confidence_score:.2f} to {new_profile.confidence_score:.2f}",
                previous_value=old_profile.confidence_score,
                new_value=new_profile.confidence_score,
                confidence_delta=conf_delta
            ))

        # Questions answered
        newly_answered = len(new_profile.answered_questions) - len(old_profile.answered_questions)
        if newly_answered > 0:
            changes.append(ProfileChange(
                change_id=f"questions_answered_{new_profile.entity_id}_{new_profile.profile_version}",
                entity_id=new_profile.entity_id,
                from_version=old_profile.profile_version,
                to_version=new_profile.profile_version,
                change_type=ProfileChangeType.QUESTION_ANSWERED,
                description=f"{newly_answered} new questions answered",
                previous_value=len(old_profile.answered_questions),
                new_value=len(new_profile.answered_questions),
                confidence_delta=0.02 * newly_answered  # Each answered question adds 0.02
            ))

        # Decision makers identified
        new_decision_makers = len(new_profile.decision_makers) - len(old_profile.decision_makers)
        if new_decision_makers > 0:
            changes.append(ProfileChange(
                change_id=f"decision_makers_{new_profile.entity_id}_{new_profile.profile_version}",
                entity_id=new_profile.entity_id,
                from_version=old_profile.profile_version,
                to_version=new_profile.profile_version,
                change_type=ProfileChangeType.DECISION_MAKER_IDENTIFIED,
                description=f"{new_decision_makers} decision makers identified",
                previous_value=len(old_profile.decision_makers),
                new_value=len(new_profile.decision_makers),
                confidence_delta=0.05 * new_decision_makers
            ))

        # Signals detected
        new_signals = new_profile.signals_detected - old_profile.signals_detected
        if new_signals > 0:
            changes.append(ProfileChange(
                change_id=f"signals_detected_{new_profile.entity_id}_{new_profile.profile_version}",
                entity_id=new_profile.entity_id,
                from_version=old_profile.profile_version,
                to_version=new_profile.profile_version,
                change_type=ProfileChangeType.SIGNAL_ADDED,
                description=f"{new_signals} new signals detected",
                previous_value=old_profile.signals_detected,
                new_value=new_profile.signals_detected,
                confidence_delta=0.06 * new_signals
            ))

        return changes


# Example usage
if __name__ == "__main__":
    import asyncio
    from claude_client import ClaudeClient
    from brightdata_sdk_client import BrightDataSDKClient

    async def test_sweep_scheduler():
        claude = ClaudeClient()
        brightdata = BrightDataSDKClient()

        scheduler = TemporalSweepScheduler(claude, brightdata)

        # Run 3 passes
        results = await scheduler.schedule_sweeps(
            entity_id="arsenal-fc",
            entity_name="Arsenal FC",
            entity_type="CLUB",
            priority_score=85,
            num_passes=3
        )

        for result in results:
            print(f"Pass {result.entity_profile.sweep_pass}: "
                  f"{result.questions_answered} questions answered, "
                  f"${result.cost_usd:.4f}, "
                  f"{result.duration_seconds:.0f}s")

    asyncio.run(test_sweep_scheduler())
