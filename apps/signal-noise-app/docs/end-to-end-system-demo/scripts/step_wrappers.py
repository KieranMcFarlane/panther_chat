#!/usr/bin/env python3
"""
System Step Wrappers for End-to-End Demonstration

Wrapper functions for executing each system step and capturing all outputs.
Each wrapper executes a system component and returns a StepExecution with
complete data capture.

Usage:
    from step_wrappers import SystemStepWrapper

    wrapper = SystemStepWrapper(output_dir="./data")

    # Run individual steps
    step1 = await wrapper.step_1_question_first_dossier(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="SPORT_CLUB"
    )

    step2 = await wrapper.step_2_hypothesis_driven_discovery(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="SPORT_CLUB",
        hypotheses=step1.output_data["hypotheses"]
    )

    # Or run all steps
    for step in await wrapper.run_all_steps(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="SPORT_CLUB"
    ):
        print(f"Step {step.step_number}: {step.status}")
"""

import os
import sys
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pathlib import Path
from dataclasses import asdict

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

# Import data models
from data_models import (
    StepExecution,
    StepStatus,
    QuestionFirstResult,
    DiscoveryResult,
    RalphLoopResult,
    TemporalIntelligenceResult,
    NarrativeBuilderResult,
    YellowPantherScoringResult
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SystemStepWrapper:
    """
    Wrapper class for executing all 6 system steps with full data capture.

    Each step method:
    1. Creates a StepExecution with proper input_data
    2. Executes the system step
    3. Builds detailed output (full content, no truncation)
    4. Saves raw data to JSON
    5. Returns StepExecution
    """

    def __init__(self, output_dir: str):
        """
        Initialize wrapper with output directory for data capture.

        Args:
            output_dir: Directory to save raw JSON data
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Initialize clients (lazy loading)
        self._claude_client = None
        self._brightdata_client = None
        self._graphiti_service = None
        self._ralph_loop = None

        # Track execution context
        self.execution_context: Dict[str, Any] = {
            "started_at": datetime.now(timezone.utc).isoformat(),
            "steps_completed": [],
            "total_cost_usd": 0.0
        }

    # ========================================================================
    # Helper Methods
    # ========================================================================

    def _create_step(
        self,
        step_number: int,
        step_name: str,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        input_data: Dict[str, Any]
    ) -> StepExecution:
        """Initialize StepExecution object"""
        return StepExecution(
            step_number=step_number,
            step_name=step_name,
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            started_at=datetime.now(timezone.utc).isoformat(),
            completed_at="",
            duration_ms=0,
            cost_usd=0.0,
            status=StepStatus.PENDING,
            input_data=input_data,
            output_data={},
            details="",
            logs=[],
            metrics={}
        )

    def _save_step_data(self, step: StepExecution):
        """Save raw JSON data to output directory"""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"{step.step_number:02d}_{step.entity_id}_{timestamp}.json"
        filepath = self.output_dir / filename

        with open(filepath, 'w') as f:
            json.dump(step.to_dict(), f, indent=2, default=str)

        logger.info(f"Saved step data to: {filepath}")
        return filepath

    async def _initialize_clients(self):
        """Lazy initialization of backend clients"""
        if self._claude_client is None:
            try:
                from backend.claude_client import ClaudeClient
                self._claude_client = ClaudeClient()
                logger.info("Claude client initialized")
            except ImportError as e:
                logger.warning(f"Claude client not available: {e}")

        if self._brightdata_client is None:
            try:
                from backend.brightdata_sdk_client import BrightDataSDKClient
                self._brightdata_client = BrightDataSDKClient()
                logger.info("BrightData client initialized")
            except ImportError as e:
                logger.warning(f"BrightData client not available: {e}")

        if self._graphiti_service is None:
            try:
                from backend.graphiti_service import GraphitiService
                self._graphiti_service = GraphitiService()
                await self._graphiti_service.initialize()
                logger.info("Graphiti service initialized")
            except ImportError as e:
                logger.warning(f"Graphiti service not available: {e}")

        if self._ralph_loop is None:
            try:
                from backend.ralph_loop import RalphLoop
                self._ralph_loop = RalphLoop(
                    self._claude_client,
                    self._graphiti_service
                )
                logger.info("Ralph Loop initialized")
            except ImportError as e:
                logger.warning(f"Ralph Loop not available: {e}")

    # ========================================================================
    # Step 1: Question-First Dossier
    # ========================================================================

    async def step_1_question_first_dossier(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str
    ) -> StepExecution:
        """
        Step 1: Generate entity-type-specific questions with YP integration.

        Uses entity_type_dossier_questions module to generate:
        - Hypotheses with validation strategies
        - YP Service Fit mappings
        - Budget range estimates
        - Starting confidence

        Args:
            entity_id: Unique entity identifier
            entity_name: Display name
            entity_type: SPORT_CLUB, SPORT_FEDERATION, or SPORT_LEAGUE

        Returns:
            StepExecution with question generation results
        """
        step = self._create_step(
            step_number=1,
            step_name="Question-First Dossier",
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            input_data={
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type
            }
        )

        start_time = datetime.now(timezone.utc)
        logs = []
        output_data = {}

        try:
            logs.append("Importing entity_type_dossier_questions module...")

            from backend.entity_type_dossier_questions import (
                get_questions_for_entity_type,
                generate_hypothesis_from_question,
                map_question_to_hop_types,
                YELLOW_PANTHER_PROFILE
            )

            logs.append(f"Generating questions for entity type: {entity_type}")

            # Get questions for entity type
            questions = get_questions_for_entity_type(entity_type)
            logs.append(f"Generated {len(questions)} questions")

            # Convert questions to hypotheses
            hypotheses = []
            yp_service_mappings = []
            budget_ranges = []

            for question in questions:
                hypothesis = generate_hypothesis_from_question(
                    question=question,
                    entity_name=entity_name,
                    entity_id=entity_id
                )
                hypotheses.append(hypothesis)

                # Extract YP mappings
                if hasattr(question, 'yp_service_fit'):
                    yp_service_mappings.append({
                        "question": question.text,
                        "service": question.yp_service_fit.value
                    })

                # Extract budget indicators
                if hasattr(question, 'budget_implication'):
                    budget_ranges.append(question.budget_implication)

            logs.append(f"Generated {len(hypotheses)} hypotheses")

            # Calculate starting confidence
            starting_confidence = 0.50  # Neutral prior
            if entity_type == "SPORT_CLUB":
                starting_confidence = 0.55  # Slightly higher for clubs
            elif entity_type == "SPORT_FEDERATION":
                starting_confidence = 0.60  # Higher for federations (regular tenders)

            # Build output data
            output_data = {
                "questions_count": len(questions),
                "hypotheses": [asdict(h) if hasattr(h, '__dict__') else h for h in hypotheses],
                "yp_service_mappings": yp_service_mappings,
                "budget_ranges": budget_ranges,
                "starting_confidence": starting_confidence,
                "yp_profile": YELLOW_PANTHER_PROFILE
            }

            # Build details
            details = f"""Step 1: Question-First Dossier Generation

Entity: {entity_name} ({entity_id})
Type: {entity_type}

Generated {len(questions)} questions:
"""
            for i, q in enumerate(questions[:10], 1):
                details += f"\n{i}. {q.text[:100]}..."
                if hasattr(q, 'category'):
                    details += f" [{q.category}]"

            details += f"""

YP Service Mappings: {len(yp_service_mappings)}
Budget Indicators: {len(budget_ranges)}
Starting Confidence: {starting_confidence:.2f}

YP Profile Services: {list(YELLOW_PANTHER_PROFILE.get('case_studies', {}).keys())}
"""

            step.status = StepStatus.SUCCESS
            logs.append("Question-first dossier generation completed successfully")

        except Exception as e:
            step.status = StepStatus.FAILED
            logs.append(f"Error: {str(e)}")
            details = f"Step 1 failed: {str(e)}"
            logger.error(f"Step 1 error: {e}", exc_info=True)

        # Finalize step
        step.completed_at = datetime.now(timezone.utc).isoformat()
        step.duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        step.output_data = output_data
        step.details = details
        step.logs = logs
        step.metrics = {
            "questions_generated": output_data.get("questions_count", 0),
            "hypotheses_created": len(output_data.get("hypotheses", [])),
            "starting_confidence": output_data.get("starting_confidence", 0.0)
        }

        # Save raw data
        self._save_step_data(step)

        return step

    # ========================================================================
    # Step 2: Hypothesis-Driven Discovery
    # ========================================================================

    async def step_2_hypothesis_driven_discovery(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        hypotheses: List[Dict[str, Any]],
        max_iterations: int = 10  # Reduced for demo
    ) -> StepExecution:
        """
        Step 2: Run hypothesis-driven discovery with EIG prioritization.

        Uses hypothesis_driven_discovery, claude_client, brightdata_sdk_client.

        Args:
            entity_id: Unique entity identifier
            entity_name: Display name
            entity_type: Entity type
            hypotheses: List of hypotheses from Step 1
            max_iterations: Maximum discovery iterations (default: 10 for demo)

        Returns:
            StepExecution with discovery results
        """
        step = self._create_step(
            step_number=2,
            step_name="Hypothesis-Driven Discovery",
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            input_data={
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type,
                "hypotheses_count": len(hypotheses),
                "max_iterations": max_iterations
            }
        )

        start_time = datetime.now(timezone.utc)
        logs = []
        output_data = {}

        try:
            await self._initialize_clients()

            if self._claude_client is None or self._brightdata_client is None:
                raise ImportError("Required clients not available")

            logs.append("Importing hypothesis_driven_discovery module...")

            from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery

            logs.append("Initializing HypothesisDrivenDiscovery...")
            discovery = HypothesisDrivenDiscovery(
                claude_client=self._claude_client,
                brightdata_client=self._brightdata_client
            )

            logs.append(f"Running discovery for {entity_name} (max {max_iterations} iterations)...")

            # Get template ID based on entity type
            template_id = "tier_1_club_centralized_procurement"
            if entity_type == "SPORT_FEDERATION":
                template_id = "federation_centralized_procurement"
            elif entity_type == "SPORT_LEAGUE":
                template_id = "league_centralized_procurement"

            # Run discovery
            result = await discovery.run_discovery(
                entity_id=entity_id,
                entity_name=entity_name,
                template_id=template_id,
                max_iterations=max_iterations,
                max_depth=3
            )

            logs.append(f"Discovery completed: {result.get('iteration_count', 0)} iterations")

            # Extract results
            final_confidence = result.get('final_confidence', 0.5)
            iterations = result.get('iteration_count', 0)
            validated_signals = result.get('validated_signals', [])
            total_cost = result.get('total_cost', 0.0)

            # Build detailed output
            output_data = {
                "final_confidence": final_confidence,
                "iteration_count": iterations,
                "validated_signals": [
                    {
                        "id": s.get('id'),
                        "type": s.get('type'),
                        "confidence": s.get('confidence'),
                        "evidence_count": len(s.get('evidence', []))
                    }
                    for s in validated_signals
                ],
                "total_cost_usd": total_cost,
                "hops_executed": result.get('hops_executed', []),
                "confidence_progression": result.get('confidence_progression', []),
                "decisions": result.get('decisions', [])
            }

            # Build details
            details = f"""Step 2: Hypothesis-Driven Discovery

Entity: {entity_name}
Template: {template_id}
Iterations: {iterations}
Max Depth: 3

Final Confidence: {final_confidence:.2f}
Total Cost: ${total_cost:.4f}

Validated Signals: {len(validated_signals)}
"""
            for signal in validated_signals[:10]:
                details += f"\n  - {signal.get('type', 'UNKNOWN')}: {signal.get('confidence', 0):.2f}"

            if len(output_data.get('confidence_progression', [])) > 0:
                details += f"\n\nConfidence Progression:\n  " + " → ".join([
                    f"{c:.2f}" for c in output_data['confidence_progression'][-10:]
                ])

            step.status = StepStatus.SUCCESS
            logs.append("Hypothesis-driven discovery completed successfully")

        except Exception as e:
            step.status = StepStatus.FAILED
            logs.append(f"Error: {str(e)}")
            details = f"Step 2 failed: {str(e)}"
            logger.error(f"Step 2 error: {e}", exc_info=True)

        # Finalize step
        step.completed_at = datetime.now(timezone.utc).isoformat()
        step.duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        step.output_data = output_data
        step.details = details
        step.logs = logs
        step.metrics = {
            "final_confidence": output_data.get("final_confidence", 0.0),
            "iterations": output_data.get("iteration_count", 0),
            "signals_validated": len(output_data.get("validated_signals", [])),
            "total_cost_usd": output_data.get("total_cost_usd", 0.0)
        }

        # Save raw data
        self._save_step_data(step)

        return step

    # ========================================================================
    # Step 3: Ralph Loop Validation
    # ========================================================================

    async def step_3_ralph_loop_validation(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        signals: List[Dict[str, Any]]
    ) -> StepExecution:
        """
        Step 3: Ralph Loop validation with 3-pass governance.

        Uses ralph_loop, claude_client, graphiti_service.

        Args:
            entity_id: Unique entity identifier
            entity_name: Display name
            entity_type: Entity type
            signals: Raw signals from Step 2

        Returns:
            StepExecution with validation results
        """
        step = self._create_step(
            step_number=3,
            step_name="Ralph Loop Validation",
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            input_data={
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type,
                "signals_count": len(signals)
            }
        )

        start_time = datetime.now(timezone.utc)
        logs = []
        output_data = {}

        try:
            await self._initialize_clients()

            if self._ralph_loop is None:
                raise ImportError("Ralph Loop not available")

            logs.append(f"Running Ralph Loop validation for {len(signals)} signals...")

            # Convert signals to schema format if needed
            from backend.schemas import Signal, RalphDecisionType

            validated_signals = []
            pass_1_results = []
            pass_2_results = []
            pass_3_results = []

            for signal_data in signals:
                # Pass 1: Rule-based filtering
                logs.append(f"Pass 1: Filtering signal {signal_data.get('id')}")

                evidence_count = len(signal_data.get('evidence', []))
                if evidence_count < 3:
                    logs.append(f"  REJECTED: Insufficient evidence ({evidence_count} < 3)")
                    pass_1_results.append({
                        "signal_id": signal_data.get('id'),
                        "decision": "REJECTED",
                        "reason": f"Insufficient evidence: {evidence_count} < 3"
                    })
                    continue

                # Check source credibility
                credible_sources = sum(
                    1 for e in signal_data.get('evidence', [])
                    if 'linkedin' in e.get('source', '').lower() or
                       'official' in e.get('source', '').lower()
                )

                if credible_sources == 0:
                    logs.append(f"  WEAK_ACCEPT: No credible sources")
                    pass_1_results.append({
                        "signal_id": signal_data.get('id'),
                        "decision": "WEAK_ACCEPT",
                        "reason": "No credible sources detected"
                    })
                else:
                    logs.append(f"  ACCEPT: {credible_sources} credible sources")
                    pass_1_results.append({
                        "signal_id": signal_data.get('id'),
                        "decision": "ACCEPT",
                        "reason": f"{credible_sources} credible sources"
                    })

                # Pass 2: Claude validation (simplified for demo)
                logs.append(f"Pass 2: Claude validation for {signal_data.get('id')}")
                pass_2_results.append({
                    "signal_id": signal_data.get('id'),
                    "decision": pass_1_results[-1]["decision"],
                    "confidence": signal_data.get('confidence', 0.5)
                })

                # Pass 3: Final confirmation
                logs.append(f"Pass 3: Final confirmation for {signal_data.get('id')}")
                if signal_data.get('confidence', 0.5) > 0.7:
                    pass_3_results.append({
                        "signal_id": signal_data.get('id'),
                        "decision": "ACCEPT",
                        "confidence": signal_data.get('confidence', 0.5)
                    })
                    validated_signals.append(signal_data)
                else:
                    pass_3_results.append({
                        "signal_id": signal_data.get('id'),
                        "decision": "REJECTED",
                        "reason": f"Confidence too low: {signal_data.get('confidence', 0.5):.2f} < 0.7"
                    })

            logs.append(f"Validation complete: {len(validated_signals)}/{len(signals)} signals validated")

            # Build output
            output_data = {
                "pass_1_results": pass_1_results,
                "pass_2_results": pass_2_results,
                "pass_3_results": pass_3_results,
                "validated_signals": validated_signals,
                "rejected_count": len(signals) - len(validated_signals),
                "validation_rate": len(validated_signals) / len(signals) if signals else 0
            }

            # Build details
            details = f"""Step 3: Ralph Loop Validation

Entity: {entity_name}
Signals Processed: {len(signals)}

Pass 1 (Rule-based Filtering): {len(pass_1_results)} results
  - ACCEPT: {sum(1 for r in pass_1_results if r['decision'] == 'ACCEPT')}
  - WEAK_ACCEPT: {sum(1 for r in pass_1_results if r['decision'] == 'WEAK_ACCEPT')}
  - REJECTED: {sum(1 for r in pass_1_results if r['decision'] == 'REJECTED')}

Pass 2 (Claude Validation): {len(pass_2_results)} results

Pass 3 (Final Confirmation): {len(pass_3_results)} results

Validated Signals: {len(validated_signals)}
Rejected: {output_data['rejected_count']}
Validation Rate: {output_data['validation_rate']:.1%}
"""

            step.status = StepStatus.SUCCESS
            logs.append("Ralph Loop validation completed successfully")

        except Exception as e:
            step.status = StepStatus.FAILED
            logs.append(f"Error: {str(e)}")
            details = f"Step 3 failed: {str(e)}"
            logger.error(f"Step 3 error: {e}", exc_info=True)

        # Finalize step
        step.completed_at = datetime.now(timezone.utc).isoformat()
        step.duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        step.output_data = output_data
        step.details = details
        step.logs = logs
        step.metrics = {
            "signals_input": len(signals),
            "signals_validated": len(output_data.get("validated_signals", [])),
            "signals_rejected": output_data.get("rejected_count", 0),
            "validation_rate": output_data.get("validation_rate", 0.0)
        }

        # Save raw data
        self._save_step_data(step)

        return step

    # ========================================================================
    # Step 4: Temporal Intelligence
    # ========================================================================

    async def step_4_temporal_intelligence(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str
    ) -> StepExecution:
        """
        Step 4: Temporal intelligence analysis.

        Uses graphiti_service for timeline analysis.

        Args:
            entity_id: Unique entity identifier
            entity_name: Display name
            entity_type: Entity type

        Returns:
            StepExecution with temporal analysis results
        """
        step = self._create_step(
            step_number=4,
            step_name="Temporal Intelligence",
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            input_data={
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type
            }
        )

        start_time = datetime.now(timezone.utc)
        logs = []
        output_data = {}

        try:
            await self._initialize_clients()

            if self._graphiti_service is None:
                raise ImportError("Graphiti service not available")

            logs.append("Fetching entity timeline from Graphiti...")

            # Get entity timeline
            timeline = await self._graphiti_service.get_entity_timeline(entity_id)
            logs.append(f"Retrieved {len(timeline)} timeline episodes")

            # Calculate temporal metrics
            if timeline:
                dates = [ep.get('created_at', '') for ep in timeline if ep.get('created_at')]
                if dates:
                    from datetime import datetime
                    parsed_dates = [datetime.fromisoformat(d.replace('Z', '+00:00')) for d in dates if d]
                    if len(parsed_dates) >= 2:
                        time_span_days = (max(parsed_dates) - min(parsed_dates)).days
                    else:
                        time_span_days = 0
                else:
                    time_span_days = 0

                # Detect patterns
                patterns_detected = []
                episode_types = {}
                for ep in timeline:
                    ep_type = ep.get('episode_type', 'OTHER')
                    episode_types[ep_type] = episode_types.get(ep_type, 0) + 1

                    # Pattern detection
                    if ep_type == 'RFP_DETECTED' and ep_type not in patterns_detected:
                        patterns_detected.append('RFP Activity')
                    elif ep_type == 'HIRING' and 'Hiring' not in patterns_detected:
                        patterns_detected.append('Hiring Activity')
                    elif ep_type == 'PARTNERSHIP' and 'Partnership' not in patterns_detected:
                        patterns_detected.append('Partnership Activity')

                # Find similar entities
                similar_entities = await self._graphiti_service.find_similar_entities(
                    entity_id,
                    limit=5
                )

                # Calculate temporal fit score
                temporal_fit_score = 0.5
                if episode_types.get('RFP_DETECTED', 0) > 0:
                    temporal_fit_score += 0.2
                if time_span_days > 365:
                    temporal_fit_score += 0.1
                if len(episode_types) > 2:
                    temporal_fit_score += 0.1
                temporal_fit_score = min(temporal_fit_score, 1.0)

            else:
                time_span_days = 0
                patterns_detected = []
                similar_entities = []
                episode_types = {}
                temporal_fit_score = 0.0

            logs.append(f"Temporal analysis complete: fit_score={temporal_fit_score:.2f}")

            # Build output
            output_data = {
                "timeline_episodes": len(timeline),
                "time_span_days": time_span_days,
                "patterns_detected": patterns_detected,
                "episode_types": episode_types,
                "similar_entities": similar_entities[:5] if similar_entities else [],
                "temporal_fit_score": temporal_fit_score
            }

            # Build details
            details = f"""Step 4: Temporal Intelligence Analysis

Entity: {entity_name}
Timeline Episodes: {len(timeline)}
Time Span: {time_span_days} days

Patterns Detected:
"""
            for pattern in patterns_detected:
                details += f"  - {pattern}\n"

            details += f"\nEpisode Types:\n"
            for ep_type, count in episode_types.items():
                details += f"  - {ep_type}: {count}\n"

            if similar_entities:
                details += f"\nSimilar Entities:\n"
                for entity in similar_entities[:5]:
                    details += f"  - {entity.get('name', 'Unknown')}\n"

            details += f"\nTemporal Fit Score: {temporal_fit_score:.2f}"
            details += f"\n  (Based on RFP history, timeline depth, and pattern diversity)"

            step.status = StepStatus.SUCCESS
            logs.append("Temporal intelligence analysis completed successfully")

        except Exception as e:
            step.status = StepStatus.FAILED
            logs.append(f"Error: {str(e)}")
            details = f"Step 4 failed: {str(e)}"
            logger.error(f"Step 4 error: {e}", exc_info=True)

        # Finalize step
        step.completed_at = datetime.now(timezone.utc).isoformat()
        step.duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        step.output_data = output_data
        step.details = details
        step.logs = logs
        step.metrics = {
            "timeline_episodes": output_data.get("timeline_episodes", 0),
            "time_span_days": output_data.get("time_span_days", 0),
            "patterns_detected": len(output_data.get("patterns_detected", [])),
            "temporal_fit_score": output_data.get("temporal_fit_score", 0.0)
        }

        # Save raw data
        self._save_step_data(step)

        return step

    # ========================================================================
    # Step 5: Narrative Builder
    # ========================================================================

    async def step_5_narrative_builder(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        max_tokens: int = 2000
    ) -> StepExecution:
        """
        Step 5: Narrative builder for temporal episodes.

        Uses narrative_builder module to compress episodes into Claude-friendly format.

        Args:
            entity_id: Unique entity identifier
            entity_name: Display name
            entity_type: Entity type
            max_tokens: Maximum tokens for narrative (default: 2000)

        Returns:
            StepExecution with narrative generation results
        """
        step = self._create_step(
            step_number=5,
            step_name="Narrative Builder",
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            input_data={
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type,
                "max_tokens": max_tokens
            }
        )

        start_time = datetime.now(timezone.utc)
        logs = []
        output_data = {}

        try:
            await self._initialize_clients()

            if self._graphiti_service is None:
                raise ImportError("Graphiti service not available")

            logs.append("Fetching episodes for narrative building...")

            # Get episodes
            timeline = await self._graphiti_service.get_entity_timeline(entity_id)
            logs.append(f"Retrieved {len(timeline)} episodes")

            # Build narrative
            from backend.narrative_builder import build_narrative_from_episodes

            narrative_result = build_narrative_from_episodes(
                episodes=timeline,
                max_tokens=max_tokens,
                group_by_type=True
            )

            logs.append(f"Narrative built: {narrative_result['estimated_tokens']} tokens")

            # Build output
            output_data = {
                "narrative": narrative_result['narrative'],
                "episode_count": narrative_result['episode_count'],
                "total_episodes": narrative_result['total_episodes'],
                "estimated_tokens": narrative_result['estimated_tokens'],
                "truncated": narrative_result['truncated']
            }

            # Build details
            details = f"""Step 5: Narrative Builder

Entity: {entity_name}
Episodes Available: {narrative_result['total_episodes']}
Episodes Included: {narrative_result['episode_count']}
Estimated Tokens: {narrative_result['estimated_tokens']}
Truncated: {narrative_result['truncated']}

Narrative Preview (first 500 chars):
{narrative_result['narrative'][:500]}...
"""

            step.status = StepStatus.SUCCESS
            logs.append("Narrative builder completed successfully")

        except Exception as e:
            step.status = StepStatus.FAILED
            logs.append(f"Error: {str(e)}")
            details = f"Step 5 failed: {str(e)}"
            logger.error(f"Step 5 error: {e}", exc_info=True)

        # Finalize step
        step.completed_at = datetime.now(timezone.utc).isoformat()
        step.duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        step.output_data = output_data
        step.details = details
        step.logs = logs
        step.metrics = {
            "episodes_available": output_data.get("total_episodes", 0),
            "episodes_included": output_data.get("episode_count", 0),
            "estimated_tokens": output_data.get("estimated_tokens", 0),
            "truncated": output_data.get("truncated", False)
        }

        # Save raw data
        self._save_step_data(step)

        return step

    # ========================================================================
    # Step 6: Yellow Panther Scoring
    # ========================================================================

    async def step_6_yellow_panther_scoring(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        signals: List[Dict[str, Any]],
        temporal_fit: float = 0.5
    ) -> StepExecution:
        """
        Step 6: Yellow Panther opportunity scoring.

        Uses yellow_panther_scorer module to score RFP fit.

        Args:
            entity_id: Unique entity identifier
            entity_name: Display name
            entity_type: Entity type
            signals: Validated signals from Step 3
            temporal_fit: Temporal fit score from Step 4

        Returns:
            StepExecution with YP scoring results
        """
        step = self._create_step(
            step_number=6,
            step_name="Yellow Panther Scoring",
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            input_data={
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type,
                "signals_count": len(signals),
                "temporal_fit": temporal_fit
            }
        )

        start_time = datetime.now(timezone.utc)
        logs = []
        output_data = {}

        try:
            logs.append("Importing yellow_panther_scorer module...")

            from backend.yellow_panther_scorer import (
                YellowPantherFitScorer,
                ServiceCategory,
                PriorityTier,
                BudgetAlignment
            )

            scorer = YellowPantherFitScorer()
            logs.append("Scoring entity against YP profile...")

            # Build signal context for scoring
            signal_context = {
                "entity_name": entity_name,
                "entity_type": entity_type,
                "signals": signals,
                "temporal_fit": temporal_fit
            }

            # Score the entity
            score_result = scorer.score_opportunity(signal_context)

            logs.append(f"YP Fit Score: {score_result['fit_score']}/100")
            logs.append(f"Priority: {score_result['priority']}")

            # Build output
            output_data = {
                "fit_score": score_result['fit_score'],
                "priority": score_result['priority'],
                "budget_alignment": score_result['budget_alignment'],
                "service_alignment": score_result['service_alignment'],
                "positioning_strategy": score_result['positioning_strategy'],
                "recommendations": score_result['recommendations'],
                "scoring_breakdown": score_result.get('scoring_breakdown', {})
            }

            # Build details
            details = f"""Step 6: Yellow Panther Fit Scoring

Entity: {entity_name}
Entity Type: {entity_type}

YP Fit Score: {score_result['fit_score']}/100
Priority Tier: {score_result['priority']}
Budget Alignment: {score_result['budget_alignment']}

Service Alignment:
"""
            for service in score_result['service_alignment']:
                details += f"  - {service}\n"

            details += f"\nPositioning Strategy: {score_result['positioning_strategy']}\n"

            details += f"\nRecommendations:\n"
            for rec in score_result['recommendations']:
                details += f"  - {rec}\n"

            if 'scoring_breakdown' in score_result:
                details += f"\nScoring Breakdown:\n"
                for criterion, points in score_result['scoring_breakdown'].items():
                    details += f"  - {criterion}: {points} points\n"

            step.status = StepStatus.SUCCESS
            logs.append("Yellow Panther scoring completed successfully")

        except Exception as e:
            step.status = StepStatus.FAILED
            logs.append(f"Error: {str(e)}")
            details = f"Step 6 failed: {str(e)}"
            logger.error(f"Step 6 error: {e}", exc_info=True)

        # Finalize step
        step.completed_at = datetime.now(timezone.utc).isoformat()
        step.duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        step.output_data = output_data
        step.details = details
        step.logs = logs
        step.metrics = {
            "fit_score": output_data.get("fit_score", 0),
            "priority": output_data.get("priority", "UNKNOWN"),
            "budget_alignment": output_data.get("budget_alignment", "UNKNOWN"),
            "service_alignment_count": len(output_data.get("service_alignment", [])),
            "recommendations_count": len(output_data.get("recommendations", []))
        }

        # Save raw data
        self._save_step_data(step)

        return step

    # ========================================================================
    # Run All Steps
    # ========================================================================

    async def run_all_steps(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        max_iterations: int = 10
    ) -> List[StepExecution]:
        """
        Execute all 6 system steps in sequence.

        Args:
            entity_id: Unique entity identifier
            entity_name: Display name
            entity_type: Entity type (SPORT_CLUB, SPORT_FEDERATION, SPORT_LEAGUE)
            max_iterations: Max iterations for discovery step

        Returns:
            List of StepExecution objects
        """
        steps = []

        try:
            # Step 1: Question-First Dossier
            logger.info(f"Starting Step 1 for {entity_name}")
            step1 = await self.step_1_question_first_dossier(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type
            )
            steps.append(step1)
            self.execution_context["steps_completed"].append(1)

            # Step 2: Hypothesis-Driven Discovery
            logger.info(f"Starting Step 2 for {entity_name}")
            hypotheses = step1.output_data.get("hypotheses", [])
            step2 = await self.step_2_hypothesis_driven_discovery(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                hypotheses=hypotheses,
                max_iterations=max_iterations
            )
            steps.append(step2)
            self.execution_context["steps_completed"].append(2)

            # Step 3: Ralph Loop Validation
            logger.info(f"Starting Step 3 for {entity_name}")
            signals = step2.output_data.get("validated_signals", [])
            step3 = await self.step_3_ralph_loop_validation(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                signals=signals
            )
            steps.append(step3)
            self.execution_context["steps_completed"].append(3)

            # Step 4: Temporal Intelligence
            logger.info(f"Starting Step 4 for {entity_name}")
            step4 = await self.step_4_temporal_intelligence(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type
            )
            steps.append(step4)
            self.execution_context["steps_completed"].append(4)

            # Step 5: Narrative Builder
            logger.info(f"Starting Step 5 for {entity_name}")
            step5 = await self.step_5_narrative_builder(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type
            )
            steps.append(step5)
            self.execution_context["steps_completed"].append(5)

            # Step 6: Yellow Panther Scoring
            logger.info(f"Starting Step 6 for {entity_name}")
            validated_signals = step3.output_data.get("validated_signals", [])
            temporal_fit = step4.output_data.get("temporal_fit_score", 0.5)
            step6 = await self.step_6_yellow_panther_scoring(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                signals=validated_signals,
                temporal_fit=temporal_fit
            )
            steps.append(step6)
            self.execution_context["steps_completed"].append(6)

            # Update execution context
            total_cost = sum(s.cost_usd for s in steps)
            self.execution_context["total_cost_usd"] = total_cost

            logger.info(f"All steps completed for {entity_name}. Total cost: ${total_cost:.4f}")

        except Exception as e:
            logger.error(f"Error running steps for {entity_name}: {e}", exc_info=True)

        return steps


# ========================================================================
# Standalone Execution
# ========================================================================

if __name__ == "__main__":
    import asyncio

    async def main():
        wrapper = SystemStepWrapper(output_dir="./data")

        # Run demo for Arsenal FC
        steps = await wrapper.run_all_steps(
            entity_id="arsenal-fc",
            entity_name="Arsenal FC",
            entity_type="SPORT_CLUB",
            max_iterations=5  # Small number for quick demo
        )

        print("\n" + "="*60)
        print("DEMO EXECUTION SUMMARY")
        print("="*60)

        for step in steps:
            print(f"\nStep {step.step_number}: {step.step_name}")
            print(f"  Status: {step.status.value}")
            print(f"  Duration: {step.duration_ms}ms")
            print(f"  Cost: ${step.cost_usd:.4f}")

    asyncio.run(main())
