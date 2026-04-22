import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildOpenCodeRetrievalPrompt,
  buildMajorLeagueCricketPresetQuestions,
  buildMajorLeagueCricketPoiBatchAQuestions,
  buildMajorLeagueCricketPoiBatchBQuestions,
  buildMajorLeagueCricketPoiBatchCQuestions,
  buildMajorLeagueCricketPoiQuestions,
  buildMajorLeagueCricketSmokeQuestions,
  buildOpenCodeConfig,
  buildOpenCodeRunArgs,
  buildOpenCodeQuestionPrompt,
  buildOpenCodeSynthesisPrompt,
  buildQuestionState,
  prepareOpenCodeRunWorkspace,
  runOpenCodeCliQuestion,
  runOpenCodeQuestionSourceBatch,
  runOpenCodePresetBatch,
  spawnOpenCodeRunForTesting,
} from '../scripts/opencode_agentic_batch.mjs';

test('buildOpenCodeConfig wires Z.AI API GLM 5.1 and BrightData MCP for OpenCode', async () => {
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  const previousBrightDataToken = process.env.BRIGHTDATA_API_TOKEN;
  process.env.ZAI_API_KEY = 'test-zai-token';
  process.env.BRIGHTDATA_API_TOKEN = 'test-brightdata-token';
  const config = await buildOpenCodeConfig({
    worktreeRoot: '/Users/kieranmcfarlane/Downloads/panther_chat/.worktrees/v5-yellow-panther-canonical',
  });

  assert.equal(config.$schema, 'https://opencode.ai/config.json');
  assert.equal(config.model, 'zai-api/glm-5.1');
  assert.equal(config.provider['zai-api'].npm, '@ai-sdk/openai-compatible');
  assert.equal(config.provider['zai-api'].name, 'Z.AI API');
  assert.equal(config.provider['zai-api'].options.baseURL, 'https://api.z.ai/api/paas/v4');
  assert.equal(config.provider['zai-api'].options.apiKey, '{env:ZAI_API_KEY}');
  assert.equal(config.provider['zai-api'].models['glm-5.1'].id, 'GLM-5.1');
  assert.equal(config.provider['zai-api'].models['glm-5.1'].name, 'GLM-5.1');
  assert.equal(config.provider['zai-api'].models['glm-5.1'].limit.output, 16384);
  assert.ok(config.mcp.brightData);
  assert.equal(config.mcp.brightData.type, 'remote');
  assert.equal(config.mcp.brightData.enabled, true);
  assert.equal(config.mcp.brightData.url, 'http://127.0.0.1:8000/mcp/');
  assert.equal(config.mcp.brightData.timeout, 15000);
  assert.equal(config.agent.discovery.steps, 4);
  assert.equal(config.agent.discovery.model, 'zai-api/glm-5.1');
  assert.deepEqual(config.tools, { 'brightData*': false, 'brightdata*': false });
  assert.deepEqual(config.agent.build.tools, { 'brightData*': true, 'brightdata*': true });
  assert.deepEqual(config.agent.discovery.tools, { 'brightData*': true, 'brightdata*': true });
  if (previousZaiApiKey === undefined) {
    delete process.env.ZAI_API_KEY;
  } else {
    process.env.ZAI_API_KEY = previousZaiApiKey;
  }
  if (previousBrightDataToken === undefined) {
    delete process.env.BRIGHTDATA_API_TOKEN;
  } else {
    process.env.BRIGHTDATA_API_TOKEN = previousBrightDataToken;
  }
});

test('buildOpenCodeConfig omits unsupported top-level keys for the installed OpenCode schema', async () => {
  const config = await buildOpenCodeConfig({
    worktreeRoot: '/Users/kieranmcfarlane/Downloads/panther_chat',
  });

  assert.equal('mcpServers' in config, false);
  assert.equal('metadata' in config, false);
});

test('prepareOpenCodeRunWorkspace materializes repo-local OpenCode MCP config', async () => {
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  const previousBrightDataToken = process.env.BRIGHTDATA_API_TOKEN;
  process.env.ZAI_API_KEY = 'test-zai-token';
  process.env.BRIGHTDATA_API_TOKEN = 'test-brightdata-token';
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'opencode-run-workspace-'));

  try {
    const prepared = await prepareOpenCodeRunWorkspace({
      worktreeRoot: workspaceRoot,
    });
    const configPath = join(prepared.cwd, 'opencode.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));

    assert.notEqual(prepared.cwd, workspaceRoot);
    assert.equal(config.model, 'zai-api/glm-5.1');
    assert.equal(config.provider['zai-api'].options.baseURL, 'https://api.z.ai/api/paas/v4');
    assert.equal(config.provider['zai-api'].options.apiKey, '{env:ZAI_API_KEY}');
    assert.ok(config.mcp.brightData);
    assert.equal(config.mcp.brightData.type, 'remote');
    assert.equal(config.mcp.brightData.url, 'http://127.0.0.1:8000/mcp/');
    assert.equal(config.mcp.brightData.timeout, 15000);

    await prepared.cleanup();
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
    if (previousBrightDataToken === undefined) {
      delete process.env.BRIGHTDATA_API_TOKEN;
    } else {
      process.env.BRIGHTDATA_API_TOKEN = previousBrightDataToken;
    }
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
  assert.match(prompt, /Use BrightData to answer one atomic question/i);
  assert.match(prompt, /Do not inspect local files, the repository, tests, or generated scripts/i);
  assert.match(prompt, /Do not use bash, python, grep, ripgrep/i);
  assert.match(prompt, /Use only BrightData-backed web evidence/i);
  assert.match(prompt, /context, sources, confidence/i);
  assert.doesNotMatch(prompt, /hop budget/i);
  assert.doesNotMatch(prompt, /brightdata tool/i);
});

test('buildOpenCodeQuestionPrompt adds no-signal guidance for bounded negative probes', () => {
  const prompt = buildOpenCodeQuestionPrompt({
    question_id: 'q8_explicit_rfp',
    question_text: 'Are there published RFPs, tenders, or formal procurement documents for Major League Cricket?',
    question_type: 'tender_docs',
    query: '"Major League Cricket" RFP tender procurement',
    empty_result_policy: 'no_signal',
  });

  assert.match(prompt, /no meaningful public evidence is visible after a bounded search/i);
  assert.match(prompt, /no_signal/i);
});

test('buildOpenCodeQuestionPrompt requests commercial evidence fields for procurement questions', () => {
  const prompt = buildOpenCodeQuestionPrompt({
    question_id: 'q7_procurement_signal',
    question_text: 'Is there evidence LiveScore Group is buying or reshaping vendors?',
    question_type: 'procurement_signal',
    query: '"LiveScore Group" platform migration provider partnership',
  });

  assert.match(prompt, /evidence_grade/i);
  assert.match(prompt, /structured_signal/i);
  assert.match(prompt, /commercial_implication/i);
  assert.match(prompt, /signal_density/i);
  assert.match(prompt, /vendor_changes/i);
  assert.match(prompt, /platform_migrations/i);
  assert.match(prompt, /partnerships/i);
  assert.match(prompt, /org_changes/i);
});

test('buildOpenCodeQuestionPrompt tells q7 to use provisional for indirect multi-source ecosystem-change evidence', () => {
  const prompt = buildOpenCodeQuestionPrompt({
    question_id: 'q7_procurement_signal',
    question_text: 'Is there evidence LiveScore Group is buying, reshaping vendors, or changing its ecosystem?',
    question_type: 'procurement_signal',
    query: '"LiveScore Group" platform migration provider partnership',
  });

  assert.match(prompt, /indirect multi-source/i);
  assert.match(prompt, /provisional/i);
  assert.match(prompt, /do not return no_signal/i);
});

test('buildOpenCodeQuestionPrompt makes standalone harness runs BrightData-first and bounded', () => {
  const prompt = buildOpenCodeQuestionPrompt(
    {
      question_id: 'q7_procurement_signal',
      question_text: 'Is there evidence LiveScore Group is buying, reshaping vendors, or changing its ecosystem?',
      question_type: 'procurement_signal',
      query: '"LiveScore Group" platform migration provider partnership',
    },
    { standaloneHarness: true },
  );

  assert.match(prompt, /first action must be one BrightData search/i);
  assert.match(prompt, /at most one follow-up BrightData search or scrape/i);
  assert.match(prompt, /repeated reasoning without BrightData tool progress/i);
});

test('buildOpenCodeRetrievalPrompt and buildOpenCodeSynthesisPrompt split q7 into retrieval then classification responsibilities', () => {
  const question = {
    question_id: 'q7_procurement_signal',
    question_text: 'Is there evidence LiveScore Group is buying, reshaping vendors, or changing its ecosystem?',
    question_type: 'procurement_signal',
    query: '"LiveScore Group" platform migration provider partnership',
  };

  const retrievalPrompt = buildOpenCodeRetrievalPrompt(question, { standaloneHarness: true });
  const synthesisPrompt = buildOpenCodeSynthesisPrompt(question, {
    retrievalOutput: {
      leads: [
        {
          title: 'Kambi and LiveScore partnership',
          url: 'https://example.com/kambi',
          snippet: 'Vendor and platform evidence',
          excerpt: 'LiveScore expanded Kambi sportsbook support.',
        },
      ],
    },
    standaloneHarness: true,
  });

  assert.match(retrievalPrompt, /retrieval pass/i);
  assert.match(retrievalPrompt, /Return only JSON with these keys: question, query, leads, retrieval_summary/i);
  assert.match(retrievalPrompt, /Do not classify or decide validation_state/i);
  assert.match(synthesisPrompt, /synthesis pass/i);
  assert.match(synthesisPrompt, /Use only the supplied retrieval evidence/i);
  assert.match(synthesisPrompt, /validation_state/i);
  assert.match(synthesisPrompt, /structured_signal/i);
});

