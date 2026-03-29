import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('perplexity RFP storage assigns canonical entity linkage before insert', async () => {
  const source = await readFile(new URL('../src/app/api/store-perplexity-rfps/route.ts', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /entity_id:\s*null/)
  assert.doesNotMatch(source, /entity_name:\s*null/)
  assert.match(source, /linkOpportunityToCanonicalEntity/)
  assert.match(source, /canonical_entity_id|canonicalEntity\.canonical_entity_id/)
})
