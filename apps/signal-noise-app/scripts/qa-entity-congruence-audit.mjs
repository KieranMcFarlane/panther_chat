#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const FAIL_ON_ERRORS = !args.includes('--no-fail')
const AS_JSON = args.includes('--json')
const JSON_OUTPUT_PATH = readArgValue(args, '--out')
const SUMMARY_MD_PATH = readArgValue(args, '--summary-md')
const BASELINE_OVERRIDE_PATH = readArgValue(args, '--baseline')
const REQUIRE_BASELINE = args.includes('--require-baseline')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables.')
  process.exit(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const IPL_TEAMS = [
  'Chennai Super Kings',
  'Delhi Capitals',
  'Gujarat Titans',
  'Kolkata Knight Riders',
  'Lucknow Super Giants',
  'Mumbai Indians',
  'Punjab Kings',
  'Rajasthan Royals',
  'Royal Challengers Bengaluru',
  'Sunrisers Hyderabad',
]

const EPL_SEEDS = [
  'Premier League',
  'Arsenal',
  'Chelsea',
  'Liverpool',
  'Manchester City',
]

const BUNDESLIGA_SEEDS = [
  'Bundesliga',
  'Bayern Munich',
  'Borussia Dortmund',
  'RB Leipzig',
  'Bayer Leverkusen',
]

function readArgValue(argv, flag) {
  const index = argv.indexOf(flag)
  if (index === -1) return null
  return argv[index + 1] || null
}

function readBaseline() {
  const resolved = path.resolve(BASELINE_OVERRIDE_PATH || 'config/entity-congruence-baseline.json')
  if (!fs.existsSync(resolved)) return { path: resolved, data: null }
  try {
    const raw = fs.readFileSync(resolved, 'utf8')
    return { path: resolved, data: JSON.parse(raw) }
  } catch {
    return { path: resolved, data: null }
  }
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readObject(value) {
  return typeof value === 'object' && value !== null ? value : {}
}

async function fetchAll(table, columns, chunk = 1000) {
  const rows = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(offset, offset + chunk - 1)
    if (error) throw error
    const page = data || []
    rows.push(...page)
    if (page.length < chunk) break
    offset += chunk
  }
  return rows
}

function embeddingId(row) {
  const metadata = readObject(row.metadata)
  return String(metadata.neo4j_id || metadata.graph_id || metadata.node_id || row.entity_id || '')
}

function embeddingName(row) {
  const metadata = readObject(row.metadata)
  const props = readObject(metadata.properties)
  return String(props.name || row.name || metadata.name || metadata.entity_name || '').trim()
}

function cachedStableId(row) {
  return String(row.graph_id || row.neo4j_id || row.id || '')
}

function cachedName(row) {
  const props = readObject(row.properties)
  return String(props.name || '').trim()
}

async function run() {
  const [cached, embeddings] = await Promise.all([
    fetchAll('cached_entities', 'id,graph_id,neo4j_id,properties'),
    fetchAll('entity_embeddings', 'entity_id,name,metadata'),
  ])

  const cachedById = new Map()
  const cachedNames = new Set()
  for (const row of cached) {
    cachedById.set(cachedStableId(row), row)
    const nameNorm = normalizeText(cachedName(row))
    if (nameNorm) cachedNames.add(nameNorm)
  }

  const embeddingIds = new Set()
  const missingByName = new Set()
  let idNameMismatches = 0

  for (const row of embeddings) {
    const id = embeddingId(row)
    const embNameNorm = normalizeText(embeddingName(row))
    embeddingIds.add(id)

    const cachedRow = cachedById.get(id)
    if (cachedRow) {
      const cachedNameNorm = normalizeText(cachedName(cachedRow))
      if (embNameNorm && cachedNameNorm && embNameNorm !== cachedNameNorm) idNameMismatches += 1
    }

    if (embNameNorm && !cachedNames.has(embNameNorm) && !cachedRow) {
      missingByName.add(embNameNorm)
    }
  }

  const overlapById = cached.filter((row) => embeddingIds.has(cachedStableId(row))).length
  const overlapPct = embeddings.length ? overlapById / embeddings.length : 1

  const missingIplTeams = IPL_TEAMS.filter((team) => !cachedNames.has(normalizeText(team)))
  const presentIplCount = IPL_TEAMS.length - missingIplTeams.length
  const missingEplSeeds = EPL_SEEDS.filter((name) => !cachedNames.has(normalizeText(name)))
  const presentEplCount = EPL_SEEDS.length - missingEplSeeds.length
  const missingBundesligaSeeds = BUNDESLIGA_SEEDS.filter((name) => !cachedNames.has(normalizeText(name)))
  const presentBundesligaCount = BUNDESLIGA_SEEDS.length - missingBundesligaSeeds.length

  const checks = [
    {
      id: 'embedding_id_overlap',
      ok: overlapPct >= 0.95,
      details: {
        overlap_by_graph_id: overlapById,
        embedding_total: embeddings.length,
        pct: Number((overlapPct * 100).toFixed(2)),
        threshold_pct: 95,
      },
    },
    {
      id: 'normalized_names_missing_rate',
      ok: missingByName.size <= 25,
      details: {
        missing_normalized_names: missingByName.size,
        threshold: 25,
      },
    },
    {
      id: 'id_name_mismatch_threshold',
      ok: idNameMismatches <= 1200,
      details: {
        id_name_mismatches: idNameMismatches,
        threshold: 1200,
      },
    },
    {
      id: 'ipl_seed_presence',
      ok: missingIplTeams.length === 0,
      details: {
        present: presentIplCount,
        total: IPL_TEAMS.length,
        missing: missingIplTeams,
      },
    },
    {
      id: 'epl_seed_presence',
      ok: presentEplCount / EPL_SEEDS.length >= 0.8,
      details: {
        present: presentEplCount,
        total: EPL_SEEDS.length,
        threshold_pct: 80,
        missing: missingEplSeeds,
      },
    },
    {
      id: 'bundesliga_seed_presence',
      ok: presentBundesligaCount / BUNDESLIGA_SEEDS.length >= 0.8,
      details: {
        present: presentBundesligaCount,
        total: BUNDESLIGA_SEEDS.length,
        threshold_pct: 80,
        missing: missingBundesligaSeeds,
      },
    },
  ]

  const baseline = readBaseline()
  if (REQUIRE_BASELINE && !baseline.data) {
    checks.push({
      id: 'baseline_loaded',
      ok: false,
      details: {
        required: true,
        loaded: false,
        path: baseline.path,
      },
    })
  }

  if (baseline.data?.metrics && baseline.data?.allowed_regression) {
    const metrics = baseline.data.metrics
    const allowed = baseline.data.allowed_regression

    const baselineIdMismatch = Number(metrics.id_name_mismatches ?? 0)
    const baselineMissingNames = Number(metrics.normalized_names_missing ?? 0)
    const baselineOverlapPct = Number(metrics.overlap_pct ?? 0)
    const baselineIplPresent = Number(metrics.ipl_present ?? 0)
    const baselineEplPresent = Number(metrics.epl_present ?? 0)
    const baselineBundesligaPresent = Number(metrics.bundesliga_present ?? 0)

    const allowedMismatchIncrease = Number(allowed.id_name_mismatches ?? 0)
    const allowedMissingNamesIncrease = Number(allowed.normalized_names_missing ?? 0)
    const allowedOverlapPctDrop = Number(allowed.overlap_pct ?? 0)
    const allowedIplDrop = Number(allowed.ipl_present ?? 0)
    const allowedEplDrop = Number(allowed.epl_present ?? 0)
    const allowedBundesligaDrop = Number(allowed.bundesliga_present ?? 0)

    const overlapPctPoints = Number((overlapPct * 100).toFixed(2))
    const overlapDrop = Number((baselineOverlapPct - overlapPctPoints).toFixed(2))
    const mismatchIncrease = idNameMismatches - baselineIdMismatch
    const missingNamesIncrease = missingByName.size - baselineMissingNames
    const iplDrop = baselineIplPresent - presentIplCount
    const eplDrop = baselineEplPresent - presentEplCount
    const bundesligaDrop = baselineBundesligaPresent - presentBundesligaCount

    checks.push({
      id: 'baseline_drift_id_name_mismatches',
      ok: mismatchIncrease <= allowedMismatchIncrease,
      details: {
        baseline: baselineIdMismatch,
        current: idNameMismatches,
        increase: mismatchIncrease,
        allowed_increase: allowedMismatchIncrease,
      },
    })
    checks.push({
      id: 'baseline_drift_missing_normalized_names',
      ok: missingNamesIncrease <= allowedMissingNamesIncrease,
      details: {
        baseline: baselineMissingNames,
        current: missingByName.size,
        increase: missingNamesIncrease,
        allowed_increase: allowedMissingNamesIncrease,
      },
    })
    checks.push({
      id: 'baseline_drift_overlap_pct',
      ok: overlapDrop <= allowedOverlapPctDrop,
      details: {
        baseline_pct: baselineOverlapPct,
        current_pct: overlapPctPoints,
        drop_pct_points: overlapDrop,
        allowed_drop_pct_points: allowedOverlapPctDrop,
      },
    })
    checks.push({
      id: 'baseline_drift_ipl_seed_presence',
      ok: iplDrop <= allowedIplDrop,
      details: {
        baseline_present: baselineIplPresent,
        current_present: presentIplCount,
        drop: iplDrop,
        allowed_drop: allowedIplDrop,
      },
    })
    checks.push({
      id: 'baseline_drift_epl_seed_presence',
      ok: eplDrop <= allowedEplDrop,
      details: {
        baseline_present: baselineEplPresent,
        current_present: presentEplCount,
        drop: eplDrop,
        allowed_drop: allowedEplDrop,
      },
    })
    checks.push({
      id: 'baseline_drift_bundesliga_seed_presence',
      ok: bundesligaDrop <= allowedBundesligaDrop,
      details: {
        baseline_present: baselineBundesligaPresent,
        current_present: presentBundesligaCount,
        drop: bundesligaDrop,
        allowed_drop: allowedBundesligaDrop,
      },
    })
  } else if (baseline.data && REQUIRE_BASELINE) {
    checks.push({
      id: 'baseline_schema_valid',
      ok: false,
      details: {
        required: true,
        path: baseline.path,
        reason: 'baseline file missing metrics or allowed_regression sections',
      },
    })
  }

  const failed = checks.filter((check) => !check.ok)
  const result = {
    generated_at: new Date().toISOString(),
    totals: {
      cached_entities: cached.length,
      entity_embeddings: embeddings.length,
      overlap_by_graph_id: overlapById,
    },
    checks,
    baseline: baseline.data
      ? {
          path: baseline.path,
          loaded: true,
          generated_at: baseline.data.generated_at || null,
        }
      : {
          path: baseline.path,
          loaded: false,
        },
    passed: failed.length === 0,
    failed_count: failed.length,
  }

  if (JSON_OUTPUT_PATH) {
    const outPath = path.resolve(JSON_OUTPUT_PATH)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8')
  }

  if (SUMMARY_MD_PATH) {
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]))
    const lines = [
      '## Entity Congruence Audit',
      '',
      `- Generated at: ${result.generated_at}`,
      `- Passed: ${result.passed ? 'yes' : 'no'}`,
      `- Failed checks: ${result.failed_count}`,
      `- Cached entities: ${result.totals.cached_entities}`,
      `- Entity embeddings: ${result.totals.entity_embeddings}`,
      `- Overlap by graph ID: ${result.totals.overlap_by_graph_id}`,
      '',
      '### Checks',
      ...checks.map((c) => `- [${c.ok ? 'PASS' : 'FAIL'}] ${c.id}`),
      '',
      '### Seed Coverage',
      `- IPL: ${byId.ipl_seed_presence?.details?.present ?? 'n/a'}/${byId.ipl_seed_presence?.details?.total ?? 'n/a'}`,
      `- EPL: ${byId.epl_seed_presence?.details?.present ?? 'n/a'}/${byId.epl_seed_presence?.details?.total ?? 'n/a'}`,
      `- Bundesliga: ${byId.bundesliga_seed_presence?.details?.present ?? 'n/a'}/${byId.bundesliga_seed_presence?.details?.total ?? 'n/a'}`,
      '',
    ]
    const summaryPath = path.resolve(SUMMARY_MD_PATH)
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true })
    fs.writeFileSync(summaryPath, lines.join('\n'), 'utf8')
  }

  if (AS_JSON) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`Entity congruence QA @ ${result.generated_at}`)
    console.log(`- cached_entities: ${result.totals.cached_entities}`)
    console.log(`- entity_embeddings: ${result.totals.entity_embeddings}`)
    console.log(`- overlap_by_graph_id: ${result.totals.overlap_by_graph_id}`)
    for (const check of checks) {
      console.log(`- [${check.ok ? 'PASS' : 'FAIL'}] ${check.id}`)
      if (!check.ok) console.log(`  details: ${JSON.stringify(check.details)}`)
    }
  }

  if (!result.passed && FAIL_ON_ERRORS) process.exit(1)
}

run().catch((error) => {
  console.error('qa-entity-congruence-audit failed:', error?.message || error)
  process.exit(1)
})
