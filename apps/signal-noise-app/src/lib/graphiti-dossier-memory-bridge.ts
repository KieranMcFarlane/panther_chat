import crypto from 'node:crypto'
import { query as queryPostgres } from '@/lib/pg-client'
import type { GraphitiOpportunitySourceRow } from '@/lib/graphiti-opportunity-contract'

type JsonRecord = Record<string, unknown>

export type GraphitiDossierMemoryCandidate = {
  source_ledger_id: string
  canonical_entity_id: string
  entity_id: string | null
  entity_name: string
  entity_type: string | null
  content_hash: string
  quality_state: string
  answer_count: number
  evidence_count: number
  reference_time: string | null
  episode_body: JsonRecord
  raw_metadata: JsonRecord | null
  canonical_entity: JsonRecord
}

export type GraphitiDossierMemoryPayload = {
  name: string
  episode_body: string
  source: 'json'
  source_description: 'entity_dossiers'
  group_id: string
  uuid: string
}

type GraphitiMemoryBridgeConfig = {
  enabled: boolean
  directIngestUrl: string
  mcpUrl: string
  groupId: string
  timeoutMs: number
}

const MCP_PROTOCOL_VERSION = '2025-03-26'
const MCP_ACCEPT_HEADER = 'application/json, text/event-stream'

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function toInt(value: unknown, fallback = 0): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function deterministicGraphitiEpisodeUuid(value: string): string {
  const hex = crypto.createHash('sha256').update(value).digest('hex').slice(0, 32).split('')
  hex[12] = '5'
  const variant = Number.parseInt(hex[16] || '0', 16)
  hex[16] = ((variant & 0x3) | 0x8).toString(16)
  return [
    hex.slice(0, 8).join(''),
    hex.slice(8, 12).join(''),
    hex.slice(12, 16).join(''),
    hex.slice(16, 20).join(''),
    hex.slice(20, 32).join(''),
  ].join('-')
}

export function resolveGraphitiMemoryBridgeConfig(env = process.env): GraphitiMemoryBridgeConfig {
  const directIngestUrl = toText(env.GRAPHITI_MEMORY_INGEST_URL)
  const mcpUrl = toText(env.GRAPHITI_MCP_URL || env.GRAPHITI_SERVICE_URL)
  const enabledFlag = toText(env.GRAPHITI_DOSSIER_MEMORY_SYNC).toLowerCase()
  const enabled = enabledFlag === '0' || enabledFlag === 'false'
    ? false
    : Boolean(directIngestUrl || mcpUrl)

  return {
    enabled,
    directIngestUrl,
    mcpUrl,
    groupId: toText(env.GRAPHITI_DOSSIER_GROUP_ID || env.GRAPHITI_GROUP_ID) || 'entity_dossiers',
    timeoutMs: toInt(env.GRAPHITI_MEMORY_SYNC_TIMEOUT_MS, 30_000),
  }
}

export async function loadGraphitiDossierMemoryCandidates(limit = 250): Promise<GraphitiDossierMemoryCandidate[]> {
  const result = await queryPostgres(
    `
      select
        i.id::text as source_ledger_id,
        i.canonical_entity_id,
        i.entity_id,
        coalesce(c.name, i.entity_name, i.canonical_entity_id) as entity_name,
        coalesce(c.entity_type, i.entity_type) as entity_type,
        i.content_hash,
        i.quality_state,
        i.answer_count,
        i.evidence_count,
        i.reference_time,
        i.episode_body,
        i.raw_metadata,
        jsonb_strip_nulls(jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'entity_type', c.entity_type,
          'sport', c.sport,
          'league', c.league,
          'country', c.country,
          'canonical_key', c.canonical_key,
          'labels', c.labels,
          'properties', c.properties,
          'priority_score', c.priority_score,
          'quality_score', c.quality_score,
          'entity_category', c.entity_category,
          'league_canonical_entity_id', c.league_canonical_entity_id,
          'parent_canonical_entity_id', c.parent_canonical_entity_id
        )) as canonical_entity
      from graphiti_dossier_ingestions i
      left join canonical_entities c
        on c.id::text = i.canonical_entity_id
      where i.status = 'ingested'
        and i.episode_body is not null
        and coalesce(i.raw_metadata->>'graphiti_memory_sync_status', '') <> 'synced'
      order by
        case i.quality_state when 'client_ready' then 4 when 'complete' then 3 when 'partial' then 2 when 'blocked' then 1 else 0 end desc,
        coalesce(i.evidence_count, 0) desc,
        coalesce(i.answer_count, 0) desc,
        coalesce(i.source_generated_at, i.reference_time, i.updated_at) desc nulls last
      limit $1
    `,
    [Math.max(1, limit)],
  )

  return (result.rows || []).map((row: Record<string, unknown>) => ({
    source_ledger_id: toText(row.source_ledger_id),
    canonical_entity_id: toText(row.canonical_entity_id),
    entity_id: toText(row.entity_id) || null,
    entity_name: toText(row.entity_name || row.canonical_entity_id),
    entity_type: toText(row.entity_type) || null,
    content_hash: toText(row.content_hash),
    quality_state: toText(row.quality_state),
    answer_count: toInt(row.answer_count),
    evidence_count: toInt(row.evidence_count),
    reference_time: toText(row.reference_time) || null,
    episode_body: asRecord(row.episode_body),
    raw_metadata: asRecord(row.raw_metadata),
    canonical_entity: asRecord(row.canonical_entity),
  }))
}

