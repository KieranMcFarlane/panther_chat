import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/app/api/rfp-wide-research/manus-webhook/route.ts', import.meta.url), 'utf8')

test('Manus scheduled webhook verifies a shared secret and extracts task ids', () => {
  assert.match(source, /MANUS_WEBHOOK_SECRET/)
  assert.match(source, /RFP_MANUS_WEBHOOK_SECRET/)
  assert.match(source, /timingSafeEqual/)
  assert.match(source, /x-manus-webhook-secret/)
  assert.match(source, /Authorization/)
  assert.match(source, /task_id/)
  assert.match(source, /taskId/)
  assert.match(source, /task_url/)
  assert.match(source, /manus\\\.im\\\/app/)
})

test('Manus scheduled webhook supports RSA-SHA256 signed payload verification', () => {
  assert.match(source, /MANUS_WEBHOOK_PUBLIC_KEY/)
  assert.match(source, /RSA-SHA256/)
  assert.match(source, /request\.text\(\)/)
  assert.match(source, /crypto\.verify/)
  assert.match(source, /x-manus-signature/)
  assert.match(source, /x-signature/)
  assert.match(source, /manus-signature/)
  assert.match(source, /signature_verified_by:\s*signatureVerifiedBy/)
  assert.match(source, /return 'rsa'/)
})

test('Manus scheduled webhook imports through the canonical wide research pipeline', () => {
  assert.match(source, /\/api\/rfp-wide-research/)
  assert.match(source, /manusTaskId:\s*taskId/)
  assert.match(source, /currentRfpPage:\s*'\/rfps'/)
  assert.match(source, /currentIntakePage:\s*'\/rfps'/)
  assert.match(source, /researchMode/)
  assert.match(source, /researchDepth/)
  assert.match(source, /focusArea/)
  assert.match(source, /opportunities/)
  assert.match(source, /source:\s*'manus_webhook'/)
})
