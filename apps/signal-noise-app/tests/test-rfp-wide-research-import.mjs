import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMergedWideResearchImport,
} from '../src/lib/rfp-wide-research-import.mjs'

test('merged wide research import rebuilds the prompt from titles and exports stable unified rows', () => {
  const result = buildMergedWideResearchImport({
    rawBatch: {
      prompt_execution_metadata: {
        request_label: 'Yellow Panther web-platform RFP discovery',
        seed_query: 'Yellow Panther web-platform RFP discovery',
        target_year: 2026,
        excluded_known_organizations: ['USA Archery'],
      },
      opportunities: [
        {
          title: 'USA Archery Website Rebuild & Modernization Project',
          organization: 'USA Archery',
          source_url: 'https://example.com/usa-archery',
          confidence: 0.96,
          yellow_panther_fit: 10,
          entity_name: 'USA Archery',
          category: 'rfp',
          status: 'deadline_passed',
          deadline: '2026-03-31',
          description: 'Website rebuild and modernization.',
          metadata: { fit_rationale: 'Website rebuild.' },
        },
      ],
      entity_actions: [
        {
          entity_name: 'USA Archery',
          action: 'create',
          source_url: 'https://example.com/usa-archery',
        },
      ],
    },
    existingMergedBatch: {
      run_id: 'manus-rfp-wide-research-merged',
      source: 'manus',
      prompt: 'old prompt',
      generated_at: '2026-04-13T00:00:00.000Z',
      focus_area: 'web-platforms',
      lane_label: 'Web Platforms',
      seed_query: 'Yellow Panther digital-fit RFP discovery',
      target_year: 2026,
      excluded_names: ['Old Opportunity'],
      opportunities: [
        {
          id: 'existing-1',
          title: 'Old Opportunity',
          organization: 'Old Org',
          source_url: 'https://example.com/old',
          confidence: 0.9,
          yellow_panther_fit: 80,
          entity_name: 'Old Org',
          canonical_entity_id: null,
          canonical_entity_name: 'Old Org',
          category: 'rfp',
          status: 'qualified',
          deadline: null,
          description: null,
          metadata: {},
        },
      ],
      entity_actions: [],
    },
  })

  assert.equal(result.mergedBatch.run_id, 'manus-rfp-wide-research-merged')
  assert.match(result.mergedBatch.prompt, /Target year: 2026/i)
  assert.match(result.mergedBatch.prompt, /Already found RFP titles \(exclude these from the next sweep\)/i)
  assert.match(result.mergedBatch.prompt, /Old Opportunity/i)
  assert.match(result.mergedBatch.prompt, /USA Archery Website Rebuild & Modernization Project/i)
  assert.equal(result.mergedBatch.opportunities.length, 2)
  assert.equal(result.unifiedRows.length, 2)
  assert.equal(result.unifiedRows[0].batch_id, 'manus-rfp-wide-research-merged')
  assert.ok(result.unifiedRows[0].id)
  assert.equal(result.mergedBatch.entity_actions.length, 1)
})
