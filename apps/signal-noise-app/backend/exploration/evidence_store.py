"""
Evidence Store

Immutable append-only storage for exploration log entries.

Core principle: Write-once, read-many. Never mutate existing entries.
Hash chain ensures tamper detection.

Storage format: JSONL (one JSON object per line)
File location: data/exploration/evidence_logs.jsonl
"""

import json
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime

from backend.exploration.exploration_log import ExplorationLogEntry

logger = logging.getLogger(__name__)


class EvidenceStore:
    """
    Immutable append-only evidence store

    Provides:
    - Append-only writes (no mutations)
    - Hash chain verification
    - Sequential access by entry ID
    - Query by cluster/template/category
    """

    def __init__(self, store_path: str = "data/exploration/evidence_logs.jsonl"):
        """
        Initialize evidence store

        Args:
            store_path: Path to JSONL store file
        """
        self.store_path = Path(store_path)
        self.store_path.parent.mkdir(parents=True, exist_ok=True)

        # In-memory index for fast lookups
        self._index: Dict[str, ExplorationLogEntry] = {}
        self._hash_chain: List[str] = []

        # Load existing entries
        self._load_entries()

        logger.info(f"💾 EvidenceStore initialized ({len(self._index)} entries)")

    def _load_entries(self):
        """Load existing entries from disk"""
        if not self.store_path.exists():
            logger.info("ℹ️ No existing evidence store, starting fresh")
            return

        try:
            with open(self.store_path, 'r') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        entry_data = json.loads(line)
                        entry = ExplorationLogEntry.from_dict(entry_data)

                        # Verify hash chain
                        if self._hash_chain:
                            previous_hash = self._hash_chain[-1]
                            if not entry.verify_hash_chain(previous_hash):
                                logger.warning(
                                    f"⚠️ Hash chain broken at line {line_num}, "
                                    f"entry {entry.entry_id}"
                                )
                                continue

                        # Add to index
                        self._index[entry.entry_id] = entry
                        self._hash_chain.append(entry.entry_hash)

                    except Exception as e:
                        logger.error(f"❌ Error parsing line {line_num}: {e}")
                        continue

            logger.info(f"✅ Loaded {len(self._index)} entries from evidence store")

        except Exception as e:
            logger.error(f"❌ Error loading evidence store: {e}")
            self._index = {}
            self._hash_chain = []

    def append(self, entry: ExplorationLogEntry) -> bool:
        """
        Append entry to store (write-once operation)

        Args:
            entry: ExplorationLogEntry to append

        Returns:
            True if append successful
        """
        # Check if entry already exists
        if entry.entry_id in self._index:
            logger.warning(f"⚠️ Entry {entry.entry_id} already exists, skipping")
            return False

        # Set previous hash
        if self._hash_chain:
            entry.previous_hash = self._hash_chain[-1]
            entry.entry_hash = entry._calculate_hash()

        # Append to file
        try:
            with open(self.store_path, 'a') as f:
                entry_json = json.dumps(entry.to_dict())
                f.write(entry_json + '\n')

            # Add to index
            self._index[entry.entry_id] = entry
            self._hash_chain.append(entry.entry_hash)

            logger.info(f"✅ Appended entry {entry.entry_id} to evidence store")
            return True

        except Exception as e:
            logger.error(f"❌ Error appending entry: {e}")
            return False

    def get(self, entry_id: str) -> Optional[ExplorationLogEntry]:
        """
        Get entry by ID

        Args:
            entry_id: Entry UUID

        Returns:
            ExplorationLogEntry if found, None otherwise
        """
        return self._index.get(entry_id)

    def query(
        self,
        cluster_id: Optional[str] = None,
        template_id: Optional[str] = None,
        category: Optional[str] = None,
        entity_id: Optional[str] = None,
        limit: int = 100
    ) -> List[ExplorationLogEntry]:
        """
        Query entries by filters

        Args:
            cluster_id: Filter by cluster ID
            template_id: Filter by template ID
            category: Filter by category (enum value string)
            entity_id: Filter by entity in entity_sample
            limit: Maximum results to return

        Returns:
            List of matching entries
        """
        results = []

        for entry in self._index.values():
            # Apply filters
            if cluster_id and entry.cluster_id != cluster_id:
                continue

            if template_id and entry.template_id != template_id:
                continue

            if category and entry.category.value != category:
                continue

            if entity_id and entity_id not in entry.entity_sample:
                continue

            results.append(entry)

            if len(results) >= limit:
                break

        return results

    def get_latest_entries(self, limit: int = 10) -> List[ExplorationLogEntry]:
        """
        Get latest entries (most recent first)

        Args:
            limit: Maximum entries to return

        Returns:
            List of latest entries
        """
        # Sort by timestamp descending
        sorted_entries = sorted(
            self._index.values(),
            key=lambda e: e.timestamp,
            reverse=True
        )

        return sorted_entries[:limit]

    def verify_integrity(self) -> Dict[str, Any]:
        """
        Verify hash chain integrity

        Returns:
            Dictionary with integrity check results
        """
        total_entries = len(self._hash_chain)
        broken_chains = 0

        for i, entry in enumerate(self._index.values()):
            if i == 0:
                # First entry has no previous hash
                continue

            previous_hash = self._hash_chain[i - 1]
            if not entry.verify_hash_chain(previous_hash):
                broken_chains += 1

        return {
            "total_entries": total_entries,
            "hash_chain_length": len(self._hash_chain),
            "broken_chains": broken_chains,
            "integrity_verified": broken_chains == 0
        }

    def get_stats(self) -> Dict[str, Any]:
        """
        Get evidence store statistics

        Returns:
            Dictionary with store metrics
        """
        # Count by category
        category_counts = {}
        for entry in self._index.values():
            cat = entry.category.value
            category_counts[cat] = category_counts.get(cat, 0) + 1

        # Count by cluster
        cluster_counts = {}
        for entry in self._index.values():
            cluster = entry.cluster_id
            cluster_counts[cluster] = cluster_counts.get(cluster, 0) + 1

        return {
            "total_entries": len(self._index),
            "unique_clusters": len(cluster_counts),
            "categories": category_counts,
            "clusters": cluster_counts,
            "hash_chain_length": len(self._hash_chain)
        }


# =============================================================================
# Convenience Functions
# =============================================================================

def get_evidence_store(
    store_path: str = "data/exploration/evidence_logs.jsonl"
) -> EvidenceStore:
    """
    Get evidence store instance

    Args:
        store_path: Optional custom store path

    Returns:
        EvidenceStore instance
    """
    return EvidenceStore(store_path)
