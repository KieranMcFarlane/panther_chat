"""
Data models for temporal prior service
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum


class SignalCategory(str, Enum):
    """14 canonical signal categories for temporal intelligence"""

    # Core Business Systems
    CRM = "CRM"
    TICKETING = "TICKETING"
    DATA_PLATFORM = "DATA_PLATFORM"
    COMMERCE = "COMMERCE"

    # Customer-facing
    CONTENT = "CONTENT"
    MARKETING = "MARKETING"

    # Internal Operations
    ANALYTICS = "ANALYTICS"
    COMMUNICATION = "COMMUNICATION"
    COLLABORATION = "COLLABORATION"
    OPERATIONS = "OPERATIONS"

    # Business Functions
    HR = "HR"
    FINANCE = "FINANCE"

    # Infrastructure
    INFRASTRUCTURE = "INFRASTRUCTURE"
    SECURITY = "SECURITY"


class TemporalPrior(BaseModel):
    """Computed temporal prior for a signal category

    Represents the historical timing patterns for a specific
    entity and signal category combination.
    """
    entity_id: str = Field(..., description="Entity identifier")
    signal_category: SignalCategory = Field(..., description="Signal category")

    # Seasonality patterns
    seasonality: Dict[str, float] = Field(
        default_factory=lambda: {"Q1": 0.25, "Q2": 0.25, "Q3": 0.25, "Q4": 0.25},
        description="Quarter distribution (Q1-Q4)"
    )

    # Recurrence patterns
    recurrence_mean: Optional[float] = Field(
        None,
        description="Mean days between events"
    )
    recurrence_std: Optional[float] = Field(
        None,
        description="Standard deviation of intervals"
    )

    # Momentum indicators
    momentum_30d: int = Field(
        default=0,
        description="Count of events in last 30 days"
    )
    momentum_90d: int = Field(
        default=0,
        description="Count of events in last 90 days"
    )

    # Metadata
    last_seen: datetime = Field(
        ...,
        description="Timestamp of most recent event"
    )
    sample_size: int = Field(
        ...,
        description="Number of episodes used for computation"
    )
    computed_at: datetime = Field(
        default_factory=datetime.now,
        description="When this prior was computed"
    )

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class TemporalMultiplierRequest(BaseModel):
    """Request for temporal multiplier computation"""

    entity_id: str = Field(..., description="Entity identifier")
    signal_category: SignalCategory = Field(..., description="Signal category")
    current_date: Optional[datetime] = Field(
        None,
        description="Reference date (defaults to now)"
    )


class TemporalMultiplierResponse(BaseModel):
    """Response containing temporal multiplier and metadata"""

    multiplier: float = Field(
        ...,
        ge=0.75,
        le=1.40,
        description="Temporal multiplier (0.75 = unlikely, 1.40 = likely)"
    )
    backoff_level: str = Field(
        ...,
        description="Which level of backoff was used: entity, cluster, global"
    )
    confidence: str = Field(
        ...,
        description="Confidence in this multiplier: high, medium, low"
    )
    prior: Optional[TemporalPrior] = Field(
        None,
        description="The prior that was used (if any)"
    )
