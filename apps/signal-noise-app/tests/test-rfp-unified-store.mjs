import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/lib/rfp-unified-store.ts', import.meta.url), 'utf8')

test('unified rfp store reads the canonical unified table', () => {
  assert.match(source, /rfp_opportunities_unified/)
  assert.match(source, /loadUnifiedRfpOpportunities/)
  assert.match(source, /getSupabaseAdmin/)
  assert.match(source, /detected_at/)
  assert.match(source, /normalizeUnifiedRfpOpportunity/)
})
