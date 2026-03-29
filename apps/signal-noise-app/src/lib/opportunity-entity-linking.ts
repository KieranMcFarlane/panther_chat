interface CanonicalEntityLike {
  id?: string | null
  neo4j_id?: string | number | null
  properties?: {
    name?: string | null
    type?: string | null
  }
}

interface OpportunityLike {
  entity_id?: string | null
  entity_name?: string | null
  organization?: string | null
  title?: string | null
  description?: string | null
  source_url?: string | null
}

const STOP_TOKENS = new Set([
  'fc',
  'cf',
  'club',
  'football',
  'team',
  'the',
])

const GENERIC_ENTITY_TOKENS = new Set([
  'cricket',
  'football',
  'sport',
  'sports',
  'league',
  'club',
  'federation',
  'association',
  'athletics',
])

const DOMAIN_ENTITY_ALIASES: Array<{ host: string; preferredEntities: string[] }> = [
  {
    host: 'ausopen.com',
    preferredEntities: ['Tennis Australia'],
  },
  {
    host: 'wimbledon.com',
    preferredEntities: ['Wimbledon (The Championships)', 'All England Lawn Tennis Association'],
  },
]

const ORGANIZATION_ENTITY_ALIASES: Array<{ match: string; preferredEntities: string[] }> = [
  {
    match: 'French Football Federation (FFF)',
    preferredEntities: ['French Football Federation'],
  },
  {
    match: 'Korea Football Association',
    preferredEntities: ['Korea Football Association'],
  },
  {
    match: 'U.S. Soccer Federation',
    preferredEntities: ['U.S. Soccer Federation', 'US Soccer Federation'],
  },
  {
    match: 'Mexican Football Federation',
    preferredEntities: ['Mexican Football Federation'],
  },
  {
    match: 'USA Cricket',
    preferredEntities: ['USA Cricket'],
  },
  {
    match: 'USA Cycling',
    preferredEntities: ['USA Cycling'],
  },
]

function normalizeName(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[()]/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !STOP_TOKENS.has(token))
    .join(' ')
}

function scoreCandidate(left: string, right: string): number {
  if (!left || !right) return -1
  if (left === right) return 100

  const leftTokens = new Set(left.split(' ').filter(Boolean))
  const rightTokens = new Set(right.split(' ').filter(Boolean))
  const leftSubsetTokens = [...leftTokens].filter((token) => token.length > 3 || leftTokens.size === 1)
  const rightSubsetTokens = [...rightTokens].filter((token) => token.length > 3 || rightTokens.size === 1)
  const leftContainsRight =
    rightSubsetTokens.length > 0 && rightSubsetTokens.every((token) => leftTokens.has(token))
  const rightContainsLeft =
    leftSubsetTokens.length > 0 && leftSubsetTokens.every((token) => rightTokens.has(token))

  if (leftContainsRight || rightContainsLeft) return 75

  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const maxSize = Math.max(leftTokens.size, rightTokens.size)

  if (overlap === 0 || maxSize === 0) return -1
  return Math.round((overlap / maxSize) * 100)
}

function tokenCount(value: string): number {
  return value.split(' ').filter(Boolean).length
}

function meaningfulTokens(value: string): string[] {
  const tokens = value.split(' ')
  return tokens
    .filter(Boolean)
    .filter((token) => token.length > 3 || tokens.length === 1)
    .filter((token) => !GENERIC_ENTITY_TOKENS.has(token))
}

function scoreEntityType(entity: CanonicalEntityLike): number {
  const type = String(entity.properties?.type || '').toLowerCase()

  if (
    type.includes('sports entity') ||
    type.includes('organization') ||
    type.includes('club') ||
    type.includes('league') ||
    type.includes('federation')
  ) {
    return 20
  }

  if (type.includes('rfp entity')) {
    return -20
  }

  if (type.includes('category') || type.includes('business opportunity') || type.includes('business action')) {
    return -30
  }

  return 0
}

function scoreSpecificity(candidateName: string): number {
  const tokens = tokenCount(candidateName)
  const meaningful = meaningfulTokens(candidateName)
  if (meaningful.length === 0) return -50
  if (tokens === 1 && GENERIC_ENTITY_TOKENS.has(candidateName)) return -40
  if (tokens >= 3) return 8
  if (tokens === 2) return 4
  if (tokens <= 1) return -10
  return 0
}

function buildSourceCandidates(opportunity: OpportunityLike): string[] {
  const directFields = [
    opportunity.entity_name,
    opportunity.organization,
    opportunity.title,
    opportunity.description,
  ]
    .map((value) => normalizeName(value))
    .filter(Boolean)

  const combined = normalizeName(
    [
      opportunity.entity_name,
      opportunity.organization,
      opportunity.title,
      opportunity.description,
    ]
      .filter(Boolean)
      .join(' '),
  )

  return [...new Set([...directFields, combined].filter(Boolean))]
}

