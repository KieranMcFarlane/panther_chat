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

test('links French Football Federation alias when the canonical federation exists', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'French Football Federation (FFF)',
      title: 'Mobile Engagement & Digital Transformation',
      description:
        'FFF announces a federation-wide digital transformation programme for football supporters.',
      source_url: 'https://www.fff.fr/digital-transformation-rfp',
    },
    [
      {
        id: '2100',
        properties: { name: 'French Football Federation', type: 'Federation' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, '2100')
  assert.equal(linked.canonical_entity_name, 'French Football Federation')
})

test('links French Football Federation alias even with noisy generic federation candidates present', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'French Football Federation (FFF)',
      title: 'Mobile Engagement & Digital Transformation',
      description:
        'FFF announces a federation-wide digital transformation programme for football supporters.',
      source_url: 'https://www.fff.fr/digital-transformation-rfp',
    },
    [
      {
        id: 'generic-federation',
        properties: { name: 'Federation', type: 'Sports Category' },
      },
      {
        id: 'generic-football',
        properties: { name: 'Football', type: 'Sport Category' },
      },
      {
        id: 'rugby-federation',
        properties: { name: 'French Rugby Federation', type: 'Federation' },
      },
      {
        id: '2100',
        properties: { name: 'French Football Federation', type: 'Federation' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, '2100')
  assert.equal(linked.canonical_entity_name, 'French Football Federation')
})

test('leaves USA Cricket alias opportunities unlinked when the canonical entity is absent', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'USA Cricket',
      title: 'Cricket Development and Youth Programs Technology Platform',
      description:
        'USA Cricket is requesting proposals for a youth development technology platform.',
      source_url: 'https://www.usacricket.org/procurement/youth-development-platform-2025',
    },
    [
      {
        id: '4431',
        properties: { name: 'Cricket', type: 'Sports Entity' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('keeps Volleyball World opportunities unlinked when the only strong candidate is an unrelated club brand', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Volleyball World',
      title: 'Digital Growth Partnership in China',
      description:
        'Volleyball World is seeking a digital growth partner in China to expand distribution, fan engagement, and commercial reach for volleyball properties.',
      source_url: 'https://en.volleyballworld.com/news/volleyball-world-teams-up-with-mailman-to-supercharge-growth-in-china',
    },
    [
      {
        id: '3378',
        properties: { name: 'CBA (China)', type: 'League' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('keeps Australian Sports Commission opportunities unlinked when the best lexical match is an unrelated club', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Australian Sports Commission',
      title: 'Participation Growth Funding 2024-25 and Investment Announcements',
      description:
        'Australian Sports Commission funding initiative focused on national participation growth, investment programs, and strategic sports development.',
      source_url: 'https://www.ausport.gov.au/',
    },
    [
      {
        id: '1934',
        properties: { name: 'Sporting CP', type: 'Club' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})
