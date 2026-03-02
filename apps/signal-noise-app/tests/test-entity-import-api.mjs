import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routePath = new URL('../src/app/api/entity-import/route.ts', import.meta.url)
const mapperPath = new URL('../src/lib/entity-import-mapper.ts', import.meta.url)
const supabaseClientPath = new URL('../src/lib/cached-entities-supabase.ts', import.meta.url)

const routeSource = readFileSync(routePath, 'utf8')
const mapperSource = readFileSync(mapperPath, 'utf8')
const supabaseClientSource = readFileSync(supabaseClientPath, 'utf8')

test('entity import API uses the shared Supabase client and row normalization helpers', () => {
  assert.match(routeSource, /import \{ cachedEntitiesSupabase as supabase \} from ["']@\/lib\/cached-entities-supabase["']/)
  assert.match(routeSource, /import \{ normalizeImportedEntityRow, REQUIRED_ENTITY_IMPORT_COLUMNS \} from ["']@\/lib\/entity-import-schema["']/)
  assert.match(routeSource, /import \{ mapImportedEntityRowToCachedEntity \} from ["']@\/lib\/entity-import-mapper["']/)
})

test('entity import API validates rows and upserts cached entities', () => {
  assert.match(routeSource, /rows/)
  assert.match(routeSource, /invalidRows|invalid_rows/)
  assert.match(routeSource, /createdRows|created_rows/)
  assert.match(routeSource, /updatedRows|updated_rows/)
  assert.match(routeSource, /\.from\(['"]cached_entities['"]\)/)
  assert.match(routeSource, /\.upsert\(/)
  assert.match(routeSource, /onConflict: ['"]neo4j_id['"]/)
})

test('entity import mapper writes imported entity metadata into cached_entities shape', () => {
  assert.match(mapperSource, /export function mapImportedEntityRowToCachedEntity/)
  assert.match(mapperSource, /neo4j_id/)
  assert.match(mapperSource, /properties:/)
  assert.match(mapperSource, /imported_at/)
  assert.match(mapperSource, /source/)
  assert.match(mapperSource, /priority_score/)
})

test('shared cached entities supabase client uses environment variables instead of hardcoded credentials', () => {
  assert.match(supabaseClientSource, /process\.env\.NEXT_PUBLIC_SUPABASE_URL|process\.env\.SUPABASE_URL/)
  assert.match(supabaseClientSource, /process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY|process\.env\.SUPABASE_ANON_KEY/)
  assert.doesNotMatch(supabaseClientSource, /itlcuazbybqlkicsaola\.supabase\.co/)
  assert.doesNotMatch(supabaseClientSource, /eyJhbGciOiJIUzI1Ni/)
})
