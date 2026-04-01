import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildMajorLeagueCricketPresetQuestions,
  buildMajorLeagueCricketPoiBatchAQuestions,
  buildMajorLeagueCricketPoiBatchBQuestions,
  buildMajorLeagueCricketPoiBatchCQuestions,
  buildOpenCodeQuestionCommand,
  buildMajorLeagueCricketPoiQuestions,
  buildMajorLeagueCricketSmokeQuestions,
  buildOpenCodeConfig,
  buildOpenCodeQuestionPrompt,
  extractFinalCliJson,
  buildQuestionState,
  ensureBrightDataFastMcpService,
  runOpenCodeQuestionSourceBatch,
  runOpenCodePresetBatch,
} from '../scripts/opencode_agentic_batch.mjs';

test('buildOpenCodeConfig wires Z.AI and BrightData FastMCP for OpenCode', () => {
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
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
  assert.deepEqual(config.mcp.brightData.command, [
    'node',
    '/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/mcp-brightdata-server.js',
  ]);
  assert.deepEqual(config.mcp.brightData.environment, {
    BRIGHTDATA_FASTMCP_URL: 'http://127.0.0.1:8000/mcp',
    BRIGHTDATA_MCP_USE_HOSTED: 'false',
    BRIGHTDATA_MCP_HOSTED_URL: '',
  });
  assert.match(config.instructions[0], /FastMCP/);
  assert.equal(config.agent.discovery.steps, 4);
  assert.equal(config.agent.discovery.model, 'zai-coding-plan/glm-5');
  assert.deepEqual(config.tools, { 'brightData_*': false });
  assert.deepEqual(config.agent.build.tools, { 'brightData_*': true });
  assert.deepEqual(config.agent.discovery.tools, { 'brightData_*': true });
  if (previousZaiKey === undefined) {
    delete process.env.ANTHROPIC_AUTH_TOKEN;
  } else {
    process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
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
    search_strategy: {
      search_queries: [
        '"Major League Cricket" founded year',
        '"Major League Cricket" established',
      ],
    },
    yp_service_fit: [],
  });

  assert.match(prompt, /When was Major League Cricket founded\? use brightdata\./i);
  assert.match(
    prompt,
    /Suggested search queries: "Major League Cricket" founded year \| "Major League Cricket" established\./i,
  );
  assert.match(prompt, /Start with search and use scraped pages only if the search results are not enough to validate the answer\./i);
  assert.match(prompt, /You have at most 2 hops/i);
  assert.match(prompt, /fenced JSON code block with answer "", confidence 0, sources \[\], and validation_state "no_signal"/i);
  assert.match(prompt, /exactly one fenced JSON code block with the validated answer, confidence, and sources if available/i);
  assert.match(prompt, /Do not include any prose outside the fenced JSON block/i);
  assert.match(prompt, /Stop immediately after the first validated answer/i);
  assert.doesNotMatch(prompt, /brightdata tool/i);
  assert.doesNotMatch(prompt, /canonical query/i);
  assert.doesNotMatch(prompt, /question type/i);
  assert.doesNotMatch(prompt, /context, sources, confidence/i);
});

test('buildOpenCodeQuestionCommand defaults to the known-good OpenCode model', () => {
  const command = buildOpenCodeQuestionCommand({
    question_id: 'foundation_year',
    question_text: 'When was Major League Cricket founded?',
  });

  const modelIndex = command.indexOf('--model');
  assert.notEqual(modelIndex, -1);
  assert.equal(command[modelIndex + 1], 'zai-coding-plan/glm-5');
});

test('ensureBrightDataFastMcpService starts the local service when health is down', async () => {
  const seen = [];
  let probes = 0;
  const fetchImpl = async () => {
    seen.push('probe');
    probes += 1;
    if (probes === 1) {
      throw new Error('connect ECONNREFUSED');
    }
    return { ok: true };
  };
  const spawnImpl = (...args) => {
    seen.push(args);
    return {
      unref() {
        seen.push('unref');
      },
    };
  };

  const result = await ensureBrightDataFastMcpService({
    fetchImpl,
    spawnImpl,
    serviceUrl: 'http://127.0.0.1:8000/mcp',
    healthUrl: 'http://127.0.0.1:8000/health',
  });

  assert.equal(result.started, true);
  assert.equal(result.healthy, true);
  assert.equal(seen[0], 'probe');
  assert.equal(seen[1][0], 'python3');
  assert.match(seen[1][1][0], /start_brightdata_fastmcp_service\.py$/);
  assert.equal(seen.includes('unref'), true);
});

