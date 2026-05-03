import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const persistenceSource = readFileSync(new URL('../src/lib/graphiti-opportunity-persistence.ts', import.meta.url), 'utf8')
const materializerSource = readFileSync(new URL('../src/lib/graphiti-opportunity-materializer.ts', import.meta.url), 'utf8')
const readModelSource = readFileSync(new URL('../src/lib/graphiti-opportunity-read-model.ts', import.meta.url), 'utf8')

test('Graphiti opportunity materialization reads ingested local Postgres dossiers', () => {
  assert.match(persistenceSource, /from graphiti_dossier_ingestions i/)
  assert.match(persistenceSource, /join entity_dossiers d on d\.id = i\.dossier_id/)
  assert.match(persistenceSource, /where i\.status = 'ingested'/)
  assert.match(persistenceSource, /i\.id as source_ledger_id/)
  assert.match(persistenceSource, /i\.episode_body/)
  assert.match(persistenceSource, /answer_count/)
  assert.match(persistenceSource, /evidence_count/)
  assert.match(persistenceSource, /source:\s*'entity_dossiers'/)
  assert.match(persistenceSource, /episode_body:\s*row\.episode_body/)
  assert.match(persistenceSource, /source_ledger_id:\s*row\.source_ledger_id/)
  assert.match(persistenceSource, /loadPersistedDossierOpportunitySources/)
  assert.match(persistenceSource, /const generatedAt = toIso\(/)
  assert.match(persistenceSource, /return persistedDossierRows\.filter/)
  assert.doesNotMatch(persistenceSource, /\.\.\.dossierRows/)
})

test('dossier materialization applies conservative promotion metadata', () => {
  assert.match(materializerSource, /assessDossierOpportunityPromotion/)
  assert.match(materializerSource, /promotion\.shortlist/)
  assert.match(materializerSource, /promotion_reason/)
  assert.match(materializerSource, /watch_item/)
  assert.match(materializerSource, /commercial_qualification/)
  assert.match(persistenceSource, /source_ledger_id/)
  assert.match(persistenceSource, /shortlist_opportunity/)
})

test('opportunities read model excludes legacy, mock, and demo-origin materialized rows', () => {
  assert.match(readModelSource, /isLegacyOrDemoOriginOpportunityRow/)
  assert.match(readModelSource, /legacy/i)
  assert.match(readModelSource, /mock/i)
  assert.match(readModelSource, /demo/i)
  assert.match(readModelSource, /client_demo_seed/)
  assert.match(readModelSource, /demo_fallback_materialization/)
  assert.match(readModelSource, /source_objective/)
  assert.match(readModelSource, /raw_payload/)
})

test('opportunities read model only serves current ledger-backed shortlist rows by default', () => {
  assert.match(readModelSource, /isCurrentDossierShortlistOpportunityRow/)
  assert.match(readModelSource, /source_ledger_id/)
  assert.match(readModelSource, /shortlist_opportunity/)
  assert.match(readModelSource, /watch_item/)
  assert.match(readModelSource, /temporal_reasoning/)
  assert.match(readModelSource, /commercial_qualification/)
  assert.match(readModelSource, /context_only/)
  assert.match(readModelSource, /watch/)
  assert.match(readModelSource, /stale/)
  assert.match(readModelSource, /expired/)
  assert.match(readModelSource, /&& isCurrentDossierShortlistOpportunityRow\(row\)/)
})

test('opportunities read model recomputes temporal reasoning instead of trusting stale raw payload labels', () => {
  assert.match(readModelSource, /const temporalReasoning = computedReasoning\.temporal_reasoning/)
  assert.doesNotMatch(readModelSource, /const temporalReasoning = asRecord\(rawPayload\.temporal_reasoning\)\.status/)
})

test('opportunity materialization does not rematerialize legacy, mock, demo, or parent insight sources', () => {
  assert.match(persistenceSource, /isLegacyOrDemoPersistedOpportunity/)
  assert.match(persistenceSource, /const persistedDossierRows = await loadPersistedDossierOpportunitySources\(limit\)/)
  assert.match(persistenceSource, /return persistedDossierRows\.filter/)
  assert.doesNotMatch(persistenceSource, /from\('graphiti_materialized_insights'\)/)
  assert.doesNotMatch(persistenceSource, /isOpportunityCandidateSource/)
  assert.match(persistenceSource, /!isLegacyOrDemoPersistedOpportunity\(row\)/)
})

test('materialized opportunity upserts use the local Postgres persisted column shape', () => {
  assert.match(persistenceSource, /function toPersistedOpportunityRow/)
  assert.match(persistenceSource, /opportunity_id:\s*row\.opportunity_id/)
  assert.match(persistenceSource, /raw_payload:\s*row\.raw_payload/)
  assert.doesNotMatch(persistenceSource, /\.\.\.persisted,\s*\n\s*materialized_at/)
  assert.doesNotMatch(persistenceSource, /id:\s*row\.id/)
  assert.doesNotMatch(persistenceSource, /description:\s*row\.description/)
  assert.doesNotMatch(persistenceSource, /temporal_reasoning:\s*row\.temporal_reasoning/)
})

test('materialization persists demoted dossier opportunities as inactive rows', () => {
  assert.match(persistenceSource, /persistableOpportunityRows/)
  assert.match(persistenceSource, /const persistedRows = persistableOpportunityRows\s*\.map\(\(row\) => toPersistedOpportunityRow\(row, nowIso\)\)/)
  assert.match(persistenceSource, /const shortlistOpportunityRows = opportunityRows\.filter/)
  assert.doesNotMatch(
    persistenceSource,
    /const persistedRows = shortlistOpportunityRows\s*\.map\(\(row\) => toPersistedOpportunityRow\(row, nowIso\)\)/,
  )
})

test('dossier-backed opportunities skip failed-only partial dossiers', () => {
  assert.match(persistenceSource, /function hasUsefulDossierOpportunitySignal/)
  assert.match(readModelSource, /function isFailedOnlyOpportunityRow/)
  assert.match(persistenceSource, /Question execution failed before a safe answer could be produced/)
  assert.match(persistenceSource, /OpenCodeProviderInsufficientBalanceError/)
  assert.match(persistenceSource, /terminalStates/)
  assert.match(persistenceSource, /return null/)
  assert.match(readModelSource, /!isFailedOnlyOpportunityRow\(row\)/)
})

test('opportunities read model sanitizes structured blob text and compresses oversized titles', () => {
  assert.match(readModelSource, /function extractStructuredText/)
  assert.match(readModelSource, /function sanitizeNarrativeText/)
  assert.match(readModelSource, /function buildOpportunityLabel/)
  assert.match(readModelSource, /no deterministic answer was produced for this question/i)
  assert.match(readModelSource, /no_signal/)
  assert.match(readModelSource, /has a dossier-backed opportunity signal/i)
  assert.match(readModelSource, /titleNeedsCompression/)
  assert.match(readModelSource, /buildOpportunityLabel\(row\)/)
})

test('opportunity cards prefer trigger-specific labels over generic live commercial openings', () => {
  assert.match(readModelSource, /buying_triggers/)
  assert.match(readModelSource, /hiring signal/)
  assert.match(readModelSource, /digital platform opportunity/)
  assert.match(readModelSource, /procurement\/tender signal/)
  assert.match(readModelSource, /live commercial opening/)
  assert.match(readModelSource, /personTitleNeedsTriggerLabel/)
})

test('opportunity cards prefer YP fit breakdown and sanitize read-more context', () => {
  assert.match(readModelSource, /yp_fit_breakdown/)
  assert.match(readModelSource, /capability_match/)
  assert.match(readModelSource, /buyer_route/)
  assert.match(readModelSource, /verification_needed/)
  assert.match(readModelSource, /Trigger:/)
  assert.match(readModelSource, /sanitizeReadMoreContext/)
  assert.match(readModelSource, /sanitizeFindingRows/)
})
