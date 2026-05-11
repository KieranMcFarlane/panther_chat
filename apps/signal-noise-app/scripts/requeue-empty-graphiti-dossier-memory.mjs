#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import pg from 'pg'

config({ path: resolve(process.cwd(), '.env'), quiet: true })

const GRAPH_COUNT_QUERY = 'MATCH (n) RETURN count(n)'
const REQUEUE_REASON = 'empty_falkordb_graph'

function parseArgs(argv = process.argv.slice(2)) {
  return {
    apply: argv.includes('--apply'),
    force: argv.includes('--force'),
    limit: Math.max(1, Number(argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 5)),
  }
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

function parseRedisGraphCount(output) {
  const lines = String(output || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const countHeaderIndex = lines.findIndex((line) => line.toLowerCase() === 'count(n)')
  if (countHeaderIndex >= 0) {
    const candidate = Number(lines[countHeaderIndex + 1])
    if (Number.isFinite(candidate)) return candidate
  }
  const numericLine = lines.find((line) => /^\d+$/.test(line))
  if (numericLine) return Number(numericLine)
  throw new Error(`Unable to parse FalkorDB graph count from redis-cli output: ${lines.join(' | ')}`)
}

function redisCliArgs() {
  const uri = process.env.FALKORDB_URI || 'redis://localhost:6379'
  const graphName = process.env.GRAPHITI_DOSSIER_GROUP_ID
    || process.env.GRAPHITI_GROUP_ID
    || process.env.FALKORDB_DATABASE
    || 'entity_dossiers'
  const args = ['-u', uri]
  if (process.env.FALKORDB_USER) args.push('--user', process.env.FALKORDB_USER)
  if (process.env.FALKORDB_PASSWORD) args.push('--pass', process.env.FALKORDB_PASSWORD)
  args.push('GRAPH.QUERY', graphName, GRAPH_COUNT_QUERY)
  return args
}

function loadGraphNodeCount() {
  const output = execFileSync('redis-cli', redisCliArgs(), {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return parseRedisGraphCount(output)
}

async function loadFalseSyncedCandidates(pool, limit) {
  const result = await pool.query(
    `
      select
        id,
        canonical_entity_id,
        entity_name,
        evidence_count,
        answer_count,
        raw_metadata->>'graphiti_memory_sync_status' as previous_status,
        updated_at
      from graphiti_dossier_ingestions
      where status = 'ingested'
        and episode_body is not null
        and raw_metadata->>'graphiti_memory_sync_status' in ('synced', 'queued')
      order by evidence_count desc nulls last, answer_count desc nulls last, updated_at desc nulls last
      limit $1
    `,
    [limit],
  )
  return result.rows
}

async function requeueCandidates(pool, candidates) {
  if (!candidates.length) return []
  const previousStatuses = Object.fromEntries(candidates.map((row) => [row.id, row.previous_status || 'unknown']))
  const result = await pool.query(
    `
      with selected as (
        select
          key::uuid as id,
          value as previous_status
        from jsonb_each_text($1::jsonb)
      )
      update graphiti_dossier_ingestions
         set raw_metadata = (
           coalesce(raw_metadata, '{}'::jsonb)
           - ARRAY[
             'graphiti_memory_sync_status',
             'graphiti_memory_sync_error',
             'graphiti_memory_sync_failed_at',
             'graphiti_memory_response',
             'graphiti_memory_queued_at',
             'graphiti_memory_synced_at'
           ]
         ) || jsonb_build_object(
           'graphiti_memory_sync_status', 'needs_requeue',
           'graphiti_memory_previous_status', selected.previous_status,
           'graphiti_memory_requeue_reason', $2::text,
           'graphiti_memory_requeued_at', now()
         ),
             updated_at = now()
        from selected
       where graphiti_dossier_ingestions.id = selected.id
       returning
         graphiti_dossier_ingestions.id,
         graphiti_dossier_ingestions.canonical_entity_id,
         graphiti_dossier_ingestions.entity_name,
         graphiti_dossier_ingestions.raw_metadata->>'graphiti_memory_sync_status' as graphiti_memory_sync_status
    `,
    [JSON.stringify(previousStatuses), REQUEUE_REASON],
  )
  return result.rows
}

async function main() {
  const args = parseArgs()
  const graphNodeCount = loadGraphNodeCount()

  if (graphNodeCount > 0 && !args.force) {
    console.log(JSON.stringify({
      ok: true,
      dry_run: !args.apply,
      skipped: true,
      reason: 'graph_not_empty',
      graph_node_count: graphNodeCount,
      requeued_count: 0,
    }, null, 2))
    return
  }

  const pool = createPool()
  try {
    const candidates = await loadFalseSyncedCandidates(pool, args.limit)
    const output = {
      ok: true,
      dry_run: !args.apply,
      force: args.force,
      graph_node_count: graphNodeCount,
      candidate_count: candidates.length,
      would_requeue_count: candidates.length,
      candidates: candidates.map((row) => ({
        id: row.id,
        canonical_entity_id: row.canonical_entity_id,
        entity_name: row.entity_name,
        evidence_count: row.evidence_count,
        answer_count: row.answer_count,
        previous_status: row.previous_status,
      })),
    }

    if (args.apply) {
      const updated = await requeueCandidates(pool, candidates)
      output.requeued_count = updated.length
      output.updated = updated
    }

    console.log(JSON.stringify(output, null, 2))
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2))
  process.exit(1)
})
