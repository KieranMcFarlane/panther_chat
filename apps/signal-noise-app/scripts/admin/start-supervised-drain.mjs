#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import pg from 'pg'

config({ path: resolve(process.cwd(), '.env'), quiet: true })

function parseArgs(argv) {
  const args = {
    batchIds: [],
    fromCurrentQueued: false,
    limit: 9,
    reason: 'supervised pilot drain',
    startWorker: false,
    dryRun: false,
  }
  for (const arg of argv) {
    if (arg.startsWith('--batch-ids=')) {
      args.batchIds = arg.slice('--batch-ids='.length).split(',').map((value) => value.trim()).filter(Boolean)
    } else if (arg === '--from-current-queued') {
      args.fromCurrentQueued = true
    } else if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.slice('--limit='.length))
      if (Number.isFinite(parsed) && parsed > 0) args.limit = Math.floor(parsed)
    } else if (arg.startsWith('--reason=')) {
      args.reason = arg.slice('--reason='.length).trim() || args.reason
    } else if (arg === '--start-worker') {
      args.startWorker = true
    } else if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  if (!args.fromCurrentQueued && args.batchIds.length === 0) {
    throw new Error('Provide --batch-ids=<ids> or --from-current-queued')
  }
  return args
}

function printHelp() {
  console.log(`Usage:
  node scripts/admin/start-supervised-drain.mjs --batch-ids=batch1,batch2 [--start-worker]
  node scripts/admin/start-supervised-drain.mjs --from-current-queued --limit=9 [--start-worker]
  Add --dry-run to print the selected batch IDs without writing control state.
`)
}

function createPool() {
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

async function resolveBatchIds(pool, args) {
  if (args.batchIds.length > 0) return args.batchIds
  const result = await pool.query(
    `select distinct b.id, b.started_at
       from entity_import_batches b
       join entity_pipeline_runs r on r.batch_id = b.id
      where b.status = 'queued'
        and b.completed_at is null
        and r.status in ('queued', 'retrying', 'claiming')
      order by b.started_at asc nulls last, b.id asc
      limit $1`,
    [args.limit],
  )
  return result.rows.map((row) => String(row.id)).filter(Boolean)
}

async function readCurrentControlState(pool) {
  const result = await pool.query(
    `select state from pipeline_control_state where id = 'pipeline' limit 1`,
  )
  const state = result.rows[0]?.state
  return state && typeof state === 'object' ? state : {}
}

async function writeControlState(pool, state) {
  await pool.query(
    `insert into pipeline_control_state (id, state, updated_at)
     values ('pipeline', $1::jsonb, $2::timestamptz)
     on conflict (id) do update set state = excluded.state, updated_at = excluded.updated_at`,
    [JSON.stringify(state), state.updated_at],
  )
}

function startWorker() {
  const workerPidPath = resolve(process.cwd(), 'tmp/entity-pipeline-worker.pid')
  const supervisorPidPath = resolve(process.cwd(), 'tmp/entity-pipeline-worker-supervisor.pid')
  for (const pidPath of [workerPidPath, supervisorPidPath]) {
    if (!existsSync(pidPath)) continue
    const pid = Number(readFileSync(pidPath, 'utf8').trim())
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0)
        return pid
      } catch {
        // Stale pid file; continue to direct worker start.
      }
    }
  }
  const backendPort = process.env.SIGNAL_NOISE_BACKEND_PORT || '8002'
  const graphitiPort = process.env.GRAPHITI_MCP_PORT || '8000'
  const defaultBackendUrl = `http://127.0.0.1:${backendPort}`
  const normalizeBackendUrl = (value) => {
    const url = value || defaultBackendUrl
    if (url === `http://127.0.0.1:${graphitiPort}` || url === `http://localhost:${graphitiPort}`) {
      return defaultBackendUrl
    }
    return url
  }
  const fastapiUrl = normalizeBackendUrl(process.env.FASTAPI_URL)
  const pythonBackendUrl = normalizeBackendUrl(process.env.PYTHON_BACKEND_URL)
  const child = spawn('bash', ['-lc', 'PANTHER_CHAT_ALLOW_DIRECT_START=1 npm run worker:entity-pipeline'], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      ENTITY_IMPORT_QUEUE_MODE: process.env.ENTITY_IMPORT_QUEUE_MODE || 'durable_worker',
      FASTAPI_URL: fastapiUrl,
      PYTHON_BACKEND_URL: pythonBackendUrl,
      SIGNAL_NOISE_BACKEND_PORT: backendPort,
    },
  })
  child.unref()
  return child.pid ?? null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const pool = createPool()
  try {
    const batchIds = await resolveBatchIds(pool, args)
    if (batchIds.length === 0) {
      throw new Error('No queued batch IDs found for supervised drain')
    }
    const nowIso = new Date().toISOString()
    const current = await readCurrentControlState(pool)
    const nextState = {
      ...current,
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      desired_state: 'running',
      requested_state: 'running',
      observed_state: 'starting',
      transition_state: 'starting',
      state: 'recovering',
      health_class: 'recovering',
      current_batch_id: null,
      current_entity_id: null,
      current_canonical_entity_id: null,
      current_entity_name: null,
      current_question_id: null,
      current_question_text: null,
      current_action: null,
      current_phase: null,
      current_started_at: null,
      current_activity_at: null,
      updated_at: nowIso,
      recovery_source: 'supervised_drain',
      supervised_drain_enabled: true,
      supervised_drain_allowed_batch_ids: batchIds,
      supervised_drain_disable_manifest_auto_advance: true,
      supervised_drain_pause_when_exhausted: true,
      supervised_drain_reason: args.reason,
    }
    if (!args.dryRun) {
      await writeControlState(pool, nextState)
    }
    const workerPid = args.startWorker && !args.dryRun ? startWorker() : null
    console.log(JSON.stringify({
      supervised_drain_enabled: true,
      batch_ids: batchIds,
      count: batchIds.length,
      start_worker: args.startWorker,
      dry_run: args.dryRun,
      worker_pid: workerPid,
      reason: args.reason,
    }, null, 2))
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
