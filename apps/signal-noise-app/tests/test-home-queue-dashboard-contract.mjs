import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const homePageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
const dashboardSourcePath = new URL('../src/components/home/HomeQueueDashboard.tsx', import.meta.url)
const stripSourcePath = new URL('../src/components/layout/OperationalStatusStrip.tsx', import.meta.url)
const dashboardApiPath = new URL('../src/app/api/home/queue-dashboard/route.ts', import.meta.url)
const dashboardLoaderPath = new URL('../src/lib/home-queue-dashboard.ts', import.meta.url)
const queueDrilldownApiPath = new URL('../src/app/api/home/queue-drilldown/route.ts', import.meta.url)
const pipelineRuntimePath = new URL('../src/lib/pipeline-runtime.ts', import.meta.url)
const operationalHeroPath = new URL('../src/lib/operational-status-hero.ts', import.meta.url)
const workerSourcePath = new URL('../backend/entity_pipeline_worker.py', import.meta.url)

let dashboardSource = ''
let stripSource = ''
let dashboardApiSource = ''
let dashboardLoaderSource = ''
let queueDrilldownApiSource = ''
let pipelineRuntimeSource = ''
let operationalHeroSource = ''
let workerSource = ''
try {
  dashboardSource = readFileSync(dashboardSourcePath, 'utf8')
} catch {}
try {
  stripSource = readFileSync(stripSourcePath, 'utf8')
} catch {}
try {
  dashboardApiSource = readFileSync(dashboardApiPath, 'utf8')
} catch {}
try {
  dashboardLoaderSource = readFileSync(dashboardLoaderPath, 'utf8')
} catch {}
try {
  queueDrilldownApiSource = readFileSync(queueDrilldownApiPath, 'utf8')
} catch {}
try {
  pipelineRuntimeSource = readFileSync(pipelineRuntimePath, 'utf8')
} catch {}
try {
  operationalHeroSource = readFileSync(operationalHeroPath, 'utf8')
} catch {}
try {
  workerSource = readFileSync(workerSourcePath, 'utf8')
} catch {}

test('home page mounts the live queue dashboard instead of relying on the old static opportunity-only surface', () => {
  assert.match(homePageSource, /HomeQueueDashboard/)
  assert.doesNotMatch(homePageSource, /<TopOpportunities\s*\/?>/)
})

test('home queue dashboard renders loop status, queue lanes, client-ready dossiers, promoted opportunities, and graphiti sales synthesis', () => {
  assert.match(dashboardSource, /In progress now/)
  assert.match(dashboardSource, /Completed recently/)
  assert.match(dashboardSource, /Coming up next/)
  assert.match(dashboardSource, /Canonical entity/)
  assert.match(dashboardSource, /formatPlaylistSortKey\(playlist_sort_key\)/)
  assert.match(dashboardSource, /Repair run|Full run/)
  assert.match(dashboardSource, /Published degraded|Published healthy|Reconciliation pending/i)
  assert.match(dashboardSource, /Auto-repair queued|Repairing|Exhausted/i)
  assert.match(dashboardSource, /Next repair planned|Next repair queued|Next repair running/i)
  assert.match(dashboardSource, /Active follow-on repair|follow-on batch ready to inspect/i)
  assert.match(dashboardSource, /next repair batch/i)
  assert.match(dashboardSource, /Open next repair batch/i)
  assert.match(dashboardSource, /Client-ready dossiers/)
  assert.match(dashboardSource, /Promoted opportunities|RFP|Opportunity shortlist/)
  assert.match(dashboardSource, /Graphiti|sales brief|Yellow Panther/)
})

