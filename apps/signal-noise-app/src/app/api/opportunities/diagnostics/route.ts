import { NextRequest, NextResponse } from 'next/server'

import { getPool } from '@/lib/pg-client'
import { buildGraphitiOpportunityBriefing } from '@/lib/graphiti-opportunity-briefing'
import { strategyBriefToCardBrief } from '@/lib/graphiti-opportunity-strategy-synthesis.mjs'
import { classifyGraphitiCommercialState } from '@/lib/graphiti-commercial-truth-filter.mjs'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

type CommercialState = 'outreach_ready' | 'verify_now' | 'watch' | 'context_only' | 'data_issue'
type CommercialSort = 'freshest' | 'yp_fit' | 'evidence'

function normalizeCommercialState(value: string | null): CommercialState {
  if (value === 'outreach_ready' || value === 'verify_now' || value === 'context_only' || value === 'data_issue') return value
  if (value === 'active') return 'outreach_ready'
  return 'watch'
}

function normalizeCommercialSort(value: string | null): CommercialSort {
  if (value === 'yp_fit' || value === 'evidence') return value
  return 'freshest'
}

function positiveInt(value: string | null, fallback: number, max = 100) {
  const number = Number.parseInt(value || '', 10)
  if (!Number.isFinite(number) || number < 1) return fallback
  return Math.min(number, max)
}

function concise(value: unknown, maxLength = 260) {
  const clean = text(value).replace(/\s+/g, ' ').trim()
  if (!clean || clean === '[object Object]' || /^n\/a$/i.test(clean)) return ''
  if (clean.length <= maxLength) return clean
  const sentence = clean.split(/(?<=[.!?])\s+/)[0]?.trim()
  if (sentence && sentence.length <= maxLength) return sentence
  return `${clean.slice(0, Math.max(40, maxLength - 1)).trim()}...`
}

function cleanBriefPhrase(value: unknown, maxLength = 260) {
  const cleaned = concise(value, maxLength)
    .replace(/^Position Yellow Panther around\s+/i, '')
    .replace(/\s+may be the route in, but buyer ownership needs checking\.$/i, '')
    .replace(/^Confirm the buyer owner in the dossier before outreach\.?$/i, '')
    .replace(/^cold_verification$/i, '')
    .replace(/^cold$/i, '')
    .replace(/^Yes\.?$/i, '')
    .trim()
  return cleaned
}

function isUsefulBriefText(value: string) {
  return Boolean(value)
    && !/^[a-zA-Z]+(?:_[a-zA-Z]+)+$/.test(value)
    && !/No BrightData tool is available/i.test(value)
    && !/No deterministic answer was produced/i.test(value)
    && !/cold_verification/i.test(value)
    && !/^CMS:|official site .*runs on|runs on PHP|technology stack|multi-vendor digital stack|CDN\/infrastructure/i.test(value)
    && !/no public rfps/i.test(value)
    && !/no .*procurement/i.test(value)
    && !/no deterministic answer/i.test(value)
    && !/no .*found/i.test(value)
    && !/failed/i.test(value)
}

function isUsefulAngleText(value: string) {
  return isUsefulBriefText(value)
    && !/finished the \d{4} .* season/i.test(value)
    && !/division title|playoff|draft picks|franchise record/i.test(value)
    && !/has launched|\blaunched\b|launched\/announced|competes in|official site|runs on/i.test(value)
    && !/Yellow Panther succeeds here/i.test(value)
}

function isUsefulRouteText(value: string) {
  return isUsefulBriefText(value)
    && !/^cold$/i.test(value)
    && !/confirm the buyer owner/i.test(value)
}

function firstUsefulBriefText(values: unknown[], maxLength = 320) {
  for (const value of values) {
    const candidate = cleanBriefPhrase(value, maxLength)
    if (isUsefulBriefText(candidate)) return candidate
  }
  return ''
}

function firstUsefulAngleText(values: unknown[], maxLength = 220) {
  for (const value of values) {
    const candidate = cleanBriefPhrase(value, maxLength)
    if (isUsefulAngleText(candidate)) return candidate
  }
  return ''
}

function firstUsefulRouteText(values: unknown[], maxLength = 180) {
  for (const value of values) {
    const candidate = cleanBriefPhrase(value, maxLength)
    if (isUsefulRouteText(candidate)) return candidate
  }
  return ''
}

