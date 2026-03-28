import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { normalizeQuestionFirstDossier, selectBestPersistedDossierCandidate } from '@/lib/question-first-dossier'

type EntityLike = {
  id?: unknown
  uuid?: unknown
  neo4j_id?: unknown
  properties?: Record<string, any> | null
}

function uniqueStrings(values: Array<unknown>): string[] {
  return values
    .map((value) => String(value ?? '').trim())
    .filter((value, index, arr) => Boolean(value) && arr.indexOf(value) === index)
}

export async function loadLatestPersistedDossier(entityId: string, entity?: EntityLike | null) {
  const candidateIds = uniqueStrings([
    entity?.uuid,
    entityId,
    entity?.id,
    entity?.neo4j_id,
  ])

  const canonicalEntityId = String(entity?.uuid ?? '').trim()
  if (canonicalEntityId) {
    const { data } = await supabase
      .from('entity_dossiers')
      .select('dossier_data, created_at, generated_at, canonical_entity_id, entity_id, entity_name')
      .eq('canonical_entity_id', canonicalEntityId)
      .order('created_at', { ascending: false })
      .limit(5)
    const preferred = selectBestPersistedDossierCandidate(data ?? [])
    if (preferred?.dossier_data) {
      return preferred.dossier_data
    }
  }

  for (const candidateId of candidateIds) {
    const { data } = await supabase
      .from('entity_dossiers')
      .select('dossier_data, created_at, generated_at, canonical_entity_id, entity_id, entity_name')
      .eq('entity_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(5)
    const preferred = selectBestPersistedDossierCandidate(data ?? [])
    if (preferred?.dossier_data) {
      return preferred.dossier_data
    }
  }

  const entityName = String(entity?.properties?.name ?? '').trim()
  if (entityName) {
    const { data } = await supabase
      .from('entity_dossiers')
      .select('dossier_data, created_at, generated_at, canonical_entity_id, entity_id, entity_name')
      .ilike('entity_name', entityName)
      .order('created_at', { ascending: false })
      .limit(5)
    const preferred = selectBestPersistedDossierCandidate(data ?? [])
    if (preferred?.dossier_data) {
      return preferred.dossier_data
    }
  }

  return null
}

export async function loadNormalizedPersistedDossier(entityId: string, entity?: EntityLike | null) {
  const dossier = await loadLatestPersistedDossier(entityId, entity)
  return dossier ? normalizeQuestionFirstDossier(dossier, entityId, entity) : null
}
