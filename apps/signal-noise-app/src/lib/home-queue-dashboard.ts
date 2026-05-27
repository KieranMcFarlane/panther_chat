import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { deriveEntityPipelineLifecycle } from '@/lib/entity-pipeline-lifecycle'
import { getNormalizedUniverseCount } from '@/lib/normalized-universe-count'
import { matchesEntityUuid, resolveEntityUuid } from '@/lib/entity-public-id'
import { mergeQuestionFirstRunArtifactIntoDossier, normalizeQuestionFirstDossier, resolveCanonicalQuestionFirstDossier } from '@/lib/question-first-dossier'
import { resolveOperationalHeartbeatDetails } from '@/lib/operational-heartbeat'
import { query as queryPostgres } from '@/lib/pg-client'
import { readPipelineControlState } from '@/lib/pipeline-control-state'
import { loadGraphitiDossierIngestionStats } from '@/lib/graphiti-dossier-ingestion'
import { buildPipelineRuntimeSnapshot, loadPipelineRuntimeReadSet, type PipelineRuntimeRunRecord } from '@/lib/pipeline-runtime'
import { loadQuestionFirstLiveQueueSnapshot, loadQuestionFirstScaleManifest } from '@/lib/question-first-manifest'
import { describeQuestionFirstQueueOrder, sortQuestionFirstManifestEntities } from '@/lib/question-first-queue-order'
import { ROLLOUT_PROOF_SET } from '@/lib/rollout-proof-set'

type ScaleProgress = {
  schema_version?: string
  generated_at?: string
  total_scheduled?: number
  completed?: number
  failed?: number
  retryable_failures?: number
  stalled?: number
  promoted_dossiers?: number
  client_ready_dossiers?: number
  dossier_artifacts?: number
  last_successful_canonical_run_at?: string | null
  failure_breakdown?: Record<string, number>
}

type ManifestEntity = {
  entity_id: string
  entity_name: string
  entity_type: string
  default_rollout_phase?: string
}

type QueueEntityRecord = {
  entity_id: string
  entity_name: string
  entity_type: string
  state: 'completed' | 'in_progress' | 'upcoming' | 'resume_needed'
  client_ready: boolean
  promoted: boolean
  summary: string | null
  generated_at: string | null
  started_at?: string | null
  active_question_id?: string | null
  current_question_id?: string | null
  current_question_text?: string | null
  current_section_id?: string | null
  current_section_label?: string | null
  current_section_index?: number | null
  current_section_total?: number | null
  current_question_index?: number | null
  current_question_total?: number | null
  current_strategy_label?: string | null
  current_execution_state?: string | null
  current_source_order?: string[] | null
  current_substep_label?: string | null
  current_substep_progress?: string | null
  next_action?: string | null
  run_phase?: string | null
  publication_status?: string | null
  publication_mode?: string | null
  repair_state?: string | null
  repair_retry_count?: number | null
  repair_retry_budget?: number | null
  next_repair_question_id?: string | null
  next_repair_status?: string | null
  next_repair_batch_id?: string | null
  next_repair_batch_status?: string | null
  reconciliation_state?: string | null
  freshness_state?: 'fresh' | 'stale' | null
  heartbeat_at?: string | null
  heartbeat_age_seconds?: number | null
  heartbeat_source?: string | null
}

type RuntimeState = 'running' | 'queued' | 'stalled' | 'retryable' | 'resume_needed'

type ClientReadyDossierCard = {
  entity_id: string
  browser_entity_id: string
  entity_name: string
  entity_type: string
  generated_at: string | null
  summary: string | null
  dossier_path: string
  buyer_hypothesis: string | null
  best_path: string | null
}

type SalesSummaryItem = {
  entity_id: string
  entity_name: string
  buyer_hypothesis: string | null
  buyer_title: string | null
  best_path_owner: string | null
  path_type: string | null
  opportunity_framing: string | null
  capability_gap: string | null
  outreach_route: string | null
}

type RfpCard = {
  id: string
  title: string
  organization: string
  description: string | null
  yellow_panther_fit: number | null
  category: string | null
  deadline: string | null
  source_url: string | null
  entity_id: string | null
  entity_name: string | null
}

type DossierQualityState = 'partial' | 'blocked' | 'complete' | 'client_ready'

type DossierQualityCard = {
  entity_id: string
  browser_entity_id: string
  entity_name: string
  entity_type: string
  quality_state: DossierQualityState
  quality_summary: string | null
  generated_at: string | null
  question_count: number
  source: 'question_first_dossier' | 'question_first_run'
}

type RolloutProofCard = {
  entity_id: string
  browser_entity_id: string
  entity_name: string
  expected_quality_state: DossierQualityState
  actual_quality_state: string
  question_count: number
  validation_sample: boolean
  summary: string | null
}

export type HomeQueueDashboardPayload = {
  control: {
    is_paused: boolean
    pause_reason: string | null
    updated_at: string | null
    desired_state: 'running' | 'paused'
    requested_state: 'running' | 'paused'
    observed_state: 'starting' | 'running' | 'stopping' | 'paused'
    transition_state: 'starting' | 'running' | 'stopping' | 'paused'
  }
  loop_status: {
    universe_count: number
    total_scheduled: number
    completed: number
    processed_dossiers?: number
    failed: number
    retryable_failures: number
    client_ready_dossiers: number
    promoted_dossiers: number
    last_successful_canonical_run_at: string | null
    health: LoopHealth
    source: LoopSource
    last_activity_at: string | null
    quality_counts: Record<DossierQualityState, number>
    runtime_counts: Record<RuntimeState, number>
  }
  queue: {
    completed_entities: QueueEntityRecord[]
    in_progress_entity: QueueEntityRecord | null
    running_entities: QueueEntityRecord[]
    stale_active_rows?: QueueEntityRecord[]
    processed_entities?: QueueEntityRecord[]
    resume_needed_entities: QueueEntityRecord[]
    upcoming_entities: QueueEntityRecord[]
  }
  playlist_sort_key: string[]
  client_ready_dossiers: ClientReadyDossierCard[]
  rfp_cards: RfpCard[]
  sales_summary: {
    status: 'available' | 'empty'
    highlights: SalesSummaryItem[]
  }
  graphiti_dossier_ingestion: {
    canonical_entities_total: number
    dossiers_persisted_entities: number
    dossiers_ingested_entities: number
    partial_dossiers_ingested: number
    opportunity_worthy_entities: number
    failed_only_opportunities_active: number
  }
  dossier_quality: {
    counts: Record<DossierQualityState, number>
    incomplete_entities: DossierQualityCard[]
  }
  rollout_proof_set: RolloutProofCard[]
}

type BuildOptions = {
  appRoot?: string
  opportunitiesFetcher?: () => Promise<RfpCard[]>
  includeClientReadyDossiers?: boolean
  includeRfpCards?: boolean
  includeSalesSummary?: boolean
  includeDossierQuality?: boolean
  includeRolloutProofSet?: boolean
}

type LiveQueueSnapshot = {
  loop_status?: HomeQueueDashboardPayload['loop_status']
  queue?: HomeQueueDashboardPayload['queue']
}

type HomeQueueState = HomeQueueDashboardPayload['queue']

type PipelineRunRecord = {
  entity_id: string
  canonical_entity_id?: string | null
  entity_name: string
  status: 'queued' | 'claiming' | 'running' | 'retrying' | 'completed' | 'failed'
  phase: string | null
  completed_at: string | null
  started_at: string
  metadata?: Record<string, unknown> | null
}

type ProcessedDossierRow = {
  entity_id: string
  canonical_entity_id?: string | null
  entity_name: string
  entity_type: string
  generated_at: string | null
  dossier_data?: Record<string, unknown> | null
}

type LoopHealth = 'active' | 'stale' | 'idle'
type LoopSource = 'pipeline_runs' | 'diagnostics' | 'snapshot'

type LoopStatus = HomeQueueDashboardPayload['loop_status']

type QueueSourceSelection = {
  source: LoopSource
  queue: HomeQueueDashboardPayload['queue']
  loop_status: LoopStatus
  last_activity_at: string | null
  priority: number
}

const LOOP_ACTIVE_WINDOW_MS = 20 * 60 * 1000
const EMPTY_QUALITY_COUNTS: Record<DossierQualityState, number> = {
  partial: 0,
  blocked: 0,
  complete: 0,
  client_ready: 0,
}

const EMPTY_RUNTIME_COUNTS: Record<RuntimeState, number> = {
  running: 0,
  queued: 0,
  stalled: 0,
  retryable: 0,
  resume_needed: 0,
}

