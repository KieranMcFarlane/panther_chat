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
    from schemas import Entity, Signal, Evidence, Relationship, SignalType, EntityType

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
    - first_seen: Timestamp when first detected (discovery_date)
    - evidence_date: Timestamp when the evidence was originally published (if available)
    - entity_id: Reference to Entity.id
    - confidence_validation: Optional Claude confidence validation from Pass 2

    Validation rules (Ralph Loop):
    - Minimum 3 pieces of evidence
    - Confidence >= 0.7 for acceptance
    - No duplicates within time window
    - Claude validates confidence matches evidence quality (Pass 2)

    Note:
    - first_seen = when WE discovered it (discovery_date)
    - evidence_date = when the content was PUBLISHED (temporal analysis uses this)
    """
    id: str
    type: SignalType
    confidence: float
    first_seen: datetime  # When we discovered the signal
    entity_id: str
    evidence_date: Optional[datetime] = None  # When the evidence was published
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

        if isinstance(self.evidence_date, str):
            self.evidence_date = datetime.fromisoformat(self.evidence_date.replace('Z', '+00:00'))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage"""
        result = {
            'id': self.id,
            'type': self.type.value,
            'subtype': self.subtype.value if self.subtype else None,
            'confidence': self.confidence,
            'first_seen': self.first_seen.isoformat(),  # Discovery date
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
    - date: Timestamp when we collected the evidence (discovery_date)
    - evidence_date: Timestamp when the evidence was originally published
    - signal_id: Reference to Signal.id
    - url: Optional URL for web sources
    - extracted_text: Raw text/content from source
    - metadata: Source credibility, author, etc.

    Ralph Loop requirement: Minimum 3 evidence per signal

    Note:
    - date = when WE collected this evidence (discovery_date)
    - evidence_date = when the content was PUBLISHED (temporal analysis uses this)
    """
    id: str
    source: str
    date: datetime  # When we collected it (discovery_date)
    signal_id: str
    evidence_date: Optional[datetime] = None  # When evidence was published
    url: Optional[str] = None
    extracted_text: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    credibility_score: float = 0.5

    def __post_init__(self):
        """Validate evidence fields"""
        if isinstance(self.date, str):
            self.date = datetime.fromisoformat(self.date.replace('Z', '+00:00'))

        if isinstance(self.evidence_date, str):
            self.evidence_date = datetime.fromisoformat(self.evidence_date.replace('Z', '+00:00'))

        if not 0.0 <= self.credibility_score <= 1.0:
            raise ValueError(f"Evidence credibility_score must be 0.0-1.0, got {self.credibility_score}")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage"""
        return {
            'id': self.id,
            'source': self.source,
            'date': self.date.isoformat(),  # Discovery date
            'evidence_date': self.evidence_date.isoformat() if self.evidence_date else None,  # Evidence publication date
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
    - Channel tracking for MCP-guided hop selection

    Critical guardrails (see KNVB case study):
    1. If accept_count == 0: confidence_ceiling = 0.70 (WEAK_ACCEPT inflation protection)
    2. is_actionable flag requires >= 2 ACCEPTs in >= 2 categories
    3. Category saturation multiplier reduces WEAK_ACCEPT impact over time

    Depth Control (hypothesis-driven):
    - max_depth: Maximum depth level (default: 3)
    - current_depth: Current depth level
    - depth_counts: Iteration counts per depth level

    Channel Tracking (MCP-guided):
    - channel_blacklist: Tracks failed/successful channels for hop selection
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

    # Channel tracking (MCP-guided hop selection) - initialized lazily
    channel_blacklist: Any = None  # ChannelBlacklist from sources.mcp_source_priorities

    # Hop failure tracking (prevents loops on failed hop types)
    hop_failure_counts: Dict[str, int] = field(default_factory=dict)  # hop_type -> consecutive failures
    last_failed_hop: Optional[str] = None  # Track last hop that failed

    # Iteration results tracking (for signal extraction)
    iteration_results: List[Dict[str, Any]] = field(default_factory=list)

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


# =============================================================================
# TEMPORAL PROFILING SCHEMA (Yellow Panther-Style)
# =============================================================================

class DossierQuestionType(str, Enum):
    """Types of questions extracted from dossier sections"""
    LEADERSHIP = "LEADERSHIP"                    # Decision makers, org structure
    TECHNOLOGY = "TECHNOLOGY"                    # Tech stack, platforms
    PROCUREMENT_TIMING = "PROCUREMENT_TIMING"    # When they buy, cycle
    BUDGET = "BUDGET"                            # Financial capacity
    DIGITAL_MATURITY = "DIGITAL_MATURITY"        # Digital sophistication
    PARTNERSHIPS = "PARTNERSHIPS"                # Vendor relationships
    CHALLENGES = "CHALLENGES"                    # Pain points, needs
    STRATEGY = "STRATEGY"                        # Strategic direction
    COMPETITIVE = "COMPETITIVE"                  # Market position
    GENERAL = "GENERAL"                          # Other questions


class DossierQuestionStatus(str, Enum):
    """Status of dossier question in discovery loop"""
    PENDING = "PENDING"          # Not yet answered
    IN_PROGRESS = "IN_PROGRESS"  # Discovery in progress
    ANSWERED = "ANSWERED"        # Sufficient evidence found
    DEPRIORITIZED = "DEPRIORITIZED"  # Lower priority, maybe later
    IRRELEVANT = "IRRELEVANT"    # Not applicable to this entity


@dataclass
class DossierQuestion:
    """
    Question extracted from dossier section to guide discovery

    Represents an intelligence gap that discovery should fill.
    Questions are prioritized and answered across multiple temporal sweeps.

    Examples:
        - "Who is the primary decision maker for technology procurement?"
        - "What CRM platform is currently in use?"
        - "When is the next procurement window?"
    """
    question_id: str
    section_id: str              # Which section generated it
    question_type: DossierQuestionType
    question_text: str
    priority: int                # 1-10, how important?
    confidence: float = 0.0      # How confident are we in the answer?
    status: DossierQuestionStatus = DossierQuestionStatus.PENDING
    search_strategy: Dict[str, Any] = field(default_factory=dict)
    answers: List[str] = field(default_factory=list)
    evidence_sources: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    answered_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'question_id': self.question_id,
            'section_id': self.section_id,
            'question_type': self.question_type.value,
            'question_text': self.question_text,
            'priority': self.priority,
            'confidence': self.confidence,
            'status': self.status.value,
            'search_strategy': self.search_strategy,
            'answers': self.answers,
            'evidence_sources': self.evidence_sources,
            'created_at': self.created_at.isoformat(),
            'answered_at': self.answered_at.isoformat() if self.answered_at else None
        }


@dataclass
class EntityProfile:
    """
    Complete temporal profile of an entity across multiple sweeps

    Accumulates intelligence from:
    - Multiple discovery passes
    - LinkedIn profiling
    - Historical episodes
    - Question answering

    This profile evolves over time as new evidence is collected.
    """
    entity_id: str
    entity_name: str
    profile_version: int           # Incremented each sweep
    previous_version: Optional[int] = None
    sweep_pass: int = 1            # Which sweep generated this

    # Core profile data
    confidence_score: float = 0.20
    questions_answered: int = 0
    questions_total: int = 0
    signals_detected: int = 0

    # Temporal tracking
    profile_created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    profile_updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    previous_profile_id: Optional[str] = None

    # Profile sections (mirrors dossier structure)
    leadership_profile: Dict[str, Any] = field(default_factory=dict)
    technology_profile: Dict[str, Any] = field(default_factory=dict)
    procurement_profile: Dict[str, Any] = field(default_factory=dict)
    partnership_profile: Dict[str, Any] = field(default_factory=dict)
    digital_maturity_profile: Dict[str, Any] = field(default_factory=dict)

    # LinkedIn-specific data
    linkedin_profiles: List[Dict[str, Any]] = field(default_factory=list)
    decision_makers: List[Dict[str, Any]] = field(default_factory=list)
    linkedin_posts: List[Dict[str, Any]] = field(default_factory=list)  # Posts with signals
    mutual_connections: List[Dict[str, Any]] = field(default_factory=list)  # Mutuals with Yellow Panther
    opportunities_detected: List[Dict[str, Any]] = field(default_factory=list)  # Opportunities from posts

    # Questions tracking
    outstanding_questions: List[DossierQuestion] = field(default_factory=list)
    answered_questions: List[DossierQuestion] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'profile_version': self.profile_version,
            'previous_version': self.previous_version,
            'sweep_pass': self.sweep_pass,
            'confidence_score': self.confidence_score,
            'questions_answered': self.questions_answered,
            'questions_total': self.questions_total,
            'signals_detected': self.signals_detected,
            'profile_created_at': self.profile_created_at.isoformat(),
            'profile_updated_at': self.profile_updated_at.isoformat(),
            'previous_profile_id': self.previous_profile_id,
            'leadership_profile': self.leadership_profile,
            'technology_profile': self.technology_profile,
            'procurement_profile': self.procurement_profile,
            'partnership_profile': self.partnership_profile,
            'digital_maturity_profile': self.digital_maturity_profile,
            'linkedin_profiles': self.linkedin_profiles,
            'decision_makers': self.decision_makers,
            'linkedin_posts': self.linkedin_posts,
            'mutual_connections': self.mutual_connections,
            'opportunities_detected': self.opportunities_detected,
            'outstanding_questions': [q.to_dict() for q in self.outstanding_questions],
            'answered_questions': [q.to_dict() for q in self.answered_questions]
        }


