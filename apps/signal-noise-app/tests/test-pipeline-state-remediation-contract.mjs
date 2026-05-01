import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const remediationScriptPath = new URL('../scripts/remediate-pipeline-state-local.mjs', import.meta.url)
const packageSource = readFileSync(new URL('../package.json', import.meta.url), 'utf8')

test('local pipeline remediation script quarantines stale runs without deleting state', () => {
  assert.equal(existsSync(remediationScriptPath), true)
  const source = readFileSync(remediationScriptPath, 'utf8')

  assert.match(source, /export function parseArgs/)
  assert.match(source, /export function buildStaleRunCandidatesQuery/)
  assert.match(source, /export function buildQuarantineStaleRunsQuery/)
  assert.match(source, /status in \('running', 'retrying'\)/)
  assert.match(source, /stale_pipeline_run_quarantined/)
  assert.match(source, /continue_pipeline_on_failure/)
  assert.match(source, /no_live_worker_process/)
  assert.match(source, /completed_at = now\(\)/)
  assert.doesNotMatch(source, /\bdelete\s+from\s+entity_pipeline_runs\b/i)
})

test('local pipeline remediation script normalizes only dossier metadata quality state', () => {
  assert.equal(existsSync(remediationScriptPath), true)
  const source = readFileSync(remediationScriptPath, 'utf8')

  assert.match(source, /export function buildDossierQualityCandidatesQuery/)
  assert.match(source, /export function buildNormalizeDossierQualityQuery/)
  assert.match(source, /graphiti_dossier_ingestions/)
  assert.match(source, /left join graphiti_dossier_ingestions/)
  assert.match(source, /inferred_quality_state/)
  assert.match(source, /jsonb_set\(.*\{quality_state\}/s)
  assert.match(source, /where .*dossier_data->>'quality_state'/is)
  assert.match(source, /partial/)
  assert.match(source, /complete/)
  assert.match(source, /client_ready/)
  assert.match(source, /blocked/)
  assert.match(source, /failed/)
  assert.match(source, /empty/)
})

test('local pipeline remediation script resets stale control state only when no live process is found', () => {
  assert.equal(existsSync(remediationScriptPath), true)
  const source = readFileSync(remediationScriptPath, 'utf8')

  assert.match(source, /export function buildResetStaleControlStateQuery/)
  assert.match(source, /pipeline_control_state/)
  assert.match(source, /stale_control_state/)
  assert.match(source, /ready_to_start/)
  assert.match(source, /worker_process_alive/)
  assert.match(source, /execFileAsync\('ps'/)
  assert.match(source, /ports_occupied/)
  assert.match(source, /3005/)
  assert.match(source, /8000/)
  assert.match(source, /8014/)
})

test('package exposes dry-run and apply commands for local state remediation', () => {
  assert.match(packageSource, /remediate:pipeline-state:local/)
  assert.match(packageSource, /remediate:pipeline-state:local:apply/)
  assert.match(packageSource, /remediate-pipeline-state-local\.mjs/)
  assert.match(packageSource, /--apply/)
})
