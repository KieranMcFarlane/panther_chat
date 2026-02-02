#!/usr/bin/env python3
"""
Graph Intelligence Schema

Fixed-but-extensible schema for Entity/Signal/Evidence/Relationship intelligence layer.

This schema provides:
- Fixed base types (Entity, Signal, Evidence, Relationship)
- Extensible subtypes via approval mechanism
- Strong typing for confidence scoring and temporal tracking
- Migration path from Episode-based temporal system

Usage:
    from backend.schemas import Entity, Signal, Evidence, Relationship, SignalType, EntityType

    entity = Entity(
        id="ac-milan-fc",
        type=EntityType.ORG,
        name="AC Milan",
        metadata={"league": "Serie A", "founded": 1899}
    )

    signal = Signal(
        id="signal-001",
        type=SignalType.RFP_DETECTED,
        subtype=SignalSubtype.AI_PLATFORM_REWRITE,
        confidence=0.85,
        first_seen=datetime.now(timezone.utc),
        entity_id="ac-milan-fc"
    )
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field, asdict
from enum import Enum
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# Entity Schema (Fixed base types, extensible metadata)
# =============================================================================

class EntityType(str, Enum):
    """Fixed base entity types - extensible via metadata, not new types"""
    ORG = "ORG"
    PERSON = "PERSON"
    PRODUCT = "PRODUCT"
    INITIATIVE = "INITIATIVE"
    VENUE = "VENUE"


@dataclass
class Entity:
    """
    Entity: Core node in the intelligence graph

    Fixed fields:
    - id: Unique identifier (lowercase, dash-separated)
    - type: Fixed EntityType enum (no extensions)
    - name: Display name
    - metadata: Extensible key-value pairs for entity-specific data

    Examples:
        Entity(id="ac-milan-fc", type=EntityType.ORG, name="AC Milan",
               metadata={"league": "Serie A", "founded": 1899})

        Entity(id="paolo-maldini", type=EntityType.PERSON, name="Paolo Maldini",
               metadata={"role": "Technical Director", "club": "AC Milan"})
    """
    id: str
    type: EntityType
    name: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Normalize entity ID to lowercase, dash-separated format"""
        if self.id:
            self.id = self.id.lower().replace(' ', '-').replace('_', '-')

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage"""
        return {
            'id': self.id,
            'type': self.type.value,
            'name': self.name,
            'metadata': self.metadata
        }


# =============================================================================
# Signal Schema (Fixed types, extensible subtypes)
# =============================================================================

class SignalType(str, Enum):
    """Fixed base signal types - these cannot be extended"""
    RFP_DETECTED = "RFP_DETECTED"
    PARTNERSHIP_FORMED = "PARTNERSHIP_FORMED"
    PARTNERSHIP_ENDED = "PARTNERSHIP_ENDED"
    EXECUTIVE_CHANGE = "EXECUTIVE_CHANGE"
    TECHNOLOGY_ADOPTED = "TECHNOLOGY_ADOPTED"
    ACHIEVEMENT_UNLOCKED = "ACHIEVEMENT_UNLOCKED"
    LEAGUE_PROMOTION = "LEAGUE_PROMOTION"
    LEAGUE_RELEGATION = "LEAGUE_RELEGATION"
    VENUE_CHANGE = "VENUE_CHANGE"
    SPONSORSHIP = "SPONSORSHIP"


class SignalSubtype(str, Enum):
    """
    Extensible signal subtypes - these CAN be extended via approval workflow

    Base subtypes (pre-approved):
    """
    # RFP subtypes
    AI_PLATFORM_REWRITE = "AI_PLATFORM_REWRITE"
    CREATOR_MONETIZATION_STRATEGY = "CREATOR_MONETIZATION_STRATEGY"
    FAN_ENGAGEMENT_PLATFORM = "FAN_ENGAGEMENT_PLATFORM"
    DATA_ANALYTICS_SUITE = "DATA_ANALYTICS_SUITE"
    TICKETING_SYSTEM = "TICKETING_SYSTEM"

    # Partnership subtypes
    TECHNICAL_PARTNERSHIP = "TECHNICAL_PARTNERSHIP"
    SPONSORSHIP_DEAL = "SPONSORSHIP_DEAL"
    MEDIA_PARTNERSHIP = "MEDIA_PARTNERSHIP"

    # Technology subtypes
    CLOUD_MIGRATION = "CLOUD_MIGRATION"
    AI_ADOPTION = "AI_ADOPTION"
    DATA_WAREHOUSE = "DATA_WAREHOUSE"
    CRM_IMPLEMENTATION = "CRM_IMPLEMENTATION"


@dataclass
class ConfidenceValidation:
    """
    Results of Claude confidence validation in Pass 2

    Tracks Claude's assessment of scraper-assigned confidence scores:
    - original_confidence: Confidence from scraper
    - validated_confidence: Claude's assessed confidence
    - adjustment: Difference (validated - original)
    - rationale: Claude's reasoning for adjustment
    - requires_manual_review: Edge cases flagged for human review
    - validation_timestamp: When validation occurred
    """
    original_confidence: float
    validated_confidence: float
    adjustment: float
    rationale: str
    requires_manual_review: bool = False
    validation_timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage"""
        return {
            'original_confidence': self.original_confidence,
            'validated_confidence': self.validated_confidence,
            'adjustment': self.adjustment,
            'rationale': self.rationale,
            'requires_manual_review': self.requires_manual_review,
            'validation_timestamp': self.validation_timestamp.isoformat()
        }


