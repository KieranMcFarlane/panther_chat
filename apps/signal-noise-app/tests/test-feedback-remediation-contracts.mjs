import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entitiesRouteSource = readFileSync(
  new URL('../src/app/api/entities/route.ts', import.meta.url),
  'utf8'
)
const entitiesTaxonomyRouteSource = readFileSync(
  new URL('../src/app/api/entities/taxonomy/route.ts', import.meta.url),
  'utf8'
)
const tendersRouteSource = readFileSync(
  new URL('../src/app/api/tenders/route.ts', import.meta.url),
  'utf8'
)
const conventionsCalendarSource = readFileSync(
  new URL('../src/components/calendar/ConventionCalendar.tsx', import.meta.url),
  'utf8'
)
const leagueDiagnosticsRouteSource = readFileSync(
  new URL('../src/app/api/admin/league-membership-completeness/route.ts', import.meta.url),
  'utf8'
)

test('entities route accepts expanded discovery filters', () => {
  assert.match(entitiesRouteSource, /searchParams\.get\('sport'\)/)
  assert.match(entitiesRouteSource, /searchParams\.get\('league'\)/)
  assert.match(entitiesRouteSource, /searchParams\.get\('country'\)/)
  assert.match(entitiesRouteSource, /searchParams\.get\('entityClass'\)/)
  assert.match(entitiesRouteSource, /filters:\s*\{\s*[\s\S]*sport,[\s\S]*league,[\s\S]*country,[\s\S]*entityClass,/)
})

test('entities taxonomy route returns live normalized taxonomy slices', () => {
  assert.match(entitiesTaxonomyRouteSource, /sports:/)
  assert.match(entitiesTaxonomyRouteSource, /leagues:/)
  assert.match(entitiesTaxonomyRouteSource, /countries:/)
  assert.match(entitiesTaxonomyRouteSource, /entityClasses:/)
  assert.match(entitiesTaxonomyRouteSource, /federationsRightsHolders:/)
  assert.match(entitiesTaxonomyRouteSource, /leaguesBySport:/)
})

test('tenders export includes sport and source_url columns and filter support', () => {
  assert.match(tendersRouteSource, /searchParams\.get\('sport'\)/)
  assert.match(tendersRouteSource, /searchParams\.get\('source'\)/)
  assert.match(tendersRouteSource, /searchParams\.get\('search'\)/)
  assert.match(tendersRouteSource, /'title,organization,value,status,source,deadline,category,sport,yellow_panther_fit,confidence,priority_score,contact,source_url'/)
})

test('conventions calendar no longer hard-locks API fetch to current year', () => {
  assert.doesNotMatch(conventionsCalendarSource, /year:\s*currentDate\.getFullYear\(\)\.toString\(\)/)
  assert.match(conventionsCalendarSource, /View controls are always available above the calendar: Month, Week, List\./)
  assert.match(conventionsCalendarSource, /windowConventions/)
})

test('admin diagnostics route reports league membership completeness discrepancies', () => {
  assert.match(leagueDiagnosticsRouteSource, /leagueClubCountsExpected/)
  assert.match(leagueDiagnosticsRouteSource, /leagueClubCountsActual/)
  assert.match(leagueDiagnosticsRouteSource, /discrepancies/)
  assert.match(leagueDiagnosticsRouteSource, /clubs_missing_league/)
  assert.match(leagueDiagnosticsRouteSource, /leagues_incomplete/)
})
