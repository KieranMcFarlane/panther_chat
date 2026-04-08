import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  runDeterministicToolQuestion,
  runOpenCodeQuestionSourceBatch,
  runOpenCodePresetBatch,
} from '../scripts/opencode_agentic_batch.mjs';
import {
  lookupApifyTechStack,
} from '../scripts/apify_techstack_lookup.mjs';

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

  assert.equal(records.length, 8);
  assert.deepEqual(
    records.map((record) => record.question_type),
    ['foundation', 'procurement', 'poi', 'related_pois', 'poi', 'poi', 'poi', 'poi'],
  );
  assert.equal(records[0].question_id, 'entity_founded_year');
  assert.equal(records[1].question_id, 'sl_league_mobile_app');
  assert.equal(records[2].question_id, 'poi_commercial_partnerships_lead');
  assert.equal(records[7].question_id, 'poi_operations_lead');
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

  assert.equal(records.length, 6);
  assert.deepEqual(
    records.map((record) => record.question_id),
    [
      'poi_commercial_partnerships_lead',
      'poi_related_pois',
      'poi_digital_product_lead',
      'poi_fan_engagement_lead',
      'poi_marketing_comms_lead',
      'poi_operations_lead',
    ],
  );
  assert.deepEqual(
    records[0].source_priority,
    [
      'linkedin_company_profile',
      'linkedin_people_search',
      'linkedin_person_profile',
      'google_serp',
      'official_site',
    ],
  );
  assert.equal(records[0].query, '"Major League Cricket" LinkedIn company profile');
  assert.equal(records[0].search_strategy.search_queries[0], '"Major League Cricket" LinkedIn company profile');
  assert.ok(records[0].search_strategy.search_queries.includes('"Major League Cricket" LinkedIn commercial'));
  assert.ok(records[0].search_strategy.search_queries.includes('"Major League Cricket" chief commercial officer'));
});

test('buildMajorLeagueCricketPoiBatchAQuestions returns the first POI sub-bundle', () => {
  const records = buildMajorLeagueCricketPoiBatchAQuestions();

  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((record) => record.question_id),
    [
      'poi_commercial_partnerships_lead',
      'poi_related_pois',
    ],
  );
});

test('buildMajorLeagueCricketPoiBatchBQuestions returns the second POI sub-bundle', () => {
  const records = buildMajorLeagueCricketPoiBatchBQuestions();

  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((record) => record.question_id),
    [
      'poi_digital_product_lead',
      'poi_fan_engagement_lead',
    ],
  );
});