function yellowPantherAngleFor(signalTitle: string, capability: string) {
  if (capability) {
    const sentence = `${capability.charAt(0).toUpperCase()}${capability.slice(1)}`
    return sentence.endsWith('.') ? sentence : `${sentence}.`
  }
  if (/hiring|football operations/i.test(signalTitle)) {
    return 'Use the signal to test for a practical recruitment intelligence, academy pathway, or football-operations decision-support need.'
  }
  if (/digital product/i.test(signalTitle)) {
    return 'Use the signal to test for fan-data, digital product, and platform-growth decision-support needs.'
  }
  if (/procurement/i.test(signalTitle)) {
    return 'Use the signal to test for procurement intelligence, supplier-route mapping, or vendor-change decision support.'
  }
  if (/funding/i.test(signalTitle)) {
    return 'Use the signal to test whether new funding creates a near-term planning, prioritisation, or reporting need.'
  }
  return 'Use the signal as account research until it maps to a funded operational priority.'
}

function briefVerdictFor(row: Record<string, unknown>, rawPayload: Record<string, unknown>) {
  const qualification = asRecord(rawPayload.commercial_qualification)
  const sourceText = text([
    row.title,
    qualification.promotion_reason,
    Array.isArray(qualification.trigger_evidence) ? asRecord(qualification.trigger_evidence[0]).text : '',
    Array.isArray(qualification.buying_triggers) ? asRecord(qualification.buying_triggers[0]).text : '',
    rawPayload.yp_fit_reasoning,
    rawPayload.best_path_owner,
  ].join(' '))
  const blockers = promotionBlockersFor(rawPayload).join(' ').toLowerCase()

  if (/No BrightData tool is available|No deterministic answer was produced|cold_verification/i.test(sourceText)) {
    return 'data_quality_issue'
  }
  if (blockers.includes('stale')) return 'needs_fresh_trigger'
  if (blockers.includes('weak') || blockers.includes('watch item')) return 'verify_trigger'
  if (text(qualification.status) === 'context_only') return 'context_only'
  return 'review'
}

function specificSignalTitleFor(row: Record<string, unknown>, rawPayload: Record<string, unknown>) {
  const qualification = asRecord(rawPayload.commercial_qualification)
  const entity = text(row.entity_name || row.canonical_entity_name) || 'This entity'
  const sourceText = firstUsefulBriefText([
    row.title,
    Array.isArray(qualification.trigger_evidence) ? asRecord(qualification.trigger_evidence[0]).text : '',
    Array.isArray(qualification.buying_triggers) ? asRecord(qualification.buying_triggers[0]).text : '',
    qualification.promotion_reason,
  ], 420)

  if (/recruitment analyst|analyst vacancy|hiring|vacanc|job|role/i.test(sourceText)) return `${entity} — hiring signal`
  if (/tender|rfp|procurement|contract|supplier/i.test(sourceText)) return `${entity} — procurement signal`
  if (/grant|funding|award|investment/i.test(sourceText)) return `${entity} — funding signal`
  if (/academy|pathway|scouting|recruitment intelligence/i.test(sourceText)) return `${entity} — football operations signal`
  if (/launch|platform|app|digital|data|analytics/i.test(sourceText)) return `${entity} — digital product signal`
  if (/offseason|draft|playoff|division|season/i.test(sourceText)) return `${entity} — account context signal`

  return `${entity} — commercial signal`
}

function briefTriggerFor(row: Record<string, unknown>, rawPayload: Record<string, unknown>) {
  const qualification = asRecord(rawPayload.commercial_qualification)
  const trigger = firstUsefulBriefText([
    Array.isArray(qualification.trigger_evidence) ? asRecord(qualification.trigger_evidence[0]).text : '',
    Array.isArray(qualification.buying_triggers) ? asRecord(qualification.buying_triggers[0]).text : '',
    qualification.promotion_reason,
  ], 280)

  if (trigger) return trigger

  const signalTitle = specificSignalTitleFor(row, rawPayload).split(' — ')[1] || 'commercial signal'
  const entity = text(row.entity_name || row.canonical_entity_name) || 'This entity'
  const article = /^[aeiou]/i.test(signalTitle) ? 'an' : 'a'
  return `The dossier contains ${article} ${signalTitle} for ${entity}, but it needs source-level verification before outreach.`
}

function dossierUrlFor(row: { canonical_entity_id?: string | null; entity_id?: string | null }) {
  const id = text(row.canonical_entity_id || row.entity_id)
  return id ? `/entity-browser/${id}/dossier?from=opportunities-diagnostics` : null
}

