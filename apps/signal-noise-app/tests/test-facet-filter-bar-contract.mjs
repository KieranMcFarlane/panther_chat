import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'

const filterBarSource = readFileSync(new URL('../src/components/filters/FacetFilterBar.tsx', import.meta.url), 'utf8')
const entityBrowserSource = readFileSync(new URL('../src/app/entity-browser/client-page.tsx', import.meta.url), 'utf8')
const commandSource = readFileSync(new URL('../src/components/ui/command.tsx', import.meta.url), 'utf8')

test('facet filter bar centralizes select rendering and chip actions', () => {
  assert.match(filterBarSource, /import \{ SharedFilterShell, type SharedFilterShellProps \} from ["']\.\/SharedFilterShell["']/)
  assert.match(filterBarSource, /export type \{ FacetFilterAction, FacetFilterChip, FacetFilterField, FacetFilterOption \} from ["']\.\/SharedFilterShell["']/)
  assert.match(filterBarSource, /export function FacetFilterBar\(/)
  assert.match(filterBarSource, /return <SharedFilterShell \{\.\.\.props\} \/>/)
  assert.doesNotMatch(filterBarSource, /fields\.map\(\(field\) =>/)
  assert.doesNotMatch(filterBarSource, /chips\.map\(\(chip\) =>/)
})

test('entity browser uses the shared facet filter bar instead of inline select markup', () => {
  assert.match(entityBrowserSource, /import \{ FacetFilterBar, type FacetFilterField \} from ["']@\/components\/filters\/FacetFilterBar["']/)
  assert.match(entityBrowserSource, /const filterFields: FacetFilterField\[] = \[/)
  assert.match(entityBrowserSource, /label: 'Role'/)
  assert.match(entityBrowserSource, /<FacetFilterBar/)
  assert.match(entityBrowserSource, /import \{ Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList \} from ["']@\/components\/ui\/command["']/)
  assert.match(entityBrowserSource, /<CommandInput/)
  assert.match(entityBrowserSource, /<CommandList/)
  assert.doesNotMatch(entityBrowserSource, /<Select value=\{filters\.entityType\}/)
  assert.doesNotMatch(entityBrowserSource, /<Select value=\{filters\.sport\}/)
})

test('command component is available as the shadcn search primitive', () => {
  assert.match(commandSource, /import \* as React from "react"/)
  assert.match(commandSource, /CommandPrimitive/)
  assert.match(commandSource, /CommandInput/)
  assert.match(commandSource, /CommandList/)
  assert.match(commandSource, /CommandItem/)
})

test('canonical opportunity taxonomy helper is available for shared normalization', async () => {
  const helperSource = await readFile(new URL('../src/lib/opportunity-taxonomy.mjs', import.meta.url), 'utf8')
  assert.match(helperSource, /function normalizeOpportunityTaxonomy\(/)
  assert.match(helperSource, /function buildOpportunityFacetOptions\(/)
  assert.match(helperSource, /function getOpportunityTaxonomyDisplayValues\(/)
})
