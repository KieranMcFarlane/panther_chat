import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { normalizeQuestionFirstDossier } from '@/lib/question-first-dossier'
import { getSupabaseAdmin } from '@/lib/supabase-client'
import { query as queryPostgres } from '@/lib/pg-client'
import { getGraphitiStaleWindowHours } from '@/lib/runtime-env'
import { materializeGraphitiOpportunity, rankGraphitiOpportunities } from '@/lib/graphiti-opportunity-materializer'
import type {
  GraphitiOpportunityCard,
  GraphitiOpportunityResponse,
  GraphitiOpportunitySourceRow,
} from '@/lib/graphiti-opportunity-contract'

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
  freshness?: GraphitiOpportunitySourceRow['freshness']
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

type EntityDossierOpportunityRow = {
  source_ledger_id?: string | null
  entity_id?: string | null
  canonical_entity_id?: string | null
  entity_name?: string | null
  entity_type?: string | null
  created_at?: string | null
  generated_at?: string | null
  quality_state?: string | null
  answer_count?: number | null
  evidence_count?: number | null
  reference_time?: string | null
  episode_body?: Record<string, unknown> | null
  dossier_data?: Record<string, unknown> | null
}

function toIso(value: unknown, fallback = new Date().toISOString()) {
  const text = value === null || value === undefined ? '' : String(value).trim()
  if (!text) return fallback
  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function collectAnswerRecords(normalized: any): Array<Record<string, unknown>> {
  const candidateArrays = [
    normalized?.question_first?.answer_records,
    normalized?.question_first?.answers,
    normalized?.question_first?.questions,
    normalized?.metadata?.question_first_checkpoint?.answer_records,
  ]

  return candidateArrays.flatMap((value) => Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [])
}

function isFailedOnlyText(value: unknown): boolean {
  const text = toText(value).toLowerCase()
  const failedQuestionMessage = 'Question execution failed before a safe answer could be produced'
  const providerBalanceFailure = 'OpenCodeProviderInsufficientBalanceError'
  if (!text) return false
  return (
    text.includes(failedQuestionMessage.toLowerCase())
    || text.includes(providerBalanceFailure.toLowerCase())
    || text.includes('tool/runtime failure')
    || text.includes('failed before a safe answer')
  )
}

function isEmptyStructuredText(value: unknown): boolean {
  const text = toText(value).toLowerCase()
  if (!text) return true
  return (
    text.includes('"top_signals":[]')
    && text.includes('"opportunity_hypotheses":[]')
    && text.includes('"summary":null')
  )
}

function answerHasUsefulContent(answer: Record<string, unknown>): boolean {
  const terminalStates = new Set(['answered', 'validated', 'provisional'])
  const status = toText(answer.status || answer.validation_state || answer.terminal_state).toLowerCase()
  if (status && !terminalStates.has(status)) return false

  const answerRecord = asRecord(answer.answer)
  const summary = toText(answer.summary || answer.value || answer.answer || answerRecord.summary || answerRecord.value)
  if (!summary || isFailedOnlyText(summary)) return false

  const confidence = Number(answer.confidence ?? answerRecord.confidence ?? 0)
  return Number.isFinite(confidence) ? confidence > 0 : true
}

function hasUsefulDossierOpportunitySignal(
  normalized: any,
  discoverySummary: Record<string, unknown>,
  graphiti: Record<string, unknown>,
  serviceFit: unknown[],
): boolean {
  const commercialFields = [
    graphiti.outreach_angle,
    graphiti.capability_gap,
    graphiti.outreach_route,
    graphiti.outreach_target,
    graphiti.best_path_owner,
    discoverySummary.summary,
  ].map(toText).filter(Boolean)
  if (commercialFields.some(isFailedOnlyText)) return false
  const hasCommercialText = commercialFields.some((value) => !isEmptyStructuredText(value))
  const ypOpportunity = asRecord(discoverySummary.yellow_panther_opportunity)
  const probability = Number(ypOpportunity.estimated_probability ?? graphiti.estimated_probability ?? graphiti.win_probability ?? 0)
  const hasFitSignal = serviceFit.length > 0 || (Number.isFinite(probability) && probability > 0)
  const hasUsefulAnswer = collectAnswerRecords(normalized).some(answerHasUsefulContent)

  return (hasCommercialText && (hasFitSignal || hasUsefulAnswer)) || (hasFitSignal && hasUsefulAnswer)
}

function toReadableEpisodeText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value.map(toReadableEpisodeText).filter(Boolean).join(' · ')
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return [
      record.summary,
      record.answer,
      record.value,
      record.description,
      record.title,
      record.name,
    ].map(toReadableEpisodeText).find(Boolean) || ''
  }
  return String(value).trim()
}

