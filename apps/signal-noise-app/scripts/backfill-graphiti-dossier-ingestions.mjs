#!/usr/bin/env node
import crypto from 'node:crypto'
import { config } from 'dotenv'
import pg from 'pg'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

export function parseArgs(argv = process.argv.slice(2)) {
  return {
    apply: argv.includes('--apply'),
    limit: Number(argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 5000),
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

function toText(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function isPlaceholderText(value) {
  const text = toText(value).toLowerCase()
  return (
    !text
    || text === 'n/a'
    || text === 'unknown'
    || text.includes('no deterministic answer was produced for this question')
    || text.includes('question execution failed before a safe answer could be produced')
    || text.includes('opencodeproviderinsufficientbalanceerror')
  )
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

function collectAnswerRecords(dossier) {
  const questionFirst = asRecord(dossier.question_first)
  const metadata = asRecord(dossier.metadata)
  const checkpoint = asRecord(dossier.question_first_checkpoint || metadata.question_first_checkpoint)
  const report = asRecord(dossier.question_first_report)
  return [
    questionFirst.answer_records,
    questionFirst.answers,
    questionFirst.questions,
    checkpoint.answer_records,
    checkpoint.answers,
    dossier.answers,
    dossier.questions,
    report.answers,
  ].flatMap((value) => asArray(value).filter((item) => item && typeof item === 'object'))
}

function collectEvidenceUrls(value, urls = new Set()) {
  if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) {
    urls.add(value.trim())
    return urls
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectEvidenceUrls(item, urls))
    return urls
  }
  if (!value || typeof value !== 'object') return urls
  Object.entries(value).forEach(([key, nested]) => {
    if (/^(url|source_url|href)$/i.test(key)) {
      const text = toText(nested)
      if (/^https?:\/\//i.test(text)) urls.add(text)
    }
    if (/sources?|evidence|urls?/i.test(key)) {
      if (typeof nested === 'string' && /^https?:\/\//i.test(nested)) urls.add(nested)
    }
    collectEvidenceUrls(nested, urls)
  })
  return urls
}

function answerSummary(answer) {
  const answerBody = asRecord(answer.answer)
  const raw = asRecord(answerBody.raw_structured_output)
  return [
    answer.summary,
    answer.value,
    answer.answer,
    answerBody.summary,
    answerBody.value,
    raw.answer,
    raw.summary,
    raw.context,
  ].map(toText).find((value) => !isPlaceholderText(value)) || ''
}

function inferQualityState(dossier, answerCount, hasContent) {
  const explicit = toText(dossier.quality_state).toLowerCase()
  if (['partial', 'complete', 'blocked', 'failed', 'empty', 'client_ready'].includes(explicit)) return explicit
  const publicationStatus = toText(dossier.publication_status || dossier.publish_status).toLowerCase()
  if (publicationStatus.includes('client_ready')) return 'client_ready'
  if (publicationStatus.includes('partial')) return 'partial'
  if (!hasContent) return 'empty'
  return answerCount >= 15 ? 'complete' : 'partial'
}

function buildEpisode(row) {
  const dossier = asRecord(row.dossier_data)
  const answers = collectAnswerRecords(dossier)
  const questionFacts = answers.map((answer) => ({
    question_id: toText(answer.question_id || answer.id),
    question_type: toText(answer.question_type || answer.type),
    status: toText(answer.status || answer.validation_state || answer.terminal_state),
    confidence: Number(answer.confidence || asRecord(answer.answer).confidence || 0),
    summary: answerSummary(answer),
    evidence_urls: Array.from(collectEvidenceUrls(answer)),
  })).filter((fact) => fact.question_id || fact.summary || fact.evidence_urls.length > 0)
  const evidenceUrls = Array.from(collectEvidenceUrls(dossier))
  const discoverySummary = asRecord(asRecord(dossier.question_first).discovery_summary || dossier.discovery_summary)
  const graphitiSalesBrief = asRecord(discoverySummary.graphiti_sales_brief || dossier.graphiti_sales_brief)
  const yellowPanther = asRecord(discoverySummary.yellow_panther_opportunity || dossier.yellow_panther_opportunity)
  const hasContent = questionFacts.some((fact) => fact.summary) || evidenceUrls.length > 0 || Object.keys(graphitiSalesBrief).length > 0 || Object.keys(yellowPanther).length > 0
  const qualityState = inferQualityState(dossier, answers.length, hasContent)
  const referenceTime = row.generated_at || row.created_at || new Date().toISOString()
  const body = {
    source_description: 'entity_dossiers',
    reference_time: referenceTime,
    entity: {
      entity_id: row.entity_id || row.canonical_entity_id,
      canonical_entity_id: row.canonical_entity_id,
      entity_name: row.entity_name || row.canonical_entity_id,
      entity_type: row.entity_type || 'ENTITY',
    },
    dossier: {
      dossier_id: row.id || null,
      quality_state: qualityState,
      source_created_at: row.created_at || null,
      source_generated_at: row.generated_at || null,
    },
    question_facts: questionFacts,
    evidence_urls: evidenceUrls,
    graphiti_sales_brief: Object.keys(graphitiSalesBrief).length ? graphitiSalesBrief : null,
    yellow_panther: Object.keys(yellowPanther).length ? yellowPanther : null,
    promoted_summary: discoverySummary.summary || dossier.executive_summary || dossier.recommended_approach || null,
  }
  return {
    status: hasContent ? 'ingested' : 'skipped_empty',
    quality_state: hasContent ? qualityState : 'empty',
    answer_count: answers.length,
    evidence_count: evidenceUrls.length,
    content_hash: contentHash(body),
    episode_body: body,
    reference_time: referenceTime,
  }
}

async function ensureSchema(pool) {
  const migrationSql = await import('node:fs/promises')
    .then((fs) => fs.readFile(resolve(__dirname, '..', 'migrations', '20260430_graphiti_dossier_ingestions.sql'), 'utf8'))
  await pool.query(migrationSql)
}

async function loadLatestDossiers(pool, limit) {
  const result = await pool.query(`
    select distinct on (canonical_entity_id)
      id,
      entity_id,
      canonical_entity_id,
      entity_name,
      entity_type,
      created_at,
      generated_at,
      dossier_data
    from entity_dossiers
    where canonical_entity_id is not null
      and dossier_data is not null
    order by canonical_entity_id, created_at desc
    limit $1
  `, [limit])
  return result.rows
}

async function upsertLedger(pool, row, episode) {
  await pool.query(`
    insert into graphiti_dossier_ingestions (
      canonical_entity_id, dossier_id, entity_id, entity_name, entity_type,
      content_hash, status, quality_state, answer_count, evidence_count,
      source_created_at, source_generated_at, ingested_at, source_description,
      reference_time, episode_body, raw_metadata, updated_at
    ) values (
      $1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, case when $7 = 'ingested' then now() else null end,
      'entity_dossiers', $13, $14::jsonb, $15::jsonb, now()
    )
    on conflict (canonical_entity_id, content_hash)
    do update set
      dossier_id = excluded.dossier_id,
      entity_id = excluded.entity_id,
      entity_name = excluded.entity_name,
      entity_type = excluded.entity_type,
      status = excluded.status,
      quality_state = excluded.quality_state,
      answer_count = excluded.answer_count,
      evidence_count = excluded.evidence_count,
      source_created_at = excluded.source_created_at,
      source_generated_at = excluded.source_generated_at,
      ingested_at = excluded.ingested_at,
      reference_time = excluded.reference_time,
      episode_body = excluded.episode_body,
      raw_metadata = excluded.raw_metadata,
      updated_at = now()
  `, [
    row.canonical_entity_id,
    row.id,
    row.entity_id || row.canonical_entity_id,
    row.entity_name || row.canonical_entity_id,
    row.entity_type || 'ENTITY',
    episode.content_hash,
    episode.status,
    episode.quality_state,
    episode.answer_count,
    episode.evidence_count,
    row.created_at,
    row.generated_at,
    episode.reference_time,
    JSON.stringify(episode.episode_body),
    JSON.stringify({ backfilled_by: 'backfill-graphiti-dossier-ingestions' }),
  ])
}

async function deactivateFailedOnly(pool, apply) {
  const query = `
    update graphiti_materialized_opportunities
    set is_active = false,
        updated_at = now(),
        raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object(
          'failed_only_dossier_opportunities_deactivated',
          true
        )
    where is_active = true
      and raw_payload->>'source' = 'entity_dossiers'
      and title ilike 'Question execution failed before a safe answer could be produced%'
  `
  if (!apply) {
    const count = await pool.query(`
      select count(*)::int as count
      from graphiti_materialized_opportunities
      where is_active = true
        and raw_payload->>'source' = 'entity_dossiers'
        and title ilike 'Question execution failed before a safe answer could be produced%'
    `)
    return Number(count.rows[0]?.count || 0)
  }
  const result = await pool.query(query)
  return result.rowCount || 0
}

async function main() {
  const args = parseArgs()
  const pool = createPgPool()
  try {
    await ensureSchema(pool)
    const rows = await loadLatestDossiers(pool, args.limit)
    const stats = {
      dry_run: !args.apply,
      latest_canonical_dossiers: rows.length,
      would_ingest: 0,
      would_skip_empty: 0,
      ingested: 0,
      skipped_empty: 0,
      failed: 0,
      failed_only_opportunities_deactivated: 0,
      sample: [],
    }

    if (args.apply) await pool.query('BEGIN')
    for (const row of rows) {
      try {
        const episode = buildEpisode(row)
        if (episode.status === 'ingested') stats.would_ingest += 1
        if (episode.status === 'skipped_empty') stats.would_skip_empty += 1
        if (stats.sample.length < 10) {
          stats.sample.push({
            entity_name: row.entity_name,
            canonical_entity_id: row.canonical_entity_id,
            status: episode.status,
            quality_state: episode.quality_state,
            answer_count: episode.answer_count,
            evidence_count: episode.evidence_count,
          })
        }
        if (args.apply) {
          await upsertLedger(pool, row, episode)
          if (episode.status === 'ingested') stats.ingested += 1
          if (episode.status === 'skipped_empty') stats.skipped_empty += 1
        }
      } catch {
        stats.failed += 1
      }
    }
    stats.failed_only_opportunities_deactivated = await deactivateFailedOnly(pool, args.apply)
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
