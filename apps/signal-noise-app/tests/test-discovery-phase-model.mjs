import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dossierLifecyclePhases,
  deriveDossierPhaseIndex,
  deriveDossierPhaseSnapshot,
  deriveControlCenterStatusColumns,
  deriveControlCenterBacklogSummary,
  deriveControlCenterMomentumStrip,
  deriveControlCenterPhaseStrip,
  derivePipelinePhaseIndex,
  formatRelativeElapsed,
} from '../src/components/discovery/discovery-phase-model.ts';

test('dossier lifecycle defines six visible phases', () => {
  assert.equal(dossierLifecyclePhases.length, 6);
  assert.equal(dossierLifecyclePhases[0].label, 'Phase 0 · Intake');
  assert.equal(dossierLifecyclePhases[5].label, 'Phase 5 · Publish');
});

test('deriveDossierPhaseIndex promotes dossier state from evidence to publish', () => {
  const seed = deriveDossierPhaseIndex({});
  const evidence = deriveDossierPhaseIndex({
    rawEvidence: ['https://example.com'],
  });
  const publish = deriveDossierPhaseIndex({
    metadata: {
      rfp_confidence: 0.92,
      browser_dossier_url: 'https://example.com/dossier',
    },
  });

  assert.equal(seed, 0);
  assert.equal(evidence, 2);
  assert.equal(publish, 5);
});

test('deriveDossierPhaseSnapshot returns a coherent phase progress model', () => {
  const snapshot = deriveDossierPhaseSnapshot({
    metadata: {
      rfp_confidence: 0.84,
      next_action: 'Validate the evidence trail',
      freshness: 'fresh',
    },
    source_urls: ['https://example.com/rfp'],
    contacts: [{ name: 'Jane Doe' }],
  });

  assert.equal(snapshot.currentPhaseIndex, 4);
  assert.equal(snapshot.freshness, 'fresh');
  assert.equal(snapshot.nextAction, 'Validate the evidence trail');
  assert.ok(snapshot.evidenceCount >= 2);
  assert.equal(snapshot.phaseStatuses[4].status, 'active');
});

test('derivePipelinePhaseIndex tracks scout and enrichment progress', () => {
  assert.equal(derivePipelinePhaseIndex(null, null), 0);
  assert.equal(
    derivePipelinePhaseIndex(
      {
        status: 'active',
        scout: { status: 'completed' },
        enrichment: { status: 'queued' },
      },
      null
    ),
    3
  );
  assert.equal(
    derivePipelinePhaseIndex(
      {
        status: 'healthy',
        scout: { status: 'completed' },
        enrichment: { status: 'completed' },
      },
      null
    ),
    5
  );
});

test('formatRelativeElapsed makes live timestamps easy to read', () => {
  const reference = new Date('2026-03-27T12:00:00.000Z');

  assert.equal(formatRelativeElapsed(reference, reference), 'just now');
  assert.equal(formatRelativeElapsed(new Date('2026-03-27T11:59:10.000Z'), reference), '50s ago');
  assert.equal(formatRelativeElapsed(new Date('2026-03-27T11:58:00.000Z'), reference), '2m ago');
  assert.equal(formatRelativeElapsed(new Date('2026-03-27T10:00:00.000Z'), reference), '2h ago');
  assert.equal(formatRelativeElapsed('not-a-date', reference), 'unknown time');
});

test('deriveControlCenterStatusColumns surfaces now next and blocked items', () => {
  const columns = deriveControlCenterStatusColumns(
    {
      status: 'active',
      scout: { status: 'completed' },
      enrichment: { status: 'queued' },
      updated_at: '2026-03-27T11:59:00.000Z',
    },
    {
      isRunning: true,
      statistics: { successRate: 72 },
      batch: { processedEntities: 4, totalEntities: 10, currentEntity: 'Major League Cricket' },
      timestamp: '2026-03-27T11:59:45.000Z',
    },
    [
      {
        id: 'feed-1',
        timestamp: '2026-03-27T11:59:50.000Z',
        title: 'Scout lead found',
        detail: 'Major League Cricket procurement signal detected.',
        kind: 'scout',
      },
    ],
    'Wait for enrichment to finish, then validate the new evidence.'
  );

  assert.equal(columns.now[0].label, 'Active now');
  assert.equal(columns.now[0].value, 'Enrichment running');
  assert.equal(columns.next[0].label, 'Next');
  assert.match(columns.next[0].value, /Wait for enrichment/);
  assert.equal(columns.blocked[0].label, 'Blocked');
  assert.ok(columns.blocked[0].value.length > 0);
});

test('deriveControlCenterMomentumStrip summarizes what changed in the last minute', () => {
  const reference = new Date('2026-03-27T12:00:00.000Z');
  const strip = deriveControlCenterMomentumStrip(
    [
      {
        timestamp: '2026-03-27T11:59:45.000Z',
        title: 'Scout lead found',
        detail: 'Major League Cricket procurement signal detected.',
      },
      {
        timestamp: '2026-03-27T11:59:20.000Z',
        title: 'Enrichment queued',
        detail: 'LeadIQ enrichment waiting on the next hop.',
      },
    ],
    reference
  );

  assert.equal(strip[0].label, 'Last minute');
  assert.match(strip[0].value, /2 updates/);
  assert.equal(strip[1].label, 'Most recent');
  assert.match(strip[1].value, /Scout lead found/);
});

test('deriveControlCenterBacklogSummary surfaces stale sources and revisit due items', () => {
  const reference = new Date('2026-03-27T12:00:00.000Z');
  const backlog = deriveControlCenterBacklogSummary(
    {
      status: 'degraded',
      scout: { status: 'completed', summary: { updated_at: '2026-03-25T12:00:00.000Z' } },
      enrichment: { status: 'queued', summary: { updated_at: '2026-03-24T12:00:00.000Z' } },
    },
    {
      isRunning: false,
      statistics: { successRate: 72 },
      batch: { processedEntities: 4, totalEntities: 10 },
    },
    reference
  );

  assert.equal(backlog[0].label, 'Stale sources');
  assert.match(backlog[0].value, /stale/i);
  assert.equal(backlog[1].label, 'Revisit due');
  assert.match(backlog[1].value, /review/i);
});

test('deriveControlCenterPhaseStrip renders a compact phase bar for the home screen', () => {
  const strip = deriveControlCenterPhaseStrip(3, 62);

  assert.equal(strip.length, 6);
  assert.equal(strip[0].status, 'complete');
  assert.equal(strip[3].status, 'active');
  assert.ok(strip[3].progress >= 62);
});
