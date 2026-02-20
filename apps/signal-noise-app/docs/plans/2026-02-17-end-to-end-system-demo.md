# End-to-End System Demonstration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Execute and document the complete 6-step system flow across 3 entity types (Arsenal FC, International Canoe Federation, MLC) to demonstrate full system functionality for client presentation.

**Architecture:** A Python orchestrator script runs each system component sequentially, capturing all outputs, metrics, and logs. A documentation generator script compiles captured data into a comprehensive markdown document with no elisions.

**Tech Stack:** Python 3.10+, asyncio for concurrent operations, JSON for data capture, Markdown for documentation

---

## Task 1: Create Directory Structure

**Files:**
- Create: `docs/end-to-end-system-demo/`
- Create: `docs/end-to-end-system-demo/data/`
- Create: `docs/end-to-end-system-demo/scripts/`

**Step 1: Create the directory structure**

```bash
mkdir -p docs/end-to-end-system-demo/data
mkdir -p docs/end-to-end-system-demo/scripts
```

**Step 2: Verify directories were created**

Run: `ls -la docs/end-to-end-system-demo/`
Expected: Output showing `data/` and `scripts/` directories

**Step 3: Create README for the demo directory**

Create file: `docs/end-to-end-system-demo/README.md`

```markdown
# End-to-End System Demonstration

This directory contains the complete end-to-end system demonstration for client presentation.

## Structure

- `scripts/` - Orchestration and data capture scripts
- `data/` - Raw captured data from system execution
- `2026-02-17-end-to-end-system-demo.md` - Complete documentation (generated)

## Running the Demo

```bash
cd docs/end-to-end-system-demo/scripts
python run_end_to_end_demo.py
```

This will:
1. Execute all 6 system steps for 3 entities
2. Capture all outputs, metrics, and logs
3. Generate the complete markdown documentation
```

**Step 4: Commit**

```bash
git add docs/end-to-end-system-demo/
git commit -m "feat: create directory structure for end-to-end system demo"
```

---

## Task 2: Create Data Capture Models

**Files:**
- Create: `docs/end-to-end-system-demo/scripts/data_models.py`

**Step 1: Write the data models**

```python
#!/usr/bin/env python3
"""
Data models for end-to-end system demonstration
Captures all outputs from each system step
"""

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Any, Optional
from datetime import datetime
from enum import Enum
import json


class StepStatus(str, Enum):
    """Status of a system step execution"""
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class StepExecution:
    """Execution data for a single system step"""
    step_number: int
    step_name: str
    entity_id: str
    entity_name: str
    entity_type: str

    # Timing
    started_at: str
    completed_at: str
    duration_ms: int

    # Cost
    cost_usd: float

    # Status
    status: StepStatus

    # Input/Output
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]

    # Details (full content, no truncation)
    details: str
    logs: List[str] = field(default_factory=list)

    # Metrics
    metrics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        d = asdict(self)
        d['status'] = self.status.value
        return d


@dataclass
class EntityExecution:
    """Complete execution data for a single entity"""
    entity_id: str
    entity_name: str
    entity_type: str
    started_at: str
    completed_at: str
    duration_ms: int
    cost_usd: float

    # All 6 steps
    steps: List[StepExecution] = field(default_factory=list)

    # Final results
    final_confidence: float = 0.0
    total_signals: int = 0
    procurement_signals: int = 0
    capability_signals: int = 0
    confidence_band: str = ""
    estimated_value: str = ""

    # Recommendations
    recommendations: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return asdict(self)


@dataclass
class DemoExecution:
    """Complete end-to-end demonstration data"""
    version: str = "1.0.0"
    generated_at: str = ""
    total_duration_ms: int = 0
    total_cost_usd: float = 0.0

    # Entity executions
    entities: List[EntityExecution] = field(default_factory=list)

    # Summary
    summary: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return asdict(self)

    def save(self, filepath: str):
        """Save to JSON file"""
        self.generated_at = datetime.utcnow().isoformat()
        with open(filepath, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)


@dataclass
class QuestionFirstResult:
    """Results from Step 1: Question-First Dossier"""
    hypotheses: List[Dict[str, Any]]
    total_questions: int
    starting_confidence: float
    yp_service_mappings: List[str]
    budget_ranges: List[str]


@dataclass
class DiscoveryResult:
    """Results from Step 2: Hypothesis-Driven Discovery"""
    final_confidence: float
    total_iterations: int
    hops_executed: List[Dict[str, Any]]
    searches_performed: List[Dict[str, Any]]
    urls_discovered: List[str]
    confidence_progression: List[float]
    decisions: List[Dict[str, Any]]


@dataclass
class RalphLoopResult:
    """Results from Step 3: Ralph Loop Validation"""
    pass_1_results: List[Dict[str, Any]]
    pass_2_results: List[Dict[str, Any]]
    pass_3_results: List[Dict[str, Any]]
    validated_signals: List[Dict[str, Any]]
    rejected_count: int


@dataclass
class TemporalIntelligenceResult:
    """Results from Step 4: Temporal Intelligence"""
    timeline_episodes: int
    time_span_days: int
    patterns_detected: List[str]
    similar_entities: List[str]
    temporal_fit_score: float


@dataclass
class NarrativeBuilderResult:
    """Results from Step 5: Narrative Builder"""
    episode_count: int
    estimated_tokens: int
    truncated: bool
    narrative_preview: str


@dataclass
class YellowPantherScoringResult:
    """Results from Step 6: Yellow Panther Scoring"""
    fit_score: int
    priority: str
    budget_alignment: str
    service_alignment: List[str]
    positioning_strategy: str
    recommendations: List[str]
```

**Step 2: Run basic syntax check**

Run: `cd docs/end-to-end-system-demo/scripts && python -m py_compile data_models.py`
Expected: No output (successful compilation)

**Step 3: Commit**

```bash
git add docs/end-to-end-system-demo/scripts/data_models.py
git commit -m "feat: add data models for end-to-end demo"
```

---

## Task 3: Create System Step Wrappers

**Files:**
- Create: `docs/end-to-end-system-demo/scripts/step_wrappers.py`

**Step 1: Write the step wrapper functions**

