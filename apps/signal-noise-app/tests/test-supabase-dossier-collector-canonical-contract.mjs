import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../backend/supabase_dossier_collector.py', import.meta.url), 'utf8')
const manifestSource = readFileSync(new URL('../backend/build_question_first_scale_manifest.py', import.meta.url), 'utf8')

test('supabase dossier collector resolves canonical ids before legacy graph ids', () => {
  assert.match(source, /canonical_entity_id/)
  assert.match(source, /properties->>canonical_entity_id/)
  assert.match(source, /legacy_entity_id/)
  assert.match(source, /Canonical ID/)
})

test('supabase dossier collector exports canonical ids in dossier payloads and csv output', () => {
  assert.match(source, /"canonical_entity_id"/)
  assert.match(source, /writer\.writerow\(\[\s*entity\.entity_id,\s*entity\.canonical_entity_id/)
})

test('question-first scale manifest builder consumes the normalized collector output', () => {
  assert.match(manifestSource, /SupabaseDataCollector/)
  assert.match(manifestSource, /asdict\(entity\)/)
  assert.match(manifestSource, /properties = metadata\.get\("properties"\)/)
})
