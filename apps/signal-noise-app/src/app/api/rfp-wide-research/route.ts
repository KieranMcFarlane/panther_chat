import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase-client'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { linkOpportunityToCanonicalEntity } from '@/lib/opportunity-entity-linking'
import { normalizeOpportunityTaxonomy } from '@/lib/opportunity-taxonomy.mjs'
import { searchGraphitiEntities, syncWideRfpBatchToGraphiti } from '@/lib/rfp-graphiti-bridge'
import {
  DEFAULT_WIDE_RFP_FOCUS_AREA,
  buildWideRfpResearchPrompt,
  getDefaultWideRfpSeedQuery,
  normalizeWideRfpResearchBatch,
} from '@/lib/rfp-wide-research.mjs'
import { loadLatestWideRfpResearchBatch, loadWideRfpDeltaMemoryPack, persistWideRfpResearchBatch } from '@/lib/rfp-wide-research-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ManusResearchRequest = {
  seedQuery?: string
  focusArea?: string
  currentRfpPage?: string
  currentIntakePage?: string
  prompt?: string
  outputDir?: string
  targetYear?: number | string | null
  researchMode?: 'live' | 'backtest'
  deltaMemory?: Record<string, unknown>
  hardExcludedCanonicalEntityIds?: string[]
  maxKnownUrls?: number | string | null
  researchDepth?: 'safe' | 'standard' | 'deep'
  excludeNames?: string[]
  manusTaskId?: string
}

type ManusResearchResponse = {
  run_id?: string
  source?: string
  prompt?: string
  generated_at?: string
  opportunities?: any[]
  entity_actions?: any[]
  prompt_execution_metadata?: Record<string, unknown>
  data?: {
    opportunities?: any[]
    entity_actions?: any[]
    prompt_execution_metadata?: Record<string, unknown>
  }
}

type ParsedManusPayload = ManusResearchResponse | any[] | null

type ManusTaskResponse = {
  id?: string
  task_id?: string
  status?: string
  output?: Array<{
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
  result?: unknown
  result_text?: string
  error?: string
  message?: string
  task_url?: string
  credit_usage?: number
  agent_profile?: string
  metadata?: Record<string, unknown>
  prompt_execution_metadata?: Record<string, unknown>
}

type ManusTaskListItem = {
  id?: string
  task_id?: string
  status?: string
  task_url?: string
  credit_usage?: number
  agent_profile?: string
}

type ManusTaskListResponse = {
  tasks?: ManusTaskListItem[]
  data?: ManusTaskListItem[] | { tasks?: ManusTaskListItem[] }
  error?: string | { code?: string; message?: string }
  message?: string
}

type ManusV2Message = {
  type?: string
  assistant_message?: {
    content?: string
  }
  error_message?: {
    error_type?: string
    content?: string
  }
  status_update?: {
    agent_status?: string
  }
  structured_output_result?: {
    success?: boolean
    value?: unknown
    error?: string
  }
}

type ManusV2MessagesResponse = {
  ok?: boolean
  task_id?: string
  messages?: ManusV2Message[]
  error?: string | { code?: string; message?: string }
  message?: string
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function unixSecondsToIso(value: unknown): string | null {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const date = new Date(numeric * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function slugify(value: string): string {
  return toText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'entity'
}

function normalizeCanonicalName(value: string): string {
  return toText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'unknown organization'
}

function inferEntityType(opportunity: any): string {
  const source = [
    opportunity?.entity_name,
    opportunity?.organization,
    opportunity?.category,
    opportunity?.title,
    opportunity?.description,
  ]
    .map(toText)
    .join(' ')
    .toLowerCase()

  if (source.includes('federation')) return 'federation'
  if (source.includes('league')) return 'league'
  if (source.includes('club') || source.includes('team')) return 'club'
  if (source.includes('government') || source.includes('council')) return 'government'
  return 'organization'
}

function inferOpportunitySport(opportunity: any): string {
  const source = [
    opportunity?.sport,
    opportunity?.organization,
    opportunity?.entity_name,
    opportunity?.category,
    opportunity?.title,
    opportunity?.description,
  ]
    .map(toText)
    .join(' ')
    .toLowerCase()

  if (source.includes('cricket')) return 'cricket'
  if (source.includes('football') || source.includes('soccer') || source.includes('fifa')) return 'football'
  if (source.includes('athletics') || source.includes('track')) return 'athletics'
  if (source.includes('skate')) return 'skating'
  if (source.includes('aquatics') || source.includes('swim')) return 'aquatics'
  if (source.includes('volleyball')) return 'volleyball'
  if (source.includes('hockey')) return 'hockey'
  if (source.includes('archery')) return 'archery'
  if (source.includes('polo')) return 'polo'
  if (source.includes('esport')) return 'esports'
  return 'sports'
}

function extractManusBatch(payload: ManusResearchResponse) {
  const candidate = payload?.data || payload || {}
  const batchMetadata = isRecord(candidate.batch_metadata) ? candidate.batch_metadata : {}
  return {
    run_id: toText(candidate.run_id || payload.run_id || batchMetadata.sweep_id) || `wide-rfp-${Date.now()}`,
    source: toText(candidate.source || payload.source) || 'manus',
    prompt: toText(candidate.prompt || payload.prompt),
    generated_at: toText(candidate.generated_at || payload.generated_at || batchMetadata.executed_at || payload.task_updated_at),
    prompt_execution_metadata: {
      ...(isRecord(batchMetadata) ? batchMetadata : {}),
      ...(isRecord(payload.prompt_execution_metadata) ? payload.prompt_execution_metadata : {}),
      ...(isRecord(candidate.prompt_execution_metadata) ? candidate.prompt_execution_metadata : {}),
    },
    opportunities: Array.isArray(candidate.opportunities) ? candidate.opportunities : Array.isArray(payload.opportunities) ? payload.opportunities : [],
    entity_actions: Array.isArray(candidate.entity_actions) ? candidate.entity_actions : Array.isArray(payload.entity_actions) ? payload.entity_actions : [],
  }
}

function collectTaskText(task: ManusTaskResponse): string {
  const chunks: string[] = []

  for (const message of task?.output || []) {
    for (const part of message?.content || []) {
      if (part?.text) {
        chunks.push(part.text)
      }
    }
  }

  if (task?.result_text) {
    chunks.push(task.result_text)
  }

  return chunks.join('\n').trim()
}

function collectV2MessageText(messages: ManusV2Message[]): string {
  return messages
    .map((message) => toText(message?.assistant_message?.content))
    .filter(Boolean)
    .join('\n')
    .trim()
}

function extractV2StructuredOutput(messages: ManusV2Message[]): ManusResearchResponse | null {
  const structuredMessage = messages.find((message) => (
    message?.type === 'structured_output_result' &&
    isRecord(message.structured_output_result.value)
  ))

  return structuredMessage?.structured_output_result?.value as ManusResearchResponse | null
}

function parseTaskPayload(raw: string): ParsedManusPayload {
  if (!raw.trim()) return null

  try {
    return JSON.parse(raw)
  } catch {
    const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i) || raw.match(/```\s*([\s\S]*?)\s*```/i)
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim())
      } catch {
        // fall through
      }
    }

    const firstObject = raw.match(/\{[\s\S]*\}/)
    if (firstObject?.[0]) {
      try {
        return JSON.parse(firstObject[0])
      } catch {
        // fall through
      }
    }
  }

  return null
}

