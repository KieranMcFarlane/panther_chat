import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityCacheServicePath = new URL('../src/services/EntityCacheService.ts', import.meta.url)
const migrateEntitiesPath = new URL('../migrate-entities.js', import.meta.url)

test('entity cache sync prefers stable neo4j_id property before internal node identity', () => {
  const source = readFileSync(entityCacheServicePath, 'utf8')
  assert.match(source, /node\.properties\.neo4j_id\s*\?\?\s*node\.identity\.toString\(\)/)
})

test('one-off Neo4j migration prefers stable neo4j_id property before internal node identity', () => {
  const source = readFileSync(migrateEntitiesPath, 'utf8')
  assert.match(source, /node\.properties\.neo4j_id\s*\?\?\s*node\.identity\.toString\(\)/)
})
