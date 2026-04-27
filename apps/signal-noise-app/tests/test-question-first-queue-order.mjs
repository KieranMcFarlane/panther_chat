import assert from 'node:assert/strict'
import { test } from 'node:test'

const { sortQuestionFirstManifestEntities, describeQuestionFirstQueueOrder } = await import('../src/lib/question-first-queue-order.ts')

test('question-first queue ordering prefers the configured client-facing leagues first and then higher-priority entities within the league', () => {
  const canonicalEntities = [
    {
      id: 'premier-league',
      properties: {
        name: 'Premier League',
        type: 'League',
        league: '',
        sport: 'Football',
        country: 'England',
        priority_score: 99,
        quality_score: 80,
      },
    },
    {
      id: 'man-city',
      properties: {
        name: 'Manchester City',
        type: 'Club',
        league: 'Premier League',
        sport: 'Football',
        country: 'England',
        priority_score: 95,
        quality_score: 75,
      },
    },
    {
      id: 'liverpool',
      properties: {
        name: 'Liverpool FC',
        type: 'Club',
        league: 'Premier League',
        sport: 'Football',
        country: 'England',
        priority_score: 90,
        quality_score: 70,
      },
    },
    {
      id: 'bundesliga',
      properties: {
        name: 'Bundesliga',
        type: 'League',
        league: '',
        sport: 'Football',
        country: 'Germany',
        priority_score: 98,
        quality_score: 85,
      },
    },
    {
      id: 'nba',
      properties: {
        name: 'NBA',
        type: 'League',
        league: '',
        sport: 'Basketball',
        country: 'USA',
        priority_score: 97,
        quality_score: 86,
      },
    },
    {
      id: 'bayern',
      properties: {
        name: 'Bayern Munich',
        type: 'Club',
        league: 'Bundesliga',
        sport: 'Football',
        country: 'Germany',
        priority_score: 93,
        quality_score: 78,
      },
    },
  ]

  const manifestEntities = [
    { entity_id: 'liverpool', entity_name: 'Liverpool FC', entity_type: 'Club' },
    { entity_id: 'bundesliga', entity_name: 'Bundesliga', entity_type: 'League' },
    { entity_id: 'nba', entity_name: 'NBA', entity_type: 'League' },
    { entity_id: 'bayern', entity_name: 'Bayern Munich', entity_type: 'Club' },
    { entity_id: 'premier-league', entity_name: 'Premier League', entity_type: 'League' },
    { entity_id: 'man-city', entity_name: 'Manchester City', entity_type: 'Club' },
  ]

  const ordered = sortQuestionFirstManifestEntities(manifestEntities, canonicalEntities)

  assert.deepEqual(
    ordered.map((entity) => entity.entity_name),
    ['Premier League', 'Manchester City', 'Liverpool FC', 'Bundesliga', 'Bayern Munich', 'NBA'],
  )
  assert.deepEqual(describeQuestionFirstQueueOrder(), [
    'league_priority ASC',
    'league_popularity DESC',
    'priority_score DESC',
    'quality_score DESC',
    'entity_type ASC',
    'entity_name ASC',
    'entity_id ASC',
  ])
})
