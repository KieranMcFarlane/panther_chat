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
    && !/(^no_signal$|^no signal$|source pending$|question execution failed|no deterministic answer was produced|no completed brightdata leads were recoverable|no brightdata-backed evidence|no brightdata-backed evidence found|initial search returned only generic|follow-up search timed out|returned no results matching|no results matching|no results found|no evidence found|no hiring leads found|bounded retrieval|lead with a .* angle tied to the active signal|insufficient[_ ]signal|no entity identifiable|no commercial decision-making structure|searches? (for|across).* (returned|found) no|limited to unrelated|kind:\s*summary|value:\s*null|summary:\s*null|raw structured output:\s*(;|null)|no web evidence found|^\[object object\]$)/i.test(text)
}

function answerValidationState(answer) {
  return String(asRecord(answer).validation_state || asRecord(answer).status || 'unknown').trim().toLowerCase() || 'unknown'
}

function answerConfidence(answer) {
  return Number(asRecord(answer).confidence || 0)
}

function answerText(answer) {
  const record = asRecord(answer)
  return JSON.stringify({
    answer: record.answer,
    summary: record.summary,
    structured_signal: record.structured_signal,
    structured_output: record.structured_output,
    output: record.output,
  }).toLowerCase()
}

function hasBuyerRoleSignal(answer) {
  const state = answerValidationState(answer)
  if (['failed', 'blocked', 'no_signal', 'no signal', 'insufficient_signal', 'insufficient signal'].includes(state)) {
    return false
  }
  if (answerConfidence(answer) <= 0) return false
  const text = answerText(answer)
  if (/\b(no|not|without|could not|unable to|cannot)\b[^.]{0,120}\b(commercial|partnership|marketing|digital|technology|strategy|buyer|decision[- ]?maker|leadership|leader|owner|function|role|candidate)\b/i.test(text)
    || /\b(no publicly available evidence|could not be confirmed|does not publicly disclose|no identifiable buyer|not an organisation|not an organization|blocked by upstream question state)\b/i.test(text)) {
    return false
  }
  return /\b(chief|director|head|vp|vice president|owner|founder|ceo|coo|cfo|cto|cmo|commercial|marketing|partnership|partnerships|sponsor|sponsorship|digital|technology|product|procurement|operations|strategy)\b/i.test(text)
    && /\b(name|person|role|title|buyer|owner|decision|stakeholder|ranked_people|target_person)\b/i.test(text)
}

function questionAnswerMap(dossierData) {
  return answerRecords(dossierData).reduce((acc, answer) => {
    const questionId = String(answer.question_id || answer.id || '').trim()
    if (questionId && !acc[questionId]) acc[questionId] = answer
    return acc
  }, {})
}

function hasBuyerRouteEligibility(dossierData) {
  const answers = questionAnswerMap(dossierData)
  return hasBuyerRoleSignal(answers.q3_leadership)
    || hasBuyerRoleSignal(answers.q11_decision_owner)
    || hasBuyerRoleSignal(answers.q12_connections)
}

function hasCommercialSynthesisEligibility(dossierData) {
  const answers = questionAnswerMap(dossierData)
  return [
    answers.q2_digital_stack,
    answers.q6_launch_signal,
    answers.q7_procurement_signal,
    answers.q9_news_signal,
    answers.q10_hiring_signal,
    answers.q13_capability_gap,
  ].some((answer) => {
    if (!answer || answerConfidence(answer) <= 0) return false
    const state = answerValidationState(answer)
    if (!['validated', 'confirmed', 'provisional'].includes(state)) return false
    return hasMeaningfulText(answerText(answer))
  })
}

const Q14_COMMERCIAL_FIT_PATTERN = /\b(revenue|commercial|commerce|sponsor|sponsorship|partnership|partner|crm|ticketing|membership|hospitality|retail|merchandise|fan engagement|fan experience|digital|platform|app|website|ott|streaming|video|content|data|analytics|procurement|rfp|tender|vendor|technology|product|transformation|stakeholder|go[- ]?to[- ]?market|growth strategy)\b/i
const Q13_COMMERCIAL_GAP_PATTERN = /\b(revenue|commercial|commerce|sponsor|sponsorship|partnership|partner|crm|ticketing|membership|hospitality|retail|merchandise|fan engagement|fan experience|digital|platform|app|website|ott|streaming|video|content|data|analytics|procurement|rfp|tender|vendor|stakeholder|go[- ]?to[- ]?market)\b/i

