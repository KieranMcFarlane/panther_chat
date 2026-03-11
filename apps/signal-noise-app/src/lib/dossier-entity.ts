import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { buildCachedEntityLookupFilter } from '@/lib/entity-lookup'
import { buildGraphEntityLookupFilter, withGraphId } from '@/lib/graph-id'

export interface DossierEntityRecord {
  id: string
  graph_id?: string | number
  neo4j_id?: string | number
  labels: string[]
  properties: Record<string, any>
}

function stripEmbeddedDossierData(properties: Record<string, any> | null | undefined) {
  if (!properties || typeof properties !== 'object') {
    return {}
  }

  const { dossier_data, neo4j_id, supabase_id, id, ...rest } = properties
  return rest
}

export async function resolveEntityForDossier(entityId: string): Promise<DossierEntityRecord | null> {
  if (!entityId) {
    return null
  }

  try {
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select(`
        *,
        leagues:league_id (
          id,
          name,
          badge_path,
          badge_s3_url
        )
      `)
      .or(`${buildGraphEntityLookupFilter(entityId)},name.ilike.%${entityId}%`)
      .single()

    if (!teamError && teamData) {
      return withGraphId({
        id: teamData.id,
        neo4j_id: teamData.neo4j_id || teamData.id,
        labels: ['Team'],
        properties: stripEmbeddedDossierData({
          name: teamData.name,
          type: 'Team',
          sport: teamData.sport,
          country: teamData.country,
          founded: teamData.founded,
          headquarters: teamData.headquarters,
          website: teamData.website,
          linkedin: teamData.linkedin,
          about: teamData.about,
          company_size: teamData.company_size,
          priority: teamData.priority,
          estimated_value: teamData.estimated_value,
          opportunity_score: teamData.opportunity_score,
          digital_maturity_score: teamData.digital_maturity_score,
          website_moderness_score: teamData.website_moderness_score,
          digital_transformation_score: teamData.digital_transformation_score,
          procurement_status: teamData.procurement_status,
          enrichment_status: teamData.enrichment_status,
          badge_path: teamData.badge_path,
          badge_s3_url: teamData.badge_s3_url,
          level: teamData.level,
          tier: teamData.tier,
          league_id: teamData.league_id,
          league_name: teamData.leagues?.name,
          league_badge_path: teamData.leagues?.badge_path,
          league_badge_s3_url: teamData.leagues?.badge_s3_url
        })
      })
    }

    const { data: leagueData, error: leagueError } = await supabase
      .from('leagues')
      .select('*')
      .or(buildGraphEntityLookupFilter(entityId))
      .single()

    if (!leagueError && leagueData) {
      return withGraphId({
        id: leagueData.id,
        neo4j_id: leagueData.neo4j_id || leagueData.id,
        labels: ['League'],
        properties: stripEmbeddedDossierData({
          name: leagueData.name,
          type: 'League',
          sport: leagueData.sport,
          country: leagueData.country,
          website: leagueData.website,
          linkedin: leagueData.linkedin,
          description: leagueData.description,
          digital_maturity_score: leagueData.digital_maturity_score,
          estimated_value: leagueData.estimated_value,
          priority_score: leagueData.priority_score,
          badge_path: leagueData.badge_path,
          badge_s3_url: leagueData.badge_s3_url,
          tier: leagueData.tier,
          original_name: leagueData.original_name,
          league_id: leagueData.league_id
        })
      })
    }

    let { data: cachedEntity, error: cacheError } = await supabase
      .from('cached_entities')
      .select('*')
      .or(buildCachedEntityLookupFilter(entityId))
      .limit(1)
      .single()

    if (!cachedEntity || cacheError) {
      const normalizedName = entityId
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/%26/g, '&')

      const result = await supabase
        .from('cached_entities')
        .select('*')
        .ilike('properties->>name', `%${normalizedName}%`)
        .limit(1)
        .single()

      if (result.data) {
        cachedEntity = result.data
        cacheError = null
      }
    }

    if (!cacheError && cachedEntity) {
      return withGraphId({
        id: cachedEntity.id,
        neo4j_id: cachedEntity.neo4j_id,
        labels: cachedEntity.labels,
        properties: stripEmbeddedDossierData(cachedEntity.properties)
      })
    }
  } catch (error) {
    console.log('⚠️ Dossier entity lookup error:', error)
  }

  return null
}

export function getCanonicalDossierEntityId(entity: Pick<DossierEntityRecord, 'id'> | null, fallbackEntityId: string) {
  return String(entity?.id || fallbackEntityId)
}

export function getDossierLookupEntityIds(
  entity: Pick<DossierEntityRecord, 'id' | 'graph_id' | 'neo4j_id'> | null,
  fallbackEntityId: string,
) {
  const ids = [
    entity?.id ? String(entity.id) : null,
    entity?.graph_id ? String(entity.graph_id) : null,
    entity?.neo4j_id ? String(entity.neo4j_id) : null,
    fallbackEntityId ? String(fallbackEntityId) : null,
  ].filter((value): value is string => Boolean(value))

  return [...new Set(ids)]
}