function queueItems(
  items: QueueEntityRecord[] | null | undefined,
): QueueEntityRecord[] {
  return Array.isArray(items) ? items : []
}

async function loadProcessedDossierCount(): Promise<number> {
  try {
    const result = await queryPostgres(`
      select count(distinct canonical_entity_id)::int as processed_dossiers
      from entity_dossiers
      where canonical_entity_id is not null
    `)
    const rawValue = result.rows?.[0]?.processed_dossiers
    const processedDossiers = Number(rawValue)
    return Number.isFinite(processedDossiers) ? processedDossiers : 0
  } catch {
    return 0
  }
}

function extractProcessedDossierSummary(dossierData: Record<string, unknown> | null): string | null {
  if (!dossierData || typeof dossierData !== 'object') return null

  const questionFirst = dossierData.question_first && typeof dossierData.question_first === 'object'
    ? dossierData.question_first as Record<string, unknown>
    : null
  const discoverySummary = questionFirst?.discovery_summary && typeof questionFirst.discovery_summary === 'object'
    ? questionFirst.discovery_summary as Record<string, unknown>
    : null
  const graphiti = discoverySummary?.graphiti_sales_brief && typeof discoverySummary.graphiti_sales_brief === 'object'
    ? discoverySummary.graphiti_sales_brief as Record<string, unknown>
    : null

  const candidates = [
    graphiti?.outreach_angle,
    graphiti?.outreach_target,
    discoverySummary?.recommended_approach,
    discoverySummary?.opportunity_summary,
    discoverySummary?.summary,
    dossierData.recommended_approach,
    dossierData.overall_assessment,
    questionFirst?.summary,
    questionFirst?.recommended_approach,
    questionFirst?.discovery_summary,
  ]
  for (const candidate of candidates) {
    const text = toText(candidate)
    if (text) return text
  }
  return null
}

async function loadProcessedDossierRows(limit = 100): Promise<ProcessedDossierRow[]> {
  try {
    const result = await queryPostgres(
      `
        select entity_id, canonical_entity_id, entity_name, entity_type, generated_at, dossier_data
        from entity_dossiers
        where canonical_entity_id is not null
        order by generated_at desc nulls last, entity_name asc
        limit $1
      `,
      [limit],
    )
    return Array.isArray(result.rows)
      ? result.rows.map((row) => ({
        entity_id: toText(row.entity_id),
        canonical_entity_id: toText(row.canonical_entity_id) || null,
        entity_name: toText(row.entity_name),
        entity_type: toText(row.entity_type) || 'Entity',
        generated_at: toText(row.generated_at) || null,
        dossier_data: (row.dossier_data && typeof row.dossier_data === 'object') ? row.dossier_data as Record<string, unknown> : null,
      }))
      : []
  } catch {
    return []
  }
}

function mapProcessedDossierRowsToQueueEntities(rows: ProcessedDossierRow[]): QueueEntityRecord[] {
  return rows.map((row, index) => ({
    entity_id: row.canonical_entity_id || row.entity_id,
    entity_name: row.entity_name || row.canonical_entity_id || row.entity_id,
    entity_type: row.entity_type || 'Entity',
    state: 'completed',
    client_ready: false,
    promoted: true,
    summary: extractProcessedDossierSummary(row.dossier_data ?? null),
    generated_at: row.generated_at,
    started_at: row.generated_at,
    current_question_id: 'completed',
    current_question_text: 'Completed dossier',
    run_phase: 'completed',
    publication_status: 'published',
    next_action: 'Open the completed dossier',
    freshness_state: 'fresh',
    queue_position: index + 1,
    heartbeat_at: row.generated_at,
    heartbeat_source: 'entity_dossiers',
  }))
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return ''
  const text = String(value).trim()
  return text === '[object Object]' ? '' : text
}

function parseTimestamp(value: unknown): number | null {
  const text = toText(value)
  if (!text) return null
  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? timestamp : null
}

function isActiveRepairFocus(lifecycle: Awaited<ReturnType<typeof deriveEntityPipelineLifecycle>> | undefined): boolean {
  if (!lifecycle) return false
  const nextRepairStatus = toText(lifecycle.next_repair_status).toLowerCase()
  const repairState = toText(lifecycle.repair_state).toLowerCase()
  return (
    (nextRepairStatus === 'queued' || nextRepairStatus === 'running')
    || ((repairState === 'queued' || repairState === 'repairing') && Boolean(lifecycle.next_repair_question_id))
  )
}

function queueHasActiveRepairFocus(queue: HomeQueueDashboardPayload['queue']): boolean {
  const inProgress = queue.in_progress_entity
  if (!inProgress) return false
  const nextRepairStatus = toText(inProgress.next_repair_status).toLowerCase()
  const repairState = toText(inProgress.repair_state).toLowerCase()
  return (
    nextRepairStatus === 'queued'
    || nextRepairStatus === 'running'
    || ((repairState === 'queued' || repairState === 'repairing') && Boolean(inProgress.next_repair_question_id))
  )
}

function toIsoString(timestamp: number | null): string | null {
  if (timestamp === null || !Number.isFinite(timestamp)) return null
  return new Date(timestamp).toISOString()
}

function maxTimestamp(values: Array<unknown>): number | null {
  let best: number | null = null
  for (const value of values) {
    const timestamp = typeof value === 'number' ? value : parseTimestamp(value)
    if (timestamp === null) continue
    if (best === null || timestamp > best) {
      best = timestamp
    }
  }
  return best
}

function tryReadJson(filePath: string): Record<string, any> | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function walkFiles(root: string, predicate: (filePath: string) => boolean, maxDepth = 4): string[] {
  const files: string[] = []
  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || current.depth > maxDepth || !existsSync(current.dir)) continue
    for (const entry of readdirSync(current.dir, { withFileTypes: true })) {
      const entryPath = path.join(current.dir, entry.name)
      if (entry.isDirectory()) {
        stack.push({ dir: entryPath, depth: current.depth + 1 })
      } else if (predicate(entryPath)) {
        files.push(entryPath)
      }
    }
  }
  return files
}

function latestFile(root: string, filename: string): string | null {
  const files = walkFiles(root, (filePath) => path.basename(filePath) === filename, 3)
  let newest: { filePath: string; mtimeMs: number } | null = null
  for (const filePath of files) {
    const mtimeMs = statSync(filePath).mtimeMs
    if (!newest || mtimeMs > newest.mtimeMs) {
      newest = { filePath, mtimeMs }
    }
  }
  return newest?.filePath || null
}

function fileMtimeIso(filePath: string | null): string | null {
  if (!filePath || !existsSync(filePath)) return null
  return new Date(statSync(filePath).mtimeMs).toISOString()
}

function firstFile(dir: string, suffix: string): string | null {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .map((name) => path.join(dir, name))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)
  return files[0] || null
}

function summarizeDossier(dossier: Record<string, any>): string | null {
  const discoverySummary = dossier?.question_first?.discovery_summary
  const graphiti = discoverySummary?.graphiti_sales_brief
  if (toText(graphiti?.outreach_angle)) return toText(graphiti.outreach_angle)
  if (Array.isArray(discoverySummary?.opportunity_signals) && discoverySummary.opportunity_signals[0]?.answer) {
    return toText(discoverySummary.opportunity_signals[0].answer)
  }
  if (Array.isArray(dossier?.answers) && dossier.answers[0]?.answer) {
    return toText(dossier.answers[0].answer)
  }
  return null
}

function resolveBrowserEntityId(
  normalizedPayload: Record<string, any>,
  canonicalEntities: any[],
): string | null {
  const entityId = toText(normalizedPayload?.entity_id)
  const entityName = toText(normalizedPayload?.entity_name).toLowerCase()
  const entityType = toText(normalizedPayload?.entity_type).toLowerCase()

  const exactUuidMatch = canonicalEntities.find((candidate) => matchesEntityUuid(candidate, entityId))
  if (exactUuidMatch) {
    return resolveEntityUuid(exactUuidMatch)
  }

  const idMatch = canonicalEntities.find((candidate) =>
    toText(candidate?.id) === entityId ||
    toText(candidate?.neo4j_id) === entityId ||
    toText(candidate?.supabase_id || candidate?.properties?.supabase_id) === entityId,
  )
  if (idMatch) {
    return resolveEntityUuid(idMatch)
  }

  const nameMatch = canonicalEntities.find((candidate) => {
    const candidateName = toText(candidate?.properties?.name).toLowerCase()
    const candidateType = toText(candidate?.properties?.type || candidate?.labels?.[0]).toLowerCase()
    return candidateName === entityName && (!entityType || candidateType === entityType)
  })
  if (nameMatch) {
    return resolveEntityUuid(nameMatch)
  }

  return entityId || null
}