test('live ops strip exposes compact ignition mode with expand and minimize controls', () => {
  assert.match(stripSource, /Expand|Minimize/)
  assert.match(stripSource, /maxHeight:\s*isExpanded \? '40rem' : '7rem', padding: '0.7rem'/)
  assert.match(stripSource, /animate-marquee/)
  assert.match(stripSource, /isSafetyStop \? compactTicker : null/)
  assert.match(stripSource, /Completed/)
  assert.match(stripSource, /universePositionLabel/)
  assert.match(stripSource, /Fast MCP \${fastmcpHealth}/)
  assert.match(stripSource, /league_priority ASC/)
  assert.match(stripSource, /Running now/)
  assert.match(stripSource, /Blocked \/ partial/)
  assert.match(stripSource, /Current entity/)
  assert.match(stripSource, /Waiting|Starting|Stopping|Running|Paused|Repairing/)
  assert.match(stripSource, /Waiting for claimable work/)
  assert.match(stripSource, /buildOperationalStatusHero/)
  assert.match(stripSource, /Operational Snapshot/)
  assert.match(stripSource, /Position/)
  assert.match(stripSource, /Queue/)
  assert.match(stripSource, /Running entities/)
  assert.match(stripSource, /Stale \/ blocked/)
  assert.match(stripSource, /Completed/)
  assert.match(stripSource, /Recommended/)
  assert.match(stripSource, /runtimeCheckpointFailed/)
  assert.match(stripSource, /getOperationalStopDetails/)
  assert.match(stripSource, /Issue detected/)
  assert.match(stripSource, /System details/)
  assert.match(stripSource, /Current question:/)
  assert.match(stripSource, /Historical stale rows/)
  assert.doesNotMatch(stripSource, /Backlog diagnostics: stale rows/)
  assert.doesNotMatch(stripSource, /Show run details|Hide run details/)
  assert.doesNotMatch(stripSource, /requested: .*acknowledged: .*running: .*paused:/i)
  assert.doesNotMatch(stripSource, /No entity is actively running right now/)
  assert.doesNotMatch(stripSource, /No entities are currently running\./)
  assert.doesNotMatch(stripSource, /Start pipeline intake|Stop pipeline intake/)
})

test('home queue dashboard API exposes the normalized payload contract for loop status, queue, dossiers, rfp cards, and sales summary', () => {
  assert.match(dashboardApiSource, /live_operational/)
  assert.match(dashboardApiSource, /operational_state/)
  assert.match(dashboardApiSource, /freshness_state/)
  assert.match(dashboardApiSource, /loop_status/)
  assert.match(dashboardApiSource, /processed_dossiers/)
  assert.match(dashboardApiSource, /processed_entities/)
  assert.match(dashboardApiSource, /runtime_counts/)
  assert.match(dashboardApiSource, /completed_entities/)
  assert.match(dashboardApiSource, /in_progress_entity/)
  assert.match(dashboardApiSource, /resume_needed_entities/)
  assert.match(dashboardApiSource, /upcoming_entities/)
  assert.match(dashboardApiSource, /client_ready_dossiers/)
  assert.match(dashboardApiSource, /rfp_cards/)
  assert.match(dashboardApiSource, /sales_summary/)
  assert.match(dashboardApiSource, /dossier_quality/)
  assert.match(dashboardApiSource, /rollout_proof_set/)
  assert.match(dashboardApiSource, /loadGraphitiOpportunitiesFromDb/)
  assert.doesNotMatch(dashboardApiSource, /api\/tenders/)
})

test('home queue dashboard drilldown contract carries ignition control state and active-question detail', () => {
  assert.match(dashboardLoaderSource, /control/)
  assert.match(dashboardLoaderSource, /desired_state/)
  assert.match(dashboardLoaderSource, /requested_state/)
  assert.match(dashboardLoaderSource, /observed_state/)
  assert.match(dashboardLoaderSource, /transition_state/)
  assert.match(dashboardLoaderSource, /active_question_id/)
  assert.match(dashboardLoaderSource, /current_question_id/)
  assert.match(dashboardLoaderSource, /current_section_label/)
  assert.match(dashboardLoaderSource, /current_question_index/)
  assert.match(dashboardLoaderSource, /current_strategy_label/)
  assert.match(dashboardLoaderSource, /current_execution_state/)
  assert.match(dashboardLoaderSource, /next_repair_batch_id/)
  assert.match(dashboardLoaderSource, /next_action|Next action/)
})

