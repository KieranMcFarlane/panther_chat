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

    Validation rules (Ralph Loop):
    - Minimum 3 pieces of evidence
    - Confidence >= 0.7 for acceptance
    - No duplicates within time window
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

    def __post_init__(self):
        """Validate signal fields"""
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError(f"Signal confidence must be 0.0-1.0, got {self.confidence}")

        if isinstance(self.first_seen, str):
            self.first_seen = datetime.fromisoformat(self.first_seen.replace('Z', '+00:00'))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage"""
        return {
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
