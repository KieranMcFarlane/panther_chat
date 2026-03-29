import assert from 'node:assert/strict'
import { test } from 'node:test'

import { linkOpportunityToCanonicalEntity } from '../src/lib/opportunity-entity-linking.ts'

const canonicalEntities = [
  {
    id: '4431',
    properties: { name: 'Cricket', type: 'Sports Entity' },
  },
  {
    id: '225',
    properties: { name: 'Major League Cricket Ticketing System RFP', type: 'RFP Entity' },
  },
  {
    id: '0c6caa0a-8475-455f-8f9b-5ce61295bcd1',
    properties: { name: 'Major League Cricket', type: 'Sports Entity' },
  },
]

test('links ACE opportunities to Major League Cricket when the description explicitly names the league', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'American Cricket Enterprises (ACE)',
      title: 'Digital Transformation and Technology Infrastructure RFP',
      description:
        'American Cricket Enterprises has issued an RFP covering website development and fan engagement platforms for Major League Cricket operations.',
    },
    canonicalEntities,
  )

  assert.equal(linked.canonical_entity_id, '0c6caa0a-8475-455f-8f9b-5ce61295bcd1')
  assert.equal(linked.canonical_entity_name, 'Major League Cricket')
})
