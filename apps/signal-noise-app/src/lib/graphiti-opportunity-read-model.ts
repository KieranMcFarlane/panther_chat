import { getSupabaseAdmin } from '@/lib/supabase-client'
import { getGraphitiStaleWindowHours } from '@/lib/runtime-env'
import type {
  GraphitiOpportunityCard,
  GraphitiOpportunityResponse,
} from '@/lib/graphiti-opportunity-contract'
import { rankGraphitiOpportunities } from '@/lib/graphiti-opportunity-materializer'
import { buildGraphitiOpportunityReasoning } from '@/lib/graphiti-opportunity-reasoning.mjs'
import { strategyBriefToCardBrief } from '@/lib/graphiti-opportunity-strategy-synthesis.mjs'
import { classifyGraphitiCommercialState, isOutreachReadyGraphitiRow } from '@/lib/graphiti-commercial-truth-filter.mjs'
import { isTrustedGraphitiQualityEpochPayload } from '@/lib/graphiti-opportunity-quality-epoch'

const PERSISTED_COLUMNS = [
  'opportunity_id',
  'insight_id',
  'entity_id',
  'entity_name',
  'entity_type',
  'canonical_entity_id',
  'canonical_entity_name',
  'organization',
  'title',
  'summary',
  'why_it_matters',
  'suggested_action',
  'why_this_is_an_opportunity',
  'yellow_panther_fit_feedback',
  'next_steps',
  'supporting_signals',
  'read_more_context',
  'confidence',
  'confidence_score',
  'priority',
  'priority_score',
  'yellow_panther_fit',
  'category',
  'status',
  'location',
  'value',
  'deadline',
  'sport',
  'competition',
  'entity_role',
  'opportunity_kind',
  'theme',
  'taxonomy',
  'source_url',
  'tags',
  'evidence',
  'relationships',
  'source_run_id',
  'source_signal_id',
  'source_episode_id',
  'source_objective',
  'detected_at',
  'materialized_at',
  'last_seen_at',
  'state_hash',
  'is_active',
  'raw_payload',
].join(', ')

type PersistedGraphitiOpportunityRow = GraphitiOpportunityCard & {
  opportunity_id: string
  insight_id: string
  summary: string
  why_it_matters: string
  suggested_action: string
  why_this_is_an_opportunity: string
  yellow_panther_fit_feedback: string
  next_steps: string[]
  supporting_signals: string[]
  read_more_context: string
  state_hash: string
  is_active: boolean
  raw_payload: Record<string, unknown>
  source_run_id?: string | null
  source_signal_id?: string | null
  source_episode_id?: string | null
  source_objective?: string | null
  materialized_at?: string | null
  last_seen_at?: string | null
}

function hasLegacyMarker(value: unknown): boolean {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return false
  return (
    text === 'client_demo_seed'
    || text === 'demo_fallback_materialization'
    || /(^|[_/\-\s])(demo|mock|legacy)([_/\-\s]|$)/.test(text)
  )
}

function isLegacyOrDemoOriginOpportunityRow(row: Pick<PersistedGraphitiOpportunityRow, 'source_objective' | 'raw_payload'>) {
  const sourceObjective = String(row.source_objective || '').trim().toLowerCase()
  const rawPayload = row.raw_payload && typeof row.raw_payload === 'object'
    ? row.raw_payload as Record<string, unknown>
    : {}
  const rawSource = String(rawPayload.source || '').trim().toLowerCase()
  const dossierPath = String(rawPayload.dossier_path || '').trim().toLowerCase()

  return [
    sourceObjective,
    rawSource,
    rawPayload.source_objective,
    rawPayload.origin,
    rawPayload.source_run_id,
    rawPayload.fixture,
    dossierPath,
  ].some(hasLegacyMarker)
}

function isGenericOpportunityText(value: string) {
  const text = String(value || '').trim().toLowerCase()
  return (
    !text
    || /validated a .* trigger/.test(text)
    || /qualified yellow panther fit signal/.test(text)
    || /points to a live opening rather than passive monitoring/.test(text)
    || /open the canonical dossier and review the buyer hypothesis/.test(text)
    || /review question first evidence and prepare outreach/.test(text)
  )
}

