import { getSupabaseAdmin, query } from '@/lib/supabase-client'
import {
  buildWideRfpDeltaMemoryPack,
  joinWideRfpResearchBatches,
  readLatestWideRfpResearchArtifact,
  writeWideRfpResearchArtifact,
} from '@/lib/rfp-wide-research.mjs'
import {
  LEGACY_MERGED_WIDE_RFP_RUN_ID,
  resolveLatestWideRfpResearchRecord,
  sortWideRfpResearchRecordsForDisplay,
} from '@/lib/rfp-wide-research-store-selection.mjs'

type WideRfpResearchBatch = {
  run_id?: string
  source?: string
  prompt?: string
  generated_at?: string
  focus_area?: string | null
  lane_label?: string | null
  seed_query?: string | null
  opportunities?: any[]
  entity_actions?: any[]
  summary?: {
    total_opportunities?: number
    linked_entities?: number
    entities_to_create?: number
  }
}

type PersistWideRfpResearchBatchInput = {
  batch: WideRfpResearchBatch
  outputDir?: string
}

type LoadWideRfpDeltaMemoryPackInput = {
  maxKnownUrls?: number | null
  hardExcludedCanonicalEntityIds?: string[] | null
}

type WideRfpResearchRecord = {
  id: string
  run_id: string
  source: string
  prompt: string
  focus_area: string | null
  lane_label: string | null
  seed_query: string | null
  generated_at: string | null
  has_signal: boolean
  batch: WideRfpResearchBatch | null
  artifact_path: string | null
}