function normalizeParsedTaskPayload(parsed: ParsedManusPayload): ManusResearchResponse | null {
  if (!parsed) return null
  if (Array.isArray(parsed)) {
    return {
      source: 'manus',
      prompt_execution_metadata: {
        provider_output_format: 'scheduled_json_array',
      },
      opportunities: parsed,
      entity_actions: [],
    }
  }
  return parsed
}

function cleanNarrativeUrl(value: string): string {
  return toText(value)
    .replace(/[),.;\]\s]+$/g, '')
    .replace(/^["'(<\[]+|["')>\]]+$/g, '')
}

function extractNarrativeSourceUrls(rawText: string): string[] {
  const urls = new Set<string>()

  for (const match of rawText.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    const url = cleanNarrativeUrl(match[0])
    if (!url) continue

    try {
      const parsed = new URL(url)
      const host = parsed.hostname.toLowerCase()
      if (host.includes('manus.ai') || host === 'localhost' || host === '127.0.0.1') continue
      urls.add(parsed.toString())
    } catch {
      // Ignore malformed narrative fragments.
    }
  }

  return Array.from(urls).slice(0, 20)
}

function getNarrativeLineForUrl(rawText: string, sourceUrl: string): string {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const exact = lines.find((line) => line.includes(sourceUrl))
  if (exact) return exact

  const host = getHostname(sourceUrl)
  return lines.find((line) => host && line.includes(host)) || ''
}

function getHostname(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function titleCase(value: string): string {
  return toText(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function inferNarrativeOrganization(sourceUrl: string, contextLine: string): string {
  const line = contextLine.replace(sourceUrl, '').trim()
  const organizationMatch = line.match(/\b(?:organization|entity|for|by|from)\s*[:\-]\s*([^|.;,]{3,80})/i)
  if (organizationMatch?.[1]) return titleCase(organizationMatch[1])

  const host = getHostname(sourceUrl)
  const domainName = host.split('.').filter((part) => !['com', 'org', 'net', 'edu', 'gov', 'co', 'uk', 'ca', 'au', 'in'].includes(part)).at(0)
  return titleCase(domainName || host || 'Unknown organization')
}

function inferNarrativeTitle(sourceUrl: string, contextLine: string, organization: string): string {
  const withoutUrl = contextLine.replace(sourceUrl, '').replace(/^[\s\-*•:]+|[\s\-*•:]+$/g, '').trim()
  const usableLine = withoutUrl.length >= 8 && withoutUrl.length <= 160 ? withoutUrl : ''
  if (usableLine) return usableLine
  return `${organization} digital opportunity`
}

function inferNarrativeCategory(source: string): string {
  const lower = source.toLowerCase()
  if (/\bcrm|martech|email|segmentation\b/.test(lower)) return 'crm'
  if (/\bsocial media|content|video|stream|livestream\b/.test(lower)) return 'content_and_social'
  if (/\bdata|analytics|dashboard|platform|portal|app|dxp\b/.test(lower)) return 'digital_platform'
  if (/\bwebsite|cms|web\b/.test(lower)) return 'website_redesign'
  return 'digital_opportunity'
}

function inferNarrativeDeadline(source: string): string | null {
  const iso = source.match(/\b20\d{2}-\d{2}-\d{2}\b/)
  if (iso?.[0]) return iso[0]

  const dateLike = source.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+20\d{2}\b/i)
  return dateLike?.[0] || null
}

function normalizeNarrativeTaskPayload(
  rawText: string,
  payload: ManusTaskResponse,
  promptExecutionMetadata: Record<string, unknown>,
): ManusResearchResponse | null {
  const sourceUrls = extractNarrativeSourceUrls(rawText)
  if (sourceUrls.length === 0) return null

  const opportunities = sourceUrls.map((sourceUrl, index) => {
    const contextLine = getNarrativeLineForUrl(rawText, sourceUrl)
    const organization = inferNarrativeOrganization(sourceUrl, contextLine)
    const title = inferNarrativeTitle(sourceUrl, contextLine, organization)
    const category = inferNarrativeCategory(`${title} ${contextLine} ${sourceUrl}`)
    const deadline = inferNarrativeDeadline(contextLine)

    return {
      id: `narrative-recovered-${index + 1}-${slugify(title || organization)}`,
      title,
      organization,
      source_url: sourceUrl,
      confidence: 0.45,
      yellow_panther_fit: 45,
      entity_name: organization,
      canonical_entity_name: organization,
      category,
      status: 'review_required',
      deadline,
      description: contextLine
        ? `Recovered from Manus narrative; verify source before outreach. Evidence line: ${contextLine.slice(0, 260)}`
        : 'Recovered from Manus narrative; verify source before outreach.',
      metadata: {
        source_type: 'narrative_recovery',
        evidence: [sourceUrl],
        digital_fit_rationale: 'Recovered from Manus narrative because the task did not return structured JSON. Requires operator verification before qualification.',
        delta_reason: 'Recovered from a source URL in unstructured Manus narration; duplicate checks still run during persistence.',
        temporal_basis: deadline ? `Deadline/date found in narrative context: ${deadline}` : 'Unknown from narrative; verify source.',
        normalization_status: 'review_required',
        provider_output_format: 'narrative',
      },
    }
  })

  return {
    run_id: toText(payload.id || payload.task_id) || `wide-rfp-${Date.now()}`,
    source: 'manus',
    prompt: rawText,
    generated_at: unixSecondsToIso((payload as any).updated_at) || new Date().toISOString(),
    prompt_execution_metadata: {
      ...promptExecutionMetadata,
      provider_output_format: 'narrative',
      narrative_recovery_used: true,
      narrative_recovered_opportunity_count: opportunities.length,
      normalization_warning: 'review_required_source_linked_narrative_recovery',
    },
    opportunities,
    entity_actions: [],
  }
}

async function normalizeTaskResponse(payload: ManusTaskResponse): Promise<ManusResearchResponse> {
  const rawText = collectTaskText(payload)
  const parsed = normalizeParsedTaskPayload(parseTaskPayload(rawText) || await parseTaskOutputFilePayload(payload))
  const promptExecutionMetadata = {
    ...extractManusTaskMetadata(payload),
    ...(isRecord(payload.prompt_execution_metadata) ? payload.prompt_execution_metadata : {}),
  }

  if (parsed) {
    return {
      ...parsed,
      run_id: toText(parsed.run_id) || toText(payload.id || payload.task_id) || `wide-rfp-${Date.now()}`,
      generated_at: toText(parsed.generated_at) || unixSecondsToIso(payload.updated_at) || new Date().toISOString(),
      prompt_execution_metadata: {
        ...(isRecord(parsed.prompt_execution_metadata) ? parsed.prompt_execution_metadata : {}),
        ...promptExecutionMetadata,
      },
    }
  }

  const narrativeRecovered = normalizeNarrativeTaskPayload(rawText, payload, promptExecutionMetadata)
  if (narrativeRecovered) {
    return narrativeRecovered
  }

  return {
    run_id: toText(payload.id || payload.task_id) || `wide-rfp-${Date.now()}`,
    source: 'manus',
    prompt: rawText,
    prompt_execution_metadata: promptExecutionMetadata,
    opportunities: [],
    entity_actions: [],
  }
}

async function parseTaskOutputFilePayload(payload: ManusTaskResponse): Promise<ParsedManusPayload> {
  for (const message of payload?.output || []) {
    for (const part of message?.content || []) {
      const fileUrl = toText(part?.fileUrl || part?.file_url || part?.url)
      const fileName = toText(part?.fileName || part?.file_name || part?.filename)
      const mimeType = toText(part?.mimeType || part?.mime_type)
      const isJsonFile = fileUrl && (
        fileName.toLowerCase().endsWith('.json') ||
        mimeType.toLowerCase().includes('json')
      )
      if (!isJsonFile) continue

      try {
        const response = await fetch(fileUrl, { cache: 'no-store' })
        const raw = await response.text()
        if (!response.ok) continue
        const parsed = parseTaskPayload(raw)
        if (parsed) return parsed
      } catch {
        // Try the next attached file if Manus returned a stale signed URL.
      }
    }
  }

  return null
}

function extractManusTaskMetadata(task: ManusTaskResponse): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  const taskId = toText(task?.id || task?.task_id)
  const taskUrl = toText(task?.task_url || task?.metadata?.task_url)
  const agentProfile = toText(task?.agent_profile)
  const creditUsage = Number(task?.credit_usage)

  if (taskId) metadata.manus_task_id = taskId
  if (taskUrl) metadata.manus_task_url = taskUrl
  if (Number.isFinite(creditUsage)) metadata.manus_credit_usage = creditUsage
  if (agentProfile) metadata.manus_agent_profile = agentProfile

  return metadata
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getManusRfpMaxPollAttempts(): number {
  return normalizePositiveInt(process.env.MANUS_RFP_MAX_POLL_ATTEMPTS, 36)
}

function getManusRfpMaxCredits(): number {
  return normalizePositiveInt(process.env.MANUS_RFP_MAX_CREDITS, 160)
}

function getManusRfpFinalizeAfterCredits(): number {
  return normalizePositiveInt(process.env.MANUS_RFP_FINALIZE_AFTER_CREDITS, 40)
}

function getManusRfpFinalizeAfterAttempts(): number {
  return normalizePositiveInt(process.env.MANUS_RFP_FINALIZE_AFTER_ATTEMPTS, 4)
}

async function waitForManusTask(
  taskId: string,
  manusApi: string,
  maxAttempts = getManusRfpMaxPollAttempts(),
  intervalMs = 5000,
  maxCredits = getManusRfpMaxCredits(),
  finalizeAfterCredits = getManusRfpFinalizeAfterCredits(),
  finalizeAfterAttempts = getManusRfpFinalizeAfterAttempts(),
): Promise<ManusTaskResponse> {
  let finalizationRequested = false
  let latestMessages: ManusV2Message[] = []
  let latestMetadata: Record<string, unknown> = {}

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const url = new URL('https://api.manus.ai/v2/task.listMessages')
    url.searchParams.set('task_id', taskId)
    url.searchParams.set('order', 'desc')
    url.searchParams.set('limit', '100')
    url.searchParams.set('verbose', 'true')

    const response = await fetch(url, {
      headers: {
        'x-manus-api-key': manusApi,
        Accept: 'application/json',
      },
    })

    const payload = (await response.json().catch(() => null)) as ManusV2MessagesResponse | null
    if (!response.ok) {
      const message = getManusErrorMessage(payload) || `Manus task poll failed with ${response.status}`
      if (isRetryableManusPollError(message) && attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
        continue
      }
      throw new Error(message)
    }

    const messages = Array.isArray(payload?.messages) ? payload.messages : []
    latestMessages = messages
    const errorMessage = messages.find((message) => message?.type === 'error_message')
    if (errorMessage?.error_message?.content) {
      throw new Error(errorMessage.error_message.content)
    }

    const structuredNow = extractV2StructuredOutput(messages)
    if (structuredNow) {
      return {
        id: taskId,
        task_id: taskId,
        status: 'completed',
        result_text: JSON.stringify(structuredNow),
        prompt_execution_metadata: {
          ...latestMetadata,
          manus_completion_state: 'structured_output_result',
        },
      }
    }

    const taskSummary = await fetchManusTaskSummary(taskId, manusApi).catch(() => null)
    if (taskSummary) {
      latestMetadata = {
        ...latestMetadata,
        ...extractManusTaskMetadata({
          id: taskSummary.id,
          task_id: taskSummary.task_id,
          task_url: taskSummary.task_url,
          credit_usage: taskSummary.credit_usage,
          agent_profile: taskSummary.agent_profile,
        }),
      }
    }

    const status = toText(messages.find((message) => message?.type === 'status_update')?.status_update?.agent_status).toLowerCase()
    if (status === 'stopped') {
      const structured = extractV2StructuredOutput(messages)
      const rawText = structured ? JSON.stringify(structured) : collectV2MessageText(messages)
      return {
        id: taskId,
        task_id: taskId,
        status: 'completed',
        result_text: rawText,
        prompt_execution_metadata: {
          ...latestMetadata,
          manus_completion_state: structured ? 'structured_output_result' : 'stopped_without_structured_output',
        },
      }
    }
    if (status === 'error') {
      throw new Error('Manus task failed with agent_status=error')
    }

    const creditUsage = Number(taskSummary?.credit_usage)
    const creditLimitReached = Number.isFinite(creditUsage) && creditUsage >= maxCredits
    const finalizeCreditReached = Number.isFinite(creditUsage) && creditUsage >= finalizeAfterCredits
    const finalizeAttemptReached = attempt >= Math.min(Math.max(0, finalizeAfterAttempts), Math.max(0, maxAttempts - 2))
    const nearPollLimit = attempt >= Math.max(0, maxAttempts - 3)
    if (!finalizationRequested && (finalizeCreditReached || finalizeAttemptReached || creditLimitReached || nearPollLimit)) {
      await sendManusFinalizeMessage(taskId, manusApi)
      finalizationRequested = true
      latestMetadata = {
        ...latestMetadata,
        manus_finalization_requested: true,
        manus_finalization_reason: finalizeCreditReached || creditLimitReached ? 'credit_threshold' : 'poll_threshold',
      }
    } else if (finalizationRequested && creditLimitReached) {
      await stopManusTask(taskId, manusApi)
      const structured = extractV2StructuredOutput(latestMessages)
      const rawText = structured ? JSON.stringify(structured) : collectV2MessageText(latestMessages)
      return {
        id: taskId,
        task_id: taskId,
        status: 'stopped',
        result_text: rawText,
        prompt_execution_metadata: {
          ...latestMetadata,
          manus_stopped_by_route: true,
          manus_stop_reason: 'credit_limit',
        },
      }
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  await stopManusTask(taskId, manusApi)
  return {
    id: taskId,
    task_id: taskId,
    status: 'stopped',
    result_text: collectV2MessageText(latestMessages),
    prompt_execution_metadata: {
      ...latestMetadata,
      manus_stopped_by_route: true,
      manus_stop_reason: 'poll_limit',
    },
  }
}

function isRetryableManusPollError(message: string): boolean {
  return /Task not found|task not found/i.test(message)
}

async function fetchManusTaskSummary(taskId: string, manusApi: string): Promise<ManusTaskListItem | null> {
  const url = new URL('https://api.manus.ai/v2/task.list')
  url.searchParams.set('limit', '20')
  url.searchParams.set('order', 'desc')

  const response = await fetch(url, {
    headers: {
      'x-manus-api-key': manusApi,
      Accept: 'application/json',
    },
  })
  const payload = (await response.json().catch(() => null)) as ManusTaskListResponse | null
  if (!response.ok) return null

  const data = payload?.data
  const tasks = Array.isArray(payload?.tasks)
    ? payload.tasks
    : Array.isArray(data)
      ? data
      : isRecord(data) && Array.isArray(data.tasks)
        ? data.tasks
        : []

  return tasks.find((task) => toText(task?.id || task?.task_id) === taskId) || null
}

async function sendManusFinalizeMessage(taskId: string, manusApi: string): Promise<void> {
  await fetch('https://api.manus.ai/v2/task.sendMessage', {
    method: 'POST',
    headers: {
      'x-manus-api-key': manusApi,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      task_id: taskId,
      message: {
        content: [
          {
            type: 'text',
            text: [
              'Return the best qualified opportunities found so far as normalized JSON only.',
              'Do not continue browsing. Do not narrate progress.',
              'If fewer than 5 qualified opportunities are available, return the qualified subset.',
              'If no qualified opportunities are available, return a valid JSON object with empty opportunities and prompt_execution_metadata explaining the checked absence.',
            ].join(' '),
          },
        ],
      },
    }),
  }).catch(() => undefined)
}

async function stopManusTask(taskId: string, manusApi: string): Promise<void> {
  await fetch('https://api.manus.ai/v2/task.stop', {
    method: 'POST',
    headers: {
      'x-manus-api-key': manusApi,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ task_id: taskId }),
  }).catch(() => undefined)
}

async function waitForManusV1Task(
  taskId: string,
  manusApi: string,
  maxAttempts = getManusRfpMaxPollAttempts(),
  intervalMs = 5000,
  maxCredits = getManusRfpMaxCredits(),
  finalizeAfterCredits = getManusRfpFinalizeAfterCredits(),
  finalizeAfterAttempts = getManusRfpFinalizeAfterAttempts(),
): Promise<ManusTaskResponse> {
  let latestPayload: ManusTaskResponse | null = null
  let finalizationRequested = false

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`https://api.manus.ai/v1/tasks/${encodeURIComponent(taskId)}`, {
      headers: {
        API_KEY: manusApi,
        Accept: 'application/json',
      },
    })
    const payload = (await response.json().catch(() => null)) as ManusTaskResponse | null
    latestPayload = payload

    if (!response.ok) {
      const message = getManusErrorMessage(payload) || `Manus v1 task poll failed with ${response.status}`
      if (isRetryableManusPollError(message) && attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
        continue
      }
      throw new Error(message)
    }

    const status = toText(payload?.status).toLowerCase()
    if (status === 'completed' || status === 'succeeded') {
      return {
        ...(payload || {}),
        id: toText(payload?.id || payload?.task_id) || taskId,
        task_id: toText(payload?.task_id || payload?.id) || taskId,
        status: 'completed',
        task_url: toText(payload?.task_url || payload?.metadata?.task_url),
        prompt_execution_metadata: {
          ...(isRecord(payload?.prompt_execution_metadata) ? payload.prompt_execution_metadata : {}),
          manus_api_version: 'v1_fallback',
          manus_completion_state: 'v1_task_completed',
        },
      }
    }

    if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
      throw new Error(getManusErrorMessage(payload) || `Manus v1 task failed with status=${status}`)
    }

    const creditUsage = Number(payload?.credit_usage)
    const creditLimitReached = Number.isFinite(creditUsage) && creditUsage >= maxCredits
    const finalizeCreditReached = Number.isFinite(creditUsage) && creditUsage >= finalizeAfterCredits
    const finalizeAttemptReached = attempt >= Math.min(Math.max(0, finalizeAfterAttempts), Math.max(0, maxAttempts - 2))
    const nearPollLimit = attempt >= Math.max(0, maxAttempts - 3)
    if (!finalizationRequested && (finalizeCreditReached || finalizeAttemptReached || creditLimitReached || nearPollLimit)) {
      await sendManusFinalizeMessage(taskId, manusApi)
      finalizationRequested = true
      latestPayload = {
        ...(payload || {}),
        prompt_execution_metadata: {
          ...(isRecord(payload?.prompt_execution_metadata) ? payload.prompt_execution_metadata : {}),
          manus_v1_finalization_requested: true,
          manus_finalization_reason: finalizeCreditReached || creditLimitReached ? 'credit_threshold' : 'poll_threshold',
        },
      }
    } else if (finalizationRequested && creditLimitReached) {
      await stopManusTask(taskId, manusApi)
      return {
        ...(payload || {}),
        id: toText(payload?.id || payload?.task_id) || taskId,
        task_id: toText(payload?.task_id || payload?.id) || taskId,
        status: 'stopped',
        task_url: toText(payload?.task_url || payload?.metadata?.task_url),
        prompt_execution_metadata: {
          ...(isRecord(payload?.prompt_execution_metadata) ? payload.prompt_execution_metadata : {}),
          manus_api_version: 'v1_fallback',
          manus_v1_finalization_requested: true,
          manus_stopped_by_route: true,
          manus_stop_reason: 'credit_limit',
        },
      }
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  await stopManusTask(taskId, manusApi)
  return {
    ...(latestPayload || {}),
    id: toText(latestPayload?.id || latestPayload?.task_id) || taskId,
    task_id: toText(latestPayload?.task_id || latestPayload?.id) || taskId,
    status: toText(latestPayload?.status) || 'timeout',
    task_url: toText(latestPayload?.task_url || latestPayload?.metadata?.task_url),
    prompt_execution_metadata: {
      ...(isRecord(latestPayload?.prompt_execution_metadata) ? latestPayload.prompt_execution_metadata : {}),
      manus_api_version: 'v1_fallback',
      manus_completion_state: 'v1_poll_limit',
      manus_stopped_by_route: true,
      manus_stop_reason: 'poll_limit',
    },
  }
}

async function callManusV1FallbackApi(prompt: string, manusApi: string, fallbackReason: string): Promise<ManusResearchResponse> {
  const response = await fetch('https://api.manus.ai/v1/tasks', {
    method: 'POST',
    headers: {
      API_KEY: manusApi,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      prompt,
      taskMode: 'agent',
      agentProfile: 'quality',
      hideInTaskList: true,
    }),
  })

  const createPayload = (await response.json().catch(() => null)) as ManusTaskResponse | null
  if (!response.ok) {
    throw new Error(getManusErrorMessage(createPayload) || `Manus v1 fallback request failed with ${response.status}`)
  }

  const taskId = toText(createPayload?.id || createPayload?.task_id)
  if (!taskId) {
    throw new Error('Manus v1 fallback task creation did not return a task id.')
  }

  const completedTask = await waitForManusV1Task(taskId, manusApi)
  if (toText(completedTask.status).toLowerCase() !== 'completed') {
    throw new Error(`Manus v1 fallback task did not complete before the poll limit. Task: ${taskId}`)
  }
  completedTask.task_url = toText(createPayload?.task_url || createPayload?.metadata?.task_url || completedTask.task_url)
  completedTask.agent_profile = toText(completedTask.agent_profile) || 'quality'
  completedTask.prompt_execution_metadata = {
    ...(isRecord(completedTask.prompt_execution_metadata) ? completedTask.prompt_execution_metadata : {}),
    manus_api_version: 'v1_fallback',
    manus_fallback_reason: fallbackReason,
  }

  const manuscript = await normalizeTaskResponse(completedTask)
  return manuscript?.opportunities?.length || manuscript?.entity_actions?.length
    ? manuscript
    : { ...manuscript, prompt, source: 'manus' }
}