function buildDossierOpportunitySourceFromLedgerEpisode(
  row: EntityDossierOpportunityRow,
  normalized: any,
  fallbackEntityId: string,
): GraphitiOpportunitySourceRow | null {
  const episodeBody = row.episode_body && typeof row.episode_body === 'object'
    ? row.episode_body
    : null
  if (!episodeBody) return null

  const graphiti = asRecord(episodeBody.graphiti_sales_brief)
  const yellowPanther = asRecord(episodeBody.yellow_panther)
  const questionFacts = Array.isArray(episodeBody.question_facts)
    ? episodeBody.question_facts.filter((item) => item && typeof item === 'object') as Record<string, unknown>[]
    : []
  const evidenceUrls = Array.isArray(episodeBody.evidence_urls)
    ? episodeBody.evidence_urls.map(toText).filter(Boolean)
    : []
  const usefulFact = questionFacts.find((fact) => {
    const summary = toReadableEpisodeText(fact.summary)
    return summary && !isFailedOnlyText(summary) && !isEmptyStructuredText(summary)
  })
  const commercialText = [
    graphiti.outreach_angle,
    graphiti.capability_gap,
    graphiti.outreach_route,
    graphiti.outreach_target,
    graphiti.best_path_owner,
    yellowPanther.fit_feedback,
    yellowPanther.commercial_interpretation,
    yellowPanther.competitive_advantage,
    episodeBody.promoted_summary,
    usefulFact?.summary,
  ].map(toReadableEpisodeText).filter(Boolean)
  const failedOnly = commercialText.length > 0 && commercialText.every(isFailedOnlyText)
  if (failedOnly || (commercialText.length === 0 && evidenceUrls.length === 0)) return null

  const entityRecord = asRecord(episodeBody.entity)
  const entityId = toText(row.canonical_entity_id || entityRecord.canonical_entity_id || fallbackEntityId)
  const entityName = toText(row.entity_name || entityRecord.entity_name || normalized?.entity_name || entityId)
  if (!entityId || !entityName) return null

  const probability = Number(
    yellowPanther.estimated_probability
      ?? yellowPanther.score
      ?? graphiti.estimated_probability
      ?? graphiti.win_probability
      ?? 0,
  )
  const confidenceScore = Number.isFinite(probability)
    ? Math.max(0, Math.min(1, probability > 1 ? probability / 100 : probability))
    : 0.45
  const detectedAt = toIso(row.reference_time || row.generated_at || row.created_at || new Date().toISOString())
  const title = toReadableEpisodeText(graphiti.outreach_angle)
    || toReadableEpisodeText(episodeBody.promoted_summary)
    || `${entityName} has a dossier-backed opportunity signal`
  const summary = toReadableEpisodeText(graphiti.outreach_angle)
    || toReadableEpisodeText(graphiti.capability_gap)
    || toReadableEpisodeText(episodeBody.promoted_summary)
    || toReadableEpisodeText(usefulFact?.summary)
    || `${entityName} has ingested dossier facts available for commercial review.`
  const whyItMatters = toReadableEpisodeText(graphiti.capability_gap)
    || toReadableEpisodeText(yellowPanther.competitive_advantage)
    || toReadableEpisodeText(yellowPanther.fit_feedback)
    || summary
  const suggestedAction = toReadableEpisodeText(graphiti.outreach_route)
    || toReadableEpisodeText(graphiti.outreach_target)
    || toReadableEpisodeText(yellowPanther.entry_point)
    || 'Open the canonical dossier and review the strongest evidence-backed route.'
  const serviceFit = Array.isArray(yellowPanther.service_fit)
    ? yellowPanther.service_fit.map(toReadableEpisodeText).filter(Boolean)
    : []

  return {
    insight_id: `dossier-opportunity:${entityId}`,
    entity_id: entityId,
    entity_name: entityName,
    entity_type: toText(row.entity_type || entityRecord.entity_type || normalized?.entity_type || 'Entity'),
    insight_type: 'opportunity',
    title,
    summary,
    why_it_matters: whyItMatters,
    suggested_action: suggestedAction,
    confidence: confidenceScore,
    freshness: row.quality_state === 'client_ready' ? 'new' : 'recent',
    evidence: evidenceUrls.map((url, index) => ({
      type: 'episode' as const,
      id: `${entityId}:dossier-evidence:${index + 1}`,
      snippet: `Dossier evidence ${index + 1}`,
      source: url,
    })),
    relationships: [],
    priority: confidenceScore >= 0.8 || serviceFit.length > 0 ? 'high' : confidenceScore >= 0.5 ? 'medium' : 'low',
    destination_url: `/entity-browser/${encodeURIComponent(entityId)}/dossier?from=1`,
    detected_at: detectedAt,
    materialized_at: detectedAt,
    source_run_id: toText(normalized?.question_first?.run_id || normalized?.metadata?.question_first?.run_id),
    source_signal_id: undefined,
    source_episode_id: toText(row.source_ledger_id || ''),
    source_objective: title,
    raw_payload: {
      source: 'entity_dossiers',
      source_ledger_id: row.source_ledger_id,
      canonical_entity_id: row.canonical_entity_id,
      quality_state: row.quality_state || normalized?.quality_state || null,
      answer_count: row.answer_count || 0,
      evidence_count: row.evidence_count || evidenceUrls.length,
      reference_time: row.reference_time || detectedAt,
      episode_body: row.episode_body,
      graphiti_sales_brief: graphiti,
      yellow_panther_opportunity: yellowPanther,
      service_fit: serviceFit,
      capability_gap: graphiti.capability_gap || null,
      outreach_route: graphiti.outreach_route || graphiti.outreach_target || null,
    },
  }
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

function isLegacyOrDemoOpportunitySource(row: Pick<GraphitiOpportunitySourceRow, 'source_objective' | 'raw_payload' | 'source_run_id'>): boolean {
  const rawPayload = row.raw_payload && typeof row.raw_payload === 'object'
    ? row.raw_payload as Record<string, unknown>
    : {}

  return [
    row.source_objective,
    row.source_run_id,
    rawPayload.source,
    rawPayload.source_objective,
    rawPayload.origin,
    rawPayload.source_run_id,
    rawPayload.fixture,
    rawPayload.dossier_path,
  ].some(hasLegacyMarker)
}

function isLegacyOrDemoPersistedOpportunity(row: Pick<PersistedGraphitiOpportunityRow, 'source_objective' | 'raw_payload' | 'source_run_id'>): boolean {
  return isLegacyOrDemoOpportunitySource({
    source_objective: row.source_objective,
    source_run_id: row.source_run_id,
    raw_payload: row.raw_payload,
  })
}

function toRecord(row: PersistedGraphitiOpportunityRow): GraphitiOpportunityCard {
  return {
    id: row.opportunity_id,
    title: row.title,
    organization: row.organization,
    description: row.why_this_is_an_opportunity || row.summary || row.why_it_matters || row.suggested_action || '',
    why_this_is_an_opportunity: row.why_this_is_an_opportunity || row.summary || row.why_it_matters || '',
    yellow_panther_fit_feedback: row.yellow_panther_fit_feedback || '',
    next_steps: Array.isArray(row.next_steps) ? row.next_steps : [],
    supporting_signals: Array.isArray(row.supporting_signals) ? row.supporting_signals : [],
    read_more_context: row.read_more_context || '',
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
    metadata: row.raw_payload || {},
    source_url: row.source_url,
    tags: Array.isArray(row.tags) ? row.tags : [],
    detected_at: row.detected_at,
    status: row.status,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    relationships: Array.isArray(row.relationships) ? row.relationships : [],
  }
}

function toPersistedOpportunityRow(
  row: ReturnType<typeof materializeGraphitiOpportunity>,
  nowIso: string,
): PersistedGraphitiOpportunityRow {
  return {
    opportunity_id: row.opportunity_id,
    insight_id: row.insight_id,
    entity_id: row.entity_id,
    entity_name: row.entity_name,
    entity_type: row.entity_type,
    canonical_entity_id: row.canonical_entity_id || null,
    canonical_entity_name: row.canonical_entity_name || null,
    organization: row.organization,
    title: row.title,
    summary: row.summary,
    why_it_matters: row.why_it_matters,
    suggested_action: row.suggested_action,
    why_this_is_an_opportunity: row.why_this_is_an_opportunity,
    yellow_panther_fit_feedback: row.yellow_panther_fit_feedback,
    next_steps: row.next_steps || [],
    supporting_signals: row.supporting_signals || [],
    read_more_context: row.read_more_context,
    confidence: row.confidence,
    confidence_score: row.confidence_score,
    priority: row.priority,
    priority_score: row.priority_score,
    yellow_panther_fit: row.yellow_panther_fit,
    category: row.category,
    status: row.status,
    location: row.location || null,
    value: row.value || null,
    deadline: row.deadline || null,
    sport: row.sport,
    competition: row.competition,
    entity_role: row.entity_role,
    opportunity_kind: row.opportunity_kind,
    theme: row.theme,
    taxonomy: row.taxonomy || {},
    source_url: row.source_url,
    tags: row.tags || [],
    evidence: row.evidence || [],
    relationships: row.relationships || [],
    source_run_id: row.source_run_id || null,
    source_signal_id: row.source_signal_id || null,
    source_episode_id: row.source_episode_id || null,
    source_objective: row.source_objective || null,
    detected_at: row.detected_at,
    materialized_at: nowIso,
    last_seen_at: nowIso,
    state_hash: row.state_hash,
    is_active: row.is_active,
    raw_payload: row.raw_payload || {},
    updated_at: nowIso,
  } as PersistedGraphitiOpportunityRow & { updated_at: string }
}

function buildDossierOpportunitySource(
  normalized: any,
  source: {
    source: 'entity_dossiers' | 'question_first_dossier'
    sourcePath?: string | null
    fallbackEntityId?: string
    fallbackEntityName?: string | null
    canonicalEntityId?: string | null
    createdAt?: string | null
    generatedAt?: string | null
  },
): GraphitiOpportunitySourceRow | null {
  const discoverySummary = normalized?.question_first?.discovery_summary || {}
  const graphiti = discoverySummary?.graphiti_sales_brief || {}
  const qualityState = String(normalized?.quality_state || '').toLowerCase()
  if (!['partial', 'blocked', 'complete', 'client_ready'].includes(qualityState)) {
    return null
  }

  const entityId = String(
    source.canonicalEntityId
      || normalized?.canonical_entity_id
      || normalized?.entity_id
      || source.fallbackEntityId
      || '',
  ).trim()
  const entityName = String(
    normalized?.entity_name
      || source.fallbackEntityName
      || normalized?.canonical_entity_name
      || entityId,
  ).trim()
  if (!entityId || !entityName) return null

  const confidence = Number(
    discoverySummary?.yellow_panther_opportunity?.estimated_probability
      ?? graphiti?.estimated_probability
      ?? graphiti?.win_probability
      ?? 0,
  )
  const serviceFit = Array.isArray(discoverySummary?.yellow_panther_opportunity?.service_fit)
    ? discoverySummary.yellow_panther_opportunity.service_fit
    : []
  if (!hasUsefulDossierOpportunitySignal(normalized, discoverySummary, graphiti, serviceFit)) {
    return null
  }
  const title = String(graphiti?.outreach_angle || discoverySummary?.summary || `${entityName} has a dossier-backed opportunity signal`).trim()
  const summary = String(
    graphiti?.outreach_angle
      || graphiti?.capability_gap
      || discoverySummary?.summary
      || '',
  ).trim()
  const suggestedAction = String(
    graphiti?.outreach_route
      || graphiti?.outreach_target
      || graphiti?.best_path_owner
      || 'Open the canonical dossier and review the buyer hypothesis.',
  ).trim()
  const whyItMatters = String(
    graphiti?.capability_gap
      || discoverySummary?.quality_summary
    || 'This dossier surfaced a qualified Yellow Panther fit signal.',
  ).trim()
  if ([title, summary, suggestedAction, whyItMatters].some(isFailedOnlyText)) {
    return null
  }
  const confidenceScore = Number.isFinite(confidence)
    ? Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence))
    : 0
  const generatedAt = toIso(
    normalized?.question_first?.generated_at
      || normalized?.metadata?.question_first?.generated_at
      || source.generatedAt
      || source.createdAt
      || new Date().toISOString(),
  )

  return {
    insight_id: `dossier-opportunity:${entityId}`,
    entity_id: entityId,
    entity_name: entityName,
    entity_type: String(normalized?.entity_type || 'Entity'),
    insight_type: 'opportunity',
    title,
    summary,
    why_it_matters: whyItMatters,
    suggested_action: suggestedAction,
    confidence: confidenceScore,
    freshness: normalized?.quality_state === 'client_ready' ? 'new' : 'recent',
    evidence: [],
    relationships: [],
    priority: confidenceScore >= 0.8 || serviceFit.length > 0 ? 'high' : confidenceScore >= 0.5 ? 'medium' : 'low',
    destination_url: `/entity-browser/${encodeURIComponent(entityId)}/dossier?from=1`,
    detected_at: generatedAt,
    materialized_at: generatedAt,
    source_run_id: String(normalized?.question_first?.run_id || normalized?.metadata?.question_first?.run_id || ''),
    source_signal_id: undefined,
    source_episode_id: undefined,
    source_objective: String(graphiti?.outreach_angle || discoverySummary?.summary || ''),
    raw_payload: {
      source: source.source,
      dossier_path: source.sourcePath || null,
      canonical_entity_id: source.canonicalEntityId || normalized?.canonical_entity_id || null,
      quality_state: normalized?.quality_state,
      client_ready: discoverySummary?.client_ready === true,
      graphiti_sales_brief: graphiti,
      yellow_panther_opportunity: discoverySummary?.yellow_panther_opportunity,
      decision_owners: discoverySummary?.decision_owners || [],
      service_fit: serviceFit,
      best_path_owner: graphiti?.best_path_owner || null,
      outreach_route: graphiti?.outreach_route || graphiti?.outreach_target || null,
      capability_gap: graphiti?.capability_gap || null,
    },
  }
}

