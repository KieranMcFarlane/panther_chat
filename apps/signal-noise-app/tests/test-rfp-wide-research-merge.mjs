import test from 'node:test'
import assert from 'node:assert/strict'

import { joinWideRfpResearchBatches } from '../src/lib/rfp-wide-research.mjs'

test('joinWideRfpResearchBatches merges multiple Manus validated batches into one canonical batch', () => {
  const merged = joinWideRfpResearchBatches([
    {
      run_id: 'yp_rfps_2026-04-12_sports_digital_2026_only_01',
      source: 'manus',
      prompt: 'first prompt',
      generated_at: '2026-04-13T10:37:47.103Z',
      focus_area: 'web-platforms',
      lane_label: 'Web Platforms',
      seed_query: 'seed one',
      opportunities: [{ id: 'a' }, { id: 'b' }],
      entity_actions: [{ action: 'link' }],
    },
    {
      run_id: 'yp_rfps_2026-04-12_sports_digital_sweep_01',
      source: 'manus',
      prompt: 'second prompt',
      generated_at: '2026-04-13T10:37:48.420Z',
      focus_area: 'web-platforms',
      lane_label: 'Web Platforms',
      seed_query: 'seed two',
      opportunities: [{ id: 'c' }],
      entity_actions: [{ action: 'create' }],
    },
  ])

  assert.equal(merged.run_id, 'manus-rfp-wide-research-merged')
  assert.equal(merged.source, 'manus')
  assert.equal(merged.focus_area, 'web-platforms')
  assert.equal(merged.lane_label, 'Web Platforms')
  assert.equal(merged.seed_query, 'seed one')
  assert.equal(merged.opportunities.length, 3)
  assert.equal(merged.entity_actions.length, 2)
  assert.equal(merged.summary.total_opportunities, 3)
  assert.equal(merged.summary.linked_entities, 1)
  assert.equal(merged.summary.entities_to_create, 1)
})
