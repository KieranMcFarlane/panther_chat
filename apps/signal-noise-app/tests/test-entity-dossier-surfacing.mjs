import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const loaderPath = new URL('../src/lib/entity-loader.ts', import.meta.url)
const dossierPagePath = new URL('../src/app/entity-browser/[entityId]/dossier/page.tsx', import.meta.url)
const dossierClientPath = new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url)

const loaderSource = readFileSync(loaderPath, 'utf8')
const dossierPageSource = readFileSync(dossierPagePath, 'utf8')
const dossierClientSource = readFileSync(dossierClientPath, 'utf8')

test('entity loader falls back to persisted entity_dossiers when cached entity properties lack dossier_data', () => {
  assert.match(loaderSource, /from\('entity_dossiers'\)/)
  assert.match(loaderSource, /select\('dossier_data, created_at, generated_at'\)/)
  assert.match(loaderSource, /if \(!dossier\)/)
  assert.match(loaderSource, /getPersistedDossier/)
})

test('entity loader does not search filesystem dossier stores on surfaced reads', () => {
  assert.doesNotMatch(loaderSource, /DOSSIERS_DIR/)
  assert.doesNotMatch(loaderSource, /candidateTierDirs/)
  assert.doesNotMatch(loaderSource, /readFile/)
})

test('entity loader no longer synthesizes browser entities from question-first artifacts', () => {
  assert.doesNotMatch(loaderSource, /resolveCanonicalQuestionFirstDossier/)
  assert.doesNotMatch(loaderSource, /source: 'dossier-file'/)
  assert.doesNotMatch(loaderSource, /dossier_data: JSON\.stringify\(dossier\)/)
})

test('entity browser dossier page passes the persisted dossier into the client page and dossier router', () => {
  assert.match(dossierPageSource, /initialDossier=\{entityData\.dossier\}/)
  assert.match(dossierClientSource, /initialDossier\?: any \| null/)
  assert.match(dossierClientSource, /setDossier\(initialDossier\)/)
  assert.match(dossierClientSource, /<EntityDossierRouter[\s\S]*dossier=\{dossier\}/)
})
