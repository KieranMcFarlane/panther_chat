import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LEGACY_MERGED_WIDE_RFP_RUN_ID,
  resolveLatestWideRfpResearchRecord,
  sortWideRfpResearchRecordsForDisplay,
} from '../src/lib/rfp-wide-research-store-selection.mjs'

test('latest wide RFP record prefers non-legacy signal batches over the legacy merged batch', () => {
  const selected = resolveLatestWideRfpResearchRecord([
    {
      run_id: LEGACY_MERGED_WIDE_RFP_RUN_ID,
      has_signal: true,
      batch: { run_id: LEGACY_MERGED_WIDE_RFP_RUN_ID, opportunities: [{ title: 'Old merged result' }] },
    },
    {
      run_id: 'yp-rfp-sweep-20260511-001',
      has_signal: true,
      batch: { run_id: 'yp-rfp-sweep-20260511-001', opportunities: [{ title: 'Recovered Manus result' }] },
    },
  ])

  assert.equal(selected.run_id, 'yp-rfp-sweep-20260511-001')
})

test('latest wide RFP record falls back to the legacy merged batch when no non-legacy signal exists', () => {
  const selected = resolveLatestWideRfpResearchRecord([
    {
      run_id: LEGACY_MERGED_WIDE_RFP_RUN_ID,
      has_signal: true,
      batch: { run_id: LEGACY_MERGED_WIDE_RFP_RUN_ID, opportunities: [{ title: 'Old merged result' }] },
    },
  ])

  assert.equal(selected.run_id, LEGACY_MERGED_WIDE_RFP_RUN_ID)
})

test('wide RFP record sorting lets recovered filesystem artifacts beat stale legacy DB rows', () => {
  const sorted = sortWideRfpResearchRecordsForDisplay([
    {
      run_id: LEGACY_MERGED_WIDE_RFP_RUN_ID,
      generated_at: '2026-04-13T12:23:48.420Z',
      has_signal: true,
      batch: { run_id: LEGACY_MERGED_WIDE_RFP_RUN_ID, opportunities: [{ title: 'Old merged result' }] },
    },
    {
      run_id: 'yp-rfp-sweep-20260511-001',
      generated_at: '2026-05-11T00:00:00Z',
      has_signal: true,
      batch: { run_id: 'yp-rfp-sweep-20260511-001', opportunities: [{ title: 'Recovered Manus result' }] },
    },
  ])

  assert.equal(sorted[0].run_id, 'yp-rfp-sweep-20260511-001')
})
