import test from 'node:test'
import assert from 'node:assert/strict'

import { getEntityBrowserDossierHref, getEntityPrefetchId } from '../src/lib/entity-routing.js'

test('entity browser dossier href uses canonical entity id with page context', () => {
  const entity = {
    id: 'dbb4b0d7-68e4-49d7-929a-b1a0613454fd',
    neo4j_id: '335'
  }

  assert.equal(
    getEntityBrowserDossierHref(entity, '1'),
    '/entity-browser/dbb4b0d7-68e4-49d7-929a-b1a0613454fd/dossier?from=1'
  )
})

test('entity prefetch id prefers canonical entity id', () => {
  const entity = {
    id: 'dbb4b0d7-68e4-49d7-929a-b1a0613454fd',
    neo4j_id: '335'
  }

  assert.equal(
    getEntityPrefetchId(entity),
    'dbb4b0d7-68e4-49d7-929a-b1a0613454fd'
  )
})

test('entity routing falls back to neo4j id when canonical id is unavailable', () => {
  const entity = {
    neo4j_id: '335'
  }

  assert.equal(
    getEntityBrowserDossierHref(entity, '2'),
    '/entity-browser/335/dossier?from=2'
  )
  assert.equal(getEntityPrefetchId(entity), '335')
})
