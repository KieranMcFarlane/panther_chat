import { createHash } from 'node:crypto'

import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { getSupabaseAdmin } from '@/lib/supabase-client'
import { filterClientFacingGraphitiInsights, filterHighSignalGraphitiInsightRows } from '@/lib/home-graphiti-feed.mjs'
import type { HomeGraphitiInsight } from '@/lib/home-graphiti-contract'
import { buildGraphitiNotificationPayload, materializeGraphitiInsight, rankGraphitiInsights } from '@/lib/graphiti-insight-materializer'
import { resolvePinnedSmokeEntities } from '@/lib/entity-smoke-set'
import { resolveEntityUuid } from '@/lib/entity-public-id'
import { getGraphitiStaleWindowHours } from '@/lib/runtime-env'

const RAW_HOME_INSIGHT_COLUMNS = [
  'insight_id',
  'entity_id',
  'entity_name',
  'entity_type',
  'sport',
  'league',
  'title',
  'summary',
  'why_it_matters',
  'confidence',
  'freshness',
  'evidence',
  'relationships',
  'suggested_action',
  'detected_at',
  'source_run_id',
  'source_signal_id',
  'source_episode_id',
  'source_objective',
  'materialized_at',
  'updated_at',
  'raw_payload',
].join(', ')

const PERSISTED_INSIGHT_COLUMNS = [
  'insight_id',
  'entity_id',
  'entity_name',
  'entity_type',
  'title',
  'summary',
  'why_it_matters',
  'suggested_action',
  'confidence',
  'freshness',
  'insight_type',
  'priority',
  'destination_url',
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

type PersistedGraphitiInsightRow = {
  insight_id: string
  entity_id: string
  entity_name: string
  entity_type: string
  title: string
  summary: string
  why_it_matters: string
  suggested_action: string
  confidence: number
  freshness: HomeGraphitiInsight['freshness']
  insight_type: NonNullable<HomeGraphitiInsight['insight_type']>
  priority: NonNullable<HomeGraphitiInsight['priority']>
  destination_url: string
  evidence: HomeGraphitiInsight['evidence']
  relationships: HomeGraphitiInsight['relationships']
  source_run_id?: string | null
  source_signal_id?: string | null
  source_episode_id?: string | null
  source_objective?: string | null
  detected_at: string
  materialized_at?: string | null
  last_seen_at?: string | null
  state_hash: string
  is_active: boolean
  raw_payload?: Record<string, unknown> | null
}

type PersistedNotificationRow = {
  insight_id: string
  insight_type?: HomeGraphitiInsight['insight_type']
  entity_id: string
  title: string
  short_message: string
  priority: NonNullable<HomeGraphitiInsight['priority']>
  destination_url: string
  created_at: string
  sent_state?: string
  read_state?: string
  state_hash: string
}

function toIsoString(value: unknown, fallback = new Date().toISOString()) {
  const normalized = String(value || '').trim()
  if (!normalized) return fallback
  const timestamp = Date.parse(normalized)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback
}

function slugify(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function distinctRowsByEntity(rows: Record<string, unknown>[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const rawPayload = row.raw_payload && typeof row.raw_payload === 'object'
      ? row.raw_payload as Record<string, unknown>
      : {}
    const key = slugify(row.entity_id || row.entity_name || rawPayload.entity_id || rawPayload.entity_name || row.insight_id)
    if (!key || seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function isDemoOriginInsight(row: Pick<PersistedGraphitiInsightRow, 'source_objective' | 'raw_payload'>) {
  const sourceObjective = String(row.source_objective || '').trim().toLowerCase()
  const rawPayload = row.raw_payload && typeof row.raw_payload === 'object'
    ? row.raw_payload as Record<string, unknown>
    : {}
  const rawSource = String(rawPayload.source || '').trim().toLowerCase()

  return sourceObjective === 'client_demo_seed' || rawSource === 'demo_fallback_materialization'
}

function computeStateHash(insight: HomeGraphitiInsight) {
  return createHash('sha256')
    .update(JSON.stringify({
      title: insight.title,
      summary: insight.summary,
      why_it_matters: insight.why_it_matters,
      suggested_action: insight.suggested_action,
      confidence: insight.confidence,
      freshness: insight.freshness,
      insight_type: insight.insight_type,
      priority: insight.priority,
      destination_url: insight.destination_url,
      source_run_id: insight.source_run_id,
      source_signal_id: insight.source_signal_id,
      source_episode_id: insight.source_episode_id,
      source_objective: insight.source_objective,
    }))
    .digest('hex')
}

function deriveFreshness(
  insight: HomeGraphitiInsight,
  existing: Pick<PersistedGraphitiInsightRow, 'state_hash' | 'is_active'> | undefined,
  nowIso: string,
): HomeGraphitiInsight['freshness'] {
  const stateHash = computeStateHash(insight)
  if (!existing || !existing.is_active || existing.state_hash !== stateHash) {
    return 'new'
  }

  const staleWindowMs = getGraphitiStaleWindowHours() * 60 * 60 * 1000
  const referenceTime = Date.parse(insight.materialized_at || insight.detected_at || nowIso)
  if (Number.isFinite(referenceTime) && Date.now() - referenceTime > staleWindowMs) {
    return 'stale'
  }

  return 'recent'
}

function toPersistedInsight(
  insight: HomeGraphitiInsight,
  rawPayload: Record<string, unknown> | null,
  existing: Pick<PersistedGraphitiInsightRow, 'state_hash' | 'is_active'> | undefined,
  nowIso: string,
): PersistedGraphitiInsightRow {
  const freshness = deriveFreshness(insight, existing, nowIso)
  const normalized: HomeGraphitiInsight = {
    ...insight,
    freshness,
    materialized_at: nowIso,
  }

  return {
    insight_id: normalized.insight_id,
    entity_id: normalized.entity_id,
    entity_name: normalized.entity_name,
    entity_type: normalized.entity_type,
    title: normalized.title,
    summary: normalized.summary,
    why_it_matters: normalized.why_it_matters,
    suggested_action: normalized.suggested_action,
    confidence: normalized.confidence,
    freshness: normalized.freshness,
    insight_type: normalized.insight_type || 'watch_item',
    priority: normalized.priority || 'medium',
    destination_url: normalized.destination_url || `/entity-browser/${normalized.entity_id}/dossier?from=1`,
    evidence: normalized.evidence,
    relationships: normalized.relationships,
    source_run_id: normalized.source_run_id || null,
    source_signal_id: normalized.source_signal_id || null,
    source_episode_id: normalized.source_episode_id || null,
    source_objective: normalized.source_objective || null,
    detected_at: toIsoString(normalized.detected_at, nowIso),
    materialized_at: nowIso,
    last_seen_at: nowIso,
    state_hash: computeStateHash(normalized),
    is_active: true,
    raw_payload: rawPayload,
  }
}

function fromPersistedInsight(row: PersistedGraphitiInsightRow): HomeGraphitiInsight {
  return {
    insight_id: row.insight_id,
    insight_type: row.insight_type,
    entity_id: row.entity_id,
    entity_name: row.entity_name,
    entity_type: row.entity_type,
    sport: typeof row.raw_payload?.sport === 'string' ? row.raw_payload.sport : 'unknown',
    league: typeof row.raw_payload?.league === 'string' ? row.raw_payload.league : undefined,
    title: row.title,
    summary: row.summary,
    why_it_matters: row.why_it_matters,
    confidence: Number(row.confidence || 0),
    freshness: row.freshness,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    relationships: Array.isArray(row.relationships) ? row.relationships : [],
    suggested_action: row.suggested_action,
    priority: row.priority,
    destination_url: row.destination_url,
    detected_at: toIsoString(row.detected_at),
    source_run_id: row.source_run_id || undefined,
    source_signal_id: row.source_signal_id || undefined,
    source_episode_id: row.source_episode_id || undefined,
    source_objective: row.source_objective || undefined,
    materialized_at: row.materialized_at || undefined,
  }
}

async function resolveCanonicalGraphitiInsight(insight: HomeGraphitiInsight, raw: Record<string, unknown>) {
  const rawPayload = raw.raw_payload && typeof raw.raw_payload === 'object'
    ? raw.raw_payload as Record<string, unknown>
    : {}
  const candidateNames = [
    insight.entity_name,
    raw.entity_name,
    rawPayload.entity_name,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  const candidateSlugs = new Set([
    insight.entity_id,
    raw.entity_id,
    rawPayload.entity_id,
    ...candidateNames,
  ].map(slugify).filter(Boolean))

  const pinnedSmokeEntities = await resolvePinnedSmokeEntities()
  const pinnedMatch = pinnedSmokeEntities.find(({ definition, entity }) => {
    const pinnedSlugs = new Set([
      definition.display_name,
      ...(definition.aliases ?? []),
      entity.properties?.name,
      definition.entity_uuid,
    ].map(slugify).filter(Boolean))

    return candidateNames.some((name) => pinnedSlugs.has(slugify(name))) ||
      Array.from(candidateSlugs).some((slug) => {
        if (pinnedSlugs.has(slug)) return true
        return Array.from(pinnedSlugs).some((pinnedSlug) => pinnedSlug.includes(slug) || slug.includes(pinnedSlug))
      })
  })

  if (pinnedMatch) {
    return {
      ...insight,
      entity_id: pinnedMatch.entityId,
      entity_name: String(pinnedMatch.entity.properties?.name || insight.entity_name),
      entity_type: String(pinnedMatch.entity.properties?.type || insight.entity_type),
      sport: String(pinnedMatch.entity.properties?.sport || insight.sport || 'unknown'),
      league: String(pinnedMatch.entity.properties?.league || insight.league || '').trim() || undefined,
      destination_url: `/entity-browser/${pinnedMatch.entityId}/dossier?from=1`,
    }
  }

  const canonicalEntities = await getCanonicalEntitiesSnapshot()

  const match = canonicalEntities.find((entity) => {
    const entityUuid = resolveEntityUuid(entity)
    const entityName = String(entity.properties?.name || '').trim()
    const entitySlug = slugify(entityName)
    return (
      (entityUuid && candidateSlugs.has(entityUuid)) ||
      candidateSlugs.has(String(entity.id || '').trim().toLowerCase()) ||
      candidateSlugs.has(String(entity.neo4j_id || '').trim().toLowerCase()) ||
      candidateNames.some((name) => name.toLowerCase() === entityName.toLowerCase()) ||
      candidateSlugs.has(entitySlug)
    )
  })

  if (!match) {
    return insight
  }

  const entityId = resolveEntityUuid(match) || String(match.id)
  return {
    ...insight,
    entity_id: entityId,
    entity_name: String(match.properties?.name || insight.entity_name),
    entity_type: String(match.properties?.type || insight.entity_type),
    sport: String(match.properties?.sport || insight.sport || 'unknown'),
    league: String(match.properties?.league || insight.league || '').trim() || undefined,
    destination_url: `/entity-browser/${entityId}/dossier?from=1`,
  }
}

export async function loadPersistedGraphitiInsights(limit = 25, options?: { clientFacingOnly?: boolean }) {
  const supabase = getSupabaseAdmin()
  const warnings: string[] = []
  const response = await supabase
    .from('graphiti_materialized_insights')
    .select(PERSISTED_INSIGHT_COLUMNS)
    .eq('is_active', true)
    .order('last_seen_at', { ascending: false })
    .limit(Math.max(limit, 25))

  if (response.error) {
    warnings.push(`Persisted Graphiti query failed: ${response.error.message}`)
    return { highlights: [] as HomeGraphitiInsight[], lastUpdatedAt: new Date().toISOString(), warnings }
  }

  const rows = Array.isArray(response.data)
    ? (response.data as PersistedGraphitiInsightRow[]).filter((row) => !isDemoOriginInsight(row))
    : []
  const materializedInsights = rows.map(fromPersistedInsight)
  const highlights = rankGraphitiInsights(
    options?.clientFacingOnly
      ? filterClientFacingGraphitiInsights(materializedInsights)
      : materializedInsights,
  ).slice(0, limit)

  return {
    highlights,
    lastUpdatedAt: rows[0]?.last_seen_at || rows[0]?.materialized_at || new Date().toISOString(),
    warnings,
  }
}

export async function loadPersistedGraphitiNotifications(limit = 25) {
  const supabase = getSupabaseAdmin()
  const activeResponse = await supabase
    .from('graphiti_materialized_insights')
    .select('insight_id')
    .eq('is_active', true)

  if (activeResponse.error) {
    throw new Error(`Failed to load active materialized insights for notifications: ${activeResponse.error.message}`)
  }

  const activeInsightIds = (Array.isArray(activeResponse.data) ? activeResponse.data : [])
    .map((row: any) => String(row.insight_id || ''))
    .filter(Boolean)

  if (activeInsightIds.length === 0) {
    return []
  }

  const response = await supabase
    .from('graphiti_notifications')
    .select('insight_id, insight_type, entity_id, title, short_message, priority, destination_url, created_at, sent_state, read_state, state_hash')
    .in('insight_id', activeInsightIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (response.error) {
    throw new Error(`Failed to load persisted notifications: ${response.error.message}`)
  }

  const rows = (Array.isArray(response.data) ? response.data : []) as PersistedNotificationRow[]
  const deduped = new Map<string, PersistedNotificationRow>()

  for (const row of rows) {
    if (!deduped.has(row.insight_id)) {
      deduped.set(row.insight_id, row)
    }
  }

  return Array.from(deduped.values()).slice(0, limit)
}

export async function markGraphitiNotificationsRead(insightIds?: string[]) {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('graphiti_notifications')
    .update({ read_state: 'read', read_at: new Date().toISOString() })
    .eq('read_state', 'unread')

  if (Array.isArray(insightIds) && insightIds.length > 0) {
    query = query.in('insight_id', insightIds)
  }

  const response = await query
  if (response.error) {
    throw new Error(`Failed to mark Graphiti notifications as read: ${response.error.message}`)
  }
}

export async function markGraphitiNotificationsSent(insightIds: string[]) {
  if (insightIds.length === 0) return

  const supabase = getSupabaseAdmin()
  const response = await supabase
    .from('graphiti_notifications')
    .update({ sent_state: 'sent', sent_at: new Date().toISOString() })
    .in('insight_id', insightIds)
    .eq('sent_state', 'pending')

  if (response.error) {
    throw new Error(`Failed to mark Graphiti notifications as sent: ${response.error.message}`)
  }
}

export async function materializeGraphitiInsights(limit = 100) {
  const supabase = getSupabaseAdmin()
  const warnings: string[] = []
  const nowIso = new Date().toISOString()
  const sourceResponse = await supabase
    .from('homepage_graphiti_insights')
    .select(RAW_HOME_INSIGHT_COLUMNS)
    .order('materialized_at', { ascending: false })
    .limit(Math.max(limit, 25))

  if (sourceResponse.error) {
    throw new Error(`Homepage insight query failed: ${sourceResponse.error.message}`)
  }

  const sourceRows = Array.isArray(sourceResponse.data) ? sourceResponse.data as Record<string, unknown>[] : []
  const filteredRows = filterHighSignalGraphitiInsightRows(sourceRows)
  const selectedRows = filteredRows.length > 0
    ? filteredRows
    : distinctRowsByEntity(sourceRows)
  let materializedSourceInsights = await Promise.all(selectedRows
    .map((row) => ({
      raw: row,
      insight: materializeGraphitiInsight(row),
    }))
    .filter(({ insight }) => Boolean(insight.insight_id))
    .map(async ({ raw, insight }) => ({
      raw,
      insight: await resolveCanonicalGraphitiInsight(insight, raw),
    })))

  if (filteredRows.length === 0 && sourceRows.length > 0) {
    warnings.push('Materializing recent Graphiti pipeline context rows because no high-signal rows are currently available')
  }

  const sourceIds = materializedSourceInsights.map(({ insight }) => insight.insight_id)
  const existingResponse = sourceIds.length > 0
    ? await supabase
        .from('graphiti_materialized_insights')
        .select('insight_id, state_hash, is_active')
        .in('insight_id', sourceIds)
    : { data: [], error: null }

  if (existingResponse.error) {
    throw new Error(`Failed to load existing materialized insights: ${existingResponse.error.message}`)
  }

  const existingMap = new Map<string, Pick<PersistedGraphitiInsightRow, 'state_hash' | 'is_active'>>(
    (Array.isArray(existingResponse.data) ? existingResponse.data : []).map((row: any) => [String(row.insight_id), {
      state_hash: String(row.state_hash || ''),
      is_active: Boolean(row.is_active),
    }]),
  )

  const persistedRows = materializedSourceInsights.map(({ insight, raw }) =>
    toPersistedInsight(insight, raw, existingMap.get(insight.insight_id), nowIso),
  )

  if (persistedRows.length > 0) {
    const upsertResponse = await supabase
      .from('graphiti_materialized_insights')
      .upsert(persistedRows, { onConflict: 'insight_id' })

    if (upsertResponse.error) {
      throw new Error(`Failed to upsert materialized insights: ${upsertResponse.error.message}`)
    }
  }

  const activeResponse = await supabase
    .from('graphiti_materialized_insights')
    .select('insight_id')
    .eq('is_active', true)

  if (activeResponse.error) {
    warnings.push(`Failed to inspect active materialized insights: ${activeResponse.error.message}`)
  } else {
    const activeIds = (activeResponse.data || []).map((row: any) => String(row.insight_id))
    const unseenActiveIds = activeIds.filter((insightId) => !sourceIds.includes(insightId))
    if (unseenActiveIds.length > 0) {
      const deactivateResponse = await supabase
        .from('graphiti_materialized_insights')
        .update({ is_active: false, updated_at: nowIso })
        .in('insight_id', unseenActiveIds)

      if (deactivateResponse.error) {
        warnings.push(`Failed to mark unseen insights inactive: ${deactivateResponse.error.message}`)
      }
    }
  }

  const notifications = persistedRows
    .filter((row) => {
      const existing = existingMap.get(row.insight_id)
      return !existing || !existing.is_active || existing.state_hash !== row.state_hash
    })
    .map((row) => {
      const payload = buildGraphitiNotificationPayload(fromPersistedInsight(row))
      return {
        ...payload,
        state_hash: row.state_hash,
      }
    })

  if (notifications.length > 0) {
    const notificationResponse = await supabase
      .from('graphiti_notifications')
      .upsert(notifications, {
        onConflict: 'insight_id,state_hash',
        ignoreDuplicates: true,
      })

    if (notificationResponse.error) {
      throw new Error(`Failed to upsert Graphiti notifications: ${notificationResponse.error.message}`)
    }
  }

  const highlights = rankGraphitiInsights(persistedRows.map(fromPersistedInsight)).slice(0, limit)
  return {
    highlights,
    lastUpdatedAt: highlights[0]?.materialized_at || nowIso,
    warnings,
    stats: {
      source_count: filteredRows.length,
      upserted_count: persistedRows.length,
      notification_count: notifications.length,
    },
  }
}

export async function loadGraphitiInsightsWithPersistence(limit = 25, options?: { clientFacingOnly?: boolean }) {
  const persisted = await loadPersistedGraphitiInsights(limit, options)
  if (persisted.highlights.length > 0 || !allowDemoFallbacks()) {
    return persisted
  }

  return null
}