export function buildGraphitiDossierMemoryPayload(
  row: GraphitiDossierMemoryCandidate,
  groupId = 'entity_dossiers',
): GraphitiDossierMemoryPayload {
  const episode = {
    source: 'entity_dossiers',
    source_ledger_id: row.source_ledger_id,
    content_hash: row.content_hash,
    canonical_entity_id: row.canonical_entity_id,
    canonical_entity: row.canonical_entity,
    dossier_quality: {
      quality_state: row.quality_state,
      useful_fact_count: row.answer_count,
      evidence_count: row.evidence_count,
      reference_time: row.reference_time,
    },
    episode_body: row.episode_body,
  }

  return {
    name: `Entity dossier: ${row.entity_name} (${row.content_hash.slice(0, 10)})`,
    episode_body: JSON.stringify(episode),
    source: 'json',
    source_description: 'entity_dossiers',
    group_id: groupId,
    uuid: deterministicGraphitiEpisodeUuid(`${row.source_ledger_id}:${row.content_hash}`),
  }
}

function parseGraphitiHttpPayload(text: string, contentType: string): unknown {
  if (!text.trim()) return {}

  if (contentType.toLowerCase().includes('text/event-stream')) {
    const dataLines = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace(/^data:\s*/, '').trim())
      .filter(Boolean)

    for (const line of dataLines.slice().reverse()) {
      try {
        return JSON.parse(line)
      } catch {
        // Try the previous event payload.
      }
    }

    return { raw_sse_payload: text.slice(0, 1_000) }
  }

  try {
    return JSON.parse(text)
  } catch {
    return { raw_payload: text.slice(0, 1_000) }
  }
}

async function postGraphitiJson(url: string, body: unknown, timeoutMs: number, options: {
  sessionId?: string
} = {}): Promise<{ payload: unknown; sessionId: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: MCP_ACCEPT_HEADER,
    }
    if (options.sessionId) {
      headers['mcp-session-id'] = options.sessionId
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const payload = parseGraphitiHttpPayload(
      await response.text().catch(() => ''),
      response.headers.get('content-type') || '',
    )
    if (!response.ok) {
      throw new Error(`Graphiti memory ingest failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`)
    }
    return {
      payload,
      sessionId: response.headers.get('mcp-session-id') || options.sessionId || '',
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function postJson(url: string, body: unknown, timeoutMs: number): Promise<unknown> {
  return (await postGraphitiJson(url, body, timeoutMs)).payload
}

async function initializeGraphitiMcpSession(config: GraphitiMemoryBridgeConfig): Promise<string> {
  const initialized = await postGraphitiJson(config.mcpUrl, {
    jsonrpc: '2.0',
    id: `initialize:${Date.now()}`,
    method: 'initialize',
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'signal-noise-app',
        version: '0.1.0',
      },
    },
  }, config.timeoutMs)

  if (!initialized.sessionId) {
    throw new Error('Graphiti MCP initialize did not return an mcp-session-id')
  }

  await postGraphitiJson(config.mcpUrl, {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {},
  }, config.timeoutMs, { sessionId: initialized.sessionId })

  return initialized.sessionId
}

async function callGraphitiMcpTool(
  config: GraphitiMemoryBridgeConfig,
  id: string,
  name: string,
  args: JsonRecord,
): Promise<unknown> {
  const sessionId = await initializeGraphitiMcpSession(config)
  return (await postGraphitiJson(config.mcpUrl, {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: {
      name,
      arguments: args,
    },
  }, config.timeoutMs, { sessionId })).payload
}

async function callGraphitiAddMemory(payload: GraphitiDossierMemoryPayload, config: GraphitiMemoryBridgeConfig): Promise<unknown> {
  if (config.directIngestUrl) {
    return postJson(config.directIngestUrl, payload, config.timeoutMs)
  }

  if (!config.mcpUrl) {
    throw new Error('Graphiti memory sync is enabled but GRAPHITI_MEMORY_INGEST_URL or GRAPHITI_MCP_URL is not configured')
  }

  return callGraphitiMcpTool(config, payload.uuid, 'add_memory', payload as unknown as JsonRecord)
}

