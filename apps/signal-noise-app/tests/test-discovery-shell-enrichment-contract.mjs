import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const summaryRouteSource = await readFile(new URL('../src/app/api/operational-summary/route.ts', import.meta.url), 'utf8');
const panelSource = await readFile(new URL('../src/components/discovery/ContinuousSystemPanel.tsx', import.meta.url), 'utf8');

test('operational summary uses discovery-lane enrichment state', () => {
  assert.match(summaryRouteSource, /readLaneSnapshot\(\{ lane: 'enrichment'/);
  assert.doesNotMatch(summaryRouteSource, /entityDossierEnrichmentService/);
});

test('continuous system panel reads discovery-lane enrichment snapshot', () => {
  assert.match(panelSource, /\/api\/discovery-lanes\/enrichment/);
  assert.doesNotMatch(panelSource, /\/api\/entity-enrichment\/progress/);
});
