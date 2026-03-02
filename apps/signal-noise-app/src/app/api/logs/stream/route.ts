import { NextRequest } from 'next/server';
import { liveLogService } from '@/services/LiveLogService';

export const dynamic = 'force-dynamic';

// SSE endpoint for streaming Claude Agent logs
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('run_id') || 'default';
  const category = searchParams.get('category') || 'all';
  const source = searchParams.get('source') || 'all';

  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Create a readable stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const initialMessage = {
        type: 'connection',
        event: 'connected',
        data: {
          message: `🔮 Connected to Claude Agent logs stream (run_id: ${runId})`,
          timestamp: new Date().toISOString(),
          runId,
          category,
          source
        }
      };
      
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialMessage)}\n\n`));

      // Send historical logs immediately
      const sendHistoricalLogs = async () => {
        try {
          // Get historical logs from LiveLogService
          const historicalLogs = await liveLogService.getLogs({
            category: category !== 'all' ? category as any : undefined,
            source: source !== 'all' ? source : undefined,
            limit: 20, // Get last 20 historical logs
            hours: 24 // From last 24 hours
          });

          if (historicalLogs.length > 0) {
            const historyMessage = {
              type: 'history',
              event: 'history_loaded',
              data: {
                message: `📚 Loaded ${historicalLogs.length} historical logs`,
                count: historicalLogs.length,
                timestamp: new Date().toISOString()
              }
            };
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(historyMessage)}\n\n`));

            // Send each historical log
            historicalLogs.reverse().forEach(log => {
              const logMessage = {
                type: 'log',
                event: log.level,
                data: {
                  id: log.id,
                  timestamp: log.timestamp,
                  level: log.level,
                  category: log.category,
                  source: log.source,
                  entity_id: log.entity_id,
                  entity_name: log.entity_name,
                  message: log.message,
                  data: log.data,
                  metadata: log.metadata,
                  tags: log.tags,
                  correlation_id: log.correlation_id,
                  isHistorical: true
                }
              };
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(logMessage)}\n\n`));
            });
          }

        } catch (error) {
          const historyErrorMessage = {
            type: 'error',
            event: 'history_error',
            data: {
              message: `⚠️ Could not load historical logs: ${error.message}`,
              timestamp: new Date().toISOString()
            }
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(historyErrorMessage)}\n\n`));
        }
      };

      // Send historical logs immediately
      sendHistoricalLogs();

      // Subscribe to live logs
      let lastLogId = Date.now();
      
      const sendLatestLogs = async () => {
        try {
          // Get recent logs from LiveLogService
          const logs = await liveLogService.getRecentLogs({
            category: category !== 'all' ? category as any : undefined,
            source: source !== 'all' ? source : undefined,
            limit: 50,
            since: lastLogId
          });

          logs.forEach(log => {
            const logMessage = {
              type: 'log',
              event: log.level,
              data: {
                id: log.id,
                timestamp: log.timestamp,
                level: log.level,
                category: log.category,
                source: log.source,
                entity_id: log.entity_id,
                entity_name: log.entity_name,
                message: log.message,
                data: log.data,
                metadata: log.metadata,
                tags: log.tags,
                correlation_id: log.correlation_id,
                isHistorical: false
              }
            };
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(logMessage)}\n\n`));
            lastLogId = Math.max(lastLogId, new Date(log.timestamp).getTime());
          });

          // Send heartbeat with activity status
          const heartbeat = {
            type: 'heartbeat',
            event: 'ping',
            data: {
              timestamp: new Date().toISOString(),
              lastLogId,
              activeConnections: 1,
              uptime: Date.now() - startTime
            }
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`));

        } catch (error) {
          const errorMessage = {
            type: 'error',
            event: 'error',
            data: {
              message: `Error fetching logs: ${error.message}`,
              timestamp: new Date().toISOString()
            }
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
        }
      };

      // Set up interval for real-time updates (longer interval to reduce spam)
      const interval = setInterval(sendLatestLogs, 3000); // Update every 3 seconds

      const startTime = Date.now();

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        const disconnectMessage = {
          type: 'connection',
          event: 'disconnected',
          data: {
            message: '👋 Disconnected from Claude Agent logs stream',
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
          }
        };
        
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(disconnectMessage)}\n\n`));
        } catch (e) {
          // Stream might already be closed
        }
        
        controller.close();
      });

      // Cleanup after 30 minutes
      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 30 * 60 * 1000);
    },
  });

  return new Response(stream, { headers });
}