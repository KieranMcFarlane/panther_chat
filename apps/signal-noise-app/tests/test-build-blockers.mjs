import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const badgeManagementPageSource = readFileSync(
  new URL('../src/app/badge-management/page.tsx', import.meta.url),
  'utf8'
)
const emailTemplateSource = readFileSync(
  new URL('../src/components/mailbox/EmailTemplate.tsx', import.meta.url),
  'utf8'
)
const historyNavSource = readFileSync(
  new URL('../src/components/header/HistoryNav.tsx', import.meta.url),
  'utf8'
)
const entityBrowserPageSource = readFileSync(
  new URL('../src/app/entity-browser/page.tsx', import.meta.url),
  'utf8'
)
const entitiesSummaryRouteSource = readFileSync(
  new URL('../src/app/api/entities/summary/route.ts', import.meta.url),
  'utf8'
)
const homeMetricsRouteSource = readFileSync(
  new URL('../src/app/api/home/metrics/route.ts', import.meta.url),
  'utf8'
)
const logsMetricsRouteSource = readFileSync(
  new URL('../src/app/api/logs/metrics/route.ts', import.meta.url),
  'utf8'
)
const mailboxListRouteSource = readFileSync(
  new URL('../src/app/api/mailbox/list/route.ts', import.meta.url),
  'utf8'
)
const temporalPatternsRouteSource = readFileSync(
  new URL('../src/app/api/temporal/patterns/route.ts', import.meta.url),
  'utf8'
)
const automationResultsLatestRouteSource = readFileSync(
  new URL('../src/app/api/automation-results/latest/route.ts', import.meta.url),
  'utf8'
)
const evidenceImpactRouteSource = readFileSync(
  new URL('../src/app/api/ralph/analytics/evidence-impact/route.ts', import.meta.url),
  'utf8'
)
const testLogsRouteSource = readFileSync(
  new URL('../src/app/api/test-logs/route.ts', import.meta.url),
  'utf8'
)
const badgeManagerSource = readFileSync(
  new URL('../src/services/badge-manager.ts', import.meta.url),
  'utf8'
)
const activityLoggerSource = readFileSync(
  new URL('../src/lib/activity-logger.ts', import.meta.url),
  'utf8'
)
const ralphAnalyticsHelperSource = readFileSync(
  new URL('../src/lib/ralph-analytics-helper.ts', import.meta.url),
  'utf8'
)
const directMcpClientSource = readFileSync(
  new URL('../src/lib/direct-mcp-client.ts', import.meta.url),
  'utf8'
)
const neo4jSource = readFileSync(
  new URL('../src/lib/neo4j.ts', import.meta.url),
  'utf8'
)
const graphPageSource = readFileSync(
  new URL('../src/app/graph/page.tsx', import.meta.url),
  'utf8'
)
const realHeadlessVerifierSource = readFileSync(
  new URL('../src/lib/real-headless-verifier.ts', import.meta.url),
  'utf8'
)
const sportsRfpMonitorSource = readFileSync(
  new URL('../src/lib/sports-rfp-monitor.ts', import.meta.url),
  'utf8'
)
const claudeAgentRouteSource = readFileSync(
  new URL('../src/app/api/claude-agent/route.ts', import.meta.url),
  'utf8'
)
const entityDossierRouteSource = readFileSync(
  new URL('../src/app/api/entities/[entityId]/dossier/route.ts', import.meta.url),
  'utf8'
)
const tendersPageSource = readFileSync(
  new URL('../src/app/tenders/page.tsx', import.meta.url),
  'utf8'
)
const claudeGlm4vSource = readFileSync(
  new URL('../src/lib/claude-glm4v-integration.ts', import.meta.url),
  'utf8'
)
const rfpIntelligenceSource = readFileSync(
  new URL('../src/lib/claude-agent-rfp-intelligence.ts', import.meta.url),
  'utf8'
)
const enhancedHistoricalBatchProcessorSource = readFileSync(
  new URL('../src/lib/enhanced-historical-batch-processor.ts', import.meta.url),
  'utf8'
)
const entityScalingManagerSource = readFileSync(
  new URL('../src/lib/entity-scaling-manager.ts', import.meta.url),
  'utf8'
)
const intelligentEntityEnrichmentServiceSource = readFileSync(
  new URL('../src/services/IntelligentEntityEnrichmentService.ts', import.meta.url),
  'utf8'
)
const cleanClaudeAgentServiceSource = readFileSync(
  new URL('../src/services/CleanClaudeAgentService.ts', import.meta.url),
  'utf8'
)
const intelligentEnrichmentSchedulerSource = readFileSync(
  new URL('../src/services/IntelligentEnrichmentScheduler.ts', import.meta.url),
  'utf8'
)

