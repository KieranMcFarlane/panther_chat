import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const backfillRoutePath = new URL('../src/app/api/admin/graphiti/opportunities/backfill/route.ts', import.meta.url)
const memorySyncRoutePath = new URL('../src/app/api/admin/graphiti/dossier-memory/sync/route.ts', import.meta.url)
const strategySyncRoutePath = new URL('../src/app/api/admin/graphiti/opportunities/strategy/sync/route.ts', import.meta.url)
const cronOpportunityRoutePath = new URL('../src/app/api/cron/graphiti/opportunities/materialize/route.ts', import.meta.url)
const statusRoutePath = new URL('../src/app/api/admin/graphiti/opportunities/status/route.ts', import.meta.url)

test('graphiti opportunities admin routes exist and wire to the materialization stack', () => {
  assert.equal(existsSync(backfillRoutePath), true)
  assert.equal(existsSync(statusRoutePath), true)

  const backfillSource = readFileSync(backfillRoutePath, 'utf8')
  const statusSource = readFileSync(statusRoutePath, 'utf8')

  assert.match(backfillSource, /requireApiSession/)
  assert.match(backfillSource, /loadGraphitiOpportunitySourceRows/)
  assert.match(backfillSource, /graphiti_materialized_insights/)
  assert.match(backfillSource, /materializeGraphitiOpportunities/)
  assert.match(statusSource, /requireApiSession/)
  assert.match(statusSource, /loadGraphitiOpportunitiesFromDb/)
  assert.match(statusSource, /ingested_not_opportunity_worthy/)
  assert.match(statusSource, /watch_items/)
  assert.match(statusSource, /active_opportunities/)
  assert.match(statusSource, /accelerating_opportunities/)
  assert.match(statusSource, /complete_dossiers_ingested/)
  assert.match(statusSource, /complete_materialized_rows/)
  assert.match(statusSource, /complete_active_opportunities/)
  assert.match(statusSource, /no_buying_trigger_rows/)
  assert.match(statusSource, /stale_opportunity_rows/)
  assert.match(statusSource, /latest_dossier_opportunity_seen_at/)
})

test('graphiti dossier memory sync route runs memory sync without materialization or strategy synthesis', () => {
  assert.equal(existsSync(memorySyncRoutePath), true)
  const source = readFileSync(memorySyncRoutePath, 'utf8')

  assert.match(source, /requireApiSession/)
  assert.match(source, /syncGraphitiDossierIngestionMemory/)
  assert.match(source, /dry_run/)
  assert.match(source, /concurrency/)
  assert.doesNotMatch(source, /materializeGraphitiOpportunities/)
  assert.doesNotMatch(source, /synthesizeAndPersistGraphitiOpportunityStrategyBriefs/)
  assert.doesNotMatch(source, /backfillGraphitiDossierIngestions/)
})

test('graphiti opportunity strategy sync route runs synthesis without ingestion or materialization', () => {
  assert.equal(existsSync(strategySyncRoutePath), true)
  const source = readFileSync(strategySyncRoutePath, 'utf8')

  assert.match(source, /requireApiSession/)
  assert.match(source, /synthesizeAndPersistGraphitiOpportunityStrategyBriefs/)
  assert.match(source, /getSupabaseAdmin/)
  assert.match(source, /dry_run/)
  assert.match(source, /concurrency/)
  assert.match(source, /model_timeout_ms/)
  assert.match(source, /modelTimeoutMs/)
  assert.doesNotMatch(source, /backfillGraphitiDossierIngestions/)
  assert.doesNotMatch(source, /materializeGraphitiOpportunities/)
  assert.doesNotMatch(source, /syncGraphitiDossierIngestionMemory/)
})

test('graphiti opportunities backfill de-duplicates parent insights before upsert', () => {
  const backfillSource = readFileSync(backfillRoutePath, 'utf8')

  assert.match(backfillSource, /dedupeParentInsightRows/)
  assert.match(backfillSource, /new Map/)
  assert.match(backfillSource, /row\.insight_id/)
  assert.match(backfillSource, /parentRows = dedupeParentInsightRows/)
})

test('graphiti opportunities backfill can rematerialize without strategy synthesis', () => {
  const backfillSource = readFileSync(backfillRoutePath, 'utf8')

  assert.match(backfillSource, /strategy_limit/)
  assert.match(backfillSource, /effectiveStrategyLimit === 0/)
  assert.match(backfillSource, /strategy_synthesis_skipped/)
})

test('graphiti opportunities cron runs the safe full dossier to strategy pipeline', () => {
  assert.equal(existsSync(cronOpportunityRoutePath), true)
  const source = readFileSync(cronOpportunityRoutePath, 'utf8')

  assert.match(source, /requireCronSecret/)
  assert.match(source, /backfillGraphitiDossierIngestions/)
  assert.match(source, /syncGraphitiDossierIngestionMemory/)
  assert.match(source, /materializeGraphitiOpportunities/)
  assert.match(source, /synthesizeAndPersistGraphitiOpportunityStrategyBriefs/)
  assert.match(source, /CRON_DOSSIER_LIMIT/)
  assert.match(source, /CRON_STRATEGY_LIMIT/)
  assert.match(source, /modelTimeoutMs/)
  assert.match(source, /graphiti_memory_sync/)
  assert.match(source, /strategy_synthesis/)
})
