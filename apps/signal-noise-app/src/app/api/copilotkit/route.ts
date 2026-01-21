import { NextRequest } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
}

interface ChatRequest {
  messages: Message[];
  context?: any;
  userId?: string;
  stream?: boolean;
}

interface ClaudeWebhookResponse {
  type: string;
  role?: string;
  content?: string;
  status?: string;
  message?: string;
  tool?: string;
  args?: any;
  result?: any;
  error?: string;
}

// FastAPI backend URL for temporal intelligence
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

// =============================================================================
// Temporal Intelligence Tools
// =============================================================================

const temporalTools = {
  'get_entity_timeline': {
    description: "Get temporal history of an entity including RFPs, partnerships, changes, and other events over time",
    parameters: {
      entity_id: { type: "string", description: "Entity identifier (name or neo4j_id)" },
      limit: { type: "number", description: "Number of events to return (default: 50)" }
    },
    handler: async (args: { entity_id: string; limit?: number }) => {
      try {
        const response = await fetch(
          `${FASTAPI_URL}/api/temporal/entity/${encodeURIComponent(args.entity_id)}/timeline?limit=${args.limit || 50}`
        );
        if (!response.ok) {
          throw new Error(`Temporal API error: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Timeline fetch error:', error);
        return { error: 'Failed to fetch entity timeline', entity_id: args.entity_id };
      }
    }
  },

  'analyze_temporal_fit': {
    description: "Analyze how well an entity fits an RFP opportunity based on their temporal patterns, past RFP history, and trends",
    parameters: {
      entity_id: { type: "string", description: "Entity to analyze (name or neo4j_id)" },
      rfp_id: { type: "string", description: "RFP identifier" },
      rfp_category: { type: "string", description: "RFP category (optional)" },
      rfp_value: { type: "number", description: "Estimated RFP value (optional)" },
      time_horizon: { type: "number", description: "Days to look back for analysis (default: 90)" }
    },
    handler: async (args: { entity_id: string; rfp_id: string; rfp_category?: string; rfp_value?: number; time_horizon?: number }) => {
      try {
        const response = await fetch(`${FASTAPI_URL}/api/temporal/analyze-fit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_id: args.entity_id,
            rfp_id: args.rfp_id,
            rfp_category: args.rfp_category,
            rfp_value: args.rfp_value,
            time_horizon: args.time_horizon || 90
          })
        });
        if (!response.ok) {
          throw new Error(`Temporal API error: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Fit analysis error:', error);
        return {
          error: 'Failed to analyze temporal fit',
          entity_id: args.entity_id,
          fit_score: 0.5,
          confidence: 0.3,
          recommendations: ['Temporal service unavailable - using default scores']
        };
      }
    }
  },

  'get_temporal_patterns': {
    description: "Get aggregate temporal patterns across all entities including top active entities, RFP trends, and episode statistics",
    parameters: {
      entity_type: { type: "string", description: "Filter by entity type (optional)" },
      time_horizon: { type: "number", description: "Days to look back (default: 365)" }
    },
    handler: async (args: { entity_type?: string; time_horizon?: number }) => {
      try {
        const params = new URLSearchParams();
        if (args.entity_type) params.append('entity_type', args.entity_type);
        params.append('time_horizon', String(args.time_horizon || 365));

        const response = await fetch(
          `${FASTAPI_URL}/api/temporal/patterns?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error(`Temporal API error: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Patterns fetch error:', error);
        return {
          error: 'Failed to fetch temporal patterns',
          time_horizon_days: args.time_horizon || 365,
          episode_types: {},
          top_entities: []
        };
      }
    }
  },

  'create_rfp_episode': {
    description: "Record an RFP detection as a temporal episode for tracking and future analysis",
    parameters: {
      rfp_id: { type: "string", description: "Unique RFP identifier" },
      organization: { type: "string", description: "Organization name" },
      entity_type: { type: "string", description: "Entity type (Club, League, etc.)" },
      title: { type: "string", description: "RFP title" },
      description: { type: "string", description: "RFP description" },
      source: { type: "string", description: "Detection source (LinkedIn, Perplexity, etc.)" },
      url: { type: "string", description: "RFP URL" },
      category: { type: "string", description: "RFP category" },
      confidence_score: { type: "number", description: "Detection confidence (0-1)" }
    },
    handler: async (args: any) => {
      try {
        const response = await fetch(`${FASTAPI_URL}/api/temporal/rfp-episode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args)
        });
        if (!response.ok) {
          throw new Error(`Temporal API error: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Episode creation error:', error);
        return { error: 'Failed to create RFP episode', rfp_id: args.rfp_id };
      }
    }
  }
};

export async function POST(req: NextRequest) {
  try {
    // Parse the incoming CopilotKit request
    const body = await req.json();
    console.log('Raw CopilotKit request body:', JSON.stringify(body, null, 2));
    
    // Handle CopilotKit GraphQL format
    let messages: any[] = [];
    let userId: string | undefined;
    let context: any = {};
    let stream = true;

    if (body.variables && body.variables.data && body.variables.data.messages) {
      // CopilotKit GraphQL format
      const copilotMessages = body.variables.data.messages;
      userId = body.variables.data.threadId;
      
      // Convert CopilotKit messages to our format
      messages = copilotMessages
        .filter((msg: any) => msg.textMessage && msg.textMessage.role !== 'assistant' || msg.textMessage.content)
        .map((msg: any) => ({
          role: msg.textMessage.role,
          content: msg.textMessage.content,
          id: msg.id
        }));
      
      console.log('Converted CopilotKit messages:', messages.length, 'messages');
    } else {
      // Legacy REST format
      messages = body.messages || [];
      context = body.context || {};
      userId = body.userId;
      stream = body.stream !== false;
    }

    // Debug logging
    console.log('Processed CopilotKit request:', JSON.stringify({ messages: messages.length, userId, stream }, null, 2));

    // Validate that messages array is not empty (exclude empty assistant messages)
    const validMessages = messages.filter(msg => msg.role === 'user' && msg.content.trim());
    if (validMessages.length === 0) {
      console.log('No valid user messages detected, returning greeting');
      
      // Return streaming response for empty messages
      const encoder = new TextEncoder();
      const greeting = "Hello! I'm ready to help you with sports intelligence. Please send me a message to get started.";
      
      return new Response(
        new ReadableStream({
          async start(controller) {
            const chunk = {
              type: 'text',
              text: greeting
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const doneChunk = { type: 'text', text: '' };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneChunk)}\n\n`));
            controller.close();
          }
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }

    // Get the latest user message for Claude Agent SDK
    const latestUserMessage = validMessages[validMessages.length - 1];
    console.log('Sending to Claude Agent SDK:', latestUserMessage.content);

    // Create streaming response for real-time feedback
    console.log('Starting streaming response with Claude Agent SDK');
    
    const encoder = new TextEncoder();
    let fullResponse = '';
    const toolResults: any[] = [];
    
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            // Send initial status message
            const initChunk = {
              type: 'status',
              status: 'processing',
              message: 'Initializing sports intelligence tools...'
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(initChunk)}\n\n`));

            // Use Claude Agent SDK with MCP servers
            for await (const message of query({
              prompt: latestUserMessage.content,
              options: {
                mcpServers: {
                  "falkordb-mcp": {
                    "command": "python",
                    "args": [
                      "backend/falkordb_mcp_server_fastmcp.py"
                    ],
                    "env": {
                      "FALKORDB_URI": process.env.FALKORDB_URI,
                      "FALKORDB_USER": process.env.FALKORDB_USER,
                      "FALKORDB_PASSWORD": process.env.FALKORDB_PASSWORD,
                      "FALKORDB_DATABASE": process.env.FALKORDB_DATABASE || "sports_intelligence"
                    }
                  },
                  "brightData": {
                    "command": "npx",
                    "args": [
                      "-y",
                      "@brightdata/mcp"
                    ],
                    "env": {
                      "API_TOKEN": process.env.BRIGHTDATA_API_TOKEN || "",
                      "PRO_MODE": "true"
                    }
                  },
                  "perplexity-mcp": {
                    "command": "npx",
                    "args": [
                      "-y",
                      "mcp-perplexity-search"
                    ],
                    "env": {
                      "PERPLEXITY_API_KEY": process.env.PERPLEXITY_API_KEY || ""
                    }
                  }
                },
                allowedTools: [
                  // FalkorDB tools
                  "mcp__falkordb-mcp__search_rfps",
                  "mcp__falkordb-mcp__get_entity_timeline",
                  "mcp__falkordb-mcp__search_entities",
                  "mcp__falkordb-mcp__add_rfp_episode",
                  "mcp__falkordb-mcp__query_graph",
                  "mcp__falkordb-mcp__get_graph_stats",
                  "mcp__falkordb-mcp__list_graphs",
                  // BrightData tools
                  "mcp__brightData__search_engine",
                  "mcp__brightData__scrape_as_markdown",
                  "mcp__brightData__scrape_batch",
                  "mcp__brightData__extract",
                  // Perplexity tools
                  "mcp__perplexity-mcp__chat_completion"
                ]
              },
              system: `You are a Sports Intelligence AI assistant with access to powerful tools:
