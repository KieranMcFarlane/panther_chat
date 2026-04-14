import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { getSupabaseAdmin } from '@/lib/supabase-client'
import { getGraphitiStaleWindowHours } from '@/lib/runtime-env'
import { materializeGraphitiOpportunity, rankGraphitiOpportunities } from '@/lib/graphiti-opportunity-materializer'
import type {
  GraphitiOpportunityCard,
  GraphitiOpportunityResponse,
  GraphitiOpportunitySourceRow,
} from '@/lib/graphiti-opportunity-contract'

const SOURCE_COLUMNS = [
  'insight_id',
  'entity_id',
  'entity_name',
  'entity_type',
  'insight_type',
  'title',
  'summary',
  'why_it_matters',
  'suggested_action',
  'confidence',
  'freshness',
  'evidence',
  'relationships',
  'priority',
  'destination_url',
  'detected_at',
  'materialized_at',
  'source_run_id',
  'source_signal_id',
  'source_episode_id',
  'source_objective',
  'raw_payload',
].join(', ')

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

function toIso(value: unknown, fallback = new Date().toISOString()) {
  const text = value === null || value === undefined ? '' : String(value).trim()
  if (!text) return fallback
  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function toRecord(row: PersistedGraphitiOpportunityRow): GraphitiOpportunityCard {
  return {
    id: row.opportunity_id,
    title: row.title,
    organization: row.organization,
    description: row.summary || row.why_it_matters || row.suggested_action || '',
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

function isCommercialOpportunityLanguage(value: string): boolean {
  return [
    'opportunity',
    'opening',
    'procurement',
    'commercial',
    'partnership',
    'deal',
    'rfp',
    'tender',
    'sales',
    'buying signal',
    'why now',
  ].some((term) => value.includes(term))
}

function isOpportunityCandidateSource(row: GraphitiOpportunitySourceRow): boolean {
  if (row.insight_type === 'opportunity') return true

  const confidence = Number(row.confidence || 0)
  const rawPayload = row.raw_payload && typeof row.raw_payload === 'object'
    ? row.raw_payload as Record<string, unknown>
    : {}
  const commercialLanguage = [
    toText(row.title).toLowerCase(),
    toText(row.summary).toLowerCase(),
    toText(row.why_it_matters).toLowerCase(),
    toText(row.suggested_action).toLowerCase(),
    toText(rawPayload.opportunity_kind).toLowerCase(),
    toText(rawPayload.category).toLowerCase(),
    toText(rawPayload.signal_basis).toLowerCase(),
  ].join(' ')

  if (confidence >= 0.85 && isCommercialOpportunityLanguage(commercialLanguage)) {
    return true
  }

  if (confidence >= 0.75 && (
    toText(row.why_it_matters).toLowerCase().includes('why now') ||
    toText(rawPayload.active_probability) === '1' ||
    Number(rawPayload.active_probability || 0) >= 0.8
  )) {
    return true
  }

  return row.priority === 'high'
}

function isStale(lastSeenAt: string | null | undefined) {
  if (!lastSeenAt) return true
  const timestamp = Date.parse(lastSeenAt)
  if (!Number.isFinite(timestamp)) return true
  const staleWindowMs = getGraphitiStaleWindowHours() * 60 * 60 * 1000
  return Date.now() - timestamp > staleWindowMs
}

async function loadSourceOpportunities(limit: number) {
  const supabase = getSupabaseAdmin()
  const response = await supabase
    .from('graphiti_materialized_insights')
    .select(SOURCE_COLUMNS)
    .order('last_seen_at', { ascending: false })
    .limit(Math.max(limit * 4, 100))

  if (response.error) {
    throw new Error(`Failed to load Graphiti source opportunities: ${response.error.message}`)
  }

  const rows = Array.isArray(response.data) ? (response.data as GraphitiOpportunitySourceRow[]) : []
  return rows.filter(isOpportunityCandidateSource)
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
  const opportunities = rankGraphitiOpportunities(rows.map(toRecord)).slice(0, limit)
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
  if (persisted.status === 'ready') {
    return {
      source: persisted.source,
      status: persisted.status,
      generated_at: new Date().toISOString(),
      last_updated_at: persisted.lastUpdatedAt,
      opportunities: persisted.opportunities,
      snapshot: {
        opportunities_scanned: persisted.opportunities.length,
        opportunities_materialized: persisted.opportunities.length,
        active_opportunities: persisted.opportunities.length,
        freshness_window_hours: getGraphitiStaleWindowHours(),
      },
      warnings: persisted.warnings,
    }
  }

  const sourceRows = await loadSourceOpportunities(limit)
  const canonicalEntities = await getCanonicalEntitiesSnapshot().catch(() => [])
  const opportunities = rankGraphitiOpportunities(
    sourceRows.map((row) => materializeGraphitiOpportunity(row, canonicalEntities)),
  ).slice(0, limit)

  if (opportunities.length > 0) {
    return {
      source: 'graphiti_pipeline',
      status: 'degraded',
      generated_at: new Date().toISOString(),
      last_updated_at: sourceRows[0]?.materialized_at || sourceRows[0]?.detected_at || new Date().toISOString(),
      opportunities,
      snapshot: {
        opportunities_scanned: sourceRows.length,
        opportunities_materialized: opportunities.length,
        active_opportunities: opportunities.length,
        freshness_window_hours: getGraphitiStaleWindowHours(),
      },
      warnings: [
        ...(persisted.warnings || []),
        'Dedicated Graphiti opportunities projection is empty; falling back to materialized Graphiti insights only.',
      ],
    }
  }

  if (persisted.opportunities.length > 0) {
    return {
      source: persisted.source,
      status: persisted.status,
      generated_at: new Date().toISOString(),
      last_updated_at: persisted.lastUpdatedAt,
      opportunities: persisted.opportunities,
      snapshot: {
        opportunities_scanned: persisted.opportunities.length,
        opportunities_materialized: persisted.opportunities.length,
        active_opportunities: persisted.opportunities.length,
        freshness_window_hours: getGraphitiStaleWindowHours(),
      },
      warnings: persisted.warnings,
    }
  }

  return {
    source: 'graphiti_opportunities',
    status: 'empty',
    generated_at: new Date().toISOString(),
    last_updated_at: persisted.lastUpdatedAt,
    opportunities: [],
    snapshot: {
      opportunities_scanned: 0,
      opportunities_materialized: 0,
      active_opportunities: 0,
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
  const sourceIds = opportunityRows.map((row) => row.opportunity_id)
  const existingResponse = sourceIds.length > 0
    ? await supabase
      .from('graphiti_materialized_opportunities')
      .select('opportunity_id, state_hash, is_active')
      .in('opportunity_id', sourceIds)
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

  const persistedRows = opportunityRows.map((row) => ({
    ...row,
    materialized_at: nowIso,
    last_seen_at: nowIso,
    updated_at: nowIso,
  }))

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
    const unseenActiveIds = activeIds.filter((opportunityId) => !sourceIds.includes(opportunityId))

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
      upserted_count: persistedRows.length,
      changed_count: changedRows.length,
    },
  }
}