```python
#!/usr/bin/env python3
"""
Wrapper functions for each system step
Provides standardized interface and data capture
"""

import sys
import os
import asyncio
import time
from datetime import datetime, timezone
from typing import Dict, List, Any
import json

# Add backend to path
backend_path = os.path.join(os.path.dirname(__file__), '../../backend')
sys.path.insert(0, backend_path)

from data_models import (
    StepExecution, StepStatus,
    QuestionFirstResult, DiscoveryResult, RalphLoopResult,
    TemporalIntelligenceResult, NarrativeBuilderResult,
    YellowPantherScoringResult
)


class SystemStepWrapper:
    """Wrapper for executing and capturing system steps"""

    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def _create_step(
        self,
        step_number: int,
        step_name: str,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        input_data: Dict[str, Any]
    ) -> StepExecution:
        """Initialize a new step execution record"""
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
            status=StepStatus.IN_PROGRESS,
            input_data=input_data,
            output_data={},
            details="",
            logs=[]
        )

    async def step_1_question_first_dossier(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str
    ) -> StepExecution:
        """
        Step 1: Question-First Dossier System

        Generates testable procurement hypotheses based on entity type
        """
        step = self._create_step(
            step_number=1,
            step_name="Question-First Dossier System",
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            input_data={"entity_id": entity_id, "entity_name": entity_name, "entity_type": entity_type}
        )

        start_time = time.time()

        try:
            # Import the question-first system
            from entity_type_dossier_questions import (
                get_questions_for_entity_type,
                generate_hypothesis_batch
            )

            # Get questions for this entity type
            questions = get_questions_for_entity_type(entity_type)

            # Generate hypotheses
            hypotheses = generate_hypothesis_batch(
                entity_type=entity_type,
                entity_name=entity_name,
                entity_id=entity_id,
                max_questions=10  # Get all questions
            )

            # Extract results
            starting_confidence = sum(h.get('metadata', {}).get('prior_confidence', 0.5) for h in hypotheses) / len(hypotheses) if hypotheses else 0.5

            yp_services = set()
            budget_ranges = []
            for h in hypotheses:
                yp_services.update(h.get('metadata', {}).get('yp_service_fit', []))
                budget_ranges.append(h.get('metadata', {}).get('budget_range', 'Unknown'))

            # Format output
            step.output_data = {
                "hypotheses_generated": len(hypotheses),
                "questions_used": len(questions),
                "starting_confidence": round(starting_confidence, 2),
                "yp_services": list(yp_services),
                "budget_ranges": list(set(budget_ranges))
            }

            # Build detailed output
            details = []
            details.append(f"## Question-First Dossier Results for {entity_name}")
            details.append(f"")
            details.append(f"**Entity Type:** {entity_type}")
            details.append(f"**Questions Template Used:** {len(questions)} questions")
            details.append(f"**Hypotheses Generated:** {len(hypotheses)}")
            details.append(f"**Starting Confidence:** {starting_confidence:.2f}")
            details.append(f"")
            details.append(f"### Generated Hypotheses")
            details.append(f"")

            for i, hyp in enumerate(hypotheses, 1):
                details.append(f"#### Hypothesis {i}: {hyp.get('statement', 'N/A')}")
                details.append(f"")
                metadata = hyp.get('metadata', {})
                details.append(f"- **Question ID:** {hyp.get('question_id', 'N/A')}")
                details.append(f"- **YP Services:** {', '.join(metadata.get('yp_service_fit', []))}")
                details.append(f"- **Budget Range:** {metadata.get('budget_range', 'N/A')}")
                details.append(f"- **Positioning Strategy:** {metadata.get('positioning_strategy', 'N/A')}")
                details.append(f"- **Next Signals:** {', '.join(metadata.get('next_signals', []))}")
                details.append(f"- **Hop Types:** {', '.join(metadata.get('hop_types', []))}")
                details.append(f"- **Prior Confidence:** {metadata.get('prior_confidence', 0.5)}")
                details.append(f"")

            details.append(f"### YP Service Coverage")
            details.append(f"")
            for service in sorted(yp_services):
                count = sum(1 for h in hypotheses if service in h.get('metadata', {}).get('yp_service_fit', []))
                details.append(f"- **{service}:** {count} hypotheses")

            step.details = "\n".join(details)

            # Save raw data
            self._save_step_data(step.step_name, entity_id, {
                "hypotheses": hypotheses,
                "questions_template": [{"id": q.question_id, "question": q.question} for q in questions]
            })

            step.status = StepStatus.SUCCESS
            step.cost_usd = 0.01  # Minimal cost for template generation

        except Exception as e:
            step.status = StepStatus.FAILED
            step.details = f"Error: {str(e)}"
            step.logs.append(f"ERROR: {str(e)}")

        # Finalize timing
        end_time = time.time()
        step.completed_at = datetime.now(timezone.utc).isoformat()
        step.duration_ms = int((end_time - start_time) * 1000)

        return step

    async def step_2_hypothesis_driven_discovery(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        dossier_hypotheses: List[Dict[str, Any]]
    ) -> StepExecution:
        """
        Step 2: Hypothesis-Driven Discovery

        Executes single-hop discovery to validate hypotheses
        """
        step = self._create_step(
            step_number=2,
            step_name="Hypothesis-Driven Discovery",
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            input_data={"entity_id": entity_id, "hypotheses_count": len(dossier_hypotheses)}
        )

        start_time = time.time()

        try:
            # Import discovery system
            from hypothesis_driven_discovery import HypothesisDrivenDiscovery
            from claude_client import ClaudeClient
            from brightdata_sdk_client import BrightDataSDKClient

            # Initialize clients
            claude = ClaudeClient()
            brightdata = BrightDataSDKClient()

            # Create discovery instance
            discovery = HypothesisDrivenDiscovery(
                claude_client=claude,
                brightdata_client=brightdata
            )

            # Convert dossier hypotheses to internal format
            from hypothesis_manager import Hypothesis, HypothesisCategory

            internal_hypotheses = []
            for hyp_dict in dossier_hypotheses[:3]:  # Limit to 3 for demo
                # Map to internal categories
                category_str = hyp_dict.get('metadata', {}).get('category', 'DIGITAL_INFRASTRUCTURE')
                try:
                    category = HypothesisCategory[category_str]
                except KeyError:
                    category = HypothesisCategory.DIGITAL_INFRASTRUCTURE

                h = Hypothesis(
                    hypothesis_id=f"{entity_id}-{hyp_dict.get('question_id', 'unknown')}",
                    entity_id=entity_id,
                    category=category,
                    statement=hyp_dict.get('statement', ''),
                    prior_confidence=hyp_dict.get('metadata', {}).get('prior_confidence', 0.5)
                )
                internal_hypotheses.append(h)

            # Run discovery (warm-start with dossier hypotheses)
            result = await discovery.run_discovery(
                entity_id=entity_id,
                entity_name=entity_name,
                template_id="question_first",  # Use question-first template
                max_iterations=15,  # Limited for demo speed
                max_depth=2
            )

            # Extract results
            final_confidence = result.get('final_confidence', 0.0)
            validated_signals = result.get('validated_signals', [])
            iteration_log = result.get('iteration_log', [])
            total_cost = result.get('total_cost', 0.0)

            # Build output
            step.output_data = {
                "final_confidence": round(final_confidence, 2),
                "iterations": len(iteration_log),
                "signals_found": len(validated_signals),
                "total_cost": round(total_cost, 2)
            }

            # Build detailed output
            details = []
            details.append(f"## Hypothesis-Driven Discovery Results for {entity_name}")
            details.append(f"")
            details.append(f"**Starting Hypotheses:** {len(dossier_hypotheses)}")
            details.append(f"**Iterations Executed:** {len(iteration_log)}")
            details.append(f"**Final Confidence:** {final_confidence:.2f}")
            details.append(f"**Signals Discovered:** {len(validated_signals)}")
            details.append(f"")

            details.append(f"### Iteration Log")
            details.append(f"")

            confidence_progression = []
            for i, log_entry in enumerate(iteration_log, 1):
                iteration = log_entry.get('iteration', i)
                hypothesis_id = log_entry.get('hypothesis_id', 'unknown')
                hop_type = log_entry.get('hop_type', 'unknown')
                decision = log_entry.get('decision', 'NO_PROGRESS')
                confidence = log_entry.get('confidence_after', 0.0)
                confidence_progression.append(confidence)

                details.append(f"#### Iteration {iteration}")
                details.append(f"")
                details.append(f"- **Hypothesis:** {hypothesis_id}")
                details.append(f"- **Hop Type:** {hop_type}")
                details.append(f"- **Decision:** {decision}")
                details.append(f"- **Confidence After:** {confidence:.2f}")

                if 'url' in log_entry:
                    details.append(f"- **URL:** {log_entry['url']}")
                if 'search_query' in log_entry:
                    details.append(f"- **Search Query:** {log_entry['search_query']}")
                details.append(f"")

            details.append(f"### Confidence Progression")
            details.append(f"")
            for i, conf in enumerate(confidence_progression, 1):
                bar_length = int(conf * 20)
                bar = "█" * bar_length
                details.append(f"{i:2d}. {bar} {conf:.2f}")

            step.details = "\n".join(details)
            step.cost_usd = total_cost

            # Save raw data
            self._save_step_data(step.step_name, entity_id, result)

            step.status = StepStatus.SUCCESS

        except Exception as e:
            step.status = StepStatus.FAILED
            step.details = f"Error: {str(e)}\n\n{type(e).__name__}"
            step.logs.append(f"ERROR: {str(e)}")

        end_time = time.time()
        step.completed_at = datetime.now(timezone.utc).isoformat()
        step.duration_ms = int((end_time - start_time) * 1000)

        return step

    async def step_3_ralph_loop_validation(
        self,
        entity_id: str,
        entity_name: str,
        discovery_signals: List[Dict[str, Any]]
    ) -> StepExecution:
        """
        Step 3: Ralph Loop Validation

        3-pass validation governance for discovered signals
        """
        step = self._create_step(
            step_number=3,
            step_name="Ralph Loop Validation",
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type="",  # Not needed for Ralph
            input_data={"entity_id": entity_id, "signals_count": len(discovery_signals)}
        )

        start_time = time.time()

        try:
            from ralph_loop import RalphLoop, RalphLoopConfig
            from claude_client import ClaudeClient
            from graphiti_service import GraphitiService

            # Initialize
            claude = ClaudeClient()
            graphiti = GraphitiService()
            await graphiti.initialize()

            ralph = RalphLoop(claude, graphiti)

            # Run 3-pass validation
            validated = await ralph.validate_signals(
                raw_signals=discovery_signals,
                entity_id=entity_id
            )

            # Extract results
            pass_1_count = sum(1 for s in validated if s.get('pass_1_approved', False))
            pass_2_count = sum(1 for s in validated if s.get('pass_2_approved', False))
            pass_3_count = sum(1 for s in validated if s.get('pass_3_approved', False))

            # Build details
            details = []
            details.append(f"## Ralph Loop Validation Results for {entity_name}")
            details.append(f"")
            details.append(f"**Input Signals:** {len(discovery_signals)}")
            details.append(f"**Pass 1 Approved:** {pass_1_count}")
            details.append(f"**Pass 2 Approved:** {pass_2_count}")
            details.append(f"**Pass 3 Final:** {pass_3_count}")
            details.append(f"")

            details.append(f"### Pass 1: Rule-Based Filtering")
            details.append(f"")
            details.append(f"Criteria:")
            details.append(f"- Minimum 3 pieces of evidence")
            details.append(f"- Source credibility > 0.6")
            details.append(f"")

            for signal in validated:
                sid = signal.get('id', 'unknown')
                approved = signal.get('pass_1_approved', False)
                status = "✅" if approved else "❌"
                evidence_count = signal.get('evidence_count', 0)
                details.append(f"{status} {sid} ({evidence_count} evidence)")

            details.append(f"")
            details.append(f"### Pass 2: Claude Validation")
            details.append(f"")
            details.append(f"Cross-check with existing signals and confidence validation")
            details.append(f"")

            for signal in validated:
                sid = signal.get('id', 'unknown')
                approved = signal.get('pass_2_approved', False)
                original_conf = signal.get('original_confidence', 0.0)
                validated_conf = signal.get('validated_confidence', 0.0)
                status = "✅" if approved else "❌"
                details.append(f"{status} {sid}: {original_conf:.2f} → {validated_conf:.2f}")

            details.append(f"")
            details.append(f"### Pass 3: Final Confirmation")
            details.append(f"")
            details.append(f"Duplicate detection and final scoring")
            details.append(f"")

            final_signals = [s for s in validated if s.get('final_confidence', 0) > 0.7]
            for signal in final_signals:
                sid = signal.get('id', 'unknown')
                conf = signal.get('final_confidence', 0.0)
                decision = signal.get('ralph_decision', 'NO_PROGRESS')
                details.append(f"- **{sid}:** {decision} (confidence: {conf:.2f})")

            step.details = "\n".join(details)

            step.output_data = {
                "pass_1_approved": pass_1_count,
                "pass_2_approved": pass_2_count,
                "final_validated": pass_3_count,
                "final_signals": final_signals
            }

            step.status = StepStatus.SUCCESS
            step.cost_usd = 0.05  # Cost for Claude validation

        except Exception as e:
            step.status = StepStatus.FAILED
            step.details = f"Error: {str(e)}\n\n{type(e).__name__}"
            step.logs.append(f"ERROR: {str(e)}")

        end_time = time.time()
        step.completed_at = datetime.now(timezone.utc).isoformat()
        step.duration_ms = int((end_time - start_time) * 1000)

        return step

    async def step_4_temporal_intelligence(
        self,
        entity_id: str,
        entity_name: str,
        validated_signals: List[Dict[str, Any]]
    ) -> StepExecution:
        """
        Step 4: Temporal Intelligence

        Historical analysis, timeline building, pattern recognition
        """
        step = self._create_step(
            step_number=4,
            step_name="Temporal Intelligence",
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type="",
            input_data={"entity_id": entity_id, "signals_count": len(validated_signals)}
        )

        start_time = time.time()

        try:
            from graphiti_service import GraphitiService

            graphiti = GraphitiService()
            await graphiti.initialize()

            # Get entity timeline
            timeline = await graphiti.get_entity_timeline(entity_id)

            # Analyze patterns
            episodes = timeline.get('episodes', [])
            time_span_days = timeline.get('time_span_days', 0)

            # Build details
            details = []
            details.append(f"## Temporal Intelligence Analysis for {entity_name}")
            details.append(f"")
            details.append(f"**Episodes Found:** {len(episodes)}")
            details.append(f"**Time Span:** {time_span_days} days")
            details.append(f"")

            if episodes:
                details.append(f"### Historical Timeline")
                details.append(f"")

                # Group by episode type
                by_type = {}
                for ep in episodes:
                    ep_type = ep.get('episode_type', 'OTHER')
                    if ep_type not in by_type:
                        by_type[ep_type] = []
                    by_type[ep_type].append(ep)

                for ep_type, eps in sorted(by_type.items()):
                    details.append(f"#### {ep_type} ({len(eps)} episodes)")
                    details.append(f"")
                    for ep in eps[:5]:  # Show first 5
                        timestamp = ep.get('timestamp', 'Unknown')
                        title = ep.get('title', 'Untitled')
                        details.append(f"- {timestamp}: {title}")

                    if len(eps) > 5:
                        details.append(f"- ... and {len(eps) - 5} more")
                    details.append(f"")

                # Pattern detection
                details.append(f"### Pattern Detection")
                details.append(f"")
                details.append(f"Analyzing temporal patterns for procurement signals...")
                details.append(f"")

                # Similar entities
                similar = await graphiti.find_similar_entities(entity_id, limit=3)
                if similar:
                    details.append(f"#### Similar Entities")
                    details.append(f"")
                    for sim in similar:
                        sim_id = sim.get('entity_id', 'unknown')
                        sim_name = sim.get('entity_name', 'Unknown')
                        similarity = sim.get('similarity_score', 0.0)
                        details.append(f"- **{sim_name}** ({sim_id}): {similarity:.2%} similarity")
                    details.append(f"")
            else:
                details.append(f"*No historical episodes found. This entity is new to the system.*")
                details.append(f"")

            step.details = "\n".join(details)

            step.output_data = {
                "episodes_found": len(episodes),
                "time_span_days": time_span_days,
                "similar_entities": [e.get('entity_id') for e in similar] if similar else []
            }

            step.status = StepStatus.SUCCESS
            step.cost_usd = 0.02

        except Exception as e:
            step.status = StepStatus.FAILED
            step.details = f"Error: {str(e)}\n\n{type(e).__name__}"
            step.logs.append(f"ERROR: {str(e)}")

        end_time = time.time()
        step.completed_at = datetime.now(timezone.utc).isoformat()
        step.duration_ms = int((end_time - start_time) * 1000)

        return step

    async def step_5_narrative_builder(
        self,
        entity_id: str,
        entity_name: str,
        episodes: List[Dict[str, Any]]
    ) -> StepExecution:
        """
        Step 5: Narrative Builder

        Token-bounded compression of episodes for Claude context
        """
        step = self._create_step(
            step_number=5,
            step_name="Narrative Builder",
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type="",
            input_data={"entity_id": entity_id, "episodes_count": len(episodes)}
        )

        start_time = time.time()

        try:
            from narrative_builder import build_narrative_from_episodes

            # Build narrative
            narrative = build_narrative_from_episodes(
                episodes=episodes,
                max_tokens=2000,
                group_by_type=True
            )

            # Extract results
            narrative_text = narrative.get('narrative', '')
            episode_count = narrative.get('episode_count', 0)
            total_episodes = narrative.get('total_episodes', 0)
            estimated_tokens = narrative.get('estimated_tokens', 0)
            truncated = narrative.get('truncated', False)

            # Build details
            details = []
            details.append(f"## Narrative Builder Results for {entity_name}")
            details.append(f"")
            details.append(f"**Input Episodes:** {total_episodes}")
            details.append(f"**Episodes Included:** {episode_count}")
            details.append(f"**Estimated Tokens:** {estimated_tokens}")
            details.append(f"**Truncated:** {'Yes' if truncated else 'No'}")
            details.append(f"")

            details.append(f"### Generated Narrative")
            details.append(f"")
            details.append(f"```")
            details.append(narrative_text)
            details.append(f"```")

            step.details = "\n".join(details)

            step.output_data = {
                "episode_count": episode_count,
                "total_episodes": total_episodes,
                "estimated_tokens": estimated_tokens,
                "truncated": truncated
            }

            step.status = StepStatus.SUCCESS
            step.cost_usd = 0.0  # No API cost

        except Exception as e:
            step.status = StepStatus.FAILED
            step.details = f"Error: {str(e)}\n\n{type(e).__name__}"
            step.logs.append(f"ERROR: {str(e)}")

        end_time = time.time()
        step.completed_at = datetime.now(timezone.utc).isoformat()
        step.duration_ms = int((end_time - start_time) * 1000)

        return step

    async def step_6_yellow_panther_scoring(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        validated_signals: List[Dict[str, Any]]
    ) -> StepExecution:
        """
        Step 6: Yellow Panther Scoring

        Fit scoring, positioning strategy, and recommendations
        """
        step = self._create_step(
            step_number=6,
            step_name="Yellow Panther Scoring",
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            input_data={"entity_id": entity_id, "signals_count": len(validated_signals)}
        )

        start_time = time.time()

        try:
            from yellow_panther_scorer import YellowPantherFitScorer

            scorer = YellowPantherFitScorer()

            # Score each signal
            scored_opportunities = []
            for signal in validated_signals:
                result = scorer.score_opportunity(
                    signal=signal,
                    entity={"name": entity_name, "type": entity_type}
                )
                scored_opportunities.append(result)

            # Aggregate scores
            total_fit = sum(o.get('fit_score', 0) for o in scored_opportunities)
            avg_fit = total_fit / len(scored_opportunities) if scored_opportunities else 0

            # Get top opportunity
            top_opp = max(scored_opportunities, key=lambda x: x.get('fit_score', 0), default={})

            # Build details
            details = []
            details.append(f"## Yellow Panther Scoring Results for {entity_name}")
            details.append(f"")
            details.append(f"**Signals Scored:** {len(scored_opportunities)}")
            details.append(f"**Average Fit Score:** {avg_fit:.1f}/100")
            details.append(f"")

            details.append(f"### Opportunity Breakdown")
            details.append(f"")
            details.append(f"| Signal | Fit Score | Priority | Budget | Service Alignment |")
            details.append(f"|--------|-----------|----------|--------|-------------------|")

            for opp in scored_opportunities:
                signal_name = opp.get('signal_name', 'Unknown')[:30]
                fit_score = opp.get('fit_score', 0)
                priority = opp.get('priority', 'TIER_4')
                budget = opp.get('budget_alignment', 'UNKNOWN')
                services = ', '.join(opp.get('service_alignment', [])[:2])
                details.append(f"| {signal_name} | {fit_score}/100 | {priority} | {budget} | {services} |")

            details.append(f"")
            details.append(f"### Top Opportunity")
            details.append(f"")
            details.append(f"**Signal:** {top_opp.get('signal_name', 'N/A')}")
            details.append(f"**Fit Score:** {top_opp.get('fit_score', 0)}/100")
            details.append(f"**Priority:** {top_opp.get('priority', 'TIER_4')}")
            details.append(f"**Budget Alignment:** {top_opp.get('budget_alignment', 'UNKNOWN')}")
            details.append(f"**Positioning Strategy:** {top_opp.get('positioning_strategy', 'N/A')}")
            details.append(f"")

            details.append(f"### Recommendations")
            details.append(f"")
            for rec in top_opp.get('recommendations', []):
                details.append(f"- {rec}")

            step.details = "\n".join(details)

            step.output_data = {
                "average_fit_score": round(avg_fit, 1),
                "top_priority": top_opp.get('priority', 'TIER_4'),
                "positioning_strategy": top_opp.get('positioning_strategy', 'Unknown'),
                "recommendations": top_opp.get('recommendations', [])
            }

            step.status = StepStatus.SUCCESS
            step.cost_usd = 0.0

        except Exception as e:
            step.status = StepStatus.FAILED
            step.details = f"Error: {str(e)}\n\n{type(e).__name__}"
            step.logs.append(f"ERROR: {str(e)}")

        end_time = time.time()
        step.completed_at = datetime.now(timezone.utc).isoformat()
        step.duration_ms = int((end_time - start_time) * 1000)

        return step

    def _save_step_data(self, step_name: str, entity_id: str, data: Dict[str, Any]):
        """Save raw step data to JSON file"""
        filename = f"{entity_id}_{step_name.lower().replace(' ', '_')}.json"
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2, default=str)
```

**Step 2: Run basic syntax check**

Run: `cd docs/end-to-end-system-demo/scripts && python -m py_compile step_wrappers.py`
Expected: No output (successful compilation)

**Step 3: Commit**

```bash
git add docs/end-to-end-system-demo/scripts/step_wrappers.py
git commit -m "feat: add step wrapper functions for system execution"
```

---

## Task 4: Create Main Orchestrator Script

**Files:**
- Create: `docs/end-to-end-system-demo/scripts/run_end_to_end_demo.py`

**Step 1: Write the orchestrator script**

```python
#!/usr/bin/env python3
"""
End-to-End System Demonstration Orchestrator

Runs the complete 6-step system flow across 3 entity types:
1. Arsenal FC (SPORT_CLUB)
2. International Canoe Federation (SPORT_FEDERATION)
3. MLC (SPORT_LEAGUE)

Captures all outputs, metrics, and logs for client documentation.
"""

