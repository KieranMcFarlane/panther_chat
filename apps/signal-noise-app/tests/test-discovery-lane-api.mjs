import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readLaneSnapshot, readDiscoveryPipelineSnapshot } from '../src/lib/discovery-lanes/lane-status.ts';

async function seedLaneFile(outputDir, fileName, payload) {
  await writeFile(join(outputDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

test('scout status route returns the latest scout artifact', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'discovery-scout-'));
  await seedLaneFile(outputDir, 'manus_scout_001.json', {
    id: '001',
    lane: 'scout',
    system: 'manus',
    status: 'completed',
    graph_write: false,
    summary: { total_candidates: 2, accepted: 1, rejected: 1, stale: 0 },
  });

  const snapshot = await readLaneSnapshot({ lane: 'scout', outputDir });

  assert.equal(snapshot.status, 'completed');
  assert.equal(snapshot.summary.total_candidates, 2);
});

test('enrichment status route returns the latest enrichment artifact', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'discovery-enrich-'));
  await seedLaneFile(outputDir, 'opencode_enrichment_001.json', {
    id: '001',
    lane: 'enrichment',
    system: 'opencode',
    status: 'completed',
    graph_write: false,
    summary: { total_candidates: 1, enriched: 1 },
  });

  const snapshot = await readLaneSnapshot({ lane: 'enrichment', outputDir });

  assert.equal(snapshot.status, 'completed');
  assert.equal(snapshot.summary.total_candidates, 1);
});

test('pipeline status route combines scout and enrichment status', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'discovery-pipeline-'));
  await seedLaneFile(outputDir, 'manus_scout_001.json', {
    id: '001',
    lane: 'scout',
    system: 'manus',
    status: 'completed',
    graph_write: false,
    summary: { total_candidates: 2, accepted: 1, rejected: 1, stale: 0 },
  });
  await seedLaneFile(outputDir, 'opencode_enrichment_001.json', {
    id: '001',
    lane: 'enrichment',
    system: 'opencode',
    status: 'running',
    graph_write: false,
    summary: { total_candidates: 1, enriched: 0 },
  });

  const snapshot = await readDiscoveryPipelineSnapshot({ outputDir });

  assert.equal(snapshot.status, 'active');
  assert.equal(snapshot.scout.status, 'completed');
  assert.equal(snapshot.enrichment.status, 'running');
});

test('pipeline status route stays active when no lane artifacts exist yet', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'discovery-pipeline-empty-'));

  const snapshot = await readDiscoveryPipelineSnapshot({ outputDir });

  assert.equal(snapshot.status, 'active');
  assert.equal(snapshot.scout.status, 'active');
  assert.equal(snapshot.enrichment.status, 'active');
  assert.equal(snapshot.scout.summary.state, 'awaiting_first_snapshot');
  assert.equal(snapshot.enrichment.summary.state, 'awaiting_first_snapshot');
});
