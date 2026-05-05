#!/usr/bin/env node

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTargetedRerunRecommendations,
  normalizeUpstreamAnswer,
  parseArgs,
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

test('shouldRepairDossier ignores skeleton question definitions without answers', () => {
  const pack = weakFifteenPack()
  pack.answers = pack.answers.filter((item) => [
    'q11_decision_owner',
    'q12_connections',
    'q14_yp_fit',
    'q15_outreach_strategy',
  ].includes(item.question_id))
  pack.question_first = { answers: pack.answers }
  pack.questions = [
    'q1_foundation',
    'q2_digital_stack',
    'q3_leadership',
    'q4_performance',
    'q5_league_context',
    'q6_launch_signal',
    'q7_procurement_signal',
    'q8_explicit_rfp',
    'q9_news_signal',
    'q10_hiring_signal',
    'q11_decision_owner',
    'q12_connections',
    'q13_capability_gap',
    'q14_yp_fit',
    'q15_outreach_strategy',
  ].map((question_id) => ({ question_id, question_text: question_id }))

  assert.equal(shouldRepairDossier(pack), false)
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

test('repairDossierPayload synthesizes q12 from prose q11 buyer answer', () => {
  const pack = weakFifteenPack()
  pack.answers = pack.answers.map((item) => {
    if (item.question_id === 'q3_leadership') {
      return answer('q3_leadership')
    }
    if (item.question_id === 'q11_decision_owner') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.78,
        primary_owner: undefined,
        answer: {
          kind: 'list',
          summary: 'Shaun Lockwood, Chief Commercial Officer, Club Doncaster',
          raw_structured_output: {
            answer: 'Shaun Lockwood, Chief Commercial Officer, Club Doncaster',
            context: 'Shaun Lockwood oversees commercial partnerships, sponsorship, and sales.',
          },
        },
      }
    }
    if (item.question_id === 'q12_connections') {
      return answer('q12_connections')
    }
    return item
  })

  const repair = repairDossierPayload(pack, 'doncaster-rovers')
  const answers = Object.fromEntries(repair.repaired_dossier.question_first.answers.map((item) => [item.question_id, item]))

  assert.equal(answers.q12_connections.validation_state, 'provisional')
  assert.equal(answers.q12_connections.answer.raw_structured_output.target_person, 'Shaun Lockwood')
  assert.equal(answers.q12_connections.answer.raw_structured_output.target_role, 'Chief Commercial Officer')
})

test('repairDossierPayload does not promote descriptive paragraphs as buyer targets', () => {
  const pack = weakFifteenPack()
  const descriptiveBuyer = "FDJ-Suez leverages a technology and partnership stack comprising Shimano, Garmin, TrainingPeaks, Vekta, INDIBA, Buycycle, and Dynamic, with WordPress and WooCommerce elements supporting commercial operations."
  pack.answers = pack.answers.map((item) => {
    if (item.question_id === 'q3_leadership') {
      return answer('q3_leadership')
    }
    if (item.question_id === 'q11_decision_owner') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.82,
        primary_owner: undefined,
        answer: {
          kind: 'list',
          summary: descriptiveBuyer,
          raw_structured_output: {
            primary_owner: {
              name: descriptiveBuyer,
              title: null,
            },
            answer: descriptiveBuyer,
          },
        },
      }
    }
    if (item.question_id === 'q12_connections') {
      return answer('q12_connections')
    }
    if (item.question_id === 'q15_outreach_strategy') {
      return answer('q15_outreach_strategy')
    }
    return item
  })

  const repair = repairDossierPayload(pack, 'fdj-suez')
  const answers = Object.fromEntries(repair.repaired_dossier.question_first.answers.map((item) => [item.question_id, item]))

  assert.notEqual(repair.repaired_dossier.discovery_summary.graphiti_sales_brief.buyer_name, descriptiveBuyer)
  assert.notEqual(answers.q15_outreach_strategy.answer.raw_structured_output.recommended_target, descriptiveBuyer)
  assert.equal(answers.q12_connections.validation_state, 'no_signal')
})

