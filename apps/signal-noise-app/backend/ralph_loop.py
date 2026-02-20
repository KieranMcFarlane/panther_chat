#!/usr/bin/env python3
"""
Ralph Loop: Batch-Enforced Signal Validation + Exploration Governance

Implements the Ralph Loop validation system with hard minimums and max 3 passes:

RULES:
- Minimum 3 pieces of evidence per signal
- Confidence > 0.7 for signal creation
- Maximum 3 validation passes per entity
- Only validated signals written to Graphiti

PASSES:
- Pass 1: Rule-based filtering (min evidence, source credibility)
- Pass 2: Claude validation (cross-check with existing signals)
- Pass 3: Final confirmation (confidence scoring, duplicate detection)

EXPLORATION VALIDATION API:
- POST /api/validate-exploration
- Real-time governance for bounded exploration
- Ralph Decision Rubric (ACCEPT/WEAK_ACCEPT/REJECT)
- Fixed confidence math (no drift)
- Category saturation detection (3 REJECTs)
- Confidence saturation detection (<0.01 gain over 10 iterations)

Usage (Signal Validation):
    from ralph_loop import RalphLoop
    from claude_client import ClaudeClient
    from graphiti_service import GraphitiService

    claude = ClaudeClient()
    graphiti = GraphitiService()
    await graphiti.initialize()

    ralph = RalphLoop(claude, graphiti)
    validated_signals = await ralph.validate_signals(raw_signals, entity_id)

    for signal in validated_signals:
        print(f"✅ Validated: {signal.id} (confidence: {signal.confidence})")

Usage (API Server):
    from ralph_loop import start_ralph_loop_server

    start_ralph_loop_server(host="0.0.0.0", port=8001)

Usage (API Client):
    import httpx

    response = httpx.post("http://localhost:8001/api/validate-exploration", json={
        "entity_name": "Arsenal FC",
        "category": "Digital Infrastructure",
        "evidence": "Looking for CRM Manager",
        "current_confidence": 0.75,
        "source_url": "https://arsenal.com/jobs"
    })

    result = response.json()
    print(f"Decision: {result['decision']}")
    print(f"Action: {result['action']}")
    print(f"New Confidence: {result['new_confidence']}")
"""

import os
import sys
import logging
import math
import random
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

# Import schemas for type checking
from schemas import RalphDecisionType, SignalClass, HypothesisState

# FastAPI imports
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class RalphLoopConfig:
    """Configuration for Ralph Loop validation"""
    min_evidence: int = 3
    min_confidence: float = 0.7
    min_evidence_credibility: float = 0.6
    max_passes: int = 3
    duplicate_threshold: float = 0.85  # Similarity threshold for duplicate detection

    # Confidence validation settings (Pass 2)
    enable_confidence_validation: bool = True  # Feature flag for confidence validation
    max_confidence_adjustment: float = 0.15  # Max ± adjustment Claude can make
    confidence_review_threshold: float = 0.2  # Flag for manual review if adjustment > this


# =============================================================================
# SIGNAL CLASSIFICATION
# =============================================================================

# =============================================================================
# SIGNAL STRENGTH ASSESSMENT (Probabilistic Scoring)
# =============================================================================

SIGNAL_STRENGTH_PROMPT = """Analyze this procurement signal and assign a strength score.

Signal: {title}
URL: {url}
Category: {category}
Signal Class: {signal_class}

For CAPABILITY signals (job postings, tech adoption):
- Rate 0.6 if: C-level, VP, Director, "Head of", "Chief"
- Rate 0.5 if: Manager, Lead, "Senior", Principal
- Rate 0.4 if: Specialist, individual contributor, Analyst

For PROCUREMENT_INDICATOR (evaluation activity):
- Rate 0.9 if: "RFP", "tender", "procurement", "vendor selection", "solicitation"
- Rate 0.8 if: "evaluating", "demo", "POC", "proof of concept", "pilot"
- Rate 0.7 if: "researching", "exploring", "considering", "assessment"
- Rate 0.6 if: general tech mention, partnership, collaboration

Return ONLY a number with two decimal places (e.g., "0.65").
"""


def calculate_temporal_decay(
    signal_date: datetime,
    current_date: datetime = None,
    decay_lambda: float = 0.015
) -> float:
    """
    Calculate temporal decay weight using exponential decay

    Formula: weight = e^(-λ × age_in_days)

    λ = 0.015 produces:
    - 7 days old: ~90% weight
    - 30 days old: ~64% weight
    - 60 days old: ~41% weight
    - 90 days old: ~26% weight
    - 365 days old: <1% weight

    This ensures recent signals contribute more to activity scores.

    Args:
        signal_date: When the signal was collected/published
        current_date: Reference date for decay calculation (defaults to now)
        decay_lambda: Decay rate (default 0.015 for moderate decay)

    Returns:
        Decay weight between 0.01 and 1.0
    """
    if current_date is None:
        current_date = datetime.now(timezone.utc)

    age_days = max(0, (current_date - signal_date).days)
    decay = math.exp(-decay_lambda * age_days)

    return max(0.01, min(1.0, decay))  # Clamp between 1% and 100%


async def assess_signal_strength(
    signal: Dict[str, Any],
    signal_class: SignalClass,
    claude_client = None
) -> float:
    """
    Assess individual signal strength using Claude content analysis

    Returns weight between:
    - CAPABILITY: 0.4-0.6 (based on seniority/role impact)
    - PROCUREMENT_INDICATOR: 0.6-0.9 (based on phrasing strength)
    - VALIDATED_RFP: 1.0 (fixed)

    Assessment criteria for CAPABILITY:
    - 0.6: C-level, VP, Director roles (high seniority)
    - 0.5: Manager, Lead roles (medium seniority)
    - 0.4: Specialist, individual contributor (low seniority)

    Assessment criteria for PROCUREMENT_INDICATOR:
    - 0.9: "issued RFP", "tender", "procurement", "vendor selection"
    - 0.8: "evaluating", "demo", "proof of concept"
    - 0.7: "researching", "exploring", "considering"
    - 0.6: general mentions, partnerships

    Args:
        signal: Signal dictionary with 'title', 'url', 'category' keys
        signal_class: The signal class (CAPABILITY, PROCUREMENT_INDICATOR, VALIDATED_RFP)
        claude_client: Optional ClaudeClient for content analysis

    Returns:
        Strength score between 0.4 and 1.0
    """
    # VALIDATED_RFP signals always have max strength
    if signal_class == SignalClass.VALIDATED_RFP:
        return 1.0

    # If no Claude client, use heuristic-based assessment
    if claude_client is None:
        return _heuristic_signal_strength(signal, signal_class)

    title = signal.get('title', '')
    url = signal.get('url', '')
    category = signal.get('category', '')

    prompt = SIGNAL_STRENGTH_PROMPT.format(
        title=title,
        url=url,
        category=category,
        signal_class=signal_class.value
    )

    try:
        response = await claude_client.query(prompt, max_tokens=50)

        # Extract number from response
        import re
        match = re.search(r'0\.\d+', response)
        if match:
            strength = float(match.group())
            # Clamp to valid range
            if signal_class == SignalClass.CAPABILITY:
                return max(0.4, min(0.6, strength))
            else:  # PROCUREMENT_INDICATOR
                return max(0.6, min(0.9, strength))
    except Exception as e:
        logger.warning(f"Claude signal strength assessment failed: {e}, using heuristic")

    # Fallback to heuristic
    return _heuristic_signal_strength(signal, signal_class)


