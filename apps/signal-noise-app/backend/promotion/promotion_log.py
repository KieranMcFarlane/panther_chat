"""
Promotion Log

Audit trail for all promotion decisions.

Provides complete traceability from exploration → promotion decision → template version.

Storage: data/promotion/promotion_log.jsonl (append-only JSONL)
"""

import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Literal
from uuid import uuid4

logger = logging.getLogger(__name__)


@dataclass
class PromotionLogEntry:
    """
    Promotion log entry (immutable audit record)

    Attributes:
        entry_id: Unique UUID
        timestamp: ISO timestamp
        cluster_id: Cluster involved
        template_id: Template involved

        # Exploration results
        exploration_report_id: Report identifier
        total_observations: Observation count
        average_confidence: Average confidence
        entities_with_pattern: Entity count

        # Promotion decision
        decision: PROMOTE | PROMOTE_WITH_GUARD | KEEP_EXPLORING
        decision_confidence: Confidence in decision
        decision_rationale: Explanation

        # Patterns
        promoted_patterns: Patterns promoted
        guard_patterns: Patterns promoted with guard
        rejected_patterns: Patterns rejected

        # Template version
        new_version_id: Version created (if promoted)
        parent_version_id: Parent version (if any)

        # Validation
        ralph_validation: Ralph Loop validation results (if any)
        validated_by: System or user who validated

        # Metadata
        metadata: Additional context
    """
    entry_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    cluster_id: str = ""
    template_id: str = ""

    # Exploration results
    exploration_report_id: str = ""
    total_observations: int = 0
    average_confidence: float = 0.0
    entities_with_pattern: int = 0

    # Promotion decision
    decision: Literal["PROMOTE", "PROMOTE_WITH_GUARD", "KEEP_EXPLORING"] = "KEEP_EXPLORING"
    decision_confidence: float = 0.0
    decision_rationale: str = ""

    # Patterns
    promoted_patterns: List[str] = field(default_factory=list)
    guard_patterns: List[str] = field(default_factory=list)
    rejected_patterns: List[str] = field(default_factory=list)

    # Template version
    new_version_id: Optional[str] = None
    parent_version_id: Optional[str] = None

    # Validation
    ralph_validation: Optional[Dict[str, Any]] = None
    validated_by: str = "system"

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PromotionLogEntry':
        """Create from dictionary"""
        return cls(**data)


