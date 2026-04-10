import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityRouteSource = readFileSync(new URL('../src/app/entity/[entityId]/page.tsx', import.meta.url), 'utf8')
const personRouteSource = readFileSync(new URL('../src/app/person/[personId]/page.tsx', import.meta.url), 'utf8')

test('legacy entity route canonicalizes to the browser dossier uuid flow', () => {
  assert.match(entityRouteSource, /import \{ getEntityForDossierPage \} from ["']@\/lib\/entity-loader["']/)
  assert.match(entityRouteSource, /import \{ getEntityBrowserDossierHref \} from ["']@\/lib\/entity-routing["']/)
  assert.match(entityRouteSource, /export default async function EntityProfilePage/)
  assert.match(entityRouteSource, /const entityData = await getEntityForDossierPage\(entityId\)/)
  assert.match(entityRouteSource, /redirect\(href\)/)
  assert.doesNotMatch(entityRouteSource, /redirect\(`\/entity-browser\/\$\{entityId\}\/dossier\?from=1`\)/)
})

test('legacy person route canonicalizes to the browser dossier uuid flow', () => {
  assert.match(personRouteSource, /import \{ getEntityForDossierPage \} from ["']@\/lib\/entity-loader["']/)
  assert.match(personRouteSource, /import \{ getEntityBrowserDossierHref \} from ["']@\/lib\/entity-routing["']/)
  assert.match(personRouteSource, /export default async function PersonProfilePage/)
  assert.match(personRouteSource, /const entityData = await getEntityForDossierPage\(personId\)/)
  assert.match(personRouteSource, /redirect\(href\)/)
  assert.doesNotMatch(personRouteSource, /redirect\(`\/entity-browser\/\$\{personId\}\/dossier\?from=1`\)/)
})
