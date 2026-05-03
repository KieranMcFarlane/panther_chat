import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeQuestionFirstDossier } from '../src/lib/question-first-dossier.ts'

function makeAnswer(questionId, questionType, signalType, answer, extra = {}) {
  return {
    question_id: questionId,
    question_type: questionType,
    signal_type: signalType,
    confidence: extra.confidence ?? 0,
    validation_state: extra.validation_state ?? 'provisional',
    answer,
    ...extra,
  }
}

test('normalizeQuestionFirstDossier promotes question-first answers into the dossier summary tabs', () => {
  const normalized = normalizeQuestionFirstDossier(
    {
      entity_id: 'f6484cb8-8dbd-4b9a-939b-f1dff155bb64',
      entity_name: 'Doncaster Rovers',
      entity_type: 'Club',
      question_first: {
        answers: [
          makeAnswer(
            'q1_foundation',
            'foundation',
            'FOUNDATION',
            {
              kind: 'fact',
              value: 'Doncaster Rovers Football Club, founded 1879, based in Doncaster, South Yorkshire; official website: doncasterroversfc.co.uk',
              raw_structured_output: {
                answer: 'Doncaster Rovers Football Club, founded 1879, based in Doncaster, South Yorkshire; official website: doncasterroversfc.co.uk',
                sources: ['https://www.doncasterroversfc.co.uk/'],
              },
            },
            { confidence: 0.95, validation_state: 'validated' },
          ),
          makeAnswer(
            'q8_explicit_rfp',
            'tender_docs',
            'TENDER_DOCS',
            {
              kind: 'summary',
              summary: 'No published RFPs, tenders, or formal procurement documents were found for Doncaster Rovers FC.',
              raw_structured_output: {
                context: 'No published RFPs, tenders, or formal procurement documents were found for Doncaster Rovers FC.',
                sources: ['https://www.bbc.co.uk/news/articles/ceqwwrwj04qo'],
              },
            },
            { confidence: 0, validation_state: 'no_signal' },
          ),
          makeAnswer(
            'q10_hiring_signal',
            'hiring_signal',
            'HIRING_SIGNAL',
            {
              kind: 'summary',
              summary: 'Doncaster Rovers\' current hiring signals point to data-driven player recruitment and academy infrastructure buildout.',
              raw_structured_output: {
                answer: 'Doncaster Rovers\' current hiring signals point to data-driven player recruitment and academy infrastructure buildout.',
                context: 'The Recruitment Analyst role is the strongest and most recent signal.',
                sources: ['https://www.doncasterroversfc.co.uk/news/2026/april/17/vacancy--recruitment-analyst/'],
              },
            },
            { confidence: 0.65, validation_state: 'provisional' },
          ),
          makeAnswer(
            'q11_decision_owner',
            'decision_owner',
            'DECISION_OWNER',
            {
              kind: 'list',
              summary: 'Shaun Lockwood, Chief Commercial Officer, Club Doncaster',
              structured_signal: {
                decision_owner_name: 'Shaun Lockwood',
                decision_owner_title: 'Chief Commercial Officer',
              },
              raw_structured_output: {
                answer: 'Shaun Lockwood, Chief Commercial Officer, Club Doncaster',
                sources: ['https://www.doncasterroversfc.co.uk/news/2025/october/07/fan-engagement-expert-praises-work-of-shadow-board/'],
              },
            },
            { confidence: 0.78, validation_state: 'provisional' },
          ),
        ],
      },
    },
    'f6484cb8-8dbd-4b9a-939b-f1dff155bb64',
    {
      properties: {
        name: 'Doncaster Rovers',
        type: 'Club',
        stadium: 'Eco-Power Stadium',
        website: 'https://www.doncasterroversfc.co.uk',
      },
    },
  )

  const summary = normalized.question_first.discovery_summary

  assert.ok(summary)
  assert.equal(summary.promoted_count >= 3, true)
  assert.equal(summary.supporting_evidence_count >= 3, true)
  assert.ok(summary.opportunity_signals.some((entry) => entry.question_id === 'q10_hiring_signal'))
  assert.ok(summary.decision_owners.some((entry) => entry.question_id === 'q11_decision_owner'))
  assert.ok(summary.timing_procurement_markers.some((entry) => entry.question_id === 'q8_explicit_rfp'))
  assert.ok(normalized.question_first.dossier_promotions.length >= 3)
  assert.ok(normalized.tabs.some((tab) => tab.value === 'procurement-ecosystem' && tab.hasData))
  assert.ok(normalized.tabs.some((tab) => tab.value === 'decision-owners-pois' && tab.hasData))
  assert.match(summary.recommended_approach || '', /Recruitment Analyst|Shaun Lockwood|Doncaster Rovers/)
  assert.equal(summary.graphiti_sales_brief.buyer_name, 'Shaun Lockwood')
})

