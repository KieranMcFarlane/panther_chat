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
