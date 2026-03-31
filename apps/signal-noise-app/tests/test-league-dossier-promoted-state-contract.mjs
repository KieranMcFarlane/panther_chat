import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const leagueDossierSource = readFileSync(new URL('../src/components/entity-dossier/LeagueDossier.tsx', import.meta.url), 'utf8')

test('league dossier explains when promoted evidence is still pending', () => {
  assert.match(leagueDossierSource, /Awaiting promoted dossier evidence/i)
  assert.match(leagueDossierSource, /No persisted discovery synthesis is available for this league yet/i)
})

test('league dossier can render promoted discovery sections when dossier evidence exists', () => {
  assert.match(leagueDossierSource, /question_first\?\.discovery_summary/)
  assert.match(leagueDossierSource, /Opportunity signals/)
  assert.match(leagueDossierSource, /Decision owners/)
  assert.match(leagueDossierSource, /Timing and procurement/)
})