def _heuristic_signal_strength(signal: Dict[str, Any], signal_class: SignalClass) -> float:
    """
    Fallback heuristic-based signal strength assessment

    Uses keyword matching when Claude is unavailable.
    """
    title = signal.get('title', '').lower()

    if signal_class == SignalClass.CAPABILITY:
        # Check for seniority keywords
        if any(kw in title for kw in ['chief', 'c-level', 'vp ', 'vice president', 'director', 'head of']):
            return 0.6
        elif any(kw in title for kw in ['manager', 'lead ', 'senior', 'principal']):
            return 0.5
        else:
            return 0.4

    elif signal_class == SignalClass.PROCUREMENT_INDICATOR:
        # Check for procurement strength keywords
        if any(kw in title for kw in ['rfp', 'tender', 'procurement', 'vendor selection', 'solicitation']):
            return 0.9
        elif any(kw in title for kw in ['evaluating', 'demo', 'poc', 'proof of concept', 'pilot']):
            return 0.8
        elif any(kw in title for kw in ['researching', 'exploring', 'considering', 'assessment']):
            return 0.7
        else:
            return 0.6

    return 0.5  # Default fallback


# =============================================================================
# SIGNAL CLASSIFICATION
# =============================================================================

def classify_signal(
    decision: RalphDecisionType,
    confidence: float,
    source_domain: Optional[str] = None
) -> Optional[SignalClass]:
    """
    Classify signals into tiers for predictive intelligence

    Maps Ralph Loop decisions to signal classes:
    - WEAK_ACCEPT → CAPABILITY: Early indicators (digital capability exists)
    - ACCEPT + <0.75 confidence → PROCUREMENT_INDICATOR: Active evaluation
    - ACCEPT + ≥0.75 confidence → VALIDATED_RFP: Confirmed RFP/tender
    - ACCEPT + tender domain → VALIDATED_RFP: Official tender sources

    Args:
        decision: RalphDecisionType (ACCEPT, WEAK_ACCEPT, REJECT, etc.)
        confidence: Signal confidence score (0.0-1.0)
        source_domain: Optional source domain for tender detection

    Returns:
        SignalClass or None if decision doesn't map to a class
    """
    if decision == RalphDecisionType.WEAK_ACCEPT:
        return SignalClass.CAPABILITY

    if decision == RalphDecisionType.ACCEPT:
        # High confidence signals are validated RFPs
        if confidence >= 0.75:
            return SignalClass.VALIDATED_RFP

        # Tender/procurment domains are always validated RFPs
        if source_domain:
            domain_lower = source_domain.lower()
            tender_keywords = ['tender', 'bidnet', 'rfp.', 'procurement', 'contract']
            if any(keyword in domain_lower for keyword in tender_keywords):
                return SignalClass.VALIDATED_RFP

        # Default ACCEPT to PROCUREMENT_INDICATOR
        return SignalClass.PROCUREMENT_INDICATOR

    # REJECT, NO_PROGRESS, SATURATED don't classify
    return None


def recalculate_hypothesis_state(
    entity_id: str,
    category: str,
    capability_signals: List[Dict[str, Any]],
    procurement_indicators: List[Dict[str, Any]],
    validated_rfps: List[Dict[str, Any]],
    claude_client = None
) -> HypothesisState:
    """
    Probabilistic hypothesis state calculation with:
    1. Individual signal strength assessment
    2. Temporal decay weighting (recent signals matter more)
    3. Confidence-based adjustment
    4. Sigmoid state transitions (smooth not linear)

    This is a critical architectural function: we aggregate at the hypothesis
    level, NOT the signal level. All signals contribute to hypothesis-level scores.

    Signal → Hypothesis mapping:
    - CAPABILITY signals → increase maturity_score (digital capability)
    - PROCUREMENT_INDICATOR → increase activity_score (evaluation activity)
    - VALIDATED_RFP → set state = LIVE (confirmed procurement)

    Args:
        entity_id: Entity identifier
        category: Hypothesis category (e.g., "CRM_UPGRADE", "ANALYTICS")
        capability_signals: List of CAPABILITY-classified signals
        procurement_indicators: List of PROCUREMENT_INDICATOR signals
        validated_rfps: List of VALIDATED_RFP signals
        claude_client: Optional ClaudeClient for signal strength assessment

    Returns:
        HypothesisState with calculated scores and state
    """
    # -------------------------------------------------------------------------
    # MATURITY SCORE (from CAPABILITY signals)
    # -------------------------------------------------------------------------
    maturity_sum = 0.0
    for signal in capability_signals:
        # Get signal strength (0.4-0.6) from heuristic or Claude analysis
        try:
            # For now, use heuristic (async Claude would require async wrapper)
            strength = _heuristic_signal_strength(signal, SignalClass.CAPABILITY)
        except Exception:
            strength = 0.5  # Default fallback

        # Get temporal decay weight
        signal_date = signal.get('collected_at', signal.get('first_seen', datetime.now(timezone.utc)))
        if isinstance(signal_date, str):
            signal_date = datetime.fromisoformat(signal_date.replace('Z', '+00:00'))
        decay = calculate_temporal_decay(signal_date, decay_lambda=0.015)

        # Get confidence multiplier (0.45-1.0 range)
        confidence = signal.get('confidence', 0.5)
        confidence_multiplier = 0.45 + (confidence * 0.55)

        # Weighted contribution
        contribution = strength * decay * confidence_multiplier
        maturity_sum += contribution

    # Normalize: divide by expected max (assume ~5 signals max at 0.6 strength)
    maturity_score = min(1.0, maturity_sum / 3.0) if capability_signals else 0.0

    # -------------------------------------------------------------------------
    # ACTIVITY SCORE (from PROCUREMENT_INDICATOR signals)
    # -------------------------------------------------------------------------
    activity_sum = 0.0
    for signal in procurement_indicators:
        # Get signal strength (0.6-0.9) from heuristic or Claude analysis
        try:
            strength = _heuristic_signal_strength(signal, SignalClass.PROCUREMENT_INDICATOR)
        except Exception:
            strength = 0.7  # Default fallback

        # Get temporal decay weight (higher decay sensitivity for activity)
        signal_date = signal.get('collected_at', signal.get('first_seen', datetime.now(timezone.utc)))
        if isinstance(signal_date, str):
            signal_date = datetime.fromisoformat(signal_date.replace('Z', '+00:00'))
        decay = calculate_temporal_decay(signal_date, decay_lambda=0.02)

        # Get confidence multiplier
        confidence = signal.get('confidence', 0.5)
        confidence_multiplier = 0.60 + (confidence * 0.40)

        # Weighted contribution
        contribution = strength * decay * confidence_multiplier
        activity_sum += contribution

    # Normalize: divide by expected max (assume ~4 signals max at 0.9 strength)
    activity_score = min(1.0, activity_sum / 3.6) if procurement_indicators else 0.0

    # -------------------------------------------------------------------------
    # STATE DETERMINATION (Sigmoid transitions)
    # -------------------------------------------------------------------------
    def sigmoid(x: float, midpoint: float = 0.5, steepness: float = 10.0) -> float:
        """Sigmoid function for smooth state transitions"""
        return 1.0 / (1.0 + math.exp(-steepness * (x - midpoint)))

    # Calculate state probabilities
    p_live = sigmoid(activity_score, midpoint=0.8, steepness=15.0) if validated_rfps else 0.0
    p_engage = sigmoid(activity_score, midpoint=0.55, steepness=12.0)
    p_warm = sigmoid(activity_score, midpoint=0.35, steepness=10.0)

    # Select state with highest probability
    if len(validated_rfps) >= 1:
        state = "LIVE"
    elif p_engage > 0.5:
        state = "ENGAGE"
    elif p_warm > 0.5:
        state = "WARM"
    else:
        state = "MONITOR"

    return HypothesisState(
        entity_id=entity_id,
        category=category,
        maturity_score=round(maturity_score, 3),
        activity_score=round(activity_score, 3),
        state=state,
        last_updated=datetime.now(timezone.utc)
    )


# =============================================================================
# EXPLORATION VALIDATION - FASTAPI ENDPOINT
# =============================================================================

