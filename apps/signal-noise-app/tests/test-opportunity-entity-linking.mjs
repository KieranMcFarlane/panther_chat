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

test('keeps opportunities unlinked when only generic tokens overlap with the canonical entity', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      entity_id: null,
      entity_name: 'French Football Federation (FFF)',
      organization: 'French Football Federation (FFF)',
      title: 'Mobile engagement and digital transformation',
      description: 'FFF announces a federation-wide digital transformation programme for football supporters.',
    },
    [
      {
        id: '2105',
        properties: {
          name: 'French Rugby Federation',
          type: 'Organization',
        },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})