function resolvePreferredDomainAlias(
  sourceUrl: string | null | undefined,
  canonicalEntities: CanonicalEntityLike[],
): CanonicalEntityLike | null {
  if (!sourceUrl) {
    return null
  }

  let host = ''
  try {
    host = new URL(sourceUrl).hostname.toLowerCase()
  } catch {
    return null
  }

  const aliasRule = DOMAIN_ENTITY_ALIASES.find((entry) => host === entry.host || host.endsWith(`.${entry.host}`))
  if (!aliasRule) {
    return null
  }

  for (const preferredEntity of aliasRule.preferredEntities) {
    const normalizedPreferred = normalizeName(preferredEntity)
    const match = canonicalEntities.find((entity) => normalizeName(entity.properties?.name) === normalizedPreferred)
    if (match) {
      return match
    }
  }

  return {
    id: null,
    neo4j_id: null,
    properties: {
      name: '__domain_alias_unresolved__',
      type: 'Alias Guard',
    },
  }
}

function resolveOrganizationAlias(
  opportunity: OpportunityLike,
  canonicalEntities: CanonicalEntityLike[],
): CanonicalEntityLike | null {
  const normalizedOrganization = normalizeName(opportunity.organization)
  if (!normalizedOrganization) {
    return null
  }

  const aliasRule = ORGANIZATION_ENTITY_ALIASES.find((entry) => normalizedOrganization === normalizeName(entry.match))
  if (!aliasRule) {
    return null
  }

  for (const preferredEntity of aliasRule.preferredEntities) {
    const normalizedPreferred = normalizeName(preferredEntity)
    const match = canonicalEntities.find((entity) => normalizeName(entity.properties?.name) === normalizedPreferred)
    if (match) {
      return match
    }
  }

  return {
    id: null,
    neo4j_id: null,
    properties: {
      name: '__organization_alias_unresolved__',
      type: 'Alias Guard',
    },
  }
}

function hasStrongMeaningfulOverlap(sourceCandidates: string[], candidateName: string): boolean {
  const candidateMeaningful = meaningfulTokens(candidateName)

  if (candidateMeaningful.length === 0) {
    return false
  }

  const highestOverlap = sourceCandidates.reduce((maxOverlap, sourceCandidate) => {
    const sourceMeaningful = new Set(meaningfulTokens(sourceCandidate))
    const overlap = candidateMeaningful.filter((token) => sourceMeaningful.has(token)).length
    return Math.max(maxOverlap, overlap)
  }, 0)

  if (candidateMeaningful.length >= 2) {
    return highestOverlap >= 2
  }

  return highestOverlap >= 1
}

export function linkOpportunityToCanonicalEntity<T extends OpportunityLike>(
  opportunity: T,
  canonicalEntities: CanonicalEntityLike[],
): T & { canonical_entity_id: string | null; canonical_entity_name: string | null } {
  const preferredDomainEntity = resolvePreferredDomainAlias(opportunity.source_url, canonicalEntities)
  if (preferredDomainEntity?.properties?.name === '__domain_alias_unresolved__') {
    return {
      ...opportunity,
      canonical_entity_id: null,
      canonical_entity_name: null,
    }
  }

  if (preferredDomainEntity) {
    return {
      ...opportunity,
      canonical_entity_id: String(preferredDomainEntity.id || preferredDomainEntity.neo4j_id || ''),
      canonical_entity_name: String(preferredDomainEntity.properties?.name || ''),
    }
  }

  const preferredOrganizationEntity = resolveOrganizationAlias(opportunity, canonicalEntities)
  if (preferredOrganizationEntity?.properties?.name === '__organization_alias_unresolved__') {
    return {
      ...opportunity,
      canonical_entity_id: null,
      canonical_entity_name: null,
    }
  }

  if (preferredOrganizationEntity) {
    return {
      ...opportunity,
      canonical_entity_id: String(preferredOrganizationEntity.id || preferredOrganizationEntity.neo4j_id || ''),
      canonical_entity_name: String(preferredOrganizationEntity.properties?.name || ''),
    }
  }

  const sourceCandidates = buildSourceCandidates(opportunity)

  let bestMatch: CanonicalEntityLike | null = null
  let bestScore = -1

  for (const entity of canonicalEntities) {
    const candidateName = normalizeName(entity.properties?.name)
    const nameScore = sourceCandidates.reduce((highest, sourceCandidate) => {
      return Math.max(highest, scoreCandidate(sourceCandidate, candidateName))
    }, -1)
    const score = nameScore < 0 ? -1 : nameScore + scoreEntityType(entity) + scoreSpecificity(candidateName)
    if (score > bestScore) {
      bestScore = score
      bestMatch = entity
    }
  }

  const bestCandidateName = normalizeName(bestMatch?.properties?.name)

  if (!bestMatch || bestScore < 75 || !hasStrongMeaningfulOverlap(sourceCandidates, bestCandidateName)) {
    return {
      ...opportunity,
      canonical_entity_id: null,
      canonical_entity_name: null,
    }
  }

  return {
    ...opportunity,
    canonical_entity_id: String(bestMatch.id || bestMatch.neo4j_id || ''),
    canonical_entity_name: String(bestMatch.properties?.name || ''),
  }
}
