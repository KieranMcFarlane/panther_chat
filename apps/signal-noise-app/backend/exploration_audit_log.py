#!/usr/bin/env python3
"""
Exploration Audit Log - Immutable audit trail for bounded exploration

Provides append-only JSONL storage with hash chain verification:
- Logs every exploration iteration with full context
- Hash chain prevents tampering (each entry hashes previous entry)
- StoppingReason enum for exhaustive exit condition tracking
- Thread-safe append operations

Author: Claude Code
Date: 2026-01-30
"""

import logging
import json
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field, asdict
from pathlib import Path
from enum import Enum

logger = logging.getLogger(__name__)


# =============================================================================
# STOPPING REASON (EXHAUSTIVE)
# =============================================================================

class StoppingReason(Enum):
    """
    Exhaustive list of why exploration stopped

    IMPORTANT: If you add a new stopping condition, add it here!
    """
    # Budget exhaustion
    MAX_ITERATIONS_REACHED = "max_iterations_reached"
    COST_LIMIT_REACHED = "cost_limit_reached"
    TIME_LIMIT_REACHED = "time_limit_reached"

    # Early stopping (success)
    CONFIDENCE_THRESHOLD_MET = "confidence_threshold_met"
    EVIDENCE_COUNT_MET = "evidence_count_met"
    CONSECUTIVE_HIGH_CONFIDENCE = "consecutive_high_confidence"

    # Ralph Loop governance
    CATEGORY_SATURATED = "category_saturated"
    CONFIDENCE_SATURATED = "confidence_saturated"
    RALPH_LOOP_STOP = "ralph_loop_stop"
    RALPH_LOOP_LOCK_IN = "ralph_loop_lock_in"

    # Errors
    BRIGHTDATA_ERROR = "brightdata_error"
    CLAUDE_API_ERROR = "claude_api_error"
    RALPH_LOOP_ERROR = "ralph_loop_error"


# =============================================================================
# AUDIT LOG ENTRY
# =============================================================================

@dataclass
class BoundedExplorationLog:
    """
    Single exploration iteration log entry

    Attributes:
        entry_id: Unique UUID for this entry
        timestamp: ISO timestamp (UTC)

        # Entity context
        entity_id: Entity identifier
        entity_cluster: Entity cluster (if known)

        # Category context
        category: Category being explored
        category_iteration: Iteration number within category (1, 2, or 3)

        # Budget state (WHY decision was made)
        budget_remaining: Remaining budget in USD
        iterations_remaining: Remaining iterations in category
        time_remaining_seconds: Remaining time in seconds

        # Ralph Loop decision
        ralph_decision: Ralph decision (ACCEPT/WEAK_ACCEPT/REJECT)
        ralph_confidence: Confidence after Ralph decision
        ralph_rationale: Human-readable rationale

        # Evidence collected
        evidence_count: Number of evidence items collected
        evidence_sources: List of source URLs
        evidence_credibility: Average evidence credibility (0.0-1.0)

        # Outcome
        final_confidence: Final confidence score
        patterns_found: Patterns discovered
        stopped_reason: Why exploration stopped (StoppingReason enum)

        # Hash chain (immutability)
        previous_hash: Hash of previous entry (None for first entry)
        entry_hash: SHA-256 hash of this entry
    """
    entry_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    # Entity context
    entity_id: str = ""
    entity_cluster: Optional[str] = None

    # Category context
    category: str = ""
    category_iteration: int = 1

    # Budget state
    budget_remaining: float = 0.50
    iterations_remaining: int = 3
    time_remaining_seconds: int = 300

    # Ralph Loop decision
    ralph_decision: str = ""  # ACCEPT/WEAK_ACCEPT/REJECT
    ralph_confidence: float = 0.20
    ralph_rationale: str = ""

    # Evidence collected
    evidence_count: int = 0
    evidence_sources: List[str] = field(default_factory=list)
    evidence_credibility: float = 0.0

    # Outcome
    final_confidence: float = 0.20
    patterns_found: List[str] = field(default_factory=list)
    stopped_reason: str = ""

    # Hash chain
    previous_hash: Optional[str] = None
    entry_hash: str = ""

    def __post_init__(self):
        """Calculate entry hash after initialization"""
        if not self.entry_hash:
            self.entry_hash = self._calculate_hash()

    def _calculate_hash(self) -> str:
        """
        Calculate SHA-256 hash of this entry

        Hash includes all fields except entry_hash itself
        """
        # Get dict representation without entry_hash
        data_dict = asdict(self)
        data_dict.pop('entry_hash', None)

        # Serialize to JSON (sorted keys for determinism)
        json_str = json.dumps(data_dict, sort_keys=True)

        # Calculate SHA-256
        return hashlib.sha256(json_str.encode()).hexdigest()

    def verify_hash(self) -> bool:
        """
        Verify that entry_hash matches calculated hash

        Returns:
            True if hash is valid
        """
        calculated_hash = self._calculate_hash()
        return self.entry_hash == calculated_hash


