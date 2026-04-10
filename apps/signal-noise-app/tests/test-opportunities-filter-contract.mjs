import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const opportunitiesSource = readFileSync(new URL('../src/app/opportunities/page.tsx', import.meta.url), 'utf8')

test('opportunities page uses the shared filter shell for its filters', () => {
  assert.match(opportunitiesSource, /import \{ FacetFilterBar, type FacetFilterField \} from ["']@\/components\/filters\/FacetFilterBar["']/)
  assert.match(opportunitiesSource, /import \{ Command, CommandInput \} from ["']@\/components\/ui\/command["']/)
  assert.match(opportunitiesSource, /buildOpportunityFacetOptions/)
  assert.match(opportunitiesSource, /normalizeOpportunityTaxonomy/)
  assert.match(opportunitiesSource, /const filterFields: FacetFilterField\[] = \[/)
  assert.match(opportunitiesSource, /<FacetFilterBar/)
  assert.match(opportunitiesSource, /<CommandInput/)
  assert.match(opportunitiesSource, /label: 'Competition'/)
  assert.match(opportunitiesSource, /label: 'Role'/)
  assert.match(opportunitiesSource, /label: 'Opportunity Kind'/)
  assert.match(opportunitiesSource, /label: 'Theme'/)
  assert.match(opportunitiesSource, /Canonical context:/)
  assert.doesNotMatch(opportunitiesSource, /typeFilter/)
  assert.doesNotMatch(opportunitiesSource, /<Select value=\{typeFilter\}/)
})
