/**
 * 🧪 Direct MCP Test API
 * Tests the frictionless MCP + A2A integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { liveLogService } from '@/services/LiveLogService';
import { directMCP } from '@/lib/mcp/DirectMCPIntegration';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { testType = 'all' } = body;

    await liveLogService.log({
      level: 'info',
      message: '🧪 Starting Direct MCP Integration Test',
      source: 'Direct MCP Test',
      category: 'api',
      metadata: {
        testType,
        startTime: new Date().toISOString()
      }
    });

    const results: any[] = [];

    // Test Neo4j MCP
    if (testType === 'all' || testType === 'neo4j') {
      results.push(await testNeo4jDirect());
    }

    // Test BrightData MCP
    if (testType === 'all' || testType === 'brightdata') {
      results.push(await testBrightDataDirect());
    }

    // Test Perplexity MCP
    if (testType === 'all' || testType === 'perplexity') {
      results.push(await testPerplexityDirect());
    }

    const totalTime = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;

    await liveLogService.log({
      level: successCount === results.length ? 'info' : 'warn',
      message: `🧪 Direct MCP Test Completed: ${successCount}/${results.length} tools working`,
      source: 'Direct MCP Test',
      category: 'api',
      metadata: {
        successCount,
        totalTests: results.length,
        totalTime: `${totalTime}ms`,
        results: results.map(r => ({ tool: r.tool, status: r.status, responseTime: r.responseTime }))
      }
    });

    return NextResponse.json({
      success: true,
      message: `Direct MCP integration test completed: ${successCount}/${results.length} tools working`,
      testSummary: {
        overallStatus: successCount === results.length ? 'all_success' : 'partial_success',
        successCount,
        totalTests: results.length,
        totalTime: `${totalTime}ms`,
        timestamp: new Date().toISOString()
      },
      results: results,
      recommendations: generateDirectRecommendations(results),
      lastChecked: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await liveLogService.log({
      level: 'error',
      message: `❌ Direct MCP Test Failed: ${errorMessage}`,
      source: 'Direct MCP Test',
      category: 'api',
      metadata: {
        error: errorMessage,
        totalTime: `${Date.now() - startTime}ms`
      }
    });

    return NextResponse.json({
      success: false,
      error: 'Direct MCP integration test failed',
      message: errorMessage,
      testSummary: {
        overallStatus: 'test_failed',
        totalTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      },
      lastChecked: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Test Neo4j Direct MCP Integration
 */
