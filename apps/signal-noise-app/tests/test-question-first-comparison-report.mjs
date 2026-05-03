import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { normalizeQuestionFirstDossier } from '../src/lib/question-first-dossier.ts'
import { buildQuestionFirstComparisonReport } from '../src/lib/question-first-comparison.ts'

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'))
}

test('buildQuestionFirstComparisonReport separates the current batch, full run, smoke run, and legacy lanes', () => {
  const currentBatch = normalizeQuestionFirstDossier(
    {
      entity_id: 'f6484cb8-8dbd-4b9a-939b-f1dff155bb64',
      entity_name: 'Doncaster Rovers',
      entity_type: 'Club',
      question_first: {
        answers: [
          {
            question_id: 'q1_foundation',
            validation_state: 'validated',
            confidence: 0.95,
            signal_type: 'FOUNDATION',
            answer: {
              kind: 'fact',
              value: 'Doncaster Rovers Football Club, founded 1879, based in Doncaster, South Yorkshire; official website: doncasterroversfc.co.uk',
              raw_structured_output: {
                answer: 'Doncaster Rovers Football Club, founded 1879, based in Doncaster, South Yorkshire; official website: doncasterroversfc.co.uk',
                sources: ['https://www.doncasterroversfc.co.uk/'],
              },
            },
          },
          {
            question_id: 'q10_hiring_signal',
            validation_state: 'provisional',
            confidence: 0.65,
            signal_type: 'HIRING_SIGNAL',
            answer: {
              kind: 'summary',
              summary: 'Doncaster Rovers\' current hiring signals point to data-driven player recruitment and academy infrastructure buildout.',
              raw_structured_output: {
                answer: 'Doncaster Rovers\' current hiring signals point to data-driven player recruitment and academy infrastructure buildout.',
                sources: ['https://www.doncasterroversfc.co.uk/news/2026/april/17/vacancy--recruitment-analyst/'],
              },
            },
          },
          {
            question_id: 'q11_decision_owner',
            validation_state: 'provisional',
            confidence: 0.78,
            signal_type: 'DECISION_OWNER',
            answer: {
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
          },
          {
            question_id: 'q8_explicit_rfp',
            validation_state: 'no_signal',
            confidence: 0,
            signal_type: 'TENDER_DOCS',
            answer: {
              kind: 'summary',
              summary: 'No published RFPs, tenders, or formal procurement documents were found for Doncaster Rovers.',
              raw_structured_output: {
                sources: ['https://www.bbc.co.uk/news/articles/ceqwwrwj04qo'],
              },
            },
          },
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

  const arsenalFullRun = readJson('../backend/data/question_first_live_runs/arsenal_fc_20260420_054715/arsenal-fc_opencode_batch_20260420_044721_question_first_run_v1.json')
  const arsenalSmoke = readJson('../backend/data/question_first_dossiers/arsenal-fc-worker-smoke_question_first_dossier.json')
  const legacyArsenal = readJson('../backend/data/dossiers/demo/arsenal-football-club_seed_question_first_dossier.json')

  const report = buildQuestionFirstComparisonReport([
    { label: 'Doncaster Rovers current batch', lane: 'current-batch', payload: currentBatch, entityId: 'f6484cb8-8dbd-4b9a-939b-f1dff155bb64' },
    { label: 'Arsenal April 20 full run', lane: 'full-run', payload: arsenalFullRun, entityId: 'arsenal-fc' },
    { label: 'Arsenal April 23 smoke run', lane: 'smoke', payload: arsenalSmoke, entityId: 'arsenal-fc-worker-smoke' },
    { label: 'Arsenal legacy demo dossier', lane: 'legacy', payload: legacyArsenal, entityId: 'arsenal-football-club' },
  ])

  assert.equal(report.items.length, 4)
  assert.equal(report.summary.by_lane['current-batch'], 1)
  assert.equal(report.summary.by_lane['full-run'], 1)
  assert.equal(report.summary.by_lane.smoke, 1)
  assert.equal(report.summary.by_lane.legacy, 1)

  const currentBatchItem = report.items.find((item) => item.label === 'Doncaster Rovers current batch')
  assert.ok(currentBatchItem)
  assert.equal(currentBatchItem.promoted_sections.length > 0, true)
  assert.equal(currentBatchItem.answered_count, 3)
  assert.equal(currentBatchItem.synthesis.has_executive_summary, true)
  assert.equal(currentBatchItem.synthesis.has_strategic_analysis, true)
  assert.equal(currentBatchItem.synthesis.has_timing_analysis, true)
  assert.equal(currentBatchItem.synthesis.has_connections_summary, true)

  const fullRunItem = report.items.find((item) => item.label === 'Arsenal April 20 full run')
  assert.ok(fullRunItem)
  assert.equal(fullRunItem.questions_total, 15)
  assert.equal(fullRunItem.answered_count, 2)
  assert.equal(fullRunItem.validation_counts.validated, 1)
  assert.equal(fullRunItem.validation_counts.provisional, 1)
  assert.equal(fullRunItem.validation_counts.no_signal, 11)
  assert.equal(fullRunItem.lane, 'full-run')
  assert.equal(fullRunItem.synthesis.has_timing_analysis, true)

  const smokeItem = report.items.find((item) => item.label === 'Arsenal April 23 smoke run')
  assert.ok(smokeItem)
  assert.equal(smokeItem.answered_count, 1)
  assert.equal(smokeItem.validation_counts.validated, 1)
  assert.equal(smokeItem.lane, 'smoke')
  assert.equal(smokeItem.synthesis.has_connections_summary, false)
})
