import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const proofSetSource = readFileSync(new URL('../src/lib/rollout-proof-set.ts', import.meta.url), 'utf8')
const smokeConfigSource = readFileSync(new URL('../src/lib/client-smoke-config.ts', import.meta.url), 'utf8')
const questionFirstDossierSource = readFileSync(new URL('../src/lib/question-first-dossier.ts', import.meta.url), 'utf8')
const smokeSetSource = readFileSync(new URL('../src/lib/entity-smoke-set.ts', import.meta.url), 'utf8')

test('rollout proof set defines the explicit QA and validation source of truth', () => {
  assert.match(proofSetSource, /ROLLOUT_PROOF_SET/)
  assert.match(proofSetSource, /VALIDATION_ROLLOUT_PROOF_SET/)
  assert.match(proofSetSource, /role: 'validation'/)
  assert.match(proofSetSource, /b11d37c8-ece8-56d2-aa6e-757d0b8add7b/)
  assert.match(proofSetSource, /fedd8440-4082-5ce4-b07a-2d662a4c200e/)
  assert.match(proofSetSource, /fb43fc6d-5eb8-5826-8eab-06e75e44489f/)
})

test('client smoke config is derived from the rollout proof set instead of duplicating a separate list', () => {
  assert.match(smokeConfigSource, /ROLLOUT_PROOF_SET/)
  assert.match(smokeConfigSource, /PINNED_CLIENT_SMOKE_SET/)
})

test('validation-sample policy is driven by the explicit validation proof set and expected quality state', () => {
  assert.match(questionFirstDossierSource, /VALIDATION_ROLLOUT_PROOF_SET/)
  assert.match(questionFirstDossierSource, /expected_question_count/)
  assert.match(questionFirstDossierSource, /expected_quality_state/)
})

test('entity smoke journey still resolves canonical QA entities from the pinned smoke list', () => {
  assert.match(smokeSetSource, /PINNED_CLIENT_SMOKE_SET/)
  assert.match(smokeSetSource, /resolvePinnedSmokeEntities/)
})
