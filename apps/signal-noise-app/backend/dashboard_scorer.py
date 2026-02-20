#!/usr/bin/env python3
"""
Three-Axis Dashboard Scoring System (Phase 4)

Calculates three composite scores for each entity:
1. Procurement Maturity Score (0-100): Digital capability assessment
2. Active Procurement Probability (6-month): Temporal + EIG based forecasting
3. Sales Readiness Level: Combined maturity + probability for go/no-go decisions

Usage:
    from backend.dashboard_scorer import DashboardScorer, ScoringConfig

    scorer = DashboardScorer()
    scores = await scorer.calculate_entity_scores(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        hypotheses=[...],
        signals=[...],
        episodes=[...]
    )

    print(f"Maturity: {scores['procurement_maturity']}/100")
    print(f"Active Probability: {scores['active_probability']*100:.1f}%")
    print(f"Sales Readiness: {scores['sales_readiness']}")
"""

import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


# =============================================================================
# Sales Readiness Levels
# =============================================================================

class SalesReadiness(str, Enum):
    """Sales readiness classification"""
    NOT_READY = "NOT_READY"          # < 40 maturity, < 20% probability
    MONITOR = "MONITOR"              # 40-60 maturity, 20-40% probability
    ENGAGE = "ENGAGE"                # 60-80 maturity, 40-70% probability
    HIGH_PRIORITY = "HIGH_PRIORITY"  # > 80 maturity, > 70% probability
    LIVE = "LIVE"                    # Validated RFP detected


# =============================================================================
# Scoring Configuration
# =============================================================================

@dataclass
class ScoringConfig:
    """
    Configuration for three-axis dashboard scoring

    Weights for Procurement Maturity Score:
    - capability_signals: Job postings, tech adoption (0-40 pts)
    - digital_initiatives: Transformations, modernizations (0-30 pts)
    - partnership_activity: Partnerships, integrations (0-20 pts)
    - executive_changes: C-level hires (0-10 pts)

    Weights for Active Procurement Probability:
    - validated_rfp_bonus: +40% if RFP validated
    - procurement_density: Signals per month (0-30%)
    - temporal_recency: Recent activity bonus (0-20%)
    - eig_confidence: Overall EIG confidence (0-10%)
    """
    # Maturity weights
    capability_weight: float = 0.40
    initiative_weight: float = 0.30
    partnership_weight: float = 0.20
    executive_weight: float = 0.10

    # Probability weights
    rfp_bonus: float = 0.40
    density_weight: float = 0.30
    recency_weight: float = 0.20
    confidence_weight: float = 0.10

    # Thresholds
    maturity_low_threshold: float = 40.0
    maturity_high_threshold: float = 80.0
    probability_low_threshold: float = 0.20
    probability_high_threshold: float = 0.70

    # Temporal windows
    recent_window_days: int = 90
    density_window_days: int = 180


# =============================================================================
# Dashboard Scorer
# =============================================================================