test('buildMajorLeagueCricketPoiBatchCQuestions returns the third POI sub-bundle', () => {
  const records = buildMajorLeagueCricketPoiBatchCQuestions();

  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((record) => record.question_id),
    ['poi_marketing_comms_lead', 'poi_operations_lead'],
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

test('buildOpenCodeQuestionPrompt specializes tender-doc questions', () => {
  const prompt = buildOpenCodeQuestionPrompt({
    question_text: 'Are there explicit tender documents or RFPs for digital or broadcast procurement at International Canoe Federation?',
    question_type: 'tender_docs',
    source_priority: ['official_site', 'google_serp', 'press_release', 'news'],
    hop_budget: 2,
    query: '"International Canoe Federation" tenders',
    search_strategy: {
      search_queries: [
        '"International Canoe Federation" tenders',
        '"International Canoe Federation" Paddle Worldwide digital ecosystem',
        '"International Canoe Federation" OTT platform',
        'site:canoeicf.com paddleworldwide_dxp_rfp.pdf',
        'site:canoeicf.com ott platform 2026 pdf',
        'site:canoeicf.com tenders',
      ],
    },
    yp_service_fit: [],
  });

  assert.match(prompt, /Are there explicit tender documents or RFPs for digital or broadcast procurement at International Canoe Federation\?/i);
  assert.match(prompt, /Start with official tender pages, PDF attachments, and official-site search results before broader web search\./i);
  assert.match(prompt, /Return exactly one fenced JSON code block with answer, confidence, sources, and validation_state\./i);
  assert.match(prompt, /The answer should name the active tender, RFP, or procurement document if one exists\./i);
  assert.match(prompt, /validation_state "no_signal"/i);
});

test('runOpenCodeQuestionSourceBatch stops after the first validated digital-stack fallback answer', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-digital-stack-stop-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        schema_version: 'atomic_question_source_v1',
        entity_id: 'arsenal-fc',
        entity_name: 'Arsenal Football Club',
        entity_type: 'SPORT_CLUB',
        preset: 'arsenal-digital-stack',
        question_source_label: 'arsenal-digital-stack',
        question_shape: 'atomic',
        pack_role: 'discovery',
        pack_stage: 'atomic_matrix',
        question_count: 1,
        questions: [
          {
            question_id: 'q2_digital_stack',
            question_family: 'digital_stack',
            question_type: 'digital_stack',
            question: 'What visible technologies, platforms, or vendors does Arsenal Football Club use?',
            query: '"Arsenal Football Club" technology stack',
            hop_budget: 3,
            evidence_extension_budget: 0,
            evidence_extension_confidence_threshold: 0.65,
            question_timeout_ms: 180000,
            hop_timeout_ms: 180000,
            source_priority: ['google_serp', 'news', 'press_release', 'official_site'],
            deterministic_tools: [],
            fallback_to_retrieval: true,
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  let questionRunnerCalls = 0;
  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      deterministicToolRunner: async () => null,
      questionRunner: async () => {
        questionRunnerCalls += 1;
        if (questionRunnerCalls > 1) {
          throw new Error('questionRunner should stop after the first validated fallback answer');
        }
        return {
          structuredOutput: {
            answer: 'Ticketmaster',
            technologies: [{ name: 'React', confidence: 85 }],
            categories: ['Frontend'],
            vendors: ['Ticketmaster'],
            confidence: 0.9,
            validation_state: 'validated',
            sources: ['https://www.arsenal.com'],
            evidence_url: 'https://www.arsenal.com',
            signal_type: 'DIGITAL_STACK',
          },
          promptTrace: {
            status: 'validated',
            has_structured_output: true,
          },
          messageTrace: [],
          cliResult: {
            code: 0,
            stdout: '',
            stderr: '',
          },
        };
      },
    });

    assert.equal(questionRunnerCalls, 1);
    const questionPath = result.question_result_paths[0];
    const question = JSON.parse(readFileSync(questionPath, 'utf8')).question;
    assert.equal(question.validation_state, 'validated');
    assert.equal(question.answer, 'Ticketmaster');
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch writes contract-backed question timings into question_first_run_v2', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-question-timings-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        schema_version: 'atomic_question_source_v1',
        entity_id: 'arsenal-fc',
        entity_name: 'Arsenal Football Club',
        entity_type: 'SPORT_CLUB',
        preset: 'arsenal-timing-check',
        question_source_label: 'arsenal-timing-check',
        question_shape: 'atomic',
        pack_role: 'discovery',
        pack_stage: 'atomic_matrix',
        question_count: 1,
        questions: [
          {
            question_id: 'q1_foundation',
            question_family: 'foundation',
            question_type: 'foundation',
            question: 'When was {entity} founded?',
            query: '"Arsenal Football Club" founded',
            hop_budget: 1,
            evidence_extension_budget: 0,
            evidence_extension_confidence_threshold: 0.65,
            question_timeout_ms: 180000,
            hop_timeout_ms: 180000,
            source_priority: ['google_serp', 'official_site', 'wikipedia'],
            fallback_to_retrieval: false,
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
      deterministicToolRunner: async () => null,
      questionRunner: async () => ({
        structuredOutput: {
          answer: '1886',
          confidence: 0.96,
          validation_state: 'validated',
          sources: ['https://www.arsenal.com/'],
        },
        promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"1886"}', stderr: '' },
      }),
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    assert.ok(artifact.question_timings);
    assert.ok(artifact.question_timings.q1_foundation);
    assert.equal(typeof artifact.question_timings.q1_foundation.started_at, 'string');
    assert.equal(typeof artifact.question_timings.q1_foundation.completed_at, 'string');
    assert.equal(typeof artifact.question_timings.q1_foundation.duration_seconds, 'number');
    assert.equal(artifact.question_timings.q1_foundation.duration_seconds >= 0, true);
    assert.equal(artifact.answer_records[0].started_at, artifact.question_timings.q1_foundation.started_at);
    assert.equal(artifact.answer_records[0].completed_at, artifact.question_timings.q1_foundation.completed_at);
    assert.equal(artifact.answer_records[0].duration_seconds, artifact.question_timings.q1_foundation.duration_seconds);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch retries transient upstream runner failures before succeeding', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-retryable-upstream-success-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  const previousRetryAttempts = process.env.OPENCODE_TRANSIENT_RETRY_ATTEMPTS;
  const previousRetryDelayMs = process.env.OPENCODE_TRANSIENT_RETRY_DELAY_MS;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  process.env.OPENCODE_TRANSIENT_RETRY_ATTEMPTS = '2';
  process.env.OPENCODE_TRANSIENT_RETRY_DELAY_MS = '1';

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        schema_version: 'atomic_question_source_v1',
        entity_id: 'arsenal-fc',
        entity_name: 'Arsenal Football Club',
        entity_type: 'SPORT_CLUB',
        preset: 'arsenal-retry-success',
        question_source_label: 'arsenal-retry-success',
        question_shape: 'atomic',
        pack_role: 'discovery',
        pack_stage: 'atomic_matrix',
        question_count: 1,
        questions: [
          {
            question_id: 'q1_foundation',
            question_family: 'foundation',
            question_type: 'foundation',
            question: 'When was {entity} founded?',
            query: '"Arsenal Football Club" founded',
            hop_budget: 1,
            evidence_extension_budget: 0,
            evidence_extension_confidence_threshold: 0.65,
            question_timeout_ms: 180000,
            hop_timeout_ms: 180000,
            source_priority: ['google_serp', 'official_site', 'wikipedia'],
            fallback_to_retrieval: true,
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  let attempts = 0;
  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      deterministicToolRunner: async () => null,
      questionRunner: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('Too Many Requests');
        }
        return {
          structuredOutput: {
            answer: '1886',
            confidence: 0.96,
            validation_state: 'validated',
            sources: ['https://www.arsenal.com/'],
          },
          promptTrace: { status: 'ok', has_structured_output: true },
          messageTrace: [],
          cliResult: { code: 0, stdout: '{"answer":"1886"}', stderr: '' },
        };
      },
    });

    assert.equal(attempts, 2);
    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    assert.equal(artifact.answer_records[0].answer.value, '1886');
  } finally {
    if (previousRetryAttempts === undefined) {
      delete process.env.OPENCODE_TRANSIENT_RETRY_ATTEMPTS;
    } else {
      process.env.OPENCODE_TRANSIENT_RETRY_ATTEMPTS = previousRetryAttempts;
    }
    if (previousRetryDelayMs === undefined) {
      delete process.env.OPENCODE_TRANSIENT_RETRY_DELAY_MS;
    } else {
      process.env.OPENCODE_TRANSIENT_RETRY_DELAY_MS = previousRetryDelayMs;
    }
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch surfaces exhausted transient upstream failures distinctly', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-retryable-upstream-failed-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  const previousRetryAttempts = process.env.OPENCODE_TRANSIENT_RETRY_ATTEMPTS;
  const previousRetryDelayMs = process.env.OPENCODE_TRANSIENT_RETRY_DELAY_MS;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  process.env.OPENCODE_TRANSIENT_RETRY_ATTEMPTS = '2';
  process.env.OPENCODE_TRANSIENT_RETRY_DELAY_MS = '1';

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        schema_version: 'atomic_question_source_v1',
        entity_id: 'arsenal-fc',
        entity_name: 'Arsenal Football Club',
        entity_type: 'SPORT_CLUB',
        preset: 'arsenal-retry-failure',
        question_source_label: 'arsenal-retry-failure',
        question_shape: 'atomic',
        pack_role: 'discovery',
        pack_stage: 'atomic_matrix',
        question_count: 1,
        questions: [
          {
            question_id: 'q1_foundation',
            question_family: 'foundation',
            question_type: 'foundation',
            question: 'When was {entity} founded?',
            query: '"Arsenal Football Club" founded',
            hop_budget: 1,
            evidence_extension_budget: 0,
            evidence_extension_confidence_threshold: 0.65,
            question_timeout_ms: 180000,
            hop_timeout_ms: 180000,
            source_priority: ['google_serp', 'official_site', 'wikipedia'],
            fallback_to_retrieval: true,
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  let attempts = 0;
  try {
    await assert.rejects(
      () =>
        runOpenCodeQuestionSourceBatch({
          questionSourcePath: sourcePath,
          outputDir,
          deterministicToolRunner: async () => null,
          questionRunner: async () => {
            attempts += 1;
            throw new Error('too_many_requests');
          },
        }),
      /retryable_upstream_failure/i,
    );
    assert.equal(attempts, 2);
  } finally {
    if (previousRetryAttempts === undefined) {
      delete process.env.OPENCODE_TRANSIENT_RETRY_ATTEMPTS;
    } else {
      process.env.OPENCODE_TRANSIENT_RETRY_ATTEMPTS = previousRetryAttempts;
    }
    if (previousRetryDelayMs === undefined) {
      delete process.env.OPENCODE_TRANSIENT_RETRY_DELAY_MS;
    } else {
      process.env.OPENCODE_TRANSIENT_RETRY_DELAY_MS = previousRetryDelayMs;
    }
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('buildOpenCodeQuestionPrompt specializes decision-owner and related-pois outputs', () => {
  const decisionPrompt = buildOpenCodeQuestionPrompt({
    question_text: 'Who is the most suitable person for commercial partnerships or business development at Major League Cricket?',
    question_type: 'decision_owner',
    source_priority: ['linkedin_company_profile', 'linkedin_people_search', 'linkedin_person_profile', 'google_serp', 'official_site'],
    hop_budget: 2,
    query: '"Major League Cricket" LinkedIn company profile',
    search_strategy: {
      search_queries: [
        '"Major League Cricket" LinkedIn company profile',
        '"Major League Cricket" LinkedIn commercial',
        '"Major League Cricket" chief commercial officer',
      ],
    },
  });

  assert.match(decisionPrompt, /primary_owner/i);
  assert.match(decisionPrompt, /supporting_candidates/i);
  assert.match(decisionPrompt, /primary owner/i);

  const relatedPrompt = buildOpenCodeQuestionPrompt({
    question_text: 'Which 3 to 5 people are the most relevant commercial, partnerships, or business development contacts at Major League Cricket?',
    question_type: 'related_pois',
    source_priority: ['linkedin_company_profile', 'linkedin_people_search', 'linkedin_person_profile', 'google_serp', 'official_site'],
    hop_budget: 2,
    query: '"Major League Cricket" LinkedIn company profile',
    search_strategy: {
      search_queries: [
        '"Major League Cricket" LinkedIn company profile',
        '"Major League Cricket" LinkedIn partnerships',
        '"Major League Cricket" managing director',
      ],
    },
  });

  assert.match(relatedPrompt, /3 to 5 people/i);
  assert.match(relatedPrompt, /candidates/i);
  assert.match(relatedPrompt, /ranked list/i);
});

test('runOpenCodeQuestionSourceBatch preserves decision-owner primary owner and supporting candidates', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-decision-owner-'));
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
            question_id: 'q4_decision_owner',
            question_family: 'decision_owner',
            question_type: 'decision_owner',
            question: 'Who is the most suitable person for commercial partnerships or business development at {entity}?',
            query: '"Arsenal Football Club" LinkedIn company profile',
            hop_budget: 1,
            evidence_extension_budget: 2,
            evidence_extension_confidence_threshold: 0.65,
            question_timeout_ms: 180000,
            hop_timeout_ms: 180000,
            source_priority: ['linkedin_company_profile', 'linkedin_people_search', 'linkedin_person_profile', 'google_serp', 'official_site'],
            search_strategy: {
              search_queries: [
                '"Arsenal Football Club" LinkedIn company profile',
                '"Arsenal Football Club" LinkedIn commercial',
                '"Arsenal Football Club" chief commercial officer',
              ],
            },
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
      questionRunner: async () => ({
        structuredOutput: {
          answer: '',
          primary_owner: {
            name: 'Juliet Slot',
            title: 'Chief Commercial Officer',
            company: 'Arsenal Football Club',
          },
          supporting_candidates: [
            { name: 'Tom Fox', title: 'Commercial Director', company: 'Arsenal Football Club' },
            { name: 'Richard Garlick', title: 'Managing Director', company: 'Arsenal Football Club' },
          ],
          confidence: 0.95,
          validation_state: 'validated',
          sources: ['https://www.arsenal.com/'],
        },
        promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":""}', stderr: '' },
      }),
    });

    const questionPath = result.question_result_paths[0];
    const question = JSON.parse(readFileSync(questionPath, 'utf8')).question;
    assert.equal(question.validation_state, 'validated');
    assert.equal(question.answer, 'Juliet Slot');
    assert.equal(question.primary_owner.name, 'Juliet Slot');
    assert.equal(question.supporting_candidates.length, 2);
    assert.equal(question.supporting_candidates[0].name, 'Tom Fox');
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch normalizes string decision-owner candidates', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-decision-owner-strings-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        schema_version: 'atomic_question_source_v1',
        entity_id: 'major-league-cricket',
        entity_name: 'Major League Cricket',
        entity_type: 'SPORT_LEAGUE',
        preset: 'major-league-cricket-atomic-matrix',
        question_source_label: 'major-league-cricket-atomic-matrix',
        question_shape: 'atomic',
        pack_role: 'discovery',
        pack_stage: 'atomic_matrix',
        question_count: 1,
        questions: [
          {
            question_id: 'q4_decision_owner',
            question_type: 'decision_owner',
            question: 'Who is the most suitable person for commercial partnerships or business development at {entity}?',
            query: '"Major League Cricket" LinkedIn company profile',
            hop_budget: 8,
            evidence_extension_budget: 1,
            evidence_extension_confidence_threshold: 0.65,
            question_timeout_ms: 180000,
            hop_timeout_ms: 180000,
            source_priority: ['linkedin_company_profile', 'linkedin_people_search', 'linkedin_person_profile', 'google_serp', 'official_site'],
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
      questionRunner: async () => ({
        structuredOutput: {
          answer: 'Oliver Smith',
          primary_owner: 'Oliver Smith',
          supporting_candidates: ['Rushil Mehta', 'Johnny Grave'],
          confidence: 0.85,
          validation_state: 'validated',
          sources: [
            'https://www.linkedin.com/in/oliveralexsmith',
            'https://www.linkedin.com/in/rushilmehta',
          ],
        },
        promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"Oliver Smith"}', stderr: '' },
      }),
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const question = artifact.answer_records[0];
    assert.equal(question.validation_state, 'validated');
    assert.equal(question.primary_owner.name, 'Oliver Smith');
    assert.deepEqual(
      question.supporting_candidates.map((candidate) => candidate.name),
      ['Rushil Mehta', 'Johnny Grave'],
    );
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch derives related-pois from a validated decision-owner result before search', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-related-pois-derived-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  const seenQuestions = [];

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
        question_count: 2,
        questions: [
          {
            question_id: 'q4_decision_owner',
            question_type: 'decision_owner',
            question: 'Who is the most suitable person for commercial partnerships or business development at {entity}?',
            query: '"Arsenal Football Club" LinkedIn company profile',
            hop_budget: 8,
            evidence_extension_budget: 1,
            evidence_extension_confidence_threshold: 0.65,
            question_timeout_ms: 180000,
            hop_timeout_ms: 180000,
            source_priority: ['linkedin_company_profile', 'linkedin_people_search', 'linkedin_person_profile', 'google_serp', 'official_site'],
          },
          {
            question_id: 'q5_related_pois',
            question_type: 'related_pois',
            question: 'Which 3 to 5 people are the most relevant commercial, partnerships, or business development contacts at {entity}?',
            query: '"Arsenal Football Club" LinkedIn company profile',
            hop_budget: 8,
            evidence_extension_budget: 1,
            evidence_extension_confidence_threshold: 0.65,
            question_timeout_ms: 180000,
            hop_timeout_ms: 180000,
            source_priority: ['linkedin_company_profile', 'linkedin_people_search', 'linkedin_person_profile', 'google_serp', 'official_site'],
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
      questionRunner: async (question) => {
        seenQuestions.push(question.question_id);
        if (question.question_id === 'q4_decision_owner') {
          return {
            structuredOutput: {
              answer: 'Juliet Slot',
              primary_owner: {
                name: 'Juliet Slot',
                title: 'Chief Commercial Officer',
                organization: 'Arsenal Football Club',
              },
              supporting_candidates: [
                { name: 'Omar Shaikh', title: 'Director, Global Partnerships & Ventures' },
                { name: 'Stuart Milne', title: 'Head of Partnerships' },
                { name: 'Andrew Sheridan', title: 'Head of Commercial Ventures' },
              ],
              confidence: 0.95,
              validation_state: 'validated',
              sources: ['https://uk.linkedin.com/in/juliet-slot-0a823b4'],
            },
            promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
            messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
            cliResult: { code: 0, stdout: '{"answer":"Juliet Slot"}', stderr: '' },
          };
        }
        throw new Error(`unexpected runner call for ${question.question_id}`);
      },
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const relatedPois = artifact.answer_records.find((question) => question.question_id === 'q5_related_pois');
    assert.deepEqual(seenQuestions, ['q4_decision_owner']);
    assert.equal(relatedPois.validation_state, 'validated');
    assert.deepEqual(
      relatedPois.candidates.map((candidate) => candidate.name),
      ['Juliet Slot', 'Omar Shaikh', 'Stuart Milne', 'Andrew Sheridan'],
    );
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch preserves nuanced foundation validation instead of overwriting it on a later timeout', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-foundation-nuance-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  let calls = 0;

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        schema_version: 'atomic_question_source_v1',
        entity_id: 'major-league-cricket',
        entity_name: 'Major League Cricket',
        entity_type: 'SPORT_LEAGUE',
        preset: 'major-league-cricket-atomic-matrix',
        question_source_label: 'major-league-cricket-atomic-matrix',
        question_shape: 'atomic',
        pack_role: 'discovery',
        pack_stage: 'atomic_matrix',
        question_count: 1,
        questions: [
          {
            question_id: 'q1_foundation',
            question_type: 'foundation',
            question: 'What year was {entity} founded?',
            query: '"Major League Cricket" official website founded year',
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

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async () => {
        calls += 1;
        if (calls > 1) {
          throw new Error('foundation should have stopped after nuanced validation');
        }
        return {
          structuredOutput: {
            answer: '2019',
            confidence: 0.85,
            validation_state: 'validated_with_nuance',
            sources: ['https://en.wikipedia.org/wiki/Major_League_Cricket'],
          },
          promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"2019"}', stderr: '' },
        };
      },
    });

    assert.equal(result.questions_validated, 1);
    assert.equal(result.questions_no_signal, 0);
    assert.equal(calls, 1);
    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    assert.equal(artifact.answer_records[0].validation_state, 'validated');
    assert.equal(artifact.answer_records[0].answer.value, '2019');
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('lookupApifyTechStack uses the documented Apify sync endpoint and token', async () => {
  const calls = [];
  const result = await lookupApifyTechStack({
    url: 'https://www.arsenal.com',
    token: 'test-apify-token',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return {
        ok: true,
        status: 201,
        async json() {
          return [
            {
              url: 'https://www.arsenal.com',
              technologies: [
                {
                  name: 'Salesforce',
                  confidence: 100,
                  categories: ['CRM'],
                },
              ],
            },
          ];
        },
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/api\.apify\.com\/v2\/acts\/magicfingers~techstack-detector\/run-sync-get-dataset-items\?/);
  assert.match(calls[0].url, /token=test-apify-token/);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].options.body), { urls: ['https://www.arsenal.com'] });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].technologies[0].name, 'Salesforce');
  assert.deepEqual(result.results[0].categories, ['CRM']);
});

test('runDeterministicToolQuestion accepts APIFY_PERSONAL_API and APIFY_PASSWORD as token aliases', async () => {
  const previousApifyToken = process.env.APIFY_TOKEN;
  const previousApifyPassword = process.env.APIFY_PASSWORD;
  const previousApifyPersonalApi = process.env.APIFY_PERSONAL_API;
  delete process.env.APIFY_TOKEN;
  process.env.APIFY_PERSONAL_API = 'test-apify-personal-api';
  process.env.APIFY_PASSWORD = 'test-apify-password';

  try {
    const result = await runDeterministicToolQuestion(
      {
        question_type: 'digital_stack',
        deterministic_tools: ['apify_techstack'],
        fallback_to_retrieval: false,
        deterministic_input: {
          url: 'https://www.arsenal.com',
        },
      },
      {
        apifyTechStackLookup: async ({ token, url }) => {
          assert.equal(token, 'test-apify-personal-api');
          assert.equal(url, 'https://www.arsenal.com');
          return {
            results: [
              {
                url,
                technologies: [{ name: 'Salesforce', confidence: 100, categories: ['CRM'] }],
                categories: ['CRM'],
                vendors: ['Salesforce'],
              },
            ],
          };
        },
      },
    );

    assert.equal(result.structuredOutput.validation_state, 'validated');
    assert.deepEqual(result.structuredOutput.vendors, ['Salesforce']);
  } finally {
    if (previousApifyToken === undefined) {
      delete process.env.APIFY_TOKEN;
    } else {
      process.env.APIFY_TOKEN = previousApifyToken;
    }
    if (previousApifyPassword === undefined) {
      delete process.env.APIFY_PASSWORD;
    } else {
      process.env.APIFY_PASSWORD = previousApifyPassword;
    }
    if (previousApifyPersonalApi === undefined) {
      delete process.env.APIFY_PERSONAL_API;
    } else {
      process.env.APIFY_PERSONAL_API = previousApifyPersonalApi;
    }
  }
});

test('runDeterministicToolQuestion prefers graph-first candidate paths for q12_connections when graph context exists', async () => {
  const result = await runDeterministicToolQuestion(
    {
      question_id: 'q12_connections',
      question_type: 'connections',
      graph_context: {
        schema_version: 'connections_graph_v1',
        nodes: [
          { node_id: 'Elliott Hillman', node_type: 'yp_member', name: 'Elliott Hillman' },
          { node_id: 'person:jane-doe', node_type: 'person', name: 'Jane Doe' },
        ],
        edges: [
          { from_id: 'Elliott Hillman', to_id: 'person:jane-doe', edge_type: 'direct_connection', confidence: 72 },
        ],
      },
    },
    {
      runState: {
        questions: [
          {
            question_id: 'q11_decision_owner',
            current_confidence: 0.8,
            primary_owner: {
              name: 'Jane Doe',
              function_type: 'PARTNERSHIPS',
              seniority_level: 'director',
              decision_score: 0.8,
            },
            secondary_candidates: [],
            supporting_candidates: [],
          },
        ],
      },
    },
  );

  assert.equal(result.structuredOutput.answer, 'Jane Doe');
  assert.equal(result.structuredOutput.best_yp_owner, 'Elliott Hillman');
  assert.equal(result.structuredOutput.path_type, 'direct');
  assert.equal(result.structuredOutput.validation_state, 'deterministic_detected');
  assert.equal(result.structuredOutput.candidate_paths[0].q12_score, 0.72);
  assert.equal(result.structuredOutput.candidate_paths[0].decision_score, 0.576);
});

test('runDeterministicToolQuestion emits typed scorecards for q13 q14 and q15', async () => {
  const runState = {
    questions: [
      { question_id: 'q2_digital_stack', best_answer: 'Drupal 10, GTM' },
      { question_id: 'q6_launch_signal', best_answer: 'New fan app launched' },
      { question_id: 'q7_procurement_signal', best_answer: 'Vendor search underway' },
      { question_id: 'q9_news_signal', best_answer: 'Commercial priorities reset' },
      {
        question_id: 'q11_decision_owner',
        current_confidence: 0.8,
        primary_owner: { name: 'Jane Doe' },
      },
      {
        question_id: 'q12_connections',
        reasoning: {
          structured_output: {
            path_type: 'direct',
            q11_score: 0.8,
            q12_score: 0.72,
          },
        },
      },
    ],
  };

  const q13 = await runDeterministicToolQuestion({ question_type: 'capability_gap' }, { runState });
  assert.ok(Array.isArray(q13.structuredOutput.gap_scorecard));
  assert.equal(q13.structuredOutput.graph_episode.episode_type, 'capability_gap');

  const q14 = await runDeterministicToolQuestion(
    { question_type: 'yp_fit' },
    { runState: { questions: [...runState.questions, { question_id: 'q13_capability_gap', reasoning: { structured_output: q13.structuredOutput } }] } },
  );
  assert.ok(Array.isArray(q14.structuredOutput.fit_scorecard));
  assert.equal(q14.structuredOutput.graph_episode.episode_type, 'yp_fit');

  const q15 = await runDeterministicToolQuestion(
    { question_type: 'outreach_strategy' },
    {
      runState: {
        questions: [
          ...runState.questions,
          { question_id: 'q14_yp_fit', reasoning: { structured_output: q14.structuredOutput }, best_answer: q14.structuredOutput.answer },
        ],
      },
    },
  );
  assert.equal(q15.structuredOutput.graph_episode.episode_type, 'outreach_strategy');
  assert.equal(q15.structuredOutput.strategy_scorecard.strategy_score, 0.495);
  assert.ok(Array.isArray(q15.structuredOutput.avoidances));
});

test('runOpenCodeQuestionSourceBatch resolves deterministic Apify enrichment before search', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-digital-stack-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  const previousApifyToken = process.env.APIFY_TOKEN;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  process.env.APIFY_TOKEN = 'test-apify-token';

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        schema_version: 'atomic_question_source_v1',
        entity_id: 'arsenal-fc',
        entity_name: 'Arsenal Football Club',
        entity_type: 'SPORT_CLUB',
        preset: 'arsenal-digital-stack',
        question_source_label: 'arsenal-digital-stack',
        question_shape: 'atomic',
        pack_role: 'discovery',
        pack_stage: 'atomic_matrix',
        question_count: 1,
        questions: [
          {
            question_id: 'q2_digital_stack',
            question_family: 'digital_stack',
            question_type: 'digital_stack',
            question: 'What visible technologies, platforms, or vendors does {entity} use?',
            query: '"Arsenal Football Club" technology stack',
            hop_budget: 1,
            evidence_extension_budget: 0,
            evidence_extension_confidence_threshold: 0.65,
            question_timeout_ms: 180000,
            hop_timeout_ms: 180000,
            source_priority: ['apify_techstack', 'google_serp', 'news', 'press_release', 'official_site'],
            deterministic_tools: ['apify_techstack'],
            fallback_to_retrieval: false,
            deterministic_input: {
              url: 'https://www.arsenal.com',
            },
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
      questionRunner: async () => {
        throw new Error('questionRunner should not be called when deterministic enrichment validates');
      },
      deterministicToolRunner: async () => ({
        structuredOutput: {
          answer: 'Salesforce',
          technologies: [{ name: 'Salesforce', confidence: 100 }],
          categories: ['CRM'],
          vendors: ['Salesforce'],
          confidence: 0.95,
          validation_state: 'validated',
          sources: ['https://www.arsenal.com'],
          evidence_url: 'https://www.arsenal.com',
          signal_type: 'DIGITAL_STACK',
        },
        promptTrace: {
          status: 'deterministic_apify',
          has_structured_output: true,
        },
        messageTrace: [],
        cliResult: {
          code: 0,
          stdout: '',
          stderr: '',
        },
      }),
    });

    const questionPath = result.question_result_paths[0];
    const question = JSON.parse(readFileSync(questionPath, 'utf8')).question;
    assert.equal(question.question_type, 'digital_stack');
    assert.equal(question.validation_state, 'validated');
    assert.equal(question.answer, 'Salesforce');
    assert.deepEqual(question.reasoning.structured_output.categories, ['CRM']);
    assert.deepEqual(question.reasoning.structured_output.vendors, ['Salesforce']);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
    if (previousApifyToken === undefined) {
      delete process.env.APIFY_TOKEN;
    } else {
      process.env.APIFY_TOKEN = previousApifyToken;
    }
  }
});

test('buildOpenCodeQuestionPrompt asks digital-stack runs to return additional domains', () => {
  const prompt = buildOpenCodeQuestionPrompt({
    question_text: 'What visible technologies, platforms, or vendors does Arsenal Football Club use?',
    question_type: 'digital_stack',
    source_priority: ['apify_techstack', 'google_serp', 'news', 'press_release', 'official_site'],
    hop_budget: 2,
    query: '"Arsenal Football Club" technology stack',
    search_strategy: {
      search_queries: [
        '"Arsenal Football Club" CRM',
        '"Arsenal Football Club" ticketing platform',
        '"Arsenal Football Club" technology partner',
      ],
    },
  });

  assert.match(prompt, /additional_domains/i);
  assert.match(prompt, /digital services/i);
  assert.match(prompt, /maturity_signal/i);
  assert.match(prompt, /commercial_interpretation/i);
  assert.match(prompt, /opportunity/i);
});

test('runOpenCodeQuestionSourceBatch enriches digital-stack additional domains with Apify after search fallback', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-digital-stack-fallback-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  const previousApifyToken = process.env.APIFY_TOKEN;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';
  process.env.APIFY_TOKEN = 'test-apify-token';

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        schema_version: 'atomic_question_source_v1',
        entity_id: 'arsenal-fc',
        entity_name: 'Arsenal Football Club',
        entity_type: 'SPORT_CLUB',
        preset: 'arsenal-digital-stack',
        question_source_label: 'arsenal-digital-stack',
        question_shape: 'atomic',
        pack_role: 'discovery',
        pack_stage: 'atomic_matrix',
        question_count: 1,
        questions: [
          {
            question_id: 'q2_digital_stack',
            question_family: 'digital_stack',
            question_type: 'digital_stack',
            question: 'What visible technologies, platforms, or vendors does Arsenal Football Club use?',
            query: '"Arsenal Football Club" technology stack',
            hop_budget: 1,
            evidence_extension_budget: 0,
            evidence_extension_confidence_threshold: 0.65,
            question_timeout_ms: 180000,
            hop_timeout_ms: 180000,
            source_priority: ['apify_techstack', 'google_serp', 'news', 'press_release', 'official_site'],
            deterministic_tools: ['apify_techstack'],
            fallback_to_retrieval: true,
            deterministic_input: {
              url: 'https://www.arsenal.com',
            },
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const apifyCalls = [];
  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async () => ({
        structuredOutput: {
          answer: 'Ticketmaster',
          technologies: [{ name: 'React', confidence: 85 }],
          categories: ['Frontend'],
          vendors: ['Ticketmaster'],
          confidence: 0.9,
          validation_state: 'validated',
          sources: ['https://www.arsenal.com'],
          evidence_url: 'https://www.arsenal.com',
          signal_type: 'DIGITAL_STACK',
          additional_domains: [
            'tickets.arsenal.com',
            'https://shop.arsenal.com/store',
          ],
        },
        promptTrace: {
          status: 'validated',
          has_structured_output: true,
        },
        messageTrace: [],
        cliResult: {
          code: 0,
          stdout: '',
          stderr: '',
        },
      }),
      deterministicToolRunner: async () => null,
      apifyToken: 'test-apify-token',
      apifyTechStackLookup: async ({ url }) => {
        apifyCalls.push(url);
        if (String(url).includes('tickets.arsenal.com')) {
          return {
            results: [
              {
                url,
                technologies: [{ name: 'Ticketmaster', confidence: 90, categories: ['Ticketing'] }],
                categories: ['Ticketing'],
                vendors: ['Ticketmaster'],
              },
            ],
          };
        }
        return {
          results: [
            {
              url,
              technologies: [
                { name: 'Shopify', confidence: 100, categories: ['Ecommerce'] },
                { name: 'Stripe', confidence: 88, categories: ['Payments'] },
              ],
              categories: ['Ecommerce', 'Payments'],
              vendors: ['Shopify', 'Stripe'],
            },
          ],
        };
      },
    });

    assert.deepEqual(Array.from(new Set(apifyCalls)), [
      'https://www.arsenal.com/',
      'https://tickets.arsenal.com/',
      'https://shop.arsenal.com/store',
    ]);

    const questionPath = result.question_result_paths[0];
    const question = JSON.parse(readFileSync(questionPath, 'utf8')).question;
    assert.equal(question.question_type, 'digital_stack');
    assert.equal(question.validation_state, 'validated');
    assert.deepEqual(question.reasoning.structured_output.additional_domains, [
      'https://tickets.arsenal.com/',
      'https://shop.arsenal.com/store',
    ]);
    assert.equal(question.reasoning.structured_output.additional_domain_results.length, 2);
    assert.deepEqual(question.reasoning.structured_output.vendors, ['Ticketmaster', 'Shopify', 'Stripe']);
    assert.deepEqual(
      [...question.reasoning.structured_output.categories].sort(),
      ['Ecommerce', 'Frontend', 'Payments', 'Ticketing'],
    );
    assert.equal(question.reasoning.structured_output.maturity_signal, 'medium');
    assert.match(question.reasoning.structured_output.commercial_interpretation, /payment or commerce capability/i);
    assert.match(question.reasoning.structured_output.opportunity, /commerce/i);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
    if (previousApifyToken === undefined) {
      delete process.env.APIFY_TOKEN;
    } else {
      process.env.APIFY_TOKEN = previousApifyToken;
    }
  }
});

