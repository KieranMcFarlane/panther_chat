/**
 * TDD Test Suite for Real MCP Client Integration
 * 
 * Test Plan:
 * 1. Verify real MCP server connection
 * 2. Verify real BrightData tool availability
 * 3. Verify real BrightData tool execution
 * 4. Verify real data (not mock) is returned
 * 5. Verify Claude Agent SDK with real MCP tools
 */

const { getMCPClient, createRealMCPTools } = require('./src/lib/mcp-real-client.ts');

// Test 1: Verify real MCP server connection
async function testRealMCPServerConnection() {
  console.log('\n🧪 TEST 1: Real MCP Server Connection');
  console.log('=' .repeat(50));
  
  try {
    const client = await getMCPClient();
    const tools = client.getAvailableTools();
    
    console.log('✅ MCP client created successfully');
    console.log(`📊 Available tools: ${Object.keys(tools).length}`);
    
    // Check for BrightData tools
    const brightDataTools = Object.keys(tools).filter(name => name.includes('brightData'));
    console.log(`🔍 BrightData tools found: ${brightDataTools.length}`);
    
    brightDataTools.forEach(toolName => {
      console.log(`  - ${toolName}`);
    });
    
    if (brightDataTools.length > 0) {
      console.log('✅ Real BrightData MCP server connected');
      return true;
    } else {
      console.log('❌ No BrightData tools found');
      return false;
    }
  } catch (error) {
    console.log('❌ Real MCP server connection failed:', error.message);
    console.log('Stack:', error.stack);
    return false;
  }
}

// Test 2: Verify real BrightData tool execution
async function testRealBrightDataToolExecution() {
  console.log('\n🧪 TEST 2: Real BrightData Tool Execution');
  console.log('=' .repeat(50));
  
  try {
    const client = await getMCPClient();
    
    console.log('🔧 Calling real BrightData search_engine tool...');
    
    const result = await client.callTool('brightData', 'search_engine', {
      query: 'Manchester United RFP 2025',
      engine: 'google'
    });
    
    console.log('✅ Real BrightData tool executed successfully');
    console.log('📊 Tool result structure:');
    console.log(`  Result type: ${typeof result}`);
    console.log(`  Has content: ${!!result.content}`);
    console.log(`  Has isError: ${!!result.isError}`);
    
    if (result.content) {
      console.log(`  Content length: ${result.content.length}`);
      console.log('🔍 Sample content (first 300 chars):');
      console.log(`  ${result.content.substring(0, 300)}...`);
      
      // Check for real data indicators
      const hasRealUrl = result.content.includes('http') && 
                         !result.content.includes('example.com') &&
                         !result.content.includes('api-error.com');
      
      if (hasRealUrl) {
        console.log('✅ Content appears to contain real URLs');
        return true;
      } else {
        console.log('⚠️ Content may not contain real URLs');
        return false;
      }
    } else {
      console.log('❌ No content in tool result');
      return false;
    }
  } catch (error) {
    console.log('❌ Real BrightData tool execution failed:', error.message);
    console.log('Stack:', error.stack);
    return false;
  }
}

