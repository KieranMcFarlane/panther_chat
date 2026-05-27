import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  buildOpenCodeEvidenceSynthesisPrompt,
  buildOpenCodeSynthesisPrompt,
  buildQuestionState,
  prefetchQuestionEvidence,
  resolveQuestionModelRouting,
  resolveExecutionQueryForQuestionPayload,
  prepareOpenCodeRunWorkspace,
  resolveQuestionSourceOrder,
  runOpenCodeCliQuestion,
  runOpenCodeQuestionSourceBatch,
  runOpenCodePresetBatch,
  spawnOpenCodeRunForTesting,
} from '../scripts/opencode_agentic_batch.mjs';
import questionProgressFramework from '../backend/question_progress_framework.json' with { type: 'json' };

const TEST_DIR = fileURLToPath(new URL('.', import.meta.url));
const APP_ROOT = join(TEST_DIR, '..');
const CANONICAL_PARITY_SMOKE_SOURCE = join(
  APP_ROOT,
  'backend',
  'data',
  'question_sources',
  'canonical_two_question_parity_smoke.json',
);

test('buildOpenCodeConfig wires Z.AI coding plan quota-conserving models and BrightData MCP for OpenCode', async () => {
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  const previousBrightDataToken = process.env.BRIGHTDATA_API_TOKEN;
  const previousDefaultModel = process.env.QF_MODEL_DEFAULT;
  process.env.ZAI_API_KEY = 'test-zai-token';
  process.env.BRIGHTDATA_API_TOKEN = 'test-brightdata-token';
  delete process.env.QF_MODEL_DEFAULT;
  const config = await buildOpenCodeConfig({
    worktreeRoot: '/Users/kieranmcfarlane/Downloads/panther_chat/.worktrees/v5-yellow-panther-canonical',
  });

  assert.equal(config.$schema, 'https://opencode.ai/config.json');
  assert.equal(config.model, 'zai-coding-plan/glm-4.7');
  assert.equal(config.provider['zai-coding-plan'].npm, '@ai-sdk/openai-compatible');
  assert.equal(config.provider['zai-coding-plan'].name, 'Z.AI Coding Plan');
  assert.equal(config.provider['zai-coding-plan'].options.baseURL, 'https://api.z.ai/api/coding/paas/v4');
  assert.equal(config.provider['zai-coding-plan'].options.apiKey, '{env:ZAI_API_KEY}');
  assert.equal(config.provider['zai-coding-plan'].models['glm-4.7-flash'].id, 'GLM-4.7-Flash');
  assert.equal(config.provider['zai-coding-plan'].models['glm-4.5-flash'].id, 'GLM-4.5-Flash');
  assert.equal(config.provider['zai-coding-plan'].models['glm-4.5-air'].id, 'GLM-4.5-Air');
  assert.equal(config.provider['zai-coding-plan'].models['glm-5.1'].id, 'GLM-5.1');
  assert.equal(config.provider['zai-coding-plan'].models['glm-5.1'].name, 'GLM-5.1');
  assert.equal(config.provider['zai-coding-plan'].models['glm-5.1'].limit.output, 16384);
  assert.ok(config.mcp.brightData);
  assert.equal(config.mcp.brightData.type, 'remote');
  assert.equal(config.mcp.brightData.enabled, true);
  assert.equal(config.mcp.brightData.url, 'http://127.0.0.1:8014/mcp/');
  assert.equal(config.mcp.brightData.timeout, 15000);
  assert.equal(config.agent.discovery.steps, 4);
  assert.equal(config.agent.discovery.model, 'zai-coding-plan/glm-4.7');
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
  if (previousDefaultModel === undefined) {
    delete process.env.QF_MODEL_DEFAULT;
  } else {
    process.env.QF_MODEL_DEFAULT = previousDefaultModel;
  }
});

test('resolveQuestionModelRouting uses temporary quota-conserving defaults by question family', () => {
  const env = {};

  assert.deepEqual(
    resolveQuestionModelRouting({ question_id: 'q3_leadership' }, env),
    {
      model_id: 'glm-4.7',
      model: 'zai-coding-plan/glm-4.7',
      model_tier: 'prefetch',
      quota_policy: 'temporary_3_day_conserve',
      escalation_allowed: false,
      escalation_model: 'zai-coding-plan/glm-5.1',
      escalation_reason: '',
    },
  );
  assert.equal(resolveQuestionModelRouting({ question_id: 'q14_yp_fit' }, env).model, 'zai-coding-plan/glm-4.7');
  assert.equal(resolveQuestionModelRouting({ question_id: 'q14_yp_fit' }, env).model_tier, 'synthesis');
  assert.equal(resolveQuestionModelRouting({ question_id: 'q1_foundation' }, env).model, 'zai-coding-plan/glm-4.7');
  assert.equal(resolveQuestionModelRouting({ question_id: 'q1_foundation' }, env).model_tier, 'default');
});

test('resolveQuestionModelRouting honors force model and disables escalation by default', () => {
  const forced = resolveQuestionModelRouting(
    { question_id: 'q14_yp_fit' },
    { QF_FORCE_MODEL: 'glm-5.1', QF_MODEL_ESCALATION_ENABLED: 'true' },
  );
  assert.equal(forced.model, 'zai-coding-plan/glm-5.1');
  assert.equal(forced.model_tier, 'forced');
  assert.equal(forced.escalation_allowed, false);

  const routed = resolveQuestionModelRouting(
    { question_id: 'q15_outreach_strategy' },
    { QF_MODEL_SYNTHESIS: 'glm-4.5-air', QF_MODEL_ESCALATION_ENABLED: 'false' },
  );
  assert.equal(routed.model, 'zai-coding-plan/glm-4.5-air');
  assert.equal(routed.escalation_allowed, false);
});

