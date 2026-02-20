"""
Entity Domain Discovery

Multi-strategy domain discovery for entities using Claude Agent SDK.

Uses Claude as subagent for complex reasoning:
- Google search strategy formulation
- Heuristic pattern matching
- FalkorDB relationship queries
- Cross-validation strategies

Returns: List of discovered domains (e.g., ["bvb.de", "borussia-dortmund.de"])

Example:
    discovery = EntityDomainDiscovery()
    domains = await discovery.discover_domain('Borussia Dortmund')
    # Returns: ['bvb.de', 'borussia-dortmund.de']
"""

import asyncio
import json
import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class EntityDomainDiscovery:
    """
    Multi-strategy domain discovery for entities

    Uses Claude Agent SDK as subagent for complex reasoning:
    - Google search strategy formulation
    - Heuristic pattern matching
    - FalkorDB relationship queries
    - Cross-validation strategies

    Attributes:
        claude_client: ClaudeClient for API calls
        falkordb_driver: FalkorDB driver for graph queries
        cache: In-memory cache for discovered domains
    """

    def __init__(self, claude_client=None, falkordb_driver=None):
        """
        Initialize entity domain discovery

        Args:
            claude_client: Optional ClaudeClient (creates default if not provided)
            falkordb_driver: Optional FalkorDB driver (creates default if not provided)
        """
        from backend.claude_client import ClaudeClient

        self.claude = claude_client or ClaudeClient()
        self.falkordb_driver = falkordb_driver
        self.cache = {}  # entity_name -> discovered_domains

        logger.info("🔍 EntityDomainDiscovery initialized")

    async def discover_domain(
        self,
        entity_name: str,
        use_cache: bool = True,
        max_strategies: int = 3
    ) -> List[str]:
        """
        Discover domains for entity using multiple strategies

        Process:
        1. Check cache (if enabled)
        2. Use Claude subagent to plan discovery strategies
        3. Execute strategies in parallel
        4. Cross-validate and merge results
        5. Cache discovered domains

        Args:
            entity_name: Name of entity (e.g., "Borussia Dortmund")
            use_cache: Whether to use cached results (default: True)
            max_strategies: Maximum number of strategies to execute (default: 3)

        Returns:
            List of discovered domains (e.g., ["bvb.de", "borussia-dortmund.de"])
        """
        # Check cache
        if use_cache and entity_name in self.cache:
            logger.info(f"✅ Cache hit for {entity_name}")
            return self.cache[entity_name]

        logger.info(f"🔍 Discovering domains for {entity_name}")

        # Use Claude subagent to plan discovery strategies
        discovery_plan = await self._plan_discovery_strategies(entity_name)

        logger.info(f"📋 Discovery plan: {len(discovery_plan['strategies'])} strategies")

        # Execute strategies
        all_domains = []

        for strategy in discovery_plan['strategies'][:max_strategies]:
            try:
                domains = await self._execute_strategy(entity_name, strategy)
                all_domains.extend(domains)
            except Exception as e:
                logger.warning(f"⚠️ Strategy '{strategy['name']}' failed: {e}")
                continue

        # Cross-validate and deduplicate
        validated_domains = self._cross_validate_domains(entity_name, all_domains)

        # Cache results
        self.cache[entity_name] = validated_domains

        logger.info(f"✅ Discovered {len(validated_domains)} domains for {entity_name}: {validated_domains}")

        return validated_domains

    async def _plan_discovery_strategies(self, entity_name: str) -> Dict[str, Any]:
        """
        Use Claude subagent to plan domain discovery strategies

        Claude reasons about:
        - Search strategies: "Borussia Dortmund official website"
        - Heuristics: "Pattern: borussia*dortmund*.de"
        - FalkorDB query: "RELATED clubs and their domains"
        - Cross-validation: "Check .de TLD expectations"

        Args:
            entity_name: Entity to discover domains for

        Returns:
            Discovery plan with strategies
        """
        system_prompt = """You are a domain discovery strategist. Plan multi-strategy domain discovery for sports entities.

Analyze the entity name and create a discovery plan that:
1. Identifies likely TLDs (.com, .de, .uk, .es, etc.)
2. Suggests search queries for official website
3. Proposes heuristic patterns (abbreviations, acronyms)
4. Recommends FalkorDB graph queries (related entities)
5. Estimates confidence for each strategy

Respond in JSON format:
{
  "likely_tlds": [".com", ".de", ".org"],
  "search_queries": [
    "Borussia Dortmund official website",
    "BVB.de official site"
  ],
  "heuristic_patterns": [
    "borussia*dortmund*.de",
    "bvb*.de"
  ],
  "falkordb_queries": [
    "MATCH (e:Club)-[:RELATED_TO]->(c:Club {name: 'Borussia Dortmund'}) RETURN c.domain"
  ],
  "strategies": [
    {
      "name": "Google search",
      "type": "search",
      "query": "Borussia Dortmund official website",
      "confidence": 0.9
    },
    {
      "name": "Heuristic pattern",
      "type": "heuristic",
      "pattern": "bvb*.de",
      "confidence": 0.8
    },
    {
      "name": "FalkorDB graph query",
      "type": "graph",
      "query": "MATCH (e:Club)-[:RELATED_TO]->(c:Club {name: 'Borussia Dortmund'}) RETURN c.domain",
      "confidence": 0.7
    }
  ]
}

Be specific and realistic. Focus on high-confidence strategies."""

        user_prompt = f"""Entity: {entity_name}

Plan domain discovery strategies for this entity.

Consider:
1. What country/region is this entity from? (affects TLD)
2. Are there common abbreviations? (e.g., "BVB" for Borussia Dortmund)
3. What search queries would find the official website?
4. What heuristic patterns would match their domain?
5. What FalkorDB graph queries could help?

Create a comprehensive discovery plan."""

        try:
            response = await self.claude.query(
                prompt=user_prompt,
                system_prompt=system_prompt,
                model="haiku",  # Fast planning
                max_tokens=1500
            )

            # Parse JSON from response
            content = response.get("content", "{}")

            # Extract JSON
            if "```json" in content:
                json_start = content.find("```json") + 7
                json_end = content.find("```", json_start)
                content = content[json_start:json_end].strip()
            elif "```" in content:
                json_start = content.find("```") + 3
                json_end = content.find("```", json_start)
                content = content[json_start:json_end].strip()

            plan = json.loads(content)

            # Add defaults if missing
            if "strategies" not in plan:
                plan["strategies"] = self._default_strategies(entity_name)
            if "likely_tlds" not in plan:
                plan["likely_tlds"] = [".com", ".org"]
            if "search_queries" not in plan:
                plan["search_queries"] = [f"{entity_name} official website"]
            if "heuristic_patterns" not in plan:
                plan["heuristic_patterns"] = []
            if "falkordb_queries" not in plan:
                plan["falkordb_queries"] = []

            return plan

        except Exception as e:
            logger.error(f"Error planning discovery strategies: {e}")
            # Fallback to default strategies
            return {
                "likely_tlds": [".com", ".org"],
                "search_queries": [f"{entity_name} official website"],
                "heuristic_patterns": [],
                "falkordb_queries": [],
                "strategies": self._default_strategies(entity_name)
            }

    def _default_strategies(self, entity_name: str) -> List[Dict[str, Any]]:
        """Generate default discovery strategies"""
        return [
            {
                "name": "Google search",
                "type": "search",
                "query": f"{entity_name} official website",
                "confidence": 0.8
            },
            {
                "name": "Heuristic pattern",
                "type": "heuristic",
                "pattern": f"{entity_name.lower().replace(' ', '*')}.*",
                "confidence": 0.6
            }
        ]

    async def _execute_strategy(
        self,
        entity_name: str,
        strategy: Dict[str, Any]
    ) -> List[str]:
        """
        Execute a single discovery strategy

        Args:
            entity_name: Entity to discover domains for
            strategy: Strategy dictionary with type, query, pattern, etc.

        Returns:
            List of discovered domains
        """
        strategy_type = strategy.get("type")

        if strategy_type == "search":
            return await self._execute_search_strategy(entity_name, strategy)
        elif strategy_type == "heuristic":
            return self._execute_heuristic_strategy(entity_name, strategy)
        elif strategy_type == "graph":
            return await self._execute_graph_strategy(entity_name, strategy)
        else:
            logger.warning(f"Unknown strategy type: {strategy_type}")
            return []

    async def _execute_search_strategy(
        self,
        entity_name: str,
        strategy: Dict[str, Any]
    ) -> List[str]:
        """
        Execute search-based discovery strategy

        Args:
            entity_name: Entity to search for
            strategy: Strategy with search query

        Returns:
            List of discovered domains
        """
        query = strategy.get("query", f"{entity_name} official website")

        logger.info(f"🔍 Executing search strategy: {query}")

        try:
            # Use BrightData SDK client for search
            from backend.brightdata_sdk_client import BrightDataSDKClient

            brightdata = BrightDataSDKClient()
            search_result = await brightdata.search_engine(query, engine="google", num_results=10)

            if search_result.get("status") == "success":
                results = search_result.get("results", [])

                # Extract domains from search results
                domains = []
                for result in results:
                    url = result.get("url", "")
                    domain = self._extract_domain_from_url(url)
                    if domain:
                        domains.append(domain)

                logger.info(f"✅ Search strategy found {len(domains)} domains")
                return domains[:5]  # Top 5 results
            else:
                logger.warning(f"Search failed: {search_result.get('error')}")
                return []

        except Exception as e:
            logger.error(f"Search strategy error: {e}")
            return []

    def _execute_heuristic_strategy(
        self,
        entity_name: str,
        strategy: Dict[str, Any]
    ) -> List[str]:
        """
        Execute heuristic-based discovery strategy

        Args:
            entity_name: Entity to generate heuristics for
            strategy: Strategy with heuristic pattern

        Returns:
            List of predicted domains
        """
        pattern = strategy.get("pattern", "")

        logger.info(f"🎯 Executing heuristic strategy: {pattern}")

        try:
            # Generate domains from pattern
            domains = []

            # Pattern: "borussia*dortmund*.de" -> ["borussia-dortmund.de"]
            if "*" in pattern:
                # Replace wildcards with common separators
                variants = [
                    pattern.replace("*", "-"),
                    pattern.replace("*", ""),
                    pattern.replace("*", ".")
                ]
                domains.extend(variants)
            else:
                domains.append(pattern)

            # Add common TLDs if not specified
            domains_with_tlds = []
            for domain in domains:
                if "." not in domain:
                    for tld in [".com", ".org", ".de", ".co.uk", ".es"]:
                        domains_with_tlds.append(domain + tld)
                else:
                    domains_with_tlds.append(domain)

            logger.info(f"✅ Heuristic strategy generated {len(domains_with_tlds)} domains")
            return domains_with_tlds[:5]

        except Exception as e:
            logger.error(f"Heuristic strategy error: {e}")
            return []

    async def _execute_graph_strategy(
        self,
        entity_name: str,
        strategy: Dict[str, Any]
    ) -> List[str]:
        """
        Execute FalkorDB graph-based discovery strategy

        Args:
            entity_name: Entity to query graph for
            strategy: Strategy with Cypher query

        Returns:
            List of discovered domains from related entities
        """
        query = strategy.get("query", "")

        logger.info(f"📊 Executing graph strategy: {query[:50]}...")

        try:
            if not self.falkordb_driver:
                logger.warning("FalkorDB driver not available")
                return []

            # Execute Cypher query
            result = self.falkordb_driver.run(query)

            # Extract domains from results
            domains = []
            for record in result:
                domain = record.get("domain") or record.get("c.domain")
                if domain:
                    domains.append(domain)

            logger.info(f"✅ Graph strategy found {len(domains)} domains")
            return domains[:5]

        except Exception as e:
            logger.error(f"Graph strategy error: {e}")
            return []

    def _extract_domain_from_url(self, url: str) -> Optional[str]:
        """
        Extract domain from URL with validation

        Args:
            url: Full URL (e.g., "https://www.arsenal.com/news")

        Returns:
            Domain without protocol (e.g., "arsenal.com") or None if invalid
        """
        try:
            # Remove protocol
            if "://" in url:
                url = url.split("://")[1]

            # Remove path
            if "/" in url:
                url = url.split("/")[0]

            # Remove port
            if ":" in url:
                url = url.split(":")[0]

            # Remove www.
            if url.startswith("www."):
                url = url[4:]

            # Validate domain has a proper TLD
            # Must have at least one dot and end with a known TLD (2-6+ chars)
            # Supports multi-part TLDs like "co.uk", "com.au", etc.
            import re
            # Pattern: domain.tld or domain.co.uk, etc.
            # - Starts with alphanumeric
            # - Has at least one dot
            # - Ends with 2-6 char TLD (possibly with another 2-6 char TLD)
            domain_pattern = r'^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,6}(\.[a-zA-Z]{2,6})?$'
            if not re.match(domain_pattern, url):
                logger.debug(f"Invalid domain format: {url}")
                return None

            return url

        except Exception:
            return None

    def _cross_validate_domains(
        self,
        entity_name: str,
        domains: List[str]
    ) -> List[str]:
        """
        Cross-validate and deduplicate discovered domains

        Args:
            entity_name: Entity for validation context
            domains: List of discovered domains (may contain duplicates)

        Returns:
            Validated, deduplicated domains sorted by relevance
        """
        if not domains:
            return []

        # Deduplicate
        unique_domains = list(set(domains))

        # Score domains by relevance
        scored_domains = []
        for domain in unique_domains:
            score = self._score_domain_relevance(entity_name, domain)
            scored_domains.append((domain, score))

        # Sort by score (descending)
        scored_domains.sort(key=lambda x: x[1], reverse=True)

        # Filter low-confidence domains
        validated = [d for d, score in scored_domains if score > 0.3]

        return validated[:5]  # Top 5 domains

    def _score_domain_relevance(self, entity_name: str, domain: str) -> float:
        """
        Score domain relevance to entity

        Args:
            entity_name: Entity name
            domain: Domain to score

        Returns:
            Relevance score (0.0 to 1.0)
        """
        score = 0.0
        domain_lower = domain.lower()
        entity_lower = entity_name.lower()

        # Exact match
        if entity_lower.replace(" ", "") in domain_lower:
            score += 0.5

        # Partial match (words)
        entity_words = entity_lower.split()
        for word in entity_words:
            if word in domain_lower:
                score += 0.2

        # Common sports domain patterns
        if any(tld in domain_lower for tld in [".fc", "-fc-", "official", "club"]):
            score += 0.1

        # Country-specific TLDs
        if any(domain_lower.endswith(tld) for tld in [".de", ".uk", ".es", ".it", ".fr"]):
            score += 0.1

        return min(score, 1.0)


# =============================================================================
# Convenience Functions
# =============================================================================

async def discover_entity_domain(
    entity_name: str,
    use_cache: bool = True
) -> List[str]:
    """
    Convenience function to discover entity domains

    Args:
        entity_name: Entity to discover domains for
        use_cache: Whether to use cached results

    Returns:
        List of discovered domains
    """
    discovery = EntityDomainDiscovery()
    return await discovery.discover_domain(entity_name, use_cache=use_cache)


# =============================================================================
# Test / Main
# =============================================================================

if __name__ == "__main__":
    async def test_discovery():
        """Test entity domain discovery"""
        discovery = EntityDomainDiscovery()

        # Test with known entity
        print("=== Testing Domain Discovery ===")

        test_entity = "Borussia Dortmund"
        domains = await discovery.discover_domain(test_entity)

        print(f"\nEntity: {test_entity}")
        print(f"Discovered {len(domains)} domains:")
        for i, domain in enumerate(domains, 1):
            print(f"  {i}. {domain}")

        # Test cache hit
        print("\n=== Testing Cache ===")
        domains_cached = await discovery.discover_domain(test_entity)
        print(f"Cache hit: {domains == domains_cached}")

    asyncio.run(test_discovery())
