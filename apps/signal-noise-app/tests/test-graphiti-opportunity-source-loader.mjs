import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const persistenceSource = readFileSync(new URL('../src/lib/graphiti-opportunity-persistence.ts', import.meta.url), 'utf8')

test('graphiti opportunity source loader keeps opportunity insights even when they are inactive', () => {
  const loaderStart = persistenceSource.indexOf('async function loadSourceOpportunities(limit: number)')
  const loaderEnd = persistenceSource.indexOf('export async function loadPersistedGraphitiOpportunities')
  const loaderSource = persistenceSource.slice(loaderStart, loaderEnd)

  assert.match(loaderSource, /graphiti_materialized_insights/)
  assert.match(loaderSource, /insight_type', 'opportunity'/)
  assert.doesNotMatch(loaderSource, /graphiti_materialized_insights'\)\.select\(SOURCE_COLUMNS\)\s*\.eq\('is_active', true\)/)
})
