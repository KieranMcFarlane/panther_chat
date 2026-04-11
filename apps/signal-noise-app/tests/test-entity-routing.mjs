import test from 'node:test'
import assert from 'node:assert/strict'

import { getEntityBrowserDossierHref, getEntityPrefetchId, resolveCanonicalEntityBrowserDossierId } from '../src/lib/entity-routing.js'

test('entity browser dossier href uses canonical entity id with page context', () => {
  const entity = {
    uuid: 'dbb4b0d7-68e4-49d7-929a-b1a0613454fd',
    id: '335',
    neo4j_id: '335'
  }

  assert.equal(
    getEntityBrowserDossierHref(entity, '1'),
    '/entity-browser/dbb4b0d7-68e4-49d7-929a-b1a0613454fd/dossier?from=1'
  )
})

test('entity prefetch id prefers canonical entity id', () => {
  const entity = {
    uuid: 'dbb4b0d7-68e4-49d7-929a-b1a0613454fd',
    id: '335',
    neo4j_id: '335'
  }

  assert.equal(
    getEntityPrefetchId(entity),
    'dbb4b0d7-68e4-49d7-929a-b1a0613454fd'
  )
})

test('entity routing canonicalizes non-uuid identifiers into a uuid dossier id', () => {
  const entity = {
    id: '335',
    neo4j_id: '335'
  }

  const href = getEntityBrowserDossierHref(entity, '2')
  assert.ok(href)
  assert.match(href, /^\/entity-browser\/[0-9a-f-]{36}\/dossier\?from=2$/i)
  assert.notEqual(href, '/entity-browser/335/dossier?from=2')

  const canonicalId = resolveCanonicalEntityBrowserDossierId(entity)
  assert.ok(canonicalId)
  assert.match(canonicalId, /^[0-9a-f-]{36}$/i)
  assert.notEqual(canonicalId, '335')
})

test('entity routing ignores undefined sentinel strings and falls back to stable ids', () => {
  const entity = {
    uuid: 'undefined',
    id: 'dbb4b0d7-68e4-49d7-929a-b1a0613454fd',
    neo4j_id: '335'
  }

  assert.equal(
    getEntityBrowserDossierHref(entity, '3'),
    '/entity-browser/dbb4b0d7-68e4-49d7-929a-b1a0613454fd/dossier?from=3'
  )
  assert.equal(
    getEntityPrefetchId(entity),
    'dbb4b0d7-68e4-49d7-929a-b1a0613454fd'
  )
})

test('entity routing preserves uuid-shaped identifiers as-is', () => {
  const entity = {
    id: 'dbb4b0d7-68e4-49d7-929a-b1a0613454fd',
  }

  assert.equal(
    getEntityBrowserDossierHref(entity, '4'),
    '/entity-browser/dbb4b0d7-68e4-49d7-929a-b1a0613454fd/dossier?from=4'
  )
  assert.equal(
    getEntityPrefetchId(entity),
    'dbb4b0d7-68e4-49d7-929a-b1a0613454fd'
  )
})

test('entity routing preserves slug strings for public dossier routes', () => {
  assert.equal(
    getEntityBrowserDossierHref('fc-porto-2027', '1'),
    '/entity-browser/fc-porto-2027/dossier?from=1'
  )
})

test('entity routing resolves known legacy arsenal uuids to the current canonical arsenal uuid', () => {
  const canonicalArsenalUuid = 'b61e07d3-b0e5-4d5c-908e-064de77eb955'

  for (const legacyUuid of [
    '7014d188-d031-5d67-a1cb-eadd127f9b67',
    'b11d37c8-ece8-56d2-aa6e-757d0b8add7b',
  ]) {
    const href = getEntityBrowserDossierHref({ id: legacyUuid }, '1')
    assert.equal(
      href,
      `/entity-browser/${canonicalArsenalUuid}/dossier?from=1`,
      `expected ${legacyUuid} to canonicalize to the live Arsenal UUID`,
    )
    assert.equal(
      getEntityPrefetchId({ id: legacyUuid }),
      canonicalArsenalUuid,
      `expected ${legacyUuid} to prefetch the live Arsenal UUID`,
    )
  }
})
