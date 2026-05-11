import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const epochModulePath = new URL('../src/lib/graphiti-opportunity-quality-epoch.ts', import.meta.url)
const persistencePath = new URL('../src/lib/graphiti-opportunity-persistence.ts', import.meta.url)
const readModelPath = new URL('../src/lib/graphiti-opportunity-read-model.ts', import.meta.url)
const diagnosticsPath = new URL('../src/app/api/opportunities/diagnostics/route.ts', import.meta.url)
const uiPath = new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url)
const synthesisPath = new URL('../src/lib/graphiti-opportunity-strategy-synthesis.mjs', import.meta.url)
const ingestionPath = new URL('../src/lib/graphiti-dossier-ingestion.ts', import.meta.url)
const labelScriptPath = new URL('../scripts/admin/label-graphiti-opportunity-quality-epoch.mjs', import.meta.url)

test('graphiti opportunity quality epoch constants are centralized and match the verified cutoff', () => {
  assert.equal(existsSync(epochModulePath), true)
  const source = readFileSync(epochModulePath, 'utf8')

  assert.match(source, /GRAPHITI_OPPORTUNITY_QUALITY_EPOCH\s*=\s*'yp_graphiti_truth_v1'/)
  assert.match(source, /GRAPHITI_OPPORTUNITY_PROCESSED_VERSION\s*=\s*'graphiti_commercial_truth_v1'/)
  assert.match(source, /GRAPHITI_OPPORTUNITY_QUALITY_CUTOFF_AT\s*=\s*'2026-05-08T13:26:48\.989Z'/)
  assert.match(source, /stampTrustedGraphitiQualityEpoch/)
  assert.match(source, /stampLegacyUntrustedGraphitiQualityEpoch/)
  assert.match(source, /isTrustedGraphitiQualityEpochPayload/)
  assert.match(source, /isLegacyUntrustedGraphitiPayload/)
})

test('materialization and synthesis stamp newly processed rows with the trusted epoch', () => {
  const persistenceSource = readFileSync(persistencePath, 'utf8')
  const synthesisSource = readFileSync(synthesisPath, 'utf8')
  const ingestionSource = readFileSync(ingestionPath, 'utf8')

  assert.match(persistenceSource, /stampTrustedGraphitiQualityEpoch/)
  assert.match(persistenceSource, /raw_payload:\s*stampTrustedGraphitiQualityEpoch\(persisted\.raw_payload \|\| \{\},\s*nowIso\)/)
  assert.match(synthesisSource, /stampTrustedGraphitiQualityEpoch/)
  assert.match(synthesisSource, /bd_strategy_brief:\s*brief/)
  assert.match(synthesisSource, /quality_epoch/)
  assert.match(ingestionSource, /stampTrustedGraphitiQualityEpoch/)
  assert.match(ingestionSource, /raw_metadata:\s*stampTrustedGraphitiQualityEpoch/)
  assert.match(ingestionSource, /includeLegacyBeforeEpoch/)
  assert.match(ingestionSource, /GRAPHITI_OPPORTUNITY_QUALITY_CUTOFF_AT/)
})

test('materialization source selection ignores legacy dossier ledgers by default', () => {
  const persistenceSource = readFileSync(persistencePath, 'utf8')
  const synthesisSource = readFileSync(synthesisPath, 'utf8')

  assert.match(persistenceSource, /isTrustedGraphitiQualityEpochPayload\(row\.raw_metadata\)/)
  assert.match(persistenceSource, /if \(!isTrustedGraphitiQualityEpochPayload\(row\.raw_metadata\)\) continue/)
  assert.match(synthesisSource, /isTrustedGraphitiQualityEpochPayload\(row\.raw_payload\)/)
})

test('read model and strict opportunities route exclude legacy-untrusted rows', () => {
  const readModelSource = readFileSync(readModelPath, 'utf8')

  assert.match(readModelSource, /isTrustedGraphitiOpportunityRow/)
  assert.match(readModelSource, /isTrustedGraphitiQualityEpochPayload/)
  assert.match(readModelSource, /&& isTrustedGraphitiOpportunityRow\(row\)/)
  assert.match(readModelSource, /legacy_untrusted/)
})

test('diagnostics exposes trusted epoch counts and keeps legacy rows out of default commercial buckets', () => {
  const source = readFileSync(diagnosticsPath, 'utf8')

  assert.match(source, /quality_epoch_cutoff_at/)
  assert.match(source, /legacy_untrusted_count/)
  assert.match(source, /trusted_epoch_count/)
  assert.match(source, /legacy_untrusted/)
  assert.match(source, /isTrustedGraphitiQualityEpochPayload/)
  assert.match(source, /isLegacyUntrustedGraphitiPayload/)
  assert.match(source, /commercialStateRows\.filter\(\(row\) =>/)
  assert.match(source, /options\.commercialState === 'legacy_untrusted'/)
})

test('opportunities UI communicates the trusted epoch and hides legacy from main tabs by default', () => {
  const source = readFileSync(uiPath, 'utf8')

  assert.match(source, /Trusted feed since 8 May 2026, 13:26:48 UTC/)
  assert.match(source, /Legacy rows are shown as labelled untrusted cards and are not counted as trusted opportunities\./)
  assert.match(source, /legacy_untrusted_count/)
  assert.match(source, /trusted_epoch_count/)
  assert.match(source, /quality_epoch_cutoff_at/)
  assert.match(source, /Legacy recovery/)
})

test('admin label script supports dry-run and apply quality epoch labelling without deleting rows', () => {
  assert.equal(existsSync(labelScriptPath), true)
  const source = readFileSync(labelScriptPath, 'utf8')

  assert.match(source, /--apply/)
  assert.match(source, /dryRun/)
  assert.match(source, /legacy_untrusted/)
  assert.match(source, /yp_graphiti_truth_v1/)
  assert.match(source, /graphiti_commercial_truth_v1/)
  assert.match(source, /graphiti_materialized_opportunities/)
  assert.match(source, /graphiti_dossier_ingestions/)
  assert.doesNotMatch(source, /\bdelete\s+from\b/i)
})
