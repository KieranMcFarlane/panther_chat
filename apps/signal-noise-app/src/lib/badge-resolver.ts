import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'

type BadgeMapping = {
  entityId?: string | number
  entityName?: string
  badgePath?: string
}

type ResolveBadgeOptions = {
  entityId?: string | number | null
  entityName?: string | null
  badgePath?: string | null
  badgeS3Url?: string | null
}

const BADGES_DIR = path.join(process.cwd(), 'public', 'badges')
const BADGE_MAPPING_PATH = path.join(BADGES_DIR, 'badge-mapping.json')

let badgeFilenamesCache: Set<string> | null = null
let badgeMappingsCache: BadgeMapping[] | null = null

function getBadgeFilenames() {
  if (badgeFilenamesCache) {
    return badgeFilenamesCache
  }

  const filenames = existsSync(BADGES_DIR)
    ? readdirSync(BADGES_DIR).filter((filename) => filename !== '.DS_Store')
    : []

  badgeFilenamesCache = new Set(filenames)
  return badgeFilenamesCache
}

function getBadgeMappings() {
  if (badgeMappingsCache) {
    return badgeMappingsCache
  }

  if (!existsSync(BADGE_MAPPING_PATH)) {
    badgeMappingsCache = []
    return badgeMappingsCache
  }

  try {
    const raw = readFileSync(BADGE_MAPPING_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    badgeMappingsCache = Array.isArray(parsed) ? parsed : []
  } catch {
    badgeMappingsCache = []
  }

  return badgeMappingsCache
}

function normalizeEntityName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

function slugifyEntityName(value: string) {
  return normalizeEntityName(value)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function normalizeBadgePathToLocalUrl(badgePath?: string | null) {
  if (!badgePath) {
    return null
  }

  const filename = path.basename(badgePath)
  if (!filename) {
    return null
  }

  return getBadgeFilenames().has(filename) ? `/badges/${filename}` : null
}

function getSpecialCaseBadgeFilename(normalizedEntityName: string) {
  if (normalizedEntityName.includes('union') && normalizedEntityName.includes('berlin')) {
    return 'union-berlin-badge.png'
  }

  if (normalizedEntityName.includes('fc') && (normalizedEntityName.includes('koln') || normalizedEntityName.includes('kln'))) {
    return '1-fc-kln-badge.png'
  }

  return null
}

function buildCandidateBadgeFilenames(entityName: string) {
  const mainName = entityName
    .replace(/ Football Club$/i, '')
    .replace(/ FC$/i, '')
    .replace(/ AFC$/i, '')
    .replace(/ Club$/i, '')
    .trim()

  const normalizedEntityName = normalizeEntityName(entityName)
  const normalizedMainName = slugifyEntityName(mainName)
  const normalizedFullName = slugifyEntityName(entityName)
  const specialCase = getSpecialCaseBadgeFilename(normalizedEntityName)

  return Array.from(new Set([
    specialCase,
    `${normalizedMainName}-badge.png`,
    `${normalizedFullName}-badge.png`,
    `${normalizedMainName}.png`,
    `${normalizedFullName}.png`,
  ].filter(Boolean) as string[]))
}

export function resolveLocalBadgeUrl({
  entityId,
  entityName,
  badgePath,
  badgeS3Url,
}: ResolveBadgeOptions) {
  const explicitLocalBadgeUrl = normalizeBadgePathToLocalUrl(badgePath) || normalizeBadgePathToLocalUrl(badgeS3Url)
  if (explicitLocalBadgeUrl) {
    return explicitLocalBadgeUrl
  }

  const mappings = getBadgeMappings()
  const normalizedEntityName = entityName ? normalizeEntityName(entityName) : null
  const entityIdString = entityId == null ? null : String(entityId)

  const mappedBadgeUrl = mappings
    .find((mapping) => {
      if (entityIdString && mapping.entityId != null && String(mapping.entityId) === entityIdString) {
        return true
      }

      if (!normalizedEntityName || !mapping.entityName) {
        return false
      }

      return normalizeEntityName(mapping.entityName) === normalizedEntityName
    })

  const normalizedMappedBadgeUrl = normalizeBadgePathToLocalUrl(mappedBadgeUrl?.badgePath)
  if (normalizedMappedBadgeUrl) {
    return normalizedMappedBadgeUrl
  }

  if (!entityName) {
    return null
  }

  for (const candidateFilename of buildCandidateBadgeFilenames(entityName)) {
    if (getBadgeFilenames().has(candidateFilename)) {
      return `/badges/${candidateFilename}`
    }
  }

  return null
}