test('normalizeQuestionFirstDossier synthesizes dossier-facing summary fields for the club dossier page', () => {
  const normalized = normalizeQuestionFirstDossier(
    {
      entity_id: 'f6484cb8-8dbd-4b9a-939b-f1dff155bb64',
      entity_name: 'Doncaster Rovers',
      entity_type: 'Club',
      question_first: {
        answers: [
          makeAnswer(
            'q1_foundation',
            'foundation',
            'FOUNDATION',
            {
              kind: 'fact',
              value: 'Doncaster Rovers Football Club, founded 1879, based in Doncaster, South Yorkshire; official website: doncasterroversfc.co.uk',
              raw_structured_output: {
                answer: 'Doncaster Rovers Football Club, founded 1879, based in Doncaster, South Yorkshire; official website: doncasterroversfc.co.uk',
                sources: ['https://www.doncasterroversfc.co.uk/'],
              },
            },
            { confidence: 0.95, validation_state: 'validated' },
          ),
          makeAnswer(
            'q10_hiring_signal',
            'hiring_signal',
            'HIRING_SIGNAL',
            {
              kind: 'summary',
              summary: 'Doncaster Rovers\' current hiring signals point to data-driven player recruitment and academy infrastructure buildout.',
              raw_structured_output: {
                answer: 'Doncaster Rovers\' current hiring signals point to data-driven player recruitment and academy infrastructure buildout.',
                context: 'The Recruitment Analyst role is the strongest and most recent signal.',
                sources: ['https://www.doncasterroversfc.co.uk/news/2026/april/17/vacancy--recruitment-analyst/'],
              },
            },
            { confidence: 0.65, validation_state: 'provisional' },
          ),
          makeAnswer(
            'q11_decision_owner',
            'decision_owner',
            'DECISION_OWNER',
            {
              kind: 'list',
              summary: 'Shaun Lockwood, Chief Commercial Officer, Club Doncaster',
              structured_signal: {
                decision_owner_name: 'Shaun Lockwood',
                decision_owner_title: 'Chief Commercial Officer',
              },
              raw_structured_output: {
                answer: 'Shaun Lockwood, Chief Commercial Officer, Club Doncaster',
                sources: ['https://www.doncasterroversfc.co.uk/news/2025/october/07/fan-engagement-expert-praises-work-of-shadow-board/'],
              },
            },
            { confidence: 0.78, validation_state: 'provisional' },
          ),
          makeAnswer(
            'q8_explicit_rfp',
            'tender_docs',
            'TENDER_DOCS',
            {
              kind: 'summary',
              summary: 'No published RFPs, tenders, or formal procurement documents were found for Doncaster Rovers.',
              raw_structured_output: {
                context: 'No published RFPs, tenders, or formal procurement documents were found for Doncaster Rovers.',
                sources: ['https://www.bbc.co.uk/news/articles/ceqwwrwj04qo'],
              },
            },
            { confidence: 0, validation_state: 'no_signal' },
          ),
        ],
      },
    },
    'f6484cb8-8dbd-4b9a-939b-f1dff155bb64',
    {
      properties: {
        name: 'Doncaster Rovers',
        type: 'Club',
        stadium: 'Eco-Power Stadium',
        website: 'https://www.doncasterroversfc.co.uk',
      },
    },
  )

  assert.equal(normalized.core_info.stadium, 'Eco-Power Stadium')
  assert.equal(normalized.core_info.website, 'https://www.doncasterroversfc.co.uk')
  assert.ok(normalized.executive_summary)
  assert.ok(normalized.procurement_signals)
  assert.ok(normalized.digital_transformation)
  assert.ok(normalized.strategic_analysis)
  assert.match(String(normalized.executive_summary.headline || ''), /Doncaster Rovers/i)
  assert.match(String(normalized.strategic_analysis.recommended_approach || ''), /Recruitment Analyst|Shaun Lockwood|Doncaster Rovers/)
})

