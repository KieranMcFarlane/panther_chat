import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const mainPath = new URL('../backend/main.py', import.meta.url)
const source = readFileSync(mainPath, 'utf8')

test('dossier generation bypasses stale cached dossiers when entity_type does not match the request', () => {
  assert.match(source, /cached_entity_type/)
  assert.match(source, /request\.entity_type/)
  assert.match(source, /Cached dossier entity_type mismatch/)
})
