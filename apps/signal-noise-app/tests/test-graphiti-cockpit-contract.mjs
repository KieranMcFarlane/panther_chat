import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const contractSource = readFileSync(new URL('../src/lib/home-graphiti-contract.ts', import.meta.url), 'utf8')
const homeGraphitiRouteSource = readFileSync(new URL('../src/app/api/home/graphiti-insights/route.ts', import.meta.url), 'utf8')
const homeGraphitiLoaderSource = readFileSync(new URL('../src/lib/graphiti-insight-loader.ts', import.meta.url), 'utf8')
const materializerSource = readFileSync(new URL('../src/lib/graphiti-insight-materializer.ts', import.meta.url), 'utf8')

test('home graphiti contract supports mixed cockpit card classes and destinations', () => {
  assert.match(contractSource, /insight_type\??:\s*'opportunity'\s*\|\s*'watch_item'\s*\|\s*'operational'/)
  assert.match(contractSource, /destination_url\??:\s*string/)
})

test('home graphiti route uses protected ranked materialization instead of raw row ordering', () => {
  assert.match(homeGraphitiRouteSource, /requireApiSession/)
  assert.match(homeGraphitiRouteSource, /loadGraphitiInsights/)
  assert.doesNotMatch(homeGraphitiRouteSource, /insight\.insight_type !== 'opportunity'/)
})

test('home graphiti route fails soft to an empty payload instead of returning a client-breaking error shape', () => {
  assert.match(homeGraphitiRouteSource, /buildEmptyGraphitiInsightsResponse/)
  assert.match(homeGraphitiRouteSource, /highlights:\s*\[\]/)
  assert.match(homeGraphitiRouteSource, /related_entities:\s*\[\]/)
  assert.match(homeGraphitiRouteSource, /\{\s*status:\s*200\s*\}/)
})

test('homepage graphiti loader excludes operational refresh cards from client-facing highlights', () => {
  assert.match(materializerSource, /context refreshed/)
  assert.match(materializerSource, /no validated signals remained/)
  assert.match(homeGraphitiLoaderSource, /filterClientFacingGraphitiInsights/)
  assert.match(homeGraphitiLoaderSource, /clientFacingOnly:\s*true/)
  assert.match(homeGraphitiLoaderSource, /loadGraphitiOpportunitiesFromDb/)
  assert.match(homeGraphitiLoaderSource, /opportunitiesResponse\.opportunities\.map\(normalizeOpportunityForHomeFeed\)[\s\S]{0,180}\.\.\.persisted\.highlights/)
  assert.match(homeGraphitiLoaderSource, /opportunityEntityIds/)
  assert.match(homeGraphitiLoaderSource, /insightType !== 'opportunity'/)
  assert.doesNotMatch(homeGraphitiLoaderSource, /getDemoGraphitiInsights/)
  assert.doesNotMatch(homeGraphitiLoaderSource, /allowDemoFallbacks/)
})

test('graphiti notifications route exists and references entity and insight ids', () => {
  const routePath = new URL('../src/app/api/notifications/graphiti/route.ts', import.meta.url)
  assert.equal(existsSync(routePath), true)
  const routeSource = readFileSync(routePath, 'utf8')
  assert.match(routeSource, /loadPersistedGraphitiNotifications|loadGraphitiInsights/)
  assert.match(routeSource, /destination_url/)
  assert.match(routeSource, /markGraphitiNotificationsRead/)
})

test('daily sales digest route exists and derives from the same materialized insight layer', () => {
  const routePath = new URL('../src/app/api/email/daily-sales-digest/route.ts', import.meta.url)
  assert.equal(existsSync(routePath), true)
  const routeSource = readFileSync(routePath, 'utf8')
  assert.match(routeSource, /buildSalesActionDigest/)
  assert.match(routeSource, /loadPersistedGraphitiInsights/)
  assert.match(routeSource, /markGraphitiNotificationsSent/)
})

test('graphiti materializer treats context-refreshed low-signal rows as operational items with a default action', () => {
  assert.match(materializerSource, /context refreshed/)
  assert.match(materializerSource, /no validated signals remained/)
  assert.match(materializerSource, /Review the dossier, inspect missing evidence, and rerun the account if a stronger signal is needed\./)
})
