import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dossierRoutePath = new URL('../src/app/api/entities/[entityId]/dossier/route.ts', import.meta.url)
const dossierClientPath = new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url)

const dossierRouteSource = readFileSync(dossierRoutePath, 'utf8')
const dossierClientSource = readFileSync(dossierClientPath, 'utf8')

test('entity dossier API uses persisted-only reads and auto-queues pipeline runs when dossier is missing', () => {
  assert.match(dossierRouteSource, /from\('entity_dossiers'\)/)
  assert.match(dossierRouteSource, /select\('dossier_data/)
  assert.match(dossierRouteSource, /findActivePipelineRunByEntityId/)
  assert.match(dossierRouteSource, /createEntityImportBatch/)
  assert.match(dossierRouteSource, /createEntityPipelineRuns/)
  assert.match(dossierRouteSource, /queueEntityImportBatch/)
  assert.match(dossierRouteSource, /statusUrl/)
  assert.match(dossierRouteSource, /runDetailUrl/)
  assert.match(dossierRouteSource, /dossier_autoqueue_requested_at/)
  assert.match(dossierRouteSource, /status:\s*202/)
  assert.doesNotMatch(dossierRouteSource, /generateEntityDossier/)
  assert.doesNotMatch(dossierRouteSource, /Neo4jService/)
})

test('entity dossier client polls queued pipeline status when dossier endpoint returns 202', () => {
  assert.match(dossierClientSource, /response\.status === 202/)
  assert.match(dossierClientSource, /statusUrl/)
  assert.match(dossierClientSource, /pipeline run/i)
  assert.match(dossierClientSource, /setGenerationMessage/)
})
