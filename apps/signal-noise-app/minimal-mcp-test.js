#!/usr/bin/env node

/**
 * MINIMAL MCP TEST - Debug the protocol
 */

const { spawn } = require('child_process');

async function testMCPProtocol() {
  console.log('🧪 TESTING MCP PROTOCOL COMMUNICATION');
  
  // Test 1: Neo4j with proper environment
  console.log('\n=== Testing Neo4j MCP ===');
  
  const neo4jTest = await testServer({
    name: 'Neo4j',
    env: {
      NEO4J_URI: 'neo4j+s://cce1f84b.databases.neo4j.io',
      NEO4J_USERNAME: 'neo4j',
      NEO4J_PASSWORD: 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0',
      NEO4J_DATABASE: 'neo4j'
    },
    command: 'npx',
    args: ['-y', '@alanse/mcp-neo4j-server'],
    toolCall: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "execute_query",
        arguments: {
          query: "RETURN 'Hello World' as message",
          params: {}
        }
      },
      id: 1
    }
  });

  console.log(`Neo4j Test Result: ${neo4jTest.success ? 'SUCCESS' : 'FAILED'}`);
  if (neo4jTest.error) console.log(`Error: ${neo4jTest.error}`);
  if (neo4jTest.data) console.log(`Data: ${JSON.stringify(neo4jTest.data, null, 2).substring(0, 200)}...`);

  // Test 2: Perplexity
  console.log('\n=== Testing Perplexity MCP ===');
  
  const perplexityTest = await testServer({
    name: 'Perplexity',
    env: {
      PERPLEXITY_API_KEY: 'pplx-xyz123' // Mock key for now
    },
    command: 'npx',
    args: ['mcp-perplexity-search'],
    toolCall: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "chat_completion",
        arguments: {
          messages: [{ role: "user", content: "Say hello" }]
        }
      },
      id: 2
    }
  });

  console.log(`Perplexity Test Result: ${perplexityTest.success ? 'SUCCESS' : 'FAILED'}`);
  if (perplexityTest.error) console.log(`Error: ${perplexityTest.error}`);
  if (perplexityTest.data) console.log(`Data: ${JSON.stringify(perplexityTest.data, null, 2).substring(0, 200)}...`);
}

async function testServer(config) {
  return new Promise((resolve) => {
    console.log(`Starting ${config.name} server: ${config.command} ${config.args.join(' ')}`);
    console.log(`Environment variables: ${Object.keys(config.env).join(', ')}`);
    
    const child = spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env }
    });

    let stdout = '';
    let stderr = '';
    let hasResponse = false;

    const timeout = setTimeout(() => {
      if (!hasResponse) {
        child.kill('SIGTERM');
        resolve({
          success: false,
          error: 'Timeout after 30 seconds',
          data: null
        });
      }
    }, 30000);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      hasResponse = true;
      console.log(`${config.name} stdout: ${data.toString().substring(0, 100)}...`);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`${config.name} stderr: ${data.toString().substring(0, 100)}...`);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      
      console.log(`${config.name} process closed with code ${code}`);
      console.log(`Stdout length: ${stdout.length}, Stderr length: ${stderr.length}`);
      
      if (stdout.trim()) {
        try {
          // Try to parse the response
          const lines = stdout.split('\n').filter(line => line.trim());
          console.log(`Received ${lines.length} lines from ${config.name}`);
          
          // Look for JSON response
          for (const line of lines) {
            if (line.startsWith('{') && line.endsWith('}')) {
              try {
                const response = JSON.parse(line);
                clearTimeout(timeout);
                resolve({
                  success: true,
                  data: response,
                  error: null
                });
                return;
              } catch (e) {
                console.log(`Failed to parse JSON: ${e.message}`);
              }
            }
          }
          
          // If we got stdout but no valid JSON, check if it's just startup messages
          if (stderr.length > 0) {
            console.log(`Found stderr output instead of response`);
          }
          
          resolve({
            success: false,
            error: 'No valid JSON response found in stdout',
            data: stdout
          });
        } catch (e) {
          resolve({
            success: false,
            error: `Failed to process response: ${e.message}`,
            data: stdout
          });
        }
      } else {
        resolve({
          success: false,
          error: 'No output received',
          data: null
        });
      }
    });

    // Send the tool call after a short delay
    setTimeout(() => {
      console.log(`Sending tool call to ${config.name}...`);
      child.stdin.write(JSON.stringify(config.toolCall));
      child.stdin.end();
    }, 1000);
  });
}

// Run the test
testMCPProtocol().catch(console.error);