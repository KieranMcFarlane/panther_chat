import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const demoInsightsPath = new URL('../src/lib/graphiti-demo-insights.ts', import.meta.url)
const demoInsightsSource = readFileSync(demoInsightsPath, 'utf8')

test('graphiti demo insight fallback covers mixed cockpit card classes and dossier destinations', () => {
  assert.match(demoInsightsSource, /opportunity/)
  assert.match(demoInsightsSource, /watch_item/)
  assert.match(demoInsightsSource, /operational/)
  assert.match(demoInsightsSource, /destination_url/)
  assert.match(demoInsightsSource, /entity-browser\/.*\/dossier\?from=1/)
})
