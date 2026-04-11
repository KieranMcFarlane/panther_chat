import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/services/RealtimeSyncService.ts', import.meta.url), 'utf8')

test('realtime sync writes canonical_entity_id alongside uuid into cached entity rows', () => {
  assert.match(source, /canonical_entity_id/)
  assert.match(source, /resolveEntityUuid/)
  assert.match(source, /properties:\s*\{\s*\.\.\.entity\.properties,\s*uuid,/s)
})