function hasQ14CommercialFitSignal(answer) {
  if (!answer || answerConfidence(answer) <= 0) return false
  const state = answerValidationState(answer)
  if (!['validated', 'confirmed', 'provisional'].includes(state)) return false
  const text = answerText(answer)
  const questionId = String(asRecord(answer).question_id || asRecord(answer).id || '').trim()
  const commercialPattern = questionId === 'q13_capability_gap'
    ? Q13_COMMERCIAL_GAP_PATTERN
    : Q14_COMMERCIAL_FIT_PATTERN
  return hasMeaningfulText(text) && commercialPattern.test(text)
}

function hasQ14CommercialFitEligibility(dossierData) {
  const answers = questionAnswerMap(dossierData)
  return [
    answers.q2_digital_stack,
    answers.q6_launch_signal,
    answers.q7_procurement_signal,
    answers.q9_news_signal,
    answers.q10_hiring_signal,
    answers.q13_capability_gap,
  ].some(hasQ14CommercialFitSignal)
}

function isInsufficientSignalAnswer(answer) {
  const state = answerValidationState(answer)
  return ['no_signal', 'no signal', 'insufficient_signal', 'insufficient signal'].includes(state)
    || /\binsufficient[_ ]signal\b|insufficient commercial evidence|no .*yellow panther fit/i.test(answerText(answer))
}

const PRIORITY_RERUN_QUESTION_IDS = [
  'q1_foundation',
  'q2_digital_stack',
  'q3_leadership',
  'q6_launch_signal',
  'q9_news_signal',
]
const UPSTREAM_RETRIEVAL_QUESTION_IDS = new Set([
  'q2_digital_stack',
  'q3_leadership',
  'q6_launch_signal',
  'q9_news_signal',
])
const QUESTION_MATURITY_GROUPS = {
  evidence_first: new Set(['q2_digital_stack', 'q3_leadership', 'q6_launch_signal', 'q9_news_signal']),
  applicability: new Set(['q1_foundation', 'q4_performance', 'q5_league_context']),
  checked_absence: new Set(['q7_procurement_signal', 'q8_explicit_rfp', 'q10_hiring_signal']),
  deterministic_synthesis: new Set([
    'q11_decision_owner',
    'q12_connections',
    'q13_capability_gap',
    'q14_yp_fit',
    'q15_outreach_strategy',
  ]),
}
const SOURCE_BACKED_POSITIVE_QUESTION_IDS = new Set([
  'q1_foundation',
  'q2_digital_stack',
  'q3_leadership',
  'q6_launch_signal',
  'q7_procurement_signal',
  'q8_explicit_rfp',
  'q9_news_signal',
  'q10_hiring_signal',
])

function isFailedUpstreamRecord(record) {
  if (!record) return false
  const state = answerValidationState(record)
  return ['failed', 'tool_call_missing', 'unknown', 'blocked', ''].includes(state)
    || /provider infrastructure failure|insufficient balance|question execution failed|no deterministic answer was produced/i.test(answerText(record))
}

function targetedRerunRecommendationsForRow(row) {
  const dossier = asRecord(row.dossier_data)
  const answers = questionAnswerMap(dossier)
  const promising = hasCommercialSynthesisEligibility(dossier)
    || hasBuyerRouteEligibility(dossier)
  if (!promising) return []
  return PRIORITY_RERUN_QUESTION_IDS
    .filter((questionId) => isFailedUpstreamRecord(answers[questionId]))
    .map((questionId) => ({
      canonical_entity_id: row.canonical_entity_id || dossier.entity_id || null,
      entity_name: row.entity_name || dossier.entity_name || null,
      question_id: questionId,
      reason: 'upstream_failed_blocks_commercial_synthesis',
      expected_unlock: 'Improves q1-q10 evidence quality and can unlock q11-q15 buyer/fit/outreach synthesis.',
    }))
}

