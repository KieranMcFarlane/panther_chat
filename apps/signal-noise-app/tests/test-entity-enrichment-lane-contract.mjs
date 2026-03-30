import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const pageSource = await readFile(new URL('../src/app/entity-enrichment/page.tsx', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../src/components/entity-enrichment/EntityEnrichmentDashboard.tsx', import.meta.url), 'utf8');

test('entity enrichment page is framed around the OpenCode lane', () => {
  assert.match(pageSource, /OpenCode/);
  assert.match(pageSource, /LeadIQ/);
  assert.match(pageSource, /BrightData MCP/);
  assert.doesNotMatch(pageSource, /Perplexity/i);
});

test('entity enrichment dashboard uses discovery-lane enrichment status', () => {
  assert.match(dashboardSource, /\/api\/discovery-lanes\/enrichment/);
  assert.match(dashboardSource, /OpenCode/);
  assert.match(dashboardSource, /LeadIQ/);
  assert.match(dashboardSource, /BrightData MCP/);
  assert.doesNotMatch(dashboardSource, /\/api\/entity-enrichment\/(progress|start|stop)/);
  assert.doesNotMatch(dashboardSource, /Perplexity/i);
  assert.doesNotMatch(dashboardSource, /legacy batch/i);
});
