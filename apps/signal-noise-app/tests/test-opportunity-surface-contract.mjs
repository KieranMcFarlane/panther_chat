import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('opportunities page is framed as a shortlist and decision surface', async () => {
  const source = await readFile(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /Opportunity Shortlist/)
  assert.match(source, /Review Fit|Focused decision view/)
  assert.match(source, /useSearchParams/)
  assert.match(source, /\/api\/opportunities/)
  assert.match(source, /\/api\/opportunities\/diagnostics/)
  assert.match(source, /canonical_entity_id|canonicalEntityId/)
  assert.match(source, /No intake-linked opportunities found|No entity-linked opportunities yet/)
  assert.match(source, /Open dossier workspace/)
  assert.match(source, /buildOpportunityFacetOptions/)
  assert.match(source, /Competition/)
  assert.match(source, /Role/)
  assert.match(source, /Signal category/)
  assert.match(source, /Theme/)
  assert.match(source, /Outreach-ready/)
  assert.match(source, /Data issues/)
  assert.match(source, /Watch/)
  assert.match(source, /Context only/)
  assert.match(source, /Verify now/)
  assert.match(source, /Research feed/)
  assert.match(source, /Strong dossier-backed recommendations that need source, trigger, or buyer verification before outreach/)
  assert.match(source, /outreach-ready/)
  assert.match(source, /to verify/)
  assert.match(source, /promoted shortlist|Nothing has been promoted into the shortlist|shortlist will populate once intake is promoted/i)
})

test('opportunities page keeps verify-now recommendations separate from active shortlist cards', async () => {
  const source = await readFile(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /verifyNowRecommendations/)
  assert.match(source, /verify_now_recommendations/)
  assert.match(source, /commercialStateCards/)
  assert.match(source, /commercial_state_cards/)
  assert.match(source, /selectedCommercialStateTab/)
  assert.match(source, /setSelectedCommercialStateTab/)
  assert.match(source, /commercialStatePage/)
  assert.match(source, /setCommercialStatePage/)
  assert.match(source, /commercial_page/)
  assert.match(source, /active shortlist|strict active shortlist|strict shortlist/i)
  assert.match(source, /filteredOpportunities\.length[\s\S]*outreach-ready/)
  assert.doesNotMatch(source, /setOpportunities\([^)]*verify_now_recommendations/)
})

test('opportunities page labels non-shortlist commercial state cards as separate tabs', async () => {
  const source = await readFile(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /commercialStateTabs/)
  assert.match(source, /commercialStateCardsByTab/)
  assert.match(source, /Not shortlist/)
  assert.match(source, /Commercial state/)
  assert.match(source, /Signals worth reviewing, but not yet approved for outreach/)
  assert.match(source, /Entity mismatch, broken extraction, missing evidence, or internal pipeline leakage/)
  assert.match(source, /Previous/)
  assert.match(source, /Next/)
  assert.match(source, /Page \{commercialStatePage\}/)
  assert.match(source, /sortCommercialStateCards/)
  assert.match(source, /Freshest/)
  assert.match(source, /Highest YP fit/)
  assert.match(source, /Most evidence/)
  assert.match(source, /bd_brief\?\.signal_title/)
  assert.match(source, /bd_brief\?\.brief_verdict/)
  assert.match(source, /YP relevance/)
  assert.match(source, /Commercial confidence/)
  assert.match(source, /Data quality issue/)
  assert.match(source, /Needs fresh trigger/)
  assert.match(source, /What changed/)
  assert.match(source, /Why it matters/)
  assert.match(source, /Yellow Panther angle/)
  assert.match(source, /Suggested route/)
  assert.match(source, /Outreach opener/)
  assert.match(source, /Verify before action/)
  assert.doesNotMatch(source, /Next check/)
  assert.match(source, /commercial_state/)
})

test('opportunities page uses solid consistent surfaces for readability', async () => {
  const source = await readFile(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /OPPORTUNITY_SURFACE_CLASS/)
  assert.match(source, /OPPORTUNITY_CARD_CLASS/)
  assert.match(source, /OPPORTUNITY_PANEL_CLASS/)
  assert.match(source, /bg-\[#101a2b\]/)
  assert.match(source, /bg-\[#14233a\]/)
  assert.doesNotMatch(source, /bg-slate-900\/30/)
  assert.doesNotMatch(source, /bg-cyan-400\/10/)
})

test('opportunities page renders numbered evidence as bullets instead of dense inline text', async () => {
  const source = await readFile(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /splitNumberedBriefText/)
  assert.match(source, /renderBriefText/)
  assert.match(source, /list-disc/)
  assert.match(source, /\\\(\\d\+\\\)/)
})

test('opportunities page keeps compact signal metadata separate from raw evidence text', async () => {
  const source = await readFile(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /formatCommercialStateSignalLabel/)
  assert.match(source, /Signal: \{formatCommercialStateSignalLabel\(card\)\}/)
  assert.doesNotMatch(source, /Signal: \{card\.bd_brief\?\.signal_title\?\.split\('—'\)\[1\]\?\.trim\(\) \|\| card\.title \|\| 'Signal'\}/)
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