function buildClientReadyDossiersStore(dossierRoot: string, canonicalEntities: any[]) {
  const dossierFiles = walkFiles(dossierRoot, (filePath) => filePath.endsWith('_question_first_dossier.json'), 2)
  const cards: ClientReadyDossierCard[] = []
  const sales: SalesSummaryItem[] = []
  const ids = new Set<string>()

  for (const filePath of dossierFiles) {
    const payload = tryReadJson(filePath)
    if (!payload) continue
    const normalizedPayload = normalizeQuestionFirstDossier(
      (payload?.merged_dossier && typeof payload.merged_dossier === 'object') ? payload.merged_dossier : payload,
      toText(payload?.entity_id || payload?.merged_dossier?.entity_id || path.basename(filePath)),
    )
    const discoverySummary = normalizedPayload?.question_first?.discovery_summary
    if (discoverySummary?.client_ready !== true) continue
    const entityId = toText(normalizedPayload?.entity_id || payload?.entity_id || payload?.question_first?.entity_id || payload?.entity?.entity_id)
    if (!entityId || ids.has(entityId)) continue
    ids.add(entityId)
    const browserEntityId = resolveBrowserEntityId(normalizedPayload, canonicalEntities) || entityId
    const graphiti = discoverySummary?.graphiti_sales_brief || {}
    cards.push({
      entity_id: entityId,
      browser_entity_id: browserEntityId,
      entity_name: toText(normalizedPayload?.entity_name || payload?.entity_name || payload?.question_first?.entity_name || entityId),
      entity_type: toText(normalizedPayload?.entity_type || payload?.entity_type || payload?.question_first?.entity_type || 'Entity'),
      generated_at: toText(normalizedPayload?.question_first?.generated_at || normalizedPayload?.metadata?.question_first?.generated_at) || null,
      summary: summarizeDossier(normalizedPayload),
      dossier_path: filePath,
      buyer_hypothesis: toText(graphiti?.buyer_name || graphiti?.buyer_title) || null,
      best_path: toText(graphiti?.best_path_owner || graphiti?.outreach_route) || null,
    })
    sales.push({
      entity_id: entityId,
      entity_name: toText(normalizedPayload?.entity_name || payload?.entity_name || payload?.question_first?.entity_name || entityId),
      buyer_hypothesis: toText(graphiti?.buyer_name) || null,
      buyer_title: toText(graphiti?.buyer_title) || null,
      best_path_owner: toText(graphiti?.best_path_owner) || null,
      path_type: toText(graphiti?.path_type) || null,
      opportunity_framing: toText(graphiti?.outreach_angle) || summarizeDossier(normalizedPayload),
      capability_gap: toText(graphiti?.capability_gap) || null,
      outreach_route: toText(graphiti?.outreach_route || graphiti?.outreach_target) || null,
    })
  }

  cards.sort((left, right) => Date.parse(right.generated_at || '') - Date.parse(left.generated_at || ''))
  return { cards, sales, ids }
}

function buildEmptyQualityCounts(): Record<DossierQualityState, number> {
  return { ...EMPTY_QUALITY_COUNTS }
}

async function buildDossierQualityOverview(roots: string[], canonicalEntities: any[]) {
  const bestByEntity = new Map<string, DossierQualityCard & { sortTime: number; sourceRank: number }>()

  for (const root of roots) {
    const files = walkFiles(
      root,
      (filePath) =>
        filePath.endsWith('_question_first_dossier.json')
        || filePath.endsWith('_question_first_run_v2.json')
        || filePath.endsWith('_question_first_run_v1.json'),
      4,
    )

    for (const filePath of files) {
      const payload = tryReadJson(filePath)
      if (!payload) continue
      const isDossier = filePath.endsWith('_question_first_dossier.json')
      const source = isDossier ? 'question_first_dossier' as const : 'question_first_run' as const
      const normalizedPayload = normalizeQuestionFirstDossier(
        isDossier
          ? ((payload?.merged_dossier && typeof payload.merged_dossier === 'object') ? payload.merged_dossier : payload)
          : mergeQuestionFirstRunArtifactIntoDossier({}, payload),
        toText(payload?.entity_id || payload?.merged_dossier?.entity_id || path.basename(filePath)),
      )
      const qualityState = toText(normalizedPayload?.quality_state).toLowerCase() as DossierQualityState
      if (!['partial', 'blocked', 'complete', 'client_ready'].includes(qualityState)) {
        continue
      }
      const browserEntityId = resolveBrowserEntityId(normalizedPayload, canonicalEntities) || toText(normalizedPayload?.entity_id)
      if (!browserEntityId) continue
      const questionCount = Array.isArray(normalizedPayload?.questions) ? normalizedPayload.questions.length : 0
      const generatedAt = toText(normalizedPayload?.question_first?.generated_at || normalizedPayload?.metadata?.question_first?.generated_at) || null
      const mtimeMs = statSync(filePath).mtimeMs
      const sourceRank = isDossier ? 2 : 1
      const candidate: DossierQualityCard & { sortTime: number; sourceRank: number } = {
        entity_id: toText(normalizedPayload?.entity_id || browserEntityId),
        browser_entity_id: browserEntityId,
        entity_name: toText(normalizedPayload?.entity_name || browserEntityId),
        entity_type: toText(normalizedPayload?.entity_type || 'Entity'),
        quality_state: qualityState,
        quality_summary: toText(normalizedPayload?.quality_summary) || null,
        generated_at: generatedAt,
        question_count: questionCount,
        source,
        sortTime: mtimeMs,
        sourceRank,
      }
      const existing = bestByEntity.get(browserEntityId)
      if (!existing || candidate.sourceRank > existing.sourceRank || (candidate.sourceRank === existing.sourceRank && candidate.sortTime > existing.sortTime)) {
        bestByEntity.set(browserEntityId, candidate)
      }
    }
  }

  const counts = buildEmptyQualityCounts()
  const records = Array.from(bestByEntity.values())
  for (const record of records) {
    counts[record.quality_state] += 1
  }

  const incompleteEntities = records
    .filter((record) => record.quality_state === 'partial')
    .sort((left, right) => right.sortTime - left.sortTime)
    .slice(0, 6)
    .map(({ sortTime: _sortTime, sourceRank: _sourceRank, ...item }) => item)

  return {
    counts,
    incomplete_entities: incompleteEntities,
  }
}

async function buildRolloutProofSet(canonicalEntities: any[]): Promise<RolloutProofCard[]> {
  const cards: RolloutProofCard[] = []

  for (const definition of ROLLOUT_PROOF_SET) {
    const names = new Set([definition.display_name, ...(definition.aliases ?? [])].map((value) => value.trim().toLowerCase()))
    const entity = canonicalEntities.find((candidate) => {
      const candidateUuid = resolveEntityUuid(candidate)
      const candidateName = toText(candidate?.properties?.name).toLowerCase()
      return candidateUuid === definition.entity_uuid || names.has(candidateName)
    })
    const browserEntityId = entity ? (resolveEntityUuid(entity) || String(entity.id)) : definition.entity_uuid
    const canonical = await resolveCanonicalQuestionFirstDossier(browserEntityId, entity ?? null)
    const dossier = canonical.dossier
    cards.push({
      entity_id: definition.entity_uuid,
      browser_entity_id: browserEntityId,
      entity_name: toText(dossier?.entity_name) || definition.display_name,
      expected_quality_state: definition.expected_quality_state,
      actual_quality_state: toText(dossier?.quality_state) || 'missing',
      question_count: Array.isArray(dossier?.questions) ? dossier.questions.length : 0,
      validation_sample: dossier?.validation_sample === true,
      summary: toText(dossier?.quality_summary) || null,
    })
  }

  return cards
}

