import assert from 'node:assert/strict'
import test from 'node:test'

const baseUrl = process.env.SNA_RUNTIME_BASE_URL || 'http://localhost:3005'

test('tenders API high-offset requests fail safely without throwing a server exception', async () => {
  const response = await fetch(`${baseUrl}/api/tenders?limit=100&offset=200`)

  assert.notEqual(response.status, 500)

  const payload = await response.json()
  assert.ok(Array.isArray(payload.opportunities))
  assert.equal(typeof payload.total, 'number')
})
