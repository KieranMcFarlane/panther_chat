import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import pg from 'pg'

const migrationPath = new URL('../supabase/migrations/20260508_entity_source_registry_unique_conflict_target.sql', import.meta.url)
const migrationSource = readFileSync(migrationPath, 'utf8')

test('entity source registry schema supports worker upsert conflict target', async () => {
  assert.match(migrationSource, /entity_source_registry_entity_page_url_uidx/)
  assert.match(migrationSource, /entity_id,\s*page_class,\s*url/i)
  assert.match(migrationSource, /create unique index if not exists/i)
  assert.match(migrationSource, /setval\(\s*'entity_source_registry_id_seq'/)

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql:///signal_noise_app?host=/tmp',
  })
  await client.connect()
  try {
    const result = await client.query(`
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'entity_source_registry'
        and indexname = 'entity_source_registry_entity_page_url_uidx'
        and indexdef ilike '%unique%'
        and indexdef ilike '%entity_id%'
        and indexdef ilike '%page_class%'
        and indexdef ilike '%url%'
      limit 1
    `)

    assert.equal(result.rows.length, 1)

    const smoke = await client.query(`
      insert into entity_source_registry (
        entity_id,
        page_class,
        url,
        source,
        confidence,
        is_canonical,
        last_verified_at,
        metadata
      )
      values (
        'constraint-smoke-entity',
        'official_site',
        'https://example.com',
        'schema_contract',
        0.5,
        false,
        now(),
        '{}'::jsonb
      )
      on conflict (entity_id, page_class, url)
      do update set
        updated_at = now(),
        source = excluded.source
      returning id
    `)

    assert.ok(Number(smoke.rows[0]?.id) > 0)
    await client.query(`delete from entity_source_registry where entity_id = 'constraint-smoke-entity'`)
  } finally {
    await client.end()
  }
})
