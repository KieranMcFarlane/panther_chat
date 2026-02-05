"""
Scrape Agent - Content Extraction Specialist

Autonomous agent for intelligent content extraction and profile building.

Capabilities:
- Decides which URLs are worth scraping
- Manages scraping depth and token limits
- Extracts structured entity profiles
- Identifies technology stacks and partnerships
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class ScrapeAgent:
    """
    Content Extraction Specialist

    Decides:
    1. Which URLs are worth scraping
    2. Scraping depth (single page vs. follow links)
    3. When to truncate (token limits)
    4. What to extract

    Extraction Focus:
    - Technology stack (CRM, ERP, Analytics)
    - Vendor partnerships
    - Digital maturity indicators
    - Stakeholders (CTO, CIO, etc.)
    - Timeline clues (launch dates, implementations)
    """

    SYSTEM_PROMPT = """You are a Content Extraction Specialist for digital procurement intelligence.

Your goal is to extract structured intelligence from web content.

URL Selection Strategy:
- Priority 1: Official domains (careers, about, technology pages)
- Priority 2: Press releases and news
- Priority 3: Job postings (reveal tech stack)
- Priority 4: Case studies and partnerships

Scraping Strategy:
- Start with official domain main page
- Follow links to: careers, technology, about, news
- Skip: login pages, user forums, generic content
- Stop when: token limit reached, or 5 pages scraped

Extraction Focus:
1. Technology Stack
   - CRM: Salesforce, HubSpot, Microsoft Dynamics, etc.
   - Analytics: Google Analytics, Adobe Analytics, Tableau, etc.
   - ERP: SAP, Oracle, Microsoft, etc.
   - E-commerce: Shopify, Magento, WooCommerce, etc.

2. Vendor Partnerships
   - Technology resellers
   - Integration partners
   - Strategic alliances

3. Digital Maturity
   - Modern tech stack
   - Data-driven approach mentioned
   - Digital transformation initiatives
   - Innovation/technology in leadership bios

4. Stakeholders
   - CTO, CIO, Head of Digital
   - Contact information
   - Decision makers

5. Timeline Clues
   - System launch dates
   - Implementation announcements
   - Hiring dates for tech roles

Return JSON structure:
{
  "entity_profile": {
    "name": "Entity Name",
    "domain": "example.com",
    "technology_stack": {
      "crm": ["Salesforce"],
      "analytics": ["Google Analytics", "Tableau"],
      "erp": ["SAP"]
    },
    "vendor_partnerships": ["Partner1", "Partner2"],
    "digital_maturity": "HIGH" | "MEDIUM" | "LOW",
    "stakeholders": [{"role": "CTO", "name": "John Doe"}],
    "timeline_clues": ["Launched new CRM in 2023"]
  },
  "pages_scraped": 3,
  "total_tokens": 5000,
  "confidence": 0.85
}"""

    def __init__(self):
        """Initialize Scrape Agent"""
        from backend.agent_sdk.client_factory import create_discovery_client

        self.client = create_discovery_client(system_prompt=self.SYSTEM_PROMPT)
        self.max_pages = 5
        self.max_tokens_per_page = 25000
        self.max_total_tokens = 10000

        logger.info("📄 Scrape Agent initialized")

    async def extract_entity_profile(
        self,
        entity_name: str,
        urls: List[str],
        max_tokens: int = 10000,
        max_pages: int = 5
    ) -> Dict[str, Any]:
        """
        Extract structured entity profile from URLs

        Args:
            entity_name: Name of the entity
            urls: List of URLs to scrape
            max_tokens: Maximum total tokens to process
            max_pages: Maximum number of pages to scrape

        Returns:
            Dict with entity_profile, pages_scraped, confidence
        """
        logger.info(f"📄 Extracting profile for: {entity_name} ({len(urls)} URLs)")

        prompt = f"""Extract structured entity profile for: {entity_name}

URLs to scrape:
{json.dumps(urls, indent=2)}

Constraints:
- Maximum {max_pages} pages to scrape
- Maximum {max_tokens} total tokens
- Each page max {self.max_tokens_per_page} characters

Use scrape_url and scrape_batch tools to:
1. Prioritize official domains and careers pages
2. Extract technology stack indicators
3. Identify vendor partnerships
4. Assess digital maturity
5. Find stakeholder information

