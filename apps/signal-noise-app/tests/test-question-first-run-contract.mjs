import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildQuestionFirstRunArtifact,
  QUESTION_FIRST_RUN_SCHEMA_VERSION,
  validateQuestionFirstRunArtifact,
} from '../scripts/question_first_run_contract.mjs';

test('buildQuestionFirstRunArtifact emits the canonical question_first_run_v2 shape', () => {
  const artifact = buildQuestionFirstRunArtifact({
    entity_id: 'major-league-cricket',
    entity_name: 'Major League Cricket',
    entity_type: 'SPORT_LEAGUE',
    preset: 'major-league-cricket',
    question_source_path: 'backend/data/question_sources/major_league_cricket.json',
    question_specs: [
      {
        question_id: 'q1',
        question_family: 'foundation',
        question_type: 'foundation',
        question_text: 'When was Major League Cricket founded?',
        query: '"Major League Cricket" founded',
        hop_budget: 1,
        evidence_extension_budget: 0,
        source_priority: ['google_serp'],
        evidence_focus: 'entity_fact',
        promotion_target: 'profile',
        answer_kind: 'fact',
        question_shape: 'atomic',
        question_timeout_ms: 1000,
        hop_timeout_ms: 1000,
        evidence_extension_confidence_threshold: 0.65,
        entity_name: 'Major League Cricket',
        entity_id: 'major-league-cricket',
        entity_type: 'SPORT_LEAGUE',
        preset: 'major-league-cricket',
        pack_role: 'discovery',
      },
    ],
    answer_records: [
      {
        question_id: 'q1',
        question_type: 'foundation',
        status: 'answered',
        confidence: 0.92,
        validation_state: 'validated',
        signal_type: 'FOUNDATION',
        answer: {
          kind: 'fact',
          value: '2023',
        },
        evidence_refs: ['q1:foundation'],
        trace_ref: 'trace:q1',
        started_at: '2026-03-30T00:00:00+00:00',
        completed_at: '2026-03-30T00:00:05+00:00',
        duration_seconds: 5,
      },
    ],
    evidence_items: [
      {
        evidence_id: 'q1:foundation',
        question_id: 'q1',
        source_type: 'official_site',
        url: 'https://example.com',
        title: 'Example',
        snippet: 'Founded in 2023',
        captured_at: '2026-03-30T00:00:03+00:00',
        relevance: 0.92,
        confidence: 0.92,
        supports: ['2023'],
        raw_ref: 'official_site',
      },
    ],
    trace_index: [
      {
        trace_id: 'trace:q1',
        question_id: 'q1',
        trace_type: 'debug_bundle',
        path: '/tmp/question_001.debug.json',
        inline: null,
      },
    ],
    question_timings: {
      q1: {
        started_at: '2026-03-30T00:00:00+00:00',
        completed_at: '2026-03-30T00:00:05+00:00',
        duration_seconds: 5,
      },
    },
    categories: [
      {
        category: 'identity',
        question_count: 1,
        validated_count: 1,
        pending_count: 0,
        no_signal_count: 0,
        retry_count: 0,
      },
    ],
    run_rollup: {
      questions_total: 1,
      questions_validated: 1,
      questions_no_signal: 0,
      questions_provisional: 0,
      entity_id: 'major-league-cricket',
      entity_name: 'Major League Cricket',
      entity_type: 'SPORT_LEAGUE',
      preset: 'major-league-cricket',
    },
  });

  assert.equal(artifact.schema_version, QUESTION_FIRST_RUN_SCHEMA_VERSION);
  assert.equal(artifact.question_specs.length, 1);
  assert.equal(artifact.answer_records.length, 1);
  assert.equal(artifact.evidence_items.length, 1);
  assert.equal(artifact.trace_index.length, 1);
  assert.equal(artifact.poi_graph.schema_version, 'poi_graph_v1');
  assert.equal(artifact.categories.length, 1);
  assert.equal(artifact.run_rollup.questions_total, 1);
  assert.equal(artifact.question_timings.q1.started_at, '2026-03-30T00:00:00+00:00');
  assert.equal(artifact.question_timings.q1.completed_at, '2026-03-30T00:00:05+00:00');
  assert.equal(artifact.question_timings.q1.duration_seconds, 5);
  assert.equal(artifact.question_specs[0].question_text, 'When was Major League Cricket founded?');
  assert.equal(artifact.answer_records[0].answer.value, '2023');
  assert.equal(artifact.answer_records[0].evidence_refs[0], 'q1:foundation');
  assert.equal(artifact.answer_records[0].trace_ref, 'trace:q1');
  assert.equal(artifact.merge_patch.question_first.schema_version, QUESTION_FIRST_RUN_SCHEMA_VERSION);
  assert.equal(artifact.merge_patch.question_first.questions_answered, 1);
  assert.equal(artifact.merge_patch.question_first.answers[0].answer.value, '2023');
  assert.ok(!('questions' in artifact.merge_patch));
  assert.ok(!('question_first_answer' in artifact.question_specs[0]));
  assert.ok(!('raw_execution_trace' in artifact.answer_records[0]));
});

