import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const clientSource = readFileSync(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

test('opportunity cards expose dossier-specific narrative instead of generic pipeline actions', () => {
  assert.match(clientSource, /Why this is an opportunity/)
  assert.match(clientSource, /Yellow Panther fit/)
  assert.match(clientSource, /Suggested action/)
  assert.match(clientSource, /Next steps/)
  assert.match(clientSource, /readMoreContext/)
  assert.match(clientSource, /Open dossier/)
  assert.match(clientSource, /signalSummary/)
})
