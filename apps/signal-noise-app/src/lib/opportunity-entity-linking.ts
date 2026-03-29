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
}

const STOP_TOKENS = new Set([
  'fc',
  'cf',
  'club',
  'football',
  'team',
  'the',
])

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
  if (left.includes(right) || right.includes(left)) return 75

  const leftTokens = new Set(left.split(' ').filter(Boolean))
  const rightTokens = new Set(right.split(' ').filter(Boolean))
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const maxSize = Math.max(leftTokens.size, rightTokens.size)

  if (overlap === 0 || maxSize === 0) return -1
  return Math.round((overlap / maxSize) * 100)
}

export function linkOpportunityToCanonicalEntity<T extends OpportunityLike>(
  opportunity: T,
  canonicalEntities: CanonicalEntityLike[],
): T & { canonical_entity_id: string | null; canonical_entity_name: string | null } {
  const sourceName = normalizeName(opportunity.entity_name || opportunity.organization || opportunity.title)

  let bestMatch: CanonicalEntityLike | null = null
  let bestScore = -1

  for (const entity of canonicalEntities) {
    const candidateName = normalizeName(entity.properties?.name)
    const score = scoreCandidate(sourceName, candidateName)
    if (score > bestScore) {
      bestScore = score
      bestMatch = entity
    }
  }

  if (!bestMatch || bestScore < 75) {
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
