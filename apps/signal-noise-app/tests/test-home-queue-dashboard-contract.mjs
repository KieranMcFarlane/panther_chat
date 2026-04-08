import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const homePageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
const dashboardSourcePath = new URL('../src/components/home/HomeQueueDashboard.tsx', import.meta.url)
const dashboardApiPath = new URL('../src/app/api/home/queue-dashboard/route.ts', import.meta.url)
const dashboardLoaderPath = new URL('../src/lib/home-queue-dashboard.ts', import.meta.url)

let dashboardSource = ''
let dashboardApiSource = ''
let dashboardLoaderSource = ''
try {
  dashboardSource = readFileSync(dashboardSourcePath, 'utf8')
} catch {}
try {
  dashboardApiSource = readFileSync(dashboardApiPath, 'utf8')
} catch {}
try {
  dashboardLoaderSource = readFileSync(dashboardLoaderPath, 'utf8')
} catch {}

test('home page mounts the live queue dashboard instead of relying on the old static opportunity-only surface', () => {
  assert.match(homePageSource, /HomeQueueDashboard/)
  assert.doesNotMatch(homePageSource, /<TopOpportunities\s*\/?>/)
})

test('home queue dashboard renders loop status, queue lanes, client-ready dossiers, promoted opportunities, and graphiti sales synthesis', () => {
  assert.match(dashboardSource, /In progress now/)
  assert.match(dashboardSource, /Completed recently/)
  assert.match(dashboardSource, /Coming up next/)
  assert.match(dashboardSource, /Client-ready dossiers/)
  assert.match(dashboardSource, /Promoted opportunities|RFP|Opportunity shortlist/)
  assert.match(dashboardSource, /Graphiti|sales brief|Yellow Panther/)
})

test('home queue dashboard API exposes the normalized payload contract for loop status, queue, dossiers, rfp cards, and sales summary', () => {
  assert.match(dashboardApiSource, /loop_status/)
  assert.match(dashboardApiSource, /completed_entities/)
  assert.match(dashboardApiSource, /in_progress_entity/)
  assert.match(dashboardApiSource, /upcoming_entities/)
  assert.match(dashboardApiSource, /client_ready_dossiers/)
  assert.match(dashboardApiSource, /rfp_cards/)
  assert.match(dashboardApiSource, /sales_summary/)
  assert.match(dashboardApiSource, /promoted_only=true/)
})

test('home queue dashboard loader prefers Supabase pipeline runs and keeps manifest ordering for production queue state', () => {
  assert.match(dashboardLoaderSource, /cachedEntitiesSupabase as supabase/)
  assert.match(dashboardLoaderSource, /\.from\('entity_pipeline_runs'\)/)
  assert.match(dashboardLoaderSource, /buildLoopStatusFromRuns/)
  assert.match(dashboardLoaderSource, /buildQueueStateFromDiagnostics/)
  assert.match(dashboardLoaderSource, /manifestEntities\.map\(\(entity\) => entity\.entity_id\)/)
})
