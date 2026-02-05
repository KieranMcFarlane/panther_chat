"""
Multi-Agent System for Signal Noise App

This package provides autonomous agents for intelligent entity discovery:
- SearchAgent: Domain discovery specialist
- ScrapeAgent: Content extraction specialist
- AnalysisAgent: Signal scoring specialist
- VendorSearchAgent: Targeted vendor discovery specialist
- MultiAgentCoordinator: Orchestrates agent workflow
- Legacy adapters: Backward compatibility layer

Usage:
    from backend.agents import discover_entity_with_agents, discover_vendors

    result = await discover_entity_with_agents(
        entity_name="Arsenal FC",
        entity_id="arsenal-fc"
    )

    vendors = await discover_vendors(
        entity_name="Arsenal FC",
        entity_id="arsenal-fc"
    )
"""

import asyncio
from typing import Dict, List, Any, Optional

from backend.agents.search_agent import SearchAgent
from backend.agents.scrape_agent import ScrapeAgent
from backend.agents.analysis_agent import AnalysisAgent
from backend.agents.vendor_search_agent import VendorSearchAgent
from backend.agents.multi_agent_coordinator import (
    MultiAgentCoordinator,
    AgentContext,
    discover_entity_with_agents
)
from backend.agents.legacy_adapter import (
    DigitalDiscoveryAgentAdapter,
    TemplateValidationAdapter,
    HypothesisDiscoveryAdapter,
    discover_with_agents
)


async def discover_vendors(
    entity_name: str,
    entity_id: str,
    categories: Optional[List[str]] = None,
    max_vendors_per_category: int = 3
) -> Dict[str, Any]:
    """
    Convenience function for targeted vendor discovery.

    Args:
        entity_name: Display name (e.g., "Arsenal FC")
        entity_id: Unique ID (e.g., "arsenal-fc")
        categories: Technology categories to search (default: all)
        max_vendors_per_category: Max vendors per category (default: 3)

    Returns:
        Dictionary with discovered vendors, stakeholders, and partnerships

    Example:
        vendors = await discover_vendors(
            entity_name="Arsenal FC",
            entity_id="arsenal-fc",
            categories=["CRM", "Analytics"]
        )

        print(f"Found {vendors['total_vendors_found']} vendors")
        print(f"Stakeholders: {len(vendors['stakeholders'])}")
        print(f"Partnerships: {len(vendors['partnerships'])}")
    """
    vendor_agent = VendorSearchAgent()
    return await vendor_agent.discover_vendors(
        entity_name=entity_name,
        entity_id=entity_id,
        categories=categories,
        max_vendors_per_category=max_vendors_per_category
    )

__all__ = [
    "SearchAgent",
    "ScrapeAgent",
    "AnalysisAgent",
    "VendorSearchAgent",
    "MultiAgentCoordinator",
    "AgentContext",
    "discover_entity_with_agents",
    "DigitalDiscoveryAgentAdapter",
    "TemplateValidationAdapter",
    "HypothesisDiscoveryAdapter",
    "discover_with_agents",
    "discover_vendors"
]

__version__ = "1.1.0"