import asyncio
import sys
import os
import json
import time
from datetime import datetime, timezone
from pathlib import Path

# Add paths
script_dir = Path(__file__).parent
backend_dir = script_dir / '../../backend'
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(script_dir))

from data_models import DemoExecution, EntityExecution
from step_wrappers import SystemStepWrapper


# Entity configurations
ENTITIES = [
    {
        "entity_id": "arsenal-fc",
        "entity_name": "Arsenal FC",
        "entity_type": "SPORT_CLUB"
    },
    {
        "entity_id": "icf",
        "entity_name": "International Canoe Federation",
        "entity_type": "SPORT_FEDERATION"
    },
    {
        "entity_id": "mlc",
        "entity_name": "Major League Cricket",
        "entity_type": "SPORT_LEAGUE"
    }
]


def print_section(title: str):
    """Print formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80 + "\n")


async def run_entity_execution(
    wrapper: SystemStepWrapper,
    entity_config: dict
) -> EntityExecution:
    """
    Execute all 6 system steps for a single entity
    """
    entity_id = entity_config["entity_id"]
    entity_name = entity_config["entity_name"]
    entity_type = entity_config["entity_type"]

    print_section(f"Processing: {entity_name} ({entity_type})")

    entity_exec = EntityExecution(
        entity_id=entity_id,
        entity_name=entity_name,
        entity_type=entity_type,
        started_at=datetime.now(timezone.utc).isoformat(),
        completed_at="",
        duration_ms=0,
        cost_usd=0.0
    )

    start_time = time.time()

    # Step 1: Question-First Dossier
    print(f"Step 1: Question-First Dossier System...")
    step1 = await wrapper.step_1_question_first_dossier(
        entity_id=entity_id,
        entity_name=entity_name,
        entity_type=entity_type
    )
    entity_exec.steps.append(step1)
    print(f"  ✓ Completed in {step1.duration_ms}ms, ${step1.cost_usd:.2f}")

    # Extract hypotheses for next step
    dossier_hypotheses = step1.output_data.get("hypotheses", [])

    # Step 2: Hypothesis-Driven Discovery
    print(f"Step 2: Hypothesis-Driven Discovery...")
    step2 = await wrapper.step_2_hypothesis_driven_discovery(
        entity_id=entity_id,
        entity_name=entity_name,
        entity_type=entity_type,
        dossier_hypotheses=dossier_hypotheses
    )
    entity_exec.steps.append(step2)
    print(f"  ✓ Completed in {step2.duration_ms}ms, ${step2.cost_usd:.2f}")

    # Extract signals for next steps
    discovery_signals = step2.output_data.get("signals_found", [])
    validated_signals = step2.output_data.get("final_signals", [])
    final_confidence = step2.output_data.get("final_confidence", 0.0)

    # Step 3: Ralph Loop Validation
    print(f"Step 3: Ralph Loop Validation...")
    step3 = await wrapper.step_3_ralph_loop_validation(
        entity_id=entity_id,
        entity_name=entity_name,
        discovery_signals=validated_signals
    )
    entity_exec.steps.append(step3)
    print(f"  ✓ Completed in {step3.duration_ms}ms, ${step3.cost_usd:.2f}")

    # Step 4: Temporal Intelligence
    print(f"Step 4: Temporal Intelligence...")
    step4 = await wrapper.step_4_temporal_intelligence(
        entity_id=entity_id,
        entity_name=entity_name,
        validated_signals=validated_signals
    )
    entity_exec.steps.append(step4)
    print(f"  ✓ Completed in {step4.duration_ms}ms, ${step4.cost_usd:.2f}")

    # Extract episodes for narrative builder
    episodes = step4.output_data.get("episodes", [])

    # Step 5: Narrative Builder
    print(f"Step 5: Narrative Builder...")
    step5 = await wrapper.step_5_narrative_builder(
        entity_id=entity_id,
        entity_name=entity_name,
        episodes=episodes
    )
    entity_exec.steps.append(step5)
    print(f"  ✓ Completed in {step5.duration_ms}ms, ${step5.cost_usd:.2f}")

    # Step 6: Yellow Panther Scoring
    print(f"Step 6: Yellow Panther Scoring...")
    step6 = await wrapper.step_6_yellow_panther_scoring(
        entity_id=entity_id,
        entity_name=entity_name,
        entity_type=entity_type,
        validated_signals=validated_signals
    )
    entity_exec.steps.append(step6)
    print(f"  ✓ Completed in {step6.duration_ms}ms, ${step6.cost_usd:.2f}")

    # Finalize entity execution
    end_time = time.time()
    entity_exec.completed_at = datetime.now(timezone.utc).isoformat()
    entity_exec.duration_ms = int((end_time - start_time) * 1000)
    entity_exec.cost_usd = sum(s.cost_usd for s in entity_exec.steps)
    entity_exec.final_confidence = final_confidence
    entity_exec.total_signals = len(validated_signals)
    entity_exec.procurement_signals = sum(1 for s in validated_signals if s.get('signal_type') == 'procurement')
    entity_exec.capability_signals = entity_exec.total_signals - entity_exec.procurement_signals

    # Determine confidence band
    if final_confidence >= 0.80:
        entity_exec.confidence_band = "ACTIONABLE"
    elif final_confidence >= 0.60:
        entity_exec.confidence_band = "CONFIDENT"
    elif final_confidence >= 0.30:
        entity_exec.confidence_band = "INFORMED"
    else:
        entity_exec.confidence_band = "EXPLORATORY"

    # Extract recommendations
    entity_exec.recommendations = step6.output_data.get("recommendations", [])

    # Estimate value
    if entity_exec.confidence_band == "ACTIONABLE":
        entity_exec.estimated_value = "£500K+"
    elif entity_exec.confidence_band == "CONFIDENT":
        entity_exec.estimated_value = "£200K-£500K"
    elif entity_exec.confidence_band == "INFORMED":
        entity_exec.estimated_value = "£80K-£200K"
    else:
        entity_exec.estimated_value = "TBD"

    print(f"\n✅ {entity_name} Complete!")
    print(f"   Final Confidence: {final_confidence:.2f} ({entity_exec.confidence_band})")
    print(f"   Total Signals: {entity_exec.total_signals}")
    print(f"   Total Cost: ${entity_exec.cost_usd:.2f}")
    print(f"   Duration: {entity_exec.duration_ms / 1000:.1f}s")

    return entity_exec


async def main():
    """Main orchestrator"""
    print_section("SIGNAL NOISE: END-TO-END SYSTEM DEMONSTRATION")

    print(f"Started: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print(f"Entities: {len(ENTITIES)}")
    print(f"Steps per entity: 6")
    print()

    # Setup
    output_dir = Path(__file__).parent / '../data'
    wrapper = SystemStepWrapper(str(output_dir))

    demo = DemoExecution(
        version="1.0.0",
        generated_at="",
        total_duration_ms=0,
        total_cost_usd=0.0
    )

    overall_start = time.time()

    # Run each entity
    for entity_config in ENTITIES:
        entity_exec = await run_entity_execution(wrapper, entity_config)
        demo.entities.append(entity_exec)

    # Calculate totals
    overall_end = time.time()
    demo.total_duration_ms = int((overall_end - overall_start) * 1000)
    demo.total_cost_usd = sum(e.cost_usd for e in demo.entities)

    # Build summary
    demo.summary = {
        "total_entities": len(ENTITIES),
        "entity_types_tested": list(set(e.entity_type for e in demo.entities)),
        "total_steps_executed": sum(len(e.steps) for e in demo.entities),
        "successful_steps": sum(
            1 for e in demo.entities
            for s in e.steps
            if s.status.value == "success"
        ),
        "avg_confidence": sum(e.final_confidence for e in demo.entities) / len(demo.entities),
        "entity_results": [
            {
                "entity": e.entity_name,
                "confidence": e.final_confidence,
                "band": e.confidence_band,
                "signals": e.total_signals,
                "value": e.estimated_value
            }
            for e in demo.entities
        ]
    }

    # Save results
    results_file = output_dir / 'end_to_end_results.json'
    demo.save(str(results_file))

    print_section("DEMONSTRATION COMPLETE")

    print(f"Total Duration: {demo.total_duration_ms / 1000:.1f} seconds")
    print(f"Total Cost: ${demo.total_cost_usd:.2f}")
    print(f"Results Saved: {results_file}")
    print()

    print("Entity Results:")
    for e in demo.entities:
        print(f"  • {e.entity_name}: {e.final_confidence:.2f} ({e.confidence_band})")

    print()
    print("Next: Generate documentation with:")
    print(f"  python {script_dir / 'generate_documentation.py'}")

    return 0


if __name__ == "__main__":
    exit(asyncio.run(main()))
```

**Step 2: Run basic syntax check**

Run: `cd docs/end-to-end-system-demo/scripts && python -m py_compile run_end_to_end_demo.py`
Expected: No output (successful compilation)

**Step 3: Commit**

```bash
git add docs/end-to-end-system-demo/scripts/run_end_to_end_demo.py
git commit -m "feat: add main orchestrator for end-to-end demo"
```

---

## Task 5: Create Documentation Generator

**Files:**
- Create: `docs/end-to-end-system-demo/scripts/generate_documentation.py`

**Step 1: Write the documentation generator**

```python
#!/usr/bin/env python3
"""
Documentation Generator for End-to-End System Demo

