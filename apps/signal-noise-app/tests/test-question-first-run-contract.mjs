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
        execution_class: 'atomic_retrieval',
        rollout_phase: 'phase_1_core',
        conditional_on: [],
        depends_on: [],
        structured_output_schema: 'foundation_v1',
        graph_write_targets: ['entity_profile'],
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
        evidence_grade: 'strong',
        structured_signal: { named_entities: [{ name: 'Major League Cricket', evidence_url: 'https://example.com', evidence_kind: 'official_site', summary: 'Official entity profile.' }] },
        procurement_model: 'unknown',
        commercial_implication: 'Clear official grounding supports commercial targeting.',
        signal_density: 0.66,
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
  assert.equal(artifact.question_specs[0].rollout_phase, 'phase_1_core');
  assert.equal(artifact.question_specs[0].structured_output_schema, 'foundation_v1');
  assert.equal(artifact.answer_records[0].answer.value, '2023');
  assert.equal(artifact.answer_records[0].rollout_phase, 'phase_1_core');
  assert.equal(artifact.answer_records[0].evidence_refs[0], 'q1:foundation');
  assert.equal(artifact.answer_records[0].trace_ref, 'trace:q1');
  assert.equal(artifact.answer_records[0].evidence_grade, 'strong');
  assert.equal(artifact.answer_records[0].procurement_model, 'unknown');
  assert.equal(artifact.answer_records[0].commercial_implication, 'Clear official grounding supports commercial targeting.');
  assert.equal(artifact.answer_records[0].signal_density, 0.66);
  assert.equal(artifact.answer_records[0].structured_signal.named_entities[0].name, 'Major League Cricket');
  assert.equal(artifact.merge_patch.question_first.schema_version, QUESTION_FIRST_RUN_SCHEMA_VERSION);
  assert.equal(artifact.merge_patch.question_first.questions_answered, 1);
  assert.equal(artifact.merge_patch.question_first.answers[0].answer.value, '2023');
  assert.equal(artifact.merge_patch.question_first.answers[0].evidence_grade, 'strong');
  assert.equal(artifact.merge_patch.question_first.answers[0].commercial_implication, 'Clear official grounding supports commercial targeting.');
  assert.ok(!('questions' in artifact.merge_patch));
  assert.ok(!('question_first_answer' in artifact.question_specs[0]));
  assert.ok(!('raw_execution_trace' in artifact.answer_records[0]));
});

