import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pagePath = new URL('../src/app/entity-browser/[entityId]/dossier/page.tsx', import.meta.url)
const clientPagePath = new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url)
const entityLoaderPath = new URL('../src/lib/entity-loader.ts', import.meta.url)
const entityApiRoutePath = new URL('../src/app/api/entities/[entityId]/route.ts', import.meta.url)
const source = readFileSync(pagePath, 'utf8')
const clientSource = readFileSync(clientPagePath, 'utf8')
const entityLoaderSource = readFileSync(entityLoaderPath, 'utf8')
const entityApiRouteSource = readFileSync(entityApiRoutePath, 'utf8')

test('dossier page uses the shared Header with league badge modal support', () => {
  assert.match(clientSource, /import Header from ["']@\/components\/header\/Header["']/)
  assert.match(clientSource, /<Header currentEntity=\{entity\} \/>/)
})

test('dossier page keeps email modal support for dossier actions', () => {
  assert.match(clientSource, /import EmailComposeModal from ["']@\/components\/email\/EmailComposeModal["']/)
  assert.match(clientSource, /const \[showEmailModal, setShowEmailModal\] = useState\(false\)/)
  assert.match(clientSource, /onEmailEntity=\{handleEmailEntity\}/)
  assert.match(clientSource, /<EmailComposeModal/)
})

test('dossier page server-renders the entity and hands it to the client page', () => {
  assert.match(source, /import EntityDossierClientPage from ["']\.\/client-page["']/)
  assert.match(source, /import \{ getEntityForDossierPage \} from ["']@\/lib\/entity-loader["']/)
  assert.match(source, /export default async function EntityDossierPage/)
  assert.match(source, /const entityData = await getEntityForDossierPage\(entityId, tier\)/)
  assert.match(source, /<EntityDossierClientPage[\s\S]*initialEntity=\{entityData\.entity\}/)
})

test('dossier client page renders from server-provided entity data without a bootstrap fetch', () => {
  assert.match(clientSource, /initialEntity\?: Entity \| null/)
  assert.match(clientSource, /const entity = initialEntity/)
  assert.doesNotMatch(clientSource, /fetch\(`\/api\/entities\/\$\{entityId\}`\)/)
  assert.doesNotMatch(clientSource, /Fetching entity data/)
})

test('entity loader and entity API route share the same Supabase client module', () => {
  assert.match(entityLoaderSource, /import \{ cachedEntitiesSupabase as supabase \} from ["']@\/lib\/cached-entities-supabase["']/)
  assert.match(entityApiRouteSource, /import \{ cachedEntitiesSupabase as supabase \} from ["']@\/lib\/cached-entities-supabase["']/)
})
