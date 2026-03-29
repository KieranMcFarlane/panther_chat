import assert from 'node:assert/strict'
import test from 'node:test'

import { mapGraphitiResultsToEpisodes } from '../src/lib/entity-graph-timeline.ts'

test('mapGraphitiResultsToEpisodes normalizes Graphiti search results into dossier-ready episode items', () => {
  const episodes = mapGraphitiResultsToEpisodes([
    {
      fact: 'Arsenal FC CRM system upgrade RFP - £1.2 million for ticket holder management',
      source: 'LinkedIn RFP Detection',
      entities: ['Arsenal FC', 'CRM'],
      category: 'Technology',
      relevance: 0.87,
      created_at: '2025-01-24T10:30:00Z',
      uuid: 'ep-arsenal-crm-001',
    },
  ])

  assert.equal(episodes.length, 1)
  assert.equal(episodes[0].id, 'ep-arsenal-crm-001')
  assert.match(episodes[0].summary, /CRM system upgrade/i)
  assert.equal(episodes[0].source, 'LinkedIn RFP Detection')
  assert.equal(episodes[0].category, 'Technology')
  assert.equal(episodes[0].relevance, 0.87)
  assert.deepEqual(episodes[0].entities, ['Arsenal FC', 'CRM'])
})

test('mapGraphitiResultsToEpisodes sorts items by recency then relevance and keeps source links', () => {
  const episodes = mapGraphitiResultsToEpisodes([
    {
      fact: 'Older lower-value signal',
      source: 'Archive',
      category: 'Operations',
      relevance: 0.95,
      created_at: '2025-01-01T10:00:00Z',
      uuid: 'older',
      source_url: 'https://example.com/older',
    },
    {
      fact: 'Newer strategic signal',
      source: 'LinkedIn RFP Detection',
      category: 'Technology',
      relevance: 0.5,
      created_at: '2025-03-01T10:00:00Z',
      uuid: 'newer',
      source_url: 'https://example.com/newer',
    },
  ])

  assert.equal(episodes[0].id, 'newer')
  assert.equal(episodes[0].source_url, 'https://example.com/newer')
})

test('mapGraphitiResultsToEpisodes extracts a source domain for episode badges', () => {
  const episodes = mapGraphitiResultsToEpisodes([
    {
      fact: 'Domain-aware signal',
      source: 'Website monitor',
      category: 'Technology',
      relevance: 0.7,
      created_at: '2025-04-01T10:00:00Z',
      uuid: 'domain-aware',
      source_url: 'https://news.arsenal.com/articles/rfp',
    },
  ])

  assert.equal(episodes[0].source_domain, 'news.arsenal.com')
})
