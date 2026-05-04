#!/usr/bin/env node

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  artifactCoverage,
  perQuestionQuality,
  qualityState,
} = require('./report-dossier-quality.cjs')

test('qualityState demotes published dossier with missing commercial artifacts', () => {
  const row = {
    dossier_data: {
      quality_state: 'complete',
      publication_status: 'published',
      publish_status: 'published',
      answers: Array.from({ length: 15 }, (_, index) => ({
        question_id: `q${index + 1}`,
        validation_state: 'validated',
      })),
      discovery_summary: null,
      graphiti_sales_brief: null,
      yellow_panther_fit: null,
      sections: null,
    },
  }

  assert.equal(qualityState(row), 'partial')
})

test('artifactCoverage counts dossier-ready commercial artifacts', () => {
  const rows = [
    {
      dossier_data: {
        discovery_summary: {
          graphiti_sales_brief: {
            status: 'available',
            buyer_name: 'Juliet Slot',
            outreach_angle: 'Open on ticketing platform replacement.',
          },
          yellow_panther_fit: {
            fit_rationale: 'Digital transformation fit based on ticketing platform evidence.',
          },
          outreach_strategy: {
            recommended_target: 'Juliet Slot',
            recommended_angle: 'Lead with ticketing platform replacement.',
          },
        },
        executive_summary: { summary: 'Commercially useful dossier.' },
        sections: { executive_summary: { summary: 'Commercially useful dossier.' } },
      },
    },
    {
      dossier_data: {
        discovery_summary: {
          graphiti_sales_brief: { status: 'insufficient_signal' },
        },
        sections: null,
      },
    },
  ]

  assert.deepEqual(artifactCoverage(rows), {
    graphiti_sales_brief: 1,
    yellow_panther_fit: 1,
    outreach_strategy: 1,
    executive_or_strategic_summary: 1,
    sections: 1,
  })
})

test('perQuestionQuality reports validation and zero-confidence counts', () => {
  const rows = [
    {
      dossier_data: {
        answers: [
          { question_id: 'q14_yp_fit', validation_state: 'no_signal', confidence: 0 },
          { question_id: 'q15_outreach_strategy', validation_state: 'validated', confidence: 0.73 },
        ],
      },
    },
    {
      dossier_data: {
        answers: [
          { question_id: 'q14_yp_fit', validation_state: 'validated', confidence: 0.81 },
          { question_id: 'q15_outreach_strategy', validation_state: 'failed', confidence: 0 },
        ],
      },
    },
  ]

  assert.deepEqual(perQuestionQuality(rows), {
    q14_yp_fit: {
      total: 2,
      validation_states: { no_signal: 1, validated: 1 },
      zero_confidence: 1,
    },
    q15_outreach_strategy: {
      total: 2,
      validation_states: { validated: 1, failed: 1 },
      zero_confidence: 1,
    },
  })
})
