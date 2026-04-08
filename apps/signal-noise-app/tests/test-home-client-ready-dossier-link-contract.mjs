import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const loaderSource = readFileSync(new URL('../src/lib/home-queue-dashboard.ts', import.meta.url), 'utf8')
const componentSource = readFileSync(new URL('../src/components/home/HomeQueueDashboard.tsx', import.meta.url), 'utf8')

test('home queue loader resolves client-ready dossier cards through canonical public ids instead of raw dossier entity ids', () => {
  assert.match(loaderSource, /getCanonicalEntitiesSnapshot/)
  assert.match(loaderSource, /resolveEntityUuid|matchesEntityUuid/)
  assert.match(loaderSource, /browser_entity_id/)
})

test('home client-ready dossier cards link using the resolved browser entity id', () => {
  assert.match(componentSource, /browser_entity_id/)
  assert.match(componentSource, /entity-browser\/\$\{encodeURIComponent\(item\.browser_entity_id\)\}\/dossier/)
  assert.doesNotMatch(componentSource, /entity-browser\/\$\{encodeURIComponent\(item\.entity_id\)\}\/dossier/)
})
