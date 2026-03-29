import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routePath = new URL('../src/app/api/entities/[entityId]/route.ts', import.meta.url)
const source = readFileSync(routePath, 'utf8')

test('entity detail route falls back to the local canonical snapshot before returning 404', () => {
  assert.match(source, /import \{ getCanonicalEntitiesSnapshot \} from ['"]@\/lib\/canonical-entities-snapshot['"]/)
  assert.match(source, /source: 'supabase' \| 'local_export' \| null/)
  assert.match(source, /const canonicalEntities = await getCanonicalEntitiesSnapshot\(\)/)
  assert.match(source, /matchesFallbackEntity/)
  assert.match(source, /availableSources: \['Supabase cached_entities, teams, and leagues tables', 'Local Falkor export'\]/)
})
