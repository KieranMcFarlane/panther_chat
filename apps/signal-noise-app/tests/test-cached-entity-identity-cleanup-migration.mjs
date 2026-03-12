import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migrationPath = new URL('../supabase/migrations/20260303_cleanup_cached_entity_identity_props.sql', import.meta.url)
const helperPath = new URL('../src/lib/dossier-entity.ts', import.meta.url)

const migrationSource = readFileSync(migrationPath, 'utf8')
const helperSource = readFileSync(helperPath, 'utf8')

test('cached entity identity cleanup migration strips duplicate identity props from cached_entities', () => {
  assert.match(migrationSource, /update cached_entities/)
  assert.match(migrationSource, /properties = properties - 'neo4j_id' - 'supabase_id' - 'id'/)
  assert.match(migrationSource, /where properties \?\| array\['neo4j_id', 'supabase_id', 'id'\]/)
})

test('dossier entity helper strips duplicate identity props at runtime', () => {
  assert.match(helperSource, /const \{ dossier_data, neo4j_id, supabase_id, id, \.\.\.rest \} = properties/)
  assert.match(helperSource, /return rest/)
  assert.doesNotMatch(helperSource, /properties: cachedEntity\.properties/)
})
