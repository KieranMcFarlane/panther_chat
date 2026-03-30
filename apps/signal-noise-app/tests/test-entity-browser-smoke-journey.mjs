import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const journeyComponentPath = new URL('../src/components/entity-browser/EntitySmokeJourney.tsx', import.meta.url)
const browserPagePath = new URL('../src/app/entity-browser/client-page.tsx', import.meta.url)
const runbookPath = new URL('../docs/plans/2026-03-29-yellow-panther-end-to-end-system-overview.md', import.meta.url)

const journeySource = readFileSync(journeyComponentPath, 'utf8')
const browserPageSource = readFileSync(browserPagePath, 'utf8')
const runbookSource = readFileSync(runbookPath, 'utf8')

test('entity browser smoke journey presents the five-entity operator path', () => {
  assert.match(journeySource, /Arsenal Football Club/)
  assert.match(journeySource, /Coventry City/)
  assert.match(journeySource, /Zimbabwe Cricket/)
  assert.match(journeySource, /Major League Cricket/)
  assert.match(journeySource, /Zimbabwe Handball Federation/)
  assert.match(journeySource, /Open dossier/)
  assert.match(journeySource, /Find in browser/)
})

test('entity browser page mounts the smoke journey above the entity grid', () => {
  assert.match(browserPageSource, /import \{ EntitySmokeJourney \} from "@\/components\/entity-browser\/EntitySmokeJourney"/)
  assert.match(browserPageSource, /<EntitySmokeJourney \/>/)
})

test('smoke runbook documents the live operator journey and acceptance criteria', () => {
  assert.match(runbookSource, /entity browser first/)
  assert.match(runbookSource, /LeadIQ/)
  assert.match(runbookSource, /BrightData MCP/)
  assert.match(runbookSource, /Control Center/)
  assert.match(runbookSource, /persisted dossier state/)
  assert.match(runbookSource, /phase rail/)
})
