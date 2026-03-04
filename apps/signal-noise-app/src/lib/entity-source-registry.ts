import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'

export type EntitySourcePageClass =
  | 'official_site'
  | 'tenders_page'
  | 'procurement_page'
  | 'press_release'
  | 'careers_page'
  | 'document'
  | 'linkedin_company'
  | 'linkedin_posts'
  | 'linkedin_executive'
  | 'jobs_board'
  | 'procurement_portal'
  | 'presswire'

export interface EntitySourceRegistryEntry {
  entity_id: string
  page_class: EntitySourcePageClass
  url: string
  source: string
  confidence: number
  is_canonical: boolean
  last_verified_at?: string | null
  metadata?: Record<string, unknown>
}

const entitySourceRegistryMemoryStore = new Map<string, EntitySourceRegistryEntry[]>()

function normalizeRegistryEntry(
  entityId: string,
  entry: Partial<EntitySourceRegistryEntry> & Pick<EntitySourceRegistryEntry, 'page_class' | 'url'>,
): EntitySourceRegistryEntry {
  return {
    entity_id: entityId,
    page_class: entry.page_class,
    url: entry.url,
    source: entry.source ?? 'system',
    confidence: entry.confidence ?? 0.5,
    is_canonical: entry.is_canonical ?? false,
    last_verified_at: entry.last_verified_at ?? null,
    metadata: entry.metadata ?? {},
  }
}

function sortRegistryEntries(entries: EntitySourceRegistryEntry[]) {
  return [...entries].sort((left, right) => {
    if (left.page_class !== right.page_class) {
      return left.page_class.localeCompare(right.page_class)
    }

    if (left.is_canonical !== right.is_canonical) {
      return left.is_canonical ? -1 : 1
    }

    if (left.confidence !== right.confidence) {
      return right.confidence - left.confidence
    }

    return left.url.localeCompare(right.url)
  })
}

function updateMemoryRegistry(entityId: string, entries: EntitySourceRegistryEntry[]) {
  const existing = entitySourceRegistryMemoryStore.get(entityId) ?? []
  const merged = new Map<string, EntitySourceRegistryEntry>()

  for (const entry of [...existing, ...entries]) {
    const key = `${entry.page_class}:${entry.url}`
    const previous = merged.get(key)
    if (!previous || Number(entry.is_canonical) > Number(previous.is_canonical) || entry.confidence >= previous.confidence) {
      merged.set(key, entry)
    }
  }

  entitySourceRegistryMemoryStore.set(entityId, sortRegistryEntries([...merged.values()]))
}

export async function upsertEntitySourceRegistryEntries(
  entityId: string,
  entries: Array<Partial<EntitySourceRegistryEntry> & Pick<EntitySourceRegistryEntry, 'page_class' | 'url'>>,
) {
  const normalizedEntries = entries.map((entry) => normalizeRegistryEntry(entityId, entry))
  updateMemoryRegistry(entityId, normalizedEntries)

  try {
    await supabase.from('entity_source_registry').upsert(normalizedEntries, {
      onConflict: 'entity_id,page_class,url',
    })
  } catch {
    return sortRegistryEntries(entitySourceRegistryMemoryStore.get(entityId) ?? normalizedEntries)
  }

  return getEntitySourceRegistry(entityId)
}

export async function getEntitySourceRegistry(entityId: string) {
  try {
    const { data } = await supabase
      .from('entity_source_registry')
      .select('*')
      .eq('entity_id', entityId)
      .order('page_class', { ascending: true })
      .order('is_canonical', { ascending: false })
      .order('confidence', { ascending: false })

    if (data) {
      const typedEntries = data as EntitySourceRegistryEntry[]
      entitySourceRegistryMemoryStore.set(entityId, typedEntries)
      return typedEntries
    }
  } catch {
    // fall through to memory store
  }

  return sortRegistryEntries(entitySourceRegistryMemoryStore.get(entityId) ?? [])
}

export async function getCanonicalSourceUrl(
  entityId: string,
  pageClass: EntitySourcePageClass,
) {
  const registry = await getEntitySourceRegistry(entityId)
  const matchingEntries = registry.filter((entry) => entry.page_class === pageClass)
  const canonicalEntry =
    matchingEntries.find((entry) => entry.is_canonical) ??
    sortRegistryEntries(matchingEntries)[0] ??
    null

  return canonicalEntry?.url ?? null
}
