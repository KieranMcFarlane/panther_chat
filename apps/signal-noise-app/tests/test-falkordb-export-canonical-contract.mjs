import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const extractSource = readFileSync(new URL('../backend/extract_from_supabase.py', import.meta.url), 'utf8')
const importSource = readFileSync(new URL('../backend/import_to_falkordb.py', import.meta.url), 'utf8')

test('supabase export preserves canonical entity ids alongside neo4j ids', () => {
  assert.match(extractSource, /canonical_entity_id/)
  assert.match(extractSource, /uuid/)
  assert.match(extractSource, /GraphNode\(/)
})

test('falkordb import keeps canonical entity ids on imported nodes', () => {
  assert.match(importSource, /canonical_entity_id/)
  assert.match(importSource, /entity_canonical_entity_id_unique|canonical_entity_id_index/)
  assert.match(importSource, /all_props\['canonical_entity_id'\]/)
})
