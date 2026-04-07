import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dossierTabsSource = readFileSync(new URL('../src/lib/dossier-tabs.ts', import.meta.url), 'utf8')

test('phase 1 dossier tabs expose the priority client-visible question-first views', () => {
  assert.match(dossierTabsSource, /value:\s*['"`]overview['"`]/)
  assert.match(dossierTabsSource, /value:\s*['"`]digital-stack['"`]/)
  assert.match(dossierTabsSource, /value:\s*['"`]procurement-ecosystem['"`]/)
  assert.match(dossierTabsSource, /value:\s*['"`]decision-owners-pois['"`]/)
  assert.match(dossierTabsSource, /value:\s*['"`]evidence-sources['"`]/)
})

test('phase 1 dossier tabs derive from normalized question-first fields instead of legacy-only sections', () => {
  assert.match(dossierTabsSource, /question_first/)
  assert.match(dossierTabsSource, /run_rollup/)
  assert.match(dossierTabsSource, /answers/)
  assert.match(dossierTabsSource, /poi_graph/)
})
