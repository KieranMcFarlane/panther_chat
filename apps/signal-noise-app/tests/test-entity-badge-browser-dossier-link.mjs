import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/badge/EntityBadge.tsx', import.meta.url), 'utf8')

test('entity badge resolves dossier navigation through the shared browser href helper', () => {
  assert.match(source, /getEntityBrowserDossierHref\(entity, '1'\)/)
  assert.match(source, /router\.push\(href\)/)
  assert.doesNotMatch(source, /router\.push\(`\/entity-browser\/\$\{entity\?\.\id\}\/dossier\?from=1`\)/)
  assert.doesNotMatch(source, /router\.push\(`\/entity-browser\/\$\{entity\?\.\id\}\/dossier\?from=1`\)/)
})
