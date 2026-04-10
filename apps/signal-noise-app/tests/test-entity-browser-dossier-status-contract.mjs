import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityBrowserDataSource = readFileSync(new URL('../src/lib/entity-browser-data.ts', import.meta.url), 'utf8')
const entityCardSource = readFileSync(new URL('../src/components/EntityCard.tsx', import.meta.url), 'utf8')
const dossierIndexSource = readFileSync(new URL('../src/lib/dossier-index.ts', import.meta.url), 'utf8')
const dossierRouteSource = readFileSync(new URL('../src/app/api/entities/[entityId]/dossier/route.ts', import.meta.url), 'utf8')

test('entity browser shared data builder exposes lightweight dossier index fields for cards', () => {
  assert.match(entityBrowserDataSource, /dossier_status/)
  assert.match(entityBrowserDataSource, /latest_generated_at/)
  assert.match(entityBrowserDataSource, /latest_dossier_path/)
  assert.match(entityBrowserDataSource, /latest_run_id/)
})

test('entity browser shared data builder avoids per-row dossier index resolution on the hot path', () => {
  assert.doesNotMatch(entityBrowserDataSource, /getEntityDossierIndexRecord/)
  assert.match(entityBrowserDataSource, /function buildLightweightDossierIndexFromEntityState/)
  assert.match(entityBrowserDataSource, /dossier_status:\s*lightweightDossierIndex\.dossier_status/)
})

test('lightweight dossier status only treats persisted promoted artifacts as real dossiers', () => {
  assert.match(entityBrowserDataSource, /const hasPersistedDossierArtifact = Boolean\(toText\(properties\.latest_dossier_path\)\)/)
  assert.match(entityBrowserDataSource, /hasPersistedDossierArtifact && \(dossierStatus === 'ready' \|\| dossierStatus === 'stale' \|\| dossierStatus === 'pending' \|\| dossierStatus === 'rerun_needed'\)/)
  assert.match(entityBrowserDataSource, /: \['queued', 'running', 'pending'\]\.includes\(pipelineStatus\)/)
})

test('entity browser normalizes default all filters instead of filtering out every entity', () => {
  assert.match(entityBrowserDataSource, /function normalizeFilterValue\(value: string\)/)
  assert.match(entityBrowserDataSource, /return normalized === 'all' \? '' : normalized/)
  assert.match(entityBrowserDataSource, /const sport = normalizeFilterValue\(filters\.sport \|\| ''\)/)
  assert.match(entityBrowserDataSource, /const league = normalizeFilterValue\(filters\.league \|\| ''\)/)
  assert.match(entityBrowserDataSource, /const country = normalizeFilterValue\(filters\.country \|\| ''\)/)
  assert.match(entityBrowserDataSource, /const entityClass = normalizeFilterValue\(filters\.entityClass \|\| ''\)/)
})

test('question-first dossier normalization unwraps merged dossiers from promoted artifacts', () => {
  const questionFirstDossierSource = readFileSync(new URL('../src/lib/question-first-dossier.ts', import.meta.url), 'utf8')
  assert.match(questionFirstDossierSource, /const rawDossier = ensureObject\(dossierPayload\)/)
  assert.match(questionFirstDossierSource, /rawDossier\.merged_dossier && typeof rawDossier\.merged_dossier === 'object'/)
  assert.match(questionFirstDossierSource, /toText\(mergedDossier\.run_id\) \|\| toText\(rawDossier\.run_id\)/)
  assert.match(questionFirstDossierSource, /toText\(mergedDossier\.publish_status\) \|\| toText\(rawDossier\.publish_status\)/)
  assert.match(questionFirstDossierSource, /function normalizeQuestionAnswerRecord/)
  assert.match(questionFirstDossierSource, /terminal_state/)
  assert.match(questionFirstDossierSource, /terminal_summary/)
  assert.match(questionFirstDossierSource, /timeout_salvage/)
  assert.match(questionFirstDossierSource, /mergeQuestionFirstRunArtifactIntoDossier/)
  assert.match(questionFirstDossierSource, /merged_dossier/)
  assert.match(questionFirstDossierSource, /demo/)
  assert.match(questionFirstDossierSource, /source: 'question_first_run'/)
  assert.match(questionFirstDossierSource, /quality_state/)
  assert.match(questionFirstDossierSource, /validation_sample/)
  assert.match(questionFirstDossierSource, /function shouldMarkValidationSample/)
  assert.match(questionFirstDossierSource, /source !== 'legacy_dossier'/)
  assert.match(questionFirstDossierSource, /requiredSpecialistTabs/)
  assert.match(questionFirstDossierSource, /stripTrailingNumericSuffix/)
})

test('entity cards surface dossier availability and freshness status', () => {
  assert.match(entityCardSource, /dossier_status/)
  assert.match(entityCardSource, /Dossier ready|Dossier pending|Needs rerun/)
  assert.match(entityCardSource, /latest_generated_at/)
})

test('dossier index downgrades canonical dossiers that are not client-ready', () => {
  assert.match(dossierIndexSource, /client_ready/)
  assert.match(dossierIndexSource, /client_ready_blockers/)
  assert.match(dossierIndexSource, /rerun_needed/)
})

test('entity dossier API uses canonical dossier resolution before raw artifact shortcuts', () => {
  assert.match(dossierRouteSource, /resolveCanonicalQuestionFirstDossier/)
  assert.doesNotMatch(dossierRouteSource, /getLatestQuestionFirstDossierArtifact/)
  assert.doesNotMatch(dossierRouteSource, /getLatestQuestionFirstRunArtifact/)
})
