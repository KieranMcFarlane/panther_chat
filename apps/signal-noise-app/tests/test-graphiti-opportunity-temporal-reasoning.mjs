import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assessDossierOpportunityPromotion,
  buildGraphitiOpportunityReasoning,
} from '../src/lib/graphiti-opportunity-reasoning.mjs'

const NOW = Date.parse('2026-04-30T12:00:00.000Z')

function baseInput(overrides = {}) {
  return {
    entityName: 'Doncaster Rovers',
    detectedAt: '2026-04-30T10:00:00.000Z',
    lastSeenAt: '2026-04-30T11:00:00.000Z',
    materializedAt: '2026-04-30T11:00:00.000Z',
    deadline: null,
    confidence: 80,
    yellowPantherFit: 85,
    supportingSignals: [],
    evidence: [],
    relationships: [],
    rawPayload: {},
    now: NOW,
    ...overrides,
  }
}

test('fresh repeated hiring signals produce accelerating temporal and pattern reasoning', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    supportingSignals: [
      'Recruitment Analyst vacancy signals investment in data-led scouting',
      'Academy physiotherapist vacancy signals youth development investment',
      'Content Executive hiring suggests digital media output investment',
    ],
    evidence: [
      { title: 'Recruitment Analyst vacancy', url: 'https://example.com/jobs/recruitment-analyst', timestamp: '2026-04-30T09:00:00.000Z' },
      { title: 'Academy physiotherapist vacancy', url: 'https://example.com/jobs/academy-physio', timestamp: '2026-04-29T09:00:00.000Z' },
    ],
  }))

  assert.equal(reasoning.temporal_reasoning.status, 'accelerating')
  assert.ok(reasoning.commercial_qualification.buying_triggers.length >= 2)
  assert.match(reasoning.temporal_reasoning.reason, /multiple fresh/i)
  assert.equal(reasoning.pattern_reasoning.pattern_status, 'pattern_detected')
  assert.equal(reasoning.pattern_reasoning.signal_type, 'hiring')
  assert.ok(reasoning.findings.length >= 2)
})

test('fresh single evidence item stays emerging and does not invent a pattern', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    supportingSignals: ['Official app update suggests a new digital activation'],
    evidence: [
      { title: 'Official app update', url: 'https://example.com/app', timestamp: '2026-04-30T08:00:00.000Z' },
    ],
  }))

  assert.equal(reasoning.temporal_reasoning.status, 'emerging')
  assert.equal(reasoning.pattern_reasoning.pattern_status, 'isolated_signal')
  assert.equal(reasoning.pattern_reasoning.signal_count, 1)
})

test('old unreinforced evidence becomes stale and expired deadlines win', () => {
  const stale = buildGraphitiOpportunityReasoning(baseInput({
    detectedAt: '2026-04-20T10:00:00.000Z',
    lastSeenAt: '2026-04-20T10:00:00.000Z',
    materializedAt: '2026-04-20T10:00:00.000Z',
    supportingSignals: ['Historic sponsor announcement'],
  }))
  assert.equal(stale.temporal_reasoning.status, 'stale')

  const expired = buildGraphitiOpportunityReasoning(baseInput({
    deadline: '2026-04-29T23:00:00.000Z',
  }))
  assert.equal(expired.temporal_reasoning.status, 'expired')
})

test('missing timestamps returns unknown while preserving findings from evidence', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    detectedAt: null,
    lastSeenAt: null,
    materializedAt: null,
    supportingSignals: ['Leadership change creates a new buying route'],
    evidence: [{ title: 'Leadership interview', url: 'https://example.com/interview' }],
  }))

  assert.equal(reasoning.temporal_reasoning.status, 'unknown')
  assert.ok(reasoning.findings.some((finding) => finding.source_url === 'https://example.com/interview'))
})

