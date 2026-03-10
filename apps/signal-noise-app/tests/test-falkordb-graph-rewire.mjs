import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const entityCacheServiceSource = readFileSync(new URL('../src/services/EntityCacheService.ts', import.meta.url), 'utf8')
const traversalRouteSource = readFileSync(new URL('../src/app/api/traversal-enrichment/route.ts', import.meta.url), 'utf8')
const relationshipsRouteSource = readFileSync(new URL('../src/app/api/graph/relationships/route.ts', import.meta.url), 'utf8')
const realtimeSyncSource = readFileSync(new URL('../src/services/RealtimeSyncService.ts', import.meta.url), 'utf8')
const continuousReasoningSource = readFileSync(new URL('../src/services/ContinuousReasoningService.ts', import.meta.url), 'utf8')
const syncDashboardSource = readFileSync(new URL('../src/components/sync/SyncDashboard.tsx', import.meta.url), 'utf8')
const incrementalSyncRouteSource = readFileSync(new URL('../src/app/api/sync/incremental/route.ts', import.meta.url), 'utf8')
const genericSearchRouteSource = readFileSync(new URL('../src/app/api/search/route.ts', import.meta.url), 'utf8')
const entitySearchRouteSource = readFileSync(new URL('../src/app/api/entities/search/route.ts', import.meta.url), 'utf8')
const entityDetailRouteSource = readFileSync(new URL('../src/app/api/entities/[entityId]/route.ts', import.meta.url), 'utf8')
const sportsEntitiesRouteSource = readFileSync(new URL('../src/app/api/sports-entities/route.ts', import.meta.url), 'utf8')
const conventionsRouteSource = readFileSync(new URL('../src/app/api/conventions/route.ts', import.meta.url), 'utf8')
const enrichEntityRouteSource = readFileSync(new URL('../src/app/api/enrich-entity/route.ts', import.meta.url), 'utf8')
const batchEnrichmentRouteSource = readFileSync(new URL('../src/app/api/batch/enrichment/route.ts', import.meta.url), 'utf8')
const connectionIntelligenceSource = readFileSync(new URL('../src/services/ConnectionIntelligenceAgent.ts', import.meta.url), 'utf8')
const rfpStorageRouteSource = readFileSync(new URL('../src/app/api/rfp-storage/route.ts', import.meta.url), 'utf8')
const rfpStorageServiceSource = readFileSync(new URL('../src/services/RFPStorageService.ts', import.meta.url), 'utf8')
const mcpAutonomousRfpManagerSource = readFileSync(new URL('../src/services/MCPEnabledAutonomousRFPManager.ts', import.meta.url), 'utf8')
const autonomousRfpManagerSource = readFileSync(new URL('../src/services/AutonomousRFPManager.ts', import.meta.url), 'utf8')
const headlessClaudeAgentServiceFixedSource = readFileSync(new URL('../src/services/HeadlessClaudeAgentServiceFixed.ts', import.meta.url), 'utf8')
const parallelClaudeAgentServiceSource = readFileSync(new URL('../src/services/ParallelClaudeAgentService.ts', import.meta.url), 'utf8')
const entityDossierEnrichmentServiceSource = readFileSync(new URL('../src/services/EntityDossierEnrichmentService.ts', import.meta.url), 'utf8')
const entityDossierRouteSource = readFileSync(new URL('../src/app/api/entities/[entityId]/dossier/route.ts', import.meta.url), 'utf8')
const genericDossierRouteSource = readFileSync(new URL('../src/app/api/dossier/route.ts', import.meta.url), 'utf8')
const entitiesRouteSource = readFileSync(new URL('../src/app/api/entities/route.ts', import.meta.url), 'utf8')
const entitiesSummaryRouteSource = readFileSync(new URL('../src/app/api/entities/summary/route.ts', import.meta.url), 'utf8')
const entityImportRouteSource = readFileSync(new URL('../src/app/api/entity-import/route.ts', import.meta.url), 'utf8')
const entityImportMapperSource = readFileSync(new URL('../src/lib/entity-import-mapper.ts', import.meta.url), 'utf8')
const predictiveReasoningEngineSource = readFileSync(new URL('../src/services/PredictiveReasoningEngine.ts', import.meta.url), 'utf8')
const keywordMinesServiceSource = readFileSync(new URL('../src/services/KeywordMinesService.ts', import.meta.url), 'utf8')
const enhancedRfpMonitoringWebhookSource = readFileSync(new URL('../src/app/api/webhook/enhanced-rfp-monitoring/route.ts', import.meta.url), 'utf8')
const networkMonitoringWebhookSource = readFileSync(new URL('../src/app/api/webhook/network-monitoring/route.ts', import.meta.url), 'utf8')
const linkedinConnectionAnalysisWebhookSource = readFileSync(new URL('../src/app/api/webhook/linkedin-connection-analysis/route.ts', import.meta.url), 'utf8')
const setupConnectionMinesWebhookSource = readFileSync(new URL('../src/app/api/webhook/setup-connection-mines/route.ts', import.meta.url), 'utf8')
const batchProcessRouteSource = readFileSync(new URL('../src/app/api/batch-process/route.ts', import.meta.url), 'utf8')
const sunderlandDossierRouteSource = readFileSync(new URL('../src/app/api/entity-dossiers/sunderland/route.ts', import.meta.url), 'utf8')
const persistentRfpServiceSource = readFileSync(new URL('../src/services/PersistentRFPService.ts', import.meta.url), 'utf8')
const reliableClaudeServiceSource = readFileSync(new URL('../src/services/ReliableClaudeService.ts', import.meta.url), 'utf8')
const neo4jQueryRouteSource = readFileSync(new URL('../src/app/api/neo4j-query/route.ts', import.meta.url), 'utf8')
const rfpExecuteRouteSource = readFileSync(new URL('../src/app/api/rfp-execute/route.ts', import.meta.url), 'utf8')
const mcpTestPageSource = readFileSync(new URL('../src/app/mcp-test/page.tsx', import.meta.url), 'utf8')
const liveRfpScannerSource = readFileSync(new URL('../src/components/LiveRFPScanner.tsx', import.meta.url), 'utf8')
const rfpScanControlRouteSource = readFileSync(new URL('../src/app/api/rfp-scan-control/route.ts', import.meta.url), 'utf8')
const rfpAutonomousScanRouteSource = readFileSync(new URL('../src/app/api/rfp-autonomous-scan/route.ts', import.meta.url), 'utf8')
const testHeadlessMcpBusRouteSource = readFileSync(new URL('../src/app/api/test-headless-mcp-bus/route.ts', import.meta.url), 'utf8')
const testFinalRfpVerificationRouteSource = readFileSync(new URL('../src/app/api/test-final-rfp-verification/route.ts', import.meta.url), 'utf8')
const testDirectRfpSearchRouteSource = readFileSync(new URL('../src/app/api/test-direct-rfp-search/route.ts', import.meta.url), 'utf8')
const migrationCompleteRestoreRouteSource = readFileSync(new URL('../src/app/api/migration/complete-restore/route.ts', import.meta.url), 'utf8')
const migrationFullRestoreRouteSource = readFileSync(new URL('../src/app/api/migration/full-restore/route.ts', import.meta.url), 'utf8')
const migrationNeo4jRestoreRouteSource = readFileSync(new URL('../src/app/api/migration/neo4j-restore/route.ts', import.meta.url), 'utf8')
const migrationCompleteRestoreServerActionRouteSource = readFileSync(new URL('../src/app/api/migration/complete-restore-server-action/route.ts', import.meta.url), 'utf8')
const migrationSampleRestoreRouteSource = readFileSync(new URL('../src/app/api/migration/sample-restore/route.ts', import.meta.url), 'utf8')
const migrationGetBatchRouteSource = readFileSync(new URL('../src/app/api/migration/get-batch/route.ts', import.meta.url), 'utf8')
const mcpNeo4jRouteSource = readFileSync(new URL('../src/app/api/mcp/neo4j/route.ts', import.meta.url), 'utf8')
const mcpNeo4jSearchRouteSource = readFileSync(new URL('../src/app/api/mcp/neo4j/search/route.ts', import.meta.url), 'utf8')
const mcpActionsSource = readFileSync(new URL('../src/components/mcp/MCPActions.tsx', import.meta.url), 'utf8')
const cleanClaudeAgentServiceSource = readFileSync(new URL('../src/services/CleanClaudeAgentService.ts', import.meta.url), 'utf8')
const intelligentEntityEnrichmentServiceSource = readFileSync(new URL('../src/services/IntelligentEntityEnrichmentService.ts', import.meta.url), 'utf8')
const workingIntelligentEntityEnrichmentServiceSource = readFileSync(new URL('../src/services/WorkingIntelligentEntityEnrichmentService.ts', import.meta.url), 'utf8')
const claudeAgentChatRouteSource = readFileSync(new URL('../src/app/api/claude-agent/chat/route.ts', import.meta.url), 'utf8')
const claudeAgentActivityRouteSource = readFileSync(new URL('../src/app/api/claude-agent/activity/route.ts', import.meta.url), 'utf8')
const runAgentRouteSource = readFileSync(new URL('../src/app/api/run-agent/route.ts', import.meta.url), 'utf8')
const sharedClaudeAgentManagerSource = readFileSync(new URL('../src/services/SharedClaudeAgentManager.ts', import.meta.url), 'utf8')
const tabSystemSource = readFileSync(new URL('../src/types/tab-system.ts', import.meta.url), 'utf8')
const appShellSource = readFileSync(new URL('../src/components/layout/AppShell.tsx', import.meta.url), 'utf8')
const mcpIndexSource = readFileSync(new URL('../src/lib/mcp/index.ts', import.meta.url), 'utf8')
const mcpToolExecutorSource = readFileSync(new URL('../src/lib/mcp-tool-executor.ts', import.meta.url), 'utf8')
const mcpClientBusSource = readFileSync(new URL('../src/lib/mcp/MCPClientBus.ts', import.meta.url), 'utf8')
const directMcpIntegrationSource = readFileSync(new URL('../src/lib/mcp/DirectMCPIntegration.ts', import.meta.url), 'utf8')
const httpMcpClientSource = readFileSync(new URL('../src/lib/mcp/HTTPMCPClient.ts', import.meta.url), 'utf8')
const fixedMcpClientBusSource = readFileSync(new URL('../src/lib/mcp/FixedMCPClientBus.ts', import.meta.url), 'utf8')
const streamingDirectMcpSource = readFileSync(new URL('../src/lib/mcp/StreamingDirectMCP.ts', import.meta.url), 'utf8')
const mcpRegistrationSource = readFileSync(new URL('../src/lib/mcp-registration.ts', import.meta.url), 'utf8')
const streamingClaudeAgentSource = readFileSync(new URL('../src/lib/agents/StreamingClaudeAgent.ts', import.meta.url), 'utf8')
const threadSystemSource = readFileSync(new URL('../src/types/thread-system.ts', import.meta.url), 'utf8')
const claudeAgentSdkServiceSource = readFileSync(new URL('../src/services/ClaudeAgentSDKService.ts', import.meta.url), 'utf8')
const reliableClaudeServiceSourceFull = readFileSync(new URL('../src/services/ReliableClaudeService.ts', import.meta.url), 'utf8')
const rfpScanControlRouteSourceFull = readFileSync(new URL('../src/app/api/rfp-scan-control/route.ts', import.meta.url), 'utf8')
const rfpAutonomousScanRouteSourceFull = readFileSync(new URL('../src/app/api/rfp-autonomous-scan/route.ts', import.meta.url), 'utf8')
const testHeadlessMcpBusRouteSourceFull = readFileSync(new URL('../src/app/api/test-headless-mcp-bus/route.ts', import.meta.url), 'utf8')
const mcpAutonomousStartRouteSource = readFileSync(new URL('../src/app/api/mcp-autonomous/start/route.ts', import.meta.url), 'utf8')
const verificationRouteSource = readFileSync(new URL('../src/app/api/verification/route.ts', import.meta.url), 'utf8')
const mcpAutonomousPageSource = readFileSync(new URL('../src/app/mcp-autonomous/page.tsx', import.meta.url), 'utf8')
const enhancedCopilotSidebarSource = readFileSync(new URL('../src/components/enhanced-copilot-sidebar.tsx', import.meta.url), 'utf8')
const styledCopilotSidebarSource = readFileSync(new URL('../src/components/styled-copilot-sidebar.tsx', import.meta.url), 'utf8')
const mastraGraphToolsSource = readFileSync(new URL('../src/mastra/tools/graph-tools.ts', import.meta.url), 'utf8')
const mastraGraphHelperSource = readFileSync(new URL('../src/mastra/tools/graph-helper.ts', import.meta.url), 'utf8')
const sportsIntelligenceToolsSource = readFileSync(new URL('../src/mastra/tools/sports-intelligence-tools.ts', import.meta.url), 'utf8')
const mastraAgentsIndexSource = readFileSync(new URL('../src/mastra/agents/index.ts', import.meta.url), 'utf8')
const graphRagRouteSource = readFileSync(new URL('../src/app/api/graphrag/route.ts', import.meta.url), 'utf8')
const testMcpHeadlessRouteSource = readFileSync(new URL('../src/app/api/test-mcp-headless/route.ts', import.meta.url), 'utf8')
const mcpDirectTestRouteSource = readFileSync(new URL('../src/app/api/mcp-direct/test/route.ts', import.meta.url), 'utf8')
const graphStoreSource = readFileSync(new URL('../src/lib/graph-store.ts', import.meta.url), 'utf8')
const graphIdSource = readFileSync(new URL('../src/lib/graph-id.ts', import.meta.url), 'utf8')
const entityCardSource = readFileSync(new URL('../src/components/EntityCard.tsx', import.meta.url), 'utf8')
const leagueNavSource = readFileSync(new URL('../src/components/header/LeagueNav.tsx', import.meta.url), 'utf8')
const leagueNavSimpleSource = readFileSync(new URL('../src/components/header/LeagueNavSimple.tsx', import.meta.url), 'utf8')
const entityDetailTabsSource = readFileSync(new URL('../src/components/entity-detail-tabs/EntityDetailTabs.tsx', import.meta.url), 'utf8')
const graphWrapperSource = readFileSync(new URL('../src/components/graph/GraphWrapper.tsx', import.meta.url), 'utf8')
const clubNavigationContextSource = readFileSync(new URL('../src/contexts/ClubNavigationContext.tsx', import.meta.url), 'utf8')
const entityDossierTypesSource = readFileSync(new URL('../src/components/entity-dossier/types.ts', import.meta.url), 'utf8')
const badgeTypesSource = readFileSync(new URL('../src/types/badge.ts', import.meta.url), 'utf8')
const entityLoaderSource = readFileSync(new URL('../src/lib/entity-loader.ts', import.meta.url), 'utf8')
const dossierEntitySource = readFileSync(new URL('../src/lib/dossier-entity.ts', import.meta.url), 'utf8')
const claudeAgentActionsSource = readFileSync(new URL('../src/lib/claude-agent-actions.ts', import.meta.url), 'utf8')
const claudeAgentSchedulerSource = readFileSync(new URL('../src/services/ClaudeAgentScheduler.ts', import.meta.url), 'utf8')
const headlessClaudeAgentServiceSource = readFileSync(new URL('../src/services/HeadlessClaudeAgentService.ts', import.meta.url), 'utf8')
const knowledgeGraphEnrichRouteSource = readFileSync(new URL('../src/app/api/knowledge-graph/enrich/route.ts', import.meta.url), 'utf8')
const linkedinRfpClaudeWebhookSource = readFileSync(new URL('../src/app/api/webhook/linkedin-rfp-claude/route.ts', import.meta.url), 'utf8')
const testClaudeAgentRouteSource = readFileSync(new URL('../src/app/api/test-claude-agent/route.ts', import.meta.url), 'utf8')
const claudeAgentRouteSource = readFileSync(new URL('../src/app/api/claude-agent/route.ts', import.meta.url), 'utf8')
const claudeAgentsSlashRouteSource = readFileSync(new URL('../src/app/api/claude-agents/slash/route.ts', import.meta.url), 'utf8')
const claudeAgentDemoExecuteRouteSource = readFileSync(new URL('../src/app/api/claude-agent-demo/execute/route.ts', import.meta.url), 'utf8')
const claudeAgentDemoStreamRouteSource = readFileSync(new URL('../src/app/api/claude-agent-demo/stream/route.ts', import.meta.url), 'utf8')
const rfpIntelligenceAnalyzeRouteSource = readFileSync(new URL('../src/app/api/rfp-intelligence/analyze/route.ts', import.meta.url), 'utf8')
const rfpIntelligenceRealDataRouteSource = readFileSync(new URL('../src/app/api/rfp-intelligence/real-data/route.ts', import.meta.url), 'utf8')
const rfpIntelligenceEntityBrowserSource = readFileSync(new URL('../src/app/rfp-intelligence/entity-browser.tsx', import.meta.url), 'utf8')
const intelligentEnrichmentRouteSource = readFileSync(new URL('../src/app/api/intelligent-enrichment/route.ts', import.meta.url), 'utf8')
const mcpAutonomousTestRouteSource = readFileSync(new URL('../src/app/api/mcp-autonomous/test/route.ts', import.meta.url), 'utf8')
const mcpAutonomousStreamRouteSource = readFileSync(new URL('../src/app/api/mcp-autonomous/stream/route.ts', import.meta.url), 'utf8')
const mcpAutonomousValidateRouteSource = readFileSync(new URL('../src/app/api/mcp-autonomous/validate/route.ts', import.meta.url), 'utf8')
const personRouteSource = readFileSync(new URL('../src/app/api/person/[personId]/route.ts', import.meta.url), 'utf8')
const personClientPageSource = readFileSync(new URL('../src/app/person/[personId]/client-page.tsx', import.meta.url), 'utf8')
const legacyEntityClientPageSource = readFileSync(new URL('../src/app/entity/[entityId]/client-page.tsx', import.meta.url), 'utf8')
const entityBrowserComplexPageSource = readFileSync(new URL('../src/app/entity-browser/complex-page.tsx', import.meta.url), 'utf8')
const graphPageSource = readFileSync(new URL('../src/app/graph/page.tsx', import.meta.url), 'utf8')
const entityBrowserSimpleTestSource = readFileSync(new URL('../src/app/entity-browser/simple-test-with-email.tsx', import.meta.url), 'utf8')
const getSystemSummaryRouteSource = readFileSync(new URL('../src/app/api/get-system-summary/route.ts', import.meta.url), 'utf8')
const claudeAgentExecuteRouteSource = readFileSync(new URL('../src/app/api/claude-agent/execute/route.ts', import.meta.url), 'utf8')
const tendersRouteSource = readFileSync(new URL('../src/app/api/tenders/route.ts', import.meta.url), 'utf8')
const healthRouteSource = readFileSync(new URL('../src/app/api/health/route.ts', import.meta.url), 'utf8')
const copilotkitRouteSource = readFileSync(new URL('../src/app/api/copilotkit/route.ts', import.meta.url), 'utf8')
const setupConnectionMinesActivateRouteSource = readFileSync(new URL('../src/app/api/setup-connection-mines/activate/route.ts', import.meta.url), 'utf8')
const claudeAgentsEnrichmentRouteSource = readFileSync(new URL('../src/app/api/claude-agents/enrichment/route.ts', import.meta.url), 'utf8')
const demoClaudeScanRouteSource = readFileSync(new URL('../src/app/api/demo-claude-scan/route.ts', import.meta.url), 'utf8')
const mcpAutonomousValidateRouteSourceFull = readFileSync(new URL('../src/app/api/mcp-autonomous/validate/route.ts', import.meta.url), 'utf8')
const traversalEnrichmentRouteSourceFull = readFileSync(new URL('../src/app/api/traversal-enrichment/route.ts', import.meta.url), 'utf8')
const docsReadmeSource = readFileSync(new URL('../docs/README.md', import.meta.url), 'utf8')
const legacyNeo4jReadmeSource = readFileSync(new URL('../legacy/neo4j/README.md', import.meta.url), 'utf8')
const productionDeployReadmeSource = readFileSync(new URL('../production-deploy/README.md', import.meta.url), 'utf8')
const temporalIntelligenceToolsSource = readFileSync(new URL('../src/components/temporal/TemporalIntelligenceTools.tsx', import.meta.url), 'utf8')
const historicalBatchProcessorRouteSource = readFileSync(new URL('../src/app/api/historical-batch-processor/route.ts', import.meta.url), 'utf8')
const enhancedHistoricalBatchProcessorSource = readFileSync(new URL('../src/lib/enhanced-historical-batch-processor.ts', import.meta.url), 'utf8')
const claudeCopilotSidebarSource = readFileSync(new URL('../src/components/copilotkit/ClaudeCopilotSidebar.tsx', import.meta.url), 'utf8')
const streamingChatSidebarSource = readFileSync(new URL('../src/components/chat/StreamingChatSidebar.tsx', import.meta.url), 'utf8')
const claudeChatCopilotKitSource = readFileSync(new URL('../src/components/ClaudeChatCopilotKit.tsx', import.meta.url), 'utf8')
const vectorSearchSource = readFileSync(new URL('../src/components/VectorSearch.tsx', import.meta.url), 'utf8')
const claudeAgentDashboardSource = readFileSync(new URL('../src/components/claude-agent/ClaudeAgentDashboard.tsx', import.meta.url), 'utf8')
const tabbedChatSidebarSource = readFileSync(new URL('../src/components/chat/TabbedChatSidebar.tsx', import.meta.url), 'utf8')
const systemStatusPanelSource = readFileSync(new URL('../src/components/home/SystemStatusPanel.tsx', import.meta.url), 'utf8')
const featureCardsSource = readFileSync(new URL('../src/components/home/FeatureCards.tsx', import.meta.url), 'utf8')
const claudeChatSource = readFileSync(new URL('../src/components/ClaudeChat.tsx', import.meta.url), 'utf8')
const thinkingDisplaySource = readFileSync(new URL('../src/components/ThinkingDisplay.tsx', import.meta.url), 'utf8')
const systemSummarySource = readFileSync(new URL('../src/components/SystemSummary.tsx', import.meta.url), 'utf8')
const entityBrowserPageSource = readFileSync(new URL('../src/app/entity-browser/page.tsx', import.meta.url), 'utf8')
const entityBrowserClientPageSource = readFileSync(new URL('../src/app/entity-browser/client-page.tsx', import.meta.url), 'utf8')
const testSshConnectionScriptSource = readFileSync(new URL('../test-ssh-connection.sh', import.meta.url), 'utf8')
const claudeCodeRfpAutomationSource = readFileSync(new URL('../claude-code-rfp-automation.sh', import.meta.url), 'utf8')
const claudeCodeRfpAutomationFixedSource = readFileSync(new URL('../claude-code-rfp-automation-fixed.sh', import.meta.url), 'utf8')
const automatedDatabaseSyncMcpSource = readFileSync(new URL('../automated-database-sync-mcp.js', import.meta.url), 'utf8')
const mcpConfigPerplexityRfpSource = readFileSync(new URL('../mcp-config-perplexity-rfp.json', import.meta.url), 'utf8')
const envLocalExampleSource = readFileSync(new URL('../.env.local.example', import.meta.url), 'utf8')
const rootMcpConfigSource = readFileSync(new URL('../.mcp.json', import.meta.url), 'utf8')
const envProductionSource = readFileSync(new URL('../.env.production', import.meta.url), 'utf8')
const graphIdDualWriteMigrationSource = readFileSync(new URL('../supabase/migrations/20260309_add_graph_id_dual_write_columns.sql', import.meta.url), 'utf8')
const graphRelationshipElementMigrationSource = readFileSync(new URL('../supabase/migrations/20260309_backfill_relationship_element_graph_ids.sql', import.meta.url), 'utf8')

