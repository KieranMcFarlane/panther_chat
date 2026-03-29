#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { query } from '@anthropic-ai/claude-agent-sdk';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(MODULE_DIR, '..');
const WORKTREE_ROOT = path.resolve(APP_ROOT, '..', '..');
const DEFAULT_BRIGHTDATA_SERVER = path.join(APP_ROOT, 'src', 'mcp-brightdata-server.js');
const DEFAULT_MODEL =
  process.env.CLAUDE_AGENT_MODEL ||
  process.env.ZAI_MODEL ||
  'claude-3-5-haiku-20241022';

function _loadEnv() {
  for (const envPath of [
    path.resolve(WORKTREE_ROOT, '..', '..', 'apps', 'signal-noise-app', '.env'),
    path.join(WORKTREE_ROOT, '.env'),
    path.join(APP_ROOT, '.env'),
    path.join(APP_ROOT, 'backend', '.env'),
  ]) {
    try {
      loadDotenv({ path: envPath, override: true });
    } catch {
      // ignore unreadable env files; later paths override earlier ones
    }
  }
}

function _slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'entity';
}

function _presetQuestionSpecs(entityName) {
  return [
    {
      question_id: 'entity_founded_year',
      question_type: 'foundation',
      question_text: `When was ${entityName} founded?`,
      query: `"${entityName}" founded`,
      hop_budget: 2,
      source_priority: ['google_serp', 'official_site', 'wikipedia', 'press_release', 'news'],
      yp_service_fit: [],
    },
    {
      question_id: 'sl_league_mobile_app',
      question_type: 'procurement',
      question_text: `What league-wide mobile app or digital platform initiatives is ${entityName} pursuing?`,
      query: `"${entityName}" RFP tender procurement`,
      hop_budget: 3,
      source_priority: ['google_serp', 'linkedin_posts', 'official_site', 'press_release', 'news'],
      yp_service_fit: ['MOBILE_APPS', 'FAN_ENGAGEMENT'],
    },
    {
      question_id: 'poi_commercial_partnerships_lead',
      question_type: 'poi',
      question_text: `Who leads commercial partnerships or business development at ${entityName}?`,
      query: `"${entityName}" commercial partnerships LinkedIn`,
      hop_budget: 2,
      source_priority: ['google_serp', 'linkedin_profiles', 'linkedin_posts', 'official_site'],
      yp_service_fit: ['FAN_ENGAGEMENT'],
    },
    {
      question_id: 'poi_digital_product_lead',
      question_type: 'poi',
      question_text: `Who leads digital product, web, or app initiatives at ${entityName}?`,
      query: `"${entityName}" digital product LinkedIn`,
      hop_budget: 2,
      source_priority: ['google_serp', 'linkedin_profiles', 'linkedin_posts', 'official_site'],
      yp_service_fit: ['MOBILE_APPS', 'DIGITAL_TRANSFORMATION'],
    },
    {
      question_id: 'poi_fan_engagement_lead',
      question_type: 'poi',
      question_text: `Who leads fan engagement, CRM, or audience growth at ${entityName}?`,
      query: `"${entityName}" fan engagement LinkedIn`,
      hop_budget: 2,
      source_priority: ['google_serp', 'linkedin_profiles', 'linkedin_posts', 'official_site'],
      yp_service_fit: ['FAN_ENGAGEMENT'],
    },
    {
      question_id: 'poi_marketing_comms_lead',
      question_type: 'poi',
      question_text: `Who leads marketing or communications at ${entityName}?`,
      query: `"${entityName}" marketing communications LinkedIn`,
      hop_budget: 2,
      source_priority: ['google_serp', 'linkedin_profiles', 'linkedin_posts', 'official_site'],
      yp_service_fit: ['FAN_ENGAGEMENT'],
    },
    {
      question_id: 'poi_operations_lead',
      question_type: 'poi',
      question_text: `Who leads operations, strategy, or business operations at ${entityName}?`,
      query: `"${entityName}" operations LinkedIn`,
      hop_budget: 2,
      source_priority: ['google_serp', 'linkedin_profiles', 'linkedin_posts', 'official_site'],
      yp_service_fit: ['DIGITAL_TRANSFORMATION', 'ANALYTICS'],
    },
  ];
}