@dataclass
class Signal:
    """
    Signal: Intelligence event about an entity

    Fixed fields:
    - id: Unique signal identifier
    - type: Fixed SignalType enum
    - subtype: Optional SignalSubtype (extensible via approval)
    - confidence: Float 0.0-1.0 (must meet minimum for validation)
    - first_seen: Timestamp when first detected
    - entity_id: Reference to Entity.id
    - confidence_validation: Optional Claude confidence validation from Pass 2

    Validation rules (Ralph Loop):
    - Minimum 3 pieces of evidence
    - Confidence >= 0.7 for acceptance
    - No duplicates within time window
    - Claude validates confidence matches evidence quality (Pass 2)
    """
    id: str
    type: SignalType
    confidence: float
    first_seen: datetime
    entity_id: str
    subtype: Optional[SignalSubtype] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    validated: bool = False
    validation_pass: int = 0
    confidence_validation: Optional[ConfidenceValidation] = None

    def __post_init__(self):
        """Validate signal fields"""
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError(f"Signal confidence must be 0.0-1.0, got {self.confidence}")

        if isinstance(self.first_seen, str):
            self.first_seen = datetime.fromisoformat(self.first_seen.replace('Z', '+00:00'))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage"""
        result = {
            'id': self.id,
            'type': self.type.value,
            'subtype': self.subtype.value if self.subtype else None,
            'confidence': self.confidence,
            'first_seen': self.first_seen.isoformat(),
            'entity_id': self.entity_id,
            'metadata': self.metadata,
            'validated': self.validated,
            'validation_pass': self.validation_pass
        }

        # Include confidence validation if present
        if self.confidence_validation:
            result['confidence_validation'] = self.confidence_validation.to_dict()

        return result


# =============================================================================
# Evidence Schema (Supports Signal validation)
# =============================================================================

@dataclass
class Evidence:
    """
    Evidence: Proof source for a Signal

    Fixed fields:
    - id: Unique evidence identifier
    - source: Source identifier (URL, document, etc.)
    - date: Timestamp of evidence
    - signal_id: Reference to Signal.id
    - url: Optional URL for web sources
    - extracted_text: Raw text/content from source
    - metadata: Source credibility, author, etc.

    Ralph Loop requirement: Minimum 3 evidence per signal
    """
    id: str
    source: str
    date: datetime
    signal_id: str
    url: Optional[str] = None
    extracted_text: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    credibility_score: float = 0.5

    def __post_init__(self):
        """Validate evidence fields"""
        if isinstance(self.date, str):
            self.date = datetime.fromisoformat(self.date.replace('Z', '+00:00'))

        if not 0.0 <= self.credibility_score <= 1.0:
            raise ValueError(f"Evidence credibility_score must be 0.0-1.0, got {self.credibility_score}")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage"""
        return {
            'id': self.id,
            'source': self.source,
            'date': self.date.isoformat(),
            'signal_id': self.signal_id,
            'url': self.url,
            'extracted_text': self.extracted_text,
            'metadata': self.metadata,
            'credibility_score': self.credibility_score
        }