function isFailedOnlyOpportunityRow(row: PersistedGraphitiOpportunityRow) {
  const failedQuestionMessage = 'question execution failed before a safe answer could be produced'
  const fields = [
    row.title,
    row.summary,
    row.why_it_matters,
    row.suggested_action,
    row.why_this_is_an_opportunity,
    row.read_more_context,
    row.raw_payload?.source_objective,
    row.raw_payload?.outreach_angle,
    row.raw_payload?.outreach_target,
  ].map((value) => String(value || '').toLowerCase())

  return fields.some((value) => value.includes(failedQuestionMessage))
}

function isCurrentDossierShortlistOpportunityRow(row: PersistedGraphitiOpportunityRow) {
  const rawPayload = asRecord(row.raw_payload)
  const source = String(rawPayload.source || '').trim()
  const sourceLedgerId = String(rawPayload.source_ledger_id || '').trim()
  const temporalStatus = String(asRecord(rawPayload.temporal_reasoning).status || '').trim().toLowerCase()
  const commercialQualification = asRecord(rawPayload.commercial_qualification)
  const commercialStatus = String(commercialQualification.status || '').trim().toLowerCase()
  const buyingTriggers = asArray<Record<string, unknown>>(commercialQualification.buying_triggers)

  if (source !== 'entity_dossiers') return false
  if (!sourceLedgerId) return false
  if (rawPayload.shortlist_opportunity !== true) return false
  if (rawPayload.watch_item === true) return false
  if (temporalStatus === 'stale' || temporalStatus === 'expired') return false
  if (commercialStatus === 'context_only' || commercialStatus === 'watch' || commercialStatus === 'blocked' || commercialStatus === 'no_buying_trigger') return false
  if ((commercialStatus === 'active' || commercialStatus === 'accelerating') && buyingTriggers.length === 0) return false

  return isOutreachReadyGraphitiRow(row)
}

function isTrustedGraphitiOpportunityRow(row: PersistedGraphitiOpportunityRow) {
  const rawPayload = asRecord(row.raw_payload)
  return isTrustedGraphitiQualityEpochPayload(rawPayload) && rawPayload.legacy_untrusted !== true
}

function firstSentence(value: string) {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  if (!text) return ''
  return text.split(/(?<=[.!?])\s+/)[0].trim()
}

function stripQuotes(value: string) {
  return value.replace(/^['"]+|['"]+$/g, '').trim()
}

function isPlaceholderText(value: string) {
  const text = String(value || '').trim().toLowerCase()
  return (
    !text
    || text === 'n/a'
    || text === 'no_signal'
    || /^no deterministic answer was produced for this question\.?$/i.test(text)
    || text.includes('question execution failed before a safe answer could be produced')
    || text.includes('no brightdata tool or service is available in this session')
  )
}

function isQuestionIdLike(value: unknown): boolean {
  const text = String(value || '').trim()
  return /^q\d+[_a-z0-9-]*$/i.test(text) || /^[a-z_]+_signal$/i.test(text) || /^[a-z_]+_docs$/i.test(text)
}

function extractStructuredText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    return value
      .map((item) => extractStructuredText(item))
      .filter(Boolean)
      .join(' · ')
      .trim()
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return [
      extractStructuredText(record.summary),
      extractStructuredText(asRecord(record.commercial_interpretation).summary),
      extractStructuredText(record.value),
      extractStructuredText(record.answer),
      extractStructuredText(record.context),
    ].find(Boolean) || ''
  }

  const text = String(value).trim()
  if (!text) return ''

  const embeddedDoubleQuotedSummary = text.match(/"summary"\s*:\s*"([^"]+)"/i)?.[1]
  if (embeddedDoubleQuotedSummary) return stripQuotes(embeddedDoubleQuotedSummary)
  const embeddedSingleQuotedSummary = text.match(/'summary'\s*:\s*'([^']+)'/i)?.[1]
  if (embeddedSingleQuotedSummary) return stripQuotes(embeddedSingleQuotedSummary)
  const looseSummary = text.match(/summary['"]?\s*:\s*['"]([^'"]{20,})/i)?.[1]
  if (looseSummary) return stripQuotes(looseSummary)
  const embeddedDoubleQuotedValue = text.match(/"value"\s*:\s*"([^"]+)"/i)?.[1]
  if (embeddedDoubleQuotedValue) return stripQuotes(embeddedDoubleQuotedValue)
  const embeddedSingleQuotedValue = text.match(/'value'\s*:\s*'([^']+)'/i)?.[1]
  if (embeddedSingleQuotedValue) return stripQuotes(embeddedSingleQuotedValue)

  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      return extractStructuredText(JSON.parse(text))
    } catch {
      return ''
    }
  }

  return text
}

