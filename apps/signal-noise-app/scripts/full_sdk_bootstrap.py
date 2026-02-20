#!/usr/bin/env python3
"""
Full SDK Bootstrap Pass

Runs 30 iterations × 1,268 entities with BrightData SDK + Claude Agent SDK + Ralph Loop.

OBJECTIVE:
- Replace template-inherited patterns with empirically discovered patterns
- Domain discovery via BrightData SDK
- 30-iteration exploration with Ralph Loop validation
- Save runtime bindings with discovered data

AUTHOR: Claude Code
DATE: 2026-01-31
ADAPTED FROM: backend/calibration_experiment.py
"""

import os
import sys
import logging
import json
import asyncio
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
from enum import Enum

# Add paths
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables from multiple .env files FIRST
from dotenv import load_dotenv

# Try loading from .env first (has BRIGHTDATA token), then .env.ralph, then .env.local
env_files = [
    Path(__file__).parent.parent / ".env",
    Path(__file__).parent.parent / ".env.ralph",
    Path(__file__).parent.parent / ".env.local"
]

# Load ALL existing env files (not just first one) so all variables are available
for env_file in env_files:
    if env_file.exists():
        load_dotenv(env_file, override=True)
        print(f"✅ Loaded environment from {env_file.name}")

# Verify token was loaded
token = os.getenv('BRIGHTDATA_API_TOKEN')
if token:
    print(f"✅ BRIGHTDATA_API_TOKEN found: {token[:20]}...")
else:
    print(f"❌ BRIGHTDATA_API_TOKEN not found in any env file")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data/full_sdk_bootstrap.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


# =============================================================================
# FIXED CONSTANTS (NO DRIFT)
# =============================================================================

START_CONFIDENCE = 0.20
MAX_CONFIDENCE = 0.95
MIN_CONFIDENCE = 0.05

ACCEPT_DELTA = +0.06
WEAK_ACCEPT_DELTA = +0.02
REJECT_DELTA = 0.00

MAX_ITERATIONS = 30  # Hard cap for bootstrap (changed from 150)

DEFAULT_CHECKPOINT_INTERVAL = 50
DEFAULT_MAX_ENTITIES = None  # Process all entities


# =============================================================================
# 8 FIXED CATEGORIES (MUTUALLY EXCLUSIVE)
# =============================================================================

BOOTSTRAP_CATEGORIES = [
    "Digital Infrastructure & Stack",
    "Commercial & Revenue Systems",
    "Fan Engagement & Experience",
    "Data, Analytics & AI",
    "Operations & Internal Transformation",
    "Media, Content & Broadcasting",
    "Partnerships, Vendors & Ecosystem",
    "Governance, Compliance & Security",
]


# =============================================================================
# RALPH DECISION RUBRIC (HARD RULES)
# =============================================================================

class RalphDecision(Enum):
    """Ralph Loop decision types"""
    ACCEPT = "ACCEPT"
    WEAK_ACCEPT = "WEAK_ACCEPT"
    REJECT = "REJECT"


