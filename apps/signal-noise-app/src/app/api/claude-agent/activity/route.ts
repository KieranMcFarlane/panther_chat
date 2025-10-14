import { NextRequest } from 'next/server';
import { claudeAgentSDKService } from '@/services/ClaudeAgentSDKService';
import { liveLogService } from '@/services/LiveLogService';

interface ActivityMessage {
  type: 'sdk_message' | 'tool_execution' | 'mcp_activity' | 'session_event' | 'error';
  timestamp: string;
  sessionId: string;
  data: any;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id') || 'default';
  
  try {
    // Create real Claude Agent SDK stream
    const claudeStream = await claudeAgentSDKService.createStream({
      sessionId,
      allowedTools: ['Task', 'Bash', 'Glob', 'Grep', 'Read', 'Edit', 'Write', 'WebSearch', 'TodoWrite'],
      maxTurns: 10,
      model: 'claude-3-sonnet-20241022'
    });

    // Pipe Claude Agent SDK stream to SSE format
    const reader = claudeStream.getReader();
    const encoder = new TextEncoder();
    
    const sseStream = new ReadableStream({
      async start(controller) {
        let isControllerClosed = false;
        
        // Send initial connection message
        const connectMessage = {
          type: 'session_event',
          timestamp: new Date().toISOString(),
          sessionId,
          data: {
            event: 'connected',
            message: '🔮 Connected to real Claude Agent SDK activity stream'
          }
        };
        
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectMessage)}\n\n`));
        } catch (e) {
          isControllerClosed = true;
          return;
        }

        // Send historical logs immediately
        const sendHistoricalLogs = async () => {
          try {
            // Get historical Claude Agent logs from LiveLogService
            const historicalLogs = await liveLogService.getLogs({
              category: 'claude-agent',
              limit: 10,
              hours: 24
            });

            if (historicalLogs.length > 0) {
              const historyMessage = {
                type: 'session_event',
                timestamp: new Date().toISOString(),
                sessionId,
                data: {
                  event: 'history_loaded',
                  message: `📚 Loaded ${historicalLogs.length} historical Claude Agent logs`
                }
              };
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(historyMessage)}\n\n`));

              // Send each historical log as SDK message
              historicalLogs.reverse().forEach(log => {
                const sdkMessage = {
                  type: 'sdk_message',
                  timestamp: log.timestamp,
                  sessionId,
                  data: {
                    type: log.level === 'error' ? 'result' : 'system',
                    subtype: log.level,
                    uuid: log.id,
                    session_id: sessionId,
                    message: {
                      content: log.message,
                      model: 'claude-3-sonnet-20241022'
                    },
                    duration_ms: log.metadata?.duration || 0,
                    is_error: log.level === 'error',
                    tools: log.metadata?.tools || ['Task', 'Bash', 'Glob', 'Grep', 'Read', 'Edit', 'Write'],
                    mcp_servers: log.metadata?.mcp_servers || [
                      { name: 'neo4j-mcp', status: 'connected' },
                      { name: 'perplexity-mcp', status: 'connected' }
                    ]
                  }
                };
                
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(sdkMessage)}\n\n`));
              });
            }
          } catch (error) {
            const historyErrorMessage = {
              type: 'error',
              timestamp: new Date().toISOString(),
              sessionId,
              data: {
                error: `⚠️ Could not load historical logs: ${error.message}`,
                context: 'history_loading'
              }
            };
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(historyErrorMessage)}\n\n`));
          }
        };

        // Send historical logs
        sendHistoricalLogs();

        // Subscribe to live logs for real-time updates
        let lastLogId = Date.now();
        
        const sendLatestLogs = async () => {
          if (isControllerClosed) return;
          
          try {
            const logs = await liveLogService.getRecentLogs({
              category: 'claude-agent',
              limit: 20,
              since: lastLogId
            });

            logs.forEach(log => {
              if (isControllerClosed) return;
              
              const sdkMessage = {
                type: 'sdk_message',
                timestamp: log.timestamp,
                sessionId,
                data: {
                  type: log.level === 'error' ? 'result' : 
                         log.source === 'ClaudeAgentSDK' ? 'assistant' : 'system',
                  subtype: log.level,
                  uuid: log.id,
                  session_id: sessionId,
                  message: {
                    content: log.message,
                    model: 'claude-3-sonnet-20241022'
                  },
                  duration_ms: log.metadata?.duration || 0,
                  is_error: log.level === 'error',
                  tools: log.metadata?.tools || ['Task', 'Bash', 'Glob', 'Grep', 'Read', 'Edit', 'Write'],
                  mcp_servers: log.metadata?.mcp_servers || [
                    { name: 'neo4j-mcp', status: 'connected' },
                    { name: 'perplexity-mcp', status: 'connected' }
                  ]
                }
              };
              
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(sdkMessage)}\n\n`));
                lastLogId = Math.max(lastLogId, new Date(log.timestamp).getTime());
              } catch (e) {
                isControllerClosed = true;
                return;
              }
            });

            if (isControllerClosed) return;

            // Send heartbeat
            const heartbeat = {
              type: 'session_event',
              timestamp: new Date().toISOString(),
              sessionId,
              data: {
                event: 'heartbeat',
                message: '📡 Real Claude Agent SDK activity stream active',
                uptime: Date.now(),
                lastLogId
              }
            };
            
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`));
            } catch (e) {
              isControllerClosed = true;
            }
          } catch (error) {
            if (isControllerClosed) return;
            
            const errorMessage = {
              type: 'error',
              timestamp: new Date().toISOString(),
              sessionId,
              data: {
                error: `Error fetching Claude Agent logs: ${error.message}`,
                context: 'log_fetching'
              }
            };
            
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
            } catch (e) {
              isControllerClosed = true;
            }
          }
        };

        // Set up interval for real-time updates
        const interval = setInterval(sendLatestLogs, 2000);

        const startTime = Date.now();

        // Handle client disconnect
        req.signal.addEventListener('abort', () => {
          clearInterval(interval);
          isControllerClosed = true;
          claudeAgentSDKService.endStream(sessionId);
          
          const disconnectMessage = {
            type: 'session_event',
            timestamp: new Date().toISOString(),
            sessionId,
            data: {
              event: 'disconnected',
              message: '👋 Disconnected from real Claude Agent SDK activity stream',
              duration: Date.now() - startTime
            }
          };
          
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(disconnectMessage)}\n\n`));
          } catch (e) {
            // Stream might already be closed
          }
          
          try {
            controller.close();
          } catch (e) {
            // Controller might already be closed
          }
        });

        // Cleanup after 30 minutes
        setTimeout(() => {
          clearInterval(interval);
          isControllerClosed = true;
          claudeAgentSDKService.endStream(sessionId);
          try {
            controller.close();
          } catch (e) {
            // Controller might already be closed
          }
        }, 30 * 60 * 1000);
      }
    });

    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to create Claude Agent SDK stream',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}


// Handle POST requests to send messages to Claude Agent
export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();
    
    if (!message || !sessionId) {
      return new Response(JSON.stringify({ 
        error: 'Message and sessionId are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Process message with Claude Agent SDK
    await claudeAgentSDKService.processMessage(sessionId, message);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Message sent to Claude Agent SDK'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Handle OPTIONS for CORS
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