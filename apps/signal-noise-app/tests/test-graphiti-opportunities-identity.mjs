import assert from 'node:assert/strict'
import test from 'node:test'

import { buildGraphitiOpportunityId } from '../src/lib/graphiti-opportunity-identity.ts'

const canonicalInput = {
  canonical_entity_id: 'entity-123',
  canonical_entity_name: 'Major League Cricket',
  entity_id: 'source-1',
  entity_name: 'Major League Cricket',
  title: 'Major League Cricket fan engagement platform opportunity',
  opportunity_kind: 'Partnership',
  source_objective: 'question_first',
}

test('buildGraphitiOpportunityId stays stable for the same canonical opportunity identity', () => {
  const first = buildGraphitiOpportunityId(canonicalInput)
  const second = buildGraphitiOpportunityId({
    ...canonicalInput,
    source_objective: 'different-source-objective',
  })

  assert.equal(first, second)
})

test('buildGraphitiOpportunityId changes when the canonical entity changes', () => {
  const first = buildGraphitiOpportunityId(canonicalInput)
  const second = buildGraphitiOpportunityId({
    ...canonicalInput,
    canonical_entity_id: 'entity-999',
    canonical_entity_name: 'Another League',
  })

  assert.notEqual(first, second)
})

