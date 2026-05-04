import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'

async function loadPipelineRuntimeModule() {
  const sourcePath = new URL('../src/lib/pipeline-runtime.ts', import.meta.url)
  const source = await readFile(sourcePath, 'utf8')
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'pipeline-runtime-'))

  const stubPaths = {
    cachedEntitiesSupabase: path.join(tempDir, 'cached-entities-supabase.ts'),
    operationalHeartbeat: path.join(tempDir, 'operational-heartbeat.ts'),
    pgClient: path.join(tempDir, 'pg-client.ts'),
    pipelineControlState: path.join(tempDir, 'pipeline-control-state.ts'),
    pipelineWorkerSupervisor: path.join(tempDir, 'pipeline-worker-supervisor.ts'),
    questionTextResolver: path.join(tempDir, 'question-text-resolver.ts'),
  }

  await writeFile(stubPaths.cachedEntitiesSupabase, [
    'export const cachedEntitiesSupabase = {',
    '  from() {',
    "    throw new Error('supabase should not be used in this test')",
    '  },',
    '}',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubPaths.operationalHeartbeat, [
    'export const OPERATIONAL_HEARTBEAT_STALE_SECONDS = 60',
    'export function resolveOperationalHeartbeatDetails(input) {',
    '  const heartbeatAt = input?.heartbeat_at || null',
    '  const parsed = heartbeatAt ? Date.parse(String(heartbeatAt)) : Number.NaN',
    '  const ageSeconds = Number.isFinite(parsed) ? Math.max(0, Math.floor((Date.now() - parsed) / 1000)) : null',
    '  return {',
    '    heartbeat_at: heartbeatAt,',
    '    heartbeat_age_seconds: ageSeconds,',
    '  }',
    '}',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubPaths.pgClient, [
    'export async function query() {',
    '  return { rows: [] }',
    '}',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubPaths.pipelineControlState, [
    'export async function readPipelineControlState() {',
    "  return { requested_state: 'running', observed_state: 'running', transition_state: 'running', desired_state: 'running', is_paused: false, updated_at: null, pause_reason: null, stop_reason: null, stop_details: null }",
    '}',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubPaths.pipelineWorkerSupervisor, [
    'export async function inspectPipelineWorkerSupervisorState() {',
    "  return { worker_process_state: 'stopped', worker_pid: null, worker_command: null, worker_state_path: '', worker_pid_path: '', started_at: null, stopped_at: null, updated_at: null, last_error: null }",
    '}',
    '',
  ].join('\n'), 'utf8')

  await writeFile(stubPaths.questionTextResolver, [
    'export function resolveQuestionTextFromDossierData(_dossierData, questionId) {',
    "  return questionId ? `Question ${questionId}` : null",
    '}',
    '',
  ].join('\n'), 'utf8')

  const rewritten = source
    .replaceAll(
      "'@/lib/cached-entities-supabase'",
      JSON.stringify(pathToFileURL(stubPaths.cachedEntitiesSupabase).href),
    )
    .replaceAll(
      "'@/lib/operational-heartbeat'",
      JSON.stringify(pathToFileURL(stubPaths.operationalHeartbeat).href),
    )
    .replaceAll(
      "'@/lib/pg-client'",
      JSON.stringify(pathToFileURL(stubPaths.pgClient).href),
    )
    .replaceAll(
      "'@/lib/pipeline-control-state'",
      JSON.stringify(pathToFileURL(stubPaths.pipelineControlState).href),
    )
    .replaceAll(
      "'@/lib/pipeline-worker-supervisor'",
      JSON.stringify(pathToFileURL(stubPaths.pipelineWorkerSupervisor).href),
    )
    .replaceAll(
      "'@/lib/question-text-resolver'",
      JSON.stringify(pathToFileURL(stubPaths.questionTextResolver).href),
    )

  const tempPath = path.join(tempDir, 'pipeline-runtime.ts')
  await writeFile(tempPath, rewritten, 'utf8')
  return import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`)
}

const { buildPipelineRuntimeSnapshot } = await loadPipelineRuntimeModule()

test('pipeline runtime treats fresh DB activity as live when supervisor crash metadata is stale', () => {
  const snapshot = buildPipelineRuntimeSnapshot({
    snapshot_at: '2026-04-23T12:00:00.000Z',
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: '2026-04-23T11:59:59.000Z',
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
      worker_state_path: '/tmp/entity-pipeline-worker-state.json',
      worker_pid_path: '/tmp/entity-pipeline-worker.pid',
      started_at: '2026-04-23T11:58:00.000Z',
      stopped_at: '2026-04-23T11:59:00.000Z',
      updated_at: '2026-04-23T11:59:00.000Z',
      last_error: 'tracked pid exited',
    },
    fastmcp: {
      url: 'http://127.0.0.1:8001/health',
      reachable: true,
      status_code: 200,
      latency_ms: 10,
      error: null,
    },
    rows: [
      {
        batch_id: 'import_123',
        entity_id: 'arsenal',
        canonical_entity_id: 'arsenal',
        entity_name: 'Arsenal',
        status: 'running',
        phase: 'question_first',
        started_at: new Date(Date.now() - 30_000).toISOString(),
        completed_at: null,
        metadata: {
          heartbeat_at: new Date(Date.now() - 5_000).toISOString(),
          current_question_id: 'q11_decision_owner',
          current_question_text: 'Who owns the decision?',
        },
      },
    ],
    dossiers: [],
  })

  assert.equal(snapshot.worker.worker_process_state, 'running')
  assert.equal(snapshot.worker.worker_health, 'degraded')
  assert.equal(snapshot.current_live_run?.batch_id, 'import_123')
  assert.equal(snapshot.current_live_run?.queue_state, 'running')
  assert.equal(snapshot.control.current_question_id, 'q11_decision_owner')
  assert.equal(snapshot.control.current_question_text, 'Who owns the decision?')
  assert.equal(snapshot.control.cursor_source, 'live_runtime_projection')
  assert.equal(snapshot.failure_buckets.worker_stale, 0)
})

test('pipeline runtime synchronizes top-level control cursor fields from current_live_run', () => {
  const snapshot = buildPipelineRuntimeSnapshot({
    snapshot_at: '2026-05-03T15:20:00.000Z',
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: '2026-05-03T15:19:00.000Z',
      desired_state: 'running',
      requested_state: 'running',
      observed_state: 'running',
      transition_state: 'running',
      current_batch_id: 'import_stale',
      current_entity_id: 'stale-entity',
      current_canonical_entity_id: 'stale-entity',
      current_entity_name: 'Stale Entity',
      current_question_id: 'q11_decision_owner',
      current_question_text: 'Who owns this?',
      current_action: 'q11_decision_owner',
      current_phase: 'dossier_generation',
      current_activity_at: '2026-05-03T15:19:00.000Z',
      cursor_source: 'queued_claim',
    },
    worker: {
      worker_process_state: 'running',
      worker_health: 'healthy',
      worker_pid: 123,
      worker_command: 'npm run worker:entity-pipeline',
      worker_state_path: '/tmp/entity-pipeline-worker-state.json',
      worker_pid_path: '/tmp/entity-pipeline-worker.pid',
      started_at: '2026-05-03T15:10:00.000Z',
      stopped_at: null,
      updated_at: '2026-05-03T15:19:55.000Z',
      last_error: null,
      current_batch_id: 'import_456',
      current_entity_id: 'nepal',
      current_canonical_entity_id: 'nepal',
      current_entity_name: 'Nepal',
      current_question_id: null,
      current_question_text: null,
      current_action: 'dossier_generation',
      current_phase: 'dossier_generation',
      current_started_at: '2026-05-03T15:10:00.000Z',
      current_activity_at: '2026-05-03T15:19:55.000Z',
    },
    fastmcp: {
      url: 'http://127.0.0.1:8000/health',
      reachable: true,
      status_code: 200,
      latency_ms: 10,
      error: null,
    },
    rows: [
      {
        batch_id: 'import_456',
        entity_id: 'nepal',
        canonical_entity_id: 'nepal',
        entity_name: 'Nepal',
        status: 'running',
        phase: 'dossier_generation',
        started_at: new Date(Date.now() - 30_000).toISOString(),
        completed_at: null,
        metadata: {
          heartbeat_at: new Date(Date.now() - 5_000).toISOString(),
          phase_details_by_phase: {
            dossier_generation: {
              current_question_id: 'q11_decision_owner',
              current_question_text: 'Who is the highest probability buyer at Nepal given the current commercial and product context?',
            },
          },
        },
      },
    ],
    dossiers: [],
  })

  assert.equal(snapshot.current_live_run?.entity_name, 'Nepal')
  assert.equal(
    snapshot.control.current_question_text,
    'Who is the highest probability buyer at Nepal given the current commercial and product context?',
  )
  assert.equal(snapshot.control.current_entity_name, snapshot.current_live_run?.entity_name)
  assert.equal(snapshot.control.current_phase, snapshot.current_live_run?.phase)
  assert.equal(snapshot.control.current_action, snapshot.current_live_run?.current_action)
  assert.equal(snapshot.control.current_activity_at, snapshot.current_live_run?.heartbeat_at)
  assert.equal(snapshot.control.cursor_source, 'live_runtime_projection')
})

test('pipeline runtime uses fresh worker cursor when matching running row has no heartbeat yet', () => {
  const workerActivityAt = new Date(Date.now() - 5_000).toISOString()
  const snapshot = buildPipelineRuntimeSnapshot({
    snapshot_at: '2026-05-04T16:45:00.000Z',
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: '2026-05-04T16:44:00.000Z',
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
      worker_state_path: '/tmp/entity-pipeline-worker-state.json',
      worker_pid_path: '/tmp/entity-pipeline-worker.pid',
      started_at: '2026-05-04T16:40:00.000Z',
      stopped_at: null,
      updated_at: workerActivityAt,
      last_error: null,
      current_batch_id: 'operator_q3_123',
      current_entity_id: 'as-roma',
      current_canonical_entity_id: 'as-roma',
      current_entity_name: 'AS Roma',
      current_question_id: 'q3_leadership',
      current_question_text: null,
      current_action: 'q3_leadership',
      current_phase: 'dossier_generation',
      current_started_at: '2026-05-04T16:44:30.000Z',
      current_activity_at: workerActivityAt,
    },
    fastmcp: {
      url: 'http://127.0.0.1:8000/health',
      reachable: true,
      status_code: 200,
      latency_ms: 10,
      error: null,
    },
    rows: [
      {
        batch_id: 'operator_q3_123',
        entity_id: 'as-roma',
        canonical_entity_id: 'as-roma',
        entity_name: 'AS Roma',
        status: 'running',
        phase: 'entity_registration',
        started_at: new Date(Date.now() - 30_000).toISOString(),
        completed_at: null,
        metadata: {
          source: 'entity_dossier_operator_rerun',
          rerun_mode: 'question',
          question_id: 'q3_leadership',
        },
      },
    ],
    dossiers: [],
  })

  assert.equal(snapshot.current_live_run?.entity_name, 'AS Roma')
  assert.equal(snapshot.current_live_run?.current_question_id, 'q3_leadership')
  assert.equal(snapshot.current_live_run?.current_action, 'q3_leadership')
  assert.equal(snapshot.current_live_run?.phase, 'dossier_generation')
  assert.equal(snapshot.current_live_run?.queue_state, 'running')
  assert.equal(snapshot.current_live_run?.heartbeat_at, workerActivityAt)
  assert.equal(snapshot.control.current_entity_name, 'AS Roma')
  assert.equal(snapshot.control.current_question_id, 'q3_leadership')
})

test('pipeline runtime prefers fresh worker cursor over stale DB question metadata for the same run', () => {
  const heartbeatAt = new Date(Date.now() - 5_000).toISOString()
  const snapshot = buildPipelineRuntimeSnapshot({
    snapshot_at: '2026-05-04T16:45:00.000Z',
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: '2026-05-04T16:44:00.000Z',
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
      worker_state_path: '/tmp/entity-pipeline-worker-state.json',
      worker_pid_path: '/tmp/entity-pipeline-worker.pid',
      started_at: '2026-05-04T16:40:00.000Z',
      stopped_at: null,
      updated_at: heartbeatAt,
      last_error: null,
      current_batch_id: 'operator_q3_456',
      current_entity_id: 'moto3',
      current_canonical_entity_id: 'moto3',
      current_entity_name: 'Moto3 World Championship',
      current_question_id: 'q11_decision_owner',
      current_question_text: null,
      current_action: 'q11_decision_owner',
      current_phase: 'dossier_generation',
      current_started_at: '2026-05-04T16:44:30.000Z',
      current_activity_at: heartbeatAt,
    },
    fastmcp: {
      url: 'http://127.0.0.1:8000/health',
      reachable: true,
      status_code: 200,
      latency_ms: 10,
      error: null,
    },
    rows: [
      {
        batch_id: 'operator_q3_456',
        entity_id: 'moto3',
        canonical_entity_id: 'moto3',
        entity_name: 'Moto3 World Championship',
        status: 'running',
        phase: 'dossier_generation',
        started_at: new Date(Date.now() - 30_000).toISOString(),
        completed_at: null,
        metadata: {
          heartbeat_at: heartbeatAt,
          current_question_id: 'q15_outreach_strategy',
          current_action: 'dossier_generation',
        },
      },
    ],
    dossiers: [],
  })

  assert.equal(snapshot.current_live_run?.current_question_id, 'q11_decision_owner')
  assert.equal(snapshot.current_live_run?.current_action, 'q11_decision_owner')
  assert.equal(snapshot.control.current_question_id, 'q11_decision_owner')
  assert.equal(snapshot.control.current_action, 'q11_decision_owner')
})

test('pipeline runtime clears stale top-level control cursor fields when no fresh live run exists', () => {
  const snapshot = buildPipelineRuntimeSnapshot({
    snapshot_at: '2026-05-03T15:25:00.000Z',
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: '2026-05-03T15:24:00.000Z',
      desired_state: 'running',
      requested_state: 'running',
      observed_state: 'running',
      transition_state: 'running',
      current_batch_id: 'import_stale',
      current_entity_id: 'stale-entity',
      current_canonical_entity_id: 'stale-entity',
      current_entity_name: 'Stale Entity',
      current_question_id: 'q11_decision_owner',
      current_question_text: 'Who owns this?',
      current_action: 'q11_decision_owner',
      current_phase: 'dossier_generation',
      current_activity_at: '2026-05-03T15:24:00.000Z',
      cursor_source: 'queued_claim',
    },
    worker: {
      worker_process_state: 'running',
      worker_health: 'healthy',
      worker_pid: 123,
      worker_command: 'npm run worker:entity-pipeline',
      worker_state_path: '/tmp/entity-pipeline-worker-state.json',
      worker_pid_path: '/tmp/entity-pipeline-worker.pid',
      started_at: '2026-05-03T15:10:00.000Z',
      stopped_at: null,
      updated_at: '2026-05-03T15:24:55.000Z',
      last_error: null,
      current_batch_id: 'import_stale',
      current_entity_id: 'stale-entity',
      current_canonical_entity_id: 'stale-entity',
      current_entity_name: 'Stale Entity',
      current_question_id: null,
      current_question_text: null,
      current_action: null,
      current_phase: null,
      current_started_at: null,
      current_activity_at: null,
    },
    fastmcp: {
      url: 'http://127.0.0.1:8000/health',
      reachable: true,
      status_code: 200,
      latency_ms: 10,
      error: null,
    },
    rows: [
      {
        batch_id: 'import_old',
        entity_id: 'old-entity',
        canonical_entity_id: 'old-entity',
        entity_name: 'Old Entity',
        status: 'queued',
        phase: 'dossier_generation',
        started_at: new Date(Date.now() - 300_000).toISOString(),
        completed_at: null,
        metadata: {},
      },
    ],
    dossiers: [],
  })

  assert.equal(snapshot.current_live_run, null)
  assert.equal(snapshot.control.current_batch_id, null)
  assert.equal(snapshot.control.current_entity_name, null)
  assert.equal(snapshot.control.current_question_text, null)
  assert.equal(snapshot.control.cursor_source, null)
})

test('pipeline runtime does not treat a fresh queued row as proof that a stopped worker is running', () => {
  const snapshot = buildPipelineRuntimeSnapshot({
    snapshot_at: '2026-04-23T12:00:00.000Z',
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: '2026-04-23T11:59:59.000Z',
      desired_state: 'running',
      requested_state: 'running',
      observed_state: 'running',
      transition_state: 'running',
    },
    worker: {
      worker_process_state: 'stopped',
      worker_health: 'stopped',
      worker_pid: null,
      worker_command: 'npm run worker:entity-pipeline',
      worker_state_path: '/tmp/entity-pipeline-worker-state.json',
      worker_pid_path: '/tmp/entity-pipeline-worker.pid',
      started_at: '2026-04-23T11:58:00.000Z',
      stopped_at: '2026-04-23T11:59:00.000Z',
      updated_at: '2026-04-23T11:59:00.000Z',
      last_error: null,
    },
    fastmcp: {
      url: 'http://127.0.0.1:8001/health',
      reachable: true,
      status_code: 200,
      latency_ms: 10,
      error: null,
    },
    rows: [
      {
        batch_id: 'import_queued',
        entity_id: 'arsenal',
        canonical_entity_id: 'arsenal',
        entity_name: 'Arsenal',
        status: 'queued',
        phase: 'question_first',
        started_at: new Date(Date.now() - 5_000).toISOString(),
        completed_at: null,
        metadata: {},
      },
    ],
    dossiers: [],
  })

  assert.equal(snapshot.worker.worker_process_state, 'stopped')
  assert.equal(snapshot.worker.worker_health, 'stopped')
  assert.equal(snapshot.current_live_run, null)
  assert.equal(snapshot.current_run?.queue_state, 'worker_stale')
  assert.equal(snapshot.failure_buckets.worker_stale, 1)
})

test('pipeline runtime surfaces blocked provider state and last self-heal metadata from control state', () => {
  const snapshot = buildPipelineRuntimeSnapshot({
    snapshot_at: '2026-05-03T12:00:00.000Z',
    control: {
      is_paused: true,
      pause_reason: 'provider infrastructure failure',
      stop_reason: 'provider_infrastructure_failure',
      stop_details: { reason: 'provider_infrastructure_failure' },
      updated_at: '2026-05-03T11:59:59.000Z',
      desired_state: 'paused',
      requested_state: 'paused',
      observed_state: 'paused',
      transition_state: 'paused',
      health_class: 'blocked_provider',
      state: 'blocked_provider',
      last_self_heal_action: 'provider_auto_resume',
      last_self_heal_reason: 'provider preflight recovered',
      last_self_heal_at: '2026-05-03T11:55:00.000Z',
    },
    worker: {
      worker_process_state: 'running',
      worker_health: 'healthy',
      worker_pid: 999,
      worker_command: 'npm run worker:entity-pipeline',
      worker_state_path: '/tmp/entity-pipeline-worker-state.json',
      worker_pid_path: '/tmp/entity-pipeline-worker.pid',
      started_at: '2026-05-03T11:00:00.000Z',
      stopped_at: null,
      updated_at: '2026-05-03T11:59:00.000Z',
      last_error: null,
    },
    fastmcp: {
      url: 'http://127.0.0.1:8014/health',
      reachable: true,
      status_code: 200,
      latency_ms: 12,
      error: null,
    },
    rows: [],
    dossiers: [],
  })

  assert.equal(snapshot.health_class, 'blocked_provider')
  assert.equal(snapshot.state, 'blocked_provider')
  assert.equal(snapshot.last_self_heal_action, 'provider_auto_resume')
  assert.equal(snapshot.last_self_heal_reason, 'provider preflight recovered')
  assert.equal(snapshot.last_self_heal_at, '2026-05-03T11:55:00.000Z')
})

test('pipeline runtime does not expose a fresh queued row as current_live_run when the worker is healthy', () => {
  const snapshot = buildPipelineRuntimeSnapshot({
    snapshot_at: '2026-04-23T12:00:00.000Z',
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: '2026-04-23T11:59:59.000Z',
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
      worker_state_path: '/tmp/entity-pipeline-worker-state.json',
      worker_pid_path: '/tmp/entity-pipeline-worker.pid',
      started_at: '2026-04-23T11:58:00.000Z',
      stopped_at: null,
      updated_at: '2026-04-23T11:59:59.000Z',
      last_error: null,
    },
    fastmcp: {
      url: 'http://127.0.0.1:8001/health',
      reachable: true,
      status_code: 200,
      latency_ms: 10,
      error: null,
    },
    rows: [
      {
        batch_id: 'import_queued_live',
        entity_id: 'porto',
        canonical_entity_id: 'porto',
        entity_name: 'FC Porto',
        status: 'queued',
        phase: 'entity_registration',
        started_at: new Date(Date.now() - 5_000).toISOString(),
        completed_at: null,
        metadata: {
          current_question_id: 'q11_decision_owner',
        },
      },
    ],
    dossiers: [],
  })

  assert.equal(snapshot.current_live_run, null)
  assert.equal(snapshot.current_run, null)
  assert.equal(snapshot.failure_buckets.queued, 1)
})

test('pipeline runtime does not treat a claiming row without fresh heartbeat as proof that a crashed worker recovered', () => {
  const snapshot = buildPipelineRuntimeSnapshot({
    snapshot_at: '2026-04-23T12:00:00.000Z',
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: '2026-04-23T11:59:59.000Z',
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
      worker_state_path: '/tmp/entity-pipeline-worker-state.json',
      worker_pid_path: '/tmp/entity-pipeline-worker.pid',
      started_at: '2026-04-23T11:58:00.000Z',
      stopped_at: '2026-04-23T11:59:00.000Z',
      updated_at: '2026-04-23T11:59:00.000Z',
      last_error: 'tracked pid exited',
    },
    fastmcp: {
      url: 'http://127.0.0.1:8001/health',
      reachable: true,
      status_code: 200,
      latency_ms: 10,
      error: null,
    },
    rows: [
      {
        batch_id: 'import_claiming',
        entity_id: 'porto',
        canonical_entity_id: 'porto',
        entity_name: 'FC Porto',
        status: 'claiming',
        phase: 'entity_registration',
        started_at: new Date(Date.now() - 5_000).toISOString(),
        completed_at: null,
        metadata: {},
      },
    ],
    dossiers: [],
  })

  assert.equal(snapshot.worker.worker_process_state, 'crashed')
  assert.equal(snapshot.worker.worker_health, 'degraded')
  assert.equal(snapshot.current_live_run, null)
  assert.equal(snapshot.current_run?.queue_state, 'worker_stale')
  assert.equal(snapshot.failure_buckets.worker_stale, 1)
})

test('pipeline runtime does not expose stale running rows as live work when the worker process is running', () => {
  const staleHeartbeatAt = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  const snapshot = buildPipelineRuntimeSnapshot({
    snapshot_at: '2026-04-23T12:00:00.000Z',
    control: {
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      updated_at: '2026-04-23T11:59:59.000Z',
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
      worker_state_path: '/tmp/entity-pipeline-worker-state.json',
      worker_pid_path: '/tmp/entity-pipeline-worker.pid',
      started_at: '2026-04-23T11:58:00.000Z',
      stopped_at: null,
      updated_at: '2026-04-23T11:59:59.000Z',
      last_error: null,
      current_batch_id: 'import_stale',
      current_canonical_entity_id: 'pge-skra',
    },
    fastmcp: {
      url: 'http://127.0.0.1:8001/health',
      reachable: true,
      status_code: 200,
      latency_ms: 10,
      error: null,
    },
    rows: [
      {
        batch_id: 'import_stale',
        entity_id: 'pge-skra',
        canonical_entity_id: 'pge-skra',
        entity_name: 'PGE Skra Belchatow',
        status: 'running',
        phase: 'dossier_generation',
        started_at: staleHeartbeatAt,
        completed_at: null,
        metadata: {
          heartbeat_at: staleHeartbeatAt,
          current_question_id: 'q1_foundation',
          current_question_text: 'What is the canonical identity?',
        },
      },
    ],
    dossiers: [],
  })

  assert.equal(snapshot.worker.worker_process_state, 'running')
  assert.equal(snapshot.current_live_run, null)
  assert.equal(snapshot.current_run?.queue_state, 'worker_stale')
  assert.equal(snapshot.failure_buckets.worker_stale, 1)
})
