#!/usr/bin/env python3
"""
Hypothesis Manager

First-class hypothesis objects with lifecycle management for Ralph Loop.

Implements explicit hypothesis tracking with:
- Lifecycle states: ACTIVE, PROMOTED, DEGRADED, SATURATED, KILLED
- Per-hypothesis state tracking (iterations, confidence, reinforcement counts)
- FalkorDB storage for persistence
- Template-based hypothesis initialization

Key Design Principles:
- Hypotheses are explicit objects (not implicit in patterns)
- Each hypothesis has its own confidence and state
- Lifecycle transitions are deterministic
- All state changes are auditable

Usage:
    from hypothesis_manager import HypothesisManager

    manager = HypothesisManager()
    hypotheses = await manager.initialize_hypotheses(
        template_id="tier_1_club_centralized_procurement",
        entity_id="arsenal-fc"
    )

    # Update hypothesis after iteration
    await manager.update_hypothesis(
        hypothesis_id="digital_transformation_procurement",
        decision="ACCEPT",
        confidence_delta=0.06
    )

    # Get top hypothesis by EIG
    top_h = await manager.get_top_hypothesis_by_eig(entity_id="arsenal-fc")
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from enum import Enum

logger = logging.getLogger(__name__)


# Import Phase 5 components
try:
    from backend.hypothesis_cache import HypothesisLRUCache, CacheConfig
    CACHE_AVAILABLE = True
except ImportError:
    CACHE_AVAILABLE = False
    logger.warning("Phase 5 cache not available, using basic in-memory cache only")
    # Create a dummy CacheConfig for type hints
    CacheConfig = None


# =============================================================================
# Hypothesis Lifecycle States
# =============================================================================

class HypothesisStatus(str, Enum):
    """Hypothesis lifecycle states"""
    ACTIVE = "ACTIVE"           # Normal hypothesis, under active investigation
    PROMOTED = "PROMOTED"       # Strong evidence (confidence >= 0.70, >=2 ACCEPTs)
    DEGRADED = "DEGRADED"       # Contradicted (confidence < 0.30, >=2 REJECTs)
    SATURATED = "SATURATED"     # No new information expected (>=5 NO_PROGRESS in last 7 iterations)
    KILLED = "KILLED"           # Explicitly falsified (REJECT + contradictory evidence)


# =============================================================================
# Enhanced Hypothesis Schema
# =============================================================================

@dataclass
class Hypothesis:
    """
    First-class hypothesis object with full lifecycle tracking

    A hypothesis represents a testable claim about an entity's procurement readiness.

    Attributes:
        hypothesis_id: Unique identifier (e.g., "digital_transformation_procurement")
        entity_id: Entity being investigated
        category: Category (e.g., "Digital Infrastructure")
        statement: Testable claim (e.g., "Entity is preparing CRM procurement")
        prior_probability: Initial belief strength (0.0-1.0)

        # State tracking
        iterations_attempted: Total iterations attempted
        iterations_accepted: ACCEPT decisions
        iterations_weak_accept: WEAK_ACCEPT decisions
        iterations_rejected: REJECT decisions
        iterations_no_progress: NO_PROGRESS decisions
        last_updated: Timestamp of last update

        # Confidence tracking
        confidence: Current confidence score (0.0-1.0)
        reinforced_count: Times reinforced by ACCEPT decisions
        weakened_count: Times weakened by REJECT decisions
        last_delta: Most recent confidence change

        # Lifecycle
        status: Current lifecycle state
        created_at: Timestamp when hypothesis was created
        promoted_at: Timestamp when promoted (if applicable)
        degraded_at: Timestamp when degraded (if applicable)
        saturated_at: Timestamp when saturated (if applicable)
        killed_at: Timestamp when killed (if applicable)

        # EIG tracking
        expected_information_gain: EIG score (calculated dynamically)

        # Metadata
        metadata: Additional data (e.g., discovered URLs, patterns)
    """
    hypothesis_id: str
    entity_id: str
    category: str
    statement: str
    prior_probability: float

    # State tracking
    iterations_attempted: int = 0
    iterations_accepted: int = 0
    iterations_weak_accept: int = 0
    iterations_rejected: int = 0
    iterations_no_progress: int = 0
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # Confidence tracking
    confidence: float = 0.5
    reinforced_count: int = 0
    weakened_count: int = 0
    last_delta: float = 0.0

    # Lifecycle
    status: str = "ACTIVE"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    promoted_at: Optional[datetime] = None
    degraded_at: Optional[datetime] = None
    saturated_at: Optional[datetime] = None
    killed_at: Optional[datetime] = None

    # EIG tracking
    expected_information_gain: float = 0.0

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'hypothesis_id': self.hypothesis_id,
            'entity_id': self.entity_id,
            'category': self.category,
            'statement': self.statement,
            'prior_probability': self.prior_probability,

            # State tracking
            'iterations_attempted': self.iterations_attempted,
            'iterations_accepted': self.iterations_accepted,
            'iterations_weak_accept': self.iterations_weak_accept,
            'iterations_rejected': self.iterations_rejected,
            'iterations_no_progress': self.iterations_no_progress,
            'last_updated': self.last_updated.isoformat(),

            # Confidence tracking
            'confidence': self.confidence,
            'reinforced_count': self.reinforced_count,
            'weakened_count': self.weakened_count,
            'last_delta': self.last_delta,

            # Lifecycle
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'promoted_at': self.promoted_at.isoformat() if self.promoted_at else None,
            'degraded_at': self.degraded_at.isoformat() if self.degraded_at else None,
            'saturated_at': self.saturated_at.isoformat() if self.saturated_at else None,
            'killed_at': self.killed_at.isoformat() if self.killed_at else None,

            # EIG tracking
            'expected_information_gain': self.expected_information_gain,

            # Metadata
            'metadata': self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Hypothesis':
        """Create Hypothesis from dictionary"""
        # Handle datetime fields
        for field_name in ['created_at', 'last_updated', 'promoted_at', 'degraded_at', 'saturated_at', 'killed_at']:
            if data.get(field_name) and isinstance(data[field_name], str):
                data[field_name] = datetime.fromisoformat(data[field_name].replace('Z', '+00:00'))

        return cls(**data)


# =============================================================================
# Hypothesis Manager
# =============================================================================

class HypothesisManager:
    """
    Manages hypothesis lifecycle and persistence

    Responsibilities:
    - Initialize hypotheses from templates
    - Track hypothesis state changes
    - Determine lifecycle transitions
    - Persist hypotheses to FalkorDB
    - Retrieve top hypotheses by EIG
    """

    def __init__(self, falkordb_client=None, repository=None, cache_enabled: bool = True, cache_config: CacheConfig = None):
        """
        Initialize HypothesisManager

        Args:
            falkordb_client: Optional FalkorDB client (deprecated, use repository)
            repository: Optional HypothesisRepository (creates default if not provided)
            cache_enabled: Enable Phase 5 LRU cache (default: True)
            cache_config: Optional CacheConfig for LRU cache
        """
        self.falkordb_client = falkordb_client  # Deprecated
        self._repository = repository
        self._hypotheses_cache: Dict[str, List[Hypothesis]] = {}

        # Initialize Phase 5 LRU cache
        self.lru_cache = None
        if cache_enabled and CACHE_AVAILABLE:
            self.lru_cache = HypothesisLRUCache(cache_config or CacheConfig())
            logger.info("🔬 Phase 5 LRU cache enabled")
        elif cache_enabled and not CACHE_AVAILABLE:
            logger.warning("⚠️ Cache requested but Phase 5 components not available")
        else:
            logger.info("🔬 Phase 5 LRU cache disabled")

        # Lazy load repository (try native first, then neo4j-based)
        if not self._repository:
            try:
                from hypothesis_persistence_native import HypothesisRepository
                self._repository = HypothesisRepository()
                logger.info("🔬 Using native FalkorDB repository")
            except ImportError:
                try:
                    from backend.hypothesis_persistence import HypothesisRepository
                    self._repository = HypothesisRepository()
                    logger.info("🔬 Using neo4j-based FalkorDB repository")
                except ImportError:
                    logger.warning("⚠️ HypothesisRepository not available, persistence disabled")

        logger.info("🔬 HypothesisManager initialized")

    async def initialize_hypotheses(
        self,
        template_id: str,
        entity_id: str,
        entity_name: str
    ) -> List[Hypothesis]:
        """
        Initialize hypotheses from template

        Creates hypothesis objects from template signal patterns.

        Args:
            template_id: Template to create hypotheses from
            entity_id: Entity being investigated
            entity_name: Human-readable entity name

        Returns:
            List of initialized Hypothesis objects
        """
        from backend.template_loader import TemplateLoader

        logger.info(f"🔬 Initializing hypotheses for {entity_name} from {template_id}")

        # Load template
        loader = TemplateLoader()
        template = loader.get_template(template_id)

        if not template:
            logger.error(f"Template not found: {template_id}")
            return []

        # Create hypotheses from signal patterns
        hypotheses = []

        signal_patterns = template.get('signal_patterns', [])
        if not signal_patterns:
            logger.error(f"Template has no signal_patterns: {template_id}")
            return []

        for pattern in signal_patterns:
            pattern_name = pattern.get('pattern_name', 'Unknown')

            # Generate hypothesis ID
            hypothesis_id = f"{entity_id}_{pattern_name.lower().replace(' ', '_')}"

            # Create hypothesis
            hypothesis = Hypothesis(
                hypothesis_id=hypothesis_id,
                entity_id=entity_id,
                category=pattern.get('category', 'General'),
                statement=self._generate_statement(entity_name, pattern_name),
                prior_probability=pattern.get('weight', 0.5),
                confidence=pattern.get('weight', 0.5),
                metadata={
                    'pattern_name': pattern_name,
                    'template_id': template_id,
                    'entity_name': entity_name,
                    'early_indicators': pattern.get('early_indicators', []),
                    'keywords': pattern.get('keywords', []),
                    'category': pattern.get('category', 'General')
                }
            )

            hypotheses.append(hypothesis)

        # Cache hypotheses
        self._hypotheses_cache[entity_id] = hypotheses

        # Persist to FalkorDB
        if self._repository:
            # Initialize repository if needed
            if hasattr(self._repository, 'driver') and self._repository.driver is None:
                await self._repository.initialize()

            # Save all hypotheses
            for h in hypotheses:
                await self._repository.save_hypothesis(h)

        logger.info(f"✅ Initialized {len(hypotheses)} hypotheses for {entity_name}")

        return hypotheses

    async def update_hypothesis(
        self,
        hypothesis_id: str,
        entity_id: str,
        decision: str,
        confidence_delta: float,
        evidence_ref: str = None
    ) -> Hypothesis:
        """
        Update hypothesis state after iteration

        Updates confidence, iteration counts, and determines lifecycle transitions.

        Args:
            hypothesis_id: Hypothesis to update
            entity_id: Entity being investigated
            decision: RalphDecisionType (ACCEPT, WEAK_ACCEPT, REJECT, NO_PROGRESS)
            confidence_delta: Confidence change to apply
            evidence_ref: Reference to evidence (URL, document ID, etc.)

        Returns:
            Updated Hypothesis object
        """
        # Get hypothesis
        hypothesis = await self.get_hypothesis(hypothesis_id, entity_id)

        if not hypothesis:
            logger.error(f"Hypothesis not found: {hypothesis_id}")
            return None

        # Update iteration counts
        hypothesis.iterations_attempted += 1

        if decision == "ACCEPT":
            hypothesis.iterations_accepted += 1
            hypothesis.reinforced_count += 1
        elif decision == "WEAK_ACCEPT":
            hypothesis.iterations_weak_accept += 1
        elif decision == "REJECT":
            hypothesis.iterations_rejected += 1
            hypothesis.weakened_count += 1
        elif decision == "NO_PROGRESS":
            hypothesis.iterations_no_progress += 1

        # Update confidence
        old_confidence = hypothesis.confidence
        hypothesis.confidence = max(0.0, min(1.0, hypothesis.confidence + confidence_delta))
        hypothesis.last_delta = hypothesis.confidence - old_confidence
        hypothesis.last_updated = datetime.now(timezone.utc)

        # Determine lifecycle transition
        new_status = self._determine_lifecycle_status(hypothesis)

        if new_status != hypothesis.status:
            hypothesis.status = new_status

            # Update status timestamps
            now = datetime.now(timezone.utc)
            if new_status == "PROMOTED":
                hypothesis.promoted_at = now
                logger.info(f"✅ Hypothesis promoted: {hypothesis_id}")
            elif new_status == "DEGRADED":
                hypothesis.degraded_at = now
                logger.warning(f"⚠️ Hypothesis degraded: {hypothesis_id}")
            elif new_status == "SATURATED":
                hypothesis.saturated_at = now
                logger.info(f"🔄 Hypothesis saturated: {hypothesis_id}")
            elif new_status == "KILLED":
                hypothesis.killed_at = now
                logger.error(f"❌ Hypothesis killed: {hypothesis_id}")

        # Update cache
        if entity_id in self._hypotheses_cache:
            for i, h in enumerate(self._hypotheses_cache[entity_id]):
                if h.hypothesis_id == hypothesis_id:
                    self._hypotheses_cache[entity_id][i] = hypothesis
                    break

        # Persist to FalkorDB
        if self._repository:
            await self._repository.save_hypothesis(hypothesis)

            # Invalidate Phase 5 LRU cache entry (will be refreshed on next get)
            if self.lru_cache:
                await self.lru_cache.invalidate(hypothesis_id)
                logger.debug(f"🗑️ Invalidated cache entry: {hypothesis_id}")

        logger.debug(
            f"🔬 Updated hypothesis {hypothesis_id}: "
            f"{decision} (+{confidence_delta:.2f}) → {hypothesis.confidence:.2f} [{hypothesis.status}]"
        )

        return hypothesis

    async def get_hypothesis(
        self,
        hypothesis_id: str,
        entity_id: str
    ) -> Optional[Hypothesis]:
        """
        Get hypothesis by ID with Phase 5 LRU cache layer

        Args:
            hypothesis_id: Hypothesis identifier
            entity_id: Entity identifier

        Returns:
            Hypothesis object or None
        """
        # Check Phase 5 LRU cache first (fastest)
        if self.lru_cache:
            cached = await self.lru_cache.get(hypothesis_id)
            if cached:
                logger.debug(f"✅ LRU cache hit: {hypothesis_id}")
                return Hypothesis(**cached)

        # Check in-memory cache (legacy)
        if entity_id in self._hypotheses_cache:
            for h in self._hypotheses_cache[entity_id]:
                if h.hypothesis_id == hypothesis_id:
                    # Update LRU cache
                    if self.lru_cache:
                        await self.lru_cache.set(hypothesis_id, asdict(h))
                    logger.debug(f"✅ In-memory cache hit: {hypothesis_id}")
                    return h

        # Load from FalkorDB (slowest)
        if self._repository:
            # Initialize repository if needed
            if hasattr(self._repository, 'driver') and self._repository.driver is None:
                await self._repository.initialize()

            hypothesis = await self._repository.get_hypothesis(hypothesis_id)
            if hypothesis:
                # Update both caches
                if self.lru_cache:
                    await self.lru_cache.set(hypothesis_id, asdict(hypothesis))
                logger.debug(f"📥 Loaded from repository: {hypothesis_id}")
                return hypothesis

        logger.debug(f"❌ Hypothesis not found: {hypothesis_id}")
        return None

    async def get_hypotheses(self, entity_id: str) -> List[Hypothesis]:
        """
        Get all hypotheses for entity

        Args:
            entity_id: Entity identifier

        Returns:
            List of Hypothesis objects
        """
        # Check cache first
        if entity_id in self._hypotheses_cache:
            return self._hypotheses_cache[entity_id]

        # Load from FalkorDB
        if self._repository:
            # Initialize repository if needed
            if hasattr(self._repository, 'driver') and self._repository.driver is None:
                await self._repository.initialize()

            hypotheses = await self._repository.get_hypotheses_for_entity(entity_id)
            if hypotheses:
                self._hypotheses_cache[entity_id] = hypotheses
                return hypotheses

        return []

    async def get_top_hypothesis_by_eig(
        self,
        entity_id: str,
        status_filter: List[str] = None
    ) -> Optional[Hypothesis]:
        """
        Get top hypothesis by Expected Information Gain

        Args:
            entity_id: Entity identifier
            status_filter: Optional list of statuses to filter (default: ["ACTIVE"])

        Returns:
            Hypothesis with highest EIG or None
        """
        if status_filter is None:
            status_filter = ["ACTIVE"]

        # Get hypotheses
        hypotheses = await self.get_hypotheses(entity_id)

        # Filter by status
        filtered = [h for h in hypotheses if h.status in status_filter]

        if not filtered:
            return None

        # Sort by EIG (descending)
        sorted_hypotheses = sorted(
            filtered,
            key=lambda h: h.expected_information_gain,
            reverse=True
        )

        return sorted_hypotheses[0]

    def _generate_statement(self, entity_name: str, pattern_name: str) -> str:
        """
        Generate hypothesis statement from pattern name

        Example:
            entity_name="Arsenal FC", pattern_name="Strategic Hire"
            → "Arsenal FC is preparing procurement related to Strategic Hire"

        Args:
            entity_name: Entity name
            pattern_name: Pattern name

        Returns:
            Hypothesis statement
        """
        return f"{entity_name} is preparing procurement related to {pattern_name}"

    def _determine_lifecycle_status(self, hypothesis: Hypothesis) -> str:
        """
        Determine hypothesis lifecycle status based on current state

        Transition rules:
        - PROMOTED: confidence >= 0.70 AND iterations_accepted >= 2
        - DEGRADED: confidence < 0.30 AND iterations_rejected >= 2
        - SATURATED: iterations_no_progress >= 5 in last 7 iterations
        - KILLED: iterations_rejected >= 2 AND contradictory_evidence exists
        - ACTIVE: default state

        Args:
            hypothesis: Hypothesis to evaluate

        Returns:
            New lifecycle status
        """
        current_status = hypothesis.status

        # Killed hypotheses stay killed
        if current_status == "KILLED":
            return "KILLED"

        # Check for PROMOTED
        if (hypothesis.confidence >= 0.70 and
            hypothesis.iterations_accepted >= 2 and
            current_status not in ["SATURATED", "KILLED"]):
            return "PROMOTED"

        # Check for DEGRADED
        if (hypothesis.confidence < 0.30 and
            hypothesis.iterations_rejected >= 2 and
            current_status not in ["SATURATED", "KILLED"]):
            return "DEGRADED"

        # Check for SATURATED
        # Require more NO_PROGRESS decisions before saturation (prevents early stopping)
        # Updated from 3/5 to 5/7 based on validation feedback
        recent_iterations = hypothesis.iterations_attempted
        if recent_iterations >= 7 and hypothesis.iterations_no_progress >= 5:
            return "SATURATED"

        # Check for KILLED (REJECT + contradictory evidence)
        if (hypothesis.iterations_rejected >= 2 and
            hypothesis.metadata.get('contradictory_evidence') and
            current_status not in ["SATURATED"]):
            return "KILLED"

        # Default to ACTIVE
        return "ACTIVE"

    # =========================================================================
    # Phase 5 Cache Management Methods
    # =========================================================================

    def get_cache_statistics(self):
        """
        Get Phase 5 LRU cache performance statistics

        Returns:
            CacheStatistics object or None if cache disabled
        """
        if self.lru_cache:
            return self.lru_cache.get_statistics()
        return None

    async def clear_cache(self) -> None:
        """Clear Phase 5 LRU cache"""
        if self.lru_cache:
            await self.lru_cache.clear()
            logger.info("🗑️ LRU cache cleared")

    async def warm_cache(self, limit: int = 100) -> Dict[str, int]:
        """
        Warm cache with recent entities using Phase 5 CacheWarmer

        Args:
            limit: Maximum number of entities to warm

        Returns:
            Dict with warming results
        """
        if not self.lru_cache or not self._repository:
            logger.warning("⚠️ Cache warming not available")
            return {}

        try:
            from cache_warmer import CacheWarmer

            warmer = CacheWarmer(self.lru_cache, self._repository)
            results = await warmer.warm_all_strategies(
                recent_limit=limit,
                cluster_limit=limit // 2,
                template_limit=10
            )

            logger.info(f"🔥 Cache warming completed: {sum(results.values())} hypotheses")
            return results

        except ImportError:
            logger.warning("⚠️ CacheWarmer not available")
            return {}

    async def invalidate_cache_entry(self, hypothesis_id: str) -> bool:
        """
        Invalidate a specific cache entry

        Args:
            hypothesis_id: Hypothesis ID to invalidate

        Returns:
            True if entry was invalidated, False if not found
        """
        if self.lru_cache:
            return await self.lru_cache.invalidate(hypothesis_id)
        return False


# =============================================================================
# Convenience Functions
# =============================================================================

async def initialize_hypotheses_for_entity(
    template_id: str,
    entity_id: str,
    entity_name: str,
    falkordb_client=None
) -> List[Hypothesis]:
    """
    Convenience function to initialize hypotheses for an entity

    Args:
        template_id: Template to create hypotheses from
        entity_id: Entity being investigated
        entity_name: Human-readable entity name
        falkordb_client: Optional FalkorDB client

    Returns:
        List of initialized Hypothesis objects
    """
    manager = HypothesisManager(falkordb_client)
    return await manager.initialize_hypotheses(
        template_id=template_id,
        entity_id=entity_id,
        entity_name=entity_name
    )


if __name__ == "__main__":
    # Test HypothesisManager
    import asyncio

    async def test():
        print("=== Testing HypothesisManager ===")

        # Create manager
        manager = HypothesisManager()

        # Initialize hypotheses
        hypotheses = await manager.initialize_hypotheses(
            template_id="tier_1_club_centralized_procurement",
            entity_id="arsenal-fc",
            entity_name="Arsenal FC"
        )

        print(f"\nInitialized {len(hypotheses)} hypotheses:")
        for h in hypotheses:
            print(f"  - {h.hypothesis_id}: {h.statement}")
            print(f"    Confidence: {h.confidence:.2f}, Status: {h.status}")

        # Update first hypothesis
        if hypotheses:
            first_h = hypotheses[0]
            print(f"\nUpdating hypothesis: {first_h.hypothesis_id}")

            updated = await manager.update_hypothesis(
                hypothesis_id=first_h.hypothesis_id,
                entity_id="arsenal-fc",
                decision="ACCEPT",
                confidence_delta=0.06,
                evidence_ref="annual_report_2023"
            )

            print(f"  Old confidence: {first_h.confidence - updated.last_delta:.2f}")
            print(f"  New confidence: {updated.confidence:.2f}")
            print(f"  Delta: {updated.last_delta:+.2f}")
            print(f"  Status: {updated.status}")

        print("\n✅ HypothesisManager test complete")

    asyncio.run(test())