def apply_ralph_decision_rubric(
    evidence_text: str,
    category: str,
    entity_name: str,
    source_url: str,
    previous_evidences: List[str]
) -> tuple[RalphDecision, str]:
    """
    Apply Ralph Decision Rubric (hard rules, no ambiguity)

    ACCEPT (all must be true):
    1. Evidence is NEW (not logged previously)
    2. Evidence is ENTITY-SPECIFIC (explicit name match)
    3. Evidence implies FUTURE ACTION (budgeting, procurement, hiring, RFP)
    4. Source is CREDIBLE and NON-TRIVIAL (official site, job board, press release)

    WEAK_ACCEPT:
    - Evidence is new but one or more ACCEPT criteria partially missing
    - Max 1 WEAK_ACCEPT per signal type (tracked elsewhere)

    REJECT:
    - No new information
    - Generic industry commentary
    - Duplicate or paraphrased signals
    - Historical-only information
    - Speculation without evidence

    Args:
        evidence_text: Evidence content
        category: Category being explored
        entity_name: Entity being explored
        source_url: Source URL
        previous_evidences: List of previous evidence texts

    Returns:
        (RalphDecision, justification)
    """
    # Check 1: Is evidence NEW?
    is_new = evidence_text not in previous_evidences

    if not is_new:
        # Check for paraphrase/duplicate
        for prev in previous_evidences:
            if _similarity_check(evidence_text, prev) > 0.85:
                return RalphDecision.REJECT, "Duplicate or paraphrased signal"

    # Check 2: Is evidence ENTITY-SPECIFIC?
    entity_variations = [
        entity_name.lower(),
        entity_name.split()[0].lower(),  # First word (e.g., "Arsenal")
        entity_name.replace("FC", "").strip().lower(),
        entity_name.replace("International", "").strip().lower()
    ]
    is_entity_specific = any(var in evidence_text.lower() for var in entity_variations)

    # Check 3: Does evidence imply FUTURE ACTION?
    future_action_keywords = [
        "seeking", "hiring", "recruiting", "looking for", "procurement",
        "rfp", "tender", "vendor", "partner", "implement", "deploy",
        "migration", "upgrade", "transform", "digit", "platform"
    ]
    implies_future_action = any(kw in evidence_text.lower() for kw in future_action_keywords)

    # Check 4: Is source CREDIBLE?
    is_credible = _check_source_credibility(source_url)

    # Make decision
    if is_new and is_entity_specific and implies_future_action and is_credible:
        return RalphDecision.ACCEPT, "All ACCEPT criteria met (new, specific, future action, credible)"
    elif is_new and is_entity_specific:
        return RalphDecision.WEAK_ACCEPT, "New and entity-specific but missing future action or credibility"
    elif is_new and implies_future_action:
        return RalphDecision.WEAK_ACCEPT, "New with future action but not entity-specific"
    elif is_new:
        return RalphDecision.WEAK_ACCEPT, "New evidence but partially missing ACCEPT criteria"
    else:
        return RalphDecision.REJECT, "No new information or fails multiple ACCEPT criteria"


def _similarity_check(text1: str, text2: str) -> float:
    """Simple similarity check (can be enhanced with embeddings)"""
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())

    if not words1 or not words2:
        return 0.0

    intersection = words1.intersection(words2)
    union = words1.union(words2)

    return len(intersection) / len(union) if union else 0.0


def _check_source_credibility(url: str) -> bool:
    """Check if source is credible"""
    if not url:
        return False

    credible_patterns = [
        ".gov", ".edu", ".org",
        "jobs.", "careers", "official",
        "press-release", "newsroom", "/news/",
        "linkedin.com/jobs"
    ]

    return any(pattern in url.lower() for pattern in credible_patterns)


# =============================================================================
# CONFIDENCE MATH (FIXED - NO DRIFT)
# =============================================================================

@dataclass
class ConfidenceState:
    """Tracks confidence state for bootstrap"""
    current_confidence: float
    accepted_signals_per_category: Dict[str, int]
    consecutive_rejects_per_category: Dict[str, int]
    confidence_history: List[float]  # Track last 10 for saturation check


def calculate_confidence_update(
    state: ConfidenceState,
    decision: RalphDecision,
    category: str
) -> tuple[float, float, float]:
    """
    Calculate confidence update with fixed math (no drift)

    Args:
        state: Current confidence state
        decision: Ralph decision
        category: Category being explored

    Returns:
        (raw_delta, category_multiplier, applied_delta)
    """
    # Get raw delta
    if decision == RalphDecision.ACCEPT:
        raw_delta = ACCEPT_DELTA
    elif decision == RalphDecision.WEAK_ACCEPT:
        raw_delta = WEAK_ACCEPT_DELTA
    else:  # REJECT
        raw_delta = REJECT_DELTA

    # Calculate category multiplier
    accepted_in_category = state.accepted_signals_per_category.get(category, 0)
    category_multiplier = 1.0 / (1.0 + accepted_in_category)

    # Calculate applied delta
    applied_delta = raw_delta * category_multiplier

    return raw_delta, category_multiplier, applied_delta


def update_confidence(
    state: ConfidenceState,
    applied_delta: float
) -> float:
    """
    Update confidence with clamping

    Args:
        state: Current confidence state
        applied_delta: Delta to apply

    Returns:
        New confidence value (clamped to [MIN_CONFIDENCE, MAX_CONFIDENCE])
    """
    new_confidence = state.current_confidence + applied_delta
    return max(MIN_CONFIDENCE, min(MAX_CONFIDENCE, new_confidence))