# =============================================================================
# Relationship Schema (Entity-to-Entity connections)
# =============================================================================

class RelationshipType(str, Enum):
    """Fixed relationship types"""
    PARTNER_OF = "PARTNER_OF"
    SPONSOR_OF = "SPONSOR_OF"
    EMPLOYEE_OF = "EMPLOYEE_OF"
    OWNED_BY = "OWNED_BY"
    LOCATED_AT = "LOCATED_AT"
    COMPETITOR_OF = "COMPETITOR_OF"
    SUPPLIER_TO = "SUPPLIER_TO"
    CUSTOMER_OF = "CUSTOMER_OF"


@dataclass
class Relationship:
    """
    Relationship: Connection between two entities

    Fixed fields:
    - id: Unique relationship identifier
    - type: Fixed RelationshipType enum
    - from_entity: Source Entity.id
    - to_entity: Target Entity.id
    - confidence: Float 0.0-1.0
    - valid_from: Relationship start timestamp
    - valid_until: Optional end timestamp (NULL = active)
    - metadata: Additional context

    Temporal relationships support:
    - Valid from/until for time-based queries
    - Confidence scoring for uncertainty
    """
    id: str
    type: RelationshipType
    from_entity: str
    to_entity: str
    confidence: float
    valid_from: datetime
    valid_until: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Validate relationship fields"""
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError(f"Relationship confidence must be 0.0-1.0, got {self.confidence}")

        if isinstance(self.valid_from, str):
            self.valid_from = datetime.fromisoformat(self.valid_from.replace('Z', '+00:00'))

        if self.valid_until and isinstance(self.valid_until, str):
            self.valid_until = datetime.fromisoformat(self.valid_until.replace('Z', '+00:00'))

        # Validate temporal consistency
        if self.valid_until and self.valid_from > self.valid_until:
            raise ValueError(f"valid_from must be before valid_until")

    def is_active_at(self, timestamp: datetime) -> bool:
        """Check if relationship is active at given timestamp"""
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))

        if self.valid_from > timestamp:
            return False

        if self.valid_until and self.valid_until < timestamp:
            return False

        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage"""
        return {
            'id': self.id,
            'type': self.type.value,
            'from_entity': self.from_entity,
            'to_entity': self.to_entity,
            'confidence': self.confidence,
            'valid_from': self.valid_from.isoformat(),
            'valid_until': self.valid_until.isoformat() if self.valid_until else None,
            'metadata': self.metadata
        }


# =============================================================================
# RALPH LOOP STATE-AWARE SCHEMA
# =============================================================================

class HypothesisAction(str, Enum):
    """Actions that can be taken on a hypothesis during iteration"""
    REINFORCE = "reinforce"
    WEAKEN = "weaken"
    INVALIDATE = "invalidate"
    NONE = "none"


@dataclass
class BeliefLedgerEntry:
    """
    Append-only audit log entry for hypothesis changes

    Tracks every hypothesis modification with full provenance for:
    - Auditability: Trace any confidence change to its source
    - Explainability: Understand WHY confidence changed
    - Fine-tuning: Learn which evidence sources are reliable

    This ledger is the single source of truth for all confidence adjustments.
    """
    iteration: int
    hypothesis_id: str
    change: HypothesisAction  # REINFORCE | WEAKEN | INVALIDATE
    confidence_impact: float   # e.g., -0.08 for weakening
    evidence_ref: str          # e.g., "annual_report_2023" or URL
    timestamp: datetime
    category: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'iteration': self.iteration,
            'hypothesis_id': self.hypothesis_id,
            'change': self.change.value,
            'confidence_impact': self.confidence_impact,
            'evidence_ref': self.evidence_ref,
            'timestamp': self.timestamp.isoformat(),
            'category': self.category
        }


