const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');

async function testNeo4jMCPServer() {
  console.log('Testing Neo4j MCP server...');

  try {
    // Create client transport that spawns the Neo4j MCP server
    const transport = new StdioClientTransport({
      command: '/opt/homebrew/bin/node',
      args: ['neo4j-mcp-server.js'],
      env: {
        NEO4J_URI: 'neo4j+s://cce1f84b.databases.neo4j.io',
        NEO4J_USERNAME: 'neo4j',
        NEO4J_PASSWORD: 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0',
        NEO4J_DATABASE: 'neo4j'
      },
      stderr: 'pipe' // Capture stderr for debugging
    });

    // Capture stderr output
    transport.stderr?.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });

    // Create and connect client
    const client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    // Set up error handling before connecting
    transport.onerror = (error) => {
      console.error('❌ Transport error:', error);
    };

    transport.onclose = () => {
      console.log('📴 Transport closed');
    };

    console.log('🔄 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected to Neo4j MCP server');

    // List available tools
    const tools = await client.listTools();
    console.log('🛠️ Available tools:', JSON.stringify(tools, null, 2));
    
    if (tools.tools && tools.tools.length > 0) {
      console.log('✅ Tools found:');
      tools.tools.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
      
      // Test the search_sports_entities tool
      const searchTool = tools.tools.find(t => t.name === 'search_sports_entities');
      if (searchTool) {
        console.log(`🔧 Testing tool: ${searchTool.name}`);
        const searchResult = await client.callTool({
          name: searchTool.name,
          arguments: {
            entityName: "Manchester United"
          }
        });
        console.log('📊 Search result:', JSON.stringify(searchResult, null, 2));
      }

      // Test the execute_query tool
      const queryTool = tools.tools.find(t => t.name === 'execute_query');
      if (queryTool) {
        console.log(`🔧 Testing tool: ${queryTool.name}`);
        const queryResult = await client.callTool({
          name: queryTool.name,
          arguments: {
            query: "MATCH (n:Club) RETURN n.name LIMIT 3"
          }
        });
        console.log('📊 Query result:', JSON.stringify(queryResult, null, 2));
      }
    } else {
      console.log('❌ No tools found');
    }

    // Close the connection
    await client.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testNeo4jMCPServer().catch(console.error);