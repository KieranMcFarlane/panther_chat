import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const leaguesRouteSource = readFileSync(new URL('../src/app/api/leagues/route.ts', import.meta.url), 'utf8')
const teamsRouteSource = readFileSync(new URL('../src/app/api/teams/route.ts', import.meta.url), 'utf8')
const sportsDirectorySource = readFileSync(new URL('../src/lib/sports-directory.ts', import.meta.url), 'utf8')

test('sports directory is derived from the canonical snapshot rather than mock rows', () => {
  assert.match(sportsDirectorySource, /getCanonicalEntitiesSnapshot/)
  assert.match(sportsDirectorySource, /buildSportsDirectory/)
  assert.match(sportsDirectorySource, /isLeagueEntity/)
  assert.match(sportsDirectorySource, /isTeamEntity/)
  assert.match(sportsDirectorySource, /normalizeLeagueAssociation/)
})

test('league and team routes are powered by canonical snapshot projections instead of mocks', () => {
  assert.match(leaguesRouteSource, /getCanonicalEntitiesSnapshot/)
  assert.match(leaguesRouteSource, /isLeagueEntity/)
  assert.match(leaguesRouteSource, /buildLeagueRecord/)
  assert.match(teamsRouteSource, /getSportsDirectorySnapshot/)
  assert.doesNotMatch(leaguesRouteSource, /mockLeagues/)
  assert.doesNotMatch(leaguesRouteSource, /executeSupabaseQuery/)
  assert.doesNotMatch(teamsRouteSource, /mockTeams/)
  assert.doesNotMatch(teamsRouteSource, /executeSupabaseQuery/)
})
