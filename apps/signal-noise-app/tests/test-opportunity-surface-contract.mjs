import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('opportunities page is framed as a shortlist and decision surface', async () => {
  const source = await readFile(new URL('../src/app/opportunities/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /Opportunity Shortlist/)
  assert.match(source, /Decision Surface/)
  assert.match(source, /Add to Pipeline/)
})

test('tenders page is framed as the live intake feed', async () => {
  const source = await readFile(new URL('../src/app/tenders/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /Live Intake Feed/)
  assert.match(source, /RFP&apos;s & Tenders|RFP's & Tenders/)
  assert.match(source, /Refresh Feed/)
})