function targetedRerunBacklog(rows) {
  const recommendations = rows.flatMap(targetedRerunRecommendationsForRow)
  const entityIds = new Set(recommendations.map((item) => item.canonical_entity_id || item.entity_name).filter(Boolean))
  return {
    total_entities: entityIds.size,
    total_recommendations: recommendations.length,
    by_question: countBy(recommendations, (item) => item.question_id),
    recommendations: recommendations.slice(0, 50),
  }
}

function upstreamRetrievalQuality(rows) {
  const initialBucket = () => ({
    total: 0,
    validated: 0,
    provisional: 0,
    checked_no_signal: 0,
    failed: 0,
    provider_no_answer: 0,
    source_prefetch_empty: 0,
    source_prefetch_found_provider_failed: 0,
  })
  const stats = {}
  rows.forEach((row) => {
    answerRecords(row.dossier_data).forEach((answer) => {
      const questionId = String(answer.question_id || answer.id || '').trim()
      if (!UPSTREAM_RETRIEVAL_QUESTION_IDS.has(questionId)) return
      const bucket = stats[questionId] || initialBucket()
      const state = answerValidationState(answer)
      const structuredSignal = asRecord(answer.structured_signal || asRecord(answer.answer).structured_signal)
      const status = String(structuredSignal.status || '').trim().toLowerCase()
      bucket.total += 1
      if (['validated', 'confirmed'].includes(state)) {
        bucket.validated += 1
      } else if (state === 'provisional') {
        bucket.provisional += 1
      } else if (['no_signal', 'no signal', 'insufficient_signal', 'insufficient signal'].includes(state)) {
        bucket.checked_no_signal += 1
      } else if (['failed', 'blocked', 'tool_call_missing', 'unknown'].includes(state)) {
        bucket.failed += 1
      }
      if (status === 'provider_no_answer') bucket.provider_no_answer += 1
      if (status === 'source_prefetch_empty') bucket.source_prefetch_empty += 1
      if (status === 'source_prefetch_found_provider_failed') bucket.source_prefetch_found_provider_failed += 1
      stats[questionId] = bucket
    })
  })
  return stats
}

function maturityGroupForQuestion(questionId) {
  return Object.entries(QUESTION_MATURITY_GROUPS)
    .find(([, questions]) => questions.has(questionId))?.[0] || ''
}

function hasAnySourceEvidence(answer) {
  return evidenceCount([
    answer?.evidence_url,
    answer?.source_url,
    answer?.sources,
    answer?.checked_sources,
    asRecord(answer?.answer).raw_structured_output,
    answer?.structured_signal,
  ]) > 0
}

function isSourceLessPositiveAnswer(answer) {
  const questionId = String(answer?.question_id || answer?.id || '').trim()
  if (!SOURCE_BACKED_POSITIVE_QUESTION_IDS.has(questionId)) return false
  const state = answerValidationState(answer)
  if (!['validated', 'confirmed', 'provisional'].includes(state)) return false
  if (hasAnySourceEvidence(answer)) return false
  const text = answerText(answer)
  if (!hasMeaningfulText(text)) return false
  return !/no .*evidence|no signal|not found|unavailable|returned no|checked absence|checked .* no/i.test(text)
}

