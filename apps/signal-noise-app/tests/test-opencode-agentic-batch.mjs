import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildMajorLeagueCricketPresetQuestions,
  buildMajorLeagueCricketPoiBatchAQuestions,
  buildMajorLeagueCricketPoiBatchBQuestions,
  buildMajorLeagueCricketPoiBatchCQuestions,
  buildMajorLeagueCricketPoiQuestions,
  buildMajorLeagueCricketSmokeQuestions,
  buildOpenCodeConfig,
  buildOpenCodeQuestionPrompt,
  buildQuestionState,
  runOpenCodePresetBatch,
} from '../scripts/opencode_agentic_batch.mjs';

test('buildOpenCodeConfig wires Z.AI and BrightData MCP for OpenCode', () => {
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  const previousBrightDataToken = process.env.BRIGHTDATA_API_TOKEN;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  process.env.BRIGHTDATA_API_TOKEN = 'test-brightdata-token';
  const config = buildOpenCodeConfig({
    worktreeRoot: '/Users/kieranmcfarlane/Downloads/panther_chat/.worktrees/v5-yellow-panther-canonical',
  });

  assert.equal(config.$schema, 'https://opencode.ai/config.json');
  assert.equal(config.model, 'zai-coding-plan/glm-5');
  assert.equal(config.provider['zai-coding-plan'].name, 'Z.AI Coding Plan');
  assert.equal(config.provider['zai-coding-plan'].options.baseURL, 'https://api.z.ai/api/anthropic');
  assert.equal(config.provider['zai-coding-plan'].options.apiKey, 'test-zai-token');
  assert.ok(config.mcp.brightData);
  assert.equal(config.mcp.brightData.type, 'local');
  assert.equal(config.mcp.brightData.enabled, true);
  assert.equal(config.mcp.brightData.command[0], 'npx');
  assert.equal(config.mcp.brightData.command[1], '-y');
  assert.equal(config.mcp.brightData.command[2], '@brightdata/mcp');
  assert.equal(config.mcp.brightData.environment.API_TOKEN, 'test-brightdata-token');
  assert.equal(config.agent.discovery.steps, 4);
  assert.equal(config.agent.discovery.model, 'zai-coding-plan/glm-5');
  assert.deepEqual(config.tools, { 'brightdata*': false });
  assert.deepEqual(config.agent.build.tools, { 'brightdata*': true });
  assert.deepEqual(config.agent.discovery.tools, { 'brightdata*': true });
  if (previousZaiKey === undefined) {
    delete process.env.ANTHROPIC_AUTH_TOKEN;
  } else {
    process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
  }
  if (previousBrightDataToken === undefined) {
    delete process.env.BRIGHTDATA_API_TOKEN;
  } else {
    process.env.BRIGHTDATA_API_TOKEN = previousBrightDataToken;
  }
});

test('buildMajorLeagueCricketPresetQuestions returns the preset bundle in order', () => {
  const records = buildMajorLeagueCricketPresetQuestions();

  assert.equal(records.length, 7);
  assert.deepEqual(
    records.map((record) => record.question_type),
    ['foundation', 'procurement', 'poi', 'poi', 'poi', 'poi', 'poi'],
  );
  assert.equal(records[0].question_id, 'entity_founded_year');
  assert.equal(records[1].question_id, 'sl_league_mobile_app');
  assert.equal(records[2].question_id, 'poi_commercial_partnerships_lead');
  assert.equal(records[6].question_id, 'poi_operations_lead');
});

test('buildMajorLeagueCricketSmokeQuestions returns the core two-question smoke bundle', () => {
  const records = buildMajorLeagueCricketSmokeQuestions();

  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((record) => record.question_id),
    ['entity_founded_year', 'sl_league_mobile_app'],
  );
});

test('buildMajorLeagueCricketPoiQuestions returns the POI bundle in order', () => {
  const records = buildMajorLeagueCricketPoiQuestions();

  assert.equal(records.length, 5);
  assert.deepEqual(
    records.map((record) => record.question_id),
    [
      'poi_commercial_partnerships_lead',
      'poi_digital_product_lead',
      'poi_fan_engagement_lead',
      'poi_marketing_comms_lead',
      'poi_operations_lead',
    ],
  );
});