test('resolveExecutionQueryForQuestionPayload ignores stale tracker queries from another question', () => {
  const question = {
    question_id: 'q11_decision_owner',
    query: '"Kick Sauber F1 Team" (commercial director OR leadership OR board) -wikipedia',
  };
  const existingQuestionState = {
    question_id: 'q1_foundation',
    last_executed_query: '"Kick Sauber F1 Team" official website founded year',
  };

  assert.equal(
    resolveExecutionQueryForQuestionPayload(question, existingQuestionState),
    question.query,
  );
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
    assert.equal(config.model, 'zai-coding-plan/glm-4.7');
    assert.equal(config.provider['zai-coding-plan'].options.baseURL, 'https://api.z.ai/api/coding/paas/v4');
    assert.equal(config.provider['zai-coding-plan'].options.apiKey, '{env:ZAI_API_KEY}');
    assert.ok(config.mcp.brightData);
    assert.equal(config.mcp.brightData.type, 'remote');
    assert.equal(config.mcp.brightData.url, 'http://127.0.0.1:8014/mcp/');
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

test('buildOpenCodeQuestionPrompt gives q3 a typed buyer-role output contract', () => {
  const prompt = buildOpenCodeQuestionPrompt({
    question_id: 'q3_leadership',
    question_text: 'Which named people currently hold leadership or commercial roles at Baseball Australia?',
    question_type: 'leadership',
    query: '"Baseball Australia" commercial director head of partnerships',
    structured_output_schema: 'leadership_candidates_v1',
    source_priority: ['official_site', 'leadership_page', 'linkedin_people_search'],
  });

  assert.match(prompt, /people array/i);
  assert.match(prompt, /name, title, function, buyer_relevance, evidence_url/i);
  assert.match(prompt, /Reject founded years, venues, trophies, event dates, and generic history/i);
  assert.match(prompt, /checked_sources/i);
});

test('buildOpenCodeQuestionPrompt injects typed output contracts for priority upstream questions', () => {
  const examples = [
    {
      question_id: 'q1_foundation',
      question_type: 'foundation',
      question_text: 'What is the canonical identity and grounding profile for Arsenal FC?',
      query: '"Arsenal FC" official website founded year',
      expected: [/entity_classification/i, /canonical_name/i, /official_site/i, /ambiguity_notes/i],
    },
    {
      question_id: 'q2_digital_stack',
      question_type: 'digital_stack',
      question_text: 'What visible technologies, platforms, or vendors does Arsenal FC use?',
      query: '"Arsenal FC" official website',
      expected: [/platform_hints/i, /vendor_hints/i, /digital_footprint_unknown/i, /checked_sources/i],
    },
    {
      question_id: 'q6_launch_signal',
      question_type: 'launch_signal',
      question_text: 'What products, apps, platforms, or fan experiences has Arsenal FC launched?',
      query: '"Arsenal FC" launch app platform',
      expected: [/trigger_date/i, /trigger_type/i, /recency/i, /commercial_implication/i],
    },
    {
      question_id: 'q9_news_signal',
      question_type: 'news_signal',
      question_text: 'What recent news, partnerships, and strategic themes are most relevant?',
      query: '"Arsenal FC" news announcement partnership',
      expected: [/news_date/i, /news_type/i, /commercial_relevance/i, /checked_sources/i],
    },
    {
      question_id: 'q10_hiring_signal',
      question_type: 'hiring_signal',
      question_text: 'What hiring signals suggest current investment priorities?',
      query: '"Arsenal FC" careers jobs product engineering data',
      expected: [/role_mix/i, /investment_priority/i, /checked_sources/i, /commercial_implication/i],
    },
  ];

  for (const example of examples) {
    const prompt = buildOpenCodeQuestionPrompt(example);
    assert.match(prompt, /Return typed fields/i);
    assert.match(prompt, /validation_state/i);
    assert.match(prompt, /display_answer/i);
    for (const pattern of example.expected) {
      assert.match(prompt, pattern, `${example.question_id} prompt should include ${pattern}`);
    }
  }
});

test('prefetchQuestionEvidence accepts source-backed q2 digital hints and records diagnostics', async () => {
  const result = await prefetchQuestionEvidence(
    {
      question_id: 'q2_digital_stack',
      question_type: 'digital_stack',
      entity_name: 'Arsenal FC',
      query: '"Arsenal FC" official website',
      search_strategy: {
        search_queries: ['"Arsenal FC" app ticketing platform'],
      },
    },
    {
      now: () => '2026-05-05T08:00:00.000Z',
      searchEngine: async (query) => ({
        status: 'success',
        results: [
          {
            title: 'Arsenal official app and ticketing',
            url: 'https://www.arsenal.com/apps',
            snippet: `Official Arsenal app, ticketing, video and ecommerce platform evidence for ${query}.`,
          },
        ],
      }),
      scrapeMarkdown: async () => ({
        status: 'success',
        content: 'Download the official app, access ticketing, video, ecommerce shop and digital membership.',
      }),
    },
  );

  assert.equal(result.leads.length, 1);
  assert.equal(result.leads[0].source_type, 'official_site');
  assert.equal(result.leads[0].acceptance_reason, 'digital_footprint_hint');
  assert.equal(result.leads[0].retrieved_at, '2026-05-05T08:00:00.000Z');
  assert.equal(result.diagnostics.accepted_source_count, 1);
  assert.ok(result.diagnostics.query_variants_used.includes('"Arsenal FC" official website'));
  assert.ok(result.checked_sources[0].url.includes('arsenal.com'));
});

test('prefetchQuestionEvidence rejects generic q2 pages even when they mention apps', async () => {
  const result = await prefetchQuestionEvidence(
    {
      question_id: 'q2_digital_stack',
      question_type: 'digital_stack',
      entity_name: 'Arsenal FC',
      query: '"Arsenal FC" app platform',
    },
    {
      searchEngine: async () => ({
        status: 'success',
        results: [
          {
            title: 'Arsenal FC - Wikipedia',
            url: 'https://en.wikipedia.org/wiki/Arsenal_F.C.',
            snippet: 'Arsenal is a football club. Fans use apps and platforms to follow football generally.',
          },
        ],
      }),
      scrapeMarkdown: async () => ({
        status: 'success',
        content: 'Generic encyclopaedia history with no official digital product evidence.',
      }),
    },
  );

  assert.equal(result.leads.length, 0);
  assert.equal(result.diagnostics.rejected_source_count, 1);
  assert.match(result.retrieval_summary, /No accepted q2_digital_stack evidence/i);
});

test('prefetchQuestionEvidence rejects social pages as q2 official digital evidence', async () => {
  const result = await prefetchQuestionEvidence(
    {
      question_id: 'q2_digital_stack',
      question_type: 'digital_stack',
      entity_name: 'Arsenal FC',
      query: '"Arsenal FC" app platform',
    },
    {
      searchEngine: async () => ({
        status: 'success',
        results: [
          {
            title: 'Arsenal fans discuss the club app',
            url: 'https://www.reddit.com/r/Gunners/comments/example/arsenal_app/',
            snippet: 'Fans discuss ticketing, apps and platforms on Reddit.',
          },
        ],
      }),
      scrapeMarkdown: async () => ({
        status: 'success',
        content: 'Reddit discussion of apps, ticketing and platforms.',
      }),
    },
  );

  assert.equal(result.leads.length, 0);
  assert.equal(result.checked_sources[0].source_type, 'social');
  assert.equal(result.diagnostics.rejected_source_count, 1);
});

test('prefetchQuestionEvidence rejects generic q3 history pages as buyer-role evidence', async () => {
  const result = await prefetchQuestionEvidence(
    {
      question_id: 'q3_leadership',
      question_type: 'leadership',
      entity_name: 'Baseball Australia',
      query: '"Baseball Australia" leadership commercial director',
    },
    {
      searchEngine: async () => ({
        status: 'success',
        results: [
          {
            title: 'Baseball Australia history and founding',
            url: 'https://example.com/baseball-australia-history',
            snippet: 'Baseball Australia was founded in 2000 and has won trophies at historic venues.',
          },
        ],
      }),
      scrapeMarkdown: async () => ({
        status: 'success',
        content: 'History, venues, trophies and founding dates.',
      }),
    },
  );

  assert.equal(result.leads.length, 0);
  assert.equal(result.diagnostics.accepted_source_count, 0);
  assert.equal(result.diagnostics.rejected_source_count, 1);
  assert.match(result.retrieval_summary, /No accepted q3_leadership evidence/i);
});

test('prefetchQuestionEvidence extracts q3 leadership snippets from card-style official page markup', async () => {
  const result = await prefetchQuestionEvidence(
    {
      question_id: 'q3_leadership',
      question_type: 'leadership',
      entity_name: 'Major League Soccer',
      query: '"Major League Soccer" executives',
    },
    {
      searchEngine: async () => ({
        status: 'success',
        results: [
          {
            title: 'Executives',
            url: 'https://www.mlssoccer.com/about/executives',
            snippet: '',
          },
        ],
      }),
      scrapeMarkdown: async () => ({
        status: 'success',
        content: `
          <div class="mls-o-block-header__title">Commissioner</div>
          <a class="fm-card-wrap" title="Don Garber" aria-label="Don Garber">Don Garber</a>
          <div class="mls-o-block-header__title">Executive Vice President; Chief Technology Officer</div>
          <a class="fm-card-wrap" title="John Nicastro" aria-label="John Nicastro">John Nicastro</a>
        `,
      }),
    },
  );

  assert.equal(result.leads.length, 1);
  assert.match(result.leads[0].excerpt, /Don Garber\. Commissioner\./);
  assert.match(result.leads[0].excerpt, /John Nicastro\. Chief Technology Officer\./);
  assert.equal(result.diagnostics.accepted_source_count, 1);
});

test('prefetchQuestionEvidence accepts dated q6 and q9 commercial trigger evidence', async () => {
  const q6 = await prefetchQuestionEvidence(
    {
      question_id: 'q6_launch_signal',
      question_type: 'launch_signal',
      entity_name: 'Milan Cortina 2026',
      query: '"Milan Cortina 2026" launch app platform',
    },
    {
      searchEngine: async () => ({
        status: 'success',
        results: [
          {
            title: 'Milan Cortina 2026 launches official app in 2026',
            url: 'https://milanocortina2026.olympics.com/en/news/app-launch',
            snippet: 'The organising committee announced the official app launch on 5 February 2026.',
          },
        ],
      }),
      scrapeMarkdown: async () => ({
        status: 'success',
        content: '5 February 2026 launch of the official app and digital fan platform.',
      }),
    },
  );
  const q9 = await prefetchQuestionEvidence(
    {
      question_id: 'q9_news_signal',
      question_type: 'news_signal',
      entity_name: 'FDJ-Suez',
      query: '"FDJ-Suez" news announcement partnership',
    },
    {
      searchEngine: async () => ({
        status: 'success',
        results: [
          {
            title: 'FDJ-Suez announces new commercial partnership in 2026',
            url: 'https://www.fdj-suez.fr/news/partnership-2026',
            snippet: 'FDJ-Suez announced a new strategic commercial partnership on 12 March 2026.',
          },
        ],
      }),
      scrapeMarkdown: async () => ({
        status: 'success',
        content: '12 March 2026 strategic commercial partnership announcement.',
      }),
    },
  );

  assert.equal(q6.leads[0].acceptance_reason, 'dated_launch_or_platform_trigger');
  assert.equal(q9.leads[0].acceptance_reason, 'dated_commercial_news_trigger');
});

test('prefetchQuestionEvidence rejects stale q9 news as a current commercial trigger', async () => {
  const result = await prefetchQuestionEvidence(
    {
      question_id: 'q9_news_signal',
      question_type: 'news_signal',
      entity_name: 'FDJ-Suez',
      query: '"FDJ-Suez" news announcement partnership',
    },
    {
      searchEngine: async () => ({
        status: 'success',
        results: [
          {
            title: 'FDJ-Suez partnership archive from 2019',
            url: 'https://www.fdj-suez.fr/news/partnership-2019',
            snippet: 'A strategic commercial partnership was announced on 12 March 2019.',
          },
        ],
      }),
      scrapeMarkdown: async () => ({
        status: 'success',
        content: '12 March 2019 strategic commercial partnership announcement.',
      }),
    },
  );

  assert.equal(result.leads.length, 0);
  assert.equal(result.diagnostics.rejected_source_count, 1);
});

test('buildOpenCodeEvidenceSynthesisPrompt uses supplied retrieval evidence and forbids invention', () => {
  const prompt = buildOpenCodeEvidenceSynthesisPrompt(
    {
      question_id: 'q6_launch_signal',
      question_type: 'launch_signal',
      question_text: 'What products, apps, platforms, or fan experiences has Arsenal FC launched?',
      query: '"Arsenal FC" launch app platform',
      structured_output_schema: 'launch_signal_v1',
    },
    {
      prefetchEvidence: {
        leads: [{ title: 'Official app launch', url: 'https://www.arsenal.com/apps', excerpt: 'Official app launch evidence.' }],
        checked_sources: [{ url: 'https://www.arsenal.com/apps' }],
        retrieval_summary: 'Accepted one official app launch lead.',
      },
    },
  );

  assert.match(prompt, /Use supplied retrieval evidence/i);
  assert.match(prompt, /do not invent/i);
  assert.match(prompt, /If evidence is insufficient return checked no_signal/i);
  assert.match(prompt, /Official app launch/i);
  assert.doesNotMatch(prompt, /Your first action must be one BrightData search/i);
});

test('buildOpenCodeQuestionPrompt keeps q14 and q15 as synthesis prompts without retrieval wording', () => {
  const q14 = buildOpenCodeQuestionPrompt({
    question_id: 'q14_yp_fit',
    question_type: 'yp_fit',
    question_text: 'Based on current dossier evidence, which Yellow Panther capability fits best?',
    query: '',
    execution_class: 'derived_inference',
  });
  const q15 = buildOpenCodeQuestionPrompt({
    question_id: 'q15_outreach_strategy',
    question_type: 'outreach_strategy',
    question_text: 'Using buyer, connection, and capability evidence, what is the best outreach route?',
    query: '',
    execution_class: 'derived_inference',
  });

  assert.match(q14, /derived synthesis/i);
  assert.match(q14, /best_service/i);
  assert.match(q15, /derived synthesis/i);
  assert.match(q15, /recommended_target/i);
  assert.doesNotMatch(q14, /search for Yellow Panther|lookup Yellow Panther|Yellow Panther search/i);
  assert.doesNotMatch(q15, /search for Yellow Panther|lookup Yellow Panther|Yellow Panther search/i);
});

test('resolveQuestionSourceOrder varies source ranking by entity type and question family', () => {
  const clubDecisionOwner = resolveQuestionSourceOrder({
    question_id: 'q11_decision_owner',
    question_type: 'decision_owner',
  }, 'CLUB');
  const leagueDigital = resolveQuestionSourceOrder({
    question_id: 'q2_digital_stack',
    question_type: 'digital_stack',
  }, 'LEAGUE');
  const federationProcurement = resolveQuestionSourceOrder({
    question_id: 'q7_procurement_signal',
    question_type: 'procurement_signal',
  }, 'FEDERATION');

  assert.deepEqual(clubDecisionOwner.slice(0, 5), ['official_site', 'leadership_page', 'linkedin_company_profile', 'linkedin_people_search', 'linkedin_posts']);
  assert.deepEqual(leagueDigital.slice(0, 4), ['official_site', 'app_store', 'press_release', 'news']);
  assert.deepEqual(federationProcurement.slice(0, 4), ['official_site', 'tender_portal', 'press_release', 'partner_announcement']);
  assert.equal(federationProcurement.includes('linkedin_posts'), true);
  assert.equal(federationProcurement.includes('linkedin_people_search'), false);
  assert.equal(federationProcurement.includes('linkedin_person_profile'), false);
  assert.equal(federationProcurement.includes('google_serp'), false);
});

test('q7 progress framework uses a bounded procurement sweep with one LinkedIn signal check', () => {
  const q7Config = questionProgressFramework.questions.q7_procurement_signal;

  assert.match(q7Config.strategy_label, /bounded/i);
  assert.deepEqual(q7Config.source_order, [
    'official_site',
    'tender_portal',
    'press_release',
    'partner_announcement',
    'linkedin_posts',
  ]);
  assert.equal(q7Config.source_order.includes('google_serp'), false);
  assert.equal(q7Config.source_order.includes('linkedin_posts'), true);
  assert.equal(q7Config.source_order.includes('linkedin_people_search'), false);
  assert.equal(q7Config.source_order.includes('linkedin_person_profile'), false);
});

test('buildOpenCodeQuestionPrompt includes entity-type-aware source guidance when source order is available', () => {
  const prompt = buildOpenCodeQuestionPrompt({
    question_id: 'q11_decision_owner',
    question_text: 'Who owns the commercial buying decision at Doncaster Rovers?',
    question_type: 'decision_owner',
    entity_type: 'CLUB',
    query: '"Doncaster Rovers" chief commercial officer',
    source_priority: ['official_site', 'linkedin_posts', 'news', 'press_release'],
  });

  assert.match(prompt, /Entity type: CLUB/i);
  assert.match(prompt, /Prioritize sources in this order: official_site, linkedin_posts, news, press_release/i);
  assert.match(prompt, /Use Wikipedia only as last-resort context/i);
  assert.match(prompt, /perform one focused follow-up search/i);
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

test('buildOpenCodeQuestionPrompt includes the structured output schema when provided by the old matrix', () => {
  const prompt = buildOpenCodeQuestionPrompt({
    question_id: 'q1_foundation',
    question_text: 'When was Arsenal FC founded?',
    question_type: 'foundation',
    query: '"Arsenal FC" official website founded year',
    structured_output_schema: 'foundation_v1',
  });

  assert.match(prompt, /Structured output schema: foundation_v1/i);
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
  assert.match(retrievalPrompt, /maximum two BrightData tool calls/i);
  assert.match(retrievalPrompt, /at most one LinkedIn signal check/i);
  assert.match(retrievalPrompt, /post\/company search only/i);
  assert.match(retrievalPrompt, /Do not inspect LinkedIn people, personal profiles/i);
  assert.match(synthesisPrompt, /synthesis pass/i);
  assert.match(synthesisPrompt, /Use only the supplied retrieval evidence/i);
  assert.match(synthesisPrompt, /validation_state/i);
  assert.match(synthesisPrompt, /structured_signal/i);
});

test('runOpenCodeCliQuestion short-circuits q7 when retrieval times out with no recoverable leads', async () => {
  const question = {
    question_id: 'q7_procurement_signal',
    question_text: 'Is there evidence LiveScore Group is buying, reshaping vendors, or changing its ecosystem?',
    question_type: 'procurement_signal',
    query: '"LiveScore Group" platform migration provider partnership',
  };
  const seenTimeouts = [];

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-q7-timeout-worktree-')),
    opencodeTimeoutMs: 300000,
    standaloneHarness: false,
    spawnRunner: async (_args, options) => {
      seenTimeouts.push(options.timeoutMs);
      const error = new Error('opencode run timed out after 90000ms');
      error.name = 'OpenCodeTimeoutError';
      error.code = 124;
      error.stdout = '';
      error.stderr = 'OpenCodeTimeoutError: opencode run timed out after 90000ms';
      throw error;
    },
  });

  assert.deepEqual(seenTimeouts, [90000]);
  assert.equal(result.structuredOutput.validation_state, 'no_signal');
  assert.match(result.structuredOutput.context, /No completed BrightData leads/i);
  assert.equal(result.promptTrace.stage_count, 1);
  assert.equal(result.promptTrace.retrieval_recovered_from_failure, true);
  assert.equal(result.promptTrace.synthesis_skipped, true);
});

test('runOpenCodeCliQuestion marks deterministic OpenCode timeout as failed infrastructure, not no_signal', async () => {
  const question = {
    question_id: 'q4_performance',
    question_text: 'What is the current sporting performance context for England Basketball?',
    question_type: 'performance',
    query: '"England Basketball" standings',
    execution_class: 'deterministic_enrichment',
  };

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-q4-timeout-')),
    opencodeTimeoutMs: 300000,
    standaloneHarness: false,
    spawnRunner: async () => {
      const error = new Error('opencode run timed out after 300000ms');
      error.name = 'OpenCodeTimeoutError';
      error.code = 124;
      error.stdout = '';
      error.stderr = 'OpenCodeTimeoutError: opencode run timed out after 300000ms';
      throw error;
    },
  });

  assert.equal(result.structuredOutput.validation_state, 'failed');
  assert.equal(result.structuredOutput.structured_signal.failure_class, 'opencode_timeout');
  assert.equal(result.promptTrace.failure_class, 'opencode_timeout');
  assert.match(result.structuredOutput.context, /OpenCode run failed/i);
});