async function testNeo4jDirect(): Promise<any> {
  const startTime = Date.now();
  
  try {
    await liveLogService.log({
      level: 'info',
      message: '🔍 Testing Direct Neo4j MCP...',
      source: 'Direct MCP Test',
      category: 'api',
      metadata: { mcpTool: 'neo4j-direct', testType: 'query' }
    });

    // Test simple entity count query
    const result = await directMCP.executeNeo4jQuery('MATCH (n:Entity) RETURN count(n) as entityCount LIMIT 1');
    const responseTime = Date.now() - startTime;

    if (result.isError) {
      throw new Error(result.content[0].text);
    }

    await liveLogService.log({
      level: 'info',
      message: `✅ Direct Neo4j MCP Test Successful`,
      source: 'Direct MCP Test',
      category: 'api',
      metadata: {
        mcpTool: 'neo4j-direct',
        responseTime,
        query: 'Entity count query'
      }
    });

    return {
      tool: 'neo4j-direct',
      status: 'success',
      responseTime,
      result: {
        queryTime: `${responseTime}ms`,
        response: result.content[0].text.substring(0, 200) + '...'
      },
      details: {
        method: 'Direct npx execution',
        query: 'MATCH (n:Entity) RETURN count(n) as entityCount LIMIT 1',
        responseLength: result.content[0].text.length
      }
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await liveLogService.log({
      level: 'error',
      message: `❌ Direct Neo4j MCP Test Failed: ${errorMessage}`,
      source: 'Direct MCP Test',
      category: 'api',
      metadata: {
        mcpTool: 'neo4j-direct',
        responseTime,
        error: errorMessage
      }
    });

    return {
      tool: 'neo4j-direct',
      status: 'error',
      responseTime,
      error: errorMessage,
      details: {
        method: 'Direct npx execution',
        troubleshooting: [
          'Check Neo4j database connection',
          'Verify environment variables',
          'Test database credentials and access'
        ]
      }
    };
  }
}

/**
 * Test BrightData Direct MCP Integration
 */
async function testBrightDataDirect(): Promise<any> {
  const startTime = Date.now();
  
  try {
    await liveLogService.log({
      level: 'info',
      message: '🔍 Testing Direct BrightData MCP...',
      source: 'Direct MCP Test',
      category: 'api',
      metadata: { mcpTool: 'brightdata-direct', testType: 'search' }
    });

    // Test search
    const result = await directMCP.executeBrightDataSearch('sports technology', 'google');
    const responseTime = Date.now() - startTime;

    if (result.isError) {
      throw new Error(result.content[0].text);
    }

    await liveLogService.log({
      level: 'info',
      message: `✅ Direct BrightData MCP Test Successful`,
      source: 'Direct MCP Test',
      category: 'api',
      metadata: {
        mcpTool: 'brightdata-direct',
        responseTime,
        query: 'sports technology'
      }
    });

    return {
      tool: 'brightdata-direct',
      status: 'success',
      responseTime,
      result: {
        searchTime: `${responseTime}ms`,
        response: result.content[0].text.substring(0, 200) + '...'
      },
      details: {
        method: 'Direct npx execution',
        query: 'sports technology',
        engine: 'google',
        responseLength: result.content[0].text.length
      }
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await liveLogService.log({
      level: 'error',
      message: `❌ Direct BrightData MCP Test Failed: ${errorMessage}`,
      source: 'Direct MCP Test',
      category: 'api',
      metadata: {
        mcpTool: 'brightdata-direct',
        responseTime,
        error: errorMessage
      }
    });

    return {
      tool: 'brightdata-direct',
      status: 'error',
      responseTime,
      error: errorMessage,
      details: {
        method: 'Direct npx execution',
        troubleshooting: [
          'Check BrightData API token configuration',
          'Verify API credentials and rate limits',
          'Test API accessibility'
        ]
      }
    };
  }
}

/**
 * Test Perplexity Direct MCP Integration
 */
async function testPerplexityDirect(): Promise<any> {
  const startTime = Date.now();
  
  try {
    await liveLogService.log({
      level: 'info',
      message: '🔍 Testing Direct Perplexity MCP...',
      source: 'Direct MCP Test',
      category: 'api',
      metadata: { mcpTool: 'perplexity-direct', testType: 'chat' }
    });

    // Test chat
    const result = await directMCP.executePerplexityChat([
      { role: 'user', content: 'What are 3 key trends in sports technology?' }
    ], 'sonar-pro', { max_tokens: 300 });
    const responseTime = Date.now() - startTime;

    if (result.isError) {
      throw new Error(result.content[0].text);
    }

    await liveLogService.log({
      level: 'info',
      message: `✅ Direct Perplexity MCP Test Successful`,
      source: 'Direct MCP Test',
      category: 'api',
      metadata: {
        mcpTool: 'perplexity-direct',
        responseTime,
        model: 'sonar-pro'
      }
    });

    return {
      tool: 'perplexity-direct',
      status: 'success',
      responseTime,
      result: {
        model: 'sonar-pro',
        responseTime: `${responseTime}ms`,
        response: result.content[0].text.substring(0, 200) + '...'
      },
      details: {
        method: 'Direct npx execution',
        model: 'sonar-pro',
        maxTokens: 300,
        responseLength: result.content[0].text.length
      }
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await liveLogService.log({
      level: 'error',
      message: `❌ Direct Perplexity MCP Test Failed: ${errorMessage}`,
      source: 'Direct MCP Test',
      category: 'api',
      metadata: {
        mcpTool: 'perplexity-direct',
        responseTime,
        error: errorMessage
      }
    });

    return {
      tool: 'perplexity-direct',
      status: 'error',
      responseTime,
      error: errorMessage,
      details: {
        method: 'Direct npx execution',
        troubleshooting: [
          'Check Perplexity API key configuration',
          'Verify API rate limits and quota',
          'Test model accessibility'
        ]
      }
    };
  }
}

/**
 * Generate recommendations for direct MCP integration
 */
function generateDirectRecommendations(results: any[]): string[] {
  const recommendations: string[] = [];
  
  const failedTools = results.filter(r => r.status === 'error');
  const successfulTools = results.filter(r => r.status === 'success');
  
  if (successfulTools.length === results.length) {
    recommendations.push('🎉 All Direct MCP tools are working correctly - ready for frictionless A2A operation');
    recommendations.push('Your A2A agents can now use MCP tools without stdio transport complexity');
  }
  
  if (failedTools.length > 0) {
    recommendations.push(`⚠️ ${failedTools.length} Direct MCP tool(s) need attention`);
    recommendations.push('Check environment variables and API credentials');
  }
  
  if (successfulTools.length > 0) {
    recommendations.push('✅ Direct MCP integration bypasses stdio transport issues completely');
    recommendations.push('A2A agents can call MCP tools directly via simple API calls');
  }
  
  return recommendations;
}