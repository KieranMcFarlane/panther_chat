"""
Exploration Log Entry

Write-once immutable evidence tracking for every exploration decision.

Core principle: Once written, exploration logs are NEVER mutated.
All modifications create new entries with hash chain linking.

This provides complete auditability from initial exploration to pattern promotion.
"""

import json
import hashlib
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Dict, List, Any, Optional, Literal
from uuid import uuid4

from backend.exploration.canonical_categories import ExplorationCategory

logger = logging.getLogger(__name__)


@dataclass
class ExplorationLogEntry:
    """
    Immutable exploration log entry

    Attributes:
        entry_id: Unique UUID for this entry
        timestamp: ISO timestamp (immutable)
        phase: Always "EXPLORATION" for exploration entries

        # Context
        cluster_id: Cluster being explored
        template_id: Template being tested
        entity_sample: List of entities in sample (default: 7)

        # Exploration Category (one of 8 canonical)
        category: ExplorationCategory enum

        # Decision Evidence
        hypothesis: What we're testing
        exploration_method: Claude Code, BrightData MCP, etc.
        claude_prompt: Prompt sent to Claude (if applicable)
        claude_response: Response from Claude (if applicable)
        brightdata_query: Query sent to BrightData (if applicable)
        brightdata_results: Results from BrightData (if applicable)

        # Outcomes
        patterns_observed: List of patterns found
        confidence_signals: List of confidence scores (0.0-1.0)
        negative_findings: List of null results

        # Hash Chain (for immutability)
        previous_hash: Hash of previous entry (None for first entry)
        entry_hash: SHA-256 hash of this entry
    """
    entry_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    phase: Literal["EXPLORATION"] = "EXPLORATION"

    # Context
    cluster_id: str = ""
    template_id: str = ""
    entity_sample: List[str] = field(default_factory=list)

    # Exploration Category
    category: ExplorationCategory = ExplorationCategory.JOBS_BOARD_EFFECTIVENESS

    # Decision Evidence
    hypothesis: str = ""
    exploration_method: str = ""
    claude_prompt: Optional[str] = None
    claude_response: Optional[str] = None
    brightdata_query: Optional[str] = None
    brightdata_results: Optional[Dict[str, Any]] = None

    # Outcomes
    patterns_observed: List[str] = field(default_factory=list)
    confidence_signals: List[float] = field(default_factory=list)
    negative_findings: List[str] = field(default_factory=list)

    # Hash Chain
    previous_hash: Optional[str] = None
    entry_hash: str = field(default="")

    def __post_init__(self):
        """Calculate entry hash after initialization"""
        if not self.entry_hash:
            self.entry_hash = self._calculate_hash()

    def _calculate_hash(self) -> str:
        """
        Calculate SHA-256 hash of this entry

        Hash includes all fields for immutability guarantee.
        """
        # Create canonical JSON representation
        entry_dict = asdict(self)
        # Convert enum to string for JSON serialization
        entry_dict['category'] = self.category.value
        entry_json = json.dumps(entry_dict, sort_keys=True)

        # Calculate SHA-256 hash
        return hashlib.sha256(entry_json.encode()).hexdigest()

    def verify_hash_chain(self, previous_entry_hash: Optional[str]) -> bool:
        """
        Verify hash chain integrity

        Args:
            previous_entry_hash: Hash from previous entry in chain

        Returns:
            True if hash chain is valid
        """
        if self.previous_hash != previous_entry_hash:
            logger.warning(f"⚠️ Hash chain broken: expected {previous_entry_hash}, got {self.previous_hash}")
            return False

        # Recalculate hash to verify it hasn't been tampered with
        recalculated_hash = self._calculate_hash()
        if recalculated_hash != self.entry_hash:
            logger.error(f"❌ Entry hash corrupted: expected {recalculated_hash}, got {self.entry_hash}")
            return False

        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        d = asdict(self)
        # Convert enum to string for JSON serialization
        d['category'] = self.category.value
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ExplorationLogEntry':
        """Create entry from dictionary"""
        # Convert category string back to enum
        if isinstance(data.get('category'), str):
            data['category'] = ExplorationCategory[data['category']]

        return cls(**data)

    def get_average_confidence(self) -> float:
        """
        Calculate average confidence from signals

        Returns:
            Average confidence (0.0-1.0) or 0.0 if no signals
        """
        if not self.confidence_signals:
            return 0.0

        return sum(self.confidence_signals) / len(self.confidence_signals)

    def has_pattern(self, pattern_name: str) -> bool:
        """
        Check if pattern was observed

        Args:
            pattern_name: Pattern to check for

        Returns:
            True if pattern was observed
        """
        return any(
            pattern_name.lower() in pattern.lower()
            for pattern in self.patterns_observed
        )


