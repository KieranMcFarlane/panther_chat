import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const scriptPath = new URL('../scripts/admin/report-dossier-quality.cjs', import.meta.url)

test('dossier quality report reads persisted dossier and graphiti ledger counts', () => {
  assert.equal(existsSync(scriptPath), true)

  const source = readFileSync(scriptPath, 'utf8')

  assert.match(source, /canonical_entities/)
  assert.match(source, /entity_dossiers/)
  assert.match(source, /graphiti_dossier_ingestions/)
  assert.match(source, /graphiti_materialized_opportunities/)
  assert.match(source, /canonical_entities_total/)
  assert.match(source, /persisted_dossier_entities/)
  assert.match(source, /quality_counts/)
  assert.match(source, /ingestion_counts/)
  assert.match(source, /answer_coverage_buckets/)
  assert.match(source, /top_recent_dossiers/)
  assert.match(source, /top_commercial_signal_candidates/)
})

test('dossier quality report is read-only and separates provider failures', () => {
  const source = readFileSync(scriptPath, 'utf8')

  assert.match(source, /provider_infrastructure_failure/)
  assert.match(source, /failed_provider_failures/)
  assert.doesNotMatch(source, /\bupdate\s+entity_dossiers\b/i)
  assert.doesNotMatch(source, /\binsert\s+into\b/i)
  assert.doesNotMatch(source, /\bdelete\s+from\b/i)
})
