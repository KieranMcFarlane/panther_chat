'use client';

import { useCopilotAction } from '@copilotkit/react-core';

// Define the available MCP tools
interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

// Graph MCP Tools
const graphTools: MCPTool[] = [
  {
    name: 'graph_query',
    description: 'Query graph-backed relationship data for sports entities',
    parameters: {
      entityId: { type: 'string', description: 'Entity id or legacy graph ID to inspect' },
      limit: { type: 'number', description: 'Maximum number of relationships (optional)', default: 25 }
    }
  },
  {
    name: 'graph_search_entities',
    description: 'Search for sports entities in the graph-backed cache',
    parameters: {
      entityType: { type: 'string', description: 'Type of entity (club, player, competition, etc.)' },
      name: { type: 'string', description: 'Name to search for (optional)' },
      limit: { type: 'number', description: 'Maximum number of results (optional)', default: 10 }
    }
  }
];

// BrightData MCP Tools
const brightDataTools: MCPTool[] = [
  {
    name: 'brightdata_search',
    description: 'Search the web using BrightData proxy',
    parameters: {
      query: { type: 'string', description: 'Search query' },
      num_results: { type: 'number', description: 'Number of results to return (optional)', default: 5 }
    }
  },
  {
    name: 'brightdata_scrape',
    description: 'Scrape a specific URL using BrightData proxy',
    parameters: {
      url: { type: 'string', description: 'URL to scrape' }
    }
  }
];

// Perplexity MCP Tools
const perplexityTools: MCPTool[] = [
  {
    name: 'perplexity_search',
    description: 'Search using Perplexity AI for up-to-date information',
    parameters: {
      query: { type: 'string', description: 'Search query' },
      max_results: { type: 'number', description: 'Maximum results (optional)', default: 5 }
    }
  }
];

// Combined MCP tools
const allMCPTools = [...graphTools, ...brightDataTools, ...perplexityTools];

export function MCPActions() {
  // Register graph actions
  useCopilotAction({
    name: 'graph_query',
    description: 'Fetch graph-backed relationships for an entity',
    parameters: ['entityId', 'limit'],
    handler: async ({ entityId, limit = 25 }) => {
      try {
        const response = await fetch('/api/graph/relationships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityId, limit })
        });
        
        if (!response.ok) throw new Error('Graph query failed');
        
        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Graph action error:', error);
        return { error: 'Failed to execute graph query', details: error };
      }
    }
  });

  useCopilotAction({
    name: 'graph_search_entities', 
    description: 'Search for sports entities in graph-backed cache',
    parameters: ['entityType', 'name', 'limit'],
    handler: async ({ entityType, name, limit = 10 }) => {
      try {
        const query = new URLSearchParams();
        if (name) query.set('query', name);
        query.set('limit', String(limit));
        const response = await fetch(`/api/entities/search?${query.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityType, name, limit })
        });
        
        if (!response.ok) throw new Error('Graph search failed');
        
        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Graph search error:', error);
        return { error: 'Failed to search entities', details: error };
      }
    }
  });

  // Register BrightData actions
  useCopilotAction({
    name: 'brightdata_search',
    description: 'Search the web using BrightData proxy',
    parameters: ['query', 'num_results'],
    handler: async ({ query, num_results = 5 }) => {
      try {
        const response = await fetch('/api/mcp/brightdata/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, num_results })
        });
        
        if (!response.ok) throw new Error('BrightData search failed');
        
        const result = await response.json();
        return result;
      } catch (error) {
        console.error('BrightData search error:', error);
        return { error: 'Failed to search web', details: error };
      }
    }
  });

  // Register Perplexity actions
  useCopilotAction({
    name: 'perplexity_search',
    description: 'Search using Perplexity AI for up-to-date information',
    parameters: ['query', 'max_results'],
    handler: async ({ query, max_results = 5 }) => {
      try {
        const response = await fetch('/api/mcp/perplexity/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, max_results })
        });
        
        if (!response.ok) throw new Error('Perplexity search failed');
        
        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Perplexity search error:', error);
        return { error: 'Failed to search with Perplexity', details: error };
      }
    }
  });

  return null; // This component only registers actions
}

export { allMCPTools, graphTools, brightDataTools, perplexityTools };
