"""
Search Agent - Domain Discovery Specialist

Autonomous agent for discovering official domains and web presence.

Capabilities:
- Multi-engine search strategy (Google, Bing, Yandex)
- Query refinement based on findings
- Domain validation and prioritization
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class SearchAgent:
    """
    Search Specialist for digital procurement intelligence

    Decides:
    1. Optimal search strategy (Google vs Bing vs Yandex)
    2. Query refinement based on findings
    3. When to stop searching

    Frameworks:
    - Google: Official websites, general info
    - Bing: Alternative results
    - Yandex: International entities
    """

    SYSTEM_PROMPT = """You are a Search Specialist for digital procurement intelligence.

Your goal is to discover official domains and web presence for entities.

Search Strategy:
1. Start with Google for official websites and general info
2. Use Bing for alternative results if Google misses relevant content
3. Use Yandex for international entities (European clubs, etc.)

Query Refinement:
- Start with broad: "{entity_name} official website"
- Narrow down: "{entity_name} CRM analytics digital"
- Specific searches: "{entity_name} careers jobs", "{entity_name} press release"

Domain Validation:
- Prioritize official domains (e.g., arsenal.com, not arsenal-fc-fans.com)
- Look for verified badges or official social media links
- Check for careers pages (indicates size/maturity)
- Check for news/press sections (indicates activity)

Stop Criteria:
- Found official domain + careers + press sections
- 3 consecutive searches return irrelevant results
- Max iterations reached

