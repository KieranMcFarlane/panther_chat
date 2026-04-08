import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routerPath = new URL('../src/components/entity-dossier/EntityDossierRouter.tsx', import.meta.url)
const routerSource = readFileSync(routerPath, 'utf8')
const clientPagePath = new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url)
const clientPageSource = readFileSync(clientPagePath, 'utf8')

test('entity dossier router prefers the question-first tab renderer when canonical dossier tabs exist', () => {
  assert.match(routerSource, /QuestionFirstEntityDossier/)
  assert.match(routerSource, /dossier\?\.tabs/)
  assert.match(routerSource, /return <QuestionFirstEntityDossier/)
})

test('entity dossier client page does not auto-queue generation on initial view without explicit generate intent', () => {
  assert.match(clientPageSource, /if \(!entity \|\| !shouldGenerate\) return/)
  assert.match(clientPageSource, /Canonical dossier not ready/)
  assert.match(clientPageSource, /legacy dossier views are intentionally hidden on this route/)
})
