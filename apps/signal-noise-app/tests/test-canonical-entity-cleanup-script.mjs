import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../scripts/cleanup-canonical-entities.mjs', import.meta.url), 'utf8')

test('canonical entity cleanup script audits quarantine and deletes only audited ids', () => {
  assert.match(source, /canonical_entities/)
  assert.match(source, /canonical_maintenance_audit/)
  assert.match(source, /quarantine/)
  assert.match(source, /--apply/)
  assert.match(source, /synthetic_entity_name/)
  assert.match(source, /placeholder_name/)
  assert.match(source, /invalidateCanonicalEntitiesSnapshot/)
  assert.match(source, /delete/)
})

test('canonical entity cleanup script can target json_seed entities and write a keep delete shortlist', () => {
  assert.match(source, /json_seed/i)
  assert.match(source, /keep-delete/i)
  assert.match(source, /keep_delete/i)
})
