import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const recoveryPath = new URL('../src/lib/graphiti-legacy-opportunity-recovery.ts', import.meta.url)
const diagnosticsPath = new URL('../src/app/api/opportunities/diagnostics/route.ts', import.meta.url)
const endpointPath = new URL('../src/app/api/admin/graphiti/opportunities/legacy/reprocess/route.ts', import.meta.url)
const uiPath = new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url)

test('legacy recovery scorer defines recoverable, context-only, and data-issue tiers', () => {
  assert.equal(existsSync(recoveryPath), true)
  const source = readFileSync(recoveryPath, 'utf8')

  assert.match(source, /recoverable_legacy/)
  assert.match(source, /legacy_context_only/)
  assert.match(source, /legacy_data_issue/)
  assert.match(source, /scoreLegacyOpportunityRecovery/)
  assert.match(source, /legacy_recovery_score/)
  assert.match(source, /legacy_recovery_blockers/)
  assert.match(source, /recommended_recovery_action/)
  assert.match(source, /wrong_entity|kind:\s*summary|blocked by upstream question state|question execution failed|No evidence URLs/s)
  assert.match(source, /sports-relevant|sportsRelevant|sport|competition/s)
})

test('diagnostics exposes recoverable legacy candidates without mixing them into trusted buckets', () => {
  const source = readFileSync(diagnosticsPath, 'utf8')

  assert.match(source, /scoreLegacyOpportunityRecovery/)
  assert.match(source, /recoverable_legacy_count/)
  assert.match(source, /legacy_recovery_candidates/)
  assert.match(source, /legacy_recovery_score/)
  assert.match(source, /legacy_recovery_blockers/)
  assert.match(source, /recommended_recovery_action/)
  assert.match(source, /commercialStateCounts\.legacy_untrusted/)
  assert.match(source, /trustedCommercialStateRows/)
  assert.doesNotMatch(source, /commercialStateCounts\.watch\s*\+=\s*legacyRecovery/)
})

test('admin legacy recovery endpoint is dry-run by default and selected-only', () => {
  assert.equal(existsSync(endpointPath), true)
  const source = readFileSync(endpointPath, 'utf8')

  assert.match(source, /requireApiSession/)
  assert.match(source, /dry_run|dryRun/)
  assert.match(source, /dryRun\s*=\s*body\?\.dry_run !== false/)
  assert.match(source, /opportunity_ids/)
  assert.match(source, /canonical_entity_ids/)
  assert.match(source, /limit/)
  assert.match(source, /recoverable_legacy/)
  assert.match(source, /synthesizeGraphitiOpportunityStrategyBrief/)
  assert.match(source, /validateStrategyBrief/)
  assert.match(source, /stampTrustedGraphitiQualityEpoch/)
  assert.match(source, /legacy_untrusted:\s*false/)
  assert.match(source, /failed_strategy_synthesis|failed_quality_gate/)
  assert.doesNotMatch(source, /update graphiti_materialized_opportunities[\s\S]*where\s+raw_payload->>'legacy_untrusted'\s*=\s*'true'[\s\S]*without selection/i)
})

test('review UI shows legacy recovery separately and keeps default page trusted-only', () => {
  const source = readFileSync(uiPath, 'utf8')

  assert.match(source, /Legacy recovery/)
  assert.match(source, /recoverable_legacy_count/)
  assert.match(source, /legacy_recovery_candidates/)
  assert.match(source, /Recoverable/)
  assert.match(source, /Legacy context/)
  assert.match(source, /Legacy data issue/)
  assert.match(source, /reviewMode \? .*legacy_untrusted/s)
  assert.doesNotMatch(source, /commercialStateTabs:.*legacy_untrusted(?![\s\S]*reviewMode)/)
})