test('validateQuestionFirstRunArtifact rejects malformed payloads', () => {
  assert.throws(
    () => validateQuestionFirstRunArtifact({ schema_version: 'not-the-right-version' }),
    /Expected schema_version question_first_run_v2/,
  );
  assert.throws(
    () => validateQuestionFirstRunArtifact({ schema_version: QUESTION_FIRST_RUN_SCHEMA_VERSION }),
    /Missing canonical question_first_run field: question_specs/,
  );
  assert.throws(
    () => validateQuestionFirstRunArtifact({
      schema_version: QUESTION_FIRST_RUN_SCHEMA_VERSION,
      question_specs: [],
      answer_records: [],
      question_timings: {},
      categories: [],
      run_rollup: {},
      merge_patch: {},
      poi_graph: {},
      trace_index: [],
    }),
    /Missing canonical question_first_run field: evidence_items/,
  );
});

test('buildQuestionFirstRunArtifact derives poi_graph from validated people answers', () => {
  const artifact = buildQuestionFirstRunArtifact({
    entity_id: 'arsenal-fc',
    entity_name: 'Arsenal Football Club',
    entity_type: 'SPORT_CLUB',
    question_specs: [],
    answer_records: [
      {
        question_id: 'q4',
        question_type: 'decision_owner',
        status: 'answered',
        validation_state: 'validated',
        confidence: 0.95,
        signal_type: 'DECISION_OWNER',
        answer: {
          kind: 'list',
          summary: 'Ownership candidates',
        },
        primary_owner: {
          name: 'Juliet Slot',
          title: 'Chief Commercial Officer',
          organization: 'Arsenal Football Club',
        },
        supporting_candidates: [
          {
            name: 'Omar Shaikh',
            title: 'Chief Financial Officer',
            organization: 'Arsenal Football Club',
          },
        ],
        evidence_refs: [],
        trace_ref: null,
        started_at: '2026-03-30T00:00:00+00:00',
        completed_at: '2026-03-30T00:00:05+00:00',
        duration_seconds: 5,
      },
    ],
    evidence_items: [],
    trace_index: [],
    categories: [],
    run_rollup: {},
  });

  assert.equal(artifact.poi_graph.nodes.length, 3);
  assert.equal(artifact.poi_graph.edges.length, 2);
  assert.equal(artifact.poi_graph.edges[0].edge_type, 'primary_owner_of');
});

test('buildQuestionFirstRunArtifact writes trace refs instead of embedding raw execution trace', () => {
  const artifact = buildQuestionFirstRunArtifact({
    entity_id: 'celtic-fc',
    entity_name: 'Celtic FC',
    entity_type: 'SPORT_CLUB',
    question_specs: [
      {
        question_id: 'q3_procurement_signal',
        question_family: 'procurement',
        question_type: 'procurement',
        question_text: 'Is there evidence Celtic is reshaping its digital ecosystem?',
        query: '"Celtic Football Club" commercial partnership',
        hop_budget: 8,
        evidence_extension_budget: 1,
        source_priority: ['google_serp'],
        evidence_focus: 'opportunity_signal',
        promotion_target: 'opportunity_signals',
        answer_kind: 'signal',
        question_shape: 'atomic',
        question_timeout_ms: 180000,
        hop_timeout_ms: 180000,
        evidence_extension_confidence_threshold: 0.65,
        entity_name: 'Celtic FC',
        entity_id: 'celtic-fc',
        entity_type: 'SPORT_CLUB',
        preset: 'celtic',
        pack_role: 'discovery',
      },
    ],
    answer_records: [
      {
        question_id: 'q3_procurement_signal',
        question_type: 'procurement',
        status: 'failed',
        answer: { kind: 'summary', summary: null },
        confidence: 0,
        validation_state: 'failed',
        signal_type: 'PROCUREMENT',
        evidence_refs: [],
        trace_ref: 'trace:q3',
        started_at: '2026-03-30T00:00:00+00:00',
        completed_at: '2026-03-30T00:00:05+00:00',
        duration_seconds: 5,
      },
    ],
    evidence_items: [],
    trace_index: [
      {
        trace_id: 'trace:q3',
        question_id: 'q3_procurement_signal',
        trace_type: 'debug_bundle',
        path: '/tmp/question_001.debug.json',
        inline: null,
      },
    ],
    categories: [],
    run_rollup: {},
  });

  assert.equal(artifact.answer_records[0].trace_ref, 'trace:q3');
  assert.equal(artifact.trace_index[0].path, '/tmp/question_001.debug.json');
  assert.ok(!('raw_execution_trace' in artifact.answer_records[0]));
});
