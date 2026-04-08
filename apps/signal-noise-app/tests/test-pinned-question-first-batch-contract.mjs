import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const manifestPath = new URL('../backend/data/question_first_pinned_client_smoke_batch.json', import.meta.url)
const handoverPath = new URL('../../../docs/plans/2026-04-08-production-cockpit-handover.md', import.meta.url)

test('pinned client smoke batch manifest exists with the five client-facing entities', () => {
  assert.equal(existsSync(manifestPath), true, 'pinned smoke batch manifest should exist')
  const payload = JSON.parse(readFileSync(manifestPath, 'utf8'))
  assert.equal(payload.schema_version, 'question_first_scale_batch_v1')
  assert.equal(payload.batch_name, 'question-first-pinned-client-smoke')
  assert.match(JSON.stringify(payload.entities), /Arsenal Football Club/)
  assert.match(JSON.stringify(payload.entities), /Coventry City/)
  assert.match(JSON.stringify(payload.entities), /Zimbabwe Cricket/)
  assert.match(JSON.stringify(payload.entities), /Major League Cricket/)
  assert.match(JSON.stringify(payload.entities), /Zimbabwe Handball Federation/)
})

test('production handover notes the pinned manifest as the canonical regeneration path', () => {
  const source = readFileSync(handoverPath, 'utf8')
  assert.match(source, /question_first_pinned_client_smoke_batch\.json/)
})
