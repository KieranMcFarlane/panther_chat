import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const persistenceSource = readFileSync(new URL('../src/lib/graphiti-opportunity-persistence.ts', import.meta.url), 'utf8')

test('graphiti opportunities persistence strips unsupported freshness before upsert', () => {
  assert.match(persistenceSource, /const \{\s*freshness: _freshness,\s*metadata: _metadata,\s*\.\.\.persisted\s*\} = row/)
  assert.match(persistenceSource, /\.upsert\(persistedRows, \{ onConflict: 'opportunity_id' \}\)/)
})
