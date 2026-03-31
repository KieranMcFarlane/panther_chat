import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const finalClubDossierSource = readFileSync(new URL('../src/components/entity-dossier/FinalRalphClubDossier.tsx', import.meta.url), 'utf8')

test('final club dossier reads promoted question-first discovery summary inside procurement and strategy tabs', () => {
  assert.match(finalClubDossierSource, /dossier\?\.question_first\?\.discovery_summary/)
  assert.match(finalClubDossierSource, /dossier\?\.question_first\?\.dossier_promotions/)
  assert.match(finalClubDossierSource, /Evidence-backed opportunity signals/)
  assert.match(finalClubDossierSource, /Promoted decision owners/)
  assert.match(finalClubDossierSource, /Promoted timing and procurement/)
})
