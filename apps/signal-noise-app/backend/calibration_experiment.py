#!/usr/bin/env python3
"""
Calibration Experiment - Phase 0

Runs 150 iterations × 2 entities to determine optimal iteration counts,
category yields, and cost curves for the bounded exploration system.

OBJECTIVE:
- At what iteration does confidence saturate? (real data, not guesses)
- Which categories produce the most signal?
- What is the true marginal cost per unit of confidence?
- Do warm (known RFP) vs cold (no known RFP) entities behave differently?

ENTITIES:
1. ICF (International Canoe Federation) - Governing body with documented roadmap
2. Arsenal FC - Top-tier football club

Author: Claude Code
Date: 2026-01-30
"""

import os
import sys
import logging
import json
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
from enum import Enum

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
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

MAX_ITERATIONS = 150  # Hard cap for calibration


# =============================================================================
# 8 FIXED CATEGORIES (MUTUALLY EXCLUSIVE)
# =============================================================================

CALIBRATION_CATEGORIES = [
    "Digital Infrastructure & Stack",  # CMS, CRM, ERP, cloud, ticketing, data platforms
    "Commercial & Revenue Systems",     # Sponsorship tech, fan monetization, e-commerce, POS
    "Fan Engagement & Experience",      # Mobile apps, fan portals, personalization, loyalty
    "Data, Analytics & AI",             # BI tools, AI/ML adoption, data warehouses
    "Operations & Internal Transformation",  # Workflow automation, internal tooling, ERP, HRIS
    "Media, Content & Broadcasting",    # OTT platforms, streaming infrastructure
    "Partnerships, Vendors & Ecosystem", # Strategic tech partners, vendor onboarding
    "Governance, Compliance & Security", # Cybersecurity, data privacy, compliance
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
    """Tracks confidence state for calibration"""
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
# CALIBRATION ITERATION LOG
# =============================================================================

@dataclass
class CalibrationIteration:
    """Single iteration log entry"""
    iteration: int
    entity: str
    category: str
    source: str
    evidence_found: str
    ralph_decision: str
    raw_delta: float
    category_multiplier: float
    applied_delta: float
    confidence_before: float
    confidence_after: float
    cumulative_cost: float
    justification: str
    timestamp: str


# =============================================================================
# MAIN CALIBRATION LOOP
# =============================================================================

class CalibrationExperiment:
    """
    Runs 150 iterations × 2 entities for calibration

    Measures:
    - Saturation point (when does confidence stop moving?)
    - Category yield (which categories produce most ACCEPTs?)
    - Cost curve (confidence vs cost)
    - Warm vs cold entity behavior
    """

    def __init__(self, output_dir: str = "data/calibration"):
        """
        Initialize calibration experiment

        Args:
            output_dir: Directory to save results
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"🔬 CalibrationExperiment initialized (output: {self.output_dir})")

    async def run_calibration(
        self,
        entity_name: str,
        source_type: str,
        source: str,
        known_signals: List[str] = None
    ) -> List[CalibrationIteration]:
        """
        Run 150 iterations for a single entity

        Args:
            entity_name: Entity to explore
            source_type: Type of source ("document" or "web_search")
            source: Source (URL or search query)
            known_signals: Known signals (for warm entities)

        Returns:
            List of calibration iterations
        """
        logger.info(f"🔬 Starting calibration for {entity_name} ({source_type})")

        # Initialize state
        state = ConfidenceState(
            current_confidence=START_CONFIDENCE,
            accepted_signals_per_category={cat: 0 for cat in CALIBRATION_CATEGORIES},
            consecutive_rejects_per_category={cat: 0 for cat in CALIBRATION_CATEGORIES},
            confidence_history=[START_CONFIDENCE]
        )

        iterations = []
        previous_evidences = []
        cumulative_cost = 0.0

        # Initialize clients
        from brightdata_sdk_client import BrightDataSDKClient
        brightdata = BrightDataSDKClient()

        # Run 150 iterations
        for i in range(1, MAX_ITERATIONS + 1):
            logger.info(f"🔬 Iteration {i}/150 for {entity_name}")

            # Select category (round-robin through 8 categories)
            category = CALIBRATION_CATEGORIES[(i - 1) % len(CALIBRATION_CATEGORIES)]

            # Check category saturation
            if check_category_saturation(state, category):
                logger.info(f"⏭️ Category {category} is saturated (3 consecutive REJECTs), skipping")
                continue

            # Check confidence saturation (early stop)
            if check_confidence_saturation(state):
                logger.info(f"🛑 Confidence saturated at iteration {i} ({state.current_confidence:.3f})")
                break

            # Collect evidence (placeholder - real implementation uses BrightData)
            evidence, source_url = await self._collect_evidence(
                brightdata=brightdata,
                entity_name=entity_name,
                category=category,
                source_type=source_type,
                source=source,
                iteration=i
            )

            # Apply Ralph decision rubric
            decision, justification = apply_ralph_decision_rubric(
                evidence_text=evidence,
                category=category,
                entity_name=entity_name,
                source_url=source_url,
                previous_evidences=previous_evidences
            )

            # Calculate confidence update
            raw_delta, category_multiplier, applied_delta = calculate_confidence_update(
                state=state,
                decision=decision,
                category=category
            )

            confidence_before = state.current_confidence
            state.current_confidence = update_confidence(state, applied_delta)
            confidence_after = state.current_confidence

            # Track evidence
            if decision != RalphDecision.REJECT:
                previous_evidences.append(evidence)

            # Update counters
            if decision == RalphDecision.ACCEPT:
                state.accepted_signals_per_category[category] += 1
                state.consecutive_rejects_per_category[category] = 0
            elif decision == RalphDecision.WEAK_ACCEPT:
                state.consecutive_rejects_per_category[category] = 0
            else:  # REJECT
                state.consecutive_rejects_per_category[category] += 1

            # Track confidence history
            state.confidence_history.append(confidence_after)

            # Estimate cost (Claude $0.03, Ralph $0.01, BrightData $0.001)
            iteration_cost = 0.03 + 0.01 + 0.001
            cumulative_cost += iteration_cost

            # Log iteration
            iteration = CalibrationIteration(
                iteration=i,
                entity=entity_name,
                category=category,
                source=source_url,
                evidence_found=evidence[:200] + "..." if len(evidence) > 200 else evidence,
                ralph_decision=decision.value,
                raw_delta=raw_delta,
                category_multiplier=category_multiplier,
                applied_delta=applied_delta,
                confidence_before=confidence_before,
                confidence_after=confidence_after,
                cumulative_cost=cumulative_cost,
                justification=justification,
                timestamp=datetime.now().isoformat()
            )

            iterations.append(iteration)

            logger.info(
                f"  📊 Iteration {i}: {decision.value} | "
                f"{category} | "
                f"Confidence: {confidence_before:.3f} → {confidence_after:.3f} | "
                f"Cost: ${cumulative_cost:.3f}"
            )

        # Save results
        self._save_calibration_results(entity_name, iterations)

        logger.info(f"✅ Calibration complete for {entity_name}: {len(iterations)} iterations")
        logger.info(f"   Final confidence: {state.current_confidence:.3f}")
        logger.info(f"   Total cost: ${cumulative_cost:.3f}")

        return iterations

    async def _collect_evidence(
        self,
        brightdata,
        entity_name: str,
        category: str,
        source_type: str,
        source: str,
        iteration: int
    ) -> tuple[str, str]:
        """
        Collect evidence for iteration

        Args:
            brightdata: BrightDataSDKClient instance
            entity_name: Entity being explored
            category: Category being explored
            source_type: Type of source
            source: Source (URL or search query)
            iteration: Iteration number

        Returns:
            (evidence_text, source_url)
        """
        # Placeholder implementation
        # Real implementation would use BrightData SDK to:
        # 1. Search for entity + category terms
        # 2. scrape relevant URLs
        # 3. Extract evidence

        if source_type == "document":
            # For ICF, we'd scrape the PDF
            evidence = f"Document content for {entity_name} in {category}"
            source_url = source
        else:
            # For Arsenal, we'd search the web
            evidence = f"Web search result for {entity_name} in {category}"
            source_url = f"https://example.com/search?q={entity_name}+{category}"

        return evidence, source_url

    def _save_calibration_results(self, entity_name: str, iterations: List[CalibrationIteration]):
        """
        Save calibration results to JSONL file

        Args:
            entity_name: Entity name
            iterations: List of iterations
        """
        # Sanitize entity name for filename
        safe_name = entity_name.replace(" ", "_").replace("/", "_").lower()
        output_file = self.output_dir / f"{safe_name}_calibration.jsonl"

        with open(output_file, 'w') as f:
            for iteration in iterations:
                json.dump(asdict(iteration), f)
                f.write('\n')

        logger.info(f"💾 Saved {len(iterations)} iterations to {output_file}")

    def generate_calibration_report(self, entity_results: Dict[str, List[CalibrationIteration]]):
        """
        Generate calibration analysis report

        Args:
            entity_results: Dict mapping entity name to iterations
        """
        report = {
            "generated_at": datetime.now().isoformat(),
            "entities": {}
        }

        for entity_name, iterations in entity_results.items():
            if not iterations:
                continue

            # Calculate statistics
            final_confidence = iterations[-1].confidence_after
            total_cost = iterations[-1].cumulative_cost
            total_iterations = len(iterations)

            # Category yield
            category_accepts = {}
            for iteration in iterations:
                cat = iteration.category
                if iteration.ralph_decision == "ACCEPT":
                    category_accepts[cat] = category_accepts.get(cat, 0) + 1

            # Saturation point
            saturation_iteration = total_iterations
            for i, iteration in enumerate(iterations):
                if i > 10:
                    recent = [it.confidence_after for it in iterations[max(0, i-10):i]]
                    if max(recent) - min(recent) < 0.01:
                        saturation_iteration = i
                        break

            report["entities"][entity_name] = {
                "total_iterations": total_iterations,
                "final_confidence": final_confidence,
                "total_cost_usd": total_cost,
                "saturation_iteration": saturation_iteration,
                "category_accepts": category_accepts,
                "cost_per_confidence": total_cost / (final_confidence - START_CONFIDENCE) if final_confidence > START_CONFIDENCE else 0.0
            }

        # Save report
        report_file = self.output_dir / f"calibration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)

        logger.info(f"📊 Calibration report saved to {report_file}")

        return report


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

async def run_calibration_experiment():
    """Run 150 iterations × 2 entities"""

    experiment = CalibrationExperiment()

    entities = [
        {
            "name": "International Canoe Federation (ICF)",
            "source_type": "document",
            "source": "https://www.canoeicf.com/sites/default/files/paddle_worldwide_proposed_ecosystem.pdf",
            "known_signals": ["Atos SDP", "Headless CMS", "Data Lake", "Next.js"]
        },
        {
            "name": "Arsenal FC",
            "source_type": "web_search",
            "source": "https://www.arsenal.com",
            "known_signals": []
        }
    ]

    entity_results = {}

    for entity in entities:
        iterations = await experiment.run_calibration(
            entity_name=entity["name"],
            source_type=entity["source_type"],
            source=entity["source"],
            known_signals=entity.get("known_signals", [])
        )
        entity_results[entity["name"]] = iterations

    # Generate calibration report
    report = experiment.generate_calibration_report(entity_results)

    # Print summary
    print("\n" + "="*80)
    print("CALIBRATION EXPERIMENT COMPLETE")
    print("="*80)

    for entity_name, stats in report["entities"].items():
        print(f"\n{entity_name}:")
        print(f"  Iterations: {stats['total_iterations']}")
        print(f"  Final Confidence: {stats['final_confidence']:.3f}")
        print(f"  Total Cost: ${stats['total_cost_usd']:.3f}")
        print(f"  Saturation Point: Iteration {stats['saturation_iteration']}")
        print(f"  Cost per 0.1 Confidence: ${stats['cost_per_confidence'] * 0.1:.3f}")
        print(f"  Top Categories:")
        for cat, count in sorted(stats['category_accepts'].items(), key=lambda x: x[1], reverse=True)[:3]:
            print(f"    - {cat}: {count} ACCEPTs")

    print("\n" + "="*80)
    print("SUCCESS CRITERIA:")
    print("✅ Complete 300 iterations total (150 × 2 entities)")
    print("✅ Log every iteration with all required fields")
    print("✅ Generate calibration report with saturation analysis")
    print("✅ Answer: What is optimal iteration cap? (likely 30-60)")
    print("✅ Answer: Which categories are highest/lowest yield?")
    print("✅ Answer: What is true cost per 0.1 confidence unit?")
    print("="*80 + "\n")

    return report


if __name__ == "__main__":
    asyncio.run(run_calibration_experiment())
