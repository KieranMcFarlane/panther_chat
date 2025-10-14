/**
 * Simple MCP Bus Test
 * Test MCP connection and list available tools
 */

import { mcpBus } from './src/lib/mcp/MCPClientBus.js';

async function testMCPBus() {
  console.log('🧪 Testing MCP Client Bus...');
  
  try {
    // Initialize the MCP Bus
    console.log('🔌 Initializing MCP Bus...');
    await mcpBus.initialize();
    
    // Get server status
    const status = mcpBus.getServerStatus();
    console.log('📊 Server Status:', status);
    
    // Get available tools
    const tools = mcpBus.getAvailableTools();
    console.log(`📝 Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`  - ${tool.name} (${tool.server}): ${tool.description}`);
    });
    
    if (tools.length === 0) {
      console.log('❌ No tools found. MCP servers failed to connect.');
      console.log('\nTroubleshooting:');
      console.log('1. Check if npm packages are installed:');
      console.log('   - @alanse/mcp-neo4j-server');
      console.log('   - @brightdata/mcp'); 
      console.log('   - mcp-perplexity-search');
      console.log('\n2. Try installing them manually:');
      console.log('   npm install -g @alanse/mcp-neo4j-server @brightdata/mcp mcp-perplexity-search');
    } else {
      console.log('✅ MCP Bus is working!');
      
      // Test first available tool
      const firstTool = tools[0];
      console.log(`\n🧪 Testing tool: ${firstTool.name}`);
      
      try {
        const result = await mcpBus.callTool(firstTool.name, {});
        console.log('✅ Tool call successful:', result.content?.[0]?.text?.substring(0, 100) + '...');
      } catch (error) {
        console.log('❌ Tool call failed:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ MCP Bus test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    // Clean up
    await mcpBus.close();
  }
}

testMCPBus();