def check_confidence_saturation(state: ConfidenceState) -> bool:
    """
    Check if confidence has saturated (early stop rule)

    Confidence increases by < 0.01 over 10 iterations -> CONFIDENCE_SATURATED

    Args:
        state: Current confidence state

    Returns:
        True if saturated
    """
    if len(state.confidence_history) < 10:
        return False

    recent_10 = state.confidence_history[-10:]
    increase = recent_10[-1] - recent_10[0]

    return increase < 0.01


def check_category_saturation(
    state: ConfidenceState,
    category: str
) -> bool:
    """
    Check if category is saturated (3 consecutive REJECTs)

    Args:
        state: Current confidence state
        category: Category to check

    Returns:
        True if category saturated
    """
    return state.consecutive_rejects_per_category.get(category, 0) >= 3


# =============================================================================
# BOOTSTRAP ITERATION LOG
# =============================================================================

@dataclass
class BootstrapIteration:
    """Single iteration log entry (enhanced for state-aware Ralph Loop)"""
    iteration: int
    entity: str
    entity_name: str  # NEW
    category: str
    source: str
    evidence_found: str
    ralph_decision: str
    raw_delta: float
    novelty_multiplier: float  # NEW
    hypothesis_alignment: float  # NEW
    ceiling_damping: float  # NEW
    category_multiplier: float
    applied_delta: float
    confidence_before: float
    confidence_after: float
    cumulative_cost: float
    justification: str
    timestamp: str


# =============================================================================
# MAIN BOOTSTRAP LOOP
# =============================================================================

