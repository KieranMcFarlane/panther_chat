import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('wide research route references Manus execution and canonical entity reconciliation', async () => {
  const source = await readFile(new URL('../src/app/api/rfp-wide-research/route.ts', import.meta.url), 'utf8')

  assert.match(source, /MANUS_API/)
  assert.match(source, /Set MANUS_API in \.env before running wide research\./)
  assert.match(source, /https:\/\/api\.manus\.ai\/v1\/tasks/)
  assert.match(source, /API_KEY/)
  assert.match(source, /focusArea/)
  assert.match(source, /web-platforms/)
  assert.match(source, /toText\(body\.prompt\) \|\| buildWideRfpResearchPrompt/)
  assert.match(source, /getDefaultWideRfpSeedQuery/)
  assert.match(source, /buildWideRfpResearchPrompt/)
  assert.match(source, /normalizeWideRfpResearchBatch/)
  assert.match(source, /canonical_entities/)
  assert.match(source, /upsert/)
  assert.match(source, /create an entity|createCanonicalEntity|ensureCanonicalEntity/i)
  assert.match(source, /original_source_url/)
  assert.match(source, /created_via/)
  assert.match(source, /description/)
  assert.match(source, /deadline/)
  assert.match(source, /category/)
  assert.match(source, /writeWideRfpResearchArtifact|persist/i)
})