test('ingested dossier episode facts drive accelerating reasoning and evidence-backed findings', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    supportingSignals: [],
    evidence: [],
    rawPayload: {
      source: 'entity_dossiers',
      source_ledger_id: 'ledger-1',
      answer_count: 7,
      evidence_count: 2,
      episode_body: {
        reference_time: '2026-04-30T11:00:00.000Z',
        question_facts: [
          {
            question_id: 'q10_hiring_signal',
            question_type: 'hiring_signal',
            status: 'provisional',
            confidence: 0.72,
            summary: 'Recruitment Analyst hiring points to investment in data-led scouting.',
            evidence_urls: ['https://example.com/jobs/recruitment-analyst'],
            observed_at: '2026-04-30T09:00:00.000Z',
          },
          {
            question_id: 'q9_news_signal',
            question_type: 'news_signal',
            status: 'answered',
            confidence: 0.7,
            summary: 'Academy staffing expansion reinforces the same recruitment investment theme.',
            evidence_urls: ['https://example.com/news/academy-staffing'],
            observed_at: '2026-04-29T09:00:00.000Z',
          },
        ],
        evidence_urls: ['https://example.com/jobs/recruitment-analyst', 'https://example.com/news/academy-staffing'],
        graphiti_sales_brief: {
          outreach_angle: 'Lead with data-led recruitment and academy pathway support.',
          outreach_route: 'Contact football operations leadership.',
        },
        yellow_panther: {
          service_fit: ['data-led scouting', 'academy pathway analysis'],
          estimated_probability: 0.82,
        },
      },
    },
  }))

  assert.equal(reasoning.temporal_reasoning.status, 'accelerating')
  assert.equal(reasoning.pattern_reasoning.pattern_status, 'pattern_detected')
  assert.equal(reasoning.pattern_reasoning.signal_type, 'hiring')
  assert.ok(reasoning.findings.some((finding) => finding.source_url === 'https://example.com/jobs/recruitment-analyst'))
  assert.match(reasoning.yp_fit_reasoning, /data-led scouting|82%|hiring/i)
})

test('ingested object-shaped answer summaries are converted to readable text', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    supportingSignals: [],
    evidence: [],
    rawPayload: {
      source: 'entity_dossiers',
      source_ledger_id: 'ledger-object-summary',
      answer_count: 2,
      evidence_count: 2,
      episode_body: {
        reference_time: '2026-04-30T11:00:00.000Z',
        question_facts: [
          {
            question_id: 'q10_hiring_signal',
            question_type: 'hiring_signal',
            status: 'provisional',
            summary: {
              kind: 'summary',
              summary: 'Recruitment Analyst hiring points to investment in data-led scouting.',
            },
            evidence_urls: ['https://example.com/jobs/recruitment-analyst'],
            observed_at: '2026-04-30T09:00:00.000Z',
          },
          {
            question_id: 'q9_news_signal',
            question_type: 'news_signal',
            status: 'answered',
            summary: {
              answer: 'Academy staffing expansion reinforces the same recruitment investment theme.',
            },
            evidence_urls: ['https://example.com/news/academy-staffing'],
            observed_at: '2026-04-29T09:00:00.000Z',
          },
        ],
      },
    },
  }))

  const serialized = JSON.stringify(reasoning)
  assert.doesNotMatch(serialized, /\[object Object\]/)
  assert.ok(reasoning.findings.some((finding) => /Recruitment Analyst/.test(finding.finding)))
})

