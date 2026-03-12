export const REQUIRED_ENTITY_IMPORT_COLUMNS = [
  'name',
  'entity_type',
  'sport',
  'country',
  'source',
] as const

export const OPTIONAL_ENTITY_IMPORT_COLUMNS = [
  'external_id',
  'website',
  'league',
  'founded_year',
  'headquarters',
  'stadium_name',
  'capacity',
  'description',
  'priority_score',
  'badge_url',
] as const

export const ALL_ENTITY_IMPORT_COLUMNS = [
  ...REQUIRED_ENTITY_IMPORT_COLUMNS,
  ...OPTIONAL_ENTITY_IMPORT_COLUMNS,
] as const

export type RequiredEntityImportColumn = (typeof REQUIRED_ENTITY_IMPORT_COLUMNS)[number]
export type OptionalEntityImportColumn = (typeof OPTIONAL_ENTITY_IMPORT_COLUMNS)[number]
export type EntityImportColumn = (typeof ALL_ENTITY_IMPORT_COLUMNS)[number]

export interface ImportedEntityRow {
  name: string
  entity_type: string
  sport: string
  country: string
  source: string
  external_id?: string
  website?: string
  league?: string
  founded_year?: string
  headquarters?: string
  stadium_name?: string
  capacity?: string
  description?: string
  priority_score: number
  badge_url?: string
  entity_id: string
}

export interface EntityImportNormalizationResult {
  valid: boolean
  row?: ImportedEntityRow
  errors: string[]
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeEntityType(value: unknown): string {
  const normalized = normalizeText(value).toUpperCase()

  if (normalized.includes('CLUB') || normalized.includes('TEAM')) return 'CLUB'
  if (normalized.includes('LEAGUE')) return 'LEAGUE'
  if (normalized.includes('FEDERATION')) return 'FEDERATION'
  if (normalized.includes('VENUE')) return 'VENUE'
  if (normalized.includes('PERSON')) return 'PERSON'
  if (normalized.includes('ORG') || normalized.includes('ORGANIZATION')) return 'ORG'

  return normalized || 'ORG'
}

export function slugifyImportedEntityName(name: string): string {
  return normalizeText(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeImportedEntityRow(
  input: Record<string, unknown>,
): EntityImportNormalizationResult {
  const missingColumns = REQUIRED_ENTITY_IMPORT_COLUMNS.filter((column) => !normalizeText(input[column]))

  if (missingColumns.length > 0) {
    return {
      valid: false,
      errors: [`Missing required columns: ${missingColumns.join(', ')}`],
    }
  }

  const name = normalizeText(input.name)
  const entity_id = slugifyImportedEntityName(name)

  if (!entity_id) {
    return {
      valid: false,
      errors: ['Missing required columns: name'],
    }
  }

  const parsedPriorityScore = Number.parseInt(normalizeText(input.priority_score) || '85', 10)

  const row: ImportedEntityRow = {
    name,
    entity_type: normalizeEntityType(input.entity_type),
    sport: normalizeText(input.sport),
    country: normalizeText(input.country),
    source: normalizeText(input.source),
    external_id: normalizeText(input.external_id) || undefined,
    website: normalizeText(input.website) || undefined,
    league: normalizeText(input.league) || undefined,
    founded_year: normalizeText(input.founded_year) || undefined,
    headquarters: normalizeText(input.headquarters) || undefined,
    stadium_name: normalizeText(input.stadium_name) || undefined,
    capacity: normalizeText(input.capacity) || undefined,
    description: normalizeText(input.description) || undefined,
    priority_score: Number.isNaN(parsedPriorityScore) ? 85 : parsedPriorityScore,
    badge_url: normalizeText(input.badge_url) || undefined,
    entity_id,
  }

  return {
    valid: true,
    row,
    errors: [],
  }
}
