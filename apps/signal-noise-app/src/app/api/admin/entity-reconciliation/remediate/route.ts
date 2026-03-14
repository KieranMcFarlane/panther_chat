import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CachedEntityRow = {
  id: string
  graph_id: string | null
  neo4j_id: string | null
  labels: string[] | null
  properties: Record<string, unknown> | null
}

type EmbeddingRow = {
  entity_id: string
  entity_type?: string
  name?: string
  metadata?: Record<string, unknown>
}

type Candidate = {
  source_graph_id: string
  name: string
  type: string
  sport: string
  league: string
  country: string
  source: string
  aliases: string[]
  description: string
}

type RemediationStrategy = 'id_backfill' | 'semantic_merge'

type RemediationPayload = {
  action?: 'remediate'
  dry_run?: boolean
  limit?: number
  strategy?: RemediationStrategy
}

type RemediationSummary = {
  strategy: RemediationStrategy
  scanned_embeddings: number
  candidates_processed: number
  inserted: number
  updated: number
  skipped_noise: number
  semantic_matches: number
  id_collisions_resolved: number
  id_name_mismatches_resolved: number
  sample_candidates: Array<{ source_graph_id: string; name: string; type: string; sport: string; league: string }>
  errors: string[]
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
  'entity',
  'name',
  'undefined',
  'null',
  'untitled',
  'item',
  'node',
  'generic',
])

const NOISE_NAME_SUBSTRINGS = [
  'weekly rfp',
  'yellow panther',
  'website assessment',
  'modernness assessment',
  'intelligence review',
  'dashboard',
  'workflow',
  'monitoring',
  'agent',
  'assessment',
]

const LEAGUE_ALIASES: Record<string, string> = {
  ipl: 'indian premier league',
  'indian premier league': 'indian premier league',
  epl: 'premier league',
  'english premier league': 'premier league',
  'premier league': 'premier league',
}

const SPORT_ALIASES: Record<string, string> = {
  soccer: 'football',
  'association football': 'football',
  'association-football': 'football',
}

