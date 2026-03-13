#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || 'http://localhost:3005'

const CASES = [
  {
    name: 'exact_name_rajasthan_royals',
    body: { query: 'Rajasthan Royals', limit: 5, sport: 'Cricket' },
    top1: ['Rajasthan Royals'],
  },
  {
    name: 'facet_rajasthan_cricket',
    body: { query: 'Rajasthan', limit: 5, sport: 'Cricket' },
    top1: ['Rajasthan Royals'],
  },
  {
    name: 'typo_tolerance_rajasthan_royals',
    body: { query: 'Rajasthn Royls', limit: 5, sport: 'Cricket', entity_type: 'team' },
    top5: ['Rajasthan Royals'],
  },
  {
    name: 'semantic_athletics_governing_body',
    body: { query: 'athletics governing body', limit: 5 },
    top5: ['World Athletics'],
  },
  {
    name: 'semantic_ipl_franchise',
    body: { query: 'IPL franchise', limit: 5, sport: 'Cricket' },
    top5: [
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
    ],
  },
]

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAny(candidates, expected) {
  return expected.some((needle) => candidates.includes(normalize(needle)))
}

async function runCase(entry) {
  const started = Date.now()
  const response = await fetch(`${BASE_URL}/api/vector-search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(entry.body),
  })
  if (!response.ok) {
    return {
      name: entry.name,
      pass: false,
      reason: `HTTP ${response.status}`,
      latency_ms: Date.now() - started,
      results: [],
    }
  }

  const payload = await response.json()
  const names = (payload.results || []).map((row) => String(row.name || ''))
  const normalized = names.map(normalize)

  let pass = true
  let reason = 'ok'

  if (entry.top1 && entry.top1.length > 0) {
    const first = normalize(names[0] || '')
    pass = entry.top1.map(normalize).includes(first)
    if (!pass) reason = `top1 mismatch (expected one of: ${entry.top1.join(', ')})`
  }

  if (pass && entry.top5 && entry.top5.length > 0) {
    pass = includesAny(normalized.slice(0, 5), entry.top5)
    if (!pass) reason = `top5 mismatch (expected one of: ${entry.top5.join(', ')})`
  }

  return {
    name: entry.name,
    pass,
    reason,
    latency_ms: Date.now() - started,
    strategy: payload.search_strategy,
    semantic_enabled: payload.semantic_enabled,
    results: names.slice(0, 5),
  }
}

async function main() {
  const rows = []
  for (const entry of CASES) {
    rows.push(await runCase(entry))
  }

  const passed = rows.filter((row) => row.pass).length
  const failed = rows.length - passed

  console.log(JSON.stringify({ base_url: BASE_URL, passed, failed, rows }, null, 2))

  if (failed > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
