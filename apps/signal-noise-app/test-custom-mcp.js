const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { spawn } = require('child_process');

async function testCustomNeo4jMCP() {
  console.log('Testing custom Neo4j MCP server...');
  
  // Start our custom MCP server
  const serverProcess = spawn('/opt/homebrew/bin/node', ['neo4j-mcp-server.js'], {
    env: {
      NEO4J_URI: 'neo4j+s://cce1f84b.databases.neo4j.io',
      NEO4J_USERNAME: 'neo4j',
      NEO4J_PASSWORD: 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0',
      NEO4J_DATABASE: 'neo4j'
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false
  });

  // Wait a moment for the server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Create client transport
  const transport = new StdioClientTransport({
    readable: serverProcess.stdout,
    writable: serverProcess.stdin
  });

  // Create and connect client
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected to custom Neo4j MCP server');

    // List available tools
    const tools = await client.listTools();
    console.log('🛠️ Available tools:', JSON.stringify(tools, null, 2));
    
    if (tools.tools && tools.tools.length > 0) {
      console.log('✅ Tools found:');
      tools.tools.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
      
      // Test the execute_query tool
      const executeTool = tools.tools.find(t => t.name === 'execute_query');
      if (executeTool) {
        console.log(`🔧 Testing tool: ${executeTool.name}`);
        const result = await client.callTool({
          name: executeTool.name,
          arguments: {
            query: "MATCH (n:Club) RETURN n.name as club_name LIMIT 3"
          }
        });
        console.log('📊 Query result:', JSON.stringify(result, null, 2));
      }
    } else {
      console.log('❌ No tools found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    serverProcess.kill();
  }
}

testCustomNeo4jMCP().catch(console.error);