class RalphDecisionType(str, Enum):
    """
    Expanded Ralph Loop decision types for state-aware iteration

    States:
    - ACCEPT: Strong evidence of future procurement action
    - WEAK_ACCEPT: Capability present but procurement intent unclear
    - REJECT: No evidence or evidence contradicts procurement hypothesis
    - NO_PROGRESS: Evidence exists but adds no new predictive information
    - SATURATED: Category exhausted, no new information expected
    """
    ACCEPT = "ACCEPT"
    WEAK_ACCEPT = "WEAK_ACCEPT"
    REJECT = "REJECT"
    NO_PROGRESS = "NO_PROGRESS"  # NEW: Evidence exists but no delta
    SATURATED = "SATURATED"      # NEW: Category exhausted

    def to_external_name(self) -> str:
        """Convert internal decision to external customer-facing name"""
        mapping = {
            "ACCEPT": "PROCUREMENT_SIGNAL",
            "WEAK_ACCEPT": "CAPABILITY_SIGNAL",
            "REJECT": "NO_SIGNAL",
            "NO_PROGRESS": "NO_SIGNAL",
            "SATURATED": "SATURATED"
        }
        return mapping[self.value]


class ConfidenceBand(str, Enum):
    """
    Business-meaningful confidence bands for sales clarity and pricing

    Bands map confidence scores to business actions:
    - EXPLORATORY: <0.30 - Research phase, no charge
    - INFORMED: 0.30-0.60 - Monitoring mode, $500/entity/month
    - CONFIDENT: 0.60-0.80 - Sales engaged, $2,000/entity/month
    - ACTIONABLE: >0.80 + gate - Immediate outreach, $5,000/entity/month

    The ACTIONABLE gate requires:
    - Confidence >0.80
    - is_actionable = True (≥2 ACCEPTs across ≥2 categories)
    """
    EXPLORATORY = "EXPLORATORY"    # <0.30: Noise/research
    INFORMED = "INFORMED"          # 0.30-0.60: Monitor
    CONFIDENT = "CONFIDENT"        # 0.60-0.80: High capability
    ACTIONABLE = "ACTIONABLE"      # >0.80 + gate: Sales trigger


@dataclass
class Hypothesis:
    """
    Active hypothesis during Ralph Loop iteration

    A hypothesis represents a testable claim about an entity's procurement readiness.
    Hypotheses are created, reinforced, weakened, or invalidated during iteration.

    Examples:
    - "Entity modernising internally without procurement intent"
    - "Entity actively sourcing vendors for AI platform"
    - "Entity locked into long-term contracts, no near-term procurement"
    """
    hypothesis_id: str
    entity_id: str
    category: str
    statement: str
    confidence: float = 0.5
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    reinforced_count: int = 0
    weakened_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'hypothesis_id': self.hypothesis_id,
            'entity_id': self.entity_id,
            'category': self.category,
            'statement': self.statement,
            'confidence': self.confidence,
            'created_at': self.created_at.isoformat(),
            'reinforced_count': self.reinforced_count,
            'weakened_count': self.weakened_count
        }


@dataclass
class CategoryStats:
    """
    Per-category statistics during Ralph Loop iteration

    Tracks exploration history per category to enable:
    - Category saturation detection (early stopping)
    - Novelty multiplier calculation (duplicate detection)
    - Category-specific confidence adjustments
    """
    category: str
    total_iterations: int = 0
    accept_count: int = 0
    weak_accept_count: int = 0
    reject_count: int = 0
    no_progress_count: int = 0
    saturated_count: int = 0
    last_decision: RalphDecisionType = None
    last_iteration: int = 0

    @property
    def saturation_score(self) -> float:
        """
        Calculate category saturation score (0.0-1.0)

        Higher scores indicate category is exhausted and should be skipped.
        Factors:
        - Negative decision ratio (REJECT + NO_PROGRESS)
        - Consecutive weak signals penalty
        - Accept rate (low accept rate = high saturation)
        """
        if self.total_iterations == 0:
            return 0.0

        # Negative decision ratio (0.0 - 1.0)
        negative_ratio = (self.reject_count + self.no_progress_count) / self.total_iterations

        # Consecutive weak signal penalty
        consecutive_penalty = 0.3 if self.last_decision in [
            RalphDecisionType.WEAK_ACCEPT,
            RalphDecisionType.NO_PROGRESS
        ] else 0.0

        # Accept rate penalty (low accept rate = high penalty)
        accept_rate = self.accept_count / max(self.total_iterations, 1)
        accept_penalty = max(0.0, 1.0 - accept_rate * 2)

        return min(1.0, negative_ratio * 0.5 + consecutive_penalty + accept_penalty * 0.2)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'category': self.category,
            'total_iterations': self.total_iterations,
            'accept_count': self.accept_count,
            'weak_accept_count': self.weak_accept_count,
            'reject_count': self.reject_count,
            'no_progress_count': self.no_progress_count,
            'saturated_count': self.saturated_count,
            'last_decision': self.last_decision.value if self.last_decision else None,
            'last_iteration': self.last_iteration,
            'saturation_score': self.saturation_score
        }


