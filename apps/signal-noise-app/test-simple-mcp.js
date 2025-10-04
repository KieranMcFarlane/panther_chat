const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { spawn } = require('child_process');

async function testSimpleMCP() {
  console.log('Testing simple MCP server...');

  try {
    // Create client transport that spawns the server process
    const transport = new StdioClientTransport({
      command: '/opt/homebrew/bin/node',
      args: ['simple-test-mcp.js'],
      stderr: 'pipe' // Capture stderr for debugging
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

    await client.connect(transport);
    console.log('✅ Connected to simple MCP server');

    // List available tools
    const tools = await client.listTools();
    console.log('🛠️ Available tools:', JSON.stringify(tools, null, 2));
    
    if (tools.tools && tools.tools.length > 0) {
      console.log('✅ Tools found:');
      tools.tools.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
      
      // Test the test_query tool
      const testTool = tools.tools.find(t => t.name === 'test_query');
      if (testTool) {
        console.log(`🔧 Testing tool: ${testTool.name}`);
        const result = await client.callTool({
          name: testTool.name,
          arguments: {
            query: "MATCH (n:Club) RETURN n.name LIMIT 3"
          }
        });
        console.log('📊 Tool result:', JSON.stringify(result, null, 2));
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

testSimpleMCP().catch(console.error);