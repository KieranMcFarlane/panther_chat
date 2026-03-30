/**
 * Start or inspect the MCP-enabled autonomous RFP monitoring system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMcpAutonomousManager, getMcpAutonomousManagerIfExists, mapMcpAutonomousStatus } from '@/lib/mcp/mcp-autonomous-manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { config } = body;

    const manager = getMcpAutonomousManager();
    const currentStatus = manager.getSystemStatus();

    if (!currentStatus.isActive) {
      await manager.startMCPEnabledMonitoring();
    }

    const status = mapMcpAutonomousStatus(manager);

    return NextResponse.json({
      success: true,
      message: currentStatus.isActive
        ? 'MCP-enabled autonomous monitoring is already active'
        : 'MCP-enabled autonomous monitoring started successfully',
      systemInfo: status,
      config: {
        entityBatchSize: config?.entityBatchSize || status.config.entityBatchSize,
        monitoringCycle: config?.monitoringCycle || status.config.monitoringCycle,
        outputDirectory: config?.outputDirectory || status.config.outputDirectory,
        jsonFormat: 'structured-results',
        entitiesPerBatch: 3,
        cyclesPerDay: 6,
        estimatedDailyProcessing: 18
      },
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      success: false,
      error: 'Failed to start MCP-enabled autonomous RFP monitoring system',
      message: errorMessage,
      lastChecked: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  const manager = getMcpAutonomousManagerIfExists();

  if (!manager) {
    return NextResponse.json({
      success: true,
      status: 'inactive',
      message: 'MCP-enabled autonomous monitoring is inactive',
      canStart: true,
      systemInfo: {
        isRunning: false,
        managerId: 'mcp-enabled-autonomous-manager',
        uptime: 'Inactive',
        metrics: {
          entitiesProcessed: 0,
          batchesCompleted: 0,
          rfpsIdentified: 0,
          jsonFilesCreated: 0,
          totalMcpCalls: 0,
          averageProcessingTime: '0s'
        },
        config: {
          entityBatchSize: 3,
          monitoringCycle: '4-hours',
          outputDirectory: './rfp-analysis-results'
        }
      },
      capabilities: {
        directMCPIntegration: true,
        supportedMCPTools: ['neo4j-mcp', 'brightdata-mcp', 'perplexity-mcp'],
        entityProcessing: 'Neo4j traversal with relationship analysis',
        dataOutput: 'Structured JSON format',
        operationMode: '24/7 autonomous with cron scheduling'
      },
      lastChecked: new Date().toISOString()
    });
  }

  const status = mapMcpAutonomousStatus(manager);

  return NextResponse.json({
    success: true,
    status: status.isRunning ? 'active' : 'inactive',
    message: status.isRunning
      ? 'MCP-enabled autonomous monitoring is active'
      : 'MCP-enabled autonomous monitoring is inactive',
    canStart: true,
    systemInfo: status,
    capabilities: {
      directMCPIntegration: true,
      supportedMCPTools: ['neo4j-mcp', 'brightdata-mcp', 'perplexity-mcp'],
      entityProcessing: 'Neo4j traversal with relationship analysis',
      dataOutput: 'Structured JSON format',
      operationMode: '24/7 autonomous with cron scheduling'
    },
    lastChecked: new Date().toISOString()
  });
}