test('repairDossierPayload does not promote year strings as buyer targets', () => {
  const pack = weakFifteenPack()
  pack.answers = pack.answers.map((item) => {
    if (item.question_id === 'q3_leadership') {
      return answer('q3_leadership')
    }
    if (item.question_id === 'q11_decision_owner') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.82,
        primary_owner: undefined,
        answer: {
          kind: 'list',
          summary: '1875',
          raw_structured_output: {
            primary_owner: {
              name: '1875',
              title: null,
            },
            answer: '1875',
          },
        },
      }
    }
    if (item.question_id === 'q12_connections') {
      return answer('q12_connections')
    }
    if (item.question_id === 'q15_outreach_strategy') {
      return answer('q15_outreach_strategy')
    }
    return item
  })

  const repair = repairDossierPayload(pack, 'milan-cortina-2026')
  const answers = Object.fromEntries(repair.repaired_dossier.question_first.answers.map((item) => [item.question_id, item]))

  assert.notEqual(repair.repaired_dossier.discovery_summary.graphiti_sales_brief.buyer_name, '1875')
  assert.notEqual(answers.q15_outreach_strategy.answer.raw_structured_output.recommended_target, '1875')
  assert.equal(answers.q12_connections.validation_state, 'no_signal')
})

test('repairDossierPayload replaces existing year-string buyer artifacts', () => {
  const pack = weakFifteenPack()
  pack.discovery_summary = {
    graphiti_sales_brief: {
      status: 'available',
      buyer_name: '2026',
      outreach_target: '2026',
    },
    outreach_strategy: {
      status: 'available',
      recommended_target: '2026',
      recommended_angle: 'Open on the current event cycle.',
    },
  }
  pack.answers = pack.answers.map((item) => {
    if (item.question_id === 'q3_leadership') return answer('q3_leadership')
    if (item.question_id === 'q11_decision_owner') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.82,
        primary_owner: undefined,
        answer: {
          kind: 'list',
          summary: '2026',
          raw_structured_output: {
            primary_owner: { name: '2026', title: null },
            answer: '2026',
          },
        },
      }
    }
    return item
  })

  const repair = repairDossierPayload(pack, 'milan-cortina-2026')

  assert.notEqual(repair.repaired_dossier.discovery_summary.graphiti_sales_brief.buyer_name, '2026')
  assert.notEqual(repair.repaired_dossier.discovery_summary.outreach_strategy.recommended_target, '2026')
  assert.equal(repair.repaired_dossier.discovery_summary.outreach_strategy.status, 'insufficient_signal')
})

test('repairDossierPayload demotes insufficient-signal q11 answer objects', () => {
  const pack = weakFifteenPack()
  pack.answers = pack.answers.map((item) => {
    if (item.question_id === 'q11_decision_owner') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.52,
        answer: {
          kind: 'list',
          value: null,
          summary: 'insufficient_signal',
          raw_structured_output: {
            question: 'Who is the highest probability buyer?',
            answer: 'insufficient_signal',
            context: '',
            sources: ['https://example.com/history'],
            confidence: 0.52,
          },
        },
      }
    }
    return item
  })

  const repair = repairDossierPayload(pack, 'baseball-australia')
  const answers = Object.fromEntries(repair.repaired_dossier.question_first.answers.map((item) => [item.question_id, item]))
  const summary = repair.repaired_dossier.discovery_summary

  assert.equal(answers.q11_decision_owner.validation_state, 'no_signal')
  assert.equal(answers.q11_decision_owner.confidence, 0)
  assert.equal(summary.graphiti_sales_brief.status, 'insufficient_signal')
  assert.equal(summary.graphiti_sales_brief.buyer_name, null)
})

test('shouldRepairDossier targets zero-confidence q12 when q11 has buyer evidence', () => {
  const pack = weakFifteenPack()
  pack.publish_status = 'draft'
  pack.discovery_summary = {
    graphiti_sales_brief: { status: 'available', buyer_name: 'Shaun Lockwood' },
    yellow_panther_fit: { status: 'available', fit_rationale: 'Commercial partnership fit.' },
    outreach_strategy: { status: 'available', recommended_target: 'Shaun Lockwood' },
  }
  pack.answers = pack.answers.map((item) => {
    if (item.question_id === 'q11_decision_owner') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.78,
        primary_owner: undefined,
        answer: {
          kind: 'list',
          summary: 'Shaun Lockwood, Chief Commercial Officer, Club Doncaster',
          raw_structured_output: {
            answer: 'Shaun Lockwood, Chief Commercial Officer, Club Doncaster',
          },
        },
      }
    }
    if (item.question_id === 'q12_connections') {
      return answer('q12_connections')
    }
    return item
  })

  assert.equal(shouldRepairDossier(pack), true)
})

