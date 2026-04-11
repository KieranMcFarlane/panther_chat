import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const configSource = readFileSync(new URL('../src/lib/client-smoke-config.ts', import.meta.url), 'utf8')
const proofSetSource = readFileSync(new URL('../src/lib/rollout-proof-set.ts', import.meta.url), 'utf8')
const smokeSetSource = readFileSync(new URL('../src/lib/entity-smoke-set.ts', import.meta.url), 'utf8')

test('client smoke set is pinned to three explicit qa uuids', () => {
  assert.match(configSource, /PINNED_CLIENT_SMOKE_SET/)
  assert.match(configSource, /ROLLOUT_PROOF_SET/)
  assert.match(proofSetSource, /entity_uuid:/)
  assert.match(proofSetSource, /b11d37c8-ece8-56d2-aa6e-757d0b8add7b/)
  assert.match(proofSetSource, /fb43fc6d-5eb8-5826-8eab-06e75e44489f/)
  assert.match(proofSetSource, /fedd8440-4082-5ce4-b07a-2d662a4c200e/)
  assert.doesNotMatch(proofSetSource, /1db6d6eb-89c5-5c9f-95cb-217d0985a176/)
  assert.doesNotMatch(proofSetSource, /a01fa763-6170-5f62-912b-cedd1363a804/)
})

test('smoke set resolution uses pinned uuids instead of name-based demo lookup', () => {
  assert.match(smokeSetSource, /PINNED_CLIENT_SMOKE_SET/)
  assert.match(smokeSetSource, /definition\.entity_uuid/)
  assert.match(smokeSetSource, /definition\.aliases/)
  assert.match(smokeSetSource, /resolvePinnedSmokeEntities/)
  assert.match(smokeSetSource, /entityId: resolveEntityUuid\(entity\) \|\| String\(entity\.id\)/)
  assert.match(smokeSetSource, /qualityState/)
})
