/**
 * TDD Test Suite for Claude Agent SDK with MCP BrightData Integration
 * 
 * Test Plan:
 * 1. Verify MCP tool creation works
 * 2. Verify BrightData API can be called directly
 * 3. Verify Claude Agent SDK can execute BrightData tool
 * 4. Verify real data (not mock) is returned
 */

const fs = require('fs');
const path = require('path');

// Test 1: Verify MCP tool creation
async function testMCPToolCreation() {
  console.log('\n🧪 TEST 1: MCP Tool Creation');
  console.log('=' .repeat(50));
  
  try {
    // Import the MCP tools
    const { createMCPTools } = require('./src/lib/mcp/index.ts');
    
    // Create tools
    const tools = createMCPTools();
    
    console.log('✅ Tools created successfully:', tools.length);
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    
    // Check if BrightData tool exists
    const brightDataTool = tools.find(t => t.name === 'mcp__brightdata-mcp__search_engine');
    if (brightDataTool) {
      console.log('✅ BrightData tool found and properly configured');
      return true;
    } else {
      console.log('❌ BrightData tool not found');
      return false;
    }
  } catch (error) {
    console.log('❌ MCP Tool Creation failed:', error.message);
    return false;
  }
}

// Test 2: Verify direct BrightData API call
async function testDirectBrightDataAPI() {
  console.log('\n🧪 TEST 2: Direct BrightData API Call');
  console.log('=' .repeat(50));
  
  const apiUrl = 'https://api.brightdata.com/serp';
  const apiToken = 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4';
  
  const searchParams = new URLSearchParams({
    q: 'Manchester United RFP 2025',
    engine: 'google',
    num: '5'
  });
  
  try {
    console.log('🔍 Making direct BrightData API call...');
    console.log(`URL: ${apiUrl}?${searchParams}`);
    
    const response = await fetch(`${apiUrl}?${searchParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      throw new Error(`BrightData API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const results = data.organic_results || [];
    
    console.log('✅ Direct BrightData API call successful');
    console.log(`📊 Results returned: ${results.length}`);
    
    if (results.length > 0) {
      console.log('🔍 Sample result:');
      const sample = results[0];
      console.log(`  Title: ${sample.title}`);
      console.log(`  URL: ${sample.link}`);
      console.log(`  Snippet: ${sample.snippet?.substring(0, 100)}...`);
      return true;
    } else {
      console.log('⚠️ No results returned');
      return false;
    }
  } catch (error) {
    console.log('❌ Direct BrightData API call failed:', error.message);
    return false;
  }
}

// Test 3: Verify BrightData tool function directly
async function testBrightDataToolFunction() {
  console.log('\n🧪 TEST 3: BrightData Tool Function Direct Call');
  console.log('=' .repeat(50));
  
  try {
    // Import and create tools
    const { createMCPTools } = require('./src/lib/mcp/index.ts');
    const tools = createMCPTools();
    
    // Find BrightData tool
    const brightDataTool = tools.find(t => t.name === 'mcp__brightdata-mcp__search_engine');
    
    if (!brightDataTool) {
      console.log('❌ BrightData tool not found');
      return false;
    }
    
    console.log('🔧 Calling BrightData tool function directly...');
    console.log(`Tool function: ${brightDataTool.execute ? 'Found' : 'Missing'}`);
    
    // Call the tool function directly
    const result = await brightDataTool.execute({
      query: 'Manchester United RFP 2025',
      engine: 'google',
      num_results: 5
    });
    
    console.log('✅ BrightData tool function executed successfully');
    console.log('📊 Tool result:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Results count: ${result.count || 0}`);
    console.log(`  Fallback: ${result.fallback || false}`);
    
    if (result.results && result.results.length > 0) {
      console.log('🔍 Sample tool result:');
      const sample = result.results[0];
      console.log(`  Title: ${sample.title}`);
      console.log(`  URL: ${sample.link}`);
      console.log(`  Snippet: ${sample.snippet?.substring(0, 100)}...`);
      return true;
    } else {
      console.log('⚠️ No results from tool function');
      return false;
    }
  } catch (error) {
    console.log('❌ BrightData tool function failed:', error.message);
    console.log('Stack:', error.stack);
    return false;
  }
}

// Test 4: Simple Claude Agent SDK test with single tool
async function testClaudeAgentSDKSingleTool() {
  console.log('\n🧪 TEST 4: Claude Agent SDK with Single BrightData Tool');
  console.log('=' .repeat(50));
  
  try {
    const { query } = require('@anthropic-ai/claude-agent-sdk');
    const { createMCPTools } = require('./src/lib/mcp/index.ts');
    
    // Create only the BrightData tool for this test
    const tools = createMCPTools();
    const brightDataTool = tools.find(t => t.name === 'mcp__brightdata-mcp__search_engine');
    
    console.log('🔧 Using single BrightData tool for Claude Agent SDK test');
    console.log(`Tool: ${brightDataTool.name}`);
    
    // Simple prompt that should trigger the tool
    const simplePrompt = `
    Please use the BrightData search tool to search for "Manchester United RFP 2025".
    Return exactly what the tool returns - do not make up any results.
    `;
    
    console.log('🤖 Starting Claude Agent SDK execution...');
    
    let toolCalls = 0;
    let toolResults = [];
    
    for await (const message of query({
      prompt: simplePrompt,
      options: {
        model: "claude-3.5-sonnet",
        tools: [brightDataTool], // Only the BrightData tool
        temperature: 0.1, // Low temperature for predictable results
        maxTokens: 1000
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
          if (message.output.length < 500) {
            console.log(`Content: ${message.output}`);
          }
        } else {
          console.log(`📊 Result is object, keys: ${Object.keys(message.output || {})}`);
          if (message.output && message.output.results) {
            console.log(`Results count: ${message.output.results.length}`);
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
      if (toolCalls > 5) {
        console.log('🛑 Safety break: too many tool calls');
        break;
      }
    }
    
    console.log('\n📊 Claude Agent SDK Test Results:');
    console.log(`Tool calls made: ${toolCalls}`);
    console.log(`Tool results received: ${toolResults.length}`);
    
    if (toolCalls > 0 && toolResults.length > 0) {
      console.log('✅ Claude Agent SDK successfully executed BrightData tool');
      return true;
    } else {
      console.log('❌ Claude Agent SDK did not execute BrightData tool');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Claude Agent SDK test failed:', error.message);
    console.log('Stack:', error.stack);
    return false;
  }
}

// Test 5: Verify non-mock data
function verifyNonMockData(result) {
  console.log('\n🧪 TEST 5: Verify Non-Mock Data');
  console.log('=' .repeat(50));
  
  if (!result || !result.results || result.results.length === 0) {
    console.log('❌ No results to verify');
    return false;
  }
  
  const firstResult = result.results[0];
  
  // Check for mock indicators
  const mockIndicators = [
    'example.com',
    'placeholder',
    'mock',
    'fake',
    'API Error',
    'fallback'
  ];
  
  const hasMockIndicators = mockIndicators.some(indicator => 
    JSON.stringify(firstResult).toLowerCase().includes(indicator)
  );
  
  if (hasMockIndicators) {
    console.log('❌ Result contains mock/fallback data');
    console.log('Sample result:', JSON.stringify(firstResult, null, 2));
    return false;
  }
  
  // Check for real data indicators
  const hasRealIndicators = 
    firstResult.link && 
    (firstResult.link.includes('http') || firstResult.link.includes('www')) &&
    firstResult.link !== 'https://api-error.com' &&
    firstResult.link !== 'https://example.com';
  
  if (hasRealIndicators) {
    console.log('✅ Result appears to be real data');
    console.log(`Real URL: ${firstResult.link}`);
    return true;
  } else {
    console.log('⚠️ Result may not be real data');
    console.log('Sample result:', JSON.stringify(firstResult, null, 2));
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🧪 TDD Test Suite: Claude Agent SDK + MCP BrightData Integration');
  console.log('=' .repeat(70));
  
  const results = [];
  
  // Test 1: MCP Tool Creation
  results.push(await testMCPToolCreation());
  
  // Test 2: Direct BrightData API
  results.push(await testDirectBrightDataAPI());
  
  // Test 3: BrightData Tool Function
  results.push(await testBrightDataToolFunction());
  
  // Test 4: Claude Agent SDK with Single Tool
  results.push(await testClaudeAgentSDKSingleTool());
  
  // Summary
  console.log('\n🎯 TDD TEST SUMMARY');
  console.log('=' .repeat(70));
  
  const testNames = [
    'MCP Tool Creation',
    'Direct BrightData API',
    'BrightData Tool Function',
    'Claude Agent SDK Single Tool'
  ];
  
  testNames.forEach((name, index) => {
    const status = results[index] ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${name}: ${status}`);
  });
  
  const passedTests = results.filter(r => r).length;
  const totalTests = results.length;
  
  console.log(`\n📊 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! BrightData MCP integration is working.');
  } else {
    console.log('⚠️ Some tests failed. Check the logs above for details.');
  }
  
  return passedTests === totalTests;
}

// Run the tests
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

module.exports = {
  testMCPToolCreation,
  testDirectBrightDataAPI,
  testBrightDataToolFunction,
  testClaudeAgentSDKSingleTool,
  verifyNonMockData,
  runAllTests
};