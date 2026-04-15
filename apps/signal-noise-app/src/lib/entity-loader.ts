import { buildCachedEntityCanonicalLookup, dedupeCanonicalCachedEntityRows } from '@/lib/cached-entity-canonicalization.mjs'
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
  const canonicalLookup = buildCachedEntityCanonicalLookup(canonicalEntities)

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

  const directIdPredicate = [
    `id.eq.${entityId}`,
    `neo4j_id.eq.${entityId}`,
    `canonical_entity_id.eq.${entityId}`,
    Number.isNaN(Number.parseInt(entityId, 10)) ? null : `neo4j_id.eq.${Number.parseInt(entityId, 10)}`
  ].filter(Boolean).join(',')

  const { data: cachedEntity, error: cacheError } = await supabase
    .from('cached_entities')
    .select('*')
    .or(directIdPredicate)
    .limit(1)
    .single()

  if (!cacheError && cachedEntity) {
    return {
      id: cachedEntity.id,
      uuid: resolveEntityUuid({
        canonical_entity_id: cachedEntity.canonical_entity_id,
        id: cachedEntity.id,
        neo4j_id: cachedEntity.neo4j_id,
        graph_id: cachedEntity.graph_id,
        supabase_id: cachedEntity.supabase_id || cachedEntity.properties?.supabase_id,
        properties: cachedEntity.properties,
      }) || undefined,
      neo4j_id: cachedEntity.neo4j_id,
      labels: cachedEntity.labels,
      properties: cachedEntity.properties,
    }
  }

  for (const candidateName of buildNameCandidates(entityId)) {
    const fallbackByName = await supabase
      .from('cached_entities')
      .select('id, neo4j_id, graph_id, labels, properties, canonical_entity_id')
      .ilike('properties->>name', `%${candidateName}%`)
      .limit(50)

    if (fallbackByName.data && fallbackByName.data.length > 0) {
      const deduped = dedupeCanonicalCachedEntityRows(fallbackByName.data, canonicalLookup)
      const nameEntity = deduped[0]
      return {
        id: nameEntity.id,
        uuid: resolveEntityUuid({
          canonical_entity_id: nameEntity.canonical_entity_id,
          id: nameEntity.id,
          neo4j_id: nameEntity.neo4j_id,
          graph_id: nameEntity.graph_id,
          uuid: nameEntity.canonical_entity_id,
          supabase_id: nameEntity.supabase_id || nameEntity.properties?.supabase_id,
          properties: nameEntity.properties,
        }) || nameEntity.canonical_entity_id || undefined,
        neo4j_id: nameEntity.neo4j_id,
        labels: nameEntity.labels,
        properties: nameEntity.properties,
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

  if (entity.properties.dossier_data) {
    try {
      dossier = dossier ?? normalizeQuestionFirstDossier(JSON.parse(entity.properties.dossier_data), entityId, entity)
    } catch (error) {
      console.log('⚠️ Invalid dossier_data, skipping dossier parse:', error)
    }
  }

  if (!dossier) {
    const persistedDossier = await getPersistedDossier(
      entity.id?.toString() || entityId,
      entity.neo4j_id,
      entity.properties?.name,
      entity.uuid || null,
    )
    dossier = persistedDossier ? normalizeQuestionFirstDossier(persistedDossier, entityId, entity) : null
  }

  return {
    entity,
    source: 'supabase',
    dossier
  }
}
