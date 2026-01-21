/**
 * Direct MCP test without complex routing
 */

import { NextRequest, NextResponse } from 'next/server';
import { directMCPClient } from '@/lib/direct-mcp-client';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing direct MCP connection...');
    
    // Check connection status
    const isConnected = directMCPClient.isConnectionActive();
    console.log('📡 Connection status:', isConnected);
    
    if (!isConnected) {
      console.log('🔄 Connecting to MCP server...');
      await directMCPClient.connect();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for connection
    }
    
    // Get available tools
    const tools = await directMCPClient.getAvailableTools();
    console.log('🔧 Available tools:', tools.map(t => t.name));
    
    // Test simple tool call
    console.log('🧪 Calling batch_verify_rfps...');
    const result = await directMCPClient.callTool('batch_verify_rfps', {
      rfp_configs: [{
        url: 'https://www.laliga.com',
        organization_name: 'LaLiga',
        organization_type: 'league'
      }],
      business_info: {
        contact_name: 'Test User',
        email: 'test@example.com',
        company: 'Test Company'
      }
    });
    
    console.log('✅ Tool call result:', result);
    
    return NextResponse.json({
      success: true,
      isConnected,
      availableTools: tools.map(t => ({ name: t.name, description: t.description })),
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ MCP Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}