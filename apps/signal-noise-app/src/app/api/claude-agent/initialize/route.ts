/**
 * AG-UI and Claude Code SDK Integration API
 * Handles the communication between AG-UI frontend and Claude Code SDK backend
 */

import { NextRequest, NextResponse } from 'next/server';

// Initialize Claude Code SDK agent
let agentInstance: any = null;

async function initializeClaudeAgent() {
  if (agentInstance) return agentInstance;
  
  try {
    const { createEmailAgent } = await import('@/lib/claude-email-agent');
    agentInstance = await createEmailAgent();
    return agentInstance;
  } catch (error) {
    console.error('Failed to initialize Claude agent:', error);
    throw error;
  }
}

// Initialize endpoint
export async function POST(request: NextRequest) {
  try {
    await initializeClaudeAgent();
    
    return NextResponse.json({
      success: true,
      message: 'Claude Code Agent initialized successfully',
      capabilities: {
        relationshipAnalysis: true,
        strategyGeneration: true,
        campaignExecution: true,
        realTimeProcessing: true,
        autonomousMode: false
      },
      status: 'ready'
    });
    
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to initialize Claude Code Agent',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: agentInstance ? 'ready' : 'not_initialized',
    capabilities: agentInstance ? {
      relationshipAnalysis: true,
      strategyGeneration: true,
      campaignExecution: true,
      realTimeProcessing: true
    } : null
  });
}