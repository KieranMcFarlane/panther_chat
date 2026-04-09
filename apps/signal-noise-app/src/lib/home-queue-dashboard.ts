import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import liveQueueSnapshotData from '../../backend/data/question_first_live_queue_snapshot.json'
import scaleManifestData from '../../backend/data/question_first_scale_batch_3000_live.json'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { matchesEntityUuid, resolveEntityUuid } from '@/lib/entity-public-id'
import { normalizeQuestionFirstDossier } from '@/lib/question-first-dossier'

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
  state: 'completed' | 'in_progress' | 'upcoming'
  client_ready: boolean
  promoted: boolean
  summary: string | null
  generated_at: string | null
  active_question_id?: string | null
  run_phase?: string | null
}

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

export type HomeQueueDashboardPayload = {
  loop_status: {
    total_scheduled: number
    completed: number
    failed: number
    retryable_failures: number
    client_ready_dossiers: number
    promoted_dossiers: number
    last_successful_canonical_run_at: string | null
  }
  queue: {
    completed_entities: QueueEntityRecord[]
    in_progress_entity: QueueEntityRecord | null
    upcoming_entities: QueueEntityRecord[]
  }
  client_ready_dossiers: ClientReadyDossierCard[]
  rfp_cards: RfpCard[]
  sales_summary: {
    status: 'available' | 'empty'
    highlights: SalesSummaryItem[]
  }
}

type BuildOptions = {
  appRoot?: string
  tendersFetcher?: () => Promise<RfpCard[]>
}

type LiveQueueSnapshot = {
  loop_status?: HomeQueueDashboardPayload['loop_status']
  queue?: HomeQueueDashboardPayload['queue']
}

