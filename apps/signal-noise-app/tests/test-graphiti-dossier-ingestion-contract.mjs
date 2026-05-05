import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const migrationPath = new URL('../migrations/20260430_graphiti_dossier_ingestions.sql', import.meta.url)
const ingestionModulePath = new URL('../src/lib/graphiti-dossier-ingestion.ts', import.meta.url)
const backfillScriptPath = new URL('../scripts/backfill-graphiti-dossier-ingestions.mjs', import.meta.url)
const persistenceSource = readFileSync(new URL('../src/lib/graphiti-opportunity-persistence.ts', import.meta.url), 'utf8')
const adminBackfillSource = readFileSync(new URL('../src/app/api/admin/graphiti/opportunities/backfill/route.ts', import.meta.url), 'utf8')
const adminStatusSource = readFileSync(new URL('../src/app/api/admin/graphiti/opportunities/status/route.ts', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('../src/lib/home-queue-dashboard.ts', import.meta.url), 'utf8')

test('graphiti dossier ingestion has a durable local postgres ledger schema', () => {
  assert.equal(existsSync(migrationPath), true)
  const migrationSource = readFileSync(migrationPath, 'utf8')

  assert.match(migrationSource, /create table if not exists public\.graphiti_dossier_ingestions/i)
  assert.match(migrationSource, /canonical_entity_id text not null/i)
  assert.match(migrationSource, /dossier_id uuid/i)
  assert.match(migrationSource, /content_hash text not null/i)
  assert.match(migrationSource, /status text not null/i)
  assert.match(migrationSource, /quality_state text not null/i)
  assert.match(migrationSource, /answer_count integer not null/i)
  assert.match(migrationSource, /episode_body jsonb not null/i)
  assert.match(migrationSource, /source_generated_at timestamptz/i)
  assert.match(migrationSource, /unique \(canonical_entity_id, content_hash\)/i)
  assert.match(migrationSource, /graphiti_dossier_ingestions_canonical_entity_idx/i)
  assert.match(migrationSource, /graphiti_dossier_ingestions_status_idx/i)
  assert.match(migrationSource, /graphiti_dossier_ingestions_quality_idx/i)
  assert.match(migrationSource, /graphiti_dossier_ingestions_generated_idx/i)
  assert.match(migrationSource, /graphiti_dossier_ingestions_hash_idx/i)
})

test('dossier ingestion module separates all-dossier ingestion from opportunity shortlisting', () => {
  assert.equal(existsSync(ingestionModulePath), true)
  const ingestionSource = readFileSync(ingestionModulePath, 'utf8')

  assert.match(ingestionSource, /export async function loadLatestCanonicalDossiers/)
  assert.match(ingestionSource, /export function normalizeDossierIngestionState/)
  assert.match(ingestionSource, /export function buildGraphitiDossierEpisode/)
  assert.match(ingestionSource, /export async function upsertDossierIngestionLedger/)
  assert.match(ingestionSource, /export async function materializeOpportunityFromIngestedDossier/)
  assert.match(ingestionSource, /graphiti_dossier_ingestions/)
  assert.match(ingestionSource, /skipped_empty/)
  assert.match(ingestionSource, /source_description/)
  assert.match(ingestionSource, /reference_time/)
  assert.match(ingestionSource, /question_facts/)
  assert.match(ingestionSource, /evidence_urls/)
  assert.match(ingestionSource, /yellow_panther/)
  assert.ok(ingestionSource.includes("typeof value === 'string' && /^https?:\\/\\//i.test(value.trim())"))
})

test('dossier ingestion classifies OpenCode provider failures as failed infrastructure, not partial content', () => {
  const ingestionSource = readFileSync(ingestionModulePath, 'utf8')

  assert.match(ingestionSource, /function isProviderInfrastructureFailure/)
  assert.match(ingestionSource, /OpenCodeProviderInsufficientBalanceError/)
  assert.match(ingestionSource, /provider_infrastructure_failure/)
  assert.match(ingestionSource, /status: providerInfrastructureFailure \? 'failed'/)
  assert.match(ingestionSource, /quality_state: providerInfrastructureFailure \? 'failed'/)
  assert.match(ingestionSource, /last_error: episode\.failure_reason/)
})

test('dossier ingestion uses useful evidenced facts instead of raw answer volume for quality', () => {
  const ingestionSource = readFileSync(ingestionModulePath, 'utf8')

  assert.match(ingestionSource, /raw_answer_count/)
  assert.match(ingestionSource, /useful_fact_count/)
  assert.match(ingestionSource, /failed_fact_count/)
  assert.match(ingestionSource, /placeholder_fact_count/)
  assert.match(ingestionSource, /no_signal_fact_count/)
  assert.match(ingestionSource, /evidence_url_count/)
  assert.match(ingestionSource, /MIN_COMPLETE_USEFUL_FACTS\s*=\s*5/)
  assert.match(ingestionSource, /MIN_COMPLETE_EVIDENCE_URLS\s*=\s*3/)
  assert.match(ingestionSource, /answer_count:\s*qualityMetrics\.useful_fact_count/)
  assert.match(ingestionSource, /evidence_count:\s*qualityMetrics\.evidence_url_count/)
  assert.match(ingestionSource, /qualityMetrics\.useful_fact_count\s*>=\s*MIN_COMPLETE_USEFUL_FACTS/)
  assert.match(ingestionSource, /qualityMetrics\.evidence_url_count\s*>=\s*MIN_COMPLETE_EVIDENCE_URLS/)
  assert.match(ingestionSource, /qualityMetrics\.raw_answer_count/)
  assert.doesNotMatch(ingestionSource, /answer_count:\s*answerRecords\.length/)
})

test('dossier ingestion stores quality metrics in raw metadata without a migration', () => {
  const ingestionSource = readFileSync(ingestionModulePath, 'utf8')

  assert.match(ingestionSource, /quality_metrics:\s*episode\.quality_metrics/)
  assert.match(ingestionSource, /raw_answer_count:\s*episode\.quality_metrics\.raw_answer_count/)
  assert.match(ingestionSource, /useful_fact_count:\s*episode\.quality_metrics\.useful_fact_count/)
  assert.match(ingestionSource, /evidence_url_count:\s*episode\.quality_metrics\.evidence_url_count/)
})

test('dossier ingestion tracks blocked wrong-entity tool-failure and generic-context facts', () => {
  const ingestionSource = readFileSync(ingestionModulePath, 'utf8')

  assert.match(ingestionSource, /wrong_entity_fact_count/)
  assert.match(ingestionSource, /tool_failure_fact_count/)
  assert.match(ingestionSource, /generic_context_fact_count/)
  assert.match(ingestionSource, /isWrongEntityFact/)
  assert.match(ingestionSource, /isToolFailureText/)
  assert.match(ingestionSource, /isGenericContextFact/)
  assert.match(ingestionSource, /wrong_entity_blocked/)
  assert.match(ingestionSource, /tool_failure_blocked/)
  assert.match(ingestionSource, /generic_context_only/)
  assert.match(ingestionSource, /hasUsefulFactContent\(fact,\s*entityNames/)
})

test('dossier ingestion supersedes older ingested ledger rows for the same canonical entity', () => {
  const ingestionSource = readFileSync(ingestionModulePath, 'utf8')
  const scriptSource = readFileSync(backfillScriptPath, 'utf8')

  assert.match(ingestionSource, /superseded_by_latest_quality_backfill/)
  assert.match(ingestionSource, /where canonical_entity_id = \$1\s+and content_hash <> \$2\s+and status = 'ingested'/s)
  assert.match(scriptSource, /superseded_by_latest_quality_backfill/)
  assert.match(scriptSource, /where canonical_entity_id = \$1\s+and content_hash <> \$2\s+and status = 'ingested'/s)
})

test('opportunity materialization deactivates failed-only dossier rows instead of keeping them active', () => {
  assert.match(persistenceSource, /deactivateFailedOnlyDossierOpportunities/)
  assert.match(persistenceSource, /title\.ilike\('Question execution failed before a safe answer could be produced%'\)/)
  assert.match(persistenceSource, /raw_payload->>source/)
  assert.match(persistenceSource, /failed_only_dossier_opportunities_deactivated/)
})

test('admin backfill and status routes expose dossier ingestion counts separately from opportunities', () => {
  assert.match(adminBackfillSource, /backfillGraphitiDossierIngestions/)
  assert.match(adminBackfillSource, /dry_run/)
  assert.match(adminBackfillSource, /dossiers_ingested_entities/)
  assert.match(adminBackfillSource, /failed_only_opportunities_deactivated/)

  assert.match(adminStatusSource, /loadGraphitiDossierIngestionStats/)
  assert.match(adminStatusSource, /canonical_entities_total/)
  assert.match(adminStatusSource, /dossiers_persisted_entities/)
  assert.match(adminStatusSource, /dossiers_ingested_entities/)
  assert.match(adminStatusSource, /partial_dossiers_ingested/)
  assert.match(adminStatusSource, /opportunity_worthy_entities/)
  assert.match(adminStatusSource, /failed_only_opportunities_active/)
  assert.match(adminStatusSource, /sparse_complete_entities/)
  assert.match(adminStatusSource, /enrichment_required_entities/)
  assert.match(adminStatusSource, /wrong_entity_blocked/)
  assert.match(adminStatusSource, /tool_failure_blocked/)
  assert.match(adminStatusSource, /generic_context_only/)
})

test('local postgres backfill script supports dry-run and apply modes for dossier ingestion', () => {
  assert.equal(existsSync(backfillScriptPath), true)
  const scriptSource = readFileSync(backfillScriptPath, 'utf8')

  assert.match(scriptSource, /graphiti_dossier_ingestions/)
  assert.match(scriptSource, /--apply/)
  assert.match(scriptSource, /dry_run/)
  assert.match(scriptSource, /latest_canonical_dossiers/)
  assert.match(scriptSource, /would_ingest/)
  assert.match(scriptSource, /would_skip_empty/)
  assert.match(scriptSource, /failed_only_opportunities_deactivated/)
  assert.match(scriptSource, /raw_payload->>'source' = 'entity_dossiers'/)
})

test('home dashboard payload includes dossier ingestion counts without treating them as opportunity counts', () => {
  assert.match(dashboardSource, /graphiti_dossier_ingestion/)
  assert.match(dashboardSource, /loadGraphitiDossierIngestionStats/)
  assert.match(dashboardSource, /dossiers_ingested_entities/)
  assert.match(dashboardSource, /opportunity_worthy_entities/)
  assert.match(dashboardSource, /failed_only_opportunities_active/)
})
