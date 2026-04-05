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
import {
  lookupApifyTechStack,
} from './apify_techstack_lookup.mjs';

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
      question_text: `Who is the most suitable person for commercial partnerships or business development at ${entityName}?`,
      query: `"${entityName}" LinkedIn company profile`,
      hop_budget: 2,
      source_priority: [
        'linkedin_company_profile',
        'linkedin_people_search',
        'linkedin_person_profile',
        'google_serp',
        'official_site',
      ],
      search_strategy: {
        search_queries: [
          `"${entityName}" LinkedIn company profile`,
          `"${entityName}" LinkedIn commercial`,
          `"${entityName}" LinkedIn partnerships`,
          `"${entityName}" LinkedIn sponsorship`,
          `"${entityName}" LinkedIn revenue`,
          `"${entityName}" LinkedIn business development`,
          `"${entityName}" LinkedIn marketing`,
          `"${entityName}" LinkedIn fan engagement`,
          `"${entityName}" LinkedIn digital`,
          `"${entityName}" LinkedIn innovation`,
          `"${entityName}" LinkedIn strategy`,
          `"${entityName}" LinkedIn transformation`,
          `"${entityName}" LinkedIn growth`,
          `"${entityName}" chief commercial officer`,
          `"${entityName}" partnerships director`,
          `"${entityName}" sponsorship director`,
          `"${entityName}" head of partnerships`,
          `"${entityName}" chief digital officer`,
          `"${entityName}" innovation director`,
          `"${entityName}" transformation director`,
          `"${entityName}" marketing director`,
          `"${entityName}" growth director`,
          `"${entityName}" CEO`,
          `"${entityName}" managing director`,
        ],
      },
      yp_service_fit: ['FAN_ENGAGEMENT'],
    },
    {
      question_id: 'poi_related_pois',
      question_type: 'related_pois',
      question_text: `Which 3 to 5 people are the most relevant commercial, partnerships, or business development contacts at ${entityName}?`,
      query: `"${entityName}" LinkedIn company profile`,
      hop_budget: 2,
      source_priority: [
        'linkedin_company_profile',
        'linkedin_people_search',
        'linkedin_person_profile',
        'google_serp',
        'official_site',
      ],
      search_strategy: {
        search_queries: [
          `"${entityName}" LinkedIn company profile`,
          `"${entityName}" LinkedIn commercial`,
          `"${entityName}" LinkedIn partnerships`,
          `"${entityName}" LinkedIn sponsorship`,
          `"${entityName}" LinkedIn revenue`,
          `"${entityName}" LinkedIn business development`,
          `"${entityName}" LinkedIn marketing`,
          `"${entityName}" LinkedIn digital`,
          `"${entityName}" LinkedIn innovation`,
          `"${entityName}" LinkedIn strategy`,
          `"${entityName}" LinkedIn transformation`,
          `"${entityName}" LinkedIn growth`,
          `"${entityName}" chief commercial officer`,
          `"${entityName}" commercial director`,
          `"${entityName}" partnerships director`,
          `"${entityName}" sponsorship director`,
          `"${entityName}" head of partnerships`,
          `"${entityName}" chief digital officer`,
          `"${entityName}" innovation director`,
          `"${entityName}" transformation director`,
          `"${entityName}" marketing director`,
          `"${entityName}" growth director`,
          `"${entityName}" CEO`,
          `"${entityName}" managing director`,
        ],
      },
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

function _extractUrlString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') return String(value.url || value.href || '').trim();
  return '';
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
        : (questionType === 'decision_owner' || questionType === 'leadership' || questionType === 'poi')
          ? (sourceKind === 'linkedin_posts' || sourceKind === 'linkedin_profiles' ? 0.25 : 0.1)
          : (questionType === 'launch' || questionType === 'opportunity_signal')
            ? (sourceKind === 'news' || sourceKind === 'press_release' || sourceKind === 'official_site' ? 0.22 : 0.12)
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

function _resolveDeterministicInputUrl(question, runState = {}) {
  const deterministicInput = question?.deterministic_input && typeof question.deterministic_input === 'object'
    ? question.deterministic_input
    : {};
  for (const candidate of [
    deterministicInput.url,
    deterministicInput.website,
    question?.entity_website,
    question?.website,
  ]) {
    const value = String(candidate || '').trim();
    if (value) {
      return value;
    }
  }
  const sourceQuestionId = String(deterministicInput.source_question_id || '').trim();
  if (!sourceQuestionId) {
    return '';
  }
  const priorQuestions = Array.isArray(runState?.questions) ? runState.questions : [];
  const sourceQuestion = priorQuestions.find((item) => String(item?.question_id || '').trim() === sourceQuestionId);
  if (!sourceQuestion) {
    return '';
  }
  const acceptedLinks = Array.isArray(sourceQuestion.accepted_links) ? sourceQuestion.accepted_links : [];
  const preferredAccepted = acceptedLinks.find((item) => String(item?.source_kind || '').trim() === 'official_site');
  const officialAcceptedUrl = _normalizeDomainCandidate(_extractUrlString(preferredAccepted?.url));
  if (officialAcceptedUrl) {
    return officialAcceptedUrl;
  }
  const likelyOfficialAccepted = acceptedLinks.find((item) =>
    _isLikelyOfficialDomain(
      _normalizeDomainCandidate(_extractUrlString(item?.url)),
      question?.entity_name || sourceQuestion?.entity_name || '',
    ));
  const likelyOfficialAcceptedUrl = _normalizeDomainCandidate(_extractUrlString(likelyOfficialAccepted?.url));
  if (likelyOfficialAcceptedUrl) {
    return likelyOfficialAcceptedUrl;
  }
  const sourceStructuredOutput = sourceQuestion?.reasoning?.structured_output && typeof sourceQuestion.reasoning.structured_output === 'object'
    ? sourceQuestion.reasoning.structured_output
    : {};
  const officialSource = Array.isArray(sourceStructuredOutput.sources)
    ? sourceStructuredOutput.sources.find((item) => _sourceKindFromUrl(_extractUrlString(item)) === 'official_site')
    : '';
  return _normalizeDomainCandidate(_extractUrlString(officialSource));
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

function _resolveEvidenceExtensionConfidenceThreshold(question, questionState) {
  const questionThreshold = Number(question?.evidence_extension_confidence_threshold);
  if (Number.isFinite(questionThreshold) && questionThreshold >= 0 && questionThreshold <= 1) {
    return questionThreshold;
  }
  const stateThreshold = Number(questionState?.evidence_extension_confidence_threshold);
  if (Number.isFinite(stateThreshold) && stateThreshold >= 0 && stateThreshold <= 1) {
    return stateThreshold;
  }
  return 0.65;
}

function _questionHasStrongEvidence(questionPayload, confidenceThreshold = 0.9) {
  if (!_questionHasEvidence(questionPayload)) {
    return false;
  }
  if (String(questionPayload?.validation_state || '').trim().toLowerCase() !== 'validated') {
    return false;
  }
  const confidence = _coerceConfidenceScore(
    questionPayload?.confidence ?? questionPayload?.reasoning?.structured_output?.confidence ?? 0,
  );
  return confidence >= Math.max(0, Number(confidenceThreshold || 0));
}

function _structuredOwnerCandidates(structuredOutput = {}) {
  const primaryOwner = structuredOutput && typeof structuredOutput.primary_owner === 'object' && structuredOutput.primary_owner
    ? structuredOutput.primary_owner
    : null;
  const supportingCandidates = Array.isArray(structuredOutput?.supporting_candidates)
    ? structuredOutput.supporting_candidates.filter((item) => item && typeof item === 'object')
    : [];
  const candidates = Array.isArray(structuredOutput?.candidates)
    ? structuredOutput.candidates.filter((item) => item && typeof item === 'object')
    : [];
  const topCandidate = candidates[0] || supportingCandidates[0] || primaryOwner || null;
  const answerText = String(
    structuredOutput?.answer ||
      primaryOwner?.name ||
      topCandidate?.name ||
      '',
  ).trim();
  return {
    primaryOwner,
    supportingCandidates,
    candidates,
    topCandidate,
    answerText,
  };
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
    evidence_extension_confidence_threshold: Number.isFinite(Number(question.evidence_extension_confidence_threshold))
      ? Number(question.evidence_extension_confidence_threshold)
      : 0.65,
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

function _decorateRunStateCheckpoint(runState, {
  runPhase = 'running',
  activeQuestionIndex = null,
  activeQuestion = null,
  activeHopIndex = null,
  activeQuery = '',
} = {}) {
  const activeQuestionId = activeQuestion?.question_id || '';
  const activeQuestionType = activeQuestion?.question_type || '';
  const activeQuestionText = activeQuestion ? _questionText(activeQuestion) : '';
  return {
    ...runState,
    run_phase: runPhase,
    active_question_index: activeQuestionIndex,
    active_question_id: activeQuestionId,
    active_question_type: activeQuestionType,
    active_question_text: activeQuestionText,
    active_hop_index: activeHopIndex,
    active_query: activeQuery,
  };
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
  const searchQueries = Array.isArray(question?.search_strategy?.search_queries)
    ? question.search_strategy.search_queries
        .map((query) => String(query || '').trim())
        .filter(Boolean)
    : [];
  const searchHint = searchQueries.length > 0
    ? `Suggested search queries: ${searchQueries.join(' | ')}.`
    : '';
  const questionType = String(question?.question_type || '').trim().toLowerCase();
  if (questionType === 'decision_owner') {
    return `${_questionText(question)} use brightdata. ${searchHint} Start with search and use scraped pages only if the search results are not enough to validate the answer. You have at most ${hopBudget} hops. Return exactly one fenced JSON code block with answer set to the primary owner's name, primary_owner, supporting_candidates, confidence, sources, and validation_state. primary_owner must be the single best commercial buyer. supporting_candidates should include the next strongest people in rank order. If you cannot validate a supported primary owner within that budget, return exactly one fenced JSON code block with answer "", primary_owner null, supporting_candidates [], confidence 0, sources [], and validation_state "no_signal", then stop. Do not include any prose outside the fenced JSON block. Stop immediately after the first validated primary owner.`;
  }
  if (questionType === 'related_pois') {
    return `${_questionText(question)} use brightdata. ${searchHint} Start with search and use scraped pages only if the search results are not enough to validate the answer. You have at most ${hopBudget} hops. Return exactly one fenced JSON code block with answer set to the best candidate name, candidates, confidence, sources, and validation_state. candidates should be a ranked list of 3 to 5 people with the best commercial relevance. If you cannot validate a ranked list of 3 to 5 candidates within that budget, return exactly one fenced JSON code block with answer "", candidates [], confidence 0, sources [], and validation_state "no_signal", then stop. Do not include any prose outside the fenced JSON block. Stop immediately after the first validated ranked list.`;
  }
  if (questionType === 'digital_stack') {
    return `${_questionText(question)} use brightdata. ${searchHint} Start with search and use scraped pages only if the search results are not enough to validate the answer. You have at most ${hopBudget} hops. Return exactly one fenced JSON code block with answer, technologies, categories, vendors, additional_domains, maturity_signal, commercial_interpretation, opportunity, confidence, sources, and validation_state. additional_domains should only include real digital services or subdomains worth separate tech-stack enrichment, such as ticketing, shop, app, or fan platform domains. commercial_interpretation must summarize the stack in business terms, not raw telemetry. opportunity must state the most credible commercial angle from the visible stack. If you cannot validate a supported answer within that budget, return exactly one fenced JSON code block with answer "", technologies [], categories [], vendors [], additional_domains [], maturity_signal "low", commercial_interpretation "", opportunity "", confidence 0, sources [], and validation_state "no_signal", then stop. Do not include any prose outside the fenced JSON block. Stop immediately after the first validated answer.`;
  }
  return `${_questionText(question)} use brightdata. ${searchHint} Start with search and use scraped pages only if the search results are not enough to validate the answer. You have at most ${hopBudget} hops. If you cannot validate a supported answer within that budget, return exactly one fenced JSON code block with answer "", confidence 0, sources [], and validation_state "no_signal", then stop. Otherwise return exactly one fenced JSON code block with the validated answer, confidence, and sources if available. Do not include any prose outside the fenced JSON block. Stop immediately after the first validated answer.`;
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
      primary_owner: {
        type: 'object',
        additionalProperties: true,
      },
      supporting_candidates: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
        },
      },
      candidates: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
        },
      },
      context: { type: 'string' },
      sources: {
        type: 'array',
        items: { type: 'string' },
      },
      technologies: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
        },
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
      },
      vendors: {
        type: 'array',
        items: { type: 'string' },
      },
      additional_domains: {
        type: 'array',
        items: { type: 'string' },
      },
      additional_domain_results: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
        },
      },
      maturity_signal: { type: 'string' },
      commercial_interpretation: { type: 'string' },
      opportunity: { type: 'string' },
      confidence: { type: 'number' },
    },
    required: ['answer', 'confidence'],
    additionalProperties: true,
  };
}

