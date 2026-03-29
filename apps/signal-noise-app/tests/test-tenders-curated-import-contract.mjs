import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('tenders API exposes a curated source-backed import action for smoke opportunities', async () => {
  const source = await readFile(new URL('../src/app/api/tenders/route.ts', import.meta.url), 'utf8')

  assert.match(source, /import-curated-opportunities/)
  assert.match(source, /digital-rfp-opportunities\.js/)
  assert.match(source, /real-rfp-opportunities\.js/)
})