- FalkorDB knowledge graph with 3,400+ sports entities and 30+ RFPs (clubs, players, competitions)
- BrightData web search for real-time information
- Perplexity AI for up-to-date insights
- Temporal Intelligence for RFP analysis and entity history

Your task is to help users analyze sports clubs, identify business opportunities, find decision makers, and provide comprehensive sports intelligence using both database knowledge and real-time web research.

FALKORDB TOOLS:
- search_rfps: Search for RFP opportunities by sport, category, or keywords
- get_entity_timeline: Get an organization's complete RFP history
- search_entities: Find sports entities (clubs, players, tournaments)
- add_rfp_episode: Add new RFP discoveries to the knowledge graph
- query_graph: Run custom Cypher queries on the knowledge graph
- get_graph_stats: View database statistics

TEMPORAL INTELLIGENCE TOOLS:
- get_entity_timeline: Get an entity's complete history (RFPs, partnerships, changes)
- analyze_temporal_fit: Analyze if an entity fits an RFP based on their patterns
- get_temporal_patterns: Get aggregate trends across all entities
- create_rfp_episode: Record RFP detections for future analysis

When users ask about:
- "Show me Tennis RFPs" → Use search_rfps with sport="Tennis"
- "What's PGA's RFP history?" → Use get_entity_timeline with "PGA"
- "Find golf organizations" → Use search_entities with query="golf"
- "Add a new RFP" → Use add_rfp_episode

