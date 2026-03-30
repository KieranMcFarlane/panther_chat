import test from 'node:test'
import assert from 'node:assert/strict'

import { buildImportedEntityGraphUpsert } from '../src/lib/entity-import-falkor-bridge.ts'

test('buildImportedEntityGraphUpsert maps CSV row into canonical Falkor payload', () => {
  const payload = buildImportedEntityGraphUpsert({
    entity_id: 'rajasthan-royals',
    name: 'Rajasthan Royals',
    entity_type: 'CLUB',
    sport: 'cricket',
    country: 'India',
    source: 'manual',
    league: 'Indian Premier League',
    external_id: 'rr',
    website: 'https://www.rajasthanroyals.com',
    founded_year: '2008',
    headquarters: 'Jaipur, India',
    stadium_name: 'Sawai Mansingh Stadium',
    capacity: '30000',
    description: 'IPL franchise',
    priority_score: 88,
    badge_url: 'https://example.com/badge.png',
  })

  assert.equal(payload.entityId, 'rajasthan-royals')
  assert.deepEqual(payload.labels, ['Entity', 'Club'])
  assert.equal(payload.properties.name, 'Rajasthan Royals')
  assert.equal(payload.properties.sport, 'cricket')
  assert.equal(payload.properties.league, 'Indian Premier League')
  assert.equal(payload.properties.source, 'manual')
  assert.equal(payload.properties.imported_from, 'csv_import')
  assert.equal(payload.properties.import_batch_source, 'supabase_import')
})
