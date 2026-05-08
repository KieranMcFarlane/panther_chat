import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const routePath = new URL('../src/app/api/internal/graphiti/opportunities/process-dossier/route.ts', import.meta.url)
const ingestionPath = new URL('../src/lib/graphiti-dossier-ingestion.ts', import.meta.url)
const memoryBridgePath = new URL('../src/lib/graphiti-dossier-memory-bridge.ts', import.meta.url)
const persistencePath = new URL('../src/lib/graphiti-opportunity-persistence.ts', import.meta.url)
const synthesisPath = new URL('../src/lib/graphiti-opportunity-strategy-synthesis.mjs', import.meta.url)
const mainBackendPath = new URL('../backend/main.py', import.meta.url)
const orchestratorPath = new URL('../backend/pipeline_orchestrator.py', import.meta.url)
const backendGraphitiServicePath = new URL('../backend/graphiti_service.py', import.meta.url)
const notifierPath = new URL('../backend/post_dossier_graphiti_trigger.py', import.meta.url)

test('internal post-dossier route runs scoped resilient Graphiti opportunity processing', () => {
  assert.equal(existsSync(routePath), true)
  const source = readFileSync(routePath, 'utf8')

  assert.match(source, /requireCronSecret/)
  assert.match(source, /canonical_entity_id/)
  assert.match(source, /source:\s*'pipeline_dossier_completed'/)
  assert.match(source, /runGraphitiOpportunityPipelineStep/)
  assert.match(source, /name:\s*'dossier_ingestion'[\s\S]*critical:\s*true/)
  assert.match(source, /name:\s*'graphiti_memory_sync'[\s\S]*critical:\s*false/)
  assert.match(source, /name:\s*'opportunity_materialization'[\s\S]*critical:\s*true/)
  assert.match(source, /name:\s*'strategy_synthesis'[\s\S]*critical:\s*false/)
  assert.match(source, /canonicalEntityId/)
  assert.match(source, /deactivateUnseen:\s*false/)
  assert.match(source, /pipeline_status/)
  assert.match(source, /pipeline_steps/)
})

test('dossier ingestion, memory sync, materialization, and synthesis support scoped canonical processing', () => {
  const ingestionSource = readFileSync(ingestionPath, 'utf8')
  const memorySource = readFileSync(memoryBridgePath, 'utf8')
  const persistenceSource = readFileSync(persistencePath, 'utf8')
  const synthesisSource = readFileSync(synthesisPath, 'utf8')

  assert.match(ingestionSource, /canonicalEntityId/)
  assert.match(ingestionSource, /dossierId/)
  assert.match(ingestionSource, /and canonical_entity_id = \$2/)
  assert.match(ingestionSource, /and id = \$2::uuid/)

  assert.match(memorySource, /canonicalEntityId/)
  assert.match(memorySource, /sourceLedgerId/)
  assert.match(memorySource, /and i\.canonical_entity_id = \$2/)
  assert.match(memorySource, /and i\.id = \$2::uuid/)

  assert.match(persistenceSource, /deactivateUnseen/)
  assert.match(persistenceSource, /canonicalEntityId/)
  assert.match(persistenceSource, /deactivateUnseen !== false/)

  assert.match(synthesisSource, /canonicalEntityId/)
  assert.match(synthesisSource, /sourceLedgerId/)
  assert.match(synthesisSource, /rawPayload\.canonical_entity_id/)
})

test('backend dossier persistence notifies post-dossier Graphiti trigger without blocking persistence', () => {
  const mainSource = readFileSync(mainBackendPath, 'utf8')
  const orchestratorSource = readFileSync(orchestratorPath, 'utf8')
  const graphitiServiceSource = readFileSync(backendGraphitiServicePath, 'utf8')
  const notifierSource = readFileSync(notifierPath, 'utf8')

  for (const source of [mainSource, graphitiServiceSource]) {
    assert.match(source, /notify_post_dossier_graphiti_opportunity_trigger/)
    assert.match(source, /pipeline_dossier_completed/)
  }
  assert.doesNotMatch(
    orchestratorSource,
    /_persist_question_first_dossier_snapshot[\s\S]*notify_post_dossier_graphiti_opportunity_trigger/,
  )
  assert.match(graphitiServiceSource, /if envelope\.get\("phase"\) == "dashboard_scoring":/)

  assert.match(notifierSource, /INTERNAL_APP_URL/)
  assert.match(notifierSource, /NEXT_PUBLIC_APP_URL/)
  assert.match(notifierSource, /APP_URL/)
  assert.match(notifierSource, /CRON_SECRET/)
  assert.match(notifierSource, /pipeline_dossier_completed/)
  assert.match(notifierSource, /except Exception/)
  assert.match(notifierSource, /daemon=True/)
  assert.match(notifierSource, /timeout=/)
})
