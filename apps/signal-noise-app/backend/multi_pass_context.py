#!/usr/bin/env python3
"""
Multi-Pass Context Manager

Manages context and strategy across multiple discovery passes.

Each pass builds on previous findings:
- Pass 1: Initial discovery (dossier-informed hypotheses)
- Pass 2: Network context (graph relationships + peer patterns)
- Pass 3: Deep dive (highest confidence + temporal patterns)
- Pass 4+: Adaptive (develop new hypotheses from findings)

Usage:
    from backend.multi_pass_context import MultiPassContext

    context_manager = MultiPassContext()
    strategy = await context_manager.get_pass_strategy(
        entity_id="arsenal-fc",
        pass_number=2,
        previous_results=pass_1_results
    )
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class HopType(str, Enum):
    """Types of hops in discovery"""
    OFFICIAL_SITE = "OFFICIAL_SITE"
    CAREERS_PAGE = "CAREERS_PAGE"
    PRESS_RELEASE = "PRESS_RELEASE"
    ANNUAL_REPORT = "ANNUAL_REPORT"
    LINKEDIN_JOB = "LINKEDIN_JOB"
    PARTNERSHIP_ANNOUNCEMENT = "PARTNERSHIP_ANNOUNCEMENT"
    NEWS_COVERAGE = "NEWS_COVERAGE"
    TECH_BLOG = "TECH_BLOG"


@dataclass
class PassStrategy:
    """Strategy for a single discovery pass"""
    pass_number: int
    focus_areas: List[str]
    hop_types: List[str]
    max_iterations: int
    depth_limit: int
    description: str
    min_confidence_threshold: float = 0.0
    prioritized_hypotheses: List[str] = field(default_factory=list)


@dataclass
class TemporalPatterns:
    """Temporal patterns for an entity"""
    rfp_history: List[Dict] = field(default_factory=list)
    tech_adoptions: List[Dict] = field(default_factory=list)
    partnership_history: List[Dict] = field(default_factory=list)
    seasonal_patterns: Dict[str, Any] = field(default_factory=dict)

    # Pattern analysis
    avg_rfp_frequency: float = 0.0
    most_active_quarter: str = ""
    preferred_tech_categories: List[str] = field(default_factory=list)


@dataclass
class NetworkContext:
    """Graph relationships for an entity"""
    partners: List[Dict] = field(default_factory=list)
    competitors: List[Dict] = field(default_factory=list)
    suppliers: List[Dict] = field(default_factory=list)
    technology_stack: List[str] = field(default_factory=list)

    # Network hypotheses
    network_hypotheses: List[Dict] = field(default_factory=list)


@dataclass
class PassResult:
    """Results from a single pass"""
    pass_number: int
    timestamp: datetime
    strategy: PassStrategy
    signals: List[Dict] = field(default_factory=list)
    validated_signals: List[Dict] = field(default_factory=list)
    hypotheses_explored: List[str] = field(default_factory=list)
    total_cost: float = 0.0
    iteration_count: int = 0


class MultiPassContext:
    """
    Manages context and strategy across multiple discovery passes

    Responsibilities:
    - Track pass history
    - Provide temporal patterns (Graphiti)
    - Provide graph relationships (FalkorDB)
    - Generate optimal strategies for each pass
    """

    def __init__(self):
        """Initialize context manager"""
        self.pass_history: Dict[int, PassResult] = {}
        self.temporal_patterns: Dict[str, TemporalPatterns] = {}
        self.graph_context: Dict[str, NetworkContext] = {}

        # Initialize services (lazy loading)
        self._graphiti_service = None
        self._falkordb_client = None

        logger.info("🔄 MultiPassContext initialized")

    async def get_pass_strategy(
        self,
        entity_id: str,
        entity_name: str,
        pass_number: int,
        previous_results: List[PassResult]
    ) -> PassStrategy:
        """
        Determine optimal strategy for this pass

        Strategy evolves based on:
        - Previous pass findings
        - Temporal patterns (Graphiti)
        - Graph relationships (FalkorDB)
        - Current confidence levels

        Args:
            entity_id: Entity identifier
            entity_name: Entity display name
            pass_number: Current pass number (1-indexed)
            previous_results: Results from previous passes

        Returns:
            Optimal strategy for this pass
        """
        logger.info(f"🎯 Generating strategy for Pass {pass_number}: {entity_name}")

        # Get temporal patterns
        temporal_patterns = await self.get_temporal_patterns(entity_id)

        # Get graph context
        graph_context = await self.get_graph_context(entity_id)

        # Determine strategy based on pass number
        if pass_number == 1:
            strategy = self._get_pass_1_strategy(
                entity_id,
                entity_name,
                graph_context
            )
        elif pass_number == 2:
            strategy = await self._get_pass_2_strategy(
                entity_id,
                entity_name,
                previous_results,
                temporal_patterns,
                graph_context
            )
        elif pass_number == 3:
            strategy = await self._get_pass_3_strategy(
                entity_id,
                entity_name,
                previous_results,
                temporal_patterns,
                graph_context
            )
        else:
            # Pass 4+: Adaptive
            strategy = await self._get_adaptive_strategy(
                entity_id,
                entity_name,
                pass_number,
                previous_results,
                temporal_patterns,
                graph_context
            )

        logger.info(f"  ✅ Strategy: {strategy.description}")
        logger.info(f"     Focus areas: {', '.join(strategy.focus_areas[:3])}")

        return strategy

    def _get_pass_1_strategy(
        self,
        entity_id: str,
        entity_name: str,
        graph_context: NetworkContext
    ) -> PassStrategy:
        """
        Pass 1: Initial discovery (dossier-informed hypotheses)

        Strategy:
        - Focus on official sources
        - Surface-level exploration
        - Establish baseline signals
        """
        # Determine focus areas from graph context
        focus_areas = ["Web Development", "Mobile Development", "Digital Transformation"]

        # If we have technology stack info, prioritize those
        if graph_context.technology_stack:
            for tech in graph_context.technology_stack:
                if "react" in tech.lower():
                    focus_areas.insert(0, "React Development")
                    break

        return PassStrategy(
            pass_number=1,
            focus_areas=focus_areas,
            hop_types=[
                HopType.OFFICIAL_SITE,
                HopType.CAREERS_PAGE,
                HopType.PRESS_RELEASE
            ],
            max_iterations=10,
            depth_limit=2,
            description="Initial discovery with dossier-informed hypotheses",
            min_confidence_threshold=0.0
        )

    async def _get_pass_2_strategy(
        self,
        entity_id: str,
        entity_name: str,
        previous_results: List[PassResult],
        temporal_patterns: TemporalPatterns,
        graph_context: NetworkContext
    ) -> PassStrategy:
        """
        Pass 2: Network context + peer patterns

        Strategy:
        - Use Pass 1 results to inform focus
        - Explore partner/competitor patterns
        - Deep dive on high-confidence areas
        """
        # Get high-confidence signals from Pass 1
        high_confidence_signals = self._get_high_confidence_signals(previous_results, threshold=0.6)

        # Determine focus areas based on Pass 1
        focus_areas = []
        for signal in high_confidence_signals:
            category = signal.get('category', 'General')
            if category not in focus_areas:
                focus_areas.append(category)

        # Add network-inferred areas
        if graph_context.network_hypotheses:
            for hyp in graph_context.network_hypotheses:
                area = hyp.get('category')
                if area and area not in focus_areas:
                    focus_areas.append(area)

        # Default to Pass 1 areas if no signals
        if not focus_areas and previous_results:
            pass_1 = previous_results[0]
            focus_areas = pass_1.strategy.focus_areas[:3]

        return PassStrategy(
            pass_number=2,
            focus_areas=focus_areas[:5],  # Top 5 areas
            hop_types=[
                HopType.ANNUAL_REPORT,
                HopType.NEWS_COVERAGE,
                HopType.PARTNERSHIP_ANNOUNCEMENT
            ],
            max_iterations=15,
            depth_limit=3,
            description="Network context exploration based on Pass 1 findings",
            min_confidence_threshold=0.5,
            prioritized_hypotheses=[s.get('hypothesis_id') for s in high_confidence_signals[:3]]
        )

    async def _get_pass_3_strategy(
        self,
        entity_id: str,
        entity_name: str,
        previous_results: List[PassResult],
        temporal_patterns: TemporalPatterns,
        graph_context: NetworkContext
    ) -> PassStrategy:
        """
        Pass 3: Deep dive on highest confidence

        Strategy:
        - Focus on top 3 signals from Pass 2
        - Use temporal patterns to guide exploration
        - Maximum depth exploration
        """
        # Get top signals from all previous passes
        top_signals = self._get_top_signals(previous_results, limit=3)

        # Determine focus areas from top signals
        focus_areas = [s.get('category', 'General') for s in top_signals]

        # Add temporal pattern insights
        if temporal_patterns.preferred_tech_categories:
            focus_areas.extend(temporal_patterns.preferred_tech_categories[:2])

        return PassStrategy(
            pass_number=3,
            focus_areas=list(set(focus_areas))[:5],
            hop_types=[
                HopType.LINKEDIN_JOB,
                HopType.TECH_BLOG,
                HopType.PRESS_RELEASE
            ],
            max_iterations=20,
            depth_limit=4,
            description="Deep dive on highest-confidence signals with temporal patterns",
            min_confidence_threshold=0.7,
            prioritized_hypotheses=[s.get('hypothesis_id') for s in top_signals]
        )

    async def _get_adaptive_strategy(
        self,
        entity_id: str,
        entity_name: str,
        pass_number: int,
        previous_results: List[PassResult],
        temporal_patterns: TemporalPatterns,
        graph_context: NetworkContext
    ) -> PassStrategy:
        """
        Pass 4+: Adaptive exploration

        Strategy:
        - Generate new hypotheses from discoveries
        - Explore cross-category patterns
        - Adaptive depth based on findings
        """
        # Get all unique categories explored so far
        explored_categories = set()
        for result in previous_results:
            explored_categories.update(result.strategy.focus_areas)

        # Generate new focus areas (combinations of explored categories)
        focus_areas = []
        category_list = list(explored_categories)

        # Create cross-category hypotheses
        for i, cat1 in enumerate(category_list):
            for cat2 in category_list[i+1:]:
                # Combine categories
                combined = f"{cat1} + {cat2}"
                focus_areas.append(combined)

        # Get top signals for prioritization
        top_signals = self._get_top_signals(previous_results, limit=5)

        return PassStrategy(
            pass_number=pass_number,
            focus_areas=focus_areas[:5],
            hop_types=[
                HopType.LINKEDIN_JOB,
                HopType.TECH_BLOG,
                HopType.NEWS_COVERAGE,
                HopType.PARTNERSHIP_ANNOUNCEMENT
            ],
            max_iterations=25,
            depth_limit=5,
            description=f"Adaptive exploration: cross-category patterns (Pass {pass_number})",
            min_confidence_threshold=0.6,
            prioritized_hypotheses=[s.get('hypothesis_id') for s in top_signals]
        )

    async def get_temporal_patterns(self, entity_id: str) -> TemporalPatterns:
        """
        Get temporal patterns from Graphiti

        Args:
            entity_id: Entity identifier

        Returns:
            Temporal patterns for the entity
        """
        # Check cache first
        if entity_id in self.temporal_patterns:
            return self.temporal_patterns[entity_id]

        # Initialize Graphiti service
        if not self._graphiti_service:
            from graphiti_service import GraphitiService
            self._graphiti_service = GraphitiService()
            await self._graphiti_service.initialize()

        patterns = TemporalPatterns()

        try:
            # Get entity timeline (last 365 days)
            time_threshold = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()

            timeline = await self._graphiti_service.get_entity_timeline(
                entity_id=entity_id,
                limit=100
            )

            # Analyze patterns
            for event in timeline:
                event_type = event.get('event_type')

                if event_type == 'RFP_DETECTED':
                    patterns.rfp_history.append(event)
                elif event_type == 'TECHNOLOGY_ADOPTED':
                    patterns.tech_adoptions.append(event)
                elif event_type == 'PARTNERSHIP_FORMED':
                    patterns.partnership_history.append(event)

            # Calculate statistics
            if patterns.rfp_history:
                patterns.avg_rfp_frequency = len(patterns.rfp_history) / 12.0  # Per month

            # Extract preferred tech categories
            tech_categories = set()
            for adoption in patterns.tech_adoptions:
                category = adoption.get('metadata', {}).get('category')
                if category:
                    tech_categories.add(category)

            patterns.preferred_tech_categories = list(tech_categories)

            logger.info(f"📊 Loaded {len(patterns.rfp_history)} RFP events, "
                       f"{len(patterns.tech_adoptions)} tech adoptions for {entity_id}")

        except Exception as e:
            logger.warning(f"⚠️ Could not load temporal patterns: {e}")

        # Cache and return
        self.temporal_patterns[entity_id] = patterns
        return patterns

    async def get_graph_context(self, entity_id: str) -> NetworkContext:
        """
        Get graph relationships from FalkorDB

        Args:
            entity_id: Entity identifier

        Returns:
            Network context for the entity
        """
        # Check cache first
        if entity_id in self.graph_context:
            return self.graph_context[entity_id]

        context = NetworkContext()

        try:
            # Initialize FalkorDB client
            if not self._falkordb_client:
                from falkordb_client import FalkorDBClient
                self._falkordb_client = FalkorDBClient()
                await self._falkordb_client.initialize()

            # Get partners
            context.partners = await self._get_partners(entity_id)

            # Get competitors
            context.competitors = await self._get_competitors(entity_id)

            # Get technology stack
            context.technology_stack = await self._get_technology_stack(entity_id)

            # Generate network hypotheses
            context.network_hypotheses = await self._generate_network_hypotheses(
                entity_id,
                context
            )

            logger.info(f"🕸️ Loaded graph context: {len(context.partners)} partners, "
                       f"{len(context.competitors)} competitors for {entity_id}")

        except Exception as e:
            logger.warning(f"⚠️ Could not load graph context: {e}")

        # Cache and return
        self.graph_context[entity_id] = context
        return context

    async def _get_partners(self, entity_id: str) -> List[Dict]:
        """Get partner entities"""
        if not self._falkordb_client:
            return []

        try:
            # Query for PARTNER_OF relationships
            query = """
                MATCH (e {id: $entity_id})-[:PARTNER_OF]-(partner:Entity)
                RETURN partner
                LIMIT 20
            """

            results = await self._falkordb_client.execute_query(query, {'entity_id': entity_id})

            return [{'name': r.get('name'), 'id': r.get('id')} for r in results]

        except Exception as e:
            logger.warning(f"⚠️ Could not get partners: {e}")
            return []

    async def _get_competitors(self, entity_id: str) -> List[Dict]:
        """Get competitor entities"""
        if not self._falkordb_client:
            return []

        try:
            # Query for COMPETES_WITH relationships
            query = """
                MATCH (e {id: $entity_id})-[:COMPETES_WITH]-(competitor:Entity)
                RETURN competitor
                LIMIT 20
            """

            results = await self._falkordb_client.execute_query(query, {'entity_id': entity_id})

            return [{'name': r.get('name'), 'id': r.get('id')} for r in results]

        except Exception as e:
            logger.warning(f"⚠️ Could not get competitors: {e}")
            return []

    async def _get_technology_stack(self, entity_id: str) -> List[str]:
        """Get entity's technology stack"""
        if not self._falkordb_client:
            return []

        try:
            # Query for USES relationships to Technology nodes
            query = """
                MATCH (e {id: $entity_id})-[:USES]->(tech:Technology)
                RETURN tech.name as technology
                LIMIT 20
            """

            results = await self._falkordb_client.execute_query(query, {'entity_id': entity_id})

            return [r.get('technology') for r in results]

        except Exception as e:
            logger.warning(f"⚠️ Could not get technology stack: {e}")
            return []

    async def _generate_network_hypotheses(
        self,
        entity_id: str,
        context: NetworkContext
    ) -> List[Dict]:
        """
        Generate network-informed hypotheses

        Examples:
        - If partner adopted React, entity might follow
        - If competitors use certain tech, entity may need it

        Args:
            entity_id: Entity identifier
            context: Network context

        Returns:
            List of network hypotheses
        """
        hypotheses = []

        # Technology diffusion from partners
        for partner in context.partners:
            partner_tech = await self._get_technology_stack(partner.get('id'))

            for tech in partner_tech:
                if 'react' in tech.lower() and 'react' not in str(context.technology_stack).lower():
                    hypotheses.append({
                        'category': 'React Development',
                        'description': f"Partner {partner.get('name')} uses React",
                        'confidence': 0.6,
                        'source': 'network_inference'
                    })

        return hypotheses

    def _get_high_confidence_signals(
        self,
        results: List[PassResult],
        threshold: float = 0.6
    ) -> List[Dict]:
        """Get high-confidence signals from results"""
        signals = []

        for result in results:
            for signal in result.validated_signals:
                confidence = signal.get('confidence', 0.0)
                if confidence >= threshold:
                    signals.append(signal)

        # Sort by confidence descending
        signals.sort(key=lambda s: s.get('confidence', 0.0), reverse=True)

        return signals

    def _get_top_signals(
        self,
        results: List[PassResult],
        limit: int = 5
    ) -> List[Dict]:
        """Get top signals by confidence"""
        all_signals = []

        for result in results:
            all_signals.extend(result.validated_signals)

        # Sort by confidence descending
        all_signals.sort(key=lambda s: s.get('confidence', 0.0), reverse=True)

        return all_signals[:limit]


