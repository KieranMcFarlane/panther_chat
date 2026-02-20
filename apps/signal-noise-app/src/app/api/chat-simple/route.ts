/**
 * Simple Chat API - Direct tool calling without SDK
 * Bypasses Claude Agent SDK and implements tool use manually
 */

import { NextRequest } from 'next/server';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: Message[];
}

interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

// Tool definitions
const TOOLS = {
  search_graph: {
    name: 'search_graph',
    description: 'Search the temporal knowledge graph for entities, relationships, and facts',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        num_results: { type: 'number', description: 'Number of results (1-20)', default: 5 }
      },
      required: ['query']
    }
  },
  add_episode: {
    name: 'add_episode',
    description: 'Add a new episode (event, fact, or information) to the temporal knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name/title of the episode' },
        content: { type: 'string', description: 'Content/body of the episode' },
        source_description: { type: 'string', description: 'Source of the information' }
      },
      required: ['name', 'content']
    }
  }
};

async function executeTool(toolName: string, args: Record<string, any>): Promise<any> {
  console.log(`   ⚙️  Executing ${toolName} with args:`, JSON.stringify(args).substring(0, 200));

  if (toolName === 'search_graph') {
    const params = new URLSearchParams({
      query: args.query,
      num_results: String(args.num_results || 5)
    });

    const response = await fetch(`http://localhost:3005/api/graphiti?${params}`);
    const data = await response.json();

    console.log(`   ✅ Found ${data.count} results`);
    return { results: data.results, count: data.count };
  }

  if (toolName === 'add_episode') {
    const response = await fetch('http://localhost:3005/api/graphiti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add-episode',
        name: args.name,
        episode_body: args.content,
        source_description: args.source_description || 'Chat'
      })
    });
    const data = await response.json();

    console.log(`   ✅ Episode added`);
    return { success: true, episode: data.episode };
  }

  throw new Error(`Unknown tool: ${toolName}`);
}

async function callAnthropicWithTools(messages: Message[]): Promise<string> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
  const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

  let currentMessages = [...messages];
  let responseText = '';

  for (let i = 0; i < 5; i++) {
    console.log(`\n🔄 Turn ${i + 1}/5 - Sending ${currentMessages.length} messages to Claude`);

    // Call Claude API
    const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: currentMessages,
        system: `You are a Sports Intelligence AI assistant. You have access to tools to search a knowledge graph.

**MANDATORY TOOL USAGE:**
When the user asks to search for or find information, you MUST use the search_graph tool.
Do NOT answer from your training data without checking the graph first.

**Available Tools:**
1. search_graph - Search the temporal knowledge graph
2. add_episode - Add information to the knowledge graph

**Instructions:**
- ALWAYS use search_graph when asked to find entities or information
- Return tool results directly to the user in a clear format
- Be concise and factual`,
        tools: Object.values(TOOLS).map(({ name, description, inputSchema }) => ({
          name,
          description,
          input_schema: inputSchema
        }))
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Claude API error:', response.status, errorText);
      return `Error: ${response.status} - ${errorText}`;
    }

    const data = await response.json();
    console.log('📨 Received response from Claude, stop_reason:', data.stop_reason);

    // Extract assistant's response
    const textBlocks = data.content.filter((block: any) => block.type === 'text');
    responseText = textBlocks.map((block: any) => block.text).join('\n');
    console.log(`💬 Assistant: ${responseText.substring(0, 100)}...`);

    // Check for tool use
    const toolBlocks = data.content.filter((block: any) => block.type === 'tool_use');

    if (toolBlocks.length > 0) {
      console.log(`🔧 Tool calls detected: ${toolBlocks.length}`);

      // Execute tools sequentially
      for (const toolBlock of toolBlocks) {
        console.log(`🔧 Tool called: ${toolBlock.name}`);
        console.log(`   Args:`, JSON.stringify(toolBlock.input));

        // Execute tool
        const toolResult = await executeTool(toolBlock.name, toolBlock.input);
        console.log(`   ✅ Tool result:`, JSON.stringify(toolResult).substring(0, 200));

        // Add to conversation
        currentMessages.push({
          role: 'assistant',
          content: responseText
        });

        currentMessages.push({
          role: 'user',
          content: `Tool result for ${toolBlock.name}: ${JSON.stringify(toolResult)}`
        });
      }

      // Continue to next turn
      responseText = '';
    } else {
      // No tools, we're done
      console.log('✅ No tools called, returning response');
      break;
    }
  }

  return responseText;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const userMessage = body.messages[body.messages.length - 1];

    console.log('📨 New chat request:', userMessage.content);

    // Process with tools
    const response = await callAnthropicWithTools(body.messages);

    return Response.json({
      response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat error:', error);
    return Response.json(
      {
        error: 'Failed to process chat',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