function sanitizeNarrativeText(value: unknown): string {
  const text = extractStructuredText(value)
  if (!text) return ''
  if (isPlaceholderText(text)) return ''

  const cleaned = text
    .replace(/,\s*No deterministic answer was produced for this question\.?/gi, '')
    .replace(/No deterministic answer was produced for this question\.?,?\s*/gi, '')
    .replace(/,\s*No BrightData tool or service is available in this session[^.]*\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return isPlaceholderText(cleaned) ? '' : cleaned
}

function sanitizeReadMoreContext(value: unknown): string {
  return String(value || '')
    .split(' · ')
    .map((part) => sanitizeNarrativeText(part))
    .filter((part) => part && !isQuestionIdLike(part))
    .join(' · ')
}

function sanitizeFindingRows(value: unknown): unknown[] {
  return asArray<Record<string, unknown>>(value)
    .map((finding) => ({
      ...finding,
      label: sanitizeNarrativeText(finding.label),
      finding: sanitizeNarrativeText(finding.finding),
      source_url: /^https?:\/\//i.test(String(finding.source_url || '')) ? finding.source_url : null,
      source: isQuestionIdLike(finding.source) ? 'dossier-derived, source pending' : sanitizeNarrativeText(finding.source),
    }))
    .filter((finding) => finding.finding && !isQuestionIdLike(finding.finding))
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function synthesizeOpportunityNarrative(row: PersistedGraphitiOpportunityRow) {
  const rawPayload = asRecord(row.raw_payload)
  const commercialQualification = asRecord(rawPayload.commercial_qualification)
  const ypFitBreakdown = asRecord(commercialQualification.yp_fit_breakdown)
  const triggerEvidence = asArray<Record<string, unknown>>(commercialQualification.trigger_evidence)
  const buyingTriggers = asArray<Record<string, unknown>>(commercialQualification.buying_triggers)
  const primaryTrigger = triggerEvidence.find((trigger) => trigger.is_current === true) || triggerEvidence[0] || buyingTriggers[0]
  const triggerFamily = sanitizeNarrativeText(primaryTrigger?.family) || buildOpportunityLabel(row)
  const triggerSummary = sanitizeNarrativeText(primaryTrigger?.text)
  const capabilityMatch = sanitizeNarrativeText(ypFitBreakdown.capability_match)
  const buyerRoute = sanitizeNarrativeText(ypFitBreakdown.buyer_route)
  const outreachAngle = sanitizeNarrativeText(ypFitBreakdown.outreach_angle)
  const summary = firstSentence(sanitizeNarrativeText(row.summary))
  const contextBits = [
    row.entity_name,
    row.opportunity_kind || row.category,
    row.competition,
    row.sport,
  ]
    .map((value) => String(value || '').trim())
    .filter((value) => value && !['other', 'unknown', 'n/a', 'na'].includes(value.toLowerCase()))
  const context = contextBits.length > 0 ? contextBits.join(' · ') : row.entity_name || 'canonical dossier'
  const whyItMatters = [
    `${context} has a ${triggerFamily} worth pursuing because it indicates a concrete operating priority, not just static club context.`,
    triggerSummary || summary,
    capabilityMatch ? `Yellow Panther angle: ${capabilityMatch}.` : '',
    buyerRoute ? `Likely route: ${buyerRoute}.` : '',
  ].filter(Boolean).join(' ').trim()
  const suggestedAction = [
    triggerFamily.toLowerCase().includes('hiring') ? 'Use the hiring signal as the outreach wedge.' : `Use the ${triggerFamily} as the outreach wedge.`,
    outreachAngle,
    buyerRoute ? `Route the first hypothesis through ${buyerRoute}.` : '',
    'Verify recency, source evidence, and buyer ownership before outreach.',
  ].filter(Boolean).join(' ').trim()

  return {
    whyItMatters,
    suggestedAction,
    description: summary || whyItMatters,
  }
}

function buildOpportunityLabel(row: PersistedGraphitiOpportunityRow): string {
  const rawPayload = asRecord(row.raw_payload)
  const commercialQualification = asRecord(rawPayload.commercial_qualification)
  const buyingTriggers = asArray<Record<string, unknown>>(commercialQualification.buying_triggers)
  const triggerFamily = String(buyingTriggers[0]?.family || '').trim().toLowerCase()
  if (triggerFamily === 'hiring') return 'hiring signal'
  if (triggerFamily === 'procurement') return 'procurement/tender signal'
  if (triggerFamily === 'digital') return 'digital platform opportunity'
  if (triggerFamily === 'leadership') return 'decision-owner signal'
  if (triggerFamily === 'sponsorship') return 'sponsorship signal'
  if (triggerFamily === 'yp_fit') return 'Yellow Panther fit signal'

  const rawKind = [
    row.opportunity_kind,
    row.theme,
    row.category,
    rawPayload.signal_basis,
  ]
    .map((value) => String(value || '').trim())
    .find(Boolean)

  const kind = String(rawKind || 'commercial').trim().toLowerCase()
  if (kind.includes('digital')) return 'digital signal'
  if (kind.includes('procurement')) return 'procurement signal'
  if (kind.includes('sponsor')) return 'sponsorship signal'
  if (kind.includes('hiring')) return 'hiring signal'
  if (kind.includes('leadership') || kind.includes('owner')) return 'leadership signal'
  if (kind.includes('market') || kind.includes('launch') || kind.includes('media')) return 'market signal'
  if (kind.includes('question first')) return 'live commercial opening'
  return 'live commercial opening'
}

function toRecord(row: PersistedGraphitiOpportunityRow): GraphitiOpportunityCard {
  const rawPayload = asRecord(row.raw_payload)
  const commercialTruth = classifyGraphitiCommercialState(row)
  const strategyBrief = asRecord(rawPayload.bd_strategy_brief)
  const title = sanitizeNarrativeText(row.title)
  const summary = sanitizeNarrativeText(row.summary)
  const whyItMatters = sanitizeNarrativeText(row.why_it_matters)
  const suggestedAction = sanitizeNarrativeText(row.suggested_action)
  const existingWhy = sanitizeNarrativeText(row.why_this_is_an_opportunity)
  const synthesized = isGenericOpportunityText(whyItMatters) || isGenericOpportunityText(suggestedAction) || isGenericOpportunityText(existingWhy || '')
    ? synthesizeOpportunityNarrative(row)
    : null
  const whyThisIsAnOpportunity = synthesized?.description || existingWhy || summary || whyItMatters || suggestedAction
  const yellowPantherFitFeedback = sanitizeNarrativeText(row.yellow_panther_fit_feedback)
  const commercialQualification = asRecord(rawPayload.commercial_qualification)
  const ypFitBreakdown = asRecord(commercialQualification.yp_fit_breakdown)
  const triggerEvidence = asArray<Record<string, unknown>>(commercialQualification.trigger_evidence)
  const buyingTriggers = asArray<Record<string, unknown>>(commercialQualification.buying_triggers)
  const primaryTrigger = triggerEvidence.find((trigger) => trigger.is_current === true) || triggerEvidence[0] || buyingTriggers[0]
  const triggerSummary = sanitizeNarrativeText(primaryTrigger?.text)
  const breakdownFeedback = [
    triggerSummary ? `Trigger: ${triggerSummary}` : '',
    ypFitBreakdown.capability_match ? `Capability match: ${sanitizeNarrativeText(ypFitBreakdown.capability_match)}` : '',
    ypFitBreakdown.buyer_route ? `Buyer route: ${sanitizeNarrativeText(ypFitBreakdown.buyer_route)}` : '',
    ypFitBreakdown.outreach_angle && sanitizeNarrativeText(ypFitBreakdown.outreach_angle) !== sanitizeNarrativeText(ypFitBreakdown.buyer_route) ? `Outreach angle: ${sanitizeNarrativeText(ypFitBreakdown.outreach_angle)}` : '',
    ypFitBreakdown.verification_needed ? `Verification needed: ${sanitizeNarrativeText(ypFitBreakdown.verification_needed)}` : '',
  ].filter(Boolean).join(' ')
  const nextSteps = (Array.isArray(row.next_steps) ? row.next_steps : [])
    .map((value) => sanitizeNarrativeText(value))
    .filter(Boolean)
  const supportingSignals = (Array.isArray(row.supporting_signals) ? row.supporting_signals : [])
    .map((value) => sanitizeNarrativeText(value))
    .filter(Boolean)
  const readMoreContext = sanitizeReadMoreContext(row.read_more_context)
  const displayNextSteps = synthesized
    ? [synthesized.suggestedAction, ...nextSteps]
    : nextSteps
  const titleNeedsCompression = (
    !title
    || title.length > 160
    || title.includes('. ')
    || title.includes('; ')
    || title.includes('No deterministic answer')
    || /question first opportunity signal/i.test(title)
    || /has a dossier-backed opportunity signal/i.test(title)
  )
  const personTitleNeedsTriggerLabel = (
    Boolean(title)
    && !titleNeedsCompression
    && ['hiring', 'procurement', 'digital', 'sponsorship'].includes(String(primaryTrigger?.family || buyingTriggers[0]?.family || '').toLowerCase())
    && !/(hiring|vacancy|procurement|tender|rfp|app|platform|sponsor|partnership|commercial signal|opportunity)/i.test(title)
  )
  const displayTitle = titleNeedsCompression
    ? `${row.organization}: ${buildOpportunityLabel(row)}`
    : personTitleNeedsTriggerLabel
    ? `${row.organization}: ${buildOpportunityLabel(row)}`
    : title
  const computedReasoning = buildGraphitiOpportunityReasoning({
    entityName: row.canonical_entity_name || row.entity_name || row.organization,
    detectedAt: row.detected_at,
    lastSeenAt: row.last_seen_at,
    materializedAt: row.materialized_at,
    deadline: row.deadline,
    confidence: row.confidence,
    yellowPantherFit: row.yellow_panther_fit,
    supportingSignals,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    relationships: Array.isArray(row.relationships) ? row.relationships : [],
    rawPayload,
  })
  const temporalReasoning = computedReasoning.temporal_reasoning
  const patternReasoning = asRecord(rawPayload.pattern_reasoning).pattern_status
    ? rawPayload.pattern_reasoning
    : computedReasoning.pattern_reasoning
  const findings = sanitizeFindingRows(asArray(rawPayload.findings).length > 0 ? asArray(rawPayload.findings) : computedReasoning.findings)
  const timeline = asArray(rawPayload.timeline).length > 0 ? asArray(rawPayload.timeline) : computedReasoning.timeline
  const relatedPatterns = asArray(rawPayload.related_patterns).length > 0 ? asArray(rawPayload.related_patterns) : computedReasoning.related_patterns
  const enrichedMetadata = {
    ...rawPayload,
    temporal_reasoning: temporalReasoning,
    pattern_reasoning: patternReasoning,
    yp_fit_reasoning: rawPayload.yp_fit_reasoning || computedReasoning.yp_fit_reasoning,
      recommended_action: computedReasoning.recommended_action || rawPayload.recommended_action,
      commercial_qualification: rawPayload.commercial_qualification || computedReasoning.commercial_qualification,
      findings,
    timeline,
    related_patterns: relatedPatterns,
  }

  return {
    id: row.opportunity_id,
    title: displayTitle,
    organization: row.organization,
    description: synthesized?.description || whyThisIsAnOpportunity || summary || whyItMatters || suggestedAction || '',
    why_this_is_an_opportunity: synthesized?.whyItMatters || whyThisIsAnOpportunity || summary || whyItMatters || '',
    yellow_panther_fit_feedback: breakdownFeedback || yellowPantherFitFeedback || '',
    next_steps: Array.from(new Set(displayNextSteps)),
    supporting_signals: supportingSignals,
    read_more_context: readMoreContext || '',
    location: row.location || null,
    value: row.value || null,
    deadline: row.deadline || null,
    category: row.category,
    priority: row.priority,
    priority_score: row.priority_score,
    confidence: row.confidence,
    confidence_score: row.confidence_score,
    yellow_panther_fit: row.yellow_panther_fit,
    entity_id: row.entity_id,
    entity_name: row.entity_name,
    canonical_entity_id: row.canonical_entity_id || undefined,
    canonical_entity_name: row.canonical_entity_name || undefined,
    entity_type: row.entity_type,
    sport: row.sport,
    competition: row.competition,
    entity_role: row.entity_role,
    opportunity_kind: row.opportunity_kind,
    theme: row.theme,
    taxonomy: row.taxonomy,
    metadata: enrichedMetadata,
    source_url: row.source_url,
    tags: Array.isArray(row.tags) ? row.tags : [],
    detected_at: row.detected_at,
    status: row.status,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    relationships: Array.isArray(row.relationships) ? row.relationships : [],
    temporal_reasoning: temporalReasoning as GraphitiOpportunityCard['temporal_reasoning'],
    pattern_reasoning: patternReasoning as GraphitiOpportunityCard['pattern_reasoning'],
    yp_fit_reasoning: String(computedReasoning.yp_fit_reasoning || rawPayload.yp_fit_reasoning || ''),
    recommended_action: String(computedReasoning.recommended_action || rawPayload.recommended_action || ''),
    findings: findings as GraphitiOpportunityCard['findings'],
    timeline: timeline as GraphitiOpportunityCard['timeline'],
    related_patterns: relatedPatterns as GraphitiOpportunityCard['related_patterns'],
    strategy_brief: strategyBrief.schema_version === 'yp_bd_strategy_v1'
      ? strategyBrief as GraphitiOpportunityCard['strategy_brief']
      : undefined,
    briefing: strategyBrief.schema_version === 'yp_bd_strategy_v1'
      ? strategyBriefToCardBrief(strategyBrief) as GraphitiOpportunityCard['briefing']
      : undefined,
    commercial_state: commercialTruth.commercial_state as GraphitiOpportunityCard['commercial_state'],
    commercial_confidence: commercialTruth.commercial_confidence,
    commercial_confidence_score: commercialTruth.commercial_confidence_score,
    yp_relevance: commercialTruth.yp_relevance,
    commercial_truth_reasons: commercialTruth.commercial_truth_reasons,
  }
}

function getOpportunityGroupingKey(row: PersistedGraphitiOpportunityRow): string {
  return [
    row.canonical_entity_id || row.entity_id || '',
    row.canonical_entity_name || row.entity_name || '',
    row.opportunity_kind || '',
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join('|')
}

function computeOpportunityRowScore(row: PersistedGraphitiOpportunityRow): number {
  const narrativeLength = [
    row.title,
    row.summary,
    row.why_it_matters,
    row.suggested_action,
    row.why_this_is_an_opportunity,
    row.yellow_panther_fit_feedback,
    row.read_more_context,
    ...(Array.isArray(row.next_steps) ? row.next_steps : []),
    ...(Array.isArray(row.supporting_signals) ? row.supporting_signals : []),
  ]
    .map((value) => String(value || '').trim().length)
    .reduce((sum, value) => sum + value, 0)

  const confidence = Number(row.confidence || 0)
  const priority = Number(row.priority_score || 0)
  const titlePenalty = /has a dossier-backed opportunity signal/i.test(row.title || '') ? -1000 : 0

  return (confidence * 1000) + (priority * 100) + narrativeLength + titlePenalty
}

function isStale(lastSeenAt: string | null | undefined) {
  if (!lastSeenAt) return true
  const timestamp = Date.parse(lastSeenAt)
  if (!Number.isFinite(timestamp)) return true
  const staleWindowMs = getGraphitiStaleWindowHours() * 60 * 60 * 1000
  return Date.now() - timestamp > staleWindowMs
}

export async function loadGraphitiOpportunitiesFromDb(limit = 25): Promise<GraphitiOpportunityResponse> {
  const supabase = getSupabaseAdmin()
  const warnings: string[] = []
  const response = await supabase
    .from('graphiti_materialized_opportunities')
    .select(PERSISTED_COLUMNS)
    .order('last_seen_at', { ascending: false })
    .limit(Math.max(limit * 8, 500))

  if (response.error) {
    warnings.push(`Persisted Graphiti opportunities query failed: ${response.error.message}`)
    return {
      source: 'graphiti_opportunities',
      status: 'empty',
      generated_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      opportunities: [],
      snapshot: {
        opportunities_scanned: 0,
        opportunities_materialized: 0,
        active_opportunities: 0,
        freshness_window_hours: getGraphitiStaleWindowHours(),
      },
      warnings,
    }
  }

  const rows = Array.isArray(response.data) ? (response.data as PersistedGraphitiOpportunityRow[]) : []
  const activeRows = rows.filter((row) => (
    row.is_active === true
    && isTrustedGraphitiOpportunityRow(row)
    && !isLegacyOrDemoOriginOpportunityRow(row)
    && !isFailedOnlyOpportunityRow(row)
    && isCurrentDossierShortlistOpportunityRow(row)
  ))
  const bestRowsByEntity = new Map<string, PersistedGraphitiOpportunityRow>()

  for (const row of activeRows) {
    const key = getOpportunityGroupingKey(row)
    const existing = bestRowsByEntity.get(key)
    if (!existing || computeOpportunityRowScore(row) > computeOpportunityRowScore(existing)) {
      bestRowsByEntity.set(key, row)
    }
  }

  const rankedRows = Array.from(bestRowsByEntity.values())
    .sort((left, right) => computeOpportunityRowScore(right) - computeOpportunityRowScore(left))
  const opportunities = rankGraphitiOpportunities(rankedRows.map((row) => toRecord(row))).slice(0, limit)
  const lastUpdatedAt = rankedRows[0]?.last_seen_at || rankedRows[0]?.materialized_at || activeRows[0]?.last_seen_at || activeRows[0]?.materialized_at || rows[0]?.last_seen_at || rows[0]?.materialized_at || new Date().toISOString()
  const stale = isStale(rankedRows[0]?.last_seen_at || rankedRows[0]?.materialized_at || activeRows[0]?.last_seen_at || activeRows[0]?.materialized_at || rows[0]?.last_seen_at || rows[0]?.materialized_at)

  return {
    source: 'graphiti_opportunities',
    status: opportunities.length === 0 ? 'empty' : stale ? 'degraded' : 'ready',
    generated_at: new Date().toISOString(),
    last_updated_at: lastUpdatedAt,
    opportunities,
    snapshot: {
      opportunities_scanned: rows.length,
      opportunities_materialized: rankedRows.length,
      active_opportunities: opportunities.length,
      freshness_window_hours: getGraphitiStaleWindowHours(),
    },
    warnings,
  }
}