async function callManusApi(prompt: string): Promise<ManusResearchResponse> {
  const manusApi = toText(process.env.MANUS_API)
  if (!manusApi) {
    throw new Error('MANUS_API is not configured. Set MANUS_API in .env before running wide research.')
  }

  const response = await fetch('https://api.manus.ai/v2/task.create', {
    method: 'POST',
    headers: {
      'x-manus-api-key': manusApi,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      message: {
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
      agent_profile: 'manus-1.6-max',
      interactive_mode: false,
      hide_in_task_list: true,
      title: 'Yellow Panther RFP Scout',
    }),
  })

  const createPayload = (await response.json().catch(() => null)) as ManusTaskResponse | null

  if (!response.ok) {
    const message = getManusErrorMessage(createPayload) || `Manus request failed with ${response.status}`
    if (isManusV2CreateFallbackError(response.status, message)) {
      return callManusV1FallbackApi(prompt, manusApi, message)
    }
    throw new Error(message)
  }

  const taskId = toText(createPayload?.id || createPayload?.task_id)
  if (!taskId) {
    throw new Error('Manus task creation did not return a task id.')
  }

  let completedTask: ManusTaskResponse
  try {
    completedTask = await waitForManusTask(taskId, manusApi)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!isRetryableManusPollError(message)) {
      throw error
    }
    completedTask = await waitForManusV1Task(taskId, manusApi)
    completedTask.prompt_execution_metadata = {
      ...(isRecord(completedTask.prompt_execution_metadata) ? completedTask.prompt_execution_metadata : {}),
      manus_api_version: 'v1_fallback',
      manus_fallback_reason: 'Manus v2 message polling could not see task',
    }
  }
  completedTask.task_url = toText(createPayload?.task_url) || completedTask.task_url
  completedTask.agent_profile = 'manus-1.6-max'
  const manuscript = await normalizeTaskResponse(completedTask)

  return manuscript?.opportunities?.length || manuscript?.entity_actions?.length
    ? manuscript
    : { ...manuscript, prompt, source: 'manus' }
}

