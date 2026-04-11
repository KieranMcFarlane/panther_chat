import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('client nav source keeps only the canonical user-facing surfaces', async () => {
  const source = await readFile(new URL('../src/components/layout/discovery-nav.ts', import.meta.url), 'utf8')

  assert.match(source, /label: 'Home', href: '\/'/)
  assert.match(source, /label: 'Entities', href: '\/entity-browser'/)
  assert.match(source, /label: 'RFPs', href: '\/rfps'/)
  assert.match(source, /label: 'Opportunities', href: '\/opportunities'/)
  assert.match(source, /label: 'CSV Import', href: '\/entity-import'/)
  assert.match(source, /label: 'Search', href: '\/search'/)
  assert.doesNotMatch(source, /Enrichment/)
  assert.doesNotMatch(source, /Pipeline/)
})

test('client nav source keeps the expected item order', async () => {
  const source = await readFile(new URL('../src/components/layout/discovery-nav.ts', import.meta.url), 'utf8')
  const order = [
    "label: 'Home', href: '/'",
    "label: 'Entities', href: '/entity-browser'",
    "label: 'RFPs', href: '/rfps'",
    "label: 'Opportunities', href: '/opportunities'",
    "label: 'CSV Import', href: '/entity-import'",
    "label: 'Search', href: '/search'",
  ]

  let cursor = -1
  for (const entry of order) {
    const nextIndex = source.indexOf(entry)
    assert.ok(nextIndex > cursor, `${entry} should appear after the previous nav item`)
    cursor = nextIndex
  }
})

test('legacy operational nav groups are empty in the client shell config', async () => {
  const source = await readFile(new URL('../src/components/layout/discovery-nav.ts', import.meta.url), 'utf8')

  assert.match(source, /export const overviewNavItems = \[\] as const/)
  assert.match(source, /export const advancedOpsNavItems = \[\] as const/)
  assert.match(source, /export const supportNavItems = \[\] as const/)
})