function mapWatchItem(row: Record<string, unknown>) {
  const rawPayload = asRecord(row.raw_payload)
  const qualification = asRecord(rawPayload.commercial_qualification)
  return {
    opportunity_id: row.opportunity_id,
    entity_name: row.entity_name || row.canonical_entity_name,
    canonical_entity_id: row.canonical_entity_id,
    title: row.title,
    status: row.status,
    is_active: Boolean(row.is_active),
    watch_item: rawPayload.watch_item === true,
    source_ledger_id: rawPayload.source_ledger_id || null,
    promotion_reason: qualification.promotion_reason || rawPayload.promotion_reason || null,
    blockers: Array.isArray(qualification.blockers) ? qualification.blockers : [],
    commercial_status: qualification.status || null,
    temporal_status: asRecord(rawPayload.temporal_reasoning).status || null,
    yellow_panther_fit: row.yellow_panther_fit,
    dossier_url: dossierUrlFor(row),
    updated_at: row.updated_at || row.materialized_at || null,
  }
}

function uniqueTexts(values: unknown[]) {
  return [...new Set(values.map(text).filter(Boolean))]
}

function qualityMetricsFor(rawPayload: Record<string, unknown>) {
  const metrics = asRecord(rawPayload.quality_metrics)
  return {
    raw_answer_count: Number(metrics.raw_answer_count ?? rawPayload.raw_answer_count ?? rawPayload.answer_count ?? 0),
    useful_fact_count: Number(metrics.useful_fact_count ?? rawPayload.useful_fact_count ?? rawPayload.answer_count ?? 0),
    evidence_count: Number(metrics.evidence_url_count ?? rawPayload.evidence_url_count ?? rawPayload.evidence_count ?? 0),
    failed_fact_count: Number(metrics.failed_fact_count ?? rawPayload.failed_fact_count ?? 0),
    no_signal_fact_count: Number(metrics.no_signal_fact_count ?? rawPayload.no_signal_fact_count ?? 0),
    placeholder_fact_count: Number(metrics.placeholder_fact_count ?? rawPayload.placeholder_fact_count ?? 0),
  }
}

function dossierQualityBlockersFor(rawPayload: Record<string, unknown>) {
  const metrics = qualityMetricsFor(rawPayload)
  const blockers = uniqueTexts([
    metrics.evidence_count <= 0 ? 'No evidence URLs' : '',
    metrics.useful_fact_count <= 0 && (metrics.failed_fact_count > 0 || metrics.no_signal_fact_count > 0) ? 'Only failed/no-signal facts' : '',
    metrics.useful_fact_count < 5 || metrics.evidence_count < 3 ? 'Needs enrichment' : '',
  ])

  return blockers
}

function promotionBlockersFor(rawPayload: Record<string, unknown>) {
  const qualification = asRecord(rawPayload.commercial_qualification)
  const temporalStatus = text(asRecord(rawPayload.temporal_reasoning).status)
  const commercialStatus = text(qualification.status)
  const blockers = Array.isArray(qualification.blockers) ? qualification.blockers : []

  const labels = uniqueTexts([
    ...blockers,
    commercialStatus === 'no_buying_trigger' ? 'No fresh dated buying trigger' : '',
    commercialStatus === 'watch' ? 'Weak or indirect buying trigger' : '',
    commercialStatus === 'context_only' ? 'Context-only dossier evidence' : '',
    temporalStatus === 'stale' ? 'Stale source evidence' : '',
    temporalStatus === 'expired' ? 'Expired source evidence' : '',
    rawPayload.watch_item === true ? 'Watch item only' : '',
  ])

  return labels.length > 0 ? labels : ['Below active shortlist threshold']
}

function promotionScoreFor(row: Record<string, unknown>, rawPayload: Record<string, unknown>) {
  const qualification = asRecord(rawPayload.commercial_qualification)
  const temporalStatus = text(asRecord(rawPayload.temporal_reasoning).status)
  const commercialStatus = text(qualification.status)
  const fit = Number(row.yellow_panther_fit || 0)
  const temporalWeight: Record<string, number> = {
    accelerating: 35,
    active: 30,
    emerging: 20,
    unknown: 10,
    stale: 0,
    expired: -10,
  }
  const commercialWeight: Record<string, number> = {
    accelerating: 30,
    active: 25,
    watch: 10,
    no_buying_trigger: 0,
    context_only: -5,
    blocked: -20,
  }

  return Math.max(0, Math.round(
    fit
    + (temporalWeight[temporalStatus] || 0)
    + (commercialWeight[commercialStatus] || 0)
    + (rawPayload.watch_item === true ? 5 : 0),
  ))
}