async function loadPersistedDossierOpportunitySources(limit: number): Promise<GraphitiOpportunitySourceRow[]> {
  const response = await queryPostgres(
    `
      select distinct on (i.canonical_entity_id)
        i.id as source_ledger_id,
        i.quality_state,
        i.answer_count,
        i.evidence_count,
        i.reference_time,
        i.episode_body,
        d.entity_id,
        d.canonical_entity_id,
        d.entity_name,
        d.entity_type,
        d.created_at,
        d.generated_at,
        d.dossier_data
      from graphiti_dossier_ingestions i
      join entity_dossiers d on d.id = i.dossier_id
      where i.status = 'ingested'
        and d.canonical_entity_id is not null
        and d.dossier_data is not null
      order by i.canonical_entity_id, i.updated_at desc
      limit $1
    `,
    [Math.max(limit * 4, 100)],
  )

  const rows = Array.isArray(response.rows) ? response.rows as EntityDossierOpportunityRow[] : []
  const seen = new Set<string>()
  const sourceRows: GraphitiOpportunitySourceRow[] = []

  for (const row of rows) {
    if (!row.dossier_data || typeof row.dossier_data !== 'object') continue

    const fallbackEntityId = String(row.canonical_entity_id || row.entity_id || '').trim()
    const normalized = normalizeQuestionFirstDossier(row.dossier_data, fallbackEntityId || String(row.entity_id || ''))
    const sourceRow = buildDossierOpportunitySource(normalized, {
      source: 'entity_dossiers',
      fallbackEntityId,
      fallbackEntityName: row.entity_name || null,
      canonicalEntityId: row.canonical_entity_id || null,
      createdAt: row.created_at || null,
      generatedAt: row.generated_at || null,
    }) || buildDossierOpportunitySourceFromLedgerEpisode(row, normalized, fallbackEntityId)

    if (!sourceRow) continue
    sourceRow.raw_payload = {
      ...(sourceRow.raw_payload || {}),
      source: 'entity_dossiers',
      source_ledger_id: row.source_ledger_id,
      quality_state: row.quality_state || sourceRow.raw_payload?.quality_state || null,
      answer_count: row.answer_count || sourceRow.raw_payload?.answer_count || 0,
      evidence_count: row.evidence_count || sourceRow.raw_payload?.evidence_count || 0,
      reference_time: row.reference_time || sourceRow.raw_payload?.reference_time || null,
      episode_body: row.episode_body,
    }
    const key = [sourceRow.entity_id, sourceRow.entity_name].join('|').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    sourceRows.push(sourceRow)
  }

  return sourceRows
}

