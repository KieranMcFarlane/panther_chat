import assert from 'node:assert/strict'
import test from 'node:test'

import { isHighSignalGraphitiInsightRow } from '../src/lib/home-graphiti-feed.mjs'

test('filters out context refresh rows without a strong signal basis', () => {
  assert.equal(
    isHighSignalGraphitiInsightRow({
      title: 'Arsenal FC: pipeline context refreshed',
      confidence: 0.31,
      raw_payload: {
        validated_signal_count: 0,
        signal_basis: 'context_refresh',
      },
    }),
    false,
  )
})

test('keeps validated question-first rows', () => {
  assert.equal(
    isHighSignalGraphitiInsightRow({
      title: 'Arsenal FC: fan engagement opportunity signal',
      confidence: 0.84,
      raw_payload: {
        validated_signal_count: 0,
        signal_basis: 'question_first',
      },
    }),
    true,
  )
})
