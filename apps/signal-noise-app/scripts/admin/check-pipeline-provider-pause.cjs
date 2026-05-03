#!/usr/bin/env node

const { resolve } = require('node:path')
const { config } = require('dotenv')
const pg = require('pg')

config({ path: resolve(__dirname, '..', '..', '.env'), quiet: true })

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

async function loadPipelineControlState(pool) {
  const result = await pool.query(`
    select state, updated_at
    from pipeline_control_state
    where id = 'pipeline'
    limit 1
  `)
  const row = result.rows[0]
  const state = row?.state && typeof row.state === 'object' ? row.state : {}
  return {
    is_paused: Boolean(state.is_paused || state.requested_state === 'paused' || state.observed_state === 'paused'),
    requested_state: state.requested_state || null,
    observed_state: state.observed_state || null,
    desired_state: state.desired_state || null,
    transition_state: state.transition_state || null,
    stop_reason: state.stop_reason || null,
    pause_reason: state.pause_reason || null,
    current_entity: state.current_entity || state.current_entity_name || null,
    current_action: state.current_action || null,
    updated_at: row?.updated_at?.toISOString?.() || row?.updated_at || state.updated_at || null,
  }
}

async function loadRunCounts(pool) {
  const result = await pool.query(`
    select
      count(*) filter (where status in ('running', 'retrying'))::int as active_runs,
      count(*) filter (where status = 'queued')::int as queued_runs
    from entity_pipeline_runs
  `)
  return {
    active_runs: Number(result.rows[0]?.active_runs || 0),
    queued_runs: Number(result.rows[0]?.queued_runs || 0),
  }
}

async function loadRecentProviderFailures(pool) {
  const result = await pool.query(`
    select
      id,
      batch_id,
      entity_name,
      canonical_entity_id,
      status,
      phase,
      error_message,
      completed_at,
      metadata->>'updated_at' as updated_at
    from entity_pipeline_runs
    where coalesce(metadata->>'failure_class', '') = 'provider_infrastructure_failure'
       or coalesce(metadata->>'stop_reason', '') = 'provider_infrastructure_failure'
    order by coalesce(completed_at, nullif(metadata->>'updated_at', '')::timestamptz, started_at) desc nulls last
    limit 10
  `)
  return result.rows.map((row) => ({
    id: row.id,
    batch_id: row.batch_id,
    entity_name: row.entity_name,
    canonical_entity_id: row.canonical_entity_id,
    status: row.status,
    phase: row.phase,
    error_message: row.error_message,
    completed_at: row.completed_at?.toISOString?.() || row.completed_at || null,
    updated_at: row.updated_at?.toISOString?.() || row.updated_at || null,
  }))
}

async function main() {
  const pool = createPgPool()
  try {
    const [control, counts, recent_provider_failures] = await Promise.all([
      loadPipelineControlState(pool),
      loadRunCounts(pool),
      loadRecentProviderFailures(pool),
    ])
    const providerPaused = control.stop_reason === 'provider_infrastructure_failure'
    const report = {
      generated_at: new Date().toISOString(),
      control,
      active_runs: counts.active_runs,
      queued_runs: counts.queued_runs,
      recent_provider_failures,
      safe_to_resume: !providerPaused && counts.active_runs === 0,
      resume_blocker: providerPaused ? 'provider_infrastructure_failure' : null,
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
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
  loadPipelineControlState,
  loadRunCounts,
  loadRecentProviderFailures,
}