test('repairDossierPayload fills q15 target from q12 buyer path', () => {
  const pack = weakFifteenPack()
  pack.discovery_summary = {
    graphiti_sales_brief: { status: 'available' },
    yellow_panther_fit: {
      status: 'available',
      best_service: 'DIGITAL_TRANSFORMATION',
      fit_rationale: 'Digital launch evidence creates a platform delivery opportunity.',
    },
    outreach_strategy: {
      status: 'available',
      recommended_angle: 'Lead with the digital launch trigger.',
      first_message_strategy: 'Open with the launch trigger and verify the owner.',
      why_now: 'Digital launch is current.',
    },
  }
  pack.answers = pack.answers.map((item) => {
    if (item.question_id === 'q11_decision_owner') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.58,
        answer: {
          kind: 'person',
          summary: 'Nathan Bombrys is the likely buyer.',
          raw_structured_output: {
            primary_owner: { name: 'Nathan Bombrys', title: 'CEO' },
          },
        },
      }
    }
    if (item.question_id === 'q12_connections') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.52,
        answer: {
          kind: 'connections_path',
          summary: 'Nathan Bombrys is the buyer path to verify via cold.',
          raw_structured_output: {
            target_person: 'Nathan Bombrys',
            target_role: 'CEO',
            recommended_route: 'cold',
          },
        },
      }
    }
    if (item.question_id === 'q15_outreach_strategy') {
      return answer('q15_outreach_strategy')
    }
    return item
  })

  const repair = repairDossierPayload(pack, 'canadian-rugby-union')
  const answers = Object.fromEntries(repair.repaired_dossier.question_first.answers.map((item) => [item.question_id, item]))

  assert.equal(answers.q15_outreach_strategy.validation_state, 'provisional')
  assert.equal(answers.q15_outreach_strategy.answer.raw_structured_output.recommended_target, 'Nathan Bombrys')
})

test('repairDossierPayload overwrites provisional q15 when target is missing but q12 has buyer path', () => {
  const pack = weakFifteenPack()
  pack.discovery_summary = {
    graphiti_sales_brief: { status: 'available' },
    yellow_panther_fit: {
      status: 'available',
      best_service: 'DIGITAL_TRANSFORMATION',
      fit_rationale: 'Digital launch evidence creates a platform delivery opportunity.',
    },
    outreach_strategy: {
      status: 'available',
      recommended_angle: 'Lead with the digital launch trigger.',
      first_message_strategy: 'Open with the launch trigger and verify the owner.',
      why_now: 'Digital launch is current.',
    },
  }
  pack.answers = pack.answers.map((item) => {
    if (item.question_id === 'q11_decision_owner') {
      return answer('q11_decision_owner')
    }
    if (item.question_id === 'q12_connections') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.52,
        answer: {
          kind: 'connections_path',
          summary: 'Corin Haines is the buyer path to verify via cold.',
          raw_structured_output: {
            target_person: 'Corin Haines',
            target_role: 'CEO',
            recommended_route: 'cold',
          },
        },
      }
    }
    if (item.question_id === 'q15_outreach_strategy') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.56,
        answer: {
          kind: 'scorecard',
          summary: 'Verify the buyer: Lead with the digital launch trigger.',
          raw_structured_output: {
            recommended_target: null,
            recommended_route: 'cold',
            recommended_angle: 'Lead with the digital launch trigger.',
            why_now: 'Digital launch is current.',
          },
        },
      }
    }
    return item
  })

  const repair = repairDossierPayload(pack, 'colchester-united')
  const answers = Object.fromEntries(repair.repaired_dossier.question_first.answers.map((item) => [item.question_id, item]))

  assert.equal(answers.q15_outreach_strategy.answer.raw_structured_output.recommended_target, 'Corin Haines')
})

