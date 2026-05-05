import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const backfillRoutePath = new URL('../src/app/api/admin/graphiti/opportunities/backfill/route.ts', import.meta.url)
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
