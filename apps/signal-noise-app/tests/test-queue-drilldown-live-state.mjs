import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

async function loadQueueDrilldownRouteModule() {
  const sourcePath = new URL('../src/app/api/home/queue-drilldown/route.ts', import.meta.url)
  const source = await readFile(sourcePath, 'utf8')
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'queue-drilldown-route-'))

  const stubs = {
    nextServer: path.join(tempDir, 'next-server.ts'),
    canonicalEntitiesSnapshot: path.join(tempDir, 'canonical-entities-snapshot.ts'),
    entityPublicId: path.join(tempDir, 'entity-public-id.ts'),
    entityPipelineLifecycle: path.join(tempDir, 'entity-pipeline-lifecycle.ts'),
    operationalHeartbeat: path.join(tempDir, 'operational-heartbeat.ts'),
    normalizedUniverseCount: path.join(tempDir, 'normalized-universe-count.ts'),
    pipelineRuntime: path.join(tempDir, 'pipeline-runtime.ts'),
    operationalFreshness: path.join(tempDir, 'operational-freshness.ts'),
    queueDrilldownNormalization: path.join(tempDir, 'queue-drilldown-normalization.ts'),
    questionFirstManifest: path.join(tempDir, 'question-first-manifest.ts'),
    questionTextResolver: path.join(tempDir, 'question-text-resolver.ts'),
  }

  await writeFile(stubs.nextServer, [
    'export const NextResponse = {',
    '  json(payload) {',
    '    return { payload, async json() { return payload } }',
    '  },',
    '}',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubs.canonicalEntitiesSnapshot, [
    'export async function getCanonicalEntitiesSnapshot() { return [] }',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubs.entityPublicId, [
    'export function matchesEntityUuid() { return false }',
    'export function resolveEntityUuid() { return null }',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubs.entityPipelineLifecycle, [
    'export async function deriveEntityPipelineLifecycle() {',
    "  return { stage: 'queued', label: 'Queued', summary: 'Queued', last_completed_question: null }",
    '}',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubs.operationalHeartbeat, [
    'export function resolveOperationalHeartbeatDetails(input) {',
    '  const heartbeatAt = input?.heartbeat_at || null',
    '  const parsed = heartbeatAt ? Date.parse(String(heartbeatAt)) : Number.NaN',
    '  const ageSeconds = Number.isFinite(parsed) ? Math.max(0, Math.floor((Date.now() - parsed) / 1000)) : null',
    "  return { heartbeat_at: heartbeatAt, heartbeat_age_seconds: ageSeconds, freshness_state: ageSeconds !== null && ageSeconds > 300 ? 'stale' : 'fresh' }",
    '}',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubs.normalizedUniverseCount, [
    'export async function getNormalizedUniverseCount() { return 3332 }',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubs.pipelineRuntime, [
    'export async function loadPipelineRuntimeReadSet() {',
    '  return globalThis.__queueDrilldownTestReadSet',
    '}',
    'export function buildPipelineRuntimeSnapshot() {',
    '  return globalThis.__queueDrilldownTestRuntimeSnapshot',
    '}',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubs.operationalFreshness, [
    'export function deriveOperationalFreshnessCheckpoint(input) {',
    '  const candidates = [',
    '    ...(input.currentRun ? [input.currentRun] : []),',
    '    ...(input.runningEntities || []),',
    '    ...(input.staleActiveRows || []),',
    '    ...(input.completedEntities || []),',
    '  ]',
    '  const timestamps = candidates.flatMap((candidate) => [candidate?.heartbeat_at, candidate?.generated_at, candidate?.started_at, candidate?.completed_at]).filter(Boolean)',
    '  const lastActivityAt = timestamps.sort().at(-1) || input.snapshotAt || null',
    "  return { last_activity_at: lastActivityAt, freshness_state: 'stale' }",
    '}',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubs.queueDrilldownNormalization, [
    'export function normalizeTerminalFollowOnMetadata(record) { return record }',
    'export function shouldSurfaceResumeNeeded() { return false }',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubs.questionFirstManifest, [
    "export function loadQuestionFirstScaleManifest() { return { entities: [{ entity_id: 'fc-porto', entity_name: 'FC Porto', entity_type: 'club' }], sort_key: [] } }",
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubs.questionTextResolver, [
    'export function resolveQuestionTextFromDossierData(_data, questionId) {',
    "  return questionId ? `Question ${questionId}` : null",
    '}',
    '',
  ].join('\n'), 'utf8')

  const rewritten = source
    .replaceAll("'next/server'", JSON.stringify(pathToFileURL(stubs.nextServer).href))
    .replaceAll("'@/lib/canonical-entities-snapshot'", JSON.stringify(pathToFileURL(stubs.canonicalEntitiesSnapshot).href))
    .replaceAll("'@/lib/entity-public-id'", JSON.stringify(pathToFileURL(stubs.entityPublicId).href))
    .replaceAll("'@/lib/entity-pipeline-lifecycle'", JSON.stringify(pathToFileURL(stubs.entityPipelineLifecycle).href))
    .replaceAll("'@/lib/operational-heartbeat'", JSON.stringify(pathToFileURL(stubs.operationalHeartbeat).href))
    .replaceAll("'@/lib/normalized-universe-count'", JSON.stringify(pathToFileURL(stubs.normalizedUniverseCount).href))
    .replaceAll("'@/lib/pipeline-runtime'", JSON.stringify(pathToFileURL(stubs.pipelineRuntime).href))
    .replaceAll("'@/lib/operational-freshness'", JSON.stringify(pathToFileURL(stubs.operationalFreshness).href))
    .replaceAll("'@/lib/queue-drilldown-normalization'", JSON.stringify(pathToFileURL(stubs.queueDrilldownNormalization).href))
    .replaceAll("'@/lib/question-first-manifest'", JSON.stringify(pathToFileURL(stubs.questionFirstManifest).href))
    .replaceAll("'@/lib/question-text-resolver'", JSON.stringify(pathToFileURL(stubs.questionTextResolver).href))

  const tempPath = path.join(tempDir, 'route.ts')
  await writeFile(tempPath, rewritten, 'utf8')
  return import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`)
}

const { GET } = await loadQueueDrilldownRouteModule()

test('queue drilldown stays waiting when control and worker are running but only stale rows remain', async () => {
  const staleHeartbeatAt = new Date(Date.now() - 15 * 60_000).toISOString()
  const staleStartedAt = new Date(Date.now() - 20 * 60_000).toISOString()

  globalThis.__queueDrilldownTestReadSet = {
    snapshot_at: new Date().toISOString(),
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: new Date().toISOString(),
      desired_state: 'running',
      requested_state: 'running',
      observed_state: 'running',
      transition_state: 'running',
    },
    worker: {
      worker_process_state: 'running',
      worker_health: 'healthy',
      worker_pid: 123,
      worker_command: 'npm run worker:entity-pipeline',
      worker_state_path: '/tmp/state.json',
      worker_pid_path: '/tmp/pid',
      started_at: staleStartedAt,
      stopped_at: null,
      updated_at: new Date().toISOString(),
      last_error: null,
    },
    fastmcp: { reachable: true },
    rows: [
      {
        batch_id: 'import_fc_porto',
        entity_id: 'fc-porto',
        canonical_entity_id: 'fc-porto',
        entity_name: 'FC Porto',
        status: 'running',
        phase: 'dossier_generation',
        started_at: staleStartedAt,
        completed_at: null,
        metadata: {
          heartbeat_at: staleHeartbeatAt,
          current_question_id: 'q11_decision_owner',
          current_question_text: 'Who is the highest probability buyer?',
        },
      },
      {
        batch_id: 'import_tom_bradley',
        entity_id: 'tom-bradley',
        canonical_entity_id: 'tom-bradley',
        entity_name: 'Tom Bradley',
        status: 'retrying',
        phase: 'entity_registration',
        started_at: new Date(Date.now() - 2 * 60_000).toISOString(),
        completed_at: null,
        metadata: {},
      },
    ],
    dossiers: [],
  }

  globalThis.__queueDrilldownTestRuntimeSnapshot = {
    snapshot_at: new Date().toISOString(),
    generated_at: new Date().toISOString(),
    control: globalThis.__queueDrilldownTestReadSet.control,
    worker: globalThis.__queueDrilldownTestReadSet.worker,
    fastmcp: { reachable: true },
    queue_depth: 2,
    current_run: {
      batch_id: 'import_tom_bradley',
      entity_id: 'tom-bradley',
      canonical_entity_id: 'tom-bradley',
      entity_name: 'Tom Bradley',
      phase: 'entity_registration',
      queue_state: 'retrying',
      heartbeat_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    },
    current_live_run: null,
    latest_noteworthy_run: {
      batch_id: 'import_tom_bradley',
      entity_id: 'tom-bradley',
      canonical_entity_id: 'tom-bradley',
      entity_name: 'Tom Bradley',
      phase: 'entity_registration',
      queue_state: 'retrying',
      heartbeat_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    },
    recent_failures: [],
    failure_buckets: {
      queued: 0,
      running: 0,
      completed: 0,
      retrying: 1,
      reconciling: 0,
      published_degraded: 0,
      failed_terminal: 0,
      worker_stale: 1,
    },
  }

  const response = await GET()
  const payload = await response.json()

  assert.equal(payload.runtime.worker.worker_process_state, 'running')
  assert.equal(payload.operational_state, 'waiting')
  assert.equal(payload.stop_reason, null)
  assert.equal(payload.live_state.worker_process_state, 'running')
  assert.equal(payload.live_state.current_run, null)
  assert.equal(payload.live_state.in_progress_entity, null)
  assert.equal(payload.queue.stale_active_rows[0]?.entity_name, 'FC Porto')
  assert.equal(payload.queue.latest_noteworthy_entity?.entity_name, 'Tom Bradley')
})
