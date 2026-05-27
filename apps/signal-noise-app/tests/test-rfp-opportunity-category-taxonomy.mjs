import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeRfpOpportunityCategory,
  normalizeRfpOpportunityType,
} from '../src/lib/rfp-opportunity-category-taxonomy.mjs'

test('rfp opportunity category taxonomy collapses noisy Manus labels', () => {
  const cases = [
    [{ category: 'digital_transformation' }, 'digital transformation'],
    [{ category: 'RFP', title: 'FIFA World Cup 2026 Federal Grants Consultant RFP' }, 'event operations'],
    [{ category: null, title: 'High Commission of India Suva Website Redesign & Hosting RFP' }, 'website redesign'],
    [
      {
        category: 'Venue Technology/Digital Infrastructure/Fan Experience',
        title: 'Arrowhead Stadium - $375M World Cup Renovation Technology Upgrades',
      },
      'venue technology',
    ],
    [{ category: 'Ticketing & CRM', title: 'London Stadium 185 Ticketing System Contract' }, 'crm'],
    [{ category: 'digital_media_and_fan_growth_signal', title: 'Tender to Elevate Media and Commercial Strategy' }, 'streaming & media'],
  ]

  for (const [opportunity, expected] of cases) {
    assert.equal(normalizeRfpOpportunityCategory(opportunity), expected)
  }
})

test('rfp opportunity taxonomy separates direct RFPs from signals', () => {
  const directRfp = {
    title: 'ASSA Website Redevelopment RFP',
    status: 'open',
    metadata: { source_type: 'official_rfp' },
  }
  const signal = {
    title: 'DAZN Acquisition of ViewLift - Sports Streaming Platform',
    status: 'announced',
    metadata: { source_type: 'market_signal' },
  }
  const deploymentSignal = {
    title: 'LA Convention Center - WiFi 7 Network Deployment',
    status: 'deployed',
    metadata: { source_type: 'deployment_announcement' },
  }

  assert.equal(normalizeRfpOpportunityType(directRfp), 'rfp')
  assert.equal(normalizeRfpOpportunityType(signal), 'signal')
  assert.equal(normalizeRfpOpportunityType(deploymentSignal), 'signal')
})