class DashboardScorer:
    """
    Three-Axis Dashboard Scoring System

    Calculates:
    1. Procurement Maturity Score (0-100): Digital capability maturity
    2. Active Procurement Probability (0-1): 6-month procurement likelihood
    3. Sales Readiness Level: Qualitative classification
    """

    def __init__(self, config: ScoringConfig = None):
        """
        Initialize dashboard scorer

        Args:
            config: Optional scoring configuration
        """
        self.config = config or ScoringConfig()
        logger.info("📊 DashboardScorer initialized")

    async def calculate_entity_scores(
        self,
        entity_id: str,
        entity_name: str,
        hypotheses: Optional[List[Any]] = None,
        signals: Optional[List[Dict[str, Any]]] = None,
        episodes: Optional[List[Dict[str, Any]]] = None,
        validated_rfps: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Calculate three-axis scores for an entity

        Args:
            entity_id: Entity identifier
            entity_name: Entity display name
            hypotheses: Optional list of Hypothesis objects
            signals: Optional list of signal dictionaries
            episodes: Optional list of temporal episodes
            validated_rfps: Optional list of validated RFPs

        Returns:
            Dictionary with maturity, probability, and readiness scores
        """
        logger.info(f"📊 Scoring {entity_name} ({entity_id})")

        # Calculate Procurement Maturity Score
        maturity_score = await self._calculate_maturity_score(
            signals, episodes, hypotheses
        )

        # Calculate Active Procurement Probability
        active_probability = await self._calculate_active_probability(
            hypotheses, signals, episodes, validated_rfps
        )

        # Determine Sales Readiness Level
        sales_readiness = self._determine_sales_readiness(
            maturity_score, active_probability, validated_rfps
        )

        # Calculate confidence intervals
        confidence_interval = self._calculate_confidence_interval(
            maturity_score, active_probability, hypotheses
        )

        result = {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "procurement_maturity": round(maturity_score, 1),
            "active_probability": round(active_probability, 3),
            "sales_readiness": sales_readiness.value,
            "confidence_interval": confidence_interval,
            "breakdown": {
                "maturity": await self._get_maturity_breakdown(signals, episodes),
                "probability": await self._get_probability_breakdown(
                    hypotheses, signals, episodes, validated_rfps
                )
            },
            "calculated_at": datetime.now(timezone.utc).isoformat()
        }

        logger.info(
            f"📊 {entity_name}: Maturity={maturity_score:.1f}, "
            f"Probability={active_probability*100:.1f}%, "
            f"Readiness={sales_readiness.value}"
        )

        return result

    async def _calculate_maturity_score(
        self,
        signals: Optional[List[Dict[str, Any]]] = None,
        episodes: Optional[List[Dict[str, Any]]] = None,
        hypotheses: Optional[List[Any]] = None
    ) -> float:
        """
        Calculate Procurement Maturity Score (0-100)

        Based on:
        - Capability signals (40%): Job postings, tech adoption
        - Digital initiatives (30%): Transformations, modernizations
        - Partnership activity (20%): Partnerships, integrations
        - Executive changes (10%): C-level hires
        """
        if hypotheses:
            # Use hypothesis-based scoring
            return await self._maturity_from_hypotheses(hypotheses)

        # Fallback to signal/episode based scoring
        capability_score = await self._score_capability_signals(signals, episodes)
        initiative_score = await self._score_digital_initiatives(signals, episodes)
        partnership_score = await self._score_partnership_activity(signals, episodes)
        executive_score = await self._score_executive_changes(signals, episodes)

        # Weighted sum
        maturity = (
            capability_score * self.config.capability_weight +
            initiative_score * self.config.initiative_weight +
            partnership_score * self.config.partnership_weight +
            executive_score * self.config.executive_weight
        )

        return min(100.0, max(0.0, maturity))

    async def _maturity_from_hypotheses(self, hypotheses: List[Any]) -> float:
        """
        Calculate maturity from hypothesis confidence scores

        Higher average confidence = higher maturity
        """
        if not hypotheses:
            return 25.0  # Baseline for unknown

        # Get active hypotheses with confidence scores
        active_hyps = [h for h in hypotheses if h.status == "ACTIVE"]

        if not active_hyps:
            return 25.0

        # Calculate weighted average confidence
        total_confidence = sum(h.confidence for h in active_hyps)
        avg_confidence = total_confidence / len(active_hyps)

        # Scale to 0-100 (0.5 baseline = 50 points)
        maturity = avg_confidence * 100

        return min(100.0, max(0.0, maturity))

    async def _score_capability_signals(
        self,
        signals: Optional[List[Dict[str, Any]]] = None,
        episodes: Optional[List[Dict[str, Any]]] = None
    ) -> float:
        """Score capability signals (0-40 points)"""
        if not signals and not episodes:
            return 10.0  # Baseline

        # Count capability-related items
        capability_count = 0

        if signals:
            for signal in signals:
                signal_type = signal.get("type", "").upper()
                if "CRM" in signal_type or "ANALYTICS" in signal_type or "DIGITAL" in signal_type:
                    capability_count += 1

        if episodes:
            for episode in episodes:
                ep_type = episode.get("episode_type", "").upper()
                if "TECHNOLOGY" in ep_type or "CRM" in ep_type:
                    capability_count += 1

        # Cap at 10 capability signals for full points
        score = min(40.0, capability_count * 4.0)

        return max(10.0, score)

    async def _score_digital_initiatives(
        self,
        signals: Optional[List[Dict[str, Any]]] = None,
        episodes: Optional[List[Dict[str, Any]]] = None
    ) -> float:
        """Score digital initiatives (0-30 points)"""
        if not signals and not episodes:
            return 5.0

        initiative_count = 0

        if signals:
            for signal in signals:
                if "transformation" in signal.get("description", "").lower():
                    initiative_count += 1

        if episodes:
            for episode in episodes:
                if "DIGITAL_TRANSFORMATION" in episode.get("episode_type", ""):
                    initiative_count += 1

        score = min(30.0, initiative_count * 10.0)

        return max(5.0, score)

    async def _score_partnership_activity(
        self,
        signals: Optional[List[Dict[str, Any]]] = None,
        episodes: Optional[List[Dict[str, Any]]] = None
    ) -> float:
        """Score partnership activity (0-20 points)"""
        if not signals and not episodes:
            return 2.5

        partnership_count = 0

        if episodes:
            for episode in episodes:
                if "PARTNERSHIP" in episode.get("episode_type", ""):
                    partnership_count += 1

        score = min(20.0, partnership_count * 5.0)

        return max(2.5, score)

    async def _score_executive_changes(
        self,
        signals: Optional[List[Dict[str, Any]]] = None,
        episodes: Optional[List[Dict[str, Any]]] = None
    ) -> float:
        """Score executive changes (0-10 points)"""
        if not signals and not episodes:
            return 2.5

        executive_count = 0

        if episodes:
            for episode in episodes:
                if "C_SUITE" in episode.get("episode_type", "") or "HIRING" in episode.get("episode_type", ""):
                    executive_count += 1

        score = min(10.0, executive_count * 3.0)

        return max(2.5, score)

    async def _calculate_active_probability(
        self,
        hypotheses: Optional[List[Any]] = None,
        signals: Optional[List[Dict[str, Any]]] = None,
        episodes: Optional[List[Dict[str, Any]]] = None,
        validated_rfps: Optional[List[Dict[str, Any]]] = None
    ) -> float:
        """
        Calculate Active Procurement Probability (6-month)

        Based on:
        - Validated RFP bonus (+40%)
        - Procurement density (0-30%)
        - Temporal recency (0-20%)
        - EIG confidence (0-10%)
        """
        probability = 0.10  # Baseline 10%

        # 1. Validated RFP bonus
        if validated_rfps and len(validated_rfps) > 0:
            probability += self.config.rfp_bonus

        # 2. Procurement density
        density = await self._calculate_procurement_density(signals, episodes)
        probability += density * self.config.density_weight

        # 3. Temporal recency
        recency = await self._calculate_recency_bonus(signals, episodes)
        probability += recency * self.config.recency_weight

        # 4. EIG confidence
        if hypotheses:
            eig_conf = await self._calculate_eig_confidence(hypotheses)
            probability += eig_conf * self.config.confidence_weight

        return min(0.95, max(0.05, probability))

    async def _calculate_procurement_density(
        self,
        signals: Optional[List[Dict[str, Any]]] = None,
        episodes: Optional[List[Dict[str, Any]]] = None
    ) -> float:
        """Calculate procurement signal density (0-1)"""
        if not signals and not episodes:
            return 0.0

        now = datetime.now(timezone.utc)
        window_start = now - timedelta(days=self.config.density_window_days)

        count = 0

        if episodes:
            for episode in episodes:
                timestamp_str = episode.get("timestamp", "")
                try:
                    if timestamp_str.endswith("Z"):
                        timestamp_str = timestamp_str[:-1] + "+00:00"
                    timestamp = datetime.fromisoformat(timestamp_str)

                    if timestamp >= window_start:
                        ep_type = episode.get("episode_type", "").upper()
                        if "RFP" in ep_type or "PROCUREMENT" in ep_type:
                            count += 1
                except:
                    pass

        # Normalize: 3+ signals in 6 months = max density
        return min(1.0, count / 3.0)

    async def _calculate_recency_bonus(
        self,
        signals: Optional[List[Dict[str, Any]]] = None,
        episodes: Optional[List[Dict[str, Any]]] = None
    ) -> float:
        """Calculate recency bonus (0-1)"""
        if not signals and not episodes:
            return 0.0

        now = datetime.now(timezone.utc)
        window_start = now - timedelta(days=self.config.recent_window_days)

        # Find most recent signal
        most_recent_days = float('inf')

        if episodes:
            for episode in episodes:
                timestamp_str = episode.get("timestamp", "")
                try:
                    if timestamp_str.endswith("Z"):
                        timestamp_str = timestamp_str[:-1] + "+00:00"
                    timestamp = datetime.fromisoformat(timestamp_str)

                    age_days = (now - timestamp).total_seconds() / 86400
                    if age_days < most_recent_days:
                        most_recent_days = age_days
                except:
                    pass

        if most_recent_days == float('inf'):
            return 0.0

        # Exponential decay: recent = 1.0, 90 days = ~0.26
        recency = math.exp(-0.015 * most_recent_days)

        return recency

    async def _calculate_eig_confidence(self, hypotheses: List[Any]) -> float:
        """Calculate EIG-based confidence score (0-1)"""
        if not hypotheses:
            return 0.0

        # Get average confidence from active hypotheses
        active_hyps = [h for h in hypotheses if h.status == "ACTIVE"]

        if not active_hyps:
            return 0.0

        # Average confidence above 0.5 baseline contributes
        avg_confidence = sum(h.confidence for h in active_hyps) / len(active_hyps)

        # Scale: 0.5 = 0, 1.0 = 1
        return max(0.0, (avg_confidence - 0.5) * 2.0)

    def _determine_sales_readiness(
        self,
        maturity_score: float,
        active_probability: float,
        validated_rfps: Optional[List[Dict[str, Any]]] = None
    ) -> SalesReadiness:
        """
        Determine Sales Readiness Level

        Rules:
        - LIVE: Validated RFP detected (any maturity)
        - HIGH_PRIORITY: > 80 maturity AND > 70% probability
        - ENGAGE: > 60 maturity AND > 40% probability
        - MONITOR: > 40 maturity OR > 20% probability
        - NOT_READY: Everything else
        """
        # LIVE takes precedence
        if validated_rfps and len(validated_rfps) > 0:
            return SalesReadiness.LIVE

        # Check thresholds
        if (maturity_score >= self.config.maturity_high_threshold and
            active_probability >= self.config.probability_high_threshold):
            return SalesReadiness.HIGH_PRIORITY

        if (maturity_score >= 60.0 and active_probability >= 0.40):
            return SalesReadiness.ENGAGE

        if (maturity_score >= self.config.maturity_low_threshold or
            active_probability >= self.config.probability_low_threshold):
            return SalesReadiness.MONITOR

        return SalesReadiness.NOT_READY

    def _calculate_confidence_interval(
        self,
        maturity_score: float,
        active_probability: float,
        hypotheses: Optional[List[Any]] = None
    ) -> Dict[str, float]:
        """
        Calculate confidence intervals for scores

        Uses bootstrap-style estimation based on data availability
        """
        # Simple estimation based on data availability
        sample_size = 1
        if hypotheses:
            sample_size += len(hypotheses)

        # Confidence improves with sample size
        confidence = min(0.95, 0.5 + (sample_size * 0.05))

        # Margin of error (simplified)
        moe = (1 - confidence) * 10

        return {
            "confidence_level": round(confidence, 2),
            "maturity_range": [
                round(max(0, maturity_score - moe), 1),
                round(min(100, maturity_score + moe), 1)
            ],
            "probability_range": [
                round(max(0, active_probability - moe/100), 3),
                round(min(1, active_probability + moe/100), 3)
            ]
        }

    async def _get_maturity_breakdown(
        self,
        signals: Optional[List[Dict[str, Any]]] = None,
        episodes: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, float]:
        """Get detailed maturity score breakdown"""
        capability = await self._score_capability_signals(signals, episodes)
        initiative = await self._score_digital_initiatives(signals, episodes)
        partnership = await self._score_partnership_activity(signals, episodes)
        executive = await self._score_executive_changes(signals, episodes)

        # Convert to percentage contributions
        total = max(1.0, capability + initiative + partnership + executive)

        return {
            "capability": round(capability / total * 100, 1),
            "initiative": round(initiative / total * 100, 1),
            "partnership": round(partnership / total * 100, 1),
            "executive": round(executive / total * 100, 1),
            "raw_scores": {
                "capability": round(capability, 1),
                "initiative": round(initiative, 1),
                "partnership": round(partnership, 1),
                "executive": round(executive, 1)
            }
        }

    async def _get_probability_breakdown(
        self,
        hypotheses: Optional[List[Any]] = None,
        signals: Optional[List[Dict[str, Any]]] = None,
        episodes: Optional[List[Dict[str, Any]]] = None,
        validated_rfps: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Get detailed probability score breakdown"""
        rfp_bonus = self.config.rfp_bonus if (validated_rfps and len(validated_rfps) > 0) else 0.0
        density = await self._calculate_procurement_density(signals, episodes)
        recency = await self._calculate_recency_bonus(signals, episodes)
        eig_conf = 0.0

        if hypotheses:
            eig_conf = await self._calculate_eig_confidence(hypotheses)

        return {
            "rfp_bonus_contribution": round(rfp_bonus, 3),
            "density_contribution": round(density * self.config.density_weight, 3),
            "recency_contribution": round(recency * self.config.recency_weight, 3),
            "eig_confidence_contribution": round(eig_conf * self.config.confidence_weight, 3),
            "components": {
                "has_validated_rfp": len(validated_rfps) > 0 if validated_rfps else False,
                "procurement_density": round(density, 2),
                "recency_score": round(recency, 2),
                "eig_confidence": round(eig_conf, 2)
            }
        }


# =============================================================================
# Batch Scoring
# =============================================================================

async def score_entities_batch(
    entities: List[Dict[str, Any]],
    hypotheses_map: Dict[str, List[Any]] = None,
    signals_map: Dict[str, List[Dict[str, Any]]] = None,
    episodes_map: Dict[str, List[Dict[str, Any]]] = None,
    config: ScoringConfig = None
) -> List[Dict[str, Any]]:
    """
    Score multiple entities in batch

    Args:
        entities: List of entity dicts with entity_id and entity_name
        hypotheses_map: Optional map of entity_id -> hypotheses
        signals_map: Optional map of entity_id -> signals
        episodes_map: Optional map of entity_id -> episodes
        config: Optional scoring configuration

    Returns:
        List of scored entities
    """
    scorer = DashboardScorer(config)

    results = []

    for entity in entities:
        entity_id = entity.get("entity_id")
        entity_name = entity.get("entity_name", entity_id)

        scores = await scorer.calculate_entity_scores(
            entity_id=entity_id,
            entity_name=entity_name,
            hypotheses=hypotheses_map.get(entity_id) if hypotheses_map else None,
            signals=signals_map.get(entity_id) if signals_map else None,
            episodes=episodes_map.get(entity_id) if episodes_map else None
        )

        results.append(scores)

    return results


# =============================================================================
# CLI for testing
# =============================================================================

async def main():
    """Test dashboard scoring"""
    import asyncio
    from datetime import datetime, timezone, timedelta

    logging.basicConfig(level=logging.INFO)

    scorer = DashboardScorer()

    # Test with Arsenal FC
    entity_id = "arsenal-fc"

    # Create mock hypotheses
    from hypothesis_manager import Hypothesis

    now = datetime.now(timezone.utc)

    hypotheses = [
        Hypothesis(
            hypothesis_id="dt_procurement",
            entity_id=entity_id,
            category="Digital Transformation",
            statement="Arsenal FC is preparing digital transformation procurement",
            prior_probability=0.5,
            confidence=0.65,
            last_updated=now - timedelta(days=7),
            status="ACTIVE"
        ),
        Hypothesis(
            hypothesis_id="crm_upgrade",
            entity_id=entity_id,
            category="CRM Implementation",
            statement="Arsenal FC is considering CRM upgrade",
            prior_probability=0.5,
            confidence=0.45,
            last_updated=now - timedelta(days=30),
            status="ACTIVE"
        )
    ]

    # Create mock episodes
    episodes = [
        {
            "episode_id": "ep1",
            "entity_id": entity_id,
            "episode_type": "DIGITAL_TRANSFORMATION",
            "description": "Digital transformation initiative announced",
            "timestamp": (now - timedelta(days=14)).isoformat(),
            "confidence_score": 0.8
        },
        {
            "episode_id": "ep2",
            "entity_id": entity_id,
            "episode_type": "C_SUITE_HIRING",
            "description": "New CTO hired",
            "timestamp": (now - timedelta(days=30)).isoformat(),
            "confidence_score": 0.9
        },
        {
            "episode_id": "ep3",
            "entity_id": entity_id,
            "episode_type": "PARTNERSHIP",
            "description": "Partnership with tech vendor",
            "timestamp": (now - timedelta(days=60)).isoformat(),
            "confidence_score": 0.7
        }
    ]

    scores = await scorer.calculate_entity_scores(
        entity_id=entity_id,
        entity_name="Arsenal FC",
        hypotheses=hypotheses,
        episodes=episodes
    )

    print("\n=== THREE-AXIS DASHBOARD SCORES ===")
    print(f"Entity: {scores['entity_name']}")
    print(f"\n1. Procurement Maturity: {scores['procurement_maturity']}/100")
    print(f"   Breakdown: {scores['breakdown']['maturity']}")
    print(f"\n2. Active Probability: {scores['active_probability']*100:.1f}%")
    print(f"   Breakdown: {scores['breakdown']['probability']}")
    print(f"\n3. Sales Readiness: {scores['sales_readiness']}")
    print(f"\nConfidence Interval: {scores['confidence_interval']}")


if __name__ == "__main__":
    asyncio.run(main())
