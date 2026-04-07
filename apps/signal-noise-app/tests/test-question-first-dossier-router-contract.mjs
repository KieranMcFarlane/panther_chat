import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routerPath = new URL('../src/components/entity-dossier/EntityDossierRouter.tsx', import.meta.url)
const routerSource = readFileSync(routerPath, 'utf8')

test('entity dossier router prefers the question-first tab renderer when canonical dossier tabs exist', () => {
  assert.match(routerSource, /QuestionFirstEntityDossier/)
  assert.match(routerSource, /dossier\?\.tabs/)
  assert.match(routerSource, /return <QuestionFirstEntityDossier/)
})
