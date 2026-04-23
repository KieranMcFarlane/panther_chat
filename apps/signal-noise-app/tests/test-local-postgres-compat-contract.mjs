import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pgClientSource = readFileSync(
  new URL('../src/lib/pg-client.ts', import.meta.url),
  'utf8'
)
const supabaseCacheSource = readFileSync(
  new URL('../src/lib/supabase-cache.ts', import.meta.url),
  'utf8'
)

test('local Postgres Supabase shim keeps PostgREST array filter helpers used by entity routes', () => {
  assert.match(pgClientSource, /type FilterOp = [^\n]*'cs'/)
  assert.match(pgClientSource, /type FilterOp = [^\n]*'ov'/)
  assert.match(pgClientSource, /contains\(column: string, value: any\)/)
  assert.match(pgClientSource, /op: 'cs'/)
  assert.match(pgClientSource, /overlaps\(column: string, values: any\[\]\)/)
  assert.match(pgClientSource, /op: 'ov'/)
  assert.match(pgClientSource, /case 'cs':/)
  assert.match(pgClientSource, /case 'ov':/)
  assert.doesNotMatch(pgClientSource, /rawSql/)
})

test('local Postgres Supabase shim supports grouped aggregate queries still used by services', () => {
  assert.match(pgClientSource, /private groupSpecs: string\[\]/)
  assert.match(pgClientSource, /group\(columns: string\)/)
  assert.match(pgClientSource, /GROUP BY/)
})

test('supabase-cache preserves the legacy cacheService surface during the local Postgres migration', () => {
  assert.match(supabaseCacheSource, /export class SupabaseCacheService/)
  assert.match(supabaseCacheSource, /async initialize\(\)/)
  assert.match(supabaseCacheSource, /async cacheEntity\(/)
  assert.match(supabaseCacheSource, /async getCacheStats\(/)
  assert.match(supabaseCacheSource, /export const cacheService = new SupabaseCacheService\(\)/)
})
