/**
 * Stream real-time logs from the MCP-enabled autonomous RFP manager.
 */

import { NextRequest } from 'next/server';
import { liveLogService } from '@/services/LiveLogService';
import { getMcpAutonomousManagerIfExists, mapMcpAutonomousStatus } from '@/lib/mcp/mcp-autonomous-manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({
        type: 'connected',
        timestamp: new Date().toISOString(),
        message: 'Connected to MCP-enabled autonomous RFP system',
        system: {
          graphiti: 'graphiti (direct)',
          brightdata: 'brightdata-mcp (direct)',
          supabase: 'supabase-mcp (direct)'
        },
        connectionTime: `${Date.now() - startTime}ms`
      });

      let logCount = 0;
      const maxLogs = 200;

      const fetchAndSendLogs = async () => {
        try {
          const logs = await liveLogService.getLogs({
            source: 'MCPEnabledAutonomousRFPManager',
            limit: 20,
            hours: 1
          });

          for (const log of logs) {
            if (logCount >= maxLogs) break;

            send({
              type: 'log',
              timestamp: log.timestamp,
              level: log.level,
              message: log.message,
              category: log.category,
              source: log.source,
              mcpTool: log.metadata?.mcpTool,
              entityId: log.metadata?.entityId,
              responseTime: log.metadata?.responseTime,
              batchId: log.metadata?.batchId
            });
            logCount++;
          }

          const manager = getMcpAutonomousManagerIfExists();
          if (manager && logCount < maxLogs) {
            const systemStatus = mapMcpAutonomousStatus(manager);

            send({
              type: 'system_status',
              timestamp: new Date().toISOString(),
              systemInfo: systemStatus,
              mcpIntegration: systemStatus.mcpIntegration
            });
            logCount++;
          }

          if (logCount % 5 === 0) {
            send({
              type: 'heartbeat',
              timestamp: new Date().toISOString(),
              streamUptime: `${Date.now() - startTime}ms`,
              logsSent: logCount,
              maxLogs
            });
          }
        } catch (error) {
          send({
            type: 'error',
            timestamp: new Date().toISOString(),
            message: `Stream error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            streamUptime: `${Date.now() - startTime}ms`
          });
        }
      };

      fetchAndSendLogs();

      const interval = setInterval(fetchAndSendLogs, 2000);

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();

        try {
          send({
            type: 'disconnected',
            timestamp: new Date().toISOString(),
            message: 'Disconnected from MCP-enabled autonomous RFP system',
            totalStreamTime: `${Date.now() - startTime}ms`,
            logsSent: logCount
          });
        } catch {
          // Stream already closed.
        }
      });
    },
    cancel() {
      console.log('MCP autonomous log stream cancelled');
    }
  });

  return new Response(stream, { headers });
}
