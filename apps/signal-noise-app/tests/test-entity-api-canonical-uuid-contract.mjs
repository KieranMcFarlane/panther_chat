import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routeSource = readFileSync(new URL('../src/app/api/entities/[entityId]/route.ts', import.meta.url), 'utf8')

test('entity api route delegates entity resolution to the dossier-page canonical loader', () => {
  assert.match(routeSource, /import \{ getEntityForDossierPage \} from ["']@\/lib\/entity-loader["']/)
  assert.match(routeSource, /const entityData = await getEntityForDossierPage\(entityId\)/)
  assert.match(routeSource, /const entity = entityData\.entity/)
  assert.match(routeSource, /const source = entityData\.source/)
  assert.doesNotMatch(routeSource, /local_export/)
})

test('entity api route no longer performs broad team-name lookups ahead of canonical loader resolution', () => {
  assert.doesNotMatch(routeSource, /name\.ilike\.\%\$\{entityId\}\%/)
  assert.doesNotMatch(routeSource, /from\('teams'\)/)
  assert.doesNotMatch(routeSource, /from\('leagues'\)/)
})
