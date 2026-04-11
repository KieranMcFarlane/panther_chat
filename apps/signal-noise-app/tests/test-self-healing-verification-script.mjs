import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const scriptPath = new URL('../scripts/verify_self_healing_repair_loop.mjs', import.meta.url)

test('self-healing verification script exists and prints the bounded repair loop checks', () => {
  assert.equal(existsSync(scriptPath), true)
  const source = readFileSync(scriptPath, 'utf8')
  assert.match(source, /fc-porto-2027/)
  assert.match(source, /f16e501a-c750-4450-9238-847e8d4b3f8a/)
  assert.match(source, /q11_decision_owner/)
  assert.match(source, /q7_procurement_signal/)
  assert.match(source, /publication/i)
  assert.match(source, /reconciliation/i)
  assert.match(source, /next repair/i)
  assert.match(source, /planned/i)
  assert.match(source, /queued/i)
  assert.match(source, /running/i)
  assert.match(source, /slug-vs-uuid collapse/i)
  assert.match(source, /active repair batches/i)
  assert.match(source, /no duplicate equivalent batch/i)
  assert.match(source, /canonical uuid/i)
  assert.match(source, /PASS|FAIL/)
})
