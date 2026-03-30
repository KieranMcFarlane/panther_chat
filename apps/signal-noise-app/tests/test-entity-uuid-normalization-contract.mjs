import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migrationPath = new URL('../supabase/migrations/20260330_add_uuid_to_cached_entities.sql', import.meta.url)
const cacheServicePath = new URL('../src/services/EntityCacheService.ts', import.meta.url)
const realtimeSyncPath = new URL('../src/services/RealtimeSyncService.ts', import.meta.url)
const entityImportMapperPath = new URL('../src/lib/entity-import-mapper.ts', import.meta.url)
const entityImportBridgePath = new URL('../src/lib/entity-import-falkor-bridge.ts', import.meta.url)

const migrationSource = readFileSync(migrationPath, 'utf8')
const cacheServiceSource = readFileSync(cacheServicePath, 'utf8')
const realtimeSyncSource = readFileSync(realtimeSyncPath, 'utf8')
const entityImportMapperSource = readFileSync(entityImportMapperPath, 'utf8')
const entityImportBridgeSource = readFileSync(entityImportBridgePath, 'utf8')

test('cached_entities migration adds and backfills a uuid column', () => {
  assert.match(migrationSource, /ALTER TABLE cached_entities\s+ADD COLUMN IF NOT EXISTS uuid TEXT/i)
  assert.match(migrationSource, /uuid_generate_v5\(/i)
  assert.match(migrationSource, /CREATE INDEX IF NOT EXISTS idx_cached_entities_uuid/i)
})

test('entity cache sync writes uuid into cached_entities rows', () => {
  assert.match(cacheServiceSource, /import \{ resolveEntityUuid \} from ['"]@\/lib\/entity-public-id['"]/)
  assert.match(cacheServiceSource, /const uuid = resolveEntityUuid\(/)
  assert.match(cacheServiceSource, /uuid,\s*labels:/s)
  assert.match(cacheServiceSource, /properties:\s*\{\s*\.\.\.node\.properties,\s*uuid,\s*\}/s)
})

test('realtime graph sync persists uuid alongside neo4j ids', () => {
  assert.match(realtimeSyncSource, /import \{ resolveEntityUuid \} from ['"]@\/lib\/entity-public-id['"]/)
  assert.match(realtimeSyncSource, /select\('neo4j_id, uuid, properties, updated_at'\)/)
  assert.match(realtimeSyncSource, /const uuid = entity\.uuid \|\| resolveEntityUuid\(/)
  assert.match(realtimeSyncSource, /uuid,\s*labels:/s)
})

test('entity import mapper and graph bridge carry uuid into imported entities', () => {
  assert.match(entityImportMapperSource, /import \{ resolveEntityUuid \} from ['"]@\/lib\/entity-public-id['"]/)
  assert.match(entityImportMapperSource, /const uuid = resolveEntityUuid\(/)
  assert.match(entityImportMapperSource, /properties:\s*\{\s*uuid,/s)

  assert.match(entityImportBridgeSource, /import \{ resolveEntityUuid \} from ['"]\.\/entity-public-id['"]/)
  assert.match(entityImportBridgeSource, /properties:\s*\{\s*uuid,/s)
})