function commercialTruthFor(row: Record<string, unknown>, rawPayload = asRecord(row.raw_payload)) {
  return classifyGraphitiCommercialState({ ...row, raw_payload: rawPayload })
}

function suggestedVerificationActionFor(rawPayload: Record<string, unknown>) {
  const blockers = promotionBlockersFor(rawPayload)
  const blockerText = blockers.join(' ').toLowerCase()

  if (blockerText.includes('stale') || blockerText.includes('expired')) {
    return 'Confirm the source is still current, then re-check the trigger date before outreach.'
  }
  if (blockerText.includes('buying trigger') || blockerText.includes('weak')) {
    return 'Find a fresh dated buying trigger and identify whether this is an active priority.'
  }
  if (blockerText.includes('watch item')) {
    return 'Verify whether the watch signal has become an active project, budget, hire, or procurement event.'
  }

  return 'Verify source recency, buyer ownership, and whether the signal is active enough for outreach.'
}

function strategyBriefFor(row: Record<string, unknown>, rawPayload: Record<string, unknown>) {
  const strategyBrief = asRecord(rawPayload.bd_strategy_brief)
  if (strategyBrief.schema_version === 'yp_bd_strategy_v1') {
    return strategyBriefToCardBrief(strategyBrief)
  }
  return buildGraphitiOpportunityBriefing({
    ...row,
    organization: row.entity_name || row.canonical_entity_name,
    metadata: rawPayload,
    raw_payload: rawPayload,
  })
}

function bdBriefFor(row: Record<string, unknown>, rawPayload: Record<string, unknown>) {
  const qualification = asRecord(rawPayload.commercial_qualification)
  const ypFit = asRecord(qualification.yp_fit_breakdown)
  const entity = text(row.entity_name || row.canonical_entity_name) || 'This entity'
  const signalTitle = specificSignalTitleFor(row, rawPayload)
  const trigger = briefTriggerFor(row, rawPayload)
  const capability = firstUsefulAngleText([ypFit.outreach_angle, ypFit.capability_match, rawPayload.yp_fit_reasoning, rawPayload.capability_gap], 220)
  const route = firstUsefulRouteText([ypFit.buyer_route, rawPayload.best_path_owner, rawPayload.outreach_route], 180)
  const status = text(qualification.status)
  const briefVerdict = briefVerdictFor(row, rawPayload)

  return {
    signal_title: signalTitle,
    brief_verdict: briefVerdict,
    what_changed: trigger,
    why_it_matters: status === 'context_only'
      ? 'This is useful account context, but it does not yet prove a current buying trigger.'
      : 'This may indicate an emerging need, but it needs a fresher trigger or stronger buyer evidence before outreach.',
    yellow_panther_angle: yellowPantherAngleFor(signalTitle, capability),
    suggested_route: route
      ? `${route} may be the route in, but buyer ownership needs checking.`
      : 'Buyer route unconfirmed; identify the budget owner or operational sponsor before outreach.',
    outreach_hypothesis: trigger
      ? `Use this as a soft hypothesis: "${trigger}" Then connect it to a specific Yellow Panther decision-support use case.`
      : `Use ${entity} as an account-research lead, not an outreach trigger, until a current project or buyer is verified.`,
    verify_before_action: suggestedVerificationActionFor(rawPayload),
  }
}

function mapReviewableDossierCandidate(row: Record<string, unknown>) {
  const rawPayload = asRecord(row.raw_payload)
  const qualification = asRecord(rawPayload.commercial_qualification)
  const metrics = qualityMetricsFor(rawPayload)
  const truth = commercialTruthFor(row, rawPayload)
  return {
    opportunity_id: row.opportunity_id,
    entity_name: row.entity_name || row.canonical_entity_name,
    canonical_entity_id: row.canonical_entity_id,
    title: row.title,
    status: row.status,
    is_active: Boolean(row.is_active),
    quality_state: rawPayload.quality_state || null,
    watch_item: rawPayload.watch_item === true,
    source_ledger_id: rawPayload.source_ledger_id || null,
    promotion_reason: qualification.promotion_reason || rawPayload.promotion_reason || null,
    promotion_blockers: promotionBlockersFor(rawPayload),
    promotion_score: promotionScoreFor(row, rawPayload),
    yp_relevance: truth.yp_relevance,
    commercial_confidence: truth.commercial_confidence,
    commercial_confidence_score: truth.commercial_confidence_score,
    commercial_truth_reasons: truth.commercial_truth_reasons,
    useful_fact_count: metrics.useful_fact_count,
    raw_answer_count: metrics.raw_answer_count,
    evidence_count: metrics.evidence_count,
    dossier_quality_blockers: dossierQualityBlockersFor(rawPayload),
    commercial_status: qualification.status || null,
    temporal_status: asRecord(rawPayload.temporal_reasoning).status || null,
    yellow_panther_fit: row.yellow_panther_fit,
    dossier_url: dossierUrlFor(row),
    updated_at: row.updated_at || row.materialized_at || null,
  }
}

