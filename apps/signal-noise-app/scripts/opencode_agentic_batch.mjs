#!/usr/bin/env node

import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import dotenv from 'dotenv';
import {
  buildQuestionFirstRunArtifact,
  validateQuestionFirstRunArtifact,
} from './question_first_run_contract.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(MODULE_DIR, '..');
const WORKTREE_ROOT = path.resolve(APP_ROOT, '..', '..');
const OPCODE_WORKTREE_ROOT = path.resolve(WORKTREE_ROOT, '.worktrees', 'opencode-question-first-ssot');
const DEFAULT_PROVIDER_ID = 'zai-coding-plan';
const DEFAULT_MODEL_ID = 'glm-5';
const DEFAULT_MODEL = `${DEFAULT_PROVIDER_ID}/${DEFAULT_MODEL_ID}`;
const DEFAULT_QUESTION_MODEL = process.env.OPENCODE_QUESTION_MODEL || DEFAULT_MODEL;

function _loadEnv() {
  for (const envPath of [
    path.resolve(WORKTREE_ROOT, '..', '..', 'apps', 'signal-noise-app', '.env'),
    path.join(WORKTREE_ROOT, '.env'),
    path.join(APP_ROOT, '.env'),
    path.join(APP_ROOT, 'backend', '.env'),
  ]) {
    dotenv.config({ path: envPath, override: true });
  }
}

function _slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'entity';
}

function _questionText(question, entityName = '') {
  const text = String(question?.question_text || question?.question || '').trim();
  if (!text) {
    return '';
  }
  const resolvedEntityName = String(entityName || question?.entity_name || question?.entityName || '').trim();
  return resolvedEntityName ? text.replaceAll('{entity}', resolvedEntityName) : text;
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
      query: `"${entityName}" commercial partnerships`,
      hop_budget: 2,
      source_priority: ['google_serp', 'official_site', 'news'],
      yp_service_fit: ['FAN_ENGAGEMENT'],
    },
    {
      question_id: 'poi_digital_product_lead',
      question_type: 'poi',
      question_text: `Who leads digital product, web, or app initiatives at ${entityName}?`,
      query: `"${entityName}" digital product`,
      hop_budget: 2,
      source_priority: ['google_serp', 'official_site', 'news'],
      yp_service_fit: ['MOBILE_APPS', 'DIGITAL_TRANSFORMATION'],
    },
    {
      question_id: 'poi_fan_engagement_lead',
      question_type: 'poi',
      question_text: `Who leads fan engagement, CRM, or audience growth at ${entityName}?`,
      query: `"${entityName}" fan engagement`,
      hop_budget: 2,
      source_priority: ['google_serp', 'official_site', 'news'],
      yp_service_fit: ['FAN_ENGAGEMENT'],
    },
    {
      question_id: 'poi_marketing_comms_lead',
      question_type: 'poi',
      question_text: `Who leads marketing or communications at ${entityName}?`,
      query: `"${entityName}" marketing communications`,
      hop_budget: 2,
      source_priority: ['google_serp', 'official_site', 'news'],
      yp_service_fit: ['FAN_ENGAGEMENT'],
    },
    {
      question_id: 'poi_operations_lead',
      question_type: 'poi',
      question_text: `Who leads operations, strategy, or business operations at ${entityName}?`,
      query: `"${entityName}" operations`,
      hop_budget: 2,
      source_priority: ['google_serp', 'official_site', 'news'],
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

export function buildMajorLeagueCricketCoreQuestions() {
  return buildMajorLeagueCricketPresetQuestions().slice(0, 2);
}

export function buildMajorLeagueCricketSmokeQuestions() {
  return buildMajorLeagueCricketCoreQuestions();
}

export function buildMajorLeagueCricketPoiQuestions() {
  return buildMajorLeagueCricketPresetQuestions().slice(2);
}

export function buildMajorLeagueCricketPoiBatchAQuestions() {
  return buildMajorLeagueCricketPoiQuestions().slice(0, 2);
}

export function buildMajorLeagueCricketPoiBatchBQuestions() {
  return buildMajorLeagueCricketPoiQuestions().slice(2, 4);
}

export function buildMajorLeagueCricketPoiBatchCQuestions() {
  return buildMajorLeagueCricketPoiQuestions().slice(4);
}

function _buildQuestionFrontier(question, timestamp) {
  return [
    {
      query: question.query,
      url: '',
      source_kind: 'canonical',
      score: 1,
      reason_kept: 'Seed query for the question',
      first_seen_at: timestamp,
      last_seen_at: timestamp,
      status: 'unseen',
    },
  ];
}

function _coerceOverrideNumber(overrides = {}, primaryKey, fallbackKey) {
  const primary = Number(overrides?.[primaryKey]);
  if (Number.isFinite(primary)) {
    return primary;
  }
  const fallback = Number(overrides?.[fallbackKey]);
  if (Number.isFinite(fallback)) {
    return fallback;
  }
  return undefined;
}

function _buildQuestionCredits(question, overrides = {}) {
  const search = Number.isFinite(_coerceOverrideNumber(overrides, 'searchCredits', 'search'))
    ? _coerceOverrideNumber(overrides, 'searchCredits', 'search')
    : Math.max(1, Number(question.hop_budget || 0));
  const scrape = Number.isFinite(_coerceOverrideNumber(overrides, 'scrapeCredits', 'scrape'))
    ? _coerceOverrideNumber(overrides, 'scrapeCredits', 'scrape')
    : Math.max(1, Number(question.hop_budget || 0));
  const revisit = Number.isFinite(_coerceOverrideNumber(overrides, 'revisitCredits', 'revisit'))
    ? _coerceOverrideNumber(overrides, 'revisitCredits', 'revisit')
    : Math.max(1, Math.ceil(Number(question.hop_budget || 0) / 2));
  return {
    search,
    scrape,
    revisit,
  };
}

function _buildQuestionAliases(question) {
  const aliases = new Set([question.entity_name, question.entity_id, _questionText(question)]);
  if (Array.isArray(question.aliases)) {
    for (const alias of question.aliases) {
      aliases.add(alias);
    }
  }
  return [...aliases].filter(Boolean);
}

function _buildExecutionQuestion(question, query, hopIndex = 0) {
  return {
    ...question,
    query,
    question_id: hopIndex > 0 ? `${question.question_id}__hop_${hopIndex}` : question.question_id,
  };
}

function _getPendingFrontierItems(questionState) {
  return (Array.isArray(questionState.frontier) ? questionState.frontier : [])
    .filter((item) => item.status === 'unseen' && item.query && item.query !== questionState.seed_query)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
}

function _safeUrlHostname(value) {
  try {
    return new URL(String(value)).hostname || '';
  } catch {
    return '';
  }
}

function _sourceKindFromUrl(value) {
  const hostname = _safeUrlHostname(value);
  if (!hostname) return 'unknown';
  if (hostname.includes('linkedin.com')) return 'linkedin_posts';
  if (hostname.includes('wikipedia.org')) return 'wikipedia';
  if (hostname.includes('majorleaguecricket.com')) return 'official_site';
  if (hostname.includes('sportcal.com') || hostname.includes('cricketworld.com') || hostname.includes('nasdaq.com')) return 'news';
  if (hostname.includes('press') || hostname.includes('news')) return 'press_release';
  return 'web';
}

function _scoreSourceRecord(questionState, url, title = '', confidence = 0) {
  const sourceKind = _sourceKindFromUrl(url);
  const questionType = questionState.question_type;
  const sourcePriority = new Map((questionState.source_priority || []).map((value, index) => [value, Math.max(0.1, 1 - index * 0.12)]));
  const sourcePriorityBonus = sourcePriority.get(sourceKind) || 0.2;
  const domain = _safeUrlHostname(url);
  const questionMatch = String(title || '').toLowerCase().includes(String(questionState.entity_name || '').toLowerCase()) ? 0.2 : 0;
  const confidenceScore = _coerceConfidenceScore(confidence);
  const questionBias =
    questionType === 'procurement'
      ? (sourceKind === 'linkedin_posts' ? 0.25 : 0.1)
      : questionType === 'foundation'
        ? (sourceKind === 'wikipedia' || sourceKind === 'official_site' ? 0.25 : 0.08)
        : (sourceKind === 'official_site' || sourceKind === 'news' ? 0.2 : 0.08);
  const freshnessBonus = sourceKind === 'news' || sourceKind === 'press_release' ? 0.15 : 0.1;
  const score = Math.max(0, Math.min(1, sourcePriorityBonus * 0.35 + questionBias + freshnessBonus + questionMatch + confidenceScore * 0.3));
  return {
    url,
    title,
    domain,
    source_kind: sourceKind,
    entity_match: questionMatch + confidenceScore * 0.5,
    freshness: freshnessBonus,
    signal_strength: confidenceScore,
    noise_penalty: Math.max(0, 1 - score),
    last_scraped_at: null,
    last_validated_at: null,
    decision: score >= 0.7 ? 'accept' : score >= 0.45 ? 'defer' : 'reject',
    tags: [questionState.question_type],
    score,
  };
}

function _buildFrontierFromStructuredOutput(questionState, structuredOutput, timestamp) {
  const frontier = [];
  const sources = Array.isArray(structuredOutput.sources) ? structuredOutput.sources : [];
  for (const sourceUrl of sources) {
    frontier.push({
      query: questionState.seed_query,
      url: sourceUrl,
      source_kind: _sourceKindFromUrl(sourceUrl),
      score: _scoreSourceRecord(questionState, sourceUrl, structuredOutput.answer || '', structuredOutput.confidence || 0).score,
      reason_kept: 'Validated source from structured output',
      first_seen_at: timestamp,
      last_seen_at: timestamp,
      status: 'accepted',
    });
  }
  if (structuredOutput.recommended_next_query) {
    frontier.push({
      query: structuredOutput.recommended_next_query,
      url: '',
      source_kind: 'recovery_query',
      score: Math.max(0.25, Number(structuredOutput.confidence || 0) * 0.75),
      reason_kept: 'Suggested follow-up query from structured output',
      first_seen_at: timestamp,
      last_seen_at: timestamp,
      status: 'unseen',
    });
  }
  return frontier;
}

function _questionHasEvidence(questionPayload) {
  const structuredOutput = questionPayload?.reasoning?.structured_output || {};
  const evidenceUrl = String(questionPayload?.evidence_url || structuredOutput.evidence_url || '').trim();
  const sources = Array.isArray(structuredOutput.sources)
    ? structuredOutput.sources.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const source = String(structuredOutput.source || '').trim();
  const answer = String(questionPayload?.answer || structuredOutput.answer || '').trim();
  const fact = structuredOutput.fact;
  const hasFact = fact && typeof fact === 'object' && Object.keys(fact).length > 0;
  return Boolean(answer || evidenceUrl || sources.length > 0 || source || hasFact);
}

function _extendQuestionBudget(questionState, extensionBudget = 0) {
  const extension = Math.max(0, Number(extensionBudget || 0));
  if (extension <= 0) {
    return questionState;
  }
  const currentSearch = Number(questionState.credit_budget?.search || 0);
  const currentScrape = Number(questionState.credit_budget?.scrape || 0);
  const currentRevisit = Number(questionState.credit_budget?.revisit || 0);
  return {
    ...questionState,
    status: questionState.status === 'exhausted' ? 'running' : questionState.status,
    credit_budget: {
      ...(questionState.credit_budget || {}),
      search: currentSearch + extension,
      scrape: currentScrape + extension,
      revisit: currentRevisit + Math.max(1, Math.ceil(extension / 2)),
    },
  };
}

function _normalizeConfidenceThreshold(question, overrides = {}) {
  const threshold = Number(overrides.confidenceThreshold);
  if (Number.isFinite(threshold) && threshold >= 0 && threshold <= 1) {
    return threshold;
  }
  return question.question_type === 'procurement' ? 0.85 : 0.8;
}

function _coerceConfidenceScore(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return 0;
  }
  if (['high', 'strong', 'validated', 'pass', 'yes'].includes(normalized)) {
    return 0.95;
  }
  if (['medium', 'moderate', 'likely', 'probable', 'partial'].includes(normalized)) {
    return 0.7;
  }
  if (['low', 'weak', 'uncertain', 'maybe'].includes(normalized)) {
    return 0.35;
  }
  return 0;
}