test('normalizeQuestionFirstDossier preserves timing, connection, and YP-fit synthesis from partial question-first evidence', () => {
  const normalized = normalizeQuestionFirstDossier(
    {
      entity_id: 'bridge-test',
      entity_name: 'Bridge Test FC',
      entity_type: 'Club',
      question_first: {
        answers: [
          makeAnswer(
            'q8_explicit_rfp',
            'tender_docs',
            'TENDER_DOCS',
            {
              kind: 'summary',
              summary: 'No published RFPs were found; procurement appears to be private and relationship-led.',
              raw_structured_output: {
                context: 'No published RFPs were found; procurement appears to be private and relationship-led.',
                sources: ['https://example.com/rfp'],
              },
            },
            { confidence: 0, validation_state: 'no_signal' },
          ),
          makeAnswer(
            'q11_decision_owner',
            'decision_owner',
            'DECISION_OWNER',
            {
              kind: 'list',
              summary: 'Shaun Lockwood, Chief Commercial Officer, Club Doncaster',
              structured_signal: {
                decision_owner_name: 'Shaun Lockwood',
                decision_owner_title: 'Chief Commercial Officer',
              },
              raw_structured_output: {
                answer: 'Shaun Lockwood, Chief Commercial Officer, Club Doncaster',
                sources: ['https://example.com/owner'],
              },
            },
            { confidence: 0.78, validation_state: 'provisional' },
          ),
          makeAnswer(
            'q12_connections',
            'connections',
            'CONNECTIONS',
            {
              kind: 'summary',
              summary: 'Stuart Cope has a credible second-degree route into the commercial leadership team.',
              raw_structured_output: {
                candidate_paths: [
                  {
                    best_yp_owner: 'Stuart Cope',
                    recommended_yp_owner: 'Stuart Cope',
                    path_type: 'second_degree_intro',
                  },
                ],
                sources: ['https://example.com/connections'],
              },
            },
            { confidence: 0.55, validation_state: 'provisional' },
          ),
          makeAnswer(
            'q14_yp_fit',
            'yp_fit',
            'YP_FIT',
            {
              kind: 'summary',
              summary: 'Yellow Panther is a credible fit for fan engagement and digital transformation support.',
              raw_structured_output: {
                best_service: 'FAN_ENGAGEMENT',
                recommended_service: 'DIGITAL_TRANSFORMATION',
                answer: 'Yellow Panther is a credible fit for fan engagement and digital transformation support.',
                sources: ['https://example.com/fit'],
              },
            },
            { confidence: 0.71, validation_state: 'provisional' },
          ),
          makeAnswer(
            'q15_outreach_strategy',
            'outreach_strategy',
            'OUTREACH_STRATEGY',
            {
              kind: 'summary',
              summary: 'Lead with a commercial-growth angle and a fan engagement case study.',
              raw_structured_output: {
                recommended_target: 'Shaun Lockwood',
                recommended_route: 'second_degree_intro',
                recommended_angle: 'Lead with a commercial-growth angle and a fan engagement case study.',
                sources: ['https://example.com/outreach'],
              },
            },
            { confidence: 0.68, validation_state: 'provisional' },
          ),
        ],
      },
    },
    'bridge-test',
    {
      properties: {
        name: 'Bridge Test FC',
        type: 'Club',
        website: 'https://example.com',
      },
    },
  )

  assert.ok(normalized.timing_analysis)
  assert.match(String(normalized.timing_analysis.summary || ''), /RFP|private|relationship-led/i)
  assert.ok(normalized.connections_summary)
  assert.equal(normalized.connections_summary.recommended_owner, 'Stuart Cope')
  assert.equal(normalized.connections_summary.path_type, 'second_degree_intro')
  assert.equal(normalized.connections_summary.decision_owner, 'Shaun Lockwood')
  assert.deepEqual(normalized.connections_summary.service_fit, ['FAN_ENGAGEMENT'])
  assert.equal(normalized.strategic_analysis?.buyer_brief?.best_path_owner, 'Stuart Cope')
  assert.deepEqual(normalized.strategic_analysis?.commercial_positioning?.service_fit, ['FAN_ENGAGEMENT'])
  assert.match(String(normalized.recommended_approach || ''), /commercial-growth angle|fan engagement/i)
})