function mapCommercialStateCard(row: Record<string, unknown>) {
  const rawPayload = asRecord(row.raw_payload)
  const truth = commercialTruthFor(row, rawPayload)

  return {
    ...mapReviewableDossierCandidate(row),
    commercial_state: truth.commercial_state,
    recommendation_tier: truth.commercial_state,
    suggested_verification_action: suggestedVerificationActionFor(rawPayload),
    bd_brief: strategyBriefFor(row, rawPayload),
  }
}

function mapVerifyNowRecommendation(row: Record<string, unknown>) {
  const candidate = mapReviewableDossierCandidate(row)
  const rawPayload = asRecord(row.raw_payload)

  return {
    ...candidate,
    recommendation_tier: 'verify_now',
    suggested_verification_action: suggestedVerificationActionFor(rawPayload),
  }
}

function commercialSortOrderSql(sort: CommercialSort) {
  if (sort === 'yp_fit') {
    return `
            coalesce(m.yellow_panther_fit, 0) desc,
            case m.raw_payload->'temporal_reasoning'->>'status'
              when 'accelerating' then 5
              when 'active' then 4
              when 'emerging' then 3
              when 'unknown' then 2
              when 'stale' then 1
              else 0
            end desc,
            coalesce(i.evidence_count, 0) desc,`
  }
  if (sort === 'evidence') {
    return `
            coalesce(i.evidence_count, 0) desc,
            coalesce(i.answer_count, 0) desc,
            coalesce(m.yellow_panther_fit, 0) desc,`
  }
  return `
            case m.raw_payload->'temporal_reasoning'->>'status'
              when 'accelerating' then 5
              when 'active' then 4
              when 'emerging' then 3
              when 'unknown' then 2
              when 'stale' then 1
              else 0
            end desc,
            coalesce(m.updated_at, m.materialized_at) desc nulls last,
            coalesce(m.yellow_panther_fit, 0) desc,`
}