test('runDeterministicToolQuestion skips non-official domains for digital-stack enrichment', async () => {
  const previousApifyToken = process.env.APIFY_TOKEN;
  process.env.APIFY_TOKEN = 'test-apify-token';
  try {
    const result = await runDeterministicToolQuestion(
      {
        question_type: 'digital_stack',
        entity_name: 'Arsenal Football Club',
        deterministic_tools: ['apify_techstack'],
        fallback_to_retrieval: true,
        deterministic_input: {
          url: 'https://en.wikipedia.org/wiki/Arsenal_F.C.',
        },
      },
      {
        apifyTechStackLookup: async () => {
          throw new Error('apifyTechStackLookup should not run for non-official domains');
        },
      },
    );

    assert.equal(result, null);
  } finally {
    if (previousApifyToken === undefined) {
      delete process.env.APIFY_TOKEN;
    } else {
      process.env.APIFY_TOKEN = previousApifyToken;
    }
  }
});

test('runDeterministicToolQuestion uses a likely official accepted link even when q1 labeled it as web', async () => {
  const previousApifyToken = process.env.APIFY_TOKEN;
  process.env.APIFY_TOKEN = 'test-apify-token';
  try {
    const result = await runDeterministicToolQuestion(
      {
        question_type: 'digital_stack',
        entity_name: 'Arsenal Football Club',
        deterministic_tools: ['apify_techstack'],
        fallback_to_retrieval: false,
        deterministic_input: {
          source_question_id: 'q1_foundation',
        },
      },
      {
        runState: {
          questions: [
            {
              question_id: 'q1_foundation',
              entity_name: 'Arsenal Football Club',
              accepted_links: [
                {
                  url: 'https://www.arsenal.com/history',
                  source_kind: 'web',
                },
              ],
            },
          ],
        },
        apifyTechStackLookup: async ({ url }) => ({
          results: [
            {
              url,
              technologies: [{ name: 'Drupal', confidence: 100, categories: ['CMS'] }],
              categories: ['CMS'],
              vendors: ['Drupal'],
            },
          ],
        }),
      },
    );

    assert.equal(result.structuredOutput.validation_state, 'validated');
    assert.equal(result.structuredOutput.evidence_url, 'https://www.arsenal.com/history');
    assert.deepEqual(result.structuredOutput.vendors, ['Drupal']);
  } finally {
    if (previousApifyToken === undefined) {
      delete process.env.APIFY_TOKEN;
    } else {
      process.env.APIFY_TOKEN = previousApifyToken;
    }
  }
});

