import { NextRequest, NextResponse } from 'next/server'
import { searchEntityEmbeddings } from '@/lib/embeddings'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { buildCanonicalEntitySearchText } from '@/lib/canonical-search'
import { getCanonicalEntityKey } from '@/lib/entity-canonicalization'
import { getCanonicalEntityRole } from '@/lib/entity-role-taxonomy'
import { resolveEntityUuid } from '@/lib/entity-public-id'
import { recordVectorSearchMetric } from '@/lib/vector-search-observability'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type FilterInput = {
  entity_types?: string[] | null
  entity_type?: string | null
  sport?: string | null
  league?: string | null
  country?: string | null
}

type Candidate = {
  id: string
  uuid: string
  entity_id: string
  canonical_entity_id: string
  name: string
  type: string
  role: string
  canonical_key: string
  searchText: string
  metadata: Record<string, any>
  lexical_score: number
  semantic_score: number
  metadata_boost: number
  final_score: number
}

type QueryIntent = {
  impliedLeague?: string
  impliedEntityType?: string
}

type CanonicalSearchLookup = Map<string, {
  id: string
  canonical_key: string
  name: string
  entity_type: string
  sport: string
  country: string
  league: string
  quality_score: number
}>

const SEARCH_STOP_TOKENS = new Set([
  'fc',
  'cf',
  'club',
  'team',
  'json',
  'seed',
  'jsonseed',
  'the',
])

const SEARCH_SPORT_TOKENS = new Set([
  'football',
  'soccer',
  'basketball',
  'baseball',
  'cricket',
  'tennis',
  'rugby',
  'hockey',
  'handball',
  'volleyball',
  'cycling',
  'athletics',
  'equestrian',
  'motorsport',
  'formula',
  'golf',
  'f1',
])

function boundedLevenshtein(a: string, b: string, maxDistance = 3): number {
  if (a === b) return 0
  const alen = a.length
  const blen = b.length
  if (Math.abs(alen - blen) > maxDistance) return maxDistance + 1

  const prev = new Array(blen + 1)
  const curr = new Array(blen + 1)
  for (let j = 0; j <= blen; j += 1) prev[j] = j

  for (let i = 1; i <= alen; i += 1) {
    curr[0] = i
    let rowMin = curr[0]
    for (let j = 1; j <= blen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      )
      rowMin = Math.min(rowMin, curr[j])
    }
    if (rowMin > maxDistance) return maxDistance + 1
    for (let j = 0; j <= blen; j += 1) prev[j] = curr[j]
  }

  return prev[blen]
}

function fuzzySimilarity(query: string, value: string): number {
  const q = normalize(query)
  const v = normalize(value)
  if (!q || !v) return 0
  if (q.length < 4 || v.length < 4) return 0
  const maxLen = Math.max(q.length, v.length)
  const maxDistance = Math.min(4, Math.floor(maxLen * 0.35))
  const distance = boundedLevenshtein(q, v, maxDistance)
  if (distance > maxDistance) return 0
  return Math.max(0, 1 - distance / maxLen)
}