test('validateQuestionFirstRunArtifact requires typed connection and inference payloads', () => {
  const artifact = buildQuestionFirstRunArtifact({
    entity_id: 'arsenal-fc',
    entity_name: 'Arsenal Football Club',
    entity_type: 'SPORT_CLUB',
    question_specs: [
      {
        question_id: 'q12_connections',
        question_family: 'connections',
        question_type: 'connections',
        question_text: 'Which YP paths reach the ranked buyer?',
        query: '',
        hop_budget: 0,
        evidence_extension_budget: 0,
        source_priority: [],
        evidence_focus: 'network_path',
        promotion_target: 'connections',
        answer_kind: 'summary',
        question_shape: 'atomic',
        question_timeout_ms: 1000,
        hop_timeout_ms: 1000,
        evidence_extension_confidence_threshold: 0.65,
        entity_name: 'Arsenal Football Club',
        entity_id: 'arsenal-fc',
        entity_type: 'SPORT_CLUB',
        preset: 'arsenal',
        pack_role: 'discovery',
        execution_class: 'deterministic_enrichment',
        rollout_phase: 'phase_3_decision',
        conditional_on: [],
        depends_on: ['q11_decision_owner'],
        structured_output_schema: 'connections_path_v1',
        graph_write_targets: ['connection_paths'],
      },
    ],
    answer_records: [
      {
        question_id: 'q12_connections',
        question_type: 'connections',
        status: 'answered',
        validation_state: 'deterministic_detected',
        confidence: 0.72,
        signal_type: 'CONNECTIONS',
        answer: {
          kind: 'summary',
          summary: 'Path found',
          raw_structured_output: {
            candidate_paths: [
              {
                name: 'Jane Doe',
                path_type: 'direct',
                q11_score: 0.8,
                q12_score: 0.9,
                decision_score: 0.72,
              },
            ],
          },
        },
        trace_ref: 'trace:q12',
        evidence_refs: [],
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

  assert.doesNotThrow(() => validateQuestionFirstRunArtifact(artifact));
  const brokenArtifact = structuredClone(artifact);
  delete brokenArtifact.answer_records[0].answer.raw_structured_output.candidate_paths;
  assert.throws(
    () => validateQuestionFirstRunArtifact(brokenArtifact),
    /connections answers must include candidate_paths/,
  );
});

test('buildQuestionFirstRunArtifact does not stringify object-valued no-answer payloads', () => {
  const artifact = buildQuestionFirstRunArtifact({
    entity_id: 'dodgers',
    entity_name: 'Los Angeles Dodgers',
    entity_type: 'SPORT_CLUB',
    question_specs: [
      {
        question_id: 'q11_decision_owner',
        question_family: 'decision_owner',
        question_type: 'decision_owner',
        question_text: 'Who is the buyer?',
        query: '',
        hop_budget: 0,
        evidence_extension_budget: 0,
        source_priority: [],
        evidence_focus: 'buyer',
        promotion_target: 'decision_owner',
        answer_kind: 'summary',
        question_shape: 'atomic',
        question_timeout_ms: 1000,
        hop_timeout_ms: 1000,
        evidence_extension_confidence_threshold: 0.65,
        entity_name: 'Los Angeles Dodgers',
        entity_id: 'dodgers',
        entity_type: 'SPORT_CLUB',
        preset: 'dodgers',
        pack_role: 'discovery',
      },
    ],
    answer_records: [
      {
        question_id: 'q11_decision_owner',
        question_type: 'decision_owner',
        status: 'failed',
        validation_state: 'failed',
        confidence: 0,
        signal_type: 'DECISION_OWNER',
        answer: { status: 'no_answer' },
        reasoning: {
          structured_output: {
            answer: { status: 'no_answer' },
            sources: [],
            confidence: 0,
          },
        },
      },
    ],
    evidence_items: [],
    trace_index: [],
    categories: [],
    run_rollup: {},
  });

  const serialized = JSON.stringify(artifact);
  assert.doesNotMatch(serialized, /\[object Object\]/);
  assert.equal(artifact.answer_records[0].answer.summary, null);
  assert.equal(artifact.merge_patch.question_first.answers[0].answer.summary, null);
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

test('validateQuestionFirstRunArtifact rejects year-like decision owners', () => {
  const artifact = buildQuestionFirstRunArtifact({
    entity_id: 'birmingham-city',
    entity_name: 'Birmingham City',
    entity_type: 'SPORT_CLUB',
    question_specs: [],
    answer_records: [
      {
        question_id: 'q11_decision_owner',
        question_type: 'decision_owner',
        status: 'answered',
        validation_state: 'validated',
        confidence: 0.81,
        signal_type: 'DECISION_OWNER',
        answer: {
          kind: 'list',
          summary: '1875',
        },
        primary_owner: {
          name: '1875',
          title: 'Commercial Director',
          organization: 'Birmingham City',
        },
        supporting_candidates: [],
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

  assert.throws(
    () => validateQuestionFirstRunArtifact(artifact),
    /decision_owner answers must include a plausible named person or role owner/,
  );
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

test('buildQuestionFirstRunArtifact preserves prompt-trace failure provenance on failed answers', () => {
  const artifact = buildQuestionFirstRunArtifact({
    entity_id: 'arsenal-fc',
    entity_name: 'Arsenal Football Club',
    entity_type: 'SPORT_CLUB',
    question_specs: [
      {
        question_id: 'q15_outreach_strategy',
        question_family: 'outreach_strategy',
        question_type: 'outreach_strategy',
        question_text: 'What is the best outreach strategy for Arsenal FC?',
        query: '"Arsenal FC" outreach strategy',
        hop_budget: 1,
        evidence_extension_budget: 0,
        source_priority: ['google_serp'],
        evidence_focus: 'commercial_strategy',
        promotion_target: 'outreach_strategy',
        answer_kind: 'summary',
        question_shape: 'atomic',
        question_timeout_ms: 180000,
        hop_timeout_ms: 180000,
        evidence_extension_confidence_threshold: 0.65,
        entity_name: 'Arsenal Football Club',
        entity_id: 'arsenal-fc',
        entity_type: 'SPORT_CLUB',
        preset: 'arsenal',
        pack_role: 'discovery',
        execution_class: 'derived_inference',
        rollout_phase: 'phase_3_decision',
        conditional_on: [],
        depends_on: ['q11_decision_owner'],
        structured_output_schema: 'outreach_strategy_v1',
        graph_write_targets: ['strategy.outreach'],
      },
    ],
    answer_records: [
      {
        question_id: 'q15_outreach_strategy',
        question_type: 'outreach_strategy',
        status: 'failed',
        validation_state: 'tool_call_missing',
        confidence: 0,
        signal_type: 'OUTREACH_STRATEGY',
        answer: { kind: 'summary', summary: null },
        prompt_trace: {
          status: 'derived_inference_tool_call_missing',
          failure_origin: 'derived_inference',
        },
        evidence_refs: [],
        trace_ref: 'trace:q15',
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

  assert.equal(artifact.answer_records[0].validation_state, 'failed');
  assert.equal(artifact.answer_records[0].prompt_trace.status, 'derived_inference_tool_call_missing');
  assert.equal(artifact.answer_records[0].prompt_trace.failure_origin, 'derived_inference');
});

test('buildQuestionFirstRunArtifact writes derived episodes into the canonical poi graph', () => {
  const artifact = buildQuestionFirstRunArtifact({
    entity_id: 'arsenal-fc',
    entity_name: 'Arsenal Football Club',
    entity_type: 'SPORT_CLUB',
    question_specs: [],
    answer_records: [
      {
        question_id: 'q13_capability_gap',
        question_type: 'capability_gap',
        status: 'answered',
        validation_state: 'provisional',
        confidence: 0.61,
        signal_type: 'CAPABILITY_GAP',
        answer: {
          kind: 'summary',
          summary: 'Capability gaps identified',
          raw_structured_output: {
            graph_episode: {
              episode_type: 'capability_gap',
              label: 'digital_stack_maturity',
              score: 0.7,
            },
          },
        },
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

  assert.ok(artifact.poi_graph.nodes.some((node) => node.node_type === 'derived_episode'));
  assert.ok(artifact.poi_graph.edges.some((edge) => edge.edge_type === 'derived_capability_gap'));
});