async function recoverCompletedManusTask(taskId: string): Promise<ManusResearchResponse> {
  const manusApi = toText(process.env.MANUS_API)
  if (!manusApi) {
    throw new Error('MANUS_API is not configured. Set MANUS_API in .env before recovering Manus research.')
  }

  const response = await fetch(`https://api.manus.ai/v1/tasks/${encodeURIComponent(taskId)}`, {
    headers: {
      API_KEY: manusApi,
      Accept: 'application/json',
    },
  })
  const payload = (await response.json().catch(() => null)) as ManusTaskResponse | null
  if (!response.ok) {
    throw new Error(getManusErrorMessage(payload) || `Manus recovery request failed with ${response.status}`)
  }

  const status = toText(payload?.status).toLowerCase()
  if (status !== 'completed' && status !== 'succeeded') {
    throw new Error(`Manus task ${taskId} is not complete and cannot be recovered safely.`)
  }

  const manuscript = await normalizeTaskResponse({
    ...(payload || {}),
    id: toText(payload?.id || payload?.task_id) || taskId,
    task_id: toText(payload?.task_id || payload?.id) || taskId,
    status: 'completed',
    task_url: toText(payload?.task_url || payload?.metadata?.task_url),
    prompt_execution_metadata: {
      ...(isRecord(payload?.prompt_execution_metadata) ? payload.prompt_execution_metadata : {}),
      manus_api_version: 'v1_recovery',
      manus_completion_state: 'recovered_completed_task',
    },
  })

  return manuscript?.opportunities?.length || manuscript?.entity_actions?.length
    ? manuscript
    : { ...manuscript, source: 'manus' }
}

