import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityBrowserDataSource = readFileSync(new URL('../src/lib/entity-browser-data.ts', import.meta.url), 'utf8')
const entityCardSource = readFileSync(new URL('../src/components/EntityCard.tsx', import.meta.url), 'utf8')
const dossierIndexSource = readFileSync(new URL('../src/lib/dossier-index.ts', import.meta.url), 'utf8')

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
