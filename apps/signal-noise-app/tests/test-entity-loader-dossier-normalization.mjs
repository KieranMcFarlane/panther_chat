import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeDossierPayload } from '../src/lib/dossier-normalization.ts'

test('normalizeDossierPayload parses JSON dossier strings into objects', () => {
  const payload = normalizeDossierPayload('{"core_info":{"name":"Arsenal"}}')

  assert.equal(typeof payload, 'object')
  assert.equal(payload?.core_info?.name, 'Arsenal')
})

test('normalizeDossierPayload preserves dossier objects', () => {
  const dossier = { core_info: { name: 'Arsenal' } }
  const payload = normalizeDossierPayload(dossier)

  assert.equal(payload, dossier)
  assert.equal(payload?.core_info?.name, 'Arsenal')
})

test('normalizeDossierPayload returns null for invalid dossier payloads', () => {
  assert.equal(normalizeDossierPayload('not-json'), null)
  assert.equal(normalizeDossierPayload(undefined), null)
  assert.equal(normalizeDossierPayload(null), null)
})
