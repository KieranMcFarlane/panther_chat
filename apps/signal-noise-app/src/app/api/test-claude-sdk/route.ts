import { NextRequest, NextResponse } from 'next/server';
import { query } from "@anthropic-ai/claude-agent-sdk";

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Simple test without MCP tools
    const messages = [];
    for await (const message of query({
      prompt: "Hello! Please respond with a simple greeting and tell me what 2+2 equals.",
      options: {
        maxTurns: 1
      }
    })) {
      messages.push({
        type: message.type,
        content: message.content || message.text || 'no content',
        keys: Object.keys(message)
      });
      
      console.log('Claude SDK Message:', message);
      
      if (message.type === "assistant" && message.message?.content) {
        const duration = Date.now() - startTime;
        const content = Array.isArray(message.message.content) 
          ? message.message.content.map(c => c.text || c).join('')
          : message.message.content;
          
        return NextResponse.json({
          success: true,
          message: "Claude Agent SDK working!",
          claudeResponse: content,
          duration: duration,
          allMessages: messages
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: "No text response received"
    });

  } catch (error) {
    console.error('Claude SDK test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}