test('conservative promotion keeps weak watch items out of the shortlist', () => {
  const weak = assessDossierOpportunityPromotion(buildGraphitiOpportunityReasoning(baseInput({
    confidence: 35,
    yellowPantherFit: 30,
    supportingSignals: ['Single possible digital mention'],
    evidence: [],
  })), {
    qualityState: 'partial',
    answerCount: 1,
    evidenceCount: 0,
  })
  assert.equal(weak.shortlist, false)
  assert.equal(weak.watch_item, true)
  assert.equal(weak.promotion_reason, 'no_buying_trigger')

  const strong = assessDossierOpportunityPromotion(buildGraphitiOpportunityReasoning(baseInput({
    confidence: 85,
    yellowPantherFit: 88,
    supportingSignals: [
      'Recruitment Analyst hiring points to investment in data-led scouting',
      'Academy staffing expansion reinforces recruitment investment',
    ],
    evidence: [
      { title: 'Recruitment Analyst vacancy', url: 'https://example.com/jobs/recruitment-analyst', timestamp: '2026-04-30T09:00:00.000Z' },
      { title: 'Academy staffing expansion', url: 'https://example.com/news/academy-staffing', timestamp: '2026-04-29T09:00:00.000Z' },
    ],
  })), {
    qualityState: 'partial',
    answerCount: 7,
    evidenceCount: 2,
  })
  assert.equal(strong.shortlist, true)
  assert.equal(strong.watch_item, false)
  assert.equal(strong.promotion_reason, 'repeated_buying_triggers')
})

test('promotion blocks defunct or inactive entities even with strong fit signals', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    confidence: 95,
    yellowPantherFit: 100,
    supportingSignals: [
      'Deccan Chargers is a defunct cricket franchise based in Hyderabad.',
      'Historic procurement and leadership references remain in the dossier.',
    ],
    evidence: [
      {
        title: 'Deccan Chargers is a defunct cricket franchise',
        url: 'https://example.com/deccan-defunct',
        timestamp: '2026-04-30T09:00:00.000Z',
      },
      {
        title: 'Historic leadership reference',
        url: 'https://example.com/deccan-history',
        timestamp: '2026-04-29T09:00:00.000Z',
      },
    ],
  }))

  const promotion = assessDossierOpportunityPromotion(reasoning, {
    qualityState: 'partial',
    answerCount: 7,
    evidenceCount: 2,
  })

  assert.equal(promotion.shortlist, false)
  assert.equal(promotion.watch_item, false)
  assert.equal(promotion.promotion_reason, 'entity_not_current')
})

test('repeated context-only facts do not become accelerating opportunities', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    confidence: 90,
    yellowPantherFit: 90,
    supportingSignals: [
      'K League 1 was founded in 1983 and is the top tier of South Korean football.',
      'K League 1 competes in a major national football market.',
      'K League 1 has a long history and established league profile.',
    ],
    evidence: [
      { title: 'K League 1 founded in 1983', url: 'https://example.com/kleague-history', timestamp: '2026-04-30T09:00:00.000Z' },
      { title: 'K League 1 top tier profile', url: 'https://example.com/kleague-profile', timestamp: '2026-04-29T09:00:00.000Z' },
    ],
  }))
  const promotion = assessDossierOpportunityPromotion(reasoning, {
    qualityState: 'partial',
    answerCount: 7,
    evidenceCount: 2,
  })

  assert.notEqual(reasoning.temporal_reasoning.status, 'accelerating')
  assert.equal(reasoning.commercial_qualification.status, 'context_only')
  assert.equal(promotion.shortlist, false)
  assert.equal(promotion.watch_item, false)
  assert.equal(promotion.promotion_reason, 'context_only')
})

test('single fresh buying trigger can become active with evidence and fit', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    confidence: 82,
    yellowPantherFit: 84,
    supportingSignals: [
      'Official app launch creates a current digital platform opportunity.',
    ],
    evidence: [
      { title: 'Official app launch', url: 'https://example.com/app-launch', timestamp: '2026-04-30T09:00:00.000Z' },
    ],
  }))
  const promotion = assessDossierOpportunityPromotion(reasoning, {
    qualityState: 'partial',
    answerCount: 5,
    evidenceCount: 1,
  })

  assert.equal(reasoning.temporal_reasoning.status, 'active')
  assert.equal(reasoning.commercial_qualification.status, 'active')
  assert.ok(reasoning.commercial_qualification.buying_triggers.length >= 1)
  assert.equal(promotion.shortlist, true)
})

