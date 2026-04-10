import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase-client'
import type { EntityPipelineRunRecord } from '@/lib/entity-import-jobs'
import { normalizeOpportunityTaxonomy } from '@/lib/opportunity-taxonomy.mjs'

type PipelineSignal = {
  id?: string | null
  type?: string | null
  subtype?: string | null
  statement?: string | null
  text?: string | null
  url?: string | null
  confidence?: number | null
  metadata?: Record<string, unknown> | null
}

type PipelineResult = {
  entity_id: string
  entity_name: string
  sales_readiness?: string | null
  artifacts?: {
    validated_signals?: PipelineSignal[]
    scores?: Record<string, unknown>
  }
}

function normalizeConfidence(confidence: number | null | undefined): number {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    return 0.75
  }

  if (confidence > 1) {
    return Math.min(1, confidence / 100)
  }

  return Math.max(0, Math.min(1, confidence))
}

function calculatePriority(confidenceScore: number, salesReadiness?: string | null) {
  let priority = 'medium'
  let priorityScore = Math.max(5, Math.round(confidenceScore * 10))

  if (salesReadiness === 'LIVE' || confidenceScore >= 0.9) {
    priority = 'critical'
    priorityScore = Math.max(priorityScore, 10)
  } else if (salesReadiness === 'HIGH_PRIORITY' || confidenceScore >= 0.8) {
    priority = 'high'
    priorityScore = Math.max(priorityScore, 8)
  } else if (salesReadiness === 'ENGAGE' || confidenceScore >= 0.65) {
    priority = 'medium'
    priorityScore = Math.max(priorityScore, 6)
  } else {
    priority = 'low'
    priorityScore = Math.max(priorityScore, 3)
  }

  return { priority, priorityScore }
}

function buildImportedRfpId(entityId: string, statement: string, url?: string | null): string {
  const hash = createHash('sha1').update(`${entityId}|${url || ''}|${statement}`).digest('hex').slice(0, 16)
  return `csv-import-${entityId}-${hash}`
}

function isRfpSignal(signal: PipelineSignal): boolean {
  const type = String(signal.type || signal.subtype || '').toUpperCase()
  const text = String(signal.statement || signal.text || '').toUpperCase()
  return type.includes('RFP') || type.includes('PROCUREMENT') || text.includes('RFP')
}

export async function promoteImportedEntityRfps(
  batchId: string,
  run: EntityPipelineRunRecord,
  result: PipelineResult,
) {
  const validatedSignals = result.artifacts?.validated_signals ?? []
  const rfpSignals = validatedSignals.filter(isRfpSignal)

  if (rfpSignals.length === 0) {
    return []
  }

  const supabaseAdmin = getSupabaseAdmin()
  const now = new Date().toISOString()
  const entityType = String(run.metadata.entity_type || 'organization')
  const sport = run.metadata.sport ? String(run.metadata.sport) : null
  const country = run.metadata.country ? String(run.metadata.country) : null

  const rows = rfpSignals.map((signal) => {
    const statement = String(signal.statement || signal.text || 'Validated RFP signal')
    const confidenceScore = normalizeConfidence(signal.confidence)
    const { priority, priorityScore } = calculatePriority(confidenceScore, result.sales_readiness)
    const metadata = signal.metadata || {}
    const deadline = typeof metadata.deadline === 'string' ? metadata.deadline : null
    const sourceUrl = signal.url || (typeof metadata.url === 'string' ? metadata.url : null)
    const taxonomy = normalizeOpportunityTaxonomy({
      title: statement,
      organization: run.entity_name,
      description: statement,
      category: 'Procurement',
      type: signal.type || signal.subtype || 'RFP',
      sport,
      entity_type: entityType,
      metadata,
    })

    return {
      id: buildImportedRfpId(run.entity_id, statement, sourceUrl),
      title: statement.slice(0, 240),
      organization: run.entity_name,
      description: statement,
      location: country,
      value: typeof metadata.budget === 'string' ? metadata.budget : null,
      deadline,
      published: null,
      detected_at: now,
      created_at: now,
      updated_at: now,
      source: 'CSV Import Pipeline',
      source_url: sourceUrl,
      category: 'Procurement',
      status: 'new',
      priority,
      priority_score: priorityScore,
      confidence_score: confidenceScore,
      confidence: confidenceScore,
      yellow_panther_fit: Math.max(priorityScore * 10, Math.round(confidenceScore * 100)),
      taxonomy,
      entity_id: run.entity_id,
      entity_name: run.entity_name,
      entity_type: entityType,
      requirements: null,
      metadata: {
        pipeline_source: 'csv_import',
        batch_id: batchId,
        sales_readiness: result.sales_readiness ?? null,
        signal_type: signal.type ?? null,
        signal_subtype: signal.subtype ?? null,
        original_signal_id: signal.id ?? null,
        sport,
        country,
        taxonomy,
        dashboard_scores: result.artifacts?.scores ?? null,
      },
      link_status: sourceUrl ? 'unverified' : 'missing',
      link_verified_at: null,
      link_error: null,
      link_redirect_url: null,
    }
  })

  const { data, error } = await supabaseAdmin
    .from('rfp_opportunities')
    .upsert(rows, { onConflict: 'id' })
    .select('id')

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}
