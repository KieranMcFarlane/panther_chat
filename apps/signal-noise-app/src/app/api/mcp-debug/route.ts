/**
 * Debug MCP tools and connections
 */

import { NextRequest, NextResponse } from 'next/server';
import { mcpBus } from '@/lib/mcp/MCPClientBus';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging MCP connections...');
    
    // Get server status
    const serverStatus = mcpBus.getServerStatus();
    console.log('Server Status:', serverStatus);
    
    // Get available tools
    const tools = mcpBus.getAvailableTools();
    console.log('Available Tools:', tools.map(t => ({ name: t.name, server: t.server })));
    
    // Get headless-verifier specific tools
    const headlessTools = mcpBus.getToolsByServer('headless-verifier');
    console.log('Headless Verifier Tools:', headlessTools);
    
    return NextResponse.json({
      serverStatus,
      totalTools: tools.length,
      allTools: tools.map(t => ({ name: t.name, server: t.server, description: t.description })),
      headlessTools: headlessTools.map(t => ({ name: t.name, description: t.description })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('MCP Debug Error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { toolName, args } = body;
    
    console.log(`🧪 Testing MCP tool: ${toolName}`);
    
    const result = await mcpBus.callTool(toolName, args);
    console.log('Tool result:', result);
    
    return NextResponse.json({
      toolName,
      args,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Tool Test Error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}