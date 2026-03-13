import {
  canonicalizeEntityType,
  canonicalizeLeagueName,
  getEntitySport,
  normalizeForSearch,
} from '@/lib/entity-taxonomy'

type RawEntity = {
  id?: string | number
  labels?: string[]
  properties?: Record<string, any>
}

function normalizeKeyPart(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function qualityScore(entity: RawEntity): number {
  const properties = entity.properties || {}
  let score = 0
  const canonicalType = canonicalizeEntityType(entity)
  const typeScore: Record<string, number> = {
    team: 12,
    league: 10,
    federation: 10,
    rights_holder: 9,
    organisation: 6,
    unknown: 0,
  }

  if (properties.name) score += 50
  if (properties.normalized_name) score += 10
  if (properties.sport) score += 8
  if (properties.league || properties.parent_league || properties.level) score += 8
  if (properties.country) score += 5
  if (properties.description) score += 4
  if (properties.website) score += 2
  if (Array.isArray(properties.aliases) && properties.aliases.length > 0) score += 6
  if (Array.isArray(entity.labels) && entity.labels.length > 1) score += 4
  score += typeScore[canonicalType] || 0

  const updatedAt = Date.parse(String(properties.updated_at_iso || ''))
  if (!Number.isNaN(updatedAt)) {
    score += Math.min(Math.floor((Date.now() - updatedAt) / (1000 * 60 * 60 * 24 * 30)), 3)
  }

  return score
}

export function canonicalEntityKey(entity: RawEntity): string {
  const properties = entity.properties || {}
  const canonicalType = canonicalizeEntityType(entity)
  const rawName = canonicalType === 'league'
    ? canonicalizeLeagueName(properties.name || properties.normalized_name || entity.id || '')
    : (properties.normalized_name || properties.name || entity.id || '')
  const normalizedName = normalizeKeyPart(rawName)
  const sport = normalizeKeyPart(getEntitySport(entity))

  return [normalizedName || normalizeForSearch(entity.id), sport].join('|')
}

export function dedupeCanonicalEntities<T extends RawEntity>(entities: T[]): T[] {
  const buckets = new Map<string, T>()

  for (const entity of entities) {
    const key = canonicalEntityKey(entity)
    const existing = buckets.get(key)
    if (!existing) {
      buckets.set(key, entity)
      continue
    }

    if (qualityScore(entity) > qualityScore(existing)) {
      buckets.set(key, entity)
    }
  }

  return Array.from(buckets.values())
}
