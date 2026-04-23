import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const clientSource = readFileSync(
  new URL('../src/lib/operational-drilldown-client.ts', import.meta.url),
  'utf8',
)

test('operational drilldown client uses a bounded cache with refresh invalidation', () => {
  assert.match(clientSource, /OPERATIONAL_DRILLDOWN_CACHE_TTL_MS/)
  assert.match(clientSource, /4_000/)
  assert.match(clientSource, /cachedOperationalDrilldownFetchedAt/)
  assert.match(clientSource, /isOperationalDrilldownCacheFresh/)
  assert.match(clientSource, /cachedOperationalDrilldownFetchedAt < OPERATIONAL_DRILLDOWN_CACHE_TTL_MS/)
  assert.match(clientSource, /refreshOperationalDrilldownPayload/)
  assert.match(clientSource, /cachedOperationalDrilldownPayload = null/)
  assert.match(clientSource, /cachedOperationalDrilldownFetchedAt = 0/)
  assert.match(clientSource, /inFlightOperationalDrilldownRequest = fetch\('/)
})

test('operational drilldown client persists the last known payload for reload hydration', () => {
  assert.match(clientSource, /sessionStorage/)
  assert.match(clientSource, /OPERATIONAL_DRILLDOWN_STORAGE_KEY/)
  assert.match(clientSource, /JSON\.parse/)
  assert.match(clientSource, /JSON\.stringify/)
  assert.match(clientSource, /getCachedOperationalDrilldownPayload/)
})
