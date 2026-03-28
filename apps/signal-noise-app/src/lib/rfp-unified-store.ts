import { getSupabaseAdmin } from '@/lib/supabase-client'

export type UnifiedRfpOpportunity = {
  id: string
  title: string
  organization: string
  description: string | null
  yellow_panther_fit: number | null
  category: string | null
  deadline: string | null
  source_url: string | null
  entity_id: string | null
  entity_name: string | null
  canonical_entity_id: string | null
  canonical_entity_name: string | null
  location: string | null
  status: string | null
  source: string | null
  priority: string | null
  detected_at: string | null
  published: string | null
  batch_id: string | null
  created_at: string | null
}

type UnifiedRfpRecord = {
  id?: string | null
  title?: string | null
  organization?: string | null
  description?: string | null
  yellow_panther_fit?: number | string | null
  category?: string | null
  deadline?: string | null
  source_url?: string | null
  entity_id?: string | null
  entity_name?: string | null
  location?: string | null
  status?: string | null
  source?: string | null
  priority?: string | null
  detected_at?: string | null
  published?: string | null
  batch_id?: string | null
  created_at?: string | null
}

export type UnifiedRfpLoadResult = {
  opportunities: UnifiedRfpOpportunity[]
  total: number
  latestDetectedAt: string | null
}

const unifiedSelection = [
  'id',
  'title',
  'organization',
  'description',
  'yellow_panther_fit',
  'category',
  'deadline',
  'source_url',
  'entity_id',
  'entity_name',
  'location',
  'status',
  'source',
  'priority',
  'detected_at',
  'published',
  'batch_id',
  'created_at',
].join(', ')

function normalizeUnifiedRfpOpportunity(record: UnifiedRfpRecord): UnifiedRfpOpportunity {
  const detectedAt = record.detected_at || record.published || record.created_at || null
  const organization = String(record.organization || record.entity_name || 'Unknown organization').trim()
  const title = String(record.title || organization || 'Untitled RFP').trim()

  return {
    id: String(record.id || title),
    title,
    organization,
    description: record.description || null,
    yellow_panther_fit:
      typeof record.yellow_panther_fit === 'number'
        ? record.yellow_panther_fit
        : typeof record.yellow_panther_fit === 'string' && record.yellow_panther_fit.trim()
          ? Number(record.yellow_panther_fit)
          : null,
    category: record.category || null,
    deadline: record.deadline || null,
    source_url: record.source_url || null,
    entity_id: record.entity_id || null,
    entity_name: record.entity_name || null,
    canonical_entity_id: record.entity_id || null,
    canonical_entity_name: record.entity_name || record.organization || null,
    location: record.location || null,
    status: record.status || null,
    source: record.source || null,
    priority: record.priority || null,
    detected_at: detectedAt,
    published: record.published || detectedAt,
    batch_id: record.batch_id || null,
    created_at: record.created_at || null,
  }
}

export async function loadUnifiedRfpOpportunities(): Promise<UnifiedRfpLoadResult> {
  const supabase = getSupabaseAdmin()
  const { data, error, count } = await supabase
    .from('rfp_opportunities_unified')
    .select(unifiedSelection, { count: 'exact' })
    .order('detected_at', { ascending: false })
    .order('created_at', { ascending: false })
    .order('title', { ascending: true })

  if (error) {
    throw new Error(`Failed to load unified RFP opportunities: ${error.message}`)
  }

  const opportunities = (data ?? []).map((record) => normalizeUnifiedRfpOpportunity(record as UnifiedRfpRecord))
  const latestDetectedAt = opportunities[0]?.detected_at || null

  return {
    opportunities,
    total: count ?? opportunities.length,
    latestDetectedAt,
  }
}
