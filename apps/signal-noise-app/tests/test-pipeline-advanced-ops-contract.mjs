import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('pipeline page is framed as advanced ops with a link back to entities', async () => {
  const pageSource = await readFile(new URL('../src/app/entity-pipeline/page.tsx', import.meta.url), 'utf8')
  const stripSource = await readFile(new URL('../src/components/layout/OperationalStatusStrip.tsx', import.meta.url), 'utf8')
  const formSource = await readFile(new URL('../src/components/entity-import/SingleEntityPipelineForm.tsx', import.meta.url), 'utf8')

  assert.match(pageSource, /Advanced Ops/)
  assert.match(pageSource, /Queue a single entity/)
  assert.match(pageSource, /\/entity-browser/)
  assert.match(stripSource, /Pipeline/)
  assert.match(stripSource, /Live Ops/)
  assert.match(formSource, /Queue entity/)
})
