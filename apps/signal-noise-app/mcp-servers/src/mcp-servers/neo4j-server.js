#!/usr/bin/env node

/**
 * Neo4j MCP Server
 * Provides Neo4j knowledge graph operations as MCP tools
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import neo4j from 'neo4j-driver';

const server = new Server(
  {
    name: 'neo4j-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Neo4j driver setup
let driver;

try {
  driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
    neo4j.auth.basic(
      process.env.NEO4J_USERNAME || 'neo4j',
      process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0'
    )
  );
} catch (error) {
  console.error('Failed to initialize Neo4j driver:', error);
}

// List available entities
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'neo4j_query_entities',
        description: 'Query entities from Neo4j knowledge graph',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Cypher query to execute',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'neo4j_get_entity_relationships',
        description: 'Get relationships for a specific entity',
        inputSchema: {
          type: 'object',
          properties: {
            entityId: {
              type: 'string',
              description: 'Entity ID to get relationships for',
            },
            depth: {
              type: 'number',
              description: 'Depth of relationship traversal',
              default: 2,
            },
          },
          required: ['entityId'],
        },
      },
      {
        name: 'neo4j_search_entities',
        description: 'Search entities by name or type',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'Search term for entity names',
            },
            entityType: {
              type: 'string',
              description: 'Filter by entity type',
              enum: ['Entity', 'Club', 'League', 'Person', 'Venue'],
            },
            limit: {
              type: 'number',
              description: 'Maximum results to return',
              default: 10,
            },
          },
          required: ['searchTerm'],
        },
      },
      {
        name: 'neo4j_get_entity_path',
        description: 'Find shortest path between two entities',
        inputSchema: {
          type: 'object',
          properties: {
            fromEntityId: {
              type: 'string',
              description: 'Starting entity ID',
            },
            toEntityId: {
              type: 'string',
              description: 'Target entity ID',
            },
            maxDepth: {
              type: 'number',
              description: 'Maximum path depth',
              default: 5,
            },
          },
          required: ['fromEntityId', 'toEntityId'],
        },
      }
    ],
  };
});

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (!driver) {
      throw new Error('Neo4j driver not initialized');
    }

    const session = driver.session();

    switch (name) {
      case 'neo4j_query_entities': {
        const { query, limit = 10 } = args;
        
        const result = await session.run(query, { limit });
        const entities = result.records.map(record => ({
          id: record.get('node')?.identity?.toString(),
          labels: record.get('node')?.labels || [],
          properties: record.get('node')?.properties || {},
        }));

        await session.close();

        return {
          content: [
            {
              type: 'text',
              text: `Found ${entities.length} entities:\n\n${JSON.stringify(entities, null, 2)}`,
            },
          ],
        };
      }

      case 'neo4j_get_entity_relationships': {
        const { entityId, depth = 2 } = args;
        
        const result = await session.run(`
          MATCH path = (start:Entity {id: $entityId})-[*1..${depth}]-(end:Entity)
          RETURN path, relationships(path) as rels, nodes(path) as nodes
          LIMIT 50
        `, { entityId });

        const relationships = result.records.map(record => ({
          path: record.get('path'),
          relationships: record.get('rels'),
          nodes: record.get('nodes'),
        }));

        await session.close();

        return {
          content: [
            {
              type: 'text',
              text: `Found ${relationships.length} relationship paths:\n\n${JSON.stringify(relationships.slice(0, 5), null, 2)}`,
            },
          ],
        };
      }

      case 'neo4j_search_entities': {
        const { searchTerm, entityType, limit = 10 } = args;
        
        let query = `
          MATCH (n:Entity)
          WHERE n.name CONTAINS $searchTerm
        `;
        
        if (entityType) {
          query += ` AND $entityType IN labels(n)`;
        }
        
        query += ` RETURN n LIMIT $limit`;

        const result = await session.run(query, { searchTerm, entityType, limit });
        const entities = result.records.map(record => ({
          id: record.get('n').identity.toString(),
          labels: record.get('n').labels,
          properties: record.get('n').properties,
        }));

        await session.close();

        return {
          content: [
            {
              type: 'text',
              text: `Found ${entities.length} entities matching "${searchTerm}":\n\n${JSON.stringify(entities, null, 2)}`,
            },
          ],
        };
      }

      case 'neo4j_get_entity_path': {
        const { fromEntityId, toEntityId, maxDepth = 5 } = args;
        
        const result = await session.run(`
          MATCH path = shortestPath((start:Entity {id: $fromEntityId})-[*1..${maxDepth}]-(end:Entity {id: $toEntityId}))
          RETURN path, length(path) as pathLength, relationships(path) as rels
          ORDER BY pathLength
          LIMIT 1
        `, { fromEntityId, toEntityId });

        if (result.records.length === 0) {
          await session.close();
          return {
            content: [
              {
                type: 'text',
                text: `No path found between entities ${fromEntityId} and ${toEntityId}`,
              },
            ],
          };
        }

        const path = result.records[0];
        const pathData = {
          pathLength: path.get('pathLength'),
          relationships: path.get('rels'),
          path: path.get('path'),
        };

        await session.close();

        return {
          content: [
            {
              type: 'text',
              text: `Shortest path found (length: ${pathData.pathLength}):\n\n${JSON.stringify(pathData, null, 2)}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Neo4j MCP server running on stdio');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}