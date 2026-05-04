#!/usr/bin/env node

import crypto from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'
import pg from 'pg'

import { normalizeQuestionFirstDossier } from '../src/lib/question-first-dossier.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

export function parseArgs(argv = process.argv.slice(2)) {
  return {
    apply: argv.includes('--apply'),
    limit: Number(argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 500),
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

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function contentHash(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex')
}

export function answerRecords(dossierData) {
  const dossier = asRecord(dossierData)
  const questionFirst = asRecord(dossier.question_first)
  const metadata = asRecord(dossier.metadata)
  const checkpoint = asRecord(dossier.question_first_checkpoint || metadata.question_first_checkpoint)
  const report = asRecord(dossier.question_first_report)
  const records = [
    questionFirst.answer_records,
    questionFirst.answers,
    questionFirst.questions,
    checkpoint.answer_records,
    checkpoint.answers,
    dossier.answers,
    dossier.questions,
    report.answers,
  ].flatMap((value) => asArray(value).filter((item) => item && typeof item === 'object'))
  const byQuestion = new Map()
  records.forEach((record, index) => {
    const questionId = String(record.question_id || record.id || '').trim()
    byQuestion.set(questionId || `unkeyed:${index}`, record)
  })
  return Array.from(byQuestion.values())
}

export function shouldRepairDossier(dossierData) {
  const dossier = asRecord(dossierData)
  const discoverySummary = asRecord(dossier.discovery_summary || asRecord(dossier.question_first).discovery_summary)
  const graphitiSalesBrief = asRecord(discoverySummary.graphiti_sales_brief || dossier.graphiti_sales_brief)
  const yellowPantherFit = asRecord(discoverySummary.yellow_panther_fit || discoverySummary.yellow_panther_opportunity || dossier.yellow_panther_fit)
  const publishStatus = String(dossier.publish_status || dossier.publication_status || '').toLowerCase()
  const answers = answerRecords(dossier)
  return answers.length >= 15
    && (
      publishStatus.startsWith('published')
      || String(graphitiSalesBrief.status || '').toLowerCase() !== 'available'
      || !String(yellowPantherFit.fit_rationale || yellowPantherFit.fit_feedback || '').trim()
    )
}

export function repairDossierPayload(dossierData, canonicalEntityId, entityInfo = {}) {
  const dossier = asRecord(dossierData)
  const entity = {
    id: canonicalEntityId || dossier.entity_id,
    entity_uuid: canonicalEntityId || dossier.entity_id,
    properties: {
      name: entityInfo.entity_name || dossier.entity_name,
      type: entityInfo.entity_type || dossier.entity_type,
    },
  }
  const normalized = normalizeQuestionFirstDossier(dossier, String(canonicalEntityId || dossier.entity_id || ''), entity)
  return {
    changed: contentHash(dossier) !== contentHash(normalized),
    before_publish_status: dossier.publish_status || dossier.publication_status || null,
    after_publish_status: normalized.publish_status || normalized.publication_status || null,
    before_quality_state: dossier.quality_state || null,
    after_quality_state: normalized.quality_state || null,
    repaired_dossier: normalized,
  }
}

async function loadCandidateRows(pool, limit) {
  const result = await pool.query(`
    select
      id,
      canonical_entity_id::text as canonical_entity_id,
      entity_name,
      entity_type,
      dossier_data
    from entity_dossiers
    where canonical_entity_id is not null
    order by coalesce(generated_at, updated_at, created_at) desc nulls last
    limit $1
  `, [limit])
  return result.rows
}

async function main() {
  const { apply, limit } = parseArgs()
  const pool = createPgPool()
  const summary = {
    apply,
    limit,
    scanned: 0,
    eligible: 0,
    changed: 0,
    updated: 0,
    demoted_to_partial: 0,
  }

  try {
    const rows = await loadCandidateRows(pool, limit)
    for (const row of rows) {
      summary.scanned += 1
      if (!shouldRepairDossier(row.dossier_data)) {
        continue
      }
      summary.eligible += 1
      const repair = repairDossierPayload(row.dossier_data, row.canonical_entity_id, row)
      if (!repair.changed) {
        continue
      }
      summary.changed += 1
      if (String(repair.after_publish_status || '').toLowerCase() === 'published_partial') {
        summary.demoted_to_partial += 1
      }
      if (apply) {
        await pool.query(
          'update entity_dossiers set dossier_data = $1, updated_at = now() where id = $2',
          [repair.repaired_dossier, row.id],
        )
        summary.updated += 1
      }
    }
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } finally {
    await pool.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`)
    process.exitCode = 1
  })
}
