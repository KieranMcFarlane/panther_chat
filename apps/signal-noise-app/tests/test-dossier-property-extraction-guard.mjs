import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const collectorPath = new URL('../backend/dossier_data_collector.py', import.meta.url)
const source = readFileSync(collectorPath, 'utf8')

test('dossier property extraction normalizes missing model content before regex parsing', () => {
  assert.match(source, /result\.get\('content', ''\)\s+or\s+''/)
})
