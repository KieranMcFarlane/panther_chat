import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const appNavigationSource = readFileSync(
  new URL('../src/components/layout/AppNavigation.tsx', import.meta.url),
  'utf8'
)

const featureFlagsSource = readFileSync(
  new URL('../src/lib/feature-flags.ts', import.meta.url),
  'utf8'
)

test('business nav includes entity import route', () => {
  assert.match(appNavigationSource, /href:\s*'\/entity-import'/)
  assert.match(appNavigationSource, /label:\s*'CSV Import'/)
})

test('default business nav omits known technical routes', () => {
  assert.doesNotMatch(appNavigationSource, /href:\s*'\/sports-dashboard'/)
  assert.doesNotMatch(appNavigationSource, /href:\s*'\/agent-logs'/)
  assert.doesNotMatch(appNavigationSource, /href:\s*'\/sync-control'/)
  assert.doesNotMatch(appNavigationSource, /href:\s*'\/mcp-autonomous'/)
  assert.doesNotMatch(appNavigationSource, /href:\s*'\/mcp-test'/)
})

test('feature flags for technical and experimental graph pages remain available', () => {
  assert.match(featureFlagsSource, /isFeatureTechPagesEnabled/)
  assert.match(featureFlagsSource, /isFeatureExperimentalGraphEnabled/)
  assert.match(featureFlagsSource, /FEATURE_TECH_PAGES|NEXT_PUBLIC_FEATURE_TECH_PAGES/)
  assert.match(featureFlagsSource, /FEATURE_EXPERIMENTAL_GRAPH|NEXT_PUBLIC_FEATURE_EXPERIMENTAL_GRAPH/)
})