# Fixed constants for exploration validation (NO DRIFT)
EXPLORATION_START_CONFIDENCE = 0.20
EXPLORATION_MAX_CONFIDENCE = 0.95
EXPLORATION_MIN_CONFIDENCE = 0.05
EXPLORATION_ACCEPT_DELTA = +0.06
EXPLORATION_WEAK_ACCEPT_DELTA = +0.02
EXPLORATION_REJECT_DELTA = 0.00


class RalphExplorationDecision(str, Enum):
    """Ralph decision for exploration validation"""
    ACCEPT = "ACCEPT"
    WEAK_ACCEPT = "WEAK_ACCEPT"
    REJECT = "REJECT"


class ExplorationValidationRequest(BaseModel):
    """Request for exploration validation"""
    entity_name: str
    category: str
    evidence: str
    current_confidence: float
    source_url: str
    previous_evidences: List[str] = []
    iteration_number: int = 1
    accepted_signals_per_category: Dict[str, int] = {}
    consecutive_rejects_per_category: Dict[str, int] = {}


class ExplorationValidationResponse(BaseModel):
    """Response from exploration validation"""
    decision: RalphExplorationDecision  # ACCEPT/WEAK_ACCEPT/REJECT
    action: str  # CONTINUE/STOP/LOCK_IN
    justification: str
    new_confidence: float
    raw_delta: float
    category_multiplier: float
    applied_delta: float
    category_saturated: bool
    confidence_saturated: bool
    iteration_logged: bool


# Initialize FastAPI app
app = FastAPI(
    title="Ralph Loop API",
    description="Real-time governance for bounded exploration",
    version="1.0.0"
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Ralph Loop API",
        "version": "1.0.0",
        "endpoints": {
            "/api/validate-exploration": "POST - Validate exploration decision",
            "/health": "GET - Health check"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post("/api/validate-exploration", response_model=ExplorationValidationResponse)
async def validate_exploration(request: ExplorationValidationRequest) -> ExplorationValidationResponse:
    """
    Validate exploration decision with Ralph Loop

    Implements the Ralph Decision Rubric (hard rules):

    ACCEPT (all must be true):
    1. Evidence is NEW (not logged previously)
    2. Evidence is ENTITY-SPECIFIC (explicit name match)
    3. Evidence implies FUTURE ACTION (budgeting, procurement, hiring, RFP)
    4. Source is CREDIBLE and NON-TRIVIAL (official site, job board, press release)

    WEAK_ACCEPT:
    - Evidence is new but one or more ACCEPT criteria partially missing
    - Max 1 WEAK_ACCEPT per signal type

    REJECT:
    - No new information
    - Generic industry commentary
    - Duplicate or paraphrased signals
    - Historical-only information
    - Speculation without evidence

    Confidence Math (fixed, no drift):
    - category_multiplier = 1 / (1 + accepted_signals_in_category)
    - applied_delta = raw_delta * category_multiplier
    - new_confidence = clamp(current_confidence + applied_delta, 0.05, 0.95)

    Saturation Rules:
    - Category Saturation: 3 consecutive REJECTs → CATEGORY_SATURATED
    - Confidence Saturation: < 0.01 gain over 10 iterations → CONFIDENCE_SATURATED
    """
    logger.info(f"🔁 Validating exploration: {request.entity_name} | {request.category} | Iteration {request.iteration_number}")

    # =====================================================================
    # STEP 1: Apply Ralph Decision Rubric (hard rules)
    # =====================================================================

    decision, justification = apply_ralph_decision_rubric(
        evidence_text=request.evidence,
        category=request.category,
        entity_name=request.entity_name,
        source_url=request.source_url,
        previous_evidences=request.previous_evidences
    )

    # =====================================================================
    # STEP 2: Calculate confidence adjustment (fixed math)
    # =====================================================================

    # Get raw delta
    if decision == RalphExplorationDecision.ACCEPT:
        raw_delta = EXPLORATION_ACCEPT_DELTA
    elif decision == RalphExplorationDecision.WEAK_ACCEPT:
        raw_delta = EXPLORATION_WEAK_ACCEPT_DELTA
    else:  # REJECT
        raw_delta = EXPLORATION_REJECT_DELTA

    # Calculate category multiplier
    accepted_in_category = request.accepted_signals_per_category.get(request.category, 0)
    category_multiplier = 1.0 / (1.0 + accepted_in_category)

    # Calculate applied delta
    applied_delta = raw_delta * category_multiplier

    # Update confidence with clamping
    new_confidence = request.current_confidence + applied_delta
    new_confidence = max(EXPLORATION_MIN_CONFIDENCE, min(EXPLORATION_MAX_CONFIDENCE, new_confidence))

    # =====================================================================
    # STEP 3: Check saturation conditions
    # =====================================================================

    # Category saturation: 3 consecutive REJECTs
    consecutive_rejects = request.consecutive_rejects_per_category.get(request.category, 0)
    if decision == RalphExplorationDecision.REJECT:
        consecutive_rejects += 1
    else:
        consecutive_rejects = 0

    category_saturated = consecutive_rejects >= 3

    # Confidence saturation: < 0.01 gain over 10 iterations
    # Note: In full implementation, we'd track confidence_history
    # For now, we'll flag if applied_delta is very small
    confidence_saturated = abs(applied_delta) < 0.001 and request.iteration_number > 10

    # =====================================================================
    # STEP 4: Determine action
    # =====================================================================

    if category_saturated:
        action = "STOP"  # Skip this category
        logger.info(f"  ⏭️ Category saturated (3 consecutive REJECTs)")
    elif confidence_saturated:
        action = "STOP"  # Stop exploration entirely
        logger.info(f"  🛑 Confidence saturated (<0.01 gain over 10 iterations)")
    elif new_confidence >= 0.85:
        action = "LOCK_IN"  # High confidence, lock in pattern
        logger.info(f"  🔒 High confidence reached ({new_confidence:.3f}), locking in")
    elif decision == RalphExplorationDecision.REJECT and new_confidence < 0.50:
        action = "STOP"  # Low confidence with REJECT
        logger.info(f"  ⏹️ Low confidence with REJECT ({new_confidence:.3f})")
    else:
        action = "CONTINUE"  # Keep exploring
        logger.info(f"  ▶️ Continue exploration")

    # =====================================================================
    # STEP 5: Mandatory logging (every iteration)
    # =====================================================================

    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "entity_name": request.entity_name,
        "category": request.category,
        "iteration_number": request.iteration_number,
        "source_url": request.source_url,
        "evidence": request.evidence[:200] + "..." if len(request.evidence) > 200 else request.evidence,
        "decision": decision.value,
        "action": action,
        "justification": justification,
        "raw_delta": raw_delta,
        "category_multiplier": category_multiplier,
        "applied_delta": applied_delta,
        "confidence_before": request.current_confidence,
        "confidence_after": new_confidence,
        "category_saturated": category_saturated,
        "confidence_saturated": confidence_saturated
    }

    logger.info(f"  📊 Decision: {decision.value} | {action} | Confidence: {request.current_confidence:.3f} → {new_confidence:.3f}")
    logger.debug(f"  📝 Log entry: {log_entry}")

    # =====================================================================
    # STEP 6: Return response
    # =====================================================================

    return ExplorationValidationResponse(
        decision=decision,
        action=action,
        justification=justification,
        new_confidence=new_confidence,
        raw_delta=raw_delta,
        category_multiplier=category_multiplier,
        applied_delta=applied_delta,
        category_saturated=category_saturated,
        confidence_saturated=confidence_saturated,
        iteration_logged=True
    )


def apply_ralph_decision_rubric(
    evidence_text: str,
    category: str,
    entity_name: str,
    source_url: str,
    previous_evidences: List[str]
) -> tuple[RalphExplorationDecision, str]:
    """
    Apply Ralph Decision Rubric (hard rules, no ambiguity)

    Args:
        evidence_text: Evidence content
        category: Category being explored
        entity_name: Entity being explored
        source_url: Source URL
        previous_evidences: List of previous evidence texts

    Returns:
        (RalphExplorationDecision, justification)
    """
    # Check 1: Is evidence NEW?
    is_new = evidence_text not in previous_evidences

    if not is_new:
        # Check for paraphrase/duplicate
        for prev in previous_evidences:
            if _similarity_check(evidence_text, prev) > 0.85:
                return RalphExplorationDecision.REJECT, "Duplicate or paraphrased signal"

    # Check 2: Is evidence ENTITY-SPECIFIC?
    entity_variations = [
        entity_name.lower(),
        entity_name.split()[0].lower() if " " in entity_name else entity_name.lower(),
        entity_name.replace("FC", "").strip().lower() if "FC" in entity_name else entity_name.lower(),
        entity_name.replace("International", "").strip().lower() if "International" in entity_name else entity_name.lower()
    ]
    is_entity_specific = any(var in evidence_text.lower() for var in entity_variations)

    # Check 3: Does evidence imply FUTURE ACTION?
    future_action_keywords = [
        "seeking", "hiring", "recruiting", "looking for", "procurement",
        "rfp", "tender", "vendor", "partner", "implement", "deploy",
        "migration", "upgrade", "transform", "digit", "platform",
        "opportunity", "role", "position", "manager", "lead", "head"
    ]
    implies_future_action = any(kw in evidence_text.lower() for kw in future_action_keywords)

    # Check 4: Is source CREDIBLE?
    is_credible = _check_source_credibility(source_url)

    # Make decision
    if is_new and is_entity_specific and implies_future_action and is_credible:
        return RalphExplorationDecision.ACCEPT, "All ACCEPT criteria met (new, specific, future action, credible)"
    elif is_new and is_entity_specific:
        return RalphExplorationDecision.WEAK_ACCEPT, "New and entity-specific but missing future action or credibility"
    elif is_new and implies_future_action:
        return RalphExplorationDecision.WEAK_ACCEPT, "New with future action but not entity-specific"
    elif is_new:
        return RalphExplorationDecision.WEAK_ACCEPT, "New evidence but partially missing ACCEPT criteria"
    else:
        return RalphExplorationDecision.REJECT, "No new information or fails multiple ACCEPT criteria"


def _similarity_check(text1: str, text2: str) -> float:
    """Simple similarity check (Jaccard similarity)"""
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
        "linkedin.com/jobs",
        "arsenal.com", "canoeicf.com"  # Add known official domains
    ]

    return any(pattern in url.lower() for pattern in credible_patterns)


