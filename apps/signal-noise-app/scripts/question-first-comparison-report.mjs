import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildQuestionFirstComparisonReport } from '../src/lib/question-first-comparison.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const CURRENT_BATCH_IDS = [
  'f6484cb8-8dbd-4b9a-939b-f1dff155bb64',
  'e5a82838-a3e4-4c72-89e0-3592abcee2b9',
]

function loadJson(relativePath) {
  const filePath = path.join(ROOT, relativePath)
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

async function loadCurrentBatchRows() {
  const rows = []

  for (const entityId of CURRENT_BATCH_IDS) {
    const response = await fetch(`http://localhost:3005/api/entities/${entityId}/dossier?from=1`)
    if (!response.ok) {
      throw new Error(`Failed to load current batch dossier for ${entityId}: ${response.status} ${response.statusText}`)
    }
    const payload = await response.json()
    rows.push({
      label: `${payload?.dossier?.entity_name || entityId} current batch`,
      lane: 'current-batch',
      payload: payload?.dossier || payload,
      entityId,
      sourceType: 'question_first_dossier',
    })
  }

  return rows
}

async function main() {
  const currentBatch = await loadCurrentBatchRows()
  const report = buildQuestionFirstComparisonReport([
    ...currentBatch,
    {
      label: 'Arsenal April 20 full run',
      lane: 'full-run',
      payload: loadJson('backend/data/question_first_live_runs/arsenal_fc_20260420_054715/arsenal-fc_opencode_batch_20260420_044721_question_first_run_v1.json'),
      entityId: 'arsenal-fc',
      sourceType: 'question_first_run',
    },
    {
      label: 'Arsenal April 23 smoke run',
      lane: 'smoke',
      payload: loadJson('backend/data/question_first_dossiers/arsenal-fc-worker-smoke_question_first_dossier.json'),
      entityId: 'arsenal-fc-worker-smoke',
      sourceType: 'question_first_dossier',
    },
    {
      label: 'Arsenal legacy demo dossier',
      lane: 'legacy',
      payload: loadJson('backend/data/dossiers/demo/arsenal-football-club_seed_question_first_dossier.json'),
      entityId: 'arsenal-football-club',
      sourceType: 'question_first_dossier',
    },
  ])

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
