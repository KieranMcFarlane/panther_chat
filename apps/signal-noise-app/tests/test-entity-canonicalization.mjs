import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entitiesRoutePath = new URL('../src/app/api/entities/route.ts', import.meta.url)
const summaryRoutePath = new URL('../src/app/api/entities/summary/route.ts', import.meta.url)

const entitiesRouteSource = readFileSync(entitiesRoutePath, 'utf8')
const summaryRouteSource = readFileSync(summaryRoutePath, 'utf8')

test('entities api canonicalizes duplicate variants before pagination', () => {
  assert.match(entitiesRouteSource, /canonicalizeEntities/)
  assert.match(entitiesRouteSource, /const canonicalEntities = canonicalizeEntities\(/)
  assert.match(entitiesRouteSource, /const total = canonicalEntities\.length/)
  assert.match(entitiesRouteSource, /const paginatedEntities = canonicalEntities\.slice\(/)
})

test('entity summary api canonicalizes duplicate variants before returning header data', () => {
  assert.match(summaryRouteSource, /canonicalizeEntities/)
  assert.match(summaryRouteSource, /const canonicalEntities = canonicalizeEntities\(/)
  assert.match(summaryRouteSource, /const summaryEntities = canonicalEntities\.map\(/)
  assert.match(summaryRouteSource, /entities: summaryEntities/)
  assert.match(summaryRouteSource, /total: canonicalEntities\.length/)
})