test('runOpenCodeCliQuestion uses separate retrieval and synthesis passes for q7 questions', async () => {
  const question = {
    question_id: 'q7_procurement_signal',
    question_text: 'Is there evidence LiveScore Group is buying, reshaping vendors, or changing its ecosystem?',
    question_type: 'procurement_signal',
    query: '"LiveScore Group" platform migration provider partnership',
  };
  const seenArgs = [];
  const retrievalEvent = JSON.stringify({
    type: 'text',
    part: {
      text: JSON.stringify({
        question: question.question_text,
        query: question.query,
        leads: [
          {
            title: 'Kambi and LiveScore partnership',
            url: 'https://example.com/kambi',
            snippet: 'Vendor and platform evidence',
            excerpt: 'LiveScore expanded Kambi sportsbook support.',
          },
        ],
        retrieval_summary: 'Found named vendor evidence.',
      }),
    },
  }) + '\n';
  const synthesisEvent = JSON.stringify({
    type: 'text',
    part: {
      text: JSON.stringify({
        question: question.question_text,
        answer: 'Found vendor and platform evidence through Kambi.',
        context: 'Two-stage synthesis consumed the retrieval evidence.',
        sources: ['https://example.com/kambi'],
        confidence: 0.74,
        structured_signal: {
          vendor_changes: [{ name: 'Kambi', evidence_url: 'https://example.com/kambi', evidence_kind: 'vendor_change', summary: 'Named vendor evidence.' }],
          platform_migrations: [],
          partnerships: [],
          org_changes: [],
        },
      }),
    },
  }) + '\n';

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-two-stage-worktree-')),
    opencodeTimeoutMs: 5000,
    standaloneHarness: true,
    spawnRunner: async (args) => {
      seenArgs.push(args);
      const prompt = args.at(-1);
      if (seenArgs.length === 1) {
        assert.match(prompt, /retrieval pass/i);
        return {
          code: 0,
          stdout: retrievalEvent,
          stderr: '',
        };
      }
      assert.match(prompt, /synthesis pass/i);
      assert.match(prompt, /https:\/\/example.com\/kambi/i);
      return {
        code: 0,
        stdout: synthesisEvent,
        stderr: '',
      };
    },
  });

  assert.equal(seenArgs.length, 2);
  assert.match(result.structuredOutput.answer, /Kambi/i);
  assert.equal(result.promptTrace.stage_count, 2);
  assert.equal(result.promptTrace.retrieval_has_leads, true);
});

test('runOpenCodeCliQuestion uses separate retrieval and synthesis passes for generic procurement questions', async () => {
  const question = {
    question_id: 'sl_league_mobile_app',
    question_text: 'What league-wide mobile app or digital platform initiatives is Major League Cricket pursuing?',
    question_type: 'procurement',
    query: '"Major League Cricket" RFP tender procurement',
  };
  const seenArgs = [];
  const retrievalEvent = JSON.stringify({
    type: 'text',
    part: {
      text: JSON.stringify({
        question: question.question_text,
        query: question.query,
        leads: [
          {
            title: 'Major League Cricket app launch',
            url: 'https://example.com/mlc-app',
            snippet: 'Digital platform evidence',
            excerpt: 'Major League Cricket launched a league-wide app.',
          },
        ],
        retrieval_summary: 'Found digital platform evidence.',
      }),
    },
  }) + '\n';
  const synthesisEvent = JSON.stringify({
    type: 'text',
    part: {
      text: JSON.stringify({
        question: question.question_text,
        answer: 'Major League Cricket has public league-wide app evidence.',
        context: 'Two-stage synthesis consumed the retrieval evidence.',
        sources: ['https://example.com/mlc-app'],
        confidence: 0.82,
      }),
    },
  }) + '\n';

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-procurement-two-stage-worktree-')),
    opencodeTimeoutMs: 5000,
    standaloneHarness: true,
    spawnRunner: async (args) => {
      seenArgs.push(args);
      const prompt = args.at(-1);
      if (seenArgs.length === 1) {
        assert.match(prompt, /retrieval pass/i);
        return {
          code: 0,
          stdout: retrievalEvent,
          stderr: '',
        };
      }
      assert.match(prompt, /synthesis pass/i);
      assert.match(prompt, /https:\/\/example.com\/mlc-app/i);
      return {
        code: 0,
        stdout: synthesisEvent,
        stderr: '',
      };
    },
  });

  assert.equal(seenArgs.length, 2);
  assert.match(result.structuredOutput.answer, /league-wide app/i);
  assert.equal(result.promptTrace.stage_count, 2);
  assert.equal(result.promptTrace.retrieval_has_leads, true);
});

test('runOpenCodeCliQuestion recovers retrieval leads from timed out two-stage procurement runs', async () => {
  const question = {
    question_id: 'sl_league_mobile_app',
    question_text: 'What league-wide mobile app or digital platform initiatives is Major League Cricket pursuing?',
    question_type: 'procurement',
    query: '"Major League Cricket" RFP tender procurement',
  };
  const retrievalToolEvent = JSON.stringify({
    type: 'tool_use',
    part: {
      type: 'tool',
      tool: 'brightData_search_engine',
      state: {
        status: 'completed',
        input: { query: question.query },
        output: JSON.stringify({
          status: 'success',
          query: question.query,
          results: [
            {
              title: 'Major League Cricket app launch',
              url: 'https://example.com/mlc-app',
              snippet: 'Digital platform evidence',
            },
          ],
        }),
      },
    },
  }) + '\n';
  const synthesisEvent = JSON.stringify({
    type: 'text',
    part: {
      text: JSON.stringify({
        question: question.question_text,
        answer: 'Major League Cricket has public league-wide app evidence.',
        context: 'Synthesis used recovered retrieval leads.',
        sources: ['https://example.com/mlc-app'],
        confidence: 0.82,
      }),
    },
  }) + '\n';
  const seenArgs = [];

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-procurement-recovery-worktree-')),
    opencodeTimeoutMs: 5000,
    standaloneHarness: true,
    spawnRunner: async (args) => {
      seenArgs.push(args);
      const prompt = args.at(-1);
      if (seenArgs.length === 1) {
        assert.match(prompt, /retrieval pass/i);
        const error = new Error('opencode run timed out after 5000ms');
        error.name = 'OpenCodeTimeoutError';
        error.stdout = retrievalToolEvent;
        error.stderr = '';
        throw error;
      }
      assert.match(prompt, /synthesis pass/i);
      assert.match(prompt, /https:\/\/example.com\/mlc-app/i);
      return {
        code: 0,
        stdout: synthesisEvent,
        stderr: '',
      };
    },
  });

  assert.equal(seenArgs.length, 2);
  assert.equal(result.promptTrace.stage_count, 2);
  assert.equal(result.promptTrace.retrieval_recovered_from_failure, true);
  assert.equal(result.promptTrace.retrieval_has_leads, true);
  assert.match(result.structuredOutput.answer, /league-wide app/i);
});

test('spawnOpenCodeRunForTesting kills a timed-out process tree before rejecting', async () => {
  let caughtError = null;
  let descendantPid = null;
  const script = `
    const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    process.stdout.write(JSON.stringify({ descendantPid: child.pid }) + '\\n');
    setInterval(() => {}, 1000);
  `;
  try {
    await spawnOpenCodeRunForTesting(
      ['-e', script],
      {
        command: process.execPath,
        cwd: process.cwd(),
        env: process.env,
        timeoutMs: 250,
      },
    );
  } catch (error) {
    caughtError = error;
  }

  assert.ok(caughtError);
  assert.match(caughtError.message, /timed out/);
  assert.equal(caughtError.name, 'OpenCodeTimeoutError');
  assert.equal(caughtError.child_stopped, true);
  descendantPid = JSON.parse(String(caughtError.stdout || '').trim()).descendantPid;
  assert.ok(descendantPid);
  let descendantAlive = true;
  try {
    process.kill(descendantPid, 0);
  } catch {
    descendantAlive = false;
  } finally {
    if (descendantAlive) {
      process.kill(descendantPid, 'SIGKILL');
    }
  }
  assert.equal(descendantAlive, false);
});

test('runOpenCodeCliQuestion normalizes bare no_signal text into structured output', async () => {
  const question = {
    question_id: 'q1_foundation',
    question_text: 'When was Arsenal founded?',
    question_type: 'foundation',
    query: '"Arsenal FC" official website founded year',
  };

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-bare-no-signal-')),
    opencodeTimeoutMs: 5000,
    standaloneHarness: true,
    spawnRunner: async () => ({
      code: 0,
      stdout: `${JSON.stringify({ type: 'text', part: { text: 'no_signal' } })}\n`,
      stderr: '',
    }),
  });

  assert.equal(result.structuredOutput.validation_state, 'no_signal');
  assert.equal(result.structuredOutput.answer, '');
  assert.equal(result.structuredOutput.confidence, 0);
});

test('runOpenCodeCliQuestion recovers foundation answer from timeout scrape evidence', async () => {
  const question = {
    question_id: 'q1_foundation',
    question_text: 'When was Arsenal founded?',
    question_type: 'foundation',
    query: '"Arsenal FC" official website founded year',
  };
  const timeoutError = new Error('opencode run timed out after 180000ms');
  timeoutError.name = 'OpenCodeTimeoutError';
  timeoutError.stdout = [
    JSON.stringify({
      type: 'tool_use',
      part: {
        type: 'tool',
        tool: 'brightData_scrape_as_markdown',
        state: {
          status: 'completed',
          input: { url: 'https://www.arsenal.com/club/history' },
          output: 'Content scraped from https://www.arsenal.com/club/history:\nArsenal Football Club was founded in 1886 in Woolwich, south-east London.',
        },
      },
    }),
  ].join('\n');
  timeoutError.stderr = '';

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-foundation-timeout-recovery-')),
    opencodeTimeoutMs: 5000,
    standaloneHarness: true,
    spawnRunner: async () => {
      throw timeoutError;
    },
  });

  assert.equal(result.structuredOutput.answer, '1886');
  assert.equal(result.structuredOutput.validation_state, 'validated');
  assert.deepEqual(result.structuredOutput.sources, ['https://www.arsenal.com/club/history']);
  assert.equal(result.promptTrace.recovered_from_failure, true);
  assert.equal(result.promptTrace.failure_name, 'OpenCodeTimeoutError');
});

