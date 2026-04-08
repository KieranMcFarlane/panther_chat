import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const journeyComponentPath = new URL('../src/components/entity-browser/EntitySmokeJourney.tsx', import.meta.url)
const browserPagePath = new URL('../src/app/entity-browser/client-page.tsx', import.meta.url)
const smokeSetPath = new URL('../src/lib/entity-smoke-set.ts', import.meta.url)
const smokeConfigPath = new URL('../src/lib/client-smoke-config.ts', import.meta.url)
const runbookPath = new URL('../docs/plans/2026-03-29-yellow-panther-end-to-end-system-overview.md', import.meta.url)

const journeySource = readFileSync(journeyComponentPath, 'utf8')
const browserPageSource = readFileSync(browserPagePath, 'utf8')
const smokeSetSource = readFileSync(smokeSetPath, 'utf8')
const smokeConfigSource = readFileSync(smokeConfigPath, 'utf8')
const runbookSource = readFileSync(runbookPath, 'utf8')

test('entity browser smoke journey presents the five-entity operator path', () => {
  assert.match(smokeConfigSource, /Arsenal Football Club/)
  assert.match(smokeConfigSource, /Coventry City/)
  assert.match(smokeConfigSource, /Zimbabwe Cricket/)
  assert.match(smokeConfigSource, /Major League Cricket/)
  assert.match(smokeConfigSource, /Zimbabwe Handball Federation/)
  assert.match(smokeSetSource, /Pinned smoke entity is missing from the canonical snapshot/)
  assert.match(smokeSetSource, /dossier_source === 'question_first_dossier'/)
  assert.match(smokeSetSource, /dossier_source === 'question_first_run'/)
  assert.match(journeySource, /Open dossier/)
  assert.match(journeySource, /Find in browser/)
  assert.match(journeySource, /dossierStatus/)
  assert.match(journeySource, /dossierSummary/)
})

test('entity browser page mounts the smoke journey above the entity grid with canonical smoke items', () => {
  assert.match(browserPageSource, /import \{ EntitySmokeJourney \} from "@\/components\/entity-browser\/EntitySmokeJourney"/)
  assert.match(browserPageSource, /smokeItems/)
  assert.match(browserPageSource, /<EntitySmokeJourney items=\{smokeItems\} \/>/)
  assert.doesNotMatch(browserPageSource, /Hidden by default/)
})

test('client-facing smoke journey only presents ready question-first dossiers', () => {
  assert.match(journeySource, /Client-Ready Dossiers/)
  assert.match(journeySource, /Only entities with a real canonical question-first dossier are shown here/)
  assert.match(journeySource, /No client-ready dossiers are available yet/)
})

test('smoke runbook documents the live operator journey and acceptance criteria', () => {
  assert.match(runbookSource, /entity browser first/)
  assert.match(runbookSource, /LeadIQ/)
  assert.match(runbookSource, /BrightData MCP/)
  assert.match(runbookSource, /Control Center/)
  assert.match(runbookSource, /persisted dossier state/)
  assert.match(runbookSource, /phase rail/)
})
