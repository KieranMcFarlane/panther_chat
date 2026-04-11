import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const journeyComponentPath = new URL('../src/components/entity-browser/EntitySmokeJourney.tsx', import.meta.url)
const browserPagePath = new URL('../src/app/entity-browser/page.tsx', import.meta.url)
const smokeSetPath = new URL('../src/lib/entity-smoke-set.ts', import.meta.url)
const smokeConfigPath = new URL('../src/lib/client-smoke-config.ts', import.meta.url)
const proofSetPath = new URL('../src/lib/rollout-proof-set.ts', import.meta.url)
const runbookPath = new URL('../docs/plans/2026-03-29-yellow-panther-end-to-end-system-overview.md', import.meta.url)

const journeySource = readFileSync(journeyComponentPath, 'utf8')
const browserPageSource = readFileSync(browserPagePath, 'utf8')
const smokeSetSource = readFileSync(smokeSetPath, 'utf8')
const smokeConfigSource = readFileSync(smokeConfigPath, 'utf8')
const proofSetSource = readFileSync(proofSetPath, 'utf8')
const runbookSource = readFileSync(runbookPath, 'utf8')

test('entity browser smoke journey presents the truthful three-entity qa path', () => {
  assert.match(smokeConfigSource, /ROLLOUT_PROOF_SET/)
  assert.match(proofSetSource, /Arsenal Football Club/)
  assert.match(proofSetSource, /Coventry City/)
  assert.match(proofSetSource, /Zimbabwe Cricket/)
  assert.doesNotMatch(proofSetSource, /La Vuelta Ciclista a España/)
  assert.match(smokeSetSource, /Pinned smoke entity is missing from the canonical snapshot/)
  assert.match(smokeSetSource, /console\.warn/)
  assert.doesNotMatch(smokeSetSource, /throw new Error/)
  assert.match(smokeSetSource, /dossier_source === 'question_first_dossier'/)
  assert.match(smokeSetSource, /dossier_source === 'question_first_run'/)
  assert.doesNotMatch(smokeSetSource, /dossierIndex\.dossier_status !== 'ready'/)
  assert.match(smokeSetSource, /qualityState/)
  assert.match(journeySource, /Open dossier/)
  assert.match(journeySource, /Find in browser/)
  assert.match(journeySource, /dossierStatus/)
  assert.match(journeySource, /qualityState/)
  assert.match(journeySource, /dossierSummary/)
})

test('entity browser page streams the smoke journey separately from the main browser shell', () => {
  assert.doesNotMatch(browserPageSource, /EntitySmokeJourney/)
  assert.doesNotMatch(browserPageSource, /SmokeJourneySlot/)
  assert.doesNotMatch(browserPageSource, /getEntityBrowserSmokeItems\(\)\.catch\(\(\) => \[\]\)/)
  assert.doesNotMatch(browserPageSource, /<EntitySmokeJourney items=\{smokeItems\} \/>/)
  assert.doesNotMatch(browserPageSource, /<Suspense fallback=\{null\}>/)
  assert.match(browserPageSource, /<EntityBrowserClientPage/)
})

test('client-facing smoke journey presents one truthful qa example per quality state', () => {
  assert.match(journeySource, /Local QA Dossiers/)
  assert.match(journeySource, /15-question rollout proof set/)
  assert.match(journeySource, /The proof set should converge on three 15-question dossiers/)
  assert.match(journeySource, /No canonical QA dossiers are available yet/)
})

test('smoke runbook documents the live operator journey and acceptance criteria', () => {
  assert.match(runbookSource, /entity browser first/)
  assert.match(runbookSource, /LeadIQ/)
  assert.match(runbookSource, /BrightData MCP/)
  assert.match(runbookSource, /Control Center/)
  assert.match(runbookSource, /persisted dossier state/)
  assert.match(runbookSource, /phase rail/)
})
