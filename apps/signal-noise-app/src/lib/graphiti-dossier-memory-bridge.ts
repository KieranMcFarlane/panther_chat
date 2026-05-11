import crypto from 'node:crypto'
import { query as queryPostgres } from '@/lib/pg-client'
import type { GraphitiOpportunitySourceRow } from '@/lib/graphiti-opportunity-contract'
import { loadGraphitiRuntimeHealth } from '@/lib/graphiti-runtime-health.mjs'

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
  source: 'text'
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
  concurrency: number
  batchSize: number
  queueDelayMs: number
  retryAttempts: number
  retryBaseDelayMs: number
  payloadMode: 'minimal_text' | 'compact_json'
}

const MCP_PROTOCOL_VERSION = '2025-03-26'
const MCP_ACCEPT_HEADER = 'application/json, text/event-stream'
const MAX_GRAPHITI_FACTS = 3
const MAX_GRAPHITI_EVIDENCE_URLS = 3
const MAX_GRAPHITI_FACT_TEXT = 220

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function toInt(value: unknown, fallback = 0): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function positiveInt(value: unknown, fallback: number): number {
  const numeric = toInt(value, fallback)
  return numeric > 0 ? numeric : fallback
}

function truncateText(value: unknown, maxLength = MAX_GRAPHITI_FACT_TEXT): string {
  const text = toText(value).replace(/\s+/g, ' ')
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text
}

function isUsefulGraphitiFact(value: unknown): boolean {
  const fact = asRecord(value)
  const status = toText(fact.status).toLowerCase()
  const summary = truncateText(fact.summary)
  if (!summary) return false
  if (status === 'failed' || status === 'checked_no_signal' || status === 'skipped') return false
  if (summary.toLowerCase().includes('provider returned an object answer')) return false
  return true
}

async function sleep(ms: number) {
  if (ms <= 0) return
  await new Promise((resolve) => setTimeout(resolve, ms))
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
    timeoutMs: positiveInt(env.GRAPHITI_MEMORY_SYNC_TIMEOUT_MS, 120_000),
    concurrency: positiveInt(env.GRAPHITI_DOSSIER_MEMORY_SYNC_CONCURRENCY, 1),
    batchSize: positiveInt(env.GRAPHITI_MEMORY_SYNC_BATCH_SIZE, 1),
    queueDelayMs: positiveInt(env.GRAPHITI_MEMORY_SYNC_QUEUE_DELAY_MS, 60_000),
    retryAttempts: positiveInt(env.GRAPHITI_MEMORY_SYNC_RETRY_ATTEMPTS, 3),
    retryBaseDelayMs: positiveInt(env.GRAPHITI_MEMORY_SYNC_RETRY_BASE_DELAY_MS, 10_000),
    payloadMode: toText(env.GRAPHITI_MEMORY_PAYLOAD_MODE).toLowerCase() === 'compact_json' ? 'compact_json' : 'minimal_text',
  }
}

