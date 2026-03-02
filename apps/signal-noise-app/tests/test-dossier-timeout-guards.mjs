import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const proxySource = readFileSync(
  new URL('../src/app/api/dossiers/generate/route.ts', import.meta.url),
  'utf8'
)

const clubDossierSource = readFileSync(
  new URL('../src/components/entity-dossier/EnhancedClubDossier.tsx', import.meta.url),
  'utf8'
)

test('dossier proxy applies a finite timeout to backend generation', () => {
  assert.match(proxySource, /const DOSSIER_PROXY_TIMEOUT_MS = Number\(process\.env\.DOSSIER_PROXY_TIMEOUT_MS \|\| 15000\)/)
  assert.match(proxySource, /signal: AbortSignal\.timeout\(DOSSIER_PROXY_TIMEOUT_MS\)/)
  assert.match(proxySource, /status: 504/)
})

test('enhanced club dossier reuses embedded dossier data before calling the backend', () => {
  assert.match(clubDossierSource, /const getEmbeddedDossier = \(\) =>/)
  assert.match(clubDossierSource, /if \(embeddedDossier\)/)
})

test('enhanced club dossier deduplicates premium dossier requests in the client', () => {
  assert.match(clubDossierSource, /const premiumDossierRequests = new Map<string, Promise<any \| null>>\(\)/)
  assert.match(clubDossierSource, /const premiumDossierResults = new Map<string, any \| null>\(\)/)
  assert.match(clubDossierSource, /premiumDossierRequests\.set\(cacheKey, requestPromise\)/)
})