test('normalizeQuestionFirstDossier preserves useful negatives and failed states for richer synthesis', () => {
  const normalized = normalizeQuestionFirstDossier(
    {
      entity_id: 'league-test',
      entity_name: 'League Test',
      entity_type: 'League',
      questions: [
        {
          question_id: 'q8_explicit_rfp',
          question_text: 'Are there public tenders for League Test?',
          depends_on: [],
        },
        {
          question_id: 'q13_capability_gap',
          question_text: 'What capability gaps matter for League Test?',
          depends_on: ['q8_explicit_rfp'],
        },
        {
          question_id: 'q11_decision_owner',
          question_text: 'Who owns buying decisions?',
          depends_on: [],
        },
      ],
      question_first: {
        answers: [
          makeAnswer(
            'q8_explicit_rfp',
            'tender_docs',
            'TENDER_DOCS',
            {
              kind: 'summary',
              summary: 'No public tenders were found; procurement appears partner-led and private.',
              raw_structured_output: {
                context: 'No public tenders were found; procurement appears partner-led and private.',
                procurement_model: 'partner_led',
                sources: ['https://example.com/league/rfp'],
              },
            },
            { confidence: 0, validation_state: 'no_signal' },
          ),
          makeAnswer(
            'q13_capability_gap',
            'capability_gap',
            'CAPABILITY_GAP',
            {
              kind: 'summary',
              summary: '',
              raw_structured_output: {
                context: 'Upstream signals are not available yet for a safe capability-gap inference.',
                sources: ['https://example.com/league/capability'],
              },
            },
            { confidence: 0, validation_state: 'no_signal' },
          ),
          makeAnswer(
            'q11_decision_owner',
            'decision_owner',
            'DECISION_OWNER',
            {
              kind: 'summary',
              summary: 'Tool call failed after retrieval evidence was gathered.',
              raw_structured_output: {
                context: 'Tool call failed after retrieval evidence was gathered.',
                sources: ['https://example.com/league/owner'],
              },
            },
            { confidence: 0, validation_state: 'failed' },
          ),
        ],
      },
    },
    'league-test',
    {
      properties: {
        name: 'League Test',
        type: 'League',
        website: 'https://example.com/league',
      },
    },
  )

  const q8 = normalized.questions.find((question) => question.question_id === 'q8_explicit_rfp')
  const q13 = normalized.questions.find((question) => question.question_id === 'q13_capability_gap')
  const q11 = normalized.questions.find((question) => question.question_id === 'q11_decision_owner')

  assert.equal(q8.terminal_state, 'no_signal')
  assert.match(String(q8.terminal_summary || ''), /private|partner-led/i)
  assert.equal(q13.terminal_state, 'blocked')
  assert.match(String(q13.terminal_summary || ''), /upstream/i)
  assert.equal(q11.terminal_state, 'failed')
  assert.match(String(q11.terminal_summary || ''), /tool call failed/i)
  assert.match(String(normalized.procurement_signals.summary || ''), /private|partner-led/i)
  assert.match(String(normalized.timing_analysis.summary || ''), /private|partner-led/i)
  assert.match(String(normalized.executive_summary.summary || ''), /private|partner-led|tool call failed/i)
})

