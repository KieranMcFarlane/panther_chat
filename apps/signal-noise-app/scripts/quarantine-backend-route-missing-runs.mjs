#!/usr/bin/env node
import { config } from 'dotenv';
import pg from 'pg';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env'), quiet: true });

export const ROUTE_MISSING_ERROR = 'HTTP Error 404: Not Found';
export const ROUTE_MISSING_PHASE = 'entity_registration';
export const ROUTE_MISSING_FAILURE_CLASS = 'backend_route_missing';

export function parseArgs(argv = process.argv.slice(2)) {
  return {
    apply: argv.includes('--apply'),
    limit: Number(argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 0),
  };
}

export function createPgPool() {
  if (process.env.DATABASE_URL) {
    return new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return new pg.Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'signal_noise_app',
    user: process.env.PGUSER || process.env.USER,
    password: process.env.PGPASSWORD || undefined,
  });
}

function limitClause(limit) {
  return Number.isFinite(limit) && limit > 0 ? `LIMIT ${Math.floor(limit)}` : '';
}

export function buildCandidateQuery({ limit = 0 } = {}) {
  return `
    SELECT id, batch_id, entity_id, canonical_entity_id, entity_name, status, phase, error_message, started_at, completed_at
    FROM entity_pipeline_runs
    WHERE error_message = $1
      AND phase = $2
      AND coalesce(metadata->>'failure_class', '') <> $3
    ORDER BY completed_at DESC NULLS LAST, started_at DESC NULLS LAST
    ${limitClause(limit)}
  `;
}

export function buildQuarantineRunsQuery() {
  return `
    WITH candidates AS (
      SELECT id, batch_id
      FROM entity_pipeline_runs
      WHERE error_message = $1
        AND phase = $2
        AND coalesce(metadata->>'failure_class', '') <> $3
    )
    UPDATE entity_pipeline_runs r
    SET
      error_message = $3,
      metadata = coalesce(r.metadata, '{}'::jsonb) || jsonb_build_object(
        'failure_class', $3,
        'infrastructure_failure', true,
        'blocked_by_infrastructure', true,
        'quarantined_at', now(),
        'quarantine_reason', 'worker_hit_wrong_service_on_pipeline_route',
        'original_error_message', $1
      )
    FROM candidates c
    WHERE r.id = c.id
    RETURNING r.id, r.batch_id, r.entity_id, r.canonical_entity_id, r.entity_name
  `;
}

export function buildQuarantineBatchesQuery() {
  return `
    WITH affected_batches AS (
      SELECT DISTINCT batch_id
      FROM entity_pipeline_runs
      WHERE error_message = $3
        AND phase = $2
        AND coalesce(metadata->>'failure_class', '') = $3
        AND coalesce(metadata->>'original_error_message', '') = $1
        AND batch_id IS NOT NULL
    )
    UPDATE entity_import_batches b
    SET metadata = coalesce(b.metadata, '{}'::jsonb) || jsonb_build_object(
      'failure_class', $3,
      'blocked_by_infrastructure', true,
      'infrastructure_failure', true,
      'quarantined_at', now(),
      'quarantine_reason', 'backend_route_missing'
    )
    FROM affected_batches a
    WHERE b.id = a.batch_id
    RETURNING b.id, b.status
  `;
}

async function main() {
  const args = parseArgs();
  const pool = createPgPool();
  const params = [ROUTE_MISSING_ERROR, ROUTE_MISSING_PHASE, ROUTE_MISSING_FAILURE_CLASS];

  try {
    const candidates = await pool.query(buildCandidateQuery({ limit: args.limit }), params);
    const entities = new Set(candidates.rows.map((row) => row.canonical_entity_id || row.entity_id).filter(Boolean));
    console.log(JSON.stringify({
      dry_run: !args.apply,
      candidate_runs: candidates.rowCount,
      candidate_entities: entities.size,
      sample: candidates.rows.slice(0, 10),
    }, null, 2));

    if (!args.apply || candidates.rowCount === 0) {
      return;
    }

    await pool.query('BEGIN');
    const quarantinedRuns = await pool.query(buildQuarantineRunsQuery(), params);
    const quarantinedBatches = await pool.query(buildQuarantineBatchesQuery(), params);
    await pool.query('COMMIT');

    console.log(JSON.stringify({
      applied: true,
      quarantined_runs: quarantinedRuns.rowCount,
      marked_batches: quarantinedBatches.rowCount,
    }, null, 2));
  } catch (error) {
    try {
      await pool.query('ROLLBACK');
    } catch {}
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