function _applyQuestionBudgetOverrides(questionState, overrides = {}) {
  const nextState = {
    ...questionState,
  };
  const searchCredits = _coerceOverrideNumber(overrides, 'searchCredits', 'search');
  const scrapeCredits = _coerceOverrideNumber(overrides, 'scrapeCredits', 'scrape');
  const revisitCredits = _coerceOverrideNumber(overrides, 'revisitCredits', 'revisit');
  const confidenceThreshold = _coerceOverrideNumber(overrides, 'confidenceThreshold', 'confidence_threshold');
  if (Number.isFinite(searchCredits)) {
    nextState.credit_budget = {
      ...(nextState.credit_budget || {}),
      search: searchCredits,
    };
  }
  if (Number.isFinite(scrapeCredits)) {
    nextState.credit_budget = {
      ...(nextState.credit_budget || {}),
      scrape: scrapeCredits,
    };
  }
  if (Number.isFinite(revisitCredits)) {
    nextState.credit_budget = {
      ...(nextState.credit_budget || {}),
      revisit: revisitCredits,
    };
  }
  if (Number.isFinite(confidenceThreshold)) {
    nextState.confidence_threshold = confidenceThreshold;
  }
  return nextState;
}

export function buildQuestionState(question, { runId = 'cli', timestamp = new Date().toISOString(), creditBudgetOverrides = {}, confidenceThreshold } = {}) {
  return {
    question_id: question.question_id,
    entity_name: question.entity_name,
    entity_id: question.entity_id,
    entity_type: question.entity_type,
    question_type: question.question_type,
    question_text: _questionText(question),
    seed_query: question.query,
    aliases: _buildQuestionAliases(question),
    source_priority: question.source_priority,
    hop_budget: question.hop_budget,
    evidence_extension_budget: Number.isFinite(Number(question.evidence_extension_budget))
      ? Number(question.evidence_extension_budget)
      : Number(question.hop_budget || 0),
    question_timeout_ms: Number.isFinite(Number(question.question_timeout_ms))
      ? Number(question.question_timeout_ms)
      : undefined,
    credit_budget: _buildQuestionCredits(question, creditBudgetOverrides),
    credits_spent: {
      search: 0,
      scrape: 0,
      revisit: 0,
    },
    confidence_threshold: Number.isFinite(Number(confidenceThreshold))
      ? Number(confidenceThreshold)
      : _normalizeConfidenceThreshold(question, creditBudgetOverrides),
    status: 'running',
    current_confidence: 0,
    best_answer: '',
    best_evidence_url: '',
    frontier: _buildQuestionFrontier(question, timestamp),
    accepted_links: [],
    rejected_links: [],
    seen_queries: [question.query],
    run_history: [],
    last_executed_query: question.query,
    last_run_at: timestamp,
    run_id: runId,
  };
}