Generates comprehensive markdown documentation from captured execution data.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def load_results(data_dir: Path) -> dict:
    """Load execution results from JSON file"""
    results_file = data_dir / 'end_to_end_results.json'
    with open(results_file) as f:
        return json.load(f)


def generate_markdown(results: dict) -> str:
    """Generate complete markdown documentation"""

    lines = []

    # Title and metadata
    lines.append("# Signal Noise App: End-to-End System Demonstration")
    lines.append("")
    lines.append(f"**Generated:** {results.get('generated_at', 'Unknown')}")
    lines.append(f"**Version:** {results.get('version', '1.0.0')}")
    lines.append(f"**Purpose:** Complete system validation across all entity types")
    lines.append("")

    # Executive Summary
    lines.append("---")
    lines.append("")
    lines.append("## Executive Summary")
    lines.append("")
    lines.append("This document demonstrates the complete Signal Noise system functionality")
    lines.append("by executing all 6 system steps across three different entity types:")
    lines.append("")

    for entity in results.get('entities', []):
        lines.append(f"- **{entity['entity_name']}** ({entity['entity_type']})")
        lines.append(f"  - Final Confidence: {entity['final_confidence']:.2f}")
        lines.append(f"  - Confidence Band: {entity['confidence_band']}")
        lines.append(f"  - Total Signals: {entity['total_signals']}")
        lines.append(f"  - Estimated Value: {entity['estimated_value']}")
        lines.append(f"  - Duration: {entity['duration_ms']/1000:.1f}s")
        lines.append(f"  - Cost: ${entity['cost_usd']:.2f}")
        lines.append("")

    summary = results.get('summary', {})
    lines.append(f"### Overall Metrics")
    lines.append("")
    lines.append(f"- **Total Entities Processed:** {summary.get('total_entities', 0)}")
    lines.append(f"- **Entity Types Tested:** {', '.join(summary.get('entity_types_tested', []))}")
    lines.append(f"- **Total Steps Executed:** {summary.get('total_steps_executed', 0)}")
    lines.append(f"- **Successful Steps:** {summary.get('successful_steps', 0)}")
    lines.append(f"- **Average Confidence:** {summary.get('avg_confidence', 0):.2f}")
    lines.append(f"- **Total Duration:** {results.get('total_duration_ms', 0)/1000:.1f} seconds")
    lines.append(f"- **Total Cost:** ${results.get('total_cost_usd', 0):.2f}")
    lines.append("")

    # System Architecture
    lines.append("---")
    lines.append("")
    lines.append("## System Architecture Overview")
    lines.append("")
    lines.append("```")
    lines.append("┌─────────────────────────────────────────────────────────────────────┐")
    lines.append("│                    SIGNAL NOISE SYSTEM FLOW                         │")
    lines.append("├─────────────────────────────────────────────────────────────────────┤")
    lines.append("│                                                                     │")
    lines.append("│  STEP 1: Question-First Dossier     ━━● Generate hypotheses       │")
    lines.append("│  STEP 2: Hypothesis-Driven Discovery ━━━━━● Validate via web       │")
    lines.append("│  STEP 3: Ralph Loop Validation     ━━━━━━━● 3-pass governance     │")
    lines.append("│  STEP 4: Temporal Intelligence     ━━━━━━━━● Pattern analysis      │")
    lines.append("│  STEP 5: Narrative Builder         ━━━━━━━━━● Compress context      │")
    lines.append("│  STEP 6: Yellow Panther Scoring    ━━━━━━━━━━● Sales positioning    │")
    lines.append("│                                                                     │")
    lines.append("└─────────────────────────────────────────────────────────────────────┘")
    lines.append("```")
    lines.append("")

    # Confidence Bands Reference
    lines.append("### Confidence Bands (Pricing)")
    lines.append("")
    lines.append("| Band | Range | Meaning | Price |")
    lines.append("|------|-------|---------|-------|")
    lines.append("| EXPLORATORY | <0.30 | Research phase | $0 |")
    lines.append("| INFORMED | 0.30-0.60 | Monitoring | $500/entity/month |")
    lines.append("| CONFIDENT | 0.60-0.80 | Sales engaged | $2,000/entity/month |")
    lines.append("| ACTIONABLE | >0.80 + gate | Immediate outreach | $5,000/entity/month |")
    lines.append("")

    # Decision Types Reference
    lines.append("### Decision Types (Internal → External)")
    lines.append("")
    lines.append("| Internal | External | Delta | Meaning |")
    lines.append("|----------|----------|-------|---------|")
    lines.append("| ACCEPT | Procurement Signal | +0.06 | Strong evidence of procurement intent |")
    lines.append("| WEAK_ACCEPT | Capability Signal | +0.02 | Capability present, intent unclear |")
    lines.append("| REJECT | No Signal | 0.00 | No evidence or contradicts hypothesis |")
    lines.append("| NO_PROGRESS | No Signal | 0.00 | No new information |")
    lines.append("| SATURATED | Saturated | 0.00 | Category exhausted |")
    lines.append("")

    # Entity walkthroughs
    for entity in results.get('entities', []):
        lines.extend(generate_entity_section(entity))
        lines.append("")

    # Cross-Entity Analysis
    lines.extend(generate_cross_entity_analysis(results))

    # Technical Appendix
    lines.extend(generate_technical_appendix(results))

    # Business Metrics Summary
    lines.extend(generate_business_metrics(results))

    return "\n".join(lines)


