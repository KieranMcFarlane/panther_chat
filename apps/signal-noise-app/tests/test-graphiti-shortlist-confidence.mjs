import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('../src/lib/graphiti-shortlist.ts', import.meta.url), 'utf8')

test('mixed shortlist confidence normalization handles both percentage and decimal source values', () => {
  assert.match(source, /export function normalizeConfidence/)
  assert.match(source, /if \(raw > 1\) return Math\.max\(0, Math\.min\(1, raw \/ 100\)\)/)
  assert.match(source, /return Math\.max\(0, Math\.min\(1, raw\)\)/)
})
