import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  advancedOpsNavItems,
  overviewNavItems,
  primaryNavItems,
  supportNavItems,
} from '../src/components/layout/discovery-nav.ts'

test('workflow nav keeps only the primary user-facing surfaces in the main lane', () => {
  assert.deepEqual(
    primaryNavItems.map((item) => [item.label, item.href]),
    [
      ['Entities', '/entity-browser'],
      ["RFP's/Tenders", '/tenders'],
      ['Opportunities', '/opportunities'],
    ],
  )
})

test('advanced ops keeps scout and the thinner operational pages available', () => {
  assert.deepEqual(advancedOpsNavItems.map((item) => [item.label, item.href]), [
    ['Enrichment', '/entity-enrichment'],
    ['Pipeline', '/entity-pipeline'],
  ])
})

test('overview and support nav stay intentionally slim', () => {
  assert.deepEqual(overviewNavItems.map((item) => [item.label, item.href]), [
    ['Home', '/'],
  ])

  assert.deepEqual(supportNavItems.map((item) => [item.label, item.href]), [
    ['Import CSV', '/entity-import'],
  ])
})
