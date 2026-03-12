import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const loaderPath = new URL('../src/lib/entity-loader.ts', import.meta.url)
const dossierPagePath = new URL('../src/app/entity-browser/[entityId]/dossier/page.tsx', import.meta.url)
const dossierClientPath = new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url)

const loaderSource = readFileSync(loaderPath, 'utf8')
const dossierPageSource = readFileSync(dossierPagePath, 'utf8')
const dossierClientSource = readFileSync(dossierClientPath, 'utf8')

test('entity loader only reads dossier content from persisted entity_dossiers output', () => {
  assert.match(loaderSource, /from\('entity_dossiers'\)/)
  assert.match(loaderSource, /select\('dossier_data'\)/)
  assert.match(loaderSource, /getPersistedDossier/)
  assert.match(loaderSource, /getCanonicalDossierEntityId\(entity, entityId\)/)
  assert.match(loaderSource, /\.eq\('entity_id', entityId\)/)
  assert.doesNotMatch(loaderSource, /entity\.properties\.dossier_data/)
  assert.doesNotMatch(loaderSource, /backend', 'data', 'dossiers'/)
})

test('entity browser dossier page passes the persisted dossier into the client page and dossier router', () => {
  assert.match(dossierPageSource, /initialDossier=\{entityData\.dossier\}/)
  assert.match(dossierClientSource, /initialDossier\?: any \| null/)
  assert.match(dossierClientSource, /const \[dossier, setDossier\] = useState\(initialDossier\)/)
  assert.match(dossierClientSource, /fetch\(`\/api\/entities\/\$\{entityId\}\/dossier\?\$\{searchParams\.toString\(\)\}`/)
  assert.match(dossierClientSource, /method: shouldGenerate \? 'POST' : 'GET'/)
  assert.match(dossierClientSource, /<DossierError entityId=\{entityId\} error=\{generationError\} onRetry=\{handleRetryGeneration\} \/>/)
  assert.match(dossierClientSource, /dossier=\{dossier\}/)
})