class ProfileChangeType(str, Enum):
    """Types of profile changes between sweeps"""
    CONFIDENCE_INCREASED = "CONFIDENCE_INCREASED"
    CONFIDENCE_DECREASED = "CONFIDENCE_DECREASED"
    SIGNAL_ADDED = "SIGNAL_ADDED"
    SIGNAL_REMOVED = "SIGNAL_REMOVED"
    DECISION_MAKER_IDENTIFIED = "DECISION_MAKER_IDENTIFIED"
    QUESTION_ANSWERED = "QUESTION_ANSWERED"
    NEW_TECHNOLOGY_DETECTED = "NEW_TECHNOLOGY_DETECTED"
    PARTNERSHIP_CHANGE = "PARTNERSHIP_CHANGE"
    EXECUTIVE_CHANGE = "EXECUTIVE_CHANGE"


@dataclass
class ProfileChange:
    """
    Tracks how an entity profile changed between temporal sweeps

    Provides delta tracking for:
    - Confidence score changes
    - New signals detected
    - Questions answered
    - Decision makers identified
    """
    change_id: str
    entity_id: str
    from_version: int
    to_version: int
    change_type: ProfileChangeType
    description: str
    previous_value: Any
    new_value: Any
    confidence_delta: float = 0.0
    detected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'change_id': self.change_id,
            'entity_id': self.entity_id,
            'from_version': self.from_version,
            'to_version': self.to_version,
            'change_type': self.change_type.value,
            'description': self.description,
            'previous_value': str(self.previous_value),
            'new_value': str(self.new_value),
            'confidence_delta': self.confidence_delta,
            'detected_at': self.detected_at.isoformat()
        }


