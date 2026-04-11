type GraphitiEntitySearchResult = {
  id?: string
  name?: string
  entity_type?: string
  type?: string
  created_at?: string
  properties?: {
    name?: string
    type?: string
  }
}

type WideRfpGraphitiEpisode = {
  action: 'add-episode'
  entity_id?: string | null
  entity_name?: string | null
  episode_type: string
  timestamp: string
  description?: string | null
  source?: string | null
  url?: string | null
  category?: string | null
  estimated_value?: string | null
  confidence_score?: number | null
  metadata?: Record<string, unknown>
}

export const GRAPH_INTELLIGENCE_API = process.env.GRAPH_INTELLIGENCE_API || 'http://localhost:8001'

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function normalizeGraphitiEntityName(candidate: GraphitiEntitySearchResult): string {
  return toText(candidate.name || candidate.properties?.name || candidate.id)
}

export async function searchGraphitiEntities(query: string, limit = 5): Promise<GraphitiEntitySearchResult[]> {
  const normalizedQuery = toText(query)
  if (!normalizedQuery) return []

  try {
    const response = await fetch(`${GRAPH_INTELLIGENCE_API}/search-entities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: normalizedQuery,
        limit,
      }),
    })

    const payload = await response.json().catch(() => null) as { success?: boolean; results?: GraphitiEntitySearchResult[] } | null
    if (!response.ok || !payload?.success || !Array.isArray(payload.results)) {
      return []
    }

    return payload.results
      .map((item) => ({
        ...item,
        name: normalizeGraphitiEntityName(item),
      }))
      .filter((item) => Boolean(item.name))
  } catch {
    return []
  }
}

export function buildGraphitiEpisodePayload(
  opportunity: {
    canonical_entity_id?: string | null
    canonical_entity_name?: string | null
    title?: string | null
    description?: string | null
    source_url?: string | null
    category?: string | null
    value?: string | null
    confidence?: number | null
    yellow_panther_fit?: number | null
  },
  batch: {
    run_id?: string | null
    generated_at?: string | null
    focus_area?: string | null
    lane_label?: string | null
    seed_query?: string | null
  },
): WideRfpGraphitiEpisode {
  return {
    action: 'add-episode',
    entity_id: opportunity.canonical_entity_id || null,
    entity_name: opportunity.canonical_entity_name || null,
    episode_type: 'RFP_DETECTED',
    timestamp: toText(batch.generated_at) || new Date().toISOString(),
    description: opportunity.description || opportunity.title || null,
    source: 'rfp-wide-research',
    url: opportunity.source_url || null,
    category: opportunity.category || batch.focus_area || null,
    estimated_value: opportunity.value || null,
    confidence_score: typeof opportunity.confidence === 'number' ? opportunity.confidence : null,
    metadata: {
      run_id: batch.run_id || null,
      focus_area: batch.focus_area || null,
      lane_label: batch.lane_label || null,
      seed_query: batch.seed_query || null,
      opportunity_title: opportunity.title || null,
      opportunity_fit_score: typeof opportunity.yellow_panther_fit === 'number' ? opportunity.yellow_panther_fit : null,
    },
  }
}

export async function syncWideRfpBatchToGraphiti(
  opportunities: Array<Parameters<typeof buildGraphitiEpisodePayload>[0]>,
  batch: Parameters<typeof buildGraphitiEpisodePayload>[1],
  baseUrl: string,
): Promise<{ attempted: number; synced: number; warnings: string[] }> {
  const warnings: string[] = []
  let synced = 0

  for (const opportunity of opportunities) {
    try {
      const response = await fetch(new URL('/api/graphiti', baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildGraphitiEpisodePayload(opportunity, batch)),
      })

      if (!response.ok) {
        warnings.push(`Graphiti sync failed for ${opportunity.canonical_entity_name || opportunity.title || 'opportunity'} (${response.status})`)
        continue
      }

      synced += 1
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Unknown Graphiti sync error')
    }
  }

  return {
    attempted: opportunities.length,
    synced,
    warnings,
  }
}
