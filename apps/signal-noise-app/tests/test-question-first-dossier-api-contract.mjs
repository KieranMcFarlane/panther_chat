import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityDossierRouteSource = readFileSync(new URL('../src/app/api/entities/[entityId]/dossier/route.ts', import.meta.url), 'utf8')

test('dossier api resolves canonical question-first artifacts before legacy dossier rows', () => {
  assert.match(entityDossierRouteSource, /resolveCanonicalQuestionFirstDossier/)
  assert.match(entityDossierRouteSource, /getLatestQuestionFirstDossierArtifact/)
  assert.match(entityDossierRouteSource, /getLatestQuestionFirstRunArtifact/)
  assert.match(entityDossierRouteSource, /mergeQuestionFirstRunArtifactIntoDossier/)
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
})
