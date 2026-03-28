import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const homePageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
const mixedRoutePath = new URL('../src/app/api/home/graphiti-shortlist/route.ts', import.meta.url)
const mixedComponentPath = new URL('../src/components/home/GraphitiMixedShortlist.tsx', import.meta.url)
const mixedHelperSource = readFileSync(new URL('../src/lib/graphiti-shortlist.ts', import.meta.url), 'utf8')

test('home page mounts a mixed Graphiti shortlist surface', () => {
  assert.match(homePageSource, /GraphitiMixedShortlist/)
  assert.equal(existsSync(mixedRoutePath), true)
  assert.equal(existsSync(mixedComponentPath), true)

  const mixedRouteSource = readFileSync(mixedRoutePath, 'utf8')
  const mixedComponentSource = readFileSync(mixedComponentPath, 'utf8')

  assert.match(mixedRouteSource, /loadGraphitiMixedShortlist/)
  assert.match(mixedHelperSource, /loadGraphitiOpportunities/)
  assert.match(mixedHelperSource, /loadGraphitiInsightsWithPersistence/)
  assert.match(mixedHelperSource, /clientFacingOnly:\s*false/)
  assert.match(mixedComponentSource, /graphiti-shortlist/)
  assert.match(mixedComponentSource, /opportunity|watch_item|operational/)
})