// Test 3: Verify Claude Agent SDK with real MCP tools
async function testClaudeAgentSDKWithRealMCP() {
  console.log('\n🧪 TEST 3: Claude Agent SDK with Real MCP Tools');
  console.log('=' .repeat(50));
  
  try {
    const { query } = require('@anthropic-ai/claude-agent-sdk');
    
    console.log('🔧 Creating real MCP tools for Claude Agent SDK...');
    const tools = await createRealMCPTools();
    
    console.log(`✅ Created ${tools.length} real MCP tools for Claude Agent SDK`);
    
    // Find BrightData search tool
    const brightDataTool = tools.find(t => t.name.includes('brightData') && t.name.includes('search_engine'));
    
    if (!brightDataTool) {
      console.log('❌ BrightData search tool not found');
      return false;
    }
    
    console.log(`🔍 Using BrightData tool: ${brightDataTool.name}`);
    
    // Simple prompt that should trigger the tool
    const simplePrompt = `
    Please use the BrightData search engine tool to search for "Manchester United RFP 2025".
    Return exactly what the tool returns - do not make up any results.
    `;
    
    console.log('🤖 Starting Claude Agent SDK with real MCP tools...');
    
    let toolCalls = 0;
    let toolResults = [];
    
    for await (const message of query({
      prompt: simplePrompt,
      options: {
        model: "claude-3.5-sonnet",
        tools: [brightDataTool], // Only test with BrightData tool
        temperature: 0.1,
        maxTokens: 2000
      },
    })) {
      
      console.log(`📨 Message type: ${message.type}`);
      
      if (message.type === "tool_use") {
        toolCalls++;
        console.log(`🛠️ Tool Call #${toolCalls}: ${message.tool_name}`);
        console.log(`📝 Arguments:`, JSON.stringify(message.args, null, 2));
      }
      
      if (message.type === "tool_result") {
        console.log(`✅ Tool Result for: ${message.tool_name}`);
        toolResults.push({
          tool: message.tool_name,
          output: message.output
        });
        
        // Log the result structure
        if (typeof message.output === 'string') {
          console.log(`📄 Result is string, length: ${message.output.length}`);
          
          // Check for real data
          const hasRealIndicators = 
            message.output.includes('http') &&
            !message.output.includes('example.com') &&
            !message.output.includes('api-error.com') &&
            !message.output.includes('placeholder');
          
          if (hasRealIndicators) {
            console.log('✅ Result contains real data indicators');
          } else {
            console.log('⚠️ Result may not contain real data');
          }
          
          // Show first 300 chars
          if (message.output.length > 0) {
            console.log(`📄 Content preview: ${message.output.substring(0, 300)}...`);
          }
        } else {
          console.log(`📊 Result is object, keys: ${Object.keys(message.output || {})}`);
          if (message.output && message.output.content) {
            console.log(`Content length: ${message.output.content.length}`);
          }
        }
      }
      
      if (message.type === "message") {
        console.log(`💬 Claude response: ${message.content?.substring(0, 200)}...`);
      }
      
      if (message.type === "error") {
        console.log(`❌ Error: ${message.error.message}`);
      }
      
      // Safety break to prevent infinite loops
      if (toolCalls > 3) {
        console.log('🛑 Safety break: too many tool calls');
        break;
      }
    }
    
    console.log('\n📊 Claude Agent SDK Test Results:');
    console.log(`Tool calls made: ${toolCalls}`);
    console.log(`Tool results received: ${toolResults.length}`);
    
    if (toolCalls > 0 && toolResults.length > 0) {
      console.log('✅ Claude Agent SDK successfully executed real BrightData tool');
      
      // Verify real data in results
      const hasRealData = toolResults.some(result => {
        const outputStr = typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
        return outputStr.includes('http') && 
               !outputStr.includes('example.com') &&
               !outputStr.includes('api-error.com');
      });
      
      if (hasRealData) {
        console.log('✅ Real data found in tool results');
        return true;
      } else {
        console.log('⚠️ No real data found in tool results');
        return false;
      }
    } else {
      console.log('❌ Claude Agent SDK did not execute BrightData tool');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Claude Agent SDK with real MCP failed:', error.message);
    console.log('Stack:', error.stack);
    return false;
  }
}

// Main test runner
async function runRealMCPTests() {
  console.log('🧪 TDD Test Suite: Real MCP Client Integration');
  console.log('=' .repeat(70));
  
  const results = [];
  
  // Test 1: Real MCP Server Connection
  results.push(await testRealMCPServerConnection());
  
  // Test 2: Real BrightData Tool Execution
  results.push(await testRealBrightDataToolExecution());
  
  // Test 3: Claude Agent SDK with Real MCP
  results.push(await testClaudeAgentSDKWithRealMCP());
  
  // Summary
  console.log('\n🎯 REAL MCP TDD TEST SUMMARY');
  console.log('=' .repeat(70));
  
  const testNames = [
    'Real MCP Server Connection',
    'Real BrightData Tool Execution',
    'Claude Agent SDK with Real MCP'
  ];
  
  testNames.forEach((name, index) => {
    const status = results[index] ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${name}: ${status}`);
  });
  
  const passedTests = results.filter(r => r).length;
  const totalTests = results.length;
  
  console.log(`\n📊 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Real MCP integration is working with actual data.');
  } else {
    console.log('⚠️ Some tests failed. Check the logs above for details.');
  }
  
  return passedTests === totalTests;
}

// Run the tests
if (require.main === module) {
  runRealMCPTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Real MCP test runner error:', error);
      process.exit(1);
    });
}

module.exports = {
  testRealMCPServerConnection,
  testRealBrightDataToolExecution,
  testClaudeAgentSDKWithRealMCP,
  runRealMCPTests
};