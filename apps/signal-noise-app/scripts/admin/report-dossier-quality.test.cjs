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
          outreach_strategy: {
            status: 'insufficient_signal',
            first_message_strategy: 'Open with the fresh trigger, explain the relevant Yellow Panther capability, and verify the right owner before deeper outreach.',
          },
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

test('perQuestionQuality uses buyer eligibility for q11 and q12 denominators', () => {
  const rows = [
    {
      dossier_data: {
        answers: [
          {
            question_id: 'q3_leadership',
            validation_state: 'no_signal',
            confidence: 0,
            answer: 'No leadership evidence found in checked sources.',
          },
          { question_id: 'q11_decision_owner', validation_state: 'no_signal', confidence: 0 },
          { question_id: 'q12_connections', validation_state: 'no_signal', confidence: 0 },
        ],
      },
    },
    {
      dossier_data: {
        answers: [
          {
            question_id: 'q3_leadership',
            validation_state: 'validated',
            confidence: 0.78,
            structured_signal: {
              ranked_people: [
                {
                  name: 'Alex Buyer',
                  role: 'Chief Commercial Officer',
                  buyer_relevance: 'commercial owner',
                },
              ],
            },
          },
          { question_id: 'q11_decision_owner', validation_state: 'validated', confidence: 0.71 },
          { question_id: 'q12_connections', validation_state: 'validated', confidence: 0.62 },
        ],
      },
    },
  ]

  const stats = perQuestionQuality(rows)

  assert.equal(stats.q11_decision_owner.total, 2)
  assert.equal(stats.q11_decision_owner.zero_confidence, 1)
  assert.equal(stats.q11_decision_owner.eligible_total, 1)
  assert.equal(stats.q11_decision_owner.eligible_zero_confidence, 0)
  assert.equal(stats.q12_connections.total, 2)
  assert.equal(stats.q12_connections.zero_confidence, 1)
  assert.equal(stats.q12_connections.eligible_total, 1)
  assert.equal(stats.q12_connections.eligible_zero_confidence, 0)
})
