#!/usr/bin/env node

import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeQuestionFirstDossier } from '../src/lib/question-first-dossier.ts'

const QUESTION_IDS = [
  'q1_foundation',
  'q2_digital_stack',
  'q3_leadership',
  'q6_launch_signal',
  'q7_procurement_signal',
  'q8_explicit_rfp',
  'q9_news_signal',
  'q10_hiring_signal',
  'q4_performance',
  'q5_league_context',
  'q11_decision_owner',
  'q12_connections',
  'q13_capability_gap',
  'q14_yp_fit',
  'q15_outreach_strategy',
]

function questionType(questionId) {
  return questionId.replace(/^q\d+_/, '')
}

function baseAnswer(questionId, overrides = {}) {
  return {
    question_id: questionId,
    question_type: questionType(questionId),
    question_text: questionId,
    validation_state: 'validated',
    confidence: 0.86,
    signal_type: questionId.toUpperCase(),
    evidence_url: `https://example.com/${questionId}`,
    answer: {
      kind: 'summary',
      value: questionId,
      summary: questionId,
      raw_structured_output: {
        answer: questionId,
        summary: questionId,
      },
    },
    ...overrides,
  }
}

function goldenDossier() {
  const answers = QUESTION_IDS.map((questionId) => baseAnswer(questionId))
  const answerById = Object.fromEntries(answers.map((answer) => [answer.question_id, answer]))

  Object.assign(answerById.q11_decision_owner, {
    primary_owner: { name: 'Jane Buyer', title: 'Chief Commercial Officer' },
    answer: {
      kind: 'person_list',
      summary: 'Jane Buyer is the likely commercial buyer.',
      raw_structured_output: {
        primary_owner: { name: 'Jane Buyer', title: 'Chief Commercial Officer' },
      },
    },
  })
  answerById.q12_connections.answer = {
    kind: 'connections_path',
    raw_structured_output: {
      candidate_paths: [
        {
          name: 'Jane Buyer',
          best_yp_owner: 'Elliott Hillman',
          path_type: 'direct_connection',
          route_confidence: 0.8,
        },
      ],
    },
  }
  answerById.q13_capability_gap.answer = {
    kind: 'scorecard',
    raw_structured_output: {
      top_gap: 'digital fan platform modernization',
      summary: 'Digital fan platform modernization is the clearest capability gap.',
    },
  }
  answerById.q14_yp_fit.answer = {
    kind: 'scorecard',
    raw_structured_output: {
      best_service: 'digital product/platform',
      service_fit: ['platform strategy', 'delivery support'],
      fit_rationale: 'The launch signal and platform gap point to digital product/platform support.',
      buyer_context: 'Jane Buyer owns the commercial route.',
      evidence_basis: ['q6_launch_signal', 'q13_capability_gap'],
      confidence_caveat: 'Verify current ownership before outreach.',
    },
  }
  answerById.q15_outreach_strategy.answer = {
    kind: 'scorecard',
    raw_structured_output: {
      recommended_target: 'Jane Buyer',
      recommended_route: 'direct_connection',
      recommended_angle: 'Platform modernization tied to commercial growth.',
      first_message_strategy: 'Lead with the launch signal and ask to validate the platform roadmap.',
      verification_needed: 'Confirm Jane Buyer remains the commercial owner.',
      why_now: 'The platform launch creates an immediate delivery window.',
    },
  }

  return {
    entity_id: 'golden-club',
    entity_name: 'Golden Club',
    entity_type: 'CLUB',
    publish_status: 'published',
    questions: QUESTION_IDS.map((questionId) => ({
      question_id: questionId,
      question_type: questionType(questionId),
      question_text: questionId,
    })),
    question_first: {
      answers,
      publish_status: 'published',
    },
  }
}

function assertNoPlaceholderCopy(value, path = 'root') {
  if (value == null) return
  if (typeof value === 'string') {
    assert.doesNotMatch(value, /No deterministic answer was produced/i, `${path} contains placeholder copy`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPlaceholderCopy(item, `${path}[${index}]`))
    return
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, nested]) => assertNoPlaceholderCopy(nested, `${path}.${key}`))
  }
}

test('golden full-pack dossier produces usable q11-q15 commercial artifacts without placeholder copy', () => {
  const normalized = normalizeQuestionFirstDossier(goldenDossier(), 'golden-club')

  assert.equal(normalized.questions.length, 15)
  assert.equal(normalized.quality_state, 'complete')
  assert.equal(normalized.publish_status, 'published')
  assert.equal(normalized.discovery_summary.graphiti_sales_brief.status, 'available')
  assert.equal(normalized.discovery_summary.graphiti_sales_brief.buyer_name, 'Jane Buyer')
  assert.equal(normalized.discovery_summary.graphiti_sales_brief.best_path_owner, 'Elliott Hillman')
  assert.equal(normalized.discovery_summary.yellow_panther_fit.status, 'available')
  assert.equal(normalized.discovery_summary.yellow_panther_fit.best_service, 'digital product/platform')
  assert.equal(normalized.discovery_summary.outreach_strategy.status, 'available')
  assert.equal(normalized.discovery_summary.outreach_strategy.recommended_target, 'Jane Buyer')
  assertNoPlaceholderCopy(normalized.discovery_summary.yellow_panther_fit, 'yellow_panther_fit')
  assertNoPlaceholderCopy(normalized.discovery_summary.outreach_strategy, 'outreach_strategy')
})

test('golden weak full-pack dossier stays partial when q11-q15 have no usable signal', () => {
  const weak = goldenDossier()
  weak.publish_status = 'published'
  weak.question_first.publish_status = 'published'
  weak.question_first.answers = weak.question_first.answers.map((answer) => ({
    ...answer,
    validation_state: 'no_signal',
    confidence: 0,
    answer: null,
    primary_owner: undefined,
  }))

  const normalized = normalizeQuestionFirstDossier(weak, 'golden-club')

  assert.equal(normalized.publish_status, 'published_partial')
  assert.equal(normalized.discovery_summary.graphiti_sales_brief.status, 'insufficient_signal')
  assert.equal(normalized.discovery_summary.yellow_panther_fit.status, 'insufficient_signal')
  assert.equal(normalized.discovery_summary.outreach_strategy.status, 'insufficient_signal')
})
