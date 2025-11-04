import { NextRequest, NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * Test MCP Bus integration with Headless Claude Agent SDK
 * Tests both approaches: direct MCP servers vs MCP Bus abstraction
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { useMcpBus = false, testQuery = "Find 3 sports technology RFP opportunities" } = body;

    console.log(`🧪 [HEADLESS MCP BUS TEST] Starting test with MCP Bus: ${useMcpBus}`);

    if (useMcpBus) {
      // Test using the MCP Bus abstraction
      return await testWithMcpBus(testQuery);
    } else {
      // Test using direct MCP server configuration (our working approach)
      return await testWithDirectMCP(testQuery);
    }

  } catch (error) {
    console.error('❌ [HEADLESS MCP BUS TEST] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

async function testWithDirectMCP(testQuery: string) {
  console.log(`🔧 [DIRECT MCP] Testing headless Claude with direct MCP server configuration`);

  // This is the approach that's been working
  const mcpServers = {
    'brightdata-mcp': {
      command: 'node',
      args: ['src/mcp-brightdata-server.js'],
      env: {
        BRIGHTDATA_API_TOKEN: process.env.BRIGHTDATA_API_TOKEN || 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
        BRIGHTDATA_TOKEN: process.env.BRIGHTDATA_API_TOKEN || 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
        BRIGHTDATA_ZONE: 'linkedin_posts_monitor'
      }
    },
    'neo4j-mcp': {
      command: 'node',
      args: ['neo4j-mcp-server.js'],
      env: {
        NEO4J_URI: process.env.NEO4J_URI || 'neo4j+s://e6bb5665.databases.neo4j.io',
        NEO4J_USERNAME: process.env.NEO4J_USERNAME || 'neo4j',
        NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'NeO4jPaSSworD!'
      }
    }
  };

  const allowedTools = [
    'mcp__brightdata-mcp__search_engine',
    'mcp__brightdata-mcp__scrape_as_markdown',
    'mcp__neo4j-mcp__execute_query',
    'mcp__neo4j-mcp__search_sports_entities',
    'Read', 'Write', 'Grep', 'Bash'
  ];

  const systemPrompt = {
    type: "preset" as const,
    preset: "claude_code" as const,
    append: `You are an expert RFP Intelligence Analyst with access to Neo4j knowledge graph and BrightData web search.

CAPABILITIES:
1. Neo4j MCP tools: Query sports entities and relationships
2. BrightData MCP tools: Search for RFP opportunities and procurement signals
3. Analysis: Extract actionable intelligence from combined data sources

TASK: ${testQuery}

Use the available MCP tools to find real opportunities and provide structured analysis with URLs, confidence scores, and recommended actions.`
  };

  const results = [];

  for await (const message of query({
    prompt: testQuery,
    options: {
      systemPrompt,
      mcpServers,
      allowedTools,
      maxTurns: 6,
      permissionMode: 'default'
    }
  })) {
    console.log(`📝 [DIRECT MCP] Message type: ${message.type}`);
    
    if (message.type === 'tool_use') {
      console.log(`🔧 [DIRECT MCP] Tool executed: ${message.name}`);
      results.push({
        type: 'tool_use',
        tool: message.name,
        input: message.input,
        timestamp: new Date().toISOString()
      });
    } else if (message.type === 'tool_result') {
      console.log(`✅ [DIRECT MCP] Tool result received`);
      results.push({
        type: 'tool_result',
        content_length: message.content?.[0]?.text?.length || 0,
        timestamp: new Date().toISOString()
      });
    } else if (message.type === 'assistant') {
      console.log(`🤖 [DIRECT MCP] Assistant response received`);
      results.push({
        type: 'assistant_response',
        content_length: JSON.stringify(message.message?.content || '').length,
        timestamp: new Date().toISOString()
      });
    }
  }

  return NextResponse.json({
    success: true,
    approach: 'direct_mcp_servers',
    test_query: testQuery,
    mcp_servers_configured: Object.keys(mcpServers),
    tools_available: allowedTools,
    execution_results: results,
    total_tool_calls: results.filter(r => r.type === 'tool_use').length,
    completed_at: new Date().toISOString()
  });
}

async function testWithMcpBus(testQuery: string) {
  console.log(`🔧 [MCP BUS] Testing headless Claude with MCP Bus abstraction`);

  // Try to import and use the MCP Bus with custom server configurations
  try {
    const { FixedMCPClientBus } = await import('@/lib/mcp/FixedMCPClientBus');
    
    // Use our WORKING MCP server configurations instead of external packages
    const customMcpServers = [
      {
        name: 'neo4j-mcp',
        command: 'node',
        args: ['neo4j-mcp-server.js'],
        env: {
          NEO4J_URI: process.env.NEO4J_URI || 'neo4j+s://e6bb5665.databases.neo4j.io',
          NEO4J_USERNAME: process.env.NEO4J_USERNAME || 'neo4j',
          NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'NeO4jPaSSworD!'
        }
      },
      {
        name: 'brightdata-mcp',
        command: 'node',
        args: ['src/mcp-brightdata-server.js'],
        env: {
          BRIGHTDATA_API_TOKEN: process.env.BRIGHTDATA_API_TOKEN || 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
          BRIGHTDATA_TOKEN: process.env.BRIGHTDATA_API_TOKEN || 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
          BRIGHTDATA_ZONE: 'linkedin_posts_monitor'
        }
      }
    ];
    
    const mcpBus = new FixedMCPClientBus(customMcpServers);
    
    // Initialize the MCP Bus
    await mcpBus.initialize();
    
    // Get available tools
    const availableTools = mcpBus.getAvailableTools();
    console.log(`📋 [MCP BUS] Available tools: ${availableTools.length}`);
    
    // Get server status
    const serverStatus = mcpBus.getServerStatus();
    console.log(`📊 [MCP BUS] Server status:`, Object.keys(serverStatus));
    
    // Test a few tool calls to verify functionality
    const toolTestResults = [];
    
    for (const tool of availableTools.slice(0, 3)) {
      try {
        console.log(`🧪 [MCP BUS] Testing tool: ${tool.name}`);
        const testResult = await mcpBus.callTool(tool.name, { test: true });
        toolTestResults.push({
          tool: tool.name,
          success: true,
          server: tool.server,
          result_preview: testResult.content?.[0]?.text?.substring(0, 100) || 'No content'
        });
      } catch (error) {
        toolTestResults.push({
          tool: tool.name,
          success: false,
          server: tool.server,
          error: error.message
        });
      }
    }
    
    // Close the MCP Bus
    await mcpBus.close();
    
    return NextResponse.json({
      success: true,
      approach: 'mcp_bus_abstraction',
      test_query: testQuery,
      mcp_bus_initialized: true,
      servers_available: Object.keys(serverStatus),
      total_tools_available: availableTools.length,
      tool_test_results: toolTestResults,
      server_status: serverStatus,
      completed_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ [MCP BUS] MCP Bus test failed:`, error);
    return NextResponse.json({
      success: false,
      approach: 'mcp_bus_abstraction',
      test_query: testQuery,
      error: error.message,
      mcp_bus_failed: true,
      completed_at: new Date().toISOString()
    });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Headless Claude + MCP Bus Compatibility Test',
    usage: 'POST with { useMcpBus?: boolean, testQuery?: string }',
    test_approaches: {
      direct_mcp: {
        description: 'Direct MCP server configuration (proven working)',
        useMcpBus: false
      },
      mcp_bus: {
        description: 'MCP Bus abstraction layer',
        useMcpBus: true
      }
    },
    capabilities_tested: [
      'MCP server initialization',
      'Tool availability detection', 
      'Headless Claude Agent SDK integration',
      'Tool execution and results',
      'Server status monitoring'
    ]
  });
}