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
  assert.match(loaderSource, /normalizeDossierPayload/)
  assert.match(loaderSource, /from\('entity_dossiers'\)/)
  assert.match(loaderSource, /select\('dossier_data'\)/)
  assert.match(loaderSource, /if \(!dossier\)/)
  assert.match(loaderSource, /getPersistedDossier/)
})

test('entity loader searches the app-local premium and standard dossier stores before giving up', () => {
  assert.match(loaderSource, /from ['"]@\/lib\/dossier-paths['"]/)
  assert.match(loaderSource, /getDossierRoots/)
  assert.match(loaderSource, /findDossierFile/)
  assert.match(loaderSource, /findDossierByNamePattern/)
  assert.match(loaderSource, /candidateTierDirs/)
})

test('entity browser dossier page passes the persisted dossier into the client page and dossier router', () => {
  assert.match(dossierPageSource, /from ['"]@\/lib\/dossier-paths['"]/)
  assert.match(dossierPageSource, /const fallbackData = entityData\.entity \? null : await loadDossierFallback\(entityId, tier\)/)
  assert.match(dossierPageSource, /initialEntity=\{entity\}/)
  assert.match(dossierPageSource, /initialDossier=\{dossier\}/)
  assert.match(dossierClientSource, /initialDossier\?: any \| null/)
  assert.match(dossierClientSource, /setDossier\(initialDossier\)/)
  assert.match(dossierClientSource, /dossier=\{dossier\}/)
})
