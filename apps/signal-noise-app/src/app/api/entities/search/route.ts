import { NextRequest, NextResponse } from 'next/server'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { buildCanonicalEntitySearchText } from '@/lib/canonical-search'
import { resolveGraphId } from '@/lib/graph-id'
import { resolveEntityUuid } from '@/lib/entity-public-id'
import { getCanonicalEntityRole } from '@/lib/entity-role-taxonomy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SearchEntity = {
  id: string
  uuid: string
  graph_id: string
  name: string
  type: string
  sport: string
  country: string
}

function buildVectorBackedFallbackSearch(search: string, value: string): number {
  if (!search) return 0
  const normalizedSearch = search.toLowerCase()
  const normalizedValue = value.toLowerCase()
  if (normalizedValue === normalizedSearch) return 100
  if (normalizedValue.startsWith(normalizedSearch)) return 80
  if (normalizedValue.includes(normalizedSearch)) return 60
  return 0
}

function fieldMatchScore(search: string, value: unknown): number {
  const normalizedSearch = search.trim().toLowerCase()
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (!normalizedSearch || !normalizedValue) return 0
  if (normalizedValue === normalizedSearch) return 100
  if (normalizedValue.startsWith(normalizedSearch)) return 85
  if (normalizedValue.includes(normalizedSearch)) return 70

  const searchTokens = normalizedSearch.split(/\s+/).filter(Boolean)
  if (searchTokens.length > 1 && searchTokens.every((token) => normalizedValue.includes(token))) {
    return 60
  }

  return 0
}

function toCanonicalSearchEntity(entity: any) {
  const uuid = entity.canonical_entity_id || resolveEntityUuid({
    id: entity.id,
    neo4j_id: entity.neo4j_id,
    graph_id: entity.graph_id,
    uuid: entity.uuid,
    supabase_id: entity.properties?.supabase_id,
    properties: entity.properties,
  }) || resolveGraphId(entity) || entity.id

  return {
    id: String(entity.canonical_entity_id || entity.id || uuid),
    uuid: String(uuid),
    neo4j_id: entity.neo4j_id ?? entity.id,
    labels: Array.isArray(entity.labels) ? entity.labels : [],
    properties: {
      ...(entity.properties || {}),
      name: entity.properties?.name || uuid || `Entity ${entity.id}`,
      type: entity.properties?.type || entity.labels?.[0] || 'Unknown',
      canonical_entity_id: entity.canonical_entity_id || entity.properties?.canonical_entity_id || null,
    },
  }
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'browse'
    const search = (searchParams.get('search') || '').trim()
    const defaultLimit = mode === 'autocomplete' ? 8 : 20
    const limit = Math.max(1, Math.min(Math.floor(parseInt(searchParams.get('limit') || String(defaultLimit))), 100))
    const canonicalized = (await getCanonicalEntitiesSnapshot()).map((entity: any) => toCanonicalSearchEntity({
      id: entity.id,
      uuid: entity.uuid,
      neo4j_id: entity.neo4j_id,
      labels: entity.labels,
      properties: entity.properties,
      canonical_entity_id: entity.id,
    }))

    const ranked = canonicalized.map((entity: any) => {
      const uuid = String(entity.uuid || entity.id)
      const name = entity.properties?.name || uuid || `Entity ${entity.id}`
      const type = entity.properties?.type || entity.labels?.[0] || 'Unknown'
      const sport = entity.properties?.sport || ''
      const country = entity.properties?.country || ''
      const entity_role = getCanonicalEntityRole(entity)
      const normalizedSearch = search.toLowerCase()
      const lexicalScore = buildVectorBackedFallbackSearch(search, String(name))
      const canonicalSearchText = buildCanonicalEntitySearchText(entity)
      const searchScore = search
        ? Math.max(
            fieldMatchScore(search, name),
            fieldMatchScore(search, entity_role),
            fieldMatchScore(search, sport),
            fieldMatchScore(search, country),
            fieldMatchScore(search, entity.properties?.league || entity.properties?.competition || entity.properties?.level),
            fieldMatchScore(search, canonicalSearchText),
          )
        : 0
      const roleBoost =
        (normalizedSearch.includes('league') && entity_role.toLowerCase() === 'league') ||
        (normalizedSearch.includes('competition') && entity_role.toLowerCase() === 'competition') ||
        (normalizedSearch.includes('federation') && entity_role.toLowerCase() === 'federation') ||
        (normalizedSearch.includes('club') && entity_role.toLowerCase() === 'club') ||
        (normalizedSearch.includes('team') && entity_role.toLowerCase() === 'team')
          ? 20
          : 0
      const popularityScore = Number(entity.properties?.priorityScore || entity.properties?.yellowPantherPriority || 0)
      return ({
        id: uuid,
        uuid,
        graph_id: resolveGraphId(entity) || entity.id,
        name,
        type,
        sport,
        country,
        entity_role,
        _score: search ? (searchScore * 1000) + roleBoost + popularityScore + lexicalScore : popularityScore + lexicalScore
      })
    })
      .filter((entity) => !search || entity._score > 0)

    ranked.sort((a, b) => b._score - a._score || a.name.localeCompare(b.name))
    const windowed = ranked.slice(0, limit)

    const entities: SearchEntity[] = windowed.map(({ _score: _unused, ...entity }) => entity)
    const hasMore = ranked.length > entities.length
    const latencyMs = Date.now() - startedAt

    return NextResponse.json({
      success: true,
      entities,
      mode,
      total: entities.length,
      has_more: hasMore,
      total_estimate: ranked.length,
      latency_ms: latencyMs,
      search_strategy: search ? 'vector_fallback' : 'popular',
      source: 'supabase',
    })
  } catch (error) {
    console.error('Error fetching entities:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch entities',
      },
      { status: 500 }
    )
  }
}
