import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCanonicalEntitySearchText, buildCanonicalOpportunitySearchText, matchesCanonicalSearch } from '../src/lib/canonical-search.ts'

test('canonical entity search text includes name, role, sport, country, and league context', () => {
  const text = buildCanonicalEntitySearchText({
    labels: ['Club'],
    properties: {
      name: 'Arsenal',
      sport: 'Football',
      country: 'England',
      league: 'Premier League',
      type: 'Club',
    },
  })

  assert.match(text, /arsenal/)
  assert.match(text, /club/)
  assert.match(text, /football/)
  assert.match(text, /england/)
  assert.match(text, /premier league/)
  assert.ok(matchesCanonicalSearch('arsenal england premier', text))
  assert.ok(matchesCanonicalSearch('football league', text))
})

test('canonical opportunity search text includes sport, competition, role, kind, theme, and tags', () => {
  const text = buildCanonicalOpportunitySearchText({
    title: 'Digital fan platform',
    organization: 'Premier League',
    description: 'Fan engagement and ticketing',
    sport: 'Football',
    competition: 'Premier League',
    entity_role: 'League',
    opportunity_kind: 'RFP',
    theme: 'Fan Engagement',
    tags: ['mobile', 'app'],
    keywords: ['platform', 'crm'],
  })

  assert.match(text, /digital fan platform/)
  assert.match(text, /premier league/)
  assert.match(text, /football/)
  assert.match(text, /league/)
  assert.match(text, /fan engagement/)
  assert.match(text, /mobile/)
  assert.ok(matchesCanonicalSearch('premier league fan', text))
  assert.ok(matchesCanonicalSearch('mobile app', text))
})
