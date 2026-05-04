#!/usr/bin/env node

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  repairDossierPayload,
  shouldRepairDossier,
} from './repair-question-first-dossier-quality.mjs'

function answer(questionId, overrides = {}) {
  return {
    question_id: questionId,
    question_text: questionId,
    validation_state: 'no_signal',
    confidence: 0,
    answer: null,
    ...overrides,
  }
}

function weakFifteenPack() {
  return {
    entity_id: 'major-league-cricket',
    entity_name: 'Major League Cricket',
    entity_type: 'league',
    publish_status: 'published',
    quality_state: 'complete',
    answers: [
      answer('q1_foundation', { validation_state: 'validated', confidence: 0.9, answer: 'Major League Cricket' }),
      answer('q2_digital_stack', { validation_state: 'validated', confidence: 0.82, answer: 'Ticketing platform replacement surfaced in launch evidence.' }),
      answer('q3_leadership', { validation_state: 'validated', confidence: 0.88, answer: 'Commercial operations leadership present.' }),
      answer('q4_performance'),
      answer('q5_league_context'),
      answer('q6_launch_signal', {
        validation_state: 'validated',
        confidence: 0.86,
        answer: 'Major League Cricket is replacing its digital ticketing platform before the 2026 season.',
        evidence_url: 'https://example.com/mlc-ticketing',
      }),
      answer('q7_procurement_signal'),
      answer('q8_explicit_rfp'),
      answer('q9_news_signal'),
      answer('q10_hiring_signal'),
      answer('q11_decision_owner', {
        validation_state: 'provisional',
        confidence: 0.62,
        answer: 'Commercial Operations Lead',
        primary_owner: { name: 'Commercial Operations Lead', title: 'Commercial Operations' },
      }),
      answer('q12_connections'),
      answer('q13_capability_gap', {
        validation_state: 'provisional',
        confidence: 0.61,
        answer: { raw_structured_output: { top_gap: 'digital ticketing platform delivery' } },
      }),
      answer('q14_yp_fit'),
      answer('q15_outreach_strategy'),
    ],
    discovery_summary: null,
    sections: null,
    yellow_panther_fit: null,
  }
}

test('shouldRepairDossier targets mechanically complete weak published packs', () => {
  assert.equal(shouldRepairDossier(weakFifteenPack()), true)
})

test('repairDossierPayload synthesizes artifacts from useful signals without provider calls', () => {
  const repair = repairDossierPayload(weakFifteenPack(), 'major-league-cricket')

  assert.equal(repair.changed, true)
  assert.equal(repair.after_publish_status, 'published_partial')
  assert.equal(repair.repaired_dossier.discovery_summary.graphiti_sales_brief.status, 'available')
  assert.equal(repair.repaired_dossier.yellow_panther_fit.status, 'available')
  assert.equal(repair.repaired_dossier.yellow_panther_fit.best_service, 'DIGITAL_TRANSFORMATION')
  assert.equal(repair.repaired_dossier.discovery_summary.outreach_strategy.status, 'available')
  assert.ok(repair.repaired_dossier.sections)
})

test('repairDossierPayload demotes mechanically complete packs with no commercial artifacts', () => {
  const emptyPack = weakFifteenPack()
  emptyPack.answers = emptyPack.answers.map((item) => ({
    ...item,
    validation_state: 'no_signal',
    confidence: 0,
    answer: null,
    primary_owner: undefined,
    evidence_url: undefined,
  }))

  const repair = repairDossierPayload(emptyPack, 'major-league-cricket')

  assert.equal(repair.changed, true)
  assert.equal(repair.after_publish_status, 'published_partial')
  assert.equal(repair.repaired_dossier.discovery_summary.graphiti_sales_brief.status, 'insufficient_signal')
  assert.equal(repair.repaired_dossier.yellow_panther_fit.status, 'insufficient_signal')
})

test('repairDossierPayload does not convert failed placeholder summaries into available fit', () => {
  const failedPack = weakFifteenPack()
  failedPack.answers = failedPack.answers.map((item) => ({
    ...item,
    validation_state: 'failed',
    confidence: 0,
    answer: {
      kind: 'summary',
      value: '',
      summary: '',
      raw_structured_output: {},
      opportunity_hypotheses: [],
      commercial_interpretation: {
        themes: [],
        summary: '',
        implication_strength: '',
      },
    },
    commercial_implication: 'No completed BrightData leads were recoverable from the timed out retrieval pass.',
    primary_owner: undefined,
    evidence_url: undefined,
  }))

  const repair = repairDossierPayload(failedPack, 'major-league-cricket')

  assert.equal(repair.after_publish_status, 'published_partial')
  assert.equal(repair.repaired_dossier.discovery_summary.graphiti_sales_brief.status, 'insufficient_signal')
  assert.equal(repair.repaired_dossier.yellow_panther_fit.status, 'insufficient_signal')
  assert.equal(repair.repaired_dossier.discovery_summary.outreach_strategy.status, 'insufficient_signal')
})
