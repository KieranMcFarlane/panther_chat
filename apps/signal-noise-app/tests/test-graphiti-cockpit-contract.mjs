import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const contractSource = readFileSync(new URL('../src/lib/home-graphiti-contract.ts', import.meta.url), 'utf8')
const homeGraphitiRouteSource = readFileSync(new URL('../src/app/api/home/graphiti-insights/route.ts', import.meta.url), 'utf8')

test('home graphiti contract supports mixed cockpit card classes and destinations', () => {
  assert.match(contractSource, /insight_type\??:\s*'opportunity'\s*\|\s*'watch_item'\s*\|\s*'operational'/)
  assert.match(contractSource, /destination_url\??:\s*string/)
})

test('home graphiti route uses protected ranked materialization instead of raw row ordering', () => {
  assert.match(homeGraphitiRouteSource, /requireApiSession/)
  assert.match(homeGraphitiRouteSource, /materializeGraphitiInsight/)
  assert.match(homeGraphitiRouteSource, /rankGraphitiInsights/)
})

test('graphiti notifications route exists and references entity and insight ids', () => {
  const routePath = new URL('../src/app/api/notifications/graphiti/route.ts', import.meta.url)
  assert.equal(existsSync(routePath), true)
  const routeSource = readFileSync(routePath, 'utf8')
  assert.match(routeSource, /insight_id/)
  assert.match(routeSource, /entity_id/)
  assert.match(routeSource, /destination_url/)
})

test('daily sales digest route exists and derives from the same materialized insight layer', () => {
  const routePath = new URL('../src/app/api/email/daily-sales-digest/route.ts', import.meta.url)
  assert.equal(existsSync(routePath), true)
  const routeSource = readFileSync(routePath, 'utf8')
  assert.match(routeSource, /buildSalesActionDigest/)
  assert.match(routeSource, /materializeGraphitiInsight|rankGraphitiInsights/)
})