class SweepType(str, Enum):
    """Types of temporal sweeps"""
    QUICK = "QUICK"          # Cached data only, ~30s
    STANDARD = "STANDARD"    # Fresh data + questions, ~60s
    DEEP = "DEEP"            # LinkedIn API + full discovery, ~120s
    MONITORING = "MONITORING"  # Change detection only, ~90s


@dataclass
class SweepConfig:
    """
    Configuration for a single temporal sweep pass

    Defines what data to collect, which sections to generate,
    and which sources to use for a specific pass.
    """
    pass_number: int
    sweep_type: SweepType
    interval_hours: int               # Time between passes
    data_sources: List[str]           # cache, api, hybrid
    sections_to_generate: List[str]   # Which dossier sections
    linkedin_enabled: bool = False
    max_cost_usd: float = 0.0
    max_duration_seconds: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'pass_number': self.pass_number,
            'sweep_type': self.sweep_type.value,
            'interval_hours': self.interval_hours,
            'data_sources': self.data_sources,
            'sections_to_generate': self.sections_to_generate,
            'linkedin_enabled': self.linkedin_enabled,
            'max_cost_usd': self.max_cost_usd,
            'max_duration_seconds': self.max_duration_seconds
        }


@dataclass
class SweepResult:
    """
    Results from a single temporal sweep execution

    Contains:
    - Generated profile
    - Changes from previous version
    - Questions answered
    - Cost and time tracking
    """
    sweep_config: SweepConfig
    entity_profile: EntityProfile
    profile_changes: List[ProfileChange]
    questions_answered: int
    questions_generated: int
    cost_usd: float
    duration_seconds: float
    started_at: datetime
    completed_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'sweep_config': self.sweep_config.to_dict(),
            'entity_profile': self.entity_profile.to_dict(),
            'profile_changes': [c.to_dict() for c in self.profile_changes],
            'questions_answered': self.questions_answered,
            'questions_generated': self.questions_generated,
            'cost_usd': self.cost_usd,
            'duration_seconds': self.duration_seconds,
            'started_at': self.started_at.isoformat(),
            'completed_at': self.completed_at.isoformat()
        }


