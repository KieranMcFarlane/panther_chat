import { getSupabaseAdmin } from '@/lib/supabase-client'
import {
  joinWideRfpResearchBatches,
  readLatestWideRfpResearchArtifact,
  writeWideRfpResearchArtifact,
} from '@/lib/rfp-wide-research.mjs'

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

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function hasWideResearchSignal(batch: WideRfpResearchBatch | null | undefined) {
  return Boolean((batch?.opportunities && batch.opportunities.length) || (batch?.entity_actions && batch.entity_actions.length))
}

function resolveLatestRecord(rows: WideRfpResearchRecord[]) {
  return rows.find((row) => row.has_signal && row.batch) || rows[0] || null
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
    const mergedRecord = rows.find((row) => row.run_id === 'manus-rfp-wide-research-merged' && row.batch)
    if (mergedRecord?.batch) {
      return {
        artifact: mergedRecord.artifact_path || null,
        batch: mergedRecord.batch,
        source: 'database' as const,
      }
    }

    const manusSourceRows = rows.filter((row) =>
      row.batch &&
      row.run_id.startsWith('yp_rfps_') &&
      row.source === 'manus'
    )

    if (manusSourceRows.length > 1) {
      const mergedBatch = joinWideRfpResearchBatches(manusSourceRows.map((row) => row.batch))
      const payload = {
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
        updated_at: new Date().toISOString(),
      }

      const { error: upsertError } = await supabase
        .from('wide_rfp_research_batches')
        .upsert(payload, { onConflict: 'run_id' })

      if (upsertError) {
        throw new Error(`Failed to persist merged wide research batch: ${upsertError.message}`)
      }

      return {
        artifact: null,
        batch: mergedBatch,
        source: 'database' as const,
      }
    }

    const record = resolveLatestRecord(rows)
    if (record?.batch) {
      return {
        artifact: record.artifact_path || null,
        batch: record.batch,
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