test('buildOpenCodeRunArgs selects the build agent so BrightData tools are enabled', () => {
  const prompt = 'Return JSON';
  const args = buildOpenCodeRunArgs({ question_id: 'q6_launch_signal' }, prompt);

  assert.deepEqual(args.slice(0, 4), ['run', '--format', 'json', '--model']);
  assert.equal(args.includes('--agent'), true);
  assert.equal(args[args.indexOf('--agent') + 1], 'build');
  assert.equal(args.includes('--model'), true);
  assert.equal(args.at(-1), prompt);
});

test('buildOpenCodeRunArgs enables printed INFO logs for standalone harness runs', () => {
  const prompt = 'Return JSON';
  const args = buildOpenCodeRunArgs({ question_id: 'q7_procurement_signal' }, prompt, { standaloneHarness: true });

  assert.equal(args.includes('--print-logs'), true);
  assert.equal(args.includes('--log-level'), true);
  assert.equal(args[args.indexOf('--log-level') + 1], 'INFO');
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
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';
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
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch writes the canonical question_first_run artifact', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-question-source-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

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
            question_text: 'When was Major League Cricket founded?',
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
      questionRunner: async (question) => ({
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
      }),
    });

    assert.ok(result.question_first_run_path);
    assert.ok(result.tracker_path);
    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    assert.equal(artifact.schema_version, 'question_first_run_v2');
    assert.equal(artifact.question_specs.length, 1);
    assert.equal(artifact.answer_records.length, 1);
    assert.equal(artifact.merge_patch.question_first.schema_version, 'question_first_run_v2');
    assert.equal(artifact.merge_patch.question_first.answers[0].answer.value, '2023');

    const tracker = JSON.parse(readFileSync(result.tracker_path, 'utf8'));
    assert.equal(tracker.schema_version, 'question_first_run_tracker_v1');
    assert.equal(tracker.status, 'completed');
    assert.equal(tracker.total_questions, 1);
    assert.equal(tracker.questions[0].status, 'validated');
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch creates a missing output directory before writing tracker files', async () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'opencode-question-source-missing-output-'));
  const outputDir = join(baseDir, 'artifacts');
  const sourcePath = join(baseDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

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
            question_text: 'When was Major League Cricket founded?',
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
      questionRunner: async () => ({
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
      }),
    });

    assert.ok(result.tracker_path);
    assert.equal(readdirSync(outputDir).some((entry) => entry.endsWith('_tracker.json')), true);
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch caps weak commercial confidence and persists commercial fields', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-commercial-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  writeFileSync(sourcePath, JSON.stringify({
    entity_id: 'livescore-group',
    entity_name: 'LiveScore Group',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'live-test',
    questions: [
      {
        question_id: 'q7_procurement_signal',
        question_type: 'procurement_signal',
        question_text: 'Is there evidence LiveScore Group is buying, reshaping vendors, or changing its ecosystem?',
        query: '"LiveScore Group" platform migration provider partnership',
        source_priority: ['google_serp', 'news', 'press_release', 'official_site'],
        hop_budget: 3,
      },
    ],
  }), 'utf8');

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async () => ({
        structuredOutput: {
          answer: 'yes — multiple concurrent signals suggest ecosystem change',
          context: 'Generic commercial ecosystem update.',
          sources: ['https://www.livescoregroup.com'],
          confidence: 0.93,
        },
        promptTrace: { status: 'ok', structured_output_keys: 4, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
      }),
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const answer = artifact.answer_records[0];

    assert.equal(answer.question_id, 'q7_procurement_signal');
    assert.equal(answer.evidence_grade, 'weak');
    assert.equal(answer.confidence, 0.65);
    assert.deepEqual(answer.structured_signal, {
      vendor_changes: [],
      platform_migrations: [],
      partnerships: [],
      org_changes: [],
    });
    assert.match(answer.commercial_implication, /ecosystem|partner|vendor|platform/i);
    assert.equal(typeof answer.signal_density, 'number');
    assert.ok(answer.signal_density >= 0);
    assert.ok(answer.signal_density <= 1);
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch downgrades thin single-source hiring signals below strong evidence', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-commercial-q10-thin-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  writeFileSync(sourcePath, JSON.stringify({
    entity_id: 'livescore-group',
    entity_name: 'LiveScore Group',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'live-test',
    questions: [
      {
        question_id: 'q10_hiring_signal',
        question_type: 'hiring_signal',
        question_text: 'What hiring signals suggest current investment priorities for LiveScore Group?',
        query: '"LiveScore Group" careers jobs product engineering data',
        source_priority: ['careers', 'linkedin_jobs', 'google_serp', 'linkedin_posts', 'news', 'official_site'],
        hop_budget: 3,
      },
    ],
  }), 'utf8');

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async () => ({
        structuredOutput: {
          answer: 'LinkedIn shows a cluster of data and engineering openings.',
          context: 'Role mix suggests technical investment.',
          sources: ['https://www.linkedin.com/jobs/view/123'],
          confidence: 0.91,
          structured_signal: {
            open_roles_approx: 6,
            role_categories_observed: ['data', 'engineering'],
            geographic_expansion: [],
            acquisitions: [],
            market_exits: [],
            tech_partnerships: [],
          },
        },
        promptTrace: { status: 'ok', structured_output_keys: 6, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
      }),
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const answer = artifact.answer_records[0];

    assert.equal(answer.question_id, 'q10_hiring_signal');
    assert.notEqual(answer.evidence_grade, 'strong');
    assert.ok(answer.confidence <= 0.82);
    assert.ok(answer.signal_density < 0.9);
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch only grants strong procurement evidence when named multi-source signals exist', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-commercial-q7-strong-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  writeFileSync(sourcePath, JSON.stringify({
    entity_id: 'livescore-group',
    entity_name: 'LiveScore Group',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'live-test',
    questions: [
      {
        question_id: 'q7_procurement_signal',
        question_type: 'procurement_signal',
        question_text: 'Is there evidence LiveScore Group is buying, reshaping vendors, or changing its ecosystem?',
        query: '"LiveScore Group" platform migration provider partnership',
        source_priority: ['google_serp', 'news', 'press_release', 'official_site'],
        hop_budget: 3,
      },
    ],
  }), 'utf8');

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async () => ({
        structuredOutput: {
          answer: 'Kambi replaced the prior sportsbook engine and a separate partner expansion added new content suppliers.',
          context: 'Named vendor and partner changes are visible across press and company reporting.',
          sources: [
            'https://www.livescoregroup.com/press/kambi-migration',
            'https://www.sportbusiness.com/news/livescore-group-expands-partnership-network',
            'https://www.livescoregroup.com/news/vendor-update',
          ],
          confidence: 0.94,
          structured_signal: {
            vendor_changes: [
              {
                name: 'Kambi',
                evidence_url: 'https://www.livescoregroup.com/press/kambi-migration',
                evidence_kind: 'press_release',
                summary: 'Named sportsbook engine migration.',
              },
            ],
            platform_migrations: [
              {
                name: 'Sportsbook platform migration',
                evidence_url: 'https://www.livescoregroup.com/press/kambi-migration',
                evidence_kind: 'official_site',
                summary: 'Migration to a named provider is documented.',
              },
            ],
            partnerships: [
              {
                name: 'Hacksaw Gaming',
                evidence_url: 'https://www.sportbusiness.com/news/livescore-group-expands-partnership-network',
                evidence_kind: 'news',
                summary: 'Content supplier partnership expanded.',
              },
            ],
            org_changes: [],
          },
        },
        promptTrace: { status: 'ok', structured_output_keys: 6, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
      }),
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const answer = artifact.answer_records[0];

    assert.equal(answer.question_id, 'q7_procurement_signal');
    assert.equal(answer.evidence_grade, 'strong');
    assert.ok(answer.confidence > 0.82);
    assert.ok(answer.signal_density <= 1);
    assert.ok(answer.signal_density >= 0.45);
    assert.ok(answer.signal_density < 0.9);
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch keeps indirect multi-source procurement evidence as provisional instead of no_signal', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-commercial-q7-provisional-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  writeFileSync(sourcePath, JSON.stringify({
    entity_id: 'livescore-group',
    entity_name: 'LiveScore Group',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'live-test',
    questions: [
      {
        question_id: 'q7_procurement_signal',
        question_type: 'procurement_signal',
        question_text: 'Is there evidence LiveScore Group is buying, reshaping vendors, or changing its ecosystem?',
        query: '"LiveScore Group" platform migration provider partnership',
        source_priority: ['google_serp', 'news', 'press_release', 'linkedin_posts', 'official_site'],
        hop_budget: 3,
      },
    ],
  }), 'utf8');

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async () => ({
        structuredOutput: {
          answer: 'Multiple public sources suggest ecosystem reshaping through platform migration, partner additions, and regional launch activity, but the evidence does not cleanly prove a named procurement cycle.',
          context: 'Indirect multi-source signals point to commercial ecosystem change without a direct tender or explicit named vendor replacement record.',
          sources: [
            'https://www.livescoregroup.com/news/platform-update',
            'https://www.sportbusiness.com/news/livescore-group-partnership-expansion',
            'https://www.livescoregroup.com/launch/south-africa',
          ],
          confidence: 0.74,
          structured_signal: {
            vendor_changes: [],
            platform_migrations: [],
            partnerships: [],
            org_changes: [],
          },
        },
        promptTrace: { status: 'ok', structured_output_keys: 6, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
      }),
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const answer = artifact.answer_records[0];

    assert.equal(answer.question_id, 'q7_procurement_signal');
    assert.equal(answer.validation_state, 'provisional');
    assert.ok(answer.confidence > 0);
    assert.ok(answer.confidence <= 0.82);
    assert.ok(answer.evidence_grade === 'weak' || answer.evidence_grade === 'moderate');
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch downgrades q7 confirmed to provisional when named procurement buckets stay empty', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-commercial-q7-confirmed-cap-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  writeFileSync(sourcePath, JSON.stringify({
    entity_id: 'livescore-group',
    entity_name: 'LiveScore Group',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'live-test',
    questions: [
      {
        question_id: 'q7_procurement_signal',
        question_type: 'procurement_signal',
        question_text: 'Is there evidence LiveScore Group is buying, reshaping vendors, or changing its ecosystem?',
        query: '"LiveScore Group" platform migration provider partnership',
        source_priority: ['google_serp', 'news', 'press_release', 'linkedin_posts', 'official_site'],
        hop_budget: 3,
      },
    ],
  }), 'utf8');

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async () => ({
        structuredOutput: {
          answer: 'Yes. Multiple credible public sources suggest platform, partner, and market changes, but they do not explicitly prove a concrete named procurement cycle.',
          context: 'Indirect ecosystem-change evidence exists across company and trade reporting.',
          sources: [
            'https://www.livescoregroup.com/news/platform-update',
            'https://www.sportbusiness.com/news/livescore-group-partnership-expansion',
            'https://www.livescoregroup.com/launch/south-africa',
          ],
          confidence: 0.92,
          validation_state: 'confirmed',
          structured_signal: {
            vendor_changes: [],
            platform_migrations: [],
            partnerships: [],
            org_changes: [],
          },
        },
        promptTrace: { status: 'ok', structured_output_keys: 7, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
      }),
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const answer = artifact.answer_records[0];

    assert.equal(answer.question_id, 'q7_procurement_signal');
    assert.equal(answer.validation_state, 'provisional');
    assert.ok(answer.confidence <= 0.82);
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch does not treat commercial sponsorship as core procurement structure for q7', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-commercial-q7-sponsorship-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  writeFileSync(sourcePath, JSON.stringify({
    entity_id: 'livescore-group',
    entity_name: 'LiveScore Group',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'live-test',
    questions: [
      {
        question_id: 'q7_procurement_signal',
        question_type: 'procurement_signal',
        question_text: 'Is there evidence LiveScore Group is buying, reshaping vendors, or changing its ecosystem?',
        query: '"LiveScore Group" platform migration provider partnership',
        source_priority: ['google_serp', 'news', 'press_release', 'linkedin_posts', 'official_site'],
        hop_budget: 3,
      },
    ],
  }), 'utf8');

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async () => ({
        structuredOutput: {
          answer: 'A sponsorship expansion and restructuring indicate commercial motion, but no concrete vendor or platform procurement is visible.',
          context: 'Evidence points to commercial activity, not explicit procurement structure.',
          sources: [
            'https://example.com/sponsorship-news',
            'https://example.com/restructuring-news',
            'https://example.com/company-update',
          ],
          confidence: 0.9,
          validation_state: 'confirmed',
          structured_signal: {
            vendor_changes: [],
            platform_migrations: [],
            partnerships: [
              {
                name: 'Goodwood Racecourse sponsorship',
                evidence_url: 'https://example.com/sponsorship-news',
                evidence_kind: 'commercial_sponsorship',
                summary: 'Commercial sponsorship only.',
              },
            ],
            org_changes: [
              {
                name: 'Internal restructuring',
                evidence_url: 'https://example.com/restructuring-news',
                evidence_kind: 'restructuring',
                summary: 'Organisation change.',
              },
            ],
          },
        },
        promptTrace: { status: 'ok', structured_output_keys: 7, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
      }),
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const answer = artifact.answer_records[0];

    assert.equal(answer.question_id, 'q7_procurement_signal');
    assert.notEqual(answer.evidence_grade, 'strong');
    assert.equal(answer.validation_state, 'provisional');
    assert.ok(answer.signal_density < 0.8);
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch keeps q7 signal density below near-max for mixed vendor-partner-org evidence', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-commercial-q7-density-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  writeFileSync(sourcePath, JSON.stringify({
    entity_id: 'livescore-group',
    entity_name: 'LiveScore Group',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'live-test',
    questions: [
      {
        question_id: 'q7_procurement_signal',
        question_type: 'procurement_signal',
        question_text: 'Is there evidence LiveScore Group is buying, reshaping vendors, or changing its ecosystem?',
        query: '"LiveScore Group" platform migration provider partnership',
        source_priority: ['google_serp', 'news', 'press_release', 'linkedin_posts', 'official_site'],
        hop_budget: 3,
      },
    ],
  }), 'utf8');

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async () => ({
        structuredOutput: {
          answer: 'Named vendor, platform, partner, and org changes indicate ecosystem reshaping.',
          context: 'Concrete but mixed evidence exists across procurement-relevant and broader commercial changes.',
          sources: [
            'https://example.com/kambi-migration',
            'https://example.com/x-xai-partnership',
            'https://example.com/restructuring',
            'https://example.com/sponsorship',
          ],
          confidence: 0.92,
          structured_signal: {
            vendor_changes: [
              {
                name: 'SBTech to Kambi migration',
                evidence_url: 'https://example.com/kambi-migration',
                evidence_kind: 'platform_migration',
                summary: 'Named vendor change.',
              },
            ],
            platform_migrations: [
              {
                name: 'Kambi platform consolidation',
                evidence_url: 'https://example.com/kambi-migration',
                evidence_kind: 'platform_migration',
                summary: 'Named platform migration.',
              },
            ],
            partnerships: [
              {
                name: 'X and xAI strategic partnership',
                evidence_url: 'https://example.com/x-xai-partnership',
                evidence_kind: 'new_partnership',
                summary: 'Strategic product partnership.',
              },
              {
                name: 'Goodwood Racecourse sponsorship',
                evidence_url: 'https://example.com/sponsorship',
                evidence_kind: 'commercial_sponsorship',
                summary: 'Commercial sponsorship only.',
              },
            ],
            org_changes: [
              {
                name: 'Internal restructuring',
                evidence_url: 'https://example.com/restructuring',
                evidence_kind: 'restructuring',
                summary: 'Organisation change.',
              },
            ],
          },
        },
        promptTrace: { status: 'ok', structured_output_keys: 6, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
      }),
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const answer = artifact.answer_records[0];

    assert.equal(answer.question_id, 'q7_procurement_signal');
    assert.equal(answer.evidence_grade, 'strong');
    assert.ok(answer.signal_density < 0.9);
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch preserves the calibrated LiveScore commercial profile', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-commercial-livescore-profile-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  writeFileSync(sourcePath, JSON.stringify({
    entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
    entity_name: 'LiveScore Group (media)',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'livescore-group-media-atomic-matrix',
    questions: [
      {
        question_id: 'q7_procurement_signal',
        question_type: 'procurement_signal',
        question_text: 'Is there evidence LiveScore Group (media) is buying, reshaping vendors, or changing its commercial or digital ecosystem?',
        query: '"LiveScore Group (media)" platform migration provider partnership',
        source_priority: ['google_serp', 'news', 'press_release', 'linkedin_posts', 'official_site'],
        hop_budget: 3,
      },
      {
        question_id: 'q8_explicit_rfp',
        question_type: 'tender_docs',
        question_text: 'Are there published RFPs, tenders, or formal procurement documents for LiveScore Group (media)?',
        query: '"LiveScore Group (media)" RFP tender procurement',
        source_priority: ['google_serp', 'news', 'press_release', 'linkedin_posts', 'official_site'],
        hop_budget: 3,
        empty_result_policy: 'no_signal',
      },
      {
        question_id: 'q10_hiring_signal',
        question_type: 'hiring_signal',
        question_text: 'What hiring signals suggest current investment priorities for LiveScore Group (media)?',
        query: '"LiveScore Group (media)" careers jobs product engineering data',
        source_priority: ['careers', 'linkedin_jobs', 'google_serp', 'linkedin_posts', 'news', 'official_site'],
        hop_budget: 3,
        empty_result_policy: 'no_signal',
      },
    ],
  }), 'utf8');

  let callCount = 0;
  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async () => {
        callCount += 1;
        if (callCount === 1) {
          return {
            structuredOutput: {
              answer: 'LiveScore Group has executed a comprehensive vendor reshaping cycle through Kambi migration, strategic product partnerships, restructuring, and market exits.',
              context: 'Concrete named vendor, platform, and organisation changes point to procurement-relevant ecosystem reshaping.',
              sources: [
                'https://www.gamblinginsider.com/news/26217/livescore-group-brand-virgin-bet-fully-migrated-onto-kambi-platform',
                'https://www.kambi.com/news-insights/kambi-group-plc-agrees-sportsbook-partnership-with-sports-media-and-betting-giant-livescore-group/',
                'https://livescoregroup.com/press-news/livescore-group-announces-transformational-partnership-with-x-and-xai-to-drive-the-future-of-integrated-sports-media-and-betting/',
                'https://livescoregroup.com/press-news/livescore-group-announces-internal-restructuring/',
              ],
              confidence: 0.92,
              validation_state: 'confirmed',
              structured_signal: {
                vendor_changes: [
                  {
                    name: 'SBTech to Kambi migration',
                    evidence_url: 'https://www.gamblinginsider.com/news/26217/livescore-group-brand-virgin-bet-fully-migrated-onto-kambi-platform',
                    evidence_kind: 'platform_migration',
                    summary: 'Virgin Bet migrated from SBTech to Kambi.',
                  },
                  {
                    name: 'New tech supplier migration',
                    evidence_url: 'https://www.egr.global/intel/insight/livescore-group-ceo-investors-love-our-very-boring-and-steady-growth/',
                    evidence_kind: 'executive_statement',
                    summary: 'CEO confirmed migration to a new supplier.',
                  },
                ],
                platform_migrations: [
                  {
                    name: 'LiveScore Bet to Kambi sportsbook',
                    evidence_url: 'https://www.kambi.com/news-insights/kambi-group-plc-agrees-sportsbook-partnership-with-sports-media-and-betting-giant-livescore-group/',
                    evidence_kind: 'partnership_agreement',
                    summary: 'Long-term Kambi partnership.',
                  },
                  {
                    name: 'Virgin Bet to Kambi sportsbook',
                    evidence_url: 'https://www.kambi.com/news-insights/kambi-and-livescore-group-complete-virgin-bet-sportsbook-migration/',
                    evidence_kind: 'platform_migration',
                    summary: 'Migration completed in July 2024.',
                  },
                ],
                partnerships: [
                  {
                    name: 'X and xAI',
                    evidence_url: 'https://livescoregroup.com/press-news/livescore-group-announces-transformational-partnership-with-x-and-xai-to-drive-the-future-of-integrated-sports-media-and-betting/',
                    evidence_kind: 'strategic_partnership',
                    summary: 'AI and content partnership.',
                  },
                  {
                    name: 'Ringier AG strategic investment',
                    evidence_url: 'https://www.prnewswire.com/news-releases/livescore-group-to-accelerate-global-expansion-following-50-million-strategic-investment-from-ringier-ag-301618498.html',
                    evidence_kind: 'strategic_investment',
                    summary: 'Strategic investment supporting expansion.',
                  },
                  {
                    name: 'WalkSafe (Virgin Bet)',
                    evidence_url: 'https://livescoregroup.com/press-news/',
                    evidence_kind: 'brand_partnership',
                    summary: 'Brand partnership.',
                  },
                ],
                org_changes: [
                  {
                    name: 'Internal restructuring - 100+ roles impacted',
                    evidence_url: 'https://livescoregroup.com/press-news/livescore-group-announces-internal-restructuring/',
                    evidence_kind: 'restructuring',
                    summary: 'Streamlining for sustainable growth.',
                  },
                  {
                    name: 'Netherlands market exit',
                    evidence_url: 'https://www.egr.global/intel/insight/livescore-group-ceo-investors-love-our-very-boring-and-steady-growth/',
                    evidence_kind: 'market_exit',
                    summary: 'Exit from Netherlands market.',
                  },
                ],
              },
              commercial_implication: 'Ecosystem reshaping indicates active vendor and platform decision-making.',
            },
            promptTrace: { status: 'ok', structured_output_keys: 7, has_structured_output: true },
            messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
            cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
          };
        }
        if (callCount === 2) {
          return {
            structuredOutput: {
              answer: '',
              context: 'No public procurement entry point is visible.',
              sources: [
                'https://www.contractsfinder.service.gov.uk/',
                'https://sam.gov/',
              ],
              confidence: 0,
              validation_state: 'no_signal',
              evidence_grade: 'weak',
              procurement_model: 'private_direct',
              commercial_implication: 'LiveScore appears to buy via direct private negotiation rather than open tender.',
            },
            promptTrace: { status: 'ok', structured_output_keys: 6, has_structured_output: true },
            messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
            cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
          };
        }
        return {
          structuredOutput: {
            answer: 'A moderate set of hiring signals points to engineering, compliance, and commercial investment priorities.',
            context: 'Hiring points to product, data, compliance, and market expansion priorities.',
            sources: [
              'https://www.linkedin.com/jobs/view/123',
              'https://www.linkedin.com/jobs/view/456',
              'https://www.linkedin.com/jobs/view/789',
            ],
            confidence: 0.72,
            validation_state: 'provisional',
            evidence_grade: 'moderate',
            structured_signal: {
              open_roles_approx: 20,
              role_clusters: ['product_engineering', 'data_analytics', 'compliance_risk', 'commercial_marketing'],
              brands_hiring_for: ['LiveScore', 'LiveScore Bet', 'Virgin Bet'],
              geographies_with_new_licenses: ['South Africa', 'Bulgaria', 'Nigeria'],
            },
            commercial_implication: 'Hiring mix suggests investment in product, compliance, and commercial scale-up.',
          },
          promptTrace: { status: 'ok', structured_output_keys: 7, has_structured_output: true },
          messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
          cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
        };
      },
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const answers = new Map(artifact.answer_records.map((answer) => [answer.question_id, answer]));

    const q7 = answers.get('q7_procurement_signal');
    const q8 = answers.get('q8_explicit_rfp');
    const q10 = answers.get('q10_hiring_signal');

    assert.equal(q7.evidence_grade, 'strong');
    assert.ok(q7.signal_density >= 0.55);
    assert.ok(q7.signal_density <= 0.7);
    assert.notEqual(q7.signal_density, 0.98);
    assert.equal(q8.validation_state, 'no_signal');
    assert.equal(q10.validation_state, 'provisional');
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch keeps q7 density bounded for partner-heavy LiveScore evidence mixes', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-commercial-q7-live-mix-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  writeFileSync(sourcePath, JSON.stringify({
    entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
    entity_name: 'LiveScore Group (media)',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'livescore-group-media-atomic-matrix',
    questions: [
      {
        question_id: 'q7_procurement_signal',
        question_type: 'procurement_signal',
        question_text: 'Is there evidence LiveScore Group (media) is buying, reshaping vendors, or changing its commercial or digital ecosystem?',
        query: '"LiveScore Group (media)" platform migration provider partnership',
        source_priority: ['google_serp', 'news', 'press_release', 'linkedin_posts', 'official_site'],
        hop_budget: 3,
      },
    ],
  }), 'utf8');

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async () => ({
        structuredOutput: {
          answer: 'LiveScore Group shows named vendor, platform, partner, and organisational changes, but much of the evidence is broader ecosystem change rather than direct procurement.',
          context: 'This mirrors the noisier live evidence mix where q7 was still coming through too hot.',
          sources: [
            'https://example.com/kambi-migration',
            'https://example.com/wonderlabz-acquisition',
            'https://example.com/x-xai-partnership',
            'https://example.com/ringier-investment',
            'https://example.com/streamamg-partnership',
            'https://example.com/sunderland-sponsorship',
            'https://example.com/bulgaria-exit',
            'https://example.com/south-africa-entry',
          ],
          confidence: 0.92,
          validation_state: 'validated',
          structured_signal: {
            vendor_changes: [
              {
                name: 'Kambi Group plc',
                evidence_url: 'https://example.com/kambi-migration',
                evidence_kind: 'platform_migration_vendor_replacement',
                summary: 'Named migration away from a previous vendor.',
              },
              {
                name: 'Wonderlabz',
                evidence_url: 'https://example.com/wonderlabz-acquisition',
                evidence_kind: 'acquisition',
                summary: 'Acquisition adds product capability but is not direct procurement.',
              },
            ],
            platform_migrations: [
              {
                name: 'Kambi turnkey sportsbook migration',
                evidence_url: 'https://example.com/kambi-migration',
                evidence_kind: 'completed_migration',
                summary: 'Named platform migration.',
              },
            ],
            partnerships: [
              {
                name: 'X and xAI partnership',
                evidence_url: 'https://example.com/x-xai-partnership',
                evidence_kind: 'strategic_technology_and_media_partnership',
                summary: 'Strategic media and AI partnership.',
              },
              {
                name: 'Ringier AG',
                evidence_url: 'https://example.com/ringier-investment',
                evidence_kind: 'strategic_investment_partnership',
                summary: 'Strategic investment partnership.',
              },
              {
                name: 'StreamAMG',
                evidence_url: 'https://example.com/streamamg-partnership',
                evidence_kind: 'technology_vendor_partnership',
                summary: 'Technology partner relationship.',
              },
              {
                name: 'Sunderland AFC',
                evidence_url: 'https://example.com/sunderland-sponsorship',
                evidence_kind: 'commercial_sponsorship_deal',
                summary: 'Commercial sponsorship deal.',
              },
            ],
            org_changes: [
              {
                name: 'Virgin Group shareholder investment',
                evidence_url: 'https://example.com/ringier-investment',
                evidence_kind: 'equity_investment',
                summary: 'Shareholder investment, not direct procurement.',
              },
              {
                name: 'Bulgaria market exit',
                evidence_url: 'https://example.com/bulgaria-exit',
                evidence_kind: 'market_withdrawal',
                summary: 'Market withdrawal.',
              },
              {
                name: 'Netherlands market exit',
                evidence_url: 'https://example.com/bulgaria-exit',
                evidence_kind: 'market_withdrawal',
                summary: 'Market withdrawal.',
              },
              {
                name: 'South Africa market entry',
                evidence_url: 'https://example.com/south-africa-entry',
                evidence_kind: 'geographic_expansion',
                summary: 'Geographic expansion.',
              },
              {
                name: 'Four-day work week',
                evidence_url: 'https://example.com/bulgaria-exit',
                evidence_kind: 'organizational_policy_change',
                summary: 'Policy change, not procurement.',
              },
            ],
          },
        },
        promptTrace: { status: 'ok', structured_output_keys: 6, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
      }),
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const answer = artifact.answer_records[0];

    assert.equal(answer.question_id, 'q7_procurement_signal');
    assert.equal(answer.evidence_grade, 'strong');
    assert.ok(answer.signal_density <= 0.7);
    assert.notEqual(answer.signal_density, 0.78);
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch recalibrates model-claimed strong hiring evidence when support is thin', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-commercial-q10-recalibrate-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  writeFileSync(sourcePath, JSON.stringify({
    entity_id: 'livescore-group',
    entity_name: 'LiveScore Group',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'live-test',
    questions: [
      {
        question_id: 'q10_hiring_signal',
        question_type: 'hiring_signal',
        question_text: 'What hiring signals suggest current investment priorities for LiveScore Group?',
        query: '"LiveScore Group" careers jobs product engineering data',
        source_priority: ['careers', 'linkedin_jobs', 'google_serp', 'linkedin_posts', 'news', 'official_site'],
        hop_budget: 3,
      },
    ],
  }), 'utf8');

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async () => ({
        structuredOutput: {
          answer: 'A handful of hiring signals suggest technical investment.',
          context: 'Only limited public role evidence is visible.',
          sources: [
            'https://www.linkedin.com/jobs/view/123',
            'https://www.linkedin.com/jobs/view/456',
          ],
          confidence: 0.55,
          evidence_grade: 'strong',
          structured_signal: {
            open_roles_approx: 3,
            role_categories_observed: ['data', 'engineering'],
            geographic_expansion: ['South Africa'],
            acquisitions: [],
            market_exits: ['Bulgaria'],
            tech_partnerships: ['xAI'],
          },
        },
        promptTrace: { status: 'ok', structured_output_keys: 7, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
      }),
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const answer = artifact.answer_records[0];

    assert.equal(answer.question_id, 'q10_hiring_signal');
    assert.notEqual(answer.evidence_grade, 'strong');
    assert.ok(answer.signal_density < 0.9);
    assert.equal(answer.confidence, 0.55);
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch downgrades weak q10 hiring evidence from validated to provisional', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-commercial-q10-validated-cap-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  writeFileSync(sourcePath, JSON.stringify({
    entity_id: 'livescore-group',
    entity_name: 'LiveScore Group',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'live-test',
    questions: [
      {
        question_id: 'q10_hiring_signal',
        question_type: 'hiring_signal',
        question_text: 'What hiring signals suggest current investment priorities for LiveScore Group?',
        query: '"LiveScore Group" careers jobs product engineering data',
        source_priority: ['careers', 'linkedin_jobs', 'google_serp', 'linkedin_posts', 'news', 'official_site'],
        hop_budget: 3,
      },
    ],
  }), 'utf8');

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      questionRunner: async () => ({
        structuredOutput: {
          answer: 'Some hiring is visible across multiple functions.',
          context: 'Hiring exists, but the public evidence is broad and not specific enough for a validated commercial conclusion.',
          sources: [
            'https://www.linkedin.com/jobs/view/123',
            'https://www.linkedin.com/jobs/view/456',
            'https://www.linkedin.com/jobs/view/789',
          ],
          confidence: 0.65,
          validation_state: 'validated',
          evidence_grade: 'weak',
          structured_signal: {
            total_open_roles: 19,
            by_function: {
              data_analytics: 3,
              media_content: 3,
              betting_gaming_ops: 3,
            },
          },
        },
        promptTrace: { status: 'ok', structured_output_keys: 7, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
      }),
    });

    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const answer = artifact.answer_records[0];

    assert.equal(answer.question_id, 'q10_hiring_signal');
    assert.equal(answer.evidence_grade, 'weak');
    assert.equal(answer.validation_state, 'provisional');
    assert.equal(answer.confidence, 0.65);
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch normalizes question text from atomic question sources', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-question-source-normalized-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';
  const events = [];

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'zamalek-sc',
        entity_name: 'Zamalek SC',
        entity_type: 'SPORT_CLUB',
        preset: 'zamalek-sc-atomic',
        questions: [
          {
            question_id: 'q11_decision_owner',
            question_type: 'decision_owner',
            question: 'Who is the highest probability buyer at Zamalek SC given the current commercial and product context?',
            query: '"Zamalek SC" commercial partnerships business development leadership',
            hop_budget: 1,
            source_priority: ['google_serp', 'linkedin_posts'],
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  try {
    await runOpenCodeQuestionSourceBatch({
      questionSourcePath: sourcePath,
      outputDir,
      onProgress: async (event) => {
        events.push(event);
      },
      questionRunner: async (question) => ({
        structuredOutput: {
          question: question.question_text,
          answer: 'stubbed',
          context: '',
          sources: [],
          confidence: 0.5,
        },
        promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
      }),
    });

    assert.equal(events[0].current_question_id, 'q11_decision_owner');
    assert.equal(
      events[0].current_question_text,
      'Who is the highest probability buyer at Zamalek SC given the current commercial and product context?',
    );
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch emits per-question progress events before completion', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-progress-'));
  const sourcePath = join(outputDir, 'source.json');

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'major-league-cricket',
        entity_name: 'Major League Cricket',
        entity_type: 'SPORT_LEAGUE',
        questions: [
          {
            question_id: 'q1',
            question_type: 'foundation',
            question_text: 'When was Major League Cricket founded?',
            query: '"Major League Cricket" founded',
            hop_budget: 2,
            source_priority: ['google_serp'],
          },
          {
            question_id: 'q2',
            question_type: 'procurement',
            question_text: 'What platform initiatives is Major League Cricket pursuing?',
            query: '"Major League Cricket" platform',
            hop_budget: 2,
            source_priority: ['google_serp'],
          },
        ],
      },
      null,
      2,
    ),
  );

  const events = [];
  const result = await runOpenCodeQuestionSourceBatch({
    questionSourcePath: sourcePath,
    outputDir,
    onProgress: (event) => {
      events.push(event);
    },
    questionRunner: async (question) => ({
      structuredOutput: {
        answer: `stub-${question.question_id}`,
        signal_type: 'NO_SIGNAL',
        confidence: 0,
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

  assert.equal(result.questions_total, 2);
  assert.equal(events.length, 3);
  assert.deepEqual(
    events.map((event) => event.event_type),
    ['question_progress', 'question_progress', 'batch_complete'],
  );
  assert.equal(events[0].current_question_id, 'q1');
  assert.equal(events[0].current_question_text, 'When was Major League Cricket founded?');
  assert.equal(events[0].current_execution_state, 'searching sources');
  assert.deepEqual(events[0].current_source_order, ['google_serp']);
  assert.equal(events[0].current_substep, 'question_first_running');
  assert.equal(events[0].current_substep_progress, '1/2 questions');
  assert.equal(events[1].current_question_id, 'q2');
  assert.equal(events[2].current_substep, 'question_first_completed');
  assert.equal(events[2].questions_total, 2);
});

test('runOpenCodeQuestionSourceBatch defaults standalone timeout to 60000ms', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-standalone-timeout-default-'));
  const sourcePath = join(outputDir, 'source.json');

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'major-league-cricket',
        entity_name: 'Major League Cricket',
        entity_type: 'SPORT_LEAGUE',
        questions: [
          {
            question_id: 'q7_procurement_signal',
            question_type: 'procurement_signal',
            question_text: 'Is there evidence of vendor or ecosystem change?',
            query: '"Major League Cricket" vendor platform partnership',
            hop_budget: 1,
            source_priority: ['google_serp'],
          },
        ],
      },
      null,
      2,
    ),
  );

  let seenTimeoutMs = null;
  let seenStandaloneHarness = null;
  await runOpenCodeQuestionSourceBatch({
    questionSourcePath: sourcePath,
    outputDir,
    questionRunner: async (_question, options) => {
      seenTimeoutMs = options.opencodeTimeoutMs;
      seenStandaloneHarness = options.standaloneHarness;
      return {
        structuredOutput: {
          answer: '',
          signal_type: 'NO_SIGNAL',
          confidence: 0,
          validation_state: 'no_signal',
          evidence_url: '',
          recommended_next_query: '',
          notes: 'stubbed',
        },
        promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
        messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 0, stdout: '', stderr: '' },
      };
    },
  });

  assert.equal(seenTimeoutMs, 60000);
  assert.equal(seenStandaloneHarness, true);
});

