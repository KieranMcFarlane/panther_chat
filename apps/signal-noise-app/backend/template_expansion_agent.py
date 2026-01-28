"""
Template Expansion Agent

Uses Claude Agent SDK to orchestrate BrightData scraping and expand templates
with live data from real entities.

Process:
1. Load template (defines signal channels and patterns)
2. Use Claude to identify what data to collect
3. Orchestrate BrightData scraping via SDK (with HTTP fallback)
4. Extract real signal examples from scraped data
5. Expand template with live data (actual URLs, examples, signals)
6. Store enriched template for future use

Goal: Transform static templates into living, data-rich signal detectors.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

from backend.template_loader import Template, TemplateLoader
from backend.claude_client import ClaudeClient

logger = logging.getLogger(__name__)


@dataclass
class SignalExample:
    """Real signal example extracted from live data"""
    source_url: str
    signal_type: str  # job_posting, press_release, partnership, etc.
    content: str
    confidence: float
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ExpandedTemplate:
    """Template expanded with live data"""
    original_template: Template
    entity_id: str
    entity_name: str
    signal_examples: List[SignalExample]
    live_urls: Dict[str, List[str]]  # channel -> list of discovered URLs
    enriched_patterns: Dict[str, List[str]]  # pattern -> discovered indicators
    expansion_metadata: Dict[str, Any]
    expanded_at: str = field(default_factory=lambda: datetime.now().isoformat())


class TemplateExpansionAgent:
    """
    Claude Agent SDK-based template expansion

    Uses Claude to intelligently orchestrate data collection and expand
    templates with real signal examples from live entities.
    """

    def __init__(
        self,
        claude_client: Optional[ClaudeClient] = None,
        template_loader: Optional[TemplateLoader] = None
    ):
        """
        Initialize expansion agent

        Args:
            claude_client: Claude client (optional, creates default)
            template_loader: Template loader (optional, creates default)
        """
        self.claude = claude_client or ClaudeClient()
        self.loader = template_loader or TemplateLoader()

        logger.info("🚀 TemplateExpansionAgent initialized")

    async def expand_template_for_entity(
        self,
        template_id: str,
        entity_name: str,
        entity_domain: str,
        max_signals: int = 20
    ) -> ExpandedTemplate:
        """
        Expand template with live data from entity

        Process:
        1. Load template
        2. Use Claude to plan data collection strategy
        3. Scrape data via BrightData
        4. Extract signal examples
        5. Enrich template patterns

        Args:
            template_id: Template to expand
            entity_name: Entity to collect data from
            entity_domain: Entity's domain (e.g., arsenal.com)
            max_signals: Maximum signals to collect per channel

        Returns:
            Expanded template with live data
        """
        logger.info(f"🔍 Expanding template {template_id} for {entity_name}")

        # 1. Load template
        template = self.loader.get_template(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")

        # 2. Use Claude to plan data collection
        collection_plan = await self._plan_data_collection(template, entity_name, entity_domain)

        logger.info(f"📋 Collection plan: {collection_plan['channels_to_scrape']}")

        # 3. Execute data collection via BrightData
        signal_examples = await self._collect_signals(
            template,
            entity_name,
            entity_domain,
            collection_plan,
            max_signals
        )

        # 4. Extract live URLs and patterns
        live_urls = self._extract_live_urls(signal_examples)
        enriched_patterns = self._enrich_patterns(template, signal_examples)

        # 5. Create expanded template
        expanded = ExpandedTemplate(
            original_template=template,
            entity_id=entity_name.lower().replace(" ", "-"),
            entity_name=entity_name,
            signal_examples=signal_examples,
            live_urls=live_urls,
            enriched_patterns=enriched_patterns,
            expansion_metadata={
                "template_id": template_id,
                "collection_plan": collection_plan,
                "total_signals": len(signal_examples),
                "channels_scraped": len(live_urls),
                "confidence_boost": self._calculate_confidence_boost(signal_examples)
            }
        )

        logger.info(
            f"✅ Expanded template with {len(signal_examples)} signals, "
            f"{len(live_urls)} channels, confidence boost: "
            f"{expanded.expansion_metadata['confidence_boost']:.2f}"
        )

        return expanded

    async def _plan_data_collection(
        self,
        template: Template,
        entity_name: str,
        entity_domain: str
    ) -> Dict[str, Any]:
        """
        Use Claude to plan intelligent data collection

        Args:
            template: Template to expand
            entity_name: Entity to collect from
            entity_domain: Entity's domain

        Returns:
            Collection plan with channels, queries, URLs
        """
        system_prompt = """You are an expert signal detection strategist. Plan data collection to find procurement signals for sports entities.

Analyze the template and entity, then create a collection plan that:
1. Identifies which signal channels to scrape (jobs_board, official_site, partner_site, press)
2. Suggests specific search queries for each channel
3. Prioritizes channels by signal strength
4. Estimates how many signals to expect per channel