# =============================================================================
# AUDIT LOG STORAGE
# =============================================================================

class ExplorationAuditLog:
    """
    Immutable append-only audit log for exploration

    Provides:
    - Thread-safe append operations
    - Hash chain verification (each entry references previous)
    - JSONL storage (one JSON object per line)
    - Tamper detection (verify hash chain)

    Usage:
        log = ExplorationAuditLog(log_file="data/exploration/audit-trail-2026-01.jsonl")

        # Append entry (automatically handles hash chain)
        await log.append(entry)

        # Verify integrity
        is_valid = log.verify_integrity()

        # Read entries
        entries = await log.read_all()
    """

    def __init__(self, log_file: str):
        """
        Initialize audit log

        Args:
            log_file: Path to JSONL log file
        """
        self.log_file = Path(log_file)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)

        # Track last hash for chain
        self._last_hash: Optional[str] = None

        logger.info(f"📝 ExplorationAuditLog initialized ({self.log_file})")

    async def append(self, entry: BoundedExplorationLog) -> bool:
        """
        Append entry to audit log

        Automatically:
        - Sets previous_hash to last entry's hash
        - Calculates entry_hash
        - Appends to JSONL file

        Args:
            entry: Entry to append

        Returns:
            True if append successful
        """
        try:
            # Set previous hash
            if self._last_hash is None:
                # Load last entry to get hash
                last_entry = await self._read_last_entry()
                if last_entry:
                    self._last_hash = last_entry.get('entry_hash')

            entry.previous_hash = self._last_hash

            # Recalculate entry hash with previous_hash set
            entry.entry_hash = entry._calculate_hash()

            # Serialize to JSON
            json_line = json.dumps(asdict(entry))

            # Append to file
            with open(self.log_file, 'a') as f:
                f.write(json_line + '\n')

            # Update last hash
            self._last_hash = entry.entry_hash

            logger.debug(f"📝 Appended entry {entry.entry_id} to audit log")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to append entry to audit log: {e}")
            return False

    async def read_all(self) -> List[Dict[str, Any]]:
        """
        Read all entries from audit log

        Returns:
            List of entry dicts
        """
        if not self.log_file.exists():
            return []

        entries = []

        with open(self.log_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entry = json.loads(line)
                        entries.append(entry)
                    except json.JSONDecodeError as e:
                        logger.warning(f"⚠️ Failed to parse audit log line: {e}")

        return entries

    async def _read_last_entry(self) -> Optional[Dict[str, Any]]:
        """
        Read last entry from audit log

        Returns:
            Last entry dict or None
        """
        if not self.log_file.exists():
            return None

        try:
            with open(self.log_file, 'r') as f:
                lines = f.readlines()

            if lines:
                last_line = lines[-1].strip()
                return json.loads(last_line)

        except Exception as e:
            logger.warning(f"⚠️ Failed to read last entry: {e}")

        return None

    def verify_integrity(self) -> bool:
        """
        Verify hash chain integrity

        Checks:
        - Each entry's hash matches its content
        - Each entry's previous_hash matches previous entry's hash

        Returns:
            True if hash chain is valid
        """
        if not self.log_file.exists():
            logger.debug("📝 Audit log does not exist, skipping verification")
            return True

        try:
            entries = []

            with open(self.log_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        entry = json.loads(line)
                        entries.append(entry)

            if not entries:
                logger.debug("📝 Audit log is empty, skipping verification")
                return True

            # Verify hash chain
            for i, entry in enumerate(entries):
                # Check 1: Entry hash is valid
                calculated_hash = BoundedExplorationLog(**entry)._calculate_hash()
                if entry['entry_hash'] != calculated_hash:
                    logger.error(f"❌ Hash mismatch at entry {i}: {entry['entry_id']}")
                    return False

                # Check 2: Previous hash matches (except first entry)
                if i > 0:
                    prev_entry = entries[i - 1]
                    if entry['previous_hash'] != prev_entry['entry_hash']:
                        logger.error(
                            f"❌ Hash chain broken at entry {i}: "
                            f"previous_hash {entry['previous_hash'][:8]} != "
                            f"prev entry_hash {prev_entry['entry_hash'][:8]}"
                        )
                        return False
                else:
                    # First entry should have no previous hash
                    if entry['previous_hash'] is not None:
                        logger.error(f"❌ First entry has non-None previous_hash")
                        return False

            logger.info(f"✅ Audit log integrity verified: {len(entries)} entries")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to verify audit log integrity: {e}")
            return False

    def get_summary(self) -> Dict[str, Any]:
        """
        Get audit log summary

        Returns:
            Dict with summary statistics
        """
        try:
            entries = []

            if self.log_file.exists():
                with open(self.log_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            entry = json.loads(line)
                            entries.append(entry)

            if not entries:
                return {
                    "total_entries": 0,
                    "entities": [],
                    "categories": [],
                    "stopping_reasons": {},
                    "file_size_bytes": 0
                }

            # Calculate statistics
            entities = set(e.get('entity_id') for e in entries)
            categories = set(e.get('category') for e in entries)
            stopping_reasons = {}

            for entry in entries:
                reason = entry.get('stopped_reason', 'unknown')
                stopping_reasons[reason] = stopping_reasons.get(reason, 0) + 1

            file_size = self.log_file.stat().st_size if self.log_file.exists() else 0

            return {
                "total_entries": len(entries),
                "entities": list(entities),
                "categories": list(categories),
                "stopping_reasons": stopping_reasons,
                "file_size_bytes": file_size,
                "file_size_mb": file_size / (1024 * 1024)
            }

        except Exception as e:
            logger.error(f"❌ Failed to get audit log summary: {e}")
            return {}


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

async def create_exploration_log(
    entity_id: str,
    category: str,
    category_iteration: int,
    budget_remaining: float,
    ralph_decision: str,
    ralph_confidence: float,
    final_confidence: float,
    stopped_reason: str,
    log_file: str = "data/exploration/audit-trail.jsonl",
    **kwargs
) -> bool:
    """
    Convenience function to create and log exploration entry

    Args:
        entity_id: Entity identifier
        category: Category being explored
        category_iteration: Iteration number
        budget_remaining: Remaining budget
        ralph_decision: Ralph decision
        ralph_confidence: Confidence after Ralph decision
        final_confidence: Final confidence
        stopped_reason: Why exploration stopped
        log_file: Audit log file path
        **kwargs: Additional fields for BoundedExplorationLog

    Returns:
        True if log entry created successfully
    """
    log = ExplorationAuditLog(log_file)

    entry = BoundedExplorationLog(
        entity_id=entity_id,
        category=category,
        category_iteration=category_iteration,
        budget_remaining=budget_remaining,
        ralph_decision=ralph_decision,
        ralph_confidence=ralph_confidence,
        final_confidence=final_confidence,
        stopped_reason=stopped_reason,
        **kwargs
    )

    return await log.append(entry)


if __name__ == "__main__":
    # Test audit log
    import asyncio

    async def test():
        log = ExplorationAuditLog("data/exploration/test-audit-trail.jsonl")

        # Create test entries
        entry1 = BoundedExplorationLog(
            entity_id="arsenal_fc",
            category="Digital Infrastructure",
            category_iteration=1,
            budget_remaining=0.45,
            ralph_decision="ACCEPT",
            ralph_confidence=0.82,
            final_confidence=0.82,
            patterns_found=["CRM Manager hiring"],
            stopped_reason="MAX_ITERATIONS_REACHED"
        )

        await log.append(entry1)

        entry2 = BoundedExplorationLog(
            entity_id="arsenal_fc",
            category="Commercial Systems",
            category_iteration=1,
            budget_remaining=0.40,
            ralph_decision="REJECT",
            ralph_confidence=0.82,
            final_confidence=0.82,
            patterns_found=[],
            stopped_reason="CATEGORY_SATURATED"
        )

        await log.append(entry2)

        # Verify integrity
        is_valid = log.verify_integrity()
        print(f"\nAudit log valid: {is_valid}")

        # Get summary
        summary = log.get_summary()
        print(f"\nAudit log summary:")
        print(json.dumps(summary, indent=2))

    asyncio.run(test())