test('low-fit buying triggers remain watch items and stay out of the default shortlist', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    confidence: 20,
    yellowPantherFit: 10,
    supportingSignals: [
      'Sponsor partner announcement suggests a possible commercial route.',
    ],
    evidence: [
      { title: 'Sponsor partner announcement', url: 'https://example.com/sponsor', timestamp: '2026-04-30T09:00:00.000Z' },
    ],
  }))
  const promotion = assessDossierOpportunityPromotion(reasoning, {
    qualityState: 'partial',
    answerCount: 3,
    evidenceCount: 1,
  })

  assert.equal(reasoning.commercial_qualification.status, 'watch')
  assert.equal(promotion.shortlist, false)
  assert.equal(promotion.watch_item, true)
  assert.equal(promotion.promotion_reason, 'watch_item_only')
})

test('repeated low-fit signals stay out of the client shortlist', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    confidence: 90,
    yellowPantherFit: 10,
    supportingSignals: [
      'Sponsor partner announcement suggests a possible commercial route.',
      'Commercial partnership mention reinforces the same sponsorship theme.',
    ],
    evidence: [
      { title: 'Sponsor partner announcement', url: 'https://example.com/sponsor', timestamp: '2026-04-30T09:00:00.000Z' },
      { title: 'Commercial partnership mention', url: 'https://example.com/partner', timestamp: '2026-04-30T10:00:00.000Z' },
    ],
  }))
  const promotion = assessDossierOpportunityPromotion(reasoning, {
    qualityState: 'partial',
    answerCount: 8,
    evidenceCount: 2,
  })

  assert.equal(reasoning.commercial_qualification.status, 'accelerating')
  assert.equal(promotion.shortlist, false)
  assert.equal(promotion.watch_item, true)
})

test('duplicated launch text from one question does not create accelerating reasoning', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    confidence: 90,
    yellowPantherFit: 90,
    supportingSignals: [
      'The league launched an OTT platform for domestic coverage.',
      'launch_signal: validated: The league launched an OTT platform for domestic coverage.',
    ],
    evidence: [
      {
        title: 'The league launched an OTT platform for domestic coverage.',
        url: 'https://example.com/ott-launch',
        timestamp: '2026-04-30T09:00:00.000Z',
        source: 'q6_launch_signal',
      },
    ],
  }))

  assert.notEqual(reasoning.temporal_reasoning.status, 'accelerating')
  assert.equal(reasoning.commercial_qualification.status, 'active')
  assert.equal(reasoning.commercial_qualification.trigger_evidence.length, 1)
})

test('old OTT launch evidence becomes stale instead of accelerating from materialization date', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    detectedAt: '2026-04-30T10:00:00.000Z',
    lastSeenAt: '2026-04-30T11:00:00.000Z',
    materializedAt: '2026-04-30T11:00:00.000Z',
    confidence: 90,
    yellowPantherFit: 90,
    supportingSignals: [
      'K League TV launched in February 2021 as an OTT streaming platform.',
      'The mobile app launched in 2021 for league coverage.',
    ],
    evidence: [
      { title: 'K League TV launched in February 2021', url: 'https://example.com/2021-ott', timestamp: '2021-02-01T09:00:00.000Z', source: 'q6_launch_signal' },
      { title: 'Mobile app launched in 2021', url: 'https://example.com/2021-app', timestamp: '2021-03-01T09:00:00.000Z', source: 'q6_launch_signal' },
    ],
  }))
  const promotion = assessDossierOpportunityPromotion(reasoning, {
    qualityState: 'complete',
    answerCount: 15,
    evidenceCount: 2,
  })

  assert.equal(reasoning.temporal_reasoning.status, 'stale')
  assert.equal(promotion.shortlist, false)
})

