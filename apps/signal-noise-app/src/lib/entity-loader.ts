import { readFile } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import path from 'path'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { matchesEntityUuid, resolveEntityUuid } from '@/lib/entity-public-id'
import { normalizeQuestionFirstDossier, resolveCanonicalQuestionFirstDossier } from '@/lib/question-first-dossier'

export interface Entity {
  id: string
  uuid?: string
  neo4j_id: string | number
  labels: string[]
  properties: Record<string, any>
}

interface EntityLookupResult {
  entity: Entity | null
  source: 'supabase' | 'dossier-file' | null
  dossier: any | null
}

async function getPersistedDossier(entityId: string, neo4jId?: string | number, entityName?: string) {
  try {
    const candidateIds = [entityId, neo4jId != null ? String(neo4jId) : null]
      .filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index)

    for (const candidateId of candidateIds) {
      const { data, error } = await supabase
        .from('entity_dossiers')
        .select('dossier_data')
        .eq('entity_id', candidateId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!error && data?.dossier_data) {
        return data.dossier_data
      }
    }

    if (entityName && entityName.trim()) {
      const { data, error } = await supabase
        .from('entity_dossiers')
        .select('dossier_data')
        .ilike('entity_name', entityName.trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!error && data?.dossier_data) {
        return data.dossier_data
      }
    }
    return null
  } catch (error) {
    console.log('⚠️ Server-side dossier lookup error:', error)
    return null
  }
}

const getParentDir = (currentPath: string, depth = 1) => {
  let nextPath = currentPath
  for (let i = 0; i < depth; i += 1) {
    nextPath = path.dirname(nextPath)
  }
  return nextPath
}

const getPossibleDossierDirs = () => {
  const cwd = process.cwd()
  return [
    path.join(cwd, 'backend', 'data', 'dossiers'),
    path.join(cwd, '..', 'backend', 'data', 'dossiers'),
    path.join(cwd, '..', '..', 'backend', 'data', 'dossiers'),
    path.join(getParentDir(cwd, 2), 'backend', 'data', 'dossiers'),
  ]
}

const DOSSIERS_DIR = getPossibleDossierDirs().find(existsSync) ?? getPossibleDossierDirs()[0]
const ENABLE_LEGACY_DOSSIER_FILE_FALLBACK = String(
  process.env.ENTITY_DOSSIER_ENABLE_LEGACY_FILE_FALLBACK || 'false',
).toLowerCase() === 'true'

function findDossierFile(entityId: string, tierDir: string): string | null {
  const decodedEntityId = decodeURIComponent(entityId)
  const exactMatch = path.join(tierDir, `${decodedEntityId}.json`)

  if (existsSync(exactMatch)) {
    return decodedEntityId
  }

  for (const file of readdirSync(tierDir)) {
    if (!file.endsWith('.json')) continue

    const filename = file.replace('.json', '')
    if (filename.endsWith(decodedEntityId) || filename.endsWith(entityId)) {
      return filename
    }
  }

  return null
}

async function findDossierByNamePattern(entityName: string, tierDir: string): Promise<string | null> {
  const normalizedName = entityName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '_')

  const patterns = [
    normalizedName,
    `${normalizedName}_fc`,
    normalizedName.replace('_', '-'),
    `${normalizedName}-fc`,
  ]

  for (const file of readdirSync(tierDir)) {
    if (!file.endsWith('.json')) continue

    const filename = file.replace('.json', '').toLowerCase()
    for (const pattern of patterns) {
      if (filename === pattern || filename.endsWith(pattern)) {
        return file.replace('.json', '')
      }
    }
  }

  return null
}

