#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const BASELINE_PATH = path.resolve('config/entity-congruence-baseline.json')

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function checkById(result, id) {
  return (result.checks || []).find((check) => check.id === id) || null
}

function readMetricFromCheck(result, id, key, fallback = 0) {
  const check = checkById(result, id)
  const value = check?.details?.[key]
  return Number(value ?? fallback)
}

const run = spawnSync(
  'node',
  ['scripts/qa-entity-congruence-audit.mjs', '--json', '--no-fail'],
  { encoding: 'utf8' },
)

if (run.status !== 0) {
  console.error('Failed to run qa-entity-congruence-audit for baseline update.')
  console.error(run.stderr || run.stdout)
  process.exit(run.status || 1)
}

let report
try {
  report = JSON.parse(run.stdout)
} catch (error) {
  console.error('Failed to parse audit JSON output.')
  console.error(run.stdout)
  process.exit(1)
}

const existing = readJson(BASELINE_PATH)
const allowed = existing?.allowed_regression || {
  id_name_mismatches: 150,
  normalized_names_missing: 10,
  overlap_pct: 1.5,
  ipl_present: 0,
  epl_present: 1,
  bundesliga_present: 1,
}

const nextBaseline = {
  generated_at: report.generated_at || new Date().toISOString(),
  metrics: {
    id_name_mismatches: readMetricFromCheck(report, 'id_name_mismatch_threshold', 'id_name_mismatches'),
    normalized_names_missing: readMetricFromCheck(report, 'normalized_names_missing_rate', 'missing_normalized_names'),
    overlap_pct: readMetricFromCheck(report, 'embedding_id_overlap', 'pct'),
    ipl_present: readMetricFromCheck(report, 'ipl_seed_presence', 'present'),
    epl_present: readMetricFromCheck(report, 'epl_seed_presence', 'present'),
    bundesliga_present: readMetricFromCheck(report, 'bundesliga_seed_presence', 'present'),
  },
  allowed_regression: allowed,
}

fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true })
fs.writeFileSync(BASELINE_PATH, JSON.stringify(nextBaseline, null, 2) + '\n', 'utf8')

console.log(`Updated baseline: ${BASELINE_PATH}`)
console.log(JSON.stringify(nextBaseline, null, 2))
