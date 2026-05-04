#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { runOpenCodePresetBatch } from './opencode_agentic_batch.mjs'

function question(questionId, overrides = {}) {
  const questionType = questionId.replace(/^q\d+_/, '')
  return {
    question_id: questionId,
    question_family: questionType,
    question_type: questionType,
    question_text: questionId,
    question: questionId,
    query: `"Test Club" ${questionType}`,
    source_priority: ['official_site'],
    search_patterns: [],
    execution_class: 'atomic_retrieval',
    rollout_phase: 'phase_3_decision',
    conditional_on: [],
    depends_on: [],
    structured_output_schema: `${questionType}_v1`,
    graph_write_targets: [],
    evidence_focus: questionType,
    promotion_target: questionType,
    answer_kind: 'summary',
    fallback_to_retrieval: true,
    hop_budget: 1,
    evidence_extension_budget: 0,
    entity_name: 'Test Club',
    entity_id: 'test-club',
    entity_type: 'CLUB',
    preset: 'test-club',
    ...overrides,
  }
}

async function fakeQuestionRunner(executionQuestion) {
  if (executionQuestion.question_id === 'q6_launch_signal') {
    return {
      structuredOutput: {
        question: executionQuestion.question_text,
        answer: 'Test Club announced a new digital ticketing and fan engagement platform for the 2026 season.',
        context: 'Official launch announcement creates a platform delivery and fan engagement trigger.',
        sources: ['https://example.com/test-club-digital-platform'],
        confidence: 0.88,
        signal_type: 'LAUNCH_SIGNAL',
      },
      promptTrace: { fake: true },
      messageTrace: [],
      cliResult: { code: 0, stdout: '{}', stderr: '' },
    }
  }
  if (executionQuestion.question_id === 'q3_leadership') {
    return {
      structuredOutput: {
        question: executionQuestion.question_text,
        answer: 'Jane Buyer leads commercial partnerships at Test Club.',
        candidates: [
          {
            name: 'Jane Buyer',
            title: 'Chief Commercial Officer',
            function: 'commercial',
            evidence_url: 'https://example.com/test-club-leadership',
          },
        ],
        context: 'Leadership page lists Jane Buyer as the commercial owner.',
        sources: ['https://example.com/test-club-leadership'],
        confidence: 0.86,
        signal_type: 'LEADERSHIP',
      },
      promptTrace: { fake: true },
      messageTrace: [],
      cliResult: { code: 0, stdout: '{}', stderr: '' },
    }
  }
  if (executionQuestion.question_id === 'q11_decision_owner') {
    return {
      structuredOutput: {
        question: executionQuestion.question_text,
        answer: 'Jane Buyer is the likely commercial buyer.',
        primary_owner: { name: 'Jane Buyer', title: 'Chief Commercial Officer' },
        structured_signal: { decision_owner_name: 'Jane Buyer', decision_owner_title: 'Chief Commercial Officer' },
        context: 'Commercial leadership is the best initial buyer hypothesis.',
        sources: ['https://example.com/test-club-leadership'],
        confidence: 0.74,
        signal_type: 'DECISION_OWNER',
      },
      promptTrace: { fake: true },
      messageTrace: [],
      cliResult: { code: 0, stdout: '{}', stderr: '' },
    }
  }
  return {
    structuredOutput: {
      question: executionQuestion.question_text,
      answer: '',
      context: '',
      sources: [],
      confidence: 0,
    },
    promptTrace: { fake: true },
    messageTrace: [],
    cliResult: { code: 0, stdout: '{}', stderr: '' },
  }
}