function isManusV2CreateFallbackError(status: number, message: string): boolean {
  return status >= 500 || /failed to create task record/i.test(message)
}

function getManusErrorMessage(payload: unknown): string {
  if (!isRecord(payload)) return ''
  const error = payload.error
  if (typeof error === 'string') return error
  if (isRecord(error)) return toText(error.message || error.code)
  return toText(payload.message)
}

async function ensureCanonicalEntity(
  opportunity: any,
  canonicalEntities: Awaited<ReturnType<typeof getCanonicalEntitiesSnapshot>>,
  context: {
    focus_area?: string | null
    lane_label?: string | null
    seed_query?: string | null
    generated_at?: string | null
    run_id?: string | null
  } = {},
) {
  const organization = toText(opportunity?.organization || opportunity?.entity_name)
  const graphitiCandidates = await searchGraphitiEntities(
    organization || opportunity?.title || opportunity?.description || '',
    5,
  )
  const candidateNames = Array.from(new Set([
    organization,
    toText(opportunity?.entity_name),
    ...graphitiCandidates.map((candidate) => toText(candidate.name || candidate.properties?.name || candidate.id)),
  ])).filter(Boolean)

  const linked = candidateNames
    .map((candidateName) => linkOpportunityToCanonicalEntity(
      {
        entity_name: candidateName,
        organization: candidateName,
        title: opportunity?.title,
        description: opportunity?.description,
        source_url: opportunity?.source_url,
      },
      canonicalEntities,
    ))
    .find((candidate) => Boolean(candidate.canonical_entity_id))

  if (linked?.canonical_entity_id) {
    return {
      canonical_entity_id: linked.canonical_entity_id,
      canonical_entity_name: linked.canonical_entity_name || organization || null,
      action: 'link' as const,
    }
  }

  const canonicalEntityId = crypto.randomUUID()
  const canonicalEntityName = organization || linked?.canonical_entity_name || 'Unknown organization'
  const normalizedName = normalizeCanonicalName(canonicalEntityName)
  const inferredType = inferEntityType(opportunity)
  const canonicalKey = slugify(canonicalEntityName)
  const supabaseAdmin = getSupabaseAdmin()
  const { data: existingCanonicalEntity } = await supabaseAdmin
    .from('canonical_entities')
    .select('id,name')
    .eq('canonical_key', canonicalKey)
    .maybeSingle()

  if (existingCanonicalEntity?.id) {
    return {
      canonical_entity_id: existingCanonicalEntity.id,
      canonical_entity_name: toText(existingCanonicalEntity.name) || canonicalEntityName,
      action: 'link' as const,
    }
  }

  const properties = {
    name: canonicalEntityName,
    normalized_name: normalizedName,
    type: inferredType,
    entity_type: inferredType,
    source: 'manus-wide-rfp',
    created_via: 'rfp-wide-research',
    aliases: Array.from(new Set([canonicalEntityName, toText(opportunity?.entity_name), toText(opportunity?.organization)])).filter(Boolean),
    original_source_url: toText(opportunity?.source_url) || null,
    opportunity_title: toText(opportunity?.title) || null,
    opportunity_description: toText(opportunity?.description) || null,
    opportunity_category: toText(opportunity?.category) || null,
    opportunity_status: toText(opportunity?.status) || null,
    opportunity_deadline: toText(opportunity?.deadline) || null,
    opportunity_source_url: toText(opportunity?.source_url) || null,
    opportunity_confidence: typeof opportunity?.confidence === 'number' ? opportunity.confidence : null,
    opportunity_fit_score: typeof opportunity?.yellow_panther_fit === 'number' ? opportunity.yellow_panther_fit : null,
    wide_research_focus_area: toText(context.focus_area) || null,
    wide_research_lane_label: toText(context.lane_label) || null,
    wide_research_seed_query: toText(context.seed_query) || null,
    wide_research_generated_at: toText(context.generated_at) || null,
    wide_research_run_id: toText(context.run_id) || null,
  }

  const { error } = await supabaseAdmin
    .from('canonical_entities')
    .upsert([
      {
        id: canonicalEntityId,
        name: canonicalEntityName,
        normalized_name: normalizedName,
        entity_type: inferredType,
        sport: inferOpportunitySport(opportunity),
        league: toText(opportunity?.competition) || 'unknown',
        country: toText(opportunity?.country) || 'unknown',
        canonical_key: canonicalKey,
        properties,
      },
    ], { onConflict: 'id' })

  if (error) {
    if (/canonical_key/i.test(error.message || '')) {
      const { data: duplicateCanonicalEntity } = await supabaseAdmin
        .from('canonical_entities')
        .select('id,name')
        .eq('canonical_key', canonicalKey)
        .maybeSingle()
      if (duplicateCanonicalEntity?.id) {
        return {
          canonical_entity_id: duplicateCanonicalEntity.id,
          canonical_entity_name: toText(duplicateCanonicalEntity.name) || canonicalEntityName,
          action: 'link' as const,
        }
      }
    }
    throw new Error(`Failed to create canonical entity: ${error.message}`)
  }

  return {
    canonical_entity_id: canonicalEntityId,
    canonical_entity_name: canonicalEntityName,
    action: 'create' as const,
  }
}

