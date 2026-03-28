import { getSupabaseAdmin } from '@/lib/supabase-client'
import { getGraphitiStaleWindowHours } from '@/lib/runtime-env'
import type {
  GraphitiOpportunityCard,
  GraphitiOpportunityResponse,
} from '@/lib/graphiti-opportunity-contract'
import { rankGraphitiOpportunities } from '@/lib/graphiti-opportunity-materializer'

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

function isDemoOriginOpportunityRow(row: Pick<PersistedGraphitiOpportunityRow, 'source_objective' | 'raw_payload'>) {
  const sourceObjective = String(row.source_objective || '').trim().toLowerCase()
  const rawPayload = row.raw_payload && typeof row.raw_payload === 'object'
    ? row.raw_payload as Record<string, unknown>
    : {}
  const rawSource = String(rawPayload.source || '').trim().toLowerCase()

  return sourceObjective === 'client_demo_seed' || rawSource === 'demo_fallback_materialization'
}

function isGenericOpportunityText(value: string) {
  const text = String(value || '').trim().toLowerCase()
  return (
    !text
    || /validated a .* trigger/.test(text)
    || /qualified yellow panther fit signal/.test(text)
    || /open the canonical dossier and review the buyer hypothesis/.test(text)
    || /review question first evidence and prepare outreach/.test(text)
  )
}

function firstSentence(value: string) {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  if (!text) return ''
  return text.split(/(?<=[.!?])\s+/)[0].trim()
}

function synthesizeOpportunityNarrative(row: PersistedGraphitiOpportunityRow) {
  const summary = firstSentence(row.summary || '')
  const contextBits = [
    row.entity_name,
    row.opportunity_kind || row.category,
    row.competition,
    row.sport,
  ]
    .map((value) => String(value || '').trim())
    .filter((value) => value && !['other', 'unknown', 'n/a', 'na'].includes(value.toLowerCase()))
  const context = contextBits.length > 0 ? contextBits.join(' · ') : row.entity_name || 'canonical dossier'
  const whyItMatters = `${context} points to a live opening rather than passive monitoring.${summary ? ` ${summary}` : ''}`.trim()
  const suggestedAction = row.read_more_context?.includes('Open the dossier')
    ? 'Open the dossier, confirm the buyer hypothesis, and draft targeted outreach around the confirmed opening.'
    : 'Open the dossier, confirm the buyer hypothesis, and act on the live opening.'

  return {
    whyItMatters,
    suggestedAction,
    description: summary || whyItMatters,
  }
}

function toRecord(row: PersistedGraphitiOpportunityRow): GraphitiOpportunityCard {
  const title = row.title
  const summary = row.summary
  const whyItMatters = row.why_it_matters
  const suggestedAction = row.suggested_action
  const synthesized = isGenericOpportunityText(whyItMatters) || isGenericOpportunityText(suggestedAction) || isGenericOpportunityText(row.why_this_is_an_opportunity || '')
    ? synthesizeOpportunityNarrative(row)
    : null
  const whyThisIsAnOpportunity = synthesized?.description || row.why_this_is_an_opportunity || summary || whyItMatters || suggestedAction
  const yellowPantherFitFeedback = row.yellow_panther_fit_feedback
  const nextSteps = Array.isArray(row.next_steps) ? row.next_steps : []
  const supportingSignals = Array.isArray(row.supporting_signals) ? row.supporting_signals : []
  const readMoreContext = row.read_more_context
  const displayNextSteps = synthesized
    ? [synthesized.suggestedAction, ...nextSteps.map((value) => String(value || '').trim()).filter(Boolean)]
    : nextSteps
  const displayTitle = synthesized ? `${row.organization}: live commercial opening` : title

  return {
    id: row.opportunity_id,
    title: displayTitle,
    organization: row.organization,
    description: synthesized?.description || whyThisIsAnOpportunity || summary || whyItMatters || suggestedAction || '',
    why_this_is_an_opportunity: synthesized?.whyItMatters || whyThisIsAnOpportunity || summary || whyItMatters || '',
    yellow_panther_fit_feedback: yellowPantherFitFeedback || '',
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
    metadata: row.raw_payload || {},
    source_url: row.source_url,
    tags: Array.isArray(row.tags) ? row.tags : [],
    detected_at: row.detected_at,
    status: row.status,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    relationships: Array.isArray(row.relationships) ? row.relationships : [],
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
    .limit(Math.max(limit, 25))

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
  const activeRows = rows.filter((row) => row.is_active === true && !isDemoOriginOpportunityRow(row))
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