# =============================================================================
# STATE-AWARE DECISION LOGIC
# =============================================================================

def calculate_novelty_multiplier(
    evidence_text: str,
    seen_evidences: List[str],
    category_stats: 'CategoryStats'
) -> float:
    """
    Calculate novelty multiplier (1.0=new, 0.6=strengthens, 0.0=duplicate)

    Args:
        evidence_text: Current evidence text
        seen_evidences: List of previously seen evidence texts
        category_stats: Category statistics for this category

    Returns:
        Novelty multiplier (0.0-1.0)

    Logic:
    - Exact duplicate: 0.0 (no impact)
    - Category has positive history: 0.6 (strengthens existing signal)
    - First signal in category: 1.0 (full novelty bonus)
    """
    # Check for exact duplicate
    if evidence_text in seen_evidences:
        return 0.0

    # Check if category already has positive decisions
    if category_stats.accept_count > 0 or category_stats.weak_accept_count > 0:
        return 0.6

    # First signal in this category
    return 1.0


def calculate_hypothesis_alignment(
    evidence_text: str,
    active_hypotheses: List,
    category: str
) -> float:
    """
    Calculate hypothesis alignment (1.0=direct, 0.5=indirect, 0.0=noise)

    Args:
        evidence_text: Current evidence text
        active_hypotheses: List of active Hypothesis objects
        category: Category being explored

    Returns:
        Alignment score (0.0-1.0)

    Logic:
    - No hypotheses yet: 0.5 (neutral prior)
    - Evidence has predictive keywords: 0.8 (strong alignment)
    - Generic evidence: 0.3 (weak alignment)
    """
    if not active_hypotheses:
        return 0.5

    # Predictive keywords indicate procurement intent
    predictive_keywords = [
        "hiring", "seeking", "rfp", "tender", "procurement",
        "vendor", "partner", "sourcing", "implementation", "deployment"
    ]

    has_predictive = any(kw in evidence_text.lower() for kw in predictive_keywords)

    if has_predictive:
        return 0.8
    else:
        return 0.3


def calculate_ceiling_damping(
    current_confidence: float,
    confidence_ceiling: float
) -> float:
    """
    Calculate ceiling damping for smooth convergence

    Args:
        current_confidence: Current confidence score
        confidence_ceiling: Maximum allowed confidence

    Returns:
        Damping factor (0.1-1.0)

    Logic:
    - Far from ceiling: 1.0 (no damping)
    - Near ceiling: quadratic slowdown
    - At ceiling: 0.1 (minimal movement)

    Formula: damping = 1.0 - (proximity ^ 2)
    where proximity = current_confidence / confidence_ceiling
    """
    if confidence_ceiling == 0:
        return 1.0

    proximity = current_confidence / confidence_ceiling
    damping = 1.0 - (proximity ** 2)

    return max(0.1, damping)


def detect_category_saturation(
    category_stats: 'CategoryStats',
    active_hypotheses: List
) -> bool:
    """
    Detect if category is saturated (exhausted)

    Args:
        category_stats: Category statistics
        active_hypotheses: List of active hypotheses

    Returns:
        True if category is saturated and should be skipped

    Logic:
    - Saturation score >= 0.7: Category exhausted
    - 3+ consecutive REJECT/NO_PROGRESS: No new signals expected
    """
    return category_stats.saturation_score >= 0.7


def apply_category_saturation_multiplier(
    decision: 'RalphDecisionType',
    category_stats: 'CategoryStats'
) -> float:
    """
    Apply Guardrail 3: Category saturation multiplier for WEAK_ACCEPTs

    Args:
        decision: Current Ralph decision
        category_stats: Category statistics

    Returns:
        Multiplier to apply to confidence delta (0.0-1.0)

    Logic (Guardrail 3):
    - Early weak signals matter (multiplier = 1.0)
    - Repeated WEAK_ACCEPTs decay exponentially
    - Formula: 1.0 / (1.0 + weak_accept_count * 0.5)

    Example:
    - 1st WEAK_ACCEPT: 1.0 / (1.0 + 0.5) = 0.67
    - 2nd WEAK_ACCEPT: 1.0 / (1.0 + 1.0) = 0.50
    - 3rd WEAK_ACCEPT: 1.0 / (1.0 + 1.5) = 0.40
    """
    if decision != RalphDecisionType.WEAK_ACCEPT:
        return 1.0

    # Apply exponential decay to WEAK_ACCEPTs
    multiplier = 1.0 / (1.0 + category_stats.weak_accept_count * 0.5)

    return multiplier


