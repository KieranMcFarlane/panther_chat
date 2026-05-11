import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const bridgePath = new URL('../src/lib/graphiti-dossier-memory-bridge.ts', import.meta.url)
const adminBackfillPath = new URL('../src/app/api/admin/graphiti/opportunities/backfill/route.ts', import.meta.url)
const opportunityPersistencePath = new URL('../src/lib/graphiti-opportunity-persistence.ts', import.meta.url)

test('dossier memory bridge exists and loads local postgres canonical entity context', () => {
  assert.equal(existsSync(bridgePath), true)
  const source = readFileSync(bridgePath, 'utf8')

  assert.match(source, /export async function loadGraphitiDossierMemoryCandidates/)
  assert.match(source, /from graphiti_dossier_ingestions i/i)
  assert.match(source, /left join canonical_entities c/i)
  assert.match(source, /c\.id::text = i\.canonical_entity_id/i)
  assert.match(source, /i\.status = 'ingested'/)
  assert.match(source, /i\.episode_body is not null/i)
  assert.match(source, /graphiti_memory_sync_status/)
})

test('dossier memory bridge sends real Graphiti add_memory json episodes', () => {
  const source = readFileSync(bridgePath, 'utf8')

  assert.match(source, /export function buildGraphitiDossierMemoryPayload/)
  assert.match(source, /buildCompactGraphitiDossierEpisode/)
  assert.match(source, /buildMinimalGraphitiDossierMemoryText/)
  assert.match(source, /GRAPHITI_MEMORY_PAYLOAD_MODE/)
  assert.match(source, /minimal_text/)
  assert.match(source, /MAX_GRAPHITI_FACTS/)
  assert.match(source, /MAX_GRAPHITI_EVIDENCE_URLS/)
  assert.match(source, /slice\(0,\s*MAX_GRAPHITI_FACTS\)/)
  assert.match(source, /slice\(0,\s*MAX_GRAPHITI_EVIDENCE_URLS\)/)
  assert.match(source, /source:\s*'text'/)
  assert.match(source, /Graphiti MCP streamable HTTP currently parses source='json' episode_body before validation/)
  assert.match(source, /source_description:\s*'entity_dossiers'/)
  assert.match(source, /Compact entity dossier memory/)
  assert.match(source, /JSON\.stringify\(episode/)
  assert.match(source, /canonical_entity/)
  assert.match(source, /source_ledger_id/)
  assert.match(source, /content_hash/)
  assert.match(source, /uuid:\s*deterministicGraphitiEpisodeUuid/)
})

test('dossier memory bridge defaults to minimal text payloads to keep Graphiti extraction small', () => {
  const source = readFileSync(bridgePath, 'utf8')

  assert.match(source, /const MAX_GRAPHITI_FACTS = 3/)
  assert.match(source, /const MAX_GRAPHITI_EVIDENCE_URLS = 3/)
  assert.match(source, /const MAX_GRAPHITI_FACT_TEXT = 220/)
  assert.match(source, /payloadMode:\s*toText\(env\.GRAPHITI_MEMORY_PAYLOAD_MODE\)\.toLowerCase\(\) === 'compact_json'\s*\?\s*'compact_json'\s*:\s*'minimal_text'/)
  assert.match(source, /episode_body:\s*payloadMode === 'compact_json'/)
  assert.match(source, /buildGraphitiDossierMemoryPayload\(row,\s*config\.groupId,\s*config\.payloadMode\)/)
  assert.match(source, /Facts:\$\{selectedFacts\.length/)
})

test('dossier memory bridge supports MCP and direct ingest endpoints without request-time UI dependency', () => {
  const source = readFileSync(bridgePath, 'utf8')

  assert.match(source, /GRAPHITI_MEMORY_INGEST_URL/)
  assert.match(source, /GRAPHITI_MCP_URL/)
  assert.match(source, /tools\/call/)
  assert.match(source, /add_memory/)
  assert.match(source, /syncGraphitiDossierIngestionMemory/)
  assert.match(source, /dryRun/)
  assert.match(source, /concurrency/)
  assert.doesNotMatch(source, /opportunities-client/)
})

test('dossier memory bridge throttles Graphiti queue submissions for Z.ai GLM stability', () => {
  const source = readFileSync(bridgePath, 'utf8')

  assert.match(source, /GRAPHITI_DOSSIER_MEMORY_SYNC_CONCURRENCY/)
  assert.match(source, /GRAPHITI_MEMORY_SYNC_BATCH_SIZE/)
  assert.match(source, /GRAPHITI_MEMORY_SYNC_QUEUE_DELAY_MS/)
  assert.match(source, /GRAPHITI_MEMORY_SYNC_RETRY_ATTEMPTS/)
  assert.match(source, /GRAPHITI_MEMORY_SYNC_RETRY_BASE_DELAY_MS/)
  assert.match(source, /async function sleep/)
  assert.match(source, /await sleep\(config\.queueDelayMs\)/)
  assert.match(source, /isTransientGraphitiRateLimit/)
  assert.match(source, /code['"]?\s*:\s*['"]?1305/)
})

test('dossier memory bridge uses streamable HTTP MCP accept headers', () => {
  const source = readFileSync(bridgePath, 'utf8')

  assert.match(source, /const MCP_ACCEPT_HEADER = 'application\/json, text\/event-stream'/)
  assert.match(source, /accept:\s*MCP_ACCEPT_HEADER/)
})

test('dossier memory bridge initializes streamable HTTP MCP sessions before tool calls', () => {
  const source = readFileSync(bridgePath, 'utf8')

  assert.match(source, /method:\s*'initialize'/)
  assert.match(source, /mcp-session-id/i)
  assert.match(source, /notifications\/initialized/)
  assert.match(source, /method:\s*'tools\/call'/)
})

test('dossier memory bridge treats MCP tool errors as failed syncs', () => {
  const source = readFileSync(bridgePath, 'utf8')

  assert.match(source, /assertGraphitiMcpToolSuccess/)
  assert.match(source, /isError/)
  assert.match(source, /Graphiti MCP tool \$\{name\} failed/)
  assert.match(source, /throw new Error/)
})

test('dossier memory bridge lets Graphiti generate episode UUIDs for MCP add_memory', () => {
  const source = readFileSync(bridgePath, 'utf8')

  assert.match(source, /function toGraphitiMcpAddMemoryArgs/)
  assert.match(source, /const \{\s*uuid:\s*_graphitiEpisodeUuid,\s*\.\.\.mcpArgs\s*\} = payload/)
  assert.match(source, /return callGraphitiMcpTool\(config,\s*payload\.uuid,\s*'add_memory',\s*toGraphitiMcpAddMemoryArgs\(payload\)\)/)
})

test('dossier memory bridge uses Graphiti MCP search_memory_facts tool name', () => {
  const source = readFileSync(bridgePath, 'utf8')

  assert.match(source, /callGraphitiMcpTool\(config,\s*`search-facts:\$\{sourceRow\.insight_id\}`,\s*'search_memory_facts'/)
  assert.doesNotMatch(source, /name:\s*'search_facts'/)
})

test('dossier memory bridge clears stale sync error metadata after successful sync', () => {
  const source = readFileSync(bridgePath, 'utf8')

  assert.match(source, /graphiti_memory_sync_error'/)
  assert.match(source, /graphiti_memory_sync_failed_at'/)
  assert.match(source, /raw_metadata\s*=\s*\(coalesce\(raw_metadata,\s*'\{\}'::jsonb\)\s*-\s*ARRAY\[/)
})

test('dossier memory bridge records MCP add_memory as queued instead of fully synced', () => {
  const source = readFileSync(bridgePath, 'utf8')

  assert.match(source, /graphiti_memory_sync_status:\s*'queued'/)
  assert.match(source, /graphiti_memory_queued_at/)
  assert.match(source, /queued_count/)
  assert.match(source, /coalesce\(i\.raw_metadata->>'graphiti_memory_sync_status', ''\) not in \('synced', 'queued'\)/)
})

test('admin opportunities backfill syncs dossier ledger rows into Graphiti before materialization', () => {
  const source = readFileSync(adminBackfillPath, 'utf8')

  assert.match(source, /syncGraphitiDossierIngestionMemory/)
  assert.match(source, /graphiti_memory_sync/)
  assert.match(source, /dossierIngestion = await backfillGraphitiDossierIngestions/)
  assert.match(source, /await syncGraphitiDossierIngestionMemory/)
  assert.match(source, /const result = await materializeGraphitiOpportunities/)
})

test('opportunity materializer preserves graph memory sync metadata for downstream graph-backed retrieval', () => {
  const source = readFileSync(opportunityPersistencePath, 'utf8')

  assert.match(source, /enrichDossierOpportunitySourceWithGraphMemory/)
  assert.match(source, /graphiti_memory_sync_status/)
  assert.match(source, /graphiti_episode_uuid/)
  assert.match(source, /graphiti_group_id/)
  assert.match(source, /graphiti_memory_evidence/)
})
