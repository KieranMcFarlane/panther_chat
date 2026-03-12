#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
dotenv.config({ path: path.join(appRoot, '.env') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('[reconciliation-monitor] Missing Supabase credentials')
  process.exit(2)
}

const maxEmbeddingsNotInCached = Number(process.env.RECON_MAX_EMBEDDINGS_NOT_IN_CACHED || '0')
const maxActionableMismatches = Number(process.env.RECON_MAX_ACTIONABLE_MISMATCHES || '0')
const webhookUrl = process.env.RECON_ALERT_WEBHOOK_URL || ''

const supabase = createClient(url, key, { auth: { persistSession: false } })

const NOISE_NAMES = new Set([
  'type',
  'tier',
  'tier 1',
  'tier 2',
  'tier 3',
  'tier 4',
  'tier 5',
  'club',
  'league',
  'federation',
  'organization',
  'organisation',
  'international federation',
  'continental federation',
  'sport',
  'sports entity',
  'unknown',
])

async function fetchAllRows(table, columns, pageSize = 1000) {
  const output = []
  let start = 0

  while (true) {
    const end = start + pageSize - 1
    const { data, error } = await supabase.from(table).select(columns).range(start, end)
    if (error) throw error
    const rows = data || []
    output.push(...rows)
    if (rows.length < pageSize) break
    start += pageSize
  }

  return output
}

function normalizeName(v) {
  return String(v || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isActionableMismatch(embedding) {
  const name = normalizeName(embedding.name)
  if (!name) return false
  if (/^entity\s*\d+$/.test(name)) return false
  if (NOISE_NAMES.has(name)) return false

  const type = normalizeName(embedding.type)
  if (['country', 'continent', 'region', 'city', 'state', 'province', 'unknown'].includes(type)) return false

  const sport = normalizeName(embedding.sport)
  const league = normalizeName(embedding.league)
  if (!sport && !league && name.split(' ').length <= 1) return false

  return true
}

let cachedRows = []
let embeddingRows = []
let relationshipCountRes = null
try {
  ;[cachedRows, embeddingRows, relationshipCountRes] = await Promise.all([
    fetchAllRows('cached_entities', 'neo4j_id,properties'),
    fetchAllRows('entity_embeddings', 'entity_id,name,entity_type,metadata'),
    supabase.from('entity_relationships').select('id', { count: 'exact', head: true }),
  ])
} catch (error) {
  console.error('[reconciliation-monitor] failed reading rows', error instanceof Error ? error.message : String(error))
  process.exit(2)
}

if (relationshipCountRes.error) {
  console.error('[reconciliation-monitor] failed reading entity_relationships', relationshipCountRes.error.message)
  process.exit(2)
}

const cachedById = new Map()
for (const row of cachedRows) {
  cachedById.set(String(row.neo4j_id), row)
}

const embeddingById = new Map()
for (const row of embeddingRows) {
  const gid = String(row.metadata?.neo4j_id || row.entity_id)
  embeddingById.set(gid, row)
}

let rawMismatches = 0
let actionableMismatches = 0
for (const [gid, emb] of embeddingById.entries()) {
  const cached = cachedById.get(gid)
  if (!cached) continue

  const embName = normalizeName(emb.metadata?.properties?.name || emb.name)
  const cachedName = normalizeName(cached.properties?.name)
  if (!embName || !cachedName || embName === cachedName) continue

  rawMismatches += 1
  if (
    isActionableMismatch({
      name: emb.metadata?.properties?.name || emb.name,
      type: emb.metadata?.properties?.type || emb.metadata?.properties?.entity_type || emb.entity_type,
      sport: emb.metadata?.properties?.sport || emb.metadata?.sport,
      league: emb.metadata?.properties?.league || emb.metadata?.properties?.level || emb.metadata?.league,
    })
  ) {
    actionableMismatches += 1
  }
}

const cachedIds = new Set(cachedById.keys())
const embeddingIds = new Set(embeddingById.keys())

const metrics = {
  cached_entities: cachedRows.length,
  entity_embeddings: embeddingRows.length,
  entity_relationships: relationshipCountRes.count || 0,
  embeddings_not_in_cached: [...embeddingIds].filter((id) => !cachedIds.has(id)).length,
  cached_not_in_embeddings: [...cachedIds].filter((id) => !embeddingIds.has(id)).length,
  id_name_mismatches_raw: rawMismatches,
  id_name_mismatches_actionable: actionableMismatches,
}

const breaches = []
if (metrics.embeddings_not_in_cached > maxEmbeddingsNotInCached) {
  breaches.push(`embeddings_not_in_cached=${metrics.embeddings_not_in_cached} > ${maxEmbeddingsNotInCached}`)
}
if (
  metrics.id_name_mismatches_actionable !== null &&
  metrics.id_name_mismatches_actionable > maxActionableMismatches
) {
  breaches.push(`id_name_mismatches_actionable=${metrics.id_name_mismatches_actionable} > ${maxActionableMismatches}`)
}

const payload = {
  timestamp: new Date().toISOString(),
  thresholds: {
    max_embeddings_not_in_cached: maxEmbeddingsNotInCached,
    max_actionable_mismatches: maxActionableMismatches,
  },
  metrics,
  breaches,
  ok: breaches.length === 0,
}

console.log(JSON.stringify(payload, null, 2))

if (!payload.ok && webhookUrl) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    console.error('[reconciliation-monitor] failed to post webhook', err instanceof Error ? err.message : String(err))
  }
}

if (!payload.ok) process.exit(1)
