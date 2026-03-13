#!/usr/bin/env node
import 'dotenv/config'
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

function normalizeName(value) {
  return normalizeText(value)
}

const LEAGUE_ALIASES = {
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

function titleCase(value) {
  return String(value || '')
    .split(' ')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

function canonicalizeLeagueName(value) {
  const normalized = normalizeText(value)
  if (!normalized) return ''

  for (const [canonical, aliases] of Object.entries(LEAGUE_ALIASES)) {
    const normalizedAliases = aliases.map((alias) => normalizeText(alias))
    if (normalizedAliases.includes(normalized)) {
      return titleCase(canonical)
    }
  }

  return String(value || '').trim().replace(/\s+/g, ' ')
}

function normalizeList(items) {
  return Array.from(
    new Set(
      (items || [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  )
}

function canonicalType(entity) {
  const properties = entity?.properties || {}
  const labels = entity?.labels || []
  const values = [
    properties.entity_type,
    properties.entityType,
    properties.entity_class,
    properties.entityClass,
    properties.type,
    ...labels,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' | ')

  if (/rights|media|broadcast/.test(values)) return 'rights_holder'
  if (/federation|confederation|governing/.test(values)) return 'federation'
  if (/league|competition|tournament/.test(values)) return 'league'
  if (/team|club|franchise/.test(values)) return 'team'
  if (/organisation|organization|org/.test(values)) return 'organisation'
  return 'unknown'
}

function qualityScore(entity) {
  const properties = entity.properties || {}
  const type = canonicalType(entity)
  const typeScore = {
    team: 12,
    league: 10,
    federation: 10,
    rights_holder: 9,
    organisation: 6,
    unknown: 0,
  }

  let score = 0
  if (properties.name) score += 50
  if (properties.normalized_name) score += 10
  if (properties.sport) score += 8
  if (properties.league || properties.parent_league || properties.level) score += 8
  if (properties.country) score += 5
  if (properties.description) score += 4
  if (properties.website) score += 2
  if (Array.isArray(properties.aliases) && properties.aliases.length > 0) score += 6
  if (Array.isArray(entity.labels) && entity.labels.length > 1) score += 4
  score += typeScore[type] || 0
  return score
}

function canonicalKey(entity) {
  const properties = entity.properties || {}
  const type = canonicalType(entity)
  const name = type === 'league'
    ? normalizeName(canonicalizeLeagueName(properties.name || properties.normalized_name || entity.id || ''))
    : normalizeName(properties.normalized_name || properties.name || entity.id || '')
  const sport = normalizeText(properties.sport || '')
  return `${name}|${sport}`
}

async function fetchAllCachedEntities() {
  const pageSize = 1000
  let offset = 0
  let hasMore = true
  const rows = []

  while (hasMore) {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('id, graph_id, neo4j_id, labels, properties')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    const page = data || []
    rows.push(...page)

    if (page.length < pageSize) {
      hasMore = false
    } else {
      offset += pageSize
    }
  }

  return rows
}

function buildCanonicalBuckets(rows) {
  const buckets = new Map()

  for (const row of rows) {
    const key = canonicalKey(row)
    if (!key || key.startsWith('|')) continue

    const existing = buckets.get(key)
    if (!existing) {
      buckets.set(key, {
        best: row,
        bestScore: qualityScore(row),
        members: [row],
      })
      continue
    }

    const score = qualityScore(row)
    existing.members.push(row)
    if (score > existing.bestScore) {
      existing.best = row
      existing.bestScore = score
    }
  }

  return buckets
}

async function ensureCanonicalTablesExist() {
  const { error } = await supabase.from('canonical_entities').select('id').limit(1)
  if (error && /does not exist|relation .* does not exist/i.test(error.message || '')) {
    throw new Error('canonical_entities table does not exist. Apply migration 20260312_canonical_entities.sql first.')
  }
}

async function upsertCanonicalData(buckets) {
  const canonicalRows = []
  const aliasRowsByKey = new Map()

  for (const [key, bucket] of buckets.entries()) {
    const best = bucket.best
    const properties = best.properties || {}

    const allAliases = []
    for (const member of bucket.members) {
      const memberProps = member.properties || {}
      if (memberProps.name) allAliases.push(String(memberProps.name))
      if (Array.isArray(memberProps.aliases)) {
        for (const alias of memberProps.aliases) allAliases.push(String(alias || ''))
      }
    }

    const aliases = normalizeList(allAliases)

    const sourceEntityIds = normalizeList(bucket.members.map((m) => m.id))
    const sourceGraphIds = normalizeList(bucket.members.map((m) => m.graph_id))
    const sourceNeo4jIds = normalizeList(bucket.members.map((m) => m.neo4j_id))

    const league = canonicalizeLeagueName(properties.league || properties.parent_league || properties.level || '')

    canonicalRows.push({
      canonical_key: key,
      name: String(properties.name || best.neo4j_id || best.id || ''),
      normalized_name: normalizeName(properties.normalized_name || properties.name || best.neo4j_id || best.id || ''),
      entity_type: canonicalType(best),
      sport: String(properties.sport || ''),
      league,
      country: String(properties.country || ''),
      labels: normalizeList(best.labels || []),
      properties,
      source_entity_ids: sourceEntityIds,
      source_graph_ids: sourceGraphIds,
      source_neo4j_ids: sourceNeo4jIds,
      quality_score: bucket.bestScore,
      alias_count: aliases.length,
    })

    aliasRowsByKey.set(key, {
      aliases,
      sourceEntityId: String(best.id || ''),
    })
  }

  if (DRY_RUN) {
    return {
      canonicalRows,
      aliasRowsByKey,
      insertedCanonicalCount: canonicalRows.length,
      insertedAliasCount: Array.from(aliasRowsByKey.values()).reduce((acc, cur) => acc + cur.aliases.length, 0),
    }
  }

  // Full replace mode with chunked writes avoids statement timeout from very
  // large IN clauses/upserts when historical duplicates are high.
  const { error: deleteAliasesError } = await supabase
    .from('entity_aliases')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (deleteAliasesError) throw deleteAliasesError

  const { error: deleteCanonicalError } = await supabase
    .from('canonical_entities')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (deleteCanonicalError) throw deleteCanonicalError

  const chunkSize = 500
  for (let i = 0; i < canonicalRows.length; i += chunkSize) {
    const chunk = canonicalRows.slice(i, i + chunkSize)
    const { error: insertCanonicalError } = await supabase
      .from('canonical_entities')
      .insert(chunk)
    if (insertCanonicalError) throw insertCanonicalError
  }

  const { data: canonicalIds, error: fetchCanonicalIdsError } = await supabase
    .from('canonical_entities')
    .select('id, canonical_key')
  if (fetchCanonicalIdsError) throw fetchCanonicalIdsError

  const keyToCanonicalId = new Map((canonicalIds || []).map((row) => [row.canonical_key, row.id]))

  const aliasRows = []
  const aliasSeen = new Set()
  for (const [key, aliasMeta] of aliasRowsByKey.entries()) {
    const canonicalId = keyToCanonicalId.get(key)
    if (!canonicalId) continue

    for (const alias of aliasMeta.aliases) {
      const normalized = normalizeName(alias)
      if (!normalized) continue
      const aliasKey = `${canonicalId}::${normalized}`
      if (aliasSeen.has(aliasKey)) continue
      aliasSeen.add(aliasKey)
      aliasRows.push({
        canonical_entity_id: canonicalId,
        alias,
        normalized_alias: normalized,
        alias_type: 'name',
        source_entity_id: aliasMeta.sourceEntityId,
      })
    }
  }

  if (aliasRows.length > 0) {
    for (let i = 0; i < aliasRows.length; i += chunkSize) {
      const chunk = aliasRows.slice(i, i + chunkSize)
      const { error: aliasError } = await supabase
        .from('entity_aliases')
        .insert(chunk)
      if (aliasError) throw aliasError
    }
  }

  return {
    canonicalRows,
    aliasRowsByKey,
    insertedCanonicalCount: canonicalRows.length,
    insertedAliasCount: aliasRows.length,
  }
}

async function run() {
  await ensureCanonicalTablesExist()
  const rows = await fetchAllCachedEntities()
  const buckets = buildCanonicalBuckets(rows)
  const result = await upsertCanonicalData(buckets)

  const output = {
    generated_at: new Date().toISOString(),
    dry_run: DRY_RUN,
    source_cached_entities: rows.length,
    canonical_entities: result.insertedCanonicalCount,
    aliases: result.insertedAliasCount,
  }

  if (AS_JSON) {
    console.log(JSON.stringify(output, null, 2))
  } else {
    console.log(`Canonical rebuild @ ${output.generated_at}`)
    console.log(`- Dry run: ${output.dry_run}`)
    console.log(`- Source cached_entities: ${output.source_cached_entities}`)
    console.log(`- Canonical entities: ${output.canonical_entities}`)
    console.log(`- Aliases: ${output.aliases}`)
  }
}

run().catch((error) => {
  console.error('rebuild:canonical-entities failed:', error?.message || error)
  process.exit(1)
})
