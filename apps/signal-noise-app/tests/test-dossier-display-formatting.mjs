import assert from 'node:assert/strict'
import test from 'node:test'

import { formatValue } from '../src/lib/formatValue.ts'

test('formatValue preserves Neo4j integer-like year values instead of treating them as timestamps', () => {
  assert.equal(formatValue({ low: 1886, high: 0 }), '1886')
})

test('formatValue renders ISO timestamps as readable dates', () => {
  assert.match(formatValue('2025-11-17T16:11:38.982Z'), /2025|Nov|11\/17/)
})