async function enrichBatchWithCanonicalEntities(batch: ReturnType<typeof normalizeWideRfpResearchBatch>) {
  const canonicalEntities = await getCanonicalEntitiesSnapshot().catch(() => [])
  const nextOpportunities = []
  const entityActions = []

  for (const opportunity of batch.opportunities) {
    const resolved = await ensureCanonicalEntity(opportunity, canonicalEntities, {
      focus_area: batch.focus_area,
      lane_label: batch.lane_label,
      seed_query: batch.seed_query,
      generated_at: batch.generated_at,
      run_id: batch.run_id,
    })
    const normalizedOpportunity = {
      ...opportunity,
      canonical_entity_id: opportunity.canonical_entity_id || resolved.canonical_entity_id,
      canonical_entity_name: opportunity.canonical_entity_name || resolved.canonical_entity_name,
    }
    const taxonomy = normalizeOpportunityTaxonomy(
      {
        ...normalizedOpportunity,
        entity_id: normalizedOpportunity.canonical_entity_id,
        entity_name: normalizedOpportunity.canonical_entity_name,
      },
      canonicalEntities,
    )

    nextOpportunities.push({
      ...normalizedOpportunity,
      taxonomy,
      sport: taxonomy.sport,
      competition: taxonomy.competition,
      entity_role: taxonomy.entity_role,
      opportunity_kind: taxonomy.opportunity_kind,
      theme: taxonomy.theme,
    })

    entityActions.push({
      action: resolved.action,
      organization: opportunity.organization,
      canonical_entity_id: normalizedOpportunity.canonical_entity_id,
      canonical_entity_name: normalizedOpportunity.canonical_entity_name,
      source_url: opportunity.source_url,
    })
  }

  return {
    ...batch,
    opportunities: nextOpportunities,
    entity_actions: entityActions,
    summary: {
      total_opportunities: nextOpportunities.length,
      linked_entities: entityActions.filter((action) => action.action === 'link' || action.action === 'reuse').length,
      entities_to_create: entityActions.filter((action) => action.action === 'create').length,
    },
  }
}

