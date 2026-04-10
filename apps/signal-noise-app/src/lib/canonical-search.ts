import { normalizeFacetLabel } from './facet-normalization.ts'
import { getCanonicalEntityRole } from './entity-role-taxonomy.ts'

function normalizeSearchText(value: unknown): string {
  return normalizeFacetLabel(value).toLowerCase()
}

function pushText(parts: string[], value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) {
      pushText(parts, item)
    }
    return
  }

  const text = normalizeSearchText(value)
  if (text) parts.push(text)
}

export function buildCanonicalEntitySearchText(entity: any): string {
  const properties = entity?.properties || {}
  const role = getCanonicalEntityRole(entity)
  const parts: string[] = []

  pushText(parts, properties.name)
  pushText(parts, properties.alias)
  pushText(parts, properties.aliases)
  pushText(parts, properties.type)
  pushText(parts, properties.entityClass)
  pushText(parts, properties.entity_class)
  pushText(parts, role)
  pushText(parts, properties.sport)
  pushText(parts, properties.country)
  pushText(parts, properties.league)
  pushText(parts, properties.level)
  pushText(parts, properties.competition)
  pushText(parts, properties.parent_league)
  pushText(parts, properties.parentCompetition)
  pushText(parts, properties.parent_competition)
  pushText(parts, properties.description)
  pushText(parts, entity?.labels)

  return parts.join(' ')
}

export function buildCanonicalOpportunitySearchText(opportunity: any): string {
  const parts: string[] = []

  pushText(parts, opportunity?.title)
  pushText(parts, opportunity?.organization)
  pushText(parts, opportunity?.entity_name)
  pushText(parts, opportunity?.canonical_entity_name)
  pushText(parts, opportunity?.description)
  pushText(parts, opportunity?.location)
  pushText(parts, opportunity?.category)
  pushText(parts, opportunity?.subcategory)
  pushText(parts, opportunity?.sport)
  pushText(parts, opportunity?.competition)
  pushText(parts, opportunity?.entity_role)
  pushText(parts, opportunity?.opportunity_kind)
  pushText(parts, opportunity?.theme)
  pushText(parts, opportunity?.tags)
  pushText(parts, opportunity?.keywords)

  return parts.join(' ')
}

export function matchesCanonicalSearch(query: string, ...sources: Array<string | null | undefined>): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true

  const haystack = sources
    .map((value) => normalizeSearchText(value))
    .filter(Boolean)
    .join(' ')

  if (!haystack) return false

  return normalizedQuery
    .split(' ')
    .filter(Boolean)
    .every((token) => haystack.includes(token))
}