test('runOpenCodeCliQuestion marks q2 BrightData prefetch failure as failed infrastructure, not empty evidence', async () => {
  const question = {
    question_id: 'q2_digital_stack',
    question_text: 'What visible technologies, platforms, or vendors does England Basketball use?',
    question_type: 'digital_stack',
    query: '"England Basketball" official website',
    structured_output_schema: 'digital_stack_v1',
  };

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-q2-prefetch-failed-')),
    opencodeTimeoutMs: 300000,
    evidencePrefetcher: async () => {
      throw new Error('BrightData prefetch failed with exit code 1');
    },
    spawnRunner: async () => {
      throw new Error('provider should not be called when prefetch fails before evidence');
    },
  });

  assert.equal(result.structuredOutput.validation_state, 'failed');
  assert.equal(result.structuredOutput.structured_signal.status, 'source_prefetch_failed');
  assert.equal(result.structuredOutput.structured_signal.failure_class, 'brightdata_prefetch_failed');
  assert.equal(result.promptTrace.failure_class, 'brightdata_prefetch_failed');
  assert.match(result.structuredOutput.context, /Evidence prefetch failed/i);
});

test('runOpenCodeCliQuestion routes q2 q3 q6 q9 through evidence-first synthesis', async () => {
  const question = {
    question_id: 'q6_launch_signal',
    question_text: 'What products, apps, platforms, or fan experiences has Arsenal FC launched?',
    question_type: 'launch_signal',
    query: '"Arsenal FC" launch app platform',
    structured_output_schema: 'launch_signal_v1',
  };
  const prompts = [];
  const prefetchCalls = [];

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-q6-evidence-first-')),
    opencodeTimeoutMs: 300000,
    evidencePrefetcher: async (prefetchQuestion) => {
      prefetchCalls.push(prefetchQuestion.question_id);
      return {
        leads: [
          {
            title: 'Arsenal official app launch',
            url: 'https://www.arsenal.com/apps',
            snippet: 'Arsenal announced its official app launch in 2026.',
            excerpt: 'The club launched an official app and digital fan platform in March 2026.',
            source_type: 'official_site',
            query_used: question.query,
            retrieved_at: '2026-05-05T08:00:00.000Z',
            acceptance_reason: 'dated_launch_or_platform_trigger',
          },
        ],
        checked_sources: [{ url: 'https://www.arsenal.com/apps', accepted: true }],
        retrieval_summary: 'Accepted one official launch lead.',
        diagnostics: {
          accepted_source_count: 1,
          source_types: ['official_site'],
          query_variants_used: [question.query],
        },
      };
    },
    spawnRunner: async (args) => {
      const prompt = args.at(-1);
      prompts.push(prompt);
      assert.match(prompt, /Use supplied retrieval evidence/i);
      assert.match(prompt, /Arsenal official app launch/i);
      assert.doesNotMatch(prompt, /Your first action must be one BrightData search/i);
      return {
        code: 0,
        stdout: `${JSON.stringify({
          type: 'text',
          part: {
            text: JSON.stringify({
              question: question.question_text,
              answer: 'Arsenal launched an official app and digital fan platform in March 2026.',
              context: 'Source-backed launch signal from Arsenal official app page.',
              sources: ['https://www.arsenal.com/apps'],
              confidence: 0.82,
              validation_state: 'validated',
              checked_sources: [{ url: 'https://www.arsenal.com/apps', accepted: true }],
              structured_signal: {
                trigger_type: 'app_launch',
                trigger_date: 'March 2026',
                source: 'https://www.arsenal.com/apps',
              },
              commercial_implication: 'Digital fan engagement and product delivery opportunity.',
            }),
          },
        })}\n`,
        stderr: '',
      };
    },
  });

  assert.deepEqual(prefetchCalls, ['q6_launch_signal']);
  assert.equal(prompts.length, 1);
  assert.equal(result.structuredOutput.validation_state, 'validated');
  assert.equal(result.promptTrace.stage_count, 2);
  assert.equal(result.promptTrace.prefetch_used, true);
  assert.equal(result.promptTrace.model_requested, 'zai-coding-plan/glm-4.7');
  assert.equal(result.promptTrace.model_used, 'zai-coding-plan/glm-4.7');
  assert.equal(result.promptTrace.model_tier, 'prefetch');
  assert.equal(result.promptTrace.quota_policy, 'temporary_3_day_conserve');
  assert.equal(result.promptTrace.escalation_allowed, true);
  assert.equal(result.promptTrace.retrieval_lead_count, 1);
  assert.equal(result.promptTrace.accepted_source_count, 1);
  assert.deepEqual(result.promptTrace.source_types, ['official_site']);
});

