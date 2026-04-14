import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const persistenceSource = readFileSync(new URL('../src/lib/graphiti-opportunity-persistence.ts', import.meta.url), 'utf8')

test('graphiti opportunity source loader scans dossier-derived signals for qualified opportunities', () => {
  const loaderStart = persistenceSource.indexOf('async function loadSourceOpportunities(limit: number)')
  const loaderEnd = persistenceSource.indexOf('export async function loadPersistedGraphitiOpportunities')
  const loaderSource = persistenceSource.slice(loaderStart, loaderEnd)

  assert.match(loaderSource, /graphiti_materialized_insights/)
  assert.match(loaderSource, /isOpportunityCandidateSource/)
  assert.doesNotMatch(loaderSource, /\.eq\('insight_type', 'opportunity'\)/)
  assert.match(persistenceSource, /'insight_type'/)
})