type LoadWideRfpResearchOpportunitiesInput = {
  page?: number | null
  pageSize?: number | null
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function hasWideResearchSignal(batch: WideRfpResearchBatch | null | undefined) {
  return Boolean((batch?.opportunities && batch.opportunities.length) || (batch?.entity_actions && batch.entity_actions.length))
}

export async function persistWideRfpResearchBatch(input: PersistWideRfpResearchBatchInput) {
  const batch = input.batch
  const artifact = await writeWideRfpResearchArtifact({
    batch,
    outputDir: input.outputDir,
  })

  const supabase = getSupabaseAdmin()
  const payload = {
    run_id: toText(batch.run_id) || artifact.batch.run_id,
    source: toText(batch.source) || 'manus',
    prompt: toText(batch.prompt),
    focus_area: toText(batch.focus_area) || null,
    lane_label: toText(batch.lane_label) || null,
    seed_query: toText(batch.seed_query) || null,
    generated_at: toText(batch.generated_at) || new Date().toISOString(),
    has_signal: hasWideResearchSignal(batch),
    batch: artifact.batch,
    artifact_path: artifact.filePath,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('wide_rfp_research_batches')
    .upsert(payload, { onConflict: 'run_id' })

  if (error) {
    throw new Error(`Failed to persist wide research batch: ${error.message}`)
  }

  return {
    artifact: artifact.filePath,
    batch: artifact.batch,
  }
}

export async function loadLatestWideRfpResearchBatch(input: { outputDir?: string } = {}) {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('wide_rfp_research_batches')
      .select('*')
      .order('has_signal', { ascending: false })
      .order('generated_at', { ascending: false })
      .limit(20)

    if (error) {
      throw error
    }

    const rows = (data || []) as WideRfpResearchRecord[]
    const legacyMergedRecord = rows.find((row) => row.run_id === LEGACY_MERGED_WIDE_RFP_RUN_ID && row.batch)
    const latestArtifact = await readLatestWideRfpResearchArtifact({ outputDir: input.outputDir })
    const artifactRecord = latestArtifact?.batch
      ? ({
          id: latestArtifact.filePath,
          run_id: latestArtifact.batch.run_id || latestArtifact.filePath,
          source: latestArtifact.batch.source || 'filesystem',
          prompt: latestArtifact.batch.prompt || '',
          focus_area: latestArtifact.batch.focus_area || null,
          lane_label: latestArtifact.batch.lane_label || null,
          seed_query: latestArtifact.batch.seed_query || null,
          generated_at: latestArtifact.batch.generated_at || null,
          has_signal: hasWideResearchSignal(latestArtifact.batch),
          batch: latestArtifact.batch,
          artifact_path: latestArtifact.filePath,
        } satisfies WideRfpResearchRecord)
      : null

    const manusSourceRows = rows.filter((row) =>
      row.batch &&
      row.run_id.startsWith('yp_rfps_') &&
      row.source === 'manus'
    )

    let mergedRecord: WideRfpResearchRecord | null = null
    if (manusSourceRows.length > 1) {
      const mergedBatch = joinWideRfpResearchBatches(manusSourceRows.map((row) => row.batch))
      mergedRecord = {
        id: LEGACY_MERGED_WIDE_RFP_RUN_ID,
        run_id: mergedBatch.run_id,
        source: mergedBatch.source,
        prompt: mergedBatch.prompt,
        focus_area: mergedBatch.focus_area || null,
        lane_label: mergedBatch.lane_label || null,
        seed_query: mergedBatch.seed_query || null,
        generated_at: mergedBatch.generated_at || new Date().toISOString(),
        has_signal: Boolean((mergedBatch.opportunities && mergedBatch.opportunities.length) || (mergedBatch.entity_actions && mergedBatch.entity_actions.length)),
        batch: mergedBatch,
        artifact_path: null,
      }
    }

    const candidates = sortWideRfpResearchRecordsForDisplay([
      ...rows,
      ...(mergedRecord ? [mergedRecord] : []),
      ...(artifactRecord ? [artifactRecord] : []),
    ])
    const record = resolveLatestWideRfpResearchRecord(candidates)

    if (record === mergedRecord && mergedRecord?.batch) {
      const { error: upsertError } = await supabase
        .from('wide_rfp_research_batches')
        .upsert({
          run_id: mergedRecord.run_id,
          source: mergedRecord.source,
          prompt: mergedRecord.prompt,
          focus_area: mergedRecord.focus_area || null,
          lane_label: mergedRecord.lane_label || null,
          seed_query: mergedRecord.seed_query || null,
          generated_at: mergedRecord.generated_at || new Date().toISOString(),
          has_signal: mergedRecord.has_signal,
          batch: mergedRecord.batch,
          artifact_path: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'run_id' })

      if (upsertError) {
        throw new Error(`Failed to persist merged wide research batch: ${upsertError.message}`)
      }

      return {
        artifact: null,
        batch: mergedRecord.batch,
        source: 'database' as const,
      }
    }

    if (record?.batch) {
      return {
        artifact: record.artifact_path || null,
        batch: record.batch,
        source: record === artifactRecord ? 'filesystem' as const : 'database' as const,
      }
    }
    if (legacyMergedRecord?.batch) {
      return {
        artifact: legacyMergedRecord.artifact_path || null,
        batch: legacyMergedRecord.batch,
        source: 'database' as const,
      }
    }
  } catch {
    // fall through to the filesystem cache
  }

  const artifact = await readLatestWideRfpResearchArtifact({ outputDir: input.outputDir })
  if (!artifact) return null

  return {
    artifact: artifact.filePath,
    batch: artifact.batch,
    source: 'filesystem' as const,
  }
}

export async function loadWideRfpDeltaMemoryPack(input: LoadWideRfpDeltaMemoryPackInput = {}) {
  const maxKnownUrls = normalizeLimit(input.maxKnownUrls, 75)
  const hardExcludedCanonicalEntityIds = Array.isArray(input.hardExcludedCanonicalEntityIds)
    ? input.hardExcludedCanonicalEntityIds
    : []
  const opportunities: any[] = []

  try {
    const supabase = getSupabaseAdmin()
    const { data: batchRows } = await supabase
      .from('wide_rfp_research_batches')
      .select('batch')
      .order('has_signal', { ascending: false })
      .order('generated_at', { ascending: false })
      .limit(25)

    for (const row of batchRows || []) {
      for (const opportunity of row?.batch?.opportunities || []) {
        opportunities.push({
          ...opportunity,
          target_year: opportunity?.target_year || row?.batch?.target_year,
        })
      }
    }

    const { data: unifiedRows } = await supabase
      .from('rfp_opportunities_unified')
      .select('title, source_url, entity_id, entity_name, organization, deadline, metadata')
      .order('updated_at', { ascending: false })
      .limit(500)

    for (const row of unifiedRows || []) {
      opportunities.push({
        title: row?.title,
        source_url: row?.source_url,
        canonical_entity_id: row?.entity_id,
        canonical_entity_name: row?.entity_name || row?.organization,
        organization: row?.organization,
        target_year: row?.metadata?.target_year || row?.deadline,
      })
    }
  } catch {
    const latest = await loadLatestWideRfpResearchBatch({})
    for (const opportunity of latest?.batch?.opportunities || []) {
      opportunities.push({
        ...opportunity,
        target_year: opportunity?.target_year || latest?.batch?.target_year,
      })
    }
  }

  const memory = buildWideRfpDeltaMemoryPack({
    opportunities,
    hardExcludedCanonicalEntityIds,
  })

  return {
    ...memory,
    known_source_urls: memory.known_source_urls.slice(0, maxKnownUrls),
  }
}

export async function loadWideRfpResearchOpportunities(input: LoadWideRfpResearchOpportunitiesInput = {}) {
  const pageSize = normalizeLimit(input.pageSize, 24)
  const page = Math.max(1, Number.parseInt(String(input.page || 1), 10) || 1)
  const offset = (page - 1) * pageSize

  try {
    const result = await query(`
      with expanded as (
        select
          row.run_id,
          row.generated_at,
          row.batch,
          opportunity.value as opportunity,
          coalesce(
            nullif(lower(trim(opportunity.value->>'source_url')), ''),
            nullif(lower(trim(opportunity.value->>'title')), ''),
            md5(opportunity.value::text)
          ) as dedupe_key
        from wide_rfp_research_batches row
        cross join lateral jsonb_array_elements(row.batch->'opportunities') opportunity(value)
        where row.has_signal = true
          and row.batch ? 'opportunities'
      ),
      ranked as (
        select
          *,
          row_number() over (
            partition by dedupe_key
            order by generated_at desc nulls last, run_id desc
          ) as duplicate_rank
        from expanded
      ),
      deduped as (
        select * from ranked where duplicate_rank = 1
      ),
      counted as (
        select count(*)::int as total from deduped
      )
      select
        deduped.run_id,
        deduped.generated_at,
        deduped.opportunity,
        counted.total
      from deduped
      cross join counted
      order by deduped.generated_at desc nulls last, deduped.opportunity->>'title' asc
      limit $1 offset $2
    `, [pageSize, offset])

    const rows = result.rows || []
    const total = Number(rows[0]?.total || 0)
    const opportunities = rows.map((row: any) => ({
      ...(row.opportunity || {}),
      source_run_id: row.run_id,
      source_batch_generated_at: row.generated_at,
    }))
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return {
      opportunities,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  } catch {
    const latest = await loadLatestWideRfpResearchBatch({})
    const opportunities = latest?.batch?.opportunities || []
    const total = opportunities.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    return {
      opportunities: opportunities.slice(offset, offset + pageSize),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  }
}

function normalizeLimit(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, 250)
}