test('repairDossierPayload synthesizes q14 and q15 from meaningful q13 gap plus buyer path', () => {
  const pack = weakFifteenPack()
  pack.discovery_summary = null
  pack.yellow_panther_fit = null
  pack.answers = pack.answers.map((item) => {
    if (['q2_digital_stack', 'q6_launch_signal', 'q7_procurement_signal', 'q9_news_signal', 'q10_hiring_signal'].includes(item.question_id)) {
      return answer(item.question_id)
    }
    if (item.question_id === 'q11_decision_owner') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.75,
        answer: {
          kind: 'person',
          summary: 'Osvaldo Martínez Arias is the likely commercial decision owner.',
          raw_structured_output: {
            primary_owner: {
              name: 'Osvaldo Martínez Arias',
              title: 'President',
            },
          },
        },
      }
    }
    if (item.question_id === 'q12_connections') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.52,
        answer: {
          kind: 'connections_path',
          summary: 'Osvaldo Martínez Arias is the buyer path to verify via cold.',
          raw_structured_output: {
            target_person: 'Osvaldo Martínez Arias',
            target_role: 'President',
            recommended_route: 'cold',
          },
        },
      }
    }
    if (item.question_id === 'q13_capability_gap') {
      return {
        ...item,
        validation_state: 'validated',
        confidence: 0.82,
        answer: {
          kind: 'scorecard',
          summary: 'digital product/platform delivery',
          raw_structured_output: {
            top_gap: 'digital product/platform delivery',
            gap_label: 'digital product/platform delivery',
            evidence_basis: ['q2_digital_stack', 'lapsed domain and social-only footprint'],
          },
        },
      }
    }
    if (['q14_yp_fit', 'q15_outreach_strategy'].includes(item.question_id)) {
      return answer(item.question_id)
    }
    return item
  })

  const repair = repairDossierPayload(pack, 'cuba-volleyball-federation')
  const answers = Object.fromEntries(repair.repaired_dossier.question_first.answers.map((item) => [item.question_id, item]))

  assert.equal(answers.q14_yp_fit.validation_state, 'provisional')
  assert.equal(answers.q14_yp_fit.answer.raw_structured_output.best_service, 'DIGITAL_TRANSFORMATION')
  assert.match(answers.q14_yp_fit.answer.raw_structured_output.fit_rationale, /digital product.platform delivery/i)
  assert.equal(answers.q15_outreach_strategy.validation_state, 'provisional')
  assert.equal(answers.q15_outreach_strategy.answer.raw_structured_output.recommended_target, 'Osvaldo Martínez Arias')
})

test('repairDossierPayload synthesizes q14 from meaningful q2 digital stack evidence', () => {
  const pack = weakFifteenPack()
  pack.discovery_summary = null
  pack.yellow_panther_fit = null
  pack.answers = pack.answers.map((item) => {
    if (item.question_id === 'q2_digital_stack') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.72,
        answer: {
          kind: 'signal_set',
          summary: 'The team uses WSC Sports for automated highlights, Blinkfire for sponsorship analytics, Adobe Analytics, and a Web3 fan engagement platform.',
          raw_structured_output: {
            commercial_implication: 'Digital product/platform and commercial analytics stack is visible.',
          },
        },
      }
    }
    if (['q6_launch_signal', 'q7_procurement_signal', 'q9_news_signal', 'q10_hiring_signal', 'q11_decision_owner', 'q12_connections'].includes(item.question_id)) {
      return answer(item.question_id)
    }
    if (item.question_id === 'q13_capability_gap') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.55,
        answer: {
          kind: 'scorecard',
          summary: 'kind: summary',
          raw_structured_output: { top_gap: 'kind: summary' },
        },
      }
    }
    if (['q14_yp_fit', 'q15_outreach_strategy'].includes(item.question_id)) {
      return answer(item.question_id)
    }
    return item
  })

  const repair = repairDossierPayload(pack, 'fc-barcelona-basket')
  const answers = Object.fromEntries(repair.repaired_dossier.question_first.answers.map((item) => [item.question_id, item]))

  assert.equal(answers.q14_yp_fit.validation_state, 'provisional')
  assert.equal(answers.q14_yp_fit.answer.raw_structured_output.best_service, 'DIGITAL_TRANSFORMATION')
  assert.match(answers.q14_yp_fit.answer.raw_structured_output.fit_rationale, /commercial analytics stack/i)
  assert.equal(answers.q15_outreach_strategy.validation_state, 'no_signal')
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

