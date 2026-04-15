import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/lib/canonical-entities-snapshot.ts', import.meta.url), 'utf8')

test('canonical entities snapshot prefers Supabase in hosted production instead of a stale local export', () => {
  assert.match(source, /process\.env\.VERCEL|process\.env\.VERCEL_ENV|NODE_ENV/)
  assert.match(source, /'supabase'|"supabase"/)
  assert.match(source, /loadQuestionFirstScaleManifest/)
  assert.doesNotMatch(source, /question_first_scale_batch_3000_live\.json/)
})

test('canonical entities snapshot only selects the minimal columns needed for the live dashboard path', () => {
  assert.match(source, /const canonicalEntitySelectColumns = 'id,\s*labels,\s*properties,\s*source_neo4j_ids,\s*source_graph_ids,\s*source_entity_ids'/)
  assert.match(source, /\.select\(canonicalEntitySelectColumns\)/)
  assert.doesNotMatch(source, /\.select\('\*'\)/)
})
})