test('home queue dashboard payload includes dossier quality counts and incomplete artifacts', () => {
  assert.match(dashboardSource, /Running now/)
  assert.match(dashboardSource, /Resume needed/)
  assert.match(dashboardSource, /Needs full-pack completion/)
  assert.doesNotMatch(dashboardSource, /Rollout proof set/)
  assert.match(dashboardSource, /Queue this entity/)
  assert.match(dashboardLoaderSource, /quality_counts/)
  assert.match(dashboardLoaderSource, /runtime_counts/)
  assert.match(dashboardLoaderSource, /resume_needed_entities/)
  assert.match(dashboardLoaderSource, /buildRuntimeCounts/)
  assert.match(dashboardLoaderSource, /buildDossierQualityOverview/)
  assert.match(dashboardLoaderSource, /rollout_proof_set/)
  assert.match(dashboardLoaderSource, /incomplete_entities/)
  assert.match(dashboardLoaderSource, /publication_status/)
  assert.match(dashboardLoaderSource, /publication_mode/)
  assert.match(dashboardLoaderSource, /next_repair_status/)
  assert.match(dashboardLoaderSource, /next_repair_batch_id/)
  assert.match(dashboardLoaderSource, /isActiveRepairFocus/)
})

test('home queue dashboard loader prefers persisted pipeline runs and keeps manifest ordering for production queue state', () => {
  assert.match(dashboardLoaderSource, /cachedEntitiesSupabase as supabase/)
  assert.match(dashboardLoaderSource, /\.from\('entity_pipeline_runs'\)/)
  assert.match(dashboardLoaderSource, /buildLoopStatusFromRuns/)
  assert.match(dashboardLoaderSource, /buildQueueStateFromDiagnostics/)
  assert.match(dashboardLoaderSource, /sortQuestionFirstManifestEntities\(manifestEntities, canonicalEntities\)/)
  assert.match(dashboardLoaderSource, /orderedManifestEntities\.map\(\(entity\) => entity\.entity_id\)/)
  assert.match(dashboardLoaderSource, /loadPipelineRuntimeReadSet/)
  assert.match(dashboardLoaderSource, /buildPipelineRuntimeSnapshot/)
  assert.match(dashboardLoaderSource, /current_live_run/)
  assert.match(dashboardLoaderSource, /applyRuntimeOverride/)
})