export function buildMajorLeagueCricketPresetQuestions() {
  const entityName = 'Major League Cricket';
  const entityId = 'major-league-cricket';
  const entityType = 'SPORT_LEAGUE';
  return _presetQuestionSpecs(entityName).map((spec) => ({
    entity_name: entityName,
    entity_id: entityId,
    entity_type: entityType,
    preset: 'major-league-cricket',
    ...spec,
  }));
}

export function buildClaudeAgentQuestionPrompt(question) {
  return [
    'You are the discovery controller for Yellow Panther.',
    'Use the brightdata MCP server by name.',
    'First call mcp__brightdata__search_engine with the canonical query.',
    'If the first result set is weak, use mcp__brightdata__scrape_as_markdown or mcp__brightdata__scrape_batch on the top candidates.',
    `Question type: ${question.question_type}`,
    `Question: ${question.question_text}`,
    `Canonical query: ${question.query}`,
    `Hop budget: ${question.hop_budget}`,
    `Source priority: ${question.source_priority.join(' -> ')}`,
    'If the first pass is noisy, use a small number of additional hops within budget.',
    'Answer only with validated JSON matching the schema.',
    'Do not return markdown or prose.',
    'Schema keys: answer, signal_type, confidence, validation_state, evidence_url, recommended_next_query, notes',
  ].join('\n');
}