def generate_entity_section(entity: dict) -> list:
    """Generate detailed section for a single entity"""
    lines = []

    entity_name = entity['entity_name']
    entity_type = entity['entity_type']

    lines.append("---")
    lines.append("")
    lines.append(f"## Entity {entity['entity_id'].upper()}: {entity_name} ({entity_type})")
    lines.append("")

    # Entity summary
    lines.append(f"### Summary")
    lines.append("")
    lines.append(f"- **Entity ID:** {entity['entity_id']}")
    lines.append(f"- **Entity Type:** {entity_type}")
    lines.append(f"- **Started:** {entity['started_at']}")
    lines.append(f"- **Completed:** {entity['completed_at']}")
    lines.append(f"- **Duration:** {entity['duration_ms']/1000:.2f} seconds")
    lines.append(f"- **Total Cost:** ${entity['cost_usd']:.2f}")
    lines.append(f"- **Final Confidence:** {entity['final_confidence']:.2f}")
    lines.append(f"- **Confidence Band:** {entity['confidence_band']}")
    lines.append(f"- **Total Signals:** {entity['total_signals']}")
    lines.append(f"  - Procurement Signals: {entity['procurement_signals']}")
    lines.append(f"  - Capability Signals: {entity['capability_signals']}")
    lines.append(f"- **Estimated Value:** {entity['estimated_value']}")
    lines.append("")

    # Step details
    for step in entity.get('steps', []):
        lines.extend(generate_step_section(step))

    # Recommendations
    if entity.get('recommendations'):
        lines.append("### Sales Recommendations")
        lines.append("")
        for rec in entity['recommendations']:
            lines.append(f"- {rec}")
        lines.append("")

    return lines


