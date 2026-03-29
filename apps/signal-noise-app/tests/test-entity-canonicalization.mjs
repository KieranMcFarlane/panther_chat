import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entitiesRoutePath = new URL('../src/app/api/entities/route.ts', import.meta.url)
const summaryRoutePath = new URL('../src/app/api/entities/summary/route.ts', import.meta.url)
const snapshotPath = new URL('../src/lib/canonical-entities-snapshot.ts', import.meta.url)

const entitiesRouteSource = readFileSync(entitiesRoutePath, 'utf8')
const summaryRouteSource = readFileSync(summaryRoutePath, 'utf8')
const snapshotSource = readFileSync(snapshotPath, 'utf8')

test('entities api uses the canonical entity snapshot before pagination', () => {
  assert.match(entitiesRouteSource, /import \{ getCanonicalEntitiesSnapshot \} from ['"]@\/lib\/canonical-entities-snapshot['"]/)
  assert.match(entitiesRouteSource, /const canonicalEntities = await getCanonicalEntitiesSnapshot\(\)/)
  assert.match(entitiesRouteSource, /const filteredEntities = canonicalEntities\.filter\(/)
  assert.match(entitiesRouteSource, /const paginatedEntities = filteredEntities\.slice\(/)
  assert.match(entitiesRouteSource, /source: 'supabase'/)
})

test('entity summary api uses the canonical snapshot for summary data', () => {
  assert.match(summaryRouteSource, /import \{ getCanonicalEntitiesSnapshot \} from ['"]@\/lib\/canonical-entities-snapshot['"]/)
  assert.match(summaryRouteSource, /const canonicalEntities = await getCanonicalEntitiesSnapshot\(\)/)
  assert.match(summaryRouteSource, /const filteredEntities = canonicalEntities\.filter\(/)
  assert.match(summaryRouteSource, /const summaryEntities = filteredEntities\.map\(/)
  assert.match(summaryRouteSource, /entities: summaryEntities/)
  assert.match(summaryRouteSource, /total: filteredEntities\.length/)
})

test('canonical snapshot loader prefers the local Falkor export before the Supabase cold path', () => {
  assert.match(snapshotSource, /fetchCanonicalEntitiesFromLocalExport/)
  assert.match(snapshotSource, /fetchCanonicalEntitiesFromBestAvailableSource/)
  assert.match(snapshotSource, /Falling back to local Falkor export for canonical entities snapshot/)
  assert.match(snapshotSource, /hasUsableSupabaseConfiguration/)
})
