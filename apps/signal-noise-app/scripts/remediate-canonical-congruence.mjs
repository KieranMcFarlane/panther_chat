#!/usr/bin/env node
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
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

function titleCase(value) {
  return String(value || '')
    .split(' ')
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(' ')
}

function safeText(value) {
  return String(value || '').trim()
}

function inferCanonicalType(entity, rawLeague = '') {
  const p = entity.properties || {}
  const values = [
    entity.entity_type,
    p.entity_type,
    p.entityType,
    p.entity_class,
    p.entityClass,
    p.type,
    ...(entity.labels || []),
    entity.name,
  ]
    .map((v) => normalizeText(v))
    .join(' | ')

  if (/rights|media|broadcast/.test(values)) return 'rights_holder'
  if (/federation|confederation|governing/.test(values)) return 'federation'
  if (/league|competition|tournament/.test(values)) return 'league'
  if (/team|club|franchise/.test(values)) return 'team'
  if (/person|people|country|sport category|sport type|venue|stadium|arena/.test(values)) return 'organisation'
  if (/organisation|organization|association|org/.test(values)) return 'organisation'
  if (normalizeText(rawLeague) && !/city|venue|country/.test(values)) return 'team'
  return 'unknown'
}

function canonicalizeLeagueName(value) {
  const n = normalizeText(value)
  if (!n) return ''
  const groups = {
    'premier league': ['premier league', 'english premier league', 'epl'],
    'indian premier league': ['indian premier league', 'ipl'],
    'la liga': ['la liga', 'laliga', 'spanish laliga', 'la liga santander'],
    'major league soccer': ['major league soccer', 'mls'],
    'bundesliga': ['bundesliga', 'german bundesliga'],
    'serie a': ['serie a', 'italian serie a'],
    'ligue 1': ['ligue 1', 'french ligue 1'],
    'efl championship': ['efl championship', 'english league championship'],
    'uefa champions league': ['uefa champions league', 'champions league', 'ucl'],
  }

  for (const [canonical, aliases] of Object.entries(groups)) {
    if (aliases.map(normalizeText).includes(n)) return canonical
  }

  return n
}

