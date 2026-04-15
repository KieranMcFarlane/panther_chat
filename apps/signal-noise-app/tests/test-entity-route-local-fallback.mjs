import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routePath = new URL('../src/app/api/entities/[entityId]/route.ts', import.meta.url)
const source = readFileSync(routePath, 'utf8')

test('entity detail route stays on canonical supabase-backed sources before returning 404', () => {
  assert.match(source, /import \{ getEntityForDossierPage \} from ['"]@\/lib\/entity-loader['"]/)
  assert.match(source, /const source = entityData\.source/)
  assert.match(source, /availableSources: \['Supabase cached_entities, teams, and leagues tables'\]/)
  assert.doesNotMatch(source, /local_export/)
  assert.doesNotMatch(source, /Local Falkor export/)
})
