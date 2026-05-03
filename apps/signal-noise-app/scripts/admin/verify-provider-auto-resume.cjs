#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
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

function runSmoke() {
  const result = spawnSync('bash', ['scripts/smoke-zai-inference.sh'], {
    cwd: appRoot,
    encoding: 'utf8',
  })
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
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

async function loadState(pool) {
  const [controlResult, activeResult] = await Promise.all([
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
        select count(*) filter (where status in ('running', 'retrying'))::int as active_runs
        from entity_pipeline_runs
      `
    ),
  ])

  const row = controlResult.rows[0]
  const state = row?.state && typeof row.state === 'object' ? row.state : {}
  return {
    state,
    updated_at: row?.updated_at?.toISOString?.() || row?.updated_at || null,
    active_runs: Number(activeResult.rows[0]?.active_runs || 0),
  }
}

async function seedProviderPause(pool) {
  const result = await pool.query(
    `
      insert into pipeline_control_state (id, state, updated_at)
      values (
        'pipeline',
        jsonb_build_object(
          'is_paused', true,
          'pause_reason', 'provider infrastructure failure: verification seed',
          'stop_reason', 'provider_infrastructure_failure',
          'stop_details', jsonb_build_object(
            'reason', 'provider_infrastructure_failure',
            'error_type', 'provider_infrastructure_failure',
            'error_message', 'verification seed'
          ),
          'state', 'blocked_provider',
          'health_class', 'blocked_provider',
          'requested_state', 'paused',
          'desired_state', 'paused',
          'observed_state', 'paused',
          'transition_state', 'paused',
          'current_batch_id', null,
          'current_entity_id', null,
          'current_canonical_entity_id', null,
          'current_entity_name', null,
          'current_question_id', null,
          'current_question_text', null,
          'current_action', null,
          'current_phase', null,
          'current_started_at', null,
          'current_activity_at', null,
          'cursor_source', null,
          'updated_at', now()::text
        ),
        now()
      )
      on conflict (id) do update
      set
        state = coalesce(pipeline_control_state.state, '{}'::jsonb) || jsonb_build_object(
          'is_paused', true,
          'pause_reason', 'provider infrastructure failure: verification seed',
          'stop_reason', 'provider_infrastructure_failure',
          'stop_details', jsonb_build_object(
            'reason', 'provider_infrastructure_failure',
            'error_type', 'provider_infrastructure_failure',
            'error_message', 'verification seed'
          ),
          'state', 'blocked_provider',
          'health_class', 'blocked_provider',
          'requested_state', 'paused',
          'desired_state', 'paused',
          'observed_state', 'paused',
          'transition_state', 'paused',
          'current_batch_id', null,
          'current_entity_id', null,
          'current_canonical_entity_id', null,
          'current_entity_name', null,
          'current_question_id', null,
          'current_question_text', null,
          'current_action', null,
          'current_phase', null,
          'current_started_at', null,
          'current_activity_at', null,
          'cursor_source', null,
          'updated_at', now()::text
        ),
        updated_at = now()
      returning state
    `
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

async function waitForResume(pool, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000
  while (Date.now() < deadline) {
    const snapshot = await loadState(pool)
    const paused = Boolean(
      snapshot.state?.is_paused ||
      snapshot.state?.requested_state === 'paused' ||
      snapshot.state?.observed_state === 'paused'
    )
    if (!paused && snapshot.state?.last_self_heal_action === 'provider_auto_resume') {
      return snapshot
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000))
  }
  return loadState(pool)
}

async function main() {
  const args = parseArgs()
  const pool = createPgPool()
  try {
    const [smoke, backend, before] = await Promise.all([
      Promise.resolve(runSmoke()),
      backendPreflight(),
      loadState(pool),
    ])

    const report = {
      generated_at: new Date().toISOString(),
      apply: args.apply,
      timeout_seconds: args.timeoutSeconds,
      smoke: { ok: smoke.ok, status: smoke.status },
      backend_preflight: backend,
      before,
      action: args.apply ? 'seed_provider_pause_and_run_claim_cycle' : 'dry_run_only',
    }

    if (!args.apply) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
      return
    }

    if (!smoke.ok || !backend.ok) {
      report.error = 'Smoke and backend preflight must both pass before provider auto-resume verification.'
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
      process.exitCode = 2
      return
    }

    report.seeded_control_state = await seedProviderPause(pool)
    report.claim_cycle = runOneClaimCycle()
    report.after = await waitForResume(pool, args.timeoutSeconds)
    report.success = Boolean(
      report.claim_cycle.ok &&
      report.after.state?.last_self_heal_action === 'provider_auto_resume' &&
      report.after.state?.is_paused !== true
    )
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    if (!report.success) {
      process.exitCode = 3
    }
  } finally {
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
  createPgPool,
  loadState,
  parseArgs,
  runOneClaimCycle,
  runSmoke,
  seedProviderPause,
  waitForResume,
}
