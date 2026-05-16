import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const opportunitiesSource = readFileSync(new URL('../src/app/opportunities/page.tsx', import.meta.url), 'utf8')
const rfpsSource = readFileSync(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')

test('opportunities page uses the shared app page shell primitives', () => {
  assert.match(opportunitiesSource, /OpportunitiesClientPage/)
  assert.match(opportunitiesSource, /requirePageSession/)
  assert.match(opportunitiesSource, /Suspense/)
  assert.doesNotMatch(opportunitiesSource, /Opportunity shortlist|Opportunity Shortlist/)
  assert.doesNotMatch(opportunitiesSource, /Add to Pipeline/)
  assert.doesNotMatch(opportunitiesSource, /Review Fit/)
  assert.doesNotMatch(opportunitiesSource, /shortlist/)
})

test('rfps page uses the shared app page shell primitives', () => {
  assert.match(rfpsSource, /AppPageShell/)
  assert.match(rfpsSource, /AppPageHeader/)
  assert.match(rfpsSource, /AppPageBody/)
  assert.match(rfpsSource, /Canonical RFPs/)
})
