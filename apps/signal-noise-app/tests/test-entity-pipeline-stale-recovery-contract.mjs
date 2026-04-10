import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migrationSource = readFileSync(new URL('../supabase/migrations/20260409_entity_pipeline_recover_legacy_running_batches.sql', import.meta.url), 'utf8')

test('stale entity pipeline recovery requeues legacy running batches even when lease metadata is missing', () => {
  assert.match(migrationSource, /create or replace function requeue_stale_entity_import_batches/i)
  assert.match(migrationSource, /completed_at is null/i)
  assert.match(migrationSource, /metadata->>'heartbeat_at'/i)
  assert.match(migrationSource, /metadata->>'lease_expires_at'/i)
  assert.match(migrationSource, /coalesce\(\(metadata->>'heartbeat_at'\)::timestamptz,\s*started_at\)/i)
  assert.match(migrationSource, /coalesce\(\(metadata->>'lease_expires_at'\)::timestamptz,\s*started_at\)/i)
  assert.match(migrationSource, /'Recovered stale batch lease'/i)
})
