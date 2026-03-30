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
  assert.equal(artifact.categories.length, 1);
  assert.equal(artifact.run_rollup.questions_total, 1);
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
});
