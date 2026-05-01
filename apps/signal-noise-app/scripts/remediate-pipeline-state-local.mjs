#!/usr/bin/env node
import { config } from 'dotenv'
import pg from 'pg'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const VALID_QUALITY_STATES = ['partial', 'complete', 'client_ready', 'blocked', 'failed', 'empty']
const DEFAULT_STALE_MINUTES = 30

export function parseArgs(argv = process.argv.slice(2)) {
  const valueFor = (prefix, fallback) => {
    const value = argv.find((arg) => arg.startsWith(`${prefix}=`))?.split('=')[1]
    return value === undefined ? fallback : value
  }

  return {
    apply: argv.includes('--apply'),
    limit: Math.max(1, Number(valueFor('--limit', 5000))),
    staleMinutes: Math.max(1, Number(valueFor('--stale-minutes', DEFAULT_STALE_MINUTES))),
    skipControlReset: argv.includes('--skip-control-reset'),
  }
}

export function createPgPool() {
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

export function buildStaleRunCandidatesQuery() {
  return `
    select
      id,
      batch_id,
      entity_name,
      canonical_entity_id,
      status,
      phase,
      started_at,
      completed_at,
      metadata->>'heartbeat_at' as heartbeat_at,
      metadata->>'current_activity_at' as current_activity_at,
      metadata#>>'{phase_details_by_phase,dossier_generation,current_question_id}' as current_question_id
    from entity_pipeline_runs
    where status in ('running', 'retrying')
      and (
        $1::boolean = true
        or coalesce(
          nullif(metadata->>'heartbeat_at', '')::timestamptz,
          nullif(metadata->>'current_activity_at', '')::timestamptz,
          nullif(metadata->>'updated_at', '')::timestamptz,
          started_at
        ) < now() - make_interval(mins => $2::int)
      )
    order by started_at asc
    limit $3
  `
}

export function buildQuarantineStaleRunsQuery() {
  return `
    update entity_pipeline_runs
    set
      status = 'failed',
      completed_at = now(),
      error_message = coalesce(error_message, 'stale pipeline run quarantined'),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'failure_class', 'stale_pipeline_run_quarantined',
        'continue_pipeline_on_failure', true,
        'retry_state', 'failed',
        'stop_reason', 'stale_pipeline_run_quarantined',
        'quarantined_by', 'remediate-pipeline-state-local',
        'quarantined_at', now()::text,
        'no_live_worker_process', $2::boolean,
        'previous_status', status,
        'previous_phase', phase
      )
    where id = any($1::text[])
      and status in ('running', 'retrying')
    returning id, entity_name, canonical_entity_id, status, phase
  `
}

export function buildDossierQualityCandidatesQuery() {
  return `
    with candidates as (
      select distinct on (ed.id)
        ed.id,
        ed.entity_name,
        ed.canonical_entity_id,
        coalesce(ed.dossier_data->>'quality_state', '') as current_quality_state,
        i.quality_state as ledger_quality_state,
        jsonb_array_length(coalesce(ed.dossier_data->'question_first'->'answers', '[]'::jsonb)) as question_answer_count,
        jsonb_array_length(coalesce(ed.dossier_data->'question_first_checkpoint'->'answer_records', '[]'::jsonb)) as checkpoint_answer_count,
        jsonb_array_length(coalesce(ed.dossier_data->'evidence_urls', '[]'::jsonb)) as evidence_url_count
      from entity_dossiers ed
      left join graphiti_dossier_ingestions i on i.dossier_id = ed.id
      where coalesce(ed.dossier_data->>'quality_state', '') not in ('partial', 'complete', 'client_ready', 'blocked', 'failed', 'empty')
      order by ed.id, i.updated_at desc nulls last
    )
    select
      id,
      entity_name,
      canonical_entity_id,
      current_quality_state,
      ledger_quality_state,
      case
        when ledger_quality_state in ('partial', 'complete', 'client_ready', 'blocked', 'failed', 'empty') then ledger_quality_state
        when question_answer_count = 0 and checkpoint_answer_count = 0 and evidence_url_count = 0 then 'empty'
        else 'partial'
      end as inferred_quality_state
    from candidates
    limit $1
  `
}

export function buildNormalizeDossierQualityQuery() {
  return `
    with backfill(dossier_id, quality_state) as (
      values %VALUES%
    )
    update entity_dossiers ed
    set dossier_data = jsonb_set(
      coalesce(ed.dossier_data, '{}'::jsonb),
      '{quality_state}',
      to_jsonb(backfill.quality_state::text),
      true
    )
    from backfill
    where ed.id = backfill.dossier_id::uuid
      and coalesce(ed.dossier_data->>'quality_state', '') not in ('partial', 'complete', 'client_ready', 'blocked', 'failed', 'empty')
    returning ed.id, ed.entity_name, ed.canonical_entity_id, ed.dossier_data->>'quality_state' as quality_state
  `
}

export function buildResetStaleControlStateQuery() {
  return `
    update pipeline_control_state
    set
      state = coalesce(state, '{}'::jsonb) || jsonb_build_object(
        'requested_state', 'stopped',
        'desired_state', 'stopped',
        'observed_state', 'stopped',
        'transition_state', 'ready_to_start',
        'stop_reason', 'stale_control_state',
        'pause_reason', null,
        'current_action', null,
        'worker_process_alive', $1::boolean,
        'ports_occupied', $2::jsonb,
        'updated_at', now()::text
      ),
      updated_at = now()
    where id = 'pipeline'
      and coalesce(state->>'observed_state', state->>'desired_state', state->>'requested_state') = 'running'
    returning id, state, updated_at
  `
}

async function portProcess(port) {
  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'])
    const lines = stdout.split('\n').map((line) => line.trim()).filter(Boolean)
    return lines.slice(1)
  } catch {
    return []
  }
}