test('normalizeUpstreamAnswer converts empty provider objects into explicit failed records', () => {
  const patch = normalizeUpstreamAnswer({
    question_id: 'q3_leadership',
    validation_state: 'validated',
    confidence: 0,
    answer: {},
  })

  assert.equal(patch.validation_state, 'failed')
  assert.equal(patch.confidence, 0)
  assert.equal(patch.structured_signal.status, 'malformed_answer')
  assert.equal(patch.structured_signal.malformed_answer_reason, 'empty_provider_object')
  assert.match(patch.commercial_implication, /malformed answer/i)
  assert.equal(patch.checked_sources[0].rationale, 'Provider returned an empty object instead of a typed q3_leadership answer.')
})

test('normalizeUpstreamAnswer converts [object Object] strings into explicit failed records', () => {
  const patch = normalizeUpstreamAnswer({
    question_id: 'q2_digital_stack',
    validation_state: 'validated',
    confidence: 0.4,
    answer: '[object Object]',
  })

  assert.equal(patch.validation_state, 'failed')
  assert.equal(patch.confidence, 0)
  assert.equal(patch.structured_signal.status, 'malformed_answer')
  assert.equal(patch.structured_signal.malformed_answer_reason, 'object_string')
  assert.doesNotMatch(JSON.stringify(patch), /\[object Object\]/)
})

test('normalizeUpstreamAnswer converts nested [object Object] strings into explicit failed records', () => {
  const patch = normalizeUpstreamAnswer({
    question_id: 'q3_leadership',
    validation_state: 'no_signal',
    confidence: 0,
    answer: {
      kind: 'list',
      raw_structured_output: {
        answer: '[object Object]',
        summary: 'No deterministic answer was produced for this question.',
        sources: [],
      },
    },
  })

  assert.equal(patch.validation_state, 'failed')
  assert.equal(patch.confidence, 0)
  assert.equal(patch.structured_signal.status, 'malformed_answer')
  assert.equal(patch.structured_signal.malformed_answer_reason, 'object_string')
  assert.doesNotMatch(JSON.stringify(patch), /\[object Object\]/)
})

test('normalizeUpstreamAnswer converts provider no-answer placeholders into explicit failed records', () => {
  const patch = normalizeUpstreamAnswer({
    question_id: 'q3_leadership',
    validation_state: 'no_signal',
    confidence: 0,
    answer: {
      kind: 'list',
      summary: 'No deterministic answer was produced for this question.',
      raw_structured_output: {
        answer: { kind: 'list', value: null, summary: null },
        context: 'No deterministic answer was produced for this question.',
        sources: [],
        summary: 'No deterministic answer was produced for this question.',
        validation_state: 'no_signal',
      },
    },
  })

  assert.equal(patch.validation_state, 'failed')
  assert.equal(patch.confidence, 0)
  assert.equal(patch.structured_signal.status, 'provider_no_answer')
  assert.equal(patch.structured_signal.provider_no_answer_reason, 'provider_no_answer')
  assert.match(patch.commercial_implication, /provider produced no deterministic answer/i)
})

test('normalizeUpstreamAnswer converts q11 provider no-answer placeholders into explicit failed records', () => {
  const patch = normalizeUpstreamAnswer({
    question_id: 'q11_decision_owner',
    validation_state: 'no_signal',
    confidence: 0,
    answer: {
      kind: 'summary',
      raw_structured_output: {
        answer: '[object Object]',
        summary: 'No deterministic answer was produced for this question.',
        sources: [],
      },
    },
  })

  assert.equal(patch.validation_state, 'failed')
  assert.equal(patch.confidence, 0)
  assert.equal(patch.structured_signal.status, 'malformed_answer')
  assert.equal(patch.structured_signal.malformed_answer_reason, 'object_string')
})

test('normalizeUpstreamAnswer can classify q15 provider no-answer placeholders when explicitly invoked', () => {
  const patch = normalizeUpstreamAnswer({
    question_id: 'q15_outreach_strategy',
    validation_state: 'no_signal',
    confidence: 0,
    answer: {
      kind: 'scorecard',
      raw_structured_output: {
        answer: null,
        summary: 'No deterministic answer was produced for this question.',
        context: 'No deterministic answer was produced for this question.',
        sources: [],
      },
    },
  })

  assert.equal(patch.validation_state, 'failed')
  assert.equal(patch.confidence, 0)
  assert.equal(patch.structured_signal.status, 'provider_no_answer')
  assert.equal(patch.structured_signal.provider_no_answer_reason, 'provider_no_answer')
})

