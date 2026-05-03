#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const { resolve } = require('node:path')
const { config } = require('dotenv')
const pg = require('pg')

config({ path: resolve(__dirname, '..', '..', '.env'), quiet: true })

function parseArgs(argv = process.argv.slice(2)) {
  return {
    apply: argv.includes('--apply'),
    skipSmoke: argv.includes('--skip-smoke'),
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
    cwd: resolve(__dirname, '..', '..'),
    encoding: 'utf8',
  })
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

async function loadResumeState(pool) {
  const controlResult = await pool.query(`
    select state
    from pipeline_control_state
    where id = 'pipeline'
    limit 1
  `)
  const activeResult = await pool.query(`
    select count(*)::int as active_runs
    from entity_pipeline_runs
    where status in ('running', 'retrying')
  `)
  const state = controlResult.rows[0]?.state && typeof controlResult.rows[0].state === 'object'
    ? controlResult.rows[0].state
    : {}
  return {
    stop_reason: state.stop_reason || null,
    pause_reason: state.pause_reason || null,
    requested_state: state.requested_state || null,
    observed_state: state.observed_state || null,
    active_runs: Number(activeResult.rows[0]?.active_runs || 0),
  }
}

async function resumePipeline(pool) {
  const result = await pool.query(`
    update pipeline_control_state
    set
      state = coalesce(state, '{}'::jsonb) || jsonb_build_object(
        'is_paused', false,
        'requested_state', 'running',
        'desired_state', 'running',
        'observed_state', 'running',
        'transition_state', 'running',
        'stop_reason', null,
        'pause_reason', null,
        'stop_details', null,
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
        'resumed_after_provider_activation_at', now()::text,
        'updated_at', now()::text
      ),
      updated_at = now()
    where id = 'pipeline'
    returning state
  `)
  return result.rows[0]?.state || null
}

async function main() {
  const args = parseArgs()
  const pool = createPgPool()
  try {
    const smoke = args.skipSmoke ? { ok: true, status: 0, skipped: true } : runSmoke()
    const state = await loadResumeState(pool)
    const safe_to_resume = smoke.ok
      && state.stop_reason === 'provider_infrastructure_failure'
      && state.active_runs === 0
    const report = {
      generated_at: new Date().toISOString(),
      apply: args.apply,
      smoke: {
        ok: smoke.ok,
        status: smoke.status,
        skipped: Boolean(smoke.skipped),
      },
      control: state,
      active_runs: state.active_runs,
      safe_to_resume,
      action: args.apply && safe_to_resume ? 'resume_pipeline' : 'dry_run_only',
    }

    if (args.apply && safe_to_resume) {
      report.control_after = await resumePipeline(pool)
    }

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    if (!safe_to_resume) process.exitCode = args.apply ? 2 : 0
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
  createPgPool,
  loadResumeState,
  parseArgs,
  resumePipeline,
  runSmoke,
}