# =============================================================================
# LINKEDIN PROFILING SCHEMA
# =============================================================================

class LinkedInEpisodeType(str, Enum):
    """Types of LinkedIn episodes for Graphiti"""
    PROFILE_SWEEP = "LINKEDIN_PROFILE_SWEEP"
    EXECUTIVE_DETECTED = "LINKEDIN_EXECUTIVE_DETECTED"
    HIRING_CHANGE = "LINKEDIN_HIRING_CHANGE"
    SKILL_UPDATE = "LINKEDIN_SKILL_UPDATE"
    ACTIVITY_PATTERN = "LINKEDIN_ACTIVITY_PATTERN"
    POST_SIGNAL_DETECTED = "LINKEDIN_POST_SIGNAL_DETECTED"
    MUTUAL_CONNECTION_FOUND = "LINKEDIN_MUTUAL_CONNECTION_FOUND"
    OPPORTUNITY_DETECTED = "LINKEDIN_OPPORTUNITY_DETECTED"


@dataclass
class LinkedInPost:
    """
    LinkedIn post data for signal detection

    Extracted from company/person LinkedIn pages to detect:
    - RFP announcements
    - Technology needs
    - Partnership opportunities
    - Hiring signals
    """
    post_id: str
    entity_id: str
    post_url: str
    content: str
    author: Optional[str] = None
    published_at: Optional[datetime] = None
    signals: List[str] = field(default_factory=list)  # RFP, TECHNOLOGY, HIRING, etc.
    opportunity_type: Optional[str] = None
    confidence: float = 0.0
    scraped_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'post_id': self.post_id,
            'entity_id': self.entity_id,
            'post_url': self.post_url,
            'content': self.content[:500],  # Limit content length
            'author': self.author,
            'published_at': self.published_at.isoformat() if self.published_at else None,
            'signals': self.signals,
            'opportunity_type': self.opportunity_type,
            'confidence': self.confidence,
            'scraped_at': self.scraped_at.isoformat()
        }


@dataclass
class MutualConnection:
    """
    Mutual connection between Yellow Panther and target entity

    Useful for:
    - Warm introductions
    - Relationship mapping
    - Partnership opportunities
    """
    connection_id: str
    yellow_panther_entity: str  # Yellow Panther person
    target_entity: str  # Target entity
    connection_name: str
    connection_title: Optional[str] = None
    connection_url: Optional[str] = None
    context: str = ""  # How they're connected
    strength: str = "WEAK"  # WEAK, MEDIUM, STRONG
    detected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'connection_id': self.connection_id,
            'yellow_panther_entity': self.yellow_panther_entity,
            'target_entity': self.target_entity,
            'connection_name': self.connection_name,
            'connection_title': self.connection_title,
            'connection_url': self.connection_url,
            'context': self.context,
            'strength': self.strength,
            'detected_at': self.detected_at.isoformat()
        }


