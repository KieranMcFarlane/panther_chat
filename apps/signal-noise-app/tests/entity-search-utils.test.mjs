import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canonicalEntityType,
  readLeague,
  normalizeName,
  lexicalNameScore,
  extractVectorMetadata,
  computeHybridScore,
} from '../src/lib/entity-search-utils.js'

test('canonicalEntityType maps noisy labels/types into canonical taxonomy', () => {
  assert.equal(canonicalEntityType({ labels: ['Entity', 'Club'], properties: { type: 'Sports Club/Team' } }), 'team')
  assert.equal(canonicalEntityType({ labels: ['League'], properties: { type: 'League' } }), 'league')
  assert.equal(canonicalEntityType({ labels: ['Entity'], properties: { type: 'International Federation' } }), 'federation')
  assert.equal(canonicalEntityType({ labels: ['Organization'], properties: { type: 'Rights Holder' } }), 'rights_holder')
  assert.equal(canonicalEntityType({ labels: ['Organization'], properties: { type: 'Organization' } }), 'organisation')
})

test('readLeague uses league first, then level fallback', () => {
  assert.equal(readLeague({ league: 'Premier League', level: 'ignored' }), 'Premier League')
  assert.equal(readLeague({ level: 'Indian Premier League' }), 'Indian Premier League')
  assert.equal(readLeague({}), '')
})

test('normalizeName normalizes punctuation/spacing/case', () => {
  assert.equal(normalizeName('  Rajasthan Royals! '), 'rajasthan royals')
  assert.equal(normalizeName('World-Athletics'), 'world athletics')
})

test('lexicalNameScore prioritizes exact over prefix over contains', () => {
  assert.ok(lexicalNameScore('rajasthan royals', 'Rajasthan Royals') > lexicalNameScore('raj', 'Rajasthan Royals'))
  assert.ok(lexicalNameScore('raj', 'Rajasthan Royals') > lexicalNameScore('roy', 'Rajasthan Royals'))
})

test('extractVectorMetadata can read nested metadata.properties', () => {
  const meta = extractVectorMetadata({
    sport: null,
    league: null,
    metadata: {
      properties: {
        sport: 'Cricket',
        level: 'Indian Premier League',
        type: 'Club',
      },
    },
  })

  assert.equal(meta.sport, 'Cricket')
  assert.equal(meta.league, 'Indian Premier League')
  assert.equal(meta.type, 'team')
})

test('computeHybridScore boosts facet matches and exact lexical matches above pure vector matches', () => {
  const exact = computeHybridScore({
    query: 'Rajasthan Royals',
    name: 'Rajasthan Royals',
    vectorSimilarity: 0.2,
    facets: { sport: 'Cricket', entityType: 'team', league: 'Indian Premier League' },
    candidate: { labels: ['Club'], properties: { sport: 'Cricket', level: 'Indian Premier League', type: 'Club' } },
  })

  const vectorOnly = computeHybridScore({
    query: 'Rajasthan Royals',
    name: 'Rajasthan',
    vectorSimilarity: 0.9,
    facets: { sport: 'Cricket', entityType: 'team', league: 'Indian Premier League' },
    candidate: { labels: ['Entity'], properties: { sport: 'Cricket', type: 'Entity' } },
  })

  assert.ok(exact > vectorOnly)
})
