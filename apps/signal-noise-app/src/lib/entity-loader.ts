import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { matchesEntityUuid, resolveEntityUuid } from '@/lib/entity-public-id'
import { normalizeQuestionFirstDossier, selectBestPersistedDossierCandidate } from '@/lib/question-first-dossier'

export interface Entity {
  id: string
  uuid?: string
  neo4j_id: string | number
  labels: string[]
  properties: Record<string, any>
}

interface EntityLookupResult {
  entity: Entity | null
  source: 'supabase' | null
  dossier: any | null
}

function buildNameCandidates(entityId: string): string[] {
  const normalized = entityId
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/%26/g, '&')
    .trim()
  const withoutYear = normalized.replace(/\b20\d{2}\b/g, '').replace(/\s+/g, ' ').trim()
  return [normalized, withoutYear].filter((value, index, arr) => Boolean(value) && arr.indexOf(value) === index)
}

async function findEntityInLiveStores(entityId: string): Promise<Entity | null> {
  const canonicalEntities = await getCanonicalEntitiesSnapshot()

  const canonicalMatch = canonicalEntities.find((entity) => {
    const canonicalId = String(entity.id || '')
    return canonicalId === entityId || String(entity.uuid || '') === entityId
  })

  if (canonicalMatch) {
    return {
      id: canonicalMatch.id,
      uuid: canonicalMatch.uuid || canonicalMatch.id,
      neo4j_id: canonicalMatch.neo4j_id,
      labels: canonicalMatch.labels || [],
      properties: canonicalMatch.properties,
    }
  }

  const [normalizedName] = buildNameCandidates(entityId)

  // Direct ID lookup on canonical_entities
  const idFilters = [`id.eq.${entityId}`]
  const parsedId = Number.parseInt(entityId, 10)
  if (Number.isFinite(parsedId)) {
    idFilters.push(`source_neo4j_ids.cs.{${String(parsedId)}}`)
  }
  if (entityId !== String(parsedId)) {
    idFilters.push(`source_neo4j_ids.cs.{${entityId}}`)
  }

  const { data: canonicalEntity, error: canonicalError } = await supabase
    .from('canonical_entities')
    .select('id, name, entity_type, sport, league, country, labels, properties, source_neo4j_ids')
    .or(idFilters.join(','))
    .limit(1)
    .maybeSingle()

  if (!canonicalError && canonicalEntity) {
    const sourceNeo4jId = Array.isArray(canonicalEntity.source_neo4j_ids) && canonicalEntity.source_neo4j_ids.length > 0
      ? canonicalEntity.source_neo4j_ids[0]
      : canonicalEntity.id
    return {
      id: canonicalEntity.id,
      uuid: canonicalEntity.id,
      neo4j_id: sourceNeo4jId,
      labels: canonicalEntity.labels || [],
      properties: {
        ...canonicalEntity.properties,
        name: canonicalEntity.name,
        type: canonicalEntity.entity_type,
        sport: canonicalEntity.sport,
        country: canonicalEntity.country,
        league: canonicalEntity.league,
      },
    }
  }

  // Name fallback on canonical_entities
  for (const candidateName of buildNameCandidates(entityId)) {
    const fallbackByName = await supabase
      .from('canonical_entities')
      .select('id, name, entity_type, sport, league, country, labels, properties, source_neo4j_ids')
      .ilike('name', `%${candidateName}%`)
      .limit(1)

    if (fallbackByName.data && fallbackByName.data.length > 0) {
      const row = fallbackByName.data[0]
      const sourceNeo4jId = Array.isArray(row.source_neo4j_ids) && row.source_neo4j_ids.length > 0
        ? row.source_neo4j_ids[0]
        : row.id
      return {
        id: row.id,
        uuid: row.id,
        neo4j_id: sourceNeo4jId,
        labels: row.labels || [],
        properties: {
          ...row.properties,
          name: row.name,
          type: row.entity_type,
          sport: row.sport,
          country: row.country,
          league: row.league,
        },
      }
    }
  }

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
    .or(`id.eq.${entityId},neo4j_id.eq.${entityId}`)
    .single()

  if (!teamError && teamData) {
    return {
      id: teamData.id,
      uuid: resolveEntityUuid({
        canonical_entity_id: teamData.canonical_entity_id,
        id: teamData.id,
        neo4j_id: teamData.neo4j_id || teamData.id,
        supabase_id: teamData.supabase_id || teamData.properties?.supabase_id,
        properties: teamData,
      }) || undefined,
      neo4j_id: teamData.neo4j_id || teamData.id,
      labels: ['Team'],
      properties: {
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
        league_badge_s3_url: teamData.leagues?.badge_s3_url,
      },
    }
  }

  const { data: leagueData, error: leagueError } = await supabase
    .from('leagues')
    .select('*')
    .or(`id.eq.${entityId},neo4j_id.eq.${entityId}`)
    .single()

  if (!leagueError && leagueData) {
    return {
      id: leagueData.id,
      uuid: resolveEntityUuid({
        canonical_entity_id: leagueData.canonical_entity_id,
        id: leagueData.id,
        neo4j_id: leagueData.neo4j_id || leagueData.id,
        supabase_id: leagueData.supabase_id || leagueData.properties?.supabase_id,
        properties: leagueData,
      }) || undefined,
      neo4j_id: leagueData.neo4j_id || leagueData.id,
      labels: ['League'],
      properties: {
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
        league_id: leagueData.league_id,
      },
    }
  }

  return null
}

