import type { HomeGraphitiInsight } from '@/lib/home-graphiti-contract'
import { getEntityBrowserDossierHref } from '@/lib/entity-routing'

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeEvidence(value: unknown): HomeGraphitiInsight['evidence'] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      type: (typeof item.type === 'string' && (item.type === 'entity' || item.type === 'relationship' || item.type === 'rfp' || item.type === 'note'))
        ? item.type
        : 'episode',
      id: String(item.id || ''),
      snippet: String(item.snippet || ''),
      source: item.source ? String(item.source) : undefined,
    }))
    .filter((item) => item.id.length > 0)
}

function normalizeRelationships(value: unknown): HomeGraphitiInsight['relationships'] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      type: String(item.type || 'related_to'),
      target_id: String(item.target_id || item.id || ''),
      target_name: String(item.target_name || item.name || ''),
      direction: typeof item.direction === 'string' && (item.direction === 'inbound' || item.direction === 'outbound' || item.direction === 'bidirectional')
        ? item.direction
        : undefined,
    }))
    .filter((item) => item.target_id.length > 0 && item.target_name.length > 0)
}

function inferInsightType(row: Record<string, unknown>): HomeGraphitiInsight['insight_type'] {
  const rawPayload = row.raw_payload && typeof row.raw_payload === 'object'
    ? row.raw_payload as Record<string, unknown>
    : {}
  const title = readString(row.title).toLowerCase()
  const summary = readString(row.summary).toLowerCase()
  const whyItMatters = readString(row.why_it_matters).toLowerCase()
  const signalBasis = readString(rawPayload.signal_basis).toLowerCase()
  const salesReadiness = readString(rawPayload.sales_readiness).toUpperCase()

  if (
    title.includes('context refreshed') ||
    summary.includes('no validated signals remained') ||
    title.includes('rerun') ||
    title.includes('refresh') ||
    summary.includes('rerun') ||
    whyItMatters.includes('missing') ||
    signalBasis.includes('operational') ||
    salesReadiness === 'MONITOR'
  ) {
    return 'operational'
  }

  if (
    title.includes('opportunity') ||
    whyItMatters.includes('why now') ||
    signalBasis === 'sales_readiness' ||
    readNumber(rawPayload.active_probability) >= 0.8
  ) {
    return 'opportunity'
  }

  return 'watch_item'
}

function inferPriority(confidence: number, insightType: HomeGraphitiInsight['insight_type']): HomeGraphitiInsight['priority'] {
  if (insightType === 'opportunity' && confidence >= 0.75) return 'high'
  if (insightType === 'operational' || confidence >= 0.55) return 'medium'
  return 'low'
}

function freshnessWeight(freshness: HomeGraphitiInsight['freshness']): number {
  switch (freshness) {
    case 'new':
      return 3
    case 'recent':
      return 2
    default:
      return 1
  }
}

function actionabilityWeight(insightType: HomeGraphitiInsight['insight_type']): number {
  switch (insightType) {
    case 'opportunity':
      return 3
    case 'watch_item':
      return 2
    default:
      return 1
  }
}

export function materializeGraphitiInsight(row: Record<string, unknown>): HomeGraphitiInsight {
  const freshness = typeof row.freshness === 'string' && (row.freshness === 'new' || row.freshness === 'recent' || row.freshness === 'stale')
    ? row.freshness
    : 'recent'
  const insightType = inferInsightType(row)
  const confidence = readNumber(row.confidence || 0)
  const entityId = String(row.entity_id || '')
  const suggestedAction = readString(row.suggested_action)
  const fallbackSuggestedAction = insightType === 'operational'
    ? 'Review the dossier, inspect missing evidence, and rerun the account if a stronger signal is needed.'
    : insightType === 'opportunity'
      ? 'Open the dossier and convert the signal into a concrete sales next step.'
      : 'Keep the dossier current and monitor for a stronger trigger before escalating.'

  return {
    insight_id: String(row.insight_id || row.id || ''),
    insight_type: insightType,
    entity_id: entityId,
    entity_name: String(row.entity_name || ''),
    entity_type: String(row.entity_type || 'entity'),
    sport: String(row.sport || 'unknown'),
    league: row.league ? String(row.league) : undefined,
    title: String(row.title || ''),
    summary: String(row.summary || ''),
    why_it_matters: String(row.why_it_matters || ''),
    confidence,
    freshness,
    evidence: normalizeEvidence(row.evidence),
    relationships: normalizeRelationships(row.relationships),
    suggested_action: suggestedAction || fallbackSuggestedAction,
    priority: inferPriority(confidence, insightType),
    destination_url: entityId ? getEntityBrowserDossierHref(entityId, '1') || '/entity-browser' : '/entity-browser',
    detected_at: String(row.detected_at || row.materialized_at || new Date().toISOString()),
    source_run_id: row.source_run_id ? String(row.source_run_id) : undefined,
    source_signal_id: row.source_signal_id ? String(row.source_signal_id) : undefined,
    source_episode_id: row.source_episode_id ? String(row.source_episode_id) : undefined,
    source_objective: row.source_objective ? String(row.source_objective) : undefined,
    materialized_at: row.materialized_at ? String(row.materialized_at) : undefined,
  }
}

export function rankGraphitiInsights(insights: HomeGraphitiInsight[]): HomeGraphitiInsight[] {
  return [...insights].sort((left, right) => {
    const actionabilityDelta = actionabilityWeight(right.insight_type) - actionabilityWeight(left.insight_type)
    if (actionabilityDelta !== 0) return actionabilityDelta

    const confidenceDelta = right.confidence - left.confidence
    if (confidenceDelta !== 0) return confidenceDelta

    const freshnessDelta = freshnessWeight(right.freshness) - freshnessWeight(left.freshness)
    if (freshnessDelta !== 0) return freshnessDelta

    return (Date.parse(right.detected_at) || 0) - (Date.parse(left.detected_at) || 0)
  })
}

export function buildGraphitiNotificationPayload(insight: HomeGraphitiInsight) {
  return {
    insight_id: insight.insight_id,
    insight_type: insight.insight_type || 'watch_item',
    entity_id: insight.entity_id,
    title: insight.title,
    short_message: insight.summary,
    priority: insight.priority || 'medium',
    destination_url: insight.destination_url || getEntityBrowserDossierHref(insight.entity_id, '1') || '/entity-browser',
    created_at: insight.materialized_at || insight.detected_at,
    sent_state: 'pending',
    read_state: 'unread',
  }
}

export function buildSalesActionDigest(insights: HomeGraphitiInsight[]) {
  const ranked = rankGraphitiInsights(insights)
  const topOpportunities = ranked.filter((item) => item.insight_type === 'opportunity').slice(0, 5)
  const changedEntities = ranked.filter((item) => item.freshness === 'new').slice(0, 5)
  const needsAction = ranked.filter((item) => item.priority === 'high').slice(0, 5)
  const needsReview = ranked.filter((item) => item.insight_type === 'operational').slice(0, 5)

  return {
    generated_at: new Date().toISOString(),
    top_opportunities: topOpportunities,
    changed_since_yesterday: changedEntities,
    entities_needing_action: needsAction,
    entities_needing_review_or_rerun: needsReview,
  }
}