test('ensureBrightDataFastMcpService forces local BrightData transport flags', async () => {
  let capturedEnv = null;
  const fetchImpl = async () => {
    throw new Error('connect ECONNREFUSED');
  };
  const spawnImpl = (...args) => {
    capturedEnv = args[2]?.env || null;
    return {
      unref() {},
    };
  };

  await ensureBrightDataFastMcpService({
    fetchImpl,
    spawnImpl,
    serviceUrl: 'http://127.0.0.1:8000/mcp',
    healthUrl: 'http://127.0.0.1:8000/health',
  });

  assert.equal(capturedEnv.BRIGHTDATA_MCP_USE_HOSTED, 'false');
  assert.equal(capturedEnv.BRIGHTDATA_MCP_HOSTED_URL, '');
});

test('extractFinalCliJson parses fenced JSON embedded in prose', () => {
  const parsed = extractFinalCliJson([
    '{"type":"text","part":{"text":"I found the answer.\\n\\n```json\\n{\\n  \\"answer\\": \\"1886\\",\\n  \\"confidence\\": 0.98,\\n  \\"validation_state\\": \\"validated\\"\\n}\\n```"}}',
  ].join('\n'));

  assert.equal(parsed.answer, '1886');
  assert.equal(parsed.confidence, 0.98);
  assert.equal(parsed.validation_state, 'validated');
});

test('buildQuestionState applies explicit budget and threshold overrides', () => {
  const question = {
    ...buildMajorLeagueCricketPresetQuestions()[0],
    evidence_extension_confidence_threshold: 0.91,
  };
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
  assert.equal(state.evidence_extension_confidence_threshold, 0.91);
  assert.equal(state.run_id, 'test-run');
  assert.equal(state.last_run_at, '2026-03-27T00:00:00.000Z');
});