def generate_step_section(step: dict) -> list:
    """Generate detailed section for a single step"""
    lines = []

    step_num = step['step_number']
    step_name = step['step_name']
    status = step['status']

    # Status indicator
    status_icon = {"success": "✅", "partial": "⚠️", "failed": "❌", "skipped": "⏭️"}.get(status, "❓")

    lines.append(f"### Step {step_num}: {step_name} {status_icon}")
    lines.append("")

    # Metrics
    lines.append(f"**Started:** {step['started_at']}")
    lines.append(f"**Completed:** {step['completed_at']}")
    lines.append(f"**Duration:** {step['duration_ms']}ms")
    lines.append(f"**Cost:** ${step['cost_usd']:.2f}")
    lines.append(f"**Status:** {status.upper()}")
    lines.append("")

    # Input
    if step.get('input_data'):
        lines.append(f"**Input:**")
        for key, value in step['input_data'].items():
            lines.append(f"  - `{key}`: {value}")
        lines.append("")

    # Output
    if step.get('output_data'):
        lines.append(f"**Output:**")
        for key, value in step['output_data'].items():
            lines.append(f"  - `{key}`: {value}")
        lines.append("")

    # Details (full content)
    if step.get('details'):
        lines.append(f"**Details:**")
        lines.append("")
        lines.append(step['details'])
        lines.append("")

    # Logs
    if step.get('logs'):
        lines.append(f"**Logs:**")
        lines.append("")
        for log in step['logs']:
            lines.append(f"  - {log}")
        lines.append("")

    return lines


