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
  console.error('Missing Supabase credentials in environment')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

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

const [cached, embeddings, relationshipsRes] = await Promise.all([
  fetchAllRows('cached_entities', 'graph_id, neo4j_id, properties'),
  fetchAllRows('entity_embeddings', 'entity_id, name, metadata'),
  supabase.from('entity_relationships').select('id', { count: 'exact', head: true }),
])

if (relationshipsRes.error) throw relationshipsRes.error

const cachedIds = new Set(cached.map((r) => String(r.graph_id || r.neo4j_id)).filter(Boolean))
const embeddingIds = new Set(embeddings.map((r) => String(r.metadata?.neo4j_id || r.entity_id)).filter(Boolean))

const embeddingsNotInCached = [...embeddingIds].filter((id) => !cachedIds.has(id))
const cachedNotInEmbeddings = [...cachedIds].filter((id) => !embeddingIds.has(id))

const report = {
  generated_at: new Date().toISOString(),
  counts: {
    cached_entities: cached.length,
    entity_embeddings: embeddings.length,
    entity_relationships: relationshipsRes.count || 0,
  },
  congruence: {
    overlap_by_graph_id: [...cachedIds].filter((id) => embeddingIds.has(id)).length,
    embeddings_not_in_cached: embeddingsNotInCached.length,
    cached_not_in_embeddings: cachedNotInEmbeddings.length,
  },
  samples: {
    embeddings_not_in_cached: embeddingsNotInCached.slice(0, 30),
    cached_not_in_embeddings: cachedNotInEmbeddings.slice(0, 30),
  },
}

console.log(JSON.stringify(report, null, 2))