test('runOpenCodeCliQuestion falls back to provisional q6 signal when provider returns empty object after accepted prefetch leads', async () => {
  const question = {
    question_id: 'q6_launch_signal',
    question_text: 'What products, apps, platforms, or fan experiences has Arsenal FC launched?',
    question_type: 'launch_signal',
    query: '"Arsenal FC" launch app platform',
    structured_output_schema: 'launch_signal_v1',
  };

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-q6-prefetch-fallback-')),
    opencodeTimeoutMs: 300000,
    evidencePrefetcher: async () => ({
      leads: [
        {
          title: 'Arsenal launches official app in 2026',
          url: 'https://www.arsenal.com/apps',
          snippet: 'Arsenal announced the official app launch in March 2026.',
          excerpt: 'The club launched an official app and digital fan platform in March 2026.',
          source_type: 'official_site',
          acceptance_reason: 'dated_launch_or_platform_trigger',
          query_used: question.query,
          retrieved_at: '2026-05-05T08:00:00.000Z',
        },
      ],
      checked_sources: [{ url: 'https://www.arsenal.com/apps', accepted: true, source_type: 'official_site' }],
      retrieval_summary: 'Accepted one official launch lead.',
      diagnostics: {
        accepted_source_count: 1,
        source_types: ['official_site'],
        query_variants_used: [question.query],
      },
    }),
    spawnRunner: async () => ({
      code: 0,
      stdout: '{}\n',
      stderr: '',
    }),
  });

  assert.equal(result.structuredOutput.validation_state, 'provisional');
  assert.equal(result.structuredOutput.structured_signal.status, 'deterministic_prefetch_fallback');
  assert.equal(result.structuredOutput.structured_signal.trigger_type, 'launch_signal');
  assert.equal(result.structuredOutput.prompt_trace.provider_no_answer_reason, 'empty_object_answer');
  assert.equal(result.promptTrace.deterministic_prefetch_fallback, true);
  assert.equal(result.promptTrace.provider_no_answer_reason, 'empty_object_answer');
});

test('runOpenCodeCliQuestion falls back to provisional q3 buyer candidate when provider returns empty object after accepted prefetch leads', async () => {
  const question = {
    question_id: 'q3_leadership',
    question_text: 'Which named people currently hold leadership or commercial roles at Exeter City?',
    question_type: 'leadership',
    query: '"Exeter City" Head of Commercial',
    structured_output_schema: 'leadership_candidates_v1',
  };

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-q3-prefetch-fallback-')),
    opencodeTimeoutMs: 300000,
    evidencePrefetcher: async () => ({
      leads: [
        {
          title: "Who's Who | Exeter City Football Club",
          url: 'https://www.exetercityfc.co.uk/primary/club/whos-who-exeter-city',
          snippet: 'Matt Kimberley, Head of Commercial, Exeter City Football Club.',
          excerpt: 'Matt Kimberley, Head of Commercial, works across commercial partnerships and club revenue.',
          source_type: 'official_site',
          acceptance_reason: 'buyer_role_candidate',
          query_used: question.query,
          retrieved_at: '2026-05-05T08:00:00.000Z',
        },
      ],
      checked_sources: [{
        url: 'https://www.exetercityfc.co.uk/primary/club/whos-who-exeter-city',
        accepted: true,
        source_type: 'official_site',
      }],
      retrieval_summary: 'Accepted one official leadership lead.',
      diagnostics: {
        accepted_source_count: 1,
        source_types: ['official_site'],
        query_variants_used: [question.query],
      },
    }),
    spawnRunner: async () => ({
      code: 0,
      stdout: '{}\n',
      stderr: '',
    }),
  });

  assert.equal(result.structuredOutput.validation_state, 'provisional');
  assert.equal(result.structuredOutput.structured_signal.status, 'deterministic_prefetch_fallback');
  assert.equal(result.structuredOutput.primary_owner.name, 'Matt Kimberley');
  assert.equal(result.structuredOutput.primary_owner.title, 'Head of Commercial');
  assert.equal(result.structuredOutput.sources[0], 'https://www.exetercityfc.co.uk/primary/club/whos-who-exeter-city');
  assert.equal(result.promptTrace.deterministic_prefetch_fallback, true);
  assert.equal(result.promptTrace.provider_no_answer_reason, 'empty_object_answer');
});

test('runOpenCodeCliQuestion falls back to provisional q3 buyer candidate when provider returns object answer without sources after accepted prefetch leads', async () => {
  const question = {
    question_id: 'q3_leadership',
    question_text: 'Which named people currently hold leadership or commercial roles at Major League Soccer?',
    question_type: 'leadership',
    query: '"Major League Soccer" leadership board commercial director',
    structured_output_schema: 'leadership_candidates_v1',
  };

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-q3-prefetch-object-fallback-')),
    opencodeTimeoutMs: 300000,
    evidencePrefetcher: async () => ({
      leads: [
        {
          title: 'Executives',
          url: 'https://www.mlssoccer.com/about/executives',
          snippet: 'Don Garber. Commissioner, Major League Soccer CEO, Soccer United Marketing.',
          excerpt: 'Don Garber. Commissioner, Major League Soccer CEO, Soccer United Marketing.',
          source_type: 'official_site',
          acceptance_reason: 'buyer_role_candidate',
          query_used: question.query,
          retrieved_at: '2026-05-05T08:00:00.000Z',
        },
      ],
      checked_sources: [{
        url: 'https://www.mlssoccer.com/about/executives',
        accepted: true,
        source_type: 'official_site',
      }],
      retrieval_summary: 'Accepted one official leadership lead.',
      diagnostics: {
        accepted_source_count: 1,
        source_types: ['official_site'],
        query_variants_used: [question.query],
      },
    }),
    spawnRunner: async () => ({
      code: 0,
      stdout: JSON.stringify({
        answer: { status: 'no_answer' },
        context: '',
        sources: [],
        confidence: 0,
      }),
      stderr: '',
    }),
  });

  assert.equal(result.structuredOutput.validation_state, 'provisional');
  assert.equal(result.structuredOutput.structured_signal.status, 'deterministic_prefetch_fallback');
  assert.equal(result.structuredOutput.primary_owner.name, 'Don Garber');
  assert.equal(result.structuredOutput.primary_owner.title, 'Commissioner');
  assert.equal(result.structuredOutput.sources[0], 'https://www.mlssoccer.com/about/executives');
  assert.equal(result.promptTrace.provider_no_answer_reason, 'empty_object_answer');
});

