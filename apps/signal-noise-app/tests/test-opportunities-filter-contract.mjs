import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const opportunitiesSource = readFileSync(new URL('../src/app/opportunities/page.tsx', import.meta.url), 'utf8')

test('opportunities page uses the shared filter shell for its filters', () => {
  assert.match(opportunitiesSource, /import \{ FacetFilterBar, type FacetFilterField \} from ["']@\/components\/filters\/FacetFilterBar["']/)
  assert.match(opportunitiesSource, /import \{ Command, CommandInput \} from ["']@\/components\/ui\/command["']/)
  assert.match(opportunitiesSource, /const filterFields: FacetFilterField\[] = \[/)
  assert.match(opportunitiesSource, /<FacetFilterBar/)
  assert.match(opportunitiesSource, /<CommandInput/)
  assert.doesNotMatch(opportunitiesSource, /<Select value=\{typeFilter\}/)
  assert.doesNotMatch(opportunitiesSource, /<Select value=\{sportFilter\}/)
  assert.doesNotMatch(opportunitiesSource, /<Select value=\{scoreFilter\}/)
})
