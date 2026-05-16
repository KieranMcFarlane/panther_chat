import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const routeUrl = new URL('../src/app/api/admin/manus-usage/route.ts', import.meta.url)

test('manus usage route exists and protects the Manus API key behind admin auth', () => {
  assert.equal(existsSync(routeUrl), true, 'expected /api/admin/manus-usage route to exist')

  const source = readFileSync(routeUrl, 'utf8')
  assert.match(source, /requireApiSession\(request\)/)
  assert.match(source, /process\.env\.MANUS_API/)
  assert.match(source, /x-manus-api-key/)
  assert.doesNotMatch(source, /apiKey['"]?\s*:/)
})

test('manus usage route reads team usage and recent task credit telemetry', () => {
  const source = readFileSync(routeUrl, 'utf8')

  assert.match(source, /https:\/\/api\.manus\.ai\/v2\/usage\.teamLog/)
  assert.match(source, /https:\/\/api\.manus\.ai\/v2\/task\.list/)
  assert.match(source, /credit_usage/)
  assert.match(source, /recent_tasks/)
  assert.match(source, /MANUS_MONTHLY_CREDIT_LIMIT/)
  assert.match(source, /estimated_remaining/)
})

test('manus usage route returns graceful unavailable states', () => {
  const source = readFileSync(routeUrl, 'utf8')

  assert.match(source, /buildUnavailableSummary\('manus_api_not_configured', false\)/)
  assert.match(source, /available:\s*Boolean\(manualSnapshot\)/)
  assert.match(source, /team_usage_unavailable/)
  assert.match(source, /usage_unavailable/)
})

test('manus usage route supports a manual Pro credit snapshot fallback', () => {
  const source = readFileSync(routeUrl, 'utf8')

  assert.match(source, /MANUS_CREDIT_SNAPSHOT_TOTAL/)
  assert.match(source, /MANUS_CREDIT_SNAPSHOT_MONTHLY_USED/)
  assert.match(source, /MANUS_CREDIT_SNAPSHOT_MONTHLY_LIMIT/)
  assert.match(source, /MANUS_CREDIT_SNAPSHOT_DAILY_REFRESH_REMAINING/)
  assert.match(source, /MANUS_CREDIT_SNAPSHOT_DAILY_REFRESH_LIMIT/)
  assert.match(source, /manual_snapshot/)
  assert.match(source, /task_telemetry/)
})
