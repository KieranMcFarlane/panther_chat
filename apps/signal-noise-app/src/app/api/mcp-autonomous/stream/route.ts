/**
 * Stream real-time logs from MCP-Enabled Autonomous RFP Manager
 * Server-Sent Events for live progress tracking
 */

import { NextRequest } from 'next/server';
import { liveLogService } from '@/services/LiveLogService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Set up Server-Sent Events
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
      // Send initial connection message
      const connectMessage = `data: ${JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
        message: '🔌 Connected to MCP-Enabled Autonomous RFP System',
        system: {
          neo4j: 'neo4j-mcp (direct)',
          brightdata: 'brightdata-mcp (direct)',
          perplexity: 'perplexity-mcp (direct)'
        },
        connectionTime: `${Date.now() - startTime}ms`
      })}\n\n`;
      
      controller.enqueue(encoder.encode(connectMessage));

      let logCount = 0;
      const maxLogs = 200; // Limit logs to prevent memory issues

      // Function to fetch and send new logs
      const fetchAndSendLogs = async () => {
        try {
          // Get recent logs from MCP-enabled system
          const logs = await liveLogService.getLogs({
            source: 'MCPEnabledAutonomousRFPManager',
            limit: 20,
            hours: 1
          });

          // Get system status
          const mcpManager = global.mcpAutonomousManager as any;
          let systemStatus = null;
          
          if (mcpManager) {
            try {
              systemStatus = mcpManager.getSystemStatus();
            } catch (error) {
              console.error('Failed to get MCP system status:', error);
            }
          }

          // Send logs
          for (const log of logs) {
            if (logCount >= maxLogs) break;
            
            const logData = {
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
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(logData)}\n\n`));
            logCount++;
          }

          // Send system status update
          if (systemStatus && logCount < maxLogs) {
            const statusData = {
              type: 'system_status',
              timestamp: new Date().toISOString(),
              systemInfo: {
                isRunning: systemStatus.isRunning,
                managerId: systemStatus.managerId,
                uptime: systemStatus.uptime,
                metrics: systemStatus.metrics,
                config: systemStatus.config
              },
              mcpIntegration: {
                totalMcpCalls: systemStatus.metrics.totalMcpCalls || 0,
                lastMcpCall: systemStatus.metrics.lastMcpCall,
                activeMcpTools: systemStatus.metrics.activeMcpTools || []
              }
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(statusData)}\n\n`));
            logCount++;
          }

          // Only send heartbeat every few cycles to reduce updates
          if (logCount % 5 === 0) {
            const heartbeat = {
              type: 'heartbeat',
              timestamp: new Date().toISOString(),
              streamUptime: `${Date.now() - startTime}ms`,
              logsSent: logCount,
              maxLogs: maxLogs
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`));
          }

        } catch (error) {
          const errorData = {
            type: 'error',
            timestamp: new Date().toISOString(),
            message: `Stream error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            streamUptime: `${Date.now() - startTime}ms`
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
        }
      };

      // Initial log fetch
      fetchAndSendLogs();

      // Set up interval for real-time updates
      const interval = setInterval(fetchAndSendLogs, 2000); // Every 2 seconds

      // Clean up on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
        
        const disconnectMessage = `data: ${JSON.stringify({
          type: 'disconnected',
          timestamp: new Date().toISOString(),
          message: '🔌 Disconnected from MCP-Enabled Autonomous RFP System',
          totalStreamTime: `${Date.now() - startTime}ms`,
          logsSent: logCount
        })}\n\n`;
        
        try {
          controller.enqueue(encoder.encode(disconnectMessage));
        } catch (e) {
          // Stream might already be closed
        }
      });

    },
    cancel() {
      console.log('MCP Autonomous log stream cancelled');
    }
  });

  return new Response(stream, { headers });
}