import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const remediateTaxonomySource = readFileSync(
  new URL('../scripts/remediate-taxonomy-hygiene.mjs', import.meta.url),
  'utf8',
)

test('taxonomy remediation uses the shared sports hierarchy helper for backfills', () => {
  assert.match(remediateTaxonomySource, /buildCanonicalLeagueLookup/)
  assert.match(remediateTaxonomySource, /buildSportsHierarchyBackfill/)
  assert.match(remediateTaxonomySource, /shouldIncludeInSportsHierarchy/)
  assert.match(remediateTaxonomySource, /league_canonical_entity_id/)
  assert.match(remediateTaxonomySource, /parent_canonical_entity_id/)
})
