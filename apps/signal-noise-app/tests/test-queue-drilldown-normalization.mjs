import test from 'node:test'
import assert from 'node:assert/strict'

import {
  hasDistinctActiveFollowOnBatch,
  normalizeTerminalFollowOnMetadata,
} from '../src/lib/queue-drilldown-normalization.ts'

test('normalization clears self-referential follow-on metadata on terminal rows', () => {
  const normalized = normalizeTerminalFollowOnMetadata({
    batch_id: 'import_current',
    status: 'completed',
    next_repair_status: 'running',
    next_repair_batch_id: 'import_current',
    next_repair_batch_status: 'running',
  }, new Set())

  assert.equal(normalized.next_repair_status, null)
  assert.equal(normalized.next_repair_batch_id, null)
  assert.equal(normalized.next_repair_batch_status, null)
})

test('distinct active follow-on batch remains active', () => {
  const normalized = normalizeTerminalFollowOnMetadata({
    batch_id: 'import_current',
    status: 'completed',
    next_repair_status: 'running',
    next_repair_batch_id: 'import_next',
    next_repair_batch_status: 'running',
  }, new Set(['import_next']))

  assert.equal(normalized.next_repair_status, 'running')
  assert.equal(normalized.next_repair_batch_id, 'import_next')
  assert.equal(hasDistinctActiveFollowOnBatch(normalized, new Set(['import_next'])), true)
})
