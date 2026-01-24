/**
 * MCP Tool Binding Test
 *
 * This test verifies that MCP tools are properly extracted and bound to the model.
 * Following the known-good pattern from the debug analysis.
 */

// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import { query } from '@anthropic-ai/claude-agent-sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Verify required environment variables are set
 */
function verifyEnvironment() {
  const required = {
    'FALKORDB_URI': process.env.FALKORDB_URI,
    'FALKORDB_USER': process.env.FALKORDB_USER,
    'FALKORDB_PASSWORD': process.env.FALKORDB_PASSWORD,
    'FALKORDB_DATABASE': process.env.FALKORDB_DATABASE,
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY
  };

  const missing = [];
  const set = [];

  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 Environment Variable Check');
  console.log('═══════════════════════════════════════════════════════');

  for (const [key, value] of Object.entries(required)) {
    if (value && value.length > 0) {
      set.push(key);
      console.log(`✅ ${key}: *** (${value.length} chars)`);
    } else {
      missing.push(key);
      console.log(`❌ ${key}: (NOT SET)`);
    }
  }

  console.log('═══════════════════════════════════════════════════════');

  if (missing.length > 0) {
    console.error(`\n❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('   Please set these in your .env file and try again.');
    return false;
  }

  console.log(`✅ All ${set.length} required environment variables are set!\n`);
  return true;
}

/**
 * Extract MCP tools explicitly (following known-good pattern)
 */
async function extractMCPTools() {
  try {
    // Load MCP config
    const configPath = path.join(process.cwd(), 'mcp-config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const rawConfig = JSON.parse(configContent);

    const allTools = [];

    console.log('🔧 Extracting tools from MCP servers...');

    for (const [serverName, serverConfig] of Object.entries(rawConfig.mcpServers)) {
      try {
        const config = serverConfig;
        console.log(`\n📡 Connecting to: ${serverName}`);
        console.log(`   Command: ${config.command}`);
        console.log(`   Args: ${config.args.join(' ')}`);

        // Substitute environment variables
        const processEnv = (env) => {
          const processed = {};
          for (const [key, value] of Object.entries(env)) {
            if (typeof value === 'string') {
              processed[key] = value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
                return process.env[varName] || '';
              });
            } else {
              processed[key] = value;
            }
          }
          return processed;
        };

        const processedEnv = processEnv(config.env || {});

        // Log critical environment variables (with redaction)
        console.log(`   Environment variables:`);
        for (const [key, value] of Object.entries(processedEnv)) {
          const isSet = value && value.length > 0;
          const display = isSet ? `*** (${value.length} chars)` : '(NOT SET!)';
          console.log(`     ${key}: ${display}`);
        }

        // Check for critical missing environment variables
        if (serverName === 'graphiti') {
          const requiredVars = ['FALKORDB_URI', 'FALKORDB_USER', 'FALKORDB_PASSWORD', 'OPENAI_API_KEY'];
          const missing = requiredVars.filter(v => !processedEnv[v] || processedEnv[v].length === 0);
          if (missing.length > 0) {
            console.error(`   ❌ Missing required vars: ${missing.join(', ')}`);
            console.error(`   Hint: Set these in your .env file`);
            continue;
          }
        }

        // Spawn MCP server
        const serverProcess = spawn(config.command, config.args, {
          env: { ...process.env, ...processedEnv },
          stdio: ['pipe', 'pipe', 'pipe'] // Use pipe for all stdio
        });

        // Capture stderr for debugging
        let stderrOutput = '';
        serverProcess.stderr.on('data', (data) => {
          const output = data.toString();
          stderrOutput += output;
          // Log stderr but don't overwhelm
          if (output.includes('ERROR') || output.includes('WARNING')) {
            console.error(`   Server stderr: ${output.trim()}`);
          }
        });

        // Log process exit
        serverProcess.on('exit', (code, signal) => {
          if (code !== null && code !== 0) {
            console.error(`   ❌ Server process exited with code ${code}`);
            if (stderrOutput) {
              console.error(`   Last stderr output:\n${stderrOutput.substring(-500)}`);
            }
          }
        });

        // Wait a bit for server to start
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Create client
        const client = new Client(
          { name: `test-${serverName}`, version: '1.0.0' },
          { capabilities: {} }
        );

        const transport = new StdioClientTransport({
          reader: serverProcess.stdout,
          writer: serverProcess.stdin
        });

        console.log(`   Connecting to server...`);
        await client.connect(transport);
        console.log(`   Initializing session...`);
        await client.initialize();

        // List tools
        console.log(`   Requesting tool list...`);
        const toolsResponse = await client.request(
          { method: 'tools/list' },
          { timeout: 10000 } // Increase timeout
        );

        if (toolsResponse.tools) {
          console.log(`✅ ${serverName}: ${toolsResponse.tools.length} tools`);
          toolsResponse.tools.forEach(tool => {
            console.log(`   - ${tool.name}`);
            allTools.push(tool);
          });
        }

        // Keep process alive
        serverProcess.on('error', (err) => {
          console.error(`   ❌ Server error:`, err.message);
        });

      } catch (error) {
        console.error(`❌ Failed to extract from ${serverName}:`, error.message);
        console.error(`   Stack:`, error.stack);
      }
    }

    console.log(`\n🎉 Total tools extracted: ${allTools.length}`);
    return allTools;

  } catch (error) {
    console.error('❌ Failed to extract MCP tools:', error);
    return [];
  }
}

/**
 * Test query with explicitly bound tools
 */
async function testQueryWithTools() {
  console.log('🧪 Testing Claude Agent SDK with explicit tool binding\n');

  // Verify environment first
  if (!verifyEnvironment()) {
    return false;
  }

  // Extract tools
  const tools = await extractMCPTools();

  if (tools.length === 0) {
    console.error('❌ No tools extracted! Cannot proceed with test.');
    return false;
  }

  console.log('\n🔧 Sending query with explicitly bound tools...');
  console.log('Tools sent to model:', tools.map(t => t.name).join(', '));

  try {
    let toolCallCount = 0;
    let messageCount = 0;

    // Query with explicit tools
    const response = query({
      prompt: 'Search the graph for entities related to "Arsenal" and tell me what you find.',
      options: {
        // CRITICAL: Explicitly pass tools
        tools: tools,
        model: 'claude-3-5-haiku-20241022'
      }
    });

    // Process messages
    for await (const message of response) {
      messageCount++;
      console.log(`📨 Message ${messageCount}: ${message.type}${message.subtype ? ` (${message.subtype})` : ''}`);

      if (message.type === 'tool_use') {
        toolCallCount++;
        console.log(`  🔧 TOOL CALLED: ${message.tool}`);
        console.log(`     Args:`, JSON.stringify(message.args).substring(0, 100));
      }

      if (message.type === 'tool_result') {
        console.log(`  ✅ TOOL RESULT: ${message.tool}`);
      }

      if (message.type === 'assistant' && message.message) {
        const textContent = message.message.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('');
        if (textContent) {
          console.log(`  📝 Assistant: ${textContent.substring(0, 100)}...`);
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total messages: ${messageCount}`);
    console.log(`Tools sent: ${tools.length}`);
    console.log(`Tools called: ${toolCallCount}`);

    if (toolCallCount > 0) {
      console.log('\n✅ SUCCESS! Tools are being called.');
      console.log('   The MCP tool binding fix is working correctly.');
      return true;
    } else {
      console.log('\n⚠️  WARNING! No tools were called.');
      console.log('   This could mean:');
      console.log('   1. The model chose not to use tools for this query');
      console.log('   2. Tools were not properly bound (check logs above)');
      console.log('   3. Try a more explicit prompt that encourages tool usage');
      return false;
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    return false;
  }
}

// Run test
testQueryWithTools().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