test('runDeterministicToolQuestion can guess an official domain when q1 only resolved wikipedia', async () => {
  const previousApifyToken = process.env.APIFY_TOKEN;
  process.env.APIFY_TOKEN = 'test-apify-token';
  const seenUrls = [];
  try {
    const result = await runDeterministicToolQuestion(
      {
        question_type: 'digital_stack',
        entity_name: 'Major League Cricket',
        entity_type: 'SPORT_LEAGUE',
        deterministic_tools: ['apify_techstack'],
        fallback_to_retrieval: false,
        deterministic_input: {
          source_question_id: 'q1_foundation',
          official_site_only: true,
        },
      },
      {
        runState: {
          questions: [
            {
              question_id: 'q1_foundation',
              entity_name: 'Major League Cricket',
              accepted_links: [
                {
                  url: 'https://en.wikipedia.org/wiki/Major_League_Cricket',
                  source_kind: 'wikipedia',
                },
              ],
            },
          ],
        },
        apifyTechStackLookup: async ({ url }) => {
          seenUrls.push(url);
          if (url === 'https://www.majorleaguecricket.com/') {
            return {
              results: [
                {
                  url,
                  technologies: [{ name: 'Angular', confidence: 100, categories: ['Frontend'] }],
                  categories: ['Frontend'],
                  vendors: ['Angular'],
                },
              ],
            };
          }
          return { results: [] };
        },
      },
    );

    assert.equal(result.structuredOutput.validation_state, 'validated');
    assert.equal(result.structuredOutput.evidence_url, 'https://www.majorleaguecricket.com/');
    assert.deepEqual(result.structuredOutput.vendors, ['Angular']);
    assert.deepEqual(seenUrls, ['https://www.majorleaguecricket.com/']);
  } finally {
    if (previousApifyToken === undefined) {
      delete process.env.APIFY_TOKEN;
    } else {
      process.env.APIFY_TOKEN = previousApifyToken;
    }
  }
});