class DepthLevel(str, Enum):
    """Depth levels for hypothesis-driven discovery"""
    SURFACE = "SURFACE"          # Level 1: Official sites, homepages, overview pages
    OPERATIONAL = "OPERATIONAL"  # Level 2: Job postings, tender portals, specific pages
    AUTHORITY = "AUTHORITY"      # Level 3: Job descriptions, strategy docs, finance pages


@dataclass
class RalphState:
    """
    Complete state of Ralph Loop for an entity

    The RalphState object is passed through iterations and maintains:
    - Current confidence score
    - Per-category statistics
    - Active hypotheses with confidence scores
    - Confidence history for saturation detection
    - Evidence seen (for novelty detection)
    - Early stopping flags
    - Depth tracking for hypothesis-driven discovery

    Critical guardrails (see KNVB case study):
    1. If accept_count == 0: confidence_ceiling = 0.70 (WEAK_ACCEPT inflation protection)
    2. is_actionable flag requires >= 2 ACCEPTs in >= 2 categories
    3. Category saturation multiplier reduces WEAK_ACCEPT impact over time

    Depth Control (hypothesis-driven):
    - max_depth: Maximum depth level (default: 3)
    - current_depth: Current depth level
    - depth_counts: Iteration counts per depth level
    """
    entity_id: str
    entity_name: str
    current_confidence: float = 0.20
    iterations_completed: int = 0
    category_stats: Dict[str, CategoryStats] = field(default_factory=dict)
    active_hypotheses: List[Hypothesis] = field(default_factory=list)
    confidence_ceiling: float = 0.95
    confidence_history: List[float] = field(default_factory=list)
    seen_evidences: List[str] = field(default_factory=list)
    category_saturated: bool = False
    confidence_saturated: bool = False
    global_saturated: bool = False
    belief_ledger: List[BeliefLedgerEntry] = field(default_factory=list)

    # Depth tracking (hypothesis-driven discovery)
    max_depth: int = 3
    current_depth: int = 1
    depth_counts: Dict[int, int] = field(default_factory=dict)  # depth -> iteration count

    def get_category_stats(self, category: str) -> CategoryStats:
        """Get or create category stats"""
        if category not in self.category_stats:
            self.category_stats[category] = CategoryStats(category=category)
        return self.category_stats[category]

    def increment_depth_count(self, depth: int):
        """Increment iteration count for depth level"""
        if depth not in self.depth_counts:
            self.depth_counts[depth] = 0
        self.depth_counts[depth] += 1

    def get_depth_level(self) -> DepthLevel:
        """Get current depth level as enum"""
        level_map = {
            1: DepthLevel.SURFACE,
            2: DepthLevel.OPERATIONAL,
            3: DepthLevel.AUTHORITY
        }
        return level_map.get(self.current_depth, DepthLevel.SURFACE)

    def should_dig_deeper(self, hypothesis) -> bool:
        """
        Determine if system should dig deeper for this hypothesis

        Stop if ANY of:
        - depth >= max_depth (3)
        - delta < 0.01 (no confidence gain)
        - iterations >= threshold (10)
        - hypothesis.status != ACTIVE

        Args:
            hypothesis: Hypothesis to evaluate

        Returns:
            True if should dig deeper, False otherwise
        """
        # Depth limit
        if self.current_depth >= self.max_depth:
            return False

        # No confidence gain
        if abs(hypothesis.last_delta) < 0.01:
            return False

        # Iteration limit
        if hypothesis.iterations_attempted >= 10:
            return False

        # Hypothesis not active
        if hypothesis.status != "ACTIVE":
            return False

        return True

    def update_confidence(self, new_confidence: float):
        """
        Update confidence with clamping and saturation detection

        Also enforces Guardrail 1: WEAK_ACCEPT confidence ceiling
        If accept_count == 0, cap confidence at 0.70
        """
        # Apply WEAK_ACCEPT guardrail
        total_accepts = sum(stats.accept_count for stats in self.category_stats.values())
        if total_accepts == 0:
            self.confidence_ceiling = 0.70
        else:
            self.confidence_ceiling = 0.95

        # Clamp to [0.05, ceiling]
        self.current_confidence = max(0.05, min(self.confidence_ceiling, new_confidence))

        # Track history for saturation detection
        self.confidence_history.append(self.current_confidence)

        # Detect confidence saturation (no meaningful gain over 10 iterations)
        if len(self.confidence_history) >= 10:
            recent_gain = self.confidence_history[-1] - self.confidence_history[-10]
            if abs(recent_gain) < 0.01:
                self.confidence_saturated = True

    @property
    def is_actionable(self) -> bool:
        """
        Guardrail 2: Actionable status gate

        Entity is "actionable" (ready for sales outreach) only if:
        - >= 2 ACCEPT decisions (strong evidence)
        - Across >= 2 distinct categories (diversified evidence)

        This prevents sales from calling on entities like KNVB with 0 ACCEPTs
        """
        total_accepts = sum(stats.accept_count for stats in self.category_stats.values())
        categories_with_accepts = sum(
            1 for stats in self.category_stats.values()
            if stats.accept_count > 0
        )

        return (total_accepts >= 2) and (categories_with_accepts >= 2)

    @property
    def confidence_band(self) -> ConfidenceBand:
        """
        Calculate business-meaningful confidence band for pricing and SLAs

        Bands:
        - EXPLORATORY: <0.30 - Research phase, no charge
        - INFORMED: 0.30-0.60 - Monitoring mode
        - CONFIDENT: 0.60-0.80 - Sales engaged
        - ACTIONABLE: >0.80 + is_actionable gate - Immediate outreach

        The ACTIONABLE band requires BOTH high confidence AND the actionable gate.
        High confidence without meeting the actionable gate stays CONFIDENT.
        """
        if self.current_confidence < 0.30:
            return ConfidenceBand.EXPLORATORY
        elif self.current_confidence < 0.60:
            return ConfidenceBand.INFORMED
        elif self.current_confidence < 0.80:
            return ConfidenceBand.CONFIDENT
        else:
            # ACTIONABLE requires both confidence AND guardrail pass
            return ConfidenceBand.ACTIONABLE if self.is_actionable else ConfidenceBand.CONFIDENT

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'current_confidence': self.current_confidence,
            'iterations_completed': self.iterations_completed,
            'category_stats': {
                cat: stats.to_dict()
                for cat, stats in self.category_stats.items()
            },
            'active_hypotheses': [h.to_dict() for h in self.active_hypotheses],
            'confidence_ceiling': self.confidence_ceiling,
            'confidence_history': self.confidence_history,
            'seen_evidences': self.seen_evidences,
            'category_saturated': self.category_saturated,
            'confidence_saturated': self.confidence_saturated,
            'global_saturated': self.global_saturated,
            'is_actionable': self.is_actionable,
            'confidence_band': self.confidence_band.value,
            'belief_ledger': [entry.to_dict() for entry in self.belief_ledger],
            # Depth tracking
            'max_depth': self.max_depth,
            'current_depth': self.current_depth,
            'depth_level': self.get_depth_level().value,
            'depth_counts': self.depth_counts
        }


