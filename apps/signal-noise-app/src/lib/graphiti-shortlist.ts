import { loadGraphitiInsightsWithPersistence } from '@/lib/graphiti-persistence'
import { loadGraphitiOpportunities } from '@/lib/graphiti-opportunity-loader'
import type { GraphitiOpportunityCard } from '@/lib/graphiti-opportunity-contract'
import type { HomeGraphitiInsight } from '@/lib/home-graphiti-contract'

export type GraphitiMixedShortlistKind = 'opportunity' | 'watch_item' | 'operational'

export type GraphitiMixedShortlistItem = {
  id: string
  kind: GraphitiMixedShortlistKind
  title: string
  entity_id: string
  entity_name: string
  entity_type: string
  summary: string
  why_it_matters: string
  suggested_action: string
  confidence: number
  priority: 'high' | 'medium' | 'low'
  freshness: HomeGraphitiInsight['freshness'] | 'new' | 'recent' | 'stale'
  source: 'graphiti_opportunity' | 'graphiti_insight'
  source_url: string
  destination_url: string
  detected_at: string
  last_updated_at: string
  evidence: HomeGraphitiInsight['evidence']
  relationships: HomeGraphitiInsight['relationships']
  tags: string[]
}

export type GraphitiMixedShortlistResponse = {
  source: 'graphiti_shortlist'
  status: 'ready' | 'degraded' | 'empty'
  generated_at: string
  last_updated_at: string
  shortlist: GraphitiMixedShortlistItem[]
  snapshot: {
    opportunities: number
    operational: number
    watch_items: number
    total: number
    freshness_window_hours: number
  }
  warnings?: string[]
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function normalizePriority(value: unknown, confidence: number): 'high' | 'medium' | 'low' {
  const text = toText(value).toLowerCase()
  if (text === 'high') return 'high'
  if (text === 'medium') return 'medium'
  if (text === 'low') return 'low'
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.6) return 'medium'
  return 'low'
}

export function normalizeConfidence(value: unknown): number {
  const raw = Number(value ?? 0)
  if (!Number.isFinite(raw)) return 0
  if (raw > 1) return Math.max(0, Math.min(1, raw / 100))
  return Math.max(0, Math.min(1, raw))
}

function isHighConvictionMixedInsight(insight: HomeGraphitiInsight): boolean {
  if (insight.insight_type === 'opportunity') return true
  if (insight.insight_type === 'watch_item') {
    return insight.priority === 'high' || insight.confidence >= 0.7
  }

  return insight.priority === 'high' || insight.confidence >= 0.8
}

function normalizeOpportunityCard(card: GraphitiOpportunityCard): GraphitiMixedShortlistItem {
  const confidence = normalizeConfidence(card.confidence)

  return {
    id: card.id,
    kind: 'opportunity',
    title: card.title,
    entity_id: card.canonical_entity_id || card.entity_id || card.id,
    entity_name: card.canonical_entity_name || card.organization || card.entity_name || 'Unknown organization',
    entity_type: card.entity_type || 'entity',
    summary: card.description,
    why_it_matters: card.description,
    suggested_action: card.description || 'Open the dossier and progress the strongest aligned opportunity.',
    confidence,
    priority: normalizePriority(card.priority, confidence),
    freshness: card.detected_at ? 'new' : 'recent',
    source: 'graphiti_opportunity',
    source_url: card.source_url || '/entity-browser',
    destination_url: card.source_url || '/entity-browser',
    detected_at: card.detected_at || new Date().toISOString(),
    last_updated_at: card.detected_at || new Date().toISOString(),
    evidence: Array.isArray(card.evidence) ? card.evidence : [],
    relationships: Array.isArray(card.relationships) ? card.relationships : [],
    tags: Array.isArray(card.tags) ? card.tags : [],
  }
}

function normalizeInsightCard(insight: HomeGraphitiInsight): GraphitiMixedShortlistItem {
  return {
    id: insight.insight_id,
    kind: insight.insight_type || 'watch_item',
    title: insight.title,
    entity_id: insight.entity_id,
    entity_name: insight.entity_name,
    entity_type: insight.entity_type,
    summary: insight.summary,
    why_it_matters: insight.why_it_matters,
    suggested_action: insight.suggested_action,
    confidence: insight.confidence,
    priority: insight.priority || normalizePriority(undefined, insight.confidence),
    freshness: insight.freshness,
    source: 'graphiti_insight',
    source_url: insight.destination_url || '/entity-browser',
    destination_url: insight.destination_url || '/entity-browser',
    detected_at: insight.detected_at,
    last_updated_at: insight.materialized_at || insight.detected_at,
    evidence: Array.isArray(insight.evidence) ? insight.evidence : [],
    relationships: Array.isArray(insight.relationships) ? insight.relationships : [],
    tags: [insight.insight_type || 'watch_item', insight.priority || ''].filter(Boolean),
  }
}

function rankShortlistItems(items: GraphitiMixedShortlistItem[]): GraphitiMixedShortlistItem[] {
  const kindWeight: Record<GraphitiMixedShortlistKind, number> = {
    opportunity: 3,
    watch_item: 2,
    operational: 1,
  }

  return [...items].sort((left, right) => {
    const kindDelta = kindWeight[right.kind] - kindWeight[left.kind]
    if (kindDelta !== 0) return kindDelta

    const confidenceDelta = right.confidence - left.confidence
    if (confidenceDelta !== 0) return confidenceDelta

    return (Date.parse(right.detected_at) || 0) - (Date.parse(left.detected_at) || 0)
  })
}

function dedupeShortlistItems(items: GraphitiMixedShortlistItem[]) {
  const seen = new Set<string>()
  const deduped: GraphitiMixedShortlistItem[] = []

  for (const item of items) {
    const key = [
      item.kind,
      item.entity_id,
      item.title.toLowerCase(),
    ].join('|')

    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }

  return deduped
}

export async function loadGraphitiMixedShortlist(limit = 6): Promise<GraphitiMixedShortlistResponse> {
  const warnings: string[] = []
  const [opportunityResponse, insightResponse] = await Promise.all([
    loadGraphitiOpportunities(limit),
    loadGraphitiInsightsWithPersistence(limit * 2, { clientFacingOnly: false }),
  ])

  const opportunityItems = opportunityResponse.opportunities.map(normalizeOpportunityCard)
  const insightItems = (insightResponse?.highlights || [])
    .filter(isHighConvictionMixedInsight)
    .map(normalizeInsightCard)

  const shortlist = rankShortlistItems(
    dedupeShortlistItems([...opportunityItems, ...insightItems]),
  ).slice(0, limit)

  warnings.push(...(opportunityResponse.warnings || []))
  if (insightResponse?.warnings) {
    warnings.push(...insightResponse.warnings)
  }

  const status = shortlist.length > 0
    ? warnings.length > 0 ? 'degraded' : 'ready'
    : 'empty'

  const operationalCount = shortlist.filter((item) => item.kind === 'operational').length
  const watchItemCount = shortlist.filter((item) => item.kind === 'watch_item').length
  const opportunityCount = shortlist.filter((item) => item.kind === 'opportunity').length

  return {
    source: 'graphiti_shortlist',
    status,
    generated_at: new Date().toISOString(),
    last_updated_at: shortlist[0]?.last_updated_at || new Date().toISOString(),
    shortlist,
    snapshot: {
      opportunities: opportunityCount,
      operational: operationalCount,
      watch_items: watchItemCount,
      total: shortlist.length,
      freshness_window_hours: 24,
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  }
}
