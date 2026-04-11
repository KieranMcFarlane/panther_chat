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
  assert.match(opportunitiesSource, /sm:grid-cols-2 xl:grid-cols-4/)
  assert.match(opportunitiesSource, /min-w-0 rounded-lg border border-custom-border bg-custom-box p-4/)
  assert.match(opportunitiesSource, /grid grid-cols-1 gap-3 sm:grid-cols-2/)
  assert.match(opportunitiesSource, /grid grid-cols-2 gap-2 text-xs sm:grid-cols-4/)
  assert.match(opportunitiesSource, /flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between/)
})

test('tenders page uses the shared app page shell primitives', () => {
  assert.match(tendersSource, /AppPageShell/)
  assert.match(tendersSource, /AppPageHeader/)
  assert.match(tendersSource, /AppPageBody/)
  assert.match(tendersSource, /Raw tenders feed|raw intake feed/i)
})
