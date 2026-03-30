import assert from 'node:assert/strict'
import test from 'node:test'

import { buildEntitiesTaxonomy, canonicalizeLeagueLabel, getCanonicalLeagueQueryValues } from '../src/lib/entities-taxonomy.ts'

test('buildEntitiesTaxonomy derives taxonomy from entity snapshots', () => {
  const snapshot = buildEntitiesTaxonomy([
    {
      labels: ['Club'],
      properties: {
        name: 'Arsenal FC',
        sport: 'Football',
        league: 'Premier League',
        country: 'England',
        entityClass: 'SPORT_CLUB',
      },
    },
    {
      labels: ['Federation'],
      properties: {
        name: 'International Canoe Federation',
        sport: 'Canoe',
        country: 'Switzerland',
        entityClass: 'SPORT_FEDERATION',
      },
    },
  ])

  assert.deepEqual(snapshot.sports, ['Canoe', 'Football'])
  assert.deepEqual(snapshot.leagues, ['Premier League'])
  assert.deepEqual(snapshot.countries, ['England', 'Switzerland'])
  assert.deepEqual(snapshot.entityClasses, ['SPORT_CLUB', 'SPORT_FEDERATION'])
  assert.deepEqual(snapshot.federationsRightsHolders, ['International Canoe Federation'])
  assert.deepEqual(snapshot.leaguesBySport, { Football: ['Premier League'] })
  assert.equal(snapshot.counts.sports.Football, 1)
  assert.equal(snapshot.counts.entityClasses.SPORT_FEDERATION, 1)
})

test('buildEntitiesTaxonomy collapses league aliases into one canonical option', () => {
  const snapshot = buildEntitiesTaxonomy([
    {
      labels: ['Club'],
      properties: {
        name: 'Arsenal FC',
        sport: 'Football',
        league: 'English Premier League',
        country: 'England',
        entityClass: 'SPORT_CLUB',
      },
    },
    {
      labels: ['Club'],
      properties: {
        name: 'Chelsea FC',
        sport: 'Football',
        league: 'EPL',
        country: 'England',
        entityClass: 'SPORT_CLUB',
      },
    },
    {
      labels: ['League'],
      properties: {
        name: 'Premier League',
        sport: 'Football',
        country: 'England',
        entityClass: 'SPORT_LEAGUE',
      },
    },
  ])

  assert.equal(canonicalizeLeagueLabel('English Premier League'), 'Premier League')
  assert.equal(canonicalizeLeagueLabel('EPL'), 'Premier League')
  assert.deepEqual(getCanonicalLeagueQueryValues('Premier League'), ['premier league', 'english premier league', 'epl'])
  assert.deepEqual(snapshot.leagues, ['Premier League'])
  assert.deepEqual(snapshot.leaguesBySport, { Football: ['Premier League'] })
})
