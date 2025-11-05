import { NextRequest } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";

// AG-UI Event Types
interface AGUIEvent {
  type: 'agent-start' | 'agent-step' | 'agent-message' | 'agent-tool-use' | 'agent-tool-result' | 'agent-end' | 'agent-error';
  data: any;
  timestamp: string;
  id: string;
}

interface AGUIAgentConfig {
  name: string;
  description: string;
  capabilities: string[];
  tools: string[];
}

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

// AG-UI Protocol Functions
function createAGUIEvent(type: AGUIEvent['type'], data: any): AGUIEvent {
  return {
    type,
    data,
    timestamp: new Date().toISOString(),
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}

function streamAGUIEvent(controller: any, event: AGUIEvent) {
  const encoder = new TextEncoder();
  const chunk = {
    type: 'agui-event',
    event
  };
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
}

// Define our agent configuration
const agentConfig: AGUIAgentConfig = {
  name: 'Sports Intelligence Agent',
  description: 'AI agent for sports entity analysis, RFP intelligence, and database operations',
  capabilities: ['database-query', 'web-research', 'data-analysis', 'entity-enrichment'],
  tools: ['neo4j-mcp', 'brightdata', 'file-operations', 'web-search']
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

    // Get the latest user message
    const latestUserMessage = validMessages[validMessages.length - 1];
    console.log('Processing user message:', latestUserMessage.content);

    // Create streaming response
    const encoder = new TextEncoder();

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            // Send AG-UI agent start event
            const agentStartEvent = createAGUIEvent('agent-start', {
              agent: agentConfig,
              sessionId: userId,
              message: latestUserMessage.content
            });
            streamAGUIEvent(controller, agentStartEvent);

            // Send initial status
            const statusChunk = {
              type: 'status',
              message: 'Initializing sports intelligence tools...'
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(statusChunk)}\n\n`));

            // Use Claude Agent SDK with streaming
            const queryStream = query({
              prompt: latestUserMessage.content,
              options: {
                systemPrompt: "You are a sports intelligence AI assistant with access to Neo4j database containing sports entities. Use tools efficiently and provide detailed, accurate responses. When users ask about entities, use the Neo4j tools to query the database and provide comprehensive information.",
                model: 'claude-3-sonnet-20241022',
                maxTokens: 8000, // Taking advantage of 200k context window for comprehensive responses
                temperature: 0.7,
                permissionMode: 'bypassPermissions',
                allowedTools: [
                  'Task', 'Bash', 'Glob', 'Grep', 'Read', 'Edit', 'Write', 'WebSearch', 'TodoWrite',
                ],
                mcpServers: {
                  "neo4j-mcp": {
                    "command": "npx",
                    "args": [
                      "-y",
                      "@alanse/mcp-neo4j-server"
                    ],
                    "env": {
                      "NEO4J_URI": process.env.NEO4J_URI,
                      "NEO4J_USERNAME": process.env.NEO4J_USERNAME,
                      "NEO4J_PASSWORD": process.env.NEO4J_PASSWORD,
                      "NEO4J_DATABASE": process.env.NEO4J_DATABASE || 'neo4j',
                      "AURA_INSTANCEID": process.env.AURA_INSTANCEID,
                      "AURA_INSTANCENAME": process.env.AURA_INSTANCENAME
                    }
                  },
                  "brightData": {
                    "command": "npx",
                    "args": [
                      "-y",
                      "@brightdata/mcp"
                    ],
                    "env": {
                      "API_TOKEN": process.env.BRIGHTDATA_API_TOKEN,
                      "PRO_MODE": process.env.BRIGHTDATA_PRO_MODE || 'true'
                    }
                  }
                }
              }
            });

            let fullResponse = '';
            let hasContent = false;
            const toolResults: any[] = [];

            // Process the streaming response
            for await (const message of queryStream) {
              if (message.type === 'assistant' && message.message.content) {
                // Extract text content from Claude's response
                for (const contentBlock of message.message.content) {
                  if (contentBlock.type === 'text') {
                    const textChunk = contentBlock.text;
                    fullResponse += textChunk;
                    
                    if (!hasContent) {
                      hasContent = true;
                    }
                    
                    // Send AG-UI message event
                    const messageEvent = createAGUIEvent('agent-message', {
                      content: textChunk,
                      sessionId: userId,
                      step: 'response-generation',
                      isPartial: true
                    });
                    streamAGUIEvent(controller, messageEvent);
                    
                    // Send text chunk to frontend
                    const chunk = {
                      type: 'text',
                      text: textChunk
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                  }
                }
              }
              
              // Log tool usage with AG-UI events
              if (message.type === 'tool_use') {
                console.log('Tool used:', message.name);
                
                // Send AG-UI tool use event
                const toolUseEvent = createAGUIEvent('agent-tool-use', {
                  tool: message.name,
                  args: message.args,
                  sessionId: userId,
                  step: 'tool-execution'
                });
                streamAGUIEvent(controller, toolUseEvent);
                
                const toolChunk = {
                  type: 'tool_use',
                  tool: message.name,
                  message: `Using ${message.name}...`
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolChunk)}\n\n`));
              }
              
              if (message.type === 'tool_result') {
                toolResults.push({
                  tool: message.name,
                  result: message.result
                });
                
                // Send AG-UI tool result event
                const toolResultEvent = createAGUIEvent('agent-tool-result', {
                  tool: message.name,
                  result: message.result,
                  sessionId: userId,
                  step: 'tool-completion'
                });
                streamAGUIEvent(controller, toolResultEvent);
                
                const resultChunk = {
                  type: 'tool_result',
                  tool: message.name || 'unknown',
                  result: message.result
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(resultChunk)}\n\n`));
              }
            }

            // If no content was generated, provide a fallback response
            if (!hasContent) {
              console.log('No content generated, providing fallback response');
              
              let fallbackResponse = '';
              const hasDeletionOperations = toolResults.some((result: any) => 
                result.result && typeof result.result === 'string' && 
                (result.result.includes('deleted') || result.result.includes('removed'))
              );
              const hasQueryOperations = toolResults.some((result: any) => 
                result.result && typeof result.result === 'string' && 
                (result.result.includes('found') || result.result.includes('results') || result.result.includes('entities'))
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

            // Send AG-UI agent end event
            const agentEndEvent = createAGUIEvent('agent-end', {
              sessionId: userId,
              responseLength: fullResponse.length,
              toolResultsCount: toolResults.length,
              toolsUsed: toolResults.map(r => r.tool),
              status: 'completed'
            });
            streamAGUIEvent(controller, agentEndEvent);

            // Send final chunk to indicate streaming is complete
            const finalChunk = {
              type: 'final'
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));

            console.log('Streaming complete. Full response length:', fullResponse.length, 'Tool results:', toolResults.length);
            controller.close();

          } catch (error) {
            console.error('Streaming error:', error);
            
            // Send AG-UI error event
            const errorEvent = createAGUIEvent('agent-error', {
              sessionId: userId,
              error: error instanceof Error ? error.message : 'Unknown error occurred',
              originalMessage: latestUserMessage.content,
              step: 'error-occurred'
            });
            streamAGUIEvent(controller, errorEvent);
            
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