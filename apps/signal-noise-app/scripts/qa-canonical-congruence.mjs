#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const FAIL_ON_ERRORS = !process.argv.includes('--no-fail')
const AS_JSON = process.argv.includes('--json')

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

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchAll(table, columns) {
  const rows = []
  const chunk = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order('id', { ascending: true })
      .range(offset, offset + chunk - 1)
    if (error) throw error
    const page = data || []
    rows.push(...page)
    if (page.length < chunk) break
    offset += chunk
  }
  return rows
}

async function run() {
  const entities = await fetchAll(
    'canonical_entities',
    'id,entity_type,sport,country,league,league_canonical_entity_id,parent_canonical_entity_id'
  )
  const relationships = await fetchAll(
    'entity_relationships',
    'id,source_canonical_entity_id,target_canonical_entity_id,source_neo4j_id,target_neo4j_id'
  )

  const entityIds = new Set(entities.map((e) => e.id))
  const leagueIds = new Set(entities.filter((e) => e.entity_type === 'league').map((e) => e.id))

  const unknownType = entities.filter((e) => !e.entity_type || e.entity_type === 'unknown').length
  const sportCountryScope = entities.filter((e) =>
    ['team', 'league', 'federation', 'rights_holder'].includes(e.entity_type)
  )
  const emptySport = sportCountryScope.filter((e) => !String(e.sport || '').trim()).length
  const emptyCountry = sportCountryScope.filter((e) => !String(e.country || '').trim()).length

  const teams = entities.filter((e) => e.entity_type === 'team')
  const teamsWithLeagueText = teams.filter((e) => String(e.league || '').trim())
  const teamsLinkedLeague = teamsWithLeagueText.filter((e) => e.league_canonical_entity_id && leagueIds.has(e.league_canonical_entity_id))

  const relationshipsWithSource = relationships.filter((r) => String(r.source_neo4j_id || '').trim())
  const relationshipsWithTarget = relationships.filter((r) => String(r.target_neo4j_id || '').trim())
  const relSourceMapped = relationshipsWithSource.filter((r) => r.source_canonical_entity_id && entityIds.has(r.source_canonical_entity_id)).length
  const relTargetMapped = relationshipsWithTarget.filter((r) => r.target_canonical_entity_id && entityIds.has(r.target_canonical_entity_id)).length

  const sourceCoverage = relationshipsWithSource.length ? relSourceMapped / relationshipsWithSource.length : 1
  const targetCoverage = relationshipsWithTarget.length ? relTargetMapped / relationshipsWithTarget.length : 1
  const teamLeagueCoverage = teamsWithLeagueText.length ? teamsLinkedLeague.length / teamsWithLeagueText.length : 1

  const checks = [
    {
      id: 'relationship_source_canonical_coverage',
      ok: sourceCoverage >= 0.98,
      details: {
        total_with_source_neo4j: relationshipsWithSource.length,
        mapped_source_canonical: relSourceMapped,
        coverage: Number((sourceCoverage * 100).toFixed(2)),
      },
    },
    {
      id: 'relationship_target_canonical_coverage',
      ok: targetCoverage >= 0.98,
      details: {
        total_with_target_neo4j: relationshipsWithTarget.length,
        mapped_target_canonical: relTargetMapped,
        coverage: Number((targetCoverage * 100).toFixed(2)),
      },
    },
    {
      id: 'team_league_canonical_linkage',
      ok: teamLeagueCoverage >= 0.8,
      details: {
        team_rows_with_league_text: teamsWithLeagueText.length,
        linked_to_canonical_league: teamsLinkedLeague.length,
        coverage: Number((teamLeagueCoverage * 100).toFixed(2)),
      },
    },
    {
      id: 'unknown_entity_type_rate',
      ok: unknownType / Math.max(entities.length, 1) <= 0.25,
      details: {
        unknown_type: unknownType,
        total: entities.length,
        pct: Number(((unknownType / Math.max(entities.length, 1)) * 100).toFixed(2)),
      },
    },
    {
      id: 'empty_sport_rate',
      ok: emptySport / Math.max(sportCountryScope.length, 1) <= 0.2,
      details: {
        empty_sport: emptySport,
        total: sportCountryScope.length,
        pct: Number(((emptySport / Math.max(sportCountryScope.length, 1)) * 100).toFixed(2)),
        scope: 'team|league|federation|rights_holder',
      },
    },
    {
      id: 'empty_country_rate',
      ok: emptyCountry / Math.max(sportCountryScope.length, 1) <= 0.25,
      details: {
        empty_country: emptyCountry,
        total: sportCountryScope.length,
        pct: Number(((emptyCountry / Math.max(sportCountryScope.length, 1)) * 100).toFixed(2)),
        scope: 'team|league|federation|rights_holder',
      },
    },
  ]

  const failed = checks.filter((c) => !c.ok)

  const result = {
    generated_at: new Date().toISOString(),
    totals: {
      canonical_entities: entities.length,
      entity_relationships: relationships.length,
      teams: teams.length,
      teams_with_league_text: teamsWithLeagueText.length,
    },
    checks,
    passed: failed.length === 0,
    failed_count: failed.length,
  }

  if (AS_JSON) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`Canonical congruence QA @ ${result.generated_at}`)
    console.log(`- canonical_entities: ${result.totals.canonical_entities}`)
    console.log(`- entity_relationships: ${result.totals.entity_relationships}`)
    for (const c of checks) {
      console.log(`- [${c.ok ? 'PASS' : 'FAIL'}] ${c.id}`)
      if (!c.ok) console.log(`  details: ${JSON.stringify(c.details)}`)
    }
  }

  if (!result.passed && FAIL_ON_ERRORS) process.exit(1)
}

run().catch((error) => {
  console.error('qa-canonical-congruence failed:', error?.message || error)
  process.exit(1)
})