async function buildQueueState(
  manifestEntities: ManifestEntity[],
  runs: PipelineRunRecord[],
  clientReadyIds: Set<string>,
): Promise<HomeQueueState> {
  const latestRunById = new Map<string, PipelineRunRecord>()
  for (const run of runs) {
    const existing = latestRunById.get(run.entity_id)
    if (!existing) {
      latestRunById.set(run.entity_id, run)
      continue
    }

    const existingTime = Date.parse(existing.completed_at || existing.started_at || '')
    const candidateTime = Date.parse(run.completed_at || run.started_at || '')
    if (candidateTime >= existingTime) {
      latestRunById.set(run.entity_id, run)
    }
  }

  const activeStatuses = new Set(['queued', 'claiming', 'running', 'retrying'])
  let activeIndex = -1
  let highestProcessedIndex = -1
  let inProgressPriority = -1
  let inProgress: QueueEntityRecord | null = null
  const runningEntities: QueueEntityRecord[] = []
  const completed: Array<QueueEntityRecord & { sortTime: number }> = []
  const resumeNeeded: QueueEntityRecord[] = []
  const staleActiveRows: QueueEntityRecord[] = []
  const lifecycleByEntityId = new Map<string, Awaited<ReturnType<typeof deriveEntityPipelineLifecycle>>>()

  await Promise.all(
    Array.from(latestRunById.values()).map(async (run) => {
      lifecycleByEntityId.set(
        run.entity_id,
        await deriveEntityPipelineLifecycle({
          entityId: run.entity_id,
          run: run as any,
        }),
      )
    }),
  )

  for (const [index, entity] of manifestEntities.entries()) {
    const run = latestRunById.get(entity.entity_id)
    if (!run) continue
    const lifecycle = lifecycleByEntityId.get(entity.entity_id)
    const clientReady = lifecycle?.client_ready || clientReadyIds.has(entity.entity_id)
    const phase = toText(run.phase) || null
    const summaryPhase = lifecycle?.summary || (phase ? `Running ${phase}` : 'Canonical dossier run in progress')

    highestProcessedIndex = Math.max(highestProcessedIndex, index)

    if (lifecycle?.stage === 'stalled' || lifecycle?.stage === 'retryable_failure' || lifecycle?.stage === 'resume_needed') {
      resumeNeeded.push({
        entity_id: entity.entity_id,
        entity_name: entity.entity_name,
        entity_type: entity.entity_type,
        state: 'resume_needed',
        client_ready: clientReady,
        promoted: clientReady,
        summary: lifecycle.summary,
        generated_at: lifecycle.latest_activity_at || null,
        started_at: run.started_at,
        active_question_id: lifecycle.resume_from_question || phase,
        current_question_id: lifecycle.resume_from_question || phase,
        next_action: lifecycle.next_repair_question_id
          ? `Repair question ${lifecycle.next_repair_question_id}`
          : 'Resume the pipeline',
        run_phase: lifecycle.stage,
        publication_status: lifecycle.publication_status,
        publication_mode: lifecycle.publication_mode,
        repair_state: lifecycle.repair_state,
        repair_retry_count: lifecycle.repair_retry_count,
        repair_retry_budget: lifecycle.repair_retry_budget,
        next_repair_question_id: lifecycle.next_repair_question_id,
        next_repair_status: lifecycle.next_repair_status,
        next_repair_batch_id: lifecycle.next_repair_batch_id,
        next_repair_batch_status: lifecycle.next_repair_batch_status,
        reconciliation_state: lifecycle.reconciliation_state,
      })
      continue
    }

    if (activeStatuses.has(run.status)) {
      const heartbeat = resolveOperationalHeartbeatDetails({
        heartbeat_at: run.metadata && typeof run.metadata === 'object' ? (run.metadata as Record<string, unknown>).heartbeat_at : null,
        started_at: run.started_at,
        generated_at: run.completed_at || run.started_at,
      })
      const candidatePriority = isActiveRepairFocus(lifecycle) ? 2 : 1
      const queueRecord = {
        entity_id: entity.entity_id,
        entity_name: entity.entity_name,
        entity_type: entity.entity_type,
        state: 'in_progress' as const,
        client_ready: clientReady,
        promoted: clientReady,
        summary: summaryPhase,
        generated_at: lifecycle?.latest_activity_at || null,
        started_at: run.started_at,
        active_question_id: phase,
        current_question_id: phase,
        next_action: lifecycle?.next_repair_question_id
          ? `Repair question ${lifecycle.next_repair_question_id}`
          : 'Continue the active question',
        run_phase: run.status,
        publication_status: lifecycle?.publication_status || null,
        publication_mode: lifecycle?.publication_mode || null,
        repair_state: lifecycle?.repair_state || null,
        repair_retry_count: lifecycle?.repair_retry_count ?? null,
        repair_retry_budget: lifecycle?.repair_retry_budget ?? null,
        next_repair_question_id: lifecycle?.next_repair_question_id || null,
        next_repair_status: lifecycle?.next_repair_status || null,
        next_repair_batch_id: lifecycle?.next_repair_batch_id || null,
        next_repair_batch_status: lifecycle?.next_repair_batch_status || null,
        reconciliation_state: lifecycle?.reconciliation_state || null,
        freshness_state: heartbeat.freshness_state,
        heartbeat_at: heartbeat.heartbeat_at,
        heartbeat_age_seconds: heartbeat.heartbeat_age_seconds,
        heartbeat_source: heartbeat.heartbeat_source,
      }

      if (heartbeat.freshness_state === 'stale') {
        const staleRecord: QueueEntityRecord = {
          ...queueRecord,
          state: 'resume_needed',
          run_phase: 'stalled',
          next_action: 'Restart the pipeline',
        }
        staleActiveRows.push(staleRecord)
        resumeNeeded.push(staleRecord)
        continue
      }

      runningEntities.push(queueRecord)

      if (candidatePriority > inProgressPriority || (candidatePriority === inProgressPriority && activeIndex === -1)) {
        activeIndex = index
        inProgressPriority = candidatePriority
        inProgress = queueRecord
      }
      continue
    }

    if (run.status === 'completed') {
      const completedAt = Date.parse(run.completed_at || run.started_at || '')
      completed.push({
        entity_id: entity.entity_id,
        entity_name: entity.entity_name,
        entity_type: entity.entity_type,
        state: 'completed',
        client_ready: clientReady,
        promoted: clientReady,
        summary: lifecycle?.summary || (clientReady ? 'Client-ready dossier promoted' : 'Run completed. Not promoted to a client dossier yet.'),
        generated_at: lifecycle?.latest_activity_at || run.completed_at || run.started_at || null,
        started_at: run.started_at,
        next_action: 'Review the completed dossier',
        current_question_id: null,
        run_phase: run.status,
        publication_status: lifecycle?.publication_status || null,
        publication_mode: lifecycle?.publication_mode || null,
        repair_state: lifecycle?.repair_state || null,
        repair_retry_count: lifecycle?.repair_retry_count ?? null,
        repair_retry_budget: lifecycle?.repair_retry_budget ?? null,
        next_repair_question_id: lifecycle?.next_repair_question_id || null,
        next_repair_status: lifecycle?.next_repair_status || null,
        next_repair_batch_id: lifecycle?.next_repair_batch_id || null,
        next_repair_batch_status: lifecycle?.next_repair_batch_status || null,
        reconciliation_state: lifecycle?.reconciliation_state || null,
        sortTime: Number.isFinite(completedAt) ? completedAt : 0,
      })
    }
  }

  completed.sort((left, right) => right.sortTime - left.sortTime)
  const boundaryIndex = activeIndex >= 0 ? activeIndex : highestProcessedIndex
  const upcoming = manifestEntities
    .slice(boundaryIndex + 1)
    .filter((entity) => !latestRunById.has(entity.entity_id))
    .slice(0, 8)
    .map((entity) => ({
      entity_id: entity.entity_id,
      entity_name: entity.entity_name,
      entity_type: entity.entity_type,
      state: 'upcoming' as const,
      client_ready: false,
      promoted: false,
      summary: 'Waiting in the serialized live loop',
      generated_at: null,
      started_at: null,
    }))

  return {
    completed_entities: completed.slice(0, 6).map(({ sortTime: _sortTime, ...item }) => item),
    in_progress_entity: inProgress,
    running_entities: runningEntities.slice(0, 8),
    stale_active_rows: staleActiveRows.slice(0, 6),
    resume_needed_entities: resumeNeeded.slice(0, 6),
    upcoming_entities: upcoming,
  }
}

async function loadPipelineRuns(entityIds: string[]): Promise<PipelineRunRecord[]> {
  const dedupedIds = Array.from(new Set(entityIds.filter(Boolean)))
  if (dedupedIds.length === 0) {
    return []
  }

  const runs: PipelineRunRecord[] = []
  const chunkSize = 150

  for (let index = 0; index < dedupedIds.length; index += chunkSize) {
    const chunk = dedupedIds.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('entity_pipeline_runs')
      .select('entity_id, canonical_entity_id, entity_name, status, phase, completed_at, started_at, metadata')
      .in('entity_id', chunk)
      .order('started_at', { ascending: false })

    if (error) {
      throw error
    }

    for (const row of data || []) {
      runs.push(row as PipelineRunRecord)
    }
  }

  return runs
}