test('runDeterministicToolQuestion can guess federation and acronym official domains from q1 fallback', async () => {
  const previousApifyToken = process.env.APIFY_TOKEN;
  process.env.APIFY_TOKEN = 'test-apify-token';
  const seenUrls = [];
  try {
    const result = await runDeterministicToolQuestion(
      {
        question_type: 'digital_stack',
        entity_name: 'International Canoe Federation',
        entity_id: 'icf',
        entity_type: 'SPORT_FEDERATION',
        deterministic_tools: ['apify_techstack'],
        fallback_to_retrieval: false,
        deterministic_input: {
          source_question_id: 'q1_foundation',
          official_site_only: true,
        },
      },
      {
        runState: {
          questions: [
            {
              question_id: 'q1_foundation',
              entity_name: 'International Canoe Federation',
              accepted_links: [
                {
                  url: 'https://en.wikipedia.org/wiki/International_Canoe_Federation',
                  source_kind: 'wikipedia',
                },
              ],
            },
          ],
        },
        apifyTechStackLookup: async ({ url }) => {
          seenUrls.push(url);
          if (url === 'https://www.canoeicf.com/') {
            return {
              results: [
                {
                  url,
                  technologies: [{ name: 'Drupal', confidence: 100, categories: ['CMS'] }],
                  categories: ['CMS'],
                  vendors: ['Drupal'],
                },
              ],
            };
          }
          return { results: [] };
        },
      },
    );

    assert.equal(result.structuredOutput.validation_state, 'validated');
    assert.equal(result.structuredOutput.evidence_url, 'https://www.canoeicf.com/');
    assert.deepEqual(result.structuredOutput.vendors, ['Drupal']);
    assert.deepEqual(seenUrls, ['https://www.canoeicf.com/']);
  } finally {
    if (previousApifyToken === undefined) {
      delete process.env.APIFY_TOKEN;
    } else {
      process.env.APIFY_TOKEN = previousApifyToken;
    }
  }
});

