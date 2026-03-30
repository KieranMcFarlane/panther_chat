/**
 * Stop the MCP-enabled autonomous RFP monitoring system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMcpAutonomousManagerIfExists, mapMcpAutonomousStatus } from '@/lib/mcp/mcp-autonomous-manager';
import { liveLogService } from '@/services/LiveLogService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const manager = getMcpAutonomousManagerIfExists();

    if (!manager || !manager.getSystemStatus().isActive) {
      return NextResponse.json({
        success: true,
        message: 'MCP-enabled autonomous monitoring is not running',
        status: 'already_stopped',
        lastChecked: new Date().toISOString()
      });
    }

    await manager.stopMCPEnabledMonitoring();

    const status = mapMcpAutonomousStatus(manager);

    await liveLogService.addLog({
      level: 'INFO',
      message: '🛑 MCP-enabled autonomous RFP monitoring system stopped successfully',
      source: 'MCPEnabledAutonomousRFPManager',
      category: 'system',
      metadata: {
        finalMetrics: status.metrics,
        shutdownTime: new Date().toISOString()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'MCP-enabled autonomous monitoring stopped successfully',
      status: 'stopped',
      finalMetrics: status.metrics,
      mcpSummary: {
        totalMcpCalls: status.metrics.totalMcpCalls || 0,
        entitiesProcessed: status.metrics.entitiesProcessed || 0,
        batchesCompleted: status.metrics.batchesCompleted || 0,
        rfpsIdentified: status.metrics.rfpsIdentified || 0,
        jsonFilesCreated: status.metrics.jsonFilesCreated || 0,
        operationDuration: status.uptime || 'Inactive'
      },
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      success: false,
      error: 'Failed to stop MCP-enabled autonomous system',
      message: errorMessage,
      lastChecked: new Date().toISOString()
    }, { status: 500 });
  }
}
