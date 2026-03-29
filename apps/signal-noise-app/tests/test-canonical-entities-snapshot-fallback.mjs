import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const snapshotPath = new URL('../src/lib/canonical-entities-snapshot.ts', import.meta.url)
const source = readFileSync(snapshotPath, 'utf8')

test('canonical entity snapshot falls back to the local Falkor export when Supabase is unavailable', () => {
  assert.match(source, /localFalkorExportPath = path\.resolve\(process\.cwd\(\), 'backend', 'falkordb_export\.json'\)/)
  assert.match(source, /hasUsableSupabaseConfiguration/)
  assert.match(source, /Supabase configuration is not available in this environment/)
  assert.match(source, /Falling back to local Falkor export for canonical entities snapshot/)
  assert.match(source, /fetchCanonicalEntitiesFromLocalExport/)
})
