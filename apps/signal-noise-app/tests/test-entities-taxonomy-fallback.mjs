import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const entitiesTaxonomySource = readFileSync(new URL('../src/lib/entities-taxonomy.ts', import.meta.url), 'utf8')

test('buildEntitiesTaxonomy derives taxonomy from entity snapshots', () => {
  assert.match(entitiesTaxonomySource, /export function buildEntitiesTaxonomy\(entities: any\[], options:/)
  assert.match(entitiesTaxonomySource, /const sport = normalizeLabel\(properties\.sport\)/)
  assert.match(entitiesTaxonomySource, /const league = normalizeLabel\(properties\.league\)/)
  assert.match(entitiesTaxonomySource, /federationsRightsHolders\[entityName\] = \(federationsRightsHolders\[entityName\] \|\| 0\) \+ 1/)
  assert.match(entitiesTaxonomySource, /leaguesBySport: leagueMap/)
  assert.match(entitiesTaxonomySource, /counts: \{/)
})
