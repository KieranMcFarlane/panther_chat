import { createTool } from '@mastra/core/tools';
import { z } from "zod";

const GRAPH_MCP_URL = process.env.GRAPH_MCP_URL || "http://localhost:3004";

// Simple, direct call to native graph MCP tools
async function callNativeMCP(toolName: string, args: Record<string, any>): Promise<any> {
  const response = await fetch(`${GRAPH_MCP_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`graph MCP error: ${response.status} - ${await response.text()}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'graph MCP call failed');
  }

  // Parse JSON from content if available
  if (result.result?.content?.[0]?.text) {
    try {
      return JSON.parse(result.result.content[0].text);
    } catch {
      return result.result.content[0].text;
    }
  }
  
  return result.result;
}

export const graphTools = {
  queryGraph: createTool({
    id: 'query_graph',
    description: "Execute Cypher queries directly using the native graph MCP execute_query tool",
    inputSchema: z.object({
      query: z.string().describe("Cypher query (e.g., 'MATCH (n) WHERE n.name CONTAINS $name RETURN n LIMIT 10')"),
      params: z.record(z.any()).optional().default({}).describe("Query parameters (e.g., {name: 'Arsenal'})")
    }),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.any().optional(),
      error: z.string().optional(),
    }),
    execute: async ({ query, params = {} }) => {
      try {
        console.log(`🔧 Graph query: ${query}`, params);
        const data = await callNativeMCP('execute_query', { query, params });
        return { success: true, data };
      } catch (error) {
        console.error('Graph query failed:', error);
        return { success: false, error: `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }
    },
  }),

  createEntity: createTool({
    id: 'create_entity',
    description: "Create nodes directly using the native graph MCP create_node tool",
    inputSchema: z.object({
      label: z.string().describe("Node label (e.g., 'Person', 'Club', 'Entity')"),
      properties: z.record(z.any()).describe("Node properties")
    }),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.any().optional(),
      error: z.string().optional(),
    }),
    execute: async ({ label, properties }) => {
      try {
        console.log(`🔧 Graph create: ${label}`, properties);
        const data = await callNativeMCP('create_node', { label, properties });
        return { success: true, data };
      } catch (error) {
        console.error('Graph create failed:', error);
        return { success: false, error: `Create failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }
    },
  }),

  // Simple query-based approach for finding related entities
  findRelatedEntities: createTool({
    id: 'find_related_entities',
    description: "Find related entities using Cypher query via native execute_query tool",
    inputSchema: z.object({
      entityName: z.string().describe("Name of the entity"),
      maxDepth: z.number().optional().default(2).describe("Maximum relationship depth")
    }),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.any().optional(),
      error: z.string().optional(),
    }),
    execute: async ({ entityName, maxDepth = 2 }) => {
      try {
        const query = `
          MATCH (start)
          WHERE start.name CONTAINS $entityName OR start.clubName CONTAINS $entityName
          MATCH (start)-[*1..${maxDepth}]-(related)
          RETURN DISTINCT related
          LIMIT 20
        `;
        
        console.log(`🔧 Graph find related: ${entityName}`);
        const data = await callNativeMCP('execute_query', { 
          query, 
          params: { entityName } 
        });
        return { success: true, data };
      } catch (error) {
        console.error('Graph find related failed:', error);
        return { success: false, error: `Find related failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }
    },
  }),
};