test('entity cache service uses FalkorDB graph client for active sync paths', () => {
  assert.match(entityCacheServiceSource, /from ['"]@\/lib\/falkordb['"]/)
  assert.match(entityCacheServiceSource, /falkorGraphClient/)
  assert.match(entityCacheServiceSource, /syncEntitiesFromGraph|syncRelationshipsFromGraph/)
  assert.doesNotMatch(entityCacheServiceSource, /syncEntitiesFromNeo4j|syncRelationshipsFromNeo4j/)
})

test('traversal enrichment route no longer imports neo4j service directly', () => {
  assert.doesNotMatch(traversalRouteSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(traversalRouteSource, /from ['"]@\/lib\/falkordb['"]/)
})

test('graph relationships route queries FalkorDB instead of neo4j internal ids', () => {
  assert.doesNotMatch(relationshipsRouteSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(relationshipsRouteSource, /from ['"]@\/lib\/falkordb['"]/)
  assert.doesNotMatch(relationshipsRouteSource, /toString\(ID\(/)
  assert.match(relationshipsRouteSource, /source_graph_id: relationship\.fromId/)
  assert.match(relationshipsRouteSource, /target_graph_id: relationship\.toId/)
})

test('active entities and relationship routes do not emit neo4j relationship id fields', () => {
  assert.doesNotMatch(entitiesRouteSource, /neo4j_id:\s*entity\.neo4j_id/)
  assert.match(relationshipsRouteSource, /source_graph_id:\s*relationship\.fromId/)
  assert.match(relationshipsRouteSource, /target_graph_id:\s*relationship\.toId/)
  assert.doesNotMatch(relationshipsRouteSource, /source_neo4j_id:/)
  assert.doesNotMatch(relationshipsRouteSource, /target_neo4j_id:/)
})

test('realtime sync service rewires away from Neo4jService', () => {
  assert.doesNotMatch(realtimeSyncSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(realtimeSyncSource, /from ['"]@\/lib\/falkordb['"]/)
  assert.match(realtimeSyncSource, /resolveGraphId/)
  assert.match(realtimeSyncSource, /graph_id: graphId/)
  assert.match(realtimeSyncSource, /private async upsertSyncTracker\(graphId: string/)
  assert.match(realtimeSyncSource, /await this\.upsertSyncTracker\(entityGraphId, null, false\)/)
  assert.match(realtimeSyncSource, /await this\.upsertSyncTracker\(entityGraphId, graphEntity, true\)/)
  assert.match(realtimeSyncSource, /\.eq\('graph_id', graphId\)/)
  assert.match(realtimeSyncSource, /onConflict: 'graph_id'/)
})

test('continuous reasoning service uses cached relationship access instead of neo4j service', () => {
  assert.doesNotMatch(continuousReasoningSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(continuousReasoningSource, /EntityCacheService/)
  assert.match(continuousReasoningSource, /getRelationshipsForEntity\(/)
  assert.match(continuousReasoningSource, /buildGraphEntityLookupFilter|buildAnyGraphEntityLookupFilter/)
  assert.match(continuousReasoningSource, /select\('graph_id, neo4j_id, labels, properties/)
  assert.match(continuousReasoningSource, /withRelationshipGraphIds/)
  assert.match(continuousReasoningSource, /relationship\.source_graph_id === entityId/)
})

test('sync dashboard points at graph-to-supabase route and labels', () => {
  assert.match(syncDashboardSource, /\/api\/sync\/graph-to-supabase/)
  assert.doesNotMatch(syncDashboardSource, /Neo4j ↔ Supabase Sync/)
  assert.match(syncDashboardSource, /FalkorDB ↔ Supabase Sync/)
})

test('incremental sync route points at graph-to-supabase status endpoint', () => {
  assert.match(incrementalSyncRouteSource, /\/api\/sync\/graph-to-supabase/)
  assert.doesNotMatch(incrementalSyncRouteSource, /\/api\/sync\/neo4j-to-supabase/)
})

test('generic search route no longer imports neo4j directly', () => {
  assert.doesNotMatch(genericSearchRouteSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(genericSearchRouteSource, /cached-entities-supabase|supabase-client/)
  assert.match(genericSearchRouteSource, /from ['"]@\/lib\/graph-id['"]/)
  assert.match(genericSearchRouteSource, /select\('id, graph_id, neo4j_id, labels, properties'\)/)
  assert.match(genericSearchRouteSource, /const stableId = resolveGraphId\(row\) \|\| row\.id/)
  assert.match(genericSearchRouteSource, /id: stableId/)
  assert.match(genericSearchRouteSource, /graph_id: stableId/)
})

test('entity search route no longer imports neo4j directly', () => {
  assert.doesNotMatch(entitySearchRouteSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(entitySearchRouteSource, /cached-entities-supabase|supabase-client/)
  assert.match(entitySearchRouteSource, /from ['"]@\/lib\/graph-id['"]/)
  assert.doesNotMatch(entitySearchRouteSource, /mockEntities/)
  assert.match(entitySearchRouteSource, /select\('id, graph_id, neo4j_id, labels, properties'\)/)
  assert.match(entitySearchRouteSource, /const stableId = resolveGraphId\(entity\) \|\| entity\.id/)
  assert.match(entitySearchRouteSource, /graph_id: stableId/)
})

test('sports entities route no longer imports neo4j directly', () => {
  assert.doesNotMatch(sportsEntitiesRouteSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(sportsEntitiesRouteSource, /cached-entities-supabase|supabase-client/)
  assert.match(sportsEntitiesRouteSource, /from ['"]@\/lib\/graph-id['"]/)
  assert.doesNotMatch(sportsEntitiesRouteSource, /fallbackEntities/)
  assert.match(sportsEntitiesRouteSource, /select\('id, graph_id, neo4j_id, labels, properties, created_at, updated_at'\)/)
  assert.match(sportsEntitiesRouteSource, /const stableId = resolveGraphId\(entity\) \|\| 'unknown'/)
})

test('conventions route no longer imports neo4j directly for enrichment', () => {
  assert.doesNotMatch(conventionsRouteSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(conventionsRouteSource, /cached-entities-supabase|supabase-client/)
  assert.match(conventionsRouteSource, /from ['"]@\/lib\/graph-id['"]/)
  assert.match(conventionsRouteSource, /select\('id, graph_id, neo4j_id, labels, properties'\)/)
  assert.match(conventionsRouteSource, /const stableId = resolveGraphId\(entity\) \|\| entity\.id/)
  assert.match(conventionsRouteSource, /id: stableId/)
})

test('enrich entity route no longer imports neo4j directly for fetch and writeback', () => {
  assert.doesNotMatch(enrichEntityRouteSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(enrichEntityRouteSource, /from ['"]@\/lib\/supabase-client['"]/)
  assert.match(enrichEntityRouteSource, /from ['"]@\/lib\/graph-id['"]/)
  assert.doesNotMatch(enrichEntityRouteSource, /getEntityFromNeo4j|updateEntityInNeo4j/)
  assert.match(enrichEntityRouteSource, /getEntityFromSupabase|updateEntityInSupabase/)
  assert.match(enrichEntityRouteSource, /select\('id, graph_id, neo4j_id, labels, properties'\)/)
  assert.match(enrichEntityRouteSource, /buildGraphEntityLookupFilter/)
  assert.match(enrichEntityRouteSource, /flattened\.graph_id = resolveGraphId\(entity\) \|\| entity\.id/)
  assert.doesNotMatch(enrichEntityRouteSource, /flattened\.graph_id = entity\.graph_id \|\| entity\.neo4j_id \|\| entity\.id/)
})

test('batch enrichment route no longer imports neo4j directly for delta detection or writeback', () => {
  assert.doesNotMatch(batchEnrichmentRouteSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(batchEnrichmentRouteSource, /from ['"]@\/lib\/supabase-client['"]/)
  assert.match(batchEnrichmentRouteSource, /from ['"]@\/lib\/graph-id['"]/)
  assert.doesNotMatch(batchEnrichmentRouteSource, /updateNeo4jEntity/)
  assert.match(batchEnrichmentRouteSource, /updateCanonicalEntity|cached_entities/)
  assert.match(batchEnrichmentRouteSource, /select\('id, graph_id, neo4j_id, properties'\)/)
  assert.match(batchEnrichmentRouteSource, /buildGraphEntityLookupFilter\(item\.entity_id\)/)
})

test('connection intelligence agent no longer imports neo4j directly for cache persistence', () => {
  assert.doesNotMatch(connectionIntelligenceSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(connectionIntelligenceSource, /from ['"]@\/lib\/supabase-client['"]/)
  assert.doesNotMatch(connectionIntelligenceSource, /persistAnalysisResults\(\).*Neo4j|executeQuery\(/s)
  assert.match(connectionIntelligenceSource, /entity_cache|supabase/)
})

test('active service-layer cache contracts expose graph_id aliases alongside neo4j_id storage fields', () => {
  assert.match(entityCacheServiceSource, /graph_id\?: string/)
  assert.match(entityCacheServiceSource, /neo4j_id\?: string/)
  assert.match(entityCacheServiceSource, /source_graph_id\?: string/)
  assert.match(entityCacheServiceSource, /target_graph_id\?: string/)
  assert.match(entityCacheServiceSource, /buildAnyGraphEntityLookupFilter|buildLegacyRelationshipGraphFilter/)
  assert.match(entityCacheServiceSource, /source_graph_id\.eq\.\$\{sourceGraphId\},source_neo4j_id\.eq\.\$\{sourceGraphId\}/)
  assert.match(entityCacheServiceSource, /target_graph_id\.eq\.\$\{targetGraphId\},target_neo4j_id\.eq\.\$\{targetGraphId\}/)
  assert.match(entityCacheServiceSource, /source_graph_id\.eq\.\$\{graphId\},source_neo4j_id\.eq\.\$\{graphId\}/)
  assert.match(entityCacheServiceSource, /target_graph_id\.eq\.\$\{graphId\},target_neo4j_id\.eq\.\$\{graphId\}/)
  assert.match(entityCacheServiceSource, /graph_id: String\(row\.neo4j_id\)/)
  assert.match(entityCacheServiceSource, /id: entity\.graph_id \|\| entity\.neo4j_id/)
  assert.match(entityCacheServiceSource, /graph_id: entity\.graph_id \|\| entity\.neo4j_id/)
  assert.doesNotMatch(entityCacheServiceSource, /id: entity\.graph_id \|\| entity\.neo4j_id,\s+graph_id: entity\.graph_id \|\| entity\.neo4j_id,\s+neo4j_id: entity\.neo4j_id/s)
  assert.doesNotMatch(entityCacheServiceSource, /entities: entities\.map\(entity => \(\{\s+id: entity\.graph_id \|\| entity\.neo4j_id,\s+graph_id: entity\.graph_id \|\| entity\.neo4j_id,\s+neo4j_id: entity\.neo4j_id/s)
  assert.doesNotMatch(entityCacheServiceSource, /entities: paginatedEntities\.map\(entity => \(\{\s+id: entity\.graph_id \|\| entity\.neo4j_id,\s+graph_id: entity\.graph_id \|\| entity\.neo4j_id,\s+neo4j_id: entity\.neo4j_id/s)
  assert.doesNotMatch(entityCacheServiceSource, /entities: entities\.map\(entity => \(\{\s+id: entity\.graph_id \|\| entity\.neo4j_id,\s+graph_id: entity\.graph_id \|\| entity\.neo4j_id,\s+neo4j_id: entity\.neo4j_id,\s+labels: entity\.labels,\s+properties/s)
  assert.match(entityCacheServiceSource, /withRelationshipGraphIds\(relationship\)/)
  assert.match(entityCacheServiceSource, /relationship\.source_element_id = String\(sourceCheck\.graph_id \|\| sourceCheck\.neo4j_id \|\| sourceCheck\.id\)/)
  assert.match(entityCacheServiceSource, /relationship\.target_element_id = String\(targetCheck\.graph_id \|\| targetCheck\.neo4j_id \|\| targetCheck\.id\)/)
  assert.match(continuousReasoningSource, /graph_id\?: string;/)
  assert.match(continuousReasoningSource, /neo4j_id\?: string;/)
  assert.match(continuousReasoningSource, /graph_id: entity\.graph_id \|\| entity\.neo4j_id/)
  assert.match(realtimeSyncSource, /graph_id: string;/)
  assert.match(realtimeSyncSource, /neo4j_id\?: string;/)
  assert.match(realtimeSyncSource, /graph_id: String\(row\.graph_id\)/)
})

test('rfp storage route no longer imports neo4j directly', () => {
  assert.doesNotMatch(rfpStorageRouteSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.doesNotMatch(rfpStorageRouteSource, /new Neo4jService|await neo4j\.initialize/)
  assert.match(rfpStorageRouteSource, /getRFPStorageService\(\)/)
})

test('rfp storage service persists and reads from Supabase', () => {
  assert.match(rfpStorageServiceSource, /from ['"]@\/lib\/supabase-client['"]/)
  assert.match(rfpStorageServiceSource, /buildGraphEntityLookupFilter/)
  assert.match(rfpStorageServiceSource, /rfp_opportunities_unified/)
  assert.doesNotMatch(rfpStorageServiceSource, /getDriver\(\)\.session\(\)/)
})

test('mcp-enabled autonomous RFP manager uses graph-mcp and Supabase/FalkorDB helpers', () => {
  assert.match(mcpAutonomousRfpManagerSource, /from ['"]@\/lib\/supabase-client['"]/)
  assert.match(mcpAutonomousRfpManagerSource, /from ['"]@\/lib\/falkordb['"]/)
  assert.match(mcpAutonomousRfpManagerSource, /buildGraphEntityLookupFilter|buildLegacyRelationshipGraphFilter/)
  assert.match(mcpAutonomousRfpManagerSource, /graph-mcp/)
  assert.doesNotMatch(mcpAutonomousRfpManagerSource, /neo4j-mcp|executeNeo4jQuery/)
  assert.match(mcpAutonomousRfpManagerSource, /select\('id, graph_id, neo4j_id, name, labels, properties', \{ count: 'exact' \}\)/)
  assert.match(mcpAutonomousRfpManagerSource, /select\('id, graph_id, neo4j_id, name, labels, properties'\)/)
  assert.match(mcpAutonomousRfpManagerSource, /id: resolveGraphId\(entity\) \|\| entity\.id/)
  assert.match(mcpAutonomousRfpManagerSource, /graph_id: resolveGraphId\(entity\) \|\| entity\.id/)
  assert.match(mcpAutonomousRfpManagerSource, /withRelationshipGraphIds\(relationship\)/)
})

test('autonomous RFP manager no longer imports or opens Neo4j directly', () => {
  assert.doesNotMatch(autonomousRfpManagerSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(autonomousRfpManagerSource, /from ['"]@\/lib\/supabase-client['"]/)
  assert.match(autonomousRfpManagerSource, /buildLegacyRelationshipGraphFilter/)
  assert.doesNotMatch(autonomousRfpManagerSource, /new Neo4jService|getDriver\(|session\.run\(|populateEntitiesFromNeo4j|findEntityInNeo4j/)
  assert.match(autonomousRfpManagerSource, /populateEntitiesFromGraphCache|findEntityInCache|entity_relationships|cached_entities/)
  assert.match(autonomousRfpManagerSource, /graph_id: resolveGraphId\(data\) \|\| data\.id/)
  assert.doesNotMatch(autonomousRfpManagerSource, /neo4j_id:\s*data\.neo4j_id/)
  assert.match(autonomousRfpManagerSource, /withRelationshipGraphIds\(rawRelationship\)|withRelationshipGraphIds\(relationship\)/)
})

test('entity dossier route no longer imports or opens Neo4j directly', () => {
  assert.doesNotMatch(entityDossierRouteSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.doesNotMatch(entityDossierRouteSource, /new Neo4jService|getDriver\(|session\.run\(|MATCH \(e\)|Neo4j Graph/)
  assert.match(entityDossierRouteSource, /resolveEntityForDossier|entity_relationships/)
  assert.match(entityDossierRouteSource, /getSupabaseAdmin/)
  assert.match(entityDossierRouteSource, /buildLegacyRelationshipGraphFilter|resolveGraphId/)
  assert.match(entityDossierRouteSource, /select\('source_graph_id, target_graph_id, source_neo4j_id, target_neo4j_id/)
  assert.match(entityDossierRouteSource, /withRelationshipGraphIds\(rawRelationship\)/)
  assert.match(entityDossierRouteSource, /const personId = sourceIsPerson \? relationship\.source_graph_id : targetIsPerson \? relationship\.target_graph_id : null;/)
})

test('generic dossier route uses shared graph lookup helpers and server-side Supabase', () => {
  assert.match(genericDossierRouteSource, /getSupabaseAdmin/)
  assert.match(genericDossierRouteSource, /buildGraphEntityLookupFilter|resolveGraphId/)
  assert.doesNotMatch(genericDossierRouteSource, /\.eq\('neo4j_id', entityId\)/)
})

test('entities route no longer imports Neo4j helpers directly', () => {
  assert.doesNotMatch(entitiesRouteSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.doesNotMatch(entitiesRouteSource, /from ['"]neo4j-driver['"]/)
  assert.match(entitiesRouteSource, /cached-entities-supabase/)
  assert.match(entitiesRouteSource, /from ['"]@\/lib\/graph-id['"]/)
  assert.match(entitiesRouteSource, /const stableId = resolveGraphId\(entity\) \|\| entity\.id/)
  assert.match(entitiesRouteSource, /graph_id:\s*stableId/)
  assert.match(entitiesRouteSource, /name:\s*entity\.properties\?\.name \|\| stableId/)
})

test('entities summary route exposes graph_id aliases and avoids hardcoded Supabase credentials', () => {
  assert.match(entitiesSummaryRouteSource, /from ['"]@\/lib\/graph-id['"]/)
  assert.match(entitiesSummaryRouteSource, /graph_id:\s*resolveGraphId\(entity\) \|\| entity\.id/)
  assert.doesNotMatch(entitiesSummaryRouteSource, /graph_id:\s*entity\.graph_id \|\| entity\.neo4j_id \|\| entity\.id/)
  assert.doesNotMatch(entitiesSummaryRouteSource, /https:\/\/itlcuazbybqlkicsaola\.supabase\.co|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/)
})

test('entity import route uses shared graph lookup helpers for existing entity detection', () => {
  assert.match(entityImportRouteSource, /buildAnyGraphEntityLookupFilter|resolveGraphId/)
  assert.doesNotMatch(entityImportRouteSource, /\.in\('neo4j_id', entityIds\)/)
  assert.match(entityImportMapperSource, /graph_id: row\.entity_id/)
  assert.match(entityImportRouteSource, /onConflict: 'graph_id'/)
})

test('cache sync routes call graph-named EntityCacheService methods', () => {
  assert.match(readFileSync(new URL('../src/app/api/entities/cache-sync/route.ts', import.meta.url), 'utf8'), /syncEntitiesFromGraph/)
  assert.doesNotMatch(readFileSync(new URL('../src/app/api/entities/cache-sync/route.ts', import.meta.url), 'utf8'), /syncEntitiesFromNeo4j/)

  assert.match(readFileSync(new URL('../src/app/api/graph/relationships-cache/route.ts', import.meta.url), 'utf8'), /syncRelationshipsFromGraph/)
  assert.doesNotMatch(readFileSync(new URL('../src/app/api/graph/relationships-cache/route.ts', import.meta.url), 'utf8'), /syncRelationshipsFromNeo4j/)
  assert.match(readFileSync(new URL('../src/app/api/graph/relationships-cache/route.ts', import.meta.url), 'utf8'), /sourceGraphId|targetGraphId/)
  assert.match(entityCacheServiceSource, /sourceGraphId|targetGraphId/)
  assert.match(entityCacheServiceSource, /\.in\('graph_id', entities\.map\(\(entity\) => entity\.graph_id\)\)/)
  assert.match(entityCacheServiceSource, /onConflict: 'graph_id'/)
  assert.doesNotMatch(entityCacheServiceSource, /sourceNeo4jId\?: string|targetNeo4jId\?: string/)
})

test('predictive reasoning engine uses Supabase-backed history and cache persistence', () => {
  assert.doesNotMatch(predictiveReasoningEngineSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(predictiveReasoningEngineSource, /from ['"]@\/lib\/supabase-client['"]/)
  assert.match(predictiveReasoningEngineSource, /resolveEntityForDossier|entity_cache|from\('events'\)/)
  assert.doesNotMatch(predictiveReasoningEngineSource, /new Neo4jService|getDriver\(|executeQuery\(|MATCH \(|MERGE \(/)
})

test('keyword mines service initializes entities from Supabase cache instead of Neo4j', () => {
  assert.doesNotMatch(keywordMinesServiceSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(keywordMinesServiceSource, /from ['"]@\/lib\/supabase-client['"]/)
  assert.match(keywordMinesServiceSource, /from\('cached_entities'\)|keyword_mines/)
  assert.doesNotMatch(keywordMinesServiceSource, /new Neo4jService|getDriver\(|session\.run\(|MATCH \(/)
})

test('enhanced RFP monitoring webhook reads and stores via Supabase-backed paths', () => {
  assert.doesNotMatch(enhancedRfpMonitoringWebhookSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(enhancedRfpMonitoringWebhookSource, /from ['"]@\/lib\/supabase-client['"]/)
  assert.match(enhancedRfpMonitoringWebhookSource, /buildLegacyRelationshipGraphFilter|resolveGraphId/)
  assert.match(enhancedRfpMonitoringWebhookSource, /resolveEntityForDossier|entity_relationships|entity_cache/)
  assert.doesNotMatch(enhancedRfpMonitoringWebhookSource, /new Neo4jService|getDriver\(|executeQuery\(|MATCH \(|MERGE \(/)
})

test('network monitoring webhook reads and stores via Supabase-backed paths', () => {
  assert.doesNotMatch(networkMonitoringWebhookSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(networkMonitoringWebhookSource, /from ['"]@\/lib\/supabase-client['"]/)
  assert.match(networkMonitoringWebhookSource, /buildLegacyRelationshipGraphFilter|resolveGraphId/)
  assert.match(networkMonitoringWebhookSource, /resolveEntityForDossier|entity_relationships|entity_cache/)
  assert.doesNotMatch(networkMonitoringWebhookSource, /new Neo4jService|getDriver\(|executeQuery\(|MATCH \(|MERGE \(/)
})

test('linkedin connection analysis webhook stores to Supabase cache and does not advertise neo4j-mcp', () => {
  assert.doesNotMatch(linkedinConnectionAnalysisWebhookSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(linkedinConnectionAnalysisWebhookSource, /from ['"]@\/lib\/supabase-client['"]/)
  assert.match(linkedinConnectionAnalysisWebhookSource, /entity_cache/)
  assert.doesNotMatch(linkedinConnectionAnalysisWebhookSource, /neo4j-mcp|mcp__neo4j|new Neo4jService|getDriver\(|executeQuery\(|MATCH \(|MERGE \(/)
})

test('setup connection mines webhook reads entities and stores mines via Supabase cache', () => {
  assert.doesNotMatch(setupConnectionMinesWebhookSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.match(setupConnectionMinesWebhookSource, /from ['"]@\/lib\/supabase-client['"]/)
  assert.match(setupConnectionMinesWebhookSource, /from\('cached_entities'\)|entity_cache/)
  assert.doesNotMatch(setupConnectionMinesWebhookSource, /new Neo4jService|getDriver\(|executeQuery\(|MATCH \(|MERGE \(/)
  assert.match(setupConnectionMinesWebhookSource, /from ['"]@\/lib\/graph-id['"]/)
})

test('batch process route reads entity batches from Supabase cache instead of Neo4j', () => {
  assert.doesNotMatch(batchProcessRouteSource, /from ['"]neo4j-driver['"]/)
  assert.doesNotMatch(batchProcessRouteSource, /neo4jDriver|session\.run\(|MATCH \(n:Entity\)/)
  assert.match(batchProcessRouteSource, /from ['"]@\/lib\/supabase-client['"]/)
  assert.match(batchProcessRouteSource, /from ['"]@\/lib\/graph-id['"]/)
  assert.match(batchProcessRouteSource, /from\('cached_entities'\)/)
  assert.match(batchProcessRouteSource, /select\('id, graph_id, neo4j_id, labels, properties, created_at, updated_at'\)/)
  assert.match(batchProcessRouteSource, /const stableId = resolveGraphId\(row\) \|\| row\.id/)
  assert.match(batchProcessRouteSource, /graph_id:\s*stableId/)
  assert.match(batchProcessRouteSource, /id:\s*stableId/)
})

test('sunderland dossier route no longer imports or lazy-loads Neo4jService', () => {
  assert.doesNotMatch(sunderlandDossierRouteSource, /from ['"]@\/lib\/neo4j['"]/)
  assert.doesNotMatch(sunderlandDossierRouteSource, /await import\(['"]@\/lib\/neo4j['"]\)|new Neo4jService|neo4jService\.run|MATCH \(e:Entity/)
  assert.match(sunderlandDossierRouteSource, /from\('entity_dossiers'\)|from\('connection_paths'\)|from\('opportunity_assessments'\)/)
  assert.match(sunderlandDossierRouteSource, /buildGraphEntityLookupFilter/)
})

test('persistent RFP service no longer calls raw neo4j query endpoint', () => {
  assert.doesNotMatch(persistentRfpServiceSource, /\/api\/neo4j-query/)
  assert.match(persistentRfpServiceSource, /\/api\/entities\?page=1&limit=1/)
})

test('reliable Claude service fetches entities from cached entity APIs instead of raw neo4j query endpoint', () => {
  assert.doesNotMatch(reliableClaudeServiceSource, /\/api\/neo4j-query/)
  assert.match(reliableClaudeServiceSource, /\/api\/entities\?page=1&limit=\$\{safeSkip \+ safeLimit\}/)
})

test('raw neo4j query route is retired and no longer imports neo4j-driver', () => {
  assert.doesNotMatch(neo4jQueryRouteSource, /from ['"]neo4j-driver['"]/)
  assert.match(neo4jQueryRouteSource, /status:\s*'retired'|status:\s*"retired"/)
  assert.match(neo4jQueryRouteSource, /410/)
})

test('direct RFP execute route is retired and no longer contains direct secret-bearing integrations', () => {
  assert.doesNotMatch(rfpExecuteRouteSource, /neo4j-driver|api\.brightdata\.com|api\.perplexity\.ai|neo4j\+s:\/\//)
  assert.match(rfpExecuteRouteSource, /status:\s*'retired'|status:\s*"retired"/)
  assert.match(rfpExecuteRouteSource, /410/)
})

test('legacy UI surfaces no longer call the retired direct RFP execution route', () => {
  assert.doesNotMatch(mcpTestPageSource, /\/api\/rfp-execute/)
  assert.doesNotMatch(liveRfpScannerSource, /\/api\/rfp-execute/)
})

test('active RFP runtime surfaces no longer embed Neo4j or BrightData fallback secrets in code', () => {
  assert.doesNotMatch(reliableClaudeServiceSource, /neo4j\+s:\/\/e6bb5665\.databases\.neo4j\.io|bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4|NeO4jPaSSworD!/)
})

test('active RFP scan routes no longer embed Neo4j or BrightData fallback secrets in code', () => {
  const unsafeFallbackPattern = /neo4j\+s:\/\/e6bb5665\.databases\.neo4j\.io|bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4|NeO4jPaSSworD!/;
  assert.doesNotMatch(rfpScanControlRouteSource, unsafeFallbackPattern)
  assert.doesNotMatch(rfpAutonomousScanRouteSource, unsafeFallbackPattern)
})

test('test and admin RFP routes no longer embed Neo4j or BrightData fallback secrets in code', () => {
  const unsafeFallbackPattern = /neo4j\+s:\/\/e6bb5665\.databases\.neo4j\.io|bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4|NeO4jPaSSworD!/;
  assert.doesNotMatch(testHeadlessMcpBusRouteSource, unsafeFallbackPattern)
  assert.doesNotMatch(testFinalRfpVerificationRouteSource, unsafeFallbackPattern)
  assert.doesNotMatch(testDirectRfpSearchRouteSource, unsafeFallbackPattern)
})

test('legacy migration restore routes are retired instead of exposing Neo4j restore paths', () => {
  const retiredRoutes = [
    migrationCompleteRestoreRouteSource,
    migrationFullRestoreRouteSource,
    migrationNeo4jRestoreRouteSource,
    migrationCompleteRestoreServerActionRouteSource,
    migrationSampleRestoreRouteSource,
    migrationGetBatchRouteSource,
  ];

  for (const source of retiredRoutes) {
    assert.match(source, /status:\s*'retired'|status:\s*"retired"/)
    assert.match(source, /410/)
  }

  assert.doesNotMatch(migrationCompleteRestoreRouteSource, /neo4j-driver/)
  assert.doesNotMatch(migrationFullRestoreRouteSource, /neo4j-driver/)
  assert.doesNotMatch(migrationNeo4jRestoreRouteSource, /neo4j-driver/)
  assert.doesNotMatch(migrationCompleteRestoreServerActionRouteSource, /neo4j-driver/)
  assert.doesNotMatch(migrationSampleRestoreRouteSource, /neo4j-driver/)
})

test('neo4j-named MCP routes are retired and UI actions no longer call them', () => {
  assert.match(mcpNeo4jRouteSource, /status:\s*'retired'|status:\s*"retired"/)
  assert.match(mcpNeo4jRouteSource, /410/)
  assert.match(mcpNeo4jSearchRouteSource, /status:\s*'retired'|status:\s*"retired"/)
  assert.match(mcpNeo4jSearchRouteSource, /410/)
  assert.doesNotMatch(mcpActionsSource, /\/api\/mcp\/neo4j/)
  assert.doesNotMatch(mcpActionsSource, /neo4j_query|neo4j_search_entities|Neo4j MCP Tools/)
  assert.match(mcpActionsSource, /graph_query|graph_search_entities|Graph MCP Tools/)
})

test('internal agent tool definitions no longer advertise neo4j_query or Neo4j graph wording', () => {
  const sources = [
    cleanClaudeAgentServiceSource,
    intelligentEntityEnrichmentServiceSource,
    workingIntelligentEntityEnrichmentServiceSource,
    claudeAgentChatRouteSource,
  ]

  for (const source of sources) {
    assert.doesNotMatch(source, /neo4j_query/)
    assert.match(source, /graph_query/)
  }
})

test('active enrichment mock services use graph terminology in tool lists and persistence messaging', () => {
  const sources = [cleanClaudeAgentServiceSource, intelligentEntityEnrichmentServiceSource]

  for (const source of sources) {
    assert.match(source, /graph-mcp|graph_relationships|graph_data|GraphMCP|graph store/)
    assert.doesNotMatch(source, /neo4j-mcp|neo4j_relationships|neo4j_data|updateEntityInNeo4j|Neo4jMCP|Updating Neo4j/)
  }

  assert.match(cleanClaudeAgentServiceSource, /graph_id\?: string;/)
  assert.match(cleanClaudeAgentServiceSource, /graph_id: '1'/)
})

test('autonomous RFP manager uses graph credential fields instead of neo4j fields', () => {
  assert.match(autonomousRfpManagerSource, /graphUri|graphUsername|graphPassword/)
  assert.doesNotMatch(autonomousRfpManagerSource, /neo4jUri|neo4jUsername|neo4jPassword|process\.env\.NEO4J_/)
})

test('claude agent activity route reports graph-mcp server status', () => {
  assert.match(claudeAgentActivityRouteSource, /graph-mcp/)
  assert.doesNotMatch(claudeAgentActivityRouteSource, /neo4j-mcp/)
})

test('headless fixed agent service uses graph config and graph MCP naming', () => {
  assert.match(headlessClaudeAgentServiceFixedSource, /graphUri|graphUsername|graphPassword/)
  assert.match(headlessClaudeAgentServiceFixedSource, /mcp__graph_mcp__execute_query|query-graph|graph database|Graph query/)
  assert.doesNotMatch(headlessClaudeAgentServiceFixedSource, /neo4jUri|neo4jUsername|neo4jPassword|mcp__neo4j_mcp__execute_query|query-neo4j|Neo4j/)
})

test('parallel claude agent service uses graph-mcp naming and graph query helpers', () => {
  assert.match(parallelClaudeAgentServiceSource, /graph-mcp|generateGraphQueries|callGraphMCP/)
  assert.doesNotMatch(parallelClaudeAgentServiceSource, /neo4j-mcp|generateNeo4jQueries|callNeo4jMCP/)
})

test('entity dossier enrichment service uses graph credential fields', () => {
  assert.match(entityDossierEnrichmentServiceSource, /graphUri|graphUsername|graphPassword/)
  assert.doesNotMatch(entityDossierEnrichmentServiceSource, /neo4jUri|neo4jUsername|neo4jPassword/)
})

test('claude agent demo routes use graph-aligned config and status fields', () => {
  assert.match(claudeAgentDemoExecuteRouteSource, /graphUri|graphUsername|graphPassword|process\.env\.FALKORDB_/)
  assert.doesNotMatch(claudeAgentDemoExecuteRouteSource, /neo4jUri|neo4jUsername|neo4jPassword|process\.env\.NEO4J_/)

  assert.match(claudeAgentDemoStreamRouteSource, /hasGraph/)
  assert.doesNotMatch(claudeAgentDemoStreamRouteSource, /hasNeo4j|process\.env\.NEO4J_/)
})

test('intelligent enrichment and real-data routes advertise graph-mcp instead of neo4j-mcp', () => {
  assert.match(intelligentEnrichmentRouteSource, /graph-mcp/)
  assert.doesNotMatch(intelligentEnrichmentRouteSource, /neo4j-mcp/)

  assert.match(rfpIntelligenceRealDataRouteSource, /graph-mcp/)
  assert.doesNotMatch(rfpIntelligenceRealDataRouteSource, /neo4j-mcp/)
})

test('person profile route uses graph-backed wording in its mock storage comments', () => {
  assert.match(personRouteSource, /graph-backed profile store/)
  assert.doesNotMatch(personRouteSource, /fetch from Neo4j database|update person in Neo4j database/)
})

test('system summary route fallback copy advertises FalkorDB graph integration', () => {
  assert.match(getSystemSummaryRouteSource, /FalkorDB graph intelligence with sports entities|FalkorDB Graph Integration/)
  assert.doesNotMatch(getSystemSummaryRouteSource, /Neo4j Knowledge Graph with sports entities|Neo4j Knowledge Graph Integration/)
})

test('claude agent execute route uses graph-backed wording in mock action handlers', () => {
  assert.match(claudeAgentExecuteRouteSource, /graph-backed relationship store|graph-backed data store/)
  assert.doesNotMatch(claudeAgentExecuteRouteSource, /query Neo4j and email data|update Neo4j/)
})

test('tenders route advertises FalkorDB graph intelligence in opportunity source metadata', () => {
  assert.match(tendersRouteSource, /FalkorDB Graph Intelligence/)
  assert.doesNotMatch(tendersRouteSource, /Neo4j Knowledge Graph/)
})

test('health route uses graph database wording in its connection check comment', () => {
  assert.match(healthRouteSource, /actual graph database connection/)
  assert.doesNotMatch(healthRouteSource, /actual Neo4j connection/)
})

test('copilotkit route uses graph-aligned architecture and graph store wording', () => {
  assert.match(copilotkitRouteSource, /FalkorDB graph database|temporal graph memory|graph intelligence store|legacy graph ID/)
  assert.doesNotMatch(copilotkitRouteSource, /Backend: Neo4j Aura|Temporal knowledge graph via Graphiti \(Neo4j backend\)|knowledge graph is your PRIMARY source|name or neo4j_id/)
  assert.doesNotMatch(copilotkitRouteSource, /FALKORDB_USER": process\.env\.FALKORDB_USER \|\| "neo4j"/)
})

test('setup connection mines activation route uses graph-backed wording for entity loading', () => {
  assert.match(setupConnectionMinesActivateRouteSource, /graph-backed entity store/)
  assert.doesNotMatch(setupConnectionMinesActivateRouteSource, /all entities in Neo4j database|Fetching entities from Neo4j/)
})

test('claude agents enrichment route advertises Graph MCP in enrichment sources', () => {
  assert.match(claudeAgentsEnrichmentRouteSource, /Graph MCP: Relationship mapping, graph intelligence/)
  assert.doesNotMatch(claudeAgentsEnrichmentRouteSource, /Neo4j MCP: Relationship mapping, knowledge graph/)
})

test('demo Claude scan route uses graph storage wording in fallback logging', () => {
  assert.match(demoClaudeScanRouteSource, /graph intelligence store|dataSource: isRealData \? 'supabase_database' : 'graph_store'|\['claude-agent', 'tool-use', 'graph', 'storage'\]/)
  assert.doesNotMatch(demoClaudeScanRouteSource, /simulated Neo4j|Storing RFP results in Neo4j|dataSource: isRealData \? 'supabase_database' : 'neo4j'|\['claude-agent', 'tool-use', 'neo4j', 'storage'\]/)
})

test('MCP autonomous validate route uses graph analysis naming in sample validation payloads', () => {
  assert.match(mcpAutonomousValidateRouteSourceFull, /graphAnalysis|Get test entities from the graph-backed store \(simulated\)|graph:\s*\{/)
  assert.doesNotMatch(mcpAutonomousValidateRouteSourceFull, /neo4jAnalysis|Get test entities from Neo4j \(simulated\)|neo4j:\s*\{/)
})

test('traversal enrichment route advertises graph relationship traversal in status features', () => {
  assert.match(traversalEnrichmentRouteSourceFull, /Graph relationship traversal/)
  assert.doesNotMatch(traversalEnrichmentRouteSourceFull, /Neo4j relationship traversal/)
})

test('traversal enrichment route uses graph_id internally instead of neo4j_id compatibility naming', () => {
  assert.match(traversalEnrichmentRouteSourceFull, /graph_id: string/)
  assert.doesNotMatch(traversalEnrichmentRouteSourceFull, /neo4j_id: string;/)
})

test('entity detail route dossier metadata advertises FalkorDB graph store sources', () => {
  assert.match(entityDetailRouteSource, /FalkorDB Graph Store|Industry Analysis|Dynamic Generation/)
  assert.doesNotMatch(entityDetailRouteSource, /Neo4j Database/)
  assert.doesNotMatch(entityDetailRouteSource, /graph_id: entity\.graph_id \|\| entity\.neo4j_id \|\| entity\.id/)
  assert.match(entityDetailRouteSource, /graph_id: entity\.graph_id \|\| entity\.id/)
})

test('run-agent route no longer instructs agents to use neo4j-mcp directly', () => {
  assert.doesNotMatch(runAgentRouteSource, /mcp__neo4j-mcp__execute_query|Query Neo4j database|Track entities processed from Neo4j/i)
  assert.match(runAgentRouteSource, /graph-backed entity|cached entities|graph query/i)
})

test('shared Claude agent manager advertises graph-mcp instead of neo4j-mcp', () => {
  assert.doesNotMatch(sharedClaudeAgentManagerSource, /neo4j-mcp/)
  assert.match(sharedClaudeAgentManagerSource, /graph-mcp/)
})

test('tab system presets use graph-mcp naming for graph-capable tabs', () => {
  assert.doesNotMatch(tabSystemSource, /neo4j-mcp|Neo4j and knowledge graph specialist/i)
  assert.match(tabSystemSource, /graph-mcp|graph and relationship specialist/i)
})

test('app shell agent config advertises graph analysis tooling', () => {
  assert.doesNotMatch(appShellSource, /neo4j-mcp|database operations/i)
  assert.match(appShellSource, /graph-mcp|graph analysis/i)
})

test('core MCP tool definitions use graph/FalkorDB wiring instead of direct Neo4j driver access', () => {
  assert.doesNotMatch(mcpIndexSource, /neo4j-driver|mcp__neo4j-mcp__execute_query|neo4j\+s:\/\//)
  assert.match(mcpIndexSource, /falkordb|graph query|mcp__graph-mcp__execute_query/i)
})

test('MCP tool executor no longer hardcodes Neo4j driver access or BrightData secrets', () => {
  assert.doesNotMatch(mcpToolExecutorSource, /neo4j-driver|mcp__neo4j-mcp__execute_query|neo4j\+s:\/\/|bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4|llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0/)
  assert.match(mcpToolExecutorSource, /falkordb|graph-mcp|BRIGHTDATA_API_TOKEN/i)
})

test('MCP client bus config no longer boots a neo4j MCP server with hardcoded Aura defaults', () => {
  assert.doesNotMatch(mcpClientBusSource, /neo4j-mcp|@alanse\/mcp-neo4j-server|neo4j\+s:\/\/cce1f84b|AURA_INSTANCEID|AURA_INSTANCENAME/)
  assert.match(mcpClientBusSource, /graph-mcp|FALKORDB_/)
})

test('direct MCP integration uses graph-mcp naming and env-only credentials', () => {
  assert.doesNotMatch(directMcpIntegrationSource, /neo4j-mcp|@alanse\/mcp-neo4j-server|neo4j\+s:\/\/cce1f84b|bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4/)
  assert.match(directMcpIntegrationSource, /graph-mcp|FALKORDB_|BRIGHTDATA_API_TOKEN/i)
})

test('HTTP MCP client config uses graph-mcp naming and FalkorDB env vars', () => {
  assert.doesNotMatch(httpMcpClientSource, /neo4j-mcp|@alanse\/mcp-neo4j-server|neo4j\+s:\/\/cce1f84b|AURA_INSTANCEID|AURA_INSTANCENAME/)
  assert.match(httpMcpClientSource, /graph-mcp|FALKORDB_/)
})

test('fixed MCP client bus uses graph-mcp naming and FalkorDB env vars', () => {
  assert.doesNotMatch(fixedMcpClientBusSource, /neo4j-mcp|@alanse\/mcp-neo4j-server|neo4j\+s:\/\/cce1f84b|AURA_INSTANCEID|AURA_INSTANCENAME/)
  assert.match(fixedMcpClientBusSource, /graph-mcp|FALKORDB_/)
})

test('streaming direct MCP integration no longer embeds Neo4j or secret fallbacks', () => {
  assert.doesNotMatch(streamingDirectMcpSource, /neo4j-mcp|@alanse\/mcp-neo4j-server|neo4j\+s:\/\/cce1f84b|llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0|AURA_INSTANCEID|AURA_INSTANCENAME/)
  assert.match(streamingDirectMcpSource, /graph-mcp|FALKORDB_/)
})

test('MCP registration service advertises graph-mcp tool names', () => {
  assert.doesNotMatch(mcpRegistrationSource, /neo4j-mcp|registerNeo4jServer|mcp__neo4j-mcp__/)
  assert.match(mcpRegistrationSource, /graph-mcp|registerGraphServer|mcp__graph-mcp__/)
})

test('streaming Claude agent uses graph-mcp streaming methods and graph language', () => {
  assert.doesNotMatch(streamingClaudeAgentSource, /executeNeo4jQueryStream|Querying Neo4j|source: 'neo4j'|knowledge graph/i)
  assert.match(streamingClaudeAgentSource, /executeGraphQueryStream|graph query|source: 'graph'/i)
})

test('thread templates use graph-mcp naming in active tool presets', () => {
  assert.doesNotMatch(threadSystemSource, /neo4j-mcp|Neo4j/i)
  assert.match(threadSystemSource, /graph-mcp|graph/i)
})

test('Claude agent SDK service reports graph-mcp server connectivity', () => {
  assert.doesNotMatch(claudeAgentSdkServiceSource, /neo4j-mcp/)
  assert.match(claudeAgentSdkServiceSource, /graph-mcp/)
})

test('reliable Claude service uses graph-mcp tool names in active MCP config', () => {
  assert.doesNotMatch(reliableClaudeServiceSourceFull, /neo4j-mcp|mcp__neo4j-mcp__|Neo4j MCP/i)
  assert.match(reliableClaudeServiceSourceFull, /graph-mcp|mcp__graph-mcp__/)
})

test('RFP scan control route uses graph-mcp naming and graph status copy', () => {
  assert.doesNotMatch(rfpScanControlRouteSourceFull, /neo4j-mcp|mcp__neo4j-mcp__|Initializing Neo4j connection|Neo4j connected successfully|Neo4j Query/i)
  assert.match(rfpScanControlRouteSourceFull, /graph-mcp|mcp__graph-mcp__|Initializing graph connection|Graph connected successfully|Graph query/i)
})

test('autonomous RFP scan route uses graph-mcp naming and graph wording', () => {
  assert.doesNotMatch(rfpAutonomousScanRouteSourceFull, /neo4j-mcp|mcp__neo4j-mcp__|access to Neo4j|Query Neo4j|Neo4j entity/i)
  assert.match(rfpAutonomousScanRouteSourceFull, /graph-mcp|mcp__graph-mcp__|graph-backed entities|Query the graph/i)
})

test('headless MCP bus test route uses graph-mcp naming and graph wording', () => {
  assert.doesNotMatch(testHeadlessMcpBusRouteSourceFull, /neo4j-mcp|mcp__neo4j-mcp__|Neo4j knowledge graph|Neo4j MCP/i)
  assert.match(testHeadlessMcpBusRouteSourceFull, /graph-mcp|mcp__graph-mcp__|graph cache|graph MCP/i)
})

test('MCP autonomous start route uses graph-mcp naming and graph telemetry labels', () => {
  assert.doesNotMatch(mcpAutonomousStartRouteSource, /neo4j-mcp|Neo4j MCP|Verify Neo4j connection|Neo4j traversal/i)
  assert.match(mcpAutonomousStartRouteSource, /graph-mcp|Graph MCP|Verify graph connection|graph traversal/i)
})

test('verification route reports graph-mcp tool health instead of neo4j-mcp', () => {
  assert.doesNotMatch(verificationRouteSource, /neo4j-mcp|Test Neo4j MCP|Simple Neo4j connection test/i)
  assert.match(verificationRouteSource, /graph-mcp|Test graph MCP|Simple graph connection test/i)
})

test('MCP autonomous page advertises graph-backed MCP tooling instead of Neo4j wording', () => {
  assert.doesNotMatch(mcpAutonomousPageSource, /neo4j-mcp|Neo4j|knowledge graph/i)
  assert.match(mcpAutonomousPageSource, /graph-mcp|FalkorDB Graph|graph relationships/i)
})

test('enhanced copilot sidebar uses graph-mcp tool names and graph database copy', () => {
  assert.doesNotMatch(enhancedCopilotSidebarSource, /mcp__neo4j-mcp__|Neo4j/i)
  assert.match(enhancedCopilotSidebarSource, /mcp__graph-mcp__|Graph database/i)
})

test('styled copilot sidebar uses graph-mcp tool names and graph database copy', () => {
  assert.doesNotMatch(styledCopilotSidebarSource, /mcp__neo4j-mcp__|Neo4j/i)
  assert.match(styledCopilotSidebarSource, /mcp__graph-mcp__|Graph database/i)
})

test('Mastra graph tool wrappers use graph MCP naming and env vars', () => {
  assert.doesNotMatch(mastraGraphToolsSource, /NEO4J_MCP_URL|Neo4j MCP|Neo4j Query|Neo4j Create|queryKnowledgeGraph/)
  assert.match(mastraGraphToolsSource, /GRAPH_MCP_URL|graph MCP|Graph query|Graph create|queryGraph/)
})

test('Mastra graph helper uses graph MCP naming and env vars', () => {
  assert.doesNotMatch(mastraGraphHelperSource, /NEO4J_MCP_URL|Neo4j MCP|queryNeo4j|createNeo4jNode/)
  assert.match(mastraGraphHelperSource, /GRAPH_MCP_URL|graph MCP|queryGraph|createGraphNode/)
})

test('sports intelligence tools use graph helpers and graph wording', () => {
  assert.doesNotMatch(sportsIntelligenceToolsSource, /queryNeo4j|createNeo4jNode|NEO4J_MCP_URL|Neo4j MCP|Neo4j database/i)
  assert.match(sportsIntelligenceToolsSource, /queryGraph|createGraphNode|GRAPH_MCP_URL|Graph/i)
})

test('Mastra agent registry advertises graph tools instead of neo4j tools', () => {
  assert.doesNotMatch(mastraAgentsIndexSource, /neo4jTools|Neo4j database/i)
  assert.match(mastraAgentsIndexSource, /graphTools|graph database/i)
})

test('GraphRAG route no longer advertises Neo4j fallback logic', () => {
  assert.doesNotMatch(graphRagRouteSource, /queryNeo4jDirect|NEO4J_URI|NEO4J_USERNAME|NEO4J_USER|NEO4J_PASSWORD|Query Neo4j directly|Neo4j query error/i)
  assert.match(graphRagRouteSource, /getFallbackResults|Graphiti service not available, using fallback/i)
})

test('headless MCP test route reports graph-mcp usage instead of neo4j-mcp', () => {
  assert.doesNotMatch(testMcpHeadlessRouteSource, /neo4j-mcp|Neo4j MCP/i)
  assert.match(testMcpHeadlessRouteSource, /graph-mcp|Graph MCP/i)
})

test('direct MCP test route uses graph direct execution instead of neo4j direct execution', () => {
  assert.doesNotMatch(mcpDirectTestRouteSource, /testNeo4jDirect|executeNeo4jQuery|neo4j-direct|Neo4j MCP|Check Neo4j database connection/i)
  assert.match(mcpDirectTestRouteSource, /testGraphDirect|executeGraphQuery|graph-direct|Graph MCP|Check graph database connection/i)
})

test('active helper files were renamed to graph-aligned names', () => {
  assert.equal(existsSync(new URL('../src/lib/neo4j.ts', import.meta.url)), false)
  assert.equal(existsSync(new URL('../src/mastra/tools/neo4j-tools.ts', import.meta.url)), false)
  assert.equal(existsSync(new URL('../src/mastra/tools/neo4j-helper.ts', import.meta.url)), false)
  assert.equal(existsSync(new URL('../src/lib/graph-store.ts', import.meta.url)), true)
  assert.equal(existsSync(new URL('../src/lib/graph-id.ts', import.meta.url)), true)
  assert.equal(existsSync(new URL('../src/mastra/tools/graph-tools.ts', import.meta.url)), true)
  assert.equal(existsSync(new URL('../src/mastra/tools/graph-helper.ts', import.meta.url)), true)
})

test('graph store helper uses graph-aligned exports and FalkorDB env vars', () => {
  assert.match(graphStoreSource, /export class GraphStoreService/)
  assert.match(graphStoreSource, /export const graphStoreService/)
  assert.match(graphStoreSource, /export const graphStoreClient/)
  assert.match(graphStoreSource, /FALKORDB_URI|NEXT_PUBLIC_FALKORDB_URI/)
  assert.match(graphStoreSource, /graph_id\?: string \| number/)
  assert.doesNotMatch(graphStoreSource, /process\.env\.NEO4J_/)
})

test('shared graph id helper centralizes graph-neutral runtime ID resolution', () => {
  assert.match(graphIdSource, /export function resolveGraphId/)
  assert.match(graphIdSource, /export function withGraphId/)
  assert.match(graphIdSource, /export function withRelationshipGraphIds/)
  assert.match(graphIdSource, /export function buildLegacyGraphIdFilter/)
  assert.match(graphIdSource, /export function buildLegacyRelationshipGraphFilter/)
  assert.match(graphIdSource, /export function buildGraphEntityLookupFilter/)
  assert.match(graphIdSource, /export function buildAnyGraphEntityLookupFilter/)
  assert.match(graphIdSource, /graph_id\.eq\.\$\{entityId\}/)
  assert.match(graphIdSource, /source_graph_id\.eq\.\$\{graphId\},target_graph_id\.eq\.\$\{graphId\}/)
  assert.doesNotMatch(graphIdSource, /NEO4J_/)
})

test('active UI entity consumers are graph-first in runtime contracts', () => {
  assert.match(entityCardSource, /const entityGraphId = resolveGraphId\(entity\)/)
  assert.match(entityCardSource, /resolveGraphId\(entity\)/)
  assert.match(entityCardSource, /prefetchEntity\(entityGraphId\.toString\(\)\)/)
  assert.match(leagueNavSource, /id: string/)
  assert.match(leagueNavSource, /graph_id\?: string/)
  assert.doesNotMatch(leagueNavSource, /neo4j_id\?: string/)
  assert.match(leagueNavSource, /resolveGraphId\(club\) \|\| club\.id/)
  assert.match(leagueNavSource, /const currentClubGraphId = resolveGraphId\(currentClub\)/)
  assert.match(leagueNavSimpleSource, /graph_id\?: string;/)
  assert.doesNotMatch(leagueNavSimpleSource, /neo4j_id\?: string;/)
  assert.match(leagueNavSimpleSource, /graph_id:\s*resolveGraphId\(summary\) \|\| summary\.id/)
  assert.match(entityDetailTabsSource, /graph_id\?: string \| number/)
  assert.doesNotMatch(entityDetailTabsSource, /neo4j_id\?: string \| number/)
  assert.match(graphWrapperSource, /resolveGraphId\(cachedEntity\) \|\| cachedEntity\.id/)
  assert.match(graphWrapperSource, /resolveGraphId\(cachedEntity\)/)
  assert.match(clubNavigationContextSource, /graph_id\?: string/)
  assert.match(clubNavigationContextSource, /neo4j_id\?: string/)
  assert.match(entityDossierTypesSource, /graph_id\?: string \| number/)
  assert.doesNotMatch(entityDossierTypesSource, /neo4j_id\?: string \| number/)
  assert.match(badgeTypesSource, /graph_id\?: string \| number/)
  assert.match(badgeTypesSource, /neo4j_id\?: string \| number/)
  assert.match(entityLoaderSource, /graph_id\?: string \| number/)
  assert.match(entityLoaderSource, /neo4j_id\?: string \| number/)
  assert.match(dossierEntitySource, /graph_id\?: string \| number/)
  assert.match(dossierEntitySource, /neo4j_id\?: string \| number/)
  assert.match(dossierEntitySource, /buildGraphEntityLookupFilter/)
  assert.match(dossierEntitySource, /withGraphId\(\{/)
})

test('entity detail API contracts are graph-first', () => {
  assert.match(entityDetailRouteSource, /graph_id\?: string \| number/)
  assert.doesNotMatch(entityDetailRouteSource, /neo4j_id\?: string \| number/)
})

test('entity browser page contracts are graph-first', () => {
  assert.match(entityBrowserPageSource, /graph_id\?: string \| number/)
  assert.doesNotMatch(entityBrowserPageSource, /neo4j_id\?: string \| number/)
  assert.match(entityBrowserClientPageSource, /graph_id\?: string \| number/)
  assert.doesNotMatch(entityBrowserClientPageSource, /neo4j_id\?: string \| number/)
})

test('person and enrichment contracts treat neo4j_id as compatibility-only', () => {
  assert.match(personRouteSource, /graph_id\?: string \| number/)
  assert.doesNotMatch(personRouteSource, /neo4j_id\?: string \| number/)
  assert.match(personClientPageSource, /graph_id\?: string \| number/)
  assert.doesNotMatch(personClientPageSource, /neo4j_id\?: string \| number/)
  assert.match(rfpIntelligenceEntityBrowserSource, /graph_id\?: string \| number/)
  assert.match(rfpIntelligenceEntityBrowserSource, /neo4j_id\?: string \| number/)
  assert.match(cleanClaudeAgentServiceSource, /graph_id\?: string;/)
  assert.match(cleanClaudeAgentServiceSource, /neo4j_id\?: string;/)
  assert.match(intelligentEntityEnrichmentServiceSource, /graph_id\?: string;/)
  assert.match(intelligentEntityEnrichmentServiceSource, /neo4j_id\?: string;/)
  assert.match(workingIntelligentEntityEnrichmentServiceSource, /graph_id\?: string;/)
  assert.match(workingIntelligentEntityEnrichmentServiceSource, /neo4j_id\?: string;/)
})

test('legacy entity page-local contracts treat neo4j_id as compatibility-only', () => {
  assert.match(legacyEntityClientPageSource, /graph_id\?: string \| number/)
  assert.match(legacyEntityClientPageSource, /neo4j_id\?: string \| number/)
  assert.match(entityBrowserComplexPageSource, /graph_id\?: string \| number/)
  assert.doesNotMatch(entityBrowserComplexPageSource, /neo4j_id\?: string \| number/)
  assert.match(entityBrowserSimpleTestSource, /graph_id\?: string/)
  assert.doesNotMatch(entityBrowserSimpleTestSource, /neo4j_id\?: string/)
})

test('active search and listing payloads stop emitting neo4j_id by default', () => {
  assert.doesNotMatch(entitySearchRouteSource, /neo4j_id:\s*entity\.neo4j_id/)
  assert.doesNotMatch(genericSearchRouteSource, /neo4j_id:\s*row\.neo4j_id/)
  assert.doesNotMatch(sportsEntitiesRouteSource, /neo4j_id:\s*stableId/)
  assert.doesNotMatch(conventionsRouteSource, /neo4j_id:\s*entity\.neo4j_id/)
})

test('main entity API payloads stop emitting neo4j_id by default', () => {
  assert.doesNotMatch(entitiesRouteSource, /neo4j_id:\s*entity\.neo4j_id/)
  assert.doesNotMatch(entityDetailRouteSource, /neo4j_id:\s*entity\.neo4j_id/)
})

test('compatibility and demo payloads stop emitting neo4j_id by default', () => {
  assert.doesNotMatch(personRouteSource, /neo4j_id:\s*personId/)
  assert.doesNotMatch(sunderlandDossierRouteSource, /neo4j_id:\s*sunderlandDossierData\.neo4j_id/)
  assert.doesNotMatch(batchProcessRouteSource, /neo4j_id:\s*entity\.neo4j_id/)
})

test('internal enrichment and webhook payload builders stop emitting neo4j_id by default', () => {
  assert.doesNotMatch(batchProcessRouteSource, /neo4j_id:\s*row\.neo4j_id \|\| row\.graph_id \|\| row\.id/)
  assert.doesNotMatch(enrichEntityRouteSource, /neo4j_id:\s*entity\.neo4j_id/)
  assert.doesNotMatch(enrichEntityRouteSource, /flattened\.neo4j_id\s*=/)
  assert.doesNotMatch(enhancedRfpMonitoringWebhookSource, /neo4j_id:\s*entity\.neo4j_id/)
  assert.doesNotMatch(setupConnectionMinesWebhookSource, /neo4j_id:\s*entity\.neo4j_id/)
  assert.match(enhancedRfpMonitoringWebhookSource, /graph_id:\s*resolveGraphId\(entity\)/)
  assert.match(setupConnectionMinesWebhookSource, /const stableId = resolveGraphId\(entity\) \|\| entity\.id/)
  assert.match(setupConnectionMinesWebhookSource, /graph_id:\s*stableId/)
})

test('service-level runtime mappers are graph-first and do not emit neo4j_id by default', () => {
  assert.match(continuousReasoningSource, /const entityId = resolveGraphId\(entity\)/)
  assert.doesNotMatch(continuousReasoningSource, /const entityId = entity\.neo4j_id/)

  assert.doesNotMatch(entityCacheServiceSource, /neo4j_id:\s*entity\.neo4j_id/)
  assert.match(entityCacheServiceSource, /graph_id:\s*entity\.graph_id \|\| entity\.neo4j_id/)

  assert.doesNotMatch(mcpAutonomousRfpManagerSource, /neo4j_id:\s*entity\.neo4j_id/)
  assert.match(mcpAutonomousRfpManagerSource, /graph_id:\s*resolveGraphId\(entity\) \|\| entity\.id/)
})

test('remaining service readers use graph-first IDs instead of default neo4j_id payloads', () => {
  assert.doesNotMatch(continuousReasoningSource, /const entityId = entity\.neo4j_id/)
  assert.doesNotMatch(entityCacheServiceSource, /id: entity\.neo4j_id,\s+neo4j_id: entity\.neo4j_id/s)
  assert.doesNotMatch(entityCacheServiceSource, /id: entity\.neo4j_id,\s+neo4j_id: entity\.neo4j_id,\s+labels:/s)
  assert.doesNotMatch(autonomousRfpManagerSource, /graph_id: data\.neo4j_id \|\| data\.id,\s+neo4j_id: data\.neo4j_id/s)
})

test('entity dossier route runtime payload builders stop emitting neo4j_id by default', () => {
  assert.doesNotMatch(entityDossierRouteSource, /neo4j_id:\s*entity\.neo4j_id \|\| entity\.properties\?\.neo4j_id \|\| entity\.id/)
  assert.doesNotMatch(entityDossierRouteSource, /neo4j_id:\s*entity\.neo4j_id,/)
  assert.match(entityDossierRouteSource, /graph_id:\s*graphId/)
  assert.match(entityDossierRouteSource, /graph_id:\s*resolveGraphId\(entity\)/)
})

test('remaining enrichment and mining services are graph-first instead of neo4j-first', () => {
  assert.doesNotMatch(entityDossierEnrichmentServiceSource, /const entityId = entity\.id \|\| entity\.neo4j_id/)
  assert.doesNotMatch(entityDossierEnrichmentServiceSource, /entity_id:\s*entity\.id \|\| entity\.neo4j_id/)
  assert.match(keywordMinesServiceSource, /select\('id, graph_id, neo4j_id, name, labels, properties'\)/)
  assert.doesNotMatch(rfpStorageServiceSource, /neo4j_id:\s*null,/)
  assert.match(rfpStorageServiceSource, /graph_id:\s*null,/)
})

test('remaining active UI keys, prefetch calls, and mock sample payloads are graph-first', () => {
  assert.doesNotMatch(entityBrowserComplexPageSource, /prefetchEntity\(entity\.neo4j_id\.toString\(\)\)/)
  assert.doesNotMatch(entityBrowserComplexPageSource, /key=\{`\$\{entity\.id\}-\$\{entity\.neo4j_id\}`\}/)
  assert.doesNotMatch(entityBrowserClientPageSource, /formatValue\(entity\.neo4j_id\)/)
  assert.doesNotMatch(entityBrowserPageSource, /formatValue\(entity\.neo4j_id\)/)
  assert.doesNotMatch(rfpIntelligenceEntityBrowserSource, /key=\{`\$\{entity\.id\}-\$\{entity\.neo4j_id\}`\}/)
  assert.doesNotMatch(graphPageSource, /neo4j_id: cachedEntity\.neo4j_id/)
  assert.doesNotMatch(graphPageSource, /let entity_id = cachedEntity\.neo4j_id \|\| cachedEntity\.id/)
  assert.doesNotMatch(graphPageSource, /cachedEntity\.graph_id \|\| cachedEntity\.neo4j_id \|\| cachedEntity\.id/)
  assert.doesNotMatch(graphPageSource, /graph_id:\s*cachedEntity\.graph_id \|\| cachedEntity\.neo4j_id/)
  assert.doesNotMatch(intelligentEntityEnrichmentServiceSource, /neo4j_id:\s*'1'|neo4j_id:\s*'2'|neo4j_id:\s*'3'/)
  assert.doesNotMatch(workingIntelligentEntityEnrichmentServiceSource, /neo4j_id:\s*'1'|neo4j_id:\s*'2'|neo4j_id:\s*'3'/)
  assert.match(workingIntelligentEntityEnrichmentServiceSource, /graph_id:\s*'1'/)
})

test('remaining summary and service payload residue is graph-first', () => {
  assert.doesNotMatch(cleanClaudeAgentServiceSource, /neo4j_id:\s*'1'|neo4j_id:\s*'2'|neo4j_id:\s*'3'/)
  assert.doesNotMatch(predictiveReasoningEngineSource, /neo4j_id:\s*entity\.neo4j_id/)
  assert.match(predictiveReasoningEngineSource, /graph_id:\s*entity\.graph_id \|\| entity\.id/)
  assert.doesNotMatch(realtimeSyncSource, /resolveGraphId\(entity\) \|\| entity\.neo4j_id/)
  assert.doesNotMatch(realtimeSyncSource, /neo4j_id:\s*String\(row\.graph_id\)/)
  assert.match(entitiesSummaryRouteSource, /select\(`[\s\S]*graph_id,[\s\S]*neo4j_id,/)
  assert.match(entitiesSummaryRouteSource, /graph_id:\s*resolveGraphId\(entity\) \|\| entity\.id/)
})

test('remaining manager and UI identity paths use resolveGraphId or graph-first ids', () => {
  assert.match(mcpAutonomousRfpManagerSource, /const graphKey = resolveGraphId\(entity\) \|\| entityId;/)
  assert.match(autonomousRfpManagerSource, /const graphKey = resolveGraphId\(entity\) \|\| entityId;/)
  assert.doesNotMatch(leagueNavSource, /currentClubNeo4jId|hasCurrentClubNeo4jId|neo4jIdMatch|entity_neo4j_id/)
  assert.match(legacyEntityClientPageSource, /id: entity\.graph_id \|\| entity\.id/)
})

test('Claude agent runtime config uses graph store credentials instead of Neo4j fields', () => {
  const sources = [
    claudeAgentActionsSource,
    claudeAgentSchedulerSource,
    headlessClaudeAgentServiceSource,
    testClaudeAgentRouteSource,
    claudeAgentRouteSource,
    claudeAgentsSlashRouteSource,
  ]

  for (const source of sources) {
    assert.match(source, /graphUri|graphUsername|graphPassword/)
    assert.doesNotMatch(source, /neo4jUri|neo4jUsername|neo4jPassword/)
  }
})

test('graph-enrichment and RFP analysis routes advertise graph-mcp and FalkorDB env vars', () => {
  const sources = [
    knowledgeGraphEnrichRouteSource,
    rfpIntelligenceAnalyzeRouteSource,
    linkedinRfpClaudeWebhookSource,
    mcpAutonomousTestRouteSource,
    mcpAutonomousStreamRouteSource,
    mcpAutonomousValidateRouteSource,
  ]

  for (const source of sources) {
    assert.match(source, /graph-mcp|mcp__graph-mcp__/)
    assert.doesNotMatch(source, /neo4j-mcp|mcp__neo4j-mcp__/)
  }
})

test('final RFP verification route now uses graph-mcp and FalkorDB env vars', () => {
  assert.match(testFinalRfpVerificationRouteSource, /graph-mcp|mcp__graph-mcp__/)
  assert.match(testFinalRfpVerificationRouteSource, /FALKORDB_URI|FALKORDB_USER|FALKORDB_PASSWORD/)
  assert.doesNotMatch(testFinalRfpVerificationRouteSource, /neo4j-mcp|mcp__neo4j-mcp__|NEO4J_/)
})

test('stale backup and route-old artifacts have been removed from src', () => {
  const staleArtifacts = [
    new URL('../src/app/api/claude-agent-demo/stream/route-old.ts', import.meta.url),
    new URL('../src/app/api/tenders/route.ts.bak', import.meta.url),
    new URL('../src/app/api/webhook/linkedin-procurement/route.ts.backup', import.meta.url),
    new URL('../src/app/tenders/page.tsx.bak', import.meta.url),
    new URL('../src/components/badge/EntityBadge.tsx.backup', import.meta.url),
    new URL('../src/components/graph/GraphVisualizationClient.tsx.backup', import.meta.url),
  ]

  for (const artifact of staleArtifacts) {
    assert.equal(existsSync(artifact), false)
  }
})

test('legacy Neo4j archive exists and historical top-level scripts were moved out of the active root', () => {
  const archiveReadme = new URL('../legacy/neo4j/README.md', import.meta.url)
  const archivedFiles = [
    new URL('../legacy/neo4j/root/neo4j-migration.js', import.meta.url),
    new URL('../legacy/neo4j/root/neo4j-mcp-server.js', import.meta.url),
    new URL('../legacy/neo4j/root/restore-neo4j-from-supabase.sh', import.meta.url),
    new URL('../legacy/neo4j/root/explore-neo4j-basic.js', import.meta.url),
    new URL('../legacy/neo4j/scripts/live-rfp-capture-neo4j.js', import.meta.url),
  ]

  assert.equal(existsSync(archiveReadme), true)
  for (const artifact of archivedFiles) {
    assert.equal(existsSync(artifact), true)
  }

  assert.equal(existsSync(new URL('../neo4j-migration.js', import.meta.url)), false)
  assert.equal(existsSync(new URL('../neo4j-mcp-server.js', import.meta.url)), false)
  assert.equal(existsSync(new URL('../restore-neo4j-from-supabase.sh', import.meta.url)), false)
  assert.equal(existsSync(new URL('../explore-neo4j-basic.js', import.meta.url)), false)
  assert.equal(existsSync(new URL('../scripts/live-rfp-capture-neo4j.js', import.meta.url)), false)
})

test('legacy Neo4j docs and src-backend artifacts are archived out of active paths', () => {
  const archivedArtifacts = [
    new URL('../legacy/neo4j/docs/DUAL-STORAGE-STRUCTURE.md', import.meta.url),
    new URL('../legacy/neo4j/docs/SETUP_SUMMARY.md', import.meta.url),
    new URL('../legacy/neo4j/src-backend/deploy.sh', import.meta.url),
    new URL('../legacy/neo4j/src-backend/enhanced_rfp_intelligence_backend.py', import.meta.url),
  ]

  for (const artifact of archivedArtifacts) {
    assert.equal(existsSync(artifact), true)
  }

  assert.equal(existsSync(new URL('../docs/DUAL-STORAGE-STRUCTURE.md', import.meta.url)), false)
  assert.equal(existsSync(new URL('../docs/SETUP_SUMMARY.md', import.meta.url)), false)
  assert.equal(existsSync(new URL('../src/backend/deploy.sh', import.meta.url)), false)
  assert.equal(existsSync(new URL('../src/backend/enhanced_rfp_intelligence_backend.py', import.meta.url)), false)
})

test('active docs README describes FalkorDB and Supabase as the current architecture', () => {
  assert.match(docsReadmeSource, /FalkorDB \+ Supabase/)
  assert.match(docsReadmeSource, /legacy\/neo4j/)
  assert.doesNotMatch(docsReadmeSource, /Neo4j MCP integration|NEO4J_URI|NEO4J_USER|NEO4J_PASSWORD/)
})

test('legacy archive README documents backend, docs, and reports boundaries', () => {
  assert.match(legacyNeo4jReadmeSource, /legacy\/neo4j\/backend/)
  assert.match(legacyNeo4jReadmeSource, /legacy\/neo4j\/docs/)
  assert.match(legacyNeo4jReadmeSource, /legacy\/neo4j\/reports/)
})

test('historical backend Neo4j utilities were moved out of active backend paths', () => {
  const archivedArtifacts = [
    new URL('../legacy/neo4j/backend/neo4j_client.py', import.meta.url),
    new URL('../legacy/neo4j/backend/enrich_poi_brightdata.py', import.meta.url),
    new URL('../legacy/neo4j/backend/enrich_golf_premium_yellow_panther.py', import.meta.url),
    new URL('../legacy/neo4j/backend/seed_sports_entities.py', import.meta.url),
    new URL('../legacy/neo4j/backend/test_db_connection.py', import.meta.url),
  ]

  for (const artifact of archivedArtifacts) {
    assert.equal(existsSync(artifact), true)
  }

  assert.equal(existsSync(new URL('../backend/neo4j_client.py', import.meta.url)), false)
  assert.equal(existsSync(new URL('../backend/enrich_poi_brightdata.py', import.meta.url)), false)
  assert.equal(existsSync(new URL('../backend/enrich_golf_premium_yellow_panther.py', import.meta.url)), false)
  assert.equal(existsSync(new URL('../backend/seed_sports_entities.py', import.meta.url)), false)
  assert.equal(existsSync(new URL('../backend/test_db_connection.py', import.meta.url)), false)
})

test('historical deployment and report artifacts were moved into the Neo4j archive', () => {
  const archivedArtifacts = [
    new URL('../legacy/neo4j/docs/DEPLOYMENT-GUIDE.md', import.meta.url),
    new URL('../legacy/neo4j/docs/OPTIMIZED-RFP-SYSTEM-SUMMARY.md', import.meta.url),
    new URL('../legacy/neo4j/docs/RFP-INTELLIGENCE-DEPLOYMENT.md', import.meta.url),
    new URL('../legacy/neo4j/reports/RFP_MONITORING_REPORT_2025-10-28.json', import.meta.url),
    new URL('../legacy/neo4j/reports/missing-entity-analysis-1760941553483.json', import.meta.url),
  ]

  for (const artifact of archivedArtifacts) {
    assert.equal(existsSync(artifact), true)
  }

  assert.equal(existsSync(new URL('../DEPLOYMENT-GUIDE.md', import.meta.url)), false)
  assert.equal(existsSync(new URL('../OPTIMIZED-RFP-SYSTEM-SUMMARY.md', import.meta.url)), false)
  assert.equal(existsSync(new URL('../RFP-INTELLIGENCE-DEPLOYMENT.md', import.meta.url)), false)
  assert.equal(existsSync(new URL('../RFP_MONITORING_REPORT_2025-10-28.json', import.meta.url)), false)
  assert.equal(existsSync(new URL('../missing-entity-analysis-1760941553483.json', import.meta.url)), false)
})

test('active deployment helpers point historical Neo4j guidance at the archive', () => {
  assert.doesNotMatch(productionDeployReadmeSource, /\[DEPLOYMENT-GUIDE\.md\]\(DEPLOYMENT-GUIDE\.md\)/)
  assert.match(productionDeployReadmeSource, /legacy\/neo4j\/docs\/DEPLOYMENT-GUIDE\.md/)
  assert.doesNotMatch(testSshConnectionScriptSource, /Full deployment guide: DEPLOYMENT-GUIDE\.md/)
  assert.match(testSshConnectionScriptSource, /Historical deployment guide: legacy\/neo4j\/docs\/DEPLOYMENT-GUIDE\.md/)
})

test('active MCP action and temporal tool descriptions use legacy graph ID wording instead of neo4j_id wording', () => {
  assert.match(mcpActionsSource, /legacy graph ID to inspect/)
  assert.doesNotMatch(mcpActionsSource, /Entity id or neo4j_id to inspect/)

  assert.match(temporalIntelligenceToolsSource, /Entity identifier \(name or legacy graph ID\)/)
  assert.doesNotMatch(temporalIntelligenceToolsSource, /Entity identifier \(name or neo4j_id\)/)
})

test('active webhook and storage route comments no longer describe Neo4j persistence', () => {
  assert.match(linkedinConnectionAnalysisWebhookSource, /graph-backed cache for future reference/)
  assert.doesNotMatch(linkedinConnectionAnalysisWebhookSource, /Store in Neo4j for future reference/)

  assert.match(networkMonitoringWebhookSource, /graph-backed cache/)
  assert.doesNotMatch(networkMonitoringWebhookSource, /Store analysis in Neo4j/)

  assert.match(rfpStorageRouteSource, /canonical graph-backed store/)
  assert.doesNotMatch(rfpStorageRouteSource, /Store RFPs in Neo4j/)
})

test('historical batch processor advertises Graph MCP instead of Neo4j in its feature list', () => {
  assert.match(historicalBatchProcessorRouteSource, /MCP tools: Graph MCP, BrightData, Perplexity, Better Auth/)
  assert.doesNotMatch(historicalBatchProcessorRouteSource, /MCP tools: Neo4j, BrightData, Perplexity, Better Auth/)
})

test('enhanced historical batch processor uses graph-mcp naming for analysis persistence', () => {
  assert.match(enhancedHistoricalBatchProcessorSource, /storeAnalysesInGraph|mcp__graph-mcp__execute_query|graph intelligence store/)
  assert.doesNotMatch(enhancedHistoricalBatchProcessorSource, /storeAnalysesInNeo4j|mcp__neo4j-mcp__execute_query|Update the Neo4j knowledge graph|Failed to store analyses in Neo4j/)
})

test('high-visibility assistant UI copy no longer advertises Neo4j directly', () => {
  assert.match(claudeCopilotSidebarSource, /graph-backed sports intelligence store containing 3,325\+ sports entities/)
  assert.doesNotMatch(claudeCopilotSidebarSource, /access to Neo4j database containing 3,325\+ sports entities/)

  assert.match(streamingChatSidebarSource, /Graph Intelligence Store: 3,325\+ sports entities/)
  assert.doesNotMatch(streamingChatSidebarSource, /Neo4j Database: 3,325\+ sports entities/)

  assert.match(claudeChatCopilotKitSource, /Graph MCP, BrightData, Perplexity MCP servers|Graph MCP, BrightData & Perplexity tools|graph intelligence store say about Arsenal|Graph Intelligence Store/)
  assert.doesNotMatch(claudeChatCopilotKitSource, /⚡ \*\*Tools\*\*: Neo4j, BrightData, Perplexity MCP servers|with Neo4j, BrightData & Perplexity tools|knowledge graph say about Arsenal|<strong>Knowledge Graph<\/strong>/)

  assert.match(vectorSearchSource, /graph intelligence store|Searching Graph Intelligence Store|Welcome to Graph Intelligence Search/)
  assert.doesNotMatch(vectorSearchSource, /Neo4j knowledge graph|Searching Knowledge Graph|Welcome to Knowledge Graph Search/)
})

test('dashboard and system status UI surfaces use graph store wording instead of Neo4j labels', () => {
  assert.match(claudeAgentDashboardSource, /graphConfigured/)
  assert.doesNotMatch(claudeAgentDashboardSource, /neo4jConfigured/)
  assert.match(claudeAgentDashboardSource, /Missing: .*Graph Store|text-xs">Graph Store</)
  assert.doesNotMatch(claudeAgentDashboardSource, /Missing: .*Neo4j|text-xs">Neo4j</)

  assert.match(tabbedChatSidebarSource, /Graph Intelligence Store/)
  assert.doesNotMatch(tabbedChatSidebarSource, /Neo4j Database/)

  assert.match(systemStatusPanelSource, /Graph Store/)
  assert.doesNotMatch(systemStatusPanelSource, /Neo4j Database/)

  assert.match(featureCardsSource, /graph-backed intelligence integration/)
  assert.doesNotMatch(featureCardsSource, /Neo4j knowledge graph integration/)
})

test('remaining visible assistant copy uses graph store wording instead of Neo4j', () => {
  assert.match(claudeChatSource, /query graph relationships/)
  assert.doesNotMatch(claudeChatSource, /execute Neo4j queries/)

  assert.match(thinkingDisplaySource, /graph intelligence store via MCP|tool: 'Graph Store'|Graph intelligence tools are available/)
  assert.doesNotMatch(thinkingDisplaySource, /Neo4j graph database via MCP|tool: 'Neo4j Database'|Neo4j database tools are available/)

  assert.match(systemSummarySource, /FalkorDB Graph Store \(2,997 sports entities\)/)
  assert.doesNotMatch(systemSummarySource, /Neo4j Knowledge Graph \(2,997 sports entities\)/)
})

test('active automation scripts use graph-mcp naming instead of neo4j-mcp', () => {
  const sources = [claudeCodeRfpAutomationSource, claudeCodeRfpAutomationFixedSource]

  for (const source of sources) {
    assert.match(source, /graph-mcp/)
    assert.doesNotMatch(source, /neo4j-mcp|Query Neo4j|use the neo4j-mcp tool/i)
  }
})

test('active MCP config and env example advertise FalkorDB graph configuration', () => {
  assert.match(mcpConfigPerplexityRfpSource, /"graph-mcp"/)
  assert.match(mcpConfigPerplexityRfpSource, /FALKORDB_URI|FALKORDB_USER|FALKORDB_PASSWORD/)
  assert.doesNotMatch(mcpConfigPerplexityRfpSource, /"neo4j-mcp"|NEO4J_URI|NEO4J_USERNAME|NEO4J_PASSWORD/)

  assert.match(envLocalExampleSource, /FALKORDB_URI|FALKORDB_USER|FALKORDB_PASSWORD/)
  assert.doesNotMatch(envLocalExampleSource, /NEO4J_URI|NEO4J_USERNAME|NEO4J_PASSWORD/)
})

test('active MCP sync script uses graph terminology and the direct Neo4j sync script is archived', () => {
  assert.match(automatedDatabaseSyncMcpSource, /Graph store|health\.graph|graphCount/)
  assert.doesNotMatch(automatedDatabaseSyncMcpSource, /Neo4j:|health\.neo4j|neo4jCount|Get Neo4j count/)
  assert.equal(existsSync(new URL('../automated-database-sync.js', import.meta.url)), false)
  assert.equal(existsSync(new URL('../legacy/neo4j/root/automated-database-sync.js', import.meta.url)), true)
})

test('root MCP config uses graph-mcp and env placeholders instead of embedded Neo4j credentials', () => {
  assert.match(rootMcpConfigSource, /"graph-mcp"/)
  assert.match(rootMcpConfigSource, /FALKORDB_URI|FALKORDB_USER|FALKORDB_PASSWORD/)
  assert.doesNotMatch(rootMcpConfigSource, /"neo4j-mcp"|NEO4J_URI|NEO4J_USERNAME|NEO4J_PASSWORD/)
  assert.doesNotMatch(rootMcpConfigSource, /neo4j\+s:\/\/|NeO4jPaSSworD!|bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4/)
})

test('production env template is sanitized and FalkorDB-aligned', () => {
  assert.match(envProductionSource, /FALKORDB_URI|FALKORDB_USER|FALKORDB_PASSWORD/)
  assert.match(envProductionSource, /replace-with-production-secret|replace-with-anthropic-api-key/)
  assert.doesNotMatch(envProductionSource, /NEO4J_URI|NEO4J_USERNAME|NEO4J_PASSWORD/)
  assert.doesNotMatch(envProductionSource, /cce1f84b\.databases\.neo4j\.io|llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0|pplx-|ck_pub_|sk-ant-api03-|eyJhbGciOiJIUzI1Ni/)
})

test('graph id dual-write migration adds additive graph columns and backfills them', () => {
  assert.match(graphIdDualWriteMigrationSource, /alter table if exists cached_entities[\s\S]*add column if not exists graph_id text/i)
  assert.match(graphIdDualWriteMigrationSource, /alter table if exists entity_relationships[\s\S]*source_graph_id text[\s\S]*target_graph_id text/i)
  assert.match(graphIdDualWriteMigrationSource, /alter table if exists entity_sync_tracker[\s\S]*add column if not exists graph_id text/i)
  assert.match(graphIdDualWriteMigrationSource, /update cached_entities[\s\S]*coalesce\(graph_id, neo4j_id::text\)/i)
  assert.match(graphIdDualWriteMigrationSource, /update entity_relationships[\s\S]*source_graph_id = coalesce\(source_graph_id, source_neo4j_id::text\)/i)
  assert.match(graphIdDualWriteMigrationSource, /update entity_sync_tracker[\s\S]*coalesce\(graph_id, neo4j_id::text\)/i)
})

test('relationship element id migration repoints conflict keys at graph-backed ids', () => {
  assert.match(graphRelationshipElementMigrationSource, /update entity_relationships/i)
  assert.match(graphRelationshipElementMigrationSource, /source_element_id = coalesce\(source_graph_id, source_neo4j_id::text, source_element_id\)/i)
  assert.match(graphRelationshipElementMigrationSource, /target_element_id = coalesce\(target_graph_id, target_neo4j_id::text, target_element_id\)/i)
})