test('runOpenCodeCliQuestion q3 fallback scans later accepted leads when top source excerpt has no names', async () => {
  const question = {
    question_id: 'q3_leadership',
    question_text: 'Which named people currently hold leadership or commercial roles at Major League Soccer?',
    question_type: 'leadership',
    query: '"Major League Soccer" leadership board commercial director',
    structured_output_schema: 'leadership_candidates_v1',
  };

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-q3-prefetch-later-lead-fallback-')),
    opencodeTimeoutMs: 300000,
    evidencePrefetcher: async () => ({
      leads: [
        {
          title: 'Executives',
          url: 'https://www.mlssoccer.com/about/executives',
          snippet: 'MLS Communications Copy URL Share on Facebook Share on X.',
          excerpt: 'MLS Communications Copy URL Share on Facebook Share on X.',
          source_type: 'official_site',
          acceptance_reason: 'buyer_role_candidate',
          query_used: question.query,
          retrieved_at: '2026-05-05T08:00:00.000Z',
        },
        {
          title: 'MLS NEXT Names Stephanie Savino as General Manager',
          url: 'https://www.linkedin.com/posts/stephaniedimari_mls-next-names-stephanie-savino-as-general-activity-7437958278942244864-qyV3',
          snippet: "Excited to share that I've stepped into a new role at Major League Soccer as General Manager, MLS NEXT overseeing Business & Commercial.",
          excerpt: "Stephanie Savino as General Manager, MLS NEXT overseeing Business & Commercial.",
          source_type: 'linkedin_person_profile',
          acceptance_reason: 'buyer_role_candidate',
          query_used: question.query,
          retrieved_at: '2026-05-05T08:00:00.000Z',
        },
      ],
      checked_sources: [{
        url: 'https://www.mlssoccer.com/about/executives',
        accepted: true,
        source_type: 'official_site',
      }],
      retrieval_summary: 'Accepted leadership leads.',
      diagnostics: {
        accepted_source_count: 2,
        source_types: ['official_site', 'linkedin_person_profile'],
        query_variants_used: [question.query],
      },
    }),
    spawnRunner: async () => ({
      code: 0,
      stdout: '{}\n',
      stderr: '',
    }),
  });

  assert.equal(result.structuredOutput.validation_state, 'provisional');
  assert.equal(result.structuredOutput.structured_signal.status, 'deterministic_prefetch_fallback');
  assert.equal(result.structuredOutput.primary_owner.name, 'Stephanie Savino');
  assert.equal(result.structuredOutput.primary_owner.title, 'General Manager');
  assert.equal(
    result.structuredOutput.structured_signal.evidence_url,
    'https://www.linkedin.com/posts/stephaniedimari_mls-next-names-stephanie-savino-as-general-activity-7437958278942244864-qyV3',
  );
});

test('runOpenCodeCliQuestion q3 fallback cleans noisy LinkedIn title suffixes', async () => {
  const question = {
    question_id: 'q3_leadership',
    question_text: 'Which named people currently hold leadership or commercial roles at Major League Soccer?',
    question_type: 'leadership',
    query: '"Major League Soccer" digital marketing director',
    structured_output_schema: 'leadership_candidates_v1',
  };

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-q3-linkedin-title-cleanup-')),
    opencodeTimeoutMs: 300000,
    evidencePrefetcher: async () => ({
      leads: [
        {
          title: 'Claudia Iraheta - Director, Digital Marketing at Major ...',
          url: 'https://www.linkedin.com/in/ciraheta',
          snippet: 'Claudia Iraheta - Director, Digital Marketing at Major League Soccer.',
          excerpt: '',
          source_type: 'linkedin_person_profile',
          acceptance_reason: 'buyer_role_candidate',
          query_used: question.query,
          retrieved_at: '2026-05-05T08:00:00.000Z',
        },
      ],
      checked_sources: [{
        url: 'https://www.linkedin.com/in/ciraheta',
        accepted: true,
        source_type: 'linkedin_person_profile',
      }],
      retrieval_summary: 'Accepted one LinkedIn leadership lead.',
      diagnostics: {
        accepted_source_count: 1,
        source_types: ['linkedin_person_profile'],
        query_variants_used: [question.query],
      },
    }),
    spawnRunner: async () => ({
      code: 0,
      stdout: '{}\n',
      stderr: '',
    }),
  });

  assert.equal(result.structuredOutput.validation_state, 'provisional');
  assert.equal(result.structuredOutput.primary_owner.name, 'Claudia Iraheta');
  assert.equal(result.structuredOutput.primary_owner.title, 'Director, Digital Marketing');
});

test('runOpenCodeCliQuestion short-circuits q10 when retrieval has no leads', async () => {
  const question = {
    question_id: 'q10_hiring_signal',
    question_text: 'What hiring signals suggest current investment priorities for KK Šibenik?',
    question_type: 'hiring_signal',
    query: '"KK Šibenik" careers jobs product engineering data',
  };
  const prompts = [];

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-q10-empty-retrieval-')),
    opencodeTimeoutMs: 300000,
    standaloneHarness: false,
    spawnRunner: async (_args, _options) => {
      prompts.push(_args.at(-1));
      if (prompts.length > 1) {
        throw new Error('empty retrieval should not call synthesis');
      }
      return {
        code: 0,
        stdout: JSON.stringify({
          question: question.question_text,
          query: question.query,
          leads: [],
          retrieval_summary: 'No hiring leads found in bounded retrieval.',
        }),
        stderr: '',
      };
    },
  });

  assert.equal(prompts.length, 1);
  assert.equal(result.structuredOutput.validation_state, 'no_signal');
  assert.match(result.structuredOutput.context, /No hiring leads/i);
  assert.equal(result.promptTrace.stage_count, 1);
  assert.equal(result.promptTrace.synthesis_skipped, true);
});

test('runOpenCodeCliQuestion degrades q10 synthesis provider failure into no_signal output', async () => {
  const question = {
    question_id: 'q10_hiring_signal',
    question_text: 'What hiring signals suggest current investment priorities for David Lowe?',
    question_type: 'hiring_signal',
    query: '"David Lowe" careers jobs product engineering data',
  };
  let callCount = 0;

  const result = await runOpenCodeCliQuestion(question, {
    worktreeRoot: mkdtempSync(join(tmpdir(), 'opencode-q10-provider-failure-')),
    opencodeTimeoutMs: 300000,
    standaloneHarness: false,
    spawnRunner: async () => {
      callCount += 1;
      if (callCount === 1) {
        const retrievalEvent = JSON.stringify({
          type: 'text',
          part: {
            text: JSON.stringify({
              question: question.question_text,
              query: question.query,
              leads: [{ title: 'Jobs page', url: 'https://example.com/jobs' }],
              retrieval_summary: 'Found one hiring lead.',
            }),
          },
        });
        return {
          code: 0,
          stdout: `${retrievalEvent}\n`,
          stderr: '',
        };
      }
      const error = new Error('provider failed');
      error.name = 'OpenCodeProviderInsufficientBalanceError';
      error.stdout = '';
      error.stderr = '{"error":{"code":"1113","message":"Insufficient balance or no resource package. Please recharge."}}';
      throw error;
    },
  });

  assert.equal(callCount, 2);
  assert.equal(result.structuredOutput.validation_state, 'no_signal');
  assert.match(result.structuredOutput.context, /Found one hiring lead|synthesis failed/i);
  assert.equal(result.promptTrace.stage_count, 2);
  assert.equal(result.promptTrace.synthesis_failed, true);
  assert.equal(result.promptTrace.failure_name, 'OpenCodeProviderInsufficientBalanceError');
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
  assert.equal(args[4], 'zai-coding-plan/glm-4.7');
  assert.equal(args.includes('--agent'), true);
  assert.equal(args[args.indexOf('--agent') + 1], 'build');
  assert.equal(args.includes('--model'), true);
  assert.equal(args.at(-1), prompt);
});

