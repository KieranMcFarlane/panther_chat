#!/usr/bin/env node

/**
 * Direct test of Claude Agent SDK import and basic functionality
 */

// Test if we can import the SDK
let query;
try {
  query = require("@anthropic-ai/claude-agent-sdk").query;
  console.log('✅ Claude Agent SDK imported successfully');
} catch (error) {
  console.error('❌ Failed to import Claude Agent SDK:', error.message);
  process.exit(1);
}

// Test basic MCP configuration loading
async function testMCPConfig() {
  try {
    console.log('🔧 Testing MCP configuration...');
    
    // This is the same function from the backend
    const mcpConfig = {
      "supabase": {
        command: "node",
        args: ["/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/mcp-servers/supabase-mcp-server/build/index.js"],
        env: {
          "SUPABASE_URL": process.env.SUPABASE_URL || "https://fieknjkraswqxswzplbih.supabase.co",
          "SUPABASE_ANON_KEY": process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        }
      },
      "neo4j-mcp": {
        command: "node", 
        args: ["/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/mcp-servers/neo4j-mcp-server/build/index.js"],
        env: {
          "NEO4J_URI": process.env.NEO4J_URI || "neo4j+s://demo.neo4jlabs.com",
          "NEO4J_USERNAME": process.env.NEO4J_USERNAME || "neo4j",
          "NEO4J_PASSWORD": process.env.NEO4J_PASSWORD || "demo"
        }
      },
      "brightData": {
        command: "node",
        args: ["/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/mcp-servers/brightdata-mcp-server/build/index.js"],
        env: {
          "BRIGHTDATA_API_TOKEN": process.env.BRIGHTDATA_API_TOKEN || "bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4"
        }
      }
    };
    
    console.log('✅ MCP Config loaded');
    return mcpConfig;
    
  } catch (error) {
    console.error('❌ MCP config failed:', error.message);
    return null;
  }
}

// Test actual Claude Agent SDK query
async function testClaudeQuery() {
  try {
    console.log('🧠 Testing Claude Agent SDK query...');
    
    const mcpConfig = await testMCPConfig();
    if (!mcpConfig) {
      throw new Error('Failed to load MCP config');
    }
    
    console.log('📞 Calling Claude Agent SDK with simple test...');
    
    const testPrompt = 'tell me about arsenal football club in one sentence';
    
    for await (const response of query({
      prompt: testPrompt,
      options: {
        mcpServers: mcpConfig,
        maxTurns: 2,
        systemPrompt: {
          type: "text",
          text: "You are a sports intelligence AI assistant. Provide brief, accurate responses."
        }
      }
    })) {
      console.log(`📨 Response type: ${response.type}`);
      
      if (response.type === 'text') {
        console.log(`💬 Text: ${response.text.substring(0, 200)}...`);
      } else if (response.type === 'result') {
        console.log(`🎯 Result: ${response.result?.substring(0, 200)}...`);
        break; // End on result
      } else {
        console.log(`📦 Other: ${JSON.stringify(response).substring(0, 200)}...`);
      }
    }
    
    console.log('✅ Claude Agent SDK test completed successfully');
    
  } catch (error) {
    console.error('❌ Claude Agent SDK query failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testClaudeQuery().then(() => {
  console.log('\n🎯 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Test failed:', error);
  process.exit(1);
});