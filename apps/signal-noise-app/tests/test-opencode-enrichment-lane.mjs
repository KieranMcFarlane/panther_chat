import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LeadIqClient } from '../src/lib/discovery-lanes/leadiq-client.ts';
import {
  buildOpenCodeEnrichmentArtifact,
  writeOpenCodeEnrichmentArtifact,
} from '../src/lib/discovery-lanes/opencode-enrichment.ts';

const mockFetch = async (_url, init) => {
  const body = JSON.parse(init.body);

  if (body.operationName === 'SearchCompany') {
    return new Response(JSON.stringify({
      data: {
        searchCompany: {
          totalResults: 1,
          hasMore: false,
          results: [
            {
              id: 'company-1',
              name: 'Major League Cricket',
              domain: 'majorleaguecricket.com',
              industry: 'Sports',
              description: 'Professional cricket league',
              numberOfEmployees: 18,
            }
          ]
        }
      }
    }), { status: 200 });
  }

  if (body.operationName === 'FlatAdvancedSearch') {
    return new Response(JSON.stringify({
      data: {
        flatAdvancedSearch: {
          totalPeople: 2,
          people: [
            {
              id: 'person-1',
              name: 'Tom Dunmore',
              title: 'VP of Marketing',
              role: 'Marketing',
              company: {
                id: 'company-1',
                name: 'Major League Cricket',
                domain: 'majorleaguecricket.com',
                employeeCount: 18,
                industry: 'Sports',
                description: 'Professional cricket league'
              }
            }
          ]
        }
      }
    }), { status: 200 });
  }

  throw new Error(`Unexpected operation: ${body.operationName}`);
};

test('buildOpenCodeEnrichmentArtifact enriches scout candidates with LeadIQ data', async () => {
  const client = new LeadIqClient({
    apiKey: 'test-key',
    baseUrl: 'https://api.leadiq.com/graphql',
    fetchImpl: mockFetch,
  });

  const artifact = await buildOpenCodeEnrichmentArtifact({
    scoutArtifact: {
      id: 'scout-001',
      lane: 'scout',
      system: 'manus',
      graph_write: false,
      status: 'completed',
      objective: {
        id: 'scout-001',
        lane: 'scout',
        system: 'manus',
        objective: 'Find sports procurement leads',
        sport_scope: 'sports-universe',
        seed_query: 'sports procurement rfp',
        source_priority: ['google_serp'],
        confidence_threshold: 0.65,
        candidate_budget: 5,
        graph_write: false,
        status: 'completed',
        validation_state: 'pending',
        captured_at: new Date().toISOString(),
      },
      accepted_candidates: [
        {
          id: 'cand-1',
          title: 'Major League Cricket digital transformation opportunity',
          source: 'linkedin',
          source_url: 'https://example.com/ace-rfp',
          summary: 'ACE issued a digital transformation RFP',
          confidence: 0.91,
          freshness: 'fresh',
          state: 'accepted',
          follow_up_query: 'Major League Cricket digital transformation',
          source_urls: ['https://example.com/ace-rfp'],
          validation_state: 'validated',
        },
      ],
      rejected_candidates: [],
      stale_candidates: [],
      summary: { total_candidates: 1, accepted: 1, rejected: 0, stale: 0 },
      generated_at: new Date().toISOString(),
    },
    leadIqClient: client,
  });

  assert.equal(artifact.lane, 'enrichment');
  assert.equal(artifact.graph_write, false);
  assert.equal(artifact.status, 'completed');
  assert.equal(artifact.enriched_candidates.length, 1);
  assert.equal(artifact.enriched_candidates[0].company.name, 'Major League Cricket');
  assert.equal(artifact.enriched_candidates[0].contacts[0].title, 'VP of Marketing');
  assert.equal(artifact.enriched_candidates[0].contacts[0].company_name, 'Major League Cricket');
});

test('writeOpenCodeEnrichmentArtifact persists the enrichment artifact as JSON', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'opencode-enrich-'));
  const artifact = await writeOpenCodeEnrichmentArtifact({
    outputDir,
    artifact: {
      id: 'enrichment-001',
      lane: 'enrichment',
      system: 'opencode',
      graph_write: false,
      status: 'completed',
      source_artifact_id: 'scout-001',
      enriched_candidates: [],
      summary: { total_candidates: 0, enriched: 0 },
    },
  });

  const raw = await readFile(artifact.filePath, 'utf8');
  const parsed = JSON.parse(raw);

  assert.equal(parsed.system, 'opencode');
  assert.equal(parsed.graph_write, false);
  assert.equal(parsed.status, 'completed');
});
