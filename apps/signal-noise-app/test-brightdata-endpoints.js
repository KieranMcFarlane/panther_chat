/**
 * Test different BrightData API endpoints to find the correct one
 */

async function testBrightDataEndpoints() {
  const apiToken = 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4';
  
  const endpoints = [
    'https://api.brightdata.com/serp',
    'https://api.brightdata.com/serp/v1', 
    'https://api.brightdata.com/serp_engine',
    'https://api.brightdata.com/google_search',
    'https://api.brightdata.com/scrapers/serp',
    'https://api.brightdata.com/ldp_scraper/serp',
    'https://brightdata.com/api/serp',
    'https://serp.brightdata.com/api'
  ];
  
  console.log('🔍 Testing BrightData API endpoints...');
  console.log('Token:', apiToken.substring(0, 20) + '...');
  
  for (const endpoint of endpoints) {
    console.log(`\n📡 Testing: ${endpoint}`);
    
    try {
      const searchParams = new URLSearchParams({
        q: 'test',
        engine: 'google',
        num: '5'
      });
      
      const response = await fetch(`${endpoint}?${searchParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`  Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        console.log('  ✅ SUCCESS! This endpoint works.');
        const data = await response.json();
        console.log('  Response structure:', Object.keys(data));
        if (data.organic_results) {
          console.log(`  Results: ${data.organic_results.length}`);
        }
        return endpoint; // Return working endpoint
      } else {
        const errorText = await response.text();
        console.log(`  Error: ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`  Exception: ${error.message}`);
    }
  }
  
  console.log('\n❌ No working endpoints found.');
  return null;
}

// Test different auth methods
async function testAuthMethods() {
  console.log('\n🔑 Testing different authentication methods...');
  
  const workingEndpoint = 'https://api.brightdata.com/serp'; // Assume this is the right base
  const apiToken = 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4';
  
  const authMethods = [
    { name: 'Bearer', headers: { 'Authorization': `Bearer ${apiToken}` } },
    { name: 'API Key', headers: { 'X-API-KEY': apiToken } },
    { name: 'Token', headers: { 'Authorization': `Token ${apiToken}` } },
    { name: 'Basic', headers: { 'Authorization': `Basic ${Buffer.from(apiToken + ':').toString('base64')}` } },
    { name: 'Custom', headers: { 'Authorization': apiToken } }
  ];
  
  for (const auth of authMethods) {
    console.log(`\n🔑 Trying ${auth.name} auth...`);
    
    try {
      const searchParams = new URLSearchParams({
        q: 'test',
        engine: 'google',
        num: '5'
      });
      
      const response = await fetch(`${workingEndpoint}?${searchParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...auth.headers
        }
      });
      
      console.log(`  Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        console.log(`  ✅ ${auth.name} auth works!`);
        return auth;
      } else {
        const errorText = await response.text();
        console.log(`  Error: ${errorText.substring(0, 100)}`);
      }
    } catch (error) {
      console.log(`  Exception: ${error.message}`);
    }
  }
  
  return null;
}

// Test the official MCP server approach
async function testMCPBrightDataServer() {
  console.log('\n🚀 Testing BrightData MCP Server directly...');
  
  const { spawn } = require('child_process');
  
  return new Promise((resolve) => {
    console.log('Spawning BrightData MCP server...');
    
    const mcpServer = spawn('npx', ['-y', '@brightdata/mcp'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        API_TOKEN: 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
        PRO_MODE: 'true'
      }
    });
    
    let output = '';
    let errorOutput = '';
    
    mcpServer.stdout.on('data', (data) => {
      output += data.toString();
      console.log('MCP Server stdout:', data.toString());
    });
    
    mcpServer.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log('MCP Server stderr:', data.toString());
    });
    
    mcpServer.on('error', (error) => {
      console.log('MCP Server error:', error.message);
      resolve(false);
    });
    
    // Send a simple JSON-RPC request to list available tools
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };
    
    setTimeout(() => {
      console.log('Sending JSON-RPC request...');
      mcpServer.stdin.write(JSON.stringify(request) + '\n');
    }, 2000);
    
    // Kill after timeout and check results
    setTimeout(() => {
      mcpServer.kill();
      
      if (output.includes('"result"') || output.includes('tools')) {
        console.log('✅ MCP Server responded correctly');
        resolve(true);
      } else {
        console.log('❌ MCP Server did not respond correctly');
        console.log('Full output:', output);
        console.log('Error output:', errorOutput);
        resolve(false);
      }
    }, 10000);
  });
}

async function runAllTests() {
  console.log('🧪 BrightData API Diagnosis Suite');
  console.log('=' .repeat(50));
  
  // Test 1: Different endpoints
  const workingEndpoint = await testBrightDataEndpoints();
  
  // Test 2: Different auth methods
  const workingAuth = await testAuthMethods();
  
  // Test 3: MCP Server approach
  const mcpWorks = await testMCPBrightDataServer();
  
  console.log('\n🎯 Diagnosis Summary:');
  console.log(`Working endpoint: ${workingEndpoint || 'None found'}`);
  console.log(`Working auth: ${workingAuth?.name || 'None found'}`);
  console.log(`MCP Server works: ${mcpWorks ? 'Yes' : 'No'}`);
  
  if (workingEndpoint && workingAuth) {
    console.log('\n✅ Recommended fix:');
    console.log(`Use endpoint: ${workingEndpoint}`);
    console.log(`Use auth: ${workingAuth.name}`);
    console.log(`Headers:`, workingAuth.headers);
  }
}

runAllTests().catch(console.error);