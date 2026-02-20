#!/usr/bin/env python3
"""
Graph Tools MCP Server - CLI interface
Uses FastMCP to create an MCP server that can be spawned by Claude Agent SDK
"""
import asyncio
import sys
from mcp.server.fastmcp import FastMCP
from urllib.parse import urlencode

# Create MCP server
mcp = FastMCP(name="graph-tools-cli")

@mcp.tool()
def search_graph(query: str, num_results: int = 5, entity_id: str | None = None) -> str:
    """Search the temporal knowledge graph for entities, relationships, and facts.

    Args:
        query: Natural language search query
        num_results: Number of results to return (default: 5, max: 20)
        entity_id: Optional center entity UUID for contextual search

    Returns:
        Search results in JSON format
    """
    try:
        import urllib.request
        import json

        params = {
            'query': query,
            'num_results': str(num_results)
        }

        if entity_id:
            params['entity_id'] = entity_id

        url = f"http://localhost:3005/api/graphrag?{urlencode(params)}"

        with urllib.request.urlopen(url, timeout=30) as response:
            data = json.loads(response.read().decode())

            return f"Found {data.get('count', 0)} results for \"{data.get('query', '')}\":\n{json.dumps(data.get('results', []), indent=2)}"
    except Exception as e:
        return f"Error searching graph: {str(e)}"

@mcp.tool()
def add_episode(name: str, content: str, source_description: str = "CLI tool via Claude SDK") -> str:
    """Add a new episode (event, fact, or information) to the temporal knowledge graph.

    Args:
        name: Name/title of the episode
        content: Content/body of the episode
        source_description: Description of where this information came from

    Returns:
        Success message
    """
    try:
        import urllib.request
        import json

        data = json.dumps({
            'action': 'add-episode',
            'name': name,
            'episode_body': content,
            'source_description': source_description
        }).encode('utf-8')

        req = urllib.request.Request(
            'http://localhost:3005/api/graphrag',
            data=data,
            headers={'Content-Type': 'application/json'}
        )

        with urllib.request.urlopen(req, timeout=30) as response:
            return f"Successfully added episode \"{name}\" to the graph."

    except Exception as e:
        return f"Error adding episode: {str(e)}"

async def main():
    """Run the MCP server"""
    await mcp.run_stdio_async()

if __name__ == '__main__':
    asyncio.run(main())
