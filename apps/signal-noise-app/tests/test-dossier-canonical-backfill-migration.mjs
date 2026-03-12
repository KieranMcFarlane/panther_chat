import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migrationPath = new URL('../supabase/migrations/20260303_backfill_entity_dossier_canonical_ids.sql', import.meta.url)
const migrationSource = readFileSync(migrationPath, 'utf8')

test('dossier canonical backfill migration deduplicates canonical collisions before rekeying', () => {
  assert.match(migrationSource, /row_number\(\) over/)
  assert.match(migrationSource, /delete from entity_dossiers/)
  assert.match(migrationSource, /row_rank > 1/)
})

test('dossier canonical backfill migration rewrites legacy keys to canonical ids and updates metadata.entity_id', () => {
  assert.match(migrationSource, /set entity_id = m\.canonical_entity_id/)
  assert.match(migrationSource, /jsonb_set\(d\.dossier_data, '\{metadata,entity_id\}'/)
  assert.match(migrationSource, /join cached_entities ce on ce\.neo4j_id::text = d\.entity_id/)
  assert.match(migrationSource, /join teams t on t\.neo4j_id::text = d\.entity_id/)
  assert.match(migrationSource, /join leagues l on l\.neo4j_id::text = d\.entity_id/)
})
