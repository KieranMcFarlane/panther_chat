import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const homePageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
const entityBrowserPageSource = readFileSync(new URL('../src/app/entity-browser/page.tsx', import.meta.url), 'utf8')
const entityDossierPageSource = readFileSync(new URL('../src/app/entity-browser/[entityId]/dossier/page.tsx', import.meta.url), 'utf8')

test('homepage is protected by Better Auth page session', () => {
  assert.match(homePageSource, /requirePageSession\(['"`]\/['"`]\)/)
})

test('entity browser is protected by Better Auth page session', () => {
  assert.match(entityBrowserPageSource, /requirePageSession\(['"`]\/entity-browser['"`]\)/)
})

test('entity dossier page is protected by Better Auth page session', () => {
  assert.match(entityDossierPageSource, /requirePageSession\(/)
  assert.match(entityDossierPageSource, /\/entity-browser\/\$\{entityId\}\/dossier/)
})
