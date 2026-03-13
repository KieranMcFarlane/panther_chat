import { NextRequest, NextResponse } from 'next/server'
import { searchEntityEmbeddings } from '@/lib/embeddings'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'

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
  entity_id: string
  name: string
  type: string
  metadata: Record<string, any>
  lexical_score: number
  semantic_score: number
  metadata_boost: number
  final_score: number
}

function normalize(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  return 0
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

function buildKey(name: string, type: string): string {
  return `${normalize(name)}::${normalize(type)}`
}

async function loadLexicalCandidates(
  query: string,
  filters: FilterInput,
  poolSize: number
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

  return data.map((row: any) => {
    const metadata = {
      ...(row.properties || {}),
      sport: row.sport || '',
      league: row.league || '',
      country: row.country || '',
      entity_type: row.entity_type || '',
      aliases: Array.isArray(row.aliases) ? row.aliases : [],
    }
    const lexical_score = lexicalScore(query, row.name || '', metadata.aliases)
    const metadata_boost = facetBoost(metadata, filters)
    const semantic_score = 0
    const final_score = lexical_score * 0.5 + semantic_score * 0.25 + metadata_boost * 0.25

    return {
      id: String(row.id),
      entity_id: String(row.id),
      name: row.name || String(row.id),
      type: row.entity_type || 'unknown',
      metadata,
      lexical_score,
      semantic_score,
      metadata_boost,
      final_score,
    }
  })
}

export async function POST(request: NextRequest) {
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

    if (!query) {
      return NextResponse.json({
        results: [],
        total: 0,
        query: '',
        search_strategy: 'hybrid_v2',
        note: 'empty_query',
      })
    }

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
        const lexical_score = lexicalScore(query, row.name || '', Array.isArray(metadata.aliases) ? metadata.aliases : [])
        const semantic_score = Math.max(0, Math.min(100, Number(row.similarity || 0) * 100))
        const metadata_boost = facetBoost(metadata, filters)
        const final_score = lexical_score * 0.5 + semantic_score * 0.25 + metadata_boost * 0.25
        return {
          id: String(row.id),
          entity_id: String(row.entity_id || row.id),
          name: row.name || String(row.entity_id || row.id),
          type: row.entity_type || metadata.entity_type || 'unknown',
          metadata,
          lexical_score,
          semantic_score,
          metadata_boost,
          final_score,
        }
      })
      .filter((candidate) => passesFacetFilter({ ...candidate.metadata, type: candidate.type }, filters))

    const lexicalCandidates = await loadLexicalCandidates(query, filters, Math.min(limit * 8, 120))

    const merged = new Map<string, Candidate>()
    for (const candidate of [...lexicalCandidates, ...semanticCandidates]) {
      const key = buildKey(candidate.name, candidate.type)
      const existing = merged.get(key)
      if (!existing) {
        merged.set(key, candidate)
        continue
      }
      const mergedCandidate: Candidate = {
        ...existing,
        id: existing.id || candidate.id,
        entity_id: existing.entity_id || candidate.entity_id,
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
      .sort((a, b) => b.final_score - a.final_score || b.lexical_score - a.lexical_score || a.name.localeCompare(b.name))
      .slice(0, limit)

    return NextResponse.json({
      query,
      total: ranked.length,
      search_strategy: 'hybrid_v2',
      semantic_enabled,
      ...(note ? { note } : {}),
      results: ranked.map((candidate) => ({
        id: candidate.id,
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
    console.error('❌ Vector search error:', error)
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