function isStale(lastSeenAt: string | null | undefined) {
  if (!lastSeenAt) return true
  const timestamp = Date.parse(lastSeenAt)
  if (!Number.isFinite(timestamp)) return true
  const staleWindowMs = getGraphitiStaleWindowHours() * 60 * 60 * 1000
  return Date.now() - timestamp > staleWindowMs
}

async function loadSourceOpportunities(limit: number) {
  const persistedDossierRows = await loadPersistedDossierOpportunitySources(limit)
  const seen = new Set<string>()
  return persistedDossierRows.filter((row) => {
    const key = [row.entity_id, row.title.toLowerCase()].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function loadGraphitiOpportunitySourceRows(limit = 100) {
  return loadSourceOpportunities(limit)
}

export async function deactivateFailedOnlyDossierOpportunities(nowIso = new Date().toISOString()) {
  // Equivalent Supabase filter intent: raw_payload->>source = entity_dossiers, title.ilike('Question execution failed before a safe answer could be produced%')
  const result = await queryPostgres(
    `
      update graphiti_materialized_opportunities
      set is_active = false,
          updated_at = $1::timestamptz,
          raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object(
            'failed_only_dossier_opportunities_deactivated',
            true
          )
      where is_active = true
        and raw_payload->>'source' = 'entity_dossiers'
        and title ilike 'Question execution failed before a safe answer could be produced%'
      returning opportunity_id
    `,
    [nowIso],
  )
  return {
    failed_only_dossier_opportunities_deactivated: result.rowCount || 0,
  }
}

export async function loadPersistedGraphitiOpportunities(limit = 25) {
  const supabase = getSupabaseAdmin()
  const warnings: string[] = []
  const response = await supabase
    .from('graphiti_materialized_opportunities')
    .select(PERSISTED_COLUMNS)
    .eq('is_active', true)
    .order('last_seen_at', { ascending: false })
    .limit(Math.max(limit, 25))

  if (response.error) {
    warnings.push(`Persisted Graphiti opportunities query failed: ${response.error.message}`)
    return {
      opportunities: [] as GraphitiOpportunityCard[],
      lastUpdatedAt: new Date().toISOString(),
      warnings,
      source: 'graphiti_opportunities' as const,
      status: 'empty' as const,
    }
  }

  const rows = Array.isArray(response.data) ? (response.data as PersistedGraphitiOpportunityRow[]) : []
  const activeRows = rows.filter((row) => !isLegacyOrDemoPersistedOpportunity(row))
  const opportunities = rankGraphitiOpportunities(activeRows.map(toRecord)).slice(0, limit)
  const lastUpdatedAt = rows[0]?.last_seen_at || rows[0]?.materialized_at || new Date().toISOString()
  const stale = isStale(rows[0]?.last_seen_at || rows[0]?.materialized_at)

  return {
    opportunities,
    lastUpdatedAt,
    warnings,
    source: 'graphiti_opportunities' as const,
    status: opportunities.length === 0 ? 'empty' as const : stale ? 'degraded' as const : 'ready' as const,
  }
}

export async function loadGraphitiOpportunities(limit = 25): Promise<GraphitiOpportunityResponse> {
  const persisted = await loadPersistedGraphitiOpportunities(limit)
  return {
    source: 'graphiti_opportunities',
    status: persisted.status,
    generated_at: new Date().toISOString(),
    last_updated_at: persisted.lastUpdatedAt,
    opportunities: persisted.opportunities.slice(0, limit),
    snapshot: {
      opportunities_scanned: persisted.opportunities.length,
      opportunities_materialized: persisted.opportunities.length,
      active_opportunities: persisted.opportunities.length,
      freshness_window_hours: getGraphitiStaleWindowHours(),
    },
    warnings: persisted.warnings,
  }
}

export async function materializeGraphitiOpportunities(limit = 100) {
  const supabase = getSupabaseAdmin()
  const warnings: string[] = []
  const nowIso = new Date().toISOString()
  const sourceRows = await loadSourceOpportunities(limit)
  const canonicalEntities = await getCanonicalEntitiesSnapshot().catch(() => [])
  const materialized = sourceRows.map((row) => materializeGraphitiOpportunity(row, canonicalEntities))
  const uniqueByOpportunityId = new Map<string, typeof materialized[number]>()

  for (const opportunity of materialized) {
    if (!uniqueByOpportunityId.has(opportunity.opportunity_id)) {
      uniqueByOpportunityId.set(opportunity.opportunity_id, opportunity)
    }
  }

  const opportunityRows = Array.from(uniqueByOpportunityId.values())
  const shortlistOpportunityRows = opportunityRows.filter((row) => (
    row.is_active
    && row.raw_payload?.shortlist_opportunity === true
    && !isFailedOnlyText(row.title)
  ))
  const persistableOpportunityRows = opportunityRows.filter((row) => !isFailedOnlyText(row.title))
  const sourceIds: string[] = shortlistOpportunityRows.map((row) => row.opportunity_id)
  const persistedSourceIds: string[] = persistableOpportunityRows.map((row) => row.opportunity_id)
  const existingResponse = persistedSourceIds.length > 0
    ? await supabase
      .from('graphiti_materialized_opportunities')
      .select('opportunity_id, state_hash, is_active')
      .in('opportunity_id', persistedSourceIds)
    : { data: [], error: null }

  if (existingResponse.error) {
    throw new Error(`Failed to load existing Graphiti opportunities: ${existingResponse.error.message}`)
  }

  const existingMap = new Map<string, { state_hash: string; is_active: boolean }>(
    (Array.isArray(existingResponse.data) ? existingResponse.data : []).map((row: any) => [
      String(row.opportunity_id),
      {
        state_hash: String(row.state_hash || ''),
        is_active: Boolean(row.is_active),
      },
    ]),
  )

  const persistedRows = persistableOpportunityRows
    .map((row) => toPersistedOpportunityRow(row, nowIso))

  if (persistedRows.length > 0) {
    const upsertResponse = await supabase
      .from('graphiti_materialized_opportunities')
      .upsert(persistedRows, { onConflict: 'opportunity_id' })

    if (upsertResponse.error) {
      throw new Error(`Failed to upsert Graphiti opportunities: ${upsertResponse.error.message}`)
    }
  }

  const activeResponse = await supabase
    .from('graphiti_materialized_opportunities')
    .select('opportunity_id')
    .eq('is_active', true)

  if (activeResponse.error) {
    warnings.push(`Failed to inspect active Graphiti opportunities: ${activeResponse.error.message}`)
  } else {
    const activeIds = (Array.isArray(activeResponse.data) ? activeResponse.data : [])
      .map((row: any) => String(row.opportunity_id))
      .filter(Boolean)
    const unseenActiveIds = activeIds.filter((opportunityId: string) => !sourceIds.includes(opportunityId))

    if (unseenActiveIds.length > 0) {
      const deactivateResponse = await supabase
        .from('graphiti_materialized_opportunities')
        .update({ is_active: false, updated_at: nowIso })
        .in('opportunity_id', unseenActiveIds)

      if (deactivateResponse.error) {
        warnings.push(`Failed to deactivate unseen Graphiti opportunities: ${deactivateResponse.error.message}`)
      }
    }
  }

  const cleanup = await deactivateFailedOnlyDossierOpportunities(nowIso).catch((error) => {
    warnings.push(`Failed to deactivate failed-only dossier opportunities: ${error instanceof Error ? error.message : String(error)}`)
    return { failed_only_dossier_opportunities_deactivated: 0 }
  })

  const changedRows = persistedRows.filter((row) => {
    const existing = existingMap.get(row.opportunity_id)
    return !existing || !existing.is_active || existing.state_hash !== row.state_hash
  })

  return {
    opportunities: rankGraphitiOpportunities(persistedRows.map(toRecord)),
    lastUpdatedAt: persistedRows[0]?.last_seen_at || nowIso,
    warnings,
    stats: {
      source_count: sourceRows.length,
      watch_item_count: opportunityRows.filter((row) => row.raw_payload?.watch_item === true).length,
      not_promoted_count: opportunityRows.length - shortlistOpportunityRows.length,
      upserted_count: persistedRows.length,
      changed_count: changedRows.length,
      failed_only_dossier_opportunities_deactivated: cleanup.failed_only_dossier_opportunities_deactivated,
    },
  }
}
