import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const filterBarSource = readFileSync(new URL('../src/components/filters/FacetFilterBar.tsx', import.meta.url), 'utf8')
const entityBrowserSource = readFileSync(new URL('../src/app/entity-browser/client-page.tsx', import.meta.url), 'utf8')

test('facet filter bar centralizes select rendering and chip actions', () => {
  assert.match(filterBarSource, /export function FacetFilterBar\(/)
  assert.match(filterBarSource, /fields\.map\(\(field\) =>/)
  assert.match(filterBarSource, /field\.options\.map\(\(option\) =>/)
  assert.match(filterBarSource, /typeof option\.count === 'number'/)
  assert.match(filterBarSource, /chips\.map\(\(chip\) =>/)
  assert.match(filterBarSource, /actions\.map\(\(action\) =>/)
})

test('entity browser uses the shared facet filter bar instead of inline select markup', () => {
  assert.match(entityBrowserSource, /import \{ FacetFilterBar, type FacetFilterField \} from ["']@\/components\/filters\/FacetFilterBar["']/)
  assert.match(entityBrowserSource, /const filterFields: FacetFilterField\[] = \[/)
  assert.match(entityBrowserSource, /<FacetFilterBar/)
  assert.doesNotMatch(entityBrowserSource, /<Select value=\{filters\.entityType\}/)
  assert.doesNotMatch(entityBrowserSource, /<Select value=\{filters\.sport\}/)
})
