#!/usr/bin/env python3
"""
Minimal test MCP server to verify Claude Agent SDK integration
Starts instantly with no dependencies
"""
import asyncio
import sys

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("ERROR: mcp not installed. Run: pip install mcp", file=sys.stderr)
    sys.exit(1)

# Create MCP server
mcp = FastMCP(name="test-server")

@mcp.tool()
def test_tool(message: str) -> str:
    """A simple test tool that echoes back the message

    Args:
        message: The message to echo back

    Returns:
        The same message with a prefix
    """
    return f"Test server received: {message}"

@mcp.tool()
def search_entities(query: str, limit: int = 10) -> str:
    """Search for entities (mock implementation)

    Args:
        query: Search query
        limit: Maximum results

    Returns:
        Mock search results
    """
    return f"Mock search results for '{query}': found 2 entities"

async def main():
    """Run the test MCP server"""
    print("TEST MCP SERVER: Starting on stdio...", file=sys.stderr)
    await mcp.run_stdio_async()

if __name__ == "__main__":
    asyncio.run(main())
