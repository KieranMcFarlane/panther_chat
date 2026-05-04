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

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function countBy(rows, selector) {
  return rows.reduce((acc, row) => {
    const key = selector(row) || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

function hasMeaningfulText(value) {
  const text = String(value || '').trim()
  return Boolean(text)
    && !/^(no_signal|no signal|insufficient_signal|insufficient signal|failed|blocked|\[object object\])$/i.test(text)
}

function answerRecords(dossierData) {
  const dossier = asRecord(dossierData)
  const questionFirst = asRecord(dossier.question_first)
  const metadata = asRecord(dossier.metadata)
  const checkpoint = asRecord(dossier.question_first_checkpoint || metadata.question_first_checkpoint)
  const report = asRecord(dossier.question_first_report)
  const rawRecords = [
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
  rawRecords.forEach((record, index) => {
    const questionId = String(record.question_id || record.id || record.question || record.question_text || '').trim()
    const key = questionId || `unkeyed:${index}`
    if (!byQuestion.has(key)) byQuestion.set(key, record)
  })
  return Array.from(byQuestion.values())
}

function evidenceCount(value, urls = new Set()) {
  if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) {
    urls.add(value.trim())
    return urls.size
  }
  if (Array.isArray(value)) {
    value.forEach((item) => evidenceCount(item, urls))
    return urls.size
  }
  if (!value || typeof value !== 'object') return urls.size
  Object.values(value).forEach((nested) => evidenceCount(nested, urls))
  return urls.size
}

function qualityState(row) {
  const dossier = asRecord(row.dossier_data)
  const explicit = String(dossier.quality_state || '').trim().toLowerCase()
  const publication = String(dossier.publication_status || dossier.publish_status || '').trim().toLowerCase()
  if (publication.startsWith('published') && !hasMeaningfulPublicationArtifacts(dossier)) {
    return publication.includes('partial') ? 'partial' : 'partial'
  }
  if (explicit) return explicit
  if (publication.includes('partial')) return 'partial'
  if (publication.includes('client_ready')) return 'client_ready'
  return 'unknown'
}

function hasMeaningfulSalesBrief(dossierData) {
  const dossier = asRecord(dossierData)
  const discoverySummary = asRecord(dossier.discovery_summary || asRecord(dossier.question_first).discovery_summary)
  const brief = asRecord(discoverySummary.graphiti_sales_brief || dossier.graphiti_sales_brief)
  return String(brief.status || '').trim().toLowerCase() === 'available'
    && (
      hasMeaningfulText(brief.buyer_name)
      || hasMeaningfulText(brief.outreach_target)
      || hasMeaningfulText(brief.outreach_angle)
    )
}

function hasMeaningfulYellowPantherFit(dossierData) {
  const dossier = asRecord(dossierData)
  const discoverySummary = asRecord(dossier.discovery_summary || asRecord(dossier.question_first).discovery_summary)
  const fit = asRecord(discoverySummary.yellow_panther_fit || discoverySummary.yellow_panther_opportunity || dossier.yellow_panther_fit)
  return hasMeaningfulText(fit.fit_rationale)
    || hasMeaningfulText(fit.fit_feedback)
    || hasMeaningfulText(fit.competitive_advantage)
}

function hasMeaningfulOutreachStrategy(dossierData) {
  const dossier = asRecord(dossierData)
  const discoverySummary = asRecord(dossier.discovery_summary || asRecord(dossier.question_first).discovery_summary)
  const outreach = asRecord(discoverySummary.outreach_strategy || dossier.outreach_strategy)
  return String(outreach.status || '').trim().toLowerCase() !== 'insufficient_signal'
    && (
      hasMeaningfulText(outreach.recommended_target)
      || hasMeaningfulText(outreach.recommended_angle)
      || hasMeaningfulText(outreach.first_message_strategy)
    )
}

function hasMeaningfulSummary(dossierData) {
  const dossier = asRecord(dossierData)
  const executiveSummary = asRecord(dossier.executive_summary)
  const strategicAnalysis = asRecord(dossier.strategic_analysis)
  return hasMeaningfulText(executiveSummary.summary)
    || hasMeaningfulText(executiveSummary.headline)
    || hasMeaningfulText(strategicAnalysis.recommended_approach)
    || hasMeaningfulText(strategicAnalysis.overall_assessment)
}

function hasMeaningfulSections(dossierData) {
  return Object.keys(asRecord(asRecord(dossierData).sections)).length > 0
}

function hasMeaningfulPublicationArtifacts(dossierData) {
  return hasMeaningfulSalesBrief(dossierData)
    && hasMeaningfulYellowPantherFit(dossierData)
    && hasMeaningfulSummary(dossierData)
    && hasMeaningfulSections(dossierData)
}

function artifactCoverage(rows) {
  return rows.reduce((acc, row) => {
    const dossier = asRecord(row.dossier_data)
    if (hasMeaningfulSalesBrief(dossier)) acc.graphiti_sales_brief += 1
    if (hasMeaningfulYellowPantherFit(dossier)) acc.yellow_panther_fit += 1
    if (hasMeaningfulOutreachStrategy(dossier)) acc.outreach_strategy += 1
    if (hasMeaningfulSummary(dossier)) acc.executive_or_strategic_summary += 1
    if (hasMeaningfulSections(dossier)) acc.sections += 1
    return acc
  }, {
    graphiti_sales_brief: 0,
    yellow_panther_fit: 0,
    outreach_strategy: 0,
    executive_or_strategic_summary: 0,
    sections: 0,
  })
}

function perQuestionQuality(rows) {
  const byQuestion = {}
  rows.forEach((row) => {
    answerRecords(row.dossier_data).forEach((answer) => {
      const questionId = String(answer.question_id || answer.id || '').trim()
      if (!questionId) return
      if (!byQuestion[questionId]) {
        byQuestion[questionId] = {
          total: 0,
          validation_states: {},
          zero_confidence: 0,
        }
      }
      const bucket = byQuestion[questionId]
      const validationState = String(answer.validation_state || 'unknown').trim().toLowerCase() || 'unknown'
      bucket.total += 1
      bucket.validation_states[validationState] = (bucket.validation_states[validationState] || 0) + 1
      if (Number(answer.confidence || 0) === 0) {
        bucket.zero_confidence += 1
      }
    })
  })
  return Object.fromEntries(Object.entries(byQuestion).sort(([left], [right]) => left.localeCompare(right)))
}

function providerFailureCount(rows) {
  return rows.filter((row) => {
    const dossier = JSON.stringify(row.dossier_data || {}).toLowerCase()
    return dossier.includes('provider_infrastructure_failure')
      || dossier.includes('opencodeproviderinsufficientbalanceerror')
      || dossier.includes('insufficient balance')
  }).length
}

function bucketForAnswerCount(count) {
  if (count >= 15) return '15_of_15'
  if (count >= 10) return '10_to_14'
  if (count >= 5) return '5_to_9'
  if (count >= 1) return '1_to_4'
  return '0'
}

async function loadLatestDossiers(pool) {
  const result = await pool.query(`
    with latest as (
      select distinct on (canonical_entity_id)
        id,
        entity_name,
        entity_type,
        canonical_entity_id::text as canonical_entity_id,
        dossier_data,
        created_at,
        generated_at,
        updated_at
      from entity_dossiers
      where canonical_entity_id is not null
      order by canonical_entity_id, coalesce(generated_at, updated_at, created_at) desc nulls last
    )
    select *
    from latest
    order by coalesce(generated_at, updated_at, created_at) desc nulls last
  `)
  return result.rows
}

async function loadCanonicalTotal(pool) {
  const result = await pool.query('select count(*)::int as total from canonical_entities')
  return Number(result.rows[0]?.total || 0)
}

async function loadIngestionCounts(pool) {
  const result = await pool.query(`
    select status, quality_state, count(*)::int as count
    from graphiti_dossier_ingestions
    group by status, quality_state
    order by status, quality_state
  `)
  return result.rows
}

async function loadTopCommercialSignalCandidates(pool) {
  const result = await pool.query(`
    select
      entity_name,
      canonical_entity_id,
      title,
      status,
      is_active,
      yellow_panther_fit,
      raw_payload->'commercial_qualification'->>'status' as qualification_status,
      raw_payload->'commercial_qualification'->>'promotion_reason' as promotion_reason,
      materialized_at,
      updated_at
    from graphiti_materialized_opportunities
    where coalesce(raw_payload->>'source', '') = 'entity_dossiers'
    order by
      is_active desc,
      coalesce(yellow_panther_fit, 0) desc,
      coalesce(materialized_at, updated_at) desc nulls last
    limit 20
  `)
  return result.rows.map((row) => ({
    entity_name: row.entity_name,
    canonical_entity_id: row.canonical_entity_id,
    title: row.title,
    status: row.status,
    is_active: Boolean(row.is_active),
    yellow_panther_fit: row.yellow_panther_fit === null ? null : Number(row.yellow_panther_fit),
    qualification_status: row.qualification_status,
    promotion_reason: row.promotion_reason,
    updated_at: row.updated_at?.toISOString?.() || row.updated_at || row.materialized_at || null,
  }))
}

function summarizeDossiers(dossiers) {
  const enriched = dossiers.map((row) => {
    const answers = answerRecords(row.dossier_data)
    return {
      id: row.id,
      entity_name: row.entity_name,
      entity_type: row.entity_type,
      canonical_entity_id: row.canonical_entity_id,
      quality_state: qualityState(row),
      answer_count: answers.length,
      evidence_count: evidenceCount(row.dossier_data),
      generated_at: row.generated_at?.toISOString?.() || row.generated_at || null,
      updated_at: row.updated_at?.toISOString?.() || row.updated_at || null,
      created_at: row.created_at?.toISOString?.() || row.created_at || null,
    }
  })

  return {
    quality_counts: countBy(enriched, (row) => row.quality_state),
    answer_coverage_buckets: countBy(enriched, (row) => bucketForAnswerCount(row.answer_count)),
    artifact_coverage: artifactCoverage(dossiers),
    per_question_quality: perQuestionQuality(dossiers),
    failed_provider_failures: providerFailureCount(dossiers),
    top_recent_dossiers: enriched.slice(0, 15),
  }
}

function summarizeIngestions(rows) {
  return rows.reduce((acc, row) => {
    const status = row.status || 'unknown'
    const quality = row.quality_state || 'unknown'
    acc.by_status[status] = (acc.by_status[status] || 0) + Number(row.count || 0)
    acc.by_quality_state[quality] = (acc.by_quality_state[quality] || 0) + Number(row.count || 0)
    acc.matrix[`${status}:${quality}`] = Number(row.count || 0)
    return acc
  }, { by_status: {}, by_quality_state: {}, matrix: {} })
}

async function buildReport(pool) {
  const [canonicalTotal, latestDossiers, ingestionRows, topCommercialSignalCandidates] = await Promise.all([
    loadCanonicalTotal(pool),
    loadLatestDossiers(pool),
    loadIngestionCounts(pool),
    loadTopCommercialSignalCandidates(pool),
  ])
  const dossierSummary = summarizeDossiers(latestDossiers)
  return {
    generated_at: new Date().toISOString(),
    canonical_entities_total: canonicalTotal,
    persisted_dossier_entities: latestDossiers.length,
    quality_counts: dossierSummary.quality_counts,
    ingestion_counts: summarizeIngestions(ingestionRows),
    answer_coverage_buckets: dossierSummary.answer_coverage_buckets,
    artifact_coverage: dossierSummary.artifact_coverage,
    per_question_quality: dossierSummary.per_question_quality,
    failed_provider_failures: dossierSummary.failed_provider_failures,
    top_recent_dossiers: dossierSummary.top_recent_dossiers,
    top_commercial_signal_candidates: topCommercialSignalCandidates,
  }
}

async function main() {
  const pool = createPgPool()
  try {
    const report = await buildReport(pool)
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
  answerRecords,
  artifactCoverage,
  bucketForAnswerCount,
  buildReport,
  createPgPool,
  hasMeaningfulPublicationArtifacts,
  perQuestionQuality,
  qualityState,
}
