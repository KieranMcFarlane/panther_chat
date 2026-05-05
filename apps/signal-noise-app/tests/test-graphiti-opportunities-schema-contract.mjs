import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const persistenceSource = readFileSync(new URL('../src/lib/graphiti-opportunity-persistence.ts', import.meta.url), 'utf8')

test('graphiti opportunities persistence strips unsupported freshness before upsert', () => {
  assert.match(persistenceSource, /const \{\s*freshness: _freshness,\s*metadata: _metadata,\s*\.\.\.persisted\s*\} = row/)
  assert.match(persistenceSource, /\.upsert\(persistedRows, \{ onConflict: 'opportunity_id' \}\)/)
})

test('graphiti opportunities persistence refreshes materialization timestamps without changing detection time', () => {
  assert.match(persistenceSource, /detected_at:\s*persisted\.detected_at/)
  assert.match(persistenceSource, /materialized_at:\s*nowIso/)
  assert.match(persistenceSource, /last_seen_at:\s*nowIso/)
})

test('graphiti opportunities persistence preserves existing BD strategy payloads during rematerialization', () => {
  assert.match(persistenceSource, /select\('opportunity_id, state_hash, is_active, raw_payload'\)/)
  assert.match(persistenceSource, /preserveExistingStrategyPayload/)
  assert.match(persistenceSource, /bd_strategy_brief/)
  assert.match(persistenceSource, /bd_strategy_status/)
  assert.match(persistenceSource, /bd_strategy_error/)
})

test('graphiti opportunities source selection prefers strongest dossier ledger per entity', () => {
  assert.match(persistenceSource, /case i\.quality_state when 'client_ready' then 4 when 'complete' then 3 when 'partial' then 2 when 'blocked' then 1 else 0 end desc/)
  assert.match(persistenceSource, /coalesce\(i\.evidence_count,\s*0\) desc/)
  assert.match(persistenceSource, /coalesce\(i\.answer_count,\s*0\) desc/)
  assert.doesNotMatch(persistenceSource, /order by i\.canonical_entity_id,\s*i\.updated_at desc/)
})

test('graphiti opportunities source selection excludes sparse dossier ledgers without dated triggers', () => {
  assert.match(persistenceSource, /function hasExplicitFreshBuyingTrigger/)
  assert.match(persistenceSource, /function shouldSkipSparseDossierLedger/)
  assert.match(persistenceSource, /Number\(row\.evidence_count \|\| 0\) <= 0/)
  assert.match(persistenceSource, /shouldSkipSparseDossierLedger\(row, sourceRow\)/)
  assert.match(persistenceSource, /return null/)
})
