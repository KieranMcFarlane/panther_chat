import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const persistenceSource = readFileSync(new URL('../src/lib/graphiti-opportunity-persistence.ts', import.meta.url), 'utf8')

test('graphiti opportunity loader pulls dossier-backed signals as canonical candidates', () => {
  assert.match(persistenceSource, /getDossierRoots/)
  assert.match(persistenceSource, /normalizeQuestionFirstDossier/)
  assert.match(persistenceSource, /graphiti_sales_brief/)
  assert.match(persistenceSource, /yellow_panther_opportunity/)
  assert.match(persistenceSource, /question_first_dossier/)
})