export async function GET() {
  const latest = await loadLatestWideRfpResearchBatch({})

  return NextResponse.json({
    success: true,
    data: latest?.batch || null,
    artifact: latest?.artifact || null,
    source: latest?.source || null,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as ManusResearchRequest
    const focusArea = toText(body.focusArea) || DEFAULT_WIDE_RFP_FOCUS_AREA || 'web-platforms'
    const deltaMemory = body.deltaMemory || await loadWideRfpDeltaMemoryPack({
      maxKnownUrls: normalizePositiveInt(body.maxKnownUrls, 75),
      hardExcludedCanonicalEntityIds: body.hardExcludedCanonicalEntityIds || [],
    })
    const prompt = toText(body.prompt) || buildWideRfpResearchPrompt({
      seedQuery: body.seedQuery || getDefaultWideRfpSeedQuery(focusArea),
      focusArea,
      currentRfpPage: body.currentRfpPage || '/rfps',
      currentIntakePage: body.currentIntakePage || '/rfps',
      targetYear: body.targetYear,
      researchMode: body.researchMode || 'live',
      researchDepth: body.researchDepth || 'safe',
      deltaMemory,
      hardExcludedCanonicalEntityIds: body.hardExcludedCanonicalEntityIds,
      maxKnownUrls: body.maxKnownUrls,
      excludeNames: body.excludeNames,
    })

    const recoveredTaskId = toText(body.manusTaskId)
    const manusResponse = recoveredTaskId
      ? await recoverCompletedManusTask(recoveredTaskId)
      : await callManusApi(prompt)
    const normalizedBatch = normalizeWideRfpResearchBatch({
      ...extractManusBatch(manusResponse),
      targetYear: body.targetYear,
      excludeNames: body.excludeNames,
    })
    const enrichedBatch = await enrichBatchWithCanonicalEntities(normalizedBatch)
    const artifact = await persistWideRfpResearchBatch({
      outputDir: body.outputDir,
      batch: enrichedBatch,
    })
    const graphitiSync = await syncWideRfpBatchToGraphiti(
      enrichedBatch.opportunities,
      {
        run_id: enrichedBatch.run_id,
        generated_at: enrichedBatch.generated_at,
        focus_area: enrichedBatch.focus_area,
        lane_label: enrichedBatch.lane_label,
        seed_query: enrichedBatch.seed_query,
      },
      request.url,
    )

    return NextResponse.json({
      success: true,
      data: enrichedBatch,
      artifact: artifact.artifact,
    })
  } catch (error) {
    console.error('Wide RFP research failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Wide RFP research failed',
      },
      { status: 500 },
    )
  }
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(toText(value), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return parsed
}
