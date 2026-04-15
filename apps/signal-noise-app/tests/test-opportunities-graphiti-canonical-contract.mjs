import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../src/app/opportunities/page.tsx', import.meta.url), 'utf8')
const clientSource = readFileSync(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')
const readModelSource = readFileSync(new URL('../src/lib/graphiti-opportunity-read-model.ts', import.meta.url), 'utf8')

test('opportunities page reads the canonical Graphiti opportunities API and keeps the page server-gated', () => {
  assert.match(pageSource, /requirePageSession\('\/opportunities'\)/)
  assert.match(clientSource, /fetch\(['"]\/api\/opportunities['"]/)
  assert.doesNotMatch(clientSource, /\/api\/tenders\?action=opportunities/)
  assert.doesNotMatch(pageSource, /useSearchParams/)
  assert.match(readModelSource, /isDemoOriginOpportunityRow/)
  assert.doesNotMatch(readModelSource, /readFile/)
  assert.doesNotMatch(readModelSource, /loadDossierNarrative/)
})
