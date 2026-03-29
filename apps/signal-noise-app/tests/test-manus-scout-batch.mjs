import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  normalizeManusScoutObjective,
  buildManusScoutArtifact,
  writeManusScoutArtifact,
} from '../src/lib/discovery-lanes/manus-scout.ts';

test('normalizeManusScoutObjective adds the scout defaults', () => {
  const objective = normalizeManusScoutObjective({
    objective: 'Find general sports RFPs for venue technology partners',
    sport_scope: 'sports-universe',
    seed_query: 'sports venue digital transformation rfp',
  });

  assert.equal(objective.lane, 'scout');
  assert.equal(objective.system, 'manus');
  assert.equal(objective.status, 'queued');
  assert.equal(objective.graph_write, false);
  assert.equal(objective.source_priority[0], 'google_serp');
});

test('buildManusScoutArtifact separates accepted, rejected, and stale candidates', () => {
  const artifact = buildManusScoutArtifact({
    objective: {
      id: 'scout-001',
      objective: 'Find sports procurement leads',
      seed_query: 'sports procurement rfp',
    },
    candidates: [
      {
        id: 'cand-1',
        title: 'LinkedIn post: ACE issued a digital transformation RFP',
        state: 'accepted',
        source: 'linkedin',
        source_url: 'https://example.com/ace-rfp',
        confidence: 0.91,
      },
      {
        id: 'cand-2',
        title: 'Generic sports news mention',
        state: 'rejected',
        source: 'news',
        source_url: 'https://example.com/noise',
        confidence: 0.22,
      },
      {
        id: 'cand-3',
        title: 'Old tender page',
        state: 'stale',
        source: 'official_site',
        source_url: 'https://example.com/stale',
        confidence: 0.5,
      },
    ],
  });

  assert.equal(artifact.graph_write, false);
  assert.equal(artifact.accepted_candidates.length, 1);
  assert.equal(artifact.rejected_candidates.length, 1);
  assert.equal(artifact.stale_candidates.length, 1);
});

test('writeManusScoutArtifact persists the scout artifact as JSON', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'manus-scout-'));
  const artifact = await writeManusScoutArtifact({
    outputDir,
    artifact: {
      id: 'scout-001',
      lane: 'scout',
      system: 'manus',
      graph_write: false,
      status: 'completed',
      objective: {
        id: 'scout-001',
        objective: 'Find sports procurement leads',
        seed_query: 'sports procurement rfp',
      },
      accepted_candidates: [],
      rejected_candidates: [],
      stale_candidates: [],
    },
  });

  assert.ok(artifact.filePath.endsWith('.json'));
  const raw = await readFile(artifact.filePath, 'utf8');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.system, 'manus');
  assert.equal(parsed.graph_write, false);
});
