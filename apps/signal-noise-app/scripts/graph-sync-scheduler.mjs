#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cron from 'node-cron'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
dotenv.config({ path: path.join(appRoot, '.env') })

const baseUrl = process.env.GRAPH_SYNC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3005'
const schedule = process.env.GRAPH_SYNC_SCHEDULE || '0 */6 * * *' // every 6 hours
const endpoint = `${baseUrl.replace(/\/$/, '')}/api/sync/graph-to-supabase`
const reconciliationEndpoint = `${baseUrl.replace(/\/$/, '')}/api/admin/entity-reconciliation`
let running = false

async function runSync(trigger = 'scheduled') {
  if (running) {
    console.log(`[graph-sync-scheduler] Skip ${trigger}; prior run still active`)
    return
  }

  running = true
  const started = new Date()
  console.log(`[graph-sync-scheduler] ${started.toISOString()} starting ${trigger} run -> ${endpoint}`)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ trigger }),
      signal: AbortSignal.timeout(10 * 60 * 1000),
    })

    const text = await response.text()
    if (!response.ok) {
      console.error(`[graph-sync-scheduler] ${response.status} ${response.statusText}: ${text.slice(0, 2000)}`)
      return
    }

    let payload = null
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { raw: text.slice(0, 2000) }
    }

    const finished = new Date()
    console.log('[graph-sync-scheduler] completed run', {
      trigger,
      started_at: started.toISOString(),
      finished_at: finished.toISOString(),
      duration_seconds: Math.round((finished.getTime() - started.getTime()) / 1000),
      response: payload,
    })

    await runReconciliationCheck()
  } catch (error) {
    console.error('[graph-sync-scheduler] run failed', {
      trigger,
      message: error instanceof Error ? error.message : String(error),
    })
  } finally {
    running = false
  }
}

async function runReconciliationCheck() {
  const maxEmbeddingsNotInCached = Number(process.env.RECON_MAX_EMBEDDINGS_NOT_IN_CACHED || '0')
  const maxActionableMismatches = Number(process.env.RECON_MAX_ACTIONABLE_MISMATCHES || '0')

  try {
    const response = await fetch(reconciliationEndpoint, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(60 * 1000),
    })
    const payload = await response.json()
    const embeddingsNotInCached = Number(payload?.congruence?.embeddings_not_in_cached ?? NaN)
    const actionableMismatches = Number(payload?.congruence?.actionable_id_name_mismatches ?? NaN)

    const breaches = []
    if (!Number.isNaN(embeddingsNotInCached) && embeddingsNotInCached > maxEmbeddingsNotInCached) {
      breaches.push(`embeddings_not_in_cached=${embeddingsNotInCached} > ${maxEmbeddingsNotInCached}`)
    }
    if (!Number.isNaN(actionableMismatches) && actionableMismatches > maxActionableMismatches) {
      breaches.push(`actionable_id_name_mismatches=${actionableMismatches} > ${maxActionableMismatches}`)
    }

    if (breaches.length > 0) {
      console.error('[graph-sync-scheduler] reconciliation breach', {
        thresholds: { maxEmbeddingsNotInCached, maxActionableMismatches },
        metrics: { embeddingsNotInCached, actionableMismatches },
        breaches,
      })
      return
    }

    console.log('[graph-sync-scheduler] reconciliation check ok', {
      embeddingsNotInCached,
      actionableMismatches,
      thresholds: { maxEmbeddingsNotInCached, maxActionableMismatches },
    })
  } catch (error) {
    console.error('[graph-sync-scheduler] reconciliation check failed', {
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

if (!cron.validate(schedule)) {
  console.error(`[graph-sync-scheduler] Invalid GRAPH_SYNC_SCHEDULE: ${schedule}`)
  process.exit(1)
}

console.log(`[graph-sync-scheduler] scheduler started with cron "${schedule}" targeting ${endpoint}`)
cron.schedule(schedule, () => {
  void runSync('scheduled')
})

if (process.env.GRAPH_SYNC_RUN_ON_START !== 'false') {
  void runSync('startup')
}