test('buildMajorLeagueCricketPoiBatchAQuestions returns the first POI sub-bundle', () => {
  const records = buildMajorLeagueCricketPoiBatchAQuestions();

  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((record) => record.question_id),
    [
      'poi_commercial_partnerships_lead',
      'poi_digital_product_lead',
    ],
  );
});

test('buildMajorLeagueCricketPoiBatchBQuestions returns the second POI sub-bundle', () => {
  const records = buildMajorLeagueCricketPoiBatchBQuestions();

  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((record) => record.question_id),
    [
      'poi_fan_engagement_lead',
      'poi_marketing_comms_lead',
    ],
  );
});

test('buildMajorLeagueCricketPoiBatchCQuestions returns the third POI sub-bundle', () => {
  const records = buildMajorLeagueCricketPoiBatchCQuestions();

  assert.equal(records.length, 1);
  assert.deepEqual(
    records.map((record) => record.question_id),
    ['poi_operations_lead'],
  );
});

test('buildOpenCodeQuestionPrompt stays close to the proven direct prompt shape', () => {
  const prompt = buildOpenCodeQuestionPrompt({
    question_text: 'When was Major League Cricket founded?',
    question_type: 'foundation',
    source_priority: ['google_serp', 'official_site', 'wikipedia'],
    hop_budget: 2,
    query: '"Major League Cricket" founded',
    yp_service_fit: [],
  });

  assert.match(prompt, /Return only JSON/i);
  assert.match(prompt, /Use BrightData to answer the question/i);
  assert.match(prompt, /context, sources, confidence/i);
  assert.doesNotMatch(prompt, /hop budget/i);
  assert.doesNotMatch(prompt, /brightdata tool/i);
});

test('buildQuestionState applies explicit budget and threshold overrides', () => {
  const question = buildMajorLeagueCricketPresetQuestions()[0];
  const state = buildQuestionState(question, {
    runId: 'test-run',
    timestamp: '2026-03-27T00:00:00.000Z',
    creditBudgetOverrides: {
      searchCredits: 7,
      scrapeCredits: 6,
      revisitCredits: 2,
      confidenceThreshold: 0.92,
    },
  });

  assert.deepEqual(state.credit_budget, {
    search: 7,
    scrape: 6,
    revisit: 2,
  });
  assert.equal(state.confidence_threshold, 0.92);
  assert.equal(state.run_id, 'test-run');
  assert.equal(state.last_run_at, '2026-03-27T00:00:00.000Z');
});