function normalizeName(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
  .trim()
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function readString(value: unknown): string {
  return String(value || '').trim()
}

function normalizeSport(value: unknown): string {
  const normalized = normalizeName(value)
  if (!normalized) return ''
  return SPORT_ALIASES[normalized] || normalized
}

function normalizeLeague(value: unknown): string {
  const normalized = normalizeName(value)
  if (!normalized) return ''
  return LEAGUE_ALIASES[normalized] || normalized
}

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean)
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.includes('\n')) {
    return value.split('\n').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function stableEntityId(row: CachedEntityRow): string {
  return String(row.graph_id || row.neo4j_id || row.id)
}

function rowName(row: CachedEntityRow): string {
  return String((row.properties || {}).name || '')
}

function toReadLeague(props: Record<string, unknown>): string {
  return String(
    (props.league ||
      props.parent_league ||
      props.parentLeague ||
      props.level ||
      props.competition ||
      props.competition_name ||
      '') as string,
  ).trim()
}

function canonicalType(row: CachedEntityRow): string {
  const props = row.properties || {}
  const values = [
    props.entity_type,
    props.type,
    ...(Array.isArray(row.labels) ? row.labels : []),
  ]
    .map((value) => normalizeName(value))
    .filter(Boolean)
    .join(' | ')

  if (values.includes('rights') || values.includes('broadcast') || values.includes('media')) return 'rights_holder'
  if (values.includes('federation') || values.includes('governing')) return 'federation'
  if (values.includes('league') || values.includes('competition')) return 'league'
  if (values.includes('club') || values.includes('team') || values.includes('franchise')) return 'team'
  if (values.includes('organisation') || values.includes('organization') || values.includes('association')) return 'organisation'
  return 'organisation'
}

function semanticKeyFromParts(name: string, sport: string, league: string): string {
  return [normalizeName(name), normalizeName(sport), normalizeName(league)].join('|')
}

function getEmbeddingId(row: EmbeddingRow): string {
  const metadata = row.metadata || {}
  const metadataRecord = asRecord(metadata)
  const rawId = String(
    metadataRecord.neo4j_id ||
      metadataRecord.graph_id ||
      metadataRecord.node_id ||
      (row as Record<string, unknown>).entity_id ||
      '',
  )
  return rawId
}

function candidateFromEmbedding(row: EmbeddingRow): Candidate {
  const metadata = asRecord(row.metadata)
  const nested = asRecord(metadata.properties)

  const names = [
    nested?.name,
    row.name,
    metadata.name,
    metadata.entity_name,
    metadata.title,
    metadata.label,
  ].map((value) => readString(value))

  const normalizedAliases = [
    ...splitList(metadata.aliases),
    ...splitList(nested.aliases),
    ...splitList(metadata.short_name),
    ...splitList(metadata.short_name_alias),
    ...splitList(metadata.abbreviation),
    ...splitList(metadata.nicknames),
  ]

  const primaryName = names.find((value) => value.trim())
  const league = nested.league || nested.level || nested.competition || metadata.league || metadata.competition || metadata.level
  const sport = nested.sport || metadata.sport || ''

  return {
    source_graph_id: getEmbeddingId(row),
    name: primaryName || getEmbeddingId(row),
    type: canonicalTypeFromSource({
      entity_type: row.entity_type,
      labels: Array.isArray(nested.labels) ? (nested.labels as string[]) : undefined,
      properties: nested,
      fallback: {
        sport: readString(sport),
        league: readString(league),
      },
      name: primaryName || '',
    }),
    sport: normalizeSport(sport),
    league: normalizeLeague(league),
    country: readString(nested.country || metadata.country),
    source: readString(metadata.source || nested.source || 'entity_embeddings'),
    aliases: Array.from(new Set(normalizedAliases.map((value) => value.trim()).filter(Boolean))),
    description: readString(nested.description || metadata.description),
  }
}

function canonicalTypeFromSource(input: {
  entity_type?: string
  labels?: string[]
  properties?: Record<string, unknown>
  fallback?: { sport: string; league: string }
  name: string
}): string {
  const parts = [
    input.entity_type,
    ...(Array.isArray(input.labels) ? input.labels : []),
    input.properties?.type,
    input.properties?.entity_type,
  ]
    .map((value) => normalizeName(value))
    .filter(Boolean)
    .join(' | ')

  if (parts.includes('rights') || parts.includes('media') || parts.includes('broadcast')) return 'rights_holder'
  if (parts.includes('federation') || parts.includes('governing')) return 'federation'
  if (parts.includes('league') || parts.includes('competition') || parts.includes('tournament')) return 'league'
  if (parts.includes('team') || parts.includes('club') || parts.includes('franchise')) return 'team'
  if (parts.includes('organisation') || parts.includes('organization') || parts.includes('association')) return 'organisation'

  if (normalizeName(input.fallback?.sport).includes('cricket') && (normalizeName(input.fallback?.league) === 'indian premier league' ||
    normalizeName(input.fallback?.league) === 'ipl')) {
    return 'team'
  }

  if (normalizeName(input.name) === '') return 'organisation'

  return 'organisation'
}

function isNoiseCandidate(candidate: Candidate): boolean {
  const normalized = normalizeName(candidate.name)
  if (!normalized) return true
  if (normalized.length < 2) return true
  if (/^entity\s*\d+$/.test(normalized)) return true
  if (/^node\s*\d+$/i.test(normalized)) return true
  if (NOISE_NAMES.has(normalized)) return true
  if (NOISE_NAME_SUBSTRINGS.some((value) => normalized.includes(value))) return true
  if (normalized.startsWith('tier ')) return true
  if (/^type\s*\d+/i.test(normalized)) return true
  if (/[_]/.test(candidate.name) && normalized.includes('rfp')) return true
  if (/^[a-z]+_[a-z0-9_]+$/i.test(candidate.name)) return true
  const source = normalizeName(candidate.source)
  if (source.includes('system') || source.includes('internal') || source.includes('workflow')) return true
  if (normalized === normalizeName(candidate.source_graph_id)) return true
  return false
}

function toSemanticInsert(candidate: Candidate, targetGraphId: string) {
  const now = new Date().toISOString()
  return {
    neo4j_id: targetGraphId,
    graph_id: targetGraphId,
    labels: ['Entity', candidate.type === 'rights_holder' ? 'RightsHolder' : candidate.type === 'team' ? 'Team' : 'Organisation'],
    properties: {
      name: candidate.name,
      aliases: Array.from(new Set([candidate.name, ...candidate.aliases])),
      normalized_name: normalizeName(candidate.name),
      type: candidate.type,
      entity_type: candidate.type,
      sport: candidate.sport || null,
      league: candidate.league || null,
      parent_league: candidate.league || null,
      level: candidate.league || null,
      country: candidate.country || null,
      description: candidate.description || null,
      source: candidate.source,
      source_embedding_ids: [candidate.source_graph_id],
      source_embedding_count: 1,
      remediated_at: now,
      remediated_by: 'semantic_merge',
    },
    cache_version: 1,
    entity_category: candidate.type,
    priority_score: 0,
  }
}

function toSyntheticGraphId(candidate: Candidate): string {
  return crypto
    .createHash('sha1')
    .update(`${normalizeName(candidate.name)}|${normalizeName(candidate.sport)}|${normalizeName(candidate.league)}`)
    .digest('hex')
    .slice(0, 16)
}

async function fetchAllRows<T>(table: string, columns: string, pageSize = 1000): Promise<T[]> {
  const out: T[] = []
  let start = 0

  while (true) {
    const end = start + pageSize - 1
    const { data, error } = await getSupabaseAdmin()
      .from(table)
      .select(columns)
      .range(start, end)

    if (error) throw error

    const rows = (data as T[]) || []
    out.push(...rows)
    if (rows.length < pageSize) break
    start += pageSize
  }

  return out
}

function semanticKeyFromCachedRow(row: CachedEntityRow): string {
  const properties = row.properties || {}
  return semanticKeyFromParts(
    String((properties as { name?: string }).name || ''),
    normalizeSport((properties as { sport?: string }).sport),
    toReadLeague(properties),
  )
}

function readCachedAliasList(row: CachedEntityRow): string[] {
  const properties = row.properties || {}
  return [
    String((properties as { name?: string }).name || ''),
    ...(splitList((properties as { aliases?: unknown }).aliases)),
    ...splitList((properties as { short_names?: unknown }).short_names),
    ...splitList((properties as { shortName?: unknown }).shortName),
  ]
}

function cachedEntityNames(row: CachedEntityRow): string[] {
  return Array.from(new Set(readCachedAliasList(row).map((name) => String(name || '').trim()).filter(Boolean)))
}

function cachedRowNameMatchScore(candidate: Candidate, row: CachedEntityRow): number {
  const props = row.properties || {}
  const candidateName = normalizeName(candidate.name)
  const rowName = normalizeName(String((props as { name?: string }).name || ''))
  const rowSport = normalizeSport(String((props as { sport?: string }).sport || ''))
  const rowLeague = normalizeLeague(toReadLeague(props))
  const rowType = normalizeName(String((props as { type?: string }).type || (props as { entity_type?: string }).entity_type || ''))
  const candidateType = candidate.type || ''

  const rowNameVariants = cachedEntityNames(row).map((value) => normalizeName(value))

  let score = 0
  if (candidateName && rowName && rowName === candidateName) score += 50
  if (rowNameVariants.some((value) => value && value !== rowName && value === candidateName)) score += 25

  if (normalizeName(candidate.sport) && rowSport && rowSport === normalizeName(candidate.sport)) score += 20
  if (normalizeName(candidate.league) && rowLeague && rowLeague === normalizeName(candidate.league)) score += 20

  if (rowType && candidateType && rowType === candidateType) score += 10

  if (!rowSport && normalizeName(candidate.sport)) score += 5
  if (!rowLeague && normalizeName(candidate.league)) score += 5

  return score
}

function buildCanonicalCandidateRows(row: CachedEntityRow): string[] {
  const props = row.properties || {}
  const rows: string[] = []

  const name = String((props as { name?: string }).name || '')
  const sport = normalizeSport((props as { sport?: string }).sport)
  const league = normalizeLeague(toReadLeague(props))

  rows.push(semanticKeyFromParts(name, sport, league))
  rows.push(semanticKeyFromParts(name, sport, ''))
  rows.push(semanticKeyFromParts(name, '', league))

  return rows
}

function pickBestCachedMatch(
  candidate: Candidate,
  rowsByKey: Map<string, CachedEntityRow[]>,
  nameIndex: Map<string, CachedEntityRow[]>,
  aliasIndex: Map<string, CachedEntityRow[]>,
): CachedEntityRow | null {
  const orderedKeys = [
    semanticKeyFromParts(candidate.name, candidate.sport, candidate.league),
    ...buildCanonicalCandidateRows({ id: '', graph_id: '', neo4j_id: null, labels: null, properties: { name: candidate.name, sport: candidate.sport, league: candidate.league } }),
  ]

  for (const key of orderedKeys) {
    const direct = rowsByKey.get(key)
    if (direct && direct.length > 0) {
      return direct.reduce<CachedEntityRow | null>((best, row) => {
        if (!best) return row
        return cachedRowNameMatchScore(candidate, row) >= cachedRowNameMatchScore(candidate, best) ? row : best
      }, null)
    }
  }

  const directName = normalizeName(candidate.name)
  const nameMatches = new Map<CachedEntityRow, number>()

  const exactNameMatches = nameIndex.get(directName)
  for (const match of exactNameMatches || []) {
    nameMatches.set(match, (nameMatches.get(match) || 0) + cachedRowNameMatchScore(candidate, match) + 30)
  }

  for (const alias of candidate.aliases) {
    const aliasMatches = aliasIndex.get(normalizeName(alias))
    for (const match of aliasMatches || []) {
      const updated = (nameMatches.get(match) || 0) + cachedRowNameMatchScore(candidate, match) + 20
      nameMatches.set(match, Math.max(nameMatches.get(match) || 0, updated))
    }
  }

  if (nameMatches.size === 0) return null

  let best: CachedEntityRow | null = null
  let bestScore = 0
  for (const [match, score] of nameMatches.entries()) {
    if (!best || score > bestScore) {
      best = match
      bestScore = score
    }
  }

  return best
}

function cacheIndexFromRows(rows: CachedEntityRow[]): {
  byGraph: Map<string, CachedEntityRow>
  byKey: Map<string, CachedEntityRow[]>
  byPrimaryName: Map<string, CachedEntityRow[]>
  byName: Map<string, CachedEntityRow[]>
  byAlias: Map<string, CachedEntityRow[]>
} {
  const byGraph = new Map<string, CachedEntityRow>()
  const byKey = new Map<string, CachedEntityRow[]>()
  const byPrimaryName = new Map<string, CachedEntityRow[]>()
  const byName = new Map<string, CachedEntityRow[]>()
  const byAlias = new Map<string, CachedEntityRow[]>()

  for (const row of rows) {
    const canonicalId = stableEntityId(row)
    if (canonicalId) byGraph.set(canonicalId, row)

    for (const key of buildCanonicalCandidateRows(row)) {
      if (key === '||') continue
      const bucket = byKey.get(key) ?? []
      bucket.push(row)
      byKey.set(key, bucket)
    }

    const primaryNameKey = normalizeName(String((row.properties || {}).name || ''))
    if (primaryNameKey) {
      const primaryBucket = byPrimaryName.get(primaryNameKey) ?? []
      primaryBucket.push(row)
      byPrimaryName.set(primaryNameKey, primaryBucket)
    }

    for (const candidate of cachedEntityNames(row)) {
      const nameKey = normalizeName(candidate)
      if (!nameKey) continue
      const nameBucket = byName.get(nameKey) ?? []
      const aliasBucket = byAlias.get(nameKey) ?? []
      nameBucket.push(row)
      aliasBucket.push(row)
      byName.set(nameKey, nameBucket)
      byAlias.set(nameKey, aliasBucket)
    }
  }

  return { byGraph, byKey, byPrimaryName, byName, byAlias }
}

async function swapCachedIdsForSemanticMatch(
  sourceRow: CachedEntityRow,
  targetRow: CachedEntityRow,
  desiredId: string,
  dryRun: boolean,
  supabaseCachedByGraphId: Map<string, CachedEntityRow>,
  supabaseCachedBySemantic: Map<string, CachedEntityRow>,
): Promise<{ swapped: boolean; errors: string[] }> {
  const sourceCurrent = stableEntityId(sourceRow)
  const targetCurrent = stableEntityId(targetRow)
  if (sourceCurrent !== desiredId || sourceCurrent === targetCurrent) {
    return { swapped: false, errors: ['source row no longer owns desired id'] }
  }

  const now = new Date().toISOString()

  if (dryRun) {
    return { swapped: true, errors: [] }
  }

  const sourceProps = { ...(sourceRow.properties || {}), remediated_id_collision_to: targetCurrent, remediated_id_collision_from: sourceCurrent, remediated_id_collision_at: now }
  const targetProps = { ...(targetRow.properties || {}), remediated_id_collision_to: sourceCurrent, remediated_id_collision_from: targetCurrent, remediated_id_collision_at: now }
  const sourceLabels = Array.isArray(sourceRow.labels) ? [...sourceRow.labels] : sourceRow.labels
  const targetLabels = Array.isArray(targetRow.labels) ? [...targetRow.labels] : targetRow.labels

  const supabase = getSupabaseAdmin()
  const sourceSwap = await supabase
    .from('cached_entities')
    .update({ labels: targetLabels, properties: targetProps, updated_at: now })
    .eq('id', sourceRow.id)

  if (sourceSwap.error) return { swapped: false, errors: [sourceSwap.error.message] }

  const targetSwap = await supabase
    .from('cached_entities')
    .update({ labels: sourceLabels, properties: sourceProps, updated_at: now })
    .eq('id', targetRow.id)

  if (targetSwap.error) {
    await supabase
      .from('cached_entities')
      .update({ labels: sourceLabels, properties: sourceProps, updated_at: now })
      .eq('id', sourceRow.id)
    return { swapped: false, errors: [targetSwap.error.message] }
  }

  const updatedSource: CachedEntityRow = {
    ...sourceRow,
    labels: targetLabels,
    properties: targetProps,
  }
  const updatedTarget: CachedEntityRow = {
    ...targetRow,
    labels: sourceLabels,
    properties: sourceProps,
  }

  supabaseCachedByGraphId.set(sourceCurrent, updatedTarget)
  supabaseCachedByGraphId.set(targetCurrent, updatedSource)

  const sourceKey = semanticKeyFromCachedRow(updatedSource)
  const targetKey = semanticKeyFromCachedRow(updatedTarget)
  if (sourceKey !== '||') supabaseCachedBySemantic.set(sourceKey, updatedSource)
  if (targetKey !== '||') supabaseCachedBySemantic.set(targetKey, updatedTarget)

  return { swapped: true, errors: [] }
}

function computeIdNameMismatches(cached: CachedEntityRow[], embeddings: EmbeddingRow[]): number {
  const cachedByGraph = new Map<string, CachedEntityRow>()
  for (const row of cached) cachedByGraph.set(stableEntityId(row), row)

  let count = 0
  for (const row of embeddings) {
    const candidate = candidateFromEmbedding(row)
    const embeddingId = getEmbeddingId(row)
    const cachedRow = cachedByGraph.get(embeddingId)
    if (!cachedRow) continue
    const cachedName = normalizeName(cachedRowName(cachedRow))
    const embeddingName = normalizeName(candidate.name)
    if (cachedName && embeddingName && cachedName !== embeddingName) {
      count += 1
    }
  }

  return count
}

function cachedRowName(row: CachedEntityRow): string {
  return String((row.properties || {}).name || '')
}

async function runSemanticMerge(cached: CachedEntityRow[], embeddings: EmbeddingRow[], dryRun: boolean, limit: number): Promise<RemediationSummary> {
  const supabase = getSupabaseAdmin()
  const index = cacheIndexFromRows(cached)
  const cachedByGraphId = index.byGraph
  const cachedBySemantic = new Map<string, CachedEntityRow>()
  for (const [key, rows] of index.byKey.entries()) {
    const unique = rows[rows.length - 1]
    if (unique) cachedBySemantic.set(key, unique)
  }

  const candidates = embeddings
    .map(candidateFromEmbedding)
    .filter((candidate) => !isNoiseCandidate(candidate))

  const limited = candidates.slice(0, limit)

  let inserted = 0
  let updated = 0
  let semanticMatches = 0
  let skippedNoise = candidates.length - limited.length
  let idCollisionsResolved = 0
  let idNameMismatchesResolved = 0

  const inserts: any[] = []
  const updates: any[] = []
  const errors: string[] = []

  for (const candidate of limited) {
    const directMatch = pickBestCachedMatch(candidate, index.byKey, index.byName, index.byAlias)
    const key = semanticKeyFromParts(candidate.name, candidate.sport, candidate.league)

    if (directMatch) {
      const current = cachedByGraphId.get(candidate.source_graph_id)
      if (current && stableEntityId(current) === candidate.source_graph_id && stableEntityId(current) !== stableEntityId(directMatch)) {
        const mismatch = normalizeName(current.properties?.name as string) !== normalizeName(candidate.name)
        if (mismatch) {
          const swap = await swapCachedIdsForSemanticMatch(current, directMatch, candidate.source_graph_id, dryRun, cachedByGraphId, cachedBySemantic)
          if (swap.swapped) {
            idCollisionsResolved += 1
            idNameMismatchesResolved += 1
          }
          if (swap.errors.length > 0) {
            errors.push(...swap.errors)
            continue
          }
        }
      }

      const mergedAliases = new Set<string>([
        ...splitList((directMatch.properties || {}).aliases),
        candidate.name,
        ...candidate.aliases,
      ])
      const sourceEmbeddingIds = new Set<string>([
        ...splitList((directMatch.properties || {}).source_embedding_ids),
        candidate.source_graph_id,
      ])

      const nextProps: Record<string, unknown> = {
        ...(directMatch.properties || {}),
        aliases: Array.from(mergedAliases),
        source_embedding_ids: Array.from(sourceEmbeddingIds),
        source_embedding_count: sourceEmbeddingIds.size,
        remediated_at: new Date().toISOString(),
        remediated_by: 'semantic_merge',
      }
      const directMatchNameNorm = normalizeName(String((directMatch.properties || {}).name || ''))
      const candidateNameNorm = normalizeName(candidate.name)
      const primaryNameExists = (index.byPrimaryName.get(candidateNameNorm) || []).length > 0
      if (candidateNameNorm && candidateNameNorm !== directMatchNameNorm && !primaryNameExists) {
        nextProps.name = candidate.name
        nextProps.normalized_name = candidateNameNorm
      }

      if (!nextProps.sport && candidate.sport) nextProps.sport = candidate.sport
      if (!nextProps.league && candidate.league) {
        nextProps.league = candidate.league
        nextProps.level = candidate.league
        nextProps.parent_league = candidate.league
      }
      if (!nextProps.country && candidate.country) nextProps.country = candidate.country
      if (!nextProps.type && candidate.type) {
        nextProps.type = candidate.type
        nextProps.entity_type = candidate.type
      }

      semanticMatches += 1
      updates.push({ id: directMatch.id, properties: nextProps })
      continue
    }

    const existing = cachedByGraphId.get(candidate.source_graph_id)
    if (existing) {
      const existingName = String((existing.properties || {}).name || '')
      const existingNameNorm = normalizeName(existingName)
      const candidateNameNorm = normalizeName(candidate.name)
      const nameAlreadyPresent = (index.byPrimaryName.get(candidateNameNorm) || []).length > 0

      if (candidateNameNorm && candidateNameNorm !== existingNameNorm && !nameAlreadyPresent) {
        const usedIds = new Set(cachedByGraphId.keys())
        let syntheticId = `sem_${toSyntheticGraphId(candidate)}`
        while (usedIds.has(syntheticId)) {
          syntheticId = `sem_${toSyntheticGraphId({ ...candidate, source_graph_id: `${candidate.source_graph_id}_${crypto.randomBytes(2).toString('hex')}` })}`
        }

        const semanticInsert = toSemanticInsert(candidate, syntheticId)
        inserts.push(semanticInsert)
        const insertedRow: CachedEntityRow = {
          id: syntheticId,
          graph_id: syntheticId,
          neo4j_id: syntheticId,
          labels: semanticInsert.labels,
          properties: semanticInsert.properties as Record<string, unknown>,
        }
        cachedByGraphId.set(syntheticId, insertedRow)
        continue
      }

      const shouldPromoteCandidateName =
        Boolean(candidateNameNorm) &&
        candidateNameNorm !== existingNameNorm

      const nextAliases = [...new Set([...splitList((existing.properties || {}).aliases), existingName, candidate.name, ...candidate.aliases].filter(Boolean))]
      const nextSourceIds = [...new Set([...splitList((existing.properties || {}).source_embedding_ids), candidate.source_graph_id])]

      updates.push({
        id: existing.id,
        properties: {
          ...(existing.properties || {}),
          name: shouldPromoteCandidateName ? candidate.name : existingName || candidate.name,
          normalized_name: shouldPromoteCandidateName ? candidateNameNorm : normalizeName(existingName || candidate.name),
          aliases: nextAliases,
          source_embedding_ids: nextSourceIds,
          source_embedding_count: nextSourceIds.length,
          type: existing.properties?.type || candidate.type,
          entity_type: existing.properties?.entity_type || candidate.type,
          sport: existing.properties?.sport || candidate.sport || null,
          league: existing.properties?.league || candidate.league || null,
          parent_league: existing.properties?.parent_league || candidate.league || null,
          level: existing.properties?.level || candidate.league || null,
          remediated_at: new Date().toISOString(),
        },
      })
      continue
    }

    let targetId = candidate.source_graph_id
    if (!targetId) {
      targetId = `sem_${toSyntheticGraphId(candidate)}`
      candidate.source_graph_id = targetId
    }

    const usedIds = new Set(cachedByGraphId.keys())
    if (usedIds.has(targetId)) {
      idCollisionsResolved += 1
      targetId = `sem_${toSyntheticGraphId(candidate)}`
      while (usedIds.has(targetId)) {
        targetId = `sem_${toSyntheticGraphId({ ...candidate, source_graph_id: `${candidate.source_graph_id}_${crypto.randomBytes(2).toString('hex')}` })}`
      }
    }
    usedIds.add(targetId)
    const semanticInsert = toSemanticInsert(candidate, targetId)
    inserts.push(semanticInsert)
    const insertedRow: CachedEntityRow = {
      id: targetId,
      graph_id: targetId,
      neo4j_id: targetId,
      labels: semanticInsert.labels,
      properties: semanticInsert.properties as Record<string, unknown>,
    }
    cachedByGraphId.set(targetId, insertedRow)
    if (key !== '||') cachedBySemantic.set(key, insertedRow)
  }

  if (!dryRun) {
    for (const update of updates) {
      const { error } = await supabase.from('cached_entities').update({ properties: update.properties, updated_at: new Date().toISOString() }).eq('id', update.id)
      if (!error) updated += 1
      else errors.push(error.message)
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from('cached_entities').insert(inserts)
      if (error) {
        errors.push(error.message)
      } else {
        inserted = inserts.length
      }
    }
  }

  const sample = inserts.slice(0, 25).map((row) => ({
    source_graph_id: String(row.graph_id),
    name: String(row.properties?.name || ''),
    type: String(row.properties?.entity_type || ''),
    sport: String(row.properties?.sport || ''),
    league: String(row.properties?.league || ''),
  }))

  return {
    strategy: 'semantic_merge',
    scanned_embeddings: embeddings.length,
    candidates_processed: limited.length,
    inserted,
    updated: updated,
    skipped_noise: skippedNoise,
    semantic_matches: semanticMatches,
    id_collisions_resolved: idCollisionsResolved,
    id_name_mismatches_resolved: idNameMismatchesResolved,
    sample_candidates: sample,
    errors,
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const requestedLimit = Math.max(1, Number.parseInt(searchParams.get('limit') || '50', 10))

    const [cached, embeddings, relationshipRes] = await Promise.all([
      fetchAllRows<CachedEntityRow>('cached_entities', 'id, graph_id, neo4j_id, labels, properties', Math.min(2000, requestedLimit * 20)),
      fetchAllRows<EmbeddingRow>('entity_embeddings', 'entity_id, entity_type, name, metadata', 1000),
      getSupabaseAdmin().from('entity_relationships').select('id', { head: true, count: 'exact' }),
    ])

    if (relationshipRes.error) throw relationshipRes.error

    const cachedByGraph = new Map<string, CachedEntityRow>()
    const cachedNames = new Set<string>()
    for (const row of cached) {
      cachedByGraph.set(stableEntityId(row), row)
      for (const name of cachedEntityNames(row)) {
        const normalizedName = normalizeName(name)
        if (normalizedName) cachedNames.add(normalizedName)
      }
    }

    const embeddingIds = new Set<string>()
    const mismatchedByName = new Set<string>()
    for (const row of embeddings) {
      const candidate = candidateFromEmbedding(row)
      const embeddingId = getEmbeddingId(row)
      embeddingIds.add(embeddingId)
      const candidateName = normalizeName(candidate.name)
      if (candidateName && !cachedNames.has(candidateName) && !cachedByGraph.has(embeddingId)) {
        mismatchedByName.add(candidateName)
      }
    }

    const cachedNotInEmbeddings = Array.from(cachedByGraph.keys()).filter((id) => !embeddingIds.has(id))

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      counts: {
        cached_entities: cached.length,
        entity_embeddings: embeddings.length,
        entity_relationships: relationshipRes.count || 0,
        overlap_by_graph_id: cached.filter((row) => embeddingIds.has(stableEntityId(row))).length,
      },
      congruence: {
        embeddings_not_in_cached: embeddingIds.size - cached.filter((row) => embeddingIds.has(stableEntityId(row))).length,
        cached_not_in_embeddings: cachedNotInEmbeddings.length,
        normalized_names_in_embeddings_not_cached: mismatchedByName.size,
        id_name_mismatches: computeIdNameMismatches(cached, embeddings),
      },
      taxonomy: {
        sample_missing_by_name: [...mismatchedByName].slice(0, requestedLimit),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'reconciliation GET failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = ((await request.json()) as RemediationPayload | null) || {}
    const action = body.action || 'remediate'
    const dryRun = Boolean(body.dry_run)
    const limit = Math.max(1, Math.min(Number(body.limit || 2500), 10000))
    const strategy: RemediationStrategy = body.strategy || 'semantic_merge'

    if (action !== 'remediate') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const [cached, embeddings] = await Promise.all([
      fetchAllRows<CachedEntityRow>('cached_entities', 'id, graph_id, neo4j_id, labels, properties'),
      fetchAllRows<EmbeddingRow>('entity_embeddings', 'entity_id, entity_type, name, metadata'),
    ])

    if (strategy === 'id_backfill') {
      const cachedIds = new Set(cached.map((row) => stableEntityId(row)))
      const missing = embeddings
        .map((row) => ({ candidate: candidateFromEmbedding(row) }))
        .map((row) => row.candidate)
        .filter((candidate) => candidate.source_graph_id.trim())
        .filter((candidate) => !cachedIds.has(candidate.source_graph_id))
        .filter((candidate) => !isNoiseCandidate(candidate))
        .slice(0, limit)

      const payload = missing.map((candidate) => toSemanticInsert(candidate, candidate.source_graph_id))
      let inserted = 0
      const insertedIds: string[] = []

      if (!dryRun && payload.length > 0) {
        const { error } = await supabase.from('cached_entities').insert(payload)
        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }
        inserted = payload.length
        insertedIds.push(...payload.map((row) => String(row.neo4j_id)))
      }

      return NextResponse.json({
        success: true,
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
          source_graph_id: String(row.neo4j_id),
          name: String(row.properties?.name || ''),
          type: String(row.labels?.[1] || row.labels?.[0] || ''),
          sport: String(row.properties?.sport || ''),
          league: String(row.properties?.league || ''),
        })),
        inserted_rows: insertedIds,
      })
    }

    const result = await runSemanticMerge(cached, embeddings, dryRun, limit)

    return NextResponse.json({
      success: result.errors.length === 0,
      action,
      strategy,
      dry_run: dryRun,
      summary: {
        scanned_embeddings: result.scanned_embeddings,
        candidates_processed: result.candidates_processed,
        inserted: result.inserted,
        updated: result.updated,
        skipped_noise: result.skipped_noise,
        semantic_matches: result.semantic_matches,
        id_collisions_resolved: result.id_collisions_resolved,
        id_name_mismatches_resolved: result.id_name_mismatches_resolved,
      },
      sample_candidates: result.sample_candidates,
      errors: result.errors,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'reconciliation failed',
    }, { status: 500 })
  }
}