test('undated buying trigger is watch-only unless it contains a current explicit window', () => {
  const undated = buildGraphitiOpportunityReasoning(baseInput({
    detectedAt: '2026-04-30T10:00:00.000Z',
    lastSeenAt: '2026-04-30T11:00:00.000Z',
    materializedAt: '2026-04-30T11:00:00.000Z',
    confidence: 90,
    yellowPantherFit: 90,
    supportingSignals: ['Official app launch creates a current digital platform opportunity.'],
    evidence: [
      { title: 'Official app launch', url: 'https://example.com/app-launch', source: 'q6_launch_signal' },
    ],
  }))
  const currentText = buildGraphitiOpportunityReasoning(baseInput({
    detectedAt: '2026-04-20T10:00:00.000Z',
    lastSeenAt: '2026-04-20T11:00:00.000Z',
    materializedAt: '2026-04-20T11:00:00.000Z',
    confidence: 90,
    yellowPantherFit: 90,
    supportingSignals: ['Official 2026 app launch creates a current digital platform opportunity.'],
    evidence: [
      { title: 'Official 2026 app launch', url: 'https://example.com/app-launch', source: 'q6_launch_signal' },
    ],
  }))

  assert.equal(undated.commercial_qualification.status, 'watch')
  assert.equal(undated.temporal_reasoning.status, 'emerging')
  assert.equal(currentText.commercial_qualification.status, 'active')
  assert.equal(currentText.temporal_reasoning.status, 'active')
  assert.notEqual(currentText.temporal_reasoning.recency_label, 'stale')
})

test('Doncaster-style hiring signal produces client-ready YP fit breakdown', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    entityName: 'Doncaster Rovers',
    confidence: 82,
    yellowPantherFit: 84,
    supportingSignals: [
      'Recruitment Analyst vacancy signals investment in data-led scouting.',
      'Shaun Lockwood, Chief Commercial Officer, Club Doncaster.',
    ],
    evidence: [
      { title: 'Recruitment Analyst vacancy', url: 'https://example.com/jobs/recruitment-analyst', timestamp: '2026-04-17T09:00:00.000Z', source: 'q10_hiring_signal' },
      { title: 'Shaun Lockwood, Chief Commercial Officer', url: 'https://example.com/leadership', timestamp: '2026-04-24T09:00:00.000Z', source: 'q3_leadership' },
    ],
    rawPayload: {
      graphiti_sales_brief: {
        outreach_angle: 'Lead with data-led recruitment and academy pathway support.',
        outreach_route: 'Contact Club Doncaster commercial leadership.',
      },
      yellow_panther_opportunity: {
        service_fit: ['data-led scouting', 'academy pathway analysis'],
      },
    },
  }))

  assert.match(reasoning.yp_fit_reasoning, /data-led scouting/i)
  assert.match(reasoning.yp_fit_reasoning, /Club Doncaster commercial leadership/i)
  assert.match(reasoning.yp_fit_reasoning, /Yellow Panther succeeds/i)
  assert.match(reasoning.yp_fit_reasoning, /strategy/i)
  assert.match(reasoning.yp_fit_reasoning, /Verify/i)
  assert.match(reasoning.recommended_action, /Use the hiring signal/i)
  assert.match(reasoning.recommended_action, /data-led recruitment/i)
  assert.doesNotMatch(reasoning.recommended_action, /Open the dossier, confirm the buyer hypothesis/i)
  assert.equal(reasoning.commercial_qualification.yp_fit_breakdown.capability_match, 'data-led scouting, academy pathway analysis')
  assert.equal(reasoning.commercial_qualification.yp_fit_breakdown.buyer_route, 'Contact Club Doncaster commercial leadership.')
})

test('hiring signals infer a concrete Yellow Panther capability when no service fit is stored', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    entityName: 'Doncaster Rovers',
    confidence: 80,
    yellowPantherFit: 80,
    supportingSignals: [
      'Current Recruitment Analyst vacancy in football operations points to data-informed player scouting.',
      'Academy education and academy physiotherapy vacancies suggest youth pathway infrastructure investment.',
      'Shaun Lockwood, Chief Commercial Officer, Club Doncaster.',
    ],
    evidence: [
      { title: 'Recruitment Analyst vacancy posted 17 Apr 2026', url: 'https://example.com/2026/april/17/recruitment-analyst', source: 'q10_hiring_signal' },
    ],
    rawPayload: {
      graphiti_sales_brief: {
        outreach_route: 'Shaun Lockwood',
        outreach_angle: 'Position Yellow Panther around recruitment intelligence and academy pathway decisions.',
      },
    },
  }))

  assert.equal(reasoning.commercial_qualification.yp_fit_breakdown.capability_match, 'data-led recruitment intelligence and academy pathway prioritisation')
  assert.match(reasoning.yp_fit_reasoning, /data-led recruitment intelligence/i)
  assert.match(reasoning.recommended_action, /recruitment intelligence and academy pathway decisions/i)
})