Return JSON structure:
{
  "primary_domain": "example.com",
  "subdomains": ["careers.example.com", "news.example.com"],
  "confidence": 0.95,
  "searches_performed": 5,
  "reasoning": "Found official domain with careers and press sections"
}"""

    def __init__(self):
        """Initialize Search Agent"""
        from backend.agent_sdk.client_factory import create_discovery_client

        self.client = create_discovery_client(system_prompt=self.SYSTEM_PROMPT)
        self.max_iterations = 5
        self.max_results_per_search = 10

        logger.info("🔍 Search Agent initialized")

    async def discover_domains(
        self,
        entity_name: str,
        entity_type: str = "organization",
        max_iterations: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Discover official domains for an entity

        Args:
            entity_name: Name of the entity (e.g., "Arsenal FC")
            entity_type: Type of entity (organization, person, etc.)
            max_iterations: Maximum search iterations (default: 5)

        Returns:
            Dict with primary_domain, subdomains, confidence, reasoning
        """
        max_iterations = max_iterations or self.max_iterations

        logger.info(f"🔍 Discovering domains for: {entity_name}")

        prompt = f"""Search for official domains and web presence for: {entity_name} ({entity_type})

Perform up to {max_iterations} searches to discover:
1. Primary official domain
2. Key subdomains (careers, news, press, etc.)
3. Official social media profiles
4. Technology indicators

Use the available search tools to:
- Start with broad searches for official websites
- Narrow down to specific pages (careers, news)
- Validate domain authenticity

Return JSON with your findings."""

        try:
            # Query the agent
            result = await self.client.query(prompt, max_tokens=3000)

            content = result.get("content", "")

            # Try to extract JSON from response
            json_data = self._extract_json(content)

            if json_data:
                logger.info(f"✅ Domains discovered: {json_data.get('primary_domain', 'unknown')}")
                return json_data
            else:
                # Fallback: parse content
                return self._parse_domain_response(content, entity_name)

        except Exception as e:
            logger.error(f"❌ Domain discovery failed: {e}")

            # Return minimal result
            return {
                "primary_domain": None,
                "subdomains": [],
                "confidence": 0.0,
                "searches_performed": 0,
                "reasoning": f"Discovery failed: {str(e)}",
                "error": str(e)
            }

    async def validate_domain(
        self,
        domain: str,
        entity_name: str
    ) -> Dict[str, Any]:
        """
        Validate that a domain is official and belongs to the entity

        Args:
            domain: Domain to validate
            entity_name: Entity name to check against

        Returns:
            Dict with validation result and confidence
        """
        logger.info(f"🔍 Validating domain: {domain}")

        prompt = f"""Validate if {domain} is the official domain for {entity_name}.

Search for:
1. Official website branding matching {entity_name}
2. Contact information or address
3. Official social media links
4. Copyright notices or footer information

Use scrape_url tool to examine the domain content if needed.

Return JSON:
{{
  "is_official": true/false,
  "confidence": 0.95,
  "evidence": ["Official branding found", "Contact info matches", ...]
}}"""

        try:
            result = await self.client.query(prompt, max_tokens=2000)

            content = result.get("content", "")
            json_data = self._extract_json(content)

            if json_data:
                logger.info(f"✅ Domain validation: {json_data.get('is_official', 'unknown')}")
                return json_data
            else:
                return {
                    "is_official": False,
                    "confidence": 0.0,
                    "evidence": ["Could not validate"],
                    "error": "Failed to parse validation response"
                }

        except Exception as e:
            logger.error(f"❌ Domain validation failed: {e}")
            return {
                "is_official": False,
                "confidence": 0.0,
                "error": str(e)
            }

    def _extract_json(self, content: str) -> Optional[Dict[str, Any]]:
        """Extract JSON from agent response"""
        try:
            # Try to find JSON in content
            import re

            # Look for JSON code blocks
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)

            if not json_match:
                # Try to find bare JSON object
                json_match = re.search(r'\{[^{}]*"primary_domain"[^{}]*\}', content, re.DOTALL)

            if json_match:
                json_str = json_match.group(1) if json_match.lastindex else json_match.group(0)
                return json.loads(json_str)

        except Exception as e:
            logger.warning(f"⚠️ JSON extraction failed: {e}")

        return None

    def _parse_domain_response(
        self,
        content: str,
        entity_name: str
    ) -> Dict[str, Any]:
        """Fallback parser for domain response"""
        # Simple heuristic extraction
        import re

        # Look for domain patterns
        domains = re.findall(r'(https?://(?:www\.)?[\w\-]+\.[\w\.]+)', content)

        if domains:
            primary = domains[0].replace("https://", "").replace("http://", "").replace("www.", "")
            return {
                "primary_domain": primary,
                "subdomains": [],
                "confidence": 0.5,
                "searches_performed": 1,
                "reasoning": "Extracted from search results (low confidence - manual review needed)"
            }

        return {
            "primary_domain": None,
            "subdomains": [],
            "confidence": 0.0,
            "searches_performed": 0,
            "reasoning": "No domains found in response"
        }


# =============================================================================
# Convenience Functions
# =============================================================================

async def discover_entity_domains(
    entity_name: str,
    entity_type: str = "organization",
    max_iterations: int = 5
) -> Dict[str, Any]:
    """
    Convenience function to discover entity domains

    Args:
        entity_name: Name of the entity
        entity_type: Type of entity
        max_iterations: Maximum search iterations

    Returns:
        Dict with discovered domains
    """
    agent = SearchAgent()
    return await agent.discover_domains(entity_name, entity_type, max_iterations)


if __name__ == "__main__":
    import asyncio

    async def test_search_agent():
        """Test Search Agent"""
        print("Testing Search Agent...")

        agent = SearchAgent()

        # Test domain discovery
        print("\n1. Testing domain discovery...")
        result = await agent.discover_domains("Arsenal FC", max_iterations=3)
        print(f"Result: {json.dumps(result, indent=2)}")

        # Test domain validation
        if result.get("primary_domain"):
            print("\n2. Testing domain validation...")
            validation = await agent.validate_domain(result["primary_domain"], "Arsenal FC")
            print(f"Validation: {json.dumps(validation, indent=2)}")

        print("\n✅ Tests complete!")

    asyncio.run(test_search_agent())