async function loadActiveRepairFocusRuns(): Promise<PipelineRunRecord[]> {
  const { data, error } = await supabase
    .from('entity_pipeline_runs')
    .select('entity_id, canonical_entity_id, entity_name, status, phase, completed_at, started_at, metadata')
    .in('status', ['queued', 'claiming', 'running', 'retrying'])
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) {
    throw error
  }

  return (data || [])
    .map((row: unknown) => row as PipelineRunRecord)
    .filter((run: PipelineRunRecord) => {
      const metadata = (run.metadata && typeof run.metadata === 'object') ? run.metadata as Record<string, unknown> : {}
      const rerunMode = toText(metadata.rerun_mode).toLowerCase()
      const repairState = toText(metadata.repair_state).toLowerCase()
      const nextRepairStatus = toText(metadata.next_repair_status).toLowerCase()
      const nextRepairQuestionId = toText(metadata.next_repair_question_id)
      return (
        rerunMode === 'question'
        || ((repairState === 'queued' || repairState === 'repairing') && Boolean(nextRepairQuestionId))
        || nextRepairStatus === 'queued'
        || nextRepairStatus === 'running'
      )
    })
}

function buildLoopStatusFromRuns(
  universeCount: number,
  manifestCount: number,
  runs: PipelineRunRecord[],
  clientReadyCount: number,
  progress: ScaleProgress | null,
  qualityCounts: Record<DossierQualityState, number>,
): LoopStatus {
  const latestRunById = new Map<string, PipelineRunRecord>()
  for (const run of runs) {
    const existing = latestRunById.get(run.entity_id)
    if (!existing) {
      latestRunById.set(run.entity_id, run)
      continue
    }

    const existingTime = Date.parse(existing.completed_at || existing.started_at || '')
    const candidateTime = Date.parse(run.completed_at || run.started_at || '')
    if (candidateTime >= existingTime) {
      latestRunById.set(run.entity_id, run)
    }
  }

  const latestRuns = Array.from(latestRunById.values())
  const uniqueCompletedEntityIds = new Set(
    runs
      .filter((run) => run.status === 'completed')
      .map((run) => run.entity_id)
      .filter(Boolean),
  )
  const completedRuns = latestRuns.filter((run) => run.status === 'completed')
  const failedRuns = latestRuns.filter((run) => run.status === 'failed')
  const retryableFailures = latestRuns.filter((run) => run.status === 'retrying').length
  const lastSuccessfulCanonicalRunAt = completedRuns
    .map((run) => run.completed_at || run.started_at)
    .filter(Boolean)
    .sort()
    .at(-1) || null

  return {
    universe_count: universeCount,
    total_scheduled: manifestCount || Number(progress?.total_scheduled || 0),
    completed: uniqueCompletedEntityIds.size || Number(progress?.completed || 0),
    failed: failedRuns.length || Number(progress?.failed || 0),
    retryable_failures: retryableFailures || Number(progress?.retryable_failures || 0),
    client_ready_dossiers: clientReadyCount,
    promoted_dossiers: clientReadyCount,
    last_successful_canonical_run_at: lastSuccessfulCanonicalRunAt || toText(progress?.last_successful_canonical_run_at) || null,
    health: 'idle',
    source: 'pipeline_runs',
    last_activity_at: lastSuccessfulCanonicalRunAt || null,
    quality_counts: qualityCounts,
    runtime_counts: {
      ...EMPTY_RUNTIME_COUNTS,
      running: latestRuns.filter((run) => run.status === 'running').length,
      queued: latestRuns.filter((run) => run.status === 'queued' || run.status === 'claiming').length,
      retryable: retryableFailures,
    },
  }
}

function buildLoopStatusFromProgress(
  universeCount: number,
  manifestCount: number,
  progress: ScaleProgress | null,
  clientReadyCount: number,
  lastActivityAt: string | null,
  qualityCounts: Record<DossierQualityState, number>,
): LoopStatus {
  return {
    universe_count: universeCount,
    total_scheduled: manifestCount || Number(progress?.total_scheduled || 0),
    completed: Number(progress?.completed || 0),
    failed: Number(progress?.failed || 0),
    retryable_failures: Number(progress?.retryable_failures || 0),
    client_ready_dossiers: clientReadyCount,
    promoted_dossiers: clientReadyCount,
    last_successful_canonical_run_at: toText(progress?.last_successful_canonical_run_at) || lastActivityAt || null,
    health: 'idle',
    source: 'diagnostics',
    last_activity_at: lastActivityAt,
    quality_counts: qualityCounts,
    runtime_counts: {
      ...EMPTY_RUNTIME_COUNTS,
      retryable: Number(progress?.retryable_failures || 0),
      stalled: Number(progress?.stalled || 0),
    },
  }
}

function normalizeLoopStatus(
  loopStatus: LoopStatus,
  universeCount: number,
  source: LoopSource,
  clientReadyCount: number,
  lastActivityAt: string | null,
  qualityCounts: Record<DossierQualityState, number>,
): LoopStatus {
  return {
    ...loopStatus,
    universe_count: loopStatus.universe_count || universeCount,
    client_ready_dossiers: clientReadyCount,
    promoted_dossiers: clientReadyCount,
    source,
    last_activity_at: lastActivityAt,
    quality_counts: qualityCounts,
    runtime_counts: {
      ...EMPTY_RUNTIME_COUNTS,
      ...(loopStatus.runtime_counts || {}),
    },
  }
}

function buildRuntimeCounts(
  queue: HomeQueueDashboardPayload['queue'],
  universeCount: number,
  blockedCount: number,
  base: Partial<Record<RuntimeState, number>> = {},
): Record<RuntimeState, number> {
  const completedEntities = queueItems(queue.completed_entities)
  const runningEntities = queueItems(queue.running_entities)
  const resumeNeededEntities = queueItems(queue.resume_needed_entities)
  const upcomingEntities = queueItems(queue.upcoming_entities)
  const stalledFromQueue = resumeNeededEntities.filter((item) => item.run_phase === 'stalled').length
  const retryableFromQueue = resumeNeededEntities.filter((item) => item.run_phase === 'retryable_failure').length
  const resumeFromQueue = resumeNeededEntities.filter((item) => item.run_phase === 'resume_needed').length
  const runningFromQueue = runningEntities.length > 0
    ? runningEntities.length
    : (queue.in_progress_entity ? 1 : 0)
  const completedCount = completedEntities.length
  const queuedFromBase = base.queued ?? 0
  const queuedFloor = Math.max(0, universeCount - completedCount - runningFromQueue - blockedCount)
  return {
    running: Math.max(base.running ?? 0, runningFromQueue),
    queued: Math.max(queuedFromBase, upcomingEntities.length, queuedFloor),
    stalled: Math.max(base.stalled ?? 0, stalledFromQueue),
    retryable: Math.max(base.retryable ?? 0, retryableFromQueue),
    resume_needed: Math.max(base.resume_needed ?? 0, resumeFromQueue),
  }
}

function computeLoopHealth(
  queue: HomeQueueDashboardPayload['queue'],
  lastActivityAt: string | null,
): LoopHealth {
  const lastActivityTs = parseTimestamp(lastActivityAt)
  if (lastActivityTs === null) return 'idle'
  if (Date.now() - lastActivityTs <= LOOP_ACTIVE_WINDOW_MS) return 'active'
  if (
    queue.in_progress_entity
    || queueItems(queue.upcoming_entities).length > 0
    || queueItems(queue.completed_entities).length > 0
  ) return 'stale'
  return 'idle'
}

function resolveManifestEntityRecord(
  entityId: string | null | undefined,
  entityName: string | null | undefined,
  manifestEntities: ManifestEntity[],
) {
  const normalizedId = toText(entityId)
  const normalizedName = toText(entityName).toLowerCase()
  return manifestEntities.find((entity) =>
    entity.entity_id === normalizedId
    || entity.entity_name.toLowerCase() === normalizedName,
  ) || null
}

function resolveCanonicalRuntimeEntity(
  entityId: string | null | undefined,
  entityName: string | null | undefined,
  canonicalEntities: any[],
) {
  const normalizedId = toText(entityId)
  const normalizedName = toText(entityName).toLowerCase()

  const exactIdMatch = canonicalEntities.find((entity) => matchesEntityUuid(entity, normalizedId))
  if (exactIdMatch) return exactIdMatch

  return canonicalEntities.find((entity) => {
    const candidateName = toText(entity?.properties?.name || entity?.name).toLowerCase()
    return Boolean(candidateName) && candidateName === normalizedName
  }) || null
}