export function buildClaudeAgentQuestionSchema() {
  return {
    type: 'object',
    properties: {
      answer: { type: 'string' },
      signal_type: { type: 'string' },
      confidence: { type: 'number' },
      validation_state: { type: 'string' },
      evidence_url: { type: 'string' },
      recommended_next_query: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['answer', 'signal_type', 'confidence', 'validation_state', 'evidence_url', 'recommended_next_query', 'notes'],
    additionalProperties: true,
  };
}

function _buildSystemPrompt(question) {
  const searchPriority = question.source_priority.join(' -> ');
  return {
    type: 'preset',
    preset: 'claude_code',
    append: [
      'You are an agentic discovery assistant.',
      'Use BrightData MCP as the only retrieval transport.',
      `Question type: ${question.question_type}`,
      `Search priority: ${searchPriority}`,
      'Search broadly on Google first, inspect evidence carefully, and prefer LinkedIn, official site, press, PDF, and clearly entity-specific evidence.',
      'If the first pass is noisy, perform one recovery query before scraping the best result or top-K.',
      'Judge evidence strictly and return JSON only.',
      'Do not output markdown or prose.',
      'Use the configured brightdata-mcp server explicitly.',
    ].join('\n'),
  };
}

function _buildRuntimeOptions(question, { env = process.env, brightdataServerPath = DEFAULT_BRIGHTDATA_SERVER } = {}) {
  const brightDataToken = env.BRIGHTDATA_API_TOKEN || env.BRIGHTDATA_TOKEN || '';
  const brightDataZone = env.BRIGHTDATA_ZONE || 'linkedin_posts_monitor';
  const zaiToken = env.ZAI_API_KEY || env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY || '';
  const baseURL = env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic';

  if (!brightDataToken.trim()) {
    throw new Error('BRIGHTDATA_API_TOKEN is required for the BrightData MCP transport');
  }
  if (!zaiToken.trim()) {
    throw new Error('ZAI_API_KEY (or ANTHROPIC_AUTH_TOKEN) is required for the Claude Agent SDK gateway');
  }

  return {
    model: DEFAULT_MODEL,
    mcpServers: {
      brightdata: {
        command: 'node',
        args: [brightdataServerPath],
        env: {
          API_TOKEN: brightDataToken,
          BRIGHTDATA_API_TOKEN: brightDataToken,
          BRIGHTDATA_TOKEN: brightDataToken,
          PRO_MODE: 'true',
          BRIGHTDATA_ZONE: brightDataZone,
        },
      },
    },
    allowedTools: [
      'mcp__brightdata__search_engine',
      'mcp__brightdata__scrape_as_markdown',
      'mcp__brightdata__scrape_batch',
    ],
    hooks: {
      PreToolUse: [
        {
          matcher: 'mcp__brightdata__search_engine|mcp__brightdata__scrape_as_markdown|mcp__brightdata__scrape_batch',
          hooks: [async (input, toolUseId) => {
            console.error(`[claude-agent][PreToolUse] ${toolUseId || 'unknown'} ${JSON.stringify(input, null, 2)}`);
            return {};
          }],
        },
      ],
      PostToolUse: [
        {
          matcher: 'mcp__brightdata__search_engine|mcp__brightdata__scrape_as_markdown|mcp__brightdata__scrape_batch',
          hooks: [async (input, toolUseId) => {
            console.error(`[claude-agent][PostToolUse] ${toolUseId || 'unknown'} ${JSON.stringify(input, null, 2)}`);
            return {};
          }],
        },
      ],
    },
    permissionMode: 'default',
    maxTurns: Math.max(6, question.hop_budget + 4),
    includePartialMessages: true,
    systemPrompt: _buildSystemPrompt(question),
    env: {
      ...env,
      ANTHROPIC_BASE_URL: baseURL,
      ZAI_API_KEY: zaiToken,
      ANTHROPIC_AUTH_TOKEN: zaiToken,
      ANTHROPIC_API_KEY: zaiToken,
    },
    stderr: (data) => {
      if (data) {
        process.stderr.write(`[claude-agent][stderr] ${data}`);
      }
    },
  };
}

function _extractTextFromMessage(message) {
  if (!message) return '';
  if (typeof message.result === 'string') return message.result;
  if (typeof message.content === 'string') return message.content;
  const content = message.message?.content || message.content || [];
  if (Array.isArray(content)) {
    return content
      .map((part) => part?.type === 'text' ? part.text : part?.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  if (typeof content === 'string') return content;
  return '';
}

function _safeJsonParse(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}') + 1;
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function _summarizeMessage(message) {
  return {
    type: message?.type || null,
    subtype: message?.subtype || null,
    name: message?.name || message?.tool || null,
    completed: Boolean(message?.completed || message?.time?.completed),
    has_text: Boolean(_extractTextFromMessage(message)),
    has_result: Boolean(message?.result),
  };
}

function _classifyValidationState(structuredOutput, toolUseCount) {
  if (!structuredOutput || typeof structuredOutput !== 'object' || Object.keys(structuredOutput).length === 0) {
    return toolUseCount > 0 ? 'no_signal' : 'tool_call_missing';
  }
  return structuredOutput.validation_state || 'no_signal';
}

function _buildQuestionPayload(question, structuredOutput, sessionId, { messages = [], promptText = '', toolUseCount = 0, assistantText = '' } = {}) {
  const validationState = _classifyValidationState(structuredOutput, toolUseCount);
  return {
    question_id: question.question_id,
    question_type: question.question_type,
    question_text: question.question_text,
    question: question.question_text,
    query: question.query,
    hop_budget: question.hop_budget,
    source_priority: question.source_priority,
    entity_name: question.entity_name,
    entity_id: question.entity_id,
    entity_type: question.entity_type,
    preset: question.preset,
    model_used: DEFAULT_MODEL,
    session_id: sessionId,
    agentic_plan: {
      source_priority: question.source_priority,
      stop_rule: `continue for up to ${question.hop_budget} hops within Claude Agent SDK steps budget`,
    },
    prompt_text: promptText,
    message_trace: messages.map(_summarizeMessage),
    tool_use_count: toolUseCount,
    reasoning: {
      structured_output: structuredOutput,
    },
    answer: structuredOutput?.answer || '',
    signal_type: structuredOutput?.signal_type || 'NO_SIGNAL',
    confidence: structuredOutput?.confidence ?? 0,
    validation_state: validationState,
    evidence_url: structuredOutput?.evidence_url || '',
    recommended_next_query: structuredOutput?.recommended_next_query || '',
    notes: structuredOutput?.notes || assistantText || '',
  };
}

async function _runSingleQuestion({ question, env, brightdataServerPath, queryFn, timeoutMs = Number(env.AGENT_SDK_TIMEOUT_MS || env.API_TIMEOUT_MS || 60000) }) {
  const runtime = _buildRuntimeOptions(question, { env, brightdataServerPath });
  const prompt = buildClaudeAgentQuestionPrompt(question);
  const messages = [];
  let finalResultText = '';
  let assistantText = '';
  let toolUseCount = 0;
  let sessionId = null;

  console.error(`[claude-agent] query=${question.query}`);

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(new Error(`Agent SDK timed out after ${timeoutMs}ms`)), timeoutMs);

  try {
    for await (const message of queryFn({
      prompt,
      options: {
        model: runtime.model,
        abortController,
        mcpServers: runtime.mcpServers,
        allowedTools: runtime.allowedTools,
        hooks: runtime.hooks,
        permissionMode: runtime.permissionMode,
        maxTurns: runtime.maxTurns,
        includePartialMessages: runtime.includePartialMessages,
        systemPrompt: runtime.systemPrompt,
        env: runtime.env,
        stderr: runtime.stderr,
      },
    })) {
      messages.push(message);
      if (message?.type === 'system' && message?.subtype === 'init') {
        sessionId = message?.session_id || message?.sessionId || sessionId;
      }
      if (message?.type === 'tool_use') {
        toolUseCount += 1;
        console.error(`[claude-agent] tool_use ${message.name || message.tool || 'unknown'}`);
      } else if (message?.type === 'tool_result') {
        console.error('[claude-agent] tool_result');
      } else if (message?.type === 'assistant') {
        console.error('[claude-agent] assistant');
        const text = _extractTextFromMessage(message);
        if (text) assistantText = text;
      } else if (message?.type === 'stream_event') {
        const eventType = message?.event?.type || 'unknown';
        console.error(`[claude-agent] stream_event ${eventType} ${JSON.stringify(message.event, null, 2)}`);
      } else if (message?.type === 'result') {
        console.error(`[claude-agent] result ${message.subtype || 'unknown'}`);
        const resultText = _extractTextFromMessage(message);
        if (resultText) finalResultText = resultText;
      } else {
        console.error(`[claude-agent] ${message?.type || 'unknown'}`);
      }
      const text = _extractTextFromMessage(message);
      if (text) {
        finalResultText = text;
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  const structuredOutput = _safeJsonParse(finalResultText) || _safeJsonParse(assistantText) || {};
  const payload = _buildQuestionPayload(question, structuredOutput, sessionId, {
    messages,
    promptText: prompt,
    toolUseCount,
    assistantText,
  });

  if (payload.validation_state === 'tool_call_missing' && toolUseCount > 0) {
    payload.validation_state = 'no_signal';
  }

  return {
    payload,
    messages,
    finalResultText,
    structuredOutput,
    toolUseCount,
  };
}

export async function runClaudeAgentPresetBatch({
  outputDir,
  preset = 'major-league-cricket',
  env = process.env,
  brightdataServerPath = DEFAULT_BRIGHTDATA_SERVER,
  queryFn = query,
} = {}) {
  if (_slugify(preset) !== 'major-league-cricket') {
    throw new Error(`Unsupported preset ${JSON.stringify(preset)}. Expected 'major-league-cricket'.`);
  }
  if (!outputDir) {
    throw new Error('outputDir is required');
  }

  _loadEnv();
  const questions = buildMajorLeagueCricketPresetQuestions();
  const runStartedAt = new Date().toISOString();
  const finalQuestions = [];
  const perQuestionPayloads = [];
  const transcripts = [];

  for (const [index, question] of questions.entries()) {
    const { payload, messages } = await _runSingleQuestion({
      question,
      env,
      brightdataServerPath,
      queryFn,
    });
    finalQuestions.push(payload);
    perQuestionPayloads.push({
      run_started_at: runStartedAt,
      entity_name: question.entity_name,
      entity_id: question.entity_id,
      entity_type: question.entity_type,
      preset: question.preset,
      question: payload,
    });
    transcripts.push(
      [
        `Question ${index + 1}: ${question.question_id}`,
        `Prompt: ${question.query}`,
        `Validation: ${payload.validation_state}`,
        `Tool uses: ${payload.tool_use_count}`,
        `Answer: ${payload.answer || 'n/a'}`,
      ].join('\n'),
    );
    if (!messages || messages.length === 0) {
      transcripts.push('No messages returned.');
    }
  }

  const slug = _slugify('major-league-cricket');
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').replace('T', '_').replace('Z', '');
  const stem = `${slug}_claude_agent_batch_${timestamp}`;
  await fs.mkdir(outputDir, { recursive: true });

  const metaPath = path.join(outputDir, `${stem}_meta.json`);
  const rollupPath = path.join(outputDir, `${stem}_rollup.json`);
  const transcriptPath = path.join(outputDir, `${stem}.txt`);
  const questionPaths = [];

  for (const [index, payload] of perQuestionPayloads.entries()) {
    const questionPath = path.join(outputDir, `${stem}_question_${String(index + 1).padStart(3, '0')}.json`);
    await fs.writeFile(questionPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    questionPaths.push(questionPath);
  }

  const questionsValidated = finalQuestions.filter((item) => item.validation_state === 'validated').length;
  const questionsNoSignal = finalQuestions.filter((item) => item.validation_state === 'no_signal').length;
  const questionsProvisional = finalQuestions.filter((item) => item.validation_state === 'provisional').length;

  const metaPayload = {
    run_started_at: runStartedAt,
    entity_name: 'Major League Cricket',
    entity_id: 'major-league-cricket',
    entity_type: 'SPORT_LEAGUE',
    preset: 'major-league-cricket',
    questions: finalQuestions,
  };
  const rollupPayload = {
    run_started_at: runStartedAt,
    entity_name: 'Major League Cricket',
    entity_id: 'major-league-cricket',
    entity_type: 'SPORT_LEAGUE',
    preset: 'major-league-cricket',
    questions_total: finalQuestions.length,
    questions_validated: questionsValidated,
    questions_no_signal: questionsNoSignal,
    questions_provisional: questionsProvisional,
    meta_result_path: metaPath,
    question_result_paths: questionPaths,
    question_results_path: metaPath,
    transcript_path: transcriptPath,
  };

  await fs.writeFile(metaPath, `${JSON.stringify(metaPayload, null, 2)}\n`, 'utf8');
  await fs.writeFile(transcriptPath, `${transcripts.join('\n\n')}\n`, 'utf8');
  await fs.writeFile(rollupPath, `${JSON.stringify(rollupPayload, null, 2)}\n`, 'utf8');

  return {
    ...rollupPayload,
    rollup_path: rollupPath,
    meta_result_path: metaPath,
    question_result_paths: questionPaths,
    question_results_path: metaPath,
    transcript_path: transcriptPath,
  };
}

async function main(argv = process.argv.slice(2)) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.replace(/^--/, '');
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, true);
    } else {
      args.set(key, next);
      index += 1;
    }
  }

  const outputDir = args.get('output-dir');
  if (!outputDir) {
    throw new Error('--output-dir is required');
  }
  const preset = args.get('preset') || 'major-league-cricket';
  const result = await runClaudeAgentPresetBatch({
    outputDir: path.resolve(outputDir),
    preset,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
