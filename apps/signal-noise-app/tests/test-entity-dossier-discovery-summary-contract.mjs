import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dossierClientSource = readFileSync(new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url), 'utf8')
const questionPackRailSource = readFileSync(new URL('../src/components/entity-dossier/EntityQuestionPackRail.tsx', import.meta.url), 'utf8')

test('entity dossier client page renders promoted discovery summary ahead of the legacy dossier router', () => {
  assert.match(dossierClientSource, /dossierPromotions/)
  assert.match(dossierClientSource, /discoverySummary/)
  assert.match(dossierClientSource, /Promoted discovery summary/)
  assert.match(dossierClientSource, /Opportunity signals/)
  assert.match(dossierClientSource, /Decision owners/)
  assert.match(dossierClientSource, /Timing and procurement/)
  assert.match(dossierClientSource, /Supporting evidence/)
})

test('raw question pack rail is explicitly labeled as an operator debug surface', () => {
  assert.match(questionPackRailSource, /Operator debug surface/i)
  assert.match(questionPackRailSource, /secondary to the promoted dossier summary/i)
})