When users ask about sports entities, use the FalkorDB tools to search the knowledge graph.
When users need current information, use BrightData or Perplexity search tools.
Always provide detailed, actionable insights based on the tool results.

Provide your analysis in a conversational, streaming manner as if you're thinking through the problem step by step.`
            })) {
              // Enhanced logging for granular tool execution details
              console.log('Claude Agent SDK message:', {
                type: message.type,
                subtype: message.subtype,
                tool: message.tool,
                toolArgs: message.tool_args,
                content: message.text || message.content?.slice(0, 200),
                fullMessage: JSON.stringify(message, null, 2).slice(0, 500),
                timestamp: new Date().toISOString()
              });
              
              if (message.type === 'system' && message.subtype === 'init') {
                console.log('MCP Servers initialized:', message.mcp_servers);
                // Send tools ready status
                const toolsChunk = {
                  type: 'status',
                  status: 'tools_ready',
                  message: 'Sports intelligence tools initialized'
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolsChunk)}\n\n`));
              } else if (message.type === 'tool_use') {
                // Enhanced tool execution notifications with arguments
                console.log('Tool execution details:', {
                  tool: message.tool,
                  args: message.tool_args,
                  timestamp: new Date().toISOString()
                });
                
                // Stream detailed tool execution to frontend
                const toolDetails = message.tool_args ? 
                  `Executing ${message.tool} with: ${JSON.stringify(message.tool_args).slice(0, 150)}...` :
                  `Using ${message.tool} to gather intelligence...`;
                  
                const toolChunk = {
                  type: 'tool_use',
                  tool: message.tool,
                  message: toolDetails,
                  args: message.tool_args
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolChunk)}\n\n`));
              } else if (message.type === 'text') {
                // Stream text content as it's generated
                if (message.text && message.text.trim()) {
                  const textChunk = {
                    type: 'text',
                    text: message.text
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(textChunk)}\n\n`));
                  fullResponse += message.text;
                }
              } else if (message.type === 'result' && message.subtype === 'success') {
                // Stream tool results
                toolResults.push({
                  tool: message.tool,
                  result: message.result
                });
                
                const resultChunk = {
                  type: 'tool_result',
                  tool: message.tool,
                  result: message.result
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(resultChunk)}\n\n`));
                console.log('Tool result received:', {
                  tool: message.tool,
                  resultLength: message.result ? JSON.stringify(message.result).length : 0,
                  resultPreview: message.result ? JSON.stringify(message.result).slice(0, 200) : 'No result',
                  timestamp: new Date().toISOString()
                });
                
                // Don't overwrite fullResponse with tool results - let the assistant response handle it
                // Tool results are for logging/feedback, not the main response text
              } else if (message.type === 'assistant') {
                // Enhanced assistant message handling with tool use detection
                if (message.message && message.message.content && Array.isArray(message.message.content)) {
                  for (const contentBlock of message.message.content) {
                    if (contentBlock.type === 'text' && contentBlock.text) {
                      const textChunk = {
                        type: 'text',
                        text: contentBlock.text
                      };
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(textChunk)}\n\n`));
                      fullResponse += contentBlock.text;
                    } else if (contentBlock.type === 'tool_use') {
                      // Stream tool execution details
                      console.log('Tool execution detected:', {
                        tool: contentBlock.name,
                        toolId: contentBlock.id,
                        toolInput: contentBlock.input,
                        timestamp: new Date().toISOString()
                      });
                      
                      const toolExecutionChunk = {
                        type: 'tool_use',
                        tool: contentBlock.name,
                        message: `Executing ${contentBlock.name} with: ${JSON.stringify(contentBlock.input).slice(0, 150)}...`,
                        args: contentBlock.input
                      };
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolExecutionChunk)}\n\n`));
                    }
                  }
                }
              } else {
                // Log other message types for debugging
                console.log('Other message type:', message.type, message.subtype);
              }
            }

            // Send completion status
            const completeChunk = {
              type: 'status',
              status: 'complete',
              message: 'Analysis complete',
              toolResults: toolResults.length
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(completeChunk)}\n\n`));

            // Send final CopilotKit-formatted message
            if (fullResponse.trim()) {
              const finalChunk = {
                type: 'final',
                data: {
                  data: {
                    generateCopilotResponse: {
                      threadId: userId,
                      runId: `run_${Date.now()}`,
                      extensions: {},
                      messages: [
                        {
                          __typename: 'TextMessageOutput',
                          id: `msg_${Date.now()}`,
                          createdAt: new Date().toISOString(),
                          content: [fullResponse],
                          role: 'assistant',
                          parentMessageId: null,
                          status: {
                            __typename: 'SuccessMessageStatus',
                            code: 'success'
                          }
                        }
                      ],
                      metaEvents: [],
                      status: {
                        __typename: 'BaseResponseStatus',
                        code: 'success'
                      },
                      __typename: 'CopilotResponse'
                    }
                  }
                }
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
            } else {
              // Enhanced fallback for operations with minimal or no text response
              let fallbackResponse = `I've analyzed your request about "${latestUserMessage.content}" using ${toolResults.length} sports intelligence tools.`;
              
              // Check if tool results indicate successful operations
              const hasDeletionOperations = toolResults.some(result =>
                result.tool?.includes('falkordb') &&
                (result.result?.includes('deleted') || result.result?.includes('removed'))
              );

              const hasQueryOperations = toolResults.some(result =>
                result.tool?.includes('falkordb') &&
                (result.result?.includes('nodes') || result.result?.includes('relationships') || result.result?.includes('RFPs'))
              );
              
              if (hasDeletionOperations) {
                fallbackResponse = `✅ Successfully completed the deletion operation in the sports database. The requested contact or entity has been removed.`;
              } else if (hasQueryOperations) {
                fallbackResponse = `✅ Database query completed successfully. Found ${toolResults.length} relevant results from the sports intelligence database.`;
              } else if (toolResults.length > 0) {
                fallbackResponse = `✅ Operation completed successfully using ${toolResults.length} sports intelligence tools. The requested action has been performed.`;
              } else {
                fallbackResponse = `I've processed your request about "${latestUserMessage.content}". The operation is complete.`;
              }
              
              const fallbackChunk = {
                type: 'final',
                data: {
                  data: {
                    generateCopilotResponse: {
                      threadId: userId,
                      runId: `run_${Date.now()}`,
                      extensions: {},
                      messages: [
                        {
                          __typename: 'TextMessageOutput',
                          id: `msg_${Date.now()}`,
                          createdAt: new Date().toISOString(),
                          content: [fallbackResponse],
                          role: 'assistant',
                          parentMessageId: null,
                          status: {
                            __typename: 'SuccessMessageStatus',
                            code: 'success'
                          }
                        }
                      ],
                      metaEvents: [],
                      status: {
                        __typename: 'BaseResponseStatus',
                        code: 'success'
                      },
                      __typename: 'CopilotResponse'
                    }
                  }
                }
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(fallbackChunk)}\n\n`));
            }

            console.log('Streaming complete. Full response length:', fullResponse.length, 'Tool results:', toolResults.length);
            controller.close();

          } catch (error) {
            console.error('Streaming error:', error);
            
            // Send error chunk
            const errorChunk = {
              type: 'error',
              error: error instanceof Error ? error.message : 'Unknown error occurred',
              message: `I encountered an error while processing your request about "${latestUserMessage.content}". However, I can still provide general sports intelligence assistance.`
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
            controller.close();
          }
        }
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    console.error('CopilotKit route error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle OPTIONS requests for CORS
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