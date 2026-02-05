"""
Multi-Agent Client Factory

Factory for creating agent clients using existing Anthropic SDK with BrightData tools.
Provides centralized client initialization and tool management.

Architecture:
- Wraps existing ClaudeClient (Anthropic SDK)
- Manages tool availability and execution
- Provides specialized clients for different agent types
"""

import logging
from typing import Dict, Any, List, Optional
import os

logger = logging.getLogger(__name__)


# =============================================================================
# Simple Client Wrapper
# =============================================================================

class AgentClient:
    """
    Wrapper around existing ClaudeClient for agent use

    Provides a simple interface compatible with agent expectations.
    """

    def __init__(self, system_prompt: Optional[str] = None, model: str = "haiku"):
        """
        Initialize agent client

        Args:
            system_prompt: Optional system prompt for the agent
            model: Claude model to use (haiku, sonnet, opus)
        """
        from backend.claude_client import ClaudeClient

        self._claude = ClaudeClient()
        self.system_prompt = system_prompt
        self.model = model
        self._tools_cache = None

        logger.info(f"✅ AgentClient initialized (model: {model})")

    async def query(self, prompt: str, max_tokens: int = 2000) -> Dict[str, Any]:
        """
        Query Claude with prompt

        Args:
            prompt: User prompt
            max_tokens: Maximum tokens to generate

        Returns:
            Dict with content, model_used, tokens_used
        """
        try:
            result = await self._claude.query(
                prompt=prompt,
                model=self.model,
                max_tokens=max_tokens,
                system_prompt=self.system_prompt
            )

            return {
                "content": result.get("content", ""),
                "model_used": result.get("model_used", self.model),
                "tokens_used": result.get("tokens_used", {}),
                "stop_reason": result.get("stop_reason", "stop")
            }

        except Exception as e:
            logger.error(f"❌ Query failed: {e}")
            raise

    @property
    def available_tools(self) -> List[str]:
        """Get list of available tool names"""
        if self._tools_cache is None:
            from backend.agent_tools.brightdata_tools import BRIGHTDATA_TOOLS
            self._tools_cache = list(BRIGHTDATA_TOOLS.keys())
        return self._tools_cache

    async def use_tool(self, tool_name: str, tool_args: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a BrightData tool directly

        Args:
            tool_name: Name of the tool to execute
            tool_args: Arguments for the tool

        Returns:
            Tool execution result
        """
        from backend.agent_tools.brightdata_tools import BRIGHTDATA_TOOLS

        if tool_name not in BRIGHTDATA_TOOLS:
            raise ValueError(f"Unknown tool: {tool_name}")

        tool_def = BRIGHTDATA_TOOLS[tool_name]
        tool_func = tool_def["function"]

        logger.info(f"🔧 Using tool: {tool_name}")

        try:
            result = await tool_func(tool_args)
            return result
        except Exception as e:
            logger.error(f"❌ Tool execution failed: {e}")
            raise


# =============================================================================
# Client Factory
# =============================================================================

class ClientFactory:
    """
    Factory for creating agent clients with BrightData tools

    Usage:
        # Create discovery client with BrightData tools
        client = ClientFactory.create_discovery_client()

        # Create multi-agent client
        client = ClientFactory.create_multi_agent_client(
            agent_name="search",
            agent_system_prompt="You are a search specialist..."
        )
    """

    @classmethod
    def create_brightdata_tools(cls) -> Dict[str, Any]:
        """
        Get BrightData tools registry

        Returns:
            Dict with tool definitions
        """
        from backend.agent_tools.brightdata_tools import BRIGHTDATA_TOOLS

        # Build tool list
        tools = []
        for tool_name, tool_def in BRIGHTDATA_TOOLS.items():
            tools.append({
                "name": f"mcp__brightdata__{tool_name}",
                "description": tool_def["description"],
                "parameters": tool_def["parameters"],
                "function": tool_def["function"]
            })

        logger.info(f"✅ BrightData tools loaded: {len(tools)} tools")

        return {
            "name": "brightdata",
            "version": "1.0.0",
            "tools": tools
        }

    @classmethod
    def create_discovery_client(cls, system_prompt: Optional[str] = None) -> AgentClient:
        """
        Create client for discovery agents with BrightData tools

        Args:
            system_prompt: Optional system prompt for the agent

        Returns:
            AgentClient instance configured for discovery
        """
        default_system_prompt = """You are a Digital Procurement Intelligence Specialist.

Your goal is to discover signals that indicate:
1. CRM/Analytics platforms in use
2. Digital transformation initiatives
3. Vendor partnerships
4. Technology adoption through hiring
5. Upcoming procurement opportunities

Use the available tools to search and scrape web content efficiently.

When you need to search or scrape, specify the tool name and arguments clearly."""

        system_prompt = system_prompt or default_system_prompt

        logger.info("✅ Creating discovery client with BrightData tools")

        return AgentClient(system_prompt=system_prompt, model="sonnet")

    @classmethod
    def create_multi_agent_client(
        cls,
        agent_name: str,
        agent_tools: List[str],
        agent_system_prompt: str,
        model: str = "sonnet"
    ) -> AgentClient:
        """
        Create client for specialized multi-agent coordination

        Args:
            agent_name: Name of the agent (e.g., "search", "scrape", "analysis")
            agent_tools: List of tool names this agent can use
            agent_system_prompt: System prompt for this agent type
            model: Claude model to use (default: "sonnet")

        Returns:
            AgentClient instance configured for this agent type
        """
        logger.info(f"✅ Creating {agent_name} agent with {len(agent_tools)} tools")

        # Add tool info to system prompt
        tools_info = cls.create_brightdata_tools()
        available_tools = [t["name"] for t in tools_info["tools"]]

        # Filter to only allowed tools
        allowed_tool_names = [t for t in available_tools if any(t.endswith(name) for name in agent_tools)]

        enhanced_prompt = f"""{agent_system_prompt}

Available Tools:
{chr(10).join(f'- {name}' for name in allowed_tool_names)}

You have access to these tools through your client. Use them when needed to accomplish your tasks."""

        return AgentClient(system_prompt=enhanced_prompt, model=model)

    @classmethod
    def create_analysis_client(cls, system_prompt: Optional[str] = None) -> AgentClient:
        """
        Create client for analysis agents (no external tools needed)

        Args:
            system_prompt: Optional system prompt for the agent

        Returns:
            AgentClient instance configured for analysis
        """
        default_system_prompt = """You are a Procurement Intelligence Analyst.

Classify signals using this framework:

Decision Types (Internal → External):
- ACCEPT (+0.06) → Procurement Signal: Strong procurement evidence
- WEAK_ACCEPT (+0.02) → Capability Signal: Capability without intent
- REJECT (0.00) → No Signal: No evidence
- NO_PROGRESS (0.00) → No Signal: No new information
- SATURATED (0.00) → Saturated: Category exhausted

Confidence Bands:
- EXPLORATORY (<0.30): $0 - Research phase
- INFORMED (0.30-0.60): $500/entity/month - Monitoring
- CONFIDENT (0.60-0.80): $2,000/entity/month - Sales engaged
- ACTIONABLE (>0.80 + gate): $5,000/entity/month - Immediate outreach

Actionable Gate: Requires BOTH:
1. Confidence > 0.80
2. ≥2 ACCEPTs across ≥2 categories

Starting Confidence: 0.50 (neutral prior)
Formula: 0.50 + (num_ACCEPT × 0.06) + (num_WEAK_ACCEPT × 0.02)
Bounds: 0.00 to 1.00 (enforced)"""

        system_prompt = system_prompt or default_system_prompt

        logger.info("✅ Creating analysis client (no external tools)")

        return AgentClient(system_prompt=system_prompt, model="sonnet")

    @classmethod
    def create_search_client(cls) -> AgentClient:
        """Create client optimized for search operations"""
        from backend.agents.search_agent import SearchAgent

        system_prompt = SearchAgent.SYSTEM_PROMPT

        return AgentClient(system_prompt=system_prompt, model="sonnet")

    @classmethod
    def create_scrape_client(cls) -> AgentClient:
        """Create client optimized for scraping operations"""
        from backend.agents.scrape_agent import ScrapeAgent

        system_prompt = ScrapeAgent.SYSTEM_PROMPT

        return AgentClient(system_prompt=system_prompt, model="sonnet")


# =============================================================================
# Convenience Functions
# =============================================================================

def create_discovery_client(system_prompt: Optional[str] = None) -> AgentClient:
    """
    Convenience function to create discovery client

    Args:
        system_prompt: Optional system prompt

    Returns:
        AgentClient instance
    """
    return ClientFactory.create_discovery_client(system_prompt=system_prompt)


def create_analysis_client(system_prompt: Optional[str] = None) -> AgentClient:
    """
    Convenience function to create analysis client

    Args:
        system_prompt: Optional system prompt

    Returns:
        AgentClient instance
    """
    return ClientFactory.create_analysis_client(system_prompt=system_prompt)


def get_available_tools() -> Dict[str, Any]:
    """
    Get all available BrightData tools

    Returns:
        Dict with tool definitions
    """
    return ClientFactory.create_brightdata_tools()


# =============================================================================
# Test / Main
# =============================================================================

if __name__ == "__main__":
    import asyncio

    async def test_factory():
        """Test client factory"""
        print("Testing ClientFactory...")

        try:
            # Test discovery client
            print("\n1. Testing discovery client...")
            client = create_discovery_client()
            print(f"✅ Client created: {type(client).__name__}")
            print(f"   Available tools: {client.available_tools}")

            # Test query
            print("\n2. Testing query...")
            result = await client.query("Hello, can you help me?", max_tokens=100)
            print(f"✅ Query result: {result['content'][:100]}...")
            print(f"   Model used: {result['model_used']}")

            # Test tool access
            print("\n3. Testing BrightData tools...")
            tools = get_available_tools()
            print(f"✅ Tools loaded: {len(tools['tools'])} tools")
            for tool in tools['tools'][:3]:
                print(f"   - {tool['name']}")

            print("\n✅ All factory tests passed!")

        except Exception as e:
            print(f"❌ Test failed: {e}")
            import traceback
            traceback.print_exc()

    asyncio.run(test_factory())