function questionMaturityQuality(rows) {
  const initialBucket = () => ({
    total: 0,
    validated: 0,
    provisional: 0,
    checked_no_signal: 0,
    not_applicable: 0,
    failed: 0,
    malformed: 0,
    source_less_positive: 0,
    provider_no_answer: 0,
  })
  const stats = Object.fromEntries(Object.keys(QUESTION_MATURITY_GROUPS).map((group) => [group, initialBucket()]))
  rows.forEach((row) => {
    answerRecords(row.dossier_data).forEach((answer) => {
      const questionId = String(answer.question_id || answer.id || '').trim()
      const group = maturityGroupForQuestion(questionId)
      if (!group) return
      const bucket = stats[group]
      const state = answerValidationState(answer)
      const text = answerText(answer)
      const structuredSignal = asRecord(answer.structured_signal || asRecord(answer.answer).structured_signal)
      const status = String(structuredSignal.status || '').trim().toLowerCase()
      bucket.total += 1
      if (['validated', 'confirmed'].includes(state)) bucket.validated += 1
      if (state === 'provisional') bucket.provisional += 1
      if (['no_signal', 'no signal', 'insufficient_signal', 'insufficient signal'].includes(state)) bucket.checked_no_signal += 1
      if (state === 'not_applicable' || String(asRecord(answer.applicability).status || '').trim().toLowerCase() === 'not_applicable') bucket.not_applicable += 1
      if (['failed', 'blocked', 'tool_call_missing', 'unknown'].includes(state)) bucket.failed += 1
      if (/\[object object\]|empty_provider_object|object_string|object_answer_without_sources/i.test(text)) bucket.malformed += 1
      if (isSourceLessPositiveAnswer(answer)) bucket.source_less_positive += 1
      if (status === 'provider_no_answer') bucket.provider_no_answer += 1
    })
  })
  return stats
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
    || hasMeaningfulText(fit.best_service)
    || hasMeaningfulText(fit.service_fit)
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
    const buyerRouteEligible = hasBuyerRouteEligibility(row.dossier_data)
    const commercialSynthesisEligible = hasCommercialSynthesisEligibility(row.dossier_data)
    const q14CommercialFitEligible = hasQ14CommercialFitEligibility(row.dossier_data)
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
      const validationState = answerValidationState(answer)
      bucket.total += 1
      bucket.validation_states[validationState] = (bucket.validation_states[validationState] || 0) + 1
      if (answerConfidence(answer) === 0) {
        bucket.zero_confidence += 1
      }
      if (['q11_decision_owner', 'q12_connections'].includes(questionId)) {
        bucket.eligible_total = Number(bucket.eligible_total || 0)
        bucket.eligible_zero_confidence = Number(bucket.eligible_zero_confidence || 0)
        if (buyerRouteEligible) {
          bucket.eligible_total += 1
          if (answerConfidence(answer) === 0) {
            bucket.eligible_zero_confidence += 1
          }
        }
      }
      if (['q14_yp_fit', 'q15_outreach_strategy'].includes(questionId)) {
        bucket.eligible_total = Number(bucket.eligible_total || 0)
        bucket.eligible_zero_confidence = Number(bucket.eligible_zero_confidence || 0)
        if (questionId === 'q14_yp_fit') {
          bucket.insufficient_signal_count = Number(bucket.insufficient_signal_count || 0)
          bucket.performance_gap_only_count = Number(bucket.performance_gap_only_count || 0)
          if (isInsufficientSignalAnswer(answer)) {
            bucket.insufficient_signal_count += 1
            if (commercialSynthesisEligible && !q14CommercialFitEligible) {
              bucket.performance_gap_only_count += 1
            }
          }
        }
        const eligibleForQuestion = questionId === 'q15_outreach_strategy'
          ? commercialSynthesisEligible && buyerRouteEligible
          : q14CommercialFitEligible
        if (eligibleForQuestion) {
          bucket.eligible_total += 1
          if (answerConfidence(answer) === 0) {
            bucket.eligible_zero_confidence += 1
          }
        }
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
    question_maturity_quality: questionMaturityQuality(dossiers),
    upstream_retrieval_quality: upstreamRetrievalQuality(dossiers),
    targeted_rerun_backlog: targetedRerunBacklog(dossiers),
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
    question_maturity_quality: dossierSummary.question_maturity_quality,
    upstream_retrieval_quality: dossierSummary.upstream_retrieval_quality,
    targeted_rerun_backlog: dossierSummary.targeted_rerun_backlog,
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
  questionMaturityQuality,
  qualityState,
  hasBuyerRouteEligibility,
  hasCommercialSynthesisEligibility,
  hasQ14CommercialFitEligibility,
  targetedRerunBacklog,
  upstreamRetrievalQuality,
}