test('badge management imports EntityBadgeGrid from the badge barrel export', () => {
  assert.match(
    badgeManagementPageSource,
    /import \{ EntityBadgeGrid \} from ["']@\/components\/badge["']/
  )
  assert.doesNotMatch(
    badgeManagementPageSource,
    /import \{ EntityBadgeGrid \} from ["']@\/components\/badge\/EntityBadge["']/
  )
})

test('mailbox email template aliases Html to avoid Next document collisions', () => {
  assert.match(emailTemplateSource, /Html as EmailHtml/)
  assert.match(emailTemplateSource, /<EmailHtml>/)
  assert.match(emailTemplateSource, /<\/EmailHtml>/)
  assert.doesNotMatch(emailTemplateSource, /return \(\s*<Html>/)
})

test('history nav does not depend on useSearchParams for prerender-safe headers', () => {
  assert.doesNotMatch(historyNavSource, /useSearchParams/)
})

test('entity browser page no longer calls useSearchParams directly in the page module', () => {
  assert.doesNotMatch(entityBrowserPageSource, /useSearchParams/)
})

test('badge manager is safe to import during server prerender', () => {
  assert.match(badgeManagerSource, /private isBrowserStorageAvailable\(\)/)
  assert.match(badgeManagerSource, /typeof window !== 'undefined'/)
  assert.match(badgeManagerSource, /initializeDefaultMappings\(false\)/)
})

test('activity logger guards localStorage access outside the browser', () => {
  assert.match(activityLoggerSource, /private isBrowserStorageAvailable\(\): boolean/)
  assert.match(activityLoggerSource, /if \(!this\.isBrowserStorageAvailable\(\)\) \{\s*return;/)
})

test('ralph analytics helper treats a missing runtime bindings directory as empty analytics input', () => {
  assert.match(ralphAnalyticsHelperSource, /fs\.access\(bindingsDir, fsConstants\.F_OK\)/)
  assert.match(ralphAnalyticsHelperSource, /if \(\(error as NodeJS\.ErrnoException\)\.code === 'ENOENT'\) \{\s*return \[\];/)
})

test('direct MCP client does not auto-connect on module import', () => {
  assert.match(directMcpClientSource, /export const directMCPClient = new DirectMCPClient\(\);/)
  assert.doesNotMatch(directMcpClientSource, /directMCPClient\.connect\(\)\.catch\(console\.error\);/)
})

test('neo4j service creates the driver lazily instead of at module import time', () => {
  assert.match(neo4jSource, /private driver: any \| null = null/)
  assert.match(neo4jSource, /if \(!this\.driver\) \{/)
  assert.match(neo4jSource, /this\.driver = neo4j\.driver\(/)
  assert.match(neo4jSource, /export const neo4jClient = new Proxy/)
  assert.match(neo4jSource, /function isBuildPhase\(\): boolean/)
  assert.match(neo4jSource, /Skipping Neo4j initialization during build:/)
})

test('Claude GLM-4.5V integration defers MCP initialization until runtime use', () => {
  assert.doesNotMatch(claudeGlm4vSource, /constructor\(\)\s*\{\s*this\.initializeMCP\(\);/s)
})

test('RFP intelligence agent does not fetch MCP config during module construction', () => {
  assert.doesNotMatch(rfpIntelligenceSource, /constructor\(\)\s*\{[\s\S]*this\.loadMCPConfig\(\);[\s\S]*\}/)
})

test('historical batch processor does not initialize Claude or MCP config during module construction', () => {
  assert.doesNotMatch(enhancedHistoricalBatchProcessorSource, /constructor\(\)\s*\{[\s\S]*this\.initializeClaudeAgent\(\);[\s\S]*\}/)
  assert.doesNotMatch(enhancedHistoricalBatchProcessorSource, /constructor\(\)\s*\{[\s\S]*this\.loadMCPConfig\(\);[\s\S]*\}/)
})

test('entity scaling manager does not start large background initialization during module construction', () => {
  assert.doesNotMatch(entityScalingManagerSource, /constructor\(config\?: Partial<ScalingConfig>\)\s*\{[^}]*this\.initialize\(\);/)
})

test('Claude enrichment services defer initialization until runtime use', () => {
  assert.doesNotMatch(intelligentEntityEnrichmentServiceSource, /constructor\(\)\s*\{\s*this\.initializeClaudeAgent\(\);/s)
  assert.doesNotMatch(cleanClaudeAgentServiceSource, /constructor\(\)\s*\{\s*this\.initializeClaudeAgent\(\);/s)
  assert.doesNotMatch(intelligentEnrichmentSchedulerSource, /constructor\(\)\s*\{\s*this\.initializeDefaultSchedules\(\);/s)
  assert.match(intelligentEntityEnrichmentServiceSource, /ensureClaudeAgentInitialized/)
  assert.match(cleanClaudeAgentServiceSource, /ensureClaudeAgentInitialized/)
  assert.match(intelligentEnrichmentSchedulerSource, /ensureInitialized\(\)/)
})

test('build-noisy diagnostic routes are explicitly dynamic', () => {
  assert.match(automationResultsLatestRouteSource, /export const dynamic = ['"]force-dynamic['"]/)
  assert.match(evidenceImpactRouteSource, /export const dynamic = ['"]force-dynamic['"]/)
  assert.match(testLogsRouteSource, /export const dynamic = ['"]force-dynamic['"]/)
})

test('graph page avoids build-noisy server logs in the page module', () => {
  assert.match(graphPageSource, /export const dynamic = ['"]force-dynamic['"]/)
  assert.doesNotMatch(graphPageSource, /SERVER COMPONENT: Rendering with data/)
  assert.doesNotMatch(graphPageSource, /SERVER SIDE: Fetching graph data/)
})

test('headless verifier and sports RFP monitor do not auto-initialize on module import', () => {
  assert.doesNotMatch(realHeadlessVerifierSource, /realHeadlessVerifier\.initialize\(\)\.catch\(console\.error\);/)
  assert.match(realHeadlessVerifierSource, /ensureInitialized\(\)/)
  assert.doesNotMatch(sportsRfpMonitorSource, /constructor\(\)\s*\{[^}]*initializeWithSportsData\(\);/)
  assert.match(sportsRfpMonitorSource, /ensureInitialized\(\)/)
})

test('Claude agent route does not auto-start cron during build', () => {
  assert.match(claudeAgentRouteSource, /function isBuildPhase\(\)/)
  assert.match(claudeAgentRouteSource, /if \(!isBuildPhase\(\)\)/)
})

test('debug-heavy routes and pages no longer log noisy build diagnostics', () => {
  assert.doesNotMatch(entityDossierRouteSource, /Supabase URL:/)
  assert.doesNotMatch(entityDossierRouteSource, /Supabase Service Role Key:/)
  assert.doesNotMatch(tendersPageSource, /console\.log\(.*Filter results:/)
  assert.doesNotMatch(tendersPageSource, /console\.log\(.*opportunities\.length =/)
})

for (const [label, source] of [
  ['entities summary', entitiesSummaryRouteSource],
  ['home metrics', homeMetricsRouteSource],
  ['logs metrics', logsMetricsRouteSource],
  ['mailbox list', mailboxListRouteSource],
  ['temporal patterns', temporalPatternsRouteSource],
]) {
  test(`${label} API route is marked force-dynamic`, () => {
    assert.match(source, /export const dynamic = ['"]force-dynamic['"]/)
  })
}