test('zero-hop q12-q15 synthesize from prior commercial and buyer evidence without retrieval', async () => {
  process.env.ZAI_API_KEY = process.env.ZAI_API_KEY || 'test-key'
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-derived-synthesis-'))
  const questions = [
    question('q6_launch_signal', { question_type: 'launch_signal', structured_output_schema: 'launch_signal_v1' }),
    question('q11_decision_owner', {
      question_type: 'decision_owner',
      structured_output_schema: 'decision_owner_v1',
      depends_on: ['q6_launch_signal'],
    }),
    question('q12_connections', {
      question_type: 'connections',
      query: '',
      source_priority: [],
      execution_class: 'deterministic_enrichment',
      structured_output_schema: 'connections_path_v1',
      depends_on: ['q11_decision_owner'],
      fallback_to_retrieval: false,
      hop_budget: 0,
    }),
    question('q13_capability_gap', {
      question_type: 'capability_gap',
      query: '',
      source_priority: [],
      execution_class: 'derived_inference',
      structured_output_schema: 'capability_gap_v1',
      depends_on: ['q6_launch_signal'],
      fallback_to_retrieval: false,
      hop_budget: 0,
    }),
    question('q14_yp_fit', {
      question_type: 'yp_fit',
      query: '',
      source_priority: [],
      execution_class: 'derived_inference',
      structured_output_schema: 'yp_fit_v1',
      depends_on: ['q6_launch_signal', 'q11_decision_owner'],
      fallback_to_retrieval: false,
      hop_budget: 0,
    }),
    question('q15_outreach_strategy', {
      question_type: 'outreach_strategy',
      query: '',
      source_priority: [],
      execution_class: 'derived_inference',
      structured_output_schema: 'outreach_strategy_v1',
      depends_on: ['q6_launch_signal', 'q11_decision_owner', 'q14_yp_fit'],
      fallback_to_retrieval: false,
      hop_budget: 0,
    }),
  ]

  const result = await runOpenCodePresetBatch({
    outputDir,
    questionsOverride: questions,
    entityNameOverride: 'Test Club',
    entityIdOverride: 'test-club',
    entityTypeOverride: 'CLUB',
    questionRunner: fakeQuestionRunner,
    directBrightDataRunner: null,
  })

  const meta = JSON.parse(await fs.readFile(result.meta_result_path, 'utf8'))
  const answers = Object.fromEntries(meta.questions.map((item) => [item.question_id, item]))
  const q12 = answers.q12_connections
  const q13 = answers.q13_capability_gap
  const q14 = answers.q14_yp_fit
  const q15 = answers.q15_outreach_strategy

  assert.match(q12.validation_state, /provisional|validated/)
  assert.ok(q12.confidence > 0)
  assert.equal(q12.reasoning.structured_output.target_person, 'Jane Buyer')
  assert.equal(q12.reasoning.structured_output.recommended_route, 'cold_verification')

  assert.match(q13.validation_state, /provisional|validated/)
  assert.ok(q13.confidence > 0)
  assert.match(q13.reasoning.structured_output.top_gap, /digital product\/platform delivery/i)

  assert.match(q14.validation_state, /provisional|validated/)
  assert.ok(q14.confidence > 0)
  assert.equal(q14.reasoning.structured_output.best_service, 'DIGITAL_TRANSFORMATION')
  assert.match(q14.reasoning.structured_output.fit_rationale, /digital ticketing/i)

  assert.match(q15.validation_state, /provisional|validated/)
  assert.ok(q15.confidence > 0)
  assert.equal(q15.reasoning.structured_output.recommended_target, 'Jane Buyer')
  assert.match(q15.reasoning.structured_output.first_message_strategy, /Jane Buyer/)
})