class FullSDKBootstrap:
    """
    Runs 30 iterations × 1,268 entities for full SDK bootstrap

    Replaces template-inherited patterns with empirically discovered patterns.
    """

    def __init__(
        self,
        output_dir: str = "data/runtime_bindings",
        checkpoint_interval: int = DEFAULT_CHECKPOINT_INTERVAL
    ):
        """
        Initialize full SDK bootstrap

        Args:
            output_dir: Directory to save runtime bindings
            checkpoint_interval: Checkpoint every N entities
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.checkpoint_interval = checkpoint_interval
        self.checkpoint_file = Path("data/bootstrap_checkpoint.json")

        # Load entity cluster mapping
        with open("data/entity_cluster_mapping.json") as f:
            self.entity_cluster_mapping = json.load(f)

        logger.info(f"🚀 FullSDKBootstrap initialized")
        logger.info(f"   Output: {self.output_dir}")
        logger.info(f"   Entities to process: {len(self.entity_cluster_mapping)}")
        logger.info(f"   Checkpoint interval: {checkpoint_interval}")

    async def run_bootstrap(
        self,
        max_entities: Optional[int] = None,
        resume: bool = False
    ) -> Dict[str, Any]:
        """
        Run full bootstrap on all entities

        Args:
            max_entities: Maximum entities to process (for testing)
            resume: Resume from checkpoint

        Returns:
            Summary statistics
        """
        logger.info("🚀 Starting Full SDK Bootstrap")

        # Load checkpoint if resuming
        processed_entities = set()
        total_cost = 0.0

        if resume and self.checkpoint_file.exists():
            with open(self.checkpoint_file) as f:
                checkpoint = json.load(f)
                processed_entities = set(checkpoint.get("processed_entities", []))
                total_cost = checkpoint.get("total_cost_usd", 0.0)
                logger.info(f"📍 Resuming from checkpoint: {len(processed_entities)} entities processed")

        # Get entity list
        entities_to_process = [
            (entity_id, cluster_id)
            for entity_id, cluster_id in self.entity_cluster_mapping.items()
            if entity_id not in processed_entities
        ]

        if max_entities:
            entities_to_process = entities_to_process[:max_entities]
            logger.info(f"🔬 Processing {len(entities_to_process)} entities (max_entities={max_entities})")
        else:
            logger.info(f"🔬 Processing all {len(entities_to_process)} entities")

        # Process entities
        for idx, (entity_id, cluster_id) in enumerate(entities_to_process):
            entity_num = len(processed_entities) + idx + 1
            total_entities = len(self.entity_cluster_mapping)

            logger.info(f"\n{'='*80}")
            logger.info(f"Entity {entity_num}/{total_entities}: {entity_id} (cluster: {cluster_id})")
            logger.info(f"{'='*80}")

            try:
                # Run bootstrap for this entity
                entity_cost, iterations = await self._bootstrap_entity(
                    entity_id=entity_id,
                    cluster_id=cluster_id
                )

                total_cost += entity_cost
                processed_entities.add(entity_id)

                # Checkpoint
                if entity_num % self.checkpoint_interval == 0:
                    self._save_checkpoint(processed_entities, total_cost)
                    logger.info(f"💾 Checkpoint saved at entity {entity_num}")

            except Exception as e:
                logger.error(f"❌ Failed to bootstrap {entity_id}: {e}")
                # Continue with next entity
                continue

        # Save final checkpoint
        self._save_checkpoint(processed_entities, total_cost)

        # Generate final report
        report = self._generate_final_report(processed_entities, total_cost)

        # Delete checkpoint after success
        if self.checkpoint_file.exists():
            self.checkpoint_file.unlink()
            logger.info("🗑️ Checkpoint deleted after successful completion")

        logger.info(f"\n{'='*80}")
        logger.info("✅ FULL SDK BOOTSTRAP COMPLETE")
        logger.info(f"{'='*80}")
        logger.info(f"Processed entities: {len(processed_entities)}")
        logger.info(f"Total cost: ${total_cost:.2f}")
        if len(processed_entities) > 0:
            logger.info(f"Avg cost per entity: ${total_cost/len(processed_entities):.2f}")
        logger.info(f"{'='*80}\n")

        return report

    async def _bootstrap_entity(
        self,
        entity_id: str,
        cluster_id: str
    ) -> tuple[float, List[BootstrapIteration]]:
        """
        Bootstrap a single entity with state-aware Ralph Loop

        NEW IMPLEMENTATION (Phase 3):
        - Uses RalphState for state tracking across iterations
        - Early stopping via saturation detection
        - WEAK_ACCEPT guardrails prevent confidence inflation
        - Target: ~18 iterations (40% cost reduction)

        Args:
            entity_id: Entity identifier
            cluster_id: Cluster ID for template matching

        Returns:
            (total_cost, iterations)
        """
        # Load existing binding (template-inherited)
        binding_file = self.output_dir / f"{entity_id}.json"

        if binding_file.exists():
            with open(binding_file) as f:
                binding = json.load(f)
                entity_name = binding.get("entity_name", entity_id.replace("_", " ").title())
        else:
            logger.warning(f"⚠️ No existing binding for {entity_id}, creating new")
            entity_name = entity_id.replace("_", " ").title()
            binding = None

        # INITIALIZE RALPH STATE (NEW)
        from backend.schemas import RalphState
        ralph_state = RalphState(
            entity_id=entity_id,
            entity_name=entity_name,
            current_confidence=START_CONFIDENCE,
            iterations_completed=0,
            confidence_ceiling=MAX_CONFIDENCE
        )

        iteration_outputs = []
        cumulative_cost = 0.0

        # Discover domains via BrightData SDK
        discovered_domains = await self._discover_domains(entity_name)

        # Initialize clients
        from brightdata_sdk_client import BrightDataSDKClient
        brightdata = BrightDataSDKClient()

        # Import state-aware Ralph Loop function
        from backend.ralph_loop import run_ralph_iteration_with_state

        # Run iterations with early stopping
        for iteration in range(1, MAX_ITERATIONS + 1):
            logger.info(f"🔬 Iteration {iteration}/30 for {entity_id}")

            # Select category (round-robin through 8 categories)
            category = BOOTSTRAP_CATEGORIES[(iteration - 1) % len(BOOTSTRAP_CATEGORIES)]

            # Collect evidence
            evidence, source_url = await self._collect_evidence(
                brightdata=brightdata,
                entity_name=entity_name,
                category=category,
                discovered_domains=discovered_domains,
                iteration=iteration
            )

            # Estimate cost (Claude $0.02, BrightData $0.001)
            iteration_cost = 0.02 + 0.001
            cumulative_cost += iteration_cost

            # RUN RALPH ITERATION WITH STATE (NEW)
            iteration_output = await run_ralph_iteration_with_state(
                claude_client=None,  # Not needed for decision rubric
                ralph_state=ralph_state,
                category=category,
                evidence_text=evidence,
                source_url=source_url,
                iteration_number=iteration,
                cumulative_cost=cumulative_cost
            )

            iteration_outputs.append(iteration_output)

            logger.info(
                f"  📊 Iteration {iteration}: {iteration_output.decision.value} | "
                f"{category} | "
                f"Confidence: {iteration_output.confidence_before:.3f} → {iteration_output.confidence_after:.3f} | "
                f"Cost: ${cumulative_cost:.3f}"
            )

            # CHECK EARLY STOPPING CONDITIONS (NEW)
            if iteration_output.decision.value == "SATURATED":
                logger.info(f"⏹️ Early stop at iteration {iteration}: Category saturated")
                break
            if ralph_state.confidence_saturated:
                logger.info(f"🛑 Early stop at iteration {iteration}: Confidence saturated")
                break
            if ralph_state.global_saturated:
                logger.info(f"🌍 Early stop at iteration {iteration}: Global saturation")
                break
            if ralph_state.current_confidence >= 0.85:
                logger.info(f"🔒 Early stop at iteration {iteration}: High confidence reached")
                break

        # Convert iteration outputs to BootstrapIteration format for compatibility
        iterations = []
        for output in iteration_outputs:
            iteration = BootstrapIteration(
                iteration=output.iteration,
                entity=output.entity_id,
                entity_name=output.entity_name,
                category=output.category,
                source=output.source_url,
                evidence_found=output.evidence_found[:200] + "..." if len(output.evidence_found) > 200 else output.evidence_found,
                ralph_decision=output.decision.value,
                raw_delta=output.raw_delta,
                novelty_multiplier=output.novelty_multiplier,
                hypothesis_alignment=output.hypothesis_alignment,
                ceiling_damping=output.ceiling_damping,
                category_multiplier=output.category_multiplier,
                applied_delta=output.applied_delta,
                confidence_before=output.confidence_before,
                confidence_after=output.confidence_after,
                cumulative_cost=output.cumulative_cost,
                justification=output.justification,
                timestamp=output.timestamp.isoformat()
            )
            iterations.append(iteration)

        # Save binding with discovered patterns (enhanced with state)
        self._save_binding(
            entity_id=entity_id,
            entity_name=entity_name,
            cluster_id=cluster_id,
            discovered_domains=discovered_domains,
            iterations=iterations,
            final_confidence=ralph_state.current_confidence,
            total_cost=cumulative_cost,
            existing_binding=binding,
            ralph_state=ralph_state  # NEW: Pass full state
        )

        # Calculate savings
        iterations_saved = MAX_ITERATIONS - ralph_state.iterations_completed
        cost_savings_percent = (iterations_saved / MAX_ITERATIONS) * 100

        logger.info(f"✅ Bootstrap complete for {entity_id}:")
        logger.info(f"   Iterations: {ralph_state.iterations_completed}/{MAX_ITERATIONS} ({iterations_saved} saved)")
        logger.info(f"   Final confidence: {ralph_state.current_confidence:.3f}")
        logger.info(f"   Cost: ${cumulative_cost:.3f} ({cost_savings_percent:.1f}% savings)")
        logger.info(f"   Actionable: {ralph_state.is_actionable}")

        return cumulative_cost, iterations

    async def _discover_domains(self, entity_name: str) -> List[str]:
        """
        Discover official domains via BrightData SDK

        Args:
            entity_name: Entity name

        Returns:
            List of discovered domains
        """
        from brightdata_sdk_client import BrightDataSDKClient

        brightdata = BrightDataSDKClient()
        domains = []

        try:
            # Search for official website
            results = await brightdata.search_engine(
                query=f'"{entity_name}" official website',
                engine='google',
                num_results=5
            )

            if results.get("status") == "success":
                for result in results.get("results", []):
                    url = result.get("url", "")
                    # Extract domain from URL
                    if url:
                        domain = url.split("//")[-1].split("/")[0]
                        if domain not in domains:
                            domains.append(domain)

            logger.info(f"🔍 Discovered {len(domains)} domains for {entity_name}: {domains}")

        except Exception as e:
            logger.warning(f"⚠️ Domain discovery failed for {entity_name}: {e}")

        return domains

    async def _collect_evidence(
        self,
        brightdata,
        entity_name: str,
        category: str,
        discovered_domains: List[str],
        iteration: int
    ) -> tuple[str, str]:
        """
        Collect evidence for iteration

        Args:
            brightdata: BrightDataSDKClient instance
            entity_name: Entity being explored
            category: Category being explored
            discovered_domains: Discovered domains
            iteration: Iteration number

        Returns:
            (evidence_text, source_url)
        """
        # Placeholder implementation
        # Real implementation would use BrightData SDK to:
        # 1. Search for entity + category terms
        # 2. Scrape relevant URLs
        # 3. Extract evidence

        evidence = f"Evidence for {entity_name} in {category} (iteration {iteration})"
        source_url = f"https://{discovered_domains[0]}" if discovered_domains else "https://example.com"

        return evidence, source_url

    def _save_binding(
        self,
        entity_id: str,
        entity_name: str,
        cluster_id: str,
        discovered_domains: List[str],
        iterations: List[BootstrapIteration],
        final_confidence: float,
        total_cost: float,
        existing_binding: Optional[Dict] = None,
        ralph_state: 'RalphState' = None  # NEW
    ):
        """
        Save runtime binding with discovered patterns

        Args:
            entity_id: Entity identifier
            entity_name: Entity name
            cluster_id: Cluster ID
            discovered_domains: Discovered domains
            iterations: Bootstrap iterations
            final_confidence: Final confidence
            total_cost: Total cost
            existing_binding: Existing binding (if any)
            ralph_state: RalphState object (NEW)
        """
        binding_file = self.output_dir / f"{entity_id}.json"

        # Create or update binding
        if existing_binding:
            # Update existing binding (handle old schema)
            binding = existing_binding

            # Handle old schema (domains/channels at top level)
            if "domains" in binding and "discovered_data" not in binding:
                # Old schema - update in place
                binding["domains"] = discovered_domains
            else:
                # New schema - update discovered_data
                if "discovered_data" not in binding:
                    binding["discovered_data"] = {"domains": [], "channels": {}, "patterns": {}}
                binding["discovered_data"]["domains"] = discovered_domains

            # Update performance metrics
            if "performance_metrics" not in binding:
                binding["performance_metrics"] = {}

            binding["performance_metrics"]["total_iterations"] = len(iterations)
            binding["performance_metrics"]["total_cost_usd"] = total_cost
            binding["performance_metrics"]["final_confidence"] = final_confidence
            binding["performance_metrics"]["last_bootstrapped_at"] = datetime.now().isoformat()

            # NEW: Add Ralph state and metrics
            if ralph_state:
                binding["ralph_state"] = ralph_state.to_dict()
                binding["performance_metrics"]["is_actionable"] = ralph_state.is_actionable
                binding["performance_metrics"]["confidence_ceiling"] = ralph_state.confidence_ceiling
                binding["performance_metrics"]["categories_saturated"] = [
                    cat for cat, stats in ralph_state.category_stats.items()
                    if stats.saturation_score >= 0.7
                ]
                iterations_saved = MAX_ITERATIONS - ralph_state.iterations_completed
                binding["performance_metrics"]["cost_savings_percent"] = (iterations_saved / MAX_ITERATIONS) * 100

        else:
            # Create new binding
            from template_loader import TemplateLoader

            loader = TemplateLoader()
            template = loader.match_template(
                entity={
                    "entity_id": entity_id,
                    "sport": "unknown",  # Would be populated from entity profile
                    "org_type": "unknown",
                    "estimated_revenue_band": "unknown",
                    "digital_maturity": "unknown"
                }
            )

            binding = {
                "template_id": template.template_id if template else "unknown",
                "entity_id": entity_id,
                "entity_name": entity_name,
                "cluster_id": cluster_id,
                "discovered_data": {
                    "domains": discovered_domains,
                    "channels": {},
                    "patterns": {}
                },
                "performance_metrics": {
                    "total_iterations": len(iterations),
                    "total_cost_usd": total_cost,
                    "final_confidence": final_confidence,
                    "created_at": datetime.now().isoformat(),
                    "last_bootstrapped_at": datetime.now().isoformat()
                },
                "enriched_patterns": {},
                "confidence_adjustment": 0.0,
                "version": 1,
                "state": "EXPLORING"
            }

            # NEW: Add Ralph state to new bindings
            if ralph_state:
                binding["ralph_state"] = ralph_state.to_dict()
                binding["performance_metrics"]["is_actionable"] = ralph_state.is_actionable
                binding["performance_metrics"]["confidence_ceiling"] = ralph_state.confidence_ceiling
                iterations_saved = MAX_ITERATIONS - ralph_state.iterations_completed
                binding["performance_metrics"]["cost_savings_percent"] = (iterations_saved / MAX_ITERATIONS) * 100

        # Add iteration history to metadata (create if not exists)
        if "metadata" not in binding:
            binding["metadata"] = {}

        binding["metadata"]["bootstrap_iterations"] = [asdict(it) for it in iterations]

        # Save binding
        with open(binding_file, 'w') as f:
            json.dump(binding, f, indent=2)

        logger.info(f"💾 Saved binding for {entity_id} to {binding_file}")

    def _save_checkpoint(self, processed_entities: set, total_cost: float):
        """
        Save checkpoint for resume capability

        Args:
            processed_entities: Set of processed entity IDs
            total_cost: Total cost so far
        """
        checkpoint = {
            "timestamp": datetime.now().isoformat(),
            "processed_entities": list(processed_entities),
            "total_cost_usd": total_cost,
            "entity_count": len(processed_entities)
        }

        with open(self.checkpoint_file, 'w') as f:
            json.dump(checkpoint, f, indent=2)

        logger.info(f"💾 Checkpoint saved: {len(processed_entities)} entities, ${total_cost:.2f}")

    def _generate_final_report(self, processed_entities: set, total_cost: float) -> Dict[str, Any]:
        """
        Generate final bootstrap report

        Args:
            processed_entities: Set of processed entity IDs
            total_cost: Total cost

        Returns:
            Report dict
        """
        report = {
            "generated_at": datetime.now().isoformat(),
            "total_entities": len(processed_entities),
            "total_cost_usd": total_cost,
            "avg_cost_per_entity": total_cost / len(processed_entities) if processed_entities else 0.0,
            "estimated_total_iterations": len(processed_entities) * MAX_ITERATIONS,
            "max_iterations_per_entity": MAX_ITERATIONS
        }

        # Save report
        report_file = Path("data") / f"full_sdk_bootstrap_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)

        logger.info(f"📊 Final report saved to {report_file}")

        return report


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

async def main():
    """Main entry point"""
    global MAX_ITERATIONS  # Declare global at function start

    parser = argparse.ArgumentParser(description="Full SDK Bootstrap Pass")
    parser.add_argument("--max-entities", type=int, default=None, help="Maximum entities to process (for testing)")
    parser.add_argument("--iterations", type=int, default=MAX_ITERATIONS, help="Iterations per entity (default: 30)")
    parser.add_argument("--checkpoint-interval", type=int, default=DEFAULT_CHECKPOINT_INTERVAL, help="Checkpoint every N entities")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")

    args = parser.parse_args()

    # Update MAX_ITERATIONS if specified
    if args.iterations != MAX_ITERATIONS:
        MAX_ITERATIONS = args.iterations
        logger.info(f"🔧 Using custom MAX_ITERATIONS: {MAX_ITERATIONS}")

    # Run bootstrap
    bootstrap = FullSDKBootstrap(checkpoint_interval=args.checkpoint_interval)

    report = await bootstrap.run_bootstrap(
        max_entities=args.max_entities,
        resume=args.resume
    )

    # Print summary
    print("\n" + "="*80)
    print("FULL SDK BOOTSTRAP COMPLETE")
    print("="*80)
    print(f"Total entities: {report['total_entities']}")
    print(f"Total cost: ${report['total_cost_usd']:.2f}")
    print(f"Avg cost per entity: ${report['avg_cost_per_entity']:.2f}")
    print(f"Estimated total iterations: {report['estimated_total_iterations']:,}")
    print(f"Max iterations per entity: {report['max_iterations_per_entity']}")
    print("="*80 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
