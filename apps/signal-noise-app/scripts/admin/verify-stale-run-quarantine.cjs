#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const { resolve } = require('node:path')
const { config } = require('dotenv')
const pg = require('pg')

const appRoot = resolve(__dirname, '..', '..')
config({ path: resolve(appRoot, '.env'), quiet: true })

function parseArgs(argv = process.argv.slice(2)) {
  return {
    apply: argv.includes('--apply'),
    timeoutSeconds: Number(
      argv.find((arg) => arg.startsWith('--timeout-seconds='))?.split('=')[1] || 30
    ),
  }
}

function createPgPool() {
  if (process.env.DATABASE_URL) {
    return new pg.Pool({ connectionString: process.env.DATABASE_URL })
  }
  return new pg.Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'signal_noise_app',
    user: process.env.PGUSER || process.env.USER,
    password: process.env.PGPASSWORD || undefined,
  })
}

async function backendPreflight() {
  try {
    const healthResponse = await fetch('http://127.0.0.1:8000/health')
    if (!healthResponse.ok) {
      return { ok: false, reason: `backend health http ${healthResponse.status}` }
    }
    const health = await healthResponse.json()
    if (health?.status !== 'healthy') {
      return { ok: false, reason: 'backend health payload unhealthy' }
    }

    const openapiResponse = await fetch('http://127.0.0.1:8000/openapi.json')
    if (!openapiResponse.ok) {
      return { ok: false, reason: `openapi http ${openapiResponse.status}` }
    }
    const openapi = await openapiResponse.json()
    if (!openapi?.paths || !openapi.paths['/api/pipeline/run-entity']) {
      return { ok: false, reason: 'pipeline route missing from openapi' }
    }
    return { ok: true, reason: null }
  } catch (error) {
    return { ok: false, reason: error?.message || String(error) }
  }
}

async function loadState(pool, batchId, entityId) {
  const [controlResult, runResult, activeResult] = await Promise.all([
    pool.query(
      `
        select state, updated_at
        from pipeline_control_state
        where id = 'pipeline'
        limit 1
      `
    ),
    pool.query(
      `
        select id, batch_id, entity_id, status, phase, error_message, completed_at, metadata
        from entity_pipeline_runs
        where batch_id = $1 and entity_id = $2
        limit 1
      `,
      [batchId, entityId]
    ),
    pool.query(
      `
        select count(*) filter (where status in ('running', 'retrying'))::int as active_runs
        from entity_pipeline_runs
      `
    ),
  ])

  const row = controlResult.rows[0]
  const state = row?.state && typeof row.state === 'object' ? row.state : {}
  return {
    control_state: state,
    control_updated_at: row?.updated_at?.toISOString?.() || row?.updated_at || null,
    run: runResult.rows[0] || null,
    active_runs: Number(activeResult.rows[0]?.active_runs || 0),
  }
}

async function seedStaleRun(pool, batchId, entityId) {
  const canonicalEntityId = `codex-stale-${randomUUID()}`
  const entityName = 'Codex Stale Run Verification'
  await pool.query(
    `
      insert into entity_import_batches (
        id, filename, status, total_rows, created_rows, updated_rows, invalid_rows, started_at, metadata
      ) values (
        $1, 'codex-stale-run-verification.csv', 'running', 1, 0, 0, 0, now() - interval '90 minutes',
        jsonb_build_object('source', 'codex_stale_run_verification')
      )
      on conflict (id) do nothing
    `,
    [batchId]
  )

  await pool.query(
    `
      insert into entity_pipeline_runs (
        id, batch_id, entity_id, entity_name, status, phase, error_message, started_at, metadata
      ) values (
        $1, $2, $3, $4, 'running', 'dossier_generation', null, now() - interval '90 minutes',
        jsonb_build_object(
          'canonical_entity_id', $5::text,
          'heartbeat_at', (now() - interval '90 minutes')::text,
          'lease_expires_at', (now() - interval '80 minutes')::text,
          'question_id', 'q11_decision_owner',
          'current_question_id', 'q11_decision_owner',
          'current_question_text', 'Who owns this?',
          'worker_id', 'codex-stale-verification-worker'
        )
      )
      on conflict (id) do update
      set
        batch_id = excluded.batch_id,
        entity_id = excluded.entity_id,
        entity_name = excluded.entity_name,
        status = excluded.status,
        phase = excluded.phase,
        error_message = excluded.error_message,
        started_at = excluded.started_at,
        metadata = excluded.metadata
    `,
    [`${batchId}_${entityId}`, batchId, entityId, entityName, canonicalEntityId]
  )

  const result = await pool.query(
    `
      insert into pipeline_control_state (id, state, updated_at)
      values (
        'pipeline',
        jsonb_build_object(
          'is_paused', false,
          'pause_reason', null,
          'stop_reason', null,
          'requested_state', 'running',
          'desired_state', 'running',
          'observed_state', 'running',
          'transition_state', 'running',
          'state', 'healthy',
          'health_class', 'healthy',
          'current_batch_id', $1::text,
          'current_entity_id', $2::text,
          'current_canonical_entity_id', $3::text,
          'current_entity_name', $4::text,
          'current_question_id', 'q11_decision_owner',
          'current_question_text', 'Who owns this?',
          'current_action', 'q11_decision_owner',
          'current_phase', 'dossier_generation',
          'current_started_at', (now() - interval '90 minutes')::text,
          'current_activity_at', (now() - interval '80 minutes')::text,
          'cursor_source', 'resume_claim',
          'updated_at', now()::text
        ),
        now()
      )
      on conflict (id) do update
      set
        state = coalesce(pipeline_control_state.state, '{}'::jsonb) || jsonb_build_object(
          'is_paused', false,
          'pause_reason', null,
          'stop_reason', null,
          'requested_state', 'running',
          'desired_state', 'running',
          'observed_state', 'running',
          'transition_state', 'running',
          'state', 'healthy',
          'health_class', 'healthy',
          'current_batch_id', $1::text,
          'current_entity_id', $2::text,
          'current_canonical_entity_id', $3::text,
          'current_entity_name', $4::text,
          'current_question_id', 'q11_decision_owner',
          'current_question_text', 'Who owns this?',
          'current_action', 'q11_decision_owner',
          'current_phase', 'dossier_generation',
          'current_started_at', (now() - interval '90 minutes')::text,
          'current_activity_at', (now() - interval '80 minutes')::text,
          'cursor_source', 'resume_claim',
          'updated_at', now()::text
        ),
        updated_at = now()
      returning state
    `,
    [batchId, entityId, canonicalEntityId, entityName]
  )

  return result.rows[0]?.state || null
}

