#!/usr/bin/env node

/**
 * SIMPLE MCP CONNECTION TEST
 * 
 * Tests if MCP servers are actually accessible by making direct HTTP calls
 * This bypasses the TypeScript compilation and mcp-tool-executor.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class SimpleMCPTester {
  constructor() {
    this.results = {
      startTime: new Date().toISOString(),
      tests: [],
      successes: 0,
      failures: 0,
      realDataFound: false,
      errors: []
    };
    this.mcpConfig = this.loadMCPConfig();
  }

  loadMCPConfig() {
    try {
      const configPath = path.join(__dirname, 'mcp-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.log(`Loaded MCP config with ${Object.keys(config.mcpServers || {}).length} servers`, 'INFO');
        return config;
      } else {
        throw new Error('mcp-config.json not found');
      }
    } catch (error) {
      this.log(`Failed to load MCP config: ${error.message}`, 'ERROR');
      return null;
    }
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'SUCCESS' ? '✅' : type === 'ERROR' ? '❌' : type === 'WARNING' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async testNeo4jConnection() {
    this.log('TEST 1: Neo4j MCP Server Connection', 'INFO');
    
    if (!this.mcpConfig || !this.mcpConfig.mcpServers['neo4j-mcp']) {
      this.log('Neo4j MCP server not configured', 'ERROR');
      this.results.failures++;
      return;
    }

    const neo4jConfig = this.mcpConfig.mcpServers['neo4j-mcp'];
    
    try {
      // Test by running npx @alanse/mcp-neo4j-server directly
      this.log('Testing Neo4j MCP server via npx...', 'INFO');
      
      const testQuery = `
        MATCH (n) 
        WHERE n.name IS NOT NULL 
        RETURN n.name as name, labels(n) as types 
        LIMIT 5
      `;

      const result = await this.executeMCPServerTest({
        command: 'npx',
        args: ['-y', '@alanse/mcp-neo4j-server'],
        env: neo4jConfig.env,
        method: 'tools/call',
        toolName: 'execute_query',
        toolArgs: { query: testQuery },
        timeout: 30000
      }, 'neo4j');

      this.results.tests.push({
        test: 'Neo4j MCP Connection',
        tool: 'execute_query',
        success: result.success,
        dataFound: result.dataFound,
        result: result
      });

      if (result.success && result.dataFound) {
        this.log(`SUCCESS: Neo4j MCP server connected and returned data`, 'SUCCESS');
        this.results.successes++;
        this.results.actualDataFound = true;
      } else {
        this.log(`FAILED: Neo4j MCP connection failed - ${result.error || 'No data returned'}`, 'ERROR');
        this.results.failures++;
        this.results.errors.push(`Neo4j connection failed: ${result.error}`);
      }

    } catch (error) {
      this.log(`ERROR: Neo4j test failed: ${error.message}`, 'ERROR');
      this.results.failures++;
      this.results.errors.push(`Neo4j test exception: ${error.message}`);
    }
  }

  async testBrightDataConnection() {
    this.log('TEST 2: BrightData MCP Server Connection', 'INFO');
    
    if (!this.mcpConfig || !this.mcpConfig.mcpServers['brightdata']) {
      this.log('BrightData MCP server not configured', 'ERROR');
      this.results.failures++;
      return;
    }

    const brightdataConfig = this.mcpConfig.mcpServers['brightdata'];
    
    try {
      this.log('Testing BrightData MCP server search...', 'INFO');
      
      const testSearch = 'RFP sports organizations digital transformation 2025';
      
      const result = await this.executeMCPServerTest({
        command: 'npx',
        args: ['@brightdata/mcp'],
        env: brightdataConfig.env,
        method: 'tools/call',
        toolName: 'search_engine',
        toolArgs: {
          query: testSearch,
          engine: 'google',
          num_results: 5
        },
        timeout: 45000
      }, 'brightdata');

      this.results.tests.push({
        test: 'BrightData MCP Connection',
        tool: 'search_engine',
        searchQuery: testSearch,
        success: result.success,
        dataFound: result.dataFound,
        result: result
      });

      if (result.success && result.dataFound) {
        this.log(`SUCCESS: BrightData MCP server connected and returned search results`, 'SUCCESS');
        this.results.successes++;
        this.results.actualDataFound = true;
      } else {
        this.log(`FAILED: BrightData MCP connection failed - ${result.error || 'No data returned'}`, 'ERROR');
        this.results.failures++;
        this.results.errors.push(`BrightData connection failed: ${result.error}`);
      }

    } catch (error) {
      this.log(`ERROR: BrightData test failed: ${error.message}`, 'ERROR');
      this.results.failures++;
      this.results.errors.push(`BrightData test exception: ${error.message}`);
    }
  }

  async testPerplexityConnection() {
    this.log('TEST 3: Perplexity MCP Server Connection', 'INFO');
    
    if (!this.mcpConfig || !this.mcpConfig.mcpServers['perplexity-mcp']) {
      this.log('Perplexity MCP server not configured', 'ERROR');
      this.results.failures++;
      return;
    }

    const perplexityConfig = this.mcpConfig.mcpServers['perplexity-mcp'];
    
    try {
      this.log('Testing Perplexity MCP server analysis...', 'INFO');
      
      const testQuery = 'Analyze the market for digital transformation in sports organizations';
      
      const result = await this.executeMCPServerTest({
        command: 'npx',
        args: ['mcp-perplexity-search'],
        env: perplexityConfig.env,
        method: 'tools/call',
        toolName: 'chat_completion',
        toolArgs: {
          messages: [{ role: 'user', content: testQuery }],
          model: 'sonar'
        },
        timeout: 30000
      }, 'perplexity');

      this.results.tests.push({
        test: 'Perplexity MCP Connection',
        tool: 'chat_completion',
        query: testQuery,
        success: result.success,
        dataFound: result.dataFound,
        result: result
      });

      if (result.success && result.dataFound) {
        this.log(`SUCCESS: Perplexity MCP server connected and returned analysis`, 'SUCCESS');
        this.results.successes++;
        this.results.actualDataFound = true;
      } else {
        this.log(`FAILED: Perplexity MCP connection failed - ${result.error || 'No data returned'}`, 'ERROR');
        this.results.failures++;
        this.results.errors.push(`Perplexity connection failed: ${result.error}`);
      }

    } catch (error) {
      this.log(`ERROR: Perplexity test failed: ${error.message}`, 'ERROR');
      this.results.failures++;
      this.results.errors.push(`Perplexity test exception: ${error.message}`);
    }
  }

  async executeMCPServerTest(config, serverType) {
    return new Promise((resolve) => {
      this.log(`Executing MCP test for ${serverType}: ${config.command} ${config.args.join(' ')}`, 'INFO');
      
      const child = spawn(config.command, config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...config.env }
      });

      let responseData = '';
      let startTime = Date.now();
      let hasReceivedResponse = false;

      // Set timeout
      const timeout = setTimeout(() => {
        if (!hasReceivedResponse) {
          child.kill('SIGTERM');
          resolve({
            success: false,
            error: `Test timed out after ${config.timeout}ms`,
            dataFound: false,
            serverType: serverType
          });
        }
      }, config.timeout);

      child.stdout.on('data', (data) => {
        responseData += data.toString();
        hasReceivedResponse = true;
        this.log(`Received data from ${serverType}: ${data.toString().substring(0, 100)}...`, 'DEBUG');
      });

      child.stderr.on('data', (data) => {
        this.log(`${serverType} stderr: ${data.toString()}`, 'DEBUG');
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        
        const duration = Date.now() - startTime;
        this.log(`${serverType} process closed with code ${code} after ${duration}ms`, 'INFO');
        
        try {
          // Parse MCP response
          if (responseData.trim()) {
            const lines = responseData.split('\n').filter(line => line.trim());
            const jsonLines = lines.filter(line => line.startsWith('{') && line.endsWith('}'));
            
            if (jsonLines.length > 0) {
              const response = JSON.parse(jsonLines[jsonLines.length - 1]);
              
              if (response.error) {
                resolve({
                  success: false,
                  error: response.error.message || response.error,
                  dataFound: false,
                  serverType: serverType
                });
              } else if (response.content && response.content.length > 0) {
                // For Perplexity, content contains the analysis
                const text = response.content[0].text || '';
                
                resolve({
                  success: true,
                  data: response.content[0],
                  dataFound: text && text.length > 10,
                  text: text,
                  serverType: serverType,
                  response: response
                });
              } else {
                resolve({
                  success: true,
                  data: response,
                  dataFound: Object.keys(response).length > 2, // More than just jsonrpc/method etc.
                  serverType: serverType
                });
              }
            } else {
              resolve({
                success: false,
                error: 'Invalid response format - no JSON found',
                dataFound: false,
                serverType: serverType
              });
            }
          } else {
            resolve({
              success: false,
              error: 'No response received from MCP server',
              dataFound: false,
              serverType: serverType
            });
          }
        } catch (parseError) {
          this.log(`Parse error for ${serverType}: ${parseError.message}`, 'DEBUG');
          resolve({
            success: false,
            error: `Failed to parse response: ${parseError.message}`,
            dataFound: false,
            serverType: serverType
          });
        }
      });

      // Send MCP tool call request
      const mcpRequest = {
        jsonrpc: "2.0",
        method: config.method,
        params: {
          name: config.toolName,
          arguments: config.toolArgs
        },
        id: Date.now()
      };

      this.log(`Sending MCP request to ${serverType}:`, 'DEBUG');
      child.stdin.write(JSON.stringify(mcpRequest));
      child.stdin.end();
    });
  }

  generateReport() {
    const endTime = new Date().toISOString();
    const duration = Date.now() - new Date(this.results.startTime).getTime();

    console.log('\n' + '='.repeat(80));
    console.log('🧪 SIMPLE MCP CONNECTION TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`⏰ Started: ${this.results.startTime}`);
    console.log(`⏰ Completed: ${endTime}`);
    console.log(`⏱️ Duration: ${(duration / 1000).toFixed(1)} seconds`);
    console.log('');

    console.log('📊 CONNECTION TEST SUMMARY:');
    console.log(`  Total Tests: ${this.results.tests.length}`);
    console.log(`  Successful Connections: ${this.results.successes}`);
    console.log(`  Failed Connections: ${this.results.failures}`);
    console.log(`  Success Rate: ${this.results.tests.length > 0 ? Math.round((this.results.successes / this.results.tests.length) * 100) : 0}%`);
    console.log(`  Real Data Found: ${this.results.actualDataFound ? 'YES' : 'NO'}`);
    console.log('');

    console.log('📋 DETAILED TEST RESULTS:');
    console.log('-'.repeat(80));
    
    this.results.tests.forEach((test, index) => {
      const status = test.success ? '✅ CONNECTED' : '❌ FAILED';
      const dataStatus = test.dataFound ? '📊 DATA' : '🚫 NO DATA';
      console.log(`${index + 1}. ${test.test}: ${status} ${dataStatus}`);
      
      if (test.searchQuery) {
        console.log(`    Query: ${test.searchQuery}`);
      }
      if (test.text && test.text.length > 0) {
        console.log(`    Response: ${test.text.substring(0, 100)}...`);
      }
      if (test.result && !test.success) {
        console.log(`    Error: ${test.result.error || 'Unknown error'}`);
      }
    });

    // Errors encountered
    if (this.results.errors.length > 0) {
      console.log('⚠️ ERRORS ENCOUNTERED:');
      console.log('-'.repeat(80));
      this.results.errors.slice(0, 5).forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }

    // Validation conclusion
    console.log('🔍 CONNECTION VALIDATION CONCLUSION:');
    console.log('-'.repeat(80));
    
    if (this.results.actualDataFound) {
      console.log('✅ MCP SERVERS ARE WORKING: Real connections established');
      console.log(`   - At least ${this.results.successes} MCP servers responded`);
      console.log('   - Real data is being returned from the services');
      console.log('   - The MCP infrastructure is functional');
    } else {
      console.log('❌ MCP SERVERS NOT WORKING: No real data returned');
      console.log('   - All connections either failed or returned empty results');
      console.log('   - MCP servers may not be properly configured or accessible');
      console.log('   - Check API keys, credentials, and server configuration');
    }

    console.log(`\n🏁 MCP CONNECTION TEST COMPLETE`);
    console.log(`Success Rate: ${this.results.tests.length > 0 ? Math.round((this.results.successes / this.results.tests.length) * 100) : 0}%`);
    console.log(`Real Data: ${this.results.actualDataFound ? 'CONFIRMED' : 'NOT CONFIRMED'}`);
  }

  async runTests() {
    console.log('🚀 STARTING SIMPLE MCP CONNECTION TEST');
    console.log('This test makes direct connections to MCP servers');
    console.log('Goal: Verify if Neo4j, BrightData, and Perplexity are actually accessible');
    console.log('');

    try {
      await this.testNeo4jConnection();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between tests
      await this.testBrightDataConnection();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between tests
      await this.testPerplexityConnection();
      
    } catch (error) {
      this.log(`CRITICAL ERROR: ${error.message}`, 'ERROR');
      this.results.errors.push(`Critical test failure: ${error.message}`);
    } finally {
      this.generateReport();
    }
  }
}

// Run the tests
async function main() {
  const tester = new SimpleMCPTester();
  await tester.runTests();
}

main().catch(console.error);