class PromotionLog:
    """
    Promotion log (append-only audit trail)

    Provides complete traceability of promotion decisions.
    """

    def __init__(self, log_path: str = "data/promotion/promotion_log.jsonl"):
        """
        Initialize promotion log

        Args:
            log_path: Path to JSONL log file
        """
        self.log_path = Path(log_path)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

        # In-memory index
        self._entries: List[PromotionLogEntry] = []

        # Load existing log
        self._load_log()

        logger.info(f"📜 PromotionLog initialized ({len(self._entries)} entries)")

    def _load_log(self):
        """Load existing log from disk"""
        if not self.log_path.exists():
            logger.info("ℹ️ No existing promotion log, starting fresh")
            return

        try:
            with open(self.log_path, 'r') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        entry_data = json.loads(line)
                        entry = PromotionLogEntry.from_dict(entry_data)
                        self._entries.append(entry)

                    except Exception as e:
                        logger.error(f"❌ Error parsing line {line_num}: {e}")
                        continue

            logger.info(f"✅ Loaded {len(self._entries)} promotion log entries")

        except Exception as e:
            logger.error(f"❌ Error loading promotion log: {e}")
            self._entries = []

    def _save_log(self):
        """Save log to disk"""
        try:
            with open(self.log_path, 'w') as f:
                for entry in self._entries:
                    entry_json = json.dumps(entry.to_dict())
                    f.write(entry_json + '\n')

            logger.debug(f"💾 Saved {len(self._entries)} entries to promotion log")

        except Exception as e:
            logger.error(f"❌ Error saving promotion log: {e}")

    def append(self, entry: PromotionLogEntry) -> bool:
        """
        Append entry to log (append-only)

        Args:
            entry: PromotionLogEntry to append

        Returns:
            True if append successful
        """
        # Append to in-memory list
        self._entries.append(entry)

        # Persist to disk
        try:
            with open(self.log_path, 'a') as f:
                entry_json = json.dumps(entry.to_dict())
                f.write(entry_json + '\n')

            logger.info(f"✅ Appended promotion log entry: {entry.entry_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Error appending entry: {e}")
            return False

    def query(
        self,
        cluster_id: Optional[str] = None,
        template_id: Optional[str] = None,
        decision: Optional[str] = None,
        limit: int = 100
    ) -> List[PromotionLogEntry]:
        """
        Query promotion log entries

        Args:
            cluster_id: Filter by cluster
            template_id: Filter by template
            decision: Filter by decision (PROMOTE, etc.)
            limit: Maximum results

        Returns:
            List of matching entries
        """
        results = []

        for entry in reversed(self._entries):  # Most recent first
            # Apply filters
            if cluster_id and entry.cluster_id != cluster_id:
                continue

            if template_id and entry.template_id != template_id:
                continue

            if decision and entry.decision != decision:
                continue

            results.append(entry)

            if len(results) >= limit:
                break

        return results

    def get_promotion_history(
        self,
        template_id: str
    ) -> List[PromotionLogEntry]:
        """
        Get promotion history for template

        Args:
            template_id: Template ID

        Returns:
            List of promotion entries (chronological order)
        """
        entries = [
            e for e in self._entries
            if e.template_id == template_id
        ]

        # Sort by timestamp ascending
        entries.sort(key=lambda e: e.timestamp)

        return entries

    def get_stats(self) -> Dict[str, Any]:
        """
        Get promotion log statistics

        Returns:
            Dictionary with metrics
        """
        if not self._entries:
            return {
                "total_entries": 0,
                "promotions": 0,
                "guard_promotions": 0,
                "kept_exploring": 0
            }

        promotions = len([e for e in self._entries if e.decision == "PROMOTE"])
        guard_promotions = len([e for e in self._entries if e.decision == "PROMOTE_WITH_GUARD"])
        kept_exploring = len([e for e in self._entries if e.decision == "KEEP_EXPLORING"])

        return {
            "total_entries": len(self._entries),
            "promotions": promotions,
            "guard_promotions": guard_promotions,
            "kept_exploring": kept_exploring,
            "promotion_rate": f"{(promotions / len(self._entries) * 100):.1f}%"
        }


# =============================================================================
# Convenience Functions
# =============================================================================

def get_promotion_log(
    log_path: str = "data/promotion/promotion_log.jsonl"
) -> PromotionLog:
    """
    Get promotion log instance

    Args:
        log_path: Optional custom log path

    Returns:
        PromotionLog instance
    """
    return PromotionLog(log_path)


def log_promotion_decision(
    cluster_id: str,
    template_id: str,
    exploration_report_id: str,
    decision: Dict[str, Any],
    ralph_validation: Optional[Dict[str, Any]] = None
) -> PromotionLogEntry:
    """
    Convenience function to log promotion decision

    Args:
        cluster_id: Cluster involved
        template_id: Template involved
        exploration_report_id: Report identifier
        decision: Promotion decision from PromotionEngine
        ralph_validation: Optional Ralph Loop validation

    Returns:
        PromotionLogEntry
    """
    log = get_promotion_log()

    entry = PromotionLogEntry(
        cluster_id=cluster_id,
        template_id=template_id,
        exploration_report_id=exploration_report_id,
        decision=decision.get("action", "KEEP_EXPLORING"),
        decision_confidence=decision.get("confidence", 0.0),
        decision_rationale=decision.get("rationale", ""),
        promoted_patterns=decision.get("promoted_patterns", []),
        guard_patterns=decision.get("guard_patterns", []),
        rejected_patterns=decision.get("rejected_patterns", []),
        ralph_validation=ralph_validation,
        metadata=decision.get("metadata", {})
    )

    log.append(entry)

    return entry
