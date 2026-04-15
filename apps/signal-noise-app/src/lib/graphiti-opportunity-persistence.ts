import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { getDossierRoots } from '@/lib/dossier-paths'
import { normalizeQuestionFirstDossier } from '@/lib/question-first-dossier'
import { getSupabaseAdmin } from '@/lib/supabase-client'
import { getGraphitiStaleWindowHours } from '@/lib/runtime-env'
import { materializeGraphitiOpportunity, rankGraphitiOpportunities } from '@/lib/graphiti-opportunity-materializer'
import type {
  GraphitiOpportunityCard,
  GraphitiOpportunityResponse,
  GraphitiOpportunitySourceRow,
} from '@/lib/graphiti-opportunity-contract'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

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

function walkFiles(root: string, maxDepth = 3): string[] {
  const files: string[] = []
  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || current.depth > maxDepth || !existsSync(current.dir)) continue

    for (const entry of readdirSync(current.dir, { withFileTypes: true })) {
      const entryPath = path.join(current.dir, entry.name)
      if (entry.isDirectory()) {
        stack.push({ dir: entryPath, depth: current.depth + 1 })
        continue
      }
      files.push(entryPath)
    }
  }

  return files
}

async function loadDossierOpportunitySources(limit: number): Promise<GraphitiOpportunitySourceRow[]> {
  const seen = new Set<string>()
  const sourceRows: GraphitiOpportunitySourceRow[] = []

  for (const root of getDossierRoots()) {
    const dossierFiles = walkFiles(root, 3).filter((filePath) => filePath.endsWith('_question_first_dossier.json'))

    for (const filePath of dossierFiles) {
      if (sourceRows.length >= Math.max(limit * 4, 100)) {
        break
      }

      let payload: Record<string, unknown> | null = null
      try {
        payload = JSON.parse(await readFile(filePath, 'utf8'))
      } catch {
        continue
      }

      if (!payload) continue

      const normalized = normalizeQuestionFirstDossier(
        (payload.merged_dossier && typeof payload.merged_dossier === 'object') ? payload.merged_dossier as Record<string, any> : payload,
        String(payload.entity_id || payload?.merged_dossier?.entity_id || path.basename(filePath)),
      )
      const discoverySummary = normalized?.question_first?.discovery_summary || {}
      const graphiti = discoverySummary?.graphiti_sales_brief || {}
      const qualityState = String(normalized?.quality_state || '').toLowerCase()
      if (!['partial', 'blocked', 'complete', 'client_ready'].includes(qualityState)) {
        continue
      }

      const entityId = String(normalized?.entity_id || payload.entity_id || '').trim()
      const entityName = String(normalized?.entity_name || payload.entity_name || entityId).trim()
      if (!entityId || !entityName) continue

      const key = [entityId, entityName].join('|').toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      const confidence = Number(
        discoverySummary?.yellow_panther_opportunity?.estimated_probability
          ?? graphiti?.estimated_probability
          ?? graphiti?.win_probability
          ?? 0,
      )
      const serviceFit = Array.isArray(discoverySummary?.yellow_panther_opportunity?.service_fit)
        ? discoverySummary.yellow_panther_opportunity.service_fit
        : []
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
      const confidenceScore = Number.isFinite(confidence)
        ? Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence))
        : 0

      sourceRows.push({
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
        destination_url: normalized?.entity_id ? `/entity-browser/${encodeURIComponent(entityId)}/dossier?from=1` : '/entity-browser',
        detected_at: String(normalized?.question_first?.generated_at || normalized?.metadata?.question_first?.generated_at || new Date().toISOString()),
        materialized_at: String(normalized?.question_first?.generated_at || normalized?.metadata?.question_first?.generated_at || new Date().toISOString()),
        source_run_id: String(normalized?.question_first?.run_id || normalized?.metadata?.question_first?.run_id || ''),
        source_signal_id: undefined,
        source_episode_id: undefined,
        source_objective: String(graphiti?.outreach_angle || discoverySummary?.summary || ''),
        raw_payload: {
          source: 'question_first_dossier',
          dossier_path: filePath,
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
      })
    }
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
  const dossierRows = await loadDossierOpportunitySources(limit)
  const combined = [...rows.filter(isOpportunityCandidateSource), ...dossierRows]
  const seen = new Set<string>()
  return combined.filter((row) => {
    const key = [row.entity_id, row.title.toLowerCase()].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function loadGraphitiOpportunitySourceRows(limit = 100) {
  return loadSourceOpportunities(limit)
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

  const persistedRows = opportunityRows.map((row) => {
    const {
      freshness: _freshness,
      metadata: _metadata,
      ...persisted
    } = row as typeof row & { freshness?: unknown; metadata?: unknown }
    return {
      ...persisted,
      materialized_at: nowIso,
      last_seen_at: nowIso,
      updated_at: nowIso,
    }
  })

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
