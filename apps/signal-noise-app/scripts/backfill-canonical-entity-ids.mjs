#!/usr/bin/env node
import { config } from 'dotenv'
import pg from 'pg'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const require = createRequire(import.meta.url)
const { getEntityPrefetchId } = require('../src/lib/entity-routing.js')

export function parseArgs(argv = process.argv.slice(2)) {
  return {
    apply: argv.includes('--apply'),
    limit: Number(argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 0),
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

export function deriveCanonicalEntityId(entityId) {
  const text = String(entityId || '').trim()
  if (!text) return null
  return getEntityPrefetchId(text)
}

function limitClause(limit) {
  return Number.isFinite(limit) && limit > 0 ? `LIMIT ${Math.floor(limit)}` : ''
}

export function buildBackfillQuery({ tableName, limit = 0 } = {}) {
  const normalizedTable = tableName === 'entity_pipeline_runs' ? 'entity_pipeline_runs' : 'entity_dossiers'
  const sortColumn = normalizedTable === 'entity_pipeline_runs' ? 'started_at' : 'updated_at'
  return `
    SELECT entity_id
    FROM ${normalizedTable}
    WHERE canonical_entity_id IS NULL
    ORDER BY ${sortColumn} DESC NULLS LAST
    ${limitClause(limit)}
  `
}

export function buildBackfillUpdateQuery({ tableName } = {}) {
  const normalizedTable = tableName === 'entity_pipeline_runs' ? 'entity_pipeline_runs' : 'entity_dossiers'
  const metadataUpdate = normalizedTable === 'entity_pipeline_runs'
    ? `metadata = coalesce(target.metadata, '{}'::jsonb) || jsonb_build_object('canonical_entity_id', backfill.canonical_entity_id::text)`
    : null

  return `
    WITH backfill(entity_id, canonical_entity_id) AS (
      VALUES %VALUES%
    )
    UPDATE ${normalizedTable} AS target
    SET
      canonical_entity_id = backfill.canonical_entity_id::uuid
      ${metadataUpdate ? `,\n      ${metadataUpdate}` : ''}
    FROM backfill
    WHERE target.entity_id = backfill.entity_id
      AND target.canonical_entity_id IS NULL
    RETURNING target.entity_id, target.canonical_entity_id
  `
}

async function collectCandidates(pool, { limit = 0 } = {}) {
  const dossierRows = (await pool.query(buildBackfillQuery({ tableName: 'entity_dossiers', limit }))).rows
  const runRows = (await pool.query(buildBackfillQuery({ tableName: 'entity_pipeline_runs', limit }))).rows

  const dossierCandidates = dossierRows
    .map((row) => {
      const entityId = String(row.entity_id || '').trim()
      const canonicalEntityId = deriveCanonicalEntityId(entityId)
      return canonicalEntityId ? { entityId, canonicalEntityId } : null
    })
    .filter(Boolean)

  const runCandidates = runRows
    .map((row) => {
      const entityId = String(row.entity_id || '').trim()
      const canonicalEntityId = deriveCanonicalEntityId(entityId)
      return canonicalEntityId ? { entityId, canonicalEntityId } : null
    })
    .filter(Boolean)

  return { dossierCandidates, runCandidates }
}

async function applyBackfill(pool, { tableName, candidates }) {
  if (!candidates.length) {
    return { rowCount: 0 }
  }

  const valuesSql = candidates
    .map((_, index) => `($${index * 2 + 1}::text, $${index * 2 + 2}::text)`)
    .join(', ')
  const query = buildBackfillUpdateQuery({ tableName }).replace('%VALUES%', valuesSql)
  const params = candidates.flatMap(({ entityId, canonicalEntityId }) => [entityId, canonicalEntityId])
  return pool.query(query, params)
}

async function main() {
  const args = parseArgs()
  const pool = createPgPool()

  try {
    const { dossierCandidates, runCandidates } = await collectCandidates(pool, args)
    const sample = [...dossierCandidates, ...runCandidates].slice(0, 10)

    console.log(JSON.stringify({
      dry_run: !args.apply,
      dossier_candidates: dossierCandidates.length,
      run_candidates: runCandidates.length,
      sample,
    }, null, 2))

    if (!args.apply) {
      return
    }

    await pool.query('BEGIN')
    const dossierResult = await applyBackfill(pool, { tableName: 'entity_dossiers', candidates: dossierCandidates })
    const runResult = await applyBackfill(pool, { tableName: 'entity_pipeline_runs', candidates: runCandidates })
    await pool.query('COMMIT')

    console.log(JSON.stringify({
      applied: true,
      dossier_rows_updated: dossierResult.rowCount,
      run_rows_updated: runResult.rowCount,
    }, null, 2))
  } catch (error) {
    try {
      await pool.query('ROLLBACK')
    } catch {}
    console.error(error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