test('runOpenCodeQuestionSourceBatch resolves successful empty q8 and q10 searches to no_signal', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-no-signal-'));
  const sourcePath = join(outputDir, 'source.json');

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'live-score',
        entity_name: 'LiveScore Group (media)',
        entity_type: 'MEDIA',
        questions: [
          {
            question_id: 'q8_explicit_rfp',
            question_type: 'tender_docs',
            question_text: 'Are there published RFPs, tenders, or formal procurement documents for LiveScore Group (media)?',
            query: '"LiveScore Group (media)" RFP tender procurement',
            hop_budget: 2,
            source_priority: ['google_serp', 'news'],
            empty_result_policy: 'no_signal',
          },
          {
            question_id: 'q10_hiring_signal',
            question_type: 'hiring_signal',
            question_text: 'What hiring signals suggest current investment priorities for LiveScore Group (media)?',
            query: '"LiveScore Group (media)" careers hiring product marketing engineering',
            hop_budget: 2,
            source_priority: ['careers', 'linkedin_jobs', 'google_serp'],
            empty_result_policy: 'no_signal',
          },
        ],
      },
      null,
      2,
    ),
  );

  const result = await runOpenCodeQuestionSourceBatch({
    questionSourcePath: sourcePath,
    outputDir,
    questionRunner: async () => ({
      structuredOutput: {},
      promptTrace: { exit_code: 0, has_structured_output: false },
      messageTrace: [],
      cliResult: { code: 0, stdout: '', stderr: '' },
    }),
  });

  const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
  const answers = artifact.answer_records.map((record) => [record.question_id, record.validation_state]);
  assert.deepEqual(answers, [
    ['q8_explicit_rfp', 'no_signal'],
    ['q10_hiring_signal', 'no_signal'],
  ]);
});

