import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityCardSource = readFileSync(new URL('../src/components/EntityCard.tsx', import.meta.url), 'utf8')
const dossierSummarySource = readFileSync(new URL('../src/lib/entity-dossier-summary.ts', import.meta.url), 'utf8')

test('entity cards surface persisted dossier progress and next action', () => {
  assert.match(entityCardSource, /getEntityDossierSummary/)
  assert.match(entityCardSource, /dossierSummary/)
  assert.match(entityCardSource, /Phase\s*\{dossierSummary\.phaseIndex/)
  assert.match(entityCardSource, /Next action:/)
})

test('entity dossier summary helper derives phase confidence freshness and question count', () => {
  assert.match(dossierSummarySource, /deriveDossierPhaseSnapshot/)
  assert.match(dossierSummarySource, /questionCount/)
  assert.match(dossierSummarySource, /confidence/)
  assert.match(dossierSummarySource, /nextAction/)
})
