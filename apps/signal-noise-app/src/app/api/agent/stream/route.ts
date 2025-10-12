/**
 * 🌊 Streaming Agent API Route
 * Uses Server-Sent Events for real-time agent + MCP streaming
 * Works perfectly with React fetch streaming
 */

import { NextRequest, NextResponse } from 'next/server';
import { StreamingClaudeAgent } from '@/lib/agents/StreamingClaudeAgent';
import { liveLogService } from '@/services/LiveLogService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'run', entityId, analysisType = 'comprehensive', trigger = 'manual' } = body;

    await liveLogService.log({
      level: 'info',
      message: `🚀 Starting streaming agent: ${action}`,
      source: 'Streaming Agent API',
      category: 'api',
      metadata: {
        action,
        entityId,
        analysisType,
        trigger,
        startTime: new Date().toISOString()
      }
    });

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Route to appropriate agent function
          let agentGenerator: AsyncGenerator<any>;
          
          switch (action) {
            case 'run':
              agentGenerator = StreamingClaudeAgent.runAgentStream({
                trigger,
                entityId,
                analysisType
              });
              break;
              
            case 'analyze-entity':
              if (!entityId) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'error', 
                  message: 'entityId is required for entity analysis' 
                })}\n\n`));
                controller.close();
                return;
              }
              agentGenerator = StreamingClaudeAgent.analyzeEntityStream(entityId, analysisType);
              break;
              
            case 'daily-scan':
              agentGenerator = StreamingClaudeAgent.dailyRFPScan();
              break;
              
            default:
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'error', 
                message: `Unknown action: ${action}` 
              })}\n\n`));
              controller.close();
              return;
          }

          // Stream agent responses
          for await (const chunk of agentGenerator) {
            const sseData = {
              ...chunk,
              timestamp: new Date().toISOString()
            };
            
            // Send as SSE
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseData)}\n\n`));
            
            // Log significant events
            if (chunk.type === 'mcp_data' || chunk.type === 'claude_chunk' || chunk.type === 'complete') {
              await liveLogService.log({
                level: 'info',
                message: `📡 Streaming agent ${chunk.type}: ${chunk.message || 'Data received'}`,
                source: 'Streaming Agent API',
                category: 'api',
                metadata: {
                  action,
                  chunkType: chunk.type,
                  tool: chunk.tool,
                  server: chunk.server
                }
              });
            }
            
            if (chunk.type === 'error') {
              await liveLogService.log({
                level: 'error',
                message: `❌ Streaming agent error: ${chunk.data}`,
                source: 'Streaming Agent API',
                category: 'api',
                metadata: {
                  action,
                  error: chunk.data
                }
              });
            }
          }

          // Send completion signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'stream-complete',
            message: 'Agent workflow completed',
            timestamp: new Date().toISOString()
          })}\n\n`));

          await liveLogService.log({
            level: 'info',
            message: `✅ Streaming agent completed: ${action}`,
            source: 'Streaming Agent API',
            category: 'api',
            metadata: {
              action,
              completedAt: new Date().toISOString()
            }
          });

        } catch (error) {
          console.error('Streaming agent error:', error);
          
          const errorData = {
            type: 'error',
            message: `Agent execution failed: ${error.message}`,
            timestamp: new Date().toISOString()
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
          
          await liveLogService.log({
            level: 'error',
            message: `❌ Streaming agent failed: ${error.message}`,
            source: 'Streaming Agent API',
            category: 'api',
            metadata: {
              error: error.message,
              stack: error.stack
            }
          });
        } finally {
          controller.close();
        }
      }
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Streaming API error:', error);
    
    await liveLogService.log({
      level: 'error',
      message: `❌ Streaming API error: ${error.message}`,
      source: 'Streaming Agent API',
      category: 'api',
      metadata: {
        error: error.message
      }
    });

    return NextResponse.json({
      error: 'Streaming API error',
      message: error.message
    }, { status: 500 });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}