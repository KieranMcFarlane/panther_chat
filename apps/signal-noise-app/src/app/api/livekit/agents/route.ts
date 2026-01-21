import { NextRequest, NextResponse } from 'next/server';

// LiveKit Cloud configuration
const LIVEKIT_HOST = 'https://yellow-panther-8i644ma6.livekit.cloud';
const LIVEKIT_API_KEY = 'APIioqpEJhEjDsE';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

// Simulate agent deployment for demo
export async function POST(request: NextRequest) {
  try {
    const { agentName, roomName, autoJoin = true } = await request.json();

    if (!agentName) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      );
    }

    // Simulate agent deployment (in production, this would call LiveKit Cloud API)
    console.log(`🚀 Simulating deployment of agent: ${agentName} to room: ${roomName || 'default'}`);

    const agentData = {
      id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: agentName,
      status: 'running',
      roomName: roomName || 'voice-default-room',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      type: 'voice',
      config: {
        model: 'gpt-4o',
        voice: 'alloy',
        systemPrompt: `You are a sports intelligence assistant for Yellow Panther. You help users analyze sports entities, RFP opportunities, and market intelligence using your knowledge graph and research tools.`,
      },
      environment: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '***configured***' : 'missing',
        CLAUDE_AGENT_URL: `${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/claude-agent/activity`,
      },
    };

    return NextResponse.json({
      success: true,
      agent: agentData,
      message: 'Agent deployed successfully (demo mode)',
      note: 'This is a demo simulation. In production, deploy via: cd livekit-agents && ./deploy.sh'
    });

  } catch (error) {
    console.error('Error deploying agent:', error);
    return NextResponse.json(
      { error: 'Failed to deploy agent', details: error.message },
      { status: 500 }
    );
  }
}

// List deployed agents
export async function GET() {
  try {
    // Return demo agents
    const agents = [
      {
        id: 'demo-agent-1',
        name: 'yellow-panther-voice-agent',
        status: 'stopped',
        roomName: null,
        createdAt: new Date().toISOString(),
        lastActive: null,
        type: 'voice',
      }
    ];

    return NextResponse.json({
      success: true,
      agents,
      note: 'Demo mode - no actual agents are deployed'
    });

  } catch (error) {
    console.error('Error listing agents:', error);
    return NextResponse.json(
      { error: 'Failed to list agents', details: error.message },
      { status: 500 }
    );
  }
}

// Generate LiveKit token for API authentication
function generateLiveKitToken() {
  const jwt = require('jsonwebtoken');
  
  const payload = {
    iss: LIVEKIT_API_KEY,
    sub: LIVEKIT_API_KEY,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, LIVEKIT_API_SECRET);
}

// Stop/remove agent
export async function DELETE(request: NextRequest) {
  try {
    const { agentId } = await request.json();

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    const deleteResponse = await fetch(`${LIVEKIT_HOST}/agents/${agentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${generateLiveKitToken()}`,
      },
    });

    if (!deleteResponse.ok) {
      throw new Error(`Failed to stop agent: ${deleteResponse.statusText}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Agent stopped successfully',
    });

  } catch (error) {
    console.error('Error stopping agent:', error);
    return NextResponse.json(
      { error: 'Failed to stop agent', details: error.message },
      { status: 500 }
    );
  }
}