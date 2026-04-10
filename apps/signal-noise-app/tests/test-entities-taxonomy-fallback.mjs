import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const entitiesTaxonomySource = readFileSync(new URL('../src/lib/entities-taxonomy.ts', import.meta.url), 'utf8')

test('buildEntitiesTaxonomy deduplicates canonical facet keys instead of raw labels', () => {
  assert.match(entitiesTaxonomySource, /normalizeFacetKey/)
  assert.match(entitiesTaxonomySource, /normalizeFacetLabel/)
  assert.match(entitiesTaxonomySource, /isPreferredFacetLabel/)
  assert.match(entitiesTaxonomySource, /const sports = new Map<string, \{ label: string; count: number \}>/)
  assert.match(entitiesTaxonomySource, /const leaguesBySport = new Map<string, Map<string, \{ label: string; count: number \}>>/)
  assert.match(entitiesTaxonomySource, /const bumpFacet = \(bucket: Map<string, \{ label: string; count: number \}>, rawValue: unknown\)/)
  assert.match(entitiesTaxonomySource, /bumpNestedFacet\(leaguesBySport, sport, league\)/)
  assert.ok(entitiesTaxonomySource.includes('sports: [...sports.values()].sort'))
  assert.ok(entitiesTaxonomySource.includes('counts: {'))
  assert.ok(entitiesTaxonomySource.includes('sports: toSortedCountMap(sports)'))
})
