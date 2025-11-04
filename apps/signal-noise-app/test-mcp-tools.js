const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { spawn } = require('child_process');

async function testNeo4jMCP() {
  console.log('Testing Neo4j MCP server directly...');
  
  // Start the MCP server process
  const serverProcess = spawn('npx', ['-y', '@alanse/mcp-neo4j-server'], {
    env: {
      NEO4J_URI: 'neo4j+s://cce1f84b.databases.neo4j.io',
      NEO4J_USERNAME: 'neo4j',
      NEO4J_PASSWORD: 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0',
      NEO4J_DATABASE: 'neo4j',
      AURA_INSTANCEID: 'cce1f84b',
      AURA_INSTANCENAME: 'Instance01'
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });

  // Wait a moment for the server to start
  await new Promise(resolve => setTimeout(resolve, 3000));

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
    console.log('✅ Connected to Neo4j MCP server');

    // List available tools
    const tools = await client.listTools();
    console.log('🛠️ Available tools:', tools);
    
    if (tools.tools && tools.tools.length > 0) {
      console.log('✅ Tools found:');
      tools.tools.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
    } else {
      console.log('❌ No tools found');
    }

    // Try to execute a query if tools exist
    if (tools.tools && tools.tools.length > 0) {
      const executeTool = tools.tools.find(t => t.name.includes('execute') || t.name.includes('query'));
      if (executeTool) {
        console.log(`🔧 Testing tool: ${executeTool.name}`);
        const result = await client.callTool({
          name: executeTool.name,
          arguments: {
            query: "MATCH (n:Club) RETURN n.name LIMIT 5"
          }
        });
        console.log('📊 Query result:', result);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    serverProcess.kill();
  }
}

testNeo4jMCP().catch(console.error);