test('q11 and q12 synthesize buyer route from q3 leadership when q11 retrieval is empty', async () => {
  process.env.ZAI_API_KEY = process.env.ZAI_API_KEY || 'test-key'
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-buyer-synthesis-'))
  const questions = [
    question('q3_leadership', {
      question_type: 'leadership',
      structured_output_schema: 'leadership_candidates_v1',
    }),
    question('q6_launch_signal', { question_type: 'launch_signal', structured_output_schema: 'launch_signal_v1' }),
    question('q11_decision_owner', {
      question_type: 'decision_owner',
      structured_output_schema: 'decision_owner_v1',
      depends_on: ['q3_leadership', 'q6_launch_signal'],
    }),
    question('q12_connections', {
      question_type: 'connections',
      query: '',
      source_priority: [],
      execution_class: 'deterministic_enrichment',
      structured_output_schema: 'connections_path_v1',
      depends_on: ['q11_decision_owner'],
      fallback_to_retrieval: false,
      hop_budget: 0,
    }),
  ]

  const result = await runOpenCodePresetBatch({
    outputDir,
    questionsOverride: questions,
    entityNameOverride: 'Test Club',
    entityIdOverride: 'test-club',
    entityTypeOverride: 'CLUB',
    questionRunner: async (executionQuestion) => {
      if (executionQuestion.question_id === 'q11_decision_owner') {
        return {
          structuredOutput: {
            question: executionQuestion.question_text,
            answer: '',
            context: '',
            sources: [],
            confidence: 0,
          },
          promptTrace: { fake: true },
          messageTrace: [],
          cliResult: { code: 0, stdout: '{}', stderr: '' },
        }
      }
      return fakeQuestionRunner(executionQuestion)
    },
    directBrightDataRunner: null,
  })

  const meta = JSON.parse(await fs.readFile(result.meta_result_path, 'utf8'))
  const answers = Object.fromEntries(meta.questions.map((item) => [item.question_id, item]))

  assert.equal(answers.q11_decision_owner.validation_state, 'provisional')
  assert.ok(answers.q11_decision_owner.confidence > 0)
  assert.equal(answers.q11_decision_owner.reasoning.structured_output.primary_owner.name, 'Jane Buyer')
  assert.equal(answers.q11_decision_owner.reasoning.structured_output.primary_owner.title, 'Chief Commercial Officer')

  assert.equal(answers.q12_connections.validation_state, 'provisional')
  assert.ok(answers.q12_connections.confidence > 0)
  assert.equal(answers.q12_connections.reasoning.structured_output.target_person, 'Jane Buyer')
})

test('q11 and q12 synthesize buyer route from prose q3 leadership answer', async () => {
  process.env.ZAI_API_KEY = process.env.ZAI_API_KEY || 'test-key'
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-prose-buyer-synthesis-'))
  const questions = [
    question('q3_leadership', {
      question_type: 'leadership',
      structured_output_schema: 'leadership_candidates_v1',
    }),
    question('q11_decision_owner', {
      question_type: 'decision_owner',
      structured_output_schema: 'decision_owner_v1',
      depends_on: ['q3_leadership'],
    }),
    question('q12_connections', {
      question_type: 'connections',
      query: '',
      source_priority: [],
      execution_class: 'deterministic_enrichment',
      structured_output_schema: 'connections_path_v1',
      depends_on: ['q11_decision_owner'],
      fallback_to_retrieval: false,
      hop_budget: 0,
    }),
  ]

  const result = await runOpenCodePresetBatch({
    outputDir,
    questionsOverride: questions,
    entityNameOverride: 'Test Club',
    entityIdOverride: 'test-club',
    entityTypeOverride: 'CLUB',
    questionRunner: async (executionQuestion) => {
      if (executionQuestion.question_id === 'q3_leadership') {
        return {
          structuredOutput: {
            question: executionQuestion.question_text,
            answer: 'Leadership evidence identifies Jane Buyer, Chief Commercial Officer, as responsible for commercial partnerships and sponsorship growth.',
            context: 'Leadership evidence contains a named commercial owner but no structured candidate array.',
            sources: ['https://example.com/test-club-leadership'],
            confidence: 0.82,
            signal_type: 'LEADERSHIP',
          },
          promptTrace: { fake: true },
          messageTrace: [],
          cliResult: { code: 0, stdout: '{}', stderr: '' },
        }
      }
      if (executionQuestion.question_id === 'q11_decision_owner') {
        return {
          structuredOutput: {
            question: executionQuestion.question_text,
            answer: '',
            context: '',
            sources: [],
            confidence: 0,
          },
          promptTrace: { fake: true },
          messageTrace: [],
          cliResult: { code: 0, stdout: '{}', stderr: '' },
        }
      }
      return fakeQuestionRunner(executionQuestion)
    },
    directBrightDataRunner: null,
  })

  const meta = JSON.parse(await fs.readFile(result.meta_result_path, 'utf8'))
  const answers = Object.fromEntries(meta.questions.map((item) => [item.question_id, item]))

  assert.equal(answers.q11_decision_owner.validation_state, 'provisional')
  assert.equal(answers.q11_decision_owner.reasoning.structured_output.primary_owner.name, 'Jane Buyer')
  assert.equal(answers.q11_decision_owner.reasoning.structured_output.primary_owner.title, 'Chief Commercial Officer')
  assert.equal(answers.q12_connections.reasoning.structured_output.target_person, 'Jane Buyer')
})

