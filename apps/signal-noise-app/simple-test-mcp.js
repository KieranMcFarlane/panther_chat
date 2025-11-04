#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Simple test server that doesn't use Neo4j
class SimpleTestMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'simple-test-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.error('📋 Listing tools...');
      return {
        tools: [
          {
            name: 'test_query',
            description: 'A simple test query tool',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Test query parameter',
                },
              },
              required: ['query'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.error(`🔧 Tool called: ${name} with args:`, args);

      if (name === 'test_query') {
        const result = {
          success: true,
          query: args.query,
          results: [
            { id: 1, data: { test: 'result1', value: 42 } },
            { id: 2, data: { test: 'result2', value: 100 } }
          ],
          count: 2
        };
        
        console.error('✅ Test query executed successfully');
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  async run() {
    console.error('🚀 Starting simple test MCP server...');
    try {
      const transport = new StdioServerTransport();
      console.error('📡 Transport created');
      await this.server.connect(transport);
      console.error('✅ Server connected to transport');
      console.error('🚀 Simple test MCP server running on stdio');
    } catch (error) {
      console.error('❌ Server startup error:', error);
      throw error;
    }
  }
}

const server = new SimpleTestMCPServer();
server.run().catch(console.error);