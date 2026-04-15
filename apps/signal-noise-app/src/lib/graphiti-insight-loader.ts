import { getSupabaseAdmin } from "@/lib/supabase-client"
import { filterClientFacingGraphitiInsights, filterHighSignalGraphitiInsightRows } from "@/lib/home-graphiti-feed.mjs"
import { materializeGraphitiInsight, rankGraphitiInsights } from "@/lib/graphiti-insight-materializer"
import { loadGraphitiOpportunitiesFromDb } from "@/lib/graphiti-opportunity-read-model"
import type { GraphitiOpportunityCard } from "@/lib/graphiti-opportunity-contract"
import type { HomeGraphitiInsight } from "@/lib/home-graphiti-contract"
import { loadGraphitiInsightsWithPersistence } from "@/lib/graphiti-persistence"

const HOME_INSIGHT_COLUMNS = [
  "insight_id",
  "entity_id",
  "entity_name",
  "entity_type",
  "sport",
  "league",
  "title",
  "summary",
  "why_it_matters",
  "confidence",
  "freshness",
  "evidence",
  "relationships",
  "suggested_action",
  "detected_at",
  "source_run_id",
  "source_signal_id",
  "source_episode_id",
  "source_objective",
  "materialized_at",
  "updated_at",
  "raw_payload",
].join(", ")

function isDemoOriginInsightRow(row: Record<string, unknown>) {
  const rawPayload = row.raw_payload && typeof row.raw_payload === 'object'
    ? row.raw_payload as Record<string, unknown>
    : {}
  const sourceObjective = String(row.source_objective || rawPayload.source_objective || '').trim().toLowerCase()
  const rawSource = String(rawPayload.source || '').trim().toLowerCase()

  return sourceObjective === 'client_demo_seed' || rawSource === 'demo_fallback_materialization'
}

function normalizeOpportunityForHomeFeed(card: GraphitiOpportunityCard): HomeGraphitiInsight {
  const confidence = Number(card.confidence_score ?? card.confidence ?? 0)
  const detectedAt = String(card.detected_at || new Date().toISOString())
  const priority = card.priority === 'high' || card.priority === 'medium' || card.priority === 'low'
    ? card.priority
    : confidence >= 0.8
      ? 'high'
      : confidence >= 0.6
        ? 'medium'
        : 'low'

  return {
    insight_id: card.id,
    insight_type: 'opportunity',
    entity_id: String(card.canonical_entity_id || card.entity_id || card.id),
    entity_name: String(card.canonical_entity_name || card.organization || card.entity_name || 'Unknown organization'),
    entity_type: String(card.entity_type || 'entity'),
    sport: String(card.sport || 'unknown'),
    league: typeof card.competition === 'string' && card.competition.trim() ? card.competition : undefined,
    title: card.title,
    summary: card.description,
    why_it_matters: card.why_this_is_an_opportunity || card.description,
    confidence,
    freshness: card.detected_at ? 'new' : 'recent',
    evidence: Array.isArray(card.evidence) ? card.evidence : [],
    relationships: Array.isArray(card.relationships) ? card.relationships : [],
    suggested_action: Array.isArray(card.next_steps) && card.next_steps.length > 0
      ? card.next_steps[0]
      : card.description,
    priority,
    destination_url: card.source_url || undefined,
    detected_at: detectedAt,
    source_run_id: undefined,
    source_signal_id: undefined,
    source_episode_id: undefined,
    source_objective: undefined,
    materialized_at: detectedAt,
  }
}

export async function loadGraphitiInsights(limit = 25): Promise<{
  highlights: HomeGraphitiInsight[]
  lastUpdatedAt: string
  warnings: string[]
}> {
  const persisted = await loadGraphitiInsightsWithPersistence(limit, { clientFacingOnly: true })
  const supabase = getSupabaseAdmin()
  const warnings: string[] = [...persisted.warnings]
  const response = await supabase
    .from("homepage_graphiti_insights")
    .select(HOME_INSIGHT_COLUMNS)
    .order("materialized_at", { ascending: false })
    .limit(Math.max(limit, 25))

  if (response.error) {
    warnings.push(`Homepage insight query failed: ${response.error.message}`)
  }

  const rows = Array.isArray(response.data) ? response.data : []
  const filteredRows = filterHighSignalGraphitiInsightRows(
    rows.filter((row) => !isDemoOriginInsightRow(row as Record<string, unknown>)) as Record<string, unknown>[],
  )
  const seen = new Set<string>()
  const materialized: HomeGraphitiInsight[] = []

  for (const row of filteredRows) {
    const insight = materializeGraphitiInsight(row as Record<string, unknown>)
    if (!insight.insight_id || seen.has(insight.insight_id)) {
      continue
    }
    seen.add(insight.insight_id)
    materialized.push(insight)
  }

  const opportunitiesResponse = await loadGraphitiOpportunitiesFromDb(Math.max(limit, 25))
  warnings.push(...(opportunitiesResponse.warnings || []))

  // Prefer canonical opportunity cards when the same entity/title is present in both
  // the homepage insight lane and the opportunity projection.
  const combinedInsights = [
    ...opportunitiesResponse.opportunities.map(normalizeOpportunityForHomeFeed),
    ...persisted.highlights,
    ...materialized,
  ]
  const opportunityEntityIds = new Set(
    opportunitiesResponse.opportunities
      .map((card) => String(card.entity_id || '').trim().toLowerCase())
      .filter(Boolean),
  )
  const seenInsights = new Set<string>()
  const dedupedInsights = combinedInsights.filter((insight) => {
    const insightType = String(insight.insight_type || 'watch_item').trim().toLowerCase()
    if (
      insightType !== 'opportunity'
      && opportunityEntityIds.has(String(insight.entity_id || '').trim().toLowerCase())
    ) {
      return false
    }
    const key = [
      insightType === 'opportunity' ? 'opportunity' : insightType,
      String(insight.entity_id || '').trim().toLowerCase(),
      insightType === 'opportunity' ? '' : String(insight.title || '').trim().toLowerCase(),
    ].join('|')
    if (!insight.insight_id || seenInsights.has(key)) {
      return false
    }
    seenInsights.add(key)
    return true
  })

  const ranked = rankGraphitiInsights(filterClientFacingGraphitiInsights(dedupedInsights))
  if (ranked.length > 0) {
    return {
      highlights: ranked.slice(0, limit),
      lastUpdatedAt: ranked[0]?.materialized_at || ranked[0]?.detected_at || persisted.lastUpdatedAt || new Date().toISOString(),
      warnings,
    }
  }

  warnings.push("No persisted Graphiti insights are available yet")
  return {
    highlights: [],
    lastUpdatedAt: persisted.lastUpdatedAt || new Date().toISOString(),
    warnings,
  }
}
