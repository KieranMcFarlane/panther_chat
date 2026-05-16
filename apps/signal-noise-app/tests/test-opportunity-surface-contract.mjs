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
  assert.match(source, /Cards blocked by entity mismatch, missing evidence, stale data, or pipeline leakage/)
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
  assert.match(source, /Why it is interesting/)
  assert.match(source, /Possible YP angle/)
  assert.match(source, /What would promote it/)
  assert.match(source, /Context summary/)
  assert.match(source, /Issue type/)
  assert.doesNotMatch(source, /Next check/)
  assert.match(source, /commercial_state/)
})

test('commercial state cards use state-specific research labels instead of sales labels', async () => {
  const source = await readFile(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /formatCommercialStateCardCopy/)
  assert.match(source, /Why it is interesting/)
  assert.match(source, /Why it is not actionable yet/)
  assert.match(source, /Possible YP angle/)
  assert.match(source, /What would promote it/)
  assert.match(source, /Context summary/)
  assert.match(source, /Why not commercial/)
  assert.match(source, /Issue type/)
  assert.match(source, /Recommended fix/)
  assert.match(source, /showOutreachOpener/)
  assert.match(source, /commercialCopy\.showOutreachOpener \?/)
  assert.doesNotMatch(source, /<div className="text-\[11px\] uppercase tracking-\[0\.14em\] text-slate-400">Suggested route<\/div>/)
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

test('opportunities page renders full brief text without generated ellipses', async () => {
  const source = await readFile(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /cleaned\.slice\([^)]*\)\.trim\(\)}\.\.\./)
  assert.doesNotMatch(source, /return `\$\{cleaned\.slice/)
  assert.match(source, /\.replace\(\/…\/g, ''\)/)
  assert.match(source, /\.replace\(\/\\\.\{3\}\/g, ''\)/)
})

test('opportunities page keeps compact signal metadata separate from raw evidence text', async () => {
  const source = await readFile(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /formatCommercialStateSignalLabel/)
  assert.match(source, /Signal: \{formatCommercialStateSignalLabel\(card\)\}/)
  assert.doesNotMatch(source, /Signal: \{card\.bd_brief\?\.signal_title\?\.split\('—'\)\[1\]\?\.trim\(\) \|\| card\.title \|\| 'Signal'\}/)
})

test('commercial state tabs refresh in place without replacing the page loading state', async () => {
  const source = await readFile(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /useRef/)
  assert.match(source, /hasLoadedInitialDataRef/)
  assert.match(source, /let cancelled = false/)
  assert.match(source, /if \(cancelled\) return/)
  assert.match(source, /cancelled = true/)
  assert.match(source, /commercialStateLoading/)
  assert.match(source, /setCommercialStateLoading/)
  assert.match(source, /aria-busy=\{commercialStateLoading\}/)
  assert.match(source, /Updating cards/)
  assert.doesNotMatch(source, /setLoading\(true\);\n\s*setLoadError\(null\);/)
})

test('commercial state tabs hide stale bucket pagination while the selected tab is loading', async () => {
  const source = await readFile(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /showingOutreachReadyTab && !commercialStateLoading/)
  assert.match(source, /showingVerifyNowTab && !commercialStateLoading/)
  assert.match(source, /showingMaterializedStateTab && !commercialStateLoading/)
})

test('commercial state tabs are contained inside the research feed controls', async () => {
  const source = await readFile(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /role="tablist"/)
  assert.match(source, /aria-label="Commercial state filters"/)
  assert.match(source, /role="tab"/)
  assert.match(source, /aria-selected=\{selectedCommercialStateTab === tab\.key\}/)
  assert.match(source, /className="[^"]*w-fit[^"]*max-w-full[^"]*rounded-xl[^"]*border border-slate-700[^"]*bg-\[#14233a\][^"]*p-1/)
  assert.match(source, /overflow-x-auto/)
  assert.doesNotMatch(source, /<div className="mt-4 flex flex-wrap gap-2">\s*\{\s*commercialStateTabs\.map/)
})

test('commercial state tabs own outreach-ready and verify-now panels without separate lane sections', async () => {
  const source = await readFile(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /showingOutreachReadyTab/)
  assert.match(source, /showingVerifyNowTab/)
  assert.match(source, /selectedCommercialStateTab === 'outreach_ready'/)
  assert.match(source, /selectedCommercialStateTab === 'verify_now'/)
  assert.match(source, /filteredOpportunities\.map/)
  assert.match(source, /verifyNowRecommendations\.map/)
  assert.match(source, /commercialStateCardsByTab\.map/)
  assert.doesNotMatch(source, /text-xs font-semibold uppercase tracking-\[0\.16em\] text-yellow-200">Outreach-ready/)
  assert.doesNotMatch(source, /text-xs font-semibold uppercase tracking-\[0\.16em\] text-slate-300">Verify now<\/div>\s*<h2 className="mt-1 text-xl font-semibold text-white">Recommendations needing verification/)
})

test('rfps page is the canonical RFP research surface', async () => {
  const source = await readFile(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /Canonical RFPs/)
  assert.match(source, /Merged Manus wide research batch/)
  assert.match(source, /wide_rfp_research_batches/)
  assert.match(source, /WideResearchRefreshButton/)
  assert.doesNotMatch(source, /Internal raw intake feed from our unified RFP analysis system/)
  assert.doesNotMatch(source, /Yellow Panther Digital-First Opportunities/)
})