function toRuntimeQueueRecord(
  runtimeRun: PipelineRuntimeRunRecord,
  manifestEntities: ManifestEntity[],
  canonicalEntities: any[],
): QueueEntityRecord {
  const manifestEntity = resolveManifestEntityRecord(runtimeRun.entity_id, runtimeRun.entity_name, manifestEntities)
  const canonicalEntity = resolveCanonicalRuntimeEntity(runtimeRun.canonical_entity_id || runtimeRun.entity_id, runtimeRun.entity_name, canonicalEntities)
  const canonicalEntityType = toText(
    canonicalEntity?.entity_type
    || canonicalEntity?.properties?.type
    || canonicalEntity?.labels?.[0],
  )
  return {
    entity_id: runtimeRun.canonical_entity_id || runtimeRun.entity_id,
    entity_name: manifestEntity?.entity_name || runtimeRun.entity_name,
    entity_type: manifestEntity?.entity_type || canonicalEntityType || 'Entity',
    state: 'in_progress',
    client_ready: false,
    promoted: false,
    summary: runtimeRun.current_question_text
      || runtimeRun.current_execution_state
      || runtimeRun.current_substep_label
      || runtimeRun.current_action
      || 'Canonical dossier run in progress',
    generated_at: runtimeRun.heartbeat_at || null,
    started_at: runtimeRun.heartbeat_at || null,
    active_question_id: runtimeRun.current_question_id,
    current_question_id: runtimeRun.current_question_id,
    current_question_text: runtimeRun.current_question_text || null,
    current_section_id: runtimeRun.current_section_id || null,
    current_section_label: runtimeRun.current_section_label || null,
    current_section_index: runtimeRun.current_section_index ?? null,
    current_section_total: runtimeRun.current_section_total ?? null,
    current_question_index: runtimeRun.current_question_index ?? null,
    current_question_total: runtimeRun.current_question_total ?? null,
    current_strategy_label: runtimeRun.current_strategy_label || null,
    current_execution_state: runtimeRun.current_execution_state || null,
    current_source_order: runtimeRun.current_source_order || null,
    current_substep_label: runtimeRun.current_substep_label || null,
    current_substep_progress: runtimeRun.current_substep_progress || null,
    next_action: runtimeRun.current_execution_state || runtimeRun.current_substep_label || runtimeRun.current_action,
    run_phase: runtimeRun.queue_state,
    publication_status: runtimeRun.publication_status,
    freshness_state: runtimeRun.heartbeat_age_seconds !== null && runtimeRun.heartbeat_age_seconds <= LOOP_ACTIVE_WINDOW_MS / 1000
      ? 'fresh'
      : 'stale',
    heartbeat_at: runtimeRun.heartbeat_at,
    heartbeat_age_seconds: runtimeRun.heartbeat_age_seconds,
    heartbeat_source: runtimeRun.heartbeat_at ? 'heartbeat_at' : null,
  }
}

function applyRuntimeOverride(
  selectedSource: QueueSourceSelection,
  runtimeCurrentLiveRun: PipelineRuntimeRunRecord | null,
  manifestEntities: ManifestEntity[],
  canonicalEntities: any[],
  universeCount: number,
  clientReadyCount: number,
  qualityCounts: Record<DossierQualityState, number>,
): QueueSourceSelection {
  if (!runtimeCurrentLiveRun) return selectedSource

  const liveQueueRecord = toRuntimeQueueRecord(runtimeCurrentLiveRun, manifestEntities, canonicalEntities)
  const runningEntities = [liveQueueRecord, ...queueItems(selectedSource.queue.running_entities)]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.entity_id === item.entity_id) === index)

  const nextQueue: HomeQueueDashboardPayload['queue'] = {
    ...selectedSource.queue,
    in_progress_entity: liveQueueRecord,
    running_entities: runningEntities.slice(0, 8),
  }

  const runtimeCounts = buildRuntimeCounts(
    nextQueue,
    universeCount,
    (qualityCounts.partial ?? 0) + (qualityCounts.blocked ?? 0),
    {
      ...selectedSource.loop_status.runtime_counts,
      running: Math.max(selectedSource.loop_status.runtime_counts.running ?? 0, 1),
    },
  )

  return {
    source: 'pipeline_runs',
    priority: Math.max(selectedSource.priority || 0, 3),
    last_activity_at: runtimeCurrentLiveRun.heartbeat_at || selectedSource.last_activity_at,
    queue: nextQueue,
    loop_status: {
      ...selectedSource.loop_status,
      universe_count: universeCount,
      client_ready_dossiers: clientReadyCount,
      promoted_dossiers: clientReadyCount,
      source: 'pipeline_runs',
      health: 'active',
      last_activity_at: runtimeCurrentLiveRun.heartbeat_at || selectedSource.last_activity_at,
      quality_counts: qualityCounts,
      runtime_counts: runtimeCounts,
    },
  }
}

function selectQueueSource(options: {
  control: Awaited<ReturnType<typeof readPipelineControlState>>
  universeCount: number
  manifestCount: number
  progress: ScaleProgress | null
  progressPath: string | null
  pipelineRuns: PipelineRunRecord[]
  diagnosticsQueue: HomeQueueDashboardPayload['queue']
  runsQueue: HomeQueueDashboardPayload['queue']
  snapshotQueue: HomeQueueDashboardPayload['queue'] | null | undefined
  snapshotLoopStatus: LoopStatus | null | undefined
  snapshotPath: string | null
  clientReadyCount: number
  qualityCounts: Record<DossierQualityState, number>
}): QueueSourceSelection {
  const {
    control,
    universeCount,
    manifestCount,
    progress,
    progressPath,
    pipelineRuns,
    diagnosticsQueue,
    runsQueue,
    snapshotQueue,
    snapshotLoopStatus,
    snapshotPath,
    clientReadyCount,
    qualityCounts,
  } = options

  const controlObservedState = toText(control.observed_state).toLowerCase()
  const controlTransitionState = toText(control.transition_state).toLowerCase()
  const preferLivePipelineRuns = controlObservedState === 'running' || controlTransitionState === 'starting' || controlTransitionState === 'stopping'
  const pipelineLastActivityAt = toIsoString(maxTimestamp(pipelineRuns.flatMap((run) => [run.completed_at, run.started_at])))
  const diagnosticsLastActivityAt = toIsoString(maxTimestamp([
    progress?.last_successful_canonical_run_at,
    progress?.generated_at,
    fileMtimeIso(progressPath),
    diagnosticsQueue.in_progress_entity?.generated_at,
    ...diagnosticsQueue.completed_entities.map((item) => item.generated_at),
  ]))
  const snapshotLastActivityAt = toIsoString(maxTimestamp([
    snapshotLoopStatus?.last_successful_canonical_run_at,
    fileMtimeIso(snapshotPath),
    snapshotQueue?.in_progress_entity?.generated_at,
    ...(snapshotQueue?.completed_entities || []).map((item) => item.generated_at),
  ]))

  const candidates: QueueSourceSelection[] = []

  if (pipelineRuns.length > 0) {
    candidates.push({
      source: 'pipeline_runs',
      queue: runsQueue,
      priority: preferLivePipelineRuns ? 2 : 0,
      loop_status: normalizeLoopStatus(
        buildLoopStatusFromRuns(universeCount, manifestCount, pipelineRuns, clientReadyCount, progress, qualityCounts),
        universeCount,
        'pipeline_runs',
        clientReadyCount,
        pipelineLastActivityAt,
        qualityCounts,
      ),
      last_activity_at: pipelineLastActivityAt,
    })
  }

  if (progress || diagnosticsQueue.in_progress_entity || diagnosticsQueue.completed_entities.length > 0) {
    candidates.push({
      source: 'diagnostics',
      queue: diagnosticsQueue,
      priority: 0,
      loop_status: normalizeLoopStatus(
        buildLoopStatusFromProgress(universeCount, manifestCount, progress, clientReadyCount, diagnosticsLastActivityAt, qualityCounts),
        universeCount,
        'diagnostics',
        clientReadyCount,
        diagnosticsLastActivityAt,
        qualityCounts,
      ),
      last_activity_at: diagnosticsLastActivityAt,
    })
  }

  if (snapshotQueue && snapshotLoopStatus) {
    candidates.push({
      source: 'snapshot',
      queue: snapshotQueue,
      priority: 0,
      loop_status: normalizeLoopStatus(snapshotLoopStatus, universeCount, 'snapshot', clientReadyCount, snapshotLastActivityAt, qualityCounts),
      last_activity_at: snapshotLastActivityAt,
    })
  }

  const selectedSource = candidates
    .sort((left, right) => {
      const priorityDelta = (right.priority || 0) - (left.priority || 0)
      if (priorityDelta !== 0) {
        return priorityDelta
      }
      const repairFocusDelta = Number(queueHasActiveRepairFocus(right.queue)) - Number(queueHasActiveRepairFocus(left.queue))
      if (repairFocusDelta !== 0) {
        return repairFocusDelta
      }
      return (parseTimestamp(right.last_activity_at) || 0) - (parseTimestamp(left.last_activity_at) || 0)
    })[0]

  if (selectedSource) {
    return {
      ...selectedSource,
      loop_status: {
        ...selectedSource.loop_status,
        health: computeLoopHealth(selectedSource.queue, selectedSource.last_activity_at),
      },
    }
  }

  return {
    source: 'snapshot',
    queue: {
      completed_entities: [],
      in_progress_entity: null,
      running_entities: [],
      stale_active_rows: [],
      resume_needed_entities: [],
      upcoming_entities: [],
    },
    loop_status: {
      universe_count: universeCount,
      total_scheduled: manifestCount,
      completed: 0,
      failed: 0,
      retryable_failures: 0,
      client_ready_dossiers: clientReadyCount,
      promoted_dossiers: clientReadyCount,
      last_successful_canonical_run_at: null,
      health: 'idle',
      source: 'snapshot',
      last_activity_at: null,
      quality_counts: qualityCounts,
      runtime_counts: EMPTY_RUNTIME_COUNTS,
    },
    last_activity_at: null,
    priority: 0,
  }
}

