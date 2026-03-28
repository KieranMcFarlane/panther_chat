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
})
