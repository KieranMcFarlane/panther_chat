#!/usr/bin/env python3
"""
Graph Relationship Analyzer - Phase 5

Analyzes FalkorDB graph relationships for hypothesis generation and network intelligence.

This module adds:
- Partner technology stack tracking
- Competitor capability analysis
- Technology diffusion patterns
- Network-informed hypotheses
- Cross-entity learning

Usage:
    from backend.graph_relationship_analyzer import GraphRelationshipAnalyzer

    analyzer = GraphRelationshipAnalyzer()
    network_context = await analyzer.analyze_network_context(
        entity_id="arsenal-fc"
    )
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@dataclass
class TechnologyStack:
    """Technology stack for an entity"""
    frontend: List[str] = field(default_factory=list)
    backend: List[str] = field(default_factory=list)
    mobile: List[str] = field(default_factory=list)
    infrastructure: List[str] = field(default_factory=list)
    analytics: List[str] = field(default_factory=list)
    ecommerce: List[str] = field(default_factory=list)

    def add_tech(self, category: str, tech: str):
        """Add technology to category"""
        if category == "frontend" and tech not in self.frontend:
            self.frontend.append(tech)
        elif category == "backend" and tech not in self.backend:
            self.backend.append(tech)
        elif category == "mobile" and tech not in self.mobile:
            self.mobile.append(tech)
        elif category == "infrastructure" and tech not in self.infrastructure:
            self.infrastructure.append(tech)
        elif category == "analytics" and tech not in self.analytics:
            self.analytics.append(tech)
        elif category == "ecommerce" and tech not in self.ecommerce:
            self.ecommerce.append(tech)

    def has_tech(self, category: str, tech: str) -> bool:
        """Check if entity has technology"""
        if category == "frontend":
            return tech.lower() in [t.lower() for t in self.frontend]
        elif category == "backend":
            return tech.lower() in [t.lower() for t in self.backend]
        elif category == "mobile":
            return tech.lower() in [t.lower() for t in self.mobile]
        return False

    def to_dict(self) -> Dict[str, List[str]]:
        """Convert to dictionary"""
        return {
            'frontend': self.frontend,
            'backend': self.backend,
            'mobile': self.mobile,
            'infrastructure': self.infrastructure,
            'analytics': self.analytics,
            'ecommerce': self.ecommerce
        }


@dataclass
class NetworkContext:
    """Network context for an entity"""
    entity_id: str
    entity_name: str

    # Partners
    partners: List[Dict[str, Any]] = field(default_factory=list)
    partner_count: int = 0

    # Competitors
    competitors: List[Dict[str, Any]] = field(default_factory=list)
    competitor_count: int = 0

    # Technology
    technology_stack: TechnologyStack = field(default_factory=TechnologyStack)

    # Network hypotheses
    network_hypotheses: List[Dict[str, Any]] = field(default_factory=list)

    # Diffusion patterns
    technology_diffusion: Dict[str, List[str]] = field(default_factory=dict)
    # {"react": ["partner-1", "partner-2"], "salesforce": ["partner-3"]}

    # Metadata
    last_updated: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class NetworkHypothesis:
    """Hypothesis generated from network intelligence"""
    hypothesis_id: str
    entity_id: str
    category: str
    statement: str
    confidence: float
    source_type: str  # "partner_inference", "competitor_pressure", "diffusion"
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Supporting evidence
    partner_id: Optional[str] = None
    competitor_id: Optional[str] = None
    technology: Optional[str] = None


class GraphRelationshipAnalyzer:
    """
    Analyzes FalkorDB graph relationships for hypothesis generation

    Capabilities:
    - Extract partner technology stacks
    - Analyze competitor capabilities
    - Generate network-informed hypotheses
    - Track technology diffusion patterns
    - Provide cross-entity learning
    """

    def __init__(self):
        """Initialize analyzer"""
        self._falkordb_client = None
        self._cache: Dict[str, NetworkContext] = {}

        logger.info("🕸️ GraphRelationshipAnalyzer initialized")

    async def _get_client(self):
        """Get or create FalkorDB client"""
        if self._falkordb_client is None:
            try:
                from falkordb_client import FalkorDBClient
                self._falkordb_client = FalkorDBClient()
                await self._falkordb_client.initialize()
                logger.info("✅ FalkorDB client initialized")
            except Exception as e:
                logger.error(f"❌ Failed to initialize FalkorDB client: {e}")
                raise
        return self._falkordb_client

    async def analyze_network_context(
        self,
        entity_id: str,
        force_refresh: bool = False
    ) -> NetworkContext:
        """
        Analyze network context for entity

        Extracts:
        - Partners with technology stacks
        - Competitors with capabilities
        - Entity's technology stack
        - Network-informed hypotheses
        - Technology diffusion patterns

        Args:
            entity_id: Entity identifier
            force_refresh: Force refresh from DB (skip cache)

        Returns:
            NetworkContext with all network intelligence
        """
        logger.info(f"🕸️ Analyzing network context for {entity_id}")

        # Check cache
        if not force_refresh and entity_id in self._cache:
            logger.info(f"  ✅ Using cached network context")
            return self._cache[entity_id]

        client = await self._get_client()

        # Get entity name
        entity_name = await self._get_entity_name(entity_id, client)

        # Analyze partners
        partners = await self._get_partners(entity_id, client)
        logger.info(f"  ✓ Found {len(partners)} partners")

        # Analyze competitors
        competitors = await self._get_competitors(entity_id, client)
        logger.info(f"  ✓ Found {len(competitors)} competitors")

        # Get technology stack
        tech_stack = await self._get_technology_stack(entity_id, client)
        logger.info(f"  ✓ Technology stack: {len(tech_stack.to_dict())} categories")

        # Generate network hypotheses
        network_hypotheses = await self._generate_network_hypotheses(
            entity_id,
            entity_name,
            partners,
            competitors,
            tech_stack
        )
        logger.info(f"  ✓ Generated {len(network_hypotheses)} network hypotheses")

        # Analyze technology diffusion
        diffusion = await self._analyze_technology_diffusion(
            partners,
            tech_stack
        )

        # Create network context
        context = NetworkContext(
            entity_id=entity_id,
            entity_name=entity_name,
            partners=partners,
            partner_count=len(partners),
            competitors=competitors,
            competitor_count=len(competitors),
            technology_stack=tech_stack,
            network_hypotheses=network_hypotheses,
            technology_diffusion=diffusion
        )

        # Cache and return
        self._cache[entity_id] = context
        return context

    async def _get_entity_name(
        self,
        entity_id: str,
        client
    ) -> str:
        """Get entity name from database"""
        try:
            query = """
                MATCH (e {id: $entity_id})
                RETURN e.name as name
                LIMIT 1
            """

            results = await client.execute_query(query, {'entity_id': entity_id})

            if results and len(results) > 0:
                return results[0].get('name', entity_id)

            return entity_id

        except Exception as e:
            logger.warning(f"⚠️ Could not get entity name: {e}")
            return entity_id

    async def _get_partners(
        self,
        entity_id: str,
        client
    ) -> List[Dict[str, Any]]:
        """Get partner entities with their technology stacks"""
        try:
            query = """
                MATCH (e {id: $entity_id})-[:PARTNER_OF]-(partner:Entity)
                RETURN partner.id as id,
                       partner.name as name,
                       partner.type as type
                LIMIT 20
            """

            results = await client.execute_query(query, {'entity_id': entity_id})

            partners = []
            for result in results:
                # Get technology stack for each partner
                tech_stack = await self._get_technology_stack(result['id'], client)

                partners.append({
                    'id': result['id'],
                    'name': result['name'],
                    'type': result.get('type', 'ORG'),
                    'technology_stack': tech_stack
                })

            return partners

        except Exception as e:
            logger.warning(f"⚠️ Could not get partners: {e}")
            return []

    async def _get_competitors(
        self,
        entity_id: str,
        client
    ) -> List[Dict[str, Any]]:
        """Get competitor entities with their capabilities"""
        try:
            query = """
                MATCH (e {id: $entity_id})-[:COMPETES_WITH]-(competitor:Entity)
                RETURN competitor.id as id,
                       competitor.name as name,
                       competitor.type as type
                LIMIT 20
            """

            results = await client.execute_query(query, {'entity_id': entity_id})

            competitors = []
            for result in results:
                # Get technology stack for each competitor
                tech_stack = await self._get_technology_stack(result['id'], client)

                competitors.append({
                    'id': result['id'],
                    'name': result['name'],
                    'type': result.get('type', 'ORG'),
                    'technology_stack': tech_stack
                })

            return competitors

        except Exception as e:
            logger.warning(f"⚠️ Could not get competitors: {e}")
            return []

    async def _get_technology_stack(
        self,
        entity_id: str,
        client
    ) -> TechnologyStack:
        """Get entity's technology stack from relationships"""
        tech_stack = TechnologyStack()

        try:
            # Query for TECHNOLOGY_USES relationships
            query = """
                MATCH (e {id: $entity_id})-[:USES]->(tech:Technology)
                RETURN tech.name as technology,
                       tech.category as category
                LIMIT 50
            """

            results = await client.execute_query(query, {'entity_id': entity_id})

            for result in results:
                tech = result.get('technology', '')
                category = result.get('category', 'infrastructure')

                if tech:
                    tech_stack.add_tech(category, tech)

        except Exception as e:
            logger.warning(f"⚠️ Could not get technology stack: {e}")

        return tech_stack

    async def _generate_network_hypotheses(
        self,
        entity_id: str,
        entity_name: str,
        partners: List[Dict[str, Any]],
        competitors: List[Dict[str, Any]],
        tech_stack: TechnologyStack
    ) -> List[Dict[str, Any]]:
        """
        Generate network-informed hypotheses

        Types:
        1. Partner inference: If partner uses tech, entity might follow
        2. Competitor pressure: If competitors use tech, entity needs it
        3. Technology gap: Entity missing tech that partners have
        """
        hypotheses = []

        # 1. Technology diffusion from partners
        for partner in partners:
            partner_tech = partner.get('technology_stack', {})
            partner_name = partner.get('name', 'Unknown')

            # Check for technologies partner has but entity doesn't
            for category, techs in partner_tech.to_dict().items():
                for tech in techs:
                    if not tech_stack.has_tech(category, tech):
                        # Network inference hypothesis
                        confidence = 0.6  # Moderate confidence

                        hypothesis = {
                            'hypothesis_id': f"{entity_id}_{category}_{tech}_adoption",
                            'entity_id': entity_id,
                            'category': category,
                            'statement': f"{entity_name} likely to adopt {tech} (partner {partner_name} uses {tech})",
                            'confidence': confidence,
                            'source_type': 'partner_inference',
                            'metadata': {
                                'partner_id': partner['id'],
                                'partner_name': partner_name,
                                'technology': tech,
                                'category': category,
                                'reason': 'Technology diffusion from partner'
                            }
                        }

                        hypotheses.append(hypothesis)

        # 2. Competitor pressure
        if competitors:
            # Collect technologies used by multiple competitors
            tech_usage = {}  # tech -> count

            for competitor in competitors:
                comp_tech = competitor.get('technology_stack', {})
                for category, techs in comp_tech.to_dict().items():
                    for tech in techs:
                        key = f"{category}:{tech}"
                        tech_usage[key] = tech_usage.get(key, 0) + 1

            # Generate hypotheses for technologies used by 2+ competitors
            for key, count in tech_usage.items():
                if count >= 2:
                    category, tech = key.split(':', 1)

                    # Check if entity already has it
                    if not tech_stack.has_tech(category, tech):
                        hypothesis = {
                            'hypothesis_id': f"{entity_id}_{category}_{tech}_competitive",
                            'entity_id': entity_id,
                            'category': category,
                            'statement': f"{entity_name} may need {tech} to stay competitive ({count} competitors use it)",
                            'confidence': 0.55,
                            'source_type': 'competitor_pressure',
                            'metadata': {
                                'competitor_count': count,
                                'technology': tech,
                                'category': category,
                                'reason': 'Competitive pressure'
                            }
                        }

                        hypotheses.append(hypothesis)

        # 3. Gap analysis (missing critical technologies)
        critical_techs = {
            'frontend': ['React', 'Vue', 'Angular'],
            'backend': ['Node.js', 'Python', 'Java'],
            'mobile': ['React Native', 'Flutter', 'Swift']
        }

        for category, critical_list in critical_techs.items():
            for tech in critical_list:
                if not tech_stack.has_tech(category, tech):
                    # Check if partners have it
                    partners_with_tech = [
                        p for p in partners
                        if p.get('technology_stack', {}).to_dict().get(category, [])
                        and tech.lower() in str(p['technology_stack'].to_dict().get(category, [])).lower()
                    ]

                    if partners_with_tech:
                        hypothesis = {
                            'hypothesis_id': f"{entity_id}_{category}_{tech}_gap",
                            'entity_id': entity_id,
                            'category': category,
                            'statement': f"{entity_name} has technology gap in {tech} (partners have it)",
                            'confidence': 0.65,
                            'source_type': 'technology_gap',
                            'metadata': {
                                'technology': tech,
                                'category': category,
                                'gap_severity': 'medium',
                                'partners_with_tech': len(partners_with_tech)
                            }
                        }

                        hypotheses.append(hypothesis)

        return hypotheses

    async def _analyze_technology_diffusion(
        self,
        partners: List[Dict[str, Any]],
        tech_stack: TechnologyStack
    ) -> Dict[str, List[str]]:
        """
        Analyze technology diffusion patterns across network

        Tracks which technologies are spreading through the network

        Returns:
            Dict mapping technology -> list of entity IDs using it
        """
        diffusion = {}

        # Add entity's own technologies
        for category, techs in tech_stack.to_dict().items():
            for tech in techs:
                key = tech.lower()
                if key not in diffusion:
                    diffusion[key] = []
                diffusion[key].append("self")

        # Add partner technologies
        for partner in partners:
            partner_id = partner['id']
            partner_tech = partner.get('technology_stack', TechnologyStack())

            for category, techs in partner_tech.to_dict().items():
                for tech in techs:
                    key = tech.lower()
                    if key not in diffusion:
                        diffusion[key] = []
                    diffusion[key].append(partner_id)

        return diffusion

    async def calculate_network_influence_score(
        self,
        entity_id: str,
        hypothesis_category: str,
        hypothesis_id: str
    ) -> Dict[str, Any]:
        """
        Calculate how much network context influences hypothesis confidence

        Factors:
        - Partner adoption (partners using same tech)
        - Competitive pressure (competitors using tech)
        - Network centrality (well-connected entities)

        Args:
            entity_id: Entity identifier
            hypothesis_category: Category to check influence for
            hypothesis_id: Hypothesis identifier

        Returns:
            Influence score with supporting evidence
        """
        logger.info(f"🕸️ Calculating network influence for {hypothesis_category}")

        # Get network context
        network_context = await self.analyze_network_context(entity_id)

        base_score = 0.5
        evidence = []

        # 1. Partner influence (partners using same tech)
        partners_with_category = []
        for partner in network_context.partners:
            partner_tech = partner.get('technology_stack', TechnologyStack())
            techs = partner_tech.to_dict().get(hypothesis_category.lower(), [])

            if techs or hypothesis_category.lower() in str(partner_tech.to_dict()).lower():
                partners_with_category.append(partner['id'])
                base_score += 0.1

        if partners_with_category:
            evidence.append(f"{len(partners_with_category)} partners use {hypothesis_category}")

        # 2. Competitive pressure (competitors using tech)
        competitors_with_category = []
        for competitor in network_context.competitors:
            comp_tech = competitor.get('technology_stack', TechnologyStack())
            techs = comp_tech.to_dict().get(hypothesis_category.lower(), [])

            if techs or hypothesis_category.lower() in str(comp_tech.to_dict()).lower():
                competitors_with_category.append(competitor['id'])
                base_score += 0.08

        if competitors_with_category:
            evidence.append(f"{len(competitors_with_category)} competitors use {hypothesis_category}")

        # 3. Network centrality (number of connections)
        total_connections = (
            network_context.partner_count +
            network_context.competitor_count
        )

        if total_connections >= 10:
            base_score += 0.05
            evidence.append(f"High network centrality ({total_connections} connections)")
        elif total_connections >= 5:
            base_score += 0.03
            evidence.append(f"Moderate network centrality ({total_connections} connections)")

        # Normalize score
        influence_score = min(1.0, base_score)

        result = {
            'entity_id': entity_id,
            'hypothesis_id': hypothesis_id,
            'hypothesis_category': hypothesis_category,
            'influence_score': influence_score,
            'confidence_boost': influence_score * 0.1,  # Max +0.1 boost
            'evidence': evidence,
            'partners_with_category': partners_with_category,
            'competitors_with_category': competitors_with_category,
            'total_connections': total_connections
        }

        logger.info(f"  ✓ Influence score: {influence_score:.2f}")
        logger.info(f"  ✓ Confidence boost: +{result['confidence_boost']:.2f}")

        return result

    async def suggest_network_exploration_priority(
        self,
        entity_id: str
    ) -> List[Dict[str, Any]]:
        """
        Suggest which entities to explore next based on network analysis

        Priority factors:
        - High network centrality (well-connected)
        - Technology gaps (missing tech partners have)
        - Competitive opportunities

        Args:
            entity_id: Starting entity ID

        Returns:
            List of entities with priority scores
        """
        logger.info(f"🕸️ Calculating network exploration priority from {entity_id}")

        # Get network context
        network_context = await self.analyze_network_context(entity_id)

        # Get all connected entities (2 hops)
        client = await self._get_client()

        try:
            query = """
                MATCH (e {id: $entity_id})-[:PARTNER_OF|COMPETES_WITH*1..2]-(connected:Entity)
                RETURN DISTINCT connected.id as id,
                                connected.name as name,
                                connected.type as type,
                                COUNT {(e)-[:PARTNER_OF|COMPETES_WITH]->connected} as connection_count
                ORDER BY connection_count DESC
                LIMIT 20
            """

            results = await client.execute_query(query, {'entity_id': entity_id})

            priorities = []

            for result in results:
                connected_id = result['id']
                connection_count = result['connection_count']

                # Calculate priority score
                # Base: connection count
                score = connection_count * 0.1

                # Boost for tier 1 clubs (high value targets)
                if result.get('type') == 'ORG' and 'fc' in connected_id.lower():
                    score += 0.3

                # Get tech stack for connected entity
                try:
                    tech_stack = await self._get_technology_stack(connected_id, client)
                    tech_diversity = sum(len(techs) for techs in tech_stack.to_dict().values())

                    # Boost for tech diversity (more signals)
                    score += tech_diversity * 0.05
                except:
                    tech_diversity = 0

                # Normalize to 0-1
                priority_score = min(1.0, score / 5.0)

                priorities.append({
                    'entity_id': connected_id,
                    'entity_name': result['name'],
                    'connection_count': connection_count,
                    'tech_diversity': tech_diversity,
                    'priority_score': priority_score,
                    'reason': f"{connection_count} connections, {tech_diversify} tech categories"
                })

            # Sort by priority
            priorities.sort(key=lambda p: p['priority_score'], reverse=True)

            logger.info(f"  ✓ Suggested {len(priorities)} entities for exploration")

            return priorities

        except Exception as e:
            logger.warning(f"⚠️ Could not suggest exploration priorities: {e}")
            return []

    async def detect_technology_clusters(
        self,
        entity_ids: List[str],
        cluster_threshold: float = 0.3
    ) -> Dict[str, List[str]]:
        """
        Detect technology clusters across entities

        Groups entities by technology similarity.

        Args:
            entity_ids: List of entity IDs to analyze
            cluster_threshold: Similarity threshold for clustering

        Returns:
            Dict mapping cluster name -> list of entity IDs
        """
        logger.info(f"🕸️ Detecting technology clusters across {len(entity_ids)} entities")

        # Get technology stacks for all entities
        tech_stacks = {}
        client = await self._get_client()

        for entity_id in entity_ids:
            try:
                tech_stack = await self._get_technology_stack(entity_id, client)
                tech_stacks[entity_id] = tech_stack
            except Exception as e:
                logger.warning(f"⚠️ Could not get tech stack for {entity_id}: {e}")

        # Cluster by technology similarity
        clusters = {}
        entity_list = list(tech_stacks.keys())

        for entity_id in entity_list:
            tech_stack = tech_stacks[entity_id]
            best_cluster = None
            best_similarity = 0.0

            # Check against existing clusters
            for cluster_id, cluster_entities in clusters.items():
                # Calculate similarity to cluster (using first entity in cluster)
                sample_entity_id = cluster_entities[0]
                sample_tech = tech_stacks[sample_entity_id]

                similarity = self._calculate_tech_similarity(tech_stack, sample_tech)

                if similarity > best_similarity:
                    best_similarity = similarity
                    best_cluster = cluster_id

            # If found similar cluster, add to it
            if best_cluster and best_similarity >= cluster_threshold:
                clusters[best_cluster].append(entity_id)
            else:
                # Create new cluster
                cluster_id = f"cluster_{len(clusters)}"
                clusters[cluster_id] = [entity_id]

        logger.info(f"  ✓ Detected {len(clusters)} technology clusters")

        return clusters

    def _calculate_tech_similarity(
        self,
        tech_stack1: TechnologyStack,
        tech_stack2: TechnologyStack
    ) -> float:
        """
        Calculate similarity between two technology stacks

        Uses Jaccard similarity on technology sets.

        Args:
            tech_stack1: First technology stack
            tech_stack2: Second technology stack

        Returns:
            Similarity score (0.0-1.0)
        """
        # Flatten to sets
        set1 = set()
        set2 = set()

        for category, techs in tech_stack1.to_dict().items():
            for tech in techs:
                set1.add(f"{category}:{tech}".lower())

        for category, techs in tech_stack2.to_dict().items():
            for tech in techs:
                set2.add(f"{category}:{tech}".lower())

        if not set1 and not set2:
            return 1.0

        # Jaccard similarity
        intersection = len(set1 & set2)
        union = len(set1 | set2)

        if union == 0:
            return 0.0

        return intersection / union


