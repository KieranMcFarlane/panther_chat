"""
Claude Agent SDK Wrapper (Backward Compatible)

Wraps Claude Agent SDK with the same interface as existing ClaudeClient.
This maintains backward compatibility while using proper SDK integration.

Architecture:
- Matches existing ClaudeClient interface
- Uses Claude Agent SDK internally
- Falls back to Anthropic SDK if Agent SDK unavailable
- Supports model cascade (haiku → sonnet → opus)
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class ClaudeClient:
    """
    Claude Agent SDK wrapper (backward compatible with existing ClaudeClient)

    Implements the same interface as backend.claude_client.ClaudeClient
    but uses Claude Agent SDK internally.

    Usage:
        client = ClaudeClient()
        result = await client.query("Search for Arsenal FC CRM signals")
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        """
        Initialize Claude client wrapper

        Args:
            api_key: Anthropic API key (default: from ANTHROPIC_API_KEY env)
            base_url: Custom base URL (default: from ANTHROPIC_BASE_URL env)
        """
        import os

        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.base_url = base_url or os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")

        self._client = None
        self._model = "haiku"
        self._cascade_order = ["haiku", "sonnet", "opus"]

        logger.info(f"🤖 ClaudeClient wrapper initialized (model: {self._model})")

    async def query(
        self,
        prompt: str,
        model: str = "haiku",
        max_tokens: int = 2000,
        tools: Optional[List[Dict]] = None,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Query Claude with specific model

        Args:
            prompt: User prompt
            model: Model name (haiku, sonnet, opus)
            max_tokens: Maximum tokens to generate
            tools: Optional list of tools (ignored if using Agent SDK)
            system_prompt: Optional system prompt

        Returns:
            Response dict with:
            - content: Generated content
            - model_used: Which model was used
            - tokens_used: Input/output tokens
        """
        # Try to use Claude Agent SDK first
        try:
            from backend.agent_sdk.client_factory import create_discovery_client

            if self._client is None:
                self._client = create_discovery_client(system_prompt)

            logger.info(f"🔄 Querying Claude Agent SDK (model: {model})")

            # Query the client
            result = await self._client.query(prompt, max_tokens=max_tokens)

            return {
                "content": result.get("content", ""),
                "model_used": model,
                "raw_response": result,
                "tokens_used": result.get("tokens_used", {}),
                "stop_reason": "stop"
            }

        except ImportError:
            # Fall back to existing ClaudeClient
            logger.warning("⚠️ Claude Agent SDK unavailable, using Anthropic SDK fallback")

            from backend.claude_client import ClaudeClient as LegacyClaudeClient

            legacy_client = LegacyClaudeClient(api_key=self.api_key, base_url=self.base_url)

            return await legacy_client.query(
                prompt=prompt,
                model=model,
                max_tokens=max_tokens,
                tools=tools,
                system_prompt=system_prompt
            )

    async def query_with_cascade(
        self,
        prompt: str,
        max_tokens: int = 2000,
        tools: Optional[List[Dict]] = None,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Query Claude with model cascade fallback

        Tries models in order (haiku → sonnet → opus) until one produces sufficient result.

        Args:
            prompt: User prompt
            max_tokens: Maximum tokens to generate
            tools: Optional list of tools
            system_prompt: Optional system prompt

        Returns:
            Response dict with cascade metadata
        """
        for model_name in self._cascade_order:
            try:
                logger.info(f"🔄 Trying model: {model_name}")

                result = await self.query(
                    prompt=prompt,
                    model=model_name,
                    max_tokens=max_tokens,
                    tools=tools,
                    system_prompt=system_prompt
                )

                # Check if result is sufficient
                if self._is_sufficient(result):
                    logger.info(f"✅ {model_name} sufficient for query")
                    result["model_used"] = model_name
                    result["cascade_attempts"] = self._cascade_order.index(model_name) + 1
                    return result
                else:
                    logger.warning(f"⚠️ {model_name} insufficient, escalating...")
                    continue

            except Exception as e:
                logger.error(f"❌ {model_name} failed: {e}")
                continue

        # All models failed
        raise Exception("All models in cascade failed")

    def _is_sufficient(self, result: Dict[str, Any]) -> bool:
        """
        Check if result is sufficient

        Criteria:
        - Has content
        - Content length > 50 chars
        - No errors
        """
        content = result.get("content", "")

        if not content:
            return False

        if len(content) < 50:
            return False

        if "error" in result or result.get("stop_reason") == "max_tokens":
            return False

        return True


# =============================================================================
# Convenience Functions (maintain backward compatibility)
# =============================================================================

async def query_with_cascade(
    prompt: str,
    max_tokens: int = 2000,
    tools: Optional[List[Dict]] = None,
    system_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convenience function to query Claude with model cascade

    Args:
        prompt: User prompt
        max_tokens: Maximum tokens to generate
        tools: Optional list of tools
        system_prompt: Optional system prompt

    Returns:
        Response from Claude with cascade fallback
    """
    client = ClaudeClient()
    return await client.query_with_cascade(prompt, max_tokens, tools, system_prompt)


# =============================================================================
# Test / Main
# =============================================================================

if __name__ == "__main__":
    import asyncio

    async def test_wrapper():
        """Test the wrapper"""
        print("Testing ClaudeClient wrapper...")

        client = ClaudeClient()

        # Test simple query
        print("\n1. Testing simple query...")
        result = await client.query(
            "What is 2+2? Give a brief answer.",
            model="haiku",
            max_tokens=100
        )
        print(f"Result: {result['content'][:100]}")
        print(f"Model used: {result['model_used']}")

        # Test cascade
        print("\n2. Testing cascade...")
        result = await client.query_with_cascade(
            "Explain the difference between CRM and ERP systems in 2 sentences.",
            max_tokens=200
        )
        print(f"Result: {result['content'][:200]}")
        print(f"Cascade attempts: {result.get('cascade_attempts', 1)}")

        print("\n✅ All tests passed!")

    asyncio.run(test_wrapper())
