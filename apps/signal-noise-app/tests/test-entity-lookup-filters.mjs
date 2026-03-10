import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const helperSource = readFileSync(
  new URL('../src/lib/entity-lookup.ts', import.meta.url),
  'utf8'
)
const entityApiSource = readFileSync(
  new URL('../src/app/api/entities/[entityId]/route.ts', import.meta.url),
  'utf8'
)
const entityLoaderSource = readFileSync(
  new URL('../src/lib/entity-loader.ts', import.meta.url),
  'utf8'
)
const entitySearchRouteSource = readFileSync(
  new URL('../src/app/api/entities/search/route.ts', import.meta.url),
  'utf8'
)
const entityBrowserClientSource = readFileSync(
  new URL('../src/app/entity-browser/client-page.tsx', import.meta.url),
  'utf8'
)

test('entity lookup helper only adds uuid id filters when the entity id is a uuid', () => {
  assert.match(helperSource, /isUuidLike/)
  assert.match(helperSource, /buildGraphEntityLookupFilter\(entityId\)/)
})

test('entity detail lookups reuse the shared lookup helper for cached_entities queries', () => {
  assert.match(entityApiSource, /resolveEntityForDossier\(entityId\)/)
  assert.match(entityLoaderSource, /resolveEntityForDossier\(entityId\)/)
})

test('entities search route supports bounded first-load metadata and autocomplete mode', () => {
  assert.match(entitySearchRouteSource, /searchParams\.get\('mode'\)/)
  assert.match(entitySearchRouteSource, /mode === 'autocomplete'/)
  assert.match(entitySearchRouteSource, /const defaultLimit = mode === 'autocomplete' \?/)
  assert.match(entitySearchRouteSource, /has_more:/)
  assert.match(entitySearchRouteSource, /total_estimate:/)
  assert.match(entitySearchRouteSource, /latency_ms:/)
})

test('entity browser uses autocomplete endpoint and defers full dataset refresh until apply', () => {
  assert.match(entityBrowserClientSource, /\/api\/entities\/search\?mode=autocomplete/)
  assert.match(entityBrowserClientSource, /setAppliedSearchTerm\(/)
  assert.match(entityBrowserClientSource, /buildEntityQueryParams\(page, appliedSearchTerm\)/)
  assert.match(entityBrowserClientSource, /Sort By[\s\S]*Popular/)
})
