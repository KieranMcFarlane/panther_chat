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
  assert.match(source, /source:\s*'json'/)
  assert.match(source, /source_description:\s*'entity_dossiers'/)
  assert.match(source, /episode_body:\s*JSON\.stringify/)
  assert.match(source, /canonical_entity/)
  assert.match(source, /source_ledger_id/)
  assert.match(source, /content_hash/)
  assert.match(source, /uuid:\s*deterministicGraphitiEpisodeUuid/)
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