test('buildOpenCodeRunArgs routes synthesis questions to GLM-4.7 economy model', () => {
  const args = buildOpenCodeRunArgs({ question_id: 'q14_yp_fit' }, 'Return JSON');

  assert.equal(args[args.indexOf('--model') + 1], 'zai-coding-plan/glm-4.7');
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

test('runOpenCodeQuestionSourceBatch preserves execution-class failure provenance for empty tool-call-missing answers', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-question-source-failure-origin-'));
  const sourcePath = join(outputDir, 'source.json');
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'arsenal-fc',
        entity_name: 'Arsenal FC',
        entity_type: 'SPORT_CLUB',
        preset: 'arsenal-fc',
        questions: [
          {
            question_id: 'q3_leadership',
            question_family: 'leadership',
            question_type: 'leadership',
            question_text: 'Who are the key leadership figures at Arsenal FC?',
            query: '"Arsenal FC" chairman chief executive officer board',
            hop_budget: 1,
            source_priority: ['google_serp', 'official_site'],
            execution_class: 'atomic_retrieval',
            structured_output_schema: 'leadership_candidates_v1',
          },
          {
            question_id: 'q15_outreach_strategy',
            question_family: 'outreach_strategy',
            question_type: 'outreach_strategy',
            question_text: 'What is the best outreach strategy for Yellow Panther at Arsenal FC?',
            query: '"Arsenal FC" outreach strategy',
            hop_budget: 1,
            source_priority: ['google_serp', 'official_site'],
            execution_class: 'derived_inference',
            depends_on: ['q3_leadership'],
            structured_output_schema: 'outreach_strategy_v1',
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
        structuredOutput: {},
        promptTrace: {},
        messageTrace: [{ role: 'assistant', completed: false, type: 'cli-run', has_structured_output: false, part_count: 1 }],
        cliResult: { code: 1, stdout: '', stderr: 'child failed' },
      }),
    });

    const meta = JSON.parse(readFileSync(result.meta_result_path, 'utf8'));
    const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
    const tracker = JSON.parse(readFileSync(result.tracker_path, 'utf8'));

    assert.equal(meta.questions[0].validation_state, 'tool_call_missing');
    assert.equal(meta.questions[0].prompt_trace.status, 'atomic_retrieval_tool_call_missing');
    assert.equal(meta.questions[0].prompt_trace.failure_origin, 'atomic_retrieval');
    assert.equal(meta.questions[1].validation_state, 'tool_call_missing');
    assert.equal(meta.questions[1].prompt_trace.status, 'derived_inference_tool_call_missing');
    assert.equal(meta.questions[1].prompt_trace.failure_origin, 'derived_inference');

    assert.equal(tracker.questions[0].validation_state, 'tool_call_missing');
    assert.equal(tracker.questions[1].validation_state, 'tool_call_missing');

    const leadershipAnswer = artifact.answer_records.find((item) => item.question_id === 'q3_leadership');
    const outreachAnswer = artifact.answer_records.find((item) => item.question_id === 'q15_outreach_strategy');

    assert.equal(leadershipAnswer.validation_state, 'failed');
    assert.equal(leadershipAnswer.prompt_trace.status, 'atomic_retrieval_tool_call_missing');
    assert.equal(leadershipAnswer.prompt_trace.failure_origin, 'atomic_retrieval');
    assert.equal(outreachAnswer.validation_state, 'failed');
    assert.equal(outreachAnswer.prompt_trace.status, 'derived_inference_tool_call_missing');
    assert.equal(outreachAnswer.prompt_trace.failure_origin, 'derived_inference');
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodeQuestionSourceBatch rejects object-valued q3 answers without sources as provider no-answer', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-q3-object-answer-'));
  const sourcePath = join(outputDir, 'source.json');

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'milan-cortina-2026',
        entity_name: 'Milan Cortina 2026 Winter Olympics',
        entity_type: 'EVENT',
        questions: [
          {
            question_id: 'q3_leadership',
            question_type: 'leadership',
            question_text: 'Which named people currently hold leadership or commercial roles?',
            query: '"Milan Cortina 2026" leadership commercial director',
            hop_budget: 1,
            source_priority: ['official_site', 'linkedin_people_search'],
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
      structuredOutput: {
        answer: { status: 'no_answer' },
        context: '',
        sources: [],
        confidence: 0,
      },
      promptTrace: { exit_code: 0, has_structured_output: true },
      messageTrace: [],
      cliResult: { code: 0, stdout: '{"answer":{"status":"no_answer"}}', stderr: '' },
    }),
  });

  const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
  const answer = artifact.answer_records[0];

  assert.equal(answer.validation_state, 'failed');
  assert.equal(answer.status, 'failed');
  assert.equal(answer.structured_signal.status, 'provider_no_answer');
  assert.equal(answer.structured_signal.provider_no_answer_reason, 'object_answer_without_sources');
  assert.equal(answer.answer.summary, 'Provider returned an object answer without source-backed content.');
  assert.notEqual(answer.answer.summary, '[object Object]');
  assert.equal(artifact.merge_patch.question_first.answers[0].validation_state, 'failed');
  assert.equal(artifact.merge_patch.question_first.answers[0].structured_signal.status, 'provider_no_answer');
});

test('runOpenCodeQuestionSourceBatch rejects q3 generic foundation facts as leadership answers', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-q3-foundation-fact-'));
  const sourcePath = join(outputDir, 'source.json');

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'baseball-australia',
        entity_name: 'Baseball Australia',
        entity_type: 'FEDERATION',
        questions: [
          {
            question_id: 'q3_leadership',
            question_type: 'leadership',
            question_text: 'Which named people currently hold leadership or commercial roles?',
            query: '"Baseball Australia" leadership commercial director',
            hop_budget: 1,
            source_priority: ['official_site', 'linkedin_people_search', 'wikipedia'],
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
      structuredOutput: {
        answer: '2005',
        context: 'Recovered founded year 2005 from scraped canonical sources after the OpenCode run failed to finalize structured JSON.',
        sources: ['https://en.wikipedia.org/wiki/Baseball_Australia'],
        confidence: 0.85,
      },
      promptTrace: { exit_code: 0, has_structured_output: true },
      messageTrace: [],
      cliResult: { code: 0, stdout: '{"answer":"2005"}', stderr: '' },
    }),
  });

  const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
  const answer = artifact.answer_records[0];

  assert.equal(answer.validation_state, 'failed');
  assert.equal(answer.status, 'failed');
  assert.equal(answer.confidence, 0);
  assert.equal(answer.structured_signal.status, 'provider_no_answer');
  assert.equal(answer.structured_signal.provider_no_answer_reason, 'generic_fact_without_leadership_candidate');
  assert.doesNotMatch(JSON.stringify(answer), /Recovered founded year/i);
});

test('runOpenCodeQuestionSourceBatch promotes q3 nested people into leadership candidates', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-q3-nested-people-'));
  const sourcePath = join(outputDir, 'source.json');

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'exeter-city',
        entity_name: 'Exeter City',
        entity_type: 'CLUB',
        questions: [
          {
            question_id: 'q3_leadership',
            question_type: 'leadership',
            question_text: 'Which named people currently hold leadership or commercial roles?',
            query: '"Exeter City" Head of Commercial',
            hop_budget: 1,
            source_priority: ['official_site', 'linkedin_people_search'],
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
      structuredOutput: {
        answer: {
          people: [
            {
              name: 'Matt Kimberley',
              title: 'Head of Commercial',
              function: 'commercial',
              buyer_relevance: 'high',
              evidence_url: 'https://www.exetercityfc.co.uk/primary/club/whos-who-exeter-city',
              evidence_basis: "Official Exeter City FC Who's Who page",
              confidence: 0.95,
            },
          ],
        },
        context: 'Exeter City official staff page names Matt Kimberley as Head of Commercial.',
        sources: [{ url: 'https://www.exetercityfc.co.uk/primary/club/whos-who-exeter-city' }],
        confidence: 0.9,
      },
      promptTrace: { exit_code: 0, has_structured_output: true },
      messageTrace: [],
      cliResult: { code: 0, stdout: '{"answer":{"people":[{"name":"Matt Kimberley"}]}}', stderr: '' },
    }),
  });

  const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
  const answer = artifact.answer_records[0];

  assert.equal(answer.validation_state, 'validated');
  assert.equal(answer.primary_owner.name, 'Matt Kimberley');
  assert.equal(answer.primary_owner.title, 'Head of Commercial');
  assert.equal(answer.evidence_url, 'https://www.exetercityfc.co.uk/primary/club/whos-who-exeter-city');
  assert.match(answer.answer.summary, /Matt Kimberley/);
  assert.doesNotMatch(JSON.stringify(answer), /\\[object Object\\]/);
});

test('runOpenCodeQuestionSourceBatch does not persist object-valued q11 answers as display text', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-q11-object-answer-'));
  const sourcePath = join(outputDir, 'source.json');

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'milan-cortina-2026',
        entity_name: 'Milan Cortina 2026 Winter Olympics',
        entity_type: 'EVENT',
        questions: [
          {
            question_id: 'q11_decision_owner',
            question_type: 'decision_owner',
            question_text: 'Who is the highest probability named buyer?',
            query: '"Milan Cortina 2026" commercial director',
            hop_budget: 1,
            source_priority: ['official_site', 'linkedin_people_search'],
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
      structuredOutput: {
        answer: { status: 'no_answer' },
        context: '',
        sources: [],
        confidence: 0,
      },
      promptTrace: { exit_code: 0, has_structured_output: true },
      messageTrace: [],
      cliResult: { code: 0, stdout: '{"answer":{"status":"no_answer"}}', stderr: '' },
    }),
  });

  const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
  const answer = artifact.answer_records[0];

  assert.equal(answer.validation_state, 'no_signal');
  assert.notEqual(answer.answer.summary, '[object Object]');
  assert.match(answer.answer.summary, /insufficient_signal|provider returned/i);
  assert.doesNotMatch(JSON.stringify(answer), /\\[object Object\\]/);
});

