import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const cronRoutePath = new URL('../src/app/api/cron/graphiti/opportunities/materialize/route.ts', import.meta.url)
const statusRoutePath = new URL('../src/app/api/admin/graphiti/opportunities/status/route.ts', import.meta.url)
const resiliencePath = new URL('../src/lib/graphiti-opportunity-pipeline-resilience.ts', import.meta.url)

test('graphiti opportunity cron treats graphiti mcp and strategy synthesis as degraded optional steps', () => {
  assert.equal(existsSync(cronRoutePath), true)
  assert.equal(existsSync(resiliencePath), true)

  const routeSource = readFileSync(cronRoutePath, 'utf8')
  const resilienceSource = readFileSync(resiliencePath, 'utf8')

  assert.match(routeSource, /runGraphitiOpportunityPipelineStep/)
  assert.match(routeSource, /summarizeGraphitiOpportunityPipeline/)
  assert.match(routeSource, /pipeline_status/)
  assert.match(routeSource, /pipeline_steps/)
  assert.match(routeSource, /degraded/)

  assert.match(routeSource, /name:\s*'dossier_ingestion'[\s\S]*critical:\s*true/)
  assert.match(routeSource, /name:\s*'opportunity_materialization'[\s\S]*critical:\s*true/)
  assert.match(routeSource, /name:\s*'graphiti_memory_sync'[\s\S]*critical:\s*false/)
  assert.match(routeSource, /name:\s*'strategy_synthesis'[\s\S]*critical:\s*false/)

  assert.match(resilienceSource, /GRAPHITI_OPPORTUNITY_PIPELINE_RETRY_ATTEMPTS/)
  assert.match(resilienceSource, /GRAPHITI_OPPORTUNITY_PIPELINE_STEP_TIMEOUT_MS/)
  assert.match(resilienceSource, /Promise\.race/)
  assert.match(resilienceSource, /failedNonCriticalSteps/)
  assert.match(resilienceSource, /failedNonCriticalSteps\.length[\s\S]*\?\s*'degraded'/)
})

test('graphiti opportunity cron keeps backward-compatible response fields while reporting degraded health', () => {
  const routeSource = readFileSync(cronRoutePath, 'utf8')

  assert.match(routeSource, /dossier_ingestion/)
  assert.match(routeSource, /graphiti_memory_sync/)
  assert.match(routeSource, /stats/)
  assert.match(routeSource, /strategy_synthesis/)
  assert.match(routeSource, /warnings/)
  assert.match(routeSource, /last_updated_at/)
  assert.match(routeSource, /summary\.ok\s*\?\s*200\s*:\s*500/)
})

test('graphiti opportunity admin status exposes the antifragile continuation policy', () => {
  const statusSource = readFileSync(statusRoutePath, 'utf8')
  const resilienceSource = readFileSync(resiliencePath, 'utf8')

  assert.match(statusSource, /opportunity_pipeline_health/)
  assert.match(statusSource, /buildGraphitiOpportunityPipelineHealth\(result\.warnings\)/)
  assert.match(resilienceSource, /continuation_policy/)
  assert.match(resilienceSource, /critical_steps/)
  assert.match(resilienceSource, /non_critical_steps/)
  assert.match(resilienceSource, /retryable_steps/)
  assert.match(resilienceSource, /graphiti_memory_sync/)
  assert.match(resilienceSource, /strategy_synthesis/)
})
