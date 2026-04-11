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
  readLatestWideRfpResearchArtifact,
  writeWideRfpResearchArtifact,
} from '@/lib/rfp-wide-research.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ManusResearchRequest = {
  seedQuery?: string
  focusArea?: string
  currentRfpPage?: string
  currentIntakePage?: string
  prompt?: string
  outputDir?: string
}

type ManusResearchResponse = {
  run_id?: string
  source?: string
  prompt?: string
  generated_at?: string
  opportunities?: any[]
  entity_actions?: any[]
  data?: {
    opportunities?: any[]
    entity_actions?: any[]
  }
}

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
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
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

function extractManusBatch(payload: ManusResearchResponse) {
  const candidate = payload?.data || payload || {}
  return {
    run_id: toText(candidate.run_id || payload.run_id) || `wide-rfp-${Date.now()}`,
    source: toText(candidate.source || payload.source) || 'manus',
    prompt: toText(candidate.prompt || payload.prompt),
    generated_at: toText(candidate.generated_at || payload.generated_at),
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

function parseTaskPayload(raw: string): ManusResearchResponse | null {
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

function normalizeTaskResponse(payload: ManusTaskResponse): ManusResearchResponse {
  const rawText = collectTaskText(payload)
  const parsed = parseTaskPayload(rawText)

  if (parsed) {
    return parsed
  }

  return {
    run_id: toText(payload.id || payload.task_id) || `wide-rfp-${Date.now()}`,
    source: 'manus',
    prompt: rawText,
    opportunities: [],
    entity_actions: [],
  }
}

async function waitForManusTask(taskId: string, apiKey: string, maxAttempts = 18, intervalMs = 5000): Promise<ManusTaskResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`https://api.manus.ai/v1/tasks/${encodeURIComponent(taskId)}`, {
      headers: {
        API_KEY: apiKey,
        Accept: 'application/json',
      },
    })

    const payload = (await response.json().catch(() => null)) as ManusTaskResponse | null
    if (!response.ok) {
      const message = toText(payload?.error || payload?.message) || `Manus task poll failed with ${response.status}`
      throw new Error(message)
    }

    const status = toText(payload?.status).toLowerCase()
    if (status && status !== 'running' && status !== 'pending' && status !== 'queued' && status !== 'in_progress') {
      return payload || {}
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  const finalResponse = await fetch(`https://api.manus.ai/v1/tasks/${encodeURIComponent(taskId)}`, {
    headers: {
      API_KEY: apiKey,
      Accept: 'application/json',
    },
  })
  const finalPayload = (await finalResponse.json().catch(() => null)) as ManusTaskResponse | null

  if (!finalResponse.ok) {
    const message = toText(finalPayload?.error || finalPayload?.message) || `Manus task poll failed with ${finalResponse.status}`
    throw new Error(message)
  }

  return finalPayload || {}
}

async function callManusApi(prompt: string): Promise<ManusResearchResponse> {
  const manusApi = toText(process.env.MANUS_API)
  if (!manusApi) {
    throw new Error('MANUS_API is not configured. Set MANUS_API in .env before running wide research.')
  }

  const response = await fetch('https://api.manus.ai/v1/tasks', {
    method: 'POST',
    headers: {
      API_KEY: manusApi,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      prompt,
      agentProfile: 'manus-1.6-max',
      taskMode: 'agent',
      interactiveMode: false,
      hideInTaskList: true,
    }),
  })

  const createPayload = (await response.json().catch(() => null)) as ManusTaskResponse | null

  if (!response.ok) {
    const message = toText(createPayload?.error || createPayload?.message) || `Manus request failed with ${response.status}`
    throw new Error(message)
  }

  const taskId = toText(createPayload?.id || createPayload?.task_id)
  if (!taskId) {
    throw new Error('Manus task creation did not return a task id.')
  }

  const completedTask = await waitForManusTask(taskId, manusApi)
  const manuscript = normalizeTaskResponse(completedTask)

  return manuscript?.opportunities?.length || manuscript?.entity_actions?.length
    ? manuscript
    : { ...manuscript, prompt, source: 'manus' }
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

  const canonicalEntityId = `canonical-${slugify(organization)}-${crypto.createHash('sha1').update(organization || 'entity').digest('hex').slice(0, 10)}`
  const canonicalEntityName = organization || linked?.canonical_entity_name || 'Unknown organization'
  const inferredType = inferEntityType(opportunity)
  const properties = {
    name: canonicalEntityName,
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

  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('canonical_entities')
    .upsert([
      {
        id: canonicalEntityId,
        name: canonicalEntityName,
        entity_type: inferredType,
        sport: toText(opportunity?.sport) || null,
        league: toText(opportunity?.competition) || null,
        country: toText(opportunity?.country) || null,
        canonical_key: slugify(canonicalEntityName),
        properties,
      },
    ], { onConflict: 'id' })

  if (error) {
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
  const latest = await readLatestWideRfpResearchArtifact({})

  return NextResponse.json({
    success: true,
    data: latest?.batch || null,
    artifact: latest?.filePath || null,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as ManusResearchRequest
    const focusArea = toText(body.focusArea) || DEFAULT_WIDE_RFP_FOCUS_AREA || 'web-platforms'
    const prompt = toText(body.prompt) || buildWideRfpResearchPrompt({
      seedQuery: body.seedQuery || getDefaultWideRfpSeedQuery(focusArea),
      focusArea,
      currentRfpPage: body.currentRfpPage || '/rfps',
      currentIntakePage: body.currentIntakePage || '/tenders',
    })

    const manusResponse = await callManusApi(prompt)
    const normalizedBatch = normalizeWideRfpResearchBatch(extractManusBatch(manusResponse))
    const enrichedBatch = await enrichBatchWithCanonicalEntities(normalizedBatch)
    const artifact = await writeWideRfpResearchArtifact({
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
      artifact: artifact.filePath,
      graphiti: graphitiSync,
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
