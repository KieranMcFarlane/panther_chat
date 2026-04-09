import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityDossierRouteSource = readFileSync(new URL('../src/app/api/entities/[entityId]/dossier/route.ts', import.meta.url), 'utf8')

test('dossier api resolves canonical question-first artifacts before legacy dossier rows', () => {
  assert.match(entityDossierRouteSource, /resolveCanonicalQuestionFirstDossier/)
  assert.doesNotMatch(entityDossierRouteSource, /getLatestQuestionFirstDossierArtifact/)
  assert.doesNotMatch(entityDossierRouteSource, /getLatestQuestionFirstRunArtifact/)
  assert.doesNotMatch(entityDossierRouteSource, /mergeQuestionFirstRunArtifactIntoDossier/)
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

test('dossier api can synthesize an entity from canonical question-first artifacts when no live row exists', () => {
  assert.match(entityDossierRouteSource, /const canonicalQuestionFirst = await resolveCanonicalQuestionFirstDossier\(normalizedId, null\)/)
  assert.match(entityDossierRouteSource, /dossier_data: JSON\.stringify\(dossier\)/)
})
