import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const opsRoute = new URL('../src/app/api/entities/[entityId]/dossier/ops/route.ts', import.meta.url)
const reviewRoute = new URL('../src/app/api/entities/[entityId]/dossier/review/route.ts', import.meta.url)
const rerunRoute = new URL('../src/app/api/entities/[entityId]/dossier/rerun/route.ts', import.meta.url)
const controlsSource = readFileSync(new URL('../src/components/entity-dossier/DossierOperatorControls.tsx', import.meta.url), 'utf8')
const feedSource = readFileSync(new URL('../src/components/home/GraphitiInsightsFeed.tsx', import.meta.url), 'utf8')

test('operator dossier routes exist and require authenticated operator actions', () => {
  assert.equal(existsSync(opsRoute), true)
  assert.equal(existsSync(reviewRoute), true)
  assert.equal(existsSync(rerunRoute), true)
  assert.match(readFileSync(reviewRoute, 'utf8'), /requireOperatorApiSession/)
  assert.match(readFileSync(rerunRoute, 'utf8'), /queueDossierRefresh/)
  assert.match(readFileSync(opsRoute, 'utf8'), /getEntityDossierOpsRecord/)
})

test('dossier page exposes rerun, review, and missing evidence controls for stale entities', () => {
  assert.match(controlsSource, /Rerun dossier/)
  assert.match(controlsSource, /Mark for review/)
  assert.match(controlsSource, /Inspect missing evidence/)
  assert.match(controlsSource, /missing_evidence_summary/)
})

test('operational graphiti cards expose operator actions', () => {
  assert.match(feedSource, /insight\.insight_type === 'operational'/)
  assert.match(feedSource, /Rerun dossier/)
  assert.match(feedSource, /Mark for review/)
  assert.match(feedSource, /Inspect missing evidence/)
})