function normalize(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSearchName(value: string | null | undefined, type: string | null | undefined): string {
  const normalizedType = normalize(type)
  const normalizedValue = normalize(value)
  const stripSportTokens = normalizedType.includes('club')
    || normalizedType.includes('team')
    || normalizedType.includes('league')
    || normalizedType.includes('competition')
    || normalizedType.includes('federation')
    || /\bclub\b|\bteam\b|\bfc\b|\bcf\b/.test(normalizedValue)

  return normalizedValue
    .split(' ')
    .filter(Boolean)
    .filter((token) => !SEARCH_STOP_TOKENS.has(token))
    .filter((token) => !(stripSportTokens && SEARCH_SPORT_TOKENS.has(token)))
    .map((token) => {
      if (!/[a-z]/.test(token) || token.length <= 3) {
        return token
      }
      return token[0] + token.slice(1).replace(/[aeiou]/g, '')
    })
    .join(' ')
}

function buildCanonicalSearchKeys(name: string, type: string, sport: string, country: string, league: string): string[] {
  const normalizedName = normalizeSearchName(name, type)
  const normalizedSport = normalize(sport)
  const normalizedCountry = normalize(country)
  const normalizedLeague = normalize(league)

  const keyParts = [
    [normalizedName, normalizedSport, normalizedCountry, normalizedLeague],
    [normalizedName, normalizedSport, normalizedCountry],
    [normalizedName, normalizedSport],
    [normalizedName],
  ]

  return keyParts
    .map((parts) => parts.filter(Boolean).join('|'))
    .filter(Boolean)
}

function pickCanonicalSearchEntity(candidate: any, canonicalLookup: CanonicalSearchLookup): any | null {
  const properties = candidate?.properties || {}
  const keys = buildCanonicalSearchKeys(
    candidate?.name || properties.name || '',
    candidate?.type || properties.type || candidate?.entity_type || properties.entity_type || '',
    candidate?.sport || properties.sport || '',
    candidate?.country || properties.country || '',
    candidate?.league || properties.league || properties.level || '',
  )

  for (const key of keys) {
    const canonicalEntity = canonicalLookup.get(key)
    if (canonicalEntity) return canonicalEntity
  }

  return null
}

async function loadCanonicalSearchLookup(): Promise<CanonicalSearchLookup> {
  const canonicalEntities = await getCanonicalEntitiesSnapshot()
  const lookup: CanonicalSearchLookup = new Map()

  for (const entity of canonicalEntities) {
    const properties = entity.properties || {}
    const keys = buildCanonicalSearchKeys(
      entity.name || properties.name || '',
      entity.entity_type || properties.type || '',
      entity.sport || properties.sport || '',
      entity.country || properties.country || '',
      entity.league || properties.league || properties.level || '',
    )

    const qualityScore = Number((entity as any).quality_score || 0)
    for (const key of keys) {
      const existing = lookup.get(key)
      if (!existing || qualityScore > existing.quality_score) {
        lookup.set(key, {
          id: String(entity.id),
          canonical_key: String((entity as any).canonical_key || ''),
          name: String(entity.name || properties.name || entity.id),
          entity_type: String(entity.entity_type || properties.type || ''),
          sport: String(entity.sport || properties.sport || ''),
          country: String(entity.country || properties.country || ''),
          league: String(entity.league || properties.league || properties.level || ''),
          quality_score: qualityScore,
        })
      }
    }
  }

  return lookup
}

function includesNormalized(haystack: string, needle: string): boolean {
  if (!needle) return true
  return normalize(haystack).includes(normalize(needle))
}

function lexicalScore(query: string, name: string, aliases: string[] = []): number {
  if (!query) return 0
  const q = normalize(query)
  const n = normalize(name)
  if (!q || !n) return 0
  if (n === q) return 100
  if (aliases.map(normalize).includes(q)) return 92
  if (n.startsWith(q)) return 82
  if (aliases.some((alias) => normalize(alias).startsWith(q))) return 76
  if (n.includes(q)) return 64
  if (aliases.some((alias) => normalize(alias).includes(q))) return 56
  const fuzzy = Math.max(
    fuzzySimilarity(q, n),
    ...aliases.map((alias) => fuzzySimilarity(q, alias)),
  )
  if (fuzzy >= 0.84) return 48
  if (fuzzy >= 0.74) return 36
  return 0
}

function searchTextBoost(query: string, searchText: string): number {
  if (!query || !searchText) return 0
  const normalizedQuery = normalize(query)
  const normalizedSearchText = normalize(searchText)
  if (!normalizedQuery || !normalizedSearchText) return 0

  if (normalizedSearchText === normalizedQuery) return 22
  if (normalizedSearchText.startsWith(normalizedQuery)) return 16
  if (normalizedSearchText.includes(normalizedQuery)) return 12
  return 0
}

function roleBoost(role: string, query: string, searchText: string): number {
  const normalizedQuery = normalize(query)
  const normalizedSearchText = normalize(searchText)
  const normalizedRole = normalize(role)
  if (!normalizedQuery || !normalizedRole) return 0

  let boost = 0

  if (normalizedSearchText.includes(normalizedRole)) {
    boost += 6
  }

  if (normalizedRole === 'league' && /\bleague\b|\bdivision\b|\bconference\b|\bpremiership\b/.test(normalizedQuery)) {
    boost += 14
  }
  if (normalizedRole === 'competition' && /\bcompetition\b|\bchampionship\b|\bcup\b|\btournament\b|\bseries\b|\bopen\b|\bgames\b|\bgrand prix\b/.test(normalizedQuery)) {
    boost += 14
  }
  if (normalizedRole === 'federation' && /\bfederation\b|\bassociation\b|\bunion\b|\bgoverning\b|\brightsholder\b|\bcommittee\b/.test(normalizedQuery)) {
    boost += 14
  }
  if (normalizedRole === 'club' && /\bclub\b|\bfc\b|\bcf\b/.test(normalizedQuery)) {
    boost += 10
  }
  if (normalizedRole === 'team' && /\bteam\b|\bsquad\b/.test(normalizedQuery)) {
    boost += 10
  }

  return boost
}

function facetBoost(metadata: Record<string, any>, filters: FilterInput): number {
  let boost = 0
  if (filters.sport && includesNormalized(String(metadata.sport || ''), filters.sport)) boost += 20
  if (filters.entity_type && includesNormalized(String(metadata.entity_type || metadata.type || ''), filters.entity_type)) boost += 20
  if (filters.league && includesNormalized(String(metadata.league || ''), filters.league)) boost += 30
  if (filters.country && includesNormalized(String(metadata.country || ''), filters.country)) boost += 15
  return Math.min(100, boost)
}

function passesFacetFilter(metadata: Record<string, any>, filters: FilterInput): boolean {
  if (filters.sport && !includesNormalized(String(metadata.sport || ''), filters.sport)) return false
  if (filters.league && !includesNormalized(String(metadata.league || ''), filters.league)) return false
  if (filters.country && !includesNormalized(String(metadata.country || ''), filters.country)) return false

  const requestedTypes = [
    ...(Array.isArray(filters.entity_types) ? filters.entity_types : []),
    ...(filters.entity_type ? [filters.entity_type] : []),
  ]
    .map((value) => normalize(value))
    .filter(Boolean)

  if (requestedTypes.length > 0) {
    const entityType = normalize(String(metadata.entity_type || metadata.type || ''))
    if (!requestedTypes.some((type) => entityType.includes(type))) {
      return false
    }
  }

  return true
}

function buildKey(candidate: Candidate): string {
  return (
    candidate.canonical_entity_id ||
    candidate.canonical_key ||
    candidate.uuid ||
    candidate.entity_id ||
    `${normalize(candidate.name)}::${normalize(candidate.role || candidate.type)}`
  )
}

function deriveIntent(query: string): QueryIntent {
  const normalized = normalize(query)
  const intent: QueryIntent = {}

  if (/\bipl\b/.test(normalized) || normalized.includes('indian premier league')) {
    intent.impliedLeague = 'Indian Premier League'
  } else if (/\bepl\b/.test(normalized) || normalized.includes('premier league')) {
    intent.impliedLeague = 'Premier League'
  }

  if (
    normalized.includes('franchise') ||
    normalized.includes('team') ||
    normalized.includes('teams') ||
    normalized.includes('clubs') ||
    normalized.includes('club')
  ) {
    intent.impliedEntityType = 'team'
  }

  return intent
}

function isMeaningfulCandidate(candidate: Candidate): boolean {
  return (
    candidate.lexical_score >= 20 ||
    candidate.semantic_score >= 8 ||
    candidate.metadata_boost >= 20 ||
    candidate.final_score >= 8
  )
}

async function loadLexicalCandidates(
  query: string,
  filters: FilterInput,
  poolSize: number,
  canonicalLookup: CanonicalSearchLookup
): Promise<Candidate[]> {
  const probe = await supabase.from('canonical_entities').select('id').limit(1)
  const useCanonical = !probe.error
  if (!useCanonical) return []

  let dbQuery = supabase.from('canonical_entities').select('*').limit(poolSize)

  if (query) {
    const safe = query.replace(/[,%]/g, ' ').trim()
    dbQuery = dbQuery.or(
      `name.ilike.%${safe}%,normalized_name.ilike.%${safe}%,sport.ilike.%${safe}%,league.ilike.%${safe}%,country.ilike.%${safe}%`
    )
  }

  if (filters.sport) dbQuery = dbQuery.ilike('sport', `%${filters.sport}%`)
  if (filters.league) dbQuery = dbQuery.ilike('league', `%${filters.league}%`)
  if (filters.country) dbQuery = dbQuery.ilike('country', `%${filters.country}%`)
  if (filters.entity_type) dbQuery = dbQuery.ilike('entity_type', `%${filters.entity_type}%`)

  const { data, error } = await dbQuery.order('quality_score', { ascending: false })
  if (error || !data) return []

  let rows = data
  if (rows.length === 0) {
    const intent = deriveIntent(query)
    let fallbackQuery = supabase.from('canonical_entities').select('*').limit(poolSize)
    if (filters.sport) fallbackQuery = fallbackQuery.ilike('sport', `%${filters.sport}%`)
    if (filters.league) fallbackQuery = fallbackQuery.ilike('league', `%${filters.league}%`)
    if (filters.country) fallbackQuery = fallbackQuery.ilike('country', `%${filters.country}%`)
    if (filters.entity_type) fallbackQuery = fallbackQuery.ilike('entity_type', `%${filters.entity_type}%`)
    if (intent.impliedLeague) fallbackQuery = fallbackQuery.ilike('league', `%${intent.impliedLeague}%`)
    if (intent.impliedEntityType) fallbackQuery = fallbackQuery.eq('entity_type', intent.impliedEntityType)
    const { data: fallbackRows, error: fallbackError } = await fallbackQuery.order('quality_score', { ascending: false })
    if (!fallbackError && fallbackRows) rows = fallbackRows
  }

  return rows.map((row: any) => {
    const properties = row.properties || {}
    const metadata = {
      ...properties,
      sport: row.sport || properties.sport || '',
      league: row.league || properties.league || '',
      country: row.country || properties.country || '',
      entity_type: row.entity_type || properties.entity_type || '',
      canonical_entity_id: row.canonical_entity_id || properties.canonical_entity_id || '',
      aliases: Array.isArray(row.aliases) ? row.aliases : [],
    }
    const lexical_score = lexicalScore(query, row.name || '', metadata.aliases)
    const metadata_boost = facetBoost(metadata, filters)
    const semantic_score = 0
    const sourceEntity = {
      id: row.id,
      uuid: row.uuid,
      entity_uuid: row.entity_uuid,
      graph_id: row.graph_id,
      neo4j_id: row.neo4j_id,
      properties: {
        ...metadata,
        name: row.name || properties.name || '',
        type: row.entity_type || properties.type || metadata.entity_type || 'unknown',
      },
    }
    const canonicalSearchEntity = pickCanonicalSearchEntity(sourceEntity, canonicalLookup)
    const role = getCanonicalEntityRole(sourceEntity)
    const searchText = buildCanonicalEntitySearchText(sourceEntity)
    const canonical_key =
      canonicalSearchEntity?.canonical_key ||
      getCanonicalEntityKey(sourceEntity) ||
      resolveEntityUuid(sourceEntity) ||
      `${normalize(row.name || '')}::${normalize(role || row.entity_type || '')}`
    const final_score = lexical_score * 0.4 + semantic_score * 0.3 + (metadata_boost + searchTextBoost(query, searchText) + roleBoost(role, query, searchText)) * 0.3

    return {
      id: String(canonicalSearchEntity?.id || resolveEntityUuid(sourceEntity) || row.id),
      uuid: String(canonicalSearchEntity?.id || resolveEntityUuid(sourceEntity) || row.uuid || row.id),
      entity_id: String(row.entity_id || row.id),
      canonical_entity_id: String(
        canonicalSearchEntity?.id ||
        row.canonical_entity_id ||
        properties.canonical_entity_id ||
        resolveEntityUuid(sourceEntity) ||
        row.id,
      ),
      name: row.name || String(row.id),
      type: canonicalSearchEntity?.entity_type || (role !== 'Unknown' ? role : (row.entity_type || metadata.entity_type || 'unknown')),
      role,
      canonical_key,
      searchText,
      metadata,
      lexical_score,
      semantic_score,
      metadata_boost,
      final_score,
    }
  })
}

export async function POST(request: NextRequest) {
  const request_started_at = Date.now()
  const request_id = globalThis.crypto?.randomUUID?.() || `vs_${request_started_at}`
  try {
    const body = await request.json()
    const query = String(body?.query || '').trim()
    const limit = Math.max(1, Math.min(Number(body?.limit || 10), 100))
    const score_threshold = Math.max(0, Math.min(Number(body?.score_threshold ?? 0.15), 1))

    const filters: FilterInput = {
      entity_types: Array.isArray(body?.entity_types) ? body.entity_types : null,
      entity_type: body?.entity_type || null,
      sport: body?.sport || null,
      league: body?.league || null,
      country: body?.country || null,
    }

    console.info(
      JSON.stringify({
        event: 'vector_search_request',
        request_id,
        query,
        limit,
        score_threshold,
        filters,
      }),
    )

    if (!query) {
      return NextResponse.json({
        results: [],
        total: 0,
        query: '',
        search_strategy: 'hybrid_v2',
        note: 'empty_query',
      })
    }

    const canonicalLookup = await loadCanonicalSearchLookup()

    const requestedEntityTypes = [
      ...(filters.entity_types || []),
      ...(filters.entity_type ? [filters.entity_type] : []),
    ].filter(Boolean)
    const semantic_enabled = Boolean(process.env.OPENAI_API_KEY)
    let semanticRows: any[] = []
    let note: string | undefined
    if (semantic_enabled) {
      semanticRows = await searchEntityEmbeddings(query, {
        entityTypes: requestedEntityTypes.length > 0 ? requestedEntityTypes : undefined,
        matchThreshold: Math.max(0.05, score_threshold * 0.7),
        matchCount: Math.min(limit * 8, 80),
      })
    } else {
      note = 'semantic_unavailable_lexical_only'
    }

    const semanticCandidates: Candidate[] = semanticRows
      .map((row: any) => {
        const metadata = { ...(row.metadata || {}) }
        const sourceEntity = {
          id: row.id,
          uuid: row.uuid,
          canonical_entity_id: row.canonical_entity_id || row.metadata?.canonical_entity_id,
          entity_uuid: row.entity_uuid,
          graph_id: row.graph_id,
          neo4j_id: row.neo4j_id,
          properties: {
            ...metadata,
            name: row.name || metadata.name || '',
            type: row.entity_type || metadata.entity_type || metadata.type || 'unknown',
          },
        }
        const canonicalSearchEntity = pickCanonicalSearchEntity({
          name: row.name || metadata.name || '',
          type: metadata.properties?.type || row.entity_type || metadata.entity_type || metadata.type || 'unknown',
          sport: metadata.properties?.sport || row.sport || metadata.sport || '',
          country: metadata.properties?.country || row.country || metadata.country || '',
          league: metadata.properties?.league || metadata.properties?.level || row.league || metadata.league || '',
          properties: metadata.properties || {},
        }, canonicalLookup)
        const lexical_score = lexicalScore(query, row.name || '', Array.isArray(metadata.aliases) ? metadata.aliases : [])
        const semantic_score = Math.max(0, Math.min(100, Number(row.similarity || 0) * 100))
        const role = getCanonicalEntityRole(sourceEntity)
        const searchText = buildCanonicalEntitySearchText(sourceEntity)
        const metadata_boost = facetBoost(metadata, filters) + searchTextBoost(query, searchText) + roleBoost(role, query, searchText)
        const final_score = lexical_score * 0.4 + semantic_score * 0.3 + metadata_boost * 0.3
        const canonical_key =
          canonicalSearchEntity?.canonical_key ||
          getCanonicalEntityKey(sourceEntity) ||
          resolveEntityUuid(sourceEntity) ||
          `${normalize(row.name || '')}::${normalize(role || row.entity_type || metadata.entity_type || '')}`
        return {
          id: String(canonicalSearchEntity?.id || resolveEntityUuid(sourceEntity) || row.id),
          uuid: String(canonicalSearchEntity?.id || resolveEntityUuid(sourceEntity) || row.uuid || row.entity_id || row.id),
          entity_id: String(row.entity_id || row.id),
          canonical_entity_id: String(
            canonicalSearchEntity?.id ||
            row.canonical_entity_id ||
            row.metadata?.canonical_entity_id ||
            resolveEntityUuid(sourceEntity) ||
            row.id,
          ),
          name: row.name || String(row.entity_id || row.id),
          type: canonicalSearchEntity?.entity_type || (role !== 'Unknown' ? role : (row.entity_type || metadata.entity_type || 'unknown')),
          role,
          canonical_key,
          searchText,
          metadata,
          lexical_score,
          semantic_score,
          metadata_boost,
          final_score,
        }
      })
      .filter((candidate) => passesFacetFilter({ ...candidate.metadata, type: candidate.type }, filters))

    const lexicalCandidates = await loadLexicalCandidates(query, filters, Math.min(limit * 8, 120), canonicalLookup)

    const merged = new Map<string, Candidate>()
    for (const candidate of [...lexicalCandidates, ...semanticCandidates]) {
      const key = buildKey(candidate)
      const existing = merged.get(key)
      if (!existing) {
        merged.set(key, candidate)
        continue
      }
      const mergedCandidate: Candidate = {
        ...existing,
        id: existing.id || candidate.id,
        entity_id: existing.entity_id || candidate.entity_id,
        uuid: existing.uuid || candidate.uuid,
        canonical_key: existing.canonical_key || candidate.canonical_key,
        role: existing.role || candidate.role,
        searchText: existing.searchText || candidate.searchText,
        metadata: { ...candidate.metadata, ...existing.metadata },
        lexical_score: Math.max(existing.lexical_score, candidate.lexical_score),
        semantic_score: Math.max(existing.semantic_score, candidate.semantic_score),
        metadata_boost: Math.max(existing.metadata_boost, candidate.metadata_boost),
        final_score: 0,
      }
      mergedCandidate.final_score =
        mergedCandidate.lexical_score * 0.5 +
        mergedCandidate.semantic_score * 0.25 +
        mergedCandidate.metadata_boost * 0.25
      merged.set(key, mergedCandidate)
    }

    const ranked = Array.from(merged.values())
      .filter((candidate) => isMeaningfulCandidate(candidate))
      .sort((a, b) => b.final_score - a.final_score || b.lexical_score - a.lexical_score || a.name.localeCompare(b.name))
      .slice(0, limit)

    const duration_ms = Date.now() - request_started_at
    const observability = recordVectorSearchMetric({
      duration_ms,
      result_count: ranked.length,
      top_score: ranked[0]?.final_score || 0,
      semantic_enabled,
    })
    console.info(
      JSON.stringify({
        event: 'vector_search_response',
        request_id,
        query,
        duration_ms,
        semantic_enabled,
        lexical_candidates: lexicalCandidates.length,
        semantic_candidates: semanticCandidates.length,
        merged_candidates: merged.size,
        returned: ranked.length,
        top_result: ranked[0]?.name || null,
        observability,
      }),
    )

    return NextResponse.json({
      query,
      total: ranked.length,
      search_strategy: 'hybrid_v2',
      semantic_enabled,
      ...(note ? { note } : {}),
      results: ranked.map((candidate) => ({
        id: candidate.id,
        uuid: candidate.uuid,
        entity_id: candidate.entity_id,
        name: candidate.name,
        type: candidate.type,
        score: Number((candidate.final_score / 100).toFixed(4)),
        lexical_score: candidate.lexical_score,
        semantic_score: candidate.semantic_score,
        metadata_boost: candidate.metadata_boost,
        final_score: Number(candidate.final_score.toFixed(2)),
        metadata: candidate.metadata,
      })),
    })
  } catch (error: any) {
    const duration_ms = Date.now() - request_started_at
    console.error(
      JSON.stringify({
        event: 'vector_search_error',
        request_id,
        duration_ms,
        error: error?.message || 'Unknown error',
      }),
    )
    return NextResponse.json(
      {
        results: [],
        total: 0,
        query: '',
        search_strategy: 'hybrid_v2',
        note: 'internal_error',
        error: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Hybrid vector search API endpoint',
    usage:
      'POST /api/vector-search { query, limit?, score_threshold?, entity_types?, entity_type?, sport?, league?, country? }',
  })
}
