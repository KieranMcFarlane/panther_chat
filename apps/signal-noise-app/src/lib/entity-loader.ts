import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { getDossierLookupEntityIds, resolveEntityForDossier } from '@/lib/dossier-entity'

export interface Entity {
  id: string
  graph_id?: string | number
  neo4j_id?: string | number
  labels: string[]
  properties: Record<string, any>
}

interface EntityLookupResult {
  entity: Entity | null
  source: 'supabase' | null
  dossier: any | null
}

async function getPersistedDossier(entityIds: string[]) {
  try {
    if (!entityIds || entityIds.length === 0) {
      return null
    }

    const { data, error } = await supabase
      .from('entity_dossiers')
      .select('dossier_data')
      .in('entity_id', entityIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data?.dossier_data) {
      return null
    }

    return data.dossier_data
  } catch (error) {
    console.log('⚠️ Server-side dossier lookup error:', error)
    return null
  }
}

export async function getEntityForDossierPage(entityId: string, tier = 'standard'): Promise<EntityLookupResult> {
  if (!entityId) {
    return { entity: null, source: null, dossier: null }
  }

  const entity = await resolveEntityForDossier(entityId) as Entity | null

  if (!entity) {
    return { entity: null, source: null, dossier: null }
  }

  const dossierLookupIds = getDossierLookupEntityIds(entity, entityId)
  const dossier = await getPersistedDossier(dossierLookupIds)

  return {
    entity,
    source: 'supabase',
    dossier
  }
}
