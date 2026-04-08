import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('client nav source keeps only the canonical user-facing surfaces', async () => {
  const source = await readFile(new URL('../src/components/layout/discovery-nav.ts', import.meta.url), 'utf8')

  assert.match(source, /label: 'Home', href: '\/'/)
  assert.match(source, /label: 'Entities', href: '\/entity-browser'/)
  assert.match(source, /label: 'Opportunities', href: '\/opportunities'/)
  assert.doesNotMatch(source, /RFP's\/Tenders/)
  assert.doesNotMatch(source, /Enrichment/)
  assert.doesNotMatch(source, /Pipeline/)
  assert.doesNotMatch(source, /Import CSV/)
})

test('legacy operational nav groups are empty in the client shell config', async () => {
  const source = await readFile(new URL('../src/components/layout/discovery-nav.ts', import.meta.url), 'utf8')

  assert.match(source, /export const overviewNavItems = \[\] as const/)
  assert.match(source, /export const advancedOpsNavItems = \[\] as const/)
  assert.match(source, /export const supportNavItems = \[\] as const/)
})
