import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const repoRoot = process.cwd()
const dossierPagePath = path.join(
  repoRoot,
  'apps',
  'signal-noise-app',
  'src',
  'app',
  'entity-browser',
  '[entityId]',
  'dossier',
  'page.tsx',
)
const dossierRoutePath = path.join(
  repoRoot,
  'apps',
  'signal-noise-app',
  'src',
  'app',
  'api',
  'dossier',
  'file',
  'route.ts',
)

const dossierPageSource = readFileSync(dossierPagePath, 'utf8')
const dossierRouteSource = readFileSync(dossierRoutePath, 'utf8')

test('dossier page imports the shared dossier-path helper', () => {
  assert.match(dossierPageSource, /from ['"]@\/lib\/dossier-paths['"]/)
  assert.doesNotMatch(dossierPageSource, /function getDossierSearchDirs\(/)
  assert.doesNotMatch(dossierPageSource, /function findDossierFilename\(/)
})

test('dossier file route imports the shared dossier-path helper', () => {
  assert.match(dossierRouteSource, /from ['"]@\/lib\/dossier-paths['"]/)
  assert.doesNotMatch(dossierRouteSource, /function getPossibleDossierDirs\(/)
  assert.doesNotMatch(dossierRouteSource, /function findDossierFile\(/)
  assert.doesNotMatch(dossierRouteSource, /async function findDossierByNamePattern\(/)
})
