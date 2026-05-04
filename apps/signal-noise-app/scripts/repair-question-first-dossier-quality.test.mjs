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

function leadershipBuyerPack() {
  const pack = weakFifteenPack()
  pack.answers = pack.answers.map((item) => {
    if (item.question_id === 'q3_leadership') {
      return {
        ...item,
        validation_state: 'validated',
        confidence: 0.86,
        answer: {
          kind: 'person_list',
          summary: 'Jane Buyer leads commercial partnerships.',
          raw_structured_output: {
            candidates: [
              {
                name: 'Jane Buyer',
                title: 'Chief Commercial Officer',
                function: 'commercial',
                evidence_url: 'https://example.com/jane-buyer',
              },
            ],
          },
        },
      }
    }
    if (item.question_id === 'q11_decision_owner') {
      return answer('q11_decision_owner')
    }
    return item
  })
  return pack
}

test('shouldRepairDossier targets mechanically complete weak published packs', () => {
  assert.equal(shouldRepairDossier(weakFifteenPack()), true)
})

test('repairDossierPayload synthesizes artifacts from useful signals without provider calls', () => {
  const repair = repairDossierPayload(weakFifteenPack(), 'major-league-cricket')
  const answers = Object.fromEntries(repair.repaired_dossier.question_first.answers.map((item) => [item.question_id, item]))

  assert.equal(repair.changed, true)
  assert.equal(repair.after_publish_status, 'published_partial')
  assert.equal(repair.repaired_dossier.discovery_summary.graphiti_sales_brief.status, 'available')
  assert.equal(repair.repaired_dossier.yellow_panther_fit.status, 'available')
  assert.equal(repair.repaired_dossier.yellow_panther_fit.best_service, 'DIGITAL_TRANSFORMATION')
  assert.equal(repair.repaired_dossier.discovery_summary.outreach_strategy.status, 'available')
  assert.ok(answers.q12_connections.confidence > 0)
  assert.equal(answers.q12_connections.validation_state, 'provisional')
  assert.ok(answers.q13_capability_gap.confidence > 0)
  assert.equal(answers.q13_capability_gap.validation_state, 'provisional')
  assert.ok(answers.q14_yp_fit.confidence > 0)
  assert.equal(answers.q14_yp_fit.validation_state, 'provisional')
  assert.equal(answers.q14_yp_fit.answer.raw_structured_output.best_service, 'DIGITAL_TRANSFORMATION')
  assert.ok(answers.q15_outreach_strategy.confidence > 0)
  assert.equal(answers.q15_outreach_strategy.validation_state, 'provisional')
  assert.equal(answers.q15_outreach_strategy.answer.raw_structured_output.recommended_target, 'Commercial Operations Lead')
  assert.ok(repair.repaired_dossier.sections)
})

test('repairDossierPayload synthesizes q11 and q12 from leadership buyer evidence', () => {
  const repair = repairDossierPayload(leadershipBuyerPack(), 'major-league-cricket')
  const answers = Object.fromEntries(repair.repaired_dossier.question_first.answers.map((item) => [item.question_id, item]))

  assert.equal(answers.q11_decision_owner.validation_state, 'provisional')
  assert.ok(answers.q11_decision_owner.confidence > 0)
  assert.equal(answers.q11_decision_owner.answer.raw_structured_output.primary_owner.name, 'Jane Buyer')
  assert.equal(answers.q11_decision_owner.answer.raw_structured_output.primary_owner.title, 'Chief Commercial Officer')

  assert.equal(answers.q12_connections.validation_state, 'provisional')
  assert.ok(answers.q12_connections.confidence > 0)
  assert.equal(answers.q12_connections.answer.raw_structured_output.target_person, 'Jane Buyer')
})