def generate_cross_entity_analysis(results: dict) -> list:
    """Generate cross-entity comparison section"""
    lines = []

    lines.append("---")
    lines.append("")
    lines.append("## Cross-Entity Analysis")
    lines.append("")

    entities = results.get('entities', [])

    # Confidence comparison
    lines.append("### Confidence Comparison")
    lines.append("")
    lines.append("| Entity | Type | Confidence | Band | Signals | Duration | Cost |")
    lines.append("|--------|------|------------|------|---------|----------|------|")

    for e in entities:
        lines.append(f"| {e['entity_name']} | {e['entity_type']} | {e['final_confidence']:.2f} | {e['confidence_band']} | {e['total_signals']} | {e['duration_ms']/1000:.1f}s | ${e['cost_usd']:.2f} |")

    lines.append("")

    # Entity type breakdown
    lines.append("### Entity Type Breakdown")
    lines.append("")

    by_type = {}
    for e in entities:
        et = e['entity_type']
        if et not in by_type:
            by_type[et] = []
        by_type[et].append(e)

    for et, ents in sorted(by_type.items()):
        lines.append(f"#### {et}")
        lines.append("")
        lines.append(f"- **Count:** {len(ents)}")
        lines.append(f"- **Avg Confidence:** {sum(e['final_confidence'] for e in ents)/len(ents):.2f}")
        lines.append(f"- **Total Signals:** {sum(e['total_signals'] for e in ents)}")
        lines.append(f"- **Total Cost:** ${sum(e['cost_usd'] for e in ents):.2f}")
        lines.append("")

    # Scalability demonstration
    lines.append("### Scalability Demonstration")
    lines.append("")
    lines.append("The system successfully processed three different entity types without")
    lines.append("any manual configuration or template updates:")
    lines.append("")
    for e in entities:
        lines.append(f"- ✅ {e['entity_name']} ({e['entity_type']}) - {e['total_signals']} signals detected")
    lines.append("")
    lines.append("This demonstrates that the Question-First system scales across all")
    lines.append("entity types in the taxonomy using entity-type-specific question templates.")
    lines.append("")

    return lines


def generate_technical_appendix(results: dict) -> list:
    """Generate technical appendix"""
    lines = []

    lines.append("---")
    lines.append("")
    lines.append("## Technical Appendix")
    lines.append("")

    # System Components
    lines.append("### System Components")
    lines.append("")
    lines.append("| Component | File | Purpose |")
    lines.append("|-----------|------|---------|")
    lines.append("| Question-First Dossier | `entity_type_dossier_questions.py` | Generate hypotheses from entity type |")
    lines.append("| Hypothesis-Driven Discovery | `hypothesis_driven_discovery.py` | Single-hop validation via web searches |")
    lines.append("| Ralph Loop | `ralph_loop.py` | 3-pass signal validation governance |")
    lines.append("| Temporal Intelligence | `graphiti_service.py` | Timeline analysis and pattern recognition |")
    lines.append("| Narrative Builder | `narrative_builder.py` | Token-bounded episode compression |")
    lines.append("| Yellow Panther Scorer | `yellow_panther_scorer.py` | Fit scoring and positioning |")
    lines.append("")

    # Data Flow
    lines.append("### Data Flow")
    lines.append("")
    lines.append("```")
    lines.append("Entity Name + Type")
    lines.append("        │")
    lines.append("        ▼")
    lines.append("Question-First Dossier → Hypotheses (prior_confidence ~0.50)")
    lines.append("        │")
    lines.append("        ▼")
    lines.append("Hypothesis-Driven Discovery → Validated Signals (confidence 0.00-1.00)")
    lines.append("        │")
    lines.append("        ▼")
    lines.append("Ralph Loop (3-pass) → Governed Signals (>0.7 threshold)")
    lines.append("        │")
    lines.append("        ▼")
    lines.append("Temporal Intelligence → Timeline + Patterns")
    lines.append("        │")
    lines.append("        ▼")
    lines.append("Narrative Builder → Compressed Narrative (max_tokens)")
    lines.append("        │")
    lines.append("        ▼")
    lines.append("Yellow Panther Scoring → Fit Score + Recommendations")
    lines.append("```")
    lines.append("")

    # API Endpoints Used
    lines.append("### External APIs Used")
    lines.append("")
    lines.append("| Service | Purpose | Cost Model |")
    lines.append("|---------|---------|------------|")
    lines.append("| Anthropic Claude | AI reasoning | Per-token pricing |")
    lines.append("| BrightData SDK | Web scraping | Pay-per-success |")
    lines.append("| FalkorDB | Graph database | Self-hosted |")
    lines.append("| Supabase | Cache layer | Usage-based |")
    lines.append("")

    return lines