async function buildQueueStateFromDiagnostics(
  outputRoot: string,
  manifestEntities: ManifestEntity[],
  clientReadyIds: Set<string>,
): Promise<HomeQueueState> {
  const stateById = new Map<string, Record<string, any>>()
  const runArtifactById = new Map<string, string | null>()

  for (const entity of manifestEntities) {
    const entityDir = path.join(outputRoot, entity.entity_id)
    const statePath = firstFile(entityDir, '_state.json')
    if (!statePath) continue
    const state = tryReadJson(statePath)
    if (!state) continue
    stateById.set(entity.entity_id, state)
    runArtifactById.set(entity.entity_id, firstFile(entityDir, '_question_first_run_v2.json'))
  }

  const terminalPhases = new Set(['completed', 'failed'])
  let activeIndex = -1
  let highestMaterializedIndex = -1
  let inProgressPriority = -1
  const completed: Array<QueueEntityRecord & { sortTime: number }> = []
  let inProgress: QueueEntityRecord | null = null
  const runningEntities: QueueEntityRecord[] = []
  const resumeNeeded: QueueEntityRecord[] = []
  const lifecycleByEntityId = new Map<string, Awaited<ReturnType<typeof deriveEntityPipelineLifecycle>>>()

  await Promise.all(
    Array.from(stateById.keys()).map(async (entityId) => {
      lifecycleByEntityId.set(
        entityId,
        await deriveEntityPipelineLifecycle({ entityId }),
      )
    }),
  )

  for (const [index, entity] of manifestEntities.entries()) {
    const state = stateById.get(entity.entity_id)
    if (!state) continue
    highestMaterializedIndex = Math.max(highestMaterializedIndex, index)
    const runPhase = toText(state.run_phase)
    const activeQuestionId = toText(state.active_question_id) || null
    const lifecycle = lifecycleByEntityId.get(entity.entity_id)
    const clientReady = lifecycle?.client_ready || clientReadyIds.has(entity.entity_id)
    const artifactPath = runArtifactById.get(entity.entity_id)

    if (lifecycle?.stage === 'stalled' || lifecycle?.stage === 'retryable_failure' || lifecycle?.stage === 'resume_needed') {
      resumeNeeded.push({
        entity_id: entity.entity_id,
        entity_name: entity.entity_name,
        entity_type: entity.entity_type,
        state: 'resume_needed',
        client_ready: clientReady,
        promoted: clientReady,
        summary: lifecycle.summary,
        generated_at: lifecycle.latest_activity_at || null,
        active_question_id: state.active_question_id ? toText(state.active_question_id) : null,
        current_question_id: state.active_question_id ? toText(state.active_question_id) : null,
        next_action: state.active_question_id ? `Repair question ${state.active_question_id}` : 'Resume the pipeline',
        run_phase: runPhase,
        publication_status: lifecycle.publication_status,
        publication_mode: lifecycle.publication_mode,
        repair_state: lifecycle.repair_state,
        repair_retry_count: lifecycle.repair_retry_count,
        repair_retry_budget: lifecycle.repair_retry_budget,
        next_repair_question_id: lifecycle.next_repair_question_id,
        next_repair_status: lifecycle.next_repair_status,
        next_repair_batch_id: lifecycle.next_repair_batch_id,
        next_repair_batch_status: lifecycle.next_repair_batch_status,
        reconciliation_state: lifecycle.reconciliation_state,
      })
      continue
    }

    if (runPhase && !terminalPhases.has(runPhase)) {
      const candidatePriority = isActiveRepairFocus(lifecycle) ? 2 : 1
      const runningRecord: QueueEntityRecord = {
        entity_id: entity.entity_id,
        entity_name: entity.entity_name,
        entity_type: entity.entity_type,
        state: 'in_progress',
        client_ready: clientReady,
        promoted: clientReady,
        summary: lifecycle?.summary || (activeQuestionId ? `Running ${activeQuestionId}` : 'Canonical dossier run in progress'),
        generated_at: lifecycle?.latest_activity_at || null,
        active_question_id: activeQuestionId,
        current_question_id: activeQuestionId,
        next_action: activeQuestionId
          ? `Repair question ${activeQuestionId}`
          : 'Continue the active question',
        run_phase: runPhase,
        publication_status: lifecycle?.publication_status || null,
        publication_mode: lifecycle?.publication_mode || null,
        repair_state: lifecycle?.repair_state || null,
        repair_retry_count: lifecycle?.repair_retry_count ?? null,
        repair_retry_budget: lifecycle?.repair_retry_budget ?? null,
        next_repair_question_id: lifecycle?.next_repair_question_id || null,
        next_repair_status: lifecycle?.next_repair_status || null,
        next_repair_batch_id: lifecycle?.next_repair_batch_id || null,
        next_repair_batch_status: lifecycle?.next_repair_batch_status || null,
        reconciliation_state: lifecycle?.reconciliation_state || null,
      }
      runningEntities.push(runningRecord)
      if (candidatePriority > inProgressPriority || (candidatePriority === inProgressPriority && activeIndex === -1)) {
        activeIndex = index
        inProgressPriority = candidatePriority
        inProgress = runningRecord
      }
      continue
    }

    if (runPhase === 'completed' && artifactPath) {
      const mtimeMs = statSync(artifactPath).mtimeMs
      completed.push({
        entity_id: entity.entity_id,
        entity_name: entity.entity_name,
        entity_type: entity.entity_type,
        state: 'completed',
        client_ready: clientReady,
        promoted: clientReady,
        summary: lifecycle?.summary || (clientReady ? 'Client-ready dossier promoted' : 'Run completed. Not promoted to a client dossier yet.'),
        generated_at: lifecycle?.latest_activity_at || new Date(mtimeMs).toISOString(),
        current_question_id: null,
        next_action: 'Review the completed dossier',
        run_phase: runPhase,
        publication_status: lifecycle?.publication_status || null,
        publication_mode: lifecycle?.publication_mode || null,
        repair_state: lifecycle?.repair_state || null,
        repair_retry_count: lifecycle?.repair_retry_count ?? null,
        repair_retry_budget: lifecycle?.repair_retry_budget ?? null,
        next_repair_question_id: lifecycle?.next_repair_question_id || null,
        next_repair_status: lifecycle?.next_repair_status || null,
        next_repair_batch_id: lifecycle?.next_repair_batch_id || null,
        next_repair_batch_status: lifecycle?.next_repair_batch_status || null,
        reconciliation_state: lifecycle?.reconciliation_state || null,
        sortTime: mtimeMs,
      })
    }
  }

  completed.sort((left, right) => right.sortTime - left.sortTime)
  const boundaryIndex = activeIndex >= 0 ? activeIndex : highestMaterializedIndex
  const upcoming = manifestEntities
    .slice(boundaryIndex + 1)
    .filter((entity) => !stateById.has(entity.entity_id))
    .slice(0, 8)
    .map((entity) => ({
      entity_id: entity.entity_id,
      entity_name: entity.entity_name,
      entity_type: entity.entity_type,
      state: 'upcoming' as const,
      client_ready: false,
      promoted: false,
      summary: 'Waiting in the serialized live loop',
      generated_at: null,
    }))

  return {
    completed_entities: completed.slice(0, 6).map(({ sortTime: _sortTime, ...item }) => item),
    in_progress_entity: inProgress,
    running_entities: runningEntities.slice(0, 8),
    stale_active_rows: [],
    resume_needed_entities: resumeNeeded.slice(0, 6),
    upcoming_entities: upcoming,
  }
}

