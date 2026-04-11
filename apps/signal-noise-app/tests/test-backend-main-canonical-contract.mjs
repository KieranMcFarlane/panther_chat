import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const mainSource = readFileSync(new URL('../backend/main.py', import.meta.url), 'utf8')

test('dossier generation resolves canonical entity id before checking entity_dossiers cache', () => {
  const canonicalIndex = mainSource.indexOf('canonical_entity_id = str(')
  const cacheLookupIndex = mainSource.indexOf('cache_query = supabase.table("entity_dossiers").select("*")')

  assert.ok(canonicalIndex >= 0, 'dossier generation should derive canonical_entity_id')
  assert.ok(cacheLookupIndex >= 0, 'dossier generation should still consult entity_dossiers')
  assert.ok(
    canonicalIndex < cacheLookupIndex,
    'canonical_entity_id should be available before cache lookup so canonical dossiers win',
  )
})

test('pipeline phase updates prefer canonical entity ids when available', () => {
  const canonicalIndex = mainSource.indexOf('canonical_entity_id = str(')
  const updateBranchIndex = mainSource.indexOf('.eq("canonical_entity_id", canonical_entity_id)')
  const rawBranchIndex = mainSource.indexOf('.eq("entity_id", request.entity_id)')

  assert.ok(canonicalIndex >= 0, 'pipeline request should derive canonical_entity_id')
  assert.ok(updateBranchIndex >= 0, 'pipeline updates should support canonical_entity_id targeting')
  assert.ok(rawBranchIndex >= 0, 'pipeline updates should still support legacy entity_id fallback')
  assert.ok(
    updateBranchIndex < rawBranchIndex,
    'canonical_entity_id branch should be present before the legacy entity_id fallback branch',
  )
})