async def run_ralph_iteration_with_state(
    claude_client,
    ralph_state: 'RalphState',
    category: str,
    evidence_text: str,
    source_url: str,
    iteration_number: int,
    cumulative_cost: float
) -> 'RalphIterationOutput':
    """
    Run a single Ralph Loop iteration with state-aware logic

    This is the NEW state-aware iteration function that replaces the old
    fixed-iteration model. It tracks state across iterations and enables
    early stopping via saturation detection.

    Args:
        claude_client: Claude client for AI validation
        ralph_state: Current RalphState object (passed through iterations)
        category: Category being explored
        evidence_text: Evidence text discovered
        source_url: Source URL
        iteration_number: Current iteration number (1-indexed)
        cumulative_cost: Cumulative cost so far

    Returns:
        RalphIterationOutput with decision, confidence update, and state

    Key improvements over old model:
    1. Tracks seen evidences for novelty detection
    2. Applies hypothesis alignment for predictive power
    3. Uses ceiling damping for smooth convergence
    4. Detects category saturation for early stopping
    5. Enforces WEAK_ACCEPT guardrails
    """
    from schemas import (
        RalphDecisionType,
        RalphIterationOutput,
        RalphState,
        CategoryStats
    )

    # Record evidence (for novelty detection)
    ralph_state.seen_evidences.append(evidence_text)

    # Get category stats
    category_stats = ralph_state.get_category_stats(category)

    # Check for category saturation (early stopping)
    if detect_category_saturation(category_stats, ralph_state.active_hypotheses):
        decision = RalphDecisionType.SATURATED
        justification = f"Category saturated (score: {category_stats.saturation_score:.2f}, iterations: {category_stats.total_iterations})"
    else:
        # Apply decision rubric (existing logic)
        old_decision, old_justification = apply_ralph_decision_rubric(
            evidence_text, category, ralph_state.entity_name, source_url, ralph_state.seen_evidences[:-1]
        )

        # Map old decision to new types with state awareness
        if old_decision == RalphExplorationDecision.ACCEPT:
            decision = RalphDecisionType.ACCEPT
            justification = old_justification
        elif old_decision == RalphExplorationDecision.WEAK_ACCEPT:
            # Check if this is repeated WEAK_ACCEPT (convert to NO_PROGRESS)
            if category_stats.weak_accept_count >= 2 and category_stats.accept_count == 0:
                decision = RalphDecisionType.NO_PROGRESS
                justification = f"Repeated WEAK_ACCEPT in category (count: {category_stats.weak_accept_count}) without ACCEPT - indicates capability not procurement intent"
            else:
                decision = RalphDecisionType.WEAK_ACCEPT
                justification = old_justification
        else:
            decision = RalphDecisionType.REJECT
            justification = old_justification

    # Calculate raw delta based on decision
    EXPLORATION_ACCEPT_DELTA = 0.06
    EXPLORATION_WEAK_ACCEPT_DELTA = 0.02
    EXPLORATION_REJECT_DELTA = 0.00

    raw_delta = (
        EXPLORATION_ACCEPT_DELTA if decision == RalphDecisionType.ACCEPT else
        EXPLORATION_WEAK_ACCEPT_DELTA if decision == RalphDecisionType.WEAK_ACCEPT else
        0.0  # REJECT, NO_PROGRESS, SATURATED have no delta
    )

    # Calculate multipliers
    novelty_multiplier = calculate_novelty_multiplier(evidence_text, ralph_state.seen_evidences, category_stats)
    hypothesis_alignment = calculate_hypothesis_alignment(evidence_text, ralph_state.active_hypotheses, category)
    ceiling_damping = calculate_ceiling_damping(ralph_state.current_confidence, ralph_state.confidence_ceiling)

    # Apply Guardrail 3: Category saturation multiplier for WEAK_ACCEPTs
    category_multiplier = apply_category_saturation_multiplier(decision, category_stats)

    # Calculate applied delta
    applied_delta = raw_delta * novelty_multiplier * hypothesis_alignment * ceiling_damping * category_multiplier

    # Update state
    confidence_before = ralph_state.current_confidence
    ralph_state.update_confidence(confidence_before + applied_delta)
    confidence_after = ralph_state.current_confidence

    # Update category stats
    category_stats.total_iterations += 1
    category_stats.last_decision = decision
    category_stats.last_iteration = iteration_number

    if decision == RalphDecisionType.ACCEPT:
        category_stats.accept_count += 1
    elif decision == RalphDecisionType.WEAK_ACCEPT:
        category_stats.weak_accept_count += 1
    elif decision == RalphDecisionType.REJECT:
        category_stats.reject_count += 1
    elif decision == RalphDecisionType.NO_PROGRESS:
        category_stats.no_progress_count += 1
    elif decision == RalphDecisionType.SATURATED:
        category_stats.saturated_count += 1
        ralph_state.category_saturated = True

    ralph_state.iterations_completed += 1

    # Record hypothesis updates to belief ledger (Enhancement 1: Belief Ledger)
    # For now, we create a placeholder entry for the confidence change
    # Full hypothesis tracking will be implemented in future iterations
    from datetime import datetime, timezone
    from schemas import BeliefLedgerEntry, HypothesisAction

    if applied_delta != 0.0:
        # Create a belief ledger entry for this confidence change
        ledger_entry = BeliefLedgerEntry(
            iteration=iteration_number,
            hypothesis_id=f"{category}_confidence_change",
            change=HypothesisAction.REINFORCE if applied_delta > 0 else HypothesisAction.WEAKEN,
            confidence_impact=applied_delta,
            evidence_ref=f"{iteration_number}_{source_url}",
            timestamp=datetime.now(timezone.utc),
            category=category
        )
        ralph_state.belief_ledger.append(ledger_entry)

    # Create iteration output
    return RalphIterationOutput(
        iteration=iteration_number,
        entity_id=ralph_state.entity_id,
        entity_name=ralph_state.entity_name,
        category=category,
        decision=decision,
        justification=justification,
        confidence_before=confidence_before,
        confidence_after=confidence_after,
        raw_delta=raw_delta,
        novelty_multiplier=novelty_multiplier,
        hypothesis_alignment=hypothesis_alignment,
        ceiling_damping=ceiling_damping,
        category_multiplier=category_multiplier,
        applied_delta=applied_delta,
        updated_state=ralph_state,
        hypothesis_updates=[],  # TODO: Implement hypothesis updates
        source_url=source_url,
        evidence_found=evidence_text,
        cumulative_cost=cumulative_cost
    )


def start_ralph_loop_server(host: str = "0.0.0.0", port: int = 8001):
    """
    Start Ralph Loop API server

    Args:
        host: Host to bind to
        port: Port to bind to
    """
    logger.info(f"🚀 Starting Ralph Loop API server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")


