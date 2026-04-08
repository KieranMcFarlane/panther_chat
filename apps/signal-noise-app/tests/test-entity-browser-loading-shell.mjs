import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const clientPagePath = new URL('../src/app/entity-browser/client-page.tsx', import.meta.url)
const clientPageSource = readFileSync(clientPagePath, 'utf8')

test('entity browser loading state matches the page layout instead of a blank spinner', () => {
  assert.match(clientPageSource, /import \{ Skeleton \} from ['"]@\/components\/ui\/skeleton['"]/)
  assert.match(clientPageSource, /min-h-screen bg-background/)
  assert.match(clientPageSource, /initialEntitiesData\?: EntityBrowserResponse \| null/)
  assert.match(clientPageSource, /initialTaxonomy\?: EntitiesTaxonomyResponse \| null/)
  assert.match(clientPageSource, /useEntitiesBrowserData\([\s\S]*initialEntitiesData/)
  assert.match(clientPageSource, /useEntityTaxonomy\(initialTaxonomy\)/)
  assert.match(clientPageSource, /if \(entitiesLoading && !entitiesData && !initialEntitiesData\) \{/)
  assert.match(clientPageSource, /Hydrating entity browser from cached snapshot and taxonomy/)
  assert.match(clientPageSource, /Array\.from\(\{ length: 5 \}\)\.map/)
  assert.match(clientPageSource, /Array\.from\(\{ length: 6 \}\)\.map/)
})
