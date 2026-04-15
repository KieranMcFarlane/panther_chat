#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) continue
    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function resolveEnv() {
  const cwd = process.cwd()
  const candidates = [
    path.resolve(cwd, '.env'),
    path.resolve(cwd, '.env.local'),
    path.resolve(cwd, '.env.production'),
    path.resolve(cwd, '..', '..', '..', '..', '..', 'apps', 'signal-noise-app', '.env'),
    path.resolve(cwd, '..', '..', '..', '..', '..', 'apps', 'signal-noise-app', '.env.production'),
  ]

  for (const candidate of candidates) {
    loadEnvFile(candidate)
  }
}

function toText(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function normalizeText(value) {
  return toText(value)
}

function slugify(value) {
  return toText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function chunk(array, size) {
  const chunks = []
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size))
  }
  return chunks
}

function getEntityName(row) {
  return toText(row?.name || row?.properties?.name)
}

function getEntityType(row) {
  return toText(row?.entity_type || row?.properties?.type)
}

function getCanonicalKey(row) {
  return toText(row?.canonical_key || row?.properties?.canonical_key)
}

function auditEntity(row) {
  const name = getEntityName(row)
  const entityType = getEntityType(row)
  const canonicalKey = getCanonicalKey(row)
  const reasons = []

  if (!name) reasons.push('missing_name')
  if (!entityType) reasons.push('missing_type')
  if (!canonicalKey) reasons.push('missing_canonical_key')
  if (/^(unknown|test|demo|sample|placeholder|tmp|temp)(\b|_|-)/i.test(name)) reasons.push('placeholder_name')
  if (/^Entity\s+\d+\s+\(.+\)$/i.test(name)) reasons.push('synthetic_entity_name')
  if (/^Entity\b/i.test(name)) reasons.push('generic_entity_name')

  return reasons.length > 0 ? reasons : null
}

function isJsonSeedEntity(row) {
  const name = getEntityName(row)
  const canonicalKey = getCanonicalKey(row)
  const combined = `${name} ${canonicalKey}`.toLowerCase()
  return combined.includes('json_seed') || combined.includes('json seed')
}

function isSportsLikeEntity(row) {
  const name = getEntityName(row)
  const canonicalKey = getCanonicalKey(row)
  const entityType = getEntityType(row)
  const combined = `${name} ${canonicalKey} ${entityType}`.toLowerCase()
  return /football|soccer|basketball|baseball|hockey|volleyball|tennis|archery|athletics|cycling|biathlon|motorsport|league|team|federation|club|sports?|olympic|rugby|cricket|golf|esports|e-sports|championship|tournament|recreation|athletic|marathon|formula|boxing|badminton|bobsleigh|skeleton|aquatics|rowing|ski|running|wrestling|table tennis|swimming|canoe|kayak|handball|field hockey/i.test(combined)
}

function buildKeepDeleteShortlist(rows) {
  return rows
    .filter((row) => isSportsLikeEntity(row) || isJsonSeedEntity(row))
    .map((row) => {
      const reasons = []
      if (isJsonSeedEntity(row)) reasons.push('json_seed_artifact')
      if (/^\d+$/.test(getEntityName(row))) reasons.push('numeric_name')
      if (/^Entity\b/i.test(getEntityName(row))) reasons.push('generic_entity_name')
      return {
        id: row.id,
        name: getEntityName(row),
        entity_type: getEntityType(row),
        canonical_key: getCanonicalKey(row),
        action: reasons.includes('json_seed_artifact') || reasons.includes('numeric_name') || reasons.includes('generic_entity_name') ? 'delete' : 'keep',
        reasons,
      }
    })
}

function normalizeType(type) {
  const normalized = normalizeText(type).toLowerCase()

  if (!normalized) return 'Entity'
  if (normalized.includes('club') || normalized.includes('team')) return 'Club'
  if (normalized.includes('sports entity') || normalized.includes('sport entity') || normalized.includes('sport club')) return 'Club'
  if (normalized.includes('league')) return 'League'
  if (normalized.includes('federation')) return 'Federation'
  if (normalized.includes('organization')) return 'Organization'
  if (normalized.includes('tournament')) return 'Tournament'
  if (normalized.includes('competition')) return 'Competition'
  if (normalized.includes('person')) return 'Person'

  return normalizeText(type) || 'Entity'
}

function normalizeSport(value) {
  return normalizeText(value) || 'Unknown Sport'
}

function normalizeCountry(value) {
  return normalizeText(value) || 'Unknown Country'
}

