/**
 * Simple test to verify MCP server connection and tool execution
 */

const { spawn } = require('child_process');

// Test direct MCP server connection
async function testDirectMCPServer() {
  console.log('🧪 Testing direct BrightData MCP server connection...');
  
  return new Promise((resolve) => {
    const mcpServer = spawn('npx', ['-y', '@brightdata/mcp'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        API_TOKEN: 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
        PRO_MODE: 'true'
      }
    });
    
    let output = '';
    let messageId = 1;
    
    mcpServer.stdout.on('data', (data) => {
      output += data.toString();
      
      // Process complete JSON lines
      const lines = output.split('\n');
      output = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            console.log('📨 MCP Response:', JSON.stringify(message, null, 2));
            
            if (message.method === 'tools/call' && message.result) {
              console.log('✅ Tool execution result received');
              console.log('📊 Result type:', typeof message.result);
              console.log('📊 Result keys:', Object.keys(message.result || {}));
              
              if (message.result.content) {
                console.log('📄 Content length:', message.result.content.length);
                console.log('🔍 Content preview:', message.result.content.substring(0, 300) + '...');
                
                // Check for real data
                const hasRealUrl = message.result.content.includes('http') && 
                                   !message.result.content.includes('example.com') &&
                                   !message.result.content.includes('placeholder');
                
                console.log(hasRealUrl ? '✅ Real data found' : '⚠️ No real data found');
                
                mcpServer.kill();
                resolve(hasRealUrl);
                return;
              }
            }
          } catch (error) {
            console.warn('Failed to parse MCP message:', line);
          }
        }
      }
    });
    
    mcpServer.stderr.on('data', (data) => {
      console.log('MCP stderr:', data.toString());
    });
    
    mcpServer.on('error', (error) => {
      console.error('MCP Server error:', error.message);
      resolve(false);
    });
    
    // Wait for server to start
    setTimeout(() => {
      console.log('📤 Sending tool list request...');
      const listRequest = {
        jsonrpc: '2.0',
        id: messageId++,
        method: 'tools/list',
        params: {}
      };
      mcpServer.stdin.write(JSON.stringify(listRequest) + '\n');
    }, 2000);
    
    // Wait for tools list, then call search tool
    setTimeout(() => {
      console.log('📤 Sending search tool call...');
      const callRequest = {
        jsonrpc: '2.0',
        id: messageId++,
        method: 'tools/call',
        params: {
          name: 'search_engine',
          arguments: {
            query: 'Manchester United RFP 2025',
            engine: 'google'
          }
        }
      };
      mcpServer.stdin.write(JSON.stringify(callRequest) + '\n');
    }, 4000);
    
    // Timeout after 15 seconds
    setTimeout(() => {
      console.log('⏰ Test timeout');
      mcpServer.kill();
      resolve(false);
    }, 15000);
  });
}

// Test the complete flow
async function runSimpleMCPTest() {
  console.log('🧪 Simple MCP Server Test');
  console.log('=' .repeat(50));
  
  const success = await testDirectMCPServer();
  
  console.log('\n🎯 Test Result:', success ? '✅ PASS' : '❌ FAIL');
  
  if (success) {
    console.log('🎉 BrightData MCP server is working and returning real data!');
  } else {
    console.log('❌ BrightData MCP server test failed');
  }
  
  return success;
}

// Run the test
runSimpleMCPTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
