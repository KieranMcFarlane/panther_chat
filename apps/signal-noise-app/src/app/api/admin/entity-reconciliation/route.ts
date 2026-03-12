import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { normalizeName, readLeague, canonicalEntityType } from '@/lib/entity-search-utils.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CachedEntityRow = {
  id: string
  graph_id?: string
  neo4j_id?: string
  labels?: string[]
  properties?: Record<string, any>
  priority_score?: number
  entity_category?: string
}

type EmbeddingRow = {
  entity_id: string
  entity_type: string
  name: string
  metadata?: Record<string, any>
}

type RemediationStrategy = 'id_backfill' | 'semantic_merge'

type RemediationPayload = {
  action?: 'remediate'
  dry_run?: boolean
  limit?: number
  strategy?: RemediationStrategy
}

type Candidate = {
  source_graph_id: string
  name: string
  type: string
  sport: string
  league: string
  country: string
  description: string
  labels: string[]
  source: string
  raw_entity_type: string
}

const NOISE_NAMES = new Set([
  'type',
  'tier',
  'tier 1',
  'tier 2',
  'tier 3',
  'tier 4',
  'tier 5',
  'club',
  'league',
  'federation',
  'organization',
  'organisation',
  'international federation',
  'continental federation',
  'sport',
  'sports entity',
  'unknown',
])

async function fetchAllRows<T>(table: string, columns: string, pageSize = 1000): Promise<T[]> {
  const output: T[] = []
  let start = 0

  while (true) {
    const end = start + pageSize - 1
    const { data, error } = await supabase.from(table).select(columns).range(start, end)
    if (error) throw error

    const rows = (data || []) as T[]
    output.push(...rows)
    if (rows.length < pageSize) break
    start += pageSize
  }

  return output
}

function getEmbeddingGraphId(row: EmbeddingRow): string {
  const metadata = row.metadata || {}
  return String(metadata.neo4j_id || row.entity_id)
}

function countMissing(values: Array<string>): number {
  return values.filter((value) => !String(value || '').trim()).length
}