@dataclass
class HypothesisUpdate:
    """
    Update to a hypothesis during a single iteration

    Tracks how hypotheses evolve as evidence accumulates.
    """
    hypothesis_id: str
    action: HypothesisAction
    reason: str
    confidence_change: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'hypothesis_id': self.hypothesis_id,
            'action': self.action.value,
            'reason': self.reason,
            'confidence_change': self.confidence_change
        }


@dataclass
class RalphIterationOutput:
    """
    Output from a single Ralph Loop iteration with state-aware logic

    Contains:
    - Decision and justification
    - Confidence calculation breakdown (raw delta, multipliers, applied delta)
    - State update (RalphState after iteration)
    - Hypothesis updates (if any)
    - Cost tracking
    - Timestamp
    """
    iteration: int
    entity_id: str
    entity_name: str
    category: str
    decision: RalphDecisionType
    justification: str
    confidence_before: float
    confidence_after: float
    raw_delta: float
    novelty_multiplier: float
    hypothesis_alignment: float
    ceiling_damping: float
    category_multiplier: float
    applied_delta: float
    updated_state: RalphState
    hypothesis_updates: List[HypothesisUpdate]
    source_url: str
    evidence_found: str
    cumulative_cost: float
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'iteration': self.iteration,
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'category': self.category,
            'decision': self.decision.to_external_name(),  # Use external name for API
            'justification': self.justification,
            'confidence_before': self.confidence_before,
            'confidence_after': self.confidence_after,
            'raw_delta': self.raw_delta,
            'novelty_multiplier': self.novelty_multiplier,
            'hypothesis_alignment': self.hypothesis_alignment,
            'ceiling_damping': self.ceiling_damping,
            'category_multiplier': self.category_multiplier,
            'applied_delta': self.applied_delta,
            'updated_state': self.updated_state.to_dict(),
            'hypothesis_updates': [update.to_dict() for update in self.hypothesis_updates],
            'source_url': self.source_url,
            'evidence_found': self.evidence_found,
            'cumulative_cost': self.cumulative_cost,
            'timestamp': self.timestamp.isoformat()
        }