# =============================================================================
# Convenience Functions
# =============================================================================

async def analyze_entity_network(
    entity_id: str,
    force_refresh: bool = False
) -> NetworkContext:
    """
    Convenience function to analyze entity network

    Args:
        entity_id: Entity identifier
        force_refresh: Force refresh from DB

    Returns:
        NetworkContext with all network intelligence
    """
    analyzer = GraphRelationshipAnalyzer()
    return await analyzer.analyze_network_context(entity_id, force_refresh)


async def get_network_influence(
    entity_id: str,
    hypothesis_category: str,
    hypothesis_id: str
) -> Dict[str, Any]:
    """
    Convenience function to get network influence score

    Args:
        entity_id: Entity identifier
        hypothesis_category: Category to check
        hypothesis_id: Hypothesis ID

    Returns:
        Influence score with evidence
    """
    analyzer = GraphRelationshipAnalyzer()
    return await analyzer.calculate_network_influence_score(
        entity_id, hypothesis_category, hypothesis_id
    )


async def suggest_exploration_order(
    entity_id: str,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Convenience function to suggest exploration order

    Args:
        entity_id: Starting entity ID
        limit: Maximum entities to suggest

    Returns:
        List of entities with priority scores
    """
    analyzer = GraphRelationshipAnalyzer()
    priorities = await analyzer.suggest_network_exploration_priority(entity_id)

    return priorities[:limit]


if __name__ == "__main__":
    # Test network relationship analyzer
    import asyncio

    async def test():
        print("=== Testing Graph Relationship Analyzer ===\n")

        analyzer = GraphRelationshipAnalyzer()

        # Test 1: Analyze network context
        print("Test 1: Analyzing network context...")
        context = await analyzer.analyze_network_context(
            entity_id="arsenal-fc"
        )

        print(f"\n✅ Network Context:")
        print(f"  Partners: {len(context.partners)}")
        print(f"  Competitors: {len(context.competitors)}")
        print(f"  Tech categories: {len(context.technology_stack.to_dict())}")
        print(f"  Network hypotheses: {len(context.network_hypotheses)}")
        print(f"  Diffusion patterns: {len(context.technology_diffusion)}")

        # Test 2: Network influence score
        print("\nTest 2: Calculating network influence...")
        influence = await analyzer.calculate_network_influence_score(
            entity_id="arsenal-fc",
            hypothesis_category="React Development",
            hypothesis_id="arsenal_react_dev"
        )

        print(f"\n✅ Network Influence:")
        print(f"  Influence score: {influence['influence_score']:.2f}")
        print(f"  Confidence boost: +{influence['confidence_boost']:.2f}")
        print(f"  Evidence: {influence['evidence']}")

        # Test 3: Exploration priority
        print("\nTest 3: Suggesting exploration order...")
        priorities = await analyzer.suggest_network_exploration_priority(
            entity_id="arsenal-fc",
            limit=5
        )

        print(f"\n✅ Exploration Priorities:")
        for i, priority in enumerate(priorities[:5], 1):
            print(f"  {i}. {priority['entity_name']}: {priority['priority_score']:.2f}")
            print(f"     Reason: {priority['reason']}")

        print("\n✅ Test complete")

    asyncio.run(test())
