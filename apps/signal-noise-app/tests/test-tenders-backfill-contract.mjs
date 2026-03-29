import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('tenders API exposes canonical entity backfill action for existing opportunities', async () => {
  const source = await readFile(new URL('../src/app/api/tenders/route.ts', import.meta.url), 'utf8')

  assert.match(source, /case 'backfill-entity-links'/)
  assert.match(source, /handleBackfillEntityLinks/)
  assert.match(source, /getSupabaseAdmin\(\)/)
  assert.match(source, /canonical_entity_id|entity_id/)
})
