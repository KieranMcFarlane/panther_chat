import test from 'node:test'
import assert from 'node:assert/strict'
import { v5 as uuidv5 } from 'uuid'

import { deriveCanonicalEntityId, buildBackfillUpdateQuery } from '../scripts/backfill-canonical-entity-ids.mjs'

const ENTITY_PUBLIC_ID_NAMESPACE = 'f5c2b2b8-9cf2-4e66-a1c2-38cde7bc3f4e'

test('backfill helper canonicalizes slug entity ids with deterministic uuid5', () => {
  assert.equal(
    deriveCanonicalEntityId('arsenal-fc'),
    uuidv5('arsenal-fc', ENTITY_PUBLIC_ID_NAMESPACE),
  )
})

test('backfill helper preserves uuid-shaped entity ids', () => {
  assert.equal(
    deriveCanonicalEntityId('f66b9c56-7a38-44d0-8923-6993b7b33926'),
    'f66b9c56-7a38-44d0-8923-6993b7b33926',
  )
})

test('backfill update query includes canonical entity column and metadata for runs', () => {
  const query = buildBackfillUpdateQuery({ tableName: 'entity_pipeline_runs' })
  assert.match(query, /canonical_entity_id = backfill\.canonical_entity_id::uuid/)
  assert.match(query, /jsonb_build_object\('canonical_entity_id', backfill\.canonical_entity_id::text\)/)
})
