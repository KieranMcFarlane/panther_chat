import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('dossier header browser uses the canonical entity taxonomy/search shell', async () => {
  const source = await readFile(new URL('../src/components/header/LeagueNavSimple.tsx', import.meta.url), 'utf8')

  assert.match(source, /FacetFilterBar/)
  assert.match(source, /useEntitiesBrowserData/)
  assert.match(source, /useEntityTaxonomy/)
  assert.match(source, /CommandInput/)
  assert.match(source, /label: 'Sport'/)
  assert.match(source, /label: 'Country'/)
  assert.match(source, /label: 'Competition'/)
  assert.match(source, /label: 'Role'/)
  assert.match(source, /label: 'Sort By'/)
  assert.match(source, /label: 'Sort Order'/)
  assert.doesNotMatch(source, /useVectorSearch/)
  assert.doesNotMatch(source, /useEntitySummaries/)
  assert.doesNotMatch(source, /label: 'Entity Type'/)
  assert.doesNotMatch(source, /placeholder: 'Entity Type'/)
  assert.doesNotMatch(source, /label: 'League'/)
  assert.doesNotMatch(source, /placeholder: 'League'/)
  assert.doesNotMatch(source, /Select Sport/)
  assert.doesNotMatch(source, /Browsing: All Sports/)
})