test('normalizeUpstreamAnswer converts empty typed q3 answer shells into provider no-answer failures', () => {
  const patch = normalizeUpstreamAnswer({
    question_id: 'q3_leadership',
    validation_state: 'failed',
    confidence: 0,
    answer: {
      kind: 'list',
      value: null,
      summary: null,
      top_signals: [],
      maturity_signal: null,
      raw_structured_output: null,
      opportunity_hypotheses: [],
      commercial_interpretation: {},
    },
  })

  assert.equal(patch.validation_state, 'failed')
  assert.equal(patch.confidence, 0)
  assert.equal(patch.structured_signal.status, 'provider_no_answer')
  assert.equal(patch.structured_signal.provider_no_answer_reason, 'empty_typed_answer')
})

test('repairDossierPayload normalizes q11 provider no-answer placeholders in dossier records', () => {
  const pack = weakFifteenPack()
  pack.answers = pack.answers.map((item) => item.question_id === 'q11_decision_owner'
    ? {
        ...item,
        validation_state: 'no_signal',
        confidence: 0,
        answer: {
          kind: 'summary',
          raw_structured_output: {
            answer: '[object Object]',
            summary: 'No deterministic answer was produced for this question.',
            sources: [],
          },
        },
      }
    : item)

  const repair = repairDossierPayload(pack, 'major-league-cricket')
  const q11 = repair.repaired_dossier.answers.find((item) => item.question_id === 'q11_decision_owner')

  assert.equal(q11.validation_state, 'failed')
  assert.equal(q11.confidence, 0)
  assert.equal(q11.structured_signal.status, 'malformed_answer')
  assert.equal(q11.structured_signal.malformed_answer_reason, 'object_string')
  assert.doesNotMatch(JSON.stringify(q11), /\[object Object\]/)
})

test('normalizeUpstreamAnswer preserves sourced insufficient-signal upstream answers', () => {
  const patch = normalizeUpstreamAnswer({
    question_id: 'q3_leadership',
    validation_state: 'no_signal',
    confidence: 0,
    answer: {
      raw_structured_output: {
        answer: 'insufficient_signal',
        summary: 'Checked official team page and did not find buyer-role evidence.',
        sources: ['https://example.com/team'],
      },
    },
  })

  assert.equal(patch.validation_state, 'no_signal')
  assert.notEqual(patch.structured_signal.status, 'provider_no_answer')
})

test('normalizeUpstreamAnswer converts source-less zero-confidence upstream answers to checked no-signal', () => {
  const patch = normalizeUpstreamAnswer({
    question_id: 'q6_launch_signal',
    validation_state: 'validated',
    confidence: 0,
    answer: 'No launch evidence found.',
  })

  assert.equal(patch.validation_state, 'no_signal')
  assert.equal(patch.confidence, 0)
  assert.equal(patch.structured_signal.status, 'checked_absent')
  assert.equal(patch.structured_signal.checked_absence_rationale, 'No launch evidence found.')
  assert.ok(patch.checked_sources.length > 0)
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

test('repairDossierPayload replaces stale no-hiring q14 and q15 records with insufficient signal', () => {
  const pack = weakFifteenPack()
  pack.discovery_summary = {
    graphiti_sales_brief: { status: 'available', buyer_name: 'Norsk Toppfotball' },
    yellow_panther_fit: {
      status: 'insufficient_signal',
      fit_rationale: 'insufficient_signal',
    },
    outreach_strategy: {
      status: 'insufficient_signal',
    },
  }
  pack.answers = pack.answers.map((item) => {
    if (['q2_digital_stack', 'q6_launch_signal', 'q7_procurement_signal', 'q9_news_signal', 'q10_hiring_signal', 'q13_capability_gap'].includes(item.question_id)) {
      return answer(item.question_id)
    }
    if (item.question_id === 'q14_yp_fit') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.58,
        answer: {
          kind: 'scorecard',
          summary: 'PROJECT DELIVERY is the strongest capability match because current dossier evidence points to no hiring leads found in bounded retrieval.',
          raw_structured_output: {
            best_service: 'PROJECT_DELIVERY',
            fit_rationale: 'PROJECT DELIVERY is the strongest capability match because current dossier evidence points to no hiring leads found in bounded retrieval.',
          },
        },
      }
    }
    if (item.question_id === 'q15_outreach_strategy') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.56,
        answer: {
          kind: 'scorecard',
          summary: 'Norsk Toppfotball: No hiring leads found in bounded retrieval.',
          raw_structured_output: {
            recommended_target: 'Norsk Toppfotball',
            recommended_angle: 'No hiring leads found in bounded retrieval.',
            why_now: 'No hiring leads found in bounded retrieval.',
          },
        },
      }
    }
    return item
  })

  const repair = repairDossierPayload(pack, 'eliteserien')
  const answers = Object.fromEntries(repair.repaired_dossier.question_first.answers.map((item) => [item.question_id, item]))

  assert.equal(answers.q14_yp_fit.validation_state, 'no_signal')
  assert.equal(answers.q14_yp_fit.answer.raw_structured_output.status, 'insufficient_signal')
  assert.equal(answers.q15_outreach_strategy.validation_state, 'no_signal')
  assert.equal(answers.q15_outreach_strategy.answer.raw_structured_output.status, 'insufficient_signal')
})

