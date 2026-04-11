import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const shellSource = readFileSync(new URL('../src/components/filters/SharedFilterShell.tsx', import.meta.url), 'utf8')
const facetBarSource = readFileSync(new URL('../src/components/filters/FacetFilterBar.tsx', import.meta.url), 'utf8')

test('shared filter shell exposes the reusable page-agnostic contract', () => {
  assert.match(shellSource, /export interface SharedFilterShellProps/)
  assert.match(shellSource, /searchSlot\?: ReactNode/)
  assert.match(shellSource, /fields: .*FacetFilterField/)
  assert.match(shellSource, /actions\?: .*FacetFilterAction/)
  assert.match(shellSource, /chips\?: .*FacetFilterChip/)
  assert.match(shellSource, /status\?: ReactNode/)
  assert.match(shellSource, /CardContent/)
  assert.match(shellSource, /gridClassName/)
})

test('facet filter bar is a thin wrapper over the shared shell', () => {
  assert.match(facetBarSource, /import \{ SharedFilterShell, type SharedFilterShellProps \} from ["']\.\/SharedFilterShell["']/)
  assert.match(facetBarSource, /return <SharedFilterShell/)
  assert.doesNotMatch(facetBarSource, /<Card className=/)
})
