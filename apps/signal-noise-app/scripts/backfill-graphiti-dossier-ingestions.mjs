#!/usr/bin/env node
import crypto from 'node:crypto'
import { config } from 'dotenv'
import pg from 'pg'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })
const OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR = 'OpenCodeProviderInsufficientBalanceError'
const MIN_COMPLETE_USEFUL_FACTS = 5
const MIN_COMPLETE_EVIDENCE_URLS = 3
const MIN_PARTIAL_USEFUL_FACTS = 2

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
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') {
    const text = value.trim()
    return text === '[object Object]' ? '' : text
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(' · ')
  if (typeof value === 'object') {
    const candidate = [
      value.summary,
      value.answer,
      value.value,
      value.text,
      value.context,
      value.title,
      value.description,
      value.label,
      value.name,
    ].map(toText).find(Boolean)
    return candidate || ''
  }
  return String(value).trim()
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
    || text === 'null'
    || text === 'no_signal'
    || text === 'skipped'
    || text === 'failed'
    || text === 'tool_call_missing'
    || text.includes('no deterministic answer was produced for this question')
    || text.includes('question execution failed before a safe answer could be produced')
    || text.includes(OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR.toLowerCase())
    || text.includes('retry_exhausted')
    || text.includes('insufficient_signal')
    || text.includes('no substantive')
    || text.includes('no relevant results')
    || text.includes('no web evidence')
    || text.includes('returned no results')
  )
}

function isProviderInfrastructureFailure(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') {
    const text = value.toLowerCase()
    return text.includes(OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR.toLowerCase())
      || text.includes('providerinsufficientbalance')
      || text.includes('insufficient balance')
  }
  if (typeof value === 'number' || typeof value === 'boolean') return false
  if (Array.isArray(value)) return value.some(isProviderInfrastructureFailure)
  if (typeof value !== 'object') return false
  const failureName = toText(value.failure_name || value.error_name || value.name).toLowerCase()
  const errorType = toText(value.error_type || value.failure_type).toLowerCase()
  const message = toText(value.message || value.error_message || value.stderr || value.error).toLowerCase()
  return failureName.includes(OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR.toLowerCase())
    || errorType.includes('provider_infrastructure_failure')
    || message.includes(OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR.toLowerCase())
    || Object.values(value).some(isProviderInfrastructureFailure)
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

function isFailedFact(fact) {
  const status = toText(fact.status).toLowerCase()
  return status === 'failed'
    || status === 'skipped'
    || status === 'tool_call_missing'
    || toText(fact.summary).toLowerCase().includes('question execution failed before a safe answer could be produced')
}

function isNoSignalFact(fact) {
  const status = toText(fact.status).toLowerCase()
  const summary = toText(fact.summary).toLowerCase()
  return status === 'no_signal'
    || summary === 'no_signal'
    || summary.includes('insufficient_signal')
}

function hasUsefulFactContent(fact) {
  const evidenceUrls = asArray(fact.evidence_urls).map(toText).filter(Boolean)
  const summary = toText(fact.summary)
  if (isFailedFact(fact) || isNoSignalFact(fact)) return false
  if (evidenceUrls.length > 0) return true
  if (isPlaceholderText(summary)) return false
  return summary.length >= 20
}

function computeQualityMetrics(answers, questionFacts, evidenceUrls) {
  return {
    raw_answer_count: Number(answers.length),
    useful_fact_count: questionFacts.filter(hasUsefulFactContent).length,
    failed_fact_count: questionFacts.filter(isFailedFact).length,
    placeholder_fact_count: questionFacts.filter((fact) => isPlaceholderText(fact.summary)).length,
    no_signal_fact_count: questionFacts.filter(isNoSignalFact).length,
    evidence_url_count: evidenceUrls.length,
  }
}

