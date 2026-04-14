import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const clientSource = readFileSync(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

test('opportunity cards expose an inline read more disclosure for dossier details', () => {
  assert.match(clientSource, /Read more/)
  assert.match(clientSource, /Read less/)
  assert.match(clientSource, /openOpportunityId/)
  assert.match(clientSource, /readMoreContext/)
})