async function workerProcessAlive() {
  try {
    const { stdout } = await execFileAsync('pgrep', ['-f', 'entity_pipeline_worker|worker:entity-pipeline'])
    const pids = stdout.split('\n').map((line) => line.trim()).filter(Boolean)
    if (pids.length === 0) return false
    const { stdout: processList } = await execFileAsync('ps', ['-p', pids.join(','), '-o', 'command='])
    return processList
      .split('\n')
      .some((line) => /entity_pipeline_worker|worker:entity-pipeline/.test(line) && !/pgrep/.test(line))
  } catch {
    return false
  }
}

async function collectRuntimeDiagnostics() {
  const ports = {}
  for (const port of [3005, 8000, 8014]) {
    ports[String(port)] = await portProcess(port)
  }
  const worker_process_alive = await workerProcessAlive()
  return {
    worker_process_alive,
    ports_occupied: ports,
    any_port_occupied: Object.values(ports).some((entries) => entries.length > 0),
  }
}

async function loadStaleRunCandidates(pool, { noLiveProcess, staleMinutes, limit }) {
  const result = await pool.query(buildStaleRunCandidatesQuery(), [noLiveProcess, staleMinutes, limit])
  return result.rows
}

async function quarantineStaleRuns(pool, rows, noLiveProcess) {
  if (rows.length === 0) return []
  const result = await pool.query(buildQuarantineStaleRunsQuery(), [rows.map((row) => row.id), noLiveProcess])
  return result.rows
}

async function loadDossierQualityCandidates(pool, limit) {
  const result = await pool.query(buildDossierQualityCandidatesQuery(), [limit])
  return result.rows
}

async function normalizeDossierQuality(pool, rows) {
  if (rows.length === 0) return []
  const valuesSql = rows.map((_, index) => `($${index * 2 + 1}::uuid, $${index * 2 + 2}::text)`).join(', ')
  const query = buildNormalizeDossierQualityQuery().replace('%VALUES%', valuesSql)
  const params = rows.flatMap((row) => [
    row.id,
    VALID_QUALITY_STATES.includes(row.inferred_quality_state) ? row.inferred_quality_state : 'empty',
  ])
  const result = await pool.query(query, params)
  return result.rows
}

async function resetStaleControlState(pool, diagnostics, apply) {
  const canReset = !diagnostics.worker_process_alive && !diagnostics.any_port_occupied
  const result = {
    eligible: canReset,
    reset: false,
    rows: [],
  }
  if (!canReset || !apply) return result
  const response = await pool.query(
    buildResetStaleControlStateQuery(),
    [diagnostics.worker_process_alive, JSON.stringify(diagnostics.ports_occupied)],
  )
  result.reset = (response.rowCount || 0) > 0
  result.rows = response.rows
  return result
}

async function main() {
  const args = parseArgs()
  const pool = createPgPool()
  const diagnostics = await collectRuntimeDiagnostics()
  const noLiveProcess = !diagnostics.worker_process_alive && !diagnostics.any_port_occupied
  const stats = {
    dry_run: !args.apply,
    stale_minutes: args.staleMinutes,
    runtime: diagnostics,
    no_live_worker_process: !diagnostics.worker_process_alive,
    no_live_process: noLiveProcess,
    stale_run_candidates: 0,
    stale_runs_quarantined: 0,
    dossier_quality_candidates: 0,
    dossier_quality_normalized: 0,
    control_state: { eligible: false, reset: false },
    samples: {
      stale_runs: [],
      dossier_quality: [],
    },
  }

  try {
    const staleRows = await loadStaleRunCandidates(pool, {
      noLiveProcess,
      staleMinutes: args.staleMinutes,
      limit: args.limit,
    })
    const qualityRows = await loadDossierQualityCandidates(pool, args.limit)
    stats.stale_run_candidates = staleRows.length
    stats.dossier_quality_candidates = qualityRows.length
    stats.samples.stale_runs = staleRows.slice(0, 10)
    stats.samples.dossier_quality = qualityRows.slice(0, 10)

    if (args.apply) await pool.query('BEGIN')
    if (args.apply) {
      const quarantined = await quarantineStaleRuns(pool, staleRows, noLiveProcess)
      const normalized = await normalizeDossierQuality(pool, qualityRows)
      stats.stale_runs_quarantined = quarantined.length
      stats.dossier_quality_normalized = normalized.length
      if (!args.skipControlReset) {
        stats.control_state = await resetStaleControlState(pool, diagnostics, true)
      }
    } else if (!args.skipControlReset) {
      stats.control_state = await resetStaleControlState(pool, diagnostics, false)
    }
    if (args.apply) await pool.query('COMMIT')
    console.log(JSON.stringify(stats, null, 2))
  } catch (error) {
    if (args.apply) {
      try { await pool.query('ROLLBACK') } catch {}
    }
    console.error(error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
