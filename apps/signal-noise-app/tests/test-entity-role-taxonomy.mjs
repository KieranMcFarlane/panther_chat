import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const entityRoleTaxonomySource = readFileSync(new URL('../src/lib/entity-role-taxonomy.ts', import.meta.url), 'utf8')
const entityBrowserDataSource = readFileSync(new URL('../src/lib/entity-browser-data.ts', import.meta.url), 'utf8')
const sportsEntitiesRouteSource = readFileSync(new URL('../src/app/api/sports-entities/route.ts', import.meta.url), 'utf8')

test('canonical entity roles are derived from labels, names, and type hints', () => {
  assert.match(entityRoleTaxonomySource, /export function getCanonicalEntityRole\(/)
  assert.match(entityRoleTaxonomySource, /export function isLeagueLikeEntity\(/)
  assert.match(entityRoleTaxonomySource, /export function isTeamLikeEntity\(/)
  assert.match(entityRoleTaxonomySource, /return 'League'/)
  assert.match(entityRoleTaxonomySource, /return 'Competition'/)
  assert.match(entityRoleTaxonomySource, /return 'Federation'/)
  assert.match(entityRoleTaxonomySource, /return 'Organization'/)
})

test('entity browser page data filters and search against canonical roles alongside sport and country', () => {
  assert.match(entityBrowserDataSource, /getCanonicalEntityRole/)
  assert.match(entityBrowserDataSource, /canonicalEntityRole/)
  assert.match(entityBrowserDataSource, /properties\.sport/)
  assert.match(entityBrowserDataSource, /properties\.country/)
  assert.match(entityBrowserDataSource, /entity_role: canonicalEntityRole/)
})

test('sports entities endpoint supports canonical role plus sport and country filtering', () => {
  assert.match(sportsEntitiesRouteSource, /getCanonicalEntityRole/)
  assert.match(sportsEntitiesRouteSource, /const sport = \(searchParams.get\('sport'\) \|\| ''\)\.trim\(\)\.toLowerCase\(\)/)
  assert.match(sportsEntitiesRouteSource, /const country = \(searchParams.get\('country'\) \|\| ''\)\.trim\(\)\.toLowerCase\(\)/)
  assert.match(sportsEntitiesRouteSource, /entity_role: getCanonicalEntityRole\(entity\)/)
})
