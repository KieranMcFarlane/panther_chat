import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/lib/canonical-entities-snapshot.ts', import.meta.url), 'utf8')

test('canonical entities snapshot prefers Supabase in hosted production instead of a stale local export', () => {
  assert.match(source, /process\.env\.VERCEL|process\.env\.VERCEL_ENV|NODE_ENV/)
  assert.match(source, /'supabase'|"supabase"/)
})