test('runDeterministicToolQuestion retries known official surface candidates before giving up q2', async () => {
  const previousApifyToken = process.env.APIFY_TOKEN;
  process.env.APIFY_TOKEN = 'test-apify-token';
  const seenUrls = [];
  try {
    const result = await runDeterministicToolQuestion(
      {
        question_type: 'digital_stack',
        entity_name: 'World Athletics',
        entity_id: 'world-athletics',
        entity_type: 'SPORT_FEDERATION',
        deterministic_tools: ['apify_techstack'],
        fallback_to_retrieval: false,
        deterministic_input: {
          website: 'https://worldathletics.org/',
          official_site_only: true,
        },
      },
      {
        apifyTechStackLookup: async ({ url }) => {
          seenUrls.push(url);
          if (url === 'https://results.worldathletics.org/') {
            return {
              results: [
                {
                  url,
                  technologies: [{ name: 'React', confidence: 92, categories: ['Frontend'] }],
                  categories: ['Frontend'],
                  vendors: ['React'],
                },
              ],
            };
          }
          return { results: [{ url, technologies: [], categories: [], vendors: [] }] };
        },
      },
    );

    assert.equal(result.structuredOutput.validation_state, 'validated');
    assert.equal(result.structuredOutput.evidence_url, 'https://results.worldathletics.org/');
    assert.deepEqual(result.structuredOutput.vendors, ['React']);
    assert.deepEqual(seenUrls, [
      'https://worldathletics.org/',
      'https://results.worldathletics.org/',
    ]);
  } finally {
    if (previousApifyToken === undefined) {
      delete process.env.APIFY_TOKEN;
    } else {
      process.env.APIFY_TOKEN = previousApifyToken;
    }
  }
});