test('runOpenCodePresetBatch supports the POI-only preset', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-poi-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';
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
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodePresetBatch supports the POI batch A preset', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-poi-a-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';
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
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodePresetBatch supports the POI batch B preset', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-poi-b-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';
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
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodePresetBatch supports the POI batch C preset', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-poi-c-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';
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
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodePresetBatch persists explicit credit and confidence overrides', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-budget-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

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
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});


test('runOpenCodePresetBatch marks successful empty structured output as no_signal', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-missing-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

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
    assert.equal(result.questions_no_signal, 2);
    assert.equal(meta.questions[0].validation_state, 'no_signal');
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodePresetBatch keeps tool_call_missing for true execution failure', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-exec-failure-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      questionRunner: async () => ({
        structuredOutput: {},
        promptTrace: { status: 'error', structured_output_keys: 0, has_structured_output: false },
        messageTrace: [{ role: 'assistant', completed: false, type: 'cli-run', has_structured_output: false, part_count: 1 }],
        cliResult: { code: 1, stdout: '', stderr: 'child failed' },
      }),
    });

    const meta = JSON.parse(readFileSync(result.meta_result_path, 'utf8'));
    assert.equal(meta.questions[0].validation_state, 'tool_call_missing');
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodePresetBatch classifies recovered structured timeout output instead of tool_call_missing', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-recovered-timeout-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  try {
    const result = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      questionRunner: async (question) => ({
        structuredOutput: {
          question: question.question_text,
          answer: '2023',
          context: 'Recovered from completed BrightData evidence after OpenCode timeout.',
          sources: ['https://www.majorleaguecricket.com/about'],
          confidence: 0.85,
          validation_state: 'validated',
        },
        promptTrace: { recovered_from_failure: true, failure_name: 'OpenCodeTimeoutError' },
        messageTrace: [{ role: 'assistant', completed: false, type: 'cli-run', has_structured_output: true, part_count: 1 }],
        cliResult: { code: 124, stdout: 'partial stdout', stderr: '' },
      }),
    });

    const meta = JSON.parse(readFileSync(result.meta_result_path, 'utf8'));
    assert.equal(meta.questions[0].validation_state, 'validated');
    assert.equal(meta.questions[0].answer, '2023');
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});