test('runOpenCodePresetBatch writes a merged meta artifact for the preset', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  const questionRuns = [];

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      questionRunner: async (question) => {
        questionRuns.push(question.question_id);
        return {
          structuredOutput: {
            answer: `stub-${question.question_id}`,
            signal_type: 'NO_SIGNAL',
            confidence: 0.0,
            validation_state: 'no_signal',
            evidence_url: '',
            recommended_next_query: '',
            notes: 'stubbed',
          },
          promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
        };
      },
    });

    assert.equal(result.questions_total, 2);
    assert.deepEqual(questionRuns, [
      'entity_founded_year',
      'sl_league_mobile_app',
    ]);

    const meta = JSON.parse(readFileSync(result.meta_result_path, 'utf8'));
    assert.equal(meta.questions.length, 2);
    assert.equal(meta.questions[0].question_id, 'entity_founded_year');
    assert.equal(meta.questions[1].question_id, 'sl_league_mobile_app');
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodePresetBatch supports the POI-only preset', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-poi-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  const questionRuns = [];

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-poi',
      questionRunner: async (question) => {
        questionRuns.push(question.question_id);
        return {
          structuredOutput: {
            answer: `stub-${question.question_id}`,
            signal_type: 'NO_SIGNAL',
            confidence: 0.0,
            validation_state: 'no_signal',
            evidence_url: '',
            recommended_next_query: '',
            notes: 'stubbed',
          },
          promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
        };
      },
    });

    assert.equal(result.questions_total, 5);
    assert.deepEqual(questionRuns, [
      'poi_commercial_partnerships_lead',
      'poi_digital_product_lead',
      'poi_fan_engagement_lead',
      'poi_marketing_comms_lead',
      'poi_operations_lead',
    ]);
    const meta = JSON.parse(readFileSync(result.meta_result_path, 'utf8'));
    assert.equal(meta.questions.length, 5);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodePresetBatch supports the POI batch A preset', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-poi-a-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  const questionRuns = [];

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-poi-a',
      questionRunner: async (question) => {
        questionRuns.push(question.question_id);
        return {
          structuredOutput: {
            answer: `stub-${question.question_id}`,
            signal_type: 'NO_SIGNAL',
            confidence: 0.0,
            validation_state: 'no_signal',
            evidence_url: '',
            recommended_next_query: '',
            notes: 'stubbed',
          },
          promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
        };
      },
    });

    assert.equal(result.questions_total, 2);
    assert.deepEqual(questionRuns, [
      'poi_commercial_partnerships_lead',
      'poi_digital_product_lead',
    ]);
    const meta = JSON.parse(readFileSync(result.meta_result_path, 'utf8'));
    assert.equal(meta.questions.length, 2);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodePresetBatch supports the POI batch B preset', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-poi-b-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  const questionRuns = [];

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-poi-b',
      questionRunner: async (question) => {
        questionRuns.push(question.question_id);
        return {
          structuredOutput: {
            answer: `stub-${question.question_id}`,
            signal_type: 'NO_SIGNAL',
            confidence: 0.0,
            validation_state: 'no_signal',
            evidence_url: '',
            recommended_next_query: '',
            notes: 'stubbed',
          },
          promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
        };
      },
    });

    assert.equal(result.questions_total, 2);
    assert.deepEqual(questionRuns, [
      'poi_fan_engagement_lead',
      'poi_marketing_comms_lead',
    ]);
    const meta = JSON.parse(readFileSync(result.meta_result_path, 'utf8'));
    assert.equal(meta.questions.length, 2);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodePresetBatch supports the POI batch C preset', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-poi-c-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  const questionRuns = [];

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-poi-c',
      questionRunner: async (question) => {
        questionRuns.push(question.question_id);
        return {
          structuredOutput: {
            answer: `stub-${question.question_id}`,
            signal_type: 'NO_SIGNAL',
            confidence: 0.0,
            validation_state: 'no_signal',
            evidence_url: '',
            recommended_next_query: '',
            notes: 'stubbed',
          },
          promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
        };
      },
    });

    assert.equal(result.questions_total, 1);
    assert.deepEqual(questionRuns, ['poi_operations_lead']);
    const meta = JSON.parse(readFileSync(result.meta_result_path, 'utf8'));
    assert.equal(meta.questions.length, 1);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodePresetBatch persists explicit credit and confidence overrides', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-budget-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      searchCredits: 9,
      scrapeCredits: 8,
      revisitCredits: 4,
      confidenceThreshold: 0.93,
      questionRunner: async (question) => ({
        structuredOutput: {
          answer: `stub-${question.question_id}`,
          signal_type: 'NO_SIGNAL',
          confidence: 0.0,
          validation_state: 'no_signal',
          evidence_url: '',
          recommended_next_query: '',
          notes: 'stubbed',
        },
        promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
      }),
    });

    const state = JSON.parse(readFileSync(result.state_path, 'utf8'));
    assert.equal(state.questions[0].credit_budget.search, 9);
    assert.equal(state.questions[0].credit_budget.scrape, 8);
    assert.equal(state.questions[0].credit_budget.revisit, 4);
    assert.equal(state.questions[0].confidence_threshold, 0.93);
    assert.equal(state.questions[1].credit_budget.search, 9);
    assert.equal(state.questions[1].confidence_threshold, 0.93);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});


test('runOpenCodePresetBatch marks empty structured output as tool_call_missing', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-missing-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      questionRunner: async () => ({
        structuredOutput: {},
        promptTrace: { status: 'ok', structured_output_keys: 0, has_structured_output: false },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: false, part_count: 1 }],
        cliResult: { code: 0, stdout: '', stderr: '' },
      }),
    });

    const meta = JSON.parse(readFileSync(result.meta_result_path, 'utf8'));
    assert.equal(result.questions_total, 2);
    assert.equal(result.questions_no_signal, 0);
    assert.equal(meta.questions[0].validation_state, 'tool_call_missing');
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});


test('runOpenCodePresetBatch stores prompt response trace when available', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-trace-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      questionRunner: async () => ({
        structuredOutput: {},
        promptTrace: { status: 'ok', structured_output_keys: 0, has_structured_output: false },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: false, part_count: 1 }],
        cliResult: { code: 0, stdout: '', stderr: '' },
      }),
    });

    const question = JSON.parse(readFileSync(result.question_result_paths[0], 'utf8')).question;
    assert.equal(question.prompt_trace.status, 'ok');
    assert.equal(question.prompt_trace.structured_output_keys, 0);
    assert.ok(Array.isArray(question.message_trace));
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});