test('live progress projection uses nested phase metadata instead of stale worker placeholders', () => {
  assert.match(pipelineRuntimeSource, /export function buildPipelineRuntimeRunRecord/)
  assert.match(pipelineRuntimeSource, /phase_details_by_phase/)
  assert.match(pipelineRuntimeSource, /selectWorkerReferencedRun/)
  assert.match(pipelineRuntimeSource, /currentLiveRun = workerReferencedRun \?\? selectCurrentLiveRun\(runtimeRecords\)/)
  assert.match(queueDrilldownApiSource, /buildPipelineRuntimeRunRecord/)
  assert.match(queueDrilldownApiSource, /current_section_label: runtimeRecord\.current_section_label/)
  assert.match(queueDrilldownApiSource, /current_substep_progress: runtimeRecord\.current_substep_progress/)
  assert.match(queueDrilldownApiSource, /current_strategy_label: runtimeRecord\.current_strategy_label/)
  assert.match(queueDrilldownApiSource, /execution_backend: runtimeRecord\.execution_backend/)
  assert.match(operationalHeroSource, /Pipeline intake/)
  assert.match(operationalHeroSource, /Current activity/)
  assert.doesNotMatch(operationalHeroSource, /pushDetailRow\('Requested'/)
  assert.doesNotMatch(operationalHeroSource, /pushDetailRow\('Activity'/)
})

test('pipeline runtime loads live running rows before queued backlog rows', () => {
  assert.match(
    pipelineRuntimeSource,
    /CASE status\s+WHEN 'running' THEN 0\s+WHEN 'retrying' THEN 1\s+WHEN 'reconciling' THEN 2\s+WHEN 'queued' THEN 3/s,
  )
  assert.doesNotMatch(
    pipelineRuntimeSource,
    /\.in\('status', \['running', 'queued', 'retrying', 'reconciling'\]\)\s*\.order\('started_at'/,
  )
})

test('entity pipeline worker promotes claimed runs to dossier generation before backend calls', () => {
  assert.match(workerSource, /"phase": "dossier_generation"/)
  assert.match(workerSource, /run = \{\s+\*\*run,\s+"status": "running",\s+"phase": "dossier_generation"/)
  assert.match(workerSource, /result = self\.call_pipeline\(run, batch_id\)/)
  assert.match(workerSource, /"failure_class"] = "entity_pipeline_timeout"/)
  assert.match(workerSource, /"continue_pipeline_on_failure"] = True/)
})

test('auto-advance batches preserve canonical entity identity for dashboard and claim tooling', () => {
  assert.match(workerSource, /"auto_advance_target_entity_id": next_entity_id/)
  assert.match(workerSource, /"entity_id": next_entity_id/)
  assert.match(workerSource, /"canonical_entity_id": canonical_entity_id or next_entity_id/)
  assert.match(workerSource, /"entity_name": next_entity_name/)
  assert.match(workerSource, /"entity_type": next_entity_type/)
  assert.match(queueDrilldownApiSource, /auto_advance_target_entity_id/)
  assert.match(queueDrilldownApiSource, /normalizeQueueIdentity/)
})

test('home dashboard exposes the canonical universe as a virtual queue with lazy rendering', () => {
  assert.doesNotMatch(queueDrilldownApiSource, /const upcomingEntities = canonicalManifestEntities\s*\.filter\([^)]*\)\s*\.slice\(0, 8\)/)
  assert.match(queueDrilldownApiSource, /canonicalQueuePositionByEntityId\.get\(entity\.entity_id\)/)
  assert.match(queueDrilldownApiSource, /question_first_canonical_sequence\.json/)
  assert.match(queueDrilldownApiSource, /loadCanonicalSequenceEntityIds/)
  assert.match(queueDrilldownApiSource, /saveCanonicalSequenceEntityIds/)
  assert.match(queueDrilldownApiSource, /buildCanonicalSequencePositionMap/)
  assert.match(queueDrilldownApiSource, /processedRows/)
  assert.match(queueDrilldownApiSource, /effectiveUniverseCount/)
  assert.match(dashboardSource, /visibleUpcomingCount/)
  assert.match(dashboardSource, /Show more queued entities/)
  assert.match(dashboardSource, /queue\.upcoming_entities\.slice\(0, visibleUpcomingCount\)/)
})

test('home queue dashboard loader keeps the published snapshot as fallback-only and computes live loop health from runtime timestamps', () => {
  assert.match(dashboardLoaderSource, /question_first_live_queue_snapshot\.json/)
  assert.match(dashboardLoaderSource, /loadQuestionFirstLiveQueueSnapshot/)
  assert.match(dashboardLoaderSource, /loadQuestionFirstScaleManifest/)
  assert.doesNotMatch(dashboardLoaderSource, /loop_status:\s*publishedLoopStatus\s*\|\|/)
  assert.doesNotMatch(dashboardLoaderSource, /queue:\s*publishedQueue\s*\|\|/)
  assert.match(dashboardLoaderSource, /health:\s*'/)
  assert.match(dashboardLoaderSource, /last_activity_at/)
  assert.match(dashboardLoaderSource, /selectQueueSource\(/)
  assert.match(dashboardLoaderSource, /loop_status:\s*runtimeSelectedSource\.loop_status/)
  assert.match(dashboardLoaderSource, /processed_entities:\s*processedEntities/)
  assert.match(dashboardLoaderSource, /queue:\s*\{\s*\.\.\.runtimeSelectedSource\.queue,/)
})

test('home queue dashboard UI reflects computed loop health instead of always claiming active looping', () => {
  assert.doesNotMatch(dashboardSource, /Continuous loop active over current validated universe/)
  assert.match(dashboardSource, /Loop active|Loop stalled|Loop idle/)
  assert.match(dashboardSource, /Source of truth|runtime source|Last observed activity/i)
  assert.match(dashboardSource, /subscribeOperationalDrilldown/)
  assert.match(dashboardSource, /startOperationalDrilldownPolling/)
  assert.match(dashboardSource, /loadOperationalDrilldownPayload/)
  assert.match(dashboardSource, /refreshOperationalDrilldownPayload/)
  assert.doesNotMatch(dashboardSource, /window\.setInterval\(/)
  assert.match(dashboardSource, /Operational snapshot is stale/)
  assert.match(dashboardSource, /current section:/i)
  assert.match(dashboardSource, /current question:/i)
  assert.match(dashboardSource, /question progress:/i)
  assert.match(dashboardSource, /execution:/i)
  assert.match(dashboardSource, /strategy:/i)
})
