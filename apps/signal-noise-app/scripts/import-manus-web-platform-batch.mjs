import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'

import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

import { buildMergedWideResearchImport, MERGED_WIDE_RFP_RUN_ID } from '../src/lib/rfp-wide-research-import.mjs'

const repoRoot = resolve(process.cwd(), '..')
const appRoot = resolve(process.cwd())
loadEnv({ path: join(appRoot, '.env') })
loadEnv({ path: join(appRoot, '.env.production'), override: false })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL')
}

if (!supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

const inputPath = process.argv[2]
  ? resolve(process.argv[2])
  : '/Users/kieranmcfarlane/Downloads/yellow_panther_web_platform_batch.json'

async function main() {
  const rawText = await readFile(inputPath, 'utf8')
  const rawBatch = JSON.parse(rawText)

  const { data: existingRows, error: existingError } = await supabase
    .from('wide_rfp_research_batches')
    .select('batch')
    .eq('run_id', MERGED_WIDE_RFP_RUN_ID)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to load existing merged Manus batch: ${existingError.message}`)
  }

  const existingMergedBatch = existingRows?.batch || null
  const mergedImport = buildMergedWideResearchImport({ rawBatch, existingMergedBatch })

  const batchPayload = {
    run_id: mergedImport.mergedBatch.run_id,
    source: mergedImport.mergedBatch.source,
    prompt: mergedImport.mergedBatch.prompt,
    focus_area: mergedImport.mergedBatch.focus_area || null,
    lane_label: mergedImport.mergedBatch.lane_label || null,
    seed_query: mergedImport.mergedBatch.seed_query || null,
    generated_at: mergedImport.mergedBatch.generated_at || new Date().toISOString(),
    has_signal: Boolean((mergedImport.mergedBatch.opportunities || []).length || (mergedImport.mergedBatch.entity_actions || []).length),
    batch: mergedImport.mergedBatch,
    artifact_path: inputPath,
    updated_at: new Date().toISOString(),
  }

  const { error: batchUpsertError } = await supabase
    .from('wide_rfp_research_batches')
    .upsert(batchPayload, { onConflict: 'run_id' })

  if (batchUpsertError) {
    throw new Error(`Failed to persist merged Manus batch: ${batchUpsertError.message}`)
  }

  const { error: deleteError } = await supabase
    .from('rfp_opportunities_unified')
    .delete()
    .eq('batch_id', MERGED_WIDE_RFP_RUN_ID)

  if (deleteError) {
    throw new Error(`Failed to clear previous unified rows for ${MERGED_WIDE_RFP_RUN_ID}: ${deleteError.message}`)
  }

  const rowsToInsert = mergedImport.unifiedRows.map((row) => ({
    ...row,
    source: 'manus',
    batch_id: MERGED_WIDE_RFP_RUN_ID,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  const { error: insertError } = await supabase
    .from('rfp_opportunities_unified')
    .insert(rowsToInsert)

  if (insertError) {
    throw new Error(`Failed to insert unified opportunities: ${insertError.message}`)
  }

  console.log(JSON.stringify({
    ok: true,
    inputPath,
    mergedRunId: MERGED_WIDE_RFP_RUN_ID,
    inserted: rowsToInsert.length,
    opportunityTitles: mergedImport.mergedBatch.opportunities.map((opportunity) => opportunity.title),
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2))
  process.exitCode = 1
})