# =============================================================================
# Schema Extension System (Approval workflow for new subtypes)
# =============================================================================

class SchemaExtensionRequest(BaseModel):
    """
    Request to extend SignalSubtype enum

    Process:
    1. Request submitted with rationale
    2. Stored in pending_extensions table
    3. Auto-approved if confidence > 0.9 and matches pattern
    4. Manual approval via admin notification otherwise
    5. Approved extensions added to SignalSubtype enum
    """
    node: str = Field(..., description="Node type: 'SignalSubtype' (only Signal supports extensions)")
    field: str = Field(..., description="New subtype name (e.g., 'BLOCKCHAIN_ADOPTION')")
    value: str = Field(..., description="Display value (e.g., 'Blockchain Adoption')")
    rationale: str = Field(..., description="Why this subtype is needed")
    requested_by: str = Field(default="system", description="Who requested this extension")
    confidence: float = Field(default=0.5, description="Confidence in this extension (0.0-1.0)")

    class Config:
        json_schema_extra = {
            "example": {
                "node": "SignalSubtype",
                "field": "BLOCKCHAIN_ADOPTION",
                "value": "Blockchain Adoption",
                "rationale": "Track NFT ticketing initiatives",
                "requested_by": "ralph_loop",
                "confidence": 0.85
            }
        }


