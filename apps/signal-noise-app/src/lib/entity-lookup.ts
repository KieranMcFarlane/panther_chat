import { buildGraphEntityLookupFilter } from '@/lib/graph-id'

export function isUuidLike(entityId: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entityId)
}

export function buildCachedEntityLookupFilter(entityId: string) {
  return buildGraphEntityLookupFilter(entityId)
}