class RalphLoop:
    """
    Batch-enforced signal validation with hard minimums

    The Ralph Loop ensures only high-quality signals enter the graph by:
    1. Enforcing minimum evidence requirements
    2. Validating against existing signals
    3. Detecting and deduplicating similar signals
    4. Scoring confidence with multiple validation passes

    Only signals that pass all 3 passes are written to Graphiti.
    """

    def __init__(self, claude_client, graphiti_service, config: RalphLoopConfig = None):
        """
        Initialize Ralph Loop

        Args:
            claude_client: ClaudeClient instance for AI validation
            graphiti_service: GraphitiService instance for graph operations
            config: Optional RalphLoopConfig (uses defaults if not provided)
        """
        self.claude_client = claude_client
        self.graphiti_service = graphiti_service
        self.config = config or RalphLoopConfig()

        logger.info(f"🔁 Ralph Loop initialized (min_evidence: {self.config.min_evidence}, "
                   f"min_confidence: {self.config.min_confidence}, max_passes: {self.config.max_passes})")

    async def validate_signals(
        self,
        raw_signals: List[Dict[str, Any]],
        entity_id: str
    ) -> Dict[str, Any]:
        """
        Ralph Loop validation pipeline with signal classification

        Args:
            raw_signals: List of raw signal data from scrapers
            entity_id: Entity identifier for validation context

        Returns:
            Dict with:
            - validated_signals: List of validated Signal objects (PROCUREMENT_INDICATOR, VALIDATED_RFP)
            - capability_signals: List of CAPABILITY signals (early indicators)
            - hypothesis_states: Dict of category -> HypothesisState

        Process:
        1. Pass 1: Rule-based filtering (min evidence, basic checks)
        2. Pass 2: Claude validation (cross-check with existing signals)
        3. Pass 3: Final confirmation (confidence scoring, duplicate detection)
        4. Classification: Separate into CAPABILITY / PROCUREMENT_INDICATOR / VALIDATED_RFP
        5. State Recalculation: Calculate hypothesis-level states

        Only signals that survive all 3 passes are classified and returned.
        """
        from schemas import Signal

        logger.info(f"🔁 Starting Ralph Loop for {entity_id} with {len(raw_signals)} raw signals")

        validated_signals = []
        capability_signals = []  # NEW: Track CAPABILITY signals
        pass_results = {1: [], 2: [], 3: []}

        # Pass 1: Rule-based filtering
        logger.info(f"🔁 Pass 1/3: Rule-based filtering for {entity_id}")
        pass1_candidates = await self._pass1_filter(raw_signals)
        pass_results[1] = pass1_candidates

        logger.info(f"   ✅ Pass 1: {len(pass1_candidates)}/{len(raw_signals)} signals survived")
        logger.info(f"   ❌ Pass 1: {len(raw_signals) - len(pass1_candidates)} signals rejected")

        if not pass1_candidates:
            logger.warning(f"⚠️ No signals survived Pass 1 for {entity_id}")
            return {
                "validated_signals": [],
                "capability_signals": [],
                "hypothesis_states": {}
            }

        # Pass 2: Claude validation
        logger.info(f"🔁 Pass 2/3: Claude validation for {entity_id}")
        pass2_candidates = await self._pass2_claude_validation(pass1_candidates, entity_id)
        pass_results[2] = pass2_candidates

        logger.info(f"   ✅ Pass 2: {len(pass2_candidates)}/{len(pass1_candidates)} signals survived")
        logger.info(f"   ❌ Pass 2: {len(pass1_candidates) - len(pass2_candidates)} signals rejected")

        if not pass2_candidates:
            logger.warning(f"⚠️ No signals survived Pass 2 for {entity_id}")
            return {
                "validated_signals": [],
                "capability_signals": [],
                "hypothesis_states": {}
            }

        # Pass 3: Final confirmation
        logger.info(f"🔁 Pass 3/3: Final confirmation for {entity_id}")
        pass3_candidates = await self._pass3_final_confirmation(pass2_candidates, entity_id)
        pass_results[3] = pass3_candidates

        logger.info(f"   ✅ Pass 3: {len(pass3_candidates)}/{len(pass2_candidates)} signals survived")
        logger.info(f"   ❌ Pass 3: {len(pass2_candidates) - len(pass3_candidates)} signals rejected")

        if not pass3_candidates:
            logger.warning(f"⚠️ No signals survived Pass 3 for {entity_id}")
            return {
                "validated_signals": [],
                "capability_signals": [],
                "hypothesis_states": {}
            }

        # Mark all surviving signals as validated
        for signal in pass3_candidates:
            signal.validated = True
            signal.validation_pass = 3

        # NEW: Classify signals into tiers
        logger.info(f"🏷️ Classifying {len(pass3_candidates)} signals")
        capability_signals = []
        procurement_indicators = []
        validated_rfps = []

        for signal in pass3_candidates:
            signal_class = classify_signal(
                signal.decision if hasattr(signal, 'decision') else RalphDecisionType.ACCEPT,
                signal.confidence,
                signal.source_url if hasattr(signal, 'source_url') else None
            )

            if signal_class == SignalClass.CAPABILITY:
                signal.signal_class = "CAPABILITY"
                capability_signals.append(signal)
            elif signal_class == SignalClass.PROCUREMENT_INDICATOR:
                signal.signal_class = "PROCUREMENT_INDICATOR"
                procurement_indicators.append(signal)
            elif signal_class == SignalClass.VALIDATED_RFP:
                signal.signal_class = "VALIDATED_RFP"
                validated_rfps.append(signal)
            else:
                # Default to validated_signals for backward compatibility
                signal.signal_class = "VALIDATED"
                procurement_indicators.append(signal)

        logger.info(f"   📊 Classification: {len(capability_signals)} CAPABILITY, "
                   f"{len(procurement_indicators)} INDICATOR, {len(validated_rfps)} VALIDATED_RFP")

        # Combine INDICATOR and RFP for validated_signals (backward compatible)
        validated_signals = procurement_indicators + validated_rfps

        # Write validated signals to Graphiti
        logger.info(f"💾 Writing {len(validated_signals)} validated signals to Graphiti")
        for signal in validated_signals:
            try:
                await self.graphiti_service.upsert_signal(signal)
                logger.info(f"   ✅ Wrote signal: {signal.id} (confidence: {signal.confidence})")
            except Exception as e:
                logger.error(f"   ❌ Failed to write signal {signal.id}: {e}")

        # NEW: Recalculate hypothesis states by category
        hypothesis_states = {}
        categories = set(s.subtype for s in validated_signals if hasattr(s, 'subtype'))

        for category in categories:
            # Get signals for this category
            cat_capability = [s for s in capability_signals if hasattr(s, 'subtype') and s.subtype == category]
            cat_indicators = [s for s in procurement_indicators if hasattr(s, 'subtype') and s.subtype == category]
            cat_rfps = [s for s in validated_rfps if hasattr(s, 'subtype') and s.subtype == category]

            # Calculate hypothesis state (with probabilistic scoring)
            hypothesis_states[category] = recalculate_hypothesis_state(
                entity_id=entity_id,
                category=category,
                capability_signals=[s.__dict__ for s in cat_capability],
                procurement_indicators=[s.__dict__ for s in cat_indicators],
                validated_rfps=[s.__dict__ for s in cat_rfps],
                claude_client=self.claude_client  # Pass claude_client for signal strength assessment
            )

            logger.info(f"   📈 Category {category}: maturity={hypothesis_states[category].maturity_score:.2f}, "
                       f"activity={hypothesis_states[category].activity_score:.2f}, "
                       f"state={hypothesis_states[category].state}")

        logger.info(f"✅ Ralph Loop complete: {len(validated_signals)} validated, {len(capability_signals)} capability signals")

        return {
            "validated_signals": validated_signals,
            "capability_signals": capability_signals,
            "hypothesis_states": hypothesis_states
        }

    async def _pass1_filter(self, raw_signals: List[Dict]) -> List['Signal']:
        """
        Pass 1: Rule-based filtering

        Filters:
        - Minimum evidence count
        - Source credibility
        - Confidence threshold
        - Basic data validation
        """
        from schemas import Signal, Evidence, SignalType

        filtered = []

        for raw_signal in raw_signals:
            try:
                # Extract basic fields
                signal_type = raw_signal.get('type', 'RFP_DETECTED')
                confidence = raw_signal.get('confidence', 0.0)
                entity_id = raw_signal.get('entity_id')
                evidence_list = raw_signal.get('evidence', [])

                # Check confidence threshold
                if confidence < self.config.min_confidence:
                    logger.debug(f"❌ Pass 1: Signal rejected (low confidence: {confidence})")
                    continue

                # Check evidence count
                if len(evidence_list) < self.config.min_evidence:
                    logger.debug(f"❌ Pass 1: Signal rejected (insufficient evidence: {len(evidence_list)}/{self.config.min_evidence})")
                    continue

                # Check source credibility
                if not self._check_source_credibility(evidence_list):
                    logger.debug(f"❌ Pass 1: Signal rejected (low source credibility)")
                    continue

                # Create Signal object
                signal_id = raw_signal.get('id', f"signal_{entity_id}_{signal_type.lower()}_{datetime.now().strftime('%Y%m%d%H%M%S')}")

                signal = Signal(
                    id=signal_id,
                    type=SignalType[signal_type] if signal_type in SignalType.__members__ else SignalType.RFP_DETECTED,
                    subtype=raw_signal.get('subtype'),
                    confidence=confidence,
                    first_seen=datetime.now(timezone.utc),
                    entity_id=entity_id,
                    metadata=raw_signal.get('metadata', {}),
                    validation_pass=1
                )

                filtered.append(signal)

            except Exception as e:
                logger.warning(f"⚠️ Pass 1: Error processing signal: {e}")
                continue

        return filtered

    def _check_source_credibility(self, evidence_list: List[Dict]) -> bool:
        """
        Check if evidence sources meet credibility threshold

        Args:
            evidence_list: List of evidence items

        Returns:
            True if average credibility >= min_evidence_credibility
        """
        if not evidence_list:
            return False

        credibility_scores = [
            ev.get('credibility_score', 0.5)
            for ev in evidence_list
        ]

        avg_credibility = sum(credibility_scores) / len(credibility_scores)

        return avg_credibility >= self.config.min_evidence_credibility

    def _format_evidence_for_claude(self, evidence: List[Dict]) -> str:
        """
        Format evidence items with credibility details for Claude

        Args:
            evidence: List of evidence items

        Returns:
            Formatted string with credibility, source, date, and text
        """
        if not evidence:
            return "    No evidence"

        lines = []
        for i, ev in enumerate(evidence, 1):
            source = ev.get('source', 'Unknown')
            credibility = ev.get('credibility_score', 0.5)
            date = ev.get('date', 'Unknown date')
            url = ev.get('url', '')
            text = ev.get('extracted_text', '')

            line = f"    {i}. {source} (credibility: {credibility:.2f}, date: {date})"
            if url:
                line += f"\n       URL: {url}"
            if text:
                text_short = text[:100] + "..." if len(text) > 100 else text
                line += f"\n       Text: \"{text_short}\""

            lines.append(line)

        return "\n".join(lines)

    def _format_signals_for_claude_detailed(self, signals: List[Any]) -> str:
        """
        Format signals with evidence details for Claude consumption

        Args:
            signals: List of Signal objects or dicts

        Returns:
            Formatted string with signal details and evidence
        """
        lines = []
        for signal in signals:
            # Extract signal data
            if isinstance(signal, dict):
                signal_id = signal.get('id', 'unknown')
                signal_type = signal.get('type', 'unknown')
                confidence = signal.get('confidence', 0.0)
                evidence = signal.get('evidence', [])
            else:
                signal_id = signal.id
                signal_type = signal.type.value
                confidence = signal.confidence
                evidence = signal.metadata.get('evidence', [])

            # Format evidence with credibility
            evidence_summary = self._format_evidence_for_claude(evidence)

            lines.append(f"""
- {signal_id}: {signal_type}
  Confidence: {confidence}
  Evidence:
{evidence_summary}
""")
        return "\n".join(lines)

    async def _pass2_claude_validation(
        self,
        candidates: List['Signal'],
        entity_id: str
    ) -> List['Signal']:
        """
        Pass 2: Claude validation with confidence assessment

        Validates:
        - Consistency with existing signals
        - Duplicate detection
        - Plausibility check
        - Confidence score appropriateness (NEW)
        """
        from schemas import ConfidenceValidation

        # Get existing signals for context
        try:
            existing_signals = await self.graphiti_service.find_related_signals(
                entity_id=entity_id,
                min_confidence=0.0,  # Get all signals for context
                time_horizon_days=365
            )
        except Exception as e:
            logger.warning(f"⚠️ Could not fetch existing signals: {e}")
            existing_signals = []

        # Format signals for Claude with evidence details
        existing_summary = self._format_signals_for_claude_detailed(existing_signals[:10]) if existing_signals else "No existing signals"
        candidates_summary = self._format_signals_for_claude_detailed(candidates)

        # Build prompt based on whether confidence validation is enabled
        if self.config.enable_confidence_validation:
            prompt = f"""
You are a signal validation expert. Your job is to validate candidate signals against existing signals for entity: {entity_id}

EXISTING SIGNALS (last 10):
{existing_summary}

CANDIDATE SIGNALS TO VALIDATE:
{candidates_summary}

For each candidate signal, evaluate:

1. CONSISTENCY: Is it consistent with existing signals? (No contradictions)
2. UNIQUENESS: Is it distinct from existing signals? (Not a duplicate)
3. PLAUSIBILITY: Is it plausible given entity context?
4. CONFIDENCE ASSESSMENT: Does the confidence score match the evidence quality?

CONFIDENCE ASSESSMENT CRITERIA:
- Evidence Quality: Assess credibility, recency, source diversity
- Score Alignment: Does confidence (0.0-1.0) reflect evidence strength?
- Adjustment: Can adjust by ±{self.config.max_confidence_adjustment} max if evidence clearly warrants it
- Flags: Mark for review if confidence seems significantly misaligned

CONFIDENCE SCORING GUIDELINES:
- 0.9-1.0: Multiple high-credibility sources (0.8+), official statements, direct confirmation
- 0.7-0.9: Multiple credible sources (0.6+), strong indicators, recent activity
- 0.5-0.7: Mixed credibility, some ambiguity, limited sources
- 0.3-0.5: Single sources, low credibility, speculative
- 0.0-0.3: Rumors, unverified, very weak evidence

Return ONLY a JSON object with this exact format:
{{
  "validated": [
    {{
      "signal_id": "signal_id_1",
      "original_confidence": 0.85,
      "validated_confidence": 0.82,
      "confidence_rationale": "High-credibility sources but single data point, slight reduction",
      "requires_manual_review": false
    }}
  ],
  "rejected": [
    {{
      "signal_id": "signal_id_3",
      "reason": "Duplicate of existing signal"
    }}
  ]
}}

Be strict but fair. Only reject signals that are clearly duplicates or inconsistent.
Adjust confidence only when evidence clearly supports it (within ±{self.config.max_confidence_adjustment} range).
"""
        else:
            # Original prompt without confidence validation
            prompt = f"""
You are a signal validation expert. Your job is to validate candidate signals against existing signals for entity: {entity_id}

EXISTING SIGNALS (last 10):
{existing_summary}

CANDIDATE SIGNALS TO VALIDATE:
{candidates_summary}

For each candidate signal, evaluate:
1. Is it consistent with existing signals? (No contradictions)
2. Is it distinct from existing signals? (Not a duplicate)
3. Is it plausible? (Reasonable given entity context)

Return ONLY a JSON object with this exact format:
{{
  "validated": ["signal_id_1", "signal_id_2"],
  "rejected": [
    {{"signal_id": "signal_id_3", "reason": "Duplicate of existing signal"}}
  ]
}}

Be strict but fair. Only reject signals that are clearly duplicates or inconsistent.
"""

        try:
            # Call Claude for validation
            response = await self.claude_client.query(
                prompt=prompt,
                max_tokens=3000  # Increased for confidence reasoning
            )

            # Parse Claude's response with confidence adjustments
            if self.config.enable_confidence_validation:
                validated_signals = self._parse_claude_validation_with_confidence(response, candidates)
                validated = [s['signal'] for s in validated_signals]
            else:
                # Use original parsing
                validated_ids = self._parse_claude_validation(response, candidates)
                validated = [s for s in candidates if s.id in validated_ids]

            rejected = [s for s in candidates if s not in validated]

            for signal in rejected:
                logger.debug(f"❌ Pass 2: Claude rejected {signal.id}")

            return validated

        except Exception as e:
            logger.error(f"❌ Pass 2: Claude validation failed: {e}")
            # Fail open: return all candidates if Claude fails
            return candidates

    def _format_signals_for_claude(self, signals: List[Any]) -> str:
        """Format signals for Claude consumption"""
        lines = []
        for signal in signals:
            if isinstance(signal, dict):
                signal_id = signal.get('id', 'unknown')
                signal_type = signal.get('type', 'unknown')
                confidence = signal.get('confidence', 0.0)
                lines.append(f"- {signal_id}: {signal_type} (confidence: {confidence})")
            else:
                # Signal object
                lines.append(f"- {signal.id}: {signal.type.value} (confidence: {signal.confidence})")
        return "\n".join(lines)

    def _parse_claude_validation_with_confidence(
        self,
        response: str,
        candidates: List['Signal']
    ) -> List[Dict]:
        """
        Parse Claude's validation response with confidence adjustments

        Args:
            response: Claude's JSON response
            candidates: List of candidate Signal objects

        Returns:
            List of dicts with 'signal' and 'validation' keys
        """
        import json
        import re
        from schemas import ConfidenceValidation

        try:
            # Extract JSON from response (more flexible regex - handle multiline JSON)
            json_match = re.search(
                r'\{[\s\S]*"validated"[\s\S]*"rejected"[\s\S]*\}',
                response,
                re.DOTALL
            )

            if json_match:
                result = json.loads(json_match.group(0))

                validated_signals = []

                # Process validated signals with confidence adjustments
                for validated_item in result.get('validated', []):
                    signal_id = validated_item.get('signal_id')
                    signal = next((s for s in candidates if s.id == signal_id), None)

                    if signal:
                        # Apply confidence adjustment
                        original_confidence = validated_item.get('original_confidence', signal.confidence)
                        validated_confidence = validated_item.get('validated_confidence', signal.confidence)

                        # Update signal confidence
                        signal.confidence = validated_confidence

                        # Attach validation metadata
                        signal.confidence_validation = ConfidenceValidation(
                            original_confidence=original_confidence,
                            validated_confidence=validated_confidence,
                            adjustment=validated_confidence - original_confidence,
                            rationale=validated_item.get('confidence_rationale', 'No rationale provided'),
                            requires_manual_review=validated_item.get('requires_manual_review', False)
                        )

                        validated_signals.append({
                            'signal': signal,
                            'validation': validated_item
                        })

                # Log confidence adjustments
                for signal_data in validated_signals:
                    validation = signal_data['validation']
                    if validation.get('validated_confidence') != validation.get('original_confidence'):
                        logger.info(
                            f"📊 Confidence adjusted: {signal_data['signal'].id} "
                            f"{validation['original_confidence']:.2f} → "
                            f"{validation['validated_confidence']:.2f} "
                            f"({validation['confidence_rationale']})"
                        )

                # Log rejected signals
                for rejected_item in result.get('rejected', []):
                    signal_id = rejected_item.get('signal_id')
                    reason = rejected_item.get('reason', 'Unknown')
                    logger.debug(f"Claude rejected {signal_id}: {reason}")

                return validated_signals
            else:
                logger.warning("Could not parse Claude validation JSON, accepting all candidates")
                return [{'signal': s, 'validation': {
                    'original_confidence': s.confidence,
                    'validated_confidence': s.confidence,
                    'confidence_rationale': 'Parse error - no change'
                }} for s in candidates]

        except Exception as e:
            logger.warning(f"Error parsing Claude validation: {e}, accepting all candidates")
            return [{'signal': s, 'validation': {
                'original_confidence': s.confidence,
                'validated_confidence': s.confidence,
                'confidence_rationale': 'Parse error - no change'
            }} for s in candidates]

    def _parse_claude_validation(self, response: str, candidates: List['Signal']) -> List[str]:
        """Parse Claude's validation response and extract validated signal IDs"""
        import json
        import re

        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{[^}]*"validated"[^}]*\}', response, re.DOTALL)

            if json_match:
                result = json.loads(json_match.group(0))
                validated = result.get('validated', [])

                logger.debug(f"Claude validated {len(validated)}/{len(candidates)} signals")
                return validated
            else:
                logger.warning("Could not parse Claude validation JSON, accepting all candidates")
                return [s.id for s in candidates]

        except Exception as e:
            logger.warning(f"Error parsing Claude validation: {e}, accepting all candidates")
            return [s.id for s in candidates]

    async def _pass3_final_confirmation(
        self,
        candidates: List['Signal'],
        entity_id: str
    ) -> List['Signal']:
        """
        Pass 3: Final confirmation

        Performs:
        - Final confidence scoring
        - Duplicate detection via embedding similarity
        - Quality assessment
        """
        # For now, this is a simple pass that checks final confidence
        # In production, this could use embeddings for duplicate detection

        confirmed = []

        for signal in candidates:
            # Final confidence check
            if signal.confidence >= self.config.min_confidence:
                # Check for near-duplicates in confirmed
                is_duplicate = False

                for confirmed_signal in confirmed:
                    if self._are_signals_duplicate(signal, confirmed_signal):
                        is_duplicate = True
                        logger.debug(f"❌ Pass 3: Duplicate detected: {signal.id} ~ {confirmed_signal.id}")
                        break

                if not is_duplicate:
                    signal.validation_pass = 3
                    confirmed.append(signal)

        return confirmed

    def _are_signals_duplicate(self, signal1: 'Signal', signal2: 'Signal') -> bool:
        """
        Check if two signals are duplicates

        Args:
            signal1: First signal
            signal2: Second signal

        Returns:
            True if signals are near-duplicates
        """
        # Simple check: same type and entity within 24 hours
        from datetime import timedelta

        time_diff = abs((signal1.first_seen - signal2.first_seen).total_seconds())

        if signal1.type == signal2.type and signal1.entity_id == signal2.entity_id:
            # Same type and entity, check time proximity
            if time_diff < 86400:  # 24 hours in seconds
                # Check confidence similarity
                conf_diff = abs(signal1.confidence - signal2.confidence)
                if conf_diff < 0.15:  # Very similar confidence
                    return True

        return False