async function markGraphitiMemorySync(row: GraphitiDossierMemoryCandidate, patch: JsonRecord) {
  await queryPostgres(
    `
      update graphiti_dossier_ingestions
      set raw_metadata = (coalesce(raw_metadata, '{}'::jsonb) - ARRAY[
            'graphiti_memory_sync_error',
            'graphiti_memory_sync_failed_at'
          ]) || $2::jsonb,
          updated_at = now()
      where id = $1::uuid
    `,
    [row.source_ledger_id, JSON.stringify(patch)],
  )
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let index = 0
  async function next() {
    while (index < items.length) {
      const item = items[index++]
      await worker(item)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, next))
}

export async function syncGraphitiDossierIngestionMemory(options: {
  limit?: number
  dryRun?: boolean
  concurrency?: number
  config?: GraphitiMemoryBridgeConfig
} = {}) {
  const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 250
  const dryRun = options.dryRun === true
  const concurrency = Number.isFinite(Number(options.concurrency)) ? Number(options.concurrency) : 2
  const config = options.config || resolveGraphitiMemoryBridgeConfig()
  const candidates = await loadGraphitiDossierMemoryCandidates(limit)

  if (dryRun || !config.enabled) {
    return {
      candidate_count: candidates.length,
      synced_count: 0,
      failed_count: 0,
      dry_run: dryRun,
      skipped: !config.enabled,
      warnings: config.enabled ? [] : ['Graphiti memory sync skipped: no GRAPHITI_MEMORY_INGEST_URL or GRAPHITI_MCP_URL configured'],
    }
  }

  let synced = 0
  let failed = 0
  const errors: Array<{ source_ledger_id: string; error: string }> = []

  await runWithConcurrency(candidates, concurrency, async (row) => {
    const payload = buildGraphitiDossierMemoryPayload(row, config.groupId)
    try {
      const response = await callGraphitiAddMemory(payload, config)
      await markGraphitiMemorySync(row, {
        graphiti_memory_sync_status: 'synced',
        graphiti_memory_synced_at: new Date().toISOString(),
        graphiti_episode_uuid: payload.uuid,
        graphiti_group_id: payload.group_id,
        graphiti_memory_response: response,
      })
      synced += 1
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      errors.push({ source_ledger_id: row.source_ledger_id, error: message })
      await markGraphitiMemorySync(row, {
        graphiti_memory_sync_status: 'failed',
        graphiti_memory_sync_error: message.slice(0, 500),
        graphiti_memory_sync_failed_at: new Date().toISOString(),
        graphiti_episode_uuid: payload.uuid,
        graphiti_group_id: payload.group_id,
      })
    }
  })

  return {
    candidate_count: candidates.length,
    synced_count: synced,
    failed_count: failed,
    dry_run: false,
    skipped: false,
    errors,
    warnings: [],
  }
}

export async function enrichDossierOpportunitySourceWithGraphMemory(
  ledgerRow: { raw_metadata?: JsonRecord | null; entity_name?: string | null; canonical_entity_id?: string | null },
  sourceRow: GraphitiOpportunitySourceRow,
  config = resolveGraphitiMemoryBridgeConfig(),
): Promise<GraphitiOpportunitySourceRow> {
  const rawMetadata = asRecord(ledgerRow.raw_metadata)
  const retrievalEnabled = toText(process.env.GRAPHITI_DOSSIER_MEMORY_RETRIEVAL).toLowerCase() !== '0'
  const syncStatus = toText(rawMetadata.graphiti_memory_sync_status)
  if (!retrievalEnabled || !config.mcpUrl || syncStatus !== 'synced') return sourceRow

  const queryText = [
    sourceRow.entity_name || ledgerRow.entity_name,
    sourceRow.title,
    'entity_dossiers Yellow Panther opportunity commercial evidence',
  ].map(toText).filter(Boolean).join(' ')

  if (!queryText) return sourceRow

  try {
    const response = await callGraphitiMcpTool(config, `search-facts:${sourceRow.insight_id}`, 'search_memory_facts', {
      query: queryText,
      group_ids: [toText(rawMetadata.graphiti_group_id) || config.groupId],
      max_facts: 8,
    })

    return {
      ...sourceRow,
      raw_payload: {
        ...(sourceRow.raw_payload || {}),
        graphiti_memory_evidence: response,
        graphiti_memory_retrieved_at: new Date().toISOString(),
      },
    }
  } catch (error) {
    return {
      ...sourceRow,
      raw_payload: {
        ...(sourceRow.raw_payload || {}),
        graphiti_memory_evidence: null,
        graphiti_memory_retrieval_error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      },
    }
  }
}
