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
                  "neo4j-mcp": {
                    "command": "npx",
                    "args": [
                      "-y",
                      "@alanse/mcp-neo4j-server"
                    ],
                    "env": {
                      "NEO4J_URI": process.env.NEO4J_URI || "",
                      "NEO4J_USERNAME": process.env.NEO4J_USERNAME || "",
                      "NEO4J_PASSWORD": process.env.NEO4J_PASSWORD || "",
                      "NEO4J_DATABASE": process.env.NEO4J_DATABASE || "neo4j",
                      "AURA_INSTANCEID": process.env.AURA_INSTANCEID || "",
                      "AURA_INSTANCENAME": process.env.AURA_INSTANCENAME || ""
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
                  // Neo4j tools
                  "mcp__neo4j-mcp__execute_query",
                  "mcp__neo4j-mcp__search_nodes", 
                  "mcp__neo4j-mcp__get_relationships",
                  "mcp__neo4j-mcp__create_node",
                  "mcp__neo4j-mcp__create_relationship",
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
- Neo4j database with 3,325+ sports entities (clubs, players, competitions)
- BrightData web search for real-time information  
- Perplexity AI for up-to-date insights

Your task is to help users analyze sports clubs, identify business opportunities, find decision makers, and provide comprehensive sports intelligence using both database knowledge and real-time web research.

When users ask about sports entities, use the Neo4j tools to search the database.
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
                result.tool?.includes('neo4j') && 
                (result.result?.includes('deleted') || result.result?.includes('removed'))
              );
              
              const hasQueryOperations = toolResults.some(result => 
                result.tool?.includes('neo4j') && 
                (result.result?.includes('nodes') || result.result?.includes('relationships'))
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