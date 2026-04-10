import { NextRequest, NextResponse } from 'next/server'

import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { getCanonicalEntityRole } from '@/lib/entity-role-taxonomy'
import { resolveEntityUuid } from '@/lib/entity-public-id'
import { isPreferredFacetLabel, normalizeFacetKey, normalizeFacetLabel } from '@/lib/facet-normalization'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type LeagueRecord = {
  id: string
  name: string
  original_name: string
  tier?: string
  sport?: string
  country?: string
  website?: string
  linkedin?: string
  description?: string
  digital_maturity_score?: number
  estimated_value?: string
  priority_score?: number
  badge_path?: string | null
  badge_s3_url?: string | null
  league_id: string
  teams?: unknown[]
  created_at: string
  updated_at: string
}

function toTimestamp(value: unknown): string {
  const normalized = normalizeFacetLabel(value)
  return normalized || new Date().toISOString()
}

function isLeagueEntity(entity: any): boolean {
  const role = getCanonicalEntityRole(entity)
  return role === 'League' || role === 'Competition'
}

function buildLeagueRecord(entity: any): LeagueRecord {
  const properties = entity?.properties || {}
  const name = normalizeFacetLabel(properties.name || entity?.neo4j_id || entity?.graph_id || 'Unknown League')
  const key = normalizeFacetKey(name || properties.league || properties.level || entity?.neo4j_id || '')
  const id = `league:${key || normalizeFacetKey(String(entity?.id || entity?.neo4j_id || name))}`
  const resolvedId = resolveEntityUuid({
    id: entity?.id,
    neo4j_id: entity?.neo4j_id,
    graph_id: entity?.graph_id,
    supabase_id: entity?.supabase_id || properties.supabase_id,
    properties,
  }) || id

  return {
    id,
    name,
    original_name: normalizeFacetLabel(properties.original_name || properties.originalName || name),
    tier: properties.tier || undefined,
    sport: properties.sport || undefined,
    country: properties.country || undefined,
    website: properties.website || undefined,
    linkedin: properties.linkedin || undefined,
    description: properties.description || undefined,
    digital_maturity_score: properties.digital_maturity_score ?? undefined,
    estimated_value: properties.estimated_value || undefined,
    priority_score: properties.priority_score ?? undefined,
    badge_path: entity?.badge_path || properties.badge_path || null,
    badge_s3_url: entity?.badge_s3_url || properties.badge_s3_url || null,
    league_id: resolvedId,
    teams: [],
    created_at: toTimestamp(properties.created_at || entity?.created_at),
    updated_at: toTimestamp(properties.updated_at || entity?.updated_at),
  }
}

function mergeLeagueRecord(existing: LeagueRecord, next: LeagueRecord): LeagueRecord {
  return {
    ...existing,
    name: isPreferredFacetLabel(existing.name, next.name) ? next.name : existing.name,
    original_name: next.original_name || existing.original_name,
    tier: next.tier || existing.tier,
    sport: next.sport || existing.sport,
    country: next.country || existing.country,
    website: next.website || existing.website,
    linkedin: next.linkedin || existing.linkedin,
    description: next.description || existing.description,
    digital_maturity_score: next.digital_maturity_score ?? existing.digital_maturity_score,
    estimated_value: next.estimated_value || existing.estimated_value,
    priority_score: next.priority_score ?? existing.priority_score,
    badge_path: next.badge_path || existing.badge_path,
    badge_s3_url: next.badge_s3_url || existing.badge_s3_url,
    league_id: next.league_id || existing.league_id,
    created_at: existing.created_at || next.created_at,
    updated_at: next.updated_at || existing.updated_at,
  }
}

function createCacheHeaders(maxAge = 300, staleWhileRevalidate = 600) {
  return new Headers({
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    'Content-Type': 'application/json',
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport')?.trim()
    const country = searchParams.get('country')?.trim()

    const canonicalEntities = await getCanonicalEntitiesSnapshot()
    const leaguesByKey = new Map<string, LeagueRecord>()

    for (const entity of canonicalEntities) {
      if (!isLeagueEntity(entity)) continue

      const league = buildLeagueRecord(entity)
      const leagueKey = normalizeFacetKey(league.name)
      if (!leagueKey) continue

      const existing = leaguesByKey.get(leagueKey)
      leaguesByKey.set(leagueKey, existing ? mergeLeagueRecord(existing, league) : league)
    }

    const filteredLeagues = [...leaguesByKey.values()]
      .filter((league) => {
        if (sport && league.sport !== sport) return false
        if (country && league.country !== country) return false
        return true
      })
      .sort((left, right) => {
        const priorityDiff = (right.priority_score || 0) - (left.priority_score || 0)
        if (priorityDiff !== 0) return priorityDiff
        return left.name.localeCompare(right.name)
      })

    return NextResponse.json(filteredLeagues, {
      headers: createCacheHeaders(),
    })
  } catch (error) {
    console.error('Error fetching leagues:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch leagues' },
      { status: 500 }
    )
  }
}
