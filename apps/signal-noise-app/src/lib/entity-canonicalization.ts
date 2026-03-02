export interface CanonicalEntity {
  id: string
  neo4j_id: string | number
  labels?: string[]
  properties: Record<string, any>
  badge_path?: string | null
  badge_s3_url?: string | null
}

interface EntitySignature {
  type: string
  sport: string
  country: string
  name: string
}

const STOP_TOKENS = new Set([
  'fc',
  'cf',
  'club',
  'team',
  'json',
  'seed',
  'jsonseed',
  'the',
])

function stripDiacritics(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeType(type: unknown): string {
  const normalized = normalizeText(type).toLowerCase()

  if (!normalized) return 'Entity'
  if (normalized.includes('club') || normalized.includes('team')) return 'Club'
  if (normalized.includes('league')) return 'League'
  if (normalized.includes('federation')) return 'Federation'
  if (normalized.includes('organization')) return 'Organization'
  if (normalized.includes('tournament')) return 'Tournament'
  if (normalized.includes('person')) return 'Person'

  return normalizeText(type) || 'Entity'
}

function normalizeNameForKey(name: unknown): string {
  const normalized = stripDiacritics(
    normalizeText(name)
      .toLowerCase()
      .replace(/\((json[_\s-]*seed|seed)\)/gi, ' ')
      .replace(/&/g, ' and ')
  )

  return normalized
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !STOP_TOKENS.has(token))
    .map((token) => {
      if (!/[a-z]/.test(token) || token.length <= 3) {
        return token
      }

      return token[0] + token.slice(1).replace(/[aeiou]/g, '')
    })
    .join(' ')
}

function normalizeSport(value: unknown): string {
  return normalizeText(value) || 'Unknown Sport'
}

function normalizeCountry(value: unknown): string {
  return normalizeText(value) || 'Unknown Country'
}

function normalizeLeague(value: unknown): string {
  const normalized = normalizeText(value)
  return /^\d+$/.test(normalized) ? '' : normalized
}

function scoreEntityVariant(entity: CanonicalEntity): number {
  const properties = entity.properties || {}
  const name = normalizeText(properties.name)
  const normalizedType = normalizeType(properties.type)
  const league = normalizeLeague(properties.league)
  const level = normalizeLeague(properties.level)

  let score = 0

  if (name) score += 10
  if (normalizedType !== 'Entity') score += 12
  if (normalizeSport(properties.sport) !== 'Unknown Sport') score += 10
  if (normalizeCountry(properties.country) !== 'Unknown Country') score += 10
  if (league) score += 40
  if (level) score += 20
  if (entity.badge_path || entity.badge_s3_url || properties.badge_path || properties.badge_s3_url) score += 8
  if ((entity.labels || []).length > 0) score += 4
  if (/\(json[_\s-]*seed|seed\)/i.test(name)) score -= 30
  if (!normalizeText(properties.sport)) score -= 10
  if (!normalizeText(properties.country)) score -= 10
  if (/^[0-9]+$/.test(normalizeText(properties.level))) score -= 5

  return score
}

function chooseBetterValue(currentValue: unknown, candidateValue: unknown): unknown {
  const currentText = normalizeText(currentValue)
  const candidateText = normalizeText(candidateValue)

  if (!candidateText) return currentValue
  if (!currentText) return candidateValue

  if (/^\d+$/.test(currentText) && !/^\d+$/.test(candidateText)) {
    return candidateValue
  }

  if (/\(json[_\s-]*seed|seed\)/i.test(currentText) && !/\(json[_\s-]*seed|seed\)/i.test(candidateText)) {
    return candidateValue
  }

  return currentValue
}

