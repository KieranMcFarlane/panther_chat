import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeScoutLead,
  normalizeEnrichmentResult,
} from '../src/lib/discovery-lanes/types.ts';

import {
  LeadIqClient,
} from '../src/lib/discovery-lanes/leadiq-client.ts';

test('normalizeScoutLead adds the discovery lane defaults', () => {
  const lead = normalizeScoutLead({
    id: 'lead-001',
    source: 'manus',
    source_url: 'https://example.com/opportunity',
    title: 'Sports venue procurement lead',
    summary: 'Venue operator is seeking a digital partner',
    confidence: 0.82,
    follow_up_query: 'sports venue digital procurement rfp',
  });

  assert.equal(lead.id, 'lead-001');
  assert.equal(lead.lane, 'scout');
  assert.equal(lead.state, 'candidate');
  assert.equal(lead.freshness, 'fresh');
  assert.equal(lead.validation_state, 'pending');
  assert.deepEqual(lead.source_urls, ['https://example.com/opportunity']);
});

test('normalizeEnrichmentResult preserves company and people enrichment fields', () => {
  const enrichment = normalizeEnrichmentResult({
    id: 'lead-001',
    company: {
      name: 'Major League Cricket',
      domain: 'majorleaguecricket.com',
      employee_count: 18,
    },
    contacts: [
      { name: 'Tom Dunmore', title: 'VP of Marketing' },
    ],
    decision_makers: ['Tom Dunmore'],
    source_urls: ['https://leadiq.com/c/major-league-cricket/6038f65d411f372b40786937'],
  });

  assert.equal(enrichment.id, 'lead-001');
  assert.equal(enrichment.lane, 'enrichment');
  assert.equal(enrichment.validation_state, 'pending');
  assert.equal(enrichment.company.name, 'Major League Cricket');
  assert.equal(enrichment.contacts[0].title, 'VP of Marketing');
  assert.deepEqual(enrichment.decision_makers, ['Tom Dunmore']);
});

test('LeadIqClient builds search payloads from a scout lead', () => {
  const client = new LeadIqClient({
    apiKey: 'test-key',
    baseUrl: 'https://developer.leadiq.com/api',
  });

  const company = client.buildCompanySearchRequest({
    company_name: 'Major League Cricket',
    company_domain: 'majorleaguecricket.com',
    country_code: 'US',
  });

  const people = client.buildFlatAdvancedSearchRequest({
    title: 'Marketing',
    company_name: 'Major League Cricket',
    country_code: 'US',
  });

  const grouped = client.buildGroupedAdvancedSearchRequest({
    company_name: 'Major League Cricket',
    company_domain: 'majorleaguecricket.com',
    country_code: 'US',
  });

  const feedback = client.buildPersonFeedbackRequest({
    personId: 'person-123',
    status: 'bad',
    reason: 'outdated title',
  });

  assert.equal(company.query.company_name, 'Major League Cricket');
  assert.equal(people.query.title, 'Marketing');
  assert.equal(grouped.query.company_domain, 'majorleaguecricket.com');
  assert.equal(feedback.body.status, 'Invalid');
  assert.equal(feedback.body.value, 'outdated title');
});
