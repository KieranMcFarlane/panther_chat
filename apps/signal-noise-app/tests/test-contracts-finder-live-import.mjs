import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { extractContractsFinderOpportunities } from '../src/lib/contracts-finder-live-import.ts'

const contractsFinderSnippet = `
<div class="search-result">
  <div class="search-result-header" title="REQUEST FOR INFORMATION - PROJECT HORUS">
    <h2 id=e45c4cd2-5f64-4d59-9807-9648f9c22843>
      <a href="https://www.contractsfinder.service.gov.uk/notice/e45c4cd2-5f64-4d59-9807-9648f9c22843?origin=SearchResults&p=1" class="govuk-link search-result-rwh break-word" data-page="1">
        REQUEST FOR INFORMATION - PROJECT HORUS
      </a>
    </h2>
  </div>
  <div class="search-result-sub-header wrap-text">Ministry of Defence</div>
  <div class="search-result-spacer">&nbsp;</div>
  <div class="wrap-text">The Royal Navy requires a rapidly procured and persistent air search capability, suitable for maritime platforms.</div>
  <div class="search-result-entry"><strong>Procurement stage</strong> Early engagement</div>
  <div class="search-result-entry"><strong>Notice status</strong> Open</div>
  <div class="search-result-entry"><strong>Closing</strong> 31 March 2026</div>
  <div class="search-result-entry"><strong>Contract location</strong> PO2 8BY</div>
  <div class="search-result-entry"><strong>Publication date</strong> 19 March 2026, last edited 27 March 2026</div>
</div>
`

test('extracts a Contracts Finder notice with a unique notice URL', () => {
  const opportunities = extractContractsFinderOpportunities(contractsFinderSnippet, {
    searchUrl: 'https://www.contractsfinder.service.gov.uk/Search/Results?Page=1&sort=CloseDate-desc&search=sports%20technology',
    limit: 10,
  })

  assert.equal(opportunities.length, 1)
  assert.deepEqual(opportunities[0], {
    id: 'contracts-finder-e45c4cd2-5f64-4d59-9807-9648f9c22843',
    title: 'REQUEST FOR INFORMATION - PROJECT HORUS',
    organization: 'Ministry of Defence',
    description: 'The Royal Navy requires a rapidly procured and persistent air search capability, suitable for maritime platforms.',
    location: 'PO2 8BY',
    value: null,
    deadline: '2026-03-31',
    published: '2026-03-19T00:00:00.000Z',
    source: 'Contracts Finder',
    source_url: 'https://www.contractsfinder.service.gov.uk/notice/e45c4cd2-5f64-4d59-9807-9648f9c22843?origin=SearchResults&p=1',
    url: 'https://www.contractsfinder.service.gov.uk/notice/e45c4cd2-5f64-4d59-9807-9648f9c22843?origin=SearchResults&p=1',
    category: 'Government Procurement',
    status: 'qualified',
    confidence: 0.82,
    yellow_panther_fit: 80,
    priority_score: 8,
  })
})

test('tenders route exposes a Contracts Finder live import action', () => {
  const routePath = path.resolve(process.cwd(), 'src/app/api/tenders/route.ts')
  const routeSource = fs.readFileSync(routePath, 'utf8')

  assert.match(routeSource, /import-contracts-finder-opportunities/)
  assert.match(routeSource, /contractsfinder\.service\.gov\.uk/)
})