function mergeEntityVariants(variants: CanonicalEntity[]): CanonicalEntity {
  const sortedVariants = [...variants].sort((left, right) => {
    const scoreDifference = scoreEntityVariant(right) - scoreEntityVariant(left)
    if (scoreDifference !== 0) return scoreDifference

    return normalizeText(left.properties?.name).length - normalizeText(right.properties?.name).length
  })

  const bestVariant = sortedVariants[0]
  const mergedProperties = { ...(bestVariant.properties || {}) }
  let mergedLabels = [...(bestVariant.labels || [])]
  let badgePath = bestVariant.badge_path || bestVariant.properties?.badge_path || null
  let badgeS3Url = bestVariant.badge_s3_url || bestVariant.properties?.badge_s3_url || null

  for (const variant of sortedVariants.slice(1)) {
    const properties = variant.properties || {}

    for (const [propertyKey, propertyValue] of Object.entries(properties)) {
      mergedProperties[propertyKey] = chooseBetterValue(mergedProperties[propertyKey], propertyValue)
    }

    mergedLabels = Array.from(new Set([...mergedLabels, ...(variant.labels || [])]))
    badgePath = chooseBetterValue(badgePath, variant.badge_path || properties.badge_path) as string | null
    badgeS3Url = chooseBetterValue(badgeS3Url, variant.badge_s3_url || properties.badge_s3_url) as string | null
  }

  mergedProperties.type = normalizeType(mergedProperties.type)

  return {
    ...bestVariant,
    labels: mergedLabels,
    badge_path: badgePath,
    badge_s3_url: badgeS3Url,
    properties: mergedProperties,
  }
}

export function getCanonicalEntityKey(entity: CanonicalEntity | null | undefined): string {
  if (!entity) return ''

  const properties = entity.properties || {}
  return [
    normalizeType(properties.type),
    normalizeSport(properties.sport),
    normalizeCountry(properties.country),
    normalizeNameForKey(properties.name),
  ].join('|')
}

function getEntitySignature(entity: CanonicalEntity): EntitySignature {
  const properties = entity.properties || {}

  return {
    type: normalizeType(properties.type),
    sport: normalizeSport(properties.sport),
    country: normalizeCountry(properties.country),
    name: normalizeNameForKey(properties.name),
  }
}

function signatureCompatibilityScore(left: EntitySignature, right: EntitySignature): number {
  if (!left.name || !right.name || left.name !== right.name) return -1
  if (left.type !== right.type) return -1

  let score = 0

  if (left.sport === right.sport) {
    score += 2
  } else if (left.sport === 'Unknown Sport' || right.sport === 'Unknown Sport') {
    score += 1
  } else {
    return -1
  }

  if (left.country === right.country) {
    score += 2
  } else if (left.country === 'Unknown Country' || right.country === 'Unknown Country') {
    score += 1
  } else {
    return -1
  }

  return score
}

export function canonicalizeEntities(entities: CanonicalEntity[]): CanonicalEntity[] {
  const bestScoreByName = new Map<string, number>()

  for (const entity of entities) {
    const nameKey = normalizeNameForKey(entity.properties?.name)
    if (!nameKey) continue

    const currentBestScore = bestScoreByName.get(nameKey) ?? Number.NEGATIVE_INFINITY
    bestScoreByName.set(nameKey, Math.max(currentBestScore, scoreEntityVariant(entity)))
  }

  const filteredEntities = entities.filter((entity) => {
    const name = normalizeText(entity.properties?.name)
    if (!/\(json[_\s-]*seed|seed\)/i.test(name)) {
      return true
    }

    const nameKey = normalizeNameForKey(name)
    const bestScore = bestScoreByName.get(nameKey) ?? Number.NEGATIVE_INFINITY
    return scoreEntityVariant(entity) >= bestScore
  })

  const entityGroups: CanonicalEntity[][] = []

  for (const entity of filteredEntities) {
    const signature = getEntitySignature(entity)
    if (!signature.name) continue

    let bestGroup: CanonicalEntity[] | null = null
    let bestScore = -1

    for (const group of entityGroups) {
      const groupSignature = getEntitySignature(group[0])
      const score = signatureCompatibilityScore(signature, groupSignature)
      if (score > bestScore) {
        bestScore = score
        bestGroup = group
      }
    }

    if (bestGroup && bestScore >= 0) {
      bestGroup.push(entity)
    } else {
      entityGroups.push([entity])
    }
  }

  return entityGroups.map((variants) => mergeEntityVariants(variants))
}