test('runOpenCodePresetBatch resumes from persisted validated state without re-running questions', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-resume-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  const runs = [];

  try {
    const initial = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      questionRunner: async (question) => {
        runs.push(question.question_id);
        return {
          structuredOutput: {
            question: question.question_text,
            answer: `stub-${question.question_id}`,
            context: 'stubbed',
            sources: ['https://example.com'],
            confidence: 0.99,
            validation_state: 'validated',
          },
          promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
        };
      },
    });

    assert.equal(initial.questions_total, 2);
    assert.deepEqual(runs, ['entity_founded_year', 'sl_league_mobile_app']);

    const resumed = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      resume: true,
      questionRunner: async () => {
        throw new Error('resume should not re-run validated questions');
      },
    });

    assert.equal(resumed.questions_total, 2);
    const state = JSON.parse(readFileSync(resumed.state_path, 'utf8'));
    assert.equal(state.questions[0].status, 'validated');
    assert.equal(state.questions[1].status, 'validated');
    assert.equal(state.questions[0].best_answer, 'stub-entity_founded_year');
    assert.equal(state.questions[1].best_answer, 'stub-sl_league_mobile_app');
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});


test('runOpenCodePresetBatch consumes queued frontier items on resume', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-frontier-resume-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  const runs = [];

  try {
    const initial = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      questionRunner: async (question) => {
        runs.push(question.query);
        return {
          structuredOutput: {
            question: question.question_text,
            answer: `stub-${question.question_id}`,
            context: 'stubbed',
            sources: ['https://example.com'],
            confidence: 0.99,
            validation_state: 'validated',
            recommended_next_query: 'Major League Cricket digital transformation 2025',
          },
          promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
        };
      },
    });

    assert.equal(initial.questions_total, 2);
    assert.equal(runs[0], '"Major League Cricket" founded');
    assert.equal(runs[1], '"Major League Cricket" RFP tender procurement');

    const resumedRuns = [];
    const resumed = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      resume: true,
      questionRunner: async (question) => {
        resumedRuns.push(question.query);
        return {
          structuredOutput: {
            question: question.question_text,
            answer: `followup-${question.question_id}`,
            context: 'followup',
            sources: ['https://www.linkedin.com/posts/majorleaguecricket_american-cricket-enterprises-has-issued-an-activity-7371974338536861696-zCn6'],
            confidence: 0.9,
            validation_state: 'validated',
          },
          promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"followup"}', stderr: '' },
        };
      },
    });

    assert.equal(resumed.questions_total, 2);
    assert.equal(resumedRuns.length, 2);
    assert.equal(resumedRuns[0], 'Major League Cricket digital transformation 2025');
    const state = JSON.parse(readFileSync(resumed.state_path, 'utf8'));
    assert.ok(state.questions[1].run_history.length >= 2);
    assert.equal(state.questions[1].run_history.at(-1).executed_query, 'Major League Cricket digital transformation 2025');
    assert.ok(state.questions[1].frontier.some((item) => item.query === 'Major League Cricket digital transformation 2025'));
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});


test('runOpenCodePresetBatch expands the frontier from accepted sources and next queries', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-frontier-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      questionRunner: async (question) => ({
        structuredOutput: {
          question: question.question_text,
          answer: `stub-${question.question_id}`,
          context: 'stubbed',
          sources: [
            'https://www.linkedin.com/posts/majorleaguecricket_american-cricket-enterprises-has-issued-an-activity-7371974338536861696-zCn6',
          ],
          confidence: 0.91,
          validation_state: 'validated',
          recommended_next_query: 'Major League Cricket digital transformation 2025',
        },
        promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
      }),
    });

    const state = JSON.parse(readFileSync(result.state_path, 'utf8'));
    const questionState = state.questions[1];
    assert.equal(questionState.status, 'validated');
    assert.ok(questionState.accepted_links.length >= 1);
    assert.ok(questionState.frontier.some((item) => item.source_kind === 'linkedin_posts'));
    assert.ok(questionState.frontier.some((item) => item.query === 'Major League Cricket digital transformation 2025'));
    assert.equal(questionState.accepted_links[0].score >= 0.7, true);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});
