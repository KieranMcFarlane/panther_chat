import { normalizeFacetKey, normalizeFacetLabel } from './facet-normalization.ts'

export type CanonicalEntityRole =
  | 'Club'
  | 'Team'
  | 'League'
  | 'Competition'
  | 'Federation'
  | 'Venue'
  | 'Person'
  | 'Brand'
  | 'Media'
  | 'Technology'
  | 'Sponsor'
  | 'Organization'
  | 'Unknown'

type RoleEntityLike = {
  labels?: string[] | null
  properties?: Record<string, unknown> | null
}

function normalizeRoleText(value: unknown): string {
  return normalizeFacetKey(value)
}

function includesAny(value: unknown, needles: string[]): boolean {
  const haystack = normalizeRoleText(value)
  if (!haystack) return false
  const tokens = haystack.split(' ').filter(Boolean)

  return needles.some((needle) => {
    const normalizedNeedle = normalizeRoleText(needle)
    if (!normalizedNeedle) return false
    if (!normalizedNeedle.includes(' ')) {
      return tokens.includes(normalizedNeedle)
    }
    return haystack.includes(normalizedNeedle)
  })
}

function buildRoleText(entity: RoleEntityLike): string {
  const properties = entity?.properties || {}
  const labels = (entity?.labels || []).map((label) => normalizeFacetLabel(label)).filter(Boolean)
  return [
    properties.name,
    properties.type,
    properties.entityClass,
    properties.entity_class,
    labels.join(' '),
  ].filter(Boolean).join(' ')
}

export function getCanonicalEntityRole(entity: RoleEntityLike | null | undefined): CanonicalEntityRole {
  const properties = entity?.properties || {}
  const text = buildRoleText(entity || {})

  if (includesAny(text, ['director', 'manager', 'coach', 'ceo', 'chairman', 'president', 'owner', 'executive', 'player', 'athlete', 'captain', 'secretary', 'head', 'chief', 'officer'])) {
    return 'Person'
  }
  if (includesAny(text, ['stadium', 'arena', 'ground', 'park', 'field', 'centre', 'center', 'oval', 'coliseum', 'venue', 'facility', 'complex'])) {
    return 'Venue'
  }
  if (includesAny(text, ['tv', 'television', 'radio', 'media', 'broadcast', 'channel', 'network', 'newspaper', 'magazine', 'website', 'streaming'])) {
    return 'Media'
  }
  if (includesAny(text, ['software', 'platform', 'app', 'technology', 'digital', 'analytics', 'data', 'systems', 'infrastructure', 'cloud'])) {
    return 'Technology'
  }
  if (includesAny(text, ['sponsor', 'partner', 'backer', 'supporter', 'funding', 'investment'])) {
    return 'Sponsor'
  }
  if (includesAny(text, ['club', 'fc'])) return 'Club'
  if (includesAny(text, ['team', 'squad'])) return 'Team'
  if (includesAny(text, ['federation', 'association', 'confederation', 'union', 'governing', 'rights holder'])) return 'Federation'
  if (includesAny(text, ['league', 'division', 'conference', 'premiership'])) return 'League'
  if (includesAny(text, ['competition', 'championship', 'championships', 'cup', 'tournament', 'series', 'grand prix', 'open', 'masters', 'games'])) return 'Competition'
  if (includesAny(text, ['brand', 'apparel', 'equipment', 'gear', 'manufacturer', 'supplier'])) return 'Brand'
  if (includesAny(text, ['organization', 'organisation', 'body', 'authority', 'council', 'institute', 'committee', 'commission', 'foundation', 'trust'])) return 'Organization'

  if (normalizeFacetLabel(properties.sport) || normalizeFacetLabel(properties.country)) {
    return 'Organization'
  }

  return 'Organization'
}

export function isLeagueLikeEntity(entity: RoleEntityLike | null | undefined): boolean {
  const role = getCanonicalEntityRole(entity)
  return role === 'League' || role === 'Competition'
}

export function isTeamLikeEntity(entity: RoleEntityLike | null | undefined): boolean {
  const role = getCanonicalEntityRole(entity)
  return role === 'Team' || role === 'Club'
}
