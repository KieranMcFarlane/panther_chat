import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildQuestionFirstRunArtifact,
  QUESTION_FIRST_RUN_SCHEMA_VERSION,
  validateQuestionFirstRunArtifact,
} from '../scripts/question_first_run_contract.mjs';

test('buildQuestionFirstRunArtifact emits the canonical question_first_run_v1 shape', () => {
  const artifact = buildQuestionFirstRunArtifact({
    entity_id: 'major-league-cricket',
    entity_name: 'Major League Cricket',
    entity_type: 'SPORT_LEAGUE',
    preset: 'major-league-cricket',
    question_source_path: 'backend/data/question_sources/major_league_cricket.json',
    questions: [
      {
        question_id: 'q1',
        question_type: 'foundation',
        question_text: 'When was Major League Cricket founded?',
        query: '"Major League Cricket" founded',
      },
    ],
    answers: [
      {
        question_id: 'q1',
        question_type: 'foundation',
        question_text: 'When was Major League Cricket founded?',
        answer: '2023',
        confidence: 0.92,
        validation_state: 'validated',
        evidence_url: 'https://example.com',
        signal_type: 'FOUNDATION',
      },
    ],
    evidence_items: [
      {
        evidence_id: 'q1:foundation',
        question_id: 'q1',
        entity_id: 'major-league-cricket',
        signal_type: 'FOUNDATION',
        evidence_focus: 'entity_fact',
        promotion_target: 'profile',
        answer_kind: 'fact',
        answer: '2023',
        confidence: 0.92,
        validation_state: 'validated',
        evidence_url: 'https://example.com',
      },
    ],
    promotion_candidates: [
      {
        candidate_id: 'q1:profile',
        question_id: 'q1',
        promotion_target: 'profile',
        signal_type: 'FOUNDATION',
        answer: '2023',
        confidence: 0.92,
        promotion_candidate: true,
      },
    ],
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
  assert.equal(artifact.questions.length, 1);
  assert.equal(artifact.answers.length, 1);
  assert.equal(artifact.evidence_items.length, 1);
  assert.equal(artifact.promotion_candidates.length, 1);
  assert.equal(artifact.poi_graph.schema_version, 'poi_graph_v1');
  assert.equal(artifact.categories.length, 1);
  assert.equal(artifact.run_rollup.questions_total, 1);
  assert.equal(artifact.merge_patch.metadata.question_first.evidence_items[0].promotion_target, 'profile');
  assert.equal(artifact.merge_patch.question_first.promotion_candidates[0].candidate_id, 'q1:profile');
  assert.equal(artifact.merge_patch.question_first.poi_graph.schema_version, 'poi_graph_v1');
  assert.equal(artifact.merge_patch.question_first.schema_version, QUESTION_FIRST_RUN_SCHEMA_VERSION);
  assert.equal(artifact.merge_patch.question_first.questions_answered, 1);
  assert.equal(artifact.merge_patch.questions[0].question_first_answer.answer, '2023');
});

test('validateQuestionFirstRunArtifact rejects malformed payloads', () => {
  assert.throws(
    () => validateQuestionFirstRunArtifact({ schema_version: 'not-the-right-version' }),
    /Expected schema_version question_first_run_v1/,
  );
  assert.throws(
    () => validateQuestionFirstRunArtifact({ schema_version: QUESTION_FIRST_RUN_SCHEMA_VERSION }),
    /Missing canonical question_first_run field: questions/,
  );
  assert.throws(
    () => validateQuestionFirstRunArtifact({
      schema_version: QUESTION_FIRST_RUN_SCHEMA_VERSION,
      questions: [],
      answers: [],
      categories: [],
      run_rollup: {},
      merge_patch: {},
      poi_graph: {},
    }),
    /Missing canonical question_first_run field: evidence_items/,
  );
});

test('buildQuestionFirstRunArtifact derives poi_graph from validated people answers', () => {
  const artifact = buildQuestionFirstRunArtifact({
    entity_id: 'arsenal-fc',
    entity_name: 'Arsenal Football Club',
    entity_type: 'SPORT_CLUB',
    questions: [],
    answers: [
      {
        question_id: 'q4',
        question_type: 'decision_owner',
        validation_state: 'validated',
        confidence: 0.95,
        evidence_url: 'https://example.com/juliet-slot',
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
      },
    ],
    evidence_items: [],
    promotion_candidates: [],
    categories: [],
    run_rollup: {},
  });

  assert.equal(artifact.poi_graph.nodes.length, 3);
  assert.equal(artifact.poi_graph.edges.length, 2);
  assert.equal(artifact.poi_graph.edges[0].edge_type, 'primary_owner_of');
});