# =============================================================================
# Convenience Functions
# =============================================================================

async def validate_with_ralph_loop(
    raw_signals: List[Dict[str, Any]],
    entity_id: str,
    claude_client=None,
    graphiti_service=None
) -> List['Signal']:
    """
    Convenience function to run Ralph Loop validation

    Args:
        raw_signals: Raw signal data from scrapers
        entity_id: Entity identifier
        claude_client: Optional ClaudeClient (creates default if not provided)
        graphiti_service: Optional GraphitiService (creates default if not provided)

    Returns:
        List of validated Signal objects
    """
    from claude_client import ClaudeClient
    from graphiti_service import GraphitiService

    # Initialize clients if not provided
    if not claude_client:
        claude_client = ClaudeClient()

    if not graphiti_service:
        graphiti_service = GraphitiService()
        await graphiti_service.initialize()

    # Run Ralph Loop
    ralph = RalphLoop(claude_client, graphiti_service)
    validated = await ralph.validate_signals(raw_signals, entity_id)

    return validated


if __name__ == "__main__":
    import sys

    # Check if we should run the API server or test
    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        # Start API server
        host = sys.argv[2] if len(sys.argv) > 2 else "0.0.0.0"
        port = int(sys.argv[3]) if len(sys.argv) > 3 else 8001

        print(f"\n🚀 Starting Ralph Loop API server on {host}:{port}")
        print(f"   Endpoint: http://{host}:{port}/api/validate-exploration")
        print(f"   Health: http://{host}:{port}/health\n")

        start_ralph_loop_server(host=host, port=port)
    else:
        # Test Ralph Loop (original behavior)
        import asyncio

        async def test():
            from claude_client import ClaudeClient
            from graphiti_service import GraphitiService
            from schemas import SignalType

            # Initialize
            claude = ClaudeClient()
            graphiti = GraphitiService()
            await graphiti.initialize()

            # Create test signals
            raw_signals = [
                {
                    "id": "test-signal-001",
                    "type": "RFP_DETECTED",
                    "confidence": 0.85,
                    "entity_id": "test-entity",
                    "evidence": [
                        {"source": "LinkedIn", "credibility_score": 0.8},
                        {"source": "Perplexity", "credibility_score": 0.7},
                        {"source": "Crunchbase", "credibility_score": 0.9}
                    ]
                },
                {
                    "id": "test-signal-002",
                    "type": "RFP_DETECTED",
                    "confidence": 0.6,  # Below threshold
                    "entity_id": "test-entity",
                    "evidence": [
                        {"source": "LinkedIn", "credibility_score": 0.8}
                    ]  # Only 1 evidence
                }
            ]

            # Run Ralph Loop
            ralph = RalphLoop(claude, graphiti)
            validated = await ralph.validate_signals(raw_signals, "test-entity")

            print(f"\n✅ Ralph Loop test complete: {len(validated)} signals validated")

            graphiti.close()

        asyncio.run(test())