function stripDiacritics(value) {
  return normalizeText(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeNameForKey(name, type) {
  const stopTokens = new Set(['fc', 'cf', 'club', 'team', 'json', 'seed', 'jsonseed', 'the'])
  const sportTokens = new Set([
    'football',
    'soccer',
    'basketball',
    'baseball',
    'cricket',
    'tennis',
    'rugby',
    'hockey',
    'handball',
    'volleyball',
    'cycling',
    'athletics',
    'equestrian',
    'motorsport',
    'formula',
    'golf',
    'f1',
  ])
  const normalizedType = normalizeType(type)
  const stripSportTokens = normalizedType === 'Club' || normalizedType === 'League' || normalizedType === 'Competition'
  const normalized = stripDiacritics(
    normalizeText(name)
      .toLowerCase()
      .replace(/\((json[_\s-]*seed|seed)\)/gi, ' ')
      .replace(/&/g, ' and '),
  )

  return normalized
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !stopTokens.has(token))
    .filter((token) => !(stripSportTokens && sportTokens.has(token)))
    .map((token) => {
      if (!/[a-z]/.test(token) || token.length <= 3) {
        return token
      }

      return token[0] + token.slice(1).replace(/[aeiou]/g, '')
    })
    .join(' ')
}

function scoreCanonicalMergeVariant(row) {
  const properties = row?.properties || {}
  const name = normalizeText(properties.name)
  const normalizedType = normalizeType(properties.type)
  const league = normalizeText(properties.league)
  const level = normalizeText(properties.level)

  let score = 0

  if (name) score += 10
  if (normalizedType !== 'Entity') score += 12
  if (normalizeSport(properties.sport) !== 'Unknown Sport') score += 10
  if (normalizeCountry(properties.country) !== 'Unknown Country') score += 10
  if (league) score += 40
  if (level) score += 20
  if (row?.badge_path || row?.badge_s3_url || properties.badge_path || properties.badge_s3_url) score += 8
  if ((row?.labels || []).length > 0) score += 4
  if (/\(json[_\s-]*seed|seed\)/i.test(name)) score -= 30
  if (!normalizeText(properties.sport)) score -= 10
  if (!normalizeText(properties.country)) score -= 10
  if (/^[0-9]+$/.test(normalizeText(properties.level))) score -= 5

  return score
}

function getCanonicalMergeSignature(row) {
  const properties = row?.properties || {}

  return {
    type: normalizeType(properties.type),
    sport: normalizeSport(properties.sport),
    country: normalizeCountry(properties.country),
    name: normalizeNameForKey(properties.name, properties.type),
  }
}

function signatureCompatibilityScore(left, right) {
  if (!left.name || !right.name || left.name !== right.name) return -1
  if (left.type !== right.type) return -1

  let score = 0

  if (left.sport === right.sport) {
    score += 2
  } else if (left.sport === 'Unknown Sport' || right.sport === 'Unknown Sport') {
    score += 1
  } else {
    return -1
  }

  if (left.country === right.country) {
    score += 2
  } else if (left.country === 'Unknown Country' || right.country === 'Unknown Country') {
    score += 1
  } else {
    return -1
  }

  return score
}

function resolveCanonicalMergeWinner(variants) {
  const sortedVariants = [...variants].sort((left, right) => {
    const scoreDifference = scoreCanonicalMergeVariant(right) - scoreCanonicalMergeVariant(left)
    if (scoreDifference !== 0) return scoreDifference

    return normalizeText(left.properties?.name).length - normalizeText(right.properties?.name).length
  })

  return sortedVariants[0]
}

function buildCompatibleDuplicateGroups(rows) {
  const groupsByTypeAndName = new Map()

  for (const row of rows) {
    const signature = getCanonicalMergeSignature(row)
    if (!signature.name) continue

    const groupKey = `${signature.type}|${signature.name}`
    let entityGroups = groupsByTypeAndName.get(groupKey)
    if (!entityGroups) {
      entityGroups = []
      groupsByTypeAndName.set(groupKey, entityGroups)
    }

    let bestGroup = null
    let bestScore = -1

    for (const group of entityGroups) {
      const groupSignature = getCanonicalMergeSignature(group[0])
      const score = signatureCompatibilityScore(signature, groupSignature)
      if (score > bestScore) {
        bestScore = score
        bestGroup = group
      }
    }

    if (bestGroup && bestScore >= 0) {
      bestGroup.push(row)
    } else {
      entityGroups.push([row])
    }
  }

  return Array.from(groupsByTypeAndName.values()).flatMap((groups) => groups.filter((group) => group.length > 1))
}

function buildCompatibleDuplicateMergePlan(rows) {
  const compatibleDuplicateGroups = buildCompatibleDuplicateGroups(rows)

  return compatibleDuplicateGroups.map((group) => {
    const winner = resolveCanonicalMergeWinner(group)
    const losers = group.filter((row) => row.id !== winner.id)
    return {
      key: `${getCanonicalMergeSignature(winner).type}|${getCanonicalMergeSignature(winner).name}`,
      winner: {
        id: winner.id,
        name: getEntityName(winner),
        entity_type: getEntityType(winner),
        canonical_key: getCanonicalKey(winner),
      },
      losers: losers.map((row) => ({
        id: row.id,
        name: getEntityName(row),
        entity_type: getEntityType(row),
        canonical_key: getCanonicalKey(row),
      })),
      rows: group.map((row) => ({
        id: row.id,
        name: getEntityName(row),
        entity_type: getEntityType(row),
        canonical_key: getCanonicalKey(row),
      })),
    }
  })
}

async function fetchSupabaseJson(url, key, pathName, options = {}) {
  const response = await fetch(`${url}/rest/v1/${pathName}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    const message = typeof data === 'string' ? data : data?.message || data?.error || `HTTP ${response.status}`
    throw new Error(message || `HTTP ${response.status}`)
  }

  return data
}

async function fetchSupabaseRows(url, key, pathName) {
  const response = await fetch(`${url}/rest/v1/${pathName}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : []

  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`
    throw new Error(message)
  }

  return Array.isArray(data) ? data : []
}

async function patchSupabaseRow(url, key, pathName, rowId, patch) {
  const response = await fetch(`${url}/rest/v1/${pathName}?id=eq.${rowId}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`
    throw new Error(message)
  }

  return data
}

async function relinkCanonicalEntityReferences(url, key, winnerId, loserIds) {
  const tables = [
    { name: 'cached_entities', includeProperties: true },
    { name: 'entity_pipeline_runs', includeProperties: false },
    { name: 'entity_dossiers', includeProperties: false },
  ]

  const relinked = []

  for (const table of tables) {
    let rowCount = 0
    const selectColumns = table.includeProperties ? 'id,canonical_entity_id,properties' : 'id,canonical_entity_id'

    for (const loserChunk of chunk(loserIds, 25)) {
      const rows = await fetchSupabaseRows(
        url,
        key,
        `${table.name}?select=${selectColumns}&canonical_entity_id=in.(${loserChunk.join(',')})`,
      )

      rowCount += rows.length
      for (const row of rows) {
        const patch = { canonical_entity_id: winnerId }
        if (table.includeProperties && row.properties && typeof row.properties === 'object') {
          patch.properties = {
            ...row.properties,
            canonical_entity_id: winnerId,
          }
        }

        await patchSupabaseRow(url, key, table.name, row.id, patch)
      }
    }

    relinked.push({
      table: table.name,
      row_count: rowCount,
    })
  }

  return relinked
}

async function fetchAllCanonicalEntities(url, key) {
  const rows = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const response = await fetch(`${url}/rest/v1/canonical_entities?select=id,name,entity_type,canonical_key,properties,labels&order=name.asc&limit=${pageSize}&offset=${offset}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    })

    const text = await response.text()
    const page = text ? JSON.parse(text) : []
    if (!response.ok) {
      const message = page?.message || page?.error || `HTTP ${response.status}`
      throw new Error(message)
    }

    rows.push(...page)
    if (!Array.isArray(page) || page.length < pageSize) {
      break
    }
    offset += pageSize
  }

  return rows
}