function inferQualityState(dossier, qualityMetrics, failedOnly) {
  const explicit = toText(dossier.quality_state).toLowerCase()
  const publicationStatus = toText(dossier.publication_status || dossier.publish_status).toLowerCase()
  if (failedOnly) return 'failed'
  if (explicit === 'blocked' || publicationStatus.includes('blocked')) return 'blocked'
  if (explicit === 'failed' || explicit === 'empty') return explicit
  if (
    qualityMetrics.useful_fact_count >= MIN_COMPLETE_USEFUL_FACTS
    && qualityMetrics.evidence_url_count >= MIN_COMPLETE_EVIDENCE_URLS
  ) {
    return explicit === 'client_ready' || publicationStatus.includes('client_ready') ? 'client_ready' : 'complete'
  }
  if (qualityMetrics.useful_fact_count >= MIN_PARTIAL_USEFUL_FACTS || qualityMetrics.evidence_url_count >= 1) return 'partial'
  return 'empty'
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
  const qualityMetrics = computeQualityMetrics(answers, questionFacts, evidenceUrls)
  const discoverySummary = asRecord(asRecord(dossier.question_first).discovery_summary || dossier.discovery_summary)
  const graphitiSalesBrief = asRecord(discoverySummary.graphiti_sales_brief || dossier.graphiti_sales_brief)
  const yellowPanther = asRecord(discoverySummary.yellow_panther_opportunity || dossier.yellow_panther_opportunity)
  const providerInfrastructureFailure = answers.some(isProviderInfrastructureFailure) || isProviderInfrastructureFailure(dossier)
  const failedOnly = questionFacts.length > 0 && qualityMetrics.useful_fact_count === 0
  const hasContent = !providerInfrastructureFailure && (
    qualityMetrics.useful_fact_count > 0
    || qualityMetrics.evidence_url_count > 0
    || Object.keys(graphitiSalesBrief).length > 0
    || Object.keys(yellowPanther).length > 0
  ) && !failedOnly
  const qualityState = inferQualityState(dossier, qualityMetrics, failedOnly)
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
      raw_answer_count: qualityMetrics.raw_answer_count,
      useful_fact_count: qualityMetrics.useful_fact_count,
      evidence_url_count: qualityMetrics.evidence_url_count,
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
    status: providerInfrastructureFailure ? 'failed' : hasContent ? 'ingested' : 'skipped_empty',
    quality_state: providerInfrastructureFailure ? 'failed' : hasContent ? qualityState : 'empty',
    answer_count: qualityMetrics.useful_fact_count,
    evidence_count: qualityMetrics.evidence_url_count,
    quality_metrics: qualityMetrics,
    content_hash: contentHash(body),
    episode_body: body,
    reference_time: referenceTime,
    failure_reason: providerInfrastructureFailure ? 'provider_infrastructure_failure' : null,
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
      source_created_at, source_generated_at, ingested_at, last_error, source_description,
      reference_time, episode_body, raw_metadata, updated_at
    ) values (
      $1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, case when $7 = 'ingested' then now() else null end,
      $13, 'entity_dossiers', $14, $15::jsonb, $16::jsonb, now()
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
      last_error = excluded.last_error,
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
    episode.failure_reason,
    episode.reference_time,
    JSON.stringify(episode.episode_body),
    JSON.stringify({
      backfilled_by: 'backfill-graphiti-dossier-ingestions',
      failure_reason: episode.failure_reason,
      quality_metrics: episode.quality_metrics,
      raw_answer_count: episode.quality_metrics.raw_answer_count,
      useful_fact_count: episode.quality_metrics.useful_fact_count,
      failed_fact_count: episode.quality_metrics.failed_fact_count,
      placeholder_fact_count: episode.quality_metrics.placeholder_fact_count,
      no_signal_fact_count: episode.quality_metrics.no_signal_fact_count,
      evidence_url_count: episode.quality_metrics.evidence_url_count,
    }),
  ])

  await pool.query(`
    update graphiti_dossier_ingestions
    set status = 'skipped_empty',
        quality_state = 'empty',
        updated_at = now(),
        raw_metadata = coalesce(raw_metadata, '{}'::jsonb) || jsonb_build_object(
          'superseded_by_latest_quality_backfill',
          true,
          'superseded_by_content_hash',
          $2
        )
    where canonical_entity_id = $1
      and content_hash <> $2
      and status = 'ingested'
  `, [
    row.canonical_entity_id,
    episode.content_hash,
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
        if (episode.status === 'failed') stats.failed += 1
        if (stats.sample.length < 10) {
          stats.sample.push({
            entity_name: row.entity_name,
            canonical_entity_id: row.canonical_entity_id,
            status: episode.status,
            quality_state: episode.quality_state,
            answer_count: episode.answer_count,
            evidence_count: episode.evidence_count,
            raw_answer_count: episode.quality_metrics.raw_answer_count,
            useful_fact_count: episode.quality_metrics.useful_fact_count,
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