@dataclass
class ExplorationReport:
    """
    Aggregated exploration report for multiple entries

    Provides summary statistics and patterns across exploration cycle.
    """
    cluster_id: str
    template_id: str
    category: ExplorationCategory

    # Entries in this report
    entries: List[ExplorationLogEntry] = field(default_factory=list)

    # Aggregated outcomes
    total_observations: int = 0
    unique_patterns: List[str] = field(default_factory=list)
    average_confidence: float = 0.0
    entities_with_pattern: int = 0

    # Repeatability metrics
    pattern_frequency: Dict[str, int] = field(default_factory=dict)
    entity_coverage: float = 0.0  # % of entities with pattern

    def add_entry(self, entry: ExplorationLogEntry):
        """
        Add exploration entry to report

        Args:
            entry: ExplorationLogEntry to add
        """
        self.entries.append(entry)

        # Update aggregated metrics
        self.total_observations += len(entry.patterns_observed)

        # Update pattern frequency
        for pattern in entry.patterns_observed:
            if pattern not in self.pattern_frequency:
                self.pattern_frequency[pattern] = 0
                self.unique_patterns.append(pattern)
            self.pattern_frequency[pattern] += 1

        # Update average confidence
        if entry.confidence_signals:
            entry_avg = entry.get_average_confidence()
            if self.average_confidence == 0.0:
                self.average_confidence = entry_avg
            else:
                # Running average
                self.average_confidence = (
                    (self.average_confidence * (len(self.entries) - 1) + entry_avg) /
                    len(self.entries)
                )

        # Update entity coverage
        if entry.patterns_observed:
            self.entities_with_pattern += 1

        if self.entity_sample_size > 0:
            self.entity_coverage = self.entities_with_pattern / self.entity_sample_size

    @property
    def entity_sample_size(self) -> int:
        """Get size of entity sample"""
        if not self.entries:
            return 0

        # Use first entry's sample size (all entries should have same sample)
        return len(self.entries[0].entity_sample)

    def meets_promotion_threshold(self, min_observations: int = 5) -> bool:
        """
        Check if report meets promotion threshold

        Args:
            min_observations: Minimum observations for promotion (default: 5)

        Returns:
            True if meets threshold
        """
        return self.total_observations >= min_observations

    def meets_guard_threshold(self, min_observations: int = 3) -> bool:
        """
        Check if report meets guard threshold

        Args:
            min_observations: Minimum observations for guard promotion (default: 3)

        Returns:
            True if meets guard threshold
        """
        return self.total_observations >= min_observations

    def get_repeatable_patterns(self, min_entities: int = 3) -> List[str]:
        """
        Get patterns observed in multiple entities

        Args:
            min_entities: Minimum entities for pattern to be repeatable (default: 3)

        Returns:
            List of repeatable patterns
        """
        return [
            pattern
            for pattern, count in self.pattern_frequency.items()
            if count >= min_entities
        ]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "cluster_id": self.cluster_id,
            "template_id": self.template_id,
            "category": self.category.value,
            "total_entries": len(self.entries),
            "total_observations": self.total_observations,
            "unique_patterns": self.unique_patterns,
            "average_confidence": self.average_confidence,
            "entities_with_pattern": self.entities_with_pattern,
            "entity_sample_size": self.entity_sample_size,
            "entity_coverage": self.entity_coverage,
            "pattern_frequency": self.pattern_frequency,
            "repeatable_patterns": self.get_repeatable_patterns(),
            "meets_promotion_threshold": self.meets_promotion_threshold(),
            "meets_guard_threshold": self.meets_guard_threshold()
        }
