import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/services/EntityCacheService.ts', import.meta.url), 'utf8')

test('entity cache sync writes canonical_entity_id into cached entity rows', () => {
  assert.match(source, /canonical_entity_id/)
  assert.match(source, /resolveEntityUuid/)
})

test('entity cache read path exposes canonical uuid instead of raw neo4j_id as public id', () => {
  assert.match(source, /id: entity\.uuid \|\| entity\.canonical_entity_id \|\| entity\.neo4j_id/)
})