test('repairDossierPayload extracts q11 buyer from prose leadership answer', () => {
  const pack = leadershipBuyerPack()
  pack.answers = pack.answers.map((item) => {
    if (item.question_id === 'q3_leadership') {
      return {
        ...item,
        validation_state: 'validated',
        confidence: 0.82,
        answer: 'Leadership evidence identifies Jane Buyer, Chief Commercial Officer, as responsible for commercial partnerships and sponsorship growth.',
      }
    }
    if (item.question_id === 'q11_decision_owner') {
      return answer('q11_decision_owner')
    }
    return item
  })

  const repair = repairDossierPayload(pack, 'major-league-cricket')
  const answers = Object.fromEntries(repair.repaired_dossier.question_first.answers.map((item) => [item.question_id, item]))

  assert.equal(answers.q11_decision_owner.validation_state, 'provisional')
  assert.equal(answers.q11_decision_owner.answer.raw_structured_output.primary_owner.name, 'Jane Buyer')
  assert.equal(answers.q11_decision_owner.answer.raw_structured_output.primary_owner.title, 'Chief Commercial Officer')
  assert.equal(answers.q12_connections.answer.raw_structured_output.target_person, 'Jane Buyer')
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

test('repairDossierPayload does not treat checked-absence search text as a launch signal', () => {
  const noSignalPack = weakFifteenPack()
  noSignalPack.answers = noSignalPack.answers.map((item) => ({
    ...item,
    validation_state: 'no_signal',
    confidence: 0,
    answer: 'Web searches for launch app platform returned no results matching product, app, platform, or fan experience launches.',
    primary_owner: undefined,
    evidence_url: undefined,
  }))

  const repair = repairDossierPayload(noSignalPack, 'major-league-cricket')

  assert.equal(repair.after_publish_status, 'published_partial')
  assert.equal(repair.repaired_dossier.discovery_summary.graphiti_sales_brief.status, 'insufficient_signal')
  assert.equal(repair.repaired_dossier.yellow_panther_fit.status, 'insufficient_signal')
  assert.equal(repair.repaired_dossier.discovery_summary.outreach_strategy.status, 'insufficient_signal')
})

test('repairDossierPayload does not treat bounded no-hiring text as a commercial trigger', () => {
  const noHiringPack = weakFifteenPack()
  noHiringPack.answers = noHiringPack.answers.map((item) => ({
    ...item,
    validation_state: 'no_signal',
    confidence: 0,
    answer: 'No hiring leads found in bounded retrieval.',
    primary_owner: undefined,
    evidence_url: undefined,
  }))

  const repair = repairDossierPayload(noHiringPack, 'major-league-cricket')

  assert.equal(repair.after_publish_status, 'published_partial')
  assert.equal(repair.repaired_dossier.discovery_summary.graphiti_sales_brief.status, 'insufficient_signal')
  assert.equal(repair.repaired_dossier.yellow_panther_fit.status, 'insufficient_signal')
  assert.equal(repair.repaired_dossier.discovery_summary.outreach_strategy.status, 'insufficient_signal')
})

test('repairDossierPayload replaces stale checked-absence fit artifacts with insufficient signal', () => {
  const stalePack = weakFifteenPack()
  stalePack.answers = stalePack.answers.map((item) => ({
    ...item,
    validation_state: 'no_signal',
    confidence: 0,
    answer: 'Web searches for launch app platform returned no results matching product, app, platform, or fan experience launches.',
    primary_owner: undefined,
    evidence_url: undefined,
  }))
  stalePack.discovery_summary = {
    graphiti_sales_brief: { status: 'insufficient_signal' },
    yellow_panther_fit: {
      status: 'available',
      best_service: 'DIGITAL_TRANSFORMATION',
      fit_rationale: 'DIGITAL TRANSFORMATION is the strongest capability match because current dossier evidence points to web searches for launch app platform returned no results matching product launches.',
    },
    outreach_strategy: {
      status: 'available',
      recommended_angle: 'Web searches for launch app platform returned no results matching product launches.',
    },
  }
  stalePack.question_first = {
    discovery_summary: stalePack.discovery_summary,
    answers: stalePack.answers,
  }

  const repair = repairDossierPayload(stalePack, 'major-league-cricket')

  assert.equal(repair.repaired_dossier.yellow_panther_fit.status, 'insufficient_signal')
  assert.equal(repair.repaired_dossier.discovery_summary.outreach_strategy.status, 'insufficient_signal')
})
