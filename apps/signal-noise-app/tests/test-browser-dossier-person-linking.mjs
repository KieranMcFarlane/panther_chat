import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityDossierSource = readFileSync(new URL('../src/components/entity-dossier/EntityDossier.tsx', import.meta.url), 'utf8')
const clubDossierSource = readFileSync(new URL('../src/components/entity-dossier/ClubDossier.tsx', import.meta.url), 'utf8')

assert.match(entityDossierSource, /\/entity-browser\/\$\{poi\.id\}\/dossier\?from=1/, 'EntityDossier should link POIs to the browser dossier path')
assert.match(clubDossierSource, /\/entity-browser\/\$\{resolvedId\}\/dossier\?from=1/, 'ClubDossier should navigate people to the browser dossier path')
assert.doesNotMatch(entityDossierSource, /\/person\/\$\{poi\.id\}/, 'EntityDossier should no longer link POIs through the legacy person route')
assert.doesNotMatch(clubDossierSource, /\/person\/\$\{resolvedId\}/, 'ClubDossier should no longer navigate through the legacy person route')