function _normalizeDomainCandidate(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function _mergeTechnologyRecords(base, extra, sourceUrl = '') {
  const merged = new Map();
  for (const record of [...(Array.isArray(base) ? base : []), ...(Array.isArray(extra) ? extra : [])]) {
    if (!record || typeof record !== 'object') {
      continue;
    }
    const name = String(record.name || '').trim();
    if (!name) {
      continue;
    }
    const existing = merged.get(name) || {};
    const categories = Array.from(new Set([
      ...(Array.isArray(existing.categories) ? existing.categories : []),
      ...(Array.isArray(record.categories) ? record.categories : []),
    ].filter(Boolean)));
    merged.set(name, {
      ...existing,
      ...record,
      name,
      categories,
      source_url: record.source_url || existing.source_url || sourceUrl || '',
    });
  }
  return Array.from(merged.values());
}

function _mergeUniqueStrings(...values) {
  return Array.from(new Set(values.flatMap((value) => (Array.isArray(value) ? value : [])).map((item) => String(item || '').trim()).filter(Boolean)));
}

function _isLikelyOfficialDomain(url, entityName = '') {
  const hostname = _safeUrlHostname(url);
  if (!hostname) return false;
  if (hostname.includes('wikipedia.org') || hostname.includes('linkedin.com')) return false;
  const entityTokens = String(entityName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !['football', 'club', 'league', 'federation', 'international', 'major'].includes(token));
  if (entityTokens.length === 0) return true;
  return entityTokens.some((token) => hostname.includes(token));
}

function _deriveDigitalStackMaturity({ technologies = [], categories = [], vendors = [] } = {}) {
  const techNames = Array.isArray(technologies)
    ? technologies.map((item) => String(item?.name || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const categoryNames = Array.isArray(categories)
    ? categories.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const vendorNames = Array.isArray(vendors)
    ? vendors.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const modernSignals = ['next.js', 'angular', 'react', 'pwa', 'google analytics 4', 'google tag manager', 'stripe', 'azure', 'aws', 'cloudflare'];
  const legacySignals = ['jquery', 'magento', 'bootstrap'];
  const modernHits = modernSignals.filter((item) => techNames.includes(item)).length;
  const legacyHits = legacySignals.filter((item) => techNames.includes(item)).length;
  const hasAnalytics = categoryNames.includes('analytics') || techNames.includes('google analytics') || techNames.includes('google analytics 4');
  const hasPayments = techNames.includes('stripe');
  const hasCms = categoryNames.includes('cms');
  const hasFragmentation = ['webflow', 'magento', 'wordpress', 'drupal'].filter((item) => techNames.includes(item)).length >= 2;
  let maturitySignal = 'medium';
  if (modernHits >= 4 && hasAnalytics) {
    maturitySignal = 'high';
  } else if (modernHits <= 1 && legacyHits >= 2) {
    maturitySignal = 'low';
  }
  const interpretationParts = [];
  if (modernHits > 0) interpretationParts.push('Visible modern web delivery and tagging stack');
  if (legacyHits > 0) interpretationParts.push('Mixed legacy frontend signals remain present');
  if (hasCms) interpretationParts.push('CMS-backed publishing is likely part of the estate');
  if (hasPayments) interpretationParts.push('Payment or commerce capability is visible');
  if (hasFragmentation) interpretationParts.push('Stack fragmentation is plausible across multiple web properties');
  const opportunityParts = [];
  if (hasFragmentation) opportunityParts.push('Platform consolidation and governance');
  if (hasAnalytics) opportunityParts.push('Measurement, data activation, and fan journey optimization');
  if (hasPayments || vendorNames.some((item) => /magento|shopify|stripe/i.test(item))) opportunityParts.push('Commerce and fan monetization improvements');
  if (modernHits > 0 && legacyHits > 0) opportunityParts.push('Legacy-to-modern platform transition planning');
  return {
    maturity_signal: maturitySignal,
    commercial_interpretation: interpretationParts.join('. ') || 'Limited visible stack evidence beyond generic web technologies.',
    opportunity: opportunityParts.join('; ') || 'Use direct discovery to confirm the core digital estate before shaping an opportunity.',
  };
}

export async function enrichDigitalStackStructuredOutput(
  question,
  structuredOutput,
  {
    fetchImpl = globalThis.fetch,
    apifyTechStackLookup = lookupApifyTechStack,
    apifyToken = process.env.APIFY_PERSONAL_API || process.env.APIFY_TOKEN || process.env.APIFY_PASSWORD || '',
  } = {},
) {
  const questionType = String(question?.question_type || '').trim().toLowerCase();
  if (questionType !== 'digital_stack' || !structuredOutput || typeof structuredOutput !== 'object') {
    return structuredOutput;
  }
  const baseCommercialView = _deriveDigitalStackMaturity({
    technologies: structuredOutput.technologies,
    categories: structuredOutput.categories,
    vendors: structuredOutput.vendors,
  });
  const resolvedApifyToken = String(apifyToken || '').trim();
  if (!resolvedApifyToken) {
    return {
      ...structuredOutput,
      commercial_interpretation: structuredOutput.commercial_interpretation || baseCommercialView.commercial_interpretation,
      opportunity: structuredOutput.opportunity || baseCommercialView.opportunity,
      maturity_signal: structuredOutput.maturity_signal || baseCommercialView.maturity_signal,
    };
  }
  const baseEvidenceUrl = _normalizeDomainCandidate(
    structuredOutput.evidence_url || structuredOutput.source || (Array.isArray(structuredOutput.sources) ? structuredOutput.sources[0] : ''),
  );
  let technologies = Array.isArray(structuredOutput.technologies) ? structuredOutput.technologies : [];
  let categories = Array.isArray(structuredOutput.categories) ? structuredOutput.categories : [];
  let vendors = Array.isArray(structuredOutput.vendors) ? structuredOutput.vendors : [];
  let primaryDomainResult = null;
  if (baseEvidenceUrl && _isLikelyOfficialDomain(baseEvidenceUrl, question?.entity_name)) {
    try {
      const lookupResult = await apifyTechStackLookup({
        url: baseEvidenceUrl,
        token: resolvedApifyToken,
        fetchImpl,
      });
      primaryDomainResult = Array.isArray(lookupResult?.results) ? lookupResult.results[0] : null;
    } catch {
      primaryDomainResult = null;
    }
  }
  if (primaryDomainResult) {
    const primaryTechnologies = Array.isArray(primaryDomainResult.technologies)
      ? primaryDomainResult.technologies.map((item) => ({ ...item, source_url: baseEvidenceUrl }))
      : [];
    technologies = _mergeTechnologyRecords(technologies, primaryTechnologies, baseEvidenceUrl);
    categories = _mergeUniqueStrings(categories, primaryDomainResult.categories);
    vendors = _mergeUniqueStrings(vendors, primaryDomainResult.vendors);
  }
  const additionalDomains = _mergeUniqueStrings(structuredOutput.additional_domains)
    .map((item) => _normalizeDomainCandidate(item))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .filter((item) => item !== baseEvidenceUrl);
  if (additionalDomains.length === 0) {
    return {
      ...structuredOutput,
      commercial_interpretation: structuredOutput.commercial_interpretation || baseCommercialView.commercial_interpretation,
      opportunity: structuredOutput.opportunity || baseCommercialView.opportunity,
      maturity_signal: structuredOutput.maturity_signal || baseCommercialView.maturity_signal,
    };
  }
  const additionalDomainResults = [];

  for (const url of additionalDomains) {
    try {
      const lookupResult = await apifyTechStackLookup({
        url,
        token: resolvedApifyToken,
        fetchImpl,
      });
      const topResult = Array.isArray(lookupResult?.results) ? lookupResult.results[0] : null;
      if (!topResult) {
        continue;
      }
      const nextTechnologies = Array.isArray(topResult.technologies)
        ? topResult.technologies.map((item) => ({ ...item, source_url: url }))
        : [];
      const nextCategories = Array.isArray(topResult.categories) ? topResult.categories : [];
      const nextVendors = Array.isArray(topResult.vendors) ? topResult.vendors : [];
      technologies = _mergeTechnologyRecords(technologies, nextTechnologies, url);
      categories = _mergeUniqueStrings(categories, nextCategories);
      vendors = _mergeUniqueStrings(vendors, nextVendors);
      additionalDomainResults.push({
        url,
        technologies: nextTechnologies,
        categories: nextCategories,
        vendors: nextVendors,
      });
    } catch {
      // Keep the primary digital stack result even if one secondary enrichment fails.
    }
  }

  const commercialView = _deriveDigitalStackMaturity({ technologies, categories, vendors });
  return {
    ...structuredOutput,
    technologies,
    categories,
    vendors,
    additional_domains: additionalDomains,
    additional_domain_results: additionalDomainResults,
    answer: vendors.slice(0, 5).join(', ') || structuredOutput.answer || '',
    commercial_interpretation: structuredOutput.commercial_interpretation || commercialView.commercial_interpretation,
    opportunity: structuredOutput.opportunity || commercialView.opportunity,
    maturity_signal: structuredOutput.maturity_signal || commercialView.maturity_signal,
  };
}

export async function runDeterministicToolQuestion(
  question,
  {
    runState = {},
    fetchImpl = globalThis.fetch,
    apifyTechStackLookup = lookupApifyTechStack,
  } = {},
) {
  const deterministicTools = Array.isArray(question?.deterministic_tools)
    ? question.deterministic_tools.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const usesApifyTechStack = deterministicTools.includes('apify_techstack') || deterministicTools.includes('wappalyzer');
  if (!usesApifyTechStack) {
    return null;
  }

  const fallbackToRetrieval = question?.fallback_to_retrieval !== false;
  const inputUrl = _resolveDeterministicInputUrl(question, runState);
  const apifyToken = process.env.APIFY_PERSONAL_API || process.env.APIFY_TOKEN || process.env.APIFY_PASSWORD || '';
  if (inputUrl && !_isLikelyOfficialDomain(inputUrl, question?.entity_name)) {
    return null;
  }
  if (!inputUrl || !String(apifyToken || '').trim()) {
    if (fallbackToRetrieval) {
      return null;
    }
    return {
      structuredOutput: {
        answer: '',
        technologies: [],
        categories: [],
        vendors: [],
        confidence: 0,
        validation_state: 'no_signal',
        sources: inputUrl ? [inputUrl] : [],
        evidence_url: inputUrl,
        signal_type: 'DIGITAL_STACK',
        notes: inputUrl ? 'Missing Apify token' : 'Missing deterministic input URL',
      },
      promptTrace: {
        status: 'deterministic_apify_skipped',
        has_structured_output: true,
      },
      messageTrace: [],
      cliResult: {
        code: 0,
        stdout: '',
        stderr: '',
      },
    };
  }

  let lookupResult;
  try {
    lookupResult = await apifyTechStackLookup({
      url: inputUrl,
      token: apifyToken,
      fetchImpl,
    });
  } catch (error) {
    if (fallbackToRetrieval) {
      return null;
    }
    return {
      structuredOutput: {
        answer: '',
        technologies: [],
        categories: [],
        vendors: [],
        confidence: 0,
        validation_state: 'no_signal',
        sources: inputUrl ? [inputUrl] : [],
        evidence_url: inputUrl,
        signal_type: 'DIGITAL_STACK',
        notes: error instanceof Error ? error.message : String(error),
      },
      promptTrace: {
        status: 'deterministic_apify_error',
        has_structured_output: true,
      },
      messageTrace: [],
      cliResult: {
        code: 0,
        stdout: '',
        stderr: '',
      },
    };
  }

  const topResult = Array.isArray(lookupResult?.results) ? lookupResult.results[0] : null;
  const technologies = Array.isArray(topResult?.technologies) ? topResult.technologies : [];
  if (technologies.length === 0 && fallbackToRetrieval) {
    return null;
  }
  const vendors = Array.isArray(topResult?.vendors) ? topResult.vendors : [];
  const categories = Array.isArray(topResult?.categories) ? topResult.categories : [];
  const commercialView = _deriveDigitalStackMaturity({ technologies, categories, vendors });
  return {
    structuredOutput: {
      answer: vendors.slice(0, 5).join(', '),
      technologies,
      categories,
      vendors,
      raw: topResult?.raw || {},
      confidence: technologies.length > 0 ? 0.95 : 0,
      validation_state: technologies.length > 0 ? 'validated' : 'no_signal',
      sources: inputUrl ? [inputUrl] : [],
      source: inputUrl,
      evidence_url: inputUrl,
      signal_type: 'DIGITAL_STACK',
      commercial_interpretation: commercialView.commercial_interpretation,
      opportunity: commercialView.opportunity,
      maturity_signal: commercialView.maturity_signal,
    },
    promptTrace: {
      status: 'deterministic_apify',
      has_structured_output: true,
      technologies_detected: technologies.length,
    },
    messageTrace: [],
    cliResult: {
      code: 0,
      stdout: '',
      stderr: '',
    },
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
  const { answerText } = _structuredOwnerCandidates(structuredOutput);
  const answer = String(structuredOutput.answer || answerText || '').trim();
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

async function _runQuestionRunnerWithTimeout(questionRunner, executionQuestion, options = {}, timeoutMs = 300000) {
  const normalizedTimeoutMs = Number.isFinite(Number(timeoutMs))
    ? Math.max(1, Number(timeoutMs))
    : 300000;
  const runnerPromise = Promise.resolve().then(() => questionRunner(executionQuestion, options));
  const timeoutResult = {
    timedOut: true,
    questionRun: {
      structuredOutput: {
        answer: '',
        confidence: 0,
        validation_state: 'no_signal',
        sources: [],
      },
      promptTrace: {
        status: 'timeout',
        exit_code: 124,
        stdout_length: 0,
        stderr_length: 0,
        has_structured_output: false,
        timeout_ms: timeoutMs,
      },
      messageTrace: [],
      cliResult: {
        code: 124,
        stdout: '',
      stderr: `question runner timed out after ${timeoutMs}ms`,
      },
    },
  };
  const raceResult = await Promise.race([
    runnerPromise.then((questionRun) => ({
      timedOut: false,
      questionRun,
    })),
    delay(normalizedTimeoutMs).then(() => timeoutResult),
  ]);
  if (raceResult.timedOut) {
    runnerPromise.catch(() => {});
  }
  return raceResult;
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
  const { primaryOwner, supportingCandidates, candidates, answerText } = _structuredOwnerCandidates(structuredOutput);
  const evidenceUrl = structuredOutput.evidence_url || primaryOwner?.profile_url || primaryOwner?.linkedin_url || sources[0] || '';
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
    evidence_extension_confidence_threshold: Number.isFinite(Number(question.evidence_extension_confidence_threshold))
      ? Number(question.evidence_extension_confidence_threshold)
      : 0.65,
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
    answer: answerText || structuredOutput.answer || '',
    primary_owner: primaryOwner,
    supporting_candidates: supportingCandidates,
    candidates,
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
  if (questionType === 'launch' || questionType === 'opportunity_signal') {
    return 'opportunity_signal';
  }
  if (questionType === 'procurement') {
    return 'procurement_opportunity';
  }
  if (questionType === 'poi') {
    return 'connections';
  }
  if (questionType === 'leadership' || questionType === 'decision_owner' || questionType === 'related_pois') {
    return 'decision_owners';
  }
  if (questionType === 'digital_stack') {
    return 'technology_stack';
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
  deterministicToolRunner = runDeterministicToolQuestion,
  apifyTechStackLookup = lookupApifyTechStack,
  apifyToken = process.env.APIFY_PERSONAL_API || process.env.APIFY_TOKEN || process.env.APIFY_PASSWORD || '',
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
  let runState = existingState && typeof existingState === 'object' ? existingState : buildPresetRunState(questions, { preset: normalizedPreset, runId: 'cli', timestamp: runStartedAt });
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
  runState = _decorateRunStateCheckpoint(runState, {
    runPhase: 'initialized',
    activeQuestionIndex: questions.length > 0 ? 0 : null,
    activeQuestion: questions[0] || null,
    activeHopIndex: 0,
    activeQuery: questions[0]?.query || '',
  });
  await _writeJsonFile(statePath, runState);

  const finalQuestions = [];
  const perQuestionPayloads = [];
  const transcripts = [];

  try {
    for (const [index, question] of questions.entries()) {
      let existingQuestionState = runState.questions[index];
      const currentQuestionState = existingQuestionState || buildQuestionState(question, { runId: `cli-${index + 1}`, timestamp: runStartedAt, creditBudgetOverrides: budgetOverrides, confidenceThreshold: budgetOverrides.confidenceThreshold });
      existingQuestionState = currentQuestionState;
      runState = _decorateRunStateCheckpoint(runState, {
        runPhase: 'question_start',
        activeQuestionIndex: index,
        activeQuestion: question,
        activeHopIndex: 0,
        activeQuery: question.query,
      });
      runState.questions[index] = existingQuestionState;
      await _writeJsonFile(statePath, runState);
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
      const evidenceExtensionConfidenceThreshold = _resolveEvidenceExtensionConfidenceThreshold(question, existingQuestionState || currentQuestionState);
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
      const fallbackToRetrieval = question.fallback_to_retrieval !== false;

      if (typeof deterministicToolRunner === 'function') {
        const deterministicRun = await deterministicToolRunner(question, {
          runState,
          fetchImpl: globalThis.fetch,
        });
        if (deterministicRun) {
          const deterministicStructuredOutput = await enrichDigitalStackStructuredOutput(
            question,
            deterministicRun.structuredOutput || {},
            {
              fetchImpl: globalThis.fetch,
              apifyTechStackLookup,
              apifyToken,
            },
          );
          questionRun = deterministicRun;
          questionPayload = _buildQuestionPayload(
            question,
            deterministicStructuredOutput,
            `cli-${index + 1}`,
            {
              promptTrace: deterministicRun.promptTrace || null,
              messageTrace: deterministicRun.messageTrace || [],
              executionQuery: question.query,
            },
          );
          let updatedState = _mergeQuestionState(currentState || currentQuestionState, questionPayload, new Date().toISOString());
          if (questionPayload.validation_state !== 'validated' && fallbackToRetrieval) {
            updatedState = {
              ...updatedState,
              status: 'running',
            };
          }
          runState.questions[index] = updatedState;
          await _writeJsonFile(statePath, runState);
          currentState = updatedState;
          existingQuestionState = updatedState;
          if (questionPayload.validation_state === 'validated' || !fallbackToRetrieval) {
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
            continue;
          }
        }
      }

      if (isAtomicDiscoveryQuestion) {
      while (hopIndex < hopLimit && Date.now() < questionDeadline) {
        const executionQuery = queuedQueries.length > 0 ? queuedQueries.shift() : activeQuery || question.query;
        const remainingMs = questionDeadline - Date.now();
        if (remainingMs <= 0) {
          break;
        }
        const hopTimeoutMs = Math.max(1000, Math.min(atomicHopTimeoutMs, remainingMs));
        const executionQuestion = _buildExecutionQuestion(question, executionQuery, hopIndex);
        runState = _decorateRunStateCheckpoint(runState, {
          runPhase: 'question_runner_enter',
          activeQuestionIndex: index,
          activeQuestion: executionQuestion,
          activeHopIndex: hopIndex,
          activeQuery: executionQuestion.query,
        });
        runState.questions[index] = existingQuestionState;
        await _writeJsonFile(statePath, runState);
        const runnerResult = await _runQuestionRunnerWithTimeout(
          questionRunner,
          executionQuestion,
          { worktreeRoot: resolvedWorktreeRoot, opencodeTimeoutMs: hopTimeoutMs },
          hopTimeoutMs,
        );
        questionRun = runnerResult.questionRun;
        if (questionRun?.structuredOutput && typeof questionRun.structuredOutput === 'object') {
          questionRun.structuredOutput = await enrichDigitalStackStructuredOutput(
            question,
            questionRun.structuredOutput,
            {
              fetchImpl: globalThis.fetch,
              apifyTechStackLookup,
              apifyToken,
            },
          );
        }
        runState = _decorateRunStateCheckpoint(runState, {
          runPhase: runnerResult.timedOut ? 'question_runner_timeout' : 'question_runner_return',
          activeQuestionIndex: index,
          activeQuestion: executionQuestion,
          activeHopIndex: hopIndex,
          activeQuery: executionQuestion.query,
        });
        runState.questions[index] = existingQuestionState;
        await _writeJsonFile(statePath, runState);
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

        const hasEvidence = _questionHasStrongEvidence(questionPayload, evidenceExtensionConfidenceThreshold);
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
        if (String(questionPayload?.validation_state || '').trim().toLowerCase() === 'validated' || updatedState.status === 'validated') {
          break;
        }

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
          runState = _decorateRunStateCheckpoint(runState, {
            runPhase: 'question_runner_enter',
            activeQuestionIndex: index,
            activeQuestion: executionQuestion,
            activeHopIndex: hopIndex,
            activeQuery: executionQuestion.query,
          });
          runState.questions[index] = existingQuestionState;
          await _writeJsonFile(statePath, runState);
          const runnerResult = await _runQuestionRunnerWithTimeout(
            questionRunner,
            executionQuestion,
            { worktreeRoot: resolvedWorktreeRoot, opencodeTimeoutMs },
            opencodeTimeoutMs,
          );
          questionRun = runnerResult.questionRun;
          runState = _decorateRunStateCheckpoint(runState, {
            runPhase: runnerResult.timedOut ? 'question_runner_timeout' : 'question_runner_return',
            activeQuestionIndex: index,
            activeQuestion: executionQuestion,
            activeHopIndex: hopIndex,
            activeQuery: executionQuestion.query,
          });
          runState.questions[index] = existingQuestionState;
          await _writeJsonFile(statePath, runState);
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
        if (updatedState.status === 'validated') {
          break;
        }
        if (runnerResult.timedOut || existingQuestionState.status === 'exhausted') {
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
    await _writeJsonFile(statePath, _decorateRunStateCheckpoint({
      ...runState,
      last_run_at: new Date().toISOString(),
      preset: normalizedPreset,
      questions: runState.questions,
    }, {
      runPhase: 'completed',
      activeQuestionIndex: null,
      activeQuestion: null,
      activeHopIndex: null,
      activeQuery: '',
    }));

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
  deterministicToolRunner = runDeterministicToolQuestion,
  apifyTechStackLookup = lookupApifyTechStack,
  apifyToken = process.env.APIFY_PERSONAL_API || process.env.APIFY_TOKEN || process.env.APIFY_PASSWORD || '',
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
      entity_type: question.entity_type || entityType,
      preset: question.preset || preset,
      question_shape: question.question_shape || sourcePayload.question_shape || 'atomic',
      pack_role: question.pack_role || sourcePayload.pack_role || 'discovery',
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
    deterministicToolRunner,
    apifyTechStackLookup,
    apifyToken,
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
