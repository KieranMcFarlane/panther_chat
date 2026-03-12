import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migrationPath = new URL('../supabase/migrations/20260303_cleanup_legacy_embedded_and_orphan_dossiers.sql', import.meta.url)
const migrationSource = readFileSync(migrationPath, 'utf8')

test('legacy dossier cleanup migration deletes orphan dossier rows', () => {
  assert.match(migrationSource, /delete from entity_dossiers d/)
  assert.match(migrationSource, /not exists \(\s*select 1\s*from cached_entities ce/)
  assert.match(migrationSource, /from teams t/)
  assert.match(migrationSource, /from leagues l/)
})

test('legacy dossier cleanup migration strips embedded dossier_data from cached_entities', () => {
  assert.match(migrationSource, /update cached_entities/)
  assert.match(migrationSource, /set properties = properties - 'dossier_data'/)
  assert.match(migrationSource, /where properties \? 'dossier_data'/)
})