test('runOpenCodeQuestionSourceBatch serializes object-valued evidence_url to a URL string', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-object-evidence-url-'));
  const sourcePath = join(outputDir, 'source.json');

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'bucks',
        entity_name: 'Milwaukee Bucks',
        entity_type: 'CLUB',
        questions: [
          {
            question_id: 'q11_decision_owner',
            question_type: 'decision_owner',
            question_text: 'Who is the highest probability named buyer?',
            query: '"Milwaukee Bucks" president strategy',
            hop_budget: 1,
            source_priority: ['official_site', 'news'],
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
      structuredOutput: {
        answer: 'insufficient_signal',
        context: 'No plausible buyer owner could be verified.',
        evidence_url: { url: 'https://www.nba.com/bucks/news/josh-glessing-named-president' },
        sources: [{ url: 'https://www.nba.com/bucks/news/josh-glessing-named-president' }],
        confidence: 0,
        validation_state: 'no_signal',
      },
      promptTrace: { exit_code: 0, has_structured_output: true },
      messageTrace: [],
      cliResult: { code: 0, stdout: '{}', stderr: '' },
    }),
  });

  const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
  const answer = artifact.answer_records[0];

  assert.equal(answer.evidence_url, 'https://www.nba.com/bucks/news/josh-glessing-named-president');
  assert.doesNotMatch(JSON.stringify(answer), /\\[object Object\\]/);
});

test('runOpenCodeQuestionSourceBatch upgrades q2 checked_no_signal when accepted vendor evidence exists', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-q2-vendor-upgrade-'));
  const sourcePath = join(outputDir, 'source.json');

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'bucks',
        entity_name: 'Milwaukee Bucks',
        entity_type: 'CLUB',
        questions: [
          {
            question_id: 'q2_digital_stack',
            question_type: 'digital_stack',
            question_text: 'What visible technologies, platforms, or vendors does Milwaukee Bucks use?',
            query: '"Milwaukee Bucks" digital stack',
            hop_budget: 1,
            source_priority: ['official_site', 'vendor_page'],
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
      structuredOutput: {
        answer: 'digital_footprint_unknown',
        context: 'Adobe Experience Cloud and Tradable Bits are visible, but implementation details are thin.',
        sources: [
          'https://business.adobe.com/customer-success-stories/milwaukee-bucks-case-study.html',
          'https://blog.tradablebits.com/how-the-milwaukee-bucks-engaged-8.5k-fans-for-over-34k-minutes-in-their-app',
        ],
        confidence: 0,
        validation_state: 'checked_no_signal',
        checked_sources: [
          {
            url: 'https://business.adobe.com/customer-success-stories/milwaukee-bucks-case-study.html',
            accepted: true,
            reason: 'digital_footprint_hint - mentions Adobe Experience Cloud',
          },
          {
            url: 'https://blog.tradablebits.com/how-the-milwaukee-bucks-engaged-8.5k-fans-for-over-34k-minutes-in-their-app',
            accepted: true,
            reason: 'digital_footprint_hint - references Tradable Bits platform',
          },
        ],
      },
      promptTrace: { exit_code: 0, has_structured_output: true },
      messageTrace: [],
      cliResult: { code: 0, stdout: '{}', stderr: '' },
    }),
  });

  const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
  const answer = artifact.answer_records[0];

  assert.equal(answer.validation_state, 'provisional');
  assert.equal(answer.confidence, 0.65);
  assert.match(answer.answer.raw_structured_output.summary, /Adobe/);
  assert.match(answer.answer.raw_structured_output.summary, /Tradable Bits/);
  assert.equal(answer.structured_signal.digital_footprint_unknown, false);
  assert.equal(answer.structured_signal.vendor_hints.length, 2);
});

test('runOpenCodeQuestionSourceBatch grounds q1 from canonical entity metadata when provider returns no signal', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-q1-canonical-grounding-'));
  const sourcePath = join(outputDir, 'source.json');

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'houston-rockets',
        entity_name: 'Houston Rockets',
        entity_type: 'Club',
        questions: [
          {
            question_id: 'q1_foundation',
            question_type: 'foundation',
            question_family: 'foundation',
            question_text: 'What is the canonical identity and grounding profile for Houston Rockets?',
            query: '"Houston Rockets" official website founded year',
            hop_budget: 1,
            source_priority: ['google_serp', 'official_site', 'wikipedia'],
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
      structuredOutput: {
        answer: '',
        context: 'No supporting evidence was finalized by the model.',
        sources: [],
        confidence: 0,
        validation_state: 'no_signal',
      },
      promptTrace: { exit_code: 0, has_structured_output: true },
      messageTrace: [],
      cliResult: { code: 0, stdout: '{}', stderr: '' },
    }),
  });

  const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
  const answer = artifact.answer_records[0];

  assert.equal(answer.validation_state, 'provisional');
  assert.equal(answer.confidence, 0.6);
  assert.equal(answer.structured_signal.status, 'canonical_entity_grounded');
  assert.equal(answer.structured_signal.canonical_name, 'Houston Rockets');
  assert.equal(answer.structured_signal.official_site, null);
  assert.equal(answer.answer.raw_structured_output.checked_sources[0].source, 'canonical_entities');
  assert.match(answer.answer.raw_structured_output.summary, /did not return official-site evidence/i);
});

test('runOpenCodeQuestionSourceBatch rejects source-less q6 positive claims and adds readable display answer', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-q6-sourceless-positive-'));
  const sourcePath = join(outputDir, 'source.json');

  writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        entity_id: 'arsenal-fc',
        entity_name: 'Arsenal FC',
        entity_type: 'CLUB',
        questions: [
          {
            question_id: 'q6_launch_signal',
            question_type: 'launch_signal',
            question_text: 'What products, apps, platforms, or fan experiences has Arsenal FC launched?',
            query: '"Arsenal FC" launch app platform',
            hop_budget: 1,
            source_priority: ['official_site', 'press_release'],
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
      structuredOutput: {
        answer: 'Arsenal launched a new fan engagement platform.',
        context: 'Positive launch claim without source evidence.',
        sources: [],
        confidence: 0.86,
      },
      promptTrace: { exit_code: 0, has_structured_output: true },
      messageTrace: [],
      cliResult: { code: 0, stdout: '{"answer":"Arsenal launched a new fan engagement platform."}', stderr: '' },
    }),
  });

  const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
  const answer = artifact.answer_records[0];

  assert.equal(answer.validation_state, 'failed');
  assert.equal(answer.confidence, 0);
  assert.equal(answer.structured_signal.status, 'provider_no_answer');
  assert.equal(answer.structured_signal.provider_no_answer_reason, 'source_less_positive_claim');
  assert.equal(answer.prompt_trace.provider_no_answer_reason, 'source_less_positive_claim');
  assert.equal(answer.display_answer.status_label, 'failed');
  assert.match(answer.display_answer.headline, /could not be converted|without source-backed content/i);
  assert.doesNotMatch(JSON.stringify(answer.display_answer), /\\[object Object\\]/);
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
  assert.equal(events.length, 5);
  assert.deepEqual(
    events.map((event) => event.event_type),
    ['question_progress', 'question_completed', 'question_progress', 'question_completed', 'batch_complete'],
  );
  assert.equal(events[0].current_question_id, 'q1');
  assert.equal(events[0].current_question_text, 'When was Major League Cricket founded?');
  assert.equal(events[0].current_execution_state, 'searching sources');
  assert.deepEqual(events[0].current_source_order, ['google_serp']);
  assert.equal(events[0].current_substep, 'question_first_running');
  assert.equal(events[0].current_substep_progress, '1/2 questions');
  assert.equal(events[1].current_question_id, 'q1');
  assert.equal(events[1].completed_question.question_id, 'q1');
  assert.equal(events[1].completed_question.validation_state, 'no_signal');
  assert.equal(events[1].questions_answered, 1);
  assert.equal(events[2].current_question_id, 'q2');
  assert.equal(events[3].completed_question.question_id, 'q2');
  assert.equal(events[3].questions_answered, 2);
  assert.equal(events[4].current_substep, 'question_first_completed');
  assert.equal(events[4].questions_total, 2);
});

