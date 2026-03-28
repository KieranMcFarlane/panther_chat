import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routeSource = readFileSync(new URL('../src/app/api/home/pipeline-status/route.ts', import.meta.url), 'utf8')
const libSource = readFileSync(new URL('../src/lib/pipeline-status.ts', import.meta.url), 'utf8')

test('pipeline status api is backed by the canonical pipeline run table and lifecycle resolver', () => {
  assert.match(routeSource, /loadCanonicalPipelineStatus/)
  assert.match(routeSource, /limit/)
  assert.match(libSource, /loadQuestionFirstScaleManifest/)
  assert.match(libSource, /loadActiveRepairFocusRuns/)
  assert.match(libSource, /loadRunsForEntities/)
  assert.match(libSource, /entity_pipeline_runs/)
  assert.match(libSource, /deriveEntityPipelineLifecycle/)
  assert.match(libSource, /completed_entities/)
  assert.match(libSource, /partial_entities/)
  assert.match(libSource, /blocked_entities/)
  assert.match(libSource, /client_ready_entities/)
  assert.match(libSource, /artifact_path/)
  assert.match(libSource, /dossier_path/)
  assert.match(libSource, /quality_state/)
  assert.match(libSource, /published_degraded/)
  assert.doesNotMatch(libSource, /limit\(10000\)/)
  assert.doesNotMatch(libSource, /rollout-proof-20260410/)
})