test('q11 synthesis rejects founding years as buyer candidates from q3 leadership', async () => {
  process.env.ZAI_API_KEY = process.env.ZAI_API_KEY || 'test-key'
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-year-buyer-rejection-'))
  const questions = [
    question('q3_leadership', {
      question_type: 'leadership',
      structured_output_schema: 'leadership_candidates_v1',
    }),
    question('q11_decision_owner', {
      question_type: 'decision_owner',
      structured_output_schema: 'decision_owner_v1',
      depends_on: ['q3_leadership'],
    }),
    question('q12_connections', {
      question_type: 'connections',
      query: '',
      source_priority: [],
      execution_class: 'deterministic_enrichment',
      structured_output_schema: 'connections_path_v1',
      depends_on: ['q11_decision_owner'],
      fallback_to_retrieval: false,
      hop_budget: 0,
    }),
  ]

  const result = await runOpenCodePresetBatch({
    outputDir,
    questionsOverride: questions,
    entityNameOverride: 'Test Club',
    entityIdOverride: 'test-club',
    entityTypeOverride: 'CLUB',
    questionRunner: async (executionQuestion) => {
      if (executionQuestion.question_id === 'q3_leadership') {
        return {
          structuredOutput: {
            question: executionQuestion.question_text,
            answer: 'Test Club was founded in 1875 and has a long sporting history.',
            candidates: [
              {
                name: '1875',
                title: 'Commercial Director',
                function: 'commercial',
                evidence_url: 'https://example.com/test-club-history',
              },
            ],
            context: 'This is foundation history, not a named commercial buyer.',
            sources: ['https://example.com/test-club-history'],
            confidence: 0.86,
            signal_type: 'LEADERSHIP',
          },
          promptTrace: { fake: true },
          messageTrace: [],
          cliResult: { code: 0, stdout: '{}', stderr: '' },
        }
      }
      if (executionQuestion.question_id === 'q11_decision_owner') {
        return {
          structuredOutput: {
            question: executionQuestion.question_text,
            answer: '',
            context: '',
            sources: [],
            confidence: 0,
          },
          promptTrace: { fake: true },
          messageTrace: [],
          cliResult: { code: 0, stdout: '{}', stderr: '' },
        }
      }
      return fakeQuestionRunner(executionQuestion)
    },
    directBrightDataRunner: null,
  })

  const meta = JSON.parse(await fs.readFile(result.meta_result_path, 'utf8'))
  const answers = Object.fromEntries(meta.questions.map((item) => [item.question_id, item]))

  assert.equal(answers.q11_decision_owner.validation_state, 'no_signal')
  assert.equal(answers.q11_decision_owner.confidence, 0)
  assert.equal(answers.q11_decision_owner.reasoning.structured_output.answer, 'insufficient_signal')
  assert.equal(answers.q12_connections.validation_state, 'no_signal')
  assert.equal(answers.q12_connections.confidence, 0)
})
