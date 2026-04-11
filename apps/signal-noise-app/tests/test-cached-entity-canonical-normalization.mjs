import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildCachedEntityCanonicalLookup,
  dedupeCanonicalCachedEntityRows,
} from '../src/lib/cached-entity-canonicalization.mjs'

const migrationSource = readFileSync(
  new URL('../supabase/migrations/20260410_add_canonical_entity_id_to_cached_entities.sql', import.meta.url),
  'utf8',
)

const canonicalArsenal = {
  id: '11111111-1111-1111-1111-111111111111',
  canonical_key: 'arsenal|football',
  name: 'Arsenal',
  normalized_name: 'arsenal',
  entity_type: 'team',
  sport: 'Football',
  league: 'Premier League',
  country: 'England',
  labels: ['Club'],
  properties: { name: 'Arsenal', type: 'Club', sport: 'Football', country: 'England' },
  source_entity_ids: ['raw-arsenal-1', 'raw-arsenal-2', 'raw-arsenal-3'],
  source_graph_ids: ['1297', '1298', '428'],
  source_neo4j_ids: ['1297', '1298', '428'],
  quality_score: 90,
  alias_count: 3,
}

const canonicalLookup = buildCachedEntityCanonicalLookup([canonicalArsenal])

test('cached entities migration adds a canonical entity id mapping', () => {
  assert.match(migrationSource, /ALTER TABLE cached_entities\s+ADD COLUMN IF NOT EXISTS canonical_entity_id UUID/i)
  assert.match(migrationSource, /CREATE INDEX IF NOT EXISTS idx_cached_entities_canonical_entity_id/i)
  assert.match(migrationSource, /CREATE OR REPLACE FUNCTION set_cached_entity_canonical_entity_id/i)
  assert.match(migrationSource, /UPDATE cached_entities ce\s+SET canonical_entity_id = c.id/i)
})

test('cached entity normalization collapses Arsenal variants to one canonical row', () => {
  const deduped = dedupeCanonicalCachedEntityRows(
    [
      {
        id: 'raw-arsenal-1',
        neo4j_id: '1297',
        graph_id: '1297',
        labels: ['Club'],
        properties: { name: 'Arsenal', type: 'Club', sport: 'Football', country: 'England' },
      },
      {
        id: 'raw-arsenal-2',
        neo4j_id: '1298',
        graph_id: '1298',
        labels: ['Club'],
        properties: { name: 'Arsenal FC', type: 'Club', sport: 'Football', country: 'England' },
      },
      {
        id: 'raw-arsenal-3',
        neo4j_id: '428',
        graph_id: '428',
        labels: ['Sports Entity'],
        properties: { name: 'Arsenal Football Club', type: 'Sports Entity' },
      },
    ],
    canonicalLookup,
  )

  assert.equal(deduped.length, 1)
  assert.equal(deduped[0].canonical_entity_id, canonicalArsenal.id)
  assert.equal(deduped[0].properties.name, 'Arsenal')
  assert.equal(deduped[0].properties.type, 'Club')
  assert.equal(deduped[0].properties.sport, 'Football')
  assert.equal(deduped[0].properties.country, 'England')
})
