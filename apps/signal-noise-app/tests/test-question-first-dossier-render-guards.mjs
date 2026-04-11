import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/entity-dossier/QuestionFirstEntityDossier.tsx', import.meta.url), 'utf8')

test('question-first dossier coerces structured answer payloads before rendering overview and evidence bodies', () => {
  assert.match(source, /function toText/)
  assert.match(source, /function getQuestionBody/)
  assert.match(source, /function getQuestionTerminalSummary/)
  assert.match(source, /renderEvidenceCards/)
})

test('question-first dossier uses normalized question records and signal-type fallbacks when promoted summary sections are sparse', () => {
  assert.match(source, /collectQuestionRecords/)
  assert.match(source, /dossier\?\.questions/)
  assert.match(source, /getQuestionTitle/)
  assert.match(source, /formatQuestionAnswer/)
  assert.match(source, /formatStructuredFact/)
  assert.match(source, /formatStructuredList/)
  assert.match(source, /PROCUREMENT_SIGNAL/)
  assert.match(source, /NEWS_SIGNAL/)
  assert.match(source, /LEADERSHIP/)
  assert.match(source, /DIGITAL_STACK/)
})

test('question-first dossier renders explicit terminal-state badges and blocked dependency context instead of blank cards', () => {
  assert.match(source, /function getQuestionTerminalState/)
  assert.match(source, /function getQuestionStatusLabel/)
  assert.match(source, /Blocked by:/)
  assert.match(source, /No signal/)
  assert.match(source, /Answered/)
})

test('question-first dossier resolves evidence refs into readable source items and surfaces dossier quality state', () => {
  assert.match(source, /function buildEvidenceIndex/)
  assert.match(source, /function buildEvidenceGroups/)
  assert.match(source, /function getDossierQualityLabel/)
  assert.match(source, /Partial dossier/)
  assert.match(source, /Validation sample/)
  assert.doesNotMatch(source, /\[object Object\]/)
})

test('question-first dossier renders enriched poi cards with bio, verified email, linkedin link, and post-summary context', () => {
  assert.match(source, /linkedin_url/)
  assert.match(source, /recent_post_summary/)
  assert.match(source, /bio/)
  assert.match(source, /Verified email/)
  assert.match(source, /LinkedIn/)
})
