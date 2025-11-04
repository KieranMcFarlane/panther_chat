const { mcpBus } = require('./src/lib/mcp/MCPClientBus');

async function testMCPBus() {
  console.log('🧪 Testing MCP Client Bus...');
  
  try {
    // Initialize the MCP Bus
    console.log('🔌 Initializing MCP Bus...');
    await mcpBus.initialize();
    
    // Get available tools
    const tools = mcpBus.getAvailableTools();
    console.log(`📝 Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`  - ${tool.name} (${tool.server})`);
    });
    
    // Test Neo4j connection
    if (tools.find(t => t.name.includes('neo4j'))) {
      console.log('🧪 Testing Neo4j MCP...');
      const neo4jResult = await mcpBus.callTool('neo4j_query_entities', { 
        query: 'MATCH (n:Entity) RETURN count(n) as entityCount LIMIT 1' 
      });
      console.log('✅ Neo4j Result:', neo4jResult.content[0].text.substring(0, 100) + '...');
    }
    
    // Test BrightData connection
    if (tools.find(t => t.name.includes('brightdata'))) {
      console.log('🧪 Testing BrightData MCP...');
      const brightdataResult = await mcpBus.callTool('brightdata_search_google', { 
        query: 'sports technology partnerships', 
        country: 'us', 
        numResults: 2 
      });
      console.log('✅ BrightData Result:', brightdataResult.content[0].text.substring(0, 100) + '...');
    }
    
    // Test Perplexity connection
    if (tools.find(t => t.name.includes('perplexity'))) {
      console.log('🧪 Testing Perplexity MCP...');
      const perplexityResult = await mcpBus.callTool('perplexity_search', { 
        query: 'sports industry digital transformation trends 2024', 
        model: 'sonar-pro', 
        max_tokens: 512 
      });
      console.log('✅ Perplexity Result:', perplexityResult.content[0].text.substring(0, 100) + '...');
    }
    
    // Get server status
    const status = mcpBus.getServerStatus();
    console.log('📊 Server Status:', status);
    
    console.log('🎉 MCP Bus test completed successfully!');
    
  } catch (error) {
    console.error('❌ MCP Bus test failed:', error.message);
  } finally {
    // Clean up
    await mcpBus.close();
  }
}

testMCPBus();