export async function buildHomeQueueDashboardPayload(options: BuildOptions = {}): Promise<HomeQueueDashboardPayload> {
  const appRoot = options.appRoot || process.cwd()
  const includeClientReadyDossiers = options.includeClientReadyDossiers ?? true
  const includeRfpCards = options.includeRfpCards ?? true
  const includeSalesSummary = options.includeSalesSummary ?? true
  const includeDossierQuality = options.includeDossierQuality ?? true
  const includeRolloutProofSet = options.includeRolloutProofSet ?? true
  const diagnosticsRoot = path.join(appRoot, 'tmp', 'question-first-diagnostics')
  const progressPath = latestFile(diagnosticsRoot, 'question_first_scale_progress.json')
  const progress = (progressPath ? tryReadJson(progressPath) : null) as ScaleProgress | null
  const outputRoot = progressPath ? path.dirname(progressPath) : diagnosticsRoot
  const liveQueueSnapshot = loadQuestionFirstLiveQueueSnapshot(appRoot) as LiveQueueSnapshot | null
  const snapshotPath = path.join(appRoot, 'backend', 'data', 'question_first_live_queue_snapshot.json')
  const manifestPayload = loadQuestionFirstScaleManifest(appRoot) as Record<string, unknown> | null
  const manifestEntities = Array.isArray(manifestPayload?.entities) ? manifestPayload.entities as ManifestEntity[] : []
  const normalizedUniverseCount = await getNormalizedUniverseCount()
  const dossierRoot = path.join(appRoot, 'backend', 'data', 'dossiers', 'question_first')
  const canonicalEntities = await getCanonicalEntitiesSnapshot()
  const orderedManifestEntities = sortQuestionFirstManifestEntities(manifestEntities, canonicalEntities)
  const playlistSortKey = describeQuestionFirstQueueOrder()
  const universeCount = normalizedUniverseCount ?? orderedManifestEntities.length
  const clientReadyStore = includeClientReadyDossiers || includeSalesSummary
    ? buildClientReadyDossiersStore(dossierRoot, canonicalEntities)
    : { cards: [] as ClientReadyDossierCard[], sales: [] as SalesSummaryItem[], ids: new Set<string>() }
  const { cards, sales, ids } = clientReadyStore
  const dossierQuality = includeDossierQuality
    ? await buildDossierQualityOverview(
        Array.from(new Set([dossierRoot, outputRoot].filter((value) => existsSync(value)))),
        canonicalEntities,
      )
    : {
        counts: { ...EMPTY_QUALITY_COUNTS },
        incomplete_entities: [] as DossierQualityCard[],
      }
  const rolloutProofSet = includeRolloutProofSet ? await buildRolloutProofSet(canonicalEntities) : []
  const rfpCards = includeRfpCards && options.opportunitiesFetcher ? await options.opportunitiesFetcher() : []
  const control = await readPipelineControlState()
  let runtimeCurrentLiveRun: PipelineRuntimeRunRecord | null = null
  let pipelineRuns: PipelineRunRecord[] = []
  let activeRepairRuns: PipelineRunRecord[] = []
  const processedDossierRows = await loadProcessedDossierRows(200)
  const processedEntities = mapProcessedDossierRowsToQueueEntities(processedDossierRows)
  const graphitiDossierIngestion = await loadGraphitiDossierIngestionStats().catch(() => ({
    canonical_entities_total: universeCount,
    dossiers_persisted_entities: 0,
    dossiers_ingested_entities: 0,
    partial_dossiers_ingested: 0,
    skipped_empty_entities: 0,
    failed_ingestions: 0,
    opportunity_worthy_entities: 0,
    failed_only_opportunities_active: 0,
  }))

  try {
    const runtimeReadSet = await loadPipelineRuntimeReadSet()
    const runtimeSnapshot = buildPipelineRuntimeSnapshot(runtimeReadSet)
    runtimeCurrentLiveRun = runtimeSnapshot.current_live_run
  } catch {
    runtimeCurrentLiveRun = null
  }

  try {
    pipelineRuns = await loadPipelineRuns(orderedManifestEntities.map((entity) => entity.entity_id))
  } catch {
    pipelineRuns = []
  }

  try {
    activeRepairRuns = await loadActiveRepairFocusRuns()
  } catch {
    activeRepairRuns = []
  }

  const dashboardEntities = [
    ...orderedManifestEntities,
    ...activeRepairRuns
      .filter((run) => !orderedManifestEntities.some((entity) => entity.entity_id === run.entity_id))
      .map((run) => {
        const metadata = (run.metadata && typeof run.metadata === 'object') ? run.metadata as Record<string, unknown> : {}
        return {
          entity_id: run.entity_id,
          entity_name: run.entity_name,
          entity_type: toText(metadata.entity_type) || 'UNKNOWN',
        }
      }),
  ]
  const allPipelineRuns = [...pipelineRuns, ...activeRepairRuns]
  const processedDossierCount = await loadProcessedDossierCount()

  const queue = allPipelineRuns.length > 0
    ? await buildQueueState(dashboardEntities, allPipelineRuns, ids)
    : await buildQueueStateFromDiagnostics(outputRoot, dashboardEntities, ids)
  const diagnosticsQueue = await buildQueueStateFromDiagnostics(outputRoot, dashboardEntities, ids)
  const publishedQueue = liveQueueSnapshot?.queue
  const publishedLoopStatus = liveQueueSnapshot?.loop_status
  const selectedSource = selectQueueSource({
    control,
    universeCount,
    manifestCount: orderedManifestEntities.length,
    progress,
    progressPath,
    pipelineRuns: allPipelineRuns,
    diagnosticsQueue,
    runsQueue: queue,
    snapshotQueue: publishedQueue,
    snapshotLoopStatus: publishedLoopStatus
      ? {
          ...publishedLoopStatus,
          health: 'idle',
          source: 'snapshot',
          last_activity_at: toText(publishedLoopStatus.last_successful_canonical_run_at) || fileMtimeIso(snapshotPath) || null,
        }
      : null,
    snapshotPath,
    clientReadyCount: cards.length,
    qualityCounts: dossierQuality.counts,
  })
  const runtimeSelectedSource = applyRuntimeOverride(
    selectedSource,
    runtimeCurrentLiveRun,
    dashboardEntities,
    canonicalEntities,
    universeCount,
    cards.length,
    dossierQuality.counts,
  )

  const blockedPipelineCount = (runtimeSelectedSource.loop_status.quality_counts.partial ?? 0) + (runtimeSelectedSource.loop_status.quality_counts.blocked ?? 0)
  const runtimeCounts = buildRuntimeCounts(
    runtimeSelectedSource.queue,
    universeCount,
    blockedPipelineCount,
    runtimeSelectedSource.loop_status.runtime_counts,
  )
  runtimeSelectedSource.loop_status = {
    ...runtimeSelectedSource.loop_status,
    universe_count: universeCount,
    processed_dossiers: processedDossierCount,
    runtime_counts: runtimeCounts,
  }

  return {
    control,
    playlist_sort_key: playlistSortKey,
    loop_status: runtimeSelectedSource.loop_status,
    queue: {
      ...runtimeSelectedSource.queue,
      processed_entities: processedEntities.slice(0, 200),
    },
    client_ready_dossiers: includeClientReadyDossiers ? cards.slice(0, 6) : [],
    rfp_cards: rfpCards.slice(0, 6),
    sales_summary: {
      status: includeSalesSummary && sales.length > 0 ? 'available' : 'empty',
      highlights: includeSalesSummary ? sales.slice(0, 6) : [],
    },
    graphiti_dossier_ingestion: {
      canonical_entities_total: graphitiDossierIngestion.canonical_entities_total,
      dossiers_persisted_entities: graphitiDossierIngestion.dossiers_persisted_entities,
      dossiers_ingested_entities: graphitiDossierIngestion.dossiers_ingested_entities,
      partial_dossiers_ingested: graphitiDossierIngestion.partial_dossiers_ingested,
      opportunity_worthy_entities: graphitiDossierIngestion.opportunity_worthy_entities,
      failed_only_opportunities_active: graphitiDossierIngestion.failed_only_opportunities_active,
    },
    dossier_quality: dossierQuality,
    rollout_proof_set: rolloutProofSet,
  }
}