function buildDuplicateKeySummary(rows) {
  const grouped = new Map()
  for (const row of rows) {
    const key = getCanonicalKey(row)
    if (!key) continue
    const list = grouped.get(key) || []
    list.push(row)
    grouped.set(key, list)
  }

  return Array.from(grouped.entries())
    .filter(([, value]) => value.length > 1)
    .map(([canonical_key, value]) => ({
      canonical_key,
      count: value.length,
      names: value.slice(0, 5).map((row) => getEntityName(row)).filter(Boolean),
    }))
}

async function invalidateCanonicalEntitiesSnapshot(reason) {
  const markerPath = path.resolve(process.cwd(), 'tmp', 'canonical-entities-cache.invalidated.json')
  mkdirSync(path.dirname(markerPath), { recursive: true })
  writeFileSync(markerPath, JSON.stringify({ invalidated_at: new Date().toISOString(), reason }, null, 2) + '\n', 'utf8')
}

async function main() {
  resolveEnv()
  const apply = process.argv.includes('--apply')
  const jsonSeedOnly = process.argv.includes('--json-seed-only')
  const mergeCompatibleDuplicates = process.argv.includes('--merge-compatible-duplicates')
  const projectRoot = process.cwd()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }

  const startedAt = new Date().toISOString()
  const allRows = await fetchAllCanonicalEntities(supabaseUrl, supabaseKey)
  const compatibleDuplicateGroups = buildCompatibleDuplicateGroups(allRows)
  const mergePlan = buildCompatibleDuplicateMergePlan(allRows)
  const candidates = allRows
    .map((row) => ({ row, reasons: auditEntity(row) }))
    .filter((item) => Array.isArray(item.reasons) && item.reasons.length > 0)
    .map(({ row, reasons }) => ({
      id: row.id,
      name: getEntityName(row),
      entity_type: getEntityType(row),
      canonical_key: getCanonicalKey(row),
      labels: Array.isArray(row.labels) ? row.labels : [],
      reasons,
    }))
  const jsonSeedCandidates = allRows
    .filter((row) => isJsonSeedEntity(row))
    .map((row) => ({
      id: row.id,
      name: getEntityName(row),
      entity_type: getEntityType(row),
      canonical_key: getCanonicalKey(row),
      reasons: ['json_seed_artifact'],
    }))

  const duplicateKeys = buildDuplicateKeySummary(allRows)
  const exportDir = path.resolve(
    projectRoot,
    'tmp',
    mergeCompatibleDuplicates
      ? 'canonical-entity-merge-plan'
      : jsonSeedOnly
        ? 'canonical-entity-keep-delete-shortlist'
        : 'canonical-entity-quarantine',
  )
  mkdirSync(exportDir, { recursive: true })
  const exportBase = mergeCompatibleDuplicates
    ? 'merge-plan'
    : jsonSeedOnly
      ? 'keep-delete-shortlist'
      : 'canonical-entity-quarantine'
  const exportPath = path.resolve(exportDir, `${exportBase}-${startedAt.replace(/[:.]/g, '-')}.json`)
  const shortlistMdPath = path.resolve(exportDir, `${exportBase}-${startedAt.replace(/[:.]/g, '-')}.md`)
  const shortlistRows = buildKeepDeleteShortlist(allRows)
  const exportPayload = {
    started_at: startedAt,
    total_entities: allRows.length,
    candidate_count: mergeCompatibleDuplicates ? mergePlan.length : jsonSeedOnly ? jsonSeedCandidates.length : candidates.length,
    duplicate_canonical_keys: duplicateKeys.length,
    candidates: jsonSeedOnly ? jsonSeedCandidates : candidates,
    duplicate_keys: duplicateKeys,
    compatible_duplicate_groups: compatibleDuplicateGroups.map((group) => ({
      key: `${getCanonicalMergeSignature(group[0]).type}|${getCanonicalMergeSignature(group[0]).name}`,
      count: group.length,
      rows: group.map((row) => ({
        id: row.id,
        name: getEntityName(row),
        entity_type: getEntityType(row),
        canonical_key: getCanonicalKey(row),
      })),
    })),
    merge_plan: mergePlan,
    quarantine: {
      candidate_ids: (jsonSeedOnly ? jsonSeedCandidates : candidates).map((candidate) => candidate.id).filter(Boolean),
      candidate_count: mergeCompatibleDuplicates ? mergePlan.length : jsonSeedOnly ? jsonSeedCandidates.length : candidates.length,
    },
    keep_delete_shortlist: shortlistRows,
  }
  writeFileSync(exportPath, JSON.stringify(exportPayload, null, 2) + '\n', 'utf8')

  const shortlistMarkdown = [
    '# Keep Delete Shortlist',
    '',
    `Target: ${jsonSeedOnly ? 'json_seed' : 'broken_rows'}`,
    `Generated: ${startedAt}`,
    `Rows: ${shortlistRows.length}`,
    '',
    '| action | name | entity_type | canonical_key | reasons |',
    '|---|---|---|---|---|',
    ...shortlistRows.map((row) => `| ${row.action} | ${String(row.name).replace(/\\|/g, '\\\\|')} | ${String(row.entity_type).replace(/\\|/g, '\\\\|')} | ${String(row.canonical_key).replace(/\\|/g, '\\\\|')} | ${(row.reasons || []).join(', ')} |`),
  ].join('\\n')
  writeFileSync(shortlistMdPath, shortlistMarkdown + '\\n', 'utf8')

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'audit',
    target: mergeCompatibleDuplicates ? 'compatible_duplicates' : jsonSeedOnly ? 'json_seed' : 'broken_rows',
    started_at: startedAt,
    total_entities: allRows.length,
    candidate_count: mergeCompatibleDuplicates ? mergePlan.length : jsonSeedOnly ? jsonSeedCandidates.length : candidates.length,
    duplicate_canonical_keys: duplicateKeys.length,
    compatible_duplicate_groups: compatibleDuplicateGroups.length,
    export_path: exportPath,
    shortlist_md_path: shortlistMdPath,
    quarantine_path: exportPath,
  }, null, 2))

  if (!apply) {
    return
  }

  const syncRunId = `canonical-entity-cleanup-${startedAt.replace(/[:.]/g, '')}`
  const steps = []
  let deletedCount = 0

  if (mergeCompatibleDuplicates) {
    for (const mergeGroup of mergePlan) {
      const winnerId = mergeGroup.winner.id
      const loserIds = mergeGroup.losers.map((loser) => loser.id).filter(Boolean)
      if (loserIds.length === 0) continue

      const relinkStarted = Date.now()
      const relinkedTables = await relinkCanonicalEntityReferences(supabaseUrl, supabaseKey, winnerId, loserIds)
      steps.push({
        command: `relink canonical references for ${mergeGroup.key}`,
        durationMs: Date.now() - relinkStarted,
        winner_id: winnerId,
        loser_ids: loserIds,
        relinked_tables: relinkedTables,
      })

      for (const loserChunk of chunk(loserIds, 50)) {
        const deleteStarted = Date.now()
        await fetchSupabaseJson(supabaseUrl, supabaseKey, `canonical_entities?id=in.(${loserChunk.join(',')})`, {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' },
        })
        deletedCount += loserChunk.length
        steps.push({
          command: `delete merged canonical entities (${loserChunk.length} rows)`,
          durationMs: Date.now() - deleteStarted,
          winner_id: winnerId,
          loser_ids: loserChunk,
        })
      }
    }
  } else {
    const ids = (jsonSeedOnly ? jsonSeedCandidates : candidates).map((candidate) => candidate.id).filter(Boolean)

    for (const idsChunk of chunk(ids, 50)) {
      const deleteStarted = Date.now()
      await fetchSupabaseJson(supabaseUrl, supabaseKey, `canonical_entities?id=in.(${idsChunk.join(',')})`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      })
      deletedCount += idsChunk.length
      steps.push({ command: `delete canonical_entities (${idsChunk.length} rows)`, durationMs: Date.now() - deleteStarted })
    }
  }

  const invalidationStarted = Date.now()
  await invalidateCanonicalEntitiesSnapshot(mergeCompatibleDuplicates ? 'canonical_entity_merge_duplicates' : 'canonical_entity_cleanup')
  steps.push({ command: 'invalidate canonical entities snapshot', durationMs: Date.now() - invalidationStarted })

  const auditStarted = Date.now()
  await fetchSupabaseJson(supabaseUrl, supabaseKey, 'canonical_maintenance_audit', {
    method: 'POST',
    body: JSON.stringify({
      sync_run_id: syncRunId,
      trigger: 'canonical_entity_cleanup',
      status: 'passed',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: 0,
      steps,
      error_message: null,
      metadata: {
        exported_to: exportPath,
        total_entities: allRows.length,
        candidate_count: mergeCompatibleDuplicates ? mergePlan.length : jsonSeedOnly ? jsonSeedCandidates.length : candidates.length,
        duplicate_canonical_keys: duplicateKeys.length,
        compatible_duplicate_groups: compatibleDuplicateGroups.length,
        deleted_count: deletedCount,
        target: mergeCompatibleDuplicates ? 'compatible_duplicates' : jsonSeedOnly ? 'json_seed' : 'broken_rows',
      },
    }),
  })

  steps.push({ command: 'record canonical maintenance audit', durationMs: Date.now() - auditStarted })
  console.log(JSON.stringify({
    deleted_count: deletedCount,
    invalidated: true,
    audit_trigger: 'canonical_entity_cleanup',
    sync_run_id: syncRunId,
  }, null, 2))
}

main().catch((error) => {
  console.error('canonical entity cleanup failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