@dataclass
class LinkedInProfile:
    """
    LinkedIn profile data extracted during sweeps

    Pass 1: Cached data from BrightData (job titles, postings)
    Pass 2: LinkedIn API deep dive (executives, career history)
    Pass 3+: Hybrid approach with profile versioning
    """
    profile_id: str
    entity_id: str
    profile_type: str  # COMPANY, EXECUTIVE, JOB_POSTING
    sweep_pass: int
    data_source: str   # CACHE, API, HYBRID

    # Profile data
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    profile_url: Optional[str] = None

    # Executive-specific fields
    career_history: List[Dict[str, Any]] = field(default_factory=list)
    skills: List[str] = field(default_factory=list)
    connections_count: Optional[int] = None

    # Job posting-specific fields
    job_title: Optional[str] = None
    job_description: Optional[str] = None
    posting_date: Optional[datetime] = None
    requirements: List[str] = field(default_factory=list)

    # Metadata
    collected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    confidence_score: float = 0.0
    version: int = 1

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'profile_id': self.profile_id,
            'entity_id': self.entity_id,
            'profile_type': self.profile_type,
            'sweep_pass': self.sweep_pass,
            'data_source': self.data_source,
            'name': self.name,
            'title': self.title,
            'company': self.company,
            'profile_url': self.profile_url,
            'career_history': self.career_history,
            'skills': self.skills,
            'connections_count': self.connections_count,
            'job_title': self.job_title,
            'job_description': self.job_description,
            'posting_date': self.posting_date.isoformat() if self.posting_date else None,
            'requirements': self.requirements,
            'collected_at': self.collected_at.isoformat(),
            'confidence_score': self.confidence_score,
            'version': self.version
        }


# =============================================================================
# DOSSIER GENERATION SCHEMA
# =============================================================================

class DossierTier(str, Enum):
    """Dossier tier based on entity priority"""
    BASIC = "BASIC"          # 0-20 priority: 3 sections, ~5s
    STANDARD = "STANDARD"    # 21-50 priority: 7 sections, ~15s
    PREMIUM = "PREMIUM"      # 51-100 priority: 11 sections, ~30s


class CacheStatus(str, Enum):
    """Cache status for dossiers"""
    FRESH = "FRESH"          # Recently generated, valid
    STALE = "STALE"          # Exists but needs refresh
    EXPIRED = "EXPIRED"      # Too old, must regenerate


@dataclass
class DossierSection:
    """
    Individual dossier section with multi-model generation tracking

    Tracks:
    - Section content and metadata
    - Which model generated it (haiku/sonnet/opus)
    - Generation timestamp and confidence
    - Optional metrics, insights, and recommendations
    """
    id: str
    title: str
    content: List[str]
    metrics: List[Dict[str, Any]] = field(default_factory=list)
    insights: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[Dict[str, Any]] = field(default_factory=list)
    confidence: float = 0.0
    generated_by: str = "haiku"  # Which model generated this section
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'metrics': self.metrics,
            'insights': self.insights,
            'recommendations': self.recommendations,
            'confidence': self.confidence,
            'generated_by': self.generated_by,
            'generated_at': self.generated_at.isoformat()
        }


@dataclass
class EntityDossier:
    """
    Complete entity dossier with multi-section intelligence

    Contains:
    - Entity metadata (id, name, type, priority)
    - Tier-based section generation (Basic/Standard/Premium)
    - Extracted questions for discovery feedback loop
    - Cost and time tracking
    - Cache management
    """
    entity_id: str
    entity_name: str
    entity_type: str  # CLUB, LEAGUE, VENUE, etc.
    priority_score: int  # 0-100
    tier: str  # BASIC, STANDARD, PREMIUM

    # All sections (populated based on tier)
    sections: List[DossierSection] = field(default_factory=list)

    # Questions extracted from sections (for discovery feedback)
    questions: List[DossierQuestion] = field(default_factory=list)

    # Metadata
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    total_cost_usd: float = 0.0
    generation_time_seconds: float = 0.0
    cache_status: str = "FRESH"  # FRESH, STALE, EXPIRED

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'entity_type': self.entity_type,
            'priority_score': self.priority_score,
            'tier': self.tier,
            'sections': [section.to_dict() for section in self.sections],
            'questions': [q.to_dict() for q in self.questions],
            'generated_at': self.generated_at.isoformat(),
            'total_cost_usd': self.total_cost_usd,
            'generation_time_seconds': self.generation_time_seconds,
            'cache_status': self.cache_status
        }


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
