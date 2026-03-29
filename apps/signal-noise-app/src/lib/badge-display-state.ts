export interface BadgeEntityLike {
  id?: string | number | null
  badge_s3_url?: string | null
  badge_lookup_complete?: boolean | null
  badge_path?: string | null
  properties?: {
    name?: string | null
    badge_s3_url?: string | null
    badge_lookup_complete?: boolean | null
    badge_path?: string | null
  } | null
}

export interface BadgeDisplayState {
  explicitBadgeUrl: string | null
  isLookupComplete: boolean
  shouldLookupBadge: boolean
  initialLoading: boolean
}

export function resolveBadgeDisplayState(entity: BadgeEntityLike | null | undefined): BadgeDisplayState {
  const explicitBadgeUrl =
    entity?.badge_s3_url ||
    entity?.properties?.badge_s3_url ||
    entity?.properties?.badge_path ||
    entity?.badge_path ||
    null

  const isLookupComplete =
    Boolean(entity?.badge_lookup_complete) ||
    Boolean(entity?.properties?.badge_lookup_complete) ||
    Boolean(explicitBadgeUrl)

  const shouldLookupBadge = !explicitBadgeUrl && !isLookupComplete

  return {
    explicitBadgeUrl,
    isLookupComplete,
    shouldLookupBadge,
    initialLoading: shouldLookupBadge,
  }
}