async function getFallbackEntityFromDossier(entityId: string, tier = 'standard'): Promise<EntityLookupResult> {
  const normalizedTier = tier.toLowerCase()
  const candidateTierDirs = Array.from(
    new Set([
      path.join(DOSSIERS_DIR, normalizedTier),
      path.join(DOSSIERS_DIR, 'premium'),
      path.join(DOSSIERS_DIR, 'standard'),
    ]),
  ).filter((tierDir) => existsSync(tierDir))

  for (const tierDir of candidateTierDirs) {
    let foundFilename = findDossierFile(entityId, tierDir)
    if (!foundFilename) {
      foundFilename = await findDossierByNamePattern(entityId, tierDir)
    }

    if (!foundFilename) {
      continue
    }

    const fileContent = await readFile(path.join(tierDir, `${foundFilename}.json`), 'utf-8')
    const dossier = JSON.parse(fileContent)

    return {
      entity: {
        id: dossier.entity_id || entityId,
        uuid: resolveEntityUuid({
          id: dossier.entity_id || entityId,
          neo4j_id: dossier.entity_id || entityId,
          supabase_id: dossier.entity_id || entityId,
          properties: {
            name:
              dossier.entity_name ||
              entityId.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            type: dossier.entity_type || 'CLUB',
          },
        }) || undefined,
        neo4j_id: dossier.entity_id || entityId,
        labels: [dossier.entity_type || 'CLUB'],
        properties: {
          name:
            dossier.entity_name ||
            entityId.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          type: dossier.entity_type || 'CLUB',
          sport: 'Football',
          tier: dossier.tier,
          priority: dossier.priority_score,
          dossier_data: JSON.stringify(dossier),
        },
      },
      source: 'dossier-file',
      dossier,
    }
  }

  return { entity: null, source: null, dossier: null }
}

export async function getEntityForDossierPage(entityId: string, tier = 'standard'): Promise<EntityLookupResult> {
  if (!entityId) {
    return { entity: null, source: null, dossier: null }
  }

  let entity: Entity | null = null
  const canonicalEntities = await getCanonicalEntitiesSnapshot()
  const canonicalUuidMatch = canonicalEntities.find((candidate) => matchesEntityUuid(candidate, entityId))

  if (canonicalUuidMatch) {
    entity = {
      id: String(canonicalUuidMatch.id),
      uuid: resolveEntityUuid(canonicalUuidMatch) || undefined,
      neo4j_id: canonicalUuidMatch.neo4j_id,
      labels: canonicalUuidMatch.labels || [],
      properties: canonicalUuidMatch.properties || {},
    }
  }

  try {
    if (!entity) {
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
      .or(`id.eq.${entityId},neo4j_id.eq.${entityId},name.ilike.%${entityId}%`)
      .single()

    if (!teamError && teamData) {
      entity = {
        id: teamData.id,
        uuid: resolveEntityUuid({
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
          league_badge_s3_url: teamData.leagues?.badge_s3_url
        }
      }
    } else {
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .or(`id.eq.${entityId},neo4j_id.eq.${entityId}`)
        .single()

      if (!leagueError && leagueData) {
        entity = {
          id: leagueData.id,
          uuid: resolveEntityUuid({
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
            league_id: leagueData.league_id
          }
        }
      } else {
        let { data: cachedEntity, error: cacheError } = await supabase
          .from('cached_entities')
          .select('*')
          .or(`id.eq.${entityId},neo4j_id.eq.${entityId},neo4j_id.eq.${parseInt(entityId, 10) || entityId}`)
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
          entity = {
            id: cachedEntity.id,
            uuid: resolveEntityUuid({
              id: cachedEntity.id,
              neo4j_id: cachedEntity.neo4j_id,
              graph_id: cachedEntity.graph_id,
              supabase_id: cachedEntity.supabase_id || cachedEntity.properties?.supabase_id,
              properties: cachedEntity.properties,
            }) || undefined,
            neo4j_id: cachedEntity.neo4j_id,
            labels: cachedEntity.labels,
            properties: cachedEntity.properties
          }
        }
      }
    }
    }
  } catch (error) {
    console.log('⚠️ Server-side entity lookup error:', error)
  }

  if (!entity) {
    const canonicalMatch = canonicalEntities.find((candidate) =>
      String(candidate.id || '') === entityId ||
      String(candidate.neo4j_id || '') === entityId,
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
    // Keep the dossier route usable even when the live entity row is missing.
    // This lets persisted dossier artifacts like Arsenal still render in the browser.
    const fallbackResult = await getFallbackEntityFromDossier(entityId, tier)
    if (fallbackResult.entity) {
      return fallbackResult
    }

    if (ENABLE_LEGACY_DOSSIER_FILE_FALLBACK) {
      return fallbackResult
    }

    return { entity: null, source: null, dossier: null }
  }

  let dossier = null
  const canonicalQuestionFirst = await resolveCanonicalQuestionFirstDossier(entityId, entity)

  if (canonicalQuestionFirst.dossier) {
    dossier = canonicalQuestionFirst.dossier
  }

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
    )
    dossier = persistedDossier ? normalizeQuestionFirstDossier(persistedDossier, entityId, entity) : null
  }

  return {
    entity,
    source: 'supabase',
    dossier
  }
}
