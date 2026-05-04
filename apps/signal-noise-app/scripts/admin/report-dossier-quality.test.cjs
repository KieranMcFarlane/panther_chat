#!/usr/bin/env node

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  artifactCoverage,
  hasBuyerRouteEligibility,
  hasCommercialSynthesisEligibility,
  perQuestionQuality,
  qualityState,
  targetedRerunBacklog,
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
      eligible_total: 0,
      eligible_zero_confidence: 0,
    },
    q15_outreach_strategy: {
      total: 2,
      validation_states: { validated: 1, failed: 1 },
      zero_confidence: 1,
      eligible_total: 0,
      eligible_zero_confidence: 0,
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

test('perQuestionQuality uses commercial synthesis eligibility for q14 and q15 denominators', () => {
  const rows = [
    {
      dossier_data: {
        answers: [
          { question_id: 'q6_launch_signal', validation_state: 'no_signal', confidence: 0, answer: 'No launch signal found.' },
          { question_id: 'q14_yp_fit', validation_state: 'no_signal', confidence: 0 },
          { question_id: 'q15_outreach_strategy', validation_state: 'no_signal', confidence: 0 },
        ],
      },
    },
    {
      dossier_data: {
        answers: [
          { question_id: 'q6_launch_signal', validation_state: 'validated', confidence: 0.82, answer: 'The club launched a new digital ticketing app.' },
          {
            question_id: 'q11_decision_owner',
            validation_state: 'provisional',
            confidence: 0.62,
            answer: 'Jane Buyer, Chief Commercial Officer',
          },
          { question_id: 'q14_yp_fit', validation_state: 'provisional', confidence: 0.58 },
          { question_id: 'q15_outreach_strategy', validation_state: 'provisional', confidence: 0.56 },
        ],
      },
    },
  ]

  const stats = perQuestionQuality(rows)

  assert.equal(stats.q14_yp_fit.total, 2)
  assert.equal(stats.q14_yp_fit.zero_confidence, 1)
  assert.equal(stats.q14_yp_fit.eligible_total, 1)
  assert.equal(stats.q14_yp_fit.eligible_zero_confidence, 0)
  assert.equal(stats.q15_outreach_strategy.eligible_total, 1)
  assert.equal(stats.q15_outreach_strategy.eligible_zero_confidence, 0)
})

test('commercial synthesis eligibility rejects placeholder q13 gap output', () => {
  const dossier = {
    answers: [
      {
        question_id: 'q13_capability_gap',
        validation_state: 'provisional',
        confidence: 0.55,
        answer: {
          kind: 'scorecard',
          value: 'kind: summary',
          summary: 'kind: summary',
          raw_structured_output: {
            top_gap: 'kind: summary',
            gap_label: 'kind: summary',
            evidence_basis: ['No hiring leads found in bounded retrieval.'],
          },
        },
      },
      { question_id: 'q14_yp_fit', validation_state: 'no_signal', confidence: 0 },
      { question_id: 'q15_outreach_strategy', validation_state: 'no_signal', confidence: 0 },
    ],
  }

  assert.equal(hasCommercialSynthesisEligibility(dossier), false)

  const stats = perQuestionQuality([{ dossier_data: dossier }])
  assert.equal(stats.q14_yp_fit.eligible_total, 0)
  assert.equal(stats.q15_outreach_strategy.eligible_total, 0)
})

test('commercial synthesis eligibility does not count buyer route alone as a trigger', () => {
  const dossier = {
    answers: [
      {
        question_id: 'q11_decision_owner',
        validation_state: 'validated',
        confidence: 0.92,
        answer: {
          kind: 'person',
          summary: 'Ivo Ferriani is the President and likely commercial decision owner.',
          raw_structured_output: {
            primary_owner: {
              name: 'Ivo Ferriani',
              title: 'President',
            },
          },
        },
      },
      {
        question_id: 'q12_connections',
        validation_state: 'provisional',
        confidence: 0.52,
        answer: {
          kind: 'connections_path',
          summary: 'Ivo Ferriani is the buyer path to verify via cold.',
          raw_structured_output: {
            target_person: 'Ivo Ferriani',
            recommended_route: 'cold',
          },
        },
      },
      { question_id: 'q14_yp_fit', validation_state: 'no_signal', confidence: 0 },
      { question_id: 'q15_outreach_strategy', validation_state: 'no_signal', confidence: 0 },
    ],
  }

  assert.equal(hasBuyerRouteEligibility(dossier), true)
  assert.equal(hasCommercialSynthesisEligibility(dossier), false)

  const stats = perQuestionQuality([{ dossier_data: dossier }])
  assert.equal(stats.q14_yp_fit.eligible_total, 0)
  assert.equal(stats.q15_outreach_strategy.eligible_total, 0)
})

test('perQuestionQuality requires buyer route eligibility for q15 outreach denominator', () => {
  const rows = [
    {
      dossier_data: {
        answers: [
          {
            question_id: 'q2_digital_stack',
            validation_state: 'provisional',
            confidence: 0.72,
            answer: 'WSC Sports and Blinkfire show a meaningful digital and sponsorship analytics stack.',
          },
          { question_id: 'q14_yp_fit', validation_state: 'provisional', confidence: 0.58 },
          { question_id: 'q15_outreach_strategy', validation_state: 'no_signal', confidence: 0 },
        ],
      },
    },
  ]

  const stats = perQuestionQuality(rows)

  assert.equal(stats.q14_yp_fit.eligible_total, 1)
  assert.equal(stats.q14_yp_fit.eligible_zero_confidence, 0)
  assert.equal(stats.q15_outreach_strategy.eligible_total, 0)
  assert.equal(stats.q15_outreach_strategy.eligible_zero_confidence, 0)
})

test('hasBuyerRouteEligibility rejects checked absence leadership prose', () => {
  const dossier = {
    answers: [
      {
        question_id: 'q3_leadership',
        validation_state: 'provisional',
        confidence: 0.55,
        answer: 'Key leadership identified, but detailed figures for commercial, partnerships, marketing, digital, technology, and strategy functions could not be confirmed from available sources.',
      },
      { question_id: 'q11_decision_owner', validation_state: 'no_signal', confidence: 0 },
      { question_id: 'q12_connections', validation_state: 'no_signal', confidence: 0 },
    ],
  }

  assert.equal(hasBuyerRouteEligibility(dossier), false)
})

test('hasBuyerRouteEligibility rejects private entity leadership absence prose', () => {
  const dossier = {
    answers: [
      {
        question_id: 'q3_leadership',
        validation_state: 'provisional',
        confidence: 0.4,
        answer: 'Fred Ridley serves as Chairman. The club does not publicly disclose its executive structure, board members, or staff in functional roles such as commercial, partnerships, marketing, digital, technology, or strategy. No publicly available evidence identifies individuals in those specific functional leadership positions.',
      },
      { question_id: 'q11_decision_owner', validation_state: 'no_signal', confidence: 0 },
      { question_id: 'q12_connections', validation_state: 'no_signal', confidence: 0 },
    ],
  }

  assert.equal(hasBuyerRouteEligibility(dossier), false)
})

test('targetedRerunBacklog reports upstream rerun candidates with reason codes', () => {
  const rows = [
    {
      canonical_entity_id: 'major-league-cricket',
      entity_name: 'Major League Cricket',
      dossier_data: {
        answers: [
          { question_id: 'q1_foundation', validation_state: 'failed', confidence: 0, answer: 'Provider infrastructure failure.' },
          { question_id: 'q2_digital_stack', validation_state: 'failed', confidence: 0, answer: 'Provider infrastructure failure.' },
          { question_id: 'q3_leadership', validation_state: 'failed', confidence: 0, answer: 'Provider infrastructure failure.' },
          { question_id: 'q6_launch_signal', validation_state: 'validated', confidence: 0.82, answer: 'The league launched a new ticketing app.' },
          { question_id: 'q14_yp_fit', validation_state: 'no_signal', confidence: 0 },
        ],
      },
    },
  ]

  const backlog = targetedRerunBacklog(rows)

  assert.equal(backlog.total_entities, 1)
  assert.equal(backlog.total_recommendations, 3)
  assert.deepEqual(backlog.by_question, {
    q1_foundation: 1,
    q2_digital_stack: 1,
    q3_leadership: 1,
  })
  assert.equal(backlog.recommendations[0].canonical_entity_id, 'major-league-cricket')
  assert.equal(backlog.recommendations[0].reason, 'upstream_failed_blocks_commercial_synthesis')
})