# =============================================================================
# Convenience Functions
# =============================================================================

async def get_pass_strategy_for_entity(
    entity_id: str,
    entity_name: str,
    pass_number: int,
    previous_results: List[PassResult]
) -> PassStrategy:
    """
    Convenience function to get pass strategy

    Args:
        entity_id: Entity identifier
        entity_name: Entity display name
        pass_number: Pass number
        previous_results: Previous pass results

    Returns:
        Optimal strategy for this pass
    """
    context_manager = MultiPassContext()
    return await context_manager.get_pass_strategy(
        entity_id, entity_name, pass_number, previous_results
    )


if __name__ == "__main__":
    # Test multi-pass context
    import asyncio

    async def test():
        print("=== Testing Multi-Pass Context ===\n")

        context_manager = MultiPassContext()

        # Test Pass 1 strategy
        print("Generating Pass 1 strategy...")
        strategy_1 = await context_manager.get_pass_strategy(
            entity_id="arsenal-fc",
            entity_name="Arsenal FC",
            pass_number=1,
            previous_results=[]
        )

        print(f"  ✅ Pass 1: {strategy_1.description}")
        print(f"     Focus areas: {strategy_1.focus_areas}")
        print(f"     Hop types: {strategy_1.hop_types}")
        print(f"     Max iterations: {strategy_1.max_iterations}")

        # Test Pass 2 strategy (with mock previous results)
        print("\nGenerating Pass 2 strategy...")
        mock_result = PassResult(
            pass_number=1,
            timestamp=datetime.now(timezone.utc),
            strategy=strategy_1,
            validated_signals=[
                {
                    'category': 'React Development',
                    'confidence': 0.75,
                    'hypothesis_id': 'arsenal_react_dev'
                }
            ]
        )

        strategy_2 = await context_manager.get_pass_strategy(
            entity_id="arsenal-fc",
            entity_name="Arsenal FC",
            pass_number=2,
            previous_results=[mock_result]
        )

        print(f"  ✅ Pass 2: {strategy_2.description}")
        print(f"     Focus areas: {strategy_2.focus_areas}")
        print(f"     Prioritized hypotheses: {strategy_2.prioritized_hypotheses}")

        print("\n✅ Test complete")

    asyncio.run(test())