test('repairDossierPayload replaces generic placeholder q15 outreach with insufficient signal', () => {
  const pack = weakFifteenPack()
  pack.discovery_summary = {
    graphiti_sales_brief: { status: 'available', buyer_name: 'Ivo Ferriani' },
    yellow_panther_fit: { status: 'insufficient_signal' },
    outreach_strategy: { status: 'insufficient_signal' },
  }
  pack.answers = pack.answers.map((item) => {
    if (['q2_digital_stack', 'q6_launch_signal', 'q7_procurement_signal', 'q9_news_signal', 'q10_hiring_signal', 'q13_capability_gap'].includes(item.question_id)) {
      return answer(item.question_id)
    }
    if (item.question_id === 'q15_outreach_strategy') {
      return {
        ...item,
        validation_state: 'provisional',
        confidence: 0.56,
        answer: {
          kind: 'scorecard',
          summary: 'Ivo Ferriani: Lead with a current commercial trigger angle tied to the active signal.',
          raw_structured_output: {
            recommended_target: 'Ivo Ferriani',
            recommended_angle: 'Lead with a current commercial trigger angle tied to the active signal.',
            why_now: 'Lead with a current commercial trigger angle tied to the active signal.',
          },
        },
      }
    }
    return item
  })

  const repair = repairDossierPayload(pack, 'ibsf')
  const answers = Object.fromEntries(repair.repaired_dossier.question_first.answers.map((item) => [item.question_id, item]))

  assert.equal(answers.q15_outreach_strategy.validation_state, 'no_signal')
  assert.equal(answers.q15_outreach_strategy.answer.raw_structured_output.status, 'insufficient_signal')
})

test('parseArgs supports dry-run filters and rerun plan output', () => {
  assert.deepEqual(parseArgs([
    '--dry-run',
    '--limit=25',
    '--entity-id=major-league-cricket',
    '--questions=q1_foundation,q3_leadership,q6_launch_signal',
    '--rerun-plan-output=/tmp/reruns.json',
  ]), {
    apply: false,
    dryRun: true,
    limit: 25,
    entityId: 'major-league-cricket',
    questions: ['q1_foundation', 'q3_leadership', 'q6_launch_signal'],
    rerunPlanOutput: '/tmp/reruns.json',
  })
})

test('targeted rerun recommendations prioritize upstream unlock questions', () => {
  const pack = weakFifteenPack()
  pack.answers = pack.answers.map((item) => {
    if (['q1_foundation', 'q2_digital_stack', 'q3_leadership', 'q6_launch_signal', 'q9_news_signal'].includes(item.question_id)) {
      return {
        ...item,
        validation_state: 'failed',
        confidence: 0,
        answer: 'Provider infrastructure failure.',
      }
    }
    if (item.question_id === 'q14_yp_fit') {
      return answer('q14_yp_fit')
    }
    return item
  })

  const recommendations = buildTargetedRerunRecommendations(pack, {
    canonicalEntityId: 'major-league-cricket',
    entityName: 'Major League Cricket',
  })

  assert.deepEqual(recommendations.map((item) => item.question_id), [
    'q1_foundation',
    'q2_digital_stack',
    'q3_leadership',
    'q6_launch_signal',
    'q9_news_signal',
  ])
  assert.equal(recommendations[0].canonical_entity_id, 'major-league-cricket')
  assert.equal(recommendations[0].reason, 'upstream_failed_blocks_commercial_synthesis')
  assert.match(recommendations[0].expected_unlock, /q11-q15/)
})
