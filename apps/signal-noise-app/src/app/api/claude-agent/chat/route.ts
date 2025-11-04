import { NextRequest, NextResponse } from 'next/server';

interface ChatRequest {
  message: string;
  context: {
    userId: string;
    tabId: string;
    tabType: string;
    tabConfig: {
      model: string;
      temperature: number;
      maxTokens: number;
      tools: string[];
      systemPrompt: string;
    };
    conversationHistory?: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
    tabContext: {
      name: string;
      toolsAvailable: string[];
      systemPrompt: string;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, context } = body;

    // Validate request
    if (!message || !context) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Configure Claude Agent SDK call
    const claudeConfig = {
      model: context.tabConfig.model || 'claude-3-sonnet-20240229',
      max_tokens: context.tabConfig.maxTokens || 4000,
      temperature: context.tabConfig.temperature || 0.7,
      system: context.tabConfig.systemPrompt,
      tools: getMCPToolsForTab(context.tabConfig.tools),
      stream: true
    };

    // Prepare messages for Claude
    const messages = [
      ...(context.conversationHistory || []).slice(-10), // Keep last 10 messages for context
      {
        role: 'user' as const,
        content: message
      }
    ];

    // Call Claude Agent SDK
    const response = await callClaudeAgentSDK(messages, claudeConfig, context);

    // Return streaming response
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getMCPToolsForTab(tools: string[]) {
  // Define available MCP tools based on tab configuration
  const availableTools = [];

  if (tools.includes('neo4j-mcp')) {
    availableTools.push({
      name: 'neo4j_query',
      description: 'Execute Neo4j queries on the knowledge graph',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Cypher query to execute' }
        },
        required: ['query']
      }
    });
  }

  if (tools.includes('brightdata')) {
    availableTools.push({
      name: 'web_search',
      description: 'Search the web for information',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' }
        },
        required: ['query']
      }
    });
  }

  if (tools.includes('perplexity-mcp')) {
    availableTools.push({
      name: 'research',
      description: 'Research topics using Perplexity AI',
      input_schema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Topic to research' }
        },
        required: ['topic']
      }
    });
  }

  if (tools.includes('better-auth')) {
    availableTools.push({
      name: 'user_info',
      description: 'Get user information from Better Auth',
      input_schema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID to lookup' }
        },
        required: ['userId']
      }
    });
  }

  return availableTools;
}

async function callClaudeAgentSDK(
  messages: any[], 
  config: any, 
  context: ChatRequest['context']
) {
  // This is where you'd integrate with the actual Claude Agent SDK
  // For now, we'll simulate a streaming response
  
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Simulate thinking
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'thinking',
          content: `Thinking about the user's request for ${context.tabContext.name}...`
        })}\n\n`));

        await new Promise(resolve => setTimeout(resolve, 500));

        // Simulate tool use if applicable
        if (config.tools.length > 0) {
          const tool = config.tools[0];
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'tool_use',
            tool: tool.name,
            args: { query: 'example query' }
          })}\n\n`));

          await new Promise(resolve => setTimeout(resolve, 1000));

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'tool_result',
            result: { success: true, count: 5 }
          })}\n\n`));
        }

        // Stream response text
        const responseText = generateContextualResponse(messages[messages.length - 1]?.content, context);
        const words = responseText.split(' ');
        
        let currentText = '';
        for (const word of words) {
          currentText += word + ' ';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'text',
            content: word + ' '
          })}\n\n`));
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Done
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'done'
        })}\n\n`));

        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          error: error.message
        })}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(stream);
}

function generateContextualResponse(userMessage: string, context: ChatRequest['context']) {
  const { tabType, tabContext } = context;
  
  // Generate contextual responses based on tab type
  switch (tabType) {
    case 'general':
      return `I understand you're asking about: "${userMessage}". As your general AI assistant for the Signal Noise platform, I can help you with various tasks including sports intelligence, RFP analysis, and knowledge graph queries. What specific aspect would you like to explore further?`;

    case 'rfp':
      return `I've analyzed your RFP-related query: "${userMessage}". For RFP intelligence, I can help you identify procurement opportunities, analyze requirements, and assess fit with sports organizations. Let me search through available procurement data and provide you with relevant insights.`;

    case 'sports':
      return `Regarding your sports intelligence query: "${userMessage}", I can help you analyze sports entities, clubs, leagues, and business opportunities. I have access to comprehensive sports data and can provide detailed insights about organizations, relationships, and market trends.`;

    case 'knowledge-graph':
      return `For your knowledge graph exploration: "${userMessage}", I can execute Neo4j queries to analyze complex entity relationships in our sports intelligence database. I can help you traverse connections, identify patterns, and extract meaningful insights from the graph structure.`;

    case 'custom':
      return `I've received your custom query: "${userMessage}". With my configurable toolset, I can assist you with various tasks including web research, data analysis, and knowledge graph queries. How would you like me to help you with this request?`;

    default:
      return `I understand your message: "${userMessage}". I'm here to help you with AI-powered analysis and insights. What would you like to explore?`;
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}