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
    pgClient: path.join(tempDir, 'pg-client.ts'),
    pipelineRuntime: path.join(tempDir, 'pipeline-runtime.ts'),
    operationalFreshness: path.join(tempDir, 'operational-freshness.ts'),
    queueDrilldownNormalization: path.join(tempDir, 'queue-drilldown-normalization.ts'),
    questionFirstManifest: path.join(tempDir, 'question-first-manifest.ts'),
    questionFirstQueueOrder: path.join(tempDir, 'question-first-queue-order.ts'),
    questionTextResolver: path.join(tempDir, 'question-text-resolver.ts'),
  }

  await writeFile(stubs.nextServer, [
    'export const NextResponse = {',
    '  json(payload) {',
    '    return { status: 200, payload, async json() { return payload } }',
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

  await writeFile(stubs.pgClient, [
    'export async function query() { return { rows: [] } }',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubs.pipelineRuntime, [
    'export function buildPipelineRuntimeRunRecord(row) {',
    '  const metadata = row?.metadata || {}',
    '  const phaseDetails = metadata.phase_details_by_phase || {}',
    "  const phase = row?.phase || metadata.run_phase || 'entity_registration'",
    '  const detail = phaseDetails[phase] || {}',
    '  return {',
    '    batch_id: row?.batch_id || null,',
    '    entity_id: row?.entity_id || "",',
    '    canonical_entity_id: row?.canonical_entity_id || null,',
    '    entity_name: row?.entity_name || "",',
    '    status: row?.status || null,',
    '    phase,',
    '    current_section_id: detail.current_section_id || metadata.current_section_id || null,',
    '    current_section_label: detail.current_section_label || metadata.current_section_label || null,',
    '    current_section_index: detail.current_section_index ?? metadata.current_section_index ?? null,',
    '    current_section_total: detail.current_section_total ?? metadata.current_section_total ?? null,',
    '    current_question_id: detail.current_question_id || metadata.current_question_id || null,',
    '    current_question_text: detail.current_question_text || metadata.current_question_text || null,',
    '    current_question_index: detail.current_question_index ?? metadata.current_question_index ?? null,',
    '    current_question_total: detail.current_question_total ?? metadata.current_question_total ?? null,',
    '    current_strategy_label: detail.current_strategy_label || metadata.current_strategy_label || null,',
    '    current_execution_state: detail.current_execution_state || metadata.current_execution_state || null,',
    '    current_source_order: detail.current_source_order || metadata.current_source_order || null,',
    '    execution_backend: detail.execution_backend || metadata.execution_backend || null,',
    '    execution_model: detail.execution_model || metadata.execution_model || null,',
    '    execution_provider: detail.execution_provider || metadata.execution_provider || null,',
    '    brightdata_transport: detail.brightdata_transport || metadata.brightdata_transport || null,',
    '    current_substep: detail.current_substep || metadata.current_substep || null,',
    '    current_substep_label: detail.current_substep_label || metadata.current_substep_label || null,',
    '    current_substep_progress: detail.current_substep_progress || metadata.current_substep_progress || null,',
    '    current_action: detail.current_action || metadata.current_action || phase || null,',
    '    current_stage: metadata.current_stage || phase || null,',
    '    heartbeat_at: metadata.heartbeat_at || row?.completed_at || row?.started_at || null,',
    '    heartbeat_age_seconds: null,',
    '    publication_status: metadata.publication_status || null,',
    '    retry_state: metadata.retry_state || null,',
    '    stop_reason: metadata.stop_reason || null,',
    '    continue_pipeline_on_failure: metadata.continue_pipeline_on_failure === true,',
    '    error_type: metadata.error_type || null,',
    '    error_message: metadata.error_message || null,',
    "    queue_state: row?.status === 'queued' ? 'queued' : row?.status === 'failed' ? 'failed_terminal' : 'running',",
    '  }',
    '}',
    'export async function loadPipelineRuntimeReadSet() {',
    '  globalThis.__queueDrilldownReadSetCount = (globalThis.__queueDrilldownReadSetCount || 0) + 1',
    '  if (globalThis.__queueDrilldownThrowOnReadSet) throw new Error(globalThis.__queueDrilldownThrowOnReadSet)',
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
    'export function shouldSurfaceResumeNeeded(record) {',
    "  return Boolean((record?.status === 'completed' || record?.status === 'failed') && (record?.next_repair_question_id || record?.current_question_id))",
    '}',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubs.questionFirstManifest, [
    "export function loadQuestionFirstScaleManifest() { return { entities: [{ entity_id: 'fc-porto', entity_name: 'FC Porto', entity_type: 'club' }], sort_key: [] } }",
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubs.questionFirstQueueOrder, [
    "export function describeQuestionFirstQueueOrder() { return 'test order' }",
    'export function sortQuestionFirstManifestEntities(entities) { return entities }',
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
    .replaceAll("'@/lib/pg-client'", JSON.stringify(pathToFileURL(stubs.pgClient).href))
    .replaceAll("'@/lib/pipeline-runtime'", JSON.stringify(pathToFileURL(stubs.pipelineRuntime).href))
    .replaceAll("'@/lib/operational-freshness'", JSON.stringify(pathToFileURL(stubs.operationalFreshness).href))
    .replaceAll("'@/lib/queue-drilldown-normalization'", JSON.stringify(pathToFileURL(stubs.queueDrilldownNormalization).href))
    .replaceAll("'@/lib/question-first-manifest'", JSON.stringify(pathToFileURL(stubs.questionFirstManifest).href))
    .replaceAll("'@/lib/question-first-queue-order'", JSON.stringify(pathToFileURL(stubs.questionFirstQueueOrder).href))
    .replaceAll("'@/lib/question-text-resolver'", JSON.stringify(pathToFileURL(stubs.questionTextResolver).href))

  const tempPath = path.join(tempDir, 'route.ts')
  await writeFile(tempPath, `${rewritten}\nexport { __resetQueueDrilldownRouteCacheForTests }\n`, 'utf8')
  return import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`)
}

const { GET, __resetQueueDrilldownRouteCacheForTests } = await loadQueueDrilldownRouteModule()

test('queue drilldown keeps old queued entity-registration rows out of stale active backlog', async () => {
  __resetQueueDrilldownRouteCacheForTests()
  const now = new Date().toISOString()
  const queuedAt = new Date(Date.now() - 90 * 60_000).toISOString()

  globalThis.__queueDrilldownTestReadSet = {
    snapshot_at: now,
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: now,
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
      started_at: now,
      stopped_at: null,
      updated_at: now,
      last_error: null,
    },
    fastmcp: { reachable: true },
    rows: [
      {
        batch_id: 'queued-costa-rica',
        entity_id: 'costa-rica-handball',
        canonical_entity_id: 'costa-rica-handball',
        entity_name: 'Costa Rican Handball Federation',
        status: 'queued',
        phase: 'entity_registration',
        started_at: queuedAt,
        completed_at: null,
        metadata: {},
      },
    ],
    dossiers: [],
  }

  globalThis.__queueDrilldownTestRuntimeSnapshot = {
    snapshot_at: now,
    generated_at: now,
    control: globalThis.__queueDrilldownTestReadSet.control,
    worker: globalThis.__queueDrilldownTestReadSet.worker,
    fastmcp: { reachable: true },
    queue_depth: 1,
    current_run: {
      batch_id: 'queued-costa-rica',
      entity_id: 'costa-rica-handball',
      canonical_entity_id: 'costa-rica-handball',
      entity_name: 'Costa Rican Handball Federation',
      phase: 'entity_registration',
      queue_state: 'queued',
      heartbeat_at: null,
    },
    current_live_run: null,
    latest_noteworthy_run: null,
    recent_failures: [],
    failure_buckets: {
      queued: 1,
      running: 0,
      completed: 0,
      retrying: 0,
      reconciling: 0,
      published_degraded: 0,
      failed_terminal: 0,
      worker_stale: 0,
    },
  }

  const response = await GET()
  const payload = await response.json()

  assert.equal(payload.operational_state, 'waiting')
  assert.equal(payload.queue.stale_active_rows.length, 0)
  assert.equal(payload.backlog_health.stale_active_count, 0)
  assert.equal(payload.loop_status.runtime_counts.stalled, 0)
  assert.equal(payload.queue.upcoming_entities[0]?.entity_name, 'Costa Rican Handball Federation')
  assert.equal(payload.queue.upcoming_entities[0]?.run_phase, 'queued')
})

test('queue drilldown stays waiting when control and worker are running but only stale rows remain', async () => {
  __resetQueueDrilldownRouteCacheForTests()
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

test('queue drilldown reports worker heartbeat stale when control says running but the worker crashed and only stale rows remain', async () => {
  __resetQueueDrilldownRouteCacheForTests()
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
      worker_process_state: 'crashed',
      worker_health: 'degraded',
      worker_pid: null,
      worker_command: 'npm run worker:entity-pipeline',
      worker_state_path: '/tmp/state.json',
      worker_pid_path: '/tmp/pid',
      started_at: staleStartedAt,
      stopped_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
      last_error: 'tracked pid exited',
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
    ],
    dossiers: [],
  }

  globalThis.__queueDrilldownTestRuntimeSnapshot = {
    snapshot_at: new Date().toISOString(),
    generated_at: new Date().toISOString(),
    control: globalThis.__queueDrilldownTestReadSet.control,
    worker: globalThis.__queueDrilldownTestReadSet.worker,
    fastmcp: { reachable: true },
    queue_depth: 1,
    current_run: {
      batch_id: 'import_fc_porto',
      entity_id: 'fc-porto',
      canonical_entity_id: 'fc-porto',
      entity_name: 'FC Porto',
      phase: 'dossier_generation',
      queue_state: 'worker_stale',
      heartbeat_at: staleHeartbeatAt,
    },
    current_live_run: null,
    latest_noteworthy_run: {
      batch_id: 'import_fc_porto',
      entity_id: 'fc-porto',
      canonical_entity_id: 'fc-porto',
      entity_name: 'FC Porto',
      phase: 'dossier_generation',
      queue_state: 'worker_stale',
      heartbeat_at: staleHeartbeatAt,
    },
    recent_failures: [],
    failure_buckets: {
      queued: 0,
      running: 0,
      completed: 0,
      retrying: 0,
      reconciling: 0,
      published_degraded: 0,
      failed_terminal: 0,
      worker_stale: 1,
    },
  }

  const response = await GET()
  const payload = await response.json()

  assert.equal(payload.runtime.worker.worker_process_state, 'crashed')
  assert.equal(payload.operational_state, 'stopped')
  assert.equal(payload.stop_reason, 'worker_heartbeat_stale')
  assert.equal(payload.live_state.worker_process_state, 'crashed')
  assert.equal(payload.queue.stale_active_rows[0]?.entity_name, 'FC Porto')
})

test('queue drilldown surfaces resumable terminal work as resume-needed instead of silently completed', async () => {
  __resetQueueDrilldownRouteCacheForTests()
  const completedAt = new Date(Date.now() - 2 * 60_000).toISOString()

  globalThis.__queueDrilldownTestReadSet = {
    snapshot_at: new Date().toISOString(),
    control: {
      is_paused: true,
      pause_reason: 'manual stop',
      stop_reason: null,
      stop_details: null,
      updated_at: new Date().toISOString(),
      desired_state: 'paused',
      requested_state: 'paused',
      observed_state: 'paused',
      transition_state: 'paused',
    },
    worker: {
      worker_process_state: 'stopped',
      worker_health: 'stopped',
      worker_pid: null,
      worker_command: 'npm run worker:entity-pipeline',
      worker_state_path: '/tmp/state.json',
      worker_pid_path: '/tmp/pid',
      started_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      stopped_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
      last_error: null,
    },
    fastmcp: { reachable: true },
    rows: [
      {
        batch_id: 'batch_completed',
        entity_id: 'fc-porto',
        canonical_entity_id: 'fc-porto',
        entity_name: 'FC Porto',
        status: 'completed',
        phase: 'dossier_generation',
        started_at: new Date(Date.now() - 8 * 60_000).toISOString(),
        completed_at: completedAt,
        metadata: {
          current_question_id: 'q7_procurement_signal',
          next_repair_question_id: 'q11_decision_owner',
        },
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
    queue_depth: 1,
    current_run: null,
    current_live_run: null,
    latest_noteworthy_run: {
      batch_id: 'batch_completed',
      entity_id: 'fc-porto',
      canonical_entity_id: 'fc-porto',
      entity_name: 'FC Porto',
      phase: 'dossier_generation',
      queue_state: 'completed',
      heartbeat_at: completedAt,
      current_question_id: 'q7_procurement_signal',
    },
    recent_failures: [],
    failure_buckets: {
      queued: 0,
      running: 0,
      completed: 1,
      retrying: 0,
      reconciling: 0,
      published_degraded: 0,
      failed_terminal: 0,
      worker_stale: 0,
    },
  }

  const response = await GET()
  const payload = await response.json()

  assert.equal(payload.operational_state, 'paused')
  assert.equal(payload.loop_status.runtime_counts.resume_needed, 1)
  assert.equal(payload.queue.resume_needed_entities.length, 1)
  assert.equal(payload.queue.resume_needed_entities[0]?.entity_name, 'FC Porto')
  assert.equal(payload.queue.resume_needed_entities[0]?.next_repair_question_id, 'q11_decision_owner')
  assert.equal(payload.queue.resume_needed_entities[0]?.queue_position, 1)
})

test('queue drilldown treats non-blocking failed entities as history instead of resume-needed work', async () => {
  __resetQueueDrilldownRouteCacheForTests()
  const now = new Date().toISOString()
  const failedAt = new Date(Date.now() - 2 * 60_000).toISOString()

  globalThis.__queueDrilldownTestReadSet = {
    snapshot_at: now,
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: now,
      desired_state: 'running',
      requested_state: 'running',
      observed_state: 'running',
      transition_state: 'running',
    },
    worker: {
      worker_process_state: 'running',
      worker_health: 'healthy',
      worker_pid: 321,
      worker_command: 'npm run worker:entity-pipeline',
      worker_state_path: '/tmp/state.json',
      worker_pid_path: '/tmp/pid',
      started_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      stopped_at: null,
      updated_at: now,
      last_error: null,
    },
    fastmcp: { reachable: true },
    rows: [
      {
        batch_id: 'batch-fc-porto',
        entity_id: 'fc-porto',
        canonical_entity_id: 'fc-porto',
        entity_name: 'FC Porto',
        status: 'failed',
        phase: 'entity_registration',
        started_at: new Date(Date.now() - 3 * 60_000).toISOString(),
        completed_at: failedAt,
        metadata: {
          continue_pipeline_on_failure: true,
          error_message: 'HTTP Error 403: Forbidden',
          error_type: 'http_403',
          current_question_id: 'q11_decision_owner',
        },
      },
      {
        batch_id: 'batch-wei-chuan',
        entity_id: 'wei-chuan-dragons',
        canonical_entity_id: 'wei-chuan-dragons',
        entity_name: 'Wei Chuan Dragons',
        status: 'queued',
        phase: 'entity_registration',
        started_at: now,
        completed_at: null,
        metadata: {},
      },
    ],
    dossiers: [],
  }

  globalThis.__queueDrilldownTestRuntimeSnapshot = {
    snapshot_at: now,
    generated_at: now,
    control: globalThis.__queueDrilldownTestReadSet.control,
    worker: globalThis.__queueDrilldownTestReadSet.worker,
    fastmcp: { reachable: true },
    queue_depth: 1,
    current_run: {
      batch_id: 'batch-wei-chuan',
      entity_id: 'wei-chuan-dragons',
      canonical_entity_id: 'wei-chuan-dragons',
      entity_name: 'Wei Chuan Dragons',
      phase: 'entity_registration',
      queue_state: 'queued',
      heartbeat_at: now,
      continue_pipeline_on_failure: false,
    },
    current_live_run: null,
    latest_noteworthy_run: {
      batch_id: 'batch-fc-porto',
      entity_id: 'fc-porto',
      canonical_entity_id: 'fc-porto',
      entity_name: 'FC Porto',
      phase: 'entity_registration',
      queue_state: 'failed_terminal',
      heartbeat_at: failedAt,
      current_question_id: 'q11_decision_owner',
      error_message: 'HTTP Error 403: Forbidden',
      continue_pipeline_on_failure: true,
    },
    recent_failures: [],
    failure_buckets: {
      queued: 1,
      running: 0,
      completed: 0,
      retrying: 0,
      reconciling: 0,
      published_degraded: 0,
      failed_terminal: 1,
      worker_stale: 0,
    },
  }

  const response = await GET()
  const payload = await response.json()

  assert.equal(payload.operational_state, 'waiting')
  assert.equal(payload.stop_reason, null)
  assert.equal(payload.queue.resume_needed_entities.length, 0)
  assert.equal(payload.queue.in_progress_entity, null)
  assert.equal(payload.queue.completed_entities[0]?.entity_name, 'FC Porto')
  assert.equal(payload.queue.completed_entities[0]?.continue_pipeline_on_failure, true)
})

test('queue drilldown reuses a fresh route snapshot instead of rebuilding immediately on repeated GETs', async () => {
  __resetQueueDrilldownRouteCacheForTests()
  globalThis.__queueDrilldownReadSetCount = 0
  globalThis.__queueDrilldownThrowOnReadSet = null
  const snapshotAt = new Date().toISOString()

  globalThis.__queueDrilldownTestReadSet = {
    snapshot_at: snapshotAt,
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: snapshotAt,
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
      started_at: snapshotAt,
      stopped_at: null,
      updated_at: snapshotAt,
      last_error: null,
    },
    fastmcp: { reachable: true },
    rows: [],
    dossiers: [],
  }

  globalThis.__queueDrilldownTestRuntimeSnapshot = {
    snapshot_at: snapshotAt,
    generated_at: snapshotAt,
    control: globalThis.__queueDrilldownTestReadSet.control,
    worker: globalThis.__queueDrilldownTestReadSet.worker,
    fastmcp: { reachable: true },
    queue_depth: 0,
    current_run: null,
    current_live_run: null,
    latest_noteworthy_run: null,
    recent_failures: [],
    failure_buckets: {
      queued: 0,
      running: 0,
      completed: 0,
      retrying: 0,
      reconciling: 0,
      published_degraded: 0,
      failed_terminal: 0,
      worker_stale: 0,
    },
  }

  const first = await GET()
  const second = await GET()
  const firstPayload = await first.json()
  const secondPayload = await second.json()

  assert.equal(globalThis.__queueDrilldownReadSetCount, 1)
  assert.equal(firstPayload.snapshot_at, snapshotAt)
  assert.equal(secondPayload.snapshot_at, snapshotAt)
})

test('queue drilldown serves the last good payload when a refresh hits a transient read timeout', async () => {
  __resetQueueDrilldownRouteCacheForTests()
  globalThis.__queueDrilldownReadSetCount = 0
  globalThis.__queueDrilldownThrowOnReadSet = null
  const snapshotAt = new Date().toISOString()

  globalThis.__queueDrilldownTestReadSet = {
    snapshot_at: snapshotAt,
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: snapshotAt,
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
      started_at: snapshotAt,
      stopped_at: null,
      updated_at: snapshotAt,
      last_error: null,
    },
    fastmcp: { reachable: true },
    rows: [],
    dossiers: [],
  }

  globalThis.__queueDrilldownTestRuntimeSnapshot = {
    snapshot_at: snapshotAt,
    generated_at: snapshotAt,
    control: globalThis.__queueDrilldownTestReadSet.control,
    worker: globalThis.__queueDrilldownTestReadSet.worker,
    fastmcp: { reachable: true },
    queue_depth: 0,
    current_run: null,
    current_live_run: null,
    latest_noteworthy_run: null,
    recent_failures: [],
    failure_buckets: {
      queued: 0,
      running: 0,
      completed: 0,
      retrying: 0,
      reconciling: 0,
      published_degraded: 0,
      failed_terminal: 0,
      worker_stale: 0,
    },
  }

  const first = await GET()
  const firstPayload = await first.json()

  globalThis.__queueDrilldownThrowOnReadSet = 'Connection terminated due to connection timeout'
  const refreshed = await GET(new Request('http://localhost:3005/api/home/queue-drilldown?refresh=1'))
  const refreshedPayload = await refreshed.json()

  assert.equal(firstPayload.snapshot_at, snapshotAt)
  assert.equal(refreshed.status, 200)
  assert.equal(refreshedPayload.snapshot_at, snapshotAt)
  assert.equal(globalThis.__queueDrilldownReadSetCount, 2)
})

test('queue drilldown carries forward a very recent active entity across an inter-batch gap', async () => {
  __resetQueueDrilldownRouteCacheForTests()
  globalThis.__queueDrilldownReadSetCount = 0
  globalThis.__queueDrilldownThrowOnReadSet = null
  const activeAt = new Date().toISOString()

  globalThis.__queueDrilldownTestReadSet = {
    snapshot_at: activeAt,
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: activeAt,
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
      started_at: activeAt,
      stopped_at: null,
      updated_at: activeAt,
      last_error: null,
    },
    fastmcp: { reachable: true },
    rows: [],
    dossiers: [],
  }

  globalThis.__queueDrilldownTestRuntimeSnapshot = {
    snapshot_at: activeAt,
    generated_at: activeAt,
    control: globalThis.__queueDrilldownTestReadSet.control,
    worker: globalThis.__queueDrilldownTestReadSet.worker,
    fastmcp: { reachable: true },
    queue_depth: 1,
    current_run: {
      batch_id: 'batch-andy-reid',
      entity_id: 'andy-reid',
      canonical_entity_id: 'andy-reid',
      entity_name: 'Andy Reid',
      phase: 'entity_registration',
      queue_state: 'running',
      current_question_id: 'q11_decision_owner',
      current_question_text: 'Who is the highest probability buyer?',
      heartbeat_at: activeAt,
    },
    current_live_run: {
      batch_id: 'batch-andy-reid',
      entity_id: 'andy-reid',
      canonical_entity_id: 'andy-reid',
      entity_name: 'Andy Reid',
      phase: 'entity_registration',
      queue_state: 'running',
      current_question_id: 'q11_decision_owner',
      current_question_text: 'Who is the highest probability buyer?',
      heartbeat_at: activeAt,
    },
    latest_noteworthy_run: null,
    recent_failures: [],
    failure_buckets: {
      queued: 0,
      running: 1,
      completed: 0,
      retrying: 0,
      reconciling: 0,
      published_degraded: 0,
      failed_terminal: 0,
      worker_stale: 0,
    },
  }

  const first = await GET(new Request('http://localhost:3005/api/home/queue-drilldown?refresh=1'))
  const firstPayload = await first.json()

  const gapAt = new Date(Date.now() + 1000).toISOString()
  globalThis.__queueDrilldownTestReadSet = {
    ...globalThis.__queueDrilldownTestReadSet,
    snapshot_at: gapAt,
    control: {
      ...globalThis.__queueDrilldownTestReadSet.control,
      updated_at: gapAt,
    },
    worker: {
      ...globalThis.__queueDrilldownTestReadSet.worker,
      updated_at: gapAt,
    },
  }
  globalThis.__queueDrilldownTestRuntimeSnapshot = {
    snapshot_at: gapAt,
    generated_at: gapAt,
    control: globalThis.__queueDrilldownTestReadSet.control,
    worker: globalThis.__queueDrilldownTestReadSet.worker,
    fastmcp: { reachable: true },
    queue_depth: 0,
    current_run: null,
    current_live_run: null,
    latest_noteworthy_run: null,
    recent_failures: [],
    failure_buckets: {
      queued: 0,
      running: 0,
      completed: 0,
      retrying: 0,
      reconciling: 0,
      published_degraded: 0,
      failed_terminal: 0,
      worker_stale: 0,
    },
  }

  const second = await GET(new Request('http://localhost:3005/api/home/queue-drilldown?refresh=1'))
  const secondPayload = await second.json()

  assert.equal(firstPayload.operational_state, 'running')
  assert.equal(secondPayload.operational_state, 'running')
  assert.equal(secondPayload.live_state.current_live_run?.entity_name, 'Andy Reid')
  assert.equal(secondPayload.queue.in_progress_entity?.entity_name, 'Andy Reid')
})

test('queue drilldown synthesizes a live entity from worker activity when db sampling misses a short run', async () => {
  __resetQueueDrilldownRouteCacheForTests()
  globalThis.__queueDrilldownReadSetCount = 0
  globalThis.__queueDrilldownThrowOnReadSet = null
  const snapshotAt = new Date().toISOString()

  globalThis.__queueDrilldownTestReadSet = {
    snapshot_at: snapshotAt,
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: snapshotAt,
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
      started_at: snapshotAt,
      stopped_at: null,
      updated_at: snapshotAt,
      last_error: null,
      current_entity_id: 'andy-reid',
      current_entity_name: 'Andy Reid',
      current_question_id: 'q11_decision_owner',
      current_question_text: 'Who is the highest probability buyer?',
      current_action: 'entity_registration',
      current_phase: 'dossier_generation',
    },
    fastmcp: { reachable: true },
    rows: [],
    dossiers: [],
  }

  globalThis.__queueDrilldownTestRuntimeSnapshot = {
    snapshot_at: snapshotAt,
    generated_at: snapshotAt,
    control: globalThis.__queueDrilldownTestReadSet.control,
    worker: globalThis.__queueDrilldownTestReadSet.worker,
    fastmcp: { reachable: true },
    queue_depth: 0,
    current_run: null,
    current_live_run: null,
    latest_noteworthy_run: null,
    recent_failures: [],
    failure_buckets: {
      queued: 0,
      running: 0,
      completed: 0,
      retrying: 0,
      reconciling: 0,
      published_degraded: 0,
      failed_terminal: 0,
      worker_stale: 0,
    },
  }

  const response = await GET(new Request('http://localhost:3005/api/home/queue-drilldown?refresh=1'))
  const payload = await response.json()

  assert.equal(payload.operational_state, 'running')
  assert.equal(payload.live_state.current_live_run?.entity_name, 'Andy Reid')
  assert.equal(payload.queue.in_progress_entity?.entity_name, 'Andy Reid')
})

test('queue drilldown falls back to the raw worker state file when runtime worker activity is missing', async () => {
  __resetQueueDrilldownRouteCacheForTests()
  globalThis.__queueDrilldownReadSetCount = 0
  globalThis.__queueDrilldownThrowOnReadSet = null
  const snapshotAt = new Date().toISOString()
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'queue-drilldown-worker-state-'))
  const workerStatePath = path.join(tempDir, 'entity-pipeline-worker-state.json')
  await writeFile(workerStatePath, JSON.stringify({
    worker_process_state: 'running',
    worker_pid: 123,
    worker_command: 'npm run worker:entity-pipeline',
    worker_state_path: workerStatePath,
    worker_pid_path: path.join(tempDir, 'entity-pipeline-worker.pid'),
    started_at: snapshotAt,
    stopped_at: null,
    updated_at: snapshotAt,
    last_error: null,
    current_batch_id: 'batch-1',
    current_entity_id: 'neill-blake',
    current_canonical_entity_id: 'neill-blake',
    current_entity_name: 'Neill Blake',
    current_question_id: 'q11_decision_owner',
    current_question_text: 'Who is the highest probability buyer?',
    current_action: 'entity_registration',
    current_phase: 'dossier_generation',
    current_started_at: snapshotAt,
    current_activity_at: snapshotAt,
  }), 'utf8')

  globalThis.__queueDrilldownTestReadSet = {
    snapshot_at: snapshotAt,
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: snapshotAt,
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
      worker_state_path: workerStatePath,
      worker_pid_path: path.join(tempDir, 'entity-pipeline-worker.pid'),
      started_at: snapshotAt,
      stopped_at: null,
      updated_at: snapshotAt,
      last_error: null,
      current_entity_id: null,
      current_entity_name: null,
      current_question_id: null,
      current_question_text: null,
      current_action: null,
      current_phase: null,
    },
    fastmcp: { reachable: true },
    rows: [],
    dossiers: [],
  }

  globalThis.__queueDrilldownTestRuntimeSnapshot = {
    snapshot_at: snapshotAt,
    generated_at: snapshotAt,
    control: globalThis.__queueDrilldownTestReadSet.control,
    worker: globalThis.__queueDrilldownTestReadSet.worker,
    fastmcp: { reachable: true },
    queue_depth: 0,
    current_run: null,
    current_live_run: null,
    latest_noteworthy_run: null,
    recent_failures: [],
    failure_buckets: {
      queued: 0,
      running: 0,
      completed: 0,
      retrying: 0,
      reconciling: 0,
      published_degraded: 0,
      failed_terminal: 0,
      worker_stale: 0,
    },
  }

  const response = await GET(new Request('http://localhost:3005/api/home/queue-drilldown?refresh=1'))
  const payload = await response.json()

  assert.equal(payload.operational_state, 'running')
  assert.equal(payload.runtime.worker.current_entity_name, 'Neill Blake')
  assert.equal(payload.live_state.current_live_run?.entity_name, 'Neill Blake')
  assert.equal(payload.queue.in_progress_entity?.entity_name, 'Neill Blake')
})
