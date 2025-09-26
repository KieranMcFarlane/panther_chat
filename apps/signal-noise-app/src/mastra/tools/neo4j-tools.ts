import { createTool } from '@mastra/core/tools';
import { z } from "zod";

const NEO4J_MCP_URL = process.env.NEO4J_MCP_URL || "http://localhost:3004";

// Simple, direct call to native Neo4j MCP tools
async function callNativeMCP(toolName: string, args: Record<string, any>): Promise<any> {
  const response = await fetch(`${NEO4J_MCP_URL}/mcp`, {
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
    throw new Error(`Neo4j MCP error: ${response.status} - ${await response.text()}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Neo4j MCP call failed');
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

export const neo4jTools = {
  queryKnowledgeGraph: createTool({
    id: 'query_knowledge_graph',
    description: "Execute Cypher queries directly using native Neo4j MCP execute_query tool",
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
        console.log(`🔧 Neo4j Query: ${query}`, params);
        const data = await callNativeMCP('execute_query', { query, params });
        return { success: true, data };
      } catch (error) {
        console.error('Neo4j query failed:', error);
        return { success: false, error: `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }
    },
  }),

  createEntity: createTool({
    id: 'create_entity',
    description: "Create nodes directly using native Neo4j MCP create_node tool",
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
        console.log(`🔧 Neo4j Create: ${label}`, properties);
        const data = await callNativeMCP('create_node', { label, properties });
        return { success: true, data };
      } catch (error) {
        console.error('Neo4j create failed:', error);
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
        
        console.log(`🔧 Neo4j Find Related: ${entityName}`);
        const data = await callNativeMCP('execute_query', { 
          query, 
          params: { entityName } 
        });
        return { success: true, data };
      } catch (error) {
        console.error('Neo4j find related failed:', error);
        return { success: false, error: `Find related failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }
    },
  }),
};