import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const entitiesTaxonomySource = readFileSync(new URL('../src/lib/entities-taxonomy.ts', import.meta.url), 'utf8')
const sportsHierarchySource = readFileSync(new URL('../src/lib/sports-hierarchy-taxonomy.mjs', import.meta.url), 'utf8')

test('buildEntitiesTaxonomy deduplicates canonical facet keys instead of raw labels', () => {
  assert.match(entitiesTaxonomySource, /normalizeFacetKey/)
  assert.match(entitiesTaxonomySource, /normalizeFacetLabel/)
  assert.match(entitiesTaxonomySource, /isPreferredFacetLabel/)
  assert.match(entitiesTaxonomySource, /shouldIncludeInSportsHierarchy/)
  assert.match(entitiesTaxonomySource, /const sports = new Map<string, \{ label: string; count: number \}>/)
  assert.match(entitiesTaxonomySource, /const entityRoles = new Map<string, \{ label: string; count: number \}>/)
  assert.match(entitiesTaxonomySource, /const leaguesBySport = new Map<string, Map<string, \{ label: string; count: number \}>>/)
  assert.match(entitiesTaxonomySource, /const bumpFacet = \(bucket: Map<string, \{ label: string; count: number \}>, rawValue: unknown\)/)
  assert.match(entitiesTaxonomySource, /bumpNestedFacet\(leaguesBySport, sport, league\)/)
  assert.match(entitiesTaxonomySource, /if \(inSportsHierarchy\)/)
  assert.match(entitiesTaxonomySource, /getCanonicalEntityRole/)
  assert.ok(entitiesTaxonomySource.includes('entityRoles: [...entityRoles.values()].sort'))
  assert.ok(entitiesTaxonomySource.includes('sports: [...sports.values()].sort'))
  assert.ok(entitiesTaxonomySource.includes('counts: {'))
  assert.ok(entitiesTaxonomySource.includes('sports: toSortedCountMap(sports)'))
})

test('sports hierarchy helper exposes the strict role gate and backfill shape', () => {
  assert.match(sportsHierarchySource, /export function shouldIncludeInSportsHierarchy\(/)
  assert.match(sportsHierarchySource, /export function buildCanonicalLeagueLookup\(/)
  assert.match(sportsHierarchySource, /export function buildSportsHierarchyBackfill\(/)
  assert.match(sportsHierarchySource, /SPORTS_HIERARCHY_ROLES/)
  assert.match(sportsHierarchySource, /shouldClearHierarchy/)
})
