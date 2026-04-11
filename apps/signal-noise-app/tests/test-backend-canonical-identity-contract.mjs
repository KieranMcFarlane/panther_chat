import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const graphitiSource = readFileSync(new URL('../backend/graphiti_service.py', import.meta.url), 'utf8')
const reconciliationSource = readFileSync(new URL('../backend/reconciliation_worker.py', import.meta.url), 'utf8')

test('backend dossier persistence upserts on canonical uuid when available', () => {
  assert.match(graphitiSource, /canonical_entity_id/)
  assert.match(graphitiSource, /conflict_key = "canonical_entity_id" if canonical_entity_id else "entity_id"/)
  assert.match(graphitiSource, /on_conflict=conflict_key/)
})

test('backend reconciliation worker can target runs by canonical uuid instead of raw entity_id only', () => {
  assert.match(reconciliationSource, /canonical_entity_id/)
  assert.match(reconciliationSource, /eq\("canonical_entity_id", canonical_entity_id\)/)
})