test('normalizeQuestionFirstDossier synthesizes YP fit and outreach from adjacent validated evidence', () => {
  const normalized = normalizeQuestionFirstDossier(
    {
      entity_id: 'gauteng',
      entity_name: 'Gauteng',
      entity_type: 'Province',
      publish_status: 'published',
      question_first: {
        answers: [
          makeAnswer(
            'q6_launch_signal',
            'launch_signal',
            'LAUNCH_SIGNAL',
            {
              kind: 'summary',
              summary: 'Gauteng has launched a new public platform with digital service and commercial ecosystem implications.',
              raw_structured_output: {
                answer: 'Gauteng has launched a new public platform with digital service and commercial ecosystem implications.',
                context: 'Fresh platform launch indicates active digital transformation and partner coordination.',
                sources: ['https://example.com/platform-launch'],
              },
            },
            { confidence: 0.91, validation_state: 'validated' },
          ),
          makeAnswer(
            'q11_decision_owner',
            'decision_owner',
            'DECISION_OWNER',
            {
              kind: 'list',
              summary: 'Digital Transformation Lead',
              structured_signal: {
                decision_owner_name: 'Digital Transformation Lead',
                decision_owner_title: 'Programme Director',
              },
              raw_structured_output: {
                answer: 'Digital Transformation Lead',
                sources: ['https://example.com/owner'],
              },
            },
            { confidence: 0.72, validation_state: 'provisional' },
          ),
          makeAnswer(
            'q14_yp_fit',
            'yp_fit',
            'YP_FIT',
            {
              kind: 'summary',
              summary: '',
              raw_structured_output: {
                summary: '',
                notes: "No web evidence found connecting 'Yellow Panther' to Gauteng.",
              },
            },
            { confidence: 0, validation_state: 'no_signal' },
          ),
          makeAnswer(
            'q15_outreach_strategy',
            'outreach_strategy',
            'OUTREACH_STRATEGY',
            {
              kind: 'summary',
              summary: '',
              raw_structured_output: {
                summary: '',
              },
            },
            { confidence: 0, validation_state: 'no_signal' },
          ),
        ],
      },
    },
    'gauteng',
    {
      properties: {
        name: 'Gauteng',
        type: 'Province',
      },
    },
  )

  const summary = normalized.question_first.discovery_summary
  assert.equal(summary.graphiti_sales_brief.status, 'available')
  assert.match(String(summary.graphiti_sales_brief.yp_fit_service || ''), /digital|platform|transformation/i)
  assert.match(String(summary.graphiti_sales_brief.outreach_angle || ''), /platform|digital|launch/i)
  assert.doesNotMatch(JSON.stringify(summary), /No web evidence found connecting 'Yellow Panther'|Panther results/i)
  assert.match(String(summary.recommended_approach || ''), /digital|platform|launch|Transformation/i)
})

test('normalizeQuestionFirstDossier demotes mechanically complete but commercially empty dossiers from published to published_partial', () => {
  const normalized = normalizeQuestionFirstDossier(
    {
      entity_id: 'gauteng-empty',
      entity_name: 'Gauteng Empty',
      entity_type: 'Province',
      publish_status: 'published',
      question_first: {
        quality_state: 'complete',
        answers: Array.from({ length: 15 }, (_, index) =>
          makeAnswer(
            `q${index + 1}`,
            'generic',
            'GENERIC',
            {
              kind: 'summary',
              summary: '',
              raw_structured_output: {
                summary: '',
                sources: [],
              },
            },
            { confidence: 0, validation_state: 'no_signal' },
          ),
        ),
      },
    },
    'gauteng-empty',
    {
      properties: {
        name: 'Gauteng Empty',
        type: 'Province',
      },
    },
  )

  assert.equal(normalized.publish_status, 'published_partial')
  assert.equal(normalized.question_first.discovery_summary.graphiti_sales_brief.status, 'insufficient_signal')
})