Return JSON with the complete entity profile."""

        try:
            # Query the agent
            result = await self.client.query(prompt, max_tokens=4000)

            content = result.get("content", "")

            # Try to extract JSON from response
            json_data = self._extract_json(content)

            if json_data:
                profile = json_data.get("entity_profile", {})
                logger.info(f"✅ Profile extracted: {profile.get('digital_maturity', 'unknown')} maturity")
                return json_data
            else:
                # Fallback: parse content
                return self._parse_profile_response(content, entity_name, urls)

        except Exception as e:
            logger.error(f"❌ Profile extraction failed: {e}")

            # Return minimal result
            return {
                "entity_profile": {
                    "name": entity_name,
                    "domain": urls[0] if urls else None,
                    "technology_stack": {},
                    "vendor_partnerships": [],
                    "digital_maturity": "UNKNOWN",
                    "stakeholders": [],
                    "timeline_clues": []
                },
                "pages_scraped": 0,
                "total_tokens": 0,
                "confidence": 0.0,
                "error": str(e)
            }

    async def scrape_and_analyze(
        self,
        url: str,
        entity_name: str,
        focus_areas: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Scrape single URL and analyze for specific focus areas

        Args:
            url: URL to scrape
            entity_name: Entity name
            focus_areas: List of focus areas (e.g., ["crm", "analytics", "partnerships"])

        Returns:
            Dict with scraped content and analysis
        """
        focus_areas = focus_areas or ["technology", "partnerships", "maturity"]

        logger.info(f"📄 Scraping and analyzing: {url}")

        prompt = f"""Scrape and analyze: {url} for {entity_name}

Focus areas:
{json.dumps(focus_areas, indent=2)}

Use scrape_url tool to extract content, then analyze for:
- Technology stack indicators
- Vendor partnerships mentioned
- Digital maturity signals
- Any other procurement intelligence

Return JSON with findings."""

        try:
            result = await self.client.query(prompt, max_tokens=3000)

            content = result.get("content", "")
            json_data = self._extract_json(content)

            if json_data:
                logger.info(f"✅ Analysis complete for {url}")
                return json_data
            else:
                return {
                    "url": url,
                    "entity_name": entity_name,
                    "findings": content,
                    "structured_data": {},
                    "confidence": 0.5
                }

        except Exception as e:
            logger.error(f"❌ Scrape and analyze failed: {e}")
            return {
                "url": url,
                "error": str(e),
                "confidence": 0.0
            }

    def _extract_json(self, content: str) -> Optional[Dict[str, Any]]:
        """Extract JSON from agent response"""
        try:
            import re

            # Look for JSON code blocks
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)

            if not json_match:
                # Try to find bare JSON object
                json_match = re.search(r'\{[^{}]*"entity_profile"[^{}]*\}', content, re.DOTALL)

            if json_match:
                json_str = json_match.group(1) if json_match.lastindex else json_match.group(0)
                return json.loads(json_str)

        except Exception as e:
            logger.warning(f"⚠️ JSON extraction failed: {e}")

        return None

    def _parse_profile_response(
        self,
        content: str,
        entity_name: str,
        urls: List[str]
    ) -> Dict[str, Any]:
        """Fallback parser for profile response"""
        # Simple heuristic extraction
        import re

        # Look for technology mentions
        tech_keywords = {
            "crm": ["salesforce", "hubspot", "dynamics", "sap", "oracle"],
            "analytics": ["google analytics", "adobe", "tableau", "power bi", "looker"],
            "erp": ["sap", "oracle", "microsoft dynamics", "netsuite"]
        }

        found_tech = {}
        content_lower = content.lower()

        for category, keywords in tech_keywords.items():
            found = [kw for kw in keywords if kw in content_lower]
            if found:
                found_tech[category] = found

        return {
            "entity_profile": {
                "name": entity_name,
                "domain": urls[0] if urls else None,
                "technology_stack": found_tech,
                "vendor_partnerships": [],
                "digital_maturity": "MEDIUM" if found_tech else "LOW",
                "stakeholders": [],
                "timeline_clues": []
            },
            "pages_scraped": len(urls),
            "total_tokens": len(content.split()),
            "confidence": 0.4,
            "note": "Parsed from text content (low confidence)"
        }


# =============================================================================
# Convenience Functions
# =============================================================================

async def extract_entity_profile_from_urls(
    entity_name: str,
    urls: List[str],
    max_tokens: int = 10000,
    max_pages: int = 5
) -> Dict[str, Any]:
    """
    Convenience function to extract entity profile

    Args:
        entity_name: Name of the entity
        urls: List of URLs to scrape
        max_tokens: Maximum total tokens
        max_pages: Maximum pages to scrape

    Returns:
        Dict with entity profile
    """
    agent = ScrapeAgent()
    return await agent.extract_entity_profile(entity_name, urls, max_tokens, max_pages)


if __name__ == "__main__":
    import asyncio

    async def test_scrape_agent():
        """Test Scrape Agent"""
        print("Testing Scrape Agent...")

        agent = ScrapeAgent()

        # Test profile extraction
        print("\n1. Testing profile extraction...")
        result = await agent.extract_entity_profile(
            "Arsenal FC",
            ["https://arsenal.com"],
            max_tokens=5000,
            max_pages=2
        )
        print(f"Result: {json.dumps(result, indent=2)}")

        print("\n✅ Tests complete!")

    asyncio.run(test_scrape_agent())
