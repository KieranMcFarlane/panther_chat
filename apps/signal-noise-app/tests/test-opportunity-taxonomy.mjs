import assert from 'node:assert/strict'
import test from 'node:test'

import { buildOpportunityFacetOptions, normalizeOpportunityTaxonomy } from '../src/lib/opportunity-taxonomy.mjs'

test('competition aliases collapse to a single canonical label', () => {
  const premierLeague = normalizeOpportunityTaxonomy({ title: 'Fan platform', organization: 'Premier League' })
  const englishPremierLeague = normalizeOpportunityTaxonomy({ title: 'Fan platform', organization: 'English Premier League' })
  const epl = normalizeOpportunityTaxonomy({ title: 'Fan platform', organization: 'EPL' })

  assert.equal(premierLeague.competition, 'Premier League')
  assert.equal(englishPremierLeague.competition, 'Premier League')
  assert.equal(epl.competition, 'Premier League')

  const facetOptions = buildOpportunityFacetOptions([
    { taxonomy: premierLeague },
    { taxonomy: englishPremierLeague },
    { taxonomy: epl },
  ])

  assert.deepEqual(
    facetOptions.competition.map((option) => option.value),
    ['all', 'Premier League'],
  )
})

test('sport is not inferred from a free-text category label', () => {
  const taxonomy = normalizeOpportunityTaxonomy({
    title: 'Digital fan platform',
    organization: 'Yellow Panther',
    category: 'Digital Transformation',
  })

  assert.equal(taxonomy.sport, '')
  assert.equal(taxonomy.competition, '')
  assert.equal(taxonomy.theme, 'Digital Transformation')
})

test('league, tournament, and federation style opportunities remain distinct', () => {
  const opportunities = [
    normalizeOpportunityTaxonomy({ title: 'Premier League digital partnership', organization: 'Premier League' }),
    normalizeOpportunityTaxonomy({ title: 'Wimbledon digital engagement', organization: 'All England Lawn Tennis Association' }),
    normalizeOpportunityTaxonomy({ title: 'World Athletics results service', organization: 'World Athletics' }),
  ]

  assert.equal(opportunities[0].entity_role, 'League')
  assert.equal(opportunities[1].entity_role, 'Tournament')
  assert.equal(opportunities[2].entity_role, 'Federation')

  const facetOptions = buildOpportunityFacetOptions(opportunities.map((taxonomy) => ({ taxonomy })))
  assert.deepEqual(
    facetOptions.competition.map((option) => option.value),
    ['all', 'Premier League', 'Wimbledon', 'World Athletics'],
  )
})

test('generic procurement text does not falsely match epl inside peaceplus', () => {
  const taxonomy = normalizeOpportunityTaxonomy({
    title: 'CA17462 - RFQ 2025/73 - PEACEPLUS Community Led Shared History Culture Programme Sacred Spaces of Slieve Gullion',
    organization: 'Newry, Mourne and Down District Council (NMD)',
    description: 'The Newry, Mourne & Down District Council (NMDDC) Action Plan "Thriving Together" has been developed by the PEACEPLUS Partnership.',
    category: 'Government Procurement',
    source: 'rfp_opportunities',
  })

  assert.equal(taxonomy.sport, '')
  assert.equal(taxonomy.competition, '')
  assert.equal(taxonomy.entity_role, '')
  assert.equal(taxonomy.opportunity_kind, 'RFP')
})
