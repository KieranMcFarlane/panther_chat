import assert from 'node:assert/strict'
import { test } from 'node:test'

const baseUrl = process.env.SNA_RUNTIME_BASE_URL || 'http://localhost:3005'

test('entity browser runtime HTML includes workflow shell and advanced ops navigation', async () => {
  const response = await fetch(`${baseUrl}/entity-browser`)

  assert.equal(response.status, 200)

  const html = await response.text()
  assert.match(html, /Live Ops/)
  assert.match(html, /Workflow/)
  assert.match(html, /Advanced Ops/)
  assert.match(html, /RFP&#x27;s\/Tenders|RFP&apos;s\/Tenders|RFP's\/Tenders/)
})
