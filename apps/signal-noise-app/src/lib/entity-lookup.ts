import { buildGraphEntityLookupFilter } from '@/lib/graph-id'

function safeEqValue(value: string): string {
  return value.replace(/,/g, ' ')
}

export function buildCachedEntityLookupFilter(entityId: string): string {
  const id = safeEqValue(String(entityId || '').trim())
  if (!id) return 'id.is.null'

  const graphFilter = buildGraphEntityLookupFilter(id)
  return [
    graphFilter,
    `properties->>name.ilike.%${id}%`,
    `properties->>aliases.ilike.%${id}%`,
  ].join(',')
}
