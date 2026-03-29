import assert from 'node:assert/strict'
import { test } from 'node:test'

import { linkOpportunityToCanonicalEntity } from '../src/lib/opportunity-entity-linking.ts'

test('links football club opportunity names to the canonical entity id', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      entity_id: null,
      entity_name: 'Arsenal FC',
      organization: 'Arsenal FC',
      title: 'Digital transformation partnership',
    },
    [
      {
        id: 'dca9d675-1d91-4a19-8ae6-04ed0df624cd',
        neo4j_id: '56',
        properties: {
          name: 'Arsenal Football Club',
          type: 'Sports Entity',
        },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, 'dca9d675-1d91-4a19-8ae6-04ed0df624cd')
  assert.equal(linked.canonical_entity_name, 'Arsenal Football Club')
})

test('keeps opportunities unlinked when no canonical entity is a plausible match', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      entity_id: null,
      entity_name: 'Bayern Munich',
      organization: 'Bayern Munich',
      title: 'Football RFP Document Reference',
    },
    [
      {
        id: 'dca9d675-1d91-4a19-8ae6-04ed0df624cd',
        neo4j_id: '56',
        properties: {
          name: 'Arsenal Football Club',
          type: 'Sports Entity',
        },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})
