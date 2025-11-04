import { NextRequest, NextResponse } from 'next/server';
import { claudeAgentSDKService } from '@/services/ClaudeAgentSDKService';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    
    const sessionId = `z-ai-test-${Date.now()}`;
    
    // Create a simple test stream
    const stream = await claudeAgentSDKService.createStream({
      sessionId,
      systemPrompt: 'You are a test assistant for verifying Z.AI API connection. Respond briefly confirming the connection.',
      allowedTools: [],
      maxTurns: 1
    });

    // Send test message
    await claudeAgentSDKService.processMessage(sessionId, message || 'Test connection to Z.AI API');

    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // End stream
    claudeAgentSDKService.endStream(sessionId);

    return NextResponse.json({
      success: true,
      message: '✅ Z.AI API test completed successfully',
      sessionId,
      apiConfig: {
        baseURL: process.env.ANTHROPIC_BASE_URL,
        hasAuthToken: !!process.env.ANTHROPIC_AUTH_TOKEN,
        hasApiKey: !!process.env.ANTHROPIC_API_KEY
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Z.AI API test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      apiConfig: {
        baseURL: process.env.ANTHROPIC_BASE_URL,
        hasAuthToken: !!process.env.ANTHROPIC_AUTH_TOKEN,
        hasApiKey: !!process.env.ANTHROPIC_API_KEY
      }
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      endpoint: '/api/claude-agents/test-z-ai',
      description: 'Test Z.AI API connection for Claude Agent SDK',
      apiConfig: {
        baseURL: process.env.ANTHROPIC_BASE_URL,
        hasAuthToken: !!process.env.ANTHROPIC_AUTH_TOKEN,
        hasApiKey: !!process.env.ANTHROPIC_API_KEY,
        authTokenPrefix: process.env.ANTHROPIC_AUTH_TOKEN?.substring(0, 20) + '...',
        apiKeyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 20) + '...'
      },
      usage: 'POST with { "message": "Your test message" }'
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get Z.AI API test info',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}