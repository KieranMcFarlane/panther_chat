import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('opportunities page is framed as a shortlist and decision surface', async () => {
  const source = await readFile(new URL('../src/app/opportunities/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /Opportunity Shortlist/)
  assert.match(source, /Review Fit|Focused decision view/)
  assert.match(source, /useSearchParams/)
  assert.match(source, /\/api\/tenders\?action=opportunities/)
  assert.match(source, /promoted_only=true/)
  assert.match(source, /canonical_entity_id|canonicalEntityId/)
  assert.match(source, /No intake-linked opportunities found|No entity-linked opportunities yet/)
  assert.match(source, /Open RFP&apos;s\/Tenders|Open RFP's\/Tenders/)
  assert.match(source, /buildOpportunityFacetOptions/)
  assert.match(source, /Competition/)
  assert.match(source, /Entity Role/)
  assert.match(source, /Opportunity Kind/)
  assert.match(source, /Theme/)
  assert.match(source, /promoted shortlist|Nothing has been promoted into the shortlist|shortlist will populate once intake is promoted/i)
})

test('tenders page is framed as the live intake feed', async () => {
  const source = await readFile(new URL('../src/app/tenders/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /Tenders Page/)
  assert.match(source, /Internal raw intake feed from our unified RFP analysis system/)
  assert.match(source, /No production-backed opportunities are available right now/)
  assert.match(source, /searchTerm|filterStatus|showDetectedOnly/)
  assert.match(source, /No production-backed opportunities are available right now/)
  assert.doesNotMatch(source, /Fetching real tender data with verified source links/)
  assert.doesNotMatch(source, /Yellow Panther Digital-First Opportunities/)
})