export async function loadGraphitiDossierMemoryCandidates(options: number | {
  limit?: number
  canonicalEntityId?: string | null
  sourceLedgerId?: string | null
} = 250): Promise<GraphitiDossierMemoryCandidate[]> {
  const limit = typeof options === 'number' ? options : Number(options.limit || 250)
  const canonicalEntityId = typeof options === 'number' ? '' : toText(options.canonicalEntityId)
  const sourceLedgerId = typeof options === 'number' ? '' : toText(options.sourceLedgerId)
  const scopedFilter = sourceLedgerId
    ? 'and i.id = $2::uuid'
    : canonicalEntityId
      ? 'and i.canonical_entity_id = $2'
      : ''
  const params = scopedFilter
    ? [Math.max(1, limit), sourceLedgerId || canonicalEntityId]
    : [Math.max(1, limit)]
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
        and coalesce(i.raw_metadata->>'graphiti_memory_sync_status', '') not in ('synced', 'queued')
        ${scopedFilter}
      order by
        case i.quality_state when 'client_ready' then 4 when 'complete' then 3 when 'partial' then 2 when 'blocked' then 1 else 0 end desc,
        coalesce(i.evidence_count, 0) desc,
        coalesce(i.answer_count, 0) desc,
        coalesce(i.source_generated_at, i.reference_time, i.updated_at) desc nulls last
      limit $1
    `,
    params,
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
  payloadMode: GraphitiMemoryBridgeConfig['payloadMode'] = 'minimal_text',
): GraphitiDossierMemoryPayload {
  const episode = buildCompactGraphitiDossierEpisode(row)

  return {
    name: `Entity dossier: ${row.entity_name} (${row.content_hash.slice(0, 10)})`,
    episode_body: payloadMode === 'compact_json'
      ? `Entity dossier memory payload for ${row.entity_name}:\n${JSON.stringify(episode)}`
      : buildMinimalGraphitiDossierMemoryText(row, episode),
    // Graphiti MCP streamable HTTP currently parses source='json' episode_body before validation.
    source: 'text',
    source_description: 'entity_dossiers',
    group_id: groupId,
    uuid: deterministicGraphitiEpisodeUuid(`${row.source_ledger_id}:${row.content_hash}`),
  }
}

export function buildMinimalGraphitiDossierMemoryText(
  row: GraphitiDossierMemoryCandidate,
  compactEpisode = buildCompactGraphitiDossierEpisode(row),
): string {
  const canonicalEntity = asRecord(compactEpisode.canonical_entity)
  const dossierQuality = asRecord(compactEpisode.dossier_quality)
  const graphitiSalesBrief = asRecord(compactEpisode.graphiti_sales_brief)
  const promotedSummary = asRecord(compactEpisode.promoted_summary)
  const selectedFacts = asArray(compactEpisode.question_facts).map(asRecord)
  const evidenceUrls = asArray(compactEpisode.evidence_urls).map(toText).filter(Boolean)
  const entityName = toText(canonicalEntity.name || row.entity_name)
  const entityType = toText(canonicalEntity.entity_type || row.entity_type) || 'unknown entity type'
  const sport = toText(canonicalEntity.sport) || 'unknown sport'
  const league = toText(canonicalEntity.league) || 'unknown league'
  const country = toText(canonicalEntity.country) || 'unknown country'
  const briefTitle = truncateText(graphitiSalesBrief.title || promotedSummary.title || '', 120)
  const commercialSignal = truncateText(graphitiSalesBrief.commercial_signal || promotedSummary.summary || '', 280)
  const factLines = selectedFacts
    .map((fact, index) => `${index + 1}. ${truncateText(fact.summary, MAX_GRAPHITI_FACT_TEXT)}`)
    .filter(Boolean)
  const evidenceLines = evidenceUrls.map((url, index) => `${index + 1}. ${url}`)

  return [
    `Compact entity dossier memory: ${entityName}`,
    `Source: entity_dossiers ledger ${row.source_ledger_id}`,
    `Canonical entity: ${entityName}; type: ${entityType}; sport: ${sport}; league: ${league}; country: ${country}.`,
    `Dossier quality: ${toText(dossierQuality.quality_state) || row.quality_state}; useful facts: ${row.answer_count}; evidence URLs: ${row.evidence_count}; reference time: ${row.reference_time || 'unknown'}.`,
    briefTitle ? `Signal title: ${briefTitle}` : '',
    commercialSignal ? `Commercial signal: ${commercialSignal}` : '',
    `Facts:${selectedFacts.length ? `\n${factLines.join('\n')}` : ' none selected for graph memory.'}`,
    `Evidence URLs:${evidenceLines.length ? `\n${evidenceLines.join('\n')}` : ' none selected for graph memory.'}`,
    'Use this memory only as supporting dossier context for later opportunity reasoning.',
  ].filter(Boolean).join('\n')
}

export function buildCompactGraphitiDossierEpisode(row: GraphitiDossierMemoryCandidate): JsonRecord {
  const body = asRecord(row.episode_body)
  const dossier = asRecord(body.dossier)
  const entity = asRecord(body.entity)
  const selectedFacts = asArray(body.question_facts)
    .filter(isUsefulGraphitiFact)
    .slice(0, MAX_GRAPHITI_FACTS)
    .map((value) => {
      const fact = asRecord(value)
      return {
        question_id: toText(fact.question_id),
        question_type: toText(fact.question_type),
        status: toText(fact.status),
        confidence: toInt(fact.confidence),
        summary: truncateText(fact.summary),
        evidence_urls: asArray(fact.evidence_urls)
          .map(toText)
          .filter(Boolean)
          .slice(0, 3),
      }
    })
  const evidenceUrls = asArray(body.evidence_urls)
    .map(toText)
    .filter(Boolean)
    .slice(0, MAX_GRAPHITI_EVIDENCE_URLS)

  return {
    source: 'entity_dossiers',
    source_ledger_id: row.source_ledger_id,
    content_hash: row.content_hash,
    canonical_entity_id: row.canonical_entity_id,
    canonical_entity: row.canonical_entity,
    entity: {
      entity_id: toText(entity.entity_id || row.canonical_entity_id),
      entity_name: toText(entity.entity_name || row.entity_name),
      entity_type: toText(entity.entity_type || row.entity_type),
    },
    dossier_quality: {
      quality_state: toText(dossier.quality_state) || row.quality_state,
      useful_fact_count: row.answer_count,
      evidence_count: row.evidence_count,
      raw_answer_count: toInt(dossier.raw_answer_count),
      reference_time: row.reference_time || toText(body.reference_time),
    },
    graphiti_sales_brief: asRecord(body.graphiti_sales_brief),
    promoted_summary: asRecord(body.promoted_summary),
    question_facts: selectedFacts,
    evidence_urls: evidenceUrls,
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

function isTransientGraphitiRateLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('429')
    && (
      message.includes("code':'1305")
      || message.includes('"code":"1305"')
      || message.includes("code': '1305")
      || message.includes('"code": "1305"')
      || message.includes('temporarily overloaded')
      || message.includes('Rate limit exceeded')
    )
}

async function postGraphitiJsonWithRetry(
  url: string,
  body: unknown,
  config: GraphitiMemoryBridgeConfig,
  options: { sessionId?: string } = {},
): Promise<{ payload: unknown; sessionId: string }> {
  let attempt = 0
  let lastError: unknown
  while (attempt < config.retryAttempts) {
    try {
      return await postGraphitiJson(url, body, config.timeoutMs, options)
    } catch (error) {
      lastError = error
      attempt += 1
      if (!isTransientGraphitiRateLimit(error) || attempt >= config.retryAttempts) {
        throw error
      }
      await sleep(config.retryBaseDelayMs * attempt)
    }
  }

  throw lastError
}

async function postJson(url: string, body: unknown, config: GraphitiMemoryBridgeConfig): Promise<unknown> {
  return (await postGraphitiJsonWithRetry(url, body, config)).payload
}

async function initializeGraphitiMcpSession(config: GraphitiMemoryBridgeConfig): Promise<string> {
  const initialized = await postGraphitiJsonWithRetry(config.mcpUrl, {
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
  }, config)

  if (!initialized.sessionId) {
    throw new Error('Graphiti MCP initialize did not return an mcp-session-id')
  }

  await postGraphitiJsonWithRetry(config.mcpUrl, {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {},
  }, config, { sessionId: initialized.sessionId })

  return initialized.sessionId
}

async function callGraphitiMcpTool(
  config: GraphitiMemoryBridgeConfig,
  id: string,
  name: string,
  args: JsonRecord,
): Promise<unknown> {
  const sessionId = await initializeGraphitiMcpSession(config)
  const response = (await postGraphitiJsonWithRetry(config.mcpUrl, {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: {
      name,
      arguments: args,
    },
  }, config, { sessionId })).payload
  assertGraphitiMcpToolSuccess(name, response)
  return response
}

function assertGraphitiMcpToolSuccess(name: string, response: unknown) {
  const payload = asRecord(response)
  const result = asRecord(payload.result)
  if (result.isError !== true) return

  const content = Array.isArray(result.content) ? result.content : []
  const message = content
    .map((item) => toText(asRecord(item).text))
    .filter(Boolean)
    .join(' ')
    || JSON.stringify(response).slice(0, 500)
  throw new Error(`Graphiti MCP tool ${name} failed: ${message.slice(0, 500)}`)
}

function toGraphitiMcpAddMemoryArgs(payload: GraphitiDossierMemoryPayload): JsonRecord {
  const { uuid: _graphitiEpisodeUuid, ...mcpArgs } = payload
  return mcpArgs
}

async function callGraphitiAddMemory(payload: GraphitiDossierMemoryPayload, config: GraphitiMemoryBridgeConfig): Promise<unknown> {
  if (config.directIngestUrl) {
    return postJson(config.directIngestUrl, payload, config)
  }

  if (!config.mcpUrl) {
    throw new Error('Graphiti memory sync is enabled but GRAPHITI_MEMORY_INGEST_URL or GRAPHITI_MCP_URL is not configured')
  }

  return callGraphitiMcpTool(config, payload.uuid, 'add_memory', toGraphitiMcpAddMemoryArgs(payload))
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
  canonicalEntityId?: string | null
  sourceLedgerId?: string | null
} = {}) {
  const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 250
  const dryRun = options.dryRun === true
  const config = options.config || resolveGraphitiMemoryBridgeConfig()
  const requestedConcurrency = Number.isFinite(Number(options.concurrency)) ? Number(options.concurrency) : config.concurrency
  const concurrency = Math.max(1, Math.min(requestedConcurrency, config.concurrency))
  const candidates = await loadGraphitiDossierMemoryCandidates({
    limit: Math.min(limit, config.batchSize),
    canonicalEntityId: options.canonicalEntityId,
    sourceLedgerId: options.sourceLedgerId,
  })

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

  const runtimeHealth = await loadGraphitiRuntimeHealth()
  if (!runtimeHealth.falkordb_graph_available || !runtimeHealth.graphiti_mcp_available) {
    return {
      status: 'degraded',
      reason: runtimeHealth.graphiti_degraded_reason || 'graphiti_mcp_unavailable',
      candidate_count: candidates.length,
      synced_count: 0,
      failed_count: 0,
      dry_run: false,
      skipped: true,
      graphiti_runtime_health: runtimeHealth,
      warnings: [
        `graphiti_memory_sync.status = "degraded": ${runtimeHealth.graphiti_degraded_reason || 'falkordb_graph_unavailable'}`,
      ],
    }
  }

  let synced = 0
  let queued = 0
  let failed = 0
  const errors: Array<{ source_ledger_id: string; error: string }> = []

  await runWithConcurrency(candidates, concurrency, async (row) => {
    const payload = buildGraphitiDossierMemoryPayload(row, config.groupId, config.payloadMode)
    try {
      const response = await callGraphitiAddMemory(payload, config)
      await markGraphitiMemorySync(row, {
        graphiti_memory_sync_status: 'queued',
        graphiti_memory_queued_at: new Date().toISOString(),
        graphiti_episode_uuid: payload.uuid,
        graphiti_group_id: payload.group_id,
        graphiti_memory_response: response,
      })
      queued += 1
      await sleep(config.queueDelayMs)
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
    queued_count: queued,
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
