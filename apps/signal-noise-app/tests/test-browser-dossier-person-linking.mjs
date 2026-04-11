import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityDossierSource = readFileSync(new URL('../src/components/entity-dossier/EntityDossier.tsx', import.meta.url), 'utf8')
const clubDossierSource = readFileSync(new URL('../src/components/entity-dossier/ClubDossier.tsx', import.meta.url), 'utf8')

assert.match(entityDossierSource, /import \{ getEntityBrowserDossierHref \} from ["']@\/lib\/entity-routing["']/)
assert.match(clubDossierSource, /import \{ getEntityBrowserDossierHref \} from ["']@\/lib\/entity-routing["']/)
assert.match(entityDossierSource, /getEntityBrowserDossierHref\(poi\.id, '1'\)/, 'EntityDossier should link POIs through the canonical browser route helper')
assert.match(clubDossierSource, /getEntityBrowserDossierHref\(resolvedId, '1'\)/, 'ClubDossier should navigate people through the canonical browser route helper')
assert.doesNotMatch(entityDossierSource, /\/person\/\$\{poi\.id\}/, 'EntityDossier should no longer link POIs through the legacy person route')
assert.doesNotMatch(clubDossierSource, /\/person\/\$\{resolvedId\}/, 'ClubDossier should no longer navigate through the legacy person route')
