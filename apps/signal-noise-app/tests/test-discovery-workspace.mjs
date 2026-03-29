import test from 'node:test';
import assert from 'node:assert/strict';

import {
  workspaceBadges,
  pipelineSteps,
  quickLinks,
  discoveryLaneLabels,
  dossierLifecyclePreview,
} from '../src/components/discovery/discovery-workspace-content.ts';
import { discoveryNavItems } from '../src/components/layout/discovery-nav.ts';

test('discovery workspace content exposes the new lane surfaces', () => {
  assert.ok(workspaceBadges.includes('Scout'));
  assert.ok(workspaceBadges.includes('Enrichment'));
  assert.ok(workspaceBadges.includes('Phase 0-5'));
  assert.ok(pipelineSteps.some((step) => step.name === 'GLM Reasoning'));
  assert.ok(quickLinks.some((link) => link.href === '/graph'));
  assert.ok(discoveryLaneLabels.some((lane) => lane.href === '/opportunities'));
  assert.equal(dossierLifecyclePreview.length, 6);
  assert.equal(dossierLifecyclePreview[0].label, 'Phase 0');
});

test('discovery navigation exposes scout and enrichment routes', () => {
  const routes = discoveryNavItems.map((item) => item.href);

  assert.ok(routes.includes('/scout'));
  assert.ok(routes.includes('/enrichment'));
  assert.ok(routes.includes('/pipeline'));
});