export function buildPresetRunState(questions, { preset = 'major-league-cricket', runId = 'cli', timestamp = new Date().toISOString(), creditBudgetOverrides = {}, confidenceThreshold } = {}) {
  return {
    run_id: runId,
    run_started_at: timestamp,
    last_run_at: timestamp,
    preset,
    questions: questions.map((question) => buildQuestionState(question, { runId, timestamp, creditBudgetOverrides, confidenceThreshold })),
  };
}

function _mergeQuestionState(questionState, questionPayload, timestamp) {
  const structuredOutput = questionPayload?.reasoning?.structured_output || {};
  const frontierUpdates = _buildFrontierFromStructuredOutput(questionState, structuredOutput, timestamp);
  const acceptedLinkCandidates = Array.isArray(structuredOutput.sources)
    ? structuredOutput.sources.map((sourceUrl) => _scoreSourceRecord(questionState, sourceUrl, structuredOutput.answer || '', structuredOutput.confidence || 0))
    : [];
  const nextState = {
    ...questionState,
    last_run_at: timestamp,
    status: questionPayload.validation_state === 'validated' ? 'validated' : questionPayload.validation_state === 'provisional' ? 'provisional' : questionPayload.validation_state === 'no_signal' ? 'no_signal' : 'running',
    current_confidence: questionPayload.confidence ?? questionState.current_confidence ?? 0,
    best_answer: questionPayload.answer || questionState.best_answer || '',
    best_evidence_url: questionPayload.evidence_url || questionState.best_evidence_url || '',
    frontier: [...(Array.isArray(questionState.frontier) ? questionState.frontier : []), ...frontierUpdates]
      .map((item, index, allItems) => ({
        ...item,
        status:
          index === 0 && questionPayload.validation_state === 'validated'
            ? 'accepted'
            : item.status,
        last_seen_at: timestamp,
      }))
      .filter((item, index, allItems) => allItems.findIndex((other) => other.query === item.query && other.url === item.url) === index)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0)),
    accepted_links: [...(questionState.accepted_links || [])],
    rejected_links: [...(questionState.rejected_links || [])],
    seen_queries: Array.from(new Set([...(questionState.seen_queries || []), questionState.seed_query])),
    run_history: [...(questionState.run_history || [])],
    last_executed_query: questionPayload?.execution_query || questionPayload?.query || questionState.last_executed_query || questionState.seed_query,
  };

  if (questionPayload.evidence_url || questionPayload.answer) {
    nextState.accepted_links = [
      ...(questionState.accepted_links || []),
      ...acceptedLinkCandidates.map((candidate) => ({
        ...candidate,
        url: candidate.url || questionPayload.evidence_url || '',
        title: questionPayload.answer || questionState.best_answer || '',
        last_scraped_at: timestamp,
        last_validated_at: timestamp,
        decision: questionPayload.validation_state === 'validated' ? 'accept' : candidate.decision,
      })),
    ];
  }

  nextState.run_history = [
    ...(questionState.run_history || []),
    {
      executed_query: questionPayload?.execution_query || questionPayload?.query || questionState.seed_query,
      answer: questionPayload.answer || '',
      confidence: questionPayload.confidence ?? 0,
      validation_state: questionPayload.validation_state || 'no_signal',
      evidence_url: questionPayload.evidence_url || '',
      timestamp,
    },
  ];

  return nextState;
}