test('runOpenCodePresetBatch stores prompt response trace when available', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-trace-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

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
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});


test('runOpenCodePresetBatch resumes from persisted validated state without re-running questions', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-resume-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';
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
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});


test('runOpenCodePresetBatch consumes queued frontier items on resume', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-frontier-resume-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';
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
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});


test('runOpenCodePresetBatch expands the frontier from accepted sources and next queries', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-frontier-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

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
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch persists timeout diagnostics for failed questions', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-timeout-diagnostics-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  const questionSourcePath = join(outputDir, 'question-source.json');
  writeFileSync(questionSourcePath, JSON.stringify({
    entity_name: 'LiveScore Group (media)',
    entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'atomic-matrix',
    questions: [
      {
        question_id: 'q1_foundation',
        question_text: 'What is the canonical identity and grounding profile for LiveScore Group (media)?',
        question_type: 'foundation',
        query: '"LiveScore Group (media)" official website founded year',
        entity_name: 'LiveScore Group (media)',
        entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
        entity_type: 'RIGHTS_HOLDER',
        preset: 'atomic-matrix',
        hop_budget: 1,
        source_priority: ['google_serp', 'official_site', 'wikipedia'],
      },
    ],
  }, null, 2), 'utf8');

  try {
    await assert.rejects(
      runOpenCodeQuestionSourceBatch({
        questionSourcePath,
        outputDir,
        questionRunner: async () => {
          const error = new Error('opencode run timed out after 300000ms');
          error.stdout = 'partial stdout';
          error.stderr = 'partial stderr';
          throw error;
        },
      }),
      /300000ms/,
    );

    const trackerFile = readdirSync(outputDir).find((entry) => entry.endsWith('_tracker.json'));
    assert.ok(trackerFile);
    const trackerPath = join(outputDir, trackerFile);
    const tracker = JSON.parse(readFileSync(trackerPath, 'utf8'));
    assert.equal(tracker.status, 'failed');
    assert.equal(tracker.current_question_id, 'q1_foundation');
    assert.equal(
      tracker.current_question_text,
      'What is the canonical identity and grounding profile for LiveScore Group (media)?',
    );
    assert.ok(tracker.diagnostic_stdout_path);
    assert.ok(tracker.diagnostic_stderr_path);
    assert.equal(readFileSync(tracker.diagnostic_stdout_path, 'utf8'), 'partial stdout');
    assert.equal(readFileSync(tracker.diagnostic_stderr_path, 'utf8'), 'partial stderr');
    assert.equal(tracker.events.at(-1).type, 'run_failed');
    assert.equal(tracker.events.at(-1).current_question_id, 'q1_foundation');
    assert.equal(tracker.failure_signature, null);
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch classifies loop-after-MCP-start failures for standalone harness runs', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-timeout-loop-diagnostics-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  const questionSourcePath = join(outputDir, 'question-source.json');
  writeFileSync(questionSourcePath, JSON.stringify({
    entity_name: 'LiveScore Group (media)',
    entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'atomic-matrix',
    questions: [
      {
        question_id: 'q7_procurement_signal',
        question_text: 'Is there evidence LiveScore Group (media) is buying, reshaping vendors, or changing its commercial or digital ecosystem?',
        question_type: 'procurement_signal',
        query: '"LiveScore Group (media)" platform migration provider partnership',
        entity_name: 'LiveScore Group (media)',
        entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
        entity_type: 'RIGHTS_HOLDER',
        preset: 'atomic-matrix',
        hop_budget: 1,
        source_priority: ['google_serp', 'news'],
      },
    ],
  }, null, 2), 'utf8');

  try {
    await assert.rejects(
      runOpenCodeQuestionSourceBatch({
        questionSourcePath,
        outputDir,
        directBrightDataRunner: null,
        questionRunner: async () => {
          const error = new Error('opencode run timed out after 60000ms');
          error.stdout = '{"type":"step_start"}\n{"type":"step_finish"}\n{"type":"step_start"}';
          error.stderr = 'INFO service=mcp key=brightData toolCount=62 create() successfully created client\n';
          throw error;
        },
      }),
      /60000ms/,
    );

    const trackerFile = readdirSync(outputDir).find((entry) => entry.endsWith('_tracker.json'));
    assert.ok(trackerFile);
    const trackerPath = join(outputDir, trackerFile);
    const tracker = JSON.parse(readFileSync(trackerPath, 'utf8'));
    assert.equal(tracker.failure_signature, 'loop_after_mcp_start_no_productive_progress');
    assert.deepEqual(tracker.tool_progress_summary, {
      step_count: 2,
      brightdata_client_started: true,
      no_productive_progress: true,
    });
    assert.equal(tracker.brightdata_tool_call_count, 0);
    assert.equal(tracker.brightdata_source_count, 0);
    assert.equal(tracker.events.at(-1).failure_signature, 'loop_after_mcp_start_no_productive_progress');
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch aborts standalone harness runs early once post-MCP stall is proven', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-early-stall-abort-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  const questionSourcePath = join(outputDir, 'question-source.json');
  writeFileSync(questionSourcePath, JSON.stringify({
    entity_name: 'LiveScore Group (media)',
    entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'atomic-matrix',
    questions: [
      {
        question_id: 'q7_procurement_signal',
        question_text: 'Is there evidence LiveScore Group (media) is buying, reshaping vendors, or changing its commercial or digital ecosystem?',
        question_type: 'procurement_signal',
        query: '"LiveScore Group (media)" platform migration provider partnership',
        entity_name: 'LiveScore Group (media)',
        entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
        entity_type: 'RIGHTS_HOLDER',
        preset: 'atomic-matrix',
        hop_budget: 1,
        source_priority: ['google_serp', 'news'],
      },
    ],
  }, null, 2), 'utf8');

  try {
    await assert.rejects(
      runOpenCodeQuestionSourceBatch({
        questionSourcePath,
        outputDir,
        directBrightDataRunner: null,
        questionRunner: async () => {
          const error = new Error('opencode standalone harness stalled after BrightData MCP startup without productive progress');
          error.name = 'OpenCodeHarnessStallError';
          error.stdout = Array.from({ length: 8 }, () => '{"type":"step_start"}\n{"type":"step_finish"}').join('\n');
          error.stderr = 'INFO service=mcp key=brightData toolCount=62 create() successfully created client\n';
          throw error;
        },
      }),
      /without productive progress/,
    );

    const trackerFile = readdirSync(outputDir).find((entry) => entry.endsWith('_tracker.json'));
    assert.ok(trackerFile);
    const trackerPath = join(outputDir, trackerFile);
    const tracker = JSON.parse(readFileSync(trackerPath, 'utf8'));
    assert.equal(tracker.failure_signature, 'loop_after_mcp_start_no_productive_progress');
    assert.equal(tracker.tool_progress_summary.step_count, 8);
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch falls back to direct BrightData retrieval after a standalone q7 stall and continues q8/q10', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-standalone-direct-brightdata-fallback-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  const questionSourcePath = join(outputDir, 'question-source.json');
  writeFileSync(questionSourcePath, JSON.stringify({
    entity_name: 'LiveScore Group (media)',
    entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'atomic-matrix',
    questions: [
      {
        question_id: 'q7_procurement_signal',
        question_text: 'Is there evidence LiveScore Group (media) is buying, reshaping vendors, or changing its commercial or digital ecosystem?',
        question_type: 'procurement_signal',
        query: '"LiveScore Group (media)" platform migration provider partnership',
        entity_name: 'LiveScore Group (media)',
        entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
        entity_type: 'RIGHTS_HOLDER',
        preset: 'atomic-matrix',
        hop_budget: 1,
        source_priority: ['google_serp', 'news'],
      },
      {
        question_id: 'q8_explicit_rfp',
        question_text: 'Are there published RFPs, tenders, or formal procurement documents for LiveScore Group (media)?',
        question_type: 'tender_docs',
        query: '"LiveScore Group (media)" RFP tender procurement',
        entity_name: 'LiveScore Group (media)',
        entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
        entity_type: 'RIGHTS_HOLDER',
        preset: 'atomic-matrix',
        hop_budget: 1,
        source_priority: ['google_serp', 'news'],
        empty_result_policy: 'no_signal',
      },
      {
        question_id: 'q10_hiring_signal',
        question_text: 'What public hiring evidence suggests current investment priorities for LiveScore Group (media)?',
        question_type: 'hiring_signal',
        query: '"LiveScore Group (media)" careers hiring product marketing engineering',
        entity_name: 'LiveScore Group (media)',
        entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
        entity_type: 'RIGHTS_HOLDER',
        preset: 'atomic-matrix',
        hop_budget: 1,
        source_priority: ['careers', 'linkedin_jobs', 'google_serp'],
        empty_result_policy: 'no_signal',
      },
    ],
  }, null, 2), 'utf8');

  const seenFallbackQuestions = [];
  const seenQuestionRunnerQuestions = [];

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath,
      outputDir,
      questionRunner: async (question) => {
        seenQuestionRunnerQuestions.push(question.question_id);
        if (question.question_id === 'q7_procurement_signal') {
          const error = new Error('opencode standalone harness stalled after BrightData MCP startup without productive progress');
          error.name = 'OpenCodeHarnessStallError';
          error.stdout = Array.from({ length: 8 }, () => '{"type":"step_start"}\n{"type":"step_finish"}').join('\n');
          error.stderr = 'INFO service=mcp key=brightData toolCount=62 create() successfully created client\n';
          throw error;
        }
        if (question.question_id === 'q8_explicit_rfp') {
          return {
            structuredOutput: {
              question: question.question_text,
              answer: '',
              context: 'No public RFP or tender evidence found.',
              sources: [],
              confidence: 0,
            },
            promptTrace: { fallback: false },
            messageTrace: [],
            cliResult: { code: 0, stdout: '', stderr: '' },
          };
        }
        return {
          structuredOutput: {
            question: question.question_text,
            answer: 'LiveScore shows hiring across product and engineering roles.',
            context: 'Careers and LinkedIn roles point to product and engineering investment.',
            sources: [
              'https://www.linkedin.com/company/livescore-group/jobs/',
              'https://www.livescoregroup.com/careers/',
            ],
            confidence: 0.6,
          },
          promptTrace: { fallback: false },
          messageTrace: [],
          cliResult: { code: 0, stdout: '', stderr: '' },
        };
      },
      directBrightDataRunner: async (question, diagnostics) => {
        seenFallbackQuestions.push(question.question_id);
        assert.equal(question.question_id, 'q7_procurement_signal');
        assert.equal(diagnostics.failure_signature, 'loop_after_mcp_start_no_productive_progress');
        return {
          structuredOutput: {
            question: question.question_text,
            answer: 'LiveScore shows vendor and platform-change evidence through Kambi and xAI-linked ecosystem moves.',
            context: 'Direct BrightData fallback retrieved vendor and ecosystem evidence after the standalone OpenCode loop stalled.',
            sources: [
              'https://www.kambi.com/news/live-score-partnership',
              'https://www.livescoregroup.com/news/live-score-xai-partnership',
            ],
            confidence: 0.74,
            structured_signal: {
              vendor_changes: [
                {
                  name: 'Kambi partnership',
                  evidence_url: 'https://www.kambi.com/news/live-score-partnership',
                  evidence_kind: 'vendor_change',
                  summary: 'Kambi-related sportsbook platform evidence.',
                },
              ],
              platform_migrations: [
                {
                  name: 'Sportsbook platform migration',
                  evidence_url: 'https://www.kambi.com/news/live-score-partnership',
                  evidence_kind: 'platform_migration',
                  summary: 'Platform change evidence surfaced in the fallback search.',
                },
              ],
              partnerships: [
                {
                  name: 'xAI partnership',
                  evidence_url: 'https://www.livescoregroup.com/news/live-score-xai-partnership',
                  evidence_kind: 'strategic_partnership',
                  summary: 'Ecosystem and product partnership signal.',
                },
              ],
              org_changes: [],
            },
            evidence_grade: 'moderate',
          },
          promptTrace: {
            fallback: true,
            fallback_mode: 'direct_brightdata',
          },
          messageTrace: [],
          cliResult: { code: 0, stdout: '', stderr: '' },
        };
      },
    });

    assert.deepEqual(seenFallbackQuestions, ['q7_procurement_signal']);
    assert.deepEqual(seenQuestionRunnerQuestions, [
      'q7_procurement_signal',
      'q8_explicit_rfp',
      'q10_hiring_signal',
    ]);

    const meta = JSON.parse(readFileSync(result.meta_result_path, 'utf8'));
    assert.equal(meta.questions.length, 3);
    const q7 = meta.questions.find((item) => item.question_id === 'q7_procurement_signal');
    const q8 = meta.questions.find((item) => item.question_id === 'q8_explicit_rfp');
    const q10 = meta.questions.find((item) => item.question_id === 'q10_hiring_signal');
    assert.ok(q7);
    assert.ok(q8);
    assert.ok(q10);
    assert.match(q7.answer, /Kambi/i);
    assert.equal(q7.prompt_trace.fallback_mode, 'direct_brightdata');
    assert.equal(q8.validation_state, 'no_signal');
    assert.equal(q10.validation_state, 'provisional');

    const trackerFile = readdirSync(outputDir).find((entry) => entry.endsWith('_tracker.json'));
    assert.ok(trackerFile);
    const tracker = JSON.parse(readFileSync(join(outputDir, trackerFile), 'utf8'));
    assert.equal(tracker.status, 'completed');
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch falls back to direct BrightData retrieval for normal q7 stalls', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-normal-direct-brightdata-fallback-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  const questionSourcePath = join(outputDir, 'question-source.json');
  writeFileSync(questionSourcePath, JSON.stringify({
    entity_name: 'LiveScore Group (media)',
    entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
    entity_type: 'RIGHTS_HOLDER',
    preset: 'atomic-matrix',
    questions: [
      {
        question_id: 'q7_procurement_signal',
        question_text: 'Is there evidence LiveScore Group (media) is buying, reshaping vendors, or changing its commercial or digital ecosystem?',
        question_type: 'procurement_signal',
        query: '"LiveScore Group (media)" platform migration provider partnership',
        entity_name: 'LiveScore Group (media)',
        entity_id: '20f0fe7c-52af-4a90-9c2e-ccada5d76686',
        entity_type: 'RIGHTS_HOLDER',
        preset: 'atomic-matrix',
        hop_budget: 1,
        source_priority: ['google_serp', 'news'],
      },
    ],
  }, null, 2), 'utf8');

  const seenFallbackQuestions = [];

  try {
    const result = await runOpenCodeQuestionSourceBatch({
      questionSourcePath,
      outputDir,
      standaloneHarness: false,
      questionRunner: async () => {
        const error = new Error('opencode run timed out after 300000ms');
        error.name = 'OpenCodeTimeoutError';
        error.stdout = '{"type":"step_start"}\n{"type":"step_finish"}';
        error.stderr = 'INFO service=mcp key=brightData toolCount=62 create() successfully created client\n';
        throw error;
      },
      directBrightDataRunner: async (question, diagnostics) => {
        seenFallbackQuestions.push(question.question_id);
        assert.equal(diagnostics.failure_signature, 'loop_after_mcp_start_no_productive_progress');
        return {
          structuredOutput: {
            question: question.question_text,
            answer: 'LiveScore shows vendor and platform-change evidence through Kambi.',
            context: 'Direct fallback evidence after normal OpenCode stall.',
            sources: ['https://www.kambi.com/news/live-score-partnership'],
            confidence: 0.74,
            structured_signal: {
              vendor_changes: [
                {
                  name: 'Kambi partnership',
                  evidence_url: 'https://www.kambi.com/news/live-score-partnership',
                  evidence_kind: 'vendor_change',
                  summary: 'Kambi-related sportsbook platform evidence.',
                },
              ],
              platform_migrations: [
                {
                  name: 'Sportsbook platform migration',
                  evidence_url: 'https://www.kambi.com/news/live-score-partnership',
                  evidence_kind: 'platform_migration',
                  summary: 'Platform change evidence surfaced in fallback search.',
                },
              ],
              partnerships: [],
              org_changes: [],
            },
            evidence_grade: 'moderate',
          },
          promptTrace: {},
          messageTrace: [],
          cliResult: { code: 0, stdout: '', stderr: '' },
        };
      },
    });

    assert.deepEqual(seenFallbackQuestions, ['q7_procurement_signal']);
    const meta = JSON.parse(readFileSync(result.meta_result_path, 'utf8'));
    const q7 = meta.questions.find((item) => item.question_id === 'q7_procurement_signal');
    assert.equal(q7.prompt_trace.fallback, true);
    assert.equal(q7.prompt_trace.fallback_mode, 'direct_brightdata');
    assert.equal(q7.prompt_trace.failure_signature, 'loop_after_mcp_start_no_productive_progress');
    const tracker = JSON.parse(readFileSync(result.tracker_path, 'utf8'));
    assert.equal(tracker.status, 'completed');
    assert.equal(tracker.events.some((event) => event.type === 'question_fallback_used'), true);
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});
