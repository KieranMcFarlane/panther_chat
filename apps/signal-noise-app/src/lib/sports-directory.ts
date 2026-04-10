import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { getCanonicalEntityRole } from '@/lib/entity-role-taxonomy'
import { resolveEntityUuid } from '@/lib/entity-public-id'
import { isPreferredFacetLabel, normalizeFacetKey, normalizeFacetLabel } from '@/lib/facet-normalization'

export interface SportsDirectoryLeague {
  id: string
  name: string
  original_name?: string
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
  league_id?: string
  teams?: SportsDirectoryTeam[]
  created_at: string
  updated_at: string
}

export interface SportsDirectoryTeam {
  id: string
  name: string
  original_name?: string | null
  tier?: string
  level?: string
  sport?: string
  country?: string
  founded?: number | null
  headquarters?: string | null
  website?: string
  linkedin?: string
  about?: string | null
  company_size?: string | null
  priority?: string | null
  estimated_value?: string
  opportunity_score?: number | null
  digital_maturity_score?: number | null
  website_moderness_score?: number | null
  digital_transformation_score?: number | null
  procurement_status?: string | null
  enrichment_status?: string | null
  badge_path?: string | null
  badge_s3_url?: string | null
  league_id?: string | null
  league_name?: string | null
  league_badge_path?: string | null
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

function isTeamEntity(entity: any): boolean {
  const role = getCanonicalEntityRole(entity)
  return role === 'Club' || role === 'Team'
}

function resolveDirectoryEntityId(entity: any, properties: Record<string, any>): string {
  return resolveEntityUuid({
    id: entity?.id,
    neo4j_id: entity?.neo4j_id,
    graph_id: entity?.graph_id,
    supabase_id: entity?.supabase_id || properties.supabase_id,
    properties,
  }) || String(entity?.id || entity?.neo4j_id || entity?.graph_id || properties.name || '')
}

function normalizeLeagueAssociation(entity: any): { key: string; name: string } | null {
  const properties = entity?.properties || {}
  const leagueName = normalizeFacetLabel(
    properties.league_name ||
    properties.league ||
    properties.level ||
    properties.parent_league ||
    ''
  )

  const leagueKey = normalizeFacetKey(leagueName)
  if (!leagueKey || !leagueName) return null

  return { key: `league:${leagueKey}`, name: leagueName }
}

function buildLeagueRecord(entity: any): SportsDirectoryLeague {
  const properties = entity?.properties || {}
  const id = resolveDirectoryEntityId(entity, properties)
  const name = normalizeFacetLabel(properties.name || id)
  const leagueKey = normalizeFacetKey(name || properties.league || properties.level || id)
  const now = new Date().toISOString()

  return {
    id: `league:${leagueKey || normalizeFacetKey(id)}`,
    name,
    original_name: properties.original_name || properties.originalName || name,
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
    league_id: `league:${leagueKey || normalizeFacetKey(id)}`,
    teams: [],
    created_at: toTimestamp(properties.created_at || now),
    updated_at: toTimestamp(properties.updated_at || now),
  }
}

function buildTeamRecord(entity: any): SportsDirectoryTeam {
  const properties = entity?.properties || {}
  const id = resolveDirectoryEntityId(entity, properties)
  const association = normalizeLeagueAssociation(entity)
  const now = new Date().toISOString()

  return {
    id,
    name: normalizeFacetLabel(properties.name || id),
    original_name: properties.original_name || properties.originalName || null,
    tier: properties.tier || undefined,
    level: association?.name || properties.level || properties.league_name || properties.league || undefined,
    sport: properties.sport || undefined,
    country: properties.country || undefined,
    founded: properties.founded ?? undefined,
    headquarters: properties.headquarters || undefined,
    website: properties.website || undefined,
    linkedin: properties.linkedin || undefined,
    about: properties.about || undefined,
    company_size: properties.company_size || undefined,
    priority: properties.priority || undefined,
    estimated_value: properties.estimated_value || undefined,
    opportunity_score: properties.opportunity_score ?? undefined,
    digital_maturity_score: properties.digital_maturity_score ?? undefined,
    website_moderness_score: properties.website_moderness_score ?? undefined,
    digital_transformation_score: properties.digital_transformation_score ?? undefined,
    procurement_status: properties.procurement_status || undefined,
    enrichment_status: properties.enrichment_status || undefined,
    badge_path: entity?.badge_path || properties.badge_path || null,
    badge_s3_url: entity?.badge_s3_url || properties.badge_s3_url || null,
    league_id: association?.key || null,
    league_name: association?.name || null,
    league_badge_path: properties.league_badge_path || null,
    created_at: toTimestamp(properties.created_at || now),
    updated_at: toTimestamp(properties.updated_at || now),
  }
}

export function buildSportsDirectory(entities: any[]): { leagues: SportsDirectoryLeague[]; teams: SportsDirectoryTeam[] } {
  const leaguesByKey = new Map<string, SportsDirectoryLeague>()
  const teams: SportsDirectoryTeam[] = []

  for (const entity of entities || []) {
    const properties = entity?.properties || {}

    if (isLeagueEntity(entity)) {
      const league = buildLeagueRecord(entity)
      const leagueKey = normalizeFacetKey(league.name || properties.league || properties.level || '')
      if (!leagueKey) continue

      const existing = leaguesByKey.get(leagueKey)
      if (!existing) {
        leaguesByKey.set(leagueKey, league)
      } else {
        existing.name = isPreferredFacetLabel(existing.name, league.name) ? league.name : existing.name
        existing.original_name = league.original_name || existing.original_name
        existing.tier = league.tier || existing.tier
        existing.sport = league.sport || existing.sport
        existing.country = league.country || existing.country
        existing.website = league.website || existing.website
        existing.linkedin = league.linkedin || existing.linkedin
        existing.description = league.description || existing.description
        existing.digital_maturity_score = league.digital_maturity_score ?? existing.digital_maturity_score
        existing.estimated_value = league.estimated_value || existing.estimated_value
        existing.priority_score = league.priority_score ?? existing.priority_score
        existing.badge_path = league.badge_path || existing.badge_path
        existing.badge_s3_url = league.badge_s3_url || existing.badge_s3_url
        existing.created_at = existing.created_at || league.created_at
        existing.updated_at = league.updated_at || existing.updated_at
      }
      continue
    }

    if (!isTeamEntity(entity)) {
      continue
    }

    const team = buildTeamRecord(entity)
    teams.push(team)

    if (team.league_name) {
      const leagueKey = normalizeFacetKey(team.league_name)
      if (leagueKey && !leaguesByKey.has(leagueKey)) {
        leaguesByKey.set(leagueKey, {
          id: team.league_id || leagueKey,
          name: team.league_name,
          original_name: team.league_name,
          sport: team.sport,
          country: team.country,
          badge_path: team.league_badge_path || null,
          badge_s3_url: null,
          league_id: team.league_id || leagueKey,
          teams: [],
          created_at: team.created_at,
          updated_at: team.updated_at,
        })
      }
    }
  }

  const teamsByLeagueKey = new Map<string, SportsDirectoryTeam[]>()
  for (const team of teams) {
    const leagueKey = team.league_name ? normalizeFacetKey(team.league_name) : ''
    if (!leagueKey) continue

    const groupedTeams = teamsByLeagueKey.get(leagueKey) || []
    groupedTeams.push(team)
    teamsByLeagueKey.set(leagueKey, groupedTeams)
  }

  for (const [leagueKey, league] of leaguesByKey) {
    league.teams = (teamsByLeagueKey.get(leagueKey) || []).sort((left, right) => left.name.localeCompare(right.name))
  }

  const leagues = Array.from(leaguesByKey.values()).sort((left, right) => {
    const priorityDiff = (right.priority_score || 0) - (left.priority_score || 0)
    if (priorityDiff !== 0) return priorityDiff
    return left.name.localeCompare(right.name)
  })

  const sortedTeams = [...teams].sort((left, right) => left.name.localeCompare(right.name))

  return {
    leagues,
    teams: sortedTeams,
  }
}

export async function getSportsDirectorySnapshot(): Promise<{ leagues: SportsDirectoryLeague[]; teams: SportsDirectoryTeam[] }> {
  const entities = await getCanonicalEntitiesSnapshot()
  return buildSportsDirectory(entities)
}
