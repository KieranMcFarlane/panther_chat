import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  createDiscoveryEventResponse,
  getRecentDiscoveryEvents,
  publishDiscoveryEvent,
  resetDiscoveryEventHubForTests,
  subscribeDiscoveryEvents,
} from '../src/lib/discovery-events.ts';

afterEach(() => {
  resetDiscoveryEventHubForTests();
});

test('publishes discovery events to live subscribers and recent history', async () => {
  const seen = [];
  const unsubscribe = subscribeDiscoveryEvents((event) => {
    seen.push(event);
  }, { entityId: 'arsenal-fc' });

  publishDiscoveryEvent({
    type: 'dossier_phase_update',
    priority: 'HIGH',
    timestamp: '2026-03-27T10:00:00.000Z',
    data: {
      entityId: 'arsenal-fc',
      phaseIndex: 1,
      phaseLabel: 'Phase 1 · Discovery',
      title: 'Discovery phase started',
      detail: 'BrightData search is gathering evidence.',
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(seen.length, 1);
  assert.equal(seen[0].data.entityId, 'arsenal-fc');
  assert.equal(seen[0].data.phaseIndex, 1);

  const recent = getRecentDiscoveryEvents({ entityId: 'arsenal-fc' });
  assert.equal(recent.length, 1);
  assert.equal(recent[0].type, 'dossier_phase_update');

  unsubscribe();
});

test('creates an SSE response that replays recent discovery events', async () => {
  publishDiscoveryEvent({
    type: 'dossier_generation_status',
    priority: 'MEDIUM',
    timestamp: '2026-03-27T10:01:00.000Z',
    data: {
      entityId: 'arsenal-fc',
      stage: 'queued',
      phaseIndex: 0,
      title: 'Pipeline queued',
      detail: 'Waiting for the next hop.',
    },
  });

  const response = createDiscoveryEventResponse(new URL('http://localhost/api/streaming/events?entityId=arsenal-fc'));
  assert.ok(response.body);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (let index = 0; index < 3 && !/Pipeline queued/.test(text); index += 1) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  assert.match(text, /Pipeline queued/);
  assert.match(text, /dossier_generation_status/);

  await reader.cancel();
});