test('buildOpenCodeQuestionPrompt specializes decision-owner and related-pois outputs', () => {
  const decisionPrompt = buildOpenCodeQuestionPrompt({
    question_text: 'Who is the most suitable person for commercial partnerships or business development at Major League Cricket?',
    question_type: 'decision_owner',
    source_priority: ['linkedin_company_profile', 'linkedin_people_search', 'linkedin_person_profile', 'google_serp', 'official_site'],
    hop_budget: 2,
    query: '"Major League Cricket" LinkedIn company profile',
    search_strategy: {
      search_queries: [
        '"Major League Cricket" LinkedIn company profile',
        '"Major League Cricket" LinkedIn commercial',
        '"Major League Cricket" chief commercial officer',
      ],
    },
  });

  assert.match(decisionPrompt, /primary_owner/i);
  assert.match(decisionPrompt, /supporting_candidates/i);
  assert.match(decisionPrompt, /highest probability buyer/i);

  const relatedPrompt = buildOpenCodeQuestionPrompt({
    question_text: 'Which 3 to 5 people are the most relevant commercial, partnerships, or business development contacts at Major League Cricket?',
    question_type: 'related_pois',
    source_priority: ['linkedin_company_profile', 'linkedin_people_search', 'linkedin_person_profile', 'google_serp', 'official_site'],
    hop_budget: 2,
    query: '"Major League Cricket" LinkedIn company profile',
    search_strategy: {
      search_queries: [
        '"Major League Cricket" LinkedIn company profile',
        '"Major League Cricket" LinkedIn partnerships',
        '"Major League Cricket" managing director',
      ],
    },
  });

  assert.match(relatedPrompt, /3 to 5 candidates/i);
  assert.match(relatedPrompt, /candidates/i);
  assert.match(relatedPrompt, /ranked list/i);
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

test('ensureBrightDataFastMcpService does not hang on a stalled health probe', async () => {
  let probes = 0;
  const fetchImpl = async () => {
    probes += 1;
    if (probes === 1) {
      return await new Promise(() => {});
    }
    return { ok: true };
  };
  let spawned = false;
  const spawnImpl = () => {
    spawned = true;
    return {
      unref() {},
    };
  };

  const startedAt = Date.now();
  const result = await ensureBrightDataFastMcpService({
    fetchImpl,
    spawnImpl,
    serviceUrl: 'http://127.0.0.1:8000/mcp',
    healthUrl: 'http://127.0.0.1:8000/health',
    probeTimeoutMs: 25,
    startupTimeoutMs: 100,
    pollIntervalMs: 5,
  });

  assert.equal(spawned, true);
  assert.equal(result.healthy, true);
  assert.ok(Date.now() - startedAt < 500);
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
    const baseQuestionRuns = Array.from(
      new Set(questionRuns.map((questionId) => String(questionId).replace(/__hop_\d+$/, ''))),
    );
    assert.deepEqual(baseQuestionRuns, [
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
    assert.equal(artifact.schema_version, 'question_first_run_v2');
    assert.equal(artifact.question_specs.length, 1);
    assert.equal(artifact.answer_records.length, 1);
    assert.equal(artifact.question_specs[0].question_text, 'When was Major League Cricket founded?');
    assert.equal(artifact.answer_records[0].answer.value, '2023');
    assert.equal(artifact.merge_patch.question_first.schema_version, 'question_first_run_v2');
    assert.ok(Array.isArray(artifact.trace_index));
    assert.equal(artifact.trace_index.length, 1);
    assert.match(artifact.trace_index[0].path, /question_001\.debug\.json$/);
    assert.equal(seenWorktreeRoots[0], '/Users/kieranmcfarlane/Downloads/panther_chat/.worktrees/opencode-question-first-ssot');
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch defaults to the phase_1_core subset from a canonical fifteen-question source', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-rollout-phase-'));
  const sourcePath = join(outputDir, 'source.json');
  const seenQuestionIds = [];

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
        rollout_strategy: 'phased_core',
        default_rollout_phase: 'phase_1_core',
        question_count: 3,
        questions: [
          {
            question_id: 'q1_foundation',
            question_type: 'foundation',
            question: 'What year was {entity} founded?',
            query: '"Arsenal Football Club" founded year',
            hop_budget: 1,
            execution_class: 'atomic_retrieval',
            rollout_phase: 'phase_1_core',
            fallback_to_retrieval: true,
            source_priority: ['google_serp'],
          },
          {
            question_id: 'q8_explicit_rfp',
            question_type: 'tender_docs',
            question: 'Are there published RFPs for {entity}?',
            query: '"Arsenal Football Club" tender',
            hop_budget: 1,
            execution_class: 'atomic_retrieval',
            rollout_phase: 'phase_2_conditional',
            fallback_to_retrieval: true,
            source_priority: ['google_serp'],
            conditional_on: [{ type: 'validated_question', question_id: 'q7_procurement_signal' }],
          },
          {
            question_id: 'q13_capability_gap',
            question_type: 'capability_gap',
            question: 'What capability gaps exist for {entity}?',
            query: '"Arsenal Football Club" capability gap',
            hop_budget: 1,
            execution_class: 'derived_inference',
            rollout_phase: 'phase_3_decision',
            fallback_to_retrieval: false,
            source_priority: [],
            depends_on: ['q2_digital_stack'],
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const result = await runOpenCodeQuestionSourceBatch({
    questionSourcePath: sourcePath,
    outputDir,
    questionRunner: async (question) => {
      seenQuestionIds.push(question.question_id);
      return {
        structuredOutput: {
          answer: '1886',
          confidence: 0.9,
          sources: ['https://www.arsenal.com/history'],
          validation_state: 'validated',
        },
        promptTrace: { status: 'ok', has_structured_output: true },
        messageTrace: [],
        cliResult: { code: 0, stdout: '', stderr: '' },
      };
    },
    deterministicToolRunner: async () => null,
  });

  assert.deepEqual(seenQuestionIds, ['q1_foundation']);
  assert.equal(result.questions_total, 1);
});

test('runOpenCodeQuestionSourceBatch does not send deterministic or derived questions into retrieval when fallback is disabled', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-execution-class-'));
  const sourcePath = join(outputDir, 'source.json');

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        schema_version: 'atomic_question_source_v1',
        entity_id: 'arsenal-fc',
        entity_name: 'Arsenal Football Club',
        entity_type: 'SPORT_CLUB',
        preset: 'arsenal-phase-three',
        question_source_label: 'arsenal-phase-three',
        question_shape: 'atomic',
        pack_role: 'discovery',
        pack_stage: 'atomic_matrix',
        rollout_strategy: 'phased_core',
        default_rollout_phase: 'phase_3_decision',
        question_count: 2,
        questions: [
          {
            question_id: 'q4_performance',
            question_type: 'performance',
            question: 'What is the current sporting performance context for {entity}?',
            query: '"Arsenal Football Club" table',
            hop_budget: 1,
            execution_class: 'deterministic_enrichment',
            rollout_phase: 'phase_2_conditional',
            fallback_to_retrieval: false,
            source_priority: ['sports_data'],
            conditional_on: [{ type: 'entity_type_in', values: ['SPORT_CLUB', 'SPORT_LEAGUE'] }],
          },
          {
            question_id: 'q13_capability_gap',
            question_type: 'capability_gap',
            question: 'What capability gaps exist for {entity}?',
            query: '"Arsenal Football Club" capability gap',
            hop_budget: 1,
            execution_class: 'derived_inference',
            rollout_phase: 'phase_3_decision',
            fallback_to_retrieval: false,
            source_priority: [],
            depends_on: ['q2_digital_stack'],
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  await runOpenCodeQuestionSourceBatch({
    questionSourcePath: sourcePath,
    outputDir,
    questionRunner: async () => {
      throw new Error('questionRunner should not be called for deterministic/derived questions without retrieval fallback');
    },
    deterministicToolRunner: async () => null,
  });

  const questionPaths = readdirSync(outputDir).filter((name) => /_question_\d{3}\.json$/.test(name));
  assert.equal(questionPaths.length, 2);
  const payloads = questionPaths
    .map((name) => JSON.parse(readFileSync(join(outputDir, name), 'utf8')).question)
    .sort((left, right) => left.question_id.localeCompare(right.question_id));
  assert.deepEqual(
    payloads.map((payload) => [payload.question_id, payload.validation_state]),
    [
      ['q13_capability_gap', 'no_signal'],
      ['q4_performance', 'no_signal'],
    ],
  );
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

test('runOpenCodeQuestionSourceBatch preserves runner timeout trace when child settles just after guard', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-question-source-timeout-trace-'));
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
            hop_budget: 1,
            question_timeout_ms: 50,
            hop_timeout_ms: 50,
            source_priority: ['google_serp'],
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const questionRunner = async () => {
    await new Promise((resolve) => setTimeout(resolve, 75));
    return {
      structuredOutput: {
        answer: '',
        confidence: 0,
        validation_state: 'no_signal',
        sources: [],
      },
      promptTrace: {
        exit_code: 124,
        stdout_length: 12,
        stderr_length: 19,
        has_structured_output: false,
      },
      messageTrace: [],
      cliResult: {
        code: 124,
        stdout: 'partial text',
        stderr: 'child timed out late',
      },
    };
  };

  try {
    await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      opencodeTimeoutMs: 50,
      questionRunner,
    });

    const runPath = readdirSync(outputDir).find((name) => name.endsWith('_question_first_run_v2.json'));
    const artifact = JSON.parse(readFileSync(join(outputDir, runPath), 'utf8'));
    assert.equal(artifact.answer_records[0].trace_ref, artifact.trace_index[0].trace_id);
    const debugPayload = JSON.parse(readFileSync(artifact.trace_index[0].path, 'utf8'));
    assert.equal(debugPayload.raw_execution_trace.stderr_excerpt, 'child timed out late');
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

    assert.equal(result.questions_total, 6);
    assert.deepEqual(questionRuns, [
      'poi_commercial_partnerships_lead',
      'poi_related_pois',
      'poi_digital_product_lead',
      'poi_fan_engagement_lead',
      'poi_marketing_comms_lead',
      'poi_operations_lead',
    ]);
    const meta = JSON.parse(readFileSync(result.meta_result_path, 'utf8'));
    assert.equal(meta.questions.length, 6);
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
      'poi_related_pois',
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
      'poi_digital_product_lead',
      'poi_fan_engagement_lead',
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

    assert.equal(result.questions_total, 2);
    assert.deepEqual(questionRuns, ['poi_marketing_comms_lead', 'poi_operations_lead']);
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
    assert.equal(runs.length, 1);
    assert.deepEqual(runs, ['"Test Entity" founded']);
    const state = JSON.parse(readFileSync(result.state_path, 'utf8'));
    assert.equal(state.questions[0].status, 'validated');
    assert.equal(state.questions[0].run_history.length, 1);
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


test('runOpenCodePresetBatch preserves bounded raw execution trace for tool-call-missing failures', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-raw-trace-'));
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';

  const stdout = [
    JSON.stringify({
      type: 'text',
      part: {
        text: 'Searched official site and found a possible partnerships page, but did not emit final JSON.',
      },
    }),
  ].join('\n');
  const stderr = 'OpenCode exited before tool result finalization';

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      questionRunner: async () => ({
        structuredOutput: {},
        promptTrace: {
          exit_code: 1,
          stdout_length: stdout.length,
          stderr_length: stderr.length,
          has_structured_output: false,
        },
        messageTrace: [{ role: 'assistant', completed: false, type: 'cli-run', has_structured_output: false, part_count: 1 }],
        cliResult: { code: 1, stdout, stderr },
      }),
    });

    const question = JSON.parse(readFileSync(result.question_result_paths[0], 'utf8')).question;
    assert.equal(question.validation_state, 'tool_call_missing');
    assert.equal(question.reasoning.raw_execution_trace.exit_code, 1);
    assert.match(question.reasoning.raw_execution_trace.stderr_excerpt, /tool result finalization/);
    assert.match(question.reasoning.raw_execution_trace.assistant_text_excerpt, /possible partnerships page/);
    assert.equal(question.raw_execution_trace.stderr_excerpt, question.reasoning.raw_execution_trace.stderr_excerpt);
  } finally {
    if (previousZaiKey === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = previousZaiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch adds non-strict timeout salvage without changing validation counts', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-timeout-salvage-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CHUTES_API_KEY;
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-zai-token';

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        schema_version: 'atomic_question_source_v1',
        entity_id: 'diagnostic-slice',
        entity_name: 'Diagnostic Slice',
        entity_type: 'SPORT_LEAGUE',
        preset: 'diagnostic-slice',
        question_source_label: 'diagnostic-slice',
        question_shape: 'atomic',
        pack_role: 'discovery',
        pack_stage: 'atomic_matrix',
        question_count: 4,
        questions: [
          {
            question_id: 'q3_procurement_signal_celtic',
            question_type: 'procurement',
            entity_id: 'celtic-fc',
            entity_name: 'Celtic FC',
            entity_type: 'SPORT_CLUB',
            question: 'Is there evidence Celtic is reshaping its digital ecosystem?',
            query: '"Celtic Football Club" commercial partnership',
            hop_budget: 1,
            source_priority: ['google_serp'],
          },
          {
            question_id: 'q4_decision_owner_barcelona',
            question_type: 'decision_owner',
            entity_id: 'fc-barcelona',
            entity_name: 'FC Barcelona',
            entity_type: 'SPORT_CLUB',
            question: 'Who is the most suitable person for commercial partnerships at FC Barcelona?',
            query: '"FC Barcelona" LinkedIn company profile',
            hop_budget: 1,
            source_priority: ['google_serp'],
          },
          {
            question_id: 'q4_decision_owner_mls_noise',
            question_type: 'decision_owner',
            entity_id: 'mls',
            entity_name: 'Major League Soccer',
            entity_type: 'SPORT_LEAGUE',
            question: 'Who is the most suitable person for commercial partnerships at Major League Soccer?',
            query: '"Major League Soccer" LinkedIn company profile',
            hop_budget: 1,
            source_priority: ['google_serp'],
          },
          {
            question_id: 'q3_procurement_signal_mlc',
            question_type: 'procurement',
            entity_id: 'major-league-cricket',
            entity_name: 'Major League Cricket',
            entity_type: 'SPORT_LEAGUE',
            question: 'Is there evidence Major League Cricket is reshaping its digital ecosystem?',
            query: '"Major League Cricket" official partner broadcast rights media rights data platform',
            hop_budget: 1,
            source_priority: ['google_serp'],
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const brightDataSearch = (body) => JSON.stringify({
    type: 'tool_use',
    part: {
      tool: 'brightData_search_engine',
      state: {
        output: body,
      },
    },
  });
  const timeoutTrace = (body) => ({
    structuredOutput: {},
    promptTrace: {
      exit_code: 124,
      stdout_length: body.length,
      stderr_length: 36,
      has_structured_output: false,
    },
    messageTrace: [{ role: 'assistant', completed: false, type: 'cli-run', has_structured_output: false, part_count: 1 }],
    cliResult: { code: 124, stdout: brightDataSearch(body), stderr: 'opencode run timed out after 60000ms' },
  });

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async (question) => {
        if (question.entity_id === 'celtic-fc') {
          return timeoutTrace([
            'Search results for "Celtic Football Club commercial partnership" on google:',
            '1. Celtic FC hiring Mobile App Platform Manager',
            'URL: https://jobs.celticfc.com/mobile-app-platform-manager',
            'Description: Mobile app platform manager, fan engagement and digital services.',
            '2. Eleven Sports Media become official Celtic FC partner',
            'URL: https://sportsvenuebusiness.com/2020/02/27/eleven-sports-media-become-official-celtic-fc-partner/',
            'Source: brightdata_sdk',
          ].join('\n'));
        }
        if (question.entity_id === 'fc-barcelona') {
          return timeoutTrace([
            'Search results for "FC Barcelona LinkedIn company profile" on google:',
            '1. Marc Bruix Email & Phone Number | FC Barcelona Director',
            'URL: https://rocketreach.co/marc-bruix-email_69036',
            'Description: Marc Bruix Work; Director of Partnerships and Academies @ FC Barcelona; Partnerships Director - Americas and Asia-Pacific @ FC Barcelona.',
            'Source: brightdata_sdk',
          ].join('\n'));
        }
        if (question.entity_id === 'mls') {
          return timeoutTrace([
            'Search results for "MLS listings leadership" on google:',
            '1. MLS.com - MLS Listings, Real Estate Property Listings',
            'URL: https://www.mls.com/',
            'Description: Property Search. Find Foreclosures, New Homes, Find an Agent.',
            'Source: brightdata_sdk',
          ].join('\n'));
        }
        return {
          structuredOutput: {
            answer: 'Major League Cricket has commercial ecosystem signals across title sponsorship, broadcast rights, and ticketing.',
            confidence: 0.85,
            sources: ['https://www.majorleaguecricket.com/'],
            validation_state: 'validated',
          },
          promptTrace: { exit_code: 0, stdout_length: 1, stderr_length: 0, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '', stderr: '' },
        };
      },
    });

    assert.equal(result.questions_validated, 1);
    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const [celtic, barcelona, mls, mlc] = artifact.answer_records;
    assert.equal(celtic.validation_state, 'tool_call_missing');
    assert.equal(celtic.timeout_salvage.counts_as_validated, false);
    assert.match(celtic.timeout_salvage.candidate_summary, /Mobile App Platform Manager|official Celtic FC partner/i);
    assert.ok(celtic.timeout_salvage.candidate_evidence_urls.includes('https://jobs.celticfc.com/mobile-app-platform-manager'));
    assert.equal(barcelona.timeout_salvage.salvage_state, 'evidence_retained');
    assert.match(barcelona.timeout_salvage.candidate_summary, /Marc Bruix|Director of Partnerships/i);
    assert.match(mls.timeout_salvage.risk_notes.join(' '), /real-estate MLS false positive/i);
    assert.equal(mls.timeout_salvage.counts_as_validated, false);
    assert.equal(mlc.validation_state, 'validated');
    assert.equal(mlc.timeout_salvage, undefined);
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
