import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const homeRoutePath = new URL('../src/app/api/home/graphiti-insights/route.ts', import.meta.url)
const notificationsRoutePath = new URL('../src/app/api/notifications/graphiti/route.ts', import.meta.url)
const digestRoutePath = new URL('../src/app/api/email/daily-sales-digest/route.ts', import.meta.url)
const homeRouteSource = readFileSync(homeRoutePath, 'utf8')
const notificationsRouteSource = readFileSync(notificationsRoutePath, 'utf8')
const digestRouteSource = readFileSync(digestRoutePath, 'utf8')

test('graphiti homepage, notifications, and digest routes all use the shared persisted insight layer', () => {
  assert.match(homeRouteSource, /loadGraphitiInsights/)
  assert.match(notificationsRouteSource, /loadPersistedGraphitiNotifications|loadGraphitiInsights/)
  assert.match(digestRouteSource, /loadPersistedGraphitiInsights/)
})
