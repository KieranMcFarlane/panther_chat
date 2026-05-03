import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type YpTeamStatus = 'active' | 'excluded'

export type YpTeamRosterMember = {
  member_id: string
  display_order: number
  yp_name: string
  yp_role: string
  yp_linkedin: string
  yp_weight: number
  yp_expertise_1: string
  yp_expertise_2: string
  yp_expertise_3: string
  status: YpTeamStatus
}

export type YpTeamValidationIssue = {
  field: keyof YpTeamRosterMember | 'row'
  message: string
}

export const VALID_YP_TEAM_STATUSES: YpTeamStatus[] = ['active', 'excluded']
export const DEFAULT_YP_TEAM_ROSTER_PATH = path.join(
  process.cwd(),
  'backend',
  'data',
  'dossier_templates',
  'yp_team.csv',
)

const CSV_HEADERS: Array<keyof YpTeamRosterMember> = [
  'member_id',
  'display_order',
  'yp_name',
  'yp_role',
  'yp_linkedin',
  'yp_weight',
  'yp_expertise_1',
  'yp_expertise_2',
  'yp_expertise_3',
  'status',
]

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'member'
}

export function normalizeLinkedinProfileUrl(url: string): string {
  const value = String(url || '').trim()
  if (!value) {
    throw new Error('LinkedIn URL is required')
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('LinkedIn URL must be a valid URL')
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('LinkedIn URL must start with http:// or https://')
  }
  if (!parsed.hostname.toLowerCase().includes('linkedin.com')) {
    throw new Error('LinkedIn URL must point to linkedin.com')
  }

  const pathMatch = parsed.pathname.replace(/\/+$/, '').match(/^\/in\/([^/?#]+)$/)
  if (!pathMatch) {
    throw new Error('LinkedIn URL must be a person profile URL like https://www.linkedin.com/in/name/')
  }

  return `https://www.linkedin.com/in/${pathMatch[1]}/`
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      const next = line[index + 1]
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  return values
}

function toCsvCell(value: unknown): string {
  const raw = String(value ?? '')
  if (!/[",\n]/.test(raw)) {
    return raw
  }
  return `"${raw.replace(/"/g, '""')}"`
}

function normalizeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

export function validateYpTeamMember(
  input: Partial<YpTeamRosterMember>,
  options: { fallbackOrder?: number } = {},
): { member?: YpTeamRosterMember; issues: YpTeamValidationIssue[] } {
  const fallbackOrder = options.fallbackOrder ?? 10
  const issues: YpTeamValidationIssue[] = []
  const yp_name = String(input.yp_name || '').trim()
  const yp_role = String(input.yp_role || '').trim()
  const status = String(input.status || 'active').trim().toLowerCase() as YpTeamStatus
  const member_id = String(input.member_id || '').trim() || slugify(yp_name)

  if (!yp_name) issues.push({ field: 'yp_name', message: 'Name is required' })
  if (!yp_role) issues.push({ field: 'yp_role', message: 'Role is required' })
  if (!VALID_YP_TEAM_STATUSES.includes(status)) {
    issues.push({ field: 'status', message: 'Status must be active or excluded' })
  }

  let yp_linkedin = ''
  try {
    yp_linkedin = normalizeLinkedinProfileUrl(String(input.yp_linkedin || ''))
  } catch (error) {
    issues.push({
      field: 'yp_linkedin',
      message: error instanceof Error ? error.message : 'LinkedIn URL is invalid',
    })
  }

  if (issues.length > 0) {
    return { issues }
  }

  return {
    member: {
      member_id,
      display_order: normalizeNumber(input.display_order, fallbackOrder),
      yp_name,
      yp_role,
      yp_linkedin,
      yp_weight: normalizeNumber(input.yp_weight, 1),
      yp_expertise_1: String(input.yp_expertise_1 || '').trim(),
      yp_expertise_2: String(input.yp_expertise_2 || '').trim(),
      yp_expertise_3: String(input.yp_expertise_3 || '').trim(),
      status,
    },
    issues,
  }
}

export function parseYpTeamRosterCsv(source: string): YpTeamRosterMember[] {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) return []

  const header = parseCsvLine(lines[0])
  const rows: YpTeamRosterMember[] = []
  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvLine(lines[index])
    const raw: Record<string, string> = {}
    for (let col = 0; col < header.length; col += 1) {
      raw[header[col]] = values[col] ?? ''
    }
    const { member, issues } = validateYpTeamMember(raw as Partial<YpTeamRosterMember>, {
      fallbackOrder: index * 10,
    })
    if (!member) {
      throw new Error(`Invalid yp_team.csv row ${index + 1}: ${issues.map((issue) => issue.message).join('; ')}`)
    }
    rows.push(member)
  }
  return sortYpTeamRoster(rows)
}

export function serializeYpTeamRosterCsv(rows: YpTeamRosterMember[]): string {
  const lines = [CSV_HEADERS.join(',')]
  for (const row of sortYpTeamRoster(rows)) {
    lines.push(CSV_HEADERS.map((field) => toCsvCell(row[field])).join(','))
  }
  return `${lines.join('\n')}\n`
}

export function sortYpTeamRoster(rows: YpTeamRosterMember[]): YpTeamRosterMember[] {
  return [...rows].sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order
    }
    return a.yp_name.localeCompare(b.yp_name)
  })
}

export async function readYpTeamRoster(csvPath = DEFAULT_YP_TEAM_ROSTER_PATH): Promise<YpTeamRosterMember[]> {
  const source = await readFile(csvPath, 'utf8')
  return parseYpTeamRosterCsv(source)
}

export async function writeYpTeamRoster(
  rows: YpTeamRosterMember[],
  csvPath = DEFAULT_YP_TEAM_ROSTER_PATH,
): Promise<void> {
  const normalizedRows = rows.map((row, index) => {
    const { member, issues } = validateYpTeamMember(row, { fallbackOrder: (index + 1) * 10 })
    if (!member) {
      throw new Error(`Invalid roster member: ${issues.map((issue) => issue.message).join('; ')}`)
    }
    return member
  })
  const uniqueIds = new Set<string>()
  for (const row of normalizedRows) {
    if (uniqueIds.has(row.member_id)) {
      throw new Error(`Duplicate member_id: ${row.member_id}`)
    }
    uniqueIds.add(row.member_id)
  }

  await mkdir(path.dirname(csvPath), { recursive: true })
  await writeFile(csvPath, serializeYpTeamRosterCsv(normalizedRows), 'utf8')
}

export function summarizeYpTeamRoster(rows: YpTeamRosterMember[]) {
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === 'active').length,
    excluded: rows.filter((row) => row.status === 'excluded').length,
  }
}