async function getPersistedDossier(entityId: string, neo4jId?: string | number, entityName?: string, canonicalEntityId?: string | null) {
  try {
    if (canonicalEntityId) {
      const { data, error } = await supabase
        .from('entity_dossiers')
        .select('dossier_data, created_at, generated_at')
        .eq('canonical_entity_id', canonicalEntityId)
        .order('created_at', { ascending: false })
        .limit(5)
      const preferred = !error ? selectBestPersistedDossierCandidate(data ?? []) : null
      if (preferred?.dossier_data) {
        return preferred.dossier_data
      }
    }

    const candidateIds = [entityId, neo4jId != null ? String(neo4jId) : null]
      .filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index)

    for (const candidateId of candidateIds) {
      const { data, error } = await supabase
        .from('entity_dossiers')
        .select('dossier_data, created_at, generated_at')
        .eq('entity_id', candidateId)
        .order('created_at', { ascending: false })
        .limit(5)
      const preferred = !error ? selectBestPersistedDossierCandidate(data ?? []) : null
      if (preferred?.dossier_data) {
        return preferred.dossier_data
      }
    }

    if (entityName && entityName.trim()) {
      const { data, error } = await supabase
        .from('entity_dossiers')
        .select('dossier_data, created_at, generated_at')
        .ilike('entity_name', entityName.trim())
        .order('created_at', { ascending: false })
        .limit(5)
      const preferred = !error ? selectBestPersistedDossierCandidate(data ?? []) : null
      if (preferred?.dossier_data) {
        return preferred.dossier_data
      }
    }
    return null
  } catch (error) {
    console.log('⚠️ Server-side dossier lookup error:', error)
    return null
  }
}

export async function getEntityForDossierPage(entityId: string, tier = 'standard'): Promise<EntityLookupResult> {
  if (!entityId) {
    return { entity: null, source: null, dossier: null }
  }

  let entity: Entity | null = null

  try {
    entity = await findEntityInLiveStores(entityId)
  } catch (error) {
    console.log('⚠️ Server-side entity lookup error:', error)
  }

  if (!entity) {
    const canonicalEntities = await getCanonicalEntitiesSnapshot()
    const canonicalMatch = canonicalEntities.find((candidate) =>
      matchesEntityUuid(candidate, entityId) ||
      String(candidate.id || '') === entityId ||
      String(candidate.neo4j_id || '') === entityId
    )

    if (canonicalMatch) {
      entity = {
        id: String(canonicalMatch.id),
        uuid: resolveEntityUuid(canonicalMatch) || undefined,
        neo4j_id: canonicalMatch.neo4j_id,
        labels: canonicalMatch.labels || [],
        properties: canonicalMatch.properties || {},
      }
    }
  }

  if (!entity) {
    return { entity: null, source: null, dossier: null }
  }

  let dossier = null

  const persistedDossier = await getPersistedDossier(
    entity.id?.toString() || entityId,
    entity.neo4j_id,
    entity.properties?.name,
    entity.uuid || null,
  )
  dossier = persistedDossier ? normalizeQuestionFirstDossier(persistedDossier, entityId, entity) : null

  if (!dossier && entity.properties.dossier_data) {
    try {
      dossier = normalizeQuestionFirstDossier(JSON.parse(entity.properties.dossier_data), entityId, entity)
    } catch (error) {
      console.log('⚠️ Invalid dossier_data, skipping dossier parse:', error)
    }
  }

  return {
    entity,
    source: 'supabase',
    dossier
  }
}