test('buildQuestionState does not inject unrelated aliases across entities', () => {
  const state = buildQuestionState({
    question_id: 'q1_foundation',
    question_type: 'foundation',
    question_text: 'What year was Arsenal Football Club founded?',
    query: 'Arsenal Football Club founded year',
    entity_name: 'Arsenal Football Club',
    entity_id: 'arsenal_fc',
    source_priority: ['google_serp', 'official_site', 'wikipedia'],
    hop_budget: 1,
  });

  assert.deepEqual(state.aliases, [
    'Arsenal Football Club',
    'arsenal_fc',
    'What year was Arsenal Football Club founded?',
  ]);
  assert.equal(state.aliases.includes('MLC'), false);
  assert.equal(state.aliases.includes('ACE'), false);
  assert.equal(state.aliases.includes('Major League Cricket'), false);
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

test('runOpenCodeQuestionSourceBatch writes the canonical question_first_run artifact', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-question-source-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  const seenWorktreeRoots = [];

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'major-league-cricket',
        entity_name: 'Major League Cricket',
        entity_type: 'SPORT_LEAGUE',
        preset: 'major-league-cricket',
        questions: [
          {
            question_id: 'q1',
            question_type: 'foundation',
            question: 'When was {entity} founded?',
            query: '"Major League Cricket" founded',
            hop_budget: 1,
            source_priority: ['google_serp', 'official_site'],
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async (question, options = {}) => {
        seenWorktreeRoots.push(options.worktreeRoot);
        return {
        structuredOutput: {
          answer: '2023',
          signal_type: 'FOUNDATION',
          confidence: 0.91,
          validation_state: 'validated',
          evidence_url: 'https://example.com',
          recommended_next_query: '',
          notes: 'stubbed',
          sources: ['https://example.com'],
        },
        promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"2023"}', stderr: '' },
        };
      },
    });

    assert.ok(result.question_first_run_path);
    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    assert.equal(artifact.schema_version, 'question_first_run_v1');
    assert.equal(artifact.questions.length, 1);
    assert.equal(artifact.answers.length, 1);
    assert.equal(artifact.questions[0].question_text, 'When was Major League Cricket founded?');
    assert.equal(artifact.questions[0].question, 'When was Major League Cricket founded?');
    assert.equal(artifact.merge_patch.question_first.schema_version, 'question_first_run_v1');
    assert.equal(artifact.merge_patch.questions[0].question_first_answer.answer, '2023');
    assert.equal(seenWorktreeRoots[0], '/Users/kieranmcfarlane/Downloads/panther_chat/.worktrees/opencode-question-first-ssot');
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch writes an initial checkpoint before the first question completes', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-question-source-checkpoint-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        schema_version: 'atomic_question_source_v1',
        entity_id: 'arsenal-fc',
        entity_name: 'Arsenal Football Club',
        entity_type: 'SPORT_CLUB',
        preset: 'arsenal-atomic-matrix',
        question_source_label: 'arsenal-atomic-matrix',
        question_shape: 'atomic',
        pack_role: 'discovery',
        pack_stage: 'atomic_matrix',
        question_count: 1,
        questions: [
          {
            question_id: 'q1_foundation',
            question_type: 'foundation',
            question: 'What year was {entity} founded?',
            query: '"Arsenal Football Club" founded year',
            hop_budget: 8,
            evidence_extension_budget: 1,
            evidence_extension_confidence_threshold: 0.65,
            question_timeout_ms: 180000,
            hop_timeout_ms: 180000,
            source_priority: ['google_serp', 'official_site', 'wikipedia'],
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  let resolveFirstQuestion;
  let firstQuestionSeen = false;
  const questionRunner = async () => {
    firstQuestionSeen = true;
    return await new Promise((resolve) => {
      resolveFirstQuestion = resolve;
    });
  };

  try {
    const runPromise = runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner,
    });

    const statePath = join(outputDir, 'arsenal-fc_arsenal-atomic-matrix_state.json');
    for (let index = 0; index < 40; index += 1) {
      if (existsSync(statePath)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    assert.equal(firstQuestionSeen, true);
    assert.equal(existsSync(statePath), true);

    const checkpoint = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.equal(checkpoint.run_phase, 'question_runner_enter');
    assert.equal(checkpoint.active_question_index, 0);
    assert.equal(checkpoint.active_question_id, 'q1_foundation');
    assert.equal(checkpoint.active_query, '"Arsenal Football Club" founded year');

    resolveFirstQuestion({
      structuredOutput: {
        answer: '',
        confidence: 0,
        validation_state: 'no_signal',
        sources: [],
      },
      promptTrace: {
        exit_code: 0,
        stdout_length: 0,
        stderr_length: 0,
        has_structured_output: true,
      },
      messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
      cliResult: { code: 0, stdout: '{"answer":""}', stderr: '' },
    });

    const result = await runPromise;
    assert.equal(result.questions_total, 1);
    assert.equal(result.questions_no_signal, 1);
    assert.equal(result.questions_validated, 0);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch records question runner entry and return checkpoints', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-question-source-trace-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        schema_version: 'atomic_question_source_v1',
        entity_id: 'arsenal-fc',
        entity_name: 'Arsenal Football Club',
        entity_type: 'SPORT_CLUB',
        preset: 'arsenal-atomic-matrix',
        question_source_label: 'arsenal-atomic-matrix',
        question_shape: 'atomic',
        pack_role: 'discovery',
        pack_stage: 'atomic_matrix',
        question_count: 1,
        questions: [
          {
            question_id: 'q1_foundation',
            question_type: 'foundation',
            question: 'What year was {entity} founded?',
            query: '"Arsenal Football Club" founded year',
            hop_budget: 8,
            evidence_extension_budget: 1,
            evidence_extension_confidence_threshold: 0.65,
            question_timeout_ms: 180000,
            hop_timeout_ms: 180000,
            source_priority: ['google_serp', 'official_site', 'wikipedia'],
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  let resolveFirstQuestion;
  const questionRunner = async () => {
    return await new Promise((resolve) => {
      resolveFirstQuestion = resolve;
    });
  };

  try {
    const runPromise = runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner,
    });

    const statePath = join(outputDir, 'arsenal-fc_arsenal-atomic-matrix_state.json');
    for (let index = 0; index < 40; index += 1) {
      if (existsSync(statePath)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const checkpoint = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.equal(checkpoint.run_phase, 'question_runner_enter');
    assert.equal(checkpoint.active_question_id, 'q1_foundation');

    resolveFirstQuestion({
      structuredOutput: {
        answer: '',
        confidence: 0,
        validation_state: 'no_signal',
        sources: [],
      },
      promptTrace: {
        exit_code: 0,
        stdout_length: 0,
        stderr_length: 0,
        has_structured_output: true,
      },
      messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
      cliResult: { code: 0, stdout: '{"answer":""}', stderr: '' },
    });

    const result = await runPromise;
    assert.equal(result.questions_total, 1);
    assert.equal(result.questions_no_signal, 1);

    const finalState = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.equal(finalState.run_phase, 'completed');
    assert.equal(finalState.active_question_id, '');
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch settles a question when the runner does not return', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-question-source-timeout-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        schema_version: 'atomic_question_source_v1',
        entity_id: 'arsenal-fc',
        entity_name: 'Arsenal Football Club',
        entity_type: 'SPORT_CLUB',
        preset: 'arsenal-atomic-matrix',
        question_source_label: 'arsenal-atomic-matrix',
        question_shape: 'atomic',
        pack_role: 'discovery',
        pack_stage: 'atomic_matrix',
        question_count: 1,
        questions: [
          {
            question_id: 'q1_foundation',
            question_type: 'foundation',
            question: 'What year was {entity} founded?',
            query: '"Arsenal Football Club" founded year',
            hop_budget: 8,
            evidence_extension_budget: 1,
            evidence_extension_confidence_threshold: 0.65,
            question_timeout_ms: 180000,
            hop_timeout_ms: 180000,
            source_priority: ['google_serp', 'official_site', 'wikipedia'],
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const questionRunner = async () => new Promise(() => {});

  try {
    const runPromise = runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      opencodeTimeoutMs: 50,
      questionRunner,
    });

    const result = await runPromise;
    assert.equal(result.questions_total, 1);
    assert.equal(result.questions_no_signal, 1);
    assert.equal(result.questions_validated, 0);

    const statePath = join(outputDir, 'arsenal-fc_arsenal-atomic-matrix_state.json');
    const checkpoint = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.equal(checkpoint.run_phase, 'completed');
    assert.equal(checkpoint.questions[0].status, 'no_signal');
    assert.equal(checkpoint.questions[0].current_confidence, 0);
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

test('runOpenCodePresetBatch stops after the base hop budget when no evidence appears', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-no-evidence-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  const runs = [];

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      questionsOverride: [
        {
          entity_name: 'Test Entity',
          entity_id: 'test-entity',
          entity_type: 'ENTITY',
          preset: 'test-entity',
          pack_role: 'discovery',
          question_shape: 'atomic',
          question_id: 'q_no_evidence',
          question_type: 'procurement',
          question_text: 'Is there evidence of a platform replacement?',
          query: '"Test Entity" platform replacement',
          hop_budget: 2,
          evidence_extension_budget: 2,
          question_timeout_ms: 5000,
          source_priority: ['google_serp', 'official_site'],
          yp_service_fit: [],
        },
      ],
      questionRunner: async (question) => {
        runs.push(question.query);
        return {
          structuredOutput: {
            answer: '',
            signal_type: 'NO_SIGNAL',
            confidence: 0.0,
            validation_state: 'no_signal',
            evidence_url: '',
            recommended_next_query: '',
            notes: 'stubbed',
            sources: [],
          },
          promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":""}', stderr: '' },
        };
      },
    });

    assert.equal(result.questions_total, 1);
    assert.equal(runs.length, 2);
    assert.deepEqual(runs, ['"Test Entity" platform replacement', '"Test Entity" platform replacement']);
    const state = JSON.parse(readFileSync(result.state_path, 'utf8'));
    assert.equal(state.questions[0].run_history.length, 2);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodePresetBatch extends when evidence appears', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-evidence-extension-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  const runs = [];

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      questionsOverride: [
        {
          entity_name: 'Test Entity',
          entity_id: 'test-entity',
          entity_type: 'ENTITY',
          preset: 'test-entity',
          pack_role: 'discovery',
          question_shape: 'atomic',
          question_id: 'q_evidence_extension',
          question_type: 'foundation',
          question_text: 'When was Test Entity founded?',
          query: '"Test Entity" founded',
          hop_budget: 1,
          evidence_extension_budget: 1,
          question_timeout_ms: 5000,
          source_priority: ['google_serp', 'official_site', 'wikipedia'],
          yp_service_fit: [],
        },
      ],
      questionRunner: async (question) => {
        runs.push(question.query);
        const hopCount = runs.length;
        return {
          structuredOutput: {
            answer: hopCount === 1 ? '1886' : '1887',
            signal_type: 'FOUNDATION',
            confidence: 0.95,
            validation_state: 'validated',
            evidence_url: 'https://example.com/history',
            recommended_next_query: hopCount === 1 ? 'Test Entity founding evidence' : '',
            notes: 'stubbed',
            sources: ['https://example.com/history'],
          },
          promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"1886"}', stderr: '' },
        };
      },
    });

    assert.equal(result.questions_total, 1);
    assert.equal(runs.length, 2);
    assert.deepEqual(runs, ['"Test Entity" founded', 'Test Entity founding evidence']);
    const state = JSON.parse(readFileSync(result.state_path, 'utf8'));
    assert.equal(state.questions[0].status, 'validated');
    assert.equal(state.questions[0].run_history.length, 2);
    assert.equal(state.questions[0].frontier.some((item) => item.query === 'Test Entity founding evidence'), true);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodePresetBatch does not extend when evidence confidence is below threshold', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-weak-evidence-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  const runs = [];

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      questionsOverride: [
        {
          entity_name: 'Test Entity',
          entity_id: 'test-entity',
          entity_type: 'ENTITY',
          preset: 'test-entity',
          pack_role: 'discovery',
          question_shape: 'atomic',
          question_id: 'q_weak_evidence',
          question_type: 'foundation',
          question_text: 'When was Test Entity founded?',
          query: '"Test Entity" founded',
          hop_budget: 1,
          evidence_extension_budget: 1,
          evidence_extension_confidence_threshold: 0.65,
          question_timeout_ms: 5000,
          source_priority: ['google_serp', 'official_site', 'wikipedia'],
          yp_service_fit: [],
        },
      ],
      questionRunner: async (question) => {
        runs.push(question.query);
        return {
          structuredOutput: {
            answer: '1886',
            signal_type: 'FOUNDATION',
            confidence: 0.64,
            validation_state: 'validated',
            evidence_url: 'https://example.com/history',
            recommended_next_query: 'Test Entity founding evidence',
            notes: 'stubbed',
            sources: ['https://example.com/history'],
          },
          promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"1886"}', stderr: '' },
        };
      },
    });

    assert.equal(result.questions_total, 1);
    assert.equal(runs.length, 1);
    const state = JSON.parse(readFileSync(result.state_path, 'utf8'));
    assert.equal(state.questions[0].status, 'validated');
    assert.equal(state.questions[0].run_history.length, 1);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});


test('runOpenCodePresetBatch treats string high confidence as validated', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-high-confidence-'));
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
            signal_type: 'FOUNDATION',
            confidence: 'high',
            evidence_url: 'https://example.com/evidence',
            sources: ['https://example.com/evidence'],
            notes: 'stubbed',
          },
          promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
        };
      },
    });

    const meta = JSON.parse(readFileSync(result.meta_result_path, 'utf8'));
    assert.equal(result.questions_total, 2);
    assert.deepEqual(questionRuns, ['entity_founded_year', 'sl_league_mobile_app']);
    assert.equal(result.questions_validated, 2);
    assert.equal(meta.questions[0].validation_state, 'validated');
    assert.equal(meta.questions[1].validation_state, 'validated');
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