function isJunkLeagueValue(value) {
  const raw = safeText(value)
  const n = normalizeText(value)
  if (!n) return true
  if (/^[0-9]+$/.test(n)) return true
  if (/^(unknown|professional|elite|division|tier|first|second|third)$/.test(n)) return true
  const isUpperAcronym = /^[A-Z]{2,5}$/.test(raw)
  if (n.length < 4 && !isUpperAcronym) return true
  return false
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

async function applyEntityUpdates(entityUpdates) {
  let updated = 0
  for (const update of entityUpdates) {
    if (DRY_RUN) {
      updated += 1
      continue
    }
    const { id, ...patch } = update
    const { error } = await supabase
      .from('canonical_entities')
      .update(patch)
      .eq('id', id)
    if (error) throw error
    updated += 1
  }
  return updated
}

async function applyRelationshipUpdates(relUpdates) {
  let updated = 0
  for (const update of relUpdates) {
    if (DRY_RUN) {
      updated += 1
      continue
    }
    const { id, ...patch } = update
    const { error } = await supabase
      .from('entity_relationships')
      .update(patch)
      .eq('id', id)
    if (error) throw error
    updated += 1
  }
  return updated
}

function buildLeagueMaps(canonicalEntities) {
  const byNormSport = new Map()
  const byNormName = new Map()
  const byId = new Map(canonicalEntities.map((e) => [e.id, e]))

  for (const entity of canonicalEntities) {
    if (entity.entity_type !== 'league') continue
    const normName = canonicalizeLeagueName(entity.normalized_name || entity.name)
    const normSport = normalizeText(entity.sport)
    if (!normName) continue
    byNormName.set(normName, entity.id)
    byNormSport.set(`${normName}|${normSport}`, entity.id)
  }

  return { byNormSport, byNormName, byId }
}

function resolveLeagueCanonicalId(rawLeague, sport, leagueMaps) {
  const normLeague = canonicalizeLeagueName(rawLeague)
  if (!normLeague) return null
  const normSport = normalizeText(sport)
  return leagueMaps.byNormSport.get(`${normLeague}|${normSport}`) || leagueMaps.byNormName.get(normLeague) || null
}

async function insertSyntheticLeagues(candidates) {
  if (candidates.length === 0) return 0
  if (DRY_RUN) return candidates.length

  const { error } = await supabase
    .from('canonical_entities')
    .insert(candidates)

  if (error) throw error
  return candidates.length
}

async function run() {
  let canonicalEntities = await fetchAll(
    'canonical_entities',
    'id,canonical_key,name,normalized_name,entity_type,sport,league,country,labels,properties,source_neo4j_ids,league_canonical_entity_id,parent_canonical_entity_id'
  )

  const relationships = await fetchAll(
    'entity_relationships',
    'id,source_neo4j_id,target_neo4j_id,source_canonical_entity_id,target_canonical_entity_id'
  )

  const canonicalByNeo4j = new Map()
  for (const entity of canonicalEntities) {
    for (const neoId of entity.source_neo4j_ids || []) {
      if (!neoId) continue
      canonicalByNeo4j.set(String(neoId), entity.id)
    }
  }

  let leagueMaps = buildLeagueMaps(canonicalEntities)

  const unresolvedLeagueCandidates = new Map()
  const existingCanonicalKeys = new Set(canonicalEntities.map((e) => String(e.canonical_key || '')))

  for (const entity of canonicalEntities) {
    const p = entity.properties || {}
    const rawLeague = safeText(entity.league || p.league || p.parent_league || p.level)
    const inferredType = inferCanonicalType(entity, rawLeague)
    const effectiveType = entity.entity_type === 'unknown' ? inferredType : entity.entity_type

    if (!['team', 'organisation'].includes(effectiveType)) continue
    if (isJunkLeagueValue(rawLeague)) continue

    const sport = safeText(entity.sport || p.sport)
    const resolved = resolveLeagueCanonicalId(rawLeague, sport, leagueMaps)
    if (resolved) continue

    const normLeague = canonicalizeLeagueName(rawLeague)
    const key = `${normLeague}|${normalizeText(sport)}`
    if (existingCanonicalKeys.has(key)) continue
    if (!unresolvedLeagueCandidates.has(key)) {
      unresolvedLeagueCandidates.set(key, {
        id: randomUUID(),
        canonical_key: `${normLeague}|${normalizeText(sport)}`,
        name: /^[A-Z]{2,5}$/.test(rawLeague) ? rawLeague : titleCase(normLeague),
        normalized_name: normLeague,
        entity_type: 'league',
        sport,
        league: '',
        country: '',
        labels: ['Entity', 'League'],
        properties: {
          name: /^[A-Z]{2,5}$/.test(rawLeague) ? rawLeague : titleCase(normLeague),
          normalized_name: normLeague,
          type: 'League',
          entity_type: 'league',
          sport,
          source: 'canonical_congruence_remediation',
          remediation_tag: 'schema_congruence_phase2',
          created_from_team_league_text: true,
          updated_at_iso: new Date().toISOString(),
        },
        source_entity_ids: [],
        source_graph_ids: [],
        source_neo4j_ids: [],
        quality_score: 5,
        alias_count: 0,
      })
    }
  }

  const syntheticLeagueCount = await insertSyntheticLeagues([...unresolvedLeagueCandidates.values()])

  if (syntheticLeagueCount > 0) {
    canonicalEntities = await fetchAll(
      'canonical_entities',
      'id,canonical_key,name,normalized_name,entity_type,sport,league,country,labels,properties,source_neo4j_ids,league_canonical_entity_id,parent_canonical_entity_id'
    )
    leagueMaps = buildLeagueMaps(canonicalEntities)
  }

  const entityUpdates = []
  let inferredTypes = 0
  let inferredSport = 0
  let inferredCountry = 0
  let linkedLeague = 0

  for (const entity of canonicalEntities) {
    const p = entity.properties || {}
    const patch = {}

    const rawLeague = safeText(entity.league || p.league || p.parent_league || p.level)
    const inferredType = inferCanonicalType(entity, rawLeague)
    if ((!entity.entity_type || entity.entity_type === 'unknown') && inferredType !== 'unknown') {
      patch.entity_type = inferredType
      inferredTypes += 1
    }

    const currentSport = safeText(entity.sport)
    const propSport = safeText(p.sport)
    if (!currentSport && propSport) {
      patch.sport = propSport
      inferredSport += 1
    }

    const currentCountry = safeText(entity.country)
    const propCountry = safeText(p.country)
    if (!currentCountry && propCountry) {
      patch.country = propCountry
      inferredCountry += 1
    }

    const typedValues = [
      entity.entity_type,
      p.type,
      p.entity_type,
      ...(entity.labels || []),
      entity.name,
    ]
      .map((v) => normalizeText(v))
      .join(' | ')

    if (!safeText(patch.country || entity.country) && /country/.test(typedValues) && safeText(entity.name)) {
      patch.country = safeText(entity.name)
      inferredCountry += 1
    }

    if (!safeText(patch.sport || entity.sport) && /sport/.test(typedValues) && safeText(entity.name)) {
      patch.sport = safeText(entity.name)
      inferredSport += 1
    }

    const effectiveType = patch.entity_type || entity.entity_type
    if (effectiveType === 'team' || effectiveType === 'organisation') {
      if (rawLeague && isJunkLeagueValue(rawLeague)) {
        patch.league = ''
        patch.league_canonical_entity_id = null
        patch.parent_canonical_entity_id = null
      }

      const leagueCanonicalId = isJunkLeagueValue(rawLeague)
        ? null
        : resolveLeagueCanonicalId(rawLeague, patch.sport || entity.sport || p.sport, leagueMaps)

      if (leagueCanonicalId && entity.league_canonical_entity_id !== leagueCanonicalId) {
        patch.league_canonical_entity_id = leagueCanonicalId
        patch.parent_canonical_entity_id = leagueCanonicalId
        linkedLeague += 1
      }

      if (!safeText(patch.sport || entity.sport) && leagueCanonicalId) {
        const linkedLeagueEntity = leagueMaps.byId.get(leagueCanonicalId)
        const linkedSport = safeText(linkedLeagueEntity?.sport)
        if (linkedSport) {
          patch.sport = linkedSport
          inferredSport += 1
        }
      }

      if (rawLeague && !isJunkLeagueValue(rawLeague) && !entity.league) {
        patch.league = rawLeague
      }
    }

    if (Object.keys(patch).length > 0) {
      entityUpdates.push({ id: entity.id, ...patch })
    }
  }

  const relationshipUpdates = []
  let mappedSource = 0
  let mappedTarget = 0

  for (const rel of relationships) {
    const sourceCanonical = canonicalByNeo4j.get(String(rel.source_neo4j_id || '')) || null
    const targetCanonical = canonicalByNeo4j.get(String(rel.target_neo4j_id || '')) || null

    const patch = {}
    if (sourceCanonical && rel.source_canonical_entity_id !== sourceCanonical) {
      patch.source_canonical_entity_id = sourceCanonical
      mappedSource += 1
    }
    if (targetCanonical && rel.target_canonical_entity_id !== targetCanonical) {
      patch.target_canonical_entity_id = targetCanonical
      mappedTarget += 1
    }

    if (Object.keys(patch).length > 0) {
      relationshipUpdates.push({ id: rel.id, ...patch })
    }
  }

  const entityUpdatedCount = await applyEntityUpdates(entityUpdates)
  const relUpdatedCount = await applyRelationshipUpdates(relationshipUpdates)

  const results = {
    generated_at: new Date().toISOString(),
    dry_run: DRY_RUN,
    totals: {
      canonical_entities: canonicalEntities.length,
      entity_relationships: relationships.length,
    },
    updates: {
      synthetic_leagues_created: syntheticLeagueCount,
      canonical_entities_updated: entityUpdatedCount,
      relationships_updated: relUpdatedCount,
      inferred_entity_type: inferredTypes,
      inferred_sport: inferredSport,
      inferred_country: inferredCountry,
      linked_team_or_org_to_league: linkedLeague,
      mapped_relationship_source_canonical_id: mappedSource,
      mapped_relationship_target_canonical_id: mappedTarget,
    },
  }

  if (AS_JSON) {
    console.log(JSON.stringify(results, null, 2))
    return
  }

  console.log(`Canonical congruence remediation @ ${results.generated_at}`)
  console.log(`- Dry run: ${results.dry_run}`)
  console.log(`- Canonical entities scanned: ${results.totals.canonical_entities}`)
  console.log(`- Relationships scanned: ${results.totals.entity_relationships}`)
  console.log(`- Synthetic leagues created: ${results.updates.synthetic_leagues_created}`)
  console.log(`- Canonical entities updated: ${results.updates.canonical_entities_updated}`)
  console.log(`- Relationships updated: ${results.updates.relationships_updated}`)
  console.log(`- Inferred entity_type: ${results.updates.inferred_entity_type}`)
  console.log(`- Inferred sport: ${results.updates.inferred_sport}`)
  console.log(`- Inferred country: ${results.updates.inferred_country}`)
  console.log(`- Team/org league links added: ${results.updates.linked_team_or_org_to_league}`)
  console.log(`- Relationship source canonical IDs mapped: ${results.updates.mapped_relationship_source_canonical_id}`)
  console.log(`- Relationship target canonical IDs mapped: ${results.updates.mapped_relationship_target_canonical_id}`)
}

run().catch((error) => {
  console.error('remediate-canonical-congruence failed:', error?.message || error)
  process.exit(1)
})
