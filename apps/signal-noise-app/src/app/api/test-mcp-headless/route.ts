import { NextRequest, NextResponse } from 'next/server';
import { ReliableClaudeService } from '@/services/ReliableClaudeService';

/**
 * Test route for headless Claude agent with MCP integration
 * Tests both BrightData and Neo4j MCP tools
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchQuery, entities } = body;

    console.log(`🧪 [TEST MCP] Starting headless Claude test with query: ${searchQuery}`);
    console.log(`🧪 [TEST MCP] Entities: ${entities?.join(', ')}`);

    const claudeService = new ReliableClaudeService();
    
    let result;
    if (entities && entities.length > 0) {
      // Test entity-based RFP search using the correct method
      result = await claudeService.runReliableA2AWorkflow({
        entities: entities,
        sessionId: `test_mcp_${Date.now()}`,
        chunkSize: 3,
        batchSize: 3,
        startImmediate: true,
        onUpdate: (update) => {
          console.log(`🧪 [TEST MCP] Progress update:`, update);
        }
      });
    } else {
      throw new Error('Entities array must be provided for RFP search test');
    }

    console.log(`🧪 [TEST MCP] Analysis completed successfully`);

    return NextResponse.json({
      success: true,
      test_results: {
        query: searchQuery,
        entities: entities,
        mcp_tools_used: ['brightdata-mcp', 'neo4j-mcp'],
        analysis_result: result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('🧪 [TEST MCP] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'MCP Headless Claude Test Endpoint',
    usage: 'POST with { searchQuery: string, entities?: string[] }',
    available_tests: [
      'Entity RFP search: POST with entities array',
      'Direct query search: POST with searchQuery',
      'MCP tools: brightdata-mcp, neo4j-mcp'
    ]
  });
}