async function _loadJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function _writeJsonFile(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function _coerceNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function _applyRunBudgetOverrides(runState, overrides = {}) {
  const nextState = {
    ...runState,
    questions: Array.isArray(runState.questions) ? runState.questions.map((questionState) => _applyQuestionBudgetOverrides(questionState, overrides)) : [],
  };
  return nextState;
}

function _buildCreditOverrides({ searchCredits, scrapeCredits, revisitCredits, confidenceThreshold } = {}) {
  return {
    searchCredits: _coerceNumber(searchCredits),
    scrapeCredits: _coerceNumber(scrapeCredits),
    revisitCredits: _coerceNumber(revisitCredits),
    confidenceThreshold: _coerceNumber(confidenceThreshold),
  };
}

function _spendCredit(questionState, creditType, amount = 1) {
  const currentSpent = Number(questionState.credits_spent?.[creditType] || 0);
  const currentBudget = Number(questionState.credit_budget?.[creditType] || 0);
  const nextSpent = currentSpent + amount;
  return {
    ...questionState,
    credits_spent: {
      ...(questionState.credits_spent || {}),
      [creditType]: nextSpent,
    },
    status: nextSpent >= currentBudget && creditType === 'search' && questionState.status === 'running' ? 'exhausted' : questionState.status,
  };
}

function _buildStateFilePath(outputDir, preset, entitySlug = 'major-league-cricket') {
  return path.join(outputDir, `${_slugify(entitySlug)}_${_slugify(preset)}_state.json`);
}

function _resolveOpencodeWorktreeRoot(worktreeRoot = null) {
  const candidate = String(worktreeRoot || process.env.OPENCODE_WORKTREE_ROOT || OPCODE_WORKTREE_ROOT || '').trim();
  return candidate || WORKTREE_ROOT;
}

function _resolveBrightDataFastMcpServiceUrl() {
  return process.env.BRIGHTDATA_FASTMCP_URL || 'http://127.0.0.1:8000/mcp';
}

function _resolveBrightDataFastMcpHealthUrl(serviceUrl = _resolveBrightDataFastMcpServiceUrl()) {
  try {
    const url = new URL(String(serviceUrl));
    url.pathname = '/health';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return 'http://127.0.0.1:8000/health';
  }
}

async function _probeBrightDataFastMcpHealth({
  fetchImpl = globalThis.fetch,
  healthUrl = _resolveBrightDataFastMcpHealthUrl(),
} = {}) {
  try {
    const response = await fetchImpl(healthUrl, { method: 'GET' });
    return Boolean(response && response.ok);
  } catch {
    return false;
  }
}

export async function ensureBrightDataFastMcpService({
  fetchImpl = globalThis.fetch,
  spawnImpl = spawn,
  serviceUrl = _resolveBrightDataFastMcpServiceUrl(),
  healthUrl = _resolveBrightDataFastMcpHealthUrl(serviceUrl),
  serviceCommand = ['python3', 'apps/signal-noise-app/scripts/start_brightdata_fastmcp_service.py'],
  serviceCwd = WORKTREE_ROOT,
  serviceEnv = process.env,
  startupTimeoutMs = 10000,
  pollIntervalMs = 250,
} = {}) {
  if (await _probeBrightDataFastMcpHealth({ fetchImpl, healthUrl })) {
    return { started: false, healthy: true, serviceUrl, healthUrl };
  }

  const child = spawnImpl(serviceCommand[0], serviceCommand.slice(1), {
    cwd: serviceCwd,
    env: {
      ...serviceEnv,
      BRIGHTDATA_FASTMCP_URL: serviceUrl,
      BRIGHTDATA_FASTMCP_HOST: serviceEnv.BRIGHTDATA_FASTMCP_HOST || '127.0.0.1',
      BRIGHTDATA_FASTMCP_PORT: serviceEnv.BRIGHTDATA_FASTMCP_PORT || '8000',
      BRIGHTDATA_MCP_USE_HOSTED: 'false',
      BRIGHTDATA_MCP_HOSTED_URL: '',
    },
    detached: true,
    stdio: 'ignore',
  });
  child.unref?.();

  const deadline = Date.now() + Math.max(0, Number(startupTimeoutMs || 0));
  while (Date.now() < deadline) {
    if (await _probeBrightDataFastMcpHealth({ fetchImpl, healthUrl })) {
      return { started: true, healthy: true, serviceUrl, healthUrl };
    }
    await delay(Math.max(1, Number(pollIntervalMs || 0)));
  }

  return { started: true, healthy: false, serviceUrl, healthUrl };
}

export function buildOpenCodeConfig({
  worktreeRoot = WORKTREE_ROOT,
  baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic',
} = {}) {
  const fastmcpUrl = process.env.BRIGHTDATA_FASTMCP_URL || 'http://127.0.0.1:8000/mcp';
  const brightDataStdioServerPath = path.join(APP_ROOT, 'src', 'mcp-brightdata-server.js');
  return {
    $schema: 'https://opencode.ai/config.json',
    model: DEFAULT_MODEL,
    provider: {
      [DEFAULT_PROVIDER_ID]: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Z.AI Coding Plan',
        options: {
          baseURL: baseUrl,
          apiKey: process.env.ZAI_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '',
        },
        models: {
          [DEFAULT_MODEL_ID]: {
            id: 'GLM-5',
            name: 'GLM-5',
            limit: {
              context: 128000,
              output: 16384,
            },
          },
        },
      },
    },
    permission: {
      '*': 'allow',
      bash: 'deny',
      edit: 'deny',
    },
    tools: {
      'brightData_*': false,
    },
    agent: {
      build: {
        tools: {
          'brightData_*': true,
        },
      },
      discovery: {
        name: 'discovery',
        description: 'Bounded procurement discovery agent for Yellow Panther',
        mode: 'primary',
        model: DEFAULT_MODEL,
        steps: 4,
        prompt:
          'You are a procurement discovery agent. Use the brightdata tool to search broadly, inspect evidence carefully, and return only validated JSON.',
        tools: {
          'brightData_*': true,
        },
        permission: {
          '*': 'allow',
          bash: 'deny',
          edit: 'deny',
        },
      },
    },
    mcp: {
      brightData: {
        type: 'local',
        enabled: true,
        command: ['node', brightDataStdioServerPath],
        environment: {
          BRIGHTDATA_FASTMCP_URL: fastmcpUrl,
          BRIGHTDATA_MCP_USE_HOSTED: 'false',
          BRIGHTDATA_MCP_HOSTED_URL: '',
        },
      },
    },
    instructions: [
      'Use the BrightData FastMCP service at the configured MCP URL for search and scrape operations.',
      'Return validated JSON only.',
      'Keep the agentic loop bounded.',
    ],
    metadata: {
      worktreeRoot,
    },
  };
}

export function buildOpenCodeQuestionPrompt(question) {
  const hopBudget = Math.max(1, Math.min(10, Number(question?.hop_budget || 10)));
  return `${_questionText(question)} use brightdata. Start with search and use scraped pages only if the search results are not enough to validate the answer. You have at most ${hopBudget} hops. If you cannot validate a supported answer within that budget, return exactly one fenced JSON code block with answer "", confidence 0, sources [], and validation_state "no_signal", then stop. Otherwise return exactly one fenced JSON code block with the validated answer, confidence, and sources if available. Do not include any prose outside the fenced JSON block. Stop immediately after the first validated answer.`;
}

export function buildOpenCodeQuestionCommand(question, { model = DEFAULT_QUESTION_MODEL } = {}) {
  return [
    'run',
    '--format',
    'json',
    '--model',
    model,
    '--title',
    `Yellow Panther :: ${question.question_id}`,
    buildOpenCodeQuestionPrompt(question),
  ];
}

export function buildOpenCodeQuestionSchema() {
  return {
    type: 'object',
    properties: {
      question: { type: 'string' },
      answer: { type: 'string' },
      context: { type: 'string' },
      sources: {
        type: 'array',
        items: { type: 'string' },
      },
      confidence: { type: 'number' },
    },
    required: ['answer', 'confidence'],
    additionalProperties: true,
  };
}

function _classifyValidationState(structuredOutput) {
  if (!structuredOutput || typeof structuredOutput !== 'object') {
    return 'tool_call_missing';
  }
  if (Object.keys(structuredOutput).length === 0) {
    return 'tool_call_missing';
  }
  if (structuredOutput.validation_state) {
    return structuredOutput.validation_state;
  }
  const confidence = _coerceConfidenceScore(structuredOutput.confidence);
  const answer = String(structuredOutput.answer || '').trim();
  if (!answer || confidence <= 0) {
    return 'no_signal';
  }
  if (confidence >= 0.8) {
    return 'validated';
  }
  return 'provisional';
}

function _stripJsonFence(text) {
  return String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function _extractJsonCandidate(text) {
  const rawText = String(text || '').trim();
  if (!rawText) {
    return null;
  }
  const fencedMatches = [...rawText.matchAll(/```json\s*([\s\S]*?)```/gi)];
  for (let index = fencedMatches.length - 1; index >= 0; index -= 1) {
    const candidate = _stripJsonFence(fencedMatches[index][1]);
    try {
      return JSON.parse(candidate);
    } catch {
      // Keep looking.
    }
  }
  const stripped = _stripJsonFence(rawText);
  try {
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

function _extractFinalCliJson(stdout) {
  const lines = String(stdout || '').split(/\r?\n/).filter(Boolean);
  const textEvents = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed?.type === 'text' && parsed?.part?.text) {
        textEvents.push(String(parsed.part.text));
      }
    } catch {
      // Ignore non-JSON lines and log chatter.
    }
  }
  for (let index = textEvents.length - 1; index >= 0; index -= 1) {
    const parsed = _extractJsonCandidate(textEvents[index]);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  }
  return {};
}

export function extractFinalCliJson(stdout) {
  return _extractFinalCliJson(stdout);
}