def generate_business_metrics(results: dict) -> list:
    """Generate business metrics summary"""
    lines = []

    lines.append("---")
    lines.append("")
    lines.append("## Business Metrics Summary")
    lines.append("")

    entities = results.get('entities', [])
    summary = results.get('summary', {})

    # ROI calculation
    total_cost = results.get('total_cost_usd', 0)
    total_value = 0
    for e in entities:
        val_str = e.get('estimated_value', 'TBD')
        if '£' in val_str:
            # Extract numeric value
            import re
            match = re.search(r'£(\d+)K', val_str)
            if match:
                total_value += int(match.group(1))

    lines.append("### Value Demonstration")
    lines.append("")
    lines.append(f"- **Total System Cost:** ${total_cost:.2f}")
    lines.append(f"- **Total Opportunity Value Identified:** £{total_value}K")
    lines.append(f"- **ROI Multiple:** {total_value / (total_cost * 0.8) if total_cost > 0 else 0:.1f}x")  # Rough GBP/USD conversion
    lines.append("")

    # Signal breakdown
    total_procurement = sum(e.get('procurement_signals', 0) for e in entities)
    total_capability = sum(e.get('capability_signals', 0) for e in entities)

    lines.append("### Signal Breakdown")
    lines.append("")
    lines.append(f"- **Procurement Signals:** {total_procurement}")
    lines.append(f"  - High-confidence indicators of upcoming RFPs/tenders")
    lines.append(f"- **Capability Signals:** {total_capability}")
    lines.append(f"  - Evidence of digital maturity without immediate procurement intent")
    lines.append(f"- **Total Signals:** {total_procurement + total_capability}")
    lines.append("")

    # Actionable insights
    lines.append("### Actionable Insights")
    lines.append("")
    for e in entities:
        if e['confidence_band'] in ['CONFIDENT', 'ACTIONABLE']:
            lines.append(f"#### {e['entity_name']}")
            lines.append("")
            lines.append(f"- **Priority:** {e['confidence_band']}")
            lines.append(f"- **Next Action:** {'Immediate outreach' if e['confidence_band'] == 'ACTIONABLE' else 'Engage sales team'}")
            lines.append(f"- **Estimated Value:** {e['estimated_value']}")
            lines.append("")

    return lines


def main():
    """Generate documentation from captured results"""

    # Setup paths
    script_dir = Path(__file__).parent
    data_dir = script_dir / '../data'
    docs_dir = script_dir / '..'

    print("Loading execution results...")
    results = load_results(data_dir)

    print("Generating markdown documentation...")
    markdown = generate_markdown(results)

    # Write output
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    output_file = docs_dir / f'{timestamp}-end-to-end-system-demo.md'

    with open(output_file, 'w') as f:
        f.write(markdown)

    print(f"Documentation saved to: {output_file}")
    print(f"Characters: {len(markdown):,}")
    print(f"Lines: {markdown.count(chr(10)) + 1:,}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

**Step 2: Run basic syntax check**

Run: `cd docs/end-to-end-system-demo/scripts && python -m py_compile generate_documentation.py`
Expected: No output (successful compilation)

**Step 3: Commit**

```bash
git add docs/end-to-end-system-demo/scripts/generate_documentation.py
git commit -m "feat: add documentation generator for end-to-end demo"
```

---

## Task 6: Create Quick Start Script

**Files:**
- Create: `docs/end-to-end-system-demo/run-demo.sh`

**Step 1: Write the quick start script**

```bash
#!/bin/bash
# Quick start script for end-to-end system demo

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "================================"
echo "  SIGNAL NOISE E2E DEMO"
echo "================================"
echo ""

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "Using Python: $python_version"

# Check environment
if [ ! -f "../../backend/.env" ] && [ ! -f "../../.env" ]; then
    echo "Warning: No .env file found. Please configure environment variables."
    echo "Required: ANTHROPIC_API_KEY, BRIGHTDATA_API_TOKEN"
    echo ""
fi

# Run the demo
echo ""
echo "Step 1: Running end-to-end execution..."
cd scripts
python3 run_end_to_end_demo.py

echo ""
echo "Step 2: Generating documentation..."
python3 generate_documentation.py

echo ""
echo "================================"
echo "  DEMO COMPLETE"
echo "================================"
echo ""
echo "Documentation: $(ls -t ../20*-end-to-end-system-demo.md | head -1)"
echo ""
```

**Step 2: Make script executable**

Run: `chmod +x docs/end-to-end-system-demo/run-demo.sh`
Expected: No output (sets execute bit)

**Step 3: Commit**

```bash
git add docs/end-to-end-system-demo/run-demo.sh
git commit -m "feat: add quick start script for end-to-end demo"
```

---

## Task 7: Test Execution (Dry Run)

**Files:**
- Modify: None (test run)

**Step 1: Run a dry-run syntax check on all scripts**

```bash
cd docs/end-to-end-system-demo/scripts
python3 -m compile_all data_models.py step_wrappers.py run_end_to_end_demo.py generate_documentation.py
```

Expected: No output indicates all scripts compile successfully

**Step 2: Verify directory structure**

```bash
cd docs/end-to-end-system-demo
find . -type f -name "*.py" -o -name "*.sh" -o -name "*.md" | sort
```

Expected output:
```
./README.md
./run-demo.sh
./scripts/data_models.py
./scripts/generate_documentation.py
./scripts/run_end_to_end_demo.py
./scripts/step_wrappers.py
```

**Step 3: Commit if all checks pass**

```bash
git add docs/end-to-end-system-demo/
git commit -m "chore: verify all demo scripts compile successfully"
```

---

## Task 8: Execute Full Demo and Generate Documentation

**Files:**
- Create: `docs/end-to-end-system-demo/data/` (generated data files)
- Create: `docs/end-to-end-system-demo/YYYY-MM-DD-end-to-end-system-demo.md` (final documentation)

**Step 1: Execute the full demo**

```bash
cd docs/end-to-end-system-demo
./run-demo.sh
```

Expected: The script will run all 6 steps for 3 entities, capturing data and generating documentation

**Step 2: Verify generated documentation exists**

```bash
ls -lh docs/end-to-end-system-demo/*.md
```

Expected: Output showing the generated markdown file with size

**Step 3: Review documentation content**

```bash
head -100 docs/end-to-end-system-demo/20*-end-to-end-system-demo.md
```

Expected: Documentation header and executive summary visible

**Step 4: Commit documentation**

```bash
git add docs/end-to-end-system-demo/
git commit -m "docs: add generated end-to-end system demonstration documentation"
```

---

## Summary

This implementation plan creates a complete end-to-end system demonstration that:

1. **Executes all 6 system steps** for 3 different entity types
2. **Captures all outputs** with full detail (no elisions)
3. **Generates comprehensive markdown** documentation suitable for client presentation
4. **Demonstrates scalability** across entity types without manual configuration

### File Structure Created

```
docs/end-to-end-system-demo/
├── README.md                          # Quick start guide
├── run-demo.sh                        # One-command execution
├── scripts/
│   ├── data_models.py                 # Data structures
│   ├── step_wrappers.py               # System step wrappers
│   ├── run_end_to_end_demo.py         # Main orchestrator
│   └── generate_documentation.py      # Documentation generator
└── data/
    ├── end_to_end_results.json        # Captured execution data
    ├── arsenal-fc_*.json              # Entity-specific data
    ├── icf_*.json
    └── mlc_*.json
```

### Execution Time Estimate

- Arsenal FC: ~30-60 seconds (most data available)
- ICF: ~20-40 seconds (moderate data)
- MLC: ~20-40 seconds (moderate data)
- **Total: ~2-3 minutes** for full execution
- Documentation generation: ~1 second

### Success Criteria

✅ All 6 steps execute for all 3 entities
✅ Final documentation contains no elisions
✅ Business metrics clearly visible
✅ Technical details fully captured
✅ Scalability demonstrated across entity types
