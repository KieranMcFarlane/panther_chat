"""
Multi-Agent System for Signal Noise App

This package provides autonomous agents for intelligent entity discovery:
- SearchAgent: Domain discovery specialist
- ScrapeAgent: Content extraction specialist
- AnalysisAgent: Signal scoring specialist
- MultiAgentCoordinator: Orchestrates agent workflow
- Legacy adapters: Backward compatibility layer

Usage:
    from backend.agents import discover_entity_with_agents

    result = await discover_entity_with_agents(
        entity_name="Arsenal FC",
        entity_id="arsenal-fc"
    )
"""

from backend.agents.search_agent import SearchAgent
from backend.agents.scrape_agent import ScrapeAgent
from backend.agents.analysis_agent import AnalysisAgent
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

__all__ = [
    "SearchAgent",
    "ScrapeAgent",
    "AnalysisAgent",
    "MultiAgentCoordinator",
    "AgentContext",
    "discover_entity_with_agents",
    "DigitalDiscoveryAgentAdapter",
    "TemplateValidationAdapter",
    "HypothesisDiscoveryAdapter",
    "discover_with_agents"
]

__version__ = "1.0.0"