async function loadDiagnostics(options: { commercialState: CommercialState; commercialPage: number; commercialPageSize: number; commercialSort: CommercialSort }) {
  const pool = getPool()
  const commercialOffset = (options.commercialPage - 1) * options.commercialPageSize
  const commercialStartRank = commercialOffset
  const commercialEndRank = commercialOffset + options.commercialPageSize
  const countsResult = await pool.query(`
    select
      count(*) filter (
        where is_active = true
          and raw_payload->>'source' = 'entity_dossiers'
          and raw_payload->>'shortlist_opportunity' = 'true'
      )::int as active_shortlist_count,
      count(*) filter (
        where raw_payload->>'source' = 'entity_dossiers'
          and raw_payload->>'watch_item' = 'true'
      )::int as watch_item_count,
      count(*) filter (
        where m.raw_payload->>'source' = 'entity_dossiers'
          and i.status = 'ingested'
          and i.quality_state in ('complete', 'partial', 'client_ready')
          and coalesce(m.raw_payload->>'shortlist_opportunity', 'false') <> 'true'
      )::int as reviewable_dossier_candidate_count,
      count(*) filter (
        where m.raw_payload->>'source' = 'entity_dossiers'
          and i.status = 'ingested'
          and i.quality_state in ('complete', 'partial', 'client_ready')
          and coalesce(i.answer_count, 0) >= 5
          and coalesce(i.evidence_count, 0) >= 3
          and coalesce(m.yellow_panther_fit, 0) >= 60
          and coalesce(m.raw_payload->>'shortlist_opportunity', 'false') <> 'true'
          and coalesce(m.raw_payload->'commercial_qualification'->>'status', '') <> 'context_only'
          and coalesce(m.raw_payload->'commercial_qualification'->>'status', '') <> 'failed'
          and lower(coalesce(m.title, '') || ' ' || coalesce(m.summary, '') || ' ' || coalesce(m.read_more_context, '')) not like '%question execution failed before a safe answer could be produced%'
      )::int as verify_now_count,
      count(*) filter (
        where m.raw_payload->>'source' = 'entity_dossiers'
          and m.raw_payload->'commercial_qualification'->>'status' = 'context_only'
      )::int as context_only_count,
      count(*) filter (
        where m.raw_payload->>'source' = 'entity_dossiers'
          and (
            m.raw_payload->'commercial_qualification'->>'status' = 'failed'
            or lower(coalesce(m.title, '') || ' ' || coalesce(m.summary, '') || ' ' || coalesce(m.read_more_context, '')) like '%question execution failed before a safe answer could be produced%'
          )
      )::int as failed_only_count
    from graphiti_materialized_opportunities m
    left join graphiti_dossier_ingestions i
      on i.id::text = m.raw_payload->>'source_ledger_id'
  `)
  const ingestionResult = await pool.query(`
    select
      count(distinct canonical_entity_id)::int as ingested_dossier_entities,
      count(*) filter (where status = 'ingested')::int as ingested_rows,
      count(*) filter (where status = 'skipped_empty')::int as skipped_empty_rows,
      count(*) filter (where status = 'failed')::int as failed_rows,
      count(distinct canonical_entity_id) filter (where status = 'ingested' and quality_state = 'complete' and coalesce(evidence_count, 0) = 0)::int as sparse_complete_entities,
      count(distinct canonical_entity_id) filter (where status = 'ingested' and quality_state = 'partial' and coalesce(evidence_count, 0) = 0)::int as sparse_partial_entities,
      count(distinct canonical_entity_id) filter (where status = 'ingested' and coalesce(evidence_count, 0) = 0)::int as zero_evidence_entities,
      count(distinct canonical_entity_id) filter (where status = 'ingested' and (coalesce(answer_count, 0) >= 2 or coalesce(evidence_count, 0) >= 1))::int as useful_dossier_entities,
      count(distinct canonical_entity_id) filter (where status = 'ingested' and (coalesce(answer_count, 0) < 5 or coalesce(evidence_count, 0) < 3))::int as enrichment_required_entities,
      count(distinct canonical_entity_id) filter (where status = 'ingested' and coalesce(answer_count, 0) >= 5 and coalesce(evidence_count, 0) >= 3)::int as materializable_dossier_candidates,
      count(*) filter (where coalesce((raw_metadata->>'wrong_entity_blocked')::int, 0) > 0)::int as wrong_entity_blocked,
      count(*) filter (where coalesce((raw_metadata->>'tool_failure_blocked')::int, 0) > 0)::int as tool_failure_blocked,
      count(*) filter (where raw_metadata->>'generic_context_only' = 'true')::int as generic_context_only
    from graphiti_dossier_ingestions
  `)
  const reviewableResult = await pool.query(`
    select
      m.opportunity_id,
      m.entity_id,
      m.entity_name,
      m.canonical_entity_id,
      m.canonical_entity_name,
      m.title,
      m.status,
      m.is_active,
      m.yellow_panther_fit,
      m.materialized_at,
      m.updated_at,
      m.raw_payload || jsonb_build_object(
        'quality_state', i.quality_state,
        'answer_count', i.answer_count,
        'evidence_count', i.evidence_count,
        'quality_metrics', coalesce(i.raw_metadata->'quality_metrics', '{}'::jsonb)
      ) as raw_payload
    from graphiti_materialized_opportunities m
    join graphiti_dossier_ingestions i
      on i.id::text = m.raw_payload->>'source_ledger_id'
      and i.status = 'ingested'
    where m.raw_payload->>'source' = 'entity_dossiers'
      and (
        m.raw_payload->>'watch_item' = 'true'
        or m.raw_payload->'commercial_qualification'->>'status' in ('watch', 'context_only', 'no_buying_trigger')
      )
    order by
      coalesce(m.yellow_panther_fit, 0) desc,
      coalesce(m.updated_at, m.materialized_at) desc nulls last
    limit 20
  `)
  const reviewableDossierResult = await pool.query(`
    select
      m.opportunity_id,
      m.entity_id,
      m.entity_name,
      m.canonical_entity_id,
      m.canonical_entity_name,
      m.title,
      m.status,
      m.is_active,
      m.yellow_panther_fit,
      m.materialized_at,
      m.updated_at,
      m.raw_payload || jsonb_build_object(
        'quality_state', i.quality_state,
        'answer_count', i.answer_count,
        'evidence_count', i.evidence_count,
        'quality_metrics', coalesce(i.raw_metadata->'quality_metrics', '{}'::jsonb)
      ) as raw_payload
    from graphiti_materialized_opportunities m
    join graphiti_dossier_ingestions i
      on i.id::text = m.raw_payload->>'source_ledger_id'
      and i.status = 'ingested'
    where m.raw_payload->>'source' = 'entity_dossiers'
      and i.quality_state in ('complete', 'partial', 'client_ready')
      and coalesce(m.raw_payload->>'shortlist_opportunity', 'false') <> 'true'
    order by
      case m.raw_payload->'temporal_reasoning'->>'status'
        when 'accelerating' then 5
        when 'active' then 4
        when 'emerging' then 3
        when 'unknown' then 2
        when 'stale' then 1
        else 0
      end desc,
      case m.raw_payload->'commercial_qualification'->>'status'
        when 'accelerating' then 5
        when 'active' then 4
        when 'watch' then 3
        when 'no_buying_trigger' then 2
        when 'context_only' then 1
        else 0
      end desc,
      coalesce(m.yellow_panther_fit, 0) desc,
      coalesce(m.updated_at, m.materialized_at) desc nulls last
    limit 40
  `)
  const commercialStateRowsResult = await pool.query(`
      select
        m.opportunity_id,
        m.entity_id,
        m.entity_name,
        m.canonical_entity_id,
        m.canonical_entity_name,
        m.title,
        m.status,
        m.is_active,
        m.yellow_panther_fit,
        m.materialized_at,
        m.updated_at,
        m.raw_payload || jsonb_build_object(
          'quality_state', i.quality_state,
          'answer_count', i.answer_count,
          'evidence_count', i.evidence_count,
          'quality_metrics', coalesce(i.raw_metadata->'quality_metrics', '{}'::jsonb)
        ) as raw_payload
      from graphiti_materialized_opportunities m
      left join graphiti_dossier_ingestions i
        on i.id::text = m.raw_payload->>'source_ledger_id'
      where m.raw_payload->>'source' = 'entity_dossiers'
        and lower(coalesce(m.title, '') || ' ' || coalesce(m.summary, '') || ' ' || coalesce(m.read_more_context, '')) not like '%question execution failed before a safe answer could be produced%'
      order by
        ${commercialSortOrderSql(options.commercialSort)}
        coalesce(m.updated_at, m.materialized_at) desc nulls last
  `)
  const commercialStateCounts = {
    outreach_ready: 0,
    verify_now: 0,
    watch: 0,
    context_only: 0,
    data_issue: 0,
  }
  const commercialStateCards = {
    outreach_ready: [] as ReturnType<typeof mapCommercialStateCard>[],
    verify_now: [] as ReturnType<typeof mapCommercialStateCard>[],
    watch: [] as ReturnType<typeof mapCommercialStateCard>[],
    context_only: [] as ReturnType<typeof mapCommercialStateCard>[],
    data_issue: [] as ReturnType<typeof mapCommercialStateCard>[],
  }
  for (const row of commercialStateRowsResult.rows) {
    const card = mapCommercialStateCard(row)
    const key = text(card.commercial_state) as keyof typeof commercialStateCards
    if (key in commercialStateCards) {
      commercialStateCounts[key] += 1
      commercialStateCards[key].push(card)
    }
  }
  const selectedCommercialTotal = commercialStateCounts[options.commercialState]
  const pagedCommercialStateCards = {
    outreach_ready: [] as ReturnType<typeof mapCommercialStateCard>[],
    verify_now: [] as ReturnType<typeof mapCommercialStateCard>[],
    watch: [] as ReturnType<typeof mapCommercialStateCard>[],
    context_only: [] as ReturnType<typeof mapCommercialStateCard>[],
    data_issue: [] as ReturnType<typeof mapCommercialStateCard>[],
  }
  pagedCommercialStateCards[options.commercialState] = commercialStateCards[options.commercialState]
    .slice(commercialStartRank, commercialEndRank)

  return {
    generated_at: new Date().toISOString(),
    source: 'graphiti_dossier_ingestions',
    active_shortlist_count: commercialStateCounts.outreach_ready,
    watch_item_count: Number(countsResult.rows[0]?.watch_item_count || 0),
    reviewable_dossier_candidate_count: Number(countsResult.rows[0]?.reviewable_dossier_candidate_count || 0),
    verify_now_count: commercialStateCounts.verify_now,
    context_only_count: commercialStateCounts.context_only,
    data_issue_count: commercialStateCounts.data_issue,
    failed_only_count: Number(countsResult.rows[0]?.failed_only_count || 0),
    sparse_complete_entities: Number(ingestionResult.rows[0]?.sparse_complete_entities || 0),
    sparse_partial_entities: Number(ingestionResult.rows[0]?.sparse_partial_entities || 0),
    zero_evidence_entities: Number(ingestionResult.rows[0]?.zero_evidence_entities || 0),
    useful_dossier_entities: Number(ingestionResult.rows[0]?.useful_dossier_entities || 0),
    enrichment_required_entities: Number(ingestionResult.rows[0]?.enrichment_required_entities || 0),
    materializable_dossier_candidates: Number(ingestionResult.rows[0]?.materializable_dossier_candidates || 0),
    wrong_entity_blocked: Number(ingestionResult.rows[0]?.wrong_entity_blocked || 0),
    tool_failure_blocked: Number(ingestionResult.rows[0]?.tool_failure_blocked || 0),
    generic_context_only: Number(ingestionResult.rows[0]?.generic_context_only || 0),
    ingestion: ingestionResult.rows[0] || {
      ingested_dossier_entities: 0,
      ingested_rows: 0,
      skipped_empty_rows: 0,
      failed_rows: 0,
    },
    commercial_state_counts: commercialStateCounts,
    commercial_state_cards: pagedCommercialStateCards,
    commercial_state_pagination: {
      state: options.commercialState,
      page: options.commercialPage,
      page_size: options.commercialPageSize,
      commercial_sort: options.commercialSort,
      total: selectedCommercialTotal,
      total_pages: Math.max(1, Math.ceil(selectedCommercialTotal / options.commercialPageSize)),
      has_previous: options.commercialPage > 1,
      has_next: options.commercialPage * options.commercialPageSize < selectedCommercialTotal,
    },
    top_reviewable_watch_items: reviewableResult.rows.map(mapWatchItem),
    reviewable_dossier_candidates: reviewableDossierResult.rows.map(mapReviewableDossierCandidate),
    verify_now_recommendations: commercialStateCards.verify_now.slice(0, 12).map((card) => ({
      ...card,
      recommendation_tier: 'verify_now',
    })),
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request)
    const params = request.nextUrl.searchParams
    return NextResponse.json(await loadDiagnostics({
      commercialState: normalizeCommercialState(params.get('commercial_state')),
      commercialPage: positiveInt(params.get('commercial_page'), 1),
      commercialPageSize: positiveInt(params.get('commercial_page_size'), 24, 48),
      commercialSort: normalizeCommercialSort(params.get('commercial_sort')),
    }))
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json(
      {
        generated_at: new Date().toISOString(),
        source: 'graphiti_dossier_ingestions',
        active_shortlist_count: 0,
        watch_item_count: 0,
        context_only_count: 0,
        failed_only_count: 0,
        sparse_complete_entities: 0,
        sparse_partial_entities: 0,
        zero_evidence_entities: 0,
        useful_dossier_entities: 0,
        enrichment_required_entities: 0,
        materializable_dossier_candidates: 0,
        wrong_entity_blocked: 0,
        tool_failure_blocked: 0,
        generic_context_only: 0,
        reviewable_dossier_candidate_count: 0,
        verify_now_count: 0,
        data_issue_count: 0,
        commercial_state_counts: {
          outreach_ready: 0,
          verify_now: 0,
          watch: 0,
          context_only: 0,
          data_issue: 0,
        },
        commercial_state_cards: {
          outreach_ready: [],
          verify_now: [],
          watch: [],
          context_only: [],
          data_issue: [],
        },
        commercial_state_pagination: {
          state: 'watch',
          page: 1,
          page_size: 24,
          commercial_sort: 'freshest',
          total: 0,
          total_pages: 1,
          has_previous: false,
          has_next: false,
        },
        top_reviewable_watch_items: [],
        reviewable_dossier_candidates: [],
        verify_now_recommendations: [],
        warnings: [error instanceof Error ? error.message : 'Failed to load opportunity diagnostics'],
      },
      { status: 200 },
    )
  }
}
