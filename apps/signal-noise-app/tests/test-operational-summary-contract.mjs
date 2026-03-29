import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildOperationalSummary } from '../src/lib/operational-summary.ts'

test('operational summary derives shell metrics from real subsystem state', () => {
  const summary = buildOperationalSummary({
    entitiesActive: 128,
    scout: {
      routeAvailable: false,
      activeRuns: 0,
    },
    enrichment: {
      isRunning: true,
      totalProcessed: 6,
      totalSuccessful: 4,
      totalFailed: 1,
    },
    pipeline: {
      activeRuns: 3,
      failedRuns: 2,
      recentCompleted: 5,
    },
    updatedAt: '2026-03-29T10:41:31.050Z',
  })

  assert.deepEqual(summary.cards, {
    entitiesActive: '128',
    pipelineLive: '3',
    blocked: '4',
    recentCompletions: '9',
  })

  assert.equal(summary.scout.statusLabel, 'Unavailable')
  assert.match(summary.scout.detail, /endpoint missing/i)
  assert.equal(summary.enrichment.statusLabel, 'Running')
  assert.match(summary.enrichment.detail, /6 processed/i)
  assert.equal(summary.pipeline.statusLabel, '3 active')
  assert.match(summary.pipeline.detail, /5 completed recently/i)
})
