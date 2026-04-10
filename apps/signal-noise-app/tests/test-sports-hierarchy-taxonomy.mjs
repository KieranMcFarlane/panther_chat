import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSportsHierarchyBackfill,
  shouldIncludeInSportsHierarchy,
} from '../src/lib/sports-hierarchy-taxonomy.mjs'

test('sports hierarchy keeps clubs, teams, federations, leagues, and competitions in scope', () => {
  assert.equal(
    shouldIncludeInSportsHierarchy({
      properties: { name: 'Arsenal', type: 'Club' },
      labels: ['Club'],
    }),
    true,
  )
  assert.equal(
    shouldIncludeInSportsHierarchy({
      properties: { name: 'England Football Association', type: 'Federation' },
      labels: ['Federation'],
    }),
    true,
  )
  assert.equal(
    shouldIncludeInSportsHierarchy({
      properties: { name: 'Sports Org', type: 'Organization', sport: 'Football' },
      labels: ['Organization'],
    }),
    true,
  )
  assert.equal(
    shouldIncludeInSportsHierarchy({
      properties: { name: 'Person', type: 'Person' },
      labels: ['Person'],
    }),
    false,
  )
  assert.equal(
    shouldIncludeInSportsHierarchy({
      properties: { name: 'Venue', type: 'Venue' },
      labels: ['Venue'],
    }),
    false,
  )
  assert.equal(
    shouldIncludeInSportsHierarchy({
      properties: { name: 'Country', type: 'Country' },
      labels: ['Country'],
    }),
    false,
  )
})

test('sports hierarchy backfill derives team links only when supported by existing data', () => {
  const backfill = buildSportsHierarchyBackfill(
    {
      id: 'raw-arsenal',
      properties: {
        name: 'Arsenal FC',
        type: 'Club',
        sport: 'Football',
        country: 'England',
        league: 'Premier League',
      },
      labels: ['Club'],
    },
    {
      'premier league': {
        id: 'league-uuid',
        name: 'Premier League',
        entity_type: 'league',
        sport: 'Football',
        country: 'England',
      },
    },
  )

  assert.equal(backfill.sport, 'Football')
  assert.equal(backfill.country, 'England')
  assert.equal(backfill.league_canonical_entity_id, 'league-uuid')
  assert.equal(backfill.parent_canonical_entity_id, 'league-uuid')
})

test('sports hierarchy backfill derives federation country from the federation name when available', () => {
  const backfill = buildSportsHierarchyBackfill(
    {
      id: 'fed-aus',
      name: 'Australian Olympic Committee',
      properties: {
        name: 'Australian Olympic Committee',
        type: 'Federation',
        sport: 'Olympic Sports',
      },
      labels: ['Federation'],
    },
    {},
  )

  assert.equal(backfill.sport, 'Olympic Sports')
  assert.equal(backfill.country, 'Australia')
  assert.equal(backfill.league_canonical_entity_id, '')
  assert.equal(backfill.parent_canonical_entity_id, '')
})

test('sports hierarchy treats federation entity_type as canonical even when raw type is polluted', () => {
  const backfill = buildSportsHierarchyBackfill(
    {
      id: 'fed-aus',
      entity_type: 'federation',
      properties: {
        name: 'Australian Olympic Committee',
        type: 'Technology',
        entity_type: 'Governing Body',
        sport: 'Olympic Sports',
      },
      labels: ['Federation'],
    },
    {},
  )

  assert.equal(backfill.inHierarchy, true)
  assert.equal(backfill.country, 'Australia')
  assert.equal(backfill.sport, 'Olympic Sports')
})