type PipelineRunRecord = {
  entity_id: string
  entity_name: string
  status: 'queued' | 'claiming' | 'running' | 'retrying' | 'completed' | 'failed'
  phase: string | null
  completed_at: string | null
  started_at: string
  metadata?: Record<string, unknown> | null
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
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

function buildQueueState(
  manifestEntities: ManifestEntity[],
  runs: PipelineRunRecord[],
  clientReadyIds: Set<string>,
): HomeQueueDashboardPayload['queue'] {
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
  let inProgress: QueueEntityRecord | null = null
  const completed: Array<QueueEntityRecord & { sortTime: number }> = []

  for (const [index, entity] of manifestEntities.entries()) {
    const run = latestRunById.get(entity.entity_id)
    if (!run) continue
    const clientReady = clientReadyIds.has(entity.entity_id)
    const phase = toText(run.phase) || null
    const summaryPhase = phase ? `Running ${phase}` : 'Canonical dossier run in progress'

    highestProcessedIndex = Math.max(highestProcessedIndex, index)

    if (activeStatuses.has(run.status)) {
      if (activeIndex === -1) {
        activeIndex = index
        inProgress = {
          entity_id: entity.entity_id,
          entity_name: entity.entity_name,
          entity_type: entity.entity_type,
          state: 'in_progress',
          client_ready: clientReady,
          promoted: clientReady,
          summary: summaryPhase,
          generated_at: null,
          active_question_id: phase,
          run_phase: run.status,
        }
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
        summary: clientReady ? 'Client-ready dossier promoted' : 'Run completed. Not promoted to a client dossier yet.',
        generated_at: run.completed_at || run.started_at || null,
        run_phase: run.status,
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
    }))

  return {
    completed_entities: completed.slice(0, 6).map(({ sortTime: _sortTime, ...item }) => item),
    in_progress_entity: inProgress,
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
      .select('entity_id, entity_name, status, phase, completed_at, started_at, metadata')
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

function buildLoopStatusFromRuns(
  manifestCount: number,
  runs: PipelineRunRecord[],
  clientReadyCount: number,
  progress: ScaleProgress | null,
): HomeQueueDashboardPayload['loop_status'] {
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
  const completedRuns = latestRuns.filter((run) => run.status === 'completed')
  const failedRuns = latestRuns.filter((run) => run.status === 'failed')
  const retryableFailures = latestRuns.filter((run) => run.status === 'retrying').length
  const lastSuccessfulCanonicalRunAt = completedRuns
    .map((run) => run.completed_at || run.started_at)
    .filter(Boolean)
    .sort()
    .at(-1) || null

  return {
    total_scheduled: manifestCount || Number(progress?.total_scheduled || 0),
    completed: completedRuns.length || Number(progress?.completed || 0),
    failed: failedRuns.length || Number(progress?.failed || 0),
    retryable_failures: retryableFailures || Number(progress?.retryable_failures || 0),
    client_ready_dossiers: clientReadyCount,
    promoted_dossiers: clientReadyCount,
    last_successful_canonical_run_at: lastSuccessfulCanonicalRunAt || toText(progress?.last_successful_canonical_run_at) || null,
  }
}

function buildQueueStateFromDiagnostics(
  outputRoot: string,
  manifestEntities: ManifestEntity[],
  clientReadyIds: Set<string>,
): HomeQueueDashboardPayload['queue'] {
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
  const completed: Array<QueueEntityRecord & { sortTime: number }> = []
  let inProgress: QueueEntityRecord | null = null

  for (const [index, entity] of manifestEntities.entries()) {
    const state = stateById.get(entity.entity_id)
    if (!state) continue
    highestMaterializedIndex = Math.max(highestMaterializedIndex, index)
    const runPhase = toText(state.run_phase)
    const activeQuestionId = toText(state.active_question_id) || null
    const clientReady = clientReadyIds.has(entity.entity_id)
    const artifactPath = runArtifactById.get(entity.entity_id)

    if (runPhase && !terminalPhases.has(runPhase)) {
      activeIndex = index
      inProgress = {
        entity_id: entity.entity_id,
        entity_name: entity.entity_name,
        entity_type: entity.entity_type,
        state: 'in_progress',
        client_ready: clientReady,
        promoted: clientReady,
        summary: activeQuestionId ? `Running ${activeQuestionId}` : 'Canonical dossier run in progress',
        generated_at: null,
        active_question_id: activeQuestionId,
        run_phase: runPhase,
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
        summary: clientReady ? 'Client-ready dossier promoted' : 'Run completed. Not promoted to a client dossier yet.',
        generated_at: new Date(mtimeMs).toISOString(),
        run_phase: runPhase,
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
    upcoming_entities: upcoming,
  }
}

export async function buildHomeQueueDashboardPayload(options: BuildOptions = {}): Promise<HomeQueueDashboardPayload> {
  const appRoot = options.appRoot || process.cwd()
  const diagnosticsRoot = path.join(appRoot, 'tmp', 'question-first-diagnostics')
  const progressPath = latestFile(diagnosticsRoot, 'question_first_scale_progress.json')
  const progress = (progressPath ? tryReadJson(progressPath) : null) as ScaleProgress | null
  const outputRoot = progressPath ? path.dirname(progressPath) : diagnosticsRoot
  const liveQueueSnapshot = (liveQueueSnapshotData || null) as LiveQueueSnapshot | null
  const manifestPayload = (scaleManifestData || null) as Record<string, unknown> | null
  const manifestEntities = Array.isArray(manifestPayload?.entities) ? manifestPayload.entities as ManifestEntity[] : []
  const dossierRoot = path.join(appRoot, 'backend', 'data', 'dossiers', 'question_first')
  const canonicalEntities = await getCanonicalEntitiesSnapshot()
  const { cards, sales, ids } = buildClientReadyDossiersStore(dossierRoot, canonicalEntities)
  const rfpCards = options.tendersFetcher ? await options.tendersFetcher() : []
  let pipelineRuns: PipelineRunRecord[] = []

  try {
    pipelineRuns = await loadPipelineRuns(manifestEntities.map((entity) => entity.entity_id))
  } catch {
    pipelineRuns = []
  }

  const queue = pipelineRuns.length > 0
    ? buildQueueState(manifestEntities, pipelineRuns, ids)
    : buildQueueStateFromDiagnostics(outputRoot, manifestEntities, ids)
  const publishedQueue = liveQueueSnapshot?.queue
  const publishedLoopStatus = liveQueueSnapshot?.loop_status

  return {
    loop_status: publishedLoopStatus || buildLoopStatusFromRuns(manifestEntities.length, pipelineRuns, cards.length, progress),
    queue: publishedQueue || queue,
    client_ready_dossiers: cards.slice(0, 6),
    rfp_cards: rfpCards.slice(0, 6),
    sales_summary: {
      status: sales.length > 0 ? 'available' : 'empty',
      highlights: sales.slice(0, 6),
    },
  }
}
