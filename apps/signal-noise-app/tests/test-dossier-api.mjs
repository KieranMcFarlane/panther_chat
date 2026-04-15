import test from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = 'http://localhost:3005'

test('GET /api/dossier returns 410 and points callers at the canonical entity dossier route', async () => {
  const response = await fetch(`${BASE_URL}/api/dossier`)
  assert.equal(response.status, 410)

  const data = await response.json()
  assert.equal(data.status, 'gone')
  assert.equal(data.canonical_route, '/api/entities/[entityId]/dossier')
})

test('POST /api/dossier returns 410 and does not perform dossier generation', async () => {
  const response = await fetch(`${BASE_URL}/api/dossier`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_ids: ['arsenal-fc'] }),
  })
  assert.equal(response.status, 410)
})

test('GET /api/dossier/file returns 410 and blocks filesystem-backed dossier reads', async () => {
  const response = await fetch(`${BASE_URL}/api/dossier/file?entity_id=arsenal-fc&tier=premium`)
  assert.equal(response.status, 410)

  const data = await response.json()
  assert.equal(data.status, 'gone')
  assert.equal(data.canonical_route, '/api/entities/[entityId]/dossier')
})
