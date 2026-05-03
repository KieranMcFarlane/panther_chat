import type { CanonicalEntity } from '@/lib/entity-canonicalization'

export type QuestionFirstManifestEntity = {
  entity_id: string
  entity_name: string
  entity_type: string
  default_rollout_phase?: string
}

type RankedManifestEntity = QuestionFirstManifestEntity & {
  leaguePriority: number
  leaguePopularity: number
  priorityScore: number
  qualityScore: number
}

const LEAGUE_PRIORITY_ORDER = [
  'premier league',
  'bundesliga',
  'nba',
  'serie a',
  'major league soccer',
  'la liga',
  'league one',
  'league two',
  'ligue 1',
  'efl championship',
] as const

const LEAGUE_PRIORITY_MAP = new Map<string, number>(
  LEAGUE_PRIORITY_ORDER.map((league, index) => [league, index]),
)

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeType(type: unknown): string {
  const normalized = toText(type).toLowerCase()
  if (!normalized) return 'entity'
  if (normalized.includes('league')) return 'league'
  if (normalized.includes('federation')) return 'federation'
  if (normalized.includes('club') || normalized.includes('team')) return 'club'
  if (normalized.includes('person')) return 'person'
  return normalized
}

function normalizeKey(value: unknown): string {
  return toText(value).toLowerCase()
}

function buildLeagueKey(entity: CanonicalEntity): string {
  const properties = entity.properties || {}
  const type = normalizeType(properties.type || entity.labels?.[0])
  const name = normalizeKey(properties.name || entity.id)
  const league = normalizeKey(properties.league || properties.level)
  const sport = normalizeKey(properties.sport)
  const country = normalizeKey(properties.country)

  if (type === 'league') {
    return name || league || normalizeKey(entity.id)
  }

  if (league) {
    return league
  }

  if (sport || country) {
    return [sport, country].filter(Boolean).join('::') || type || name || normalizeKey(entity.id)
  }

  return type || name || normalizeKey(entity.id)
}

function buildManifestEntitySortRecord(
  entity: QuestionFirstManifestEntity,
  canonicalEntities: CanonicalEntity[],
  leaguePopularity: Map<string, number>,
): RankedManifestEntity {
  const canonicalMatch = canonicalEntities.find((candidate) => {
    const candidateType = normalizeType(candidate.properties?.type || candidate.labels?.[0])
    return normalizeKey(candidate.properties?.name) === normalizeKey(entity.entity_name)
      && candidateType === normalizeType(entity.entity_type)
  }) || null

  const properties = canonicalMatch?.properties || {}
  const leagueKey = canonicalMatch ? buildLeagueKey(canonicalMatch) : normalizeKey(entity.entity_type)

  return {
    ...entity,
    leaguePriority: LEAGUE_PRIORITY_MAP.get(leagueKey) ?? LEAGUE_PRIORITY_ORDER.length,
    leaguePopularity: leaguePopularity.get(leagueKey) || 0,
    priorityScore: Number(properties.priority_score ?? properties.priority ?? 0) || 0,
    qualityScore: Number(properties.quality_score ?? 0) || 0,
  }
}

export function describeQuestionFirstQueueOrder(): string[] {
  return [
    'league_priority ASC',
    'league_popularity DESC',
    'priority_score DESC',
    'quality_score DESC',
    'entity_type ASC',
    'entity_name ASC',
    'entity_id ASC',
  ]
}

export function sortQuestionFirstManifestEntities(
  manifestEntities: QuestionFirstManifestEntity[],
  canonicalEntities: CanonicalEntity[],
): QuestionFirstManifestEntity[] {
  const leaguePopularity = new Map<string, number>()

  for (const entity of canonicalEntities) {
    const leagueKey = buildLeagueKey(entity)
    leaguePopularity.set(leagueKey, (leaguePopularity.get(leagueKey) || 0) + 1)
  }

  const rankedEntities = manifestEntities.map((entity) => buildManifestEntitySortRecord(entity, canonicalEntities, leaguePopularity))

  rankedEntities.sort((left, right) => {
    const leaguePriorityDifference = left.leaguePriority - right.leaguePriority
    if (leaguePriorityDifference !== 0) return leaguePriorityDifference

    const leagueDifference = right.leaguePopularity - left.leaguePopularity
    if (leagueDifference !== 0) return leagueDifference

    const priorityDifference = right.priorityScore - left.priorityScore
    if (priorityDifference !== 0) return priorityDifference

    const qualityDifference = right.qualityScore - left.qualityScore
    if (qualityDifference !== 0) return qualityDifference

    const typeComparison = normalizeType(left.entity_type).localeCompare(normalizeType(right.entity_type))
    if (typeComparison !== 0) return typeComparison

    const nameComparison = normalizeKey(left.entity_name).localeCompare(normalizeKey(right.entity_name))
    if (nameComparison !== 0) return nameComparison

    return normalizeKey(left.entity_id).localeCompare(normalizeKey(right.entity_id))
  })

  return rankedEntities.map(({ leaguePriority: _leaguePriority, leaguePopularity: _leaguePopularity, priorityScore: _priorityScore, qualityScore: _qualityScore, ...entity }) => entity)
}
