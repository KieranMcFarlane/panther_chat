import assert from 'node:assert/strict'
import { test } from 'node:test'

import { linkOpportunityToCanonicalEntity } from '../src/lib/opportunity-entity-linking.ts'

test('prefers Tennis Australia for ausopen.com curated opportunities', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Tennis Australia',
      title: 'Tournament Digital Platform Overhaul',
      description:
        'Tennis Australia seeking technology partner for comprehensive digital platform overhaul for Australian Open.',
      source_url: 'https://www.ausopen.com/digital-transformation',
    },
    [
      {
        id: '2531',
        properties: { name: 'US Open (Tennis)', type: 'Sports Entity' },
      },
      {
        id: '9991',
        properties: { name: 'Tennis Australia', type: 'Organization' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, '9991')
  assert.equal(linked.canonical_entity_name, 'Tennis Australia')
})

test('leaves ausopen.com opportunities unlinked when the preferred host entity is missing from the canonical snapshot', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Tennis Australia',
      title: 'Tournament Digital Platform Overhaul',
      description:
        'Tennis Australia seeking technology partner for comprehensive digital platform overhaul for Australian Open.',
      source_url: 'https://www.ausopen.com/digital-transformation',
    },
    [
      {
        id: '2531',
        properties: { name: 'US Open (Tennis)', type: 'Sports Entity' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('prefers All England Lawn Tennis Association for wimbledon.com curated opportunities', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'All England Lawn Tennis Association',
      title: 'Digital Fan Experience Enhancement',
      description:
        'Wimbledon seeking digital agency to enhance fan experience while maintaining the tournament heritage.',
      source_url: 'https://www.wimbledon.com/digital-opportunities',
    },
    [
      {
        id: '3872',
        properties: { name: 'AFC Wimbledon', type: 'Club' },
      },
      {
        id: '9992',
        properties: { name: 'All England Lawn Tennis Association', type: 'Organization' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, '9992')
  assert.equal(linked.canonical_entity_name, 'All England Lawn Tennis Association')
})