function runOneClaimCycle() {
  const pythonCode = `
import json
import sys
from pathlib import Path

root = Path(${JSON.stringify(appRoot)})
sys.path.insert(0, str(root / "backend"))
from entity_pipeline_worker import EntityPipelineWorker

worker = EntityPipelineWorker()
claimed = worker.claim_next_batch()
print(json.dumps({"claimed": claimed}, default=str))
`
  const result = spawnSync(process.env.PYTHON_BIN || 'python3', ['-c', pythonCode], {
    cwd: appRoot,
    encoding: 'utf8',
  })
  const stdout = (result.stdout || '').trim()
  let parsed = null
  if (stdout) {
    try {
      parsed = JSON.parse(stdout.split('\n').filter(Boolean).at(-1))
    } catch (_error) {
      parsed = null
    }
  }
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    parsed,
  }
}

async function waitForQuarantine(pool, batchId, entityId, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000
  while (Date.now() < deadline) {
    const snapshot = await loadState(pool, batchId, entityId)
    if (
      snapshot.run?.status === 'failed' &&
      snapshot.run?.metadata?.failure_class === 'stale_pipeline_run_quarantined'
    ) {
      return snapshot
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000))
  }
  return loadState(pool, batchId, entityId)
}

async function cleanupSeed(pool, batchId) {
  await pool.query(`delete from entity_import_batches where id = $1`, [batchId])
}

async function main() {
  const args = parseArgs()
  const batchId = `codex-stale-verify-${Date.now()}`
  const entityId = `codex-stale-entity-${randomUUID()}`
  const pool = createPgPool()
  try {
    const backend = await backendPreflight()
    const before = await loadState(pool, batchId, entityId)
    const report = {
      generated_at: new Date().toISOString(),
      apply: args.apply,
      timeout_seconds: args.timeoutSeconds,
      backend_preflight: backend,
      before,
      batch_id: batchId,
      entity_id: entityId,
      action: args.apply ? 'seed_stale_run_and_run_claim_cycle' : 'dry_run_only',
    }

    if (!args.apply) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
      return
    }

    if (!backend.ok) {
      report.error = 'Backend preflight must pass before stale-run quarantine verification.'
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
      process.exitCode = 2
      return
    }

    report.seeded_control_state = await seedStaleRun(pool, batchId, entityId)
    report.claim_cycle = runOneClaimCycle()
    report.after = await waitForQuarantine(pool, batchId, entityId, args.timeoutSeconds)
    report.success = Boolean(
      report.claim_cycle.ok &&
      report.after.run?.status === 'failed' &&
      report.after.run?.metadata?.failure_class === 'stale_pipeline_run_quarantined' &&
      report.after.run?.metadata?.continue_pipeline_on_failure === true &&
      report.after.run?.metadata?.retry_state === 'failed' &&
      report.after.run?.metadata?.recovery_source === 'stale_run_quarantine'
    )
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    if (!report.success) {
      process.exitCode = 3
    }
  } finally {
    await cleanupSeed(pool, batchId)
    await pool.end()
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`)
    process.exitCode = 1
  })
}

module.exports = {
  backendPreflight,
  cleanupSeed,
  createPgPool,
  loadState,
  parseArgs,
  runOneClaimCycle,
  seedStaleRun,
  waitForQuarantine,
}
