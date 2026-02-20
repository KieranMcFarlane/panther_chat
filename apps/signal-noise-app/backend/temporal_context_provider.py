#!/usr/bin/env python3
"""
Temporal Context Provider

Provides temporal narratives and context from Graphiti for multi-pass discovery.

This module bridges the gap between discovery passes by:
1. Building temporal narratives from episodes
2. Calculating temporal fit scores for hypotheses
3. Providing inter-pass context with recent changes
4. Analyzing temporal patterns for timing insights

Usage:
    from backend.temporal_context_provider import TemporalContextProvider

    provider = TemporalContextProvider()
    context = await provider.get_inter_pass_context(
        entity_id="arsenal-fc",
        from_pass=1,
        to_pass=2
    )
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class TemporalContext:
    """Temporal context for an entity"""
    entity_id: str
    from_time: str
    to_time: str

    # Narrative
    narrative: str
    narrative_summary: str

    # Temporal patterns
    temporal_patterns: Dict[str, Any]

    # Recent changes
    recent_changes: Dict[str, Any]

    # Focus areas for next pass
    focus_areas: List[str]

    # Metadata
    episodes_used: int = 0
    confidence_boost: float = 0.0


@dataclass
class TemporalFitScore:
    """Fit score for hypothesis based on temporal patterns"""
    entity_id: str
    hypothesis_id: str
    hypothesis_category: str

    # Fit analysis
    fit_score: float  # 0.0-1.0
    confidence: float  # 0.0-1.0

    # Supporting evidence
    matching_episodes: int
    total_episodes: int
    timing_alignment: float

    # Recommendations
    recommended_action: str
    timing_recommendation: str


class TemporalContextProvider:
    """
    Provides temporal context from Graphiti for multi-pass discovery

    Responsibilities:
    - Build temporal narratives from episodes
    - Calculate temporal fit scores
    - Detect entity changes between passes
    - Provide timing insights for hypothesis prioritization
    """

    def __init__(self):
        """Initialize temporal context provider"""
        self._graphiti_service = None

        logger.info("⏰ TemporalContextProvider initialized")

    async def get_inter_pass_context(
        self,
        entity_id: str,
        from_pass: int,
        to_pass: int,
        time_horizon_days: int = 90,
        max_tokens: int = 1500
    ) -> TemporalContext:
        """
        Get contextual narrative between passes

        Includes:
        - Timeline of key events since last pass
        - Entity's temporal patterns
        - Cross-entity patterns
        - Focus areas for next pass

        Args:
            entity_id: Entity identifier
            from_pass: Previous pass number
            to_pass: Current pass number
            time_horizon_days: Days to look back (default: 90)
            max_tokens: Maximum tokens for narrative (default: 1500)

        Returns:
            Inter-pass context with narrative and patterns
        """
        logger.info(f"⏰ Building temporal context for {entity_id}: Pass {from_pass} → Pass {to_pass}")

        # Initialize Graphiti service
        if not self._graphiti_service:
            from graphiti_service import GraphitiService
            self._graphiti_service = GraphitiService()
            await self._graphiti_service.initialize()

        # Calculate time bounds
        to_time = datetime.now(timezone.utc)
        from_time = to_time - timedelta(days=time_horizon_days)

        # Build temporal narrative
        narrative_data = await self._build_temporal_narrative(
            entity_id=entity_id,
            from_time=from_time.isoformat(),
            to_time=to_time.isoformat(),
            max_tokens=max_tokens
        )

        # Get temporal patterns
        temporal_patterns = await self._analyze_temporal_patterns(
            entity_id=entity_id,
            from_time=from_time.isoformat(),
            to_time=to_time.isoformat()
        )

        # Compute recent changes
        recent_changes = await self._compute_recent_changes(
            entity_id=entity_id,
            from_time=from_time.isoformat(),
            to_time=to_time.isoformat()
        )

        # Determine focus areas for next pass
        focus_areas = self._get_focus_areas_for_pass(
            to_pass=to_pass,
            temporal_patterns=temporal_patterns,
            recent_changes=recent_changes
        )

        context = TemporalContext(
            entity_id=entity_id,
            from_time=from_time.isoformat(),
            to_time=to_time.isoformat(),
            narrative=narrative_data['narrative'],
            narrative_summary=narrative_data['summary'],
            temporal_patterns=temporal_patterns,
            recent_changes=recent_changes,
            focus_areas=focus_areas,
            episodes_used=narrative_data.get('episode_count', 0),
            confidence_boost=temporal_patterns.get('confidence_boost', 0.0)
        )

        logger.info(f"  ✅ Built narrative from {context.episodes_used} episodes")
        logger.info(f"  ✅ Temporal patterns: {temporal_patterns.get('rfp_count', 0)} RFPs, "
                   f"{temporal_patterns.get('tech_adoptions', 0)} tech adoptions")
        logger.info(f"  ✅ Focus areas: {', '.join(focus_areas[:3])}")

        return context

    async def get_temporal_fit_score(
        self,
        entity_id: str,
        hypothesis_category: str,
        hypothesis_id: str,
        time_horizon_days: int = 365
    ) -> TemporalFitScore:
        """
        Score how well hypothesis fits entity's temporal patterns

        Analyzes:
        - Category matching with historical RFPs
        - Technology adoption patterns
        - Seasonal timing alignment
        - Recent trend direction

        Args:
            entity_id: Entity identifier
            hypothesis_category: Category to check fit for
            hypothesis_id: Hypothesis identifier
            time_horizon_days: Days to look back (default: 365)

        Returns:
            Fit score with supporting evidence and recommendations
        """
        logger.info(f"⏰ Calculating temporal fit for {hypothesis_category} → {entity_id}")

        # Initialize Graphiti service
        if not self._graphiti_service:
            from graphiti_service import GraphitiService
            self._graphiti_service = GraphitiService()
            await self._graphiti_service.initialize()

        # Get entity timeline
        from_time = (datetime.now(timezone.utc) - timedelta(days=time_horizon_days)).isoformat()
        to_time = datetime.now(timezone.utc).isoformat()

        timeline = await self._graphiti_service.get_entity_timeline(
            entity_id=entity_id,
            limit=100
        )

        # Filter by time horizon
        recent_episodes = [
            ep for ep in timeline
            if ep.get('timestamp') and ep.get('timestamp') >= from_time
        ]

        # Calculate fit score
        fit_score = 0.5  # Base score
        matching_episodes = 0

        for episode in recent_episodes:
            episode_type = episode.get('event_type', '')
            description = episode.get('description', '').lower()

            # Check for category match
            if hypothesis_category.lower() in description:
                matching_episodes += 1
                fit_score += 0.1

            # Boost for RFP episodes in same category
            if 'RFP' in episode_type and hypothesis_category.lower() in description:
                fit_score += 0.15

        # Calculate confidence based on data quality
        total_episodes = len(recent_episodes)
        if total_episodes >= 10:
            confidence = 0.8
        elif total_episodes >= 5:
            confidence = 0.6
        elif total_episodes >= 2:
            confidence = 0.4
        else:
            confidence = 0.2

        # Normalize fit score
        fit_score = min(1.0, fit_score)

        # Determine timing alignment
        timing_alignment = await self._calculate_timing_alignment(
            entity_id=entity_id,
            hypothesis_category=hypothesis_category
        )

        # Generate recommendations
        if fit_score >= 0.8:
            recommended_action = "Immediate outreach - strong temporal match"
            timing_recommendation = "Optimal timing window"
        elif fit_score >= 0.6:
            recommended_action = "High priority - good temporal fit"
            timing_recommendation = "Favorable timing"
        elif fit_score >= 0.4:
            recommended_action = "Monitor - moderate temporal fit"
            timing_recommendation = "Acceptable timing"
        else:
            recommended_action = "Low priority - weak temporal fit"
            timing_recommendation = "Suboptimal timing"

        score = TemporalFitScore(
            entity_id=entity_id,
            hypothesis_id=hypothesis_id,
            hypothesis_category=hypothesis_category,
            fit_score=fit_score,
            confidence=confidence,
            matching_episodes=matching_episodes,
            total_episodes=total_episodes,
            timing_alignment=timing_alignment,
            recommended_action=recommended_action,
            timing_recommendation=timing_recommendation
        )

        logger.info(f"  ✅ Fit score: {fit_score:.2f} (matching: {matching_episodes}/{total_episodes} episodes)")

        return score

    async def _build_temporal_narrative(
        self,
        entity_id: str,
        from_time: str,
        to_time: str,
        max_tokens: int = 1500
    ) -> Dict[str, Any]:
        """
        Build temporal narrative from episodes

        Creates a concise, token-bounded narrative that summarizes:
        - Key events in chronological order
        - RFP history and outcomes
        - Technology adoptions
        - Partnership changes

        Args:
            entity_id: Entity identifier
            from_time: Start time ISO string
            to_time: End time ISO string
            max_tokens: Maximum tokens (default: 1500)

        Returns:
            Narrative data with text and metadata
        """
        # Get timeline for entity
        timeline = await self._graphiti_service.get_entity_timeline(
            entity_id=entity_id,
            limit=100
        )

        # Filter by time range
        episodes_in_range = [
            ep for ep in timeline
            if ep.get('timestamp') and ep.get('timestamp') >= from_time and ep.get('timestamp') <= to_time
        ]

        narrative_parts = []
        rfp_count = 0
        tech_count = 0

        for episode in episodes_in_range:
            episode_type = episode.get('event_type', 'OTHER')
            timestamp = episode.get('timestamp', '')
            description = episode.get('description', '')

            # Format timestamp
            if timestamp:
                try:
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    time_str = dt.strftime('%Y-%m-%d')
                except:
                    time_str = timestamp[:10]
            else:
                time_str = 'Unknown'

            # Build narrative entry
            if episode_type == 'RFP_DETECTED':
                narrative_parts.append(f"[{time_str}] RFP: {description}")
                rfp_count += 1
            elif episode_type == 'TECHNOLOGY_ADOPTED':
                narrative_parts.append(f"[{time_str}] Tech: {description}")
                tech_count += 1
            elif episode_type == 'PARTNERSHIP_FORMED':
                narrative_parts.append(f"[{time_str}] Partnership: {description}")
            else:
                narrative_parts.append(f"[{time_str}] {description}")

        # Build narrative text
        if narrative_parts:
            narrative = "Temporal Timeline:\n" + "\n".join(narrative_parts[:20])  # Limit entries
        else:
            narrative = f"No temporal events found for {entity_id} in this period."

        # Build summary
        summary_parts = []
        if rfp_count > 0:
            summary_parts.append(f"{rfp_count} RFP(s) detected")
        if tech_count > 0:
            summary_parts.append(f"{tech_count} technology adoption(s)")

        summary = ", ".join(summary_parts) if summary_parts else "No significant temporal activity"

        return {
            'narrative': narrative,
            'summary': summary,
            'episode_count': len(episodes_in_range),
            'rfp_count': rfp_count,
            'tech_count': tech_count
        }

    async def _analyze_temporal_patterns(
        self,
        entity_id: str,
        from_time: str,
        to_time: str
    ) -> Dict[str, Any]:
        """
        Analyze temporal patterns for entity

        Detects:
        - RFP frequency and timing
        - Technology adoption patterns
        - Seasonal patterns
        - Trend direction

        Args:
            entity_id: Entity identifier
            from_time: Start time ISO string
            to_time: End time ISO string

        Returns:
            Temporal pattern analysis
        """
        # Get temporal patterns from Graphiti
        patterns = await self._graphiti_service.get_temporal_patterns(
            entity_type=None,
            time_horizon=365
        )

        # Entity-specific patterns
        timeline = await self._graphiti_service.get_entity_timeline(
            entity_id=entity_id,
            limit=100
        )

        # Count RFPs
        rfp_episodes = [ep for ep in timeline if ep.get('event_type') == 'RFP_DETECTED']
        rfp_count = len(rfp_episodes)

        # Calculate RFP frequency (per month)
        time_span_days = 365
        rfp_frequency = rfp_count / (time_span_days / 30) if rfp_count > 0 else 0.0

        # Detect tech adoptions
        tech_adoptions = [ep for ep in timeline if ep.get('event_type') == 'TECHNOLOGY_ADOPTED']
        tech_count = len(tech_adoptions)

        # Calculate confidence boost based on temporal activity
        confidence_boost = 0.0
        if rfp_count >= 3:
            confidence_boost = 0.10
        elif rfp_count >= 1:
            confidence_boost = 0.05

        if tech_count >= 3:
            confidence_boost += 0.05

        return {
            'rfp_count': rfp_count,
            'tech_adoptions': tech_count,
            'rfp_frequency': rfp_frequency,
            'confidence_boost': confidence_boost,
            'total_episodes': len(timeline),
            'most_recent_rfp': rfp_episodes[0].get('timestamp') if rfp_episodes else None
        }

    async def _compute_recent_changes(
        self,
        entity_id: str,
        from_time: str,
        to_time: str
    ) -> Dict[str, Any]:
        """
        Compute entity changes between time periods

        Detects:
        - New relationships formed
        - Technology changes
        - Partnership changes
        - Confidence deltas

        Args:
            entity_id: Entity identifier
            from_time: Start time ISO string
            to_time: End time ISO string

        Returns:
            Recent changes summary
        """
        # Use Graphiti's diff computation
        try:
            changes = await self._graphiti_service.compute_entity_diff(
                entity_id=entity_id,
                from_time=from_time,
                to_time=to_time
            )

            return {
                'new_relationships': len(changes.get('changes', {}).get('new_relationships', [])),
                'ended_relationships': len(changes.get('changes', {}).get('ended_relationships', [])),
                'property_changes': len(changes.get('changes', {}).get('property_changes', [])),
                'new_episodes': changes.get('changes', {}).get('new_episodes', 0),
                'summary': changes.get('summary', {})
            }
        except Exception as e:
            logger.warning(f"⚠️ Could not compute entity diff: {e}")
            return {
                'new_relationships': 0,
                'ended_relationships': 0,
                'property_changes': 0,
                'new_episodes': 0,
                'summary': {}
            }

    def _get_focus_areas_for_pass(
        self,
        to_pass: int,
        temporal_patterns: Dict[str, Any],
        recent_changes: Dict[str, Any]
    ) -> List[str]:
        """
        Determine focus areas for next pass based on temporal patterns

        Args:
            to_pass: Current pass number
            temporal_patterns: Temporal pattern analysis
            recent_changes: Recent entity changes

        Returns:
            List of recommended focus areas
        """
        focus_areas = []

        # Base focus areas by pass
        base_areas = {
            1: ["Web Development", "Mobile Development", "Digital Transformation"],
            2: ["Web Development", "Mobile Development", "Digital Transformation", "Fan Engagement"],
            3: ["React Development", "Mobile Apps", "E-commerce", "CRM Platforms"],
            4: ["React Web", "React Native", "Digital Transformation", "Fan Engagement"]
        }

        focus_areas.extend(base_areas.get(to_pass, base_areas[4]))

        # Add temporal pattern insights
        if temporal_patterns.get('rfp_count', 0) >= 2:
            focus_areas.insert(0, "High RFP Activity Areas")

        if temporal_patterns.get('tech_adoptions', 0) >= 2:
            focus_areas.insert(0, "Technology Adoption Patterns")

        # Add recent change insights
        if recent_changes.get('new_relationships', 0) >= 3:
            focus_areas.append("Network Expansion")

        return list(set(focus_areas))[:10]  # Dedupe and limit

    async def _calculate_timing_alignment(
        self,
        entity_id: str,
        hypothesis_category: str
    ) -> float:
        """
        Calculate timing alignment for hypothesis

        Analyzes if current timing aligns with entity's historical patterns.

        Args:
            entity_id: Entity identifier
            hypothesis_category: Hypothesis category

        Returns:
            Timing alignment score (0.0-1.0)
        """
        # Get entity's RFP history
        timeline = await self._graphiti_service.get_entity_timeline(
            entity_id=entity_id,
            limit=50
        )

        rfp_episodes = [ep for ep in timeline if ep.get('event_type') == 'RFP_DETECTED']

        if not rfp_episodes:
            return 0.5  # Neutral if no history

        # Analyze seasonal patterns
        current_month = datetime.now(timezone.utc).month

        month_counts = {}
        for episode in rfp_episodes:
            timestamp = episode.get('timestamp', '')
            if timestamp:
                try:
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    month = dt.month
                    month_counts[month] = month_counts.get(month, 0) + 1
                except:
                    pass

        # Check if current month is active
        if month_counts.get(current_month, 0) > 0:
            return 0.8
        elif sum(month_counts.values()) > 0:
            return 0.5
        else:
            return 0.3


# =============================================================================
# Convenience Functions
# =============================================================================

async def get_temporal_context_between_passes(
    entity_id: str,
    from_pass: int,
    to_pass: int,
    time_horizon_days: int = 90
) -> TemporalContext:
    """
    Convenience function to get temporal context between passes

    Args:
        entity_id: Entity identifier
        from_pass: Previous pass number
        to_pass: Current pass number
        time_horizon_days: Days to look back (default: 90)

    Returns:
        Temporal context for inter-pass analysis
    """
    provider = TemporalContextProvider()
    return await provider.get_inter_pass_context(
        entity_id=entity_id,
        from_pass=from_pass,
        to_pass=to_pass,
        time_horizon_days=time_horizon_days
    )


async def calculate_temporal_fit(
    entity_id: str,
    hypothesis_category: str,
    hypothesis_id: str
) -> TemporalFitScore:
    """
    Convenience function to calculate temporal fit score

    Args:
        entity_id: Entity identifier
        hypothesis_category: Hypothesis category
        hypothesis_id: Hypothesis identifier

    Returns:
        Temporal fit score with recommendations
    """
    provider = TemporalContextProvider()
    return await provider.get_temporal_fit_score(
        entity_id=entity_id,
        hypothesis_category=hypothesis_category,
        hypothesis_id=hypothesis_id
    )


if __name__ == "__main__":
    # Test temporal context provider
    import asyncio

    async def test():
        print("=== Testing Temporal Context Provider ===\n")

        provider = TemporalContextProvider()

        # Test inter-pass context
        print("Testing inter-pass context...")
        context = await provider.get_inter_pass_context(
            entity_id="arsenal-fc",
            from_pass=1,
            to_pass=2,
            time_horizon_days=90
        )

        print(f"\n✅ Temporal Context:")
        print(f"   Narrative Summary: {context.narrative_summary}")
        print(f"   Episodes Used: {context.episodes_used}")
        print(f"   Focus Areas: {', '.join(context.focus_areas[:3])}")
        print(f"   Confidence Boost: {context.confidence_boost:.2f}")

        # Test temporal fit score
        print("\nTesting temporal fit score...")
        fit_score = await provider.get_temporal_fit_score(
            entity_id="arsenal-fc",
            hypothesis_category="React Development",
            hypothesis_id="arsenal_react_dev"
        )

        print(f"\n✅ Temporal Fit Score:")
        print(f"   Fit Score: {fit_score.fit_score:.2f}")
        print(f"   Confidence: {fit_score.confidence:.2f}")
        print(f"   Matching Episodes: {fit_score.matching_episodes}/{fit_score.total_episodes}")
        print(f"   Recommended Action: {fit_score.recommended_action}")
        print(f"   Timing: {fit_score.timing_recommendation}")

        print("\n✅ Test complete")

    asyncio.run(test())
