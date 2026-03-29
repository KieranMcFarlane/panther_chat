import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildOperationalSummary } from '../src/lib/operational-summary.ts'

test('operational summary derives shell metrics from real subsystem state', () => {
  const summary = buildOperationalSummary({
    entitiesActive: 128,
    scout: {
      status: 'queued',
      activeRuns: 1,
      detail: 'Awaiting first scout artifact',
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
    blocked: '3',
    recentCompletions: '9',
  })

  assert.equal(summary.scout.statusLabel, 'Queued')
  assert.match(summary.scout.detail, /awaiting first scout artifact/i)
  assert.equal(summary.enrichment.statusLabel, 'Running')
  assert.match(summary.enrichment.detail, /6 processed/i)
  assert.equal(summary.pipeline.statusLabel, '3 active')
  assert.match(summary.pipeline.detail, /5 completed recently/i)
})

test('operational summary reports scout as ready when no artifact has landed yet', () => {
  const summary = buildOperationalSummary({
    entitiesActive: 10,
    scout: {
      status: 'active',
      activeRuns: 0,
      detail: 'scout lane is live and waiting for its first artifact.',
    },
    enrichment: {
      isRunning: false,
      totalProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
    },
    pipeline: {
      activeRuns: 0,
      failedRuns: 0,
      recentCompleted: 0,
    },
    updatedAt: '2026-03-29T10:41:31.050Z',
  })

  assert.equal(summary.scout.statusLabel, 'Ready')
  assert.equal(summary.cards.blocked, '0')
})