test('person-title-only outreach angles fall back to strategic Yellow Panther positioning', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    entityName: 'Doncaster Rovers',
    confidence: 80,
    yellowPantherFit: 80,
    supportingSignals: [
      'Recruitment Analyst vacancy signals investment in data-led scouting and academy pathway infrastructure.',
    ],
    evidence: [
      { title: 'Recruitment Analyst vacancy posted 17 Apr 2026', url: 'https://example.com/2026/april/17/recruitment-analyst', source: 'q10_hiring_signal' },
    ],
    rawPayload: {
      graphiti_sales_brief: {
        outreach_route: 'Shaun Lockwood',
        outreach_angle: 'Shaun Lockwood, Chief Commercial Officer, Club Doncaster',
      },
    },
  }))

  assert.match(reasoning.recommended_action, /Position Yellow Panther around data-led recruitment intelligence/i)
  assert.doesNotMatch(reasoning.recommended_action, /Use the hiring signal as the outreach wedge\. Shaun Lockwood, Chief Commercial Officer/)
})

test('generic cold outreach route does not override a named buyer route', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    entityName: 'Doncaster Rovers',
    confidence: 80,
    yellowPantherFit: 80,
    supportingSignals: [
      'Recruitment Analyst vacancy posted 17 Apr 2026 signals investment in data-led scouting.',
      'Shaun Lockwood, Chief Commercial Officer, Club Doncaster.',
    ],
    evidence: [
      { title: 'Recruitment Analyst vacancy posted 17 Apr 2026', url: 'https://example.com/2026/april/17/recruitment-analyst', source: 'q10_hiring_signal' },
    ],
    rawPayload: {
      graphiti_sales_brief: {
        outreach_route: 'cold',
        outreach_target: 'Shaun Lockwood',
        buyer_name: 'Shaun Lockwood',
        outreach_angle: 'Recruitment Analyst vacancy signals investment in data-led scouting.',
      },
      yellow_panther_opportunity: {
        entry_point: 'Shaun Lockwood',
      },
    },
  }))

  assert.equal(reasoning.commercial_qualification.yp_fit_breakdown.buyer_route, 'Shaun Lockwood')
  assert.match(reasoning.recommended_action, /Route the first hypothesis through Shaun Lockwood/)
  assert.doesNotMatch(reasoning.recommended_action, /through cold/)
})

test('visible findings exclude placeholders and question ids as source urls', () => {
  const reasoning = buildGraphitiOpportunityReasoning(baseInput({
    supportingSignals: [
      '{"kind":"summary","value":null}',
      'procurement_signal',
      'No deterministic answer was produced for this question.',
      'Recruitment Analyst vacancy signals investment in data-led scouting.',
    ],
    evidence: [
      { title: 'q7_procurement_signal', url: 'q7_procurement_signal', source: 'q7_procurement_signal' },
      { title: 'no_signal', url: null, source: 'q8_explicit_rfp' },
      { title: 'Recruitment Analyst vacancy', url: 'https://example.com/jobs/recruitment-analyst', timestamp: '2026-04-30T09:00:00.000Z', source: 'q10_hiring_signal' },
    ],
  }))

  const serializedFindings = JSON.stringify(reasoning.findings)
  assert.doesNotMatch(serializedFindings, /q7_procurement_signal/)
  assert.doesNotMatch(serializedFindings, /no_signal/)
  assert.doesNotMatch(serializedFindings, /\\{\"kind\"/)
  assert.ok(reasoning.findings.every((finding) => !String(finding.source_url || '').startsWith('q')))
})
