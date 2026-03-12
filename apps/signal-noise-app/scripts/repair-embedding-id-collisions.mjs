#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
dotenv.config({ path: path.join(appRoot, '.env') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Missing Supabase credentials')

const supabase = createClient(url, key, { auth: { persistSession: false } })
const maxRepairs = Math.max(1, Number(process.env.MAX_REPAIRS || 500))

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

function normalizeName(v) {
  return String(v || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function toArray(v) {
  if (Array.isArray(v)) return v.map((x) => String(x))
  if (typeof v === 'string' && v.trim()) return v.split(',').map((x) => x.trim()).filter(Boolean)
  return []
}

function canonicalEmbeddingName(emb) {
  return String(emb?.metadata?.properties?.name || emb?.name || '')
}

function canonicalEmbeddingSport(emb) {
  return String(emb?.metadata?.properties?.sport || emb?.metadata?.sport || '')
}

function canonicalEmbeddingLeague(emb) {
  return String(emb?.metadata?.properties?.league || emb?.metadata?.properties?.level || emb?.metadata?.league || '')
}

function canonicalEmbeddingType(emb) {
  return normalizeName(emb?.metadata?.properties?.type || emb?.metadata?.properties?.entity_type || emb?.entity_type || '')
}

function isNoiseName(v) {
  const n = normalizeName(v)
  if (!n) return true
  if (/^entity\s*\d+$/.test(n)) return true
  if (n.startsWith('tier ')) return true
  return NOISE_NAMES.has(n)
}

function isSkippableEmbedding(emb) {
  const name = canonicalEmbeddingName(emb)
  if (isNoiseName(name)) return true

  const type = canonicalEmbeddingType(emb)
  if (['country', 'continent', 'region', 'city', 'state', 'province', 'unknown'].includes(type)) return true

  const sport = normalizeName(canonicalEmbeddingSport(emb))
  const league = normalizeName(canonicalEmbeddingLeague(emb))
  const hasSportsSignal = Boolean(sport) || Boolean(league)
  const normalizedName = normalizeName(name)

  if (!hasSportsSignal && normalizedName.split(' ').length <= 1) return true
  return false
}

function semanticScore(emb, row) {
  const embSport = normalizeName(canonicalEmbeddingSport(emb))
  const embLeague = normalizeName(canonicalEmbeddingLeague(emb))
  const rowSport = normalizeName(row?.properties?.sport)
  const rowLeague = normalizeName(row?.properties?.league || row?.properties?.level)
  let score = 0
  if (embSport && rowSport && embSport === rowSport) score += 2
  if (embLeague && rowLeague && embLeague === rowLeague) score += 2
  if (toArray(row?.properties?.source_embedding_ids).includes(String(emb?.metadata?.neo4j_id || emb?.entity_id))) score += 3
  return score
}

async function fetchAll(table, columns, pageSize = 1000) {
  const out = []
  for (let start = 0; ; start += pageSize) {
    const end = start + pageSize - 1
    const { data, error } = await supabase.from(table).select(columns).range(start, end)
    if (error) throw error
    const rows = data || []
    out.push(...rows)
    if (rows.length < pageSize) break
  }
  return out
}

const embeddings = await fetchAll('entity_embeddings', 'entity_id,name,metadata')
const cached = await fetchAll('cached_entities', 'id,graph_id,neo4j_id,properties,labels')

const cachedByNeo4j = new Map(cached.map((r) => [String(r.neo4j_id), r]))
const byNormName = new Map()
for (const row of cached) {
  const n = normalizeName(row.properties?.name)
  if (!n) continue
  if (!byNormName.has(n)) byNormName.set(n, [])
  byNormName.get(n).push(row)
}

let scanned = 0
let mismatches = 0
let repaired = 0
let unresolved = 0
let skipped = 0

for (const emb of embeddings) {
  const embeddingId = String(emb.metadata?.neo4j_id || emb.entity_id)
  const targetNameNorm = normalizeName(canonicalEmbeddingName(emb))
  if (!embeddingId || !targetNameNorm) continue
  if (isSkippableEmbedding(emb)) {
    skipped += 1
    continue
  }
  const current = cachedByNeo4j.get(embeddingId)
  if (!current) continue

  scanned += 1
  const currentNameNorm = normalizeName(current.properties?.name)
  if (currentNameNorm === targetNameNorm) continue
  mismatches += 1

  const pool = (byNormName.get(targetNameNorm) || []).filter((row) => row.id !== current.id)
  if (pool.length === 0) {
    unresolved += 1
    continue
  }

  const preferred = pool
    .map((row) => ({ row, score: semanticScore(emb, row) }))
    .sort((a, b) => b.score - a.score)[0]?.row
  if (!preferred) {
    unresolved += 1
    continue
  }

  const tempId = `swap_${embeddingId}_${crypto.randomBytes(4).toString('hex')}`

  const movedCurrentProps = {
    ...(current.properties || {}),
    remediated_id_collision: true,
    remediated_id_collision_from: embeddingId,
    remediated_id_collision_at: new Date().toISOString(),
  }

  const promotedProps = {
    ...(preferred.properties || {}),
    remediated_id_collision: true,
    remediated_id_collision_to: embeddingId,
    remediated_id_collision_at: new Date().toISOString(),
  }

  const moveCurrent = await supabase
    .from('cached_entities')
    .update({ neo4j_id: tempId, graph_id: tempId, properties: movedCurrentProps })
    .eq('id', current.id)

  if (moveCurrent.error) {
    unresolved += 1
    continue
  }

  const promotePreferred = await supabase
    .from('cached_entities')
    .update({ neo4j_id: embeddingId, graph_id: embeddingId, properties: promotedProps })
    .eq('id', preferred.id)

  if (promotePreferred.error) {
    // rollback current row to avoid dangling temp on partial failure
    await supabase
      .from('cached_entities')
      .update({ neo4j_id: embeddingId, graph_id: embeddingId, properties: current.properties || {} })
      .eq('id', current.id)
    unresolved += 1
    continue
  }

  // refresh local maps
  cachedByNeo4j.set(tempId, current)
  cachedByNeo4j.set(embeddingId, preferred)
  current.neo4j_id = tempId
  current.graph_id = tempId
  current.properties = movedCurrentProps
  preferred.neo4j_id = embeddingId
  preferred.graph_id = embeddingId
  preferred.properties = promotedProps

  repaired += 1

  if (repaired >= maxRepairs) {
    break
  }
}

console.log(JSON.stringify({ scanned, mismatches, repaired, unresolved, skipped, maxRepairs }, null, 2))
