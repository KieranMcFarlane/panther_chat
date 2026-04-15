import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const bridgeSource = readFileSync(new URL('../src/lib/rfp-graphiti-bridge.ts', import.meta.url), 'utf8')

test('rfp graphiti bridge searches graphiti and syncs batches', () => {
  assert.match(bridgeSource, /GRAPH_INTELLIGENCE_API/)
  assert.match(bridgeSource, /search-entities/)
  assert.match(bridgeSource, /api\/graphiti/)
  assert.match(bridgeSource, /add-episode/)
  assert.match(bridgeSource, /buildGraphitiEpisodePayload/)
  assert.match(bridgeSource, /syncWideRfpBatchToGraphiti/)
})
