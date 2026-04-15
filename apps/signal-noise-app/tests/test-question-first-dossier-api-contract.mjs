import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityDossierRouteSource = readFileSync(new URL('../src/app/api/entities/[entityId]/dossier/route.ts', import.meta.url), 'utf8')

test('dossier api reads the latest Supabase-published dossier without filesystem fallbacks', () => {
  assert.match(entityDossierRouteSource, /getPersistedDossier/)
  assert.match(entityDossierRouteSource, /supabase_persisted_dossier/)
  assert.doesNotMatch(entityDossierRouteSource, /resolveCanonicalQuestionFirstDossier/)
})

test('dossier api exposes the normalized question-first payload expected by the app', () => {
  assert.match(entityDossierRouteSource, /entity_id:/)
  assert.match(entityDossierRouteSource, /entity_name:/)
  assert.match(entityDossierRouteSource, /entity_type:/)
  assert.match(entityDossierRouteSource, /question_first:/)
  assert.match(entityDossierRouteSource, /run_rollup:/)
  assert.match(entityDossierRouteSource, /question_timings:/)
  assert.match(entityDossierRouteSource, /poi_graph:/)
  assert.match(entityDossierRouteSource, /tabs:/)
  assert.match(entityDossierRouteSource, /publish_status:/)
  assert.match(entityDossierRouteSource, /run_id:/)
  assert.match(entityDossierRouteSource, /last_completed_question:/)
  assert.match(entityDossierRouteSource, /resume_from_question:/)
  assert.match(entityDossierRouteSource, /failure_reason:/)
  assert.match(entityDossierRouteSource, /failure_category:/)
  assert.match(entityDossierRouteSource, /retryable:/)
  assert.match(entityDossierRouteSource, /heartbeat_at:/)
  assert.match(entityDossierRouteSource, /checkpoint_consistent:/)
  assert.match(entityDossierRouteSource, /non_terminal_question_ids:/)
})

test('question-first normalization preserves readable procurement timeout summaries and validation-sample metadata', () => {
  const questionFirstDossierSource = readFileSync(new URL('../src/lib/question-first-dossier.ts', import.meta.url), 'utf8')
  assert.match(questionFirstDossierSource, /Validation timed out after retaining procurement evidence/)
  assert.match(questionFirstDossierSource, /Retained evidence:/)
  assert.match(questionFirstDossierSource, /validation_sample/)
  assert.match(questionFirstDossierSource, /publish_status/)
  assert.match(questionFirstDossierSource, /published_valid/)
  assert.match(questionFirstDossierSource, /published_shadow/)
  assert.match(questionFirstDossierSource, /checkpoint_consistent/)
  assert.match(questionFirstDossierSource, /non_terminal_question_ids/)
})

test('canonical dossier resolution keeps better published dossiers ahead of worse rerun artifacts', () => {
  const questionFirstDossierSource = readFileSync(new URL('../src/lib/question-first-dossier.ts', import.meta.url), 'utf8')
  assert.match(questionFirstDossierSource, /shouldHydrateCanonicalDossierWithRun/)
  assert.match(questionFirstDossierSource, /runQuestionCount < dossierQuestionCount/)
  assert.match(questionFirstDossierSource, /runQualityPriority < dossierQualityPriority/)
})

test('dossier api rejects malformed persisted dossier cache rows before queueing canonical regeneration', () => {
  assert.match(entityDossierRouteSource, /isCanonicalPersistedDossierCandidate/)
  assert.match(entityDossierRouteSource, /hasQuestionFirstAnswers/)
  assert.match(entityDossierRouteSource, /merged_dossier/)
  assert.match(entityDossierRouteSource, /hasTopLevelQuestions/)
})

test('dossier api ranks persisted dossier candidates so malformed newer rows cannot outrank a valid published repair', () => {
  const questionFirstDossierSource = readFileSync(new URL('../src/lib/question-first-dossier.ts', import.meta.url), 'utf8')
  assert.match(questionFirstDossierSource, /export function scorePersistedDossierCandidate/)
  assert.match(questionFirstDossierSource, /export function selectBestPersistedDossierCandidate/)
  assert.match(questionFirstDossierSource, /if \(publishStatus\.startsWith\('published'\)\)/)
  assert.match(questionFirstDossierSource, /if \(!qualityState\)/)
  assert.match(questionFirstDossierSource, /if \(questionCount === 0\)/)
  assert.match(entityDossierRouteSource, /selectBestPersistedDossierCandidate/)
  assert.match(entityDossierRouteSource, /\.limit\(5\)/)
})

test('dossier api does not synthesize entities from question-first artifacts when no live row exists', () => {
  assert.doesNotMatch(entityDossierRouteSource, /resolveCanonicalQuestionFirstDossier/)
  assert.doesNotMatch(entityDossierRouteSource, /dossier_data: JSON\.stringify\(dossier\)/)
})