function _spawnOpencodeRun(args, { cwd, env, timeoutMs = 300000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('opencode', args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const teeLogs = String(env?.OPENCODE_TEE_LOGS || process.env.OPENCODE_TEE_LOGS || '').trim().toLowerCase() === 'true';
    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const maybeResolveEarly = () => {
      if (settled) return;
      const parsed = _extractFinalCliJson(stdout);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        const answer = String(parsed.answer || '').trim();
        const confidence = _coerceConfidenceScore(parsed.confidence);
        if (answer && confidence > 0) {
          child.kill('SIGTERM');
          settle({ code: 0, stdout, stderr });
        }
      }
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      rejectOnce(new Error(`opencode run timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (teeLogs) {
        process.stdout.write(chunk);
      }
      maybeResolveEarly();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (teeLogs) {
        process.stderr.write(chunk);
      }
    });
    child.on('error', (error) => {
      rejectOnce(error);
    });
    child.on('close', (code) => {
      if (settled) {
        return;
      }
      settle({ code, stdout, stderr });
    });
  });
}

async function runOpenCodeCliQuestion(question, { worktreeRoot, opencodeTimeoutMs } = {}) {
  await ensureBrightDataFastMcpService({ serviceCwd: worktreeRoot || WORKTREE_ROOT });
  const cliResult = await _spawnOpencodeRun(
    buildOpenCodeQuestionCommand(question),
    {
      cwd: worktreeRoot,
      env: {
        ...process.env,
        ZAI_API_KEY: process.env.ZAI_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '',
        ANTHROPIC_AUTH_TOKEN: process.env.ZAI_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '',
        BRIGHTDATA_API_TOKEN: process.env.BRIGHTDATA_API_TOKEN || process.env.BRIGHTDATA_TOKEN || '',
        BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE || '',
        BRIGHTDATA_MCP_USE_HOSTED: 'false',
        BRIGHTDATA_MCP_HOSTED_URL: '',
        PATH: process.env.PATH,
      },
      timeoutMs: opencodeTimeoutMs,
    },
  );
  const structuredOutput = _extractFinalCliJson(cliResult.stdout);
  const promptTrace = {
    exit_code: cliResult.code,
    stdout_length: cliResult.stdout.length,
    stderr_length: cliResult.stderr.length,
    has_structured_output: Object.keys(structuredOutput).length > 0,
  };
  const messageTrace = [
    {
      role: 'assistant',
      completed: cliResult.code === 0,
      type: 'cli-run',
      has_structured_output: Object.keys(structuredOutput).length > 0,
      part_count: 1,
    },
  ];
  return { structuredOutput, promptTrace, messageTrace, cliResult };
}

function _buildQuestionPayload(question, structuredOutput, sessionId, { promptTrace = null, messageTrace = [], executionQuery = '' } = {}) {
  const validationState = _classifyValidationState(structuredOutput);
  const sources = Array.isArray(structuredOutput.sources) ? structuredOutput.sources : [];
  const evidenceUrl = structuredOutput.evidence_url || sources[0] || '';
  const notes = structuredOutput.notes || structuredOutput.context || '';
  const inferredSignalType = structuredOutput.signal_type || (question.question_type ? question.question_type.toUpperCase() : 'NO_SIGNAL');
  return {
    question_id: question.question_id,
    question_type: question.question_type,
    question_text: _questionText(question),
    question: _questionText(question),
    query: question.query,
    hop_budget: question.hop_budget,
    source_priority: question.source_priority,
    evidence_extension_budget: Number.isFinite(Number(question.evidence_extension_budget))
      ? Number(question.evidence_extension_budget)
      : Number(question.hop_budget || 0),
    question_timeout_ms: Number.isFinite(Number(question.question_timeout_ms))
      ? Number(question.question_timeout_ms)
      : undefined,
    entity_name: question.entity_name,
    entity_id: question.entity_id,
    entity_type: question.entity_type,
    preset: question.preset,
    model_used: DEFAULT_MODEL,
    session_id: sessionId,
    agentic_plan: {
      source_priority: question.source_priority,
      stop_rule: `continue for up to ${question.hop_budget} hops within OpenCode steps budget`,
    },
    reasoning: {
      structured_output: structuredOutput,
      prompt_trace: promptTrace,
      message_trace: messageTrace,
    },
    prompt_trace: promptTrace,
    message_trace: messageTrace,
    execution_query: executionQuery || question.query,
    answer: structuredOutput.answer || '',
    signal_type: inferredSignalType,
    confidence: structuredOutput.confidence ?? 0,
    validation_state: validationState,
    evidence_url: evidenceUrl,
    recommended_next_query: structuredOutput.recommended_next_query || '',
    notes,
  };
}

function _categoryForQuestion(question) {
  const questionType = String(question?.question_type || '').trim().toLowerCase();
  if (questionType === 'foundation') {
    return 'identity';
  }
  if (questionType === 'procurement') {
    return 'procurement_opportunity';
  }
  if (questionType === 'poi') {
    return 'connections';
  }
  if (questionType === 'leadership') {
    return 'leadership';
  }
  return 'general';
}

function _buildCategorySummary(answers) {
  const summary = new Map();
  for (const answer of Array.isArray(answers) ? answers : []) {
    const category = String(answer?.category || _categoryForQuestion(answer)).trim() || 'general';
    const bucket = summary.get(category) || {
      category,
      question_count: 0,
      validated_count: 0,
      pending_count: 0,
      no_signal_count: 0,
      retry_count: 0,
    };
    bucket.question_count += 1;
    bucket.retry_count += Number(answer?.retry_count || 0);
    if (answer?.validation_state === 'validated') {
      bucket.validated_count += 1;
    } else if (answer?.validation_state === 'pending' || answer?.validation_state === 'provisional') {
      bucket.pending_count += 1;
    } else {
      bucket.no_signal_count += 1;
    }
    summary.set(category, bucket);
  }
  return Array.from(summary.values());
}

export async function runOpenCodePresetBatch({
  outputDir,
  preset = 'major-league-cricket',
  worktreeRoot = null,
  opencodeTimeoutMs = 300000,
  questionRunner = runOpenCodeCliQuestion,
  resume = false,
  searchCredits,
  scrapeCredits,
  revisitCredits,
  confidenceThreshold,
  questionsOverride = null,
  entityNameOverride = null,
  entityIdOverride = null,
  entityTypeOverride = null,
  questionSourcePath = null,
} = {}) {
  const resolvedWorktreeRoot = _resolveOpencodeWorktreeRoot(worktreeRoot);
  let normalizedPreset = _slugify(preset || entityNameOverride || entityIdOverride || 'question-first');
  let questions;
  if (Array.isArray(questionsOverride) && questionsOverride.length > 0) {
    questions = questionsOverride;
  } else {
    if (normalizedPreset === 'major-league-cricket') {
      questions = buildMajorLeagueCricketPresetQuestions();
    } else if (normalizedPreset === 'major-league-cricket-smoke' || normalizedPreset === 'major-league-cricket-core') {
      questions = buildMajorLeagueCricketSmokeQuestions();
    } else if (normalizedPreset === 'major-league-cricket-poi-a') {
      questions = buildMajorLeagueCricketPoiBatchAQuestions();
    } else if (normalizedPreset === 'major-league-cricket-poi-b') {
      questions = buildMajorLeagueCricketPoiBatchBQuestions();
    } else if (normalizedPreset === 'major-league-cricket-poi-c') {
      questions = buildMajorLeagueCricketPoiBatchCQuestions();
    } else if (normalizedPreset === 'major-league-cricket-poi') {
      questions = buildMajorLeagueCricketPoiQuestions();
    } else {
      throw new Error(`Unsupported preset ${JSON.stringify(preset)}. Expected 'major-league-cricket', 'major-league-cricket-smoke', 'major-league-cricket-core', 'major-league-cricket-poi', 'major-league-cricket-poi-a', 'major-league-cricket-poi-b', or 'major-league-cricket-poi-c'.`);
    }
  }
  if (!outputDir) {
    throw new Error('outputDir is required');
  }
  await fs.mkdir(outputDir, { recursive: true });

  const firstQuestion = questions[0] || {};
  const entityName = entityNameOverride || firstQuestion.entity_name || 'Major League Cricket';
  const entityId = entityIdOverride || firstQuestion.entity_id || _slugify(entityName);
  const entityType = entityTypeOverride || firstQuestion.entity_type || 'SPORT_LEAGUE';

  _loadEnv();
  if (!process.env.ZAI_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error('ZAI_API_KEY (or ANTHROPIC_AUTH_TOKEN) is required for OpenCode Z.AI auth');
  }

  const runStartedAt = new Date().toISOString();
  const statePath = _buildStateFilePath(outputDir, normalizedPreset, entityId);
  const existingState = resume ? await _loadJsonFile(statePath) : null;
  const runState = existingState && typeof existingState === 'object' ? existingState : buildPresetRunState(questions, { preset: normalizedPreset, runId: 'cli', timestamp: runStartedAt });
  const budgetOverrides = _buildCreditOverrides({ searchCredits, scrapeCredits, revisitCredits, confidenceThreshold });
  runState.last_run_at = runStartedAt;
  runState.preset = normalizedPreset;
  runState.run_started_at = runState.run_started_at || runStartedAt;
  runState.questions = Array.isArray(runState.questions) ? runState.questions : buildPresetRunState(questions, { preset: normalizedPreset, runId: 'cli', timestamp: runStartedAt }).questions;
  if (Object.values(budgetOverrides).some((value) => Number.isFinite(value))) {
    runState.questions = runState.questions.map((questionState, index) => {
      const question = questions[index] || {};
      const nextState = _applyQuestionBudgetOverrides(questionState || buildQuestionState(question, { runId: `cli-${index + 1}`, timestamp: runStartedAt }), budgetOverrides);
      return nextState;
    });
  }

  const finalQuestions = [];
  const perQuestionPayloads = [];
  const transcripts = [];

  try {
    for (const [index, question] of questions.entries()) {
      let existingQuestionState = runState.questions[index];
      const currentQuestionState = existingQuestionState || buildQuestionState(question, { runId: `cli-${index + 1}`, timestamp: runStartedAt, creditBudgetOverrides: budgetOverrides, confidenceThreshold: budgetOverrides.confidenceThreshold });
      existingQuestionState = currentQuestionState;
      const pendingFrontierItems = resume && existingQuestionState ? _getPendingFrontierItems(existingQuestionState) : [];
      const shouldReplayFrontier = pendingFrontierItems.length > 0;
      const baseHopBudget = Math.max(1, Number(question.hop_budget || 0) || 10);
      const evidenceExtensionBudget = Math.max(0, Number(question.evidence_extension_budget || question.hop_budget || 0) || 0);
      const configuredQuestionTimeoutMs = Number(question.question_timeout_ms);
      const configuredHopTimeoutMs = Number(question.hop_timeout_ms || question.question_timeout_ms);
      const atomicHopTimeoutMs = Math.max(
        1000,
        Number.isFinite(configuredHopTimeoutMs)
          ? configuredHopTimeoutMs
          : Math.min(Number(opencodeTimeoutMs || 300000), 60000),
      );
      let questionDeadline = Number.isFinite(configuredQuestionTimeoutMs)
        ? Date.now() + Math.max(1000, configuredQuestionTimeoutMs)
        : Date.now() + Math.max(1000, baseHopBudget * atomicHopTimeoutMs);
      let hopLimit = baseHopBudget;
      let evidenceExtended = false;
      let questionPayload;
      let questionRun = null;
      let currentState = existingQuestionState;
      let activeQuery = question.query;
      const queuedQueries = shouldReplayFrontier
        ? pendingFrontierItems.slice(0, baseHopBudget).map((item) => item.query).filter(Boolean)
        : [];
      let hopIndex = 0;
      const isAtomicDiscoveryQuestion = ['atomic', 'discovery'].includes(
        String(question.question_shape || question.pack_role || '').trim().toLowerCase(),
      );

      if (isAtomicDiscoveryQuestion) {
      while (hopIndex < hopLimit && Date.now() < questionDeadline) {
        const executionQuery = queuedQueries.length > 0 ? queuedQueries.shift() : activeQuery || question.query;
        const remainingMs = questionDeadline - Date.now();
        if (remainingMs <= 0) {
          break;
        }
        const hopTimeoutMs = Math.max(1000, Math.min(atomicHopTimeoutMs, remainingMs));
        const executionQuestion = _buildExecutionQuestion(question, executionQuery, hopIndex);
        questionRun = await questionRunner(executionQuestion, { worktreeRoot: resolvedWorktreeRoot, opencodeTimeoutMs: hopTimeoutMs });
        questionPayload = _buildQuestionPayload(
          question,
          questionRun.structuredOutput || {},
          `cli-${index + 1}`,
          {
            promptTrace: questionRun.promptTrace || null,
            messageTrace: questionRun.messageTrace || [],
            executionQuery: executionQuestion.query,
          },
        );
        let updatedState = _mergeQuestionState(currentState || currentQuestionState, questionPayload, new Date().toISOString());
        updatedState = _spendCredit(updatedState, 'search', 1);
        if (Array.isArray(questionPayload?.reasoning?.structured_output?.sources) && questionPayload.reasoning.structured_output.sources.length > 0) {
          updatedState = _spendCredit(updatedState, 'scrape', 1);
        }
        if ((executionQuestion.query || question.query) !== question.query) {
          updatedState = _spendCredit(updatedState, 'revisit', 1);
        }

        const hasEvidence = _questionHasEvidence(questionPayload);
        if (hasEvidence && !evidenceExtended && evidenceExtensionBudget > 0) {
          updatedState = _extendQuestionBudget(updatedState, evidenceExtensionBudget);
          hopLimit += evidenceExtensionBudget;
          questionDeadline += evidenceExtensionBudget * atomicHopTimeoutMs;
          evidenceExtended = true;
        }

        runState.questions[index] = updatedState;
        await _writeJsonFile(statePath, runState);
        currentState = updatedState;
        existingQuestionState = updatedState;

        const recommendedNextQuery = String(questionPayload?.recommended_next_query || '').trim();
        if (recommendedNextQuery) {
          activeQuery = recommendedNextQuery;
        } else if (!queuedQueries.length) {
          activeQuery = executionQuery;
        }

        hopIndex += 1;
      }
      } else {
      const searchSpent = Number(currentQuestionState.credits_spent?.search || 0);
      const searchBudget = Number(currentQuestionState.credit_budget?.search || 0);
      const scrapeSpent = Number(currentQuestionState.credits_spent?.scrape || 0);
      const scrapeBudget = Number(currentQuestionState.credit_budget?.scrape || 0);
      const revisitSpent = Number(currentQuestionState.credits_spent?.revisit || 0);
      const revisitBudget = Number(currentQuestionState.credit_budget?.revisit || 0);
      const executionQueue = shouldReplayFrontier
        ? pendingFrontierItems.slice(0, Math.max(1, Number(question.hop_budget || 0))).map((item, hopIndex) => _buildExecutionQuestion(question, item.query, hopIndex + 1))
        : (resume && existingQuestionState && ['validated', 'provisional', 'no_signal'].includes(existingQuestionState.status) && existingQuestionState.best_answer)
          ? []
          : [question];
      if (executionQueue.length === 0) {
        questionPayload = {
          question_id: question.question_id,
          question_type: question.question_type,
          question_text: _questionText(question),
          question: _questionText(question),
          query: question.query,
          hop_budget: question.hop_budget,
          source_priority: question.source_priority,
          entity_name: question.entity_name,
          entity_id: question.entity_id,
          entity_type: question.entity_type,
          preset: question.preset,
          model_used: DEFAULT_MODEL,
          session_id: existingQuestionState?.run_id || `cli-${index + 1}`,
          agentic_plan: {
            source_priority: question.source_priority,
            stop_rule: `continue for up to ${question.hop_budget} hops within OpenCode steps budget`,
          },
          reasoning: {
            structured_output: {
              question: question.question_text,
              answer: existingQuestionState?.best_answer || '',
              context: existingQuestionState?.notes || '',
              sources: existingQuestionState?.accepted_links?.map((link) => link.url).filter(Boolean) || [],
              confidence: existingQuestionState?.current_confidence || 0,
            },
            prompt_trace: existingQuestionState?.prompt_trace || null,
            message_trace: existingQuestionState?.message_trace || [],
          },
          prompt_trace: existingQuestionState?.prompt_trace || null,
          message_trace: existingQuestionState?.message_trace || [],
          execution_query: existingQuestionState?.last_executed_query || question.query,
          answer: existingQuestionState?.best_answer || '',
          signal_type: question.question_type.toUpperCase(),
          confidence: existingQuestionState?.current_confidence || 0,
          validation_state: existingQuestionState?.status || 'no_signal',
          evidence_url: existingQuestionState?.best_evidence_url || '',
          recommended_next_query: '',
          notes: existingQuestionState?.notes || '',
        };
        questionRun = {
          structuredOutput: questionPayload.reasoning.structured_output,
          promptTrace: questionPayload.prompt_trace,
          messageTrace: questionPayload.message_trace,
          cliResult: { code: 0, stdout: '', stderr: '' },
        };
      } else {
        for (const [hopIndex, executionQuestion] of executionQueue.entries()) {
          if (searchSpent + hopIndex >= searchBudget) {
            existingQuestionState = {
              ...currentQuestionState,
              status: 'exhausted',
            };
            runState.questions[index] = existingQuestionState;
            break;
          }
          questionRun = await questionRunner(executionQuestion, { worktreeRoot: resolvedWorktreeRoot, opencodeTimeoutMs });
          questionPayload = _buildQuestionPayload(
            question,
            questionRun.structuredOutput || {},
            `cli-${index + 1}`,
            {
              promptTrace: questionRun.promptTrace || null,
              messageTrace: questionRun.messageTrace || [],
              executionQuery: executionQuestion.query,
            },
          );
          let updatedState = _mergeQuestionState(existingQuestionState || currentQuestionState, questionPayload, new Date().toISOString());
          updatedState = _spendCredit(updatedState, 'search', 1);
          if (Array.isArray(questionPayload?.reasoning?.structured_output?.sources) && questionPayload.reasoning.structured_output.sources.length > 0) {
            updatedState = _spendCredit(updatedState, 'scrape', 1);
          }
          if ((executionQuestion.query || question.query) !== question.query) {
            updatedState = _spendCredit(updatedState, 'revisit', 1);
          }
          if (Number(updatedState.credits_spent?.scrape || 0) >= scrapeBudget && updatedState.status === 'running') {
            updatedState = {
              ...updatedState,
              status: 'exhausted',
            };
          }
          if (Number(updatedState.credits_spent?.revisit || 0) >= revisitBudget && updatedState.status === 'running' && shouldReplayFrontier) {
            updatedState = {
              ...updatedState,
              status: 'exhausted',
            };
          }
          runState.questions[index] = updatedState;
          await _writeJsonFile(statePath, runState);
          existingQuestionState = runState.questions[index];
          if (existingQuestionState.status === 'exhausted') {
            break;
          }
        }
      }
      if (!questionPayload) {
        questionPayload = {
          question_id: question.question_id,
          question_type: question.question_type,
          question_text: _questionText(question),
          question: _questionText(question),
          query: existingQuestionState?.last_executed_query || question.query,
          hop_budget: question.hop_budget,
          source_priority: question.source_priority,
          entity_name: question.entity_name,
          entity_id: question.entity_id,
          entity_type: question.entity_type,
          preset: question.preset,
          model_used: DEFAULT_MODEL,
          session_id: existingQuestionState?.run_id || `cli-${index + 1}`,
          agentic_plan: {
            source_priority: question.source_priority,
            stop_rule: `continue for up to ${question.hop_budget} hops within OpenCode steps budget`,
          },
          reasoning: {
            structured_output: {
              question: question.question_text,
              answer: existingQuestionState?.best_answer || '',
              context: existingQuestionState?.notes || '',
              sources: existingQuestionState?.accepted_links?.map((link) => link.url).filter(Boolean) || [],
              confidence: existingQuestionState?.current_confidence || 0,
            },
            prompt_trace: existingQuestionState?.prompt_trace || null,
            message_trace: existingQuestionState?.message_trace || [],
          },
          prompt_trace: existingQuestionState?.prompt_trace || null,
          message_trace: existingQuestionState?.message_trace || [],
          execution_query: existingQuestionState?.last_executed_query || question.query,
          answer: existingQuestionState?.best_answer || '',
          signal_type: question.question_type.toUpperCase(),
          confidence: existingQuestionState?.current_confidence || 0,
          validation_state: existingQuestionState?.status || 'exhausted',
          evidence_url: existingQuestionState?.best_evidence_url || '',
          recommended_next_query: '',
          notes: existingQuestionState?.notes || '',
        };
      }
      runState.questions[index] = _mergeQuestionState(existingQuestionState || currentQuestionState, questionPayload, new Date().toISOString());
      await _writeJsonFile(statePath, runState);
      }
      finalQuestions.push(questionPayload);
      perQuestionPayloads.push({
        run_started_at: runStartedAt,
        entity_name: question.entity_name,
        entity_id: question.entity_id,
        entity_type: question.entity_type,
        preset: question.preset,
        question: questionPayload,
      });
      transcripts.push(
        [
          `Question ${index + 1}: ${question.question_id}`,
          `Prompt: ${question.query}`,
          `Exit code: ${questionRun?.cliResult?.code ?? 'n/a'}`,
          `Validation: ${questionPayload.validation_state}`,
          `Answer: ${questionPayload.answer || 'n/a'}`,
        ].join('\n'),
      );
    }

	    const slug = _slugify(entityId);
	    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').replace('T', '_').replace('Z', '');
	    const stem = `${slug}_opencode_batch_${timestamp}`;
	    await fs.mkdir(outputDir, { recursive: true });

	    const metaPath = path.join(outputDir, `${stem}_meta.json`);
	    const rollupPath = path.join(outputDir, `${stem}_rollup.json`);
	    const transcriptPath = path.join(outputDir, `${stem}.txt`);
	    const questionFirstRunPath = path.join(outputDir, `${stem}_question_first_run_v1.json`);
	    const questionPaths = [];

    for (const [index, payload] of perQuestionPayloads.entries()) {
      const questionPath = path.join(outputDir, `${stem}_question_${String(index + 1).padStart(3, '0')}.json`);
      await fs.writeFile(questionPath, JSON.stringify(payload, null, 2), 'utf8');
      questionPaths.push(questionPath);
    }

	    const metaPayload = {
	      run_started_at: runStartedAt,
	      entity_name: entityName,
	      entity_id: entityId,
	      entity_type: entityType,
	      preset: normalizedPreset,
	      questions: finalQuestions,
	    };
    const questionsValidated = finalQuestions.filter((item) => item.validation_state === 'validated').length;
    const questionsNoSignal = finalQuestions.filter((item) => item.validation_state === 'no_signal').length;
    const questionsProvisional = finalQuestions.filter((item) => item.validation_state === 'provisional').length;
	    const rollupPayload = {
	      run_started_at: runStartedAt,
	      entity_name: entityName,
	      entity_id: entityId,
	      entity_type: entityType,
	      preset: normalizedPreset,
	      questions_total: finalQuestions.length,
	      questions_validated: questionsValidated,
      questions_no_signal: questionsNoSignal,
      questions_provisional: questionsProvisional,
	      meta_result_path: metaPath,
	      question_result_paths: questionPaths,
	      question_results_path: metaPath,
	      transcript_path: transcriptPath,
	      question_first_run_path: questionFirstRunPath,
	    };

	    await fs.writeFile(metaPath, JSON.stringify(metaPayload, null, 2), 'utf8');
	    await fs.writeFile(transcriptPath, transcripts.join('\n\n'), 'utf8');
	    await fs.writeFile(rollupPath, JSON.stringify(rollupPayload, null, 2), 'utf8');
	    const questionFirstArtifact = buildQuestionFirstRunArtifact({
	      entity_id: entityId,
	      entity_name: entityName,
	      entity_type: entityType,
	      preset: normalizedPreset,
	      question_source_path: questionSourcePath || `preset:${normalizedPreset}`,
	      questions,
	      answers: finalQuestions,
	      categories: finalQuestions.length ? _buildCategorySummary(finalQuestions) : [],
	      run_rollup: rollupPayload,
	      generated_at: new Date().toISOString(),
	      run_started_at: runStartedAt,
	      status: finalQuestions.some((item) => item.validation_state === 'validated') ? 'ready' : 'empty',
	    });
	    validateQuestionFirstRunArtifact(questionFirstArtifact);
	    await fs.writeFile(questionFirstRunPath, JSON.stringify(questionFirstArtifact, null, 2), 'utf8');
	    await _writeJsonFile(statePath, {
	      ...runState,
	      last_run_at: new Date().toISOString(),
	      preset: normalizedPreset,
	      questions: runState.questions,
    });

    return {
      ...rollupPayload,
	      rollup_path: rollupPath,
	      meta_result_path: metaPath,
	      question_result_paths: questionPaths,
	      question_results_path: metaPath,
	      transcript_path: transcriptPath,
	      question_first_run_path: questionFirstRunPath,
	      state_path: statePath,
	    };
  } finally {
  }
}

export async function runOpenCodeQuestionSourceBatch({
  questionSourcePath,
  outputDir,
  worktreeRoot = null,
  opencodeTimeoutMs = 300000,
  questionRunner = runOpenCodeCliQuestion,
  resume = false,
  searchCredits,
  scrapeCredits,
  revisitCredits,
  confidenceThreshold,
} = {}) {
  if (!questionSourcePath) {
    throw new Error('questionSourcePath is required');
  }
  if (!outputDir) {
    throw new Error('outputDir is required');
  }

  const sourcePayload = await _loadJsonFile(questionSourcePath);
  if (!sourcePayload || typeof sourcePayload !== 'object') {
    throw new Error(`Question source ${JSON.stringify(questionSourcePath)} must resolve to a JSON object`);
  }

  const questions = Array.isArray(sourcePayload.questions) ? sourcePayload.questions.filter((question) => question && typeof question === 'object') : [];
  if (questions.length === 0) {
    throw new Error(`Question source ${JSON.stringify(questionSourcePath)} does not contain any questions`);
  }

  const entityName = String(sourcePayload.entity_name || sourcePayload.entityName || sourcePayload.entity_id || sourcePayload.entityId || 'entity').trim() || 'entity';
  const entityId = String(sourcePayload.entity_id || sourcePayload.entityId || _slugify(entityName)).trim() || _slugify(entityName);
  const entityType = String(sourcePayload.entity_type || sourcePayload.entityType || 'ENTITY').trim() || 'ENTITY';
  const preset = String(sourcePayload.preset || sourcePayload.question_source_label || entityId).trim() || entityId;
  const materializedQuestions = questions.map((question) => {
    const resolvedQuestionText = _questionText(question, entityName);
    return {
      ...question,
      entity_name: question.entity_name || entityName,
      entity_id: question.entity_id || entityId,
      question_text: resolvedQuestionText,
      question: resolvedQuestionText,
    };
  });

  return runOpenCodePresetBatch({
    outputDir,
    preset,
    worktreeRoot: _resolveOpencodeWorktreeRoot(worktreeRoot),
    opencodeTimeoutMs,
    questionRunner,
    resume,
    searchCredits,
    scrapeCredits,
    revisitCredits,
    confidenceThreshold,
    questionsOverride: materializedQuestions,
    entityNameOverride: entityName,
    entityIdOverride: entityId,
    entityTypeOverride: entityType,
    questionSourcePath,
  });
}

export async function main(argv = process.argv.slice(2)) {
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
  const preset = args.get('preset') || 'major-league-cricket-smoke';
  const resume = Boolean(args.get('resume'));
  const opencodeTimeoutMs = _coerceNumber(args.get('opencode-timeout-ms'));
  const searchCredits = args.get('search-credits');
  const scrapeCredits = args.get('scrape-credits');
  const revisitCredits = args.get('revisit-credits');
  const confidenceThreshold = args.get('confidence-threshold');
  const questionSourcePath = args.get('question-source');
  const result = questionSourcePath
    ? await runOpenCodeQuestionSourceBatch({
      questionSourcePath: path.resolve(questionSourcePath),
      outputDir: path.resolve(outputDir),
      resume,
      opencodeTimeoutMs: opencodeTimeoutMs || undefined,
      searchCredits,
      scrapeCredits,
      revisitCredits,
      confidenceThreshold,
    })
    : await runOpenCodePresetBatch({
      outputDir: path.resolve(outputDir),
      preset,
      resume,
      opencodeTimeoutMs: opencodeTimeoutMs || undefined,
      searchCredits,
      scrapeCredits,
      revisitCredits,
      confidenceThreshold,
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
