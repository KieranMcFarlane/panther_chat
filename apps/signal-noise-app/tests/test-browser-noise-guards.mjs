import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entitiesRoutePath = new URL('../src/app/api/entities/route.ts', import.meta.url)
const entitySummaryRoutePath = new URL('../src/app/api/entities/summary/route.ts', import.meta.url)
const canonicalSnapshotPath = new URL('../src/lib/canonical-entities-snapshot.ts', import.meta.url)
const entityBadgePath = new URL('../src/components/badge/EntityBadge.tsx', import.meta.url)
const badgeServicePath = new URL('../src/services/badge-service.ts', import.meta.url)

const entitiesRouteSource = readFileSync(entitiesRoutePath, 'utf8')
const entitySummaryRouteSource = readFileSync(entitySummaryRoutePath, 'utf8')
const canonicalSnapshotSource = readFileSync(canonicalSnapshotPath, 'utf8')
const entityBadgeSource = readFileSync(entityBadgePath, 'utf8')
const badgeServiceSource = readFileSync(badgeServicePath, 'utf8')

test('entity browser API preserves badge metadata for client rendering', () => {
  assert.match(entitiesRouteSource, /const resolvedBadgeUrl = resolveLocalBadgeUrl\(\{/)
  assert.match(entitiesRouteSource, /badge_s3_url: resolvedBadgeUrl/)
  assert.match(entitiesRouteSource, /badge_lookup_complete: true/)
  assert.match(entitiesRouteSource, /badge_path: resolvedBadgeUrl/)
  assert.match(entitiesRouteSource, /badge_s3_url: resolvedBadgeUrl/)
})

test('entity browser APIs use a shared cached canonical snapshot instead of rescanning Supabase each request', () => {
  assert.match(entitiesRouteSource, /import \{ getCanonicalEntitiesSnapshot \} from ['"]@\/lib\/canonical-entities-snapshot['"]/)
  assert.match(entitySummaryRouteSource, /import \{ getCanonicalEntitiesSnapshot \} from ['"]@\/lib\/canonical-entities-snapshot['"]/)
  assert.match(entitiesRouteSource, /const canonicalEntities = await getCanonicalEntitiesSnapshot\(\)/)
  assert.match(entitySummaryRouteSource, /const canonicalEntities = await getCanonicalEntitiesSnapshot\(\)/)
  assert.match(canonicalSnapshotSource, /const SNAPSHOT_TTL_MS = 15 \* 60_000/)
  assert.match(canonicalSnapshotSource, /export async function prewarmCanonicalEntitiesSnapshot\(\): Promise<void>/)
  assert.match(canonicalSnapshotSource, /await getCanonicalEntitiesSnapshot\(\)/)
  assert.match(canonicalSnapshotSource, /let canonicalEntitiesCache: \{ entities: CanonicalEntity\[]; expiresAt: number \} \| null = null/)
  assert.match(canonicalSnapshotSource, /let inFlightCanonicalEntitiesRequest: Promise<CanonicalEntity\[]> \| null = null/)
  assert.match(canonicalSnapshotSource, /while \(hasMore\)/)
  assert.match(canonicalSnapshotSource, /canonicalEntitiesCache = \{/)
  assert.doesNotMatch(entitiesRouteSource, /while \(hasMore\)/)
  assert.doesNotMatch(entitySummaryRouteSource, /while \(hasMore\)/)
})

test('entity badge prefers explicit entity badge URLs before probing badge mappings', () => {
  assert.match(entityBadgeSource, /const explicitBadgeUrl =/)
  assert.match(entityBadgeSource, /const isBadgeLookupComplete =/)
  assert.match(entityBadgeSource, /entity\?\.badge_s3_url \|\|/)
  assert.match(entityBadgeSource, /entity\?\.badge_lookup_complete \|\|/)
  assert.match(entityBadgeSource, /entity\?\.properties\?\.badge_s3_url \|\|/)
  assert.match(entityBadgeSource, /entity\?\.properties\?\.badge_lookup_complete \|\|/)
  assert.match(entityBadgeSource, /entity\?\.properties\?\.badge_path \|\|/)
  assert.match(entityBadgeSource, /if \(explicitBadgeUrl\) \{\s*setBadgeUrl\(explicitBadgeUrl\)/)
  assert.match(entityBadgeSource, /if \(isBadgeLookupComplete\) \{\s*setBadgeUrl\(null\)/)
})

test('badge service caches misses and deduplicates in-flight lookups', () => {
  assert.match(badgeServiceSource, /private cache: Map<string, \{ data: BadgeMapping \| null; timestamp: number \}> = new Map\(\)/)
  assert.match(badgeServiceSource, /private inFlightRequests: Map<string, Promise<BadgeMapping \| null>> = new Map\(\)/)
  assert.match(badgeServiceSource, /private badgeExistenceCache: Map<string, \{ exists: boolean; timestamp: number \}> = new Map\(\)/)
  assert.match(badgeServiceSource, /private inFlightBadgeExistenceChecks: Map<string, Promise<boolean>> = new Map\(\)/)
  assert.match(badgeServiceSource, /const inFlightRequest = this\.inFlightRequests\.get\(cacheKey\)/)
  assert.match(badgeServiceSource, /const lookupPromise = this\.lookupBadgeMapping\(entityId, entityName, cacheKey\)/)
  assert.match(badgeServiceSource, /const cachedExistence = this\.badgeExistenceCache\.get\(badgeFilename\)/)
  assert.match(badgeServiceSource, /const inFlightCheck = this\.inFlightBadgeExistenceChecks\.get\(badgeFilename\)/)
  assert.match(badgeServiceSource, /return cacheMapping\(mapping \|\| null\)/)
})
