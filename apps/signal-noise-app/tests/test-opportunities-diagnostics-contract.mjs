import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const routePath = new URL('../src/app/api/opportunities/diagnostics/route.ts', import.meta.url)

test('opportunities diagnostics route exposes shortlist and reviewable signal counts', () => {
  assert.equal(existsSync(routePath), true)

  const source = readFileSync(routePath, 'utf8')

  assert.match(source, /requireApiSession/)
  assert.match(source, /graphiti_materialized_opportunities/)
  assert.match(source, /graphiti_dossier_ingestions/)
  assert.match(source, /active_shortlist_count/)
  assert.match(source, /watch_item_count/)
  assert.match(source, /context_only_count/)
  assert.match(source, /failed_only_count/)
  assert.match(source, /top_reviewable_watch_items/)
  assert.match(source, /source_ledger_id/)
})

test('opportunities diagnostics route is read-only and defaults to diagnostics not shortlist', () => {
  const source = readFileSync(routePath, 'utf8')

  assert.match(source, /watch_item/)
  assert.match(source, /promotion_reason/)
  assert.match(source, /blockers/)
  assert.match(source, /dossier_url/)
  assert.doesNotMatch(source, /\binsert\s+into\b/i)
  assert.doesNotMatch(source, /\bupdate\s+graphiti_materialized_opportunities\b/i)
  assert.doesNotMatch(source, /\bdelete\s+from\b/i)
})