function deriveLabels(rawLabels: unknown, rawType: string): string[] {
  if (Array.isArray(rawLabels) && rawLabels.length > 0) {
    return rawLabels.map((label) => String(label))
  }

  switch (rawType) {
    case 'team':
      return ['Entity', 'Club']
    case 'league':
      return ['Entity', 'League']
    case 'federation':
      return ['Entity', 'Federation']
    case 'rights_holder':
      return ['Entity', 'Organization']
    default:
      return ['Entity', 'Organization']
  }
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return value.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

function isNoiseCandidate(candidate: Candidate): boolean {
  const normalized = normalizeName(candidate.name)
  if (!normalized) return true
  if (/^entity\s*\d+$/.test(normalized)) return true
  if (NOISE_NAMES.has(normalized)) return true
  if (normalized.startsWith('tier ')) return true

  const hasSportsSignal = Boolean(candidate.sport) || Boolean(candidate.league)
  if (!hasSportsSignal && candidate.type === 'organisation' && normalized.split(' ').length <= 1) return true

  return false
}

function semanticKeyFromParts(name: string, sport: string, league: string): string {
  return [normalizeName(name), normalizeName(sport), normalizeName(league)].join('|')
}

function embeddingDisplayName(row: EmbeddingRow): string {
  return String(row.metadata?.properties?.name || row.name || '')
}

function semanticKeyFromCachedRow(row: CachedEntityRow): string {
  const properties = row.properties || {}
  return semanticKeyFromParts(
    String(properties.name || ''),
    String(properties.sport || ''),
    readLeague(properties || {}),
  )
}

function candidateFromEmbedding(row: EmbeddingRow): Candidate {
  const metadata = row.metadata || {}
  const nestedProperties = (metadata.properties || {}) as Record<string, any>

  const name = String(nestedProperties.name || row.name || getEmbeddingGraphId(row))
  const sport = String(nestedProperties.sport || metadata.sport || '').trim()
  const league = String(nestedProperties.league || nestedProperties.level || metadata.league || '').trim()
  const country = String(nestedProperties.country || metadata.country || '').trim()
  const description = String(nestedProperties.description || row.metadata?.description || '').trim()
  const canonicalType = canonicalEntityType({
    labels: Array.isArray(metadata.labels) ? metadata.labels : [],
    properties: {
      entity_type: row.entity_type,
      type: nestedProperties.type || nestedProperties.entity_type || row.entity_type,
    },
  })

  return {
    source_graph_id: getEmbeddingGraphId(row),
    name,
    type: canonicalType,
    sport,
    league,
    country,
    description,
    labels: deriveLabels(metadata.labels || metadata.original_labels, canonicalType),
    source: String(metadata.source || nestedProperties.source || 'entity_embeddings_remediation'),
    raw_entity_type: String(row.entity_type || nestedProperties.entity_type || ''),
  }
}

function toSyntheticGraphId(candidate: Candidate): string {
  const digest = crypto
    .createHash('sha1')
    .update(`${normalizeName(candidate.name)}|${normalizeName(candidate.sport)}|${normalizeName(candidate.league)}`)
    .digest('hex')
    .slice(0, 16)
  return `sem_${digest}`
}

function mapCandidateToInsert(candidate: Candidate, forcedGraphId: string) {
  return {
    graph_id: forcedGraphId,
    neo4j_id: forcedGraphId,
    labels: candidate.labels,
    properties: {
      name: candidate.name,
      type: candidate.type,
      entity_type: candidate.type,
      sport: candidate.sport || null,
      country: candidate.country || null,
      league: candidate.league || null,
      level: candidate.league || null,
      description: candidate.description || null,
      source: candidate.source,
      aliases: [candidate.name],
      source_embedding_ids: [candidate.source_graph_id],
      semantic_key: semanticKeyFromParts(candidate.name, candidate.sport, candidate.league),
      remediated_at: new Date().toISOString(),
    },
    cache_version: 1,
    entity_category: candidate.type,
    priority_score: 0,
  }
}

async function runSemanticMerge(cached: CachedEntityRow[], embeddings: EmbeddingRow[], dryRun: boolean, limit: number) {
  const usedGraphIds = new Set(cached.map((row) => String(row.graph_id || row.neo4j_id || row.id)))
  const cachedBySemantic = new Map<string, CachedEntityRow>()
  for (const row of cached) {
    const key = semanticKeyFromCachedRow(row)
    if (key !== '||' && !cachedBySemantic.has(key)) {
      cachedBySemantic.set(key, row)
    }
  }

  const candidates = embeddings
    .map(candidateFromEmbedding)
    .filter((candidate) => !isNoiseCandidate(candidate))

  const limited = candidates.slice(0, limit)

  const inserts: any[] = []
  const updates: Array<{ id: string; properties: Record<string, any>; labels: string[]; entity_category: string }> = []

  let skippedNoise = embeddings.length - candidates.length
  let semanticMatches = 0
  let idCollisionsResolved = 0

  for (const candidate of limited) {
    const key = semanticKeyFromParts(candidate.name, candidate.sport, candidate.league)
    const existing = cachedBySemantic.get(key)

    if (existing) {
      semanticMatches += 1
      const existingProps = existing.properties || {}
      const aliases = new Set<string>([
        ...toArray(existingProps.aliases),
        candidate.name,
      ])
      const sourceEmbeddingIds = new Set<string>([
        ...toArray(existingProps.source_embedding_ids),
        candidate.source_graph_id,
      ])

      const nextProps: Record<string, any> = {
        ...existingProps,
        aliases: Array.from(aliases),
        source_embedding_ids: Array.from(sourceEmbeddingIds),
        remediated_at: new Date().toISOString(),
      }

      if (!existingProps.sport && candidate.sport) nextProps.sport = candidate.sport
      if (!readLeague(existingProps) && candidate.league) {
        nextProps.league = candidate.league
        nextProps.level = candidate.league
      }
      if (!existingProps.country && candidate.country) nextProps.country = candidate.country
      if (!existingProps.description && candidate.description) nextProps.description = candidate.description
      if (!existingProps.type || normalizeName(String(existingProps.type)) === 'organisation') {
        nextProps.type = candidate.type
        nextProps.entity_type = candidate.type
      }

      updates.push({
        id: existing.id,
        properties: nextProps,
        labels: existing.labels && existing.labels.length > 0 ? existing.labels : candidate.labels,
        entity_category: existing.entity_category || candidate.type,
      })
      continue
    }

    let targetId = candidate.source_graph_id
    if (usedGraphIds.has(targetId)) {
      idCollisionsResolved += 1
      targetId = toSyntheticGraphId(candidate)
    }
    while (usedGraphIds.has(targetId)) {
      targetId = `${targetId}_x`
    }
    usedGraphIds.add(targetId)

    inserts.push(mapCandidateToInsert(candidate, targetId))
    cachedBySemantic.set(key, {
      id: targetId,
      graph_id: targetId,
      neo4j_id: targetId,
      labels: candidate.labels,
      properties: {
        name: candidate.name,
        sport: candidate.sport,
        league: candidate.league,
      },
    })
  }

  let inserted = 0
  let updated = 0
  const errors: string[] = []

  if (!dryRun) {
    if (inserts.length > 0) {
      const { error } = await supabase.from('cached_entities').upsert(inserts, { onConflict: 'neo4j_id' })
      if (error) errors.push(error.message)
      else inserted = inserts.length
    }

    for (const update of updates) {
      const { error } = await supabase
        .from('cached_entities')
        .update({
          properties: update.properties,
          labels: update.labels,
          entity_category: update.entity_category,
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.id)

      if (error) {
        errors.push(error.message)
      } else {
        updated += 1
      }
    }
  }

  return {
    strategy: 'semantic_merge' as const,
    scanned_embeddings: embeddings.length,
    candidates_processed: limited.length,
    skipped_noise: skippedNoise,
    semantic_matches: semanticMatches,
    inserted,
    updated,
    id_collisions_resolved: idCollisionsResolved,
    sample_candidates: inserts.slice(0, 25).map((row) => ({
      graph_id: row.graph_id,
      name: row.properties?.name,
      sport: row.properties?.sport,
      league: row.properties?.league || row.properties?.level,
      type: row.properties?.type,
    })),
    errors,
  }
}

export async function GET() {
  try {
    const [cached, embeddings, relationshipResult] = await Promise.all([
      fetchAllRows<CachedEntityRow>('cached_entities', 'id, graph_id, neo4j_id, labels, properties'),
      fetchAllRows<EmbeddingRow>('entity_embeddings', 'entity_id, entity_type, name, metadata'),
      supabase.from('entity_relationships').select('id', { count: 'exact', head: true }),
    ])

    if (relationshipResult.error) throw relationshipResult.error

    const cachedByGraphId = new Map<string, CachedEntityRow>()
    for (const row of cached) {
      const gid = String(row.graph_id || row.neo4j_id || row.id)
      cachedByGraphId.set(gid, row)
    }

    const embeddingByGraphId = new Map<string, EmbeddingRow>()
    for (const row of embeddings) {
      const gid = getEmbeddingGraphId(row)
      embeddingByGraphId.set(gid, row)
    }

    const embeddingsNotInCached: Array<{ graph_id: string; name: string; entity_type: string }> = []
    for (const [gid, row] of embeddingByGraphId.entries()) {
      if (!cachedByGraphId.has(gid)) {
        embeddingsNotInCached.push({ graph_id: gid, name: row.name, entity_type: row.entity_type })
      }
    }

    const cachedNotInEmbeddings: Array<{ graph_id: string; name: string; type: string }> = []
    for (const [gid, row] of cachedByGraphId.entries()) {
      if (!embeddingByGraphId.has(gid)) {
        cachedNotInEmbeddings.push({
          graph_id: gid,
          name: String(row.properties?.name || gid),
          type: canonicalEntityType({ labels: row.labels || [], properties: row.properties || {} }),
        })
      }
    }

    const normalizedCachedNames = new Set(
      cached
        .map((row) => normalizeName(row.properties?.name || ''))
        .filter(Boolean),
    )

    let idNameMismatches = 0
    let actionableIdNameMismatches = 0
    for (const row of embeddings) {
      const gid = getEmbeddingGraphId(row)
      const cachedRow = cachedByGraphId.get(gid)
      if (!cachedRow) continue

      const embeddingName = normalizeName(embeddingDisplayName(row))
      const cachedName = normalizeName(cachedRow.properties?.name || '')
      if (!embeddingName || !cachedName || embeddingName === cachedName) continue

      idNameMismatches += 1

      const candidate = candidateFromEmbedding(row)
      if (!isNoiseCandidate(candidate)) {
        actionableIdNameMismatches += 1
      }
    }

    const normalizedInEmbeddingsNotCached = new Set(
      embeddings
        .map((row) => normalizeName(row.name || ''))
        .filter((name) => name && !normalizedCachedNames.has(name)),
    )

    const missingName = countMissing(cached.map((row) => String(row.properties?.name || '')))
    const missingSport = countMissing(cached.map((row) => String(row.properties?.sport || '')))
    const missingType = countMissing(cached.map((row) => String(row.properties?.type || row.properties?.entity_type || '')))
    const missingLeague = countMissing(cached.map((row) => readLeague(row.properties || {})))

    const canonicalTypeCounts: Record<string, number> = {}
    for (const row of cached) {
      const canonicalType = canonicalEntityType({ labels: row.labels || [], properties: row.properties || {} })
      canonicalTypeCounts[canonicalType] = (canonicalTypeCounts[canonicalType] || 0) + 1
    }

    const sportCounts: Record<string, number> = {}
    for (const row of cached) {
      const sport = String(row.properties?.sport || '(missing)')
      sportCounts[sport] = (sportCounts[sport] || 0) + 1
    }

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      counts: {
        cached_entities: cached.length,
        entity_embeddings: embeddings.length,
        entity_relationships: relationshipResult.count || 0,
        overlap_by_graph_id: cached.filter((row) => embeddingByGraphId.has(String(row.graph_id || row.neo4j_id || row.id))).length,
      },
      congruence: {
        embeddings_not_in_cached: embeddingsNotInCached.length,
        cached_not_in_embeddings: cachedNotInEmbeddings.length,
        normalized_names_in_embeddings_not_cached: normalizedInEmbeddingsNotCached.size,
        id_name_mismatches: idNameMismatches,
        actionable_id_name_mismatches: actionableIdNameMismatches,
      },
      completeness: {
        cached_missing_name: missingName,
        cached_missing_sport: missingSport,
        cached_missing_type: missingType,
        cached_missing_league: missingLeague,
      },
      taxonomy: {
        canonical_types: canonicalTypeCounts,
        sports: sportCounts,
      },
      samples: {
        embeddings_not_in_cached: embeddingsNotInCached.slice(0, 50),
        cached_not_in_embeddings: cachedNotInEmbeddings.slice(0, 50),
      },
    })
  } catch (error) {
    console.error('Entity reconciliation failed:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Entity reconciliation failed',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RemediationPayload
    const action = body.action || 'remediate'
    const dryRun = Boolean(body.dry_run)
    const limit = Math.max(1, Math.min(Number(body.limit || 2000), 10000))
    const strategy: RemediationStrategy = body.strategy || 'semantic_merge'

    if (action !== 'remediate') {
      return NextResponse.json({ error: 'Unsupported action', supported_actions: ['remediate'] }, { status: 400 })
    }

    const [cached, embeddings] = await Promise.all([
      fetchAllRows<CachedEntityRow>('cached_entities', 'id, graph_id, neo4j_id, labels, properties, priority_score, entity_category'),
      fetchAllRows<EmbeddingRow>('entity_embeddings', 'entity_id, entity_type, name, metadata'),
    ])

    if (strategy === 'semantic_merge') {
      const result = await runSemanticMerge(cached, embeddings, dryRun, limit)
      return NextResponse.json({
        success: result.errors.length === 0,
        action,
        strategy,
        dry_run: dryRun,
        summary: {
          embeddings_total: embeddings.length,
          cached_total_before: cached.length,
          candidates_processed: result.candidates_processed,
          inserted: result.inserted,
          updated: result.updated,
          semantic_matches: result.semantic_matches,
          skipped_noise: result.skipped_noise,
          id_collisions_resolved: result.id_collisions_resolved,
        },
        sample_candidates: result.sample_candidates,
        errors: result.errors,
      })
    }

    const cachedIds = new Set(cached.map((row) => String(row.graph_id || row.neo4j_id || row.id)))
    const missing = embeddings
      .filter((row) => !cachedIds.has(getEmbeddingGraphId(row)))
      .map(candidateFromEmbedding)
      .filter((candidate) => !isNoiseCandidate(candidate))
      .slice(0, limit)

    const payload = missing.map((candidate) => mapCandidateToInsert(candidate, candidate.source_graph_id))

    let inserted = 0
    let errors: string[] = []

    if (!dryRun && payload.length > 0) {
      const { error } = await supabase.from('cached_entities').upsert(payload, { onConflict: 'neo4j_id' })
      if (error) {
        errors = [error.message]
      } else {
        inserted = payload.length
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      action,
      strategy,
      dry_run: dryRun,
      summary: {
        embeddings_total: embeddings.length,
        cached_total_before: cached.length,
        candidates_missing_in_cached: missing.length,
        inserted,
      },
      sample_candidates: payload.slice(0, 25).map((row) => ({
        graph_id: row.graph_id,
        name: row.properties?.name,
        type: row.properties?.type,
        sport: row.properties?.sport,
        league: row.properties?.league || row.properties?.level,
      })),
      errors,
    })
  } catch (error) {
    console.error('Entity remediation failed:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Entity remediation failed',
      },
      { status: 500 },
    )
  }
}
