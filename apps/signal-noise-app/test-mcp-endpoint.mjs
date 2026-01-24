/**
 * Simple MCP Tool Binding Test via CopilotKit Endpoint
 *
 * This test verifies that MCP tools are being properly bound by:
 * 1. Starting the dev server (or verifying it's running)
 * 2. Sending a query to the CopilotKit endpoint
 * 3. Checking the logs for tool binding evidence
 */

import { spawn } from 'child_process';

async function testCopilotKitEndpoint() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 CopilotKit MCP Tool Binding Test');
  console.log('═══════════════════════════════════════════════════════\n');

  // Check if server is already running
  console.log('📡 Checking if dev server is running on port 3005...');
  const isRunning = await checkServerRunning();

  if (!isRunning) {
    console.log('⚠️  Dev server is not running.');
    console.log('');
    console.log('Please start it first:');
    console.log('  npm run dev');
    console.log('');
    console.log('Then run this test again in a new terminal.');
    return false;
  }

  console.log('✅ Dev server is running\n');

  // Send a test query
  console.log('📤 Sending test query that should trigger MCP tools...');
  console.log('   Query: "Search the graph for Arsenal and tell me what you find"\n');

  try {
    const response = await fetch('http://localhost:3005/api/copilotkit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Search the graph for Arsenal and tell me what you find. Use the search_nodes tool.'
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      console.error(`❌ Request failed: ${response.status} ${response.statusText}`);
      return false;
    }

    const data = await response.text();
    console.log('📥 Response received (first 1000 chars):');
    console.log(data.substring(0, 1000));
    console.log('');

    // Now check what we need to verify
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 MANUAL VERIFICATION REQUIRED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('The request was sent successfully. Now check your dev server logs for:');
    console.log('');
    console.log('✅ SUCCESS INDICATORS:');
    console.log('   1. 🔧 Extracting MCP tools for model binding...');
    console.log('   2. ✅ Extracted X MCP tools for model');
    console.log('   3. 🔧 Tools sent to model: mcp__graphiti__search_nodes, ...');
    console.log('   4. 🔧 TOOL CALLED: mcp__graphiti__search_nodes');
    console.log('   5. ✅ TOOL RESULT: mcp__graphiti__search_nodes');
    console.log('');
    console.log('📊 FINAL SUMMARY:');
    console.log('   Tools sent to model: X (> 0)');
    console.log('   Tool calls made: X (> 0 = success!)');
    console.log('');
    console.log('❌ FAILURE INDICATORS:');
    console.log('   - Tools sent to model: 0');
    console.log('   - Tool calls made: 0');
    console.log('   - No "TOOL CALLED" messages');
    console.log('');
    console.log('═══════════════════════════════════════════════════════');

    return true;

  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

async function checkServerRunning() {
  try {
    const response = await fetch('http://localhost:3005', {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000)
    });
    return response.ok || response.status === 404; // 404 is fine, means server is up
  } catch {
    return false;
  }
}

// Run test
testCopilotKitEndpoint().then(success => {
  if (success) {
    console.log('✅ Test request sent. Check server logs for tool binding evidence.');
  }
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