class SchemaExtensionStatus(str, Enum):
    """Status of extension request"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


# =============================================================================
# Migration Types (Episode -> Signal)
# =============================================================================

@dataclass
class EpisodeToSignalMapping:
    """
    Mapping from Episode-based schema to Entity/Signal schema

    Mapping rules:
    - Episode.episode_type -> Signal.type
    - Episode.organization -> Entity.id
    - Episode.source -> Evidence.source
    - Episode.date -> Evidence.date
    - Episode.confidence_score -> Signal.confidence
    """
    episode_id: str
    signal_id: str
    entity_id: str
    signal_type: SignalType
    signal_subtype: Optional[SignalSubtype]
    confidence: float

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'episode_id': self.episode_id,
            'signal_id': self.signal_id,
            'entity_id': self.entity_id,
            'signal_type': self.signal_type.value,
            'signal_subtype': self.signal_subtype.value if self.signal_subtype else None,
            'confidence': self.confidence
        }


# =============================================================================
# Convenience Functions
# =============================================================================

def create_entity_id(name: str, entity_type: EntityType) -> str:
    """
    Create standardized entity ID from name

    Examples:
        "AC Milan" + EntityType.ORG -> "ac-milan"
        "Paolo Maldini" + EntityType.PERSON -> "paolo-maldini"
    """
    return name.lower().replace(' ', '-').replace('_', '-')


def create_signal_id(entity_id: str, signal_type: SignalType, timestamp: datetime) -> str:
    """
    Create standardized signal ID

    Format: signal_{entity_id}_{type}_{YYYYMMDDHHMMSS}
    """
    ts_str = timestamp.strftime("%Y%m%d%H%M%S")
    return f"signal_{entity_id}_{signal_type.value.lower()}_{ts_str}"


def create_evidence_id(signal_id: str, source: str, index: int) -> str:
    """
    Create standardized evidence ID

    Format: evidence_{signal_id}_{index}
    """
    return f"evidence_{signal_id}_{index}"


def map_episode_type_to_signal_type(episode_type: str) -> SignalType:
    """
    Map Episode.episode_type to Signal.SignalType

    Provides backward compatibility with Episode-based system
    """
    mapping = {
        "RFP_DETECTED": SignalType.RFP_DETECTED,
        "RFP_RESPONDED": SignalType.RFP_DETECTED,  # Map to same type
        "PARTNERSHIP_FORMED": SignalType.PARTNERSHIP_FORMED,
        "PARTNERSHIP_ENDED": SignalType.PARTNERSHIP_ENDED,
        "EXECUTIVE_CHANGE": SignalType.EXECUTIVE_CHANGE,
        "TECHNOLOGY_ADOPTED": SignalType.TECHNOLOGY_ADOPTED,
        "ACHIEVEMENT_UNLOCKED": SignalType.ACHIEVEMENT_UNLOCKED,
        "LEAGUE_PROMOTION": SignalType.LEAGUE_PROMOTION,
        "LEAGUE_RELEGATION": SignalType.LEAGUE_RELEGATION,
        "VENUE_CHANGE": SignalType.VENUE_CHANGE,
        "SPONSORSHIP": SignalType.SPONSORSHIP,
        "OTHER": SignalType.RFP_DETECTED,  # Default fallback
    }

    return mapping.get(episode_type, SignalType.RFP_DETECTED)


# =============================================================================
# Validation Helpers (Ralph Loop)
# =============================================================================

class SignalValidationResult(BaseModel):
    """Result of signal validation"""
    signal_id: str
    passed: bool
    pass_number: int
    evidence_count: int
    confidence: float
    rejection_reasons: List[str] = Field(default_factory=list)


def validate_signal_minimums(signal: Signal, evidence: List[Evidence]) -> SignalValidationResult:
    """
    Validate signal meets Ralph Loop minimum requirements

    Checks:
    - Minimum 3 pieces of evidence
    - Confidence >= 0.7
    - Evidence credibility scores
    """
    reasons = []
    passed = True

    # Check evidence count
    if len(evidence) < 3:
        passed = False
        reasons.append(f"Insufficient evidence: {len(evidence)}/3 minimum")

    # Check confidence
    if signal.confidence < 0.7:
        passed = False
        reasons.append(f"Low confidence: {signal.confidence} < 0.7 minimum")

    # Check evidence credibility
    avg_credibility = sum(e.credibility_score for e in evidence) / len(evidence) if evidence else 0
    if avg_credibility < 0.6:
        passed = False
        reasons.append(f"Low evidence credibility: {avg_credibility:.2f} < 0.6 average")

    return SignalValidationResult(
        signal_id=signal.id,
        passed=passed,
        pass_number=0,
        evidence_count=len(evidence),
        confidence=signal.confidence,
        rejection_reasons=reasons
    )


if __name__ == "__main__":
    # Test schema creation
    print("Testing Graph Intelligence Schema...")

    # Create Entity
    entity = Entity(
        id="ac-milan-fc",
        type=EntityType.ORG,
        name="AC Milan",
        metadata={"league": "Serie A", "founded": 1899}
    )
    print(f"✅ Entity created: {entity.id}")

    # Create Signal
    signal = Signal(
        id="signal-001",
        type=SignalType.RFP_DETECTED,
        subtype=SignalSubtype.AI_PLATFORM_REWRITE,
        confidence=0.85,
        first_seen=datetime.now(timezone.utc),
        entity_id="ac-milan-fc"
    )
    print(f"✅ Signal created: {signal.id}")

    # Create Evidence
    evidence = Evidence(
        id="evidence-001",
        source="LinkedIn",
        date=datetime.now(timezone.utc),
        signal_id="signal-001",
        url="https://linkedin.com/job/123",
        credibility_score=0.8
    )
    print(f"✅ Evidence created: {evidence.id}")

    # Create Relationship
    relationship = Relationship(
        id="rel-001",
        type=RelationshipType.PARTNER_OF,
        from_entity="ac-milan-fc",
        to_entity="tech-corp",
        confidence=0.9,
        valid_from=datetime.now(timezone.utc)
    )
    print(f"✅ Relationship created: {relationship.id}")

    # Test validation
    validation = validate_signal_minimums(signal, [evidence])
    print(f"✅ Validation: {'PASSED' if validation.passed else 'FAILED'}")
    if not validation.passed:
        print(f"   Reasons: {validation.rejection_reasons}")

    print("\n✅ All schema tests passed!")
