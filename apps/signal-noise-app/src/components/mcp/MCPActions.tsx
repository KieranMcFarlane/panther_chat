'use client';

import { useCopilotAction } from '@copilotkit/react-core';

// Define the available MCP tools
interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

// Neo4j MCP Tools
const neo4jTools: MCPTool[] = [
  {
    name: 'neo4j_query',
    description: 'Execute Cypher queries on Neo4j database to search sports entities',
    parameters: {
      query: { type: 'string', description: 'Cypher query to execute' },
      database: { type: 'string', description: 'Database name (optional)', default: 'neo4j' }
    }
  },
  {
    name: 'neo4j_search_entities',
    description: 'Search for sports entities in the Neo4j database',
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
const allMCPTools = [...neo4jTools, ...brightDataTools, ...perplexityTools];

export function MCPActions() {
  // Register Neo4j actions
  useCopilotAction({
    name: 'neo4j_query',
    description: 'Execute Cypher queries on Neo4j sports database',
    parameters: ['query', 'database'],
    handler: async ({ query, database }) => {
      try {
        const response = await fetch('/api/mcp/neo4j', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, database: database || 'neo4j' })
        });
        
        if (!response.ok) throw new Error('Neo4j query failed');
        
        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Neo4j action error:', error);
        return { error: 'Failed to execute Neo4j query', details: error };
      }
    }
  });

  useCopilotAction({
    name: 'neo4j_search_entities', 
    description: 'Search for sports entities in Neo4j database',
    parameters: ['entityType', 'name', 'limit'],
    handler: async ({ entityType, name, limit = 10 }) => {
      try {
        const response = await fetch('/api/mcp/neo4j/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityType, name, limit })
        });
        
        if (!response.ok) throw new Error('Neo4j search failed');
        
        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Neo4j search error:', error);
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

export { allMCPTools, neo4jTools, brightDataTools, perplexityTools };