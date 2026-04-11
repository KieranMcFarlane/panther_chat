import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const opportunitiesSource = readFileSync(new URL('../src/app/opportunities/page.tsx', import.meta.url), 'utf8')
const tendersSource = readFileSync(new URL('../src/app/tenders/page.tsx', import.meta.url), 'utf8')

test('opportunities page uses the shared app page shell primitives', () => {
  assert.match(opportunitiesSource, /AppPageShell/)
  assert.match(opportunitiesSource, /AppPageHeader/)
  assert.match(opportunitiesSource, /AppPageBody/)
  assert.match(opportunitiesSource, /Opportunity shortlist|Opportunity Shortlist/)
})

test('tenders page uses the shared app page shell primitives', () => {
  assert.match(tendersSource, /AppPageShell/)
  assert.match(tendersSource, /AppPageHeader/)
  assert.match(tendersSource, /AppPageBody/)
  assert.match(tendersSource, /Raw tenders feed|raw intake feed/i)
})
