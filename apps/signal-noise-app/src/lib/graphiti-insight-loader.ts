import { getSupabaseAdmin } from "@/lib/supabase-client"
import { filterHighSignalGraphitiInsightRows } from "@/lib/home-graphiti-feed.mjs"
import { getDemoGraphitiInsights } from "@/lib/graphiti-demo-insights"
import { materializeGraphitiInsight, rankGraphitiInsights } from "@/lib/graphiti-insight-materializer"
import type { HomeGraphitiInsight } from "@/lib/home-graphiti-contract"
import { loadGraphitiInsightsWithPersistence } from "@/lib/graphiti-persistence"
import { allowDemoFallbacks, isProductionRuntime } from "@/lib/runtime-env"

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

export async function loadGraphitiInsights(limit = 25): Promise<{
  highlights: HomeGraphitiInsight[]
  lastUpdatedAt: string
  warnings: string[]
}> {
  const persisted = await loadGraphitiInsightsWithPersistence(limit)
  if (persisted) {
    return persisted
  }

  const supabase = getSupabaseAdmin()
  const warnings: string[] = []
  const response = await supabase
    .from("homepage_graphiti_insights")
    .select(HOME_INSIGHT_COLUMNS)
    .order("materialized_at", { ascending: false })
    .limit(Math.max(limit, 25))

  if (response.error) {
    warnings.push(`Homepage insight query failed: ${response.error.message}`)
  }

  const rows = Array.isArray(response.data) ? response.data : []
  const filteredRows = filterHighSignalGraphitiInsightRows(rows as Record<string, unknown>[])
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

  const ranked = rankGraphitiInsights(materialized)
  if (ranked.length > 0) {
    return {
      highlights: ranked.slice(0, limit),
      lastUpdatedAt: ranked[0]?.materialized_at || ranked[0]?.detected_at || new Date().toISOString(),
      warnings,
    }
  }

  if (!allowDemoFallbacks() || isProductionRuntime()) {
    warnings.push("No persisted Graphiti insights are available yet")
    return {
      highlights: [],
      lastUpdatedAt: new Date().toISOString(),
      warnings,
    }
  }

  warnings.push("Using demo fallback insights because no persisted or raw materialized Graphiti records are available yet")
  const fallback = rankGraphitiInsights(getDemoGraphitiInsights()).slice(0, limit)

  return {
    highlights: fallback,
    lastUpdatedAt: fallback[0]?.materialized_at || fallback[0]?.detected_at || new Date().toISOString(),
    warnings,
  }
}
