#!/usr/bin/env python3
"""
Expected Information Gain (EIG) Calculator

Calculates EIG for hypothesis prioritization in Ralph Loop.

EIG Formula:
    EIG(h) = (1 - confidence_h) × novelty_h × information_value_h

Where:
    - confidence_h: Current hypothesis confidence (0.0-1.0)
    - novelty_h: Pattern novelty score (0.0-1.0, from cluster dampening)
    - information_value_h: Category value multiplier (e.g., C-suite = 1.5, general = 1.0)

Key Design Principles:
- Higher EIG = higher priority for next hop
- Uncertainty bonus (lower confidence = higher EIG)
- Novelty decay (cluster dampening prevents over-counting)
- Information value (category weights reflect business importance)

Usage:
    from backend.eig_calculator import EIGCalculator
    from backend.hypothesis_manager import HypothesisManager

    manager = HypothesisManager()
    hypotheses = await manager.initialize_hypotheses(template_id, entity_id, entity_name)

    calculator = EIGCalculator()
    for h in hypotheses:
        h.expected_information_gain = calculator.calculate_eig(h, cluster_state)

    # Get top hypothesis
    top_h = max(hypotheses, key=lambda h: h.expected_information_gain)
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


# =============================================================================
# Category Value Multipliers
# =============================================================================

# Information value multipliers by category
# Higher values indicate more business-relevant categories
CATEGORY_VALUE_MULTIPLIERS = {
    # C-suite / Executive (highest value)
    "C-Suite Hiring": 1.5,
    "Executive Change": 1.5,
    "Strategic Hire": 1.4,

    # Digital Infrastructure (high value)
    "Digital Transformation": 1.3,
    "AI Platform": 1.3,
    "Data Analytics": 1.2,
    "CRM Implementation": 1.2,

    # Commercial (medium-high value)
    "Fan Engagement": 1.1,
    "Ticketing System": 1.1,
    "E-commerce": 1.1,

    # Operational (medium value)
    "Operations": 1.0,
    "Infrastructure": 1.0,
    "IT Modernization": 1.0,

    # General (baseline value)
    "General": 1.0,
    "Other": 0.9
}


# =============================================================================
# Cluster State for Dampening
# =============================================================================

@dataclass
class ClusterState:
    """
    Cluster-level state for pattern frequency tracking

    Tracks pattern frequencies across entities in a cluster to enable:
    - Novelty decay (frequently seen patterns get lower scores)
    - Cluster dampening (prevent over-counting)
    - Cross-entity learning

    Attributes:
        cluster_id: Cluster identifier (e.g., "tier_1_clubs", "league_offices")
        pattern_frequencies: Dict mapping pattern -> frequency count
        last_updated: Timestamp of last update
    """
    cluster_id: str
    pattern_frequencies: Dict[str, int] = None
    last_updated: str = None

    def __post_init__(self):
        if self.pattern_frequencies is None:
            self.pattern_frequencies = {}

    def get_pattern_frequency(self, pattern: str) -> int:
        """Get frequency count for pattern"""
        return self.pattern_frequencies.get(pattern, 0)

    def increment_pattern(self, pattern: str):
        """Increment pattern frequency"""
        self.pattern_frequencies[pattern] = self.pattern_frequencies.get(pattern, 0) + 1

    def get_frequencies(self, category: str = None) -> Dict[str, int]:
        """
        Get pattern frequencies

        Args:
            category: Optional category filter

        Returns:
            Dict of pattern -> frequency
        """
        if category:
            # Filter by category (pattern contains category)
            return {
                p: freq for p, freq in self.pattern_frequencies.items()
                if category.lower() in p.lower()
            }
        return self.pattern_frequencies


# =============================================================================
# EIG Calculator
# =============================================================================

class EIGCalculator:
    """
    Expected Information Gain calculator for hypothesis prioritization

    Calculates EIG scores for hypotheses based on:
    1. Uncertainty (1 - confidence)
    2. Novelty (cluster dampening)
    3. Information value (category weights)
    """

    def __init__(self, category_multipliers: Dict[str, float] = None, repository=None):
        """
        Initialize EIG calculator

        Args:
            category_multipliers: Optional custom category value multipliers
            repository: Optional HypothesisRepository for cluster state persistence
        """
        self.category_multipliers = category_multipliers or CATEGORY_VALUE_MULTIPLIERS
        self._repository = repository
        self._cluster_states_cache: Dict[str, ClusterState] = {}

        # Lazy load repository if not provided
        if not self._repository:
            try:
                from backend.hypothesis_persistence_native import HypothesisRepository
                self._repository = HypothesisRepository()
                logger.info("🧮 Using native FalkorDB repository for EIG calculator")
            except ImportError:
                logger.info("🧮 No repository for EIG calculator (in-memory mode)")

        logger.info("🧮 EIGCalculator initialized")

    def calculate_eig(
        self,
        hypothesis,
        cluster_state: ClusterState = None
    ) -> float:
        """
        Calculate Expected Information Gain for hypothesis

        EIG(h) = (1 - confidence_h) × novelty_h × information_value_h

        Args:
            hypothesis: Hypothesis object
            cluster_state: Optional ClusterState for novelty dampening

        Returns:
            EIG score (0.0 to ~2.0)
        """
        # 1. Uncertainty bonus (lower confidence = higher EIG)
        uncertainty = 1.0 - hypothesis.confidence

        # 2. Novelty decay (cluster dampening)
        novelty = self._calculate_novelty(hypothesis, cluster_state)

        # 3. Information value (category weight)
        information_value = self._get_information_value(hypothesis.category)

        # Calculate EIG
        eig = uncertainty * novelty * information_value

        logger.debug(
            f"🧮 EIG for {hypothesis.hypothesis_id}: "
            f"{eig:.3f} = "
            f"{uncertainty:.2f} (uncertainty) × "
            f"{novelty:.2f} (novelty) × "
            f"{information_value:.2f} (info_value)"
        )

        return eig

    def calculate_eig_batch(
        self,
        hypotheses: List,
        cluster_state: ClusterState = None
    ) -> Dict[str, float]:
        """
        Calculate EIG for multiple hypotheses

        Args:
            hypotheses: List of Hypothesis objects
            cluster_state: Optional ClusterState for novelty dampening

        Returns:
            Dict mapping hypothesis_id -> EIG score
        """
        eig_scores = {}

        for h in hypotheses:
            eig_scores[h.hypothesis_id] = self.calculate_eig(h, cluster_state)

        return eig_scores

    def _calculate_novelty(
        self,
        hypothesis,
        cluster_state: ClusterState = None
    ) -> float:
        """
        Calculate novelty score with cluster dampening

        Novelty formula: 1 / (1 + frequency)

        Decay function:
        - Pattern seen 0 times → novelty = 1.0
        - Pattern seen 1 time → novelty = 0.5
        - Pattern seen 2 times → novelty = 0.33
        - Pattern seen 3+ times → novelty = 0.1-0.2 (diminishing returns)

        Args:
            hypothesis: Hypothesis object
            cluster_state: Optional ClusterState for pattern frequencies

        Returns:
            Novelty score (0.0 to 1.0)
        """
        if not cluster_state:
            # No cluster state, assume maximum novelty
            return 1.0

        # Get pattern frequencies for this hypothesis category
        pattern_frequencies = cluster_state.get_frequencies(hypothesis.category)

        if not pattern_frequencies:
            # No patterns seen yet, maximum novelty
            return 1.0

        # Sum all frequencies in category
        total_frequency = sum(pattern_frequencies.values())

        # Calculate novelty with decay function
        novelty = 1.0 / (1.0 + total_frequency)

        return novelty

    def _get_information_value(self, category: str) -> float:
        """
        Get information value multiplier for category

        Args:
            category: Category name

        Returns:
            Information value multiplier (0.5 to 1.5)
        """
        # Direct match
        if category in self.category_multipliers:
            return self.category_multipliers[category]

        # Partial match (contains category name)
        for known_category, multiplier in self.category_multipliers.items():
            if known_category.lower() in category.lower():
                return multiplier

        # Default to baseline
        return 1.0

    def update_cluster_state(
        self,
        cluster_state: ClusterState,
        hypotheses: List
    ):
        """
        Update cluster state with pattern frequencies from hypotheses

        Args:
            cluster_state: ClusterState to update
            hypotheses: List of Hypothesis objects to add to cluster
        """
        for h in hypotheses:
            # Increment pattern frequency for this hypothesis
            pattern_name = h.metadata.get('pattern_name', h.category)
            cluster_state.increment_pattern(pattern_name)

        logger.debug(
            f"🧮 Updated cluster state {cluster_state.cluster_id} "
            f"with {len(hypotheses)} hypotheses"
        )

        # Persist to repository if available
        if self._repository:
            import asyncio

            async def persist_patterns():
                for pattern, freq in cluster_state.pattern_frequencies.items():
                    await self._repository.update_cluster_pattern_frequency(
                        cluster_state.cluster_id,
                        pattern,
                        freq
                    )

            # Run async persistence
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # If running in async context, create task
                    asyncio.create_task(persist_patterns())
                else:
                    # If not in async context, run directly
                    asyncio.run(persist_patterns())
            except Exception as e:
                logger.warning(f"⚠️ Could not persist cluster state: {e}")

    async def get_cluster_state(
        self,
        cluster_id: str
    ) -> ClusterState:
        """
        Get or create cluster state from repository

        Args:
            cluster_id: Cluster identifier

        Returns:
            ClusterState with pattern frequencies
        """
        # Check cache first
        if cluster_id in self._cluster_states_cache:
            return self._cluster_states_cache[cluster_id]

        # Load from repository
        if self._repository:
            frequencies = await self._repository.get_cluster_pattern_frequencies(cluster_id)

            cluster_state = ClusterState(
                cluster_id=cluster_id,
                pattern_frequencies=frequencies,
                last_updated=datetime.now().isoformat()
            )

            # Cache it
            self._cluster_states_cache[cluster_id] = cluster_state

            return cluster_state

        # Return empty state if no repository
        return ClusterState(cluster_id=cluster_id)


# =============================================================================
# Convenience Functions
# =============================================================================

def calculate_eig_for_hypotheses(
    hypotheses: List,
    cluster_state: ClusterState = None,
    category_multipliers: Dict[str, float] = None
) -> Dict[str, float]:
    """
    Convenience function to calculate EIG for multiple hypotheses

    Args:
        hypotheses: List of Hypothesis objects
        cluster_state: Optional ClusterState for novelty dampening
        category_multipliers: Optional custom category multipliers

    Returns:
        Dict mapping hypothesis_id -> EIG score
    """
    calculator = EIGCalculator(category_multipliers)
    return calculator.calculate_eig_batch(hypotheses, cluster_state)


def rank_hypotheses_by_eig(
    hypotheses: List,
    cluster_state: ClusterState = None
) -> List:
    """
    Rank hypotheses by EIG score (descending)

    Args:
        hypotheses: List of Hypothesis objects
        cluster_state: Optional ClusterState for novelty dampening

    Returns:
        List of Hypothesis objects sorted by EIG (highest first)
    """
    # Calculate EIG for all hypotheses
    calculator = EIGCalculator()

    for h in hypotheses:
        h.expected_information_gain = calculator.calculate_eig(h, cluster_state)

    # Sort by EIG (descending)
    ranked = sorted(hypotheses, key=lambda h: h.expected_information_gain, reverse=True)

    return ranked


if __name__ == "__main__":
    # Test EIG Calculator
    import asyncio
    from datetime import datetime, timezone
    from backend.hypothesis_manager import Hypothesis

    async def test():
        print("=== Testing EIGCalculator ===")

        # Create test hypotheses
        h1 = Hypothesis(
            hypothesis_id="h1_crm_procurement",
            entity_id="arsenal-fc",
            category="CRM Implementation",
            statement="Arsenal FC is preparing CRM procurement",
            prior_probability=0.5,
            confidence=0.42  # Low confidence → high uncertainty
        )

        h2 = Hypothesis(
            hypothesis_id="h2_digital_transform",
            entity_id="arsenal-fc",
            category="Digital Transformation",
            statement="Arsenal FC is undergoing digital transformation",
            prior_probability=0.5,
            confidence=0.85  # High confidence → low uncertainty
        )

        h3 = Hypothesis(
            hypothesis_id="h3_c_suite_hire",
            entity_id="arsenal-fc",
            category="C-Suite Hiring",
            statement="Arsenal FC is hiring CTO",
            prior_probability=0.5,
            confidence=0.50  # Medium confidence, high information value
        )

        # Calculate EIG without cluster state
        calculator = EIGCalculator()

        print("\n--- EIG Scores (No Cluster Dampening) ---")
        for h in [h1, h2, h3]:
            eig = calculator.calculate_eig(h)
            print(f"{h.hypothesis_id}:")
            print(f"  Confidence: {h.confidence:.2f}")
            print(f"  Category: {h.category}")
            print(f"  EIG: {eig:.3f}")

        # Create cluster state with pattern frequencies
        cluster_state = ClusterState(
            cluster_id="tier_1_clubs",
            pattern_frequencies={
                "Strategic Hire": 5,      # Seen 5 times → low novelty
                "C-Suite Hiring": 1,     # Seen 1 time → medium novelty
                "Digital Transformation": 0  # Never seen → high novelty
            }
        )

        print("\n--- EIG Scores (With Cluster Dampening) ---")
        for h in [h1, h2, h3]:
            eig = calculator.calculate_eig(h, cluster_state)
            novelty = calculator._calculate_novelty(h, cluster_state)
            print(f"{h.hypothesis_id}:")
            print(f"  Confidence: {h.confidence:.2f}")
            print(f"  Novelty: {novelty:.2f}")
            print(f"  EIG: {eig:.3f}")

        # Rank hypotheses
        print("\n--- Ranked Hypotheses ---")
        ranked = rank_hypotheses_by_eig([h1, h2, h3], cluster_state)

        for i, h in enumerate(ranked, 1):
            print(f"{i}. {h.hypothesis_id}: EIG = {h.expected_information_gain:.3f}")

        print("\n✅ EIGCalculator test complete")

    asyncio.run(test())