// Parity inventory for the old dossier-backed path:
// - Matrix metadata must survive into question_first_run_v2 question_specs and answer_records.
// - {entity} templates must be hydrated before prompt/execution/progress emission.
// - Progress events must carry framework metadata directly from the runner, not rely on backend repair.
test('runOpenCodeQuestionSourceBatch preserves old matrix metadata and framework progress fields from the canonical parity smoke source', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-parity-smoke-'));
  const events = [];

  const result = await runOpenCodeQuestionSourceBatch({
    questionSourcePath: CANONICAL_PARITY_SMOKE_SOURCE,
    outputDir,
    onProgress: (event) => {
      events.push(event);
    },
    questionRunner: async (question) => ({
      structuredOutput: {
        question: question.question_text,
        answer: question.question_id === 'q1_foundation' ? '1886' : 'Vendor and platform changes are visible.',
        context: `stubbed-${question.question_id}`,
        sources: [`https://example.com/${question.question_id}`],
        confidence: question.question_id === 'q1_foundation' ? 0.82 : 0.74,
        validation_state: question.question_id === 'q1_foundation' ? 'validated' : 'provisional',
        evidence_grade: question.question_id === 'q7_procurement_signal' ? 'moderate' : undefined,
        structured_signal: question.question_id === 'q7_procurement_signal'
          ? {
            vendor_changes: [
              {
                name: 'VendorCo',
                evidence_url: 'https://example.com/q7_procurement_signal',
                evidence_kind: 'vendor_change',
                summary: 'Named vendor evidence.',
              },
            ],
            platform_migrations: [],
            partnerships: [],
            org_changes: [],
          }
          : undefined,
      },
      promptTrace: { status: 'ok', structured_output_keys: 1, has_structured_output: true },
      messageTrace: [{ role: 'assistant', completed: true, type: 'cli-run', has_structured_output: true, part_count: 1 }],
      cliResult: { code: 0, stdout: '{"answer":"stub"}', stderr: '' },
    }),
  });

  const artifact = JSON.parse(readFileSync(result.question_first_run_path, 'utf8'));
  const foundationSpec = artifact.question_specs.find((item) => item.question_id === 'q1_foundation');
  const procurementSpec = artifact.question_specs.find((item) => item.question_id === 'q7_procurement_signal');
  const procurementAnswer = artifact.answer_records.find((item) => item.question_id === 'q7_procurement_signal');

  assert.equal(foundationSpec.question_text, 'When was Arsenal FC founded?');
  assert.equal(foundationSpec.question_family, 'foundation');
  assert.equal(foundationSpec.structured_output_schema, 'foundation_v1');
  assert.equal(foundationSpec.execution_class, 'atomic_retrieval');
  assert.equal(foundationSpec.rollout_phase, 'phase_1_core');
  assert.equal(foundationSpec.evidence_extension_budget, 1);
  assert.deepEqual(foundationSpec.graph_write_targets, ['entity.identity.foundation']);

  assert.equal(procurementSpec.question_text, 'Is there evidence Arsenal FC is buying, reshaping vendors, or changing its ecosystem?');
  assert.equal(procurementSpec.question_family, 'procurement_signal');
  assert.equal(procurementSpec.structured_output_schema, 'procurement_signal_v1');
  assert.equal(procurementSpec.execution_class, 'commercial_signal');
  assert.equal(procurementSpec.rollout_phase, 'phase_1_core');
  assert.equal(procurementSpec.evidence_extension_budget, 2);
  assert.deepEqual(procurementSpec.depends_on, ['q1_foundation']);

  assert.equal(procurementAnswer.structured_output_schema, 'procurement_signal_v1');
  assert.equal(procurementAnswer.execution_class, 'commercial_signal');
  assert.equal(procurementAnswer.rollout_phase, 'phase_1_core');

  assert.equal(events.length, 5);
  assert.equal(events[0].current_question_id, 'q1_foundation');
  assert.equal(events[0].current_question_text, 'When was Arsenal FC founded?');
  assert.equal(events[0].current_section_label, 'Core Information');
  assert.equal(events[0].current_strategy_label, 'Direct factual lookup');
  assert.deepEqual(events[0].current_source_order, ['google_serp', 'official_site', 'wikipedia']);
  assert.equal(events[0].current_question_index, 1);
  assert.equal(events[0].current_question_total, 1);
  assert.equal(events[1].event_type, 'question_completed');
  assert.equal(events[1].completed_question.question_id, 'q1_foundation');
  assert.equal(events[2].current_question_id, 'q7_procurement_signal');
  assert.equal(events[2].current_section_label, 'Strategic Opportunities');
  assert.equal(events[2].current_strategy_label, 'Bounded procurement signal sweep with optional LinkedIn signal check');
  assert.deepEqual(events[2].current_source_order, [
    'official_site',
    'tender_portal',
    'press_release',
    'partner_announcement',
    'linkedin_posts',
  ]);
  assert.equal(events[3].event_type, 'question_completed');
  assert.equal(events[3].completed_question.question_id, 'q7_procurement_signal');
});

test('buildQuestionState uses evidence extension confidence thresholds from the old matrix when provided', () => {
  const state = buildQuestionState({
    question_id: 'q7_procurement_signal',
    question_type: 'procurement_signal',
    question_text: 'Is there evidence Arsenal FC is changing vendors?',
    query: '"Arsenal FC" platform migration provider partnership',
    hop_budget: 2,
    evidence_extension_confidence_threshold: 0.68,
    source_priority: ['google_serp'],
  });

  assert.equal(state.confidence_threshold, 0.68);
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

test('runOpenCodePresetBatch treats checkpointed tool-call-missing questions as terminal on resume', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-checkpoint-resume-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';
  const questions = buildMajorLeagueCricketSmokeQuestions();
  questions.__question_first_checkpoint = {
    schema_version: 'question_first_checkpoint_v1',
    questions_total: 2,
    questions_answered: 2,
    last_completed_question_id: 'sl_league_mobile_app',
    next_question_id: null,
    updated_at: '2026-04-30T00:00:00.000Z',
    terminal_states: {
      entity_founded_year: 'tool_call_missing',
      sl_league_mobile_app: 'no_signal',
    },
    answer_records: [
      {
        question_id: 'entity_founded_year',
        question_type: 'foundation',
        question: 'When was Major League Cricket founded?',
        answer: '',
        validation_state: 'tool_call_missing',
        confidence: 0,
        sources: [],
        prompt_trace: { status: 'atomic_retrieval_tool_call_missing' },
        message_trace: [{ role: 'assistant', completed: false, type: 'cli-run' }],
      },
      {
        question_id: 'sl_league_mobile_app',
        question_type: 'digital_stack',
        question: 'What is the digital stack?',
        answer: '',
        validation_state: 'no_signal',
        confidence: 0,
        sources: [],
      },
    ],
  };
  const events = [];

  try {
    const resumed = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      questionsOverride: questions,
      resume: true,
      onProgress: (event) => {
        events.push(event);
      },
      questionRunner: async () => {
        throw new Error('checkpointed terminal questions should not re-run');
      },
    });

    assert.equal(resumed.questions_total, 2);
    assert.deepEqual(events.map((event) => event.event_type), ['batch_complete']);
    const state = JSON.parse(readFileSync(resumed.state_path, 'utf8'));
    assert.equal(state.questions[0].status, 'tool_call_missing');
    assert.equal(state.questions[1].status, 'no_signal');
  } finally {
    if (previousZaiApiKey === undefined) {
      delete process.env.ZAI_API_KEY;
    } else {
      process.env.ZAI_API_KEY = previousZaiApiKey;
    }
  }
});

test('runOpenCodePresetBatch prefers a richer checkpoint over a stale local resume state', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'opencode-batch-checkpoint-over-state-'));
  const previousZaiApiKey = process.env.ZAI_API_KEY;
  delete process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'test-zai-token';
  const questions = buildMajorLeagueCricketSmokeQuestions();
  const staleStatePath = join(outputDir, 'major-league-cricket_major-league-cricket-smoke_state.json');
  writeFileSync(staleStatePath, JSON.stringify({
    run_id: 'stale',
    run_started_at: '2026-04-29T00:00:00.000Z',
    last_run_at: '2026-04-29T00:00:00.000Z',
    preset: 'major-league-cricket-smoke',
    questions: questions.map((question) => buildQuestionState(question, {
      runId: 'stale',
      timestamp: '2026-04-29T00:00:00.000Z',
    })),
  }, null, 2));
  questions.__question_first_checkpoint = {
    schema_version: 'question_first_checkpoint_v1',
    questions_total: 2,
    questions_answered: 2,
    last_completed_question_id: 'sl_league_mobile_app',
    next_question_id: null,
    updated_at: '2026-04-30T00:00:00.000Z',
    terminal_states: {
      entity_founded_year: 'tool_call_missing',
      sl_league_mobile_app: 'no_signal',
    },
    answer_records: [
      {
        question_id: 'entity_founded_year',
        validation_state: 'tool_call_missing',
        confidence: 0,
        sources: [],
      },
      {
        question_id: 'sl_league_mobile_app',
        validation_state: 'no_signal',
        confidence: 0,
        sources: [],
      },
    ],
  };

  try {
    const resumed = await runOpenCodePresetBatch({
      outputDir,
      preset: 'major-league-cricket-smoke',
      questionsOverride: questions,
      resume: true,
      questionRunner: async () => {
        throw new Error('stale local state should not override the checkpoint');
      },
    });

    assert.equal(resumed.questions_total, 2);
    const state = JSON.parse(readFileSync(resumed.state_path, 'utf8'));
    assert.equal(state.questions[0].status, 'tool_call_missing');
    assert.equal(state.questions[1].status, 'no_signal');
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