Respond in JSON format:
{
  "channels_to_scrape": ["jobs_board", "official_site", ...],
  "search_queries": {
    "jobs_board": ["query1", "query2"],
    "press": ["query1", "query2"]
  },
  "urls_to_scrape": ["url1", "url2"],
  "priority_order": ["jobs_board", "official_site", ...],
  "estimated_signals": {
    "jobs_board": 5,
    "official_site": 3
  }
}"""

        user_prompt = f"""Template: {template.template_name}
Description: {template.template_confidence} confidence template for {template.cluster_id}

Signal Patterns:
{json.dumps([p['pattern_name'] for p in template.signal_patterns], indent=2)}

Signal Channels:
{json.dumps([{c['channel_type']: c.get('notes', '')} for c in template.signal_channels], indent=2)}

Entity: {entity_name}
Domain: {entity_domain}

Create a data collection plan to find real signals from this entity."""

        try:
            response = await self.claude.query(
                prompt=user_prompt,
                system_prompt=system_prompt,
                model="haiku",  # Fast planning
                max_tokens=1000
            )

            # Parse JSON from response
            content = response.get("content", "{}")

            # Try to extract JSON from response
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
            if "channels_to_scrape" not in plan:
                plan["channels_to_scrape"] = [c["channel_type"] for c in template.signal_channels]
            if "search_queries" not in plan:
                plan["search_queries"] = {}
            if "urls_to_scrape" not in plan:
                plan["urls_to_scrape"] = [f"https://{entity_domain}"]
            if "priority_order" not in plan:
                plan["priority_order"] = plan["channels_to_scrape"]
            if "estimated_signals" not in plan:
                plan["estimated_signals"] = {}

            return plan

        except Exception as e:
            logger.error(f"Error planning data collection: {e}")
            # Fallback to default plan
            return {
                "channels_to_scrape": [c["channel_type"] for c in template.signal_channels],
                "search_queries": {
                    "jobs_board": [f'"{entity_name}" "CRM" OR "Digital" jobs'],
                    "press": [f'"{entity_name}" partnership announcement']
                },
                "urls_to_scrape": [f"https://{entity_domain}"],
                "priority_order": ["jobs_board", "official_site", "press"],
                "estimated_signals": {}
            }

    async def _collect_signals(
        self,
        template: Template,
        entity_name: str,
        entity_domain: str,
        collection_plan: Dict[str, Any],
        max_signals: int
    ) -> List[SignalExample]:
        """
        Collect signals via BrightData

        Args:
            template: Template being expanded
            entity_name: Entity to scrape
            entity_domain: Entity's domain
            collection_plan: Collection strategy from Claude
            max_signals: Max signals per channel

        Returns:
            List of signal examples
        """
        signal_examples = []

        # Import BrightData SDK client
        from backend.brightdata_sdk_client import BrightDataSDKClient

        # Create client with automatic HTTP fallback
        brightdata = BrightDataSDKClient()

        # Collect from each planned channel
        for channel_type in collection_plan.get("channels_to_scrape", []):
            try:
                if channel_type == "jobs_board":
                    # Search for job postings
                    queries = collection_plan.get("search_queries", {}).get("jobs_board", [])
                    for query in queries[:3]:  # Limit queries
                        result = await brightdata.search_engine(query)
                        for item in result.get("results", [])[:5]:
                            signal_examples.append(SignalExample(
                                source_url=item.get("url", ""),
                                signal_type="job_posting",
                                content=item.get("snippet", item.get("title", "")),
                                confidence=0.8,
                                metadata={"channel": channel_type, "query": query}
                            ))

                elif channel_type == "official_site":
                    # Scrape official site
                    url = f"https://{entity_domain}"
                    result = await brightdata.scrape_as_markdown(url)

                    if result.get("status") == "success":
                        content = result.get("content", "")

                        # Look for signal keywords
                        keywords = ['CRM', 'Digital', 'Data', 'Technology', 'Partnership', 'Sponsorship']
                        for keyword in keywords:
                            if keyword.lower() in content.lower():
                                signal_examples.append(SignalExample(
                                    source_url=url,
                                    signal_type="keyword_detection",
                                    content=f"Found '{keyword}' on official site",
                                    confidence=0.6,
                                    metadata={"channel": channel_type, "keyword": keyword}
                                ))

                elif channel_type == "press":
                    # Scrape news/press section
                    url = f"https://{entity_domain}/news"
                    result = await brightdata.scrape_as_markdown(url)

                    if result.get("status") == "success":
                        content = result.get("content", "")

                        # Look for announcements
                        announcement_keywords = ['announces', 'launches', 'partners', 'new', 'deal']
                        for keyword in announcement_keywords:
                            if keyword.lower() in content.lower():
                                signal_examples.append(SignalExample(
                                    source_url=url,
                                    signal_type="press_release",
                                    content=f"Found announcement keyword '{keyword}' in news",
                                    confidence=0.7,
                                    metadata={"channel": channel_type, "keyword": keyword}
                                ))

                # Stop if we've collected enough signals
                if len(signal_examples) >= max_signals:
                    break

            except Exception as e:
                logger.error(f"Error collecting from {channel_type}: {e}")
                continue

        return signal_examples[:max_signals]

    def _extract_live_urls(self, signal_examples: List[SignalExample]) -> Dict[str, List[str]]:
        """Extract unique URLs by signal type"""
        urls = {}

        for example in signal_examples:
            signal_type = example.signal_type
            if signal_type not in urls:
                urls[signal_type] = []

            if example.source_url and example.source_url not in urls[signal_type]:
                urls[signal_type].append(example.source_url)

        return urls

    def _enrich_patterns(
        self,
        template: Template,
        signal_examples: List[SignalExample]
    ) -> Dict[str, List[str]]:
        """Enrich patterns with discovered indicators"""
        enriched = {}

        for pattern in template.signal_patterns:
            pattern_name = pattern["pattern_name"]
            enriched[pattern_name] = []

            # Find examples matching this pattern
            for example in signal_examples:
                if example.confidence >= 0.7:
                    enriched[pattern_name].append(example.content)

        return enriched

    def _calculate_confidence_boost(self, signal_examples: List[SignalExample]) -> float:
        """Calculate confidence boost from collected signals"""
        if not signal_examples:
            return 0.0

        # Average confidence of all signals
        avg_confidence = sum(s.confidence for s in signal_examples) / len(signal_examples)

        # Boost based on number of signals (diminishing returns)
        signal_boost = min(len(signal_examples) * 0.02, 0.3)

        return avg_confidence * signal_boost

    def save_expanded_template(self, expanded: ExpandedTemplate, output_path: str):
        """Save expanded template to JSON file"""
        data = {
            "template_id": expanded.original_template.template_id,
            "entity_id": expanded.entity_id,
            "entity_name": expanded.entity_name,
            "expanded_at": expanded.expanded_at,
            "signal_examples": [
                {
                    "source_url": s.source_url,
                    "signal_type": s.signal_type,
                    "content": s.content,
                    "confidence": s.confidence,
                    "timestamp": s.timestamp,
                    "metadata": s.metadata
                }
                for s in expanded.signal_examples
            ],
            "live_urls": expanded.live_urls,
            "enriched_patterns": expanded.enriched_patterns,
            "expansion_metadata": expanded.expansion_metadata
        }

        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)

        logger.info(f"💾 Saved expanded template to {output_path}")


# =============================================================================
# Convenience Functions
# =============================================================================

async def expand_template_with_live_data(
    template_id: str,
    entity_name: str,
    entity_domain: str,
    output_path: Optional[str] = None
) -> ExpandedTemplate:
    """
    Convenience function to expand template with live data

    Args:
        template_id: Template to expand
        entity_name: Entity to collect from
        entity_domain: Entity's domain
        output_path: Optional path to save expanded template

    Returns:
        Expanded template
    """
    agent = TemplateExpansionAgent()
    expanded = await agent.expand_template_for_entity(
        template_id,
        entity_name,
        entity_domain
    )

    if output_path:
        agent.save_expanded_template(expanded, output_path)

    return expanded


# =============================================================================
# Test / Main
# =============================================================================

if __name__ == "__main__":
    import asyncio

    async def test_expansion():
        """Test template expansion"""
        agent = TemplateExpansionAgent()

        # Expand tier 1 club template with Arsenal data
        expanded = await agent.expand_template_for_entity(
            template_id="tier_1_club_centralized_procurement",
            entity_name="Arsenal FC",
            entity_domain="arsenal.com",
            max_signals=15
        )

        print("\n=== EXPANDED TEMPLATE ===")
        print(f"Template: {expanded.original_template.template_name}")
        print(f"Entity: {expanded.entity_name}")
        print(f"Signals Collected: {len(expanded.signal_examples)}")
        print(f"Live URLs: {len(expanded.live_urls)}")
        print(f"Confidence Boost: {expanded.expansion_metadata['confidence_boost']:.2f}")
        print()

        print("Signal Examples:")
        for i, example in enumerate(expanded.signal_examples[:5], 1):
            print(f"  {i}. [{example.signal_type}] {example.content[:80]}")
            print(f"     URL: {example.source_url}")
            print(f"     Confidence: {example.confidence:.2f}")

        # Save expanded template
        output_path = "bootstrapped_templates/expanded_tier_1_club arsenal-fc.json"
        agent.save_expanded_template(expanded, output_path)
        print(f"\n✅ Saved to: {output_path}")

    asyncio.run(test_expansion())
