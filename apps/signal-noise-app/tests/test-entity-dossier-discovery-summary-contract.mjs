import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dossierClientSource = readFileSync(new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url), 'utf8')

test('entity dossier client page renders promoted discovery summary ahead of the legacy dossier router', () => {
  assert.match(dossierClientSource, /dossierPromotions/)
  assert.match(dossierClientSource, /discoverySummary/)
  assert.match(dossierClientSource, /Promoted discovery summary/)
  assert.match(dossierClientSource, /Opportunity signals/)
  assert.match(dossierClientSource, /Decision owners/)
  assert.match(dossierClientSource, /Timing and procurement/)
  assert.match(dossierClientSource, /Supporting evidence/)
})

test('dossier shell copy distinguishes persisted and pending dossier states', () => {
  assert.match(dossierClientSource, /stored dossier, then adds enrichment and opportunity context/i)
  assert.match(dossierClientSource, /No persisted dossier is available yet, so this page starts from the entity state and enrichment context/i)
})
