import { MCPEnabledAutonomousRFPManager } from '@/services/MCPEnabledAutonomousRFPManager';

declare global {
  // Shared singleton for the MCP-enabled autonomous system.
  // This keeps the manager alive across route handlers in the dev server.
  // eslint-disable-next-line no-var
  var mcpAutonomousManager: MCPEnabledAutonomousRFPManager | undefined;
}

export function getMcpAutonomousManager() {
  if (!global.mcpAutonomousManager) {
    global.mcpAutonomousManager = new MCPEnabledAutonomousRFPManager();
  }

  return global.mcpAutonomousManager;
}

export function getMcpAutonomousManagerIfExists() {
  return global.mcpAutonomousManager ?? null;
}

export function mapMcpAutonomousStatus(manager = getMcpAutonomousManager()) {
  const status = manager.getSystemStatus();
  const entitiesProcessed = status.metrics.entitiesProcessed || 0;

  return {
    isRunning: status.isActive,
    managerId: 'mcp-enabled-autonomous-manager',
    uptime: status.isActive ? 'Active' : 'Inactive',
    startTime: status.isActive ? new Date().toISOString() : undefined,
    metrics: {
      entitiesProcessed,
      batchesCompleted: Math.max(0, Math.ceil(entitiesProcessed / 3)),
      rfpsIdentified: status.metrics.totalOpportunities || 0,
      jsonFilesCreated: status.metrics.connectionAnalysesTriggered || 0,
      totalMcpCalls: status.metrics.mcpToolExecutions || 0,
      averageProcessingTime:
        status.metrics.averageProcessingTime > 0
          ? `${Math.round(status.metrics.averageProcessingTime)}s`
          : '0s'
    },
    config: {
      entityBatchSize: 3,
      monitoringCycle: '4-hours',
      outputDirectory: './rfp-analysis-results'
    },
    mcpIntegration: status.mcpIntegration
  };
}
