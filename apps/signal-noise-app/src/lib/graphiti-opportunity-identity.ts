import { createHash } from 'node:crypto'

type OpportunityIdentityInput = {
  canonical_entity_id: string | null
  canonical_entity_name: string | null
  entity_id: string | null
  entity_name: string | null
  title: string
  opportunity_kind: string
}

type OpportunityStateInput = {
  title: string
  organization: string
  description: string
  why_this_is_an_opportunity?: string
  yellow_panther_fit_feedback?: string
  next_steps?: string[]
  supporting_signals?: string[]
  read_more_context?: string
  confidence: number | null
  confidence_score: number | null
  yellow_panther_fit: number | null
  priority_score: number | null
  category: string
  status: string | null
  canonical_entity_id: string | null
  canonical_entity_name: string | null
  source_url: string | null
  tags: string[]
  taxonomy: Record<string, unknown>
  metadata: Record<string, unknown>
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function slugify(value: unknown): string {
  return toText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildGraphitiOpportunityId(record: OpportunityIdentityInput): string {
  const identity = [
    record.canonical_entity_id || record.entity_id || '',
    record.canonical_entity_name || record.entity_name || '',
    record.title,
    record.opportunity_kind,
  ]
    .map(slugify)
    .filter(Boolean)
    .join('|')

  return createHash('sha1').update(identity || record.title || 'graphiti-opportunity').digest('hex')
}

export function buildGraphitiOpportunityStateHash(record: OpportunityStateInput): string {
  return createHash('sha256')
    .update(JSON.stringify(record))
    .digest('hex')
}
