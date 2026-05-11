#!/usr/bin/env node

import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  buildQuestionFirstRunArtifact,
  validateQuestionFirstRunArtifact,
} from './question_first_run_contract.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(MODULE_DIR, '..');
const WORKTREE_ROOT = path.resolve(APP_ROOT, '..', '..');
const QUESTION_PROGRESS_FRAMEWORK_PATH = path.join(APP_ROOT, 'backend', 'question_progress_framework.json');
const STANDALONE_BRIGHTDATA_FALLBACK_SCRIPT = path.join(APP_ROOT, 'scripts', 'standalone_brightdata_fallback.py');
const DEFAULT_PROVIDER_ID = 'zai-coding-plan';
const TEMPORARY_QUOTA_POLICY = 'glm_5_1_default';
const FALLBACK_PREFETCH_MODEL_ID = 'glm-5.1';
const FALLBACK_SYNTHESIS_MODEL_ID = 'glm-5.1';
const FALLBACK_ESCALATION_MODEL_ID = 'glm-5.1';
const ZAI_MODEL_CATALOG = {
  'glm-5.1': { id: 'GLM-5.1', name: 'GLM-5.1', context: 128000, output: 16384 },
  'glm-5': { id: 'GLM-5', name: 'GLM-5', context: 128000, output: 16384 },
  'glm-5-turbo': { id: 'GLM-5-Turbo', name: 'GLM-5-Turbo', context: 128000, output: 16384 },
  'glm-4.7': { id: 'GLM-4.7', name: 'GLM-4.7', context: 128000, output: 8192 },
  'glm-4.7-flashx': { id: 'GLM-4.7-FlashX', name: 'GLM-4.7-FlashX', context: 128000, output: 8192 },
  'glm-4.7-flash': { id: 'GLM-4.7-Flash', name: 'GLM-4.7-Flash', context: 128000, output: 8192 },
  'glm-4.6': { id: 'GLM-4.6', name: 'GLM-4.6', context: 128000, output: 8192 },
  'glm-4.5': { id: 'GLM-4.5', name: 'GLM-4.5', context: 128000, output: 8192 },
  'glm-4.5-x': { id: 'GLM-4.5-X', name: 'GLM-4.5-X', context: 128000, output: 8192 },
  'glm-4.5-air': { id: 'GLM-4.5-Air', name: 'GLM-4.5-Air', context: 128000, output: 8192 },
  'glm-4.5-airx': { id: 'GLM-4.5-AirX', name: 'GLM-4.5-AirX', context: 128000, output: 8192 },
  'glm-4-32b-0414-128k': { id: 'GLM-4-32B-0414-128K', name: 'GLM-4-32B-0414-128K', context: 128000, output: 8192 },
  'glm-4.5-flash': { id: 'GLM-4.5-Flash', name: 'GLM-4.5-Flash', context: 128000, output: 8192 },
};
const COMMERCIAL_SIGNAL_QUESTION_IDS = new Set([
  'q6_launch_signal',
  'q7_procurement_signal',
  'q8_explicit_rfp',
  'q9_news_signal',
  'q10_hiring_signal',
  'q11_decision_owner',
]);
const SOURCE_REQUIRED_QUESTION_IDS = new Set([
  'q1_foundation',
  'q2_digital_stack',
  'q3_leadership',
  'q6_launch_signal',
  'q7_procurement_signal',
  'q8_explicit_rfp',
  'q9_news_signal',
  'q10_hiring_signal',
  'q11_decision_owner',
]);
const QUESTION_OUTPUT_CONTRACTS = {
  q1_foundation: {
    fields: ['entity_classification', 'canonical_name', 'entity_type', 'geography', 'official_site', 'ambiguity_notes'],
    noSignal: 'If identity is ambiguous, classify it explicitly and include checked_sources rather than returning a generic failure.',
    reject: 'Reject bare founded years unless canonical identity and source context are also returned.',
  },
  q2_digital_stack: {
    fields: ['official_site', 'platform_hints', 'vendor_hints', 'app_hints', 'ticketing_hints', 'video_hints', 'social_hints', 'ecommerce_hints', 'digital_footprint_unknown'],
    noSignal: 'If visible technology evidence is weak, return digital_footprint_unknown with checked_sources and rationale.',
    reject: 'Reject generic website descriptions without platform, vendor, app, or checked-absence detail.',
  },
  q3_leadership: {
    fields: ['people', 'ranked_people', 'buyer_relevant_roles', 'checked_sources'],
    noSignal: 'If no named current buyer-role candidate is found, return validation_state no_signal with checked_sources explaining what was searched.',
    reject: 'Reject founded years, venues, trophies, event dates, and generic history as answers.',
  },
  q4_performance: {
    fields: ['performance_context', 'applicability', 'not_applicable_reason'],
    noSignal: 'For non-sport, person, RFP, or non-current entities, return not_applicable with rationale.',
    reject: 'Reject unsupported standings or performance claims without source context.',
  },
  q5_league_context: {
    fields: ['league_context', 'peer_set', 'commercial_context', 'applicability', 'not_applicable_reason'],
    noSignal: 'For non-sport, person, RFP, or non-current entities, return not_applicable with rationale.',
    reject: 'Reject generic peer context without explaining why it matters commercially.',
  },
  q6_launch_signal: {
    fields: ['trigger_date', 'trigger_type', 'source', 'recency', 'commercial_implication', 'checked_sources'],
    noSignal: 'If no launch or product trigger is visible, return no_signal with checked_sources and searched-source rationale.',
    reject: 'Reject positive launch claims without dated source evidence.',
  },
  q7_procurement_signal: {
    fields: ['vendor_changes', 'platform_migrations', 'partnerships', 'org_changes', 'commercial_implication', 'checked_sources'],
    noSignal: 'No-signal is acceptable only after checked_sources explain what was searched.',
    reject: 'Reject positive buying or vendor-change claims without named evidence.',
  },
  q8_explicit_rfp: {
    fields: ['rfp_documents', 'tender_dates', 'buyer_context', 'procurement_model', 'checked_sources'],
    noSignal: 'If no public tender exists, return no_signal with checked_sources and procurement_model if inferable.',
    reject: 'Reject informal partnership news as explicit RFP evidence.',
  },
  q9_news_signal: {
    fields: ['news_date', 'news_type', 'source', 'recency', 'commercial_relevance', 'commercial_implication', 'checked_sources'],
    noSignal: 'If no recent commercially relevant news is visible, return no_signal with checked_sources.',
    reject: 'Reject old or non-commercial news unless clearly marked low relevance.',
  },
  q10_hiring_signal: {
    fields: ['role_mix', 'investment_priority', 'commercial_implication', 'checked_sources'],
    noSignal: 'If no relevant hiring is visible, return no_signal with checked_sources.',
    reject: 'Reject generic careers pages without role evidence or checked-absence rationale.',
  },
  q11_decision_owner: {
    fields: ['primary_owner', 'supporting_candidates', 'buyer_function', 'verification_needed', 'checked_sources'],
    noSignal: 'Return insufficient_signal when evidence lacks a current named person or explicit role-owner.',
    reject: 'Reject event-history, venue, medal table, founding date, squad/performance facts, and generic history.',
  },
  q12_connections: {
    fields: ['recommended_route', 'candidate_paths', 'target_person', 'buyer_relevance', 'route_confidence', 'verification_needed'],
    noSignal: 'If no warm path is confirmed, return cold_verification with explicit verification_needed.',
    reject: 'Reject generic direct outreach copy when deterministic route fields are available.',
  },
  q13_capability_gap: {
    fields: ['top_gap', 'gap_label', 'evidence_basis', 'commercial_relevance', 'confidence_caveat'],
    noSignal: 'Return insufficient_signal unless normalized upstream commercial evidence supports the gap.',
    reject: 'Reject performance-only gaps as Yellow Panther commercial gaps unless tied to digital, procurement, platform, partnership, or stakeholder evidence.',
  },
  q14_yp_fit: {
    fields: ['best_service', 'service_fit', 'fit_rationale', 'buyer_context', 'evidence_basis', 'confidence_caveat'],
    noSignal: 'Return insufficient_signal unless normalized upstream evidence supports a Yellow Panther capability recommendation.',
    reject: 'Never require the target to mention Yellow Panther by name; reason from dossier evidence into capability fit.',
  },
  q15_outreach_strategy: {
    fields: ['recommended_target', 'recommended_route', 'recommended_angle', 'first_message_strategy', 'verification_needed', 'why_now'],
    noSignal: 'If buyer or fit is weak, produce a verification-first next step rather than empty outreach.',
    reject: 'Reject generic direct outreach copy when q11/q12/q14 provide route or verification context.',
  },
};
const EVIDENCE_PREFETCH_QUESTION_IDS = new Set([
  'q2_digital_stack',
  'q3_leadership',
  'q6_launch_signal',
  'q9_news_signal',
]);
const SYNTHESIS_QUESTION_IDS = new Set([
  'q11_decision_owner',
  'q12_connections',
  'q13_capability_gap',
  'q14_yp_fit',
  'q15_outreach_strategy',
]);
const VALID_EVIDENCE_GRADES = new Set(['weak', 'moderate', 'strong']);
const VALID_PROCUREMENT_MODELS = new Set(['private_direct', 'partner_led', 'agency_led', 'unknown']);
let _questionProgressFrameworkPromise = null;

function _loadEnv(override = true) {
  for (const envPath of [
    path.resolve(WORKTREE_ROOT, '..', '..', 'apps', 'signal-noise-app', '.env'),
    path.join(WORKTREE_ROOT, '.env'),
    path.join(APP_ROOT, '.env'),
    path.join(APP_ROOT, 'backend', '.env'),
  ]) {
    dotenv.config({ path: envPath, override });
  }
}

function _captureOpenCodeExplicitEnv() {
  return {
    baseUrl: process.env.ZAI_BASE_URL,
    zaiApiKey: process.env.ZAI_API_KEY,
    brightdataApiToken: process.env.BRIGHTDATA_API_TOKEN,
    brightdataToken: process.env.BRIGHTDATA_TOKEN,
    brightdataZone: process.env.BRIGHTDATA_ZONE,
  };
}

function _normalizeZaiModelId(value, fallback = FALLBACK_PREFETCH_MODEL_ID) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const withoutProvider = raw.includes('/') ? raw.split('/').pop() : raw;
  const normalized = withoutProvider.toLowerCase();
  return ZAI_MODEL_CATALOG[normalized] ? normalized : fallback;
}

function _modelRef(modelId) {
  return `${DEFAULT_PROVIDER_ID}/${_normalizeZaiModelId(modelId)}`;
}

export function resolveQuestionModelRouting(question = {}, env = process.env) {
  const forcedModel = String(env.QF_FORCE_MODEL || '').trim();
  if (forcedModel) {
    const modelId = _normalizeZaiModelId(forcedModel, FALLBACK_PREFETCH_MODEL_ID);
    return {
      model_id: modelId,
      model: _modelRef(modelId),
      model_tier: 'forced',
      quota_policy: TEMPORARY_QUOTA_POLICY,
      escalation_allowed: false,
      escalation_reason: '',
    };
  }

  const questionId = String(question?.question_id || '').trim();
  const escalationEnabled = /^(1|true|yes)$/i.test(String(env.QF_MODEL_ESCALATION_ENABLED || 'false').trim());
  let modelTier = 'default';
  let modelId = _normalizeZaiModelId(env.QF_MODEL_DEFAULT, FALLBACK_PREFETCH_MODEL_ID);

  if (EVIDENCE_PREFETCH_QUESTION_IDS.has(questionId)) {
    modelTier = 'prefetch';
    modelId = _normalizeZaiModelId(env.QF_MODEL_PREFETCH, FALLBACK_PREFETCH_MODEL_ID);
  } else if (SYNTHESIS_QUESTION_IDS.has(questionId)) {
    modelTier = 'synthesis';
    modelId = _normalizeZaiModelId(env.QF_MODEL_SYNTHESIS || env.QF_MODEL_REASONING, FALLBACK_SYNTHESIS_MODEL_ID);
  }

  return {
    model_id: modelId,
    model: _modelRef(modelId),
    model_tier: modelTier,
    quota_policy: TEMPORARY_QUOTA_POLICY,
    escalation_allowed: escalationEnabled,
    escalation_model: _modelRef(_normalizeZaiModelId(env.QF_MODEL_ESCALATION, FALLBACK_ESCALATION_MODEL_ID)),
    escalation_reason: escalationEnabled ? 'manual_or_future_explicit_escalation_only' : '',
  };
}

function _modelPromptTrace(question) {
  const routing = resolveQuestionModelRouting(question);
  return {
    model_requested: routing.model,
    model_used: routing.model,
    model_tier: routing.model_tier,
    quota_policy: routing.quota_policy,
    escalation_allowed: routing.escalation_allowed,
    escalation_model: routing.escalation_model,
    escalation_reason: routing.escalation_reason,
  };
}

function _resolveOpenCodeEnv(explicit) {
  _loadEnv(true);
  const env = explicit || _captureOpenCodeExplicitEnv();
  return {
    baseUrl: env.baseUrl || process.env.ZAI_BASE_URL || 'https://api.z.ai/api/anthropic/v1',
    apiKey: env.zaiApiKey || process.env.ZAI_API_KEY || '',
    brightdataToken:
      env.brightdataApiToken || env.brightdataToken || process.env.BRIGHTDATA_API_TOKEN || process.env.BRIGHTDATA_TOKEN || '',
    brightdataZone: env.brightdataZone || process.env.BRIGHTDATA_ZONE || '',
  };
}

function _slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'entity';
}

async function _loadQuestionProgressFramework() {
  if (!_questionProgressFrameworkPromise) {
    _questionProgressFrameworkPromise = fs.readFile(QUESTION_PROGRESS_FRAMEWORK_PATH, 'utf8')
      .then((raw) => JSON.parse(raw))
      .catch(() => ({ sections: [], questions: {} }));
  }
  return _questionProgressFrameworkPromise;
}

function _hydrateQuestionValue(value, replacements) {
  if (typeof value === 'string') {
    return value.replace(/\{([a-z_]+)\}/gi, (match, key) => {
      const normalizedKey = String(key || '').toLowerCase();
      return Object.prototype.hasOwnProperty.call(replacements, normalizedKey) ? replacements[normalizedKey] : match;
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => _hydrateQuestionValue(item, replacements));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, _hydrateQuestionValue(nestedValue, replacements)]),
    );
  }
  return value;
}

function _buildQuestionProgressLookup(framework) {
  const sections = Array.isArray(framework?.sections) ? framework.sections : [];
  const questions = framework?.questions && typeof framework.questions === 'object' ? framework.questions : {};
  const sectionOrder = sections
    .map((section) => String(section?.id || '').trim())
    .filter(Boolean);
  const sectionLabels = new Map(
    sections
      .map((section) => [String(section?.id || '').trim(), String(section?.label || '').trim()])
      .filter(([sectionId]) => Boolean(sectionId)),
  );
  const sectionQuestionIds = new Map(sectionOrder.map((sectionId) => [sectionId, []]));
  for (const [questionId, config] of Object.entries(questions)) {
    const sectionId = String(config?.section_id || '').trim();
    if (!sectionQuestionIds.has(sectionId)) continue;
    sectionQuestionIds.get(sectionId).push(questionId);
  }
  const lookup = new Map();
  for (const [questionId, config] of Object.entries(questions)) {
    const sectionId = String(config?.section_id || '').trim();
    if (!sectionId) continue;
    const sectionQuestionOrder = sectionQuestionIds.get(sectionId) || [];
    lookup.set(questionId, {
      current_section_id: sectionId,
      current_section_label: sectionLabels.get(sectionId) || sectionId.replace(/_/g, ' '),
      current_section_index: sectionOrder.indexOf(sectionId) >= 0 ? sectionOrder.indexOf(sectionId) + 1 : null,
      current_section_total: sectionOrder.length || null,
      current_question_index: sectionQuestionOrder.indexOf(questionId) >= 0 ? sectionQuestionOrder.indexOf(questionId) + 1 : null,
      current_question_total: sectionQuestionOrder.length || null,
      current_strategy_label: String(config?.strategy_label || '').trim() || null,
      current_source_order: Array.isArray(config?.source_order) ? [...config.source_order] : null,
    });
  }
  return lookup;
}

async function _normalizeQuestionSourceQuestions(sourcePayload) {
  const framework = await _loadQuestionProgressFramework();
  const progressLookup = _buildQuestionProgressLookup(framework);
  const entityName = String(sourcePayload?.entity_name || sourcePayload?.entityName || sourcePayload?.entity_id || sourcePayload?.entityId || 'entity').trim() || 'entity';
  const entityId = String(sourcePayload?.entity_id || sourcePayload?.entityId || _slugify(entityName)).trim() || _slugify(entityName);
  const entityType = String(sourcePayload?.entity_type || sourcePayload?.entityType || 'ENTITY').trim() || 'ENTITY';
  const preset = String(sourcePayload?.preset || sourcePayload?.question_source_label || entityId).trim() || entityId;
  const replacements = {
    entity: entityName,
    entity_name: entityName,
    entity_id: entityId,
    entity_type: entityType,
    preset,
  };
  return Array.isArray(sourcePayload?.questions)
    ? sourcePayload.questions
        .filter((question) => question && typeof question === 'object')
        .map((question, index) => {
          const hydratedQuestion = _hydrateQuestionValue(question, replacements);
          const normalizedQuestionId = String(hydratedQuestion.question_id || hydratedQuestion.id || hydratedQuestion.slug || `q${index + 1}`).trim();
          const progressFields = progressLookup.get(normalizedQuestionId) || {};
          const normalizedQuestionText = String(hydratedQuestion.question_text || hydratedQuestion.question || hydratedQuestion.prompt || '').trim();
          const sourcePriority = Array.isArray(hydratedQuestion.source_priority) && hydratedQuestion.source_priority.length > 0
            ? [...hydratedQuestion.source_priority]
            : (Array.isArray(hydratedQuestion.current_source_order) && hydratedQuestion.current_source_order.length > 0
              ? [...hydratedQuestion.current_source_order]
              : resolveQuestionSourceOrder({
                ...hydratedQuestion,
                question_id: normalizedQuestionId,
              }, String(hydratedQuestion.entity_type || entityType).trim() || entityType));
          const currentSourceOrder = Array.isArray(progressFields.current_source_order) && progressFields.current_source_order.length > 0
            ? [...progressFields.current_source_order]
            : sourcePriority;
          return {
            ...hydratedQuestion,
            ...Object.fromEntries(Object.entries(progressFields).filter(([, value]) => value !== null && value !== undefined)),
            question_id: normalizedQuestionId,
            question_text: normalizedQuestionText || normalizedQuestionId,
            question: normalizedQuestionText || String(hydratedQuestion.question || hydratedQuestion.prompt || normalizedQuestionId).trim(),
            entity_name: String(hydratedQuestion.entity_name || entityName).trim() || entityName,
            entity_id: String(hydratedQuestion.entity_id || entityId).trim() || entityId,
            entity_type: String(hydratedQuestion.entity_type || entityType).trim() || entityType,
            preset: hydratedQuestion.preset ?? preset,
            current_execution_state: String(hydratedQuestion.current_execution_state || progressFields.current_execution_state || 'searching sources').trim(),
            source_priority: sourcePriority,
            current_source_order: currentSourceOrder,
          };
        })
    : [];
}

function _isCommercialSignalQuestion(question) {
  return COMMERCIAL_SIGNAL_QUESTION_IDS.has(String(question?.question_id || '').trim());
}

function _questionOutputContract(question) {
  return QUESTION_OUTPUT_CONTRACTS[String(question?.question_id || '').trim()] || null;
}

function _questionOutputContractPromptLines(question) {
  const contract = _questionOutputContract(question);
  if (!contract) return [];
  const fields = Array.isArray(contract.fields) ? contract.fields.filter(Boolean) : [];
  return [
    `Return typed fields: validation_state, confidence, checked_sources, structured_signal, display_answer${fields.length ? `, plus ${fields.join(', ')}` : ''}.`,
    'display_answer must be a compact object: headline, bullets, evidence, commercial_implication, verification_needed, status_label.',
    contract.noSignal ? `No-signal rule: ${contract.noSignal}` : '',
    contract.reject ? `Reject rule: ${contract.reject}` : '',
  ].filter(Boolean);
}

function _usesEvidenceFirstOpenCodeFlow(question) {
  return EVIDENCE_PREFETCH_QUESTION_IDS.has(String(question?.question_id || '').trim());
}

function _normalizeUrlHost(url) {
  try {
    return new URL(String(url || '')).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function _sourceTypeForLead(lead) {
  const url = String(lead?.url || '').toLowerCase();
  const title = String(lead?.title || '').toLowerCase();
  const text = _leadText(lead).toLowerCase();
  const host = _normalizeUrlHost(url);
  if (/linkedin\.com\/in\//.test(url)) return 'linkedin_person_profile';
  if (/linkedin\.com\/company\//.test(url)) return 'linkedin_company_profile';
  if (/apps\.apple\.com|play\.google\.com/.test(url)) return 'app_store';
  if (/reddit\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com|youtube\.com|youtu\.be/.test(host)) return 'social';
  if (/wikipedia\.org|wikidata\.org|britannica\.com|dbpedia\.org|worldcat\.org/.test(host)) return 'generic_reference';
  if (/\/news|\/press|press-release|media-centre|media-center/.test(url) || /\b(news|press release|announcement)\b/.test(title)) return 'press_release';
  if (/espn|bbc|skysports|reuters|apnews|sportsbusinessjournal|sportbusiness|forbes|theguardian|cyclingnews/.test(url)) return 'news';
  if (host && /\bofficial\b/.test(text)) return 'official_site';
  if (host) return 'web_page';
  return 'unknown';
}

function _leadText(lead) {
  return [lead?.title, lead?.snippet, lead?.excerpt]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
}

function _hasDateHint(text) {
  return /\b(20[2-9]\d|19[8-9]\d)\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(String(text || ''));
}

function _hasRecentDateHint(text, { maxAgeYears = 2 } = {}) {
  const source = String(text || '');
  const currentYear = Number.isFinite(new Date().getFullYear()) ? new Date().getFullYear() : 2026;
  const years = Array.from(source.matchAll(/\b(20[0-9]\d)\b/g)).map((match) => Number(match[1])).filter(Number.isFinite);
  if (years.length === 0) {
    return /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(source);
  }
  return years.some((year) => year >= currentYear - maxAgeYears && year <= currentYear + 1);
}

function _isGenericSourceLead(lead) {
  const url = String(lead?.url || '').toLowerCase();
  const title = String(lead?.title || '').toLowerCase();
  return /wikipedia\.org|wikidata\.org|britannica\.com|dbpedia\.org|worldcat\.org/.test(url)
    || /\b(wikipedia|wikidata|encyclopaedia|encyclopedia)\b/.test(title);
}

function _isGenericHistoryText(text) {
  return /\b(founded|history|venue|venues|trophy|trophies|medal|medals|standings|fixtures|results|wikipedia)\b/i.test(String(text || ''))
    && !/\b(chief|ceo|coo|director|head of|manager|commercial|partnership|sponsorship|marketing|digital|technology|strategy|board|chair)\b/i.test(String(text || ''));
}

function _acceptanceReasonForQuestion(question, lead) {
  const questionId = String(question?.question_id || '').trim();
  const text = _leadText(lead);
  const sourceType = lead?.source_type || _sourceTypeForLead(lead);
  if (!String(lead?.url || '').trim()) return null;
  if (_isGenericSourceLead(lead)) return null;
  if (sourceType === 'social' || sourceType === 'generic_reference') return null;
  if (questionId === 'q2_digital_stack') {
    return /\b(app|platform|ticketing|tickets|video|streaming|social|ecommerce|shop|store|vendor|crm|cms|membership|digital)\b/i.test(text)
      ? 'digital_footprint_hint'
      : null;
  }
  if (questionId === 'q3_leadership') {
    if (_isGenericHistoryText(text)) return null;
    return /\b(chief|ceo|coo|director|head of|manager|commercial|partnership|sponsorship|marketing|digital|technology|strategy|board|chair|president|founder)\b/i.test(text)
      && /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(text)
      ? 'buyer_role_candidate'
      : null;
  }
  if (questionId === 'q6_launch_signal') {
    return /\b(launch|launched|announce|announced|unveil|unveiled|app|platform|product|fan experience|digital)\b/i.test(text)
      && _hasDateHint(text)
      && _hasRecentDateHint(text, { maxAgeYears: 3 })
      ? 'dated_launch_or_platform_trigger'
      : null;
  }
  if (questionId === 'q9_news_signal') {
    return /\b(partnership|partner|commercial|strategy|strategic|investment|digital|platform|launch|expansion|announcement|announced|sponsor|sponsorship)\b/i.test(text)
      && _hasDateHint(text)
      && _hasRecentDateHint(text, { maxAgeYears: 2 })
      ? 'dated_commercial_news_trigger'
      : null;
  }
  return null;
}

function _normalizeSearchResults(searchResult) {
  if (Array.isArray(searchResult)) return searchResult;
  if (Array.isArray(searchResult?.results)) return searchResult.results;
  if (Array.isArray(searchResult?.data)) return searchResult.data;
  return [];
}

function _queryVariantsForPrefetch(question, maxQueries) {
  const variants = [];
  const add = (value) => {
    const normalized = String(value || '').trim();
    if (normalized && !variants.includes(normalized)) variants.push(normalized);
  };
  add(question?.query);
  const strategyQueries = question?.search_strategy?.search_queries;
  if (Array.isArray(strategyQueries)) {
    for (const query of strategyQueries) add(query);
  }
  const entity = String(question?.entity_name || '').trim();
  const entityQuery = entity ? `"${entity}"` : '';
  const questionId = String(question?.question_id || '').trim();
  if (entityQuery && questionId === 'q2_digital_stack') {
    add(`${entityQuery} app platform ticketing video ecommerce official`);
    add(`${entityQuery} digital membership official website`);
  } else if (entityQuery && questionId === 'q3_leadership') {
    add(`${entityQuery} leadership board commercial director`);
    add(`${entityQuery} head of partnerships marketing digital director`);
    add(`${entityQuery} LinkedIn commercial director partnerships`);
  } else if (entityQuery && questionId === 'q6_launch_signal') {
    add(`${entityQuery} launch app platform product official news`);
    add(`${entityQuery} digital fan experience announced`);
  } else if (entityQuery && questionId === 'q9_news_signal') {
    add(`${entityQuery} news announcement partnership commercial 2026`);
    add(`${entityQuery} strategic partnership digital investment`);
  }
  return variants.slice(0, Math.max(1, Number(maxQueries || 1)));
}

async function _defaultPrefetchSearchEngine(query, { question } = {}) {
  const result = await runStandaloneDirectBrightDataPrefetch(question, { query });
  return { status: 'success', results: result.results || [] };
}

async function _defaultPrefetchScrapeMarkdown(url, { question } = {}) {
  const result = await runStandaloneDirectBrightDataPrefetch(question, { scrape_url: url });
  return { status: result.content ? 'success' : 'empty', content: result.content || '' };
}

function _decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function _stripMarkup(value) {
  return _decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _extractQ3LeadershipExcerpt(content) {
  const raw = _decodeHtmlEntities(content);
  if (!raw.trim()) return '';
  const plain = _stripMarkup(raw);
  const directCandidates = _leadershipCandidatesFromText(plain).slice(0, 5);
  if (directCandidates.length > 0) {
    return directCandidates
      .map((candidate) => `${candidate.name}. ${candidate.title}.`)
      .join(' ');
  }

  const snippets = [];
  const seen = new Set();
  const titlePatterns = [
    /\btitle="([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:[-'’ ][A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){1,3})"/g,
    /\baria-label="([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:[-'’ ][A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){1,3})"/g,
    /\bblockTitle":"([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:[-'’ ][A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){1,3})"/g,
  ];
  for (const pattern of titlePatterns) {
    for (const match of raw.matchAll(pattern)) {
      const name = String(match[1] || '').trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key) || /\b(major league|soccer|communications|share on|copy url)\b/i.test(name)) continue;
      seen.add(key);
      const before = raw.slice(Math.max(0, match.index - 1800), match.index);
      const roleMatches = Array.from(_stripMarkup(before).matchAll(new RegExp(BUYER_TITLE_PATTERN, 'gi')));
      const role = roleMatches.length > 0 ? roleMatches[roleMatches.length - 1][0] : 'Executive';
      snippets.push(`${name}. ${role}.`);
      if (snippets.length >= 6) break;
    }
    if (snippets.length >= 6) break;
  }
  return snippets.join(' ');
}

export async function prefetchQuestionEvidence(question, {
  maxQueries = 4,
  maxResults = 5,
  scrapeTopN = 1,
  now = () => new Date().toISOString(),
  searchEngine = _defaultPrefetchSearchEngine,
  scrapeMarkdown = _defaultPrefetchScrapeMarkdown,
} = {}) {
  const queryVariants = _queryVariantsForPrefetch(question, maxQueries);
  const leads = [];
  const checkedSources = [];
  const rejected = [];
  for (const query of queryVariants) {
    let results = [];
    try {
      results = _normalizeSearchResults(await searchEngine(query, { question })).slice(0, maxResults);
    } catch (error) {
      checkedSources.push({
        query,
        status: 'retrieval_failed',
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    for (const result of results) {
      const url = String(result?.url || result?.link || '').trim();
      if (!url || leads.some((lead) => lead.url === url) || rejected.some((lead) => lead.url === url)) continue;
      let excerpt = String(result?.excerpt || result?.content || '').trim();
      const questionId = String(question?.question_id || '').trim();
      const q3NeedsLeadershipScrape = questionId === 'q3_leadership'
        && leads.length < scrapeTopN
        && _leadershipCandidatesFromText([
          result?.title,
          result?.snippet || result?.description,
          excerpt,
        ].filter(Boolean).join(' ')).length === 0;
      if ((!excerpt || q3NeedsLeadershipScrape) && leads.length < scrapeTopN) {
        try {
          const scrape = await scrapeMarkdown(url, { question, query });
          const scrapedContent = String(scrape?.content || scrape?.markdown || '').trim();
          const q3Excerpt = questionId === 'q3_leadership'
            ? _extractQ3LeadershipExcerpt(scrapedContent)
            : '';
          excerpt = (q3Excerpt || scrapedContent).slice(0, 1600);
        } catch {
          excerpt = '';
        }
      }
      const candidate = {
        title: String(result?.title || '').trim(),
        url,
        snippet: String(result?.snippet || result?.description || '').trim(),
        excerpt,
        source_type: _sourceTypeForLead({ ...result, url }),
        query_used: query,
        retrieved_at: now(),
      };
      const acceptanceReason = _acceptanceReasonForQuestion(question, candidate);
      checkedSources.push({
        url,
        query,
        source_type: candidate.source_type,
        accepted: Boolean(acceptanceReason),
        reason: acceptanceReason || 'not_relevant_for_question_contract',
      });
      if (acceptanceReason) {
        leads.push({
          ...candidate,
          acceptance_reason: acceptanceReason,
        });
      } else {
        rejected.push(candidate);
      }
    }
  }
  const sourceTypes = Array.from(new Set(leads.map((lead) => lead.source_type).filter(Boolean)));
  return {
    leads,
    checked_sources: checkedSources,
    retrieval_summary: leads.length > 0
      ? `Accepted ${leads.length} ${question?.question_id || 'question'} evidence lead(s) from ${queryVariants.length} query variant(s).`
      : `No accepted ${question?.question_id || 'question'} evidence after ${queryVariants.length} query variant(s).`,
    diagnostics: {
      query_variants_used: queryVariants,
      accepted_source_count: leads.length,
      rejected_source_count: rejected.length,
      source_types: sourceTypes,
    },
  };
}

function _isDerivedSynthesisQuestion(question) {
  const questionId = String(question?.question_id || '').trim();
  const executionClass = String(question?.execution_class || '').trim();
  return executionClass === 'derived_inference'
    || ['q13_capability_gap', 'q14_yp_fit', 'q15_outreach_strategy'].includes(questionId);
}

function _getQuestionFamilyKey(question) {
  const questionId = String(question?.question_id || '').trim().toLowerCase();
  const questionType = String(question?.question_type || '').trim().toLowerCase();

  if (['q7_procurement_signal', 'q8_explicit_rfp', 'q10_hiring_signal'].includes(questionId) || ['procurement', 'procurement_signal', 'tender_docs', 'hiring_signal'].includes(questionType)) {
    return 'procurement';
  }
  if (['q11_decision_owner', 'q12_connections', 'q15_outreach_strategy', 'q3_leadership'].includes(questionId) || ['decision_owner', 'connections', 'outreach_strategy', 'leadership', 'poi'].includes(questionType)) {
    return 'decision-owner';
  }
  if (['q2_digital_stack', 'q6_launch_signal', 'q9_news_signal'].includes(questionId) || ['digital_stack', 'launch_signal', 'news_signal', 'performance', 'league_context'].includes(questionType)) {
    return 'digital';
  }
  if (['q13_capability_gap', 'q14_yp_fit'].includes(questionId) || ['capability_gap', 'yp_fit'].includes(questionType)) {
    return 'capability';
  }
  return 'generic';
}

export function resolveQuestionSourceOrder(question, entityType = 'ENTITY') {
  const normalizedEntityType = String(entityType || question?.entity_type || 'ENTITY').trim().toUpperCase();
  const family = _getQuestionFamilyKey(question);
  const questionId = String(question?.question_id || '').trim().toLowerCase();

  const entityTypeDefaults = {
    CLUB: ['official_site', 'leadership_page', 'vacancies', 'app_store', 'sponsors', 'news', 'linkedin_posts', 'wikipedia'],
    LEAGUE: ['official_site', 'broadcast_partner', 'app_store', 'commercial_partner', 'federation_site', 'press_release', 'news', 'linkedin_posts'],
    FEDERATION: ['official_site', 'tender_portal', 'board_minutes', 'strategic_plan', 'leadership_page', 'press_release', 'news', 'linkedin_posts'],
    PERSON: ['official_bio', 'linkedin_posts', 'interview', 'official_site', 'news'],
    ENTITY: ['official_site', 'news', 'linkedin_posts', 'wikipedia'],
  };

  const familyOverrides = {
    procurement: ['vacancies', 'partner_announcement', 'vendor_page', 'tender_portal', 'press_release', 'news'],
    'decision-owner': ['official_site', 'leadership_page', 'linkedin_company_profile', 'linkedin_people_search', 'linkedin_posts', 'news', 'official_bio', 'wikipedia'],
    digital: ['official_site', 'app_store', 'press_release', 'news', 'vendor_page', 'wikipedia'],
    capability: ['official_site', 'news', 'press_release', 'linkedin_posts'],
    generic: [],
  };

  if (questionId === 'q7_procurement_signal') {
    return ['official_site', 'tender_portal', 'press_release', 'partner_announcement', 'linkedin_posts', 'vendor_page'];
  }

  if (normalizedEntityType === 'FEDERATION' && family === 'procurement') {
    return ['official_site', 'tender_portal', 'board_minutes', 'strategic_plan', 'leadership_page', 'press_release', 'news', 'linkedin_posts', 'partner_announcement', 'vendor_page'];
  }

  const base = entityTypeDefaults[normalizedEntityType] || entityTypeDefaults.ENTITY;
  const familyFirst = familyOverrides[family] || [];
  return Array.from(new Set([...familyFirst, ...base]));
}

function _clampNumber(value, min = 0, max = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function _normalizeCommercialSignalItem(item, fallbackUrl = '') {
  if (!item) return null;
  if (typeof item === 'string') {
    const name = item.trim();
    return name
      ? { name, evidence_url: fallbackUrl || '', evidence_kind: 'web_signal', summary: '' }
      : null;
  }
  if (typeof item !== 'object') return null;
  const name = String(item.name || item.vendor || item.partner || item.platform || item.label || '').trim();
  if (!name) return null;
  return {
    name,
    evidence_url: String(item.evidence_url || item.url || fallbackUrl || '').trim(),
    evidence_kind: String(item.evidence_kind || item.source_type || item.type || item.kind || 'web_signal').trim(),
    summary: String(item.summary || item.description || item.note || '').trim(),
  };
}

function _normalizeQ7StructuredSignal(structuredOutput, fallbackUrl = '') {
  const source = structuredOutput?.structured_signal && typeof structuredOutput.structured_signal === 'object'
    ? structuredOutput.structured_signal
    : structuredOutput || {};
  const normalizeBucket = (key) => {
    const values = Array.isArray(source?.[key]) ? source[key] : [];
    return values.map((item) => _normalizeCommercialSignalItem(item, fallbackUrl)).filter(Boolean);
  };
  return {
    vendor_changes: normalizeBucket('vendor_changes'),
    platform_migrations: normalizeBucket('platform_migrations'),
    partnerships: normalizeBucket('partnerships'),
    org_changes: normalizeBucket('org_changes'),
  };
}

function _countStructuredSignalItems(questionId, structuredSignal) {
  if (!structuredSignal || typeof structuredSignal !== 'object') return 0;
  if (questionId === 'q7_procurement_signal') {
    const weightedCount = (values, bucket) => {
      if (!Array.isArray(values)) return 0;
      return values.reduce((sum, item) => {
        const kind = String(item?.evidence_kind || '').trim().toLowerCase();
        if (bucket === 'vendor_changes') return sum + 1;
        if (bucket === 'platform_migrations') return sum + 1;
        if (bucket === 'org_changes') return sum + 0.5;
        if (bucket === 'partnerships') {
          if (kind === 'commercial_sponsorship') return sum + 0.1;
          return sum + 0.75;
        }
        return sum;
      }, 0);
    };
    return weightedCount(structuredSignal.vendor_changes, 'vendor_changes')
      + weightedCount(structuredSignal.platform_migrations, 'platform_migrations')
      + weightedCount(structuredSignal.partnerships, 'partnerships')
      + weightedCount(structuredSignal.org_changes, 'org_changes');
  }
  if (questionId === 'q10_hiring_signal') {
    return [
      Array.isArray(structuredSignal.role_categories_observed) ? structuredSignal.role_categories_observed.length : 0,
      Number.isFinite(Number(structuredSignal.open_roles_approx)) ? 1 : 0,
      Array.isArray(structuredSignal.tech_partnerships) ? Math.min(structuredSignal.tech_partnerships.length, 1) : 0,
      Array.isArray(structuredSignal.geographic_expansion) ? Math.min(structuredSignal.geographic_expansion.length, 1) : 0,
    ].reduce((sum, value) => sum + value, 0);
  }
  return Object.values(structuredSignal).reduce((sum, value) => {
    if (Array.isArray(value)) return sum + value.length;
    return sum + (value ? 1 : 0);
  }, 0);
}

function _collectUniqueSourceUrls(structuredOutput = {}) {
  const urls = new Set();
  const directSources = Array.isArray(structuredOutput.sources) ? structuredOutput.sources : [];
  directSources.forEach((item) => {
    const url = typeof item === 'string' ? item : item?.url;
    if (url) urls.add(String(url).trim());
  });
  if (structuredOutput.evidence_url) urls.add(String(structuredOutput.evidence_url).trim());
  const nestedAnswer = structuredOutput.answer && typeof structuredOutput.answer === 'object'
    ? structuredOutput.answer
    : {};
  if (Array.isArray(nestedAnswer.sources)) {
    nestedAnswer.sources.forEach((item) => {
      const url = typeof item === 'string' ? item : item?.url;
      if (url) urls.add(String(url).trim());
    });
  }
  const nestedPeople = Array.isArray(nestedAnswer.people) ? nestedAnswer.people : [];
  nestedPeople.forEach((person) => {
    if (person?.evidence_url) urls.add(String(person.evidence_url).trim());
  });
  return Array.from(urls).filter(Boolean);
}

function _toDisplayText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => _toDisplayText(item)).filter(Boolean).join('; ');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nestedValue]) => {
        const nestedText = _toDisplayText(nestedValue);
        return nestedText ? `${key}: ${nestedText}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }
  return '';
}

function _isMeaningfulCommercialText(value) {
  const text = _toDisplayText(value);
  if (!text) return false;
  return !/(^no_signal$|^no signal$|^insufficient_signal$|^no_answer$|source pending$|question execution failed|no deterministic answer was produced|no completed brightdata leads were recoverable|no brightdata-backed evidence|initial search returned only generic|follow-up search timed out|returned no results matching|no results matching|no hiring leads found|bounded retrieval|lead with a .* angle tied to the active signal|points to insufficient_signal|current dossier evidence points to insufficient[_ ]signal|searches? (for|across).* (returned|found) no|limited to unrelated|kind:\s*summary(\.|;|$)|kind:\s*summary;\s*value:\s*(;|null)|value:\s*null|summary:\s*null|raw structured output:\s*(;|null)|no web evidence found|insufficient signal|^\[object object\]$)/i.test(text);
}

function _isObjectStringPlaceholder(value) {
  return typeof value === 'string' && value.trim() === '[object Object]';
}

function _firstMeaningfulCommercialText(values) {
  return values.map((value) => _toDisplayText(value)).find((text) => _isMeaningfulCommercialText(text)) || '';
}

function _isConciseBuyerTargetText(value) {
  const text = _toDisplayText(value);
  if (!_isMeaningfulCommercialText(text)) return false;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(text) || /^\d{4}$/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (text.length > 90 || words.length > 8) return false;
  return !/[.;:]|\b(leverages?|comprising|comprises|including|technology stack|partnership stack|website|wordpress|woocommerce|evidence|summary|founded|established|season|history)\b/i.test(text);
}

function _firstConciseBuyerTargetText(values) {
  return values.map((value) => _toDisplayText(value)).find((text) => _isConciseBuyerTargetText(text)) || '';
}

function _getAnswerRaw(questionPayload) {
  const answer = questionPayload?.answer;
  if (answer && typeof answer === 'object') {
    return answer.raw_structured_output && typeof answer.raw_structured_output === 'object'
      ? answer.raw_structured_output
      : answer;
  }
  return questionPayload?.reasoning?.structured_output && typeof questionPayload.reasoning.structured_output === 'object'
    ? questionPayload.reasoning.structured_output
    : {};
}

function _validatedOrProvisional(questionPayload) {
  const state = String(questionPayload?.validation_state || '').trim().toLowerCase();
  return ['validated', 'confirmed', 'provisional'].includes(state);
}

function _priorQuestionMap(priorQuestions = []) {
  return new Map(
    (Array.isArray(priorQuestions) ? priorQuestions : [])
      .filter((item) => item && typeof item === 'object' && item.question_id)
      .map((item) => [String(item.question_id), item]),
  );
}

function _strongestPriorCommercialSignal(priorById) {
  const candidates = [
    priorById.get('q6_launch_signal'),
    priorById.get('q9_news_signal'),
    priorById.get('q7_procurement_signal'),
    priorById.get('q10_hiring_signal'),
    priorById.get('q2_digital_stack'),
  ].filter(Boolean);
  return candidates
    .filter((item) => _validatedOrProvisional(item))
    .map((item) => ({
      question_id: item.question_id,
      answer: _firstMeaningfulCommercialText([
        _getAnswerRaw(item).answer,
        _getAnswerRaw(item).summary,
        _getAnswerRaw(item).context,
        item.answer,
        item.notes,
      ]),
      confidence: Number(item.confidence || 0),
      evidence_url: item.evidence_url || '',
    }))
    .filter((item) => _isMeaningfulCommercialText(item.answer))
    .sort((a, b) => b.confidence - a.confidence)[0] || null;
}

function _buyerContextFromPrior(priorById) {
  const q11 = priorById.get('q11_decision_owner') || {};
  const raw = _getAnswerRaw(q11);
  const primaryOwner = raw.primary_owner && typeof raw.primary_owner === 'object' ? raw.primary_owner : {};
  const proseOwner = _leadershipCandidatesFromText(q11.answer)[0] || _leadershipCandidatesFromText(raw.answer)[0] || null;
  const structuredSignal = raw.structured_signal && typeof raw.structured_signal === 'object'
    ? raw.structured_signal
    : (q11.structured_signal && typeof q11.structured_signal === 'object' ? q11.structured_signal : {});
  const name = _firstConciseBuyerTargetText([
    primaryOwner.name,
    proseOwner?.name,
    structuredSignal.decision_owner_name,
    structuredSignal.name,
    raw.name,
    raw.answer,
    q11.primary_owner?.name,
    q11.answer,
  ]);
  const title = _firstMeaningfulCommercialText([
    primaryOwner.title,
    proseOwner?.title,
    structuredSignal.decision_owner_title,
    structuredSignal.title,
    structuredSignal.role,
    raw.title,
    q11.primary_owner?.title,
  ]);
  return {
    name,
    title,
    confidence: Number(q11.confidence || 0),
  };
}

function _candidateRoleScore(candidate) {
  const haystack = [
    candidate?.title,
    candidate?.role,
    candidate?.function,
    candidate?.function_type,
    candidate?.department,
    candidate?.summary,
  ].map((value) => String(value || '').toLowerCase()).join(' ');
  if (/\b(chief commercial officer|cco|commercial director|head of commercial|commercial)\b/.test(haystack)) return 100;
  if (/\b(partnerships?|sponsorship|business development|revenue)\b/.test(haystack)) return 90;
  if (/\b(digital|product|technology|data|marketing|growth|strategy)\b/.test(haystack)) return 80;
  if (/\b(chief executive|ceo|managing director|general manager)\b/.test(haystack)) return 70;
  return 0;
}

const BUYER_TITLE_PATTERN = '(Chief Commercial Officer|Commercial Director|Head of Commercial|Head of Partnerships|Partnerships Director|Sponsorship Director|Business Development Director|Chief Marketing Officer|Marketing Director|Chief Digital Officer|Digital Director|Chief Technology Officer|Technology Director|Product Director|Strategy Director|Chief Executive Officer|Managing Director|General Manager|Director(?:, [A-Z][A-Za-z &]+)?|Commissioner|President|Executive Vice President|Vice President|CEO|CCO|CMO|CDO|CTO)';

function _normalizeLeadershipPersonName(value) {
  return _firstConciseBuyerTargetText([value])
    .replace(/^(Names|Named)\s+/i, '')
    .trim();
}

function _normalizeLeadershipTitle(value) {
  let title = _firstMeaningfulCommercialText([value])
    .replace(/\s+/g, ' ')
    .trim();
  if (!title) return '';
  title = title
    .replace(/\s+(?:at|with|for)\s+(?:Major|Minor|National|International|The)\b.*$/i, '')
    .replace(/\s+-\s+.*$/i, '')
    .replace(/\s+\|\s+.*$/i, '')
    .replace(/\s+·\s+.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return title.replace(/[,.]\s*$/g, '').trim();
}

function _leadershipCandidatesFromText(value) {
  const text = _toDisplayText(value);
  if (!_isMeaningfulCommercialText(text)) return [];
  const candidates = [];
  const patterns = [
    new RegExp(`\\b([A-Z][a-z]+(?:[-' ][A-Z][a-z]+){1,3})\\s*,\\s*${BUYER_TITLE_PATTERN}\\b`, 'g'),
    new RegExp(`\\b([A-Z][a-z]+(?:[-' ][A-Z][a-z]+){1,3})\\.\\s+${BUYER_TITLE_PATTERN}\\b`, 'g'),
    new RegExp(`\\b([A-Z][a-z]+(?:[-' ][A-Z][a-z]+){1,3})\\s+-\\s+${BUYER_TITLE_PATTERN}\\b`, 'g'),
    new RegExp(`\\b([A-Z][a-z]+(?:[-' ][A-Z][a-z]+){1,3})\\s+(?:is|as|serves as|acts as|was named|leads[^.]{0,60}as)\\s+(?:the\\s+)?${BUYER_TITLE_PATTERN}\\b`, 'g'),
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      candidates.push({
        name: match[1],
        title: match[2],
        summary: text,
      });
    }
  }
  return candidates;
}

function _normalizeLeadershipCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const name = _normalizeLeadershipPersonName(_firstConciseBuyerTargetText([
    candidate.name,
    candidate.full_name,
    candidate.person_name,
    candidate.label,
  ]));
  const title = _normalizeLeadershipTitle(_firstMeaningfulCommercialText([
    candidate.title,
    candidate.role,
    candidate.job_title,
    candidate.position,
  ]));
  if (/\b(association|club|fc|league|soccer|football|basketball|baseball|rugby|cricket|federation|committee|council|organisation|organization)\b/i.test(name)) {
    return null;
  }
  if (!name || _candidateRoleScore(candidate) <= 0) return null;
  return {
    name,
    title,
    function: _firstMeaningfulCommercialText([candidate.function, candidate.function_type, candidate.department]),
    evidence_url: _firstMeaningfulCommercialText([candidate.evidence_url, candidate.url, candidate.linkedin_url]),
    score: _candidateRoleScore(candidate),
  };
}

function _leadershipStructuredCandidates(structuredOutput) {
  if (!structuredOutput || typeof structuredOutput !== 'object') return [];
  const nestedAnswer = structuredOutput.answer && typeof structuredOutput.answer === 'object'
    ? structuredOutput.answer
    : {};
  return [
    ...(Array.isArray(structuredOutput.candidates) ? structuredOutput.candidates : []),
    ...(Array.isArray(structuredOutput.people) ? structuredOutput.people : []),
    ...(Array.isArray(structuredOutput.leadership) ? structuredOutput.leadership : []),
    ...(Array.isArray(structuredOutput.ranked_people) ? structuredOutput.ranked_people : []),
    ...(Array.isArray(nestedAnswer.people) ? nestedAnswer.people : []),
    ...(Array.isArray(nestedAnswer.leadership) ? nestedAnswer.leadership : []),
    ...(Array.isArray(nestedAnswer.ranked_people) ? nestedAnswer.ranked_people : []),
    structuredOutput.primary_owner && typeof structuredOutput.primary_owner === 'object' ? structuredOutput.primary_owner : null,
    nestedAnswer.primary_owner && typeof nestedAnswer.primary_owner === 'object' ? nestedAnswer.primary_owner : null,
  ].filter(Boolean);
}

function _promoteQ3LeadershipStructuredOutput(structuredOutput) {
  if (!structuredOutput || typeof structuredOutput !== 'object') return structuredOutput;
  const normalizedCandidates = _leadershipStructuredCandidates(structuredOutput)
    .map(_normalizeLeadershipCandidate)
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);
  if (normalizedCandidates.length === 0) return structuredOutput;

  const primaryOwner = normalizedCandidates[0];
  const supportingCandidates = normalizedCandidates.slice(1, 6);
  const sourceUrls = _collectUniqueSourceUrls(structuredOutput);
  const nestedAnswer = structuredOutput.answer && typeof structuredOutput.answer === 'object'
    ? structuredOutput.answer
    : {};
  const summary = structuredOutput.summary
    || nestedAnswer.summary
    || `${primaryOwner.name}${primaryOwner.title ? ` (${primaryOwner.title})` : ''} is the strongest current buyer-role candidate.`;

  return {
    ...structuredOutput,
    answer: summary,
    summary,
    primary_owner: structuredOutput.primary_owner || primaryOwner,
    supporting_candidates: Array.isArray(structuredOutput.supporting_candidates) && structuredOutput.supporting_candidates.length > 0
      ? structuredOutput.supporting_candidates
      : supportingCandidates,
    candidates: Array.isArray(structuredOutput.candidates) && structuredOutput.candidates.length > 0
      ? structuredOutput.candidates
      : normalizedCandidates,
    sources: Array.isArray(structuredOutput.sources) && structuredOutput.sources.length > 0
      ? structuredOutput.sources
      : sourceUrls,
    evidence_url: structuredOutput.evidence_url || primaryOwner.evidence_url || sourceUrls[0] || '',
  };
}

function _leadershipCandidatesFromPrior(priorById) {
  const q3 = priorById.get('q3_leadership') || {};
  if (!_validatedOrProvisional(q3)) return [];
  const raw = _getAnswerRaw(q3);
  const directCandidates = [
    ..._leadershipStructuredCandidates(raw),
    ..._leadershipCandidatesFromText(q3.answer),
  ].filter(Boolean);
  return directCandidates
    .map(_normalizeLeadershipCandidate)
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);
}

function _connectionsContextFromPrior(priorById, buyer) {
  const q12 = priorById.get('q12_connections') || {};
  const raw = _getAnswerRaw(q12);
  const paths = Array.isArray(raw.candidate_paths) ? raw.candidate_paths : [];
  const bestPath = paths[0] && typeof paths[0] === 'object' ? paths[0] : {};
  return {
    owner: _firstMeaningfulCommercialText([
      raw.best_yp_owner,
      raw.yp_member,
      raw.recommended_yp_owner,
      bestPath.best_yp_owner,
      bestPath.yp_member,
    ]),
    pathType: _firstMeaningfulCommercialText([
      raw.path_type,
      raw.introduction_path,
      raw.recommended_route,
      bestPath.path_type,
      bestPath.route_type,
    ]),
    targetPerson: _firstMeaningfulCommercialText([
      raw.target_person,
      bestPath.name,
      bestPath.target_person,
      buyer.name,
    ]),
    confidence: Number(raw.route_confidence || bestPath.route_confidence || q12.confidence || 0),
  };
}

function _inferYellowPantherService(signalText, capabilityGapText) {
  const combined = `${signalText} ${capabilityGapText}`.toLowerCase();
  if (/\b(app|platform|digital|ott|product|launch|website|fan experience|ticketing|stack)\b/.test(combined)) {
    return 'DIGITAL_TRANSFORMATION';
  }
  if (/\b(procurement|vendor|rfp|tender|commercial|partnership|sponsor|revenue)\b/.test(combined)) {
    return 'COMMERCIAL_PARTNERSHIPS';
  }
  if (/\b(hiring|recruitment|delivery|programme|program|project)\b/.test(combined)) {
    return 'PROJECT_DELIVERY';
  }
  if (/\b(strategy|growth|planning|positioning)\b/.test(combined)) {
    return 'STRATEGY';
  }
  return 'STAKEHOLDER_ENGAGEMENT';
}

function _buildInsufficientSynthesis(question, confidenceCaveat) {
  return {
    question: question.question_text,
    answer: 'insufficient_signal',
    summary: 'insufficient_signal',
    validation_state: 'no_signal',
    confidence: 0,
    sources: [],
    status: 'insufficient_signal',
    confidence_caveat: confidenceCaveat || 'Need stronger adjacent dossier evidence before deterministic synthesis.',
  };
}

function _buildDeterministicStructuredOutput(question, priorQuestions = []) {
  const questionId = String(question?.question_id || '').trim();
  const priorById = _priorQuestionMap(priorQuestions);
  const signal = _strongestPriorCommercialSignal(priorById);
  const buyer = _buyerContextFromPrior(priorById);
  const connections = _connectionsContextFromPrior(priorById, buyer);
  const q13Raw = _getAnswerRaw(priorById.get('q13_capability_gap') || {});
  const capabilityGapText = _firstMeaningfulCommercialText([
    q13Raw.top_gap,
    q13Raw.gap_label,
    q13Raw.answer,
    q13Raw.summary,
  ]);

  if (questionId === 'q11_decision_owner') {
    const candidate = _leadershipCandidatesFromPrior(priorById)[0];
    if (!candidate) {
      return _buildInsufficientSynthesis(question, 'Need a named commercial, partnerships, digital, product, or executive leadership candidate before buyer synthesis.');
    }
    const confidence = Math.max(0.5, Math.min(0.72, (Number(priorById.get('q3_leadership')?.confidence || 0) || 0.65) - 0.12));
    return {
      question: question.question_text,
      answer: candidate.name,
      summary: `${candidate.name}${candidate.title ? ` (${candidate.title})` : ''} is the strongest buyer hypothesis from leadership evidence.`,
      primary_owner: {
        name: candidate.name,
        title: candidate.title,
        function: candidate.function,
        evidence_url: candidate.evidence_url,
      },
      structured_signal: {
        decision_owner_name: candidate.name,
        decision_owner_title: candidate.title,
        buyer_function: candidate.function || 'commercial',
      },
      buyer_confidence: confidence,
      verification_needed: `Confirm ${candidate.name} still owns the commercial or digital buying motion before outreach.`,
      validation_state: 'provisional',
      confidence,
      sources: candidate.evidence_url ? [candidate.evidence_url] : [],
    };
  }

  if (questionId === 'q12_connections') {
    if (!buyer.name) {
      return _buildInsufficientSynthesis(question, 'Need a buyer hypothesis before route synthesis.');
    }
    return {
      question: question.question_text,
      answer: buyer.name,
      summary: `${buyer.name}${buyer.title ? ` (${buyer.title})` : ''} is the buyer route to verify; no deterministic warm path is confirmed yet.`,
      candidate_paths: [{
        name: buyer.name,
        title: buyer.title,
        best_yp_owner: '',
        path_type: 'cold_verification',
        buyer_relevance: 'decision_owner',
        route_confidence: Math.max(0.35, Math.min(0.62, buyer.confidence || 0.45)),
        verification_needed: `Confirm ${buyer.name} is still the right owner and check for warm intro paths.`,
      }],
      target_person: buyer.name,
      target_role: buyer.title,
      recommended_route: 'cold_verification',
      buyer_relevance: 'decision_owner',
      verification_needed: `Confirm ${buyer.name} is still the right owner and check for warm intro paths.`,
      validation_state: 'provisional',
      confidence: Math.max(0.35, Math.min(0.62, buyer.confidence || 0.45)),
      sources: [],
    };
  }

  if (questionId === 'q13_capability_gap') {
    if (!signal) {
      return _buildInsufficientSynthesis(question, 'Need at least one validated launch, digital, procurement, news, or hiring signal before gap synthesis.');
    }
    const service = _inferYellowPantherService(signal.answer, '');
    const topGap = service === 'DIGITAL_TRANSFORMATION'
      ? 'digital product/platform delivery'
      : service.toLowerCase().replace(/_/g, ' ');
    return {
      question: question.question_text,
      answer: topGap,
      summary: `${topGap} is inferred from ${signal.question_id}: ${signal.answer}`,
      top_gap: topGap,
      gap_label: topGap,
      evidence_basis: [signal.question_id],
      validation_state: 'provisional',
      confidence: Math.max(0.45, Math.min(0.72, signal.confidence - 0.12 || 0.45)),
      sources: signal.evidence_url ? [signal.evidence_url] : [],
    };
  }

  if (questionId === 'q14_yp_fit') {
    const evidenceText = _firstMeaningfulCommercialText([signal?.answer, capabilityGapText]);
    if (!evidenceText) {
      return {
        ..._buildInsufficientSynthesis(question, 'Need at least one validated commercial trigger before fit can be recommended.'),
        best_service: '',
        service_fit: [],
        fit_rationale: 'insufficient_signal',
        buyer_context: buyer.name || null,
        evidence_basis: [],
      };
    }
    const bestService = _inferYellowPantherService(signal?.answer || '', capabilityGapText);
    return {
      question: question.question_text,
      answer: bestService,
      summary: `${bestService.replace(/_/g, ' ')} is the strongest capability match because current dossier evidence points to ${evidenceText.toLowerCase()}.`,
      best_service: bestService,
      service_fit: [bestService],
      fit_rationale: `${bestService.replace(/_/g, ' ')} is the strongest capability match because current dossier evidence points to ${evidenceText.toLowerCase()}.`,
      buyer_context: [buyer.name, buyer.title].filter(Boolean).join(', ') || null,
      evidence_basis: [signal?.question_id, signal?.answer, capabilityGapText].filter(Boolean),
      confidence_caveat: buyer.name
        ? `Verify recency and confirm ${buyer.name} is still the right route before outreach.`
        : 'Verify the current buyer route before outreach.',
      validation_state: 'provisional',
      confidence: Math.max(0.5, Math.min(0.76, signal?.confidence ? signal.confidence - 0.1 : 0.55)),
      sources: signal?.evidence_url ? [signal.evidence_url] : [],
      status: 'available',
    };
  }

  if (questionId === 'q15_outreach_strategy') {
    const q14Raw = _getAnswerRaw(priorById.get('q14_yp_fit') || {});
    const bestService = _firstMeaningfulCommercialText([q14Raw.best_service, q14Raw.recommended_service]);
    const fitRationale = _firstMeaningfulCommercialText([q14Raw.fit_rationale, q14Raw.summary]);
    const hasEvidence = [signal?.answer, fitRationale].some((value) => _isMeaningfulCommercialText(value));
    if (!buyer.name && !hasEvidence) {
      return {
        ..._buildInsufficientSynthesis(question, 'Need a clearer buyer hypothesis before outreach.'),
        recommended_target: null,
        recommended_route: null,
        recommended_angle: '',
        first_message_strategy: '',
        verification_needed: 'Need a clearer buyer hypothesis before outreach.',
        why_now: '',
      };
    }
    const route = connections.pathType || (connections.owner ? 'warm_intro' : 'cold_verification');
    const angle = _firstMeaningfulCommercialText([
      signal?.answer,
      fitRationale,
      `Lead with a ${bestService ? bestService.replace(/_/g, ' ').toLowerCase() : 'current commercial trigger'} angle tied to the active signal.`,
    ]);
    return {
      question: question.question_text,
      answer: angle,
      summary: `${buyer.name || 'Verify the buyer'} via ${route}: ${angle}`,
      recommended_target: buyer.name || connections.targetPerson || null,
      recommended_route: route,
      recommended_angle: angle,
      first_message_strategy: buyer.name
        ? `Open with the fresh trigger, connect it to ${bestService ? bestService.replace(/_/g, ' ').toLowerCase() : 'Yellow Panther capability'}, and ask for a short discovery call with ${buyer.name}.`
        : 'Open with the fresh trigger, explain the relevant Yellow Panther capability, and verify the right owner before deeper outreach.',
      verification_needed: connections.owner
        ? `Confirm ${connections.owner} is still the best intro route and validate signal recency.`
        : 'Validate signal recency and confirm the right buyer route before outreach.',
      why_now: signal?.answer || angle,
      validation_state: 'provisional',
      confidence: Math.max(0.48, Math.min(0.74, signal?.confidence ? signal.confidence - 0.14 : 0.52)),
      sources: signal?.evidence_url ? [signal.evidence_url] : [],
      status: 'available',
    };
  }

  return null;
}

function _inferEvidenceGrade(question, structuredOutput, validationState, structuredSignal) {
  if (!_isCommercialSignalQuestion(question)) return null;
  const sourceCount = _collectUniqueSourceUrls(structuredOutput).length;
  const namedSignalCount = _countStructuredSignalItems(question?.question_id, structuredSignal);
  const answerText = String(structuredOutput?.answer || '').trim();
  const explicit = String(structuredOutput?.evidence_grade || '').trim().toLowerCase();
  let inferred = null;
  if (sourceCount >= 3 && namedSignalCount >= 2.75) inferred = 'strong';
  else if (sourceCount >= 2 && namedSignalCount >= 1) inferred = 'moderate';
  else if (sourceCount >= 1 || (validationState !== 'no_signal' && answerText)) inferred = 'weak';
  else inferred = null;

  if (!VALID_EVIDENCE_GRADES.has(explicit)) return inferred;
  if (explicit === 'strong' && inferred !== 'strong') return inferred || 'weak';
  if (explicit === 'moderate' && inferred === 'weak') return 'weak';
  return explicit;
}

function _capConfidenceByEvidenceGrade(confidence, evidenceGrade) {
  const capped = _clampNumber(confidence);
  if (evidenceGrade === 'weak') return Math.min(capped, 0.65);
  if (evidenceGrade === 'moderate') return Math.min(capped, 0.82);
  if (evidenceGrade === 'strong') return Math.min(capped, 0.97);
  return capped;
}

function _inferProcurementModel(structuredOutput, structuredSignal, validationState) {
  const explicit = String(structuredOutput?.procurement_model || '').trim();
  if (VALID_PROCUREMENT_MODELS.has(explicit)) return explicit;
  const haystack = [
    structuredOutput?.answer,
    structuredOutput?.context,
    structuredOutput?.notes,
    JSON.stringify(structuredSignal || {}),
  ].join(' ').toLowerCase();
  if (/agency/.test(haystack)) return 'agency_led';
  if (/partner|partnership|provider|platform|vendor|rights|sportsbook|kambi|migration/.test(haystack)) return 'partner_led';
  if (/direct procurement|direct vendor|private procurement/.test(haystack)) return 'private_direct';
  return validationState === 'no_signal' ? 'unknown' : null;
}

function _inferCommercialImplication(question, structuredOutput, structuredSignal, procurementModel) {
  const explicit = String(structuredOutput?.commercial_implication || '').trim();
  if (explicit) return explicit;
  const answer = String(structuredOutput?.answer || '').trim();
  const questionId = String(question?.question_id || '').trim();
  if (questionId === 'q7_procurement_signal') {
    const buckets = ['vendor_changes', 'platform_migrations', 'partnerships', 'org_changes']
      .filter((key) => Array.isArray(structuredSignal?.[key]) && structuredSignal[key].length > 0);
    if (buckets.length > 0) {
      return `Named ${buckets.join(', ')} signals suggest active third-party evaluation and ecosystem reshaping.`;
    }
    if (answer) {
      return 'Commercial ecosystem signals suggest active partner or platform evaluation, but named evidence remains thin.';
    }
  }
  if (questionId === 'q8_explicit_rfp' && procurementModel && procurementModel !== 'unknown') {
    return `No public tender was found, but the surrounding evidence suggests a ${procurementModel.replace('_', ' ')} procurement motion.`;
  }
  if (questionId === 'q10_hiring_signal' && answer) {
    return 'Observed hiring patterns suggest where the organisation is actively investing capability and budget.';
  }
  if (questionId === 'q11_decision_owner' && answer) {
    return 'A named commercial owner provides a plausible first outreach route for Yellow Panther.';
  }
  if ((questionId === 'q6_launch_signal' || questionId === 'q9_news_signal') && answer) {
    return 'Recent launches and strategic announcements indicate current commercial priorities and timing windows.';
  }
  return answer ? String(structuredOutput?.context || '').trim() || null : null;
}

function _computeSignalDensity(questionId, validationState, sourceCount, namedSignalCount) {
  if (questionId === 'q7_procurement_signal') {
    const sourceScore = Math.min(sourceCount, 4) * 0.09;
    const namedSignalScore = Math.min(namedSignalCount, 4) * 0.07;
    return _clampNumber(sourceScore + namedSignalScore);
  }
  const validationBonus = validationState === 'validated' ? 0.18 : validationState === 'provisional' ? 0.1 : 0;
  const sourceScore = Math.min(sourceCount, 4) * 0.11;
  const namedSignalScore = Math.min(namedSignalCount, 4) * 0.09;
  return _clampNumber(validationBonus + sourceScore + namedSignalScore);
}

function _capCommercialValidationState(question, validationState, commercialFields, confidence) {
  const questionId = String(question?.question_id || '');
  if (questionId === 'q10_hiring_signal') {
    const normalizedState = String(validationState || '').trim().toLowerCase();
    if (normalizedState !== 'validated' && normalizedState !== 'confirmed') {
      return validationState;
    }
    const evidenceGrade = commercialFields?.evidence_grade;
    if (evidenceGrade === 'weak') {
      return 'provisional';
    }
    return validationState;
  }

  if (questionId !== 'q7_procurement_signal') {
    return validationState;
  }
  const normalizedState = String(validationState || '').trim().toLowerCase();
  if (!['validated', 'confirmed', 'provisional'].includes(normalizedState)) {
    return validationState;
  }
  const structuredSignal = commercialFields?.structured_signal;
  const namedSignalCount = _countStructuredSignalItems(question?.question_id, structuredSignal);
  const evidenceGrade = commercialFields?.evidence_grade;
  if (normalizedState === 'provisional') {
    return validationState;
  }
  if (namedSignalCount >= 2 && evidenceGrade === 'strong' && Number(confidence || 0) > 0.82) {
    return normalizedState === 'confirmed' ? 'confirmed' : 'validated';
  }
  return 'provisional';
}

function _augmentCommercialStructuredOutput(question, structuredOutput, validationState) {
  if (!_isCommercialSignalQuestion(question)) {
    return {
      structuredOutput,
      commercialFields: {
        evidence_grade: null,
        structured_signal: null,
        procurement_model: null,
        commercial_implication: null,
        signal_density: null,
      },
      confidence: _clampNumber(structuredOutput?.confidence ?? 0),
    };
  }

  const sourceUrls = _collectUniqueSourceUrls(structuredOutput);
  const fallbackUrl = sourceUrls[0] || '';
  const structuredSignal = question?.question_id === 'q7_procurement_signal'
    ? _normalizeQ7StructuredSignal(structuredOutput, fallbackUrl)
    : (structuredOutput?.structured_signal && typeof structuredOutput.structured_signal === 'object'
      ? structuredOutput.structured_signal
      : null);
  const namedSignalCount = _countStructuredSignalItems(question?.question_id, structuredSignal);
  const evidenceGrade = _inferEvidenceGrade(question, structuredOutput, validationState, structuredSignal);
  const procurementModel = question?.question_id === 'q8_explicit_rfp'
    ? _inferProcurementModel(structuredOutput, structuredSignal, validationState)
    : null;
  const commercialImplication = _inferCommercialImplication(question, structuredOutput, structuredSignal, procurementModel);
  const signalDensity = _computeSignalDensity(question?.question_id, validationState, sourceUrls.length, namedSignalCount);
  const confidence = validationState === 'no_signal'
    ? 0
    : _capConfidenceByEvidenceGrade(structuredOutput?.confidence ?? 0, evidenceGrade);
  return {
    structuredOutput: {
      ...structuredOutput,
      confidence,
      evidence_grade: evidenceGrade ?? null,
      structured_signal: structuredSignal,
      procurement_model: procurementModel,
      commercial_implication: commercialImplication,
      signal_density: signalDensity,
    },
    commercialFields: {
      evidence_grade: evidenceGrade ?? null,
      structured_signal: structuredSignal,
      procurement_model: procurementModel,
      commercial_implication: commercialImplication,
      signal_density: signalDensity,
    },
    confidence,
  };
}

function _normalizeDisplayEvidenceItem(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    const url = item.trim();
    return url ? { url, label: '' } : null;
  }
  if (typeof item !== 'object') return null;
  const url = String(item.url || item.evidence_url || item.href || '').trim();
  const label = String(item.label || item.title || item.source || item.evidence_kind || '').trim();
  const snippet = String(item.snippet || item.summary || item.evidence_basis || '').trim();
  if (!url && !label && !snippet) return null;
  return {
    ...(url ? { url } : {}),
    ...(label ? { label } : {}),
    ...(snippet ? { snippet } : {}),
  };
}

function _buildDisplayAnswer(question, structuredOutput, validationState, commercialFields, evidenceUrl) {
  const existing = structuredOutput?.display_answer && typeof structuredOutput.display_answer === 'object'
    ? structuredOutput.display_answer
    : {};
  const headline = _firstMeaningfulCommercialText([
    existing.headline,
    structuredOutput?.summary,
    structuredOutput?.answer,
    structuredOutput?.context,
  ]) || (validationState === 'failed'
    ? 'Provider output could not be converted into a source-backed answer.'
    : validationState === 'no_signal'
      ? 'No source-backed signal found.'
      : '');
  const bullets = Array.isArray(existing.bullets)
    ? existing.bullets.map(_toDisplayText).filter(Boolean).slice(0, 4)
    : [structuredOutput?.notes, structuredOutput?.confidence_caveat]
      .map(_toDisplayText)
      .filter(Boolean)
      .slice(0, 4);
  const sourceEvidence = [
    ...(Array.isArray(existing.evidence) ? existing.evidence : []),
    ...(Array.isArray(structuredOutput?.sources) ? structuredOutput.sources : []),
    evidenceUrl,
  ]
    .map(_normalizeDisplayEvidenceItem)
    .filter(Boolean);
  const evidence = sourceEvidence.filter((item, index, allItems) => {
    const key = item.url || item.label || item.snippet || '';
    return key && allItems.findIndex((other) => (other.url || other.label || other.snippet || '') === key) === index;
  }).slice(0, 4);
  return {
    headline,
    bullets,
    evidence,
    commercial_implication: _toDisplayText(existing.commercial_implication || commercialFields?.commercial_implication || structuredOutput?.commercial_implication),
    verification_needed: _toDisplayText(existing.verification_needed || structuredOutput?.verification_needed || structuredOutput?.confidence_caveat),
    status_label: _toDisplayText(existing.status_label || structuredOutput?.status || validationState || 'no_signal'),
  };
}

function _hasPlausibleDecisionOwnerStructuredOutput(structuredOutput) {
  const primaryOwner = structuredOutput?.primary_owner && typeof structuredOutput.primary_owner === 'object'
    ? structuredOutput.primary_owner
    : {};
  const structuredSignal = structuredOutput?.structured_signal && typeof structuredOutput.structured_signal === 'object'
    ? structuredOutput.structured_signal
    : {};
  const candidateNames = []
    .concat(primaryOwner.name)
    .concat(structuredSignal.decision_owner_name)
    .concat(structuredSignal.name)
    .concat(Array.isArray(structuredOutput?.supporting_candidates) ? structuredOutput.supporting_candidates.map((item) => item?.name || item?.full_name || item?.person_name) : [])
    .concat(Array.isArray(structuredOutput?.candidates) ? structuredOutput.candidates.map((item) => item?.name || item?.full_name || item?.person_name) : []);
  return Boolean(_firstConciseBuyerTargetText(candidateNames));
}

function _hasPlausibleLeadershipStructuredOutput(structuredOutput) {
  if (!structuredOutput || typeof structuredOutput !== 'object') return false;
  const candidateFields = _leadershipStructuredCandidates(structuredOutput);
  if (candidateFields.some((candidate) => Boolean(_normalizeLeadershipCandidate(candidate)))) {
    return true;
  }
  return _leadershipCandidatesFromText(structuredOutput.answer).length > 0
    || _leadershipCandidatesFromText(structuredOutput.context).length > 0
    || _leadershipCandidatesFromText(structuredOutput.summary).length > 0;
}

function _isExplicitNoSignalOutput(structuredOutput) {
  const haystack = [
    structuredOutput?.validation_state,
    structuredOutput?.status,
    structuredOutput?.answer,
    structuredOutput?.summary,
    structuredOutput?.context,
  ].map((value) => _toDisplayText(value).toLowerCase()).join(' ');
  return /\b(no_signal|no signal|insufficient_signal|insufficient signal|no_answer|no answer)\b/.test(haystack);
}

function _hasPositiveAnswerIntent(structuredOutput) {
  if (!structuredOutput || typeof structuredOutput !== 'object') return false;
  if (_isExplicitNoSignalOutput(structuredOutput)) return false;
  const confidence = Number(structuredOutput.confidence || 0);
  return confidence > 0
    || _isMeaningfulCommercialText(structuredOutput.answer)
    || _isMeaningfulCommercialText(structuredOutput.summary)
    || _collectUniqueSourceUrls(structuredOutput).length > 0;
}

function _hasStructuredAnswerContent(structuredOutput) {
  if (!structuredOutput || typeof structuredOutput !== 'object') return false;
  const sourceUrls = _collectUniqueSourceUrls(structuredOutput);
  if (sourceUrls.length > 0) return true;
  if (_hasPlausibleDecisionOwnerStructuredOutput(structuredOutput)) return true;
  const listFields = [
    structuredOutput.candidates,
    structuredOutput.supporting_candidates,
    structuredOutput.people,
    structuredOutput.leadership,
    structuredOutput.ranked_people,
    structuredOutput.top_signals,
    structuredOutput.signals,
    structuredOutput.technologies,
  ];
  if (listFields.some((items) => Array.isArray(items) && items.length > 0)) return true;
  return [
    structuredOutput.summary,
    structuredOutput.context,
    structuredOutput.notes,
    structuredOutput.commercial_implication,
  ].some((value) => _isMeaningfulCommercialText(value));
}

function _providerNoAnswerStructuredOutput(question, structuredOutput, reason) {
  return {
    ...structuredOutput,
    answer: 'Provider returned an object answer without source-backed content.',
    summary: 'Provider returned an object answer without source-backed content.',
    context: 'The provider response could not be converted into a useful typed answer.',
    sources: [],
    confidence: 0,
    validation_state: 'failed',
    structured_signal: {
      status: 'provider_no_answer',
      provider_no_answer_reason: reason,
      question_id: question?.question_id || '',
    },
  };
}

function _buildDeterministicPrefetchFallback(question, prefetchEvidence, reason = 'provider_no_answer') {
  const questionId = String(question?.question_id || '').trim();
  if (!['q2_digital_stack', 'q3_leadership', 'q6_launch_signal', 'q9_news_signal'].includes(questionId)) return null;
  const leads = Array.isArray(prefetchEvidence?.leads) ? prefetchEvidence.leads : [];
  if (leads.length === 0) return null;
  const lead = leads[0] || {};
  const sources = leads.map((item) => String(item?.url || '').trim()).filter(Boolean);
  if (sources.length === 0) return null;
  const checkedSources = Array.isArray(prefetchEvidence?.checked_sources) ? prefetchEvidence.checked_sources : [];
  const evidenceText = _leadText(lead);
  const base = {
    context: prefetchEvidence?.retrieval_summary || 'Deterministic preflight found source-backed evidence, but provider synthesis returned no usable typed answer.',
    sources,
    checked_sources: checkedSources,
    confidence: questionId === 'q2_digital_stack' ? 0.65 : 0.7,
    prompt_trace: {
      provider_no_answer_reason: reason,
      deterministic_prefetch_fallback: true,
    },
  };
  if (questionId === 'q2_digital_stack') {
    return {
      ...base,
      answer: `Source-backed digital footprint hints found: ${evidenceText}`,
      summary: `Digital footprint hints found from ${lead.source_type || 'source-backed'} evidence.`,
      validation_state: 'partial_signal',
      structured_signal: {
        status: 'deterministic_prefetch_fallback',
        question_id: questionId,
        signal_type: 'digital_footprint_hint',
        source_type: lead.source_type || null,
        evidence_url: lead.url || null,
        acceptance_reason: lead.acceptance_reason || null,
      },
      commercial_implication: 'Potential digital/platform opportunity requires human verification from the accepted source evidence.',
    };
  }
  if (questionId === 'q3_leadership') {
    const candidate = leads
      .flatMap((candidateLead) => {
        const candidateTexts = [
          candidateLead?.snippet,
          candidateLead?.excerpt,
          candidateLead?.title,
          _leadText(candidateLead),
        ];
        return candidateTexts
          .flatMap((value) => _leadershipCandidatesFromText(value))
          .map((item) => _normalizeLeadershipCandidate({ ...item, evidence_url: candidateLead?.url }))
          .filter(Boolean)
          .map((item) => ({
            ...item,
            source_type: candidateLead?.source_type || null,
            acceptance_reason: candidateLead?.acceptance_reason || null,
            lead_url: candidateLead?.url || null,
          }));
      })
      .sort((left, right) => right.score - left.score)[0];
    if (!candidate) return null;
    const primaryOwner = {
      name: candidate.name,
      title: candidate.title,
      function: candidate.function || 'commercial',
      evidence_url: candidate.evidence_url || candidate.lead_url || lead.url || null,
      buyer_relevance: 'provisional_buyer_role_candidate',
      confidence: 0.68,
    };
    return {
      ...base,
      answer: `${primaryOwner.name}${primaryOwner.title ? ` (${primaryOwner.title})` : ''} is a provisional buyer-role candidate from accepted preflight evidence.`,
      summary: `${primaryOwner.name}${primaryOwner.title ? ` (${primaryOwner.title})` : ''} is a provisional buyer-role candidate from accepted preflight evidence.`,
      validation_state: 'provisional',
      primary_owner: primaryOwner,
      candidates: [primaryOwner],
      supporting_candidates: [],
      structured_signal: {
        status: 'deterministic_prefetch_fallback',
        question_id: questionId,
        signal_type: 'leadership_candidate',
        source_type: candidate.source_type || lead.source_type || null,
        evidence_url: candidate.lead_url || lead.url || null,
        acceptance_reason: candidate.acceptance_reason || lead.acceptance_reason || null,
      },
      commercial_implication: 'Potential buyer route requires human verification because provider synthesis returned no usable typed answer.',
    };
  }
  const signalType = questionId === 'q6_launch_signal' ? 'launch_signal' : 'news_signal';
  return {
    ...base,
    answer: `Source-backed ${signalType.replace('_', ' ')} found: ${evidenceText}`,
    summary: `${questionId === 'q6_launch_signal' ? 'Launch/platform' : 'Commercial news'} trigger found from accepted preflight evidence.`,
    validation_state: 'provisional',
    structured_signal: {
      status: 'deterministic_prefetch_fallback',
      question_id: questionId,
      trigger_type: signalType,
      source_type: lead.source_type || null,
      source: lead.url || null,
      evidence_url: lead.url || null,
      acceptance_reason: lead.acceptance_reason || null,
    },
    commercial_implication: 'Potential timing/commercial trigger requires verification because provider synthesis returned no usable typed answer.',
  };
}

function _requiresSourceBackedPositiveClaim(question) {
  return SOURCE_REQUIRED_QUESTION_IDS.has(String(question?.question_id || '').trim());
}

function _hasSourceBackedEvidence(structuredOutput) {
  return _collectUniqueSourceUrls(structuredOutput).length > 0;
}

function _hasCheckedNoSignalRationale(structuredOutput) {
  if (!structuredOutput || typeof structuredOutput !== 'object') return false;
  if (_isExplicitNoSignalOutput(structuredOutput)) return true;
  const checkedSources = structuredOutput.checked_sources;
  if (Array.isArray(checkedSources) && checkedSources.length > 0) return true;
  return _isMeaningfulCommercialText(structuredOutput.checked_source_rationale)
    || _isMeaningfulCommercialText(structuredOutput.checked_absence_rationale);
}

function _sanitizeProviderStructuredOutput(question, structuredOutput, cliResult = null) {
  if (!structuredOutput || typeof structuredOutput !== 'object') return structuredOutput;
  const questionId = String(question?.question_id || '').trim();
  if (QUESTION_OUTPUT_CONTRACTS[questionId] && Object.keys(structuredOutput).length === 0) {
    if (cliResult && Number(cliResult.code ?? 0) !== 0) return structuredOutput;
    if (question?.empty_result_policy === 'no_signal' || ['q8_explicit_rfp', 'q10_hiring_signal'].includes(questionId)) return structuredOutput;
    return _providerNoAnswerStructuredOutput(question, structuredOutput, 'empty_object_answer');
  }
  if (questionId === 'q3_leadership') {
    structuredOutput = _promoteQ3LeadershipStructuredOutput(structuredOutput);
  }
  if (questionId === 'q3_leadership' && _hasPositiveAnswerIntent(structuredOutput) && !_hasPlausibleLeadershipStructuredOutput(structuredOutput)) {
    return _providerNoAnswerStructuredOutput(question, structuredOutput, 'generic_fact_without_leadership_candidate');
  }
  if (_requiresSourceBackedPositiveClaim(question) && _hasPositiveAnswerIntent(structuredOutput) && !_hasSourceBackedEvidence(structuredOutput) && !_hasCheckedNoSignalRationale(structuredOutput)) {
    return _providerNoAnswerStructuredOutput(question, structuredOutput, 'source_less_positive_claim');
  }
  if (_isObjectStringPlaceholder(structuredOutput.answer) && !_hasStructuredAnswerContent(structuredOutput)) {
    return _providerNoAnswerStructuredOutput(question, structuredOutput, 'object_string_without_sources');
  }
  if (!structuredOutput.answer || typeof structuredOutput.answer !== 'object' || Array.isArray(structuredOutput.answer)) {
    return structuredOutput;
  }
  if (_hasStructuredAnswerContent(structuredOutput)) return structuredOutput;
  return _providerNoAnswerStructuredOutput(question, structuredOutput, 'object_answer_without_sources');
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
    : Math.max(1, Number(question.evidence_extension_budget || question.hop_budget || 0));
  const revisit = Number.isFinite(_coerceOverrideNumber(overrides, 'revisitCredits', 'revisit'))
    ? _coerceOverrideNumber(overrides, 'revisitCredits', 'revisit')
    : Math.max(1, Number(question.evidence_extension_budget || Math.ceil(Number(question.hop_budget || 0) / 2)));
  return {
    search,
    scrape,
    revisit,
  };
}

function _buildQuestionAliases(question) {
  const aliases = new Set([question.entity_name, question.entity_id, question.question_text]);
  if (question.question_type === 'procurement') {
    aliases.add('ACE');
    aliases.add('Major League Cricket');
  }
  if (question.question_type === 'foundation') {
    aliases.add('MLC');
  }
  return [...aliases].filter(Boolean);
}

function _isTerminalQuestionState(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return ['validated', 'provisional', 'no_signal', 'blocked', 'failed', 'exhausted', 'tool_call_missing', 'cli_error', 'parse_error', 'timeout'].includes(normalized)
    || normalized.endsWith('_tool_call_missing');
}

function _buildRunStateFromQuestionFirstCheckpoint(questions, checkpoint, { preset, timestamp }) {
  const runState = buildPresetRunState(questions, { preset, runId: 'checkpoint', timestamp });
  const answerRecords = Array.isArray(checkpoint?.answer_records) ? checkpoint.answer_records : [];
  const terminalStates = checkpoint?.terminal_states && typeof checkpoint.terminal_states === 'object'
    ? checkpoint.terminal_states
    : {};
  const answerByQuestion = new Map();
  for (const answer of answerRecords) {
    if (!answer || typeof answer !== 'object') continue;
    const questionId = String(answer.question_id || '').trim();
    if (questionId) answerByQuestion.set(questionId, answer);
  }
  runState.questions = runState.questions.map((questionState, index) => {
    const question = questions[index] || {};
    const questionId = String(question.question_id || questionState.question_id || '').trim();
    const answer = answerByQuestion.get(questionId);
    const terminalState = String(terminalStates[questionId] || answer?.validation_state || answer?.status || '').trim();
    if (!answer && !_isTerminalQuestionState(terminalState)) {
      return questionState;
    }
    const answerText = _toDisplayText(answer?.answer) || _toDisplayText(answer?.summary) || _toDisplayText(answer?.value);
    const evidenceUrl = String(answer?.evidence_url || (Array.isArray(answer?.sources) ? answer.sources[0] : '') || '').trim();
    return {
      ...questionState,
      status: _isTerminalQuestionState(terminalState) ? terminalState : 'provisional',
      current_confidence: Number(answer?.confidence || 0),
      best_answer: answerText,
      best_evidence_url: evidenceUrl,
      accepted_links: Array.isArray(answer?.sources)
        ? answer.sources.filter(Boolean).map((url) => ({ url, source_kind: _sourceKindFromUrl(url), score: 1, decision: 'accept' }))
        : questionState.accepted_links,
      notes: answer?.notes || answer?.context || answer?.commercial_interpretation?.summary || questionState.notes || '',
      prompt_trace: answer?.prompt_trace || questionState.prompt_trace || null,
      message_trace: answer?.message_trace || questionState.message_trace || [],
      last_completed_at: checkpoint?.updated_at || timestamp,
    };
  });
  runState.question_first_checkpoint = checkpoint;
  return runState;
}

function _countTerminalQuestionStates(runState) {
  if (!runState || !Array.isArray(runState.questions)) return 0;
  return runState.questions.filter((questionState) => _isTerminalQuestionState(questionState?.status)).length;
}

function _selectResumeRunState(localState, checkpointState) {
  if (!localState || typeof localState !== 'object') return checkpointState;
  if (!checkpointState || typeof checkpointState !== 'object') return localState;
  return _countTerminalQuestionStates(checkpointState) > _countTerminalQuestionStates(localState)
    ? checkpointState
    : localState;
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
  const confidenceScore = Number(confidence || 0);
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

function _normalizeConfidenceThreshold(question, overrides = {}) {
  const threshold = Number(overrides.confidenceThreshold);
  if (Number.isFinite(threshold) && threshold >= 0 && threshold <= 1) {
    return threshold;
  }
  const questionThreshold = Number(question?.evidence_extension_confidence_threshold);
  if (Number.isFinite(questionThreshold) && questionThreshold >= 0 && questionThreshold <= 1) {
    return questionThreshold;
  }
  return question.question_type === 'procurement' ? 0.85 : 0.8;
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
    question_family: question.question_family,
    question_type: question.question_type,
    question_text: question.question_text,
    seed_query: question.query,
    aliases: _buildQuestionAliases(question),
    source_priority: question.source_priority,
    hop_budget: question.hop_budget,
    evidence_extension_budget: question.evidence_extension_budget,
    structured_output_schema: question.structured_output_schema,
    execution_class: question.execution_class,
    rollout_phase: question.rollout_phase,
    search_strategy: question.search_strategy,
    graph_write_targets: question.graph_write_targets,
    depends_on: question.depends_on,
    conditional_on: question.conditional_on,
    current_section_id: question.current_section_id,
    current_section_label: question.current_section_label,
    current_section_index: question.current_section_index,
    current_section_total: question.current_section_total,
    current_question_index: question.current_question_index,
    current_question_total: question.current_question_total,
    current_strategy_label: question.current_strategy_label,
    current_source_order: question.current_source_order,
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

export function resolveExecutionQueryForQuestionPayload(question, existingQuestionState = {}) {
  if (
    existingQuestionState?.question_id &&
    question?.question_id &&
    existingQuestionState.question_id !== question.question_id
  ) {
    return question?.query || '';
  }
  return existingQuestionState?.last_executed_query || question?.query || '';
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
    status: _isTerminalQuestionState(questionPayload.validation_state) ? questionPayload.validation_state : 'running',
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

function _buildTrackerFilePath(outputDir, preset, entitySlug = 'major-league-cricket') {
  return path.join(outputDir, `${_slugify(entitySlug)}_${_slugify(preset)}_tracker.json`);
}

function _buildQuestionTracker({
  runStartedAt,
  preset,
  entityName,
  entityId,
  entityType,
  questionSourcePath = null,
  questions = [],
}) {
  return {
    schema_version: 'question_first_run_tracker_v1',
    run_started_at: runStartedAt,
    updated_at: runStartedAt,
    status: 'running',
    preset,
    entity: {
      entity_name: entityName,
      entity_id: entityId,
      entity_type: entityType,
    },
    question_source_path: questionSourcePath,
    total_questions: Array.isArray(questions) ? questions.length : 0,
    current_question_index: 0,
    current_question_id: null,
    questions: Array.isArray(questions)
      ? questions.map((question, index) => ({
          question_index: index + 1,
          question_id: question.question_id,
          question_type: question.question_type,
          question_text: question.question_text,
          query: question.query,
          status: 'queued',
          started_at: null,
          completed_at: null,
          validation_state: null,
          confidence: null,
          answer_excerpt: null,
          notes: null,
          error: null,
        }))
      : [],
    events: [
      {
        timestamp: runStartedAt,
        type: 'run_started',
        status: 'running',
      },
    ],
  };
}

function _appendTrackerEvent(tracker, event) {
  const timestamp = event.timestamp || new Date().toISOString();
  tracker.updated_at = timestamp;
  tracker.events = Array.isArray(tracker.events) ? tracker.events : [];
  tracker.events.push({
    timestamp,
    ...event,
  });
}

function _updateTrackerQuestion(tracker, questionIndex, patch) {
  if (!tracker || !Array.isArray(tracker.questions) || !tracker.questions[questionIndex]) {
    return tracker;
  }
  tracker.questions[questionIndex] = {
    ...tracker.questions[questionIndex],
    ...patch,
  };
  return tracker;
}

async function _writeTrackerFile(trackerPath, tracker) {
  await _writeJsonFile(trackerPath, tracker);
}

const FASTMCP_HEALTH_URL = 'http://127.0.0.1:8014/health';
const FASTMCP_MCP_URL = 'http://127.0.0.1:8014/mcp/';

export async function ensureBrightDataFastMcpService({
  fetchImpl = globalThis.fetch,
  spawnImpl = spawn,
  serviceUrl = FASTMCP_MCP_URL,
  healthUrl = FASTMCP_HEALTH_URL,
  serviceCommand = ['python3', 'apps/signal-noise-app/scripts/start_brightdata_fastmcp_service.py'],
  serviceCwd = WORKTREE_ROOT,
  serviceEnv = process.env,
  startupTimeoutMs = 10000,
  pollIntervalMs = 250,
} = {}) {
  const probeHealth = async () => {
    try {
      const res = await fetchImpl(healthUrl, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  };

  if (await probeHealth()) {
    return { started: false, healthy: true, serviceUrl, healthUrl };
  }

  const child = spawnImpl(serviceCommand[0], serviceCommand.slice(1), {
    cwd: serviceCwd,
    env: {
      ...serviceEnv,
      BRIGHTDATA_FASTMCP_URL: serviceUrl,
      BRIGHTDATA_FASTMCP_HOST: serviceEnv.BRIGHTDATA_FASTMCP_HOST || '127.0.0.1',
      BRIGHTDATA_FASTMCP_PORT: serviceEnv.BRIGHTDATA_FASTMCP_PORT || '8014',
      BRIGHTDATA_MCP_USE_HOSTED: 'false',
      BRIGHTDATA_MCP_HOSTED_URL: '',
    },
    detached: true,
    stdio: 'ignore',
  });
  child.unref?.();

  const deadline = Date.now() + Math.max(0, Number(startupTimeoutMs || 0));
  while (Date.now() < deadline) {
    if (await probeHealth()) {
      return { started: true, healthy: true, serviceUrl, healthUrl };
    }
    await new Promise((resolve) => setTimeout(resolve, Math.max(1, Number(pollIntervalMs || 0))));
  }

  return { started: true, healthy: false, serviceUrl, healthUrl };
}

export async function buildOpenCodeConfig({
  worktreeRoot = WORKTREE_ROOT,
  baseUrl,
} = {}) {
  const resolvedEnv = _resolveOpenCodeEnv();
  const mcpConfig = {
    brightData: {
      type: 'remote',
      url: FASTMCP_MCP_URL,
      enabled: true,
      timeout: 15000,
    },
  };
  const defaultModel = _modelRef(_normalizeZaiModelId(process.env.QF_MODEL_DEFAULT, FALLBACK_PREFETCH_MODEL_ID));
  const models = Object.fromEntries(
    Object.entries(ZAI_MODEL_CATALOG).map(([modelId, model]) => [
      modelId,
      {
        id: model.id,
        name: model.name,
        limit: {
          context: model.context,
          output: model.output,
        },
      },
    ]),
  );

  return {
    $schema: 'https://opencode.ai/config.json',
    model: defaultModel,
    provider: {
      [DEFAULT_PROVIDER_ID]: {
        npm: '@ai-sdk/anthropic',
        name: 'Z.AI Coding Plan',
        options: {
          baseURL: baseUrl || 'https://api.z.ai/api/anthropic/v1',
          apiKey: '{env:ZAI_API_KEY}',
        },
        models,
      },
    },
    permission: {
      '*': 'allow',
      bash: 'deny',
      edit: 'deny',
    },
    tools: {
      'brightData*': false,
      'brightdata*': false,
    },
    agent: {
      build: {
        tools: {
          'brightData*': true,
          'brightdata*': true,
        },
      },
      discovery: {
        name: 'discovery',
        description: 'Bounded procurement discovery agent for Yellow Panther',
        mode: 'primary',
        model: defaultModel,
        steps: 4,
        prompt:
          'You are a procurement discovery agent. Use the brightdata tool to search broadly, inspect evidence carefully, and return only validated JSON.',
        tools: {
          'brightData*': true,
          'brightdata*': true,
        },
        permission: {
          '*': 'allow',
          bash: 'deny',
          edit: 'deny',
        },
      },
    },
    mcp: mcpConfig,
    instructions: [
      'Use the BrightData FastMCP service at the configured MCP URL for search and scrape operations.',
      'Return validated JSON only.',
      'Keep the agentic loop bounded.',
    ],
  };
}

export function buildOpenCodeQuestionPrompt(question, { standaloneHarness = false } = {}) {
  const isDerivedSynthesis = _isDerivedSynthesisQuestion(question);
  const sourceOrder = Array.isArray(question?.source_priority) && question.source_priority.length > 0
    ? question.source_priority
    : (Array.isArray(question?.current_source_order) && question.current_source_order.length > 0
      ? question.current_source_order
      : []);
  const promptLines = isDerivedSynthesis ? [
    'Use prior dossier evidence to answer one derived synthesis question.',
    'Do not search the web, browse, or inspect local files.',
    'Do not use bash, python, grep, ripgrep, or any local code-analysis workflow.',
    `Entity type: ${question.entity_type || 'ENTITY'}`,
    `Question type: ${question.question_type}`,
    `Question: ${question.question_text}`,
    ...(question?.structured_output_schema ? [`Structured output schema: ${question.structured_output_schema}`] : []),
    'Return only JSON with these keys: question, answer, context, sources, confidence.',
    'If normalized upstream evidence is insufficient, return insufficient_signal with confidence 0.',
    'This is derived synthesis: reason only from normalized prior answers and evidence basis.',
    'Do not return markdown or prose.',
  ] : [
    'Use BrightData to answer one atomic question.',
    'Do not inspect local files, the repository, tests, or generated scripts.',
    'Do not use bash, python, grep, ripgrep, or any local code-analysis workflow.',
    'Use only BrightData-backed web evidence and your final JSON response.',
    `Entity type: ${question.entity_type || 'ENTITY'}`,
    `Question type: ${question.question_type}`,
    `Question: ${question.question_text}`,
    `Canonical query: ${question.query}`,
    ...(question?.structured_output_schema ? [`Structured output schema: ${question.structured_output_schema}`] : []),
    ...(sourceOrder.length > 0 ? [`Prioritize sources in this order: ${sourceOrder.join(', ')}`] : []),
    'Return only JSON with these keys: question, answer, context, sources, confidence.',
    'If you cannot find an answer, leave answer empty, keep context brief, and set confidence to 0.',
    'If the question is compound, answer the narrowest concrete fact first.',
    'Do not return markdown or prose.',
  ];
  const contractLines = _questionOutputContractPromptLines(question);
  if (contractLines.length > 0) {
    promptLines.splice(promptLines.length - 1, 0, ...contractLines);
  }
  if (standaloneHarness) {
    promptLines.splice(
      promptLines.length - 1,
      0,
      'This is a bounded standalone debug harness run.',
      'Your first action must be one BrightData search using the canonical query.',
      'If that search does not produce a usable lead, do at most one follow-up BrightData search or scrape, then return JSON immediately.',
      'Do not spend steps on repeated reasoning without BrightData tool progress.',
      'If no BrightData-backed evidence is retrieved after the bounded search, return no_signal immediately.',
    );
  }
  if (_isCommercialSignalQuestion(question)) {
    promptLines.splice(
      promptLines.length - 1,
      0,
      'For commercial-signal questions, also return these optional keys when justified: evidence_grade, structured_signal, procurement_model, commercial_implication, signal_density.',
    );
  }
  if (question?.question_id === 'q7_procurement_signal') {
    promptLines.splice(
      promptLines.length - 1,
      0,
      'For structured_signal, use vendor_changes, platform_migrations, partnerships, and org_changes arrays of objects with: name, evidence_url, evidence_kind, summary.',
      'If a bucket has no concrete named evidence, return an empty array for that bucket.',
      'If indirect multi-source ecosystem-change evidence exists but you cannot prove a named procurement cycle, return a non-empty answer with validation_state implied as provisional rather than collapsing to no_signal.',
      'Do not return no_signal for q7 when multiple credible sources point to platform, partner, launch, or ecosystem change but named vendor structure is still incomplete.',
    );
  }
  if (question?.question_id === 'q8_explicit_rfp') {
    promptLines.splice(
      promptLines.length - 1,
      0,
      'If no explicit public tender exists, you may still return procurement_model as private_direct, partner_led, agency_led, or unknown.',
    );
  }
  if (question?.question_id === 'q10_hiring_signal') {
    promptLines.splice(
      promptLines.length - 1,
      0,
      'If hiring evidence is found, commercial_implication should explain what the role mix implies about investment priorities.',
    );
  }
  if (['q3_leadership', 'q11_decision_owner'].includes(question?.question_id)) {
    promptLines.splice(
      promptLines.length - 1,
      0,
      'For buyer and leadership questions, prefer official leadership/team/board pages, LinkedIn company or people evidence, partner announcements, and credible news.',
      'Use Wikipedia only as last-resort context; do not use event-history, venue, medal table, founding date, or generic Wikipedia pages as buyer evidence.',
      'If search results are dominated by Wikipedia or generic history pages, perform one focused follow-up search with leadership, board, commercial director, partnerships director, digital director, or chief executive terms before returning no_signal.',
      'Return a person or explicit role-owner only when the evidence names a current relevant role; otherwise return insufficient_signal.',
    );
  }
  if (question?.question_id === 'q3_leadership') {
    promptLines.splice(
      promptLines.length - 1,
      0,
      'For q3_leadership, return a people array. Each item must include: name, title, function, buyer_relevance, evidence_url, evidence_basis, confidence.',
      'Buyer-relevant functions are commercial, partnerships, sponsorship, marketing, digital, product, technology, strategy, CEO/COO/general manager, or explicit role-owner.',
      'Reject founded years, venues, trophies, event dates, and generic history as answers even if a source is available.',
      'If no named current buyer-role candidate is found, return validation_state no_signal with checked_sources explaining what was searched.',
    );
  }
  if (question?.empty_result_policy === 'no_signal') {
    promptLines.splice(
      promptLines.length - 1,
      0,
      'If no meaningful public evidence is visible after a bounded search, treat that as no_signal rather than a failed run.',
    );
  }
  promptLines.push(isDerivedSynthesis
    ? 'IMPORTANT: Output your final JSON as plain text in your next message. Do not make tool calls.'
    : 'IMPORTANT: After your BrightData searches, you MUST output your final JSON as plain text in your next message. Do not make additional tool calls.');
  return promptLines.join('\n');
}

function _usesTwoStageOpenCodeFlow(question) {
  const questionType = String(question?.question_type || '').trim().toLowerCase();
  return question?.question_id === 'q7_procurement_signal'
    || question?.question_id === 'q10_hiring_signal'
    || questionType === 'procurement'
    || questionType === 'procurement_signal';
}

export function buildOpenCodeRetrievalPrompt(question, { standaloneHarness = false } = {}) {
  const sourceOrder = Array.isArray(question?.source_priority) && question.source_priority.length > 0
    ? question.source_priority
    : (Array.isArray(question?.current_source_order) && question.current_source_order.length > 0
      ? question.current_source_order
      : []);
  const promptLines = [
    'Use BrightData to gather retrieval evidence for one atomic question.',
    'This is the retrieval pass.',
    'Do not classify, score confidence, or decide validation_state.',
    'Do not inspect local files, the repository, tests, or generated scripts.',
    'Do not use bash, python, grep, ripgrep, or any local code-analysis workflow.',
    'Use only BrightData-backed web evidence.',
    `Entity type: ${question.entity_type || 'ENTITY'}`,
    `Question type: ${question.question_type}`,
    `Question: ${question.question_text}`,
    `Canonical query: ${question.query}`,
    ...(question?.structured_output_schema ? [`Structured output schema: ${question.structured_output_schema}`] : []),
    ...(sourceOrder.length > 0 ? [`Prioritize sources in this order: ${sourceOrder.join(', ')}`] : []),
    'Your first action must be one BrightData search using the canonical query.',
    'If the first search is weak, do at most one follow-up BrightData search or scrape.',
    'Return only JSON with these keys: question, query, leads, retrieval_summary.',
    'Each lead should include title, url, snippet, and excerpt when available.',
    'Do not classify or decide validation_state.',
    'Do not return markdown or prose.',
  ];
  if (standaloneHarness) {
    promptLines.splice(
      promptLines.length - 1,
      0,
      'This is a bounded standalone debug harness run.',
      'If no BrightData-backed evidence is retrieved after the bounded search, return an empty leads array and a brief retrieval_summary immediately.',
      'Do not spend steps on repeated reasoning without BrightData tool progress.',
    );
  }
  if (question?.question_id === 'q7_procurement_signal') {
    promptLines.splice(
      promptLines.length - 1,
      0,
      'For q7, keep this retrieval pass hard bounded: maximum two BrightData tool calls total.',
      'You may use at most one LinkedIn signal check for q7, and it must be a post/company search only.',
      'Do not inspect LinkedIn people, personal profiles, or broad profile search results for q7.',
      'If using LinkedIn, use one focused query such as site:linkedin.com/posts OR site:linkedin.com/company with the entity and procurement/vendor/partnership/platform terms.',
      'Prefer official site, tender/procurement pages, press releases, partner announcements, and named vendor/platform pages.',
      'Return at most three leads. If none are concrete after the bounded search, return an empty leads array immediately.',
    );
  }
  promptLines.push('IMPORTANT: After your BrightData searches, you MUST output your final JSON as plain text in your next message. Do not make additional tool calls.');
  return promptLines.join('\n');
}

export function buildOpenCodeEvidenceSynthesisPrompt(question, { prefetchEvidence = {}, standaloneHarness = false } = {}) {
  const promptLines = [
    'Use supplied retrieval evidence to answer one atomic question.',
    'This is an evidence-first synthesis pass.',
    'Use only the supplied retrieval evidence; do not invent facts, people, dates, sources, platforms, or commercial implications.',
    'Do not make BrightData tool calls during synthesis.',
    'Do not browse, search, scrape, or inspect any new source during synthesis.',
    'Do not inspect local files, the repository, tests, or generated scripts.',
    'Do not use bash, python, grep, ripgrep, or any local code-analysis workflow.',
    `Question id: ${question.question_id}`,
    `Question type: ${question.question_type}`,
    `Question: ${question.question_text}`,
    `Canonical query: ${question.query}`,
    ...(question?.structured_output_schema ? [`Structured output schema: ${question.structured_output_schema}`] : []),
    'Return only JSON with these keys: question, answer, context, sources, confidence, validation_state, checked_sources, structured_signal, display_answer.',
    'If evidence is insufficient return checked no_signal with confidence 0 and checked_sources explaining the attempted queries/sources.',
    'display_answer must be compact and readable: headline, bullets, evidence, commercial_implication, verification_needed, status_label.',
    ..._questionOutputContractPromptLines(question),
    `Supplied retrieval evidence JSON:\n${JSON.stringify(prefetchEvidence || {}, null, 2)}`,
    'Do not return markdown or prose.',
  ];
  if (question?.question_id === 'q3_leadership') {
    promptLines.splice(
      promptLines.length - 2,
      0,
      'For q3, return named current people or explicit role-owner placeholders only. Reject founding dates, venues, trophies, and generic history.',
    );
  }
  if (['q6_launch_signal', 'q9_news_signal'].includes(question?.question_id)) {
    promptLines.splice(
      promptLines.length - 2,
      0,
      'For q6/q9 positive signals, include date, source URL, recency, and commercial_implication. If date/source is missing, return no_signal or provisional at most.',
    );
  }
  if (standaloneHarness) {
    promptLines.splice(
      promptLines.length - 2,
      0,
      'This is a bounded standalone debug harness run. Use the evidence JSON directly and finish promptly.',
    );
  }
  promptLines.push('IMPORTANT: Output your final JSON as plain text in your next message. Do not make tool calls.');
  return promptLines.join('\n');
}

export function buildOpenCodeSynthesisPrompt(question, { retrievalOutput = {}, standaloneHarness = false } = {}) {
  const promptLines = [
    'Use BrightData retrieval evidence to answer one atomic question.',
    'This is the synthesis pass.',
    'Use only the supplied retrieval evidence.',
    'Do not make BrightData tool calls during synthesis.',
    'Do not browse, search, scrape, or inspect any new source during synthesis.',
    'Do not inspect local files, the repository, tests, or generated scripts.',
    'Do not use bash, python, grep, ripgrep, or any local code-analysis workflow.',
    `Question type: ${question.question_type}`,
    `Question: ${question.question_text}`,
    `Canonical query: ${question.query}`,
    ...(question?.structured_output_schema ? [`Structured output schema: ${question.structured_output_schema}`] : []),
    'Return only JSON with these keys: question, answer, context, sources, confidence.',
    'Also return these optional keys when justified: validation_state, evidence_grade, structured_signal, procurement_model, commercial_implication, signal_density.',
    'If the supplied retrieval evidence is weak or empty, be conservative and return a bounded no_signal or provisional outcome instead of inventing evidence.',
    'Do not return markdown or prose.',
    `Retrieval evidence JSON:\n${JSON.stringify(retrievalOutput, null, 2)}`,
  ];
  if (question?.question_id === 'q7_procurement_signal') {
    promptLines.splice(
      promptLines.length - 2,
      0,
      'For structured_signal, use vendor_changes, platform_migrations, partnerships, and org_changes arrays of objects with: name, evidence_url, evidence_kind, summary.',
      'If indirect multi-source ecosystem-change evidence exists but named procurement structure is incomplete, prefer provisional over no_signal.',
      'Only return validated or confirmed when named vendor or platform evidence is concrete.',
    );
  }
  if (question?.question_id === 'q10_hiring_signal') {
    promptLines.splice(
      promptLines.length - 2,
      0,
      'Only return validated when the supplied retrieval evidence contains specific named hiring or role evidence strong enough to justify it.',
      'Weak hiring evidence should stay provisional.',
    );
  }
  if (standaloneHarness) {
    promptLines.splice(
      promptLines.length - 2,
      0,
      'This is a bounded standalone debug harness run.',
      'Use the retrieval evidence directly and finish promptly.',
    );
  }
  promptLines.push('IMPORTANT: After your BrightData searches, you MUST output your final JSON as plain text in your next message. Do not make additional tool calls.');
  return promptLines.join('\n');
}

export function buildOpenCodeRunArgs(question, prompt, { standaloneHarness = false } = {}) {
  const routing = resolveQuestionModelRouting(question);
  const args = [
    'run',
    '--format',
    'json',
    '--model',
    routing.model,
    '--agent',
    'build',
    '--title',
    `Yellow Panther :: ${question.question_id}`,
    prompt,
  ];
  if (standaloneHarness) {
    args.splice(args.length - 1, 0, '--print-logs', '--log-level', 'INFO');
  }
  return args;
}

function _resolveOpenCodePassTimeoutMs(question, opencodeTimeoutMs) {
  const baseTimeoutMs = Number.isFinite(Number(opencodeTimeoutMs)) && Number(opencodeTimeoutMs) > 0
    ? Number(opencodeTimeoutMs)
    : 300000;
  if (String(question?.question_id || '').trim() === 'q7_procurement_signal') {
    return Math.min(baseTimeoutMs, 90000);
  }
  return baseTimeoutMs;
}

export async function prepareOpenCodeRunWorkspace({ worktreeRoot = WORKTREE_ROOT, baseUrl } = {}) {
  const config = await buildOpenCodeConfig({ worktreeRoot, baseUrl });
  const existingConfigPath = path.join(worktreeRoot, 'opencode.json');
  const existingConfig = await fs.readFile(existingConfigPath, 'utf8').catch(() => null);
  const existingParsed = existingConfig ? JSON.parse(existingConfig) : null;
  const configsMatch = existingParsed
    && existingParsed.model === config.model
    && existingParsed.provider?.[DEFAULT_PROVIDER_ID]?.npm === config.provider?.[DEFAULT_PROVIDER_ID]?.npm
    && existingParsed.provider?.[DEFAULT_PROVIDER_ID]?.options?.baseURL === config.provider?.[DEFAULT_PROVIDER_ID]?.options?.baseURL
    && existingParsed.provider?.[DEFAULT_PROVIDER_ID]?.options?.apiKey === config.provider?.[DEFAULT_PROVIDER_ID]?.options?.apiKey
    && existingParsed.mcp?.brightData?.url === config.mcp?.brightData?.url
    && existingParsed.mcp?.brightData?.timeout === config.mcp?.brightData?.timeout;
  if (configsMatch) {
    return {
      cwd: worktreeRoot,
      configPath: existingConfigPath,
      cleanup: async () => {},
    };
  }
  const runWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-question-run-'));
  const configPath = path.join(runWorkspace, 'opencode.json');
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return {
    cwd: runWorkspace,
    configPath,
    cleanup: async () => {
      await fs.rm(runWorkspace, { recursive: true, force: true });
    },
  };
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
      evidence_grade: { type: 'string' },
      structured_signal: { type: 'object' },
      procurement_model: { type: 'string' },
      commercial_implication: { type: 'string' },
      signal_density: { type: 'number' },
    },
    required: ['answer', 'confidence'],
    additionalProperties: true,
  };
}

function _classifyValidationState(question, structuredOutput, cliResult) {
  if (!structuredOutput || typeof structuredOutput !== 'object') {
    return cliResult && Number(cliResult.code ?? 0) !== 0 ? 'tool_call_missing' : 'no_signal';
  }
  if (Object.keys(structuredOutput).length === 0) {
    return cliResult && Number(cliResult.code ?? 0) !== 0 ? 'tool_call_missing' : 'no_signal';
  }
  if (structuredOutput.validation_state) {
    return structuredOutput.validation_state;
  }
  const confidence = Number(structuredOutput.confidence ?? 0);
  const answer = String(structuredOutput.answer || '').trim();
  if (!answer || confidence <= 0) {
    return 'no_signal';
  }
  if (confidence >= 0.8) {
    return 'validated';
  }
  return 'provisional';
}

function _derivePromptTraceStatus(question, structuredOutput, cliResult, promptTrace) {
  if (promptTrace?.status) return promptTrace.status;
  const executionClass = String(question?.execution_class || 'atomic_retrieval').trim() || 'atomic_retrieval';
  const hasStructuredOutput = Boolean(structuredOutput && typeof structuredOutput === 'object' && Object.keys(structuredOutput).length > 0);
  if (hasStructuredOutput) {
    return null;
  }
  const exitCode = Number(cliResult?.code ?? 0);
  return exitCode !== 0 ? `${executionClass}_tool_call_missing` : `${executionClass}_no_signal`;
}

function _decoratePromptTrace(question, structuredOutput, cliResult, promptTrace) {
  const base = {
    ..._modelPromptTrace(question),
    ...(promptTrace && typeof promptTrace === 'object' ? promptTrace : {}),
  };
  const executionClass = String(question?.execution_class || '').trim();
  const questionType = String(question?.question_type || '').trim();
  const status = _derivePromptTraceStatus(question, structuredOutput, cliResult, base);
  if (status && !base.status) {
    base.status = status;
  }
  if (executionClass && !base.failure_origin) {
    base.failure_origin = executionClass;
  }
  if (questionType && !base.failure_question_type) {
    base.failure_question_type = questionType;
  }
  if (!base.has_structured_output) {
    base.has_structured_output = Boolean(structuredOutput && typeof structuredOutput === 'object' && Object.keys(structuredOutput).length > 0);
  }
  if (!Number.isFinite(Number(base.exit_code)) && cliResult) {
    base.exit_code = Number(cliResult.code ?? 0);
  }
  const providerNoAnswerReason = structuredOutput?.structured_signal?.provider_no_answer_reason;
  if (providerNoAnswerReason && !base.provider_no_answer_reason) {
    base.provider_no_answer_reason = providerNoAnswerReason;
  }
  return base;
}

function _stripJsonFence(text) {
  let s = String(text || '').trim();

  // 1) Try extracting from markdown code fence (handles prose + ```json ... ```)
  const fenceMatch = s.match(/```json\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    const candidate = fenceMatch[1].trim();
    try { JSON.parse(candidate); return candidate; } catch { /* fall through */ }
  }

  // 2) Strip leading/following fences if present
  s = s.replace(/^[\s\S]*?```(?:json)?\s*\n?/i, '').replace(/\s*```[\s\S]*$/i, '').trim();

  // 3) If still not starting with { or [, find first JSON object/array
  if (s && !s.startsWith('{') && !s.startsWith('[')) {
    const objStart = s.indexOf('{');
    const arrStart = s.indexOf('[');
    const start = objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
    if (start !== -1) {
      const opener = s[start];
      const closer = opener === '{' ? '}' : ']';
      let depth = 0;
      for (let i = start; i < s.length; i++) {
        if (s[i] === opener) depth++;
        if (s[i] === closer) depth--;
        if (depth === 0) { s = s.slice(start, i + 1); break; }
      }
    }
  }

  return s;
}

function _buildStructuredNoSignalOutput(question, { context = '', sources = [] } = {}) {
  return {
    question: question?.question_text || question?.question || '',
    answer: '',
    context: context || 'No supporting evidence was finalized by the model.',
    sources: Array.isArray(sources) ? sources.filter(Boolean) : [],
    confidence: 0,
    validation_state: 'no_signal',
  };
}

function _extractCompletedToolCalls(stdout) {
  const toolCalls = [];
  const lines = String(stdout || '').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const part = parsed?.part;
      if (parsed?.type === 'tool_use' && part?.type === 'tool' && part?.state?.status === 'completed') {
        toolCalls.push({
          tool: part.tool,
          input: part.state?.input || {},
          output: typeof part.state?.output === 'string' ? part.state.output : '',
        });
      }
    } catch {
      // Ignore non-JSON lines and log chatter.
    }
  }
  return toolCalls;
}

function _normalizeRecoveredSourceUrl(url) {
  return String(url || '').trim().replace(/[:;,.]+$/g, '');
}

function _isFoundationCredibleSource(url) {
  const value = _normalizeRecoveredSourceUrl(url);
  if (!value) return false;
  try {
    const { hostname } = new URL(value);
    return ['arsenal.com', 'wikipedia.org', 'britannica.com', 'premierleague.com']
      .some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function _recoverFoundationStructuredOutput(question, stdout) {
  if (String(question?.question_type || '').trim().toLowerCase() !== 'foundation') {
    return null;
  }
  const toolCalls = _extractCompletedToolCalls(stdout);
  const sourceUrls = Array.from(new Set(toolCalls.flatMap((toolCall) => {
    const urls = [];
    if (toolCall?.input?.url) urls.push(_normalizeRecoveredSourceUrl(toolCall.input.url));
    const inlineUrls = String(toolCall.output || '').match(/https?:\/\/[^\s"')\]}]+/g) || [];
    return urls.concat(inlineUrls.map(_normalizeRecoveredSourceUrl));
  }).filter(_isFoundationCredibleSource)));
  if (sourceUrls.length === 0) {
    return null;
  }
  const evidenceText = toolCalls
    .map((toolCall) => String(toolCall.output || ''))
    .join('\n');
  const yearMatches = Array.from(evidenceText.matchAll(/\b(18\d{2}|19\d{2}|20\d{2})\b/g))
    .map((match) => match[1])
    .filter(Boolean);
  const foundedYear = yearMatches.find((year) => evidenceText.toLowerCase().includes(`founded ${year}`))
    || yearMatches.find((year) => evidenceText.toLowerCase().includes(`formed ${year}`))
    || yearMatches.find((year) => evidenceText.toLowerCase().includes(`established ${year}`))
    || yearMatches[0];
  if (!foundedYear) {
    return null;
  }
  return {
    question: question.question_text || question.question || '',
    answer: foundedYear,
    context: `Recovered founded year ${foundedYear} from scraped canonical sources after the OpenCode run failed to finalize structured JSON.`,
    sources: sourceUrls,
    confidence: 0.85,
    validation_state: 'validated',
  };
}

function _recoverStructuredOutputFromFailure(question, stdout) {
  return _recoverFoundationStructuredOutput(question, stdout);
}

function _recoverRetrievalOutputFromFailure(question, stdout) {
  const toolCalls = _extractCompletedToolCalls(stdout);
  const leads = [];
  for (const toolCall of toolCalls) {
    let parsedOutput = null;
    try {
      parsedOutput = JSON.parse(toolCall.output || '{}');
    } catch {
      parsedOutput = null;
    }
    if (Array.isArray(parsedOutput?.results)) {
      for (const result of parsedOutput.results) {
        const url = String(result?.url || '').trim();
        const title = String(result?.title || url || 'BrightData result').trim();
        const snippet = String(result?.snippet || result?.description || '').trim();
        if (url || title || snippet) {
          leads.push({
            title,
            url,
            snippet,
            excerpt: snippet,
          });
        }
      }
      continue;
    }
    const inputUrl = String(toolCall?.input?.url || '').trim();
    if (inputUrl) {
      const output = String(toolCall.output || '').trim();
      leads.push({
        title: inputUrl,
        url: inputUrl,
        snippet: output.slice(0, 500),
        excerpt: output.slice(0, 1000),
      });
    }
  }
  return {
    question: question?.question_text || question?.question || '',
    query: question?.query || '',
    leads,
    retrieval_summary: leads.length > 0
      ? `Recovered ${leads.length} BrightData lead(s) from a timed out retrieval pass.`
      : 'No completed BrightData leads were recoverable from the timed out retrieval pass.',
  };
}

function _extractFinalCliJson(stdout, question = null) {
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
  // Try text events in reverse order — the model's final answer is usually last,
  // but earlier events may contain clean JSON if the last one is prose-heavy.
  const lastText = textEvents[textEvents.length - 1] || '';
  const stripped = _stripJsonFence(lastText);
  if (stripped.toLowerCase() === 'no_signal') {
    return _recoverStructuredOutputFromFailure(question, stdout)
      || _buildStructuredNoSignalOutput(question, { context: 'Model returned bare no_signal.' });
  }
  try {
    return JSON.parse(stripped);
  } catch (primaryErr) {
    // Try earlier text events as fallback
    for (let i = textEvents.length - 2; i >= 0; i--) {
      const fallback = _stripJsonFence(textEvents[i]);
      try { return JSON.parse(fallback); } catch { /* keep trying */ }
    }
    const recoveredOutput = _recoverStructuredOutputFromFailure(question, stdout);
    if (recoveredOutput) {
      return recoveredOutput;
    }
    if (textEvents.length > 0) {
      console.error(`[_extractFinalCliJson] textEvents=${textEvents.length} lastText(${lastText.length})=${lastText.slice(0, 200)} stripped(${stripped.length})=${stripped.slice(0, 200)} parseErr=${primaryErr.message}`);
    } else {
      const types = lines.map((l) => { try { return JSON.parse(l).type; } catch { return '?'; } }).join(', ');
      console.error(`[_extractFinalCliJson] no textEvents in ${lines.length} lines. types=[${types}]`);
    }
    return {};
  }
}

function _extractUrlsFromText(text) {
  const matches = String(text || '').match(/https?:\/\/[^\s"')\]}]+/g) || [];
  return Array.from(new Set(matches));
}

function _countBrightDataToolCalls(stdout, stderr) {
  const lines = `${stdout || ''}\n${stderr || ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/service=default .* args=\[/i.test(line))
    .filter((line) => !/service=mcp key=brightData .*create\(\) successfully created client/i.test(line))
    .filter((line) => !/service=mcp key=brightData type=local found/i.test(line));
  return lines.filter((line) =>
    /brightdata[_-][a-z0-9_:-]+/i.test(line)
    || /tool[^\n]{0,120}brightdata/i.test(line)
    || /brightdata[^\n]{0,120}(search|scrape|invoke|call)/i.test(line),
  ).length;
}

function _summarizeOpencodeFailureDiagnostics({ stdout = '', stderr = '' } = {}) {
  const stepCount = (String(stdout).match(/"type":"step_start"/g) || []).length;
  const brightdataClientStarted = /service=mcp key=brightData .*successfully created client/i.test(String(stderr));
  const brightdataToolCallCount = _countBrightDataToolCalls(stdout, stderr);
  const brightdataSourceCount = _extractUrlsFromText(`${stdout}\n${stderr}`).length;
  const noProductiveProgress = brightdataClientStarted && brightdataToolCallCount === 0 && brightdataSourceCount === 0 && stepCount > 0;
  return {
    tool_progress_summary: {
      step_count: stepCount,
      brightdata_client_started: brightdataClientStarted,
      no_productive_progress: noProductiveProgress,
    },
    brightdata_tool_call_count: brightdataToolCallCount,
    brightdata_source_count: brightdataSourceCount,
    failure_signature: noProductiveProgress
      ? 'loop_after_mcp_start_no_productive_progress'
      : (!brightdataClientStarted && stepCount > 0 ? 'timeout_before_brightdata_client_ready' : null),
  };
}

function _shouldAbortStandaloneHarnessStall({ stdout = '', stderr = '' } = {}) {
  const diagnostics = _summarizeOpencodeFailureDiagnostics({ stdout, stderr });
  return diagnostics.tool_progress_summary.brightdata_client_started
    && diagnostics.tool_progress_summary.step_count >= 8
    && diagnostics.brightdata_tool_call_count === 0
    && diagnostics.brightdata_source_count === 0;
}

function _detectProviderTerminalError(stderr = '') {
  const text = String(stderr || '');
  if (/Insufficient balance or no resource package/i.test(text) || /"code":"1113"/i.test(text) || /"code"\s*:\s*"1113"/i.test(text)) {
    const error = new Error('opencode provider terminated with insufficient balance');
    error.name = 'OpenCodeProviderInsufficientBalanceError';
    return error;
  }
  return null;
}

function _normalizeQuestionRunResult(questionRun, { fallbackMode = null, failureDiagnostics = null } = {}) {
  const normalized = questionRun && typeof questionRun === 'object' ? questionRun : {};
  const promptTrace = normalized.promptTrace && typeof normalized.promptTrace === 'object'
    ? { ...normalized.promptTrace }
    : {};
  if (fallbackMode) {
    promptTrace.fallback = true;
    promptTrace.fallback_mode = fallbackMode;
  }
  if (failureDiagnostics?.failure_signature && !promptTrace.failure_signature) {
    promptTrace.failure_signature = failureDiagnostics.failure_signature;
  }
  return {
    structuredOutput: normalized.structuredOutput && typeof normalized.structuredOutput === 'object'
      ? normalized.structuredOutput
      : {},
    promptTrace,
    messageTrace: Array.isArray(normalized.messageTrace) ? normalized.messageTrace : [],
    cliResult: normalized.cliResult && typeof normalized.cliResult === 'object'
      ? normalized.cliResult
      : { code: 0, stdout: '', stderr: '' },
  };
}

function _parseFallbackRunnerStdout(stdout) {
  const trimmed = String(stdout || '').trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const parseError = new Error(`Standalone BrightData fallback returned invalid JSON: ${error.message}`);
    parseError.name = 'StandaloneBrightDataFallbackParseError';
    parseError.stdout = stdout;
    throw parseError;
  }
}

async function runStandaloneDirectBrightDataFallback(question, failureDiagnostics, { worktreeRoot, timeoutMs = 45000 } = {}) {
  const resolvedEnv = _resolveOpenCodeEnv();
  const payload = {
    question,
    failure_diagnostics: failureDiagnostics,
  };
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [STANDALONE_BRIGHTDATA_FALLBACK_SCRIPT], {
      cwd: worktreeRoot || WORKTREE_ROOT,
      env: {
        ...process.env,
        BRIGHTDATA_API_TOKEN: resolvedEnv.brightdataToken,
        BRIGHTDATA_TOKEN: resolvedEnv.brightdataToken,
        BRIGHTDATA_ZONE: resolvedEnv.brightdataZone,
        PATH: process.env.PATH,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const finishResolve = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      const error = new Error(`standalone direct BrightData fallback timed out after ${timeoutMs}ms`);
      error.name = 'StandaloneBrightDataFallbackTimeoutError';
      error.stdout = stdout;
      error.stderr = stderr;
      finishReject(error);
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      finishReject(error);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        const error = new Error(`standalone direct BrightData fallback exited with code ${code}`);
        error.name = 'StandaloneBrightDataFallbackProcessError';
        error.stdout = stdout;
        error.stderr = stderr;
        finishReject(error);
        return;
      }
      try {
        finishResolve({
          structuredOutput: _parseFallbackRunnerStdout(stdout),
          promptTrace: {
            fallback: true,
            fallback_mode: 'direct_brightdata',
            failure_signature: failureDiagnostics?.failure_signature || null,
            stderr_preview: String(stderr || '').trim().slice(-500) || '',
          },
          messageTrace: [],
          cliResult: { code: 0, stdout, stderr },
        });
      } catch (error) {
        finishReject(error);
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

async function runStandaloneDirectBrightDataPrefetch(question, { query = '', scrape_url = '', worktreeRoot = WORKTREE_ROOT, timeoutMs = 45000 } = {}) {
  const resolvedEnv = _resolveOpenCodeEnv();
  const payload = {
    mode: 'prefetch',
    question,
    query,
    scrape_url,
  };
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [STANDALONE_BRIGHTDATA_FALLBACK_SCRIPT], {
      cwd: worktreeRoot || WORKTREE_ROOT,
      env: {
        ...process.env,
        BRIGHTDATA_API_TOKEN: resolvedEnv.brightdataToken,
        BRIGHTDATA_TOKEN: resolvedEnv.brightdataToken,
        BRIGHTDATA_ZONE: resolvedEnv.brightdataZone,
        PATH: process.env.PATH,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      const error = new Error(`BrightData prefetch timed out after ${timeoutMs}ms`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        const error = new Error(`BrightData prefetch failed with exit code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      try {
        resolve(JSON.parse(String(stdout || '{}')));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

function _spawnOpencodeRun(args, { command = 'opencode', cwd, env, timeoutMs = 300000, standaloneHarness = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let pendingRejectError = null;
    let forceKillTimer = null;
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceKillTimer);
      reject(error);
    };
    const resolveOnce = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceKillTimer);
      resolve(value);
    };
    const rejectAfterChildStops = (error) => {
      if (settled || pendingRejectError) return;
      pendingRejectError = error;
      clearTimeout(timer);
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
      forceKillTimer = setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }, 2000);
    };
    const timer = setTimeout(() => {
      const error = new Error(`opencode run timed out after ${timeoutMs}ms`);
      error.name = 'OpenCodeTimeoutError';
      error.stdout = stdout;
      error.stderr = stderr;
      error.timeoutMs = timeoutMs;
      rejectAfterChildStops(error);
    }, timeoutMs);
    const maybeAbortForHarnessStall = () => {
      if (!standaloneHarness) return;
      if (!_shouldAbortStandaloneHarnessStall({ stdout, stderr })) return;
      const error = new Error('opencode standalone harness stalled after BrightData MCP startup without productive progress');
      error.name = 'OpenCodeHarnessStallError';
      error.stdout = stdout;
      error.stderr = stderr;
      error.timeoutMs = timeoutMs;
      rejectAfterChildStops(error);
    };
    const maybeAbortForToolCallLoop = () => {
      if (!standaloneHarness) return;
      const toolCallCount = (stdout.match(/"type":"tool_use"/g) || []).length;
      const textEventCount = (stdout.match(/"type":"text"/g) || []).length;
      if (toolCallCount >= 6 && textEventCount === 0) {
        const error = new Error(`opencode harness aborted after ${toolCallCount} tool calls without any text output`);
        error.name = 'OpenCodeToolLoopError';
        error.stdout = stdout;
        error.stderr = stderr;
        error.timeoutMs = timeoutMs;
        rejectAfterChildStops(error);
      }
    };
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      maybeAbortForHarnessStall();
      maybeAbortForToolCallLoop();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      maybeAbortForHarnessStall();
      const providerTerminalError = _detectProviderTerminalError(stderr);
      if (providerTerminalError) {
        providerTerminalError.stdout = stdout;
        providerTerminalError.stderr = stderr;
        providerTerminalError.timeoutMs = timeoutMs;
        rejectAfterChildStops(providerTerminalError);
      }
    });
    child.on('error', (error) => {
      rejectOnce(error);
    });
    child.on('close', (code) => {
      if (pendingRejectError) {
        pendingRejectError.child_stopped = true;
        pendingRejectError.exit_code_after_stop = code;
        rejectOnce(pendingRejectError);
        return;
      }
      resolveOnce({ code, stdout, stderr });
    });
  });
}

export function spawnOpenCodeRunForTesting(args, options = {}) {
  return _spawnOpencodeRun(args, options);
}

async function _writeFailureDiagnosticFile(filePath, content) {
  if (!String(content || '').trim()) {
    return null;
  }
  await fs.writeFile(filePath, String(content), 'utf8');
  return filePath;
}

export async function runOpenCodeCliQuestion(
  question,
  {
    worktreeRoot,
    opencodeTimeoutMs,
    standaloneHarness = false,
    spawnRunner = _spawnOpencodeRun,
    evidencePrefetcher = prefetchQuestionEvidence,
  } = {},
) {
  await ensureBrightDataFastMcpService({ serviceCwd: worktreeRoot || WORKTREE_ROOT });
  const preparedWorkspace = await prepareOpenCodeRunWorkspace({
    worktreeRoot,
  });
  const resolvedEnv = _resolveOpenCodeEnv();
  const runCliPass = async (prompt) => spawnRunner(
    buildOpenCodeRunArgs(question, prompt, { standaloneHarness }),
    {
      cwd: preparedWorkspace.cwd,
      env: {
        ...process.env,
        ZAI_API_KEY: resolvedEnv.apiKey,
        BRIGHTDATA_API_TOKEN: resolvedEnv.brightdataToken,
        BRIGHTDATA_MCP_USE_HOSTED: 'false',
        BRIGHTDATA_MCP_HOSTED_URL: '',
        BRIGHTDATA_ZONE: resolvedEnv.brightdataZone,
        PATH: process.env.PATH,
      },
      timeoutMs: _resolveOpenCodePassTimeoutMs(question, opencodeTimeoutMs),
      standaloneHarness,
    },
  );
  try {
    if (_usesEvidenceFirstOpenCodeFlow(question)) {
      let prefetchEvidence = null;
      try {
        prefetchEvidence = await evidencePrefetcher(question);
      } catch (error) {
        prefetchEvidence = {
          leads: [],
          checked_sources: [{
            status: 'retrieval_failed',
            reason: error instanceof Error ? error.message : String(error),
          }],
          retrieval_summary: 'Evidence prefetch failed before provider synthesis.',
          diagnostics: {
            query_variants_used: [],
            accepted_source_count: 0,
            rejected_source_count: 0,
            source_types: [],
            retrieval_error: error instanceof Error ? error.message : String(error),
          },
        };
      }
      const prefetchLeads = Array.isArray(prefetchEvidence?.leads) ? prefetchEvidence.leads : [];
      const prefetchDiagnostics = prefetchEvidence?.diagnostics && typeof prefetchEvidence.diagnostics === 'object'
        ? prefetchEvidence.diagnostics
        : {};
      if (prefetchLeads.length === 0) {
        const noSignalOutput = {
          ..._buildStructuredNoSignalOutput(question, {
            context: prefetchEvidence?.retrieval_summary || 'No accepted source-backed evidence was found in deterministic preflight.',
            sources: [],
          }),
          checked_sources: Array.isArray(prefetchEvidence?.checked_sources) ? prefetchEvidence.checked_sources : [],
          structured_signal: {
            status: 'source_prefetch_empty',
            question_id: question?.question_id || '',
          },
        };
        return {
          structuredOutput: noSignalOutput,
          promptTrace: {
            ..._modelPromptTrace(question),
            exit_code: 0,
            stdout_length: 0,
            stderr_length: 0,
            has_structured_output: true,
            stage_count: 1,
            prefetch_used: true,
            synthesis_skipped: true,
            retrieval_lead_count: 0,
            accepted_source_count: Number(prefetchDiagnostics.accepted_source_count || 0),
            source_types: Array.isArray(prefetchDiagnostics.source_types) ? prefetchDiagnostics.source_types : [],
            query_variants_used: Array.isArray(prefetchDiagnostics.query_variants_used) ? prefetchDiagnostics.query_variants_used : [],
          },
          messageTrace: [],
          cliResult: { code: 0, stdout: '', stderr: '' },
        };
      }
      const synthesisPrompt = buildOpenCodeEvidenceSynthesisPrompt(question, {
        prefetchEvidence,
        standaloneHarness,
      });
      let synthesisCliResult;
      try {
        synthesisCliResult = await runCliPass(synthesisPrompt);
      } catch (error) {
        const fallbackOutput = _buildStructuredNoSignalOutput(question, {
          context: `${prefetchEvidence?.retrieval_summary || 'Evidence prefetch found leads.'} Provider synthesis failed (${error?.name || 'Error'}).`,
          sources: prefetchLeads.map((lead) => lead.url).filter(Boolean),
        });
        return {
          structuredOutput: {
            ...fallbackOutput,
            checked_sources: Array.isArray(prefetchEvidence?.checked_sources) ? prefetchEvidence.checked_sources : [],
            structured_signal: {
              status: 'source_prefetch_found_provider_failed',
              provider_no_answer_reason: error?.name || 'provider_synthesis_failed',
              question_id: question?.question_id || '',
            },
          },
          promptTrace: {
            ..._modelPromptTrace(question),
            exit_code: typeof error?.code === 'number' ? error.code : 124,
            stdout_length: String(error?.stdout || '').length,
            stderr_length: String(error?.stderr || '').length,
            has_structured_output: true,
            stage_count: 2,
            prefetch_used: true,
            synthesis_failed: true,
            failure_name: error?.name || 'Error',
            retrieval_lead_count: prefetchLeads.length,
            accepted_source_count: Number(prefetchDiagnostics.accepted_source_count || prefetchLeads.length),
            source_types: Array.isArray(prefetchDiagnostics.source_types) ? prefetchDiagnostics.source_types : [],
            query_variants_used: Array.isArray(prefetchDiagnostics.query_variants_used) ? prefetchDiagnostics.query_variants_used : [],
          },
          messageTrace: [{
            role: 'assistant',
            completed: false,
            type: 'cli-run',
            stage: 'evidence_synthesis',
            has_structured_output: true,
            part_count: 1,
          }],
          cliResult: {
            code: typeof error?.code === 'number' ? error.code : 124,
            stdout: String(error?.stdout || ''),
            stderr: String(error?.stderr || ''),
          },
        };
      }
      const structuredOutput = _extractFinalCliJson(synthesisCliResult.stdout, question);
      const sanitizedForFallback = _sanitizeProviderStructuredOutput(question, structuredOutput, synthesisCliResult);
      const providerNoAnswerReason = (
        Object.keys(structuredOutput).length === 0
          ? 'empty_object_answer'
          : sanitizedForFallback?.structured_signal?.provider_no_answer_reason
      );
      const deterministicFallback = providerNoAnswerReason
        ? _buildDeterministicPrefetchFallback(question, prefetchEvidence, providerNoAnswerReason)
        : null;
      if (deterministicFallback) {
        return {
          structuredOutput: deterministicFallback,
          promptTrace: {
            ..._modelPromptTrace(question),
            exit_code: synthesisCliResult.code,
            stdout_length: synthesisCliResult.stdout.length,
            stderr_length: synthesisCliResult.stderr.length,
            has_structured_output: true,
            stage_count: 2,
            prefetch_used: true,
            deterministic_prefetch_fallback: true,
            provider_no_answer_reason: providerNoAnswerReason,
            retrieval_lead_count: prefetchLeads.length,
            accepted_source_count: Number(prefetchDiagnostics.accepted_source_count || prefetchLeads.length),
            source_types: Array.isArray(prefetchDiagnostics.source_types) ? prefetchDiagnostics.source_types : [],
            query_variants_used: Array.isArray(prefetchDiagnostics.query_variants_used) ? prefetchDiagnostics.query_variants_used : [],
          },
          messageTrace: [{
            role: 'assistant',
            completed: synthesisCliResult.code === 0,
            type: 'cli-run',
            stage: 'evidence_synthesis',
            has_structured_output: true,
            part_count: 1,
          }],
          cliResult: synthesisCliResult,
        };
      }
      return {
        structuredOutput,
        promptTrace: {
          ..._modelPromptTrace(question),
          exit_code: synthesisCliResult.code,
          stdout_length: synthesisCliResult.stdout.length,
          stderr_length: synthesisCliResult.stderr.length,
          has_structured_output: Object.keys(structuredOutput).length > 0,
          stage_count: 2,
          prefetch_used: true,
          retrieval_lead_count: prefetchLeads.length,
          accepted_source_count: Number(prefetchDiagnostics.accepted_source_count || prefetchLeads.length),
          source_types: Array.isArray(prefetchDiagnostics.source_types) ? prefetchDiagnostics.source_types : [],
          query_variants_used: Array.isArray(prefetchDiagnostics.query_variants_used) ? prefetchDiagnostics.query_variants_used : [],
        },
        messageTrace: [{
          role: 'assistant',
          completed: synthesisCliResult.code === 0,
          type: 'cli-run',
          stage: 'evidence_synthesis',
          has_structured_output: Object.keys(structuredOutput).length > 0,
          part_count: 1,
        }],
        cliResult: synthesisCliResult,
      };
    }
    if (_usesTwoStageOpenCodeFlow(question)) {
      const retrievalPrompt = buildOpenCodeRetrievalPrompt(question, { standaloneHarness });
      let retrievalCliResult;
      let retrievalRecoveredFromFailure = false;
      let retrievalOutput;
      try {
        retrievalCliResult = await runCliPass(retrievalPrompt);
        retrievalOutput = _extractFinalCliJson(retrievalCliResult.stdout);
      } catch (error) {
        retrievalRecoveredFromFailure = true;
        retrievalCliResult = {
          code: typeof error?.code === 'number' ? error.code : 124,
          stdout: String(error?.stdout || ''),
          stderr: String(error?.stderr || ''),
        };
        retrievalOutput = _recoverRetrievalOutputFromFailure(question, retrievalCliResult.stdout);
      }
      const retrievalLeads = Array.isArray(retrievalOutput?.leads) ? retrievalOutput.leads : [];
      if (question?.question_id === 'q7_procurement_signal' && retrievalRecoveredFromFailure && retrievalLeads.length === 0) {
        const noSignalOutput = _buildStructuredNoSignalOutput(question, {
          context: retrievalOutput?.retrieval_summary || 'No completed BrightData leads were recoverable from the timed out retrieval pass.',
        });
        return {
          structuredOutput: noSignalOutput,
          promptTrace: {
            ..._modelPromptTrace(question),
            exit_code: retrievalCliResult.code,
            stdout_length: retrievalCliResult.stdout.length,
            stderr_length: retrievalCliResult.stderr.length,
            has_structured_output: true,
            stage_count: 1,
            retrieval_recovered_from_failure: true,
            retrieval_has_leads: false,
            retrieval_lead_count: 0,
            retrieval_exit_code: retrievalCliResult.code,
            synthesis_skipped: true,
          },
          messageTrace: [
            {
              role: 'assistant',
              completed: false,
              type: 'cli-run',
              stage: 'retrieval',
              has_structured_output: true,
              part_count: 1,
            },
          ],
          cliResult: retrievalCliResult,
        };
      }
      if (question?.question_id === 'q10_hiring_signal' && retrievalLeads.length === 0) {
        const noSignalOutput = _buildStructuredNoSignalOutput(question, {
          context: retrievalOutput?.retrieval_summary || 'No hiring leads found in bounded retrieval.',
        });
        return {
          structuredOutput: noSignalOutput,
          promptTrace: {
            ..._modelPromptTrace(question),
            exit_code: retrievalCliResult.code,
            stdout_length: retrievalCliResult.stdout.length,
            stderr_length: retrievalCliResult.stderr.length,
            has_structured_output: true,
            stage_count: 1,
            retrieval_recovered_from_failure: retrievalRecoveredFromFailure,
            retrieval_has_leads: false,
            retrieval_lead_count: 0,
            retrieval_exit_code: retrievalCliResult.code,
            synthesis_skipped: true,
          },
          messageTrace: [
            {
              role: 'assistant',
              completed: retrievalCliResult.code === 0,
              type: 'cli-run',
              stage: 'retrieval',
              has_structured_output: Object.keys(retrievalOutput || {}).length > 0,
              part_count: 1,
            },
          ],
          cliResult: retrievalCliResult,
        };
      }
      const synthesisPrompt = buildOpenCodeSynthesisPrompt(question, {
        retrievalOutput,
        standaloneHarness,
      });
      let synthesisCliResult;
      try {
        synthesisCliResult = await runCliPass(synthesisPrompt);
      } catch (error) {
        const recoveredStructuredOutput = _recoverStructuredOutputFromFailure(question, error?.stdout || '');
        const fallbackOutput = recoveredStructuredOutput || _buildStructuredNoSignalOutput(question, {
          context: retrievalOutput?.retrieval_summary || `OpenCode synthesis failed (${error?.name || 'Error'}).`,
        });
        return {
          structuredOutput: fallbackOutput,
          promptTrace: {
            ..._modelPromptTrace(question),
            exit_code: typeof error?.code === 'number' ? error.code : 124,
            stdout_length: String(error?.stdout || '').length,
            stderr_length: String(error?.stderr || '').length,
            has_structured_output: true,
            stage_count: 2,
            retrieval_recovered_from_failure: retrievalRecoveredFromFailure,
            retrieval_has_leads: retrievalLeads.length > 0,
            retrieval_lead_count: retrievalLeads.length,
            retrieval_exit_code: retrievalCliResult.code,
            recovered_from_failure: true,
            failure_name: error?.name || 'Error',
            synthesis_failed: true,
          },
          messageTrace: [
            {
              role: 'assistant',
              completed: retrievalCliResult.code === 0,
              type: 'cli-run',
              stage: 'retrieval',
              has_structured_output: Object.keys(retrievalOutput || {}).length > 0,
              part_count: 1,
            },
            {
              role: 'assistant',
              completed: false,
              type: 'cli-run',
              stage: 'synthesis',
              has_structured_output: Object.keys(fallbackOutput || {}).length > 0,
              part_count: 1,
            },
          ],
          cliResult: {
            code: typeof error?.code === 'number' ? error.code : 124,
            stdout: String(error?.stdout || ''),
            stderr: String(error?.stderr || ''),
          },
        };
      }
      const structuredOutput = _extractFinalCliJson(synthesisCliResult.stdout);
      const promptTrace = {
        ..._modelPromptTrace(question),
        exit_code: synthesisCliResult.code,
        stdout_length: synthesisCliResult.stdout.length,
        stderr_length: synthesisCliResult.stderr.length,
        has_structured_output: Object.keys(structuredOutput).length > 0,
        stage_count: 2,
        retrieval_recovered_from_failure: retrievalRecoveredFromFailure,
        retrieval_has_leads: retrievalLeads.length > 0,
        retrieval_lead_count: retrievalLeads.length,
        retrieval_exit_code: retrievalCliResult.code,
      };
      const messageTrace = [
        {
          role: 'assistant',
          completed: retrievalCliResult.code === 0,
          type: 'cli-run',
          stage: 'retrieval',
          has_structured_output: Object.keys(retrievalOutput).length > 0,
          part_count: 1,
        },
        {
          role: 'assistant',
          completed: synthesisCliResult.code === 0,
          type: 'cli-run',
          stage: 'synthesis',
          has_structured_output: Object.keys(structuredOutput).length > 0,
          part_count: 1,
        },
      ];
      return {
        structuredOutput,
        promptTrace,
        messageTrace,
        cliResult: synthesisCliResult,
      };
    }
    const prompt = buildOpenCodeQuestionPrompt(question, { standaloneHarness });
    let cliResult;
    try {
      cliResult = await runCliPass(prompt);
    } catch (error) {
      const recoveredStructuredOutput = _recoverStructuredOutputFromFailure(question, error?.stdout || '');
      const fallbackOutput = recoveredStructuredOutput || _buildStructuredNoSignalOutput(question, {
        context: `OpenCode run failed (${error?.name || 'Error'}): no text output produced.`,
      });
      return {
        structuredOutput: fallbackOutput,
        promptTrace: {
          ..._modelPromptTrace(question),
          exit_code: 124,
          stdout_length: String(error?.stdout || '').length,
          stderr_length: String(error?.stderr || '').length,
          has_structured_output: true,
          stage_count: 1,
          recovered_from_failure: true,
          failure_name: error?.name || 'Error',
        },
        messageTrace: [
          {
            role: 'assistant',
            completed: false,
            type: 'cli-run',
            has_structured_output: true,
            part_count: 1,
          },
        ],
        cliResult: {
          code: typeof error?.code === 'number' ? error.code : 124,
          stdout: String(error?.stdout || ''),
          stderr: String(error?.stderr || ''),
        },
      };
    }
    const structuredOutput = _extractFinalCliJson(cliResult.stdout, question);
    const promptTrace = {
      ..._modelPromptTrace(question),
      exit_code: cliResult.code,
      stdout_length: cliResult.stdout.length,
      stderr_length: cliResult.stderr.length,
      has_structured_output: Object.keys(structuredOutput).length > 0,
      stage_count: 1,
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
  } finally {
    await preparedWorkspace.cleanup();
  }
}

function _buildQuestionPayload(
  question,
  structuredOutput,
  sessionId,
  { promptTrace = null, messageTrace = [], executionQuery = '', cliResult = null } = {},
) {
  const sanitizedStructuredOutput = _sanitizeProviderStructuredOutput(question, structuredOutput, cliResult);
  const normalizedPromptTrace = _decoratePromptTrace(question, sanitizedStructuredOutput, cliResult, promptTrace);
  const initialValidationState = _classifyValidationState(question, sanitizedStructuredOutput, cliResult);
  const { structuredOutput: enhancedStructuredOutput, commercialFields, confidence } =
    _augmentCommercialStructuredOutput(question, sanitizedStructuredOutput, initialValidationState);
  let finalStructuredOutput = enhancedStructuredOutput;
  let finalConfidence = confidence;
  let validationState = _capCommercialValidationState(question, initialValidationState, commercialFields, confidence);
  if (question.question_id === 'q11_decision_owner' && !_hasPlausibleDecisionOwnerStructuredOutput(enhancedStructuredOutput)) {
    finalStructuredOutput = {
      ...enhancedStructuredOutput,
      answer: 'insufficient_signal',
      summary: 'insufficient_signal',
      primary_owner: null,
      supporting_candidates: [],
      candidates: [],
      confidence: 0,
      confidence_caveat: 'Decision-owner evidence did not contain a plausible named person or role owner.',
    };
    finalConfidence = 0;
    validationState = 'no_signal';
  }
  const sources = Array.isArray(finalStructuredOutput.sources) ? finalStructuredOutput.sources : [];
  const evidenceUrl = finalStructuredOutput.evidence_url || sources[0] || '';
  const notes = finalStructuredOutput.notes || finalStructuredOutput.context || '';
  const inferredSignalType = finalStructuredOutput.signal_type || (question.question_type ? question.question_type.toUpperCase() : 'NO_SIGNAL');
  const displayAnswer = _buildDisplayAnswer(question, finalStructuredOutput, validationState, commercialFields, evidenceUrl);
  return {
    question_id: question.question_id,
    question_family: question.question_family,
    question_type: question.question_type,
    question_text: question.question_text,
    question: question.question_text,
    query: question.query,
    hop_budget: question.hop_budget,
    evidence_extension_budget: question.evidence_extension_budget,
    source_priority: question.source_priority,
    search_strategy: question.search_strategy,
    evidence_extension_confidence_threshold: question.evidence_extension_confidence_threshold,
    entity_name: question.entity_name,
    entity_id: question.entity_id,
    entity_type: question.entity_type,
    preset: question.preset,
    pack_role: question.pack_role,
    execution_class: question.execution_class,
    rollout_phase: question.rollout_phase,
    commercial_output_enabled: question.commercial_output_enabled,
    conditional_on: question.conditional_on,
    depends_on: question.depends_on,
    structured_output_schema: question.structured_output_schema,
    graph_write_targets: question.graph_write_targets,
    current_section_id: question.current_section_id,
    current_section_label: question.current_section_label,
    current_section_index: question.current_section_index,
    current_section_total: question.current_section_total,
    current_question_index: question.current_question_index,
    current_question_total: question.current_question_total,
    current_strategy_label: question.current_strategy_label,
    current_source_order: question.current_source_order,
    model_used: _modelPromptTrace(question).model_used,
    session_id: sessionId,
    agentic_plan: {
      source_priority: question.source_priority,
      stop_rule: `continue for up to ${question.hop_budget} hops within OpenCode steps budget`,
    },
    reasoning: {
      structured_output: finalStructuredOutput,
      prompt_trace: normalizedPromptTrace,
      message_trace: messageTrace,
    },
    prompt_trace: normalizedPromptTrace,
    message_trace: messageTrace,
    execution_query: executionQuery || question.query,
    answer: finalStructuredOutput.answer || '',
    signal_type: inferredSignalType,
    confidence: finalConfidence,
    validation_state: validationState,
    evidence_url: evidenceUrl,
    display_answer: displayAnswer,
    recommended_next_query: finalStructuredOutput.recommended_next_query || '',
    notes,
    primary_owner: finalStructuredOutput.primary_owner || null,
    supporting_candidates: Array.isArray(finalStructuredOutput.supporting_candidates) ? finalStructuredOutput.supporting_candidates : [],
    candidates: Array.isArray(finalStructuredOutput.candidates) ? finalStructuredOutput.candidates : [],
    evidence_grade: commercialFields.evidence_grade,
    structured_signal: commercialFields.structured_signal || finalStructuredOutput.structured_signal,
    procurement_model: commercialFields.procurement_model,
    commercial_implication: commercialFields.commercial_implication,
    signal_density: commercialFields.signal_density,
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

export const OPENCODE_PROGRESS_EVENT_PREFIX = '__QF_PROGRESS__';

function _buildProgressEvent({
  eventType,
  question = null,
  questionIndex = 0,
  questionsTotal = 0,
  error = null,
  completedQuestion = null,
  artifactPaths = null,
  nextQuestion = null,
}) {
  const answeredCount = eventType === 'batch_complete'
    ? questionsTotal
    : eventType === 'question_completed'
      ? Math.min(Math.max(0, Number(questionIndex || 0)), questionsTotal)
      : Math.max(0, Number(questionIndex || 0) - 1);
  const progress = questionsTotal > 0
    ? `${Math.min(Math.max(0, Number(questionIndex || 0)), questionsTotal)}/${questionsTotal} questions`
    : null;
  const event = {
    event_type: eventType,
    phase: 'dossier_generation',
    current_substep: eventType === 'batch_complete' ? 'question_first_completed' : 'question_first_running',
    current_substep_label: eventType === 'batch_complete' ? 'Question-first completed' : 'Question-first running',
    current_section_id: question?.current_section_id || null,
    current_section_label: question?.current_section_label || null,
    current_section_index: question?.current_section_index ?? null,
    current_section_total: question?.current_section_total ?? null,
    current_question_id: question?.question_id || null,
    current_question_text: question?.question_text || null,
    current_question_index: question?.current_question_index ?? null,
    current_question_total: question?.current_question_total ?? null,
    next_question_id: nextQuestion?.question_id || null,
    next_question_text: nextQuestion?.question_text || null,
    current_strategy_label: question?.current_strategy_label || null,
    current_execution_state: question?.current_execution_state || (eventType === 'batch_complete' ? 'finalising section' : 'searching sources'),
    current_source_order: Array.isArray(question?.current_source_order) ? question.current_source_order : (Array.isArray(question?.source_priority) ? question.source_priority : null),
    questions_answered: answeredCount,
    questions_total: questionsTotal,
    current_substep_progress: progress,
    error: error ? String(error) : null,
  };
  if (completedQuestion && typeof completedQuestion === 'object') {
    event.completed_question = completedQuestion;
  }
  if (artifactPaths && typeof artifactPaths === 'object') {
    event.artifact_paths = artifactPaths;
  }
  return event;
}

export async function runOpenCodePresetBatch({
  outputDir,
  preset = 'major-league-cricket',
  worktreeRoot = WORKTREE_ROOT,
  opencodeTimeoutMs = 300000,
  questionRunner = runOpenCodeCliQuestion,
  directBrightDataRunner = runStandaloneDirectBrightDataFallback,
  standaloneHarness = false,
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
  onProgress = null,
} = {}) {
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

  const firstQuestion = questions[0] || {};
  const entityName = entityNameOverride || firstQuestion.entity_name || 'Major League Cricket';
  const entityId = entityIdOverride || firstQuestion.entity_id || _slugify(entityName);
  const entityType = entityTypeOverride || firstQuestion.entity_type || 'SPORT_LEAGUE';

  _loadEnv();
  if (!process.env.ZAI_API_KEY) {
    throw new Error('ZAI_API_KEY is required for OpenCode Z.AI API auth');
  }
  await fs.mkdir(outputDir, { recursive: true });

  const runStartedAt = new Date().toISOString();
  const statePath = _buildStateFilePath(outputDir, normalizedPreset, entityId);
  const checkpoint = questionsOverride && questionsOverride.__question_first_checkpoint
    ? questionsOverride.__question_first_checkpoint
    : null;
  const existingState = resume
    ? _selectResumeRunState(
      await _loadJsonFile(statePath),
      checkpoint ? _buildRunStateFromQuestionFirstCheckpoint(questions, checkpoint, { preset: normalizedPreset, timestamp: runStartedAt }) : null,
    )
    : null;
  const runState = existingState && typeof existingState === 'object' ? existingState : buildPresetRunState(questions, { preset: normalizedPreset, runId: 'cli', timestamp: runStartedAt });
  const budgetOverrides = _buildCreditOverrides({ searchCredits, scrapeCredits, revisitCredits, confidenceThreshold });
  const trackerPath = _buildTrackerFilePath(outputDir, normalizedPreset, entityId);
  let tracker = _buildQuestionTracker({
    runStartedAt,
    preset: normalizedPreset,
    entityName,
    entityId,
    entityType,
    questionSourcePath,
    questions,
  });
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
  await _writeTrackerFile(trackerPath, tracker);

  const finalQuestions = [];
  const perQuestionPayloads = [];
  const transcripts = [];
  const slug = _slugify(entityId);
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').replace('T', '_').replace('Z', '');
  const stem = `${slug}_opencode_batch_${timestamp}`;
  const metaPath = path.join(outputDir, `${stem}_meta.json`);
  const rollupPath = path.join(outputDir, `${stem}_rollup.json`);
  const transcriptPath = path.join(outputDir, `${stem}.txt`);
  const questionFirstRunPath = path.join(outputDir, `${stem}_question_first_run_v1.json`);
  const failureStdoutPath = path.join(outputDir, `${stem}_failure_stdout.log`);
  const failureStderrPath = path.join(outputDir, `${stem}_failure_stderr.log`);

  try {
    for (const [index, question] of questions.entries()) {
      let existingQuestionState = runState.questions[index];
      const currentQuestionState = existingQuestionState || buildQuestionState(question, { runId: `cli-${index + 1}`, timestamp: runStartedAt, creditBudgetOverrides: budgetOverrides, confidenceThreshold: budgetOverrides.confidenceThreshold });
      existingQuestionState = currentQuestionState;
      const searchSpent = Number(currentQuestionState.credits_spent?.search || 0);
      const searchBudget = Number(currentQuestionState.credit_budget?.search || 0);
      const scrapeSpent = Number(currentQuestionState.credits_spent?.scrape || 0);
      const scrapeBudget = Number(currentQuestionState.credit_budget?.scrape || 0);
      const revisitSpent = Number(currentQuestionState.credits_spent?.revisit || 0);
      const revisitBudget = Number(currentQuestionState.credit_budget?.revisit || 0);
      const pendingFrontierItems = resume && existingQuestionState ? _getPendingFrontierItems(existingQuestionState) : [];
      const shouldReplayFrontier = pendingFrontierItems.length > 0;
      const executionQueue = shouldReplayFrontier
        ? pendingFrontierItems.slice(0, Math.max(1, Number(question.hop_budget || 0))).map((item, hopIndex) => _buildExecutionQuestion(question, item.query, hopIndex + 1))
        : (resume && existingQuestionState && _isTerminalQuestionState(existingQuestionState.status))
          ? []
          : [question];
      const shouldEmitLiveProgress = executionQueue.length > 0;
      if (shouldEmitLiveProgress) {
        if (typeof onProgress === 'function') {
          await onProgress(_buildProgressEvent({
            eventType: 'question_progress',
            question,
            questionIndex: index + 1,
            questionsTotal: questions.length,
          }));
        }
        const questionStartedAt = new Date().toISOString();
        tracker.current_question_index = index + 1;
        tracker.current_question_id = question.question_id;
        tracker.current_question_text = question.question_text;
        tracker = _updateTrackerQuestion(tracker, index, {
          status: 'running',
          started_at: questionStartedAt,
          completed_at: null,
          validation_state: null,
          confidence: null,
          answer_excerpt: null,
          notes: null,
          error: null,
        });
        _appendTrackerEvent(tracker, {
          type: 'question_started',
          question_id: question.question_id,
          question_index: index + 1,
          question_text: question.question_text,
        });
        await _writeTrackerFile(trackerPath, tracker);
      }
      let questionPayload;
      let questionRun = null;
      let usedDeterministicSynthesis = false;
      const deterministicStructuredOutput = Number(question.hop_budget || 0) <= 0 && question.fallback_to_retrieval === false
        ? _buildDeterministicStructuredOutput(question, finalQuestions)
        : null;
      if (deterministicStructuredOutput) {
        usedDeterministicSynthesis = true;
        questionRun = {
          structuredOutput: deterministicStructuredOutput,
          promptTrace: {
            provider: 'deterministic_synthesis',
            source_question_ids: Array.isArray(question.depends_on) ? question.depends_on : [],
          },
          messageTrace: [],
          cliResult: { code: 0, stdout: '', stderr: '' },
        };
        questionPayload = _buildQuestionPayload(
          question,
          deterministicStructuredOutput,
          `cli-${index + 1}`,
          {
            promptTrace: questionRun.promptTrace,
            messageTrace: questionRun.messageTrace,
            executionQuery: question.query,
            cliResult: questionRun.cliResult,
          },
        );
      } else if (executionQueue.length === 0) {
        questionPayload = {
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
          model_used: _modelPromptTrace(question).model_used,
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
          execution_query: resolveExecutionQueryForQuestionPayload(question, existingQuestionState),
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
            tracker = _updateTrackerQuestion(tracker, index, {
              status: 'exhausted',
              completed_at: new Date().toISOString(),
            });
            _appendTrackerEvent(tracker, {
              type: 'question_exhausted',
              question_id: question.question_id,
              question_index: index + 1,
              reason: 'search_budget_exhausted',
            });
            await _writeTrackerFile(trackerPath, tracker);
            break;
          }
          try {
            questionRun = await questionRunner(executionQuestion, { worktreeRoot, opencodeTimeoutMs, standaloneHarness });
          } catch (error) {
            const failureDiagnostics = _summarizeOpencodeFailureDiagnostics({
              stdout: error && typeof error === 'object' && 'stdout' in error ? error.stdout : '',
              stderr: error && typeof error === 'object' && 'stderr' in error ? error.stderr : '',
            });
            const shouldUseDirectFallback = typeof directBrightDataRunner === 'function'
              && failureDiagnostics.failure_signature === 'loop_after_mcp_start_no_productive_progress';
            if (!shouldUseDirectFallback) {
              throw error;
            }
            questionRun = await directBrightDataRunner(
              executionQuestion,
              failureDiagnostics,
              { worktreeRoot, timeoutMs: Math.min(opencodeTimeoutMs, 45000) },
            );
            questionRun = _normalizeQuestionRunResult(questionRun, {
              fallbackMode: 'direct_brightdata',
              failureDiagnostics,
            });
            _appendTrackerEvent(tracker, {
              type: 'question_fallback_used',
              question_id: executionQuestion.question_id,
              question_index: index + 1,
              fallback_mode: 'direct_brightdata',
              failure_signature: failureDiagnostics.failure_signature,
            });
            await _writeTrackerFile(trackerPath, tracker);
          }
          questionRun = _normalizeQuestionRunResult(questionRun);
          questionPayload = _buildQuestionPayload(
            question,
            questionRun.structuredOutput || {},
            `cli-${index + 1}`,
            {
              promptTrace: questionRun.promptTrace || null,
              messageTrace: questionRun.messageTrace || [],
              executionQuery: executionQuestion.query,
              cliResult: questionRun.cliResult || null,
            },
          );
          if (
            question.question_id === 'q11_decision_owner'
            && !['validated', 'confirmed', 'provisional'].includes(String(questionPayload.validation_state || '').trim().toLowerCase())
          ) {
            const synthesizedDecisionOwner = _buildDeterministicStructuredOutput(question, finalQuestions);
            if (synthesizedDecisionOwner && synthesizedDecisionOwner.validation_state === 'provisional') {
              questionPayload = _buildQuestionPayload(
                question,
                synthesizedDecisionOwner,
                `cli-${index + 1}`,
                {
                  promptTrace: {
                    provider: 'deterministic_synthesis',
                    source_question_ids: Array.isArray(question.depends_on) ? question.depends_on : [],
                  },
                  messageTrace: [],
                  executionQuery: question.query,
                  cliResult: { code: 0, stdout: '', stderr: '' },
                },
              );
            }
          }
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
            tracker = _updateTrackerQuestion(tracker, index, {
              status: 'exhausted',
              completed_at: new Date().toISOString(),
              validation_state: questionPayload?.validation_state || null,
              confidence: questionPayload?.confidence ?? null,
              answer_excerpt: String(questionPayload?.answer || '').slice(0, 280) || null,
              notes: questionPayload?.notes || null,
            });
            _appendTrackerEvent(tracker, {
              type: 'question_exhausted',
              question_id: question.question_id,
              question_index: index + 1,
              validation_state: questionPayload?.validation_state || null,
            });
            await _writeTrackerFile(trackerPath, tracker);
            break;
          }
        }
      }
      if (!questionPayload) {
        questionPayload = {
          question_id: question.question_id,
          question_type: question.question_type,
          question_text: question.question_text,
          question: question.question_text,
          query: existingQuestionState?.last_executed_query || question.query,
          hop_budget: question.hop_budget,
          source_priority: question.source_priority,
          entity_name: question.entity_name,
          entity_id: question.entity_id,
          entity_type: question.entity_type,
          preset: question.preset,
          model_used: _modelPromptTrace(question).model_used,
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
          execution_query: resolveExecutionQueryForQuestionPayload(question, existingQuestionState),
          answer: existingQuestionState?.best_answer || '',
          signal_type: question.question_type.toUpperCase(),
          confidence: existingQuestionState?.current_confidence || 0,
          validation_state: existingQuestionState?.status || 'exhausted',
          evidence_url: existingQuestionState?.best_evidence_url || '',
          recommended_next_query: '',
          notes: existingQuestionState?.notes || '',
        };
      }
      if (executionQueue.length === 0 || usedDeterministicSynthesis) {
        runState.questions[index] = _mergeQuestionState(existingQuestionState || currentQuestionState, questionPayload, new Date().toISOString());
        await _writeJsonFile(statePath, runState);
      }
      tracker = _updateTrackerQuestion(tracker, index, {
        status: questionPayload.validation_state === 'validated' ? 'validated' : (questionPayload.validation_state === 'exhausted' ? 'exhausted' : 'completed'),
        completed_at: new Date().toISOString(),
        validation_state: questionPayload.validation_state || null,
        confidence: questionPayload.confidence ?? null,
        answer_excerpt: String(questionPayload.answer || '').slice(0, 280) || null,
        notes: questionPayload.notes || null,
        error: null,
      });
      _appendTrackerEvent(tracker, {
        type: 'question_completed',
        question_id: question.question_id,
        question_index: index + 1,
        validation_state: questionPayload.validation_state || null,
        confidence: questionPayload.confidence ?? null,
      });
      await _writeTrackerFile(trackerPath, tracker);
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
      if (typeof onProgress === 'function') {
        if (shouldEmitLiveProgress) {
          await onProgress(_buildProgressEvent({
            eventType: 'question_completed',
            question,
            questionIndex: index + 1,
            questionsTotal: questions.length,
            completedQuestion: questionPayload,
            nextQuestion: questions[index + 1] || null,
          }));
        }
      }
    }

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
	      tracker_path: trackerPath,
	      question_result_paths: questionPaths,
	      question_results_path: metaPath,
	      transcript_path: transcriptPath,
	      question_first_run_path: questionFirstRunPath,
	    };

	    await fs.writeFile(metaPath, JSON.stringify(metaPayload, null, 2), 'utf8');
	    await fs.writeFile(transcriptPath, transcripts.join('\n\n'), 'utf8');
	    await fs.writeFile(rollupPath, JSON.stringify(rollupPayload, null, 2), 'utf8');
	    console.error(`[opencode_agentic_batch] About to build artifact. questions=${questions.length} finalQuestions=${finalQuestions.length} validated=${questionsValidated}`);
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
	    try {
	      validateQuestionFirstRunArtifact(questionFirstArtifact);
	    } catch (validationErr) {
	      console.warn(`[opencode_agentic_batch] Artifact validation warning (non-fatal): ${validationErr.message}`);
	    }
	    await fs.writeFile(questionFirstRunPath, JSON.stringify(questionFirstArtifact, null, 2), 'utf8');
	    console.error(`[opencode_agentic_batch] Artifact written to ${questionFirstRunPath}`);
	    tracker = {
	      ...tracker,
	      status: 'completed',
	      run_completed_at: new Date().toISOString(),
	      updated_at: new Date().toISOString(),
	      current_question_index: finalQuestions.length,
	      current_question_id: finalQuestions[finalQuestions.length - 1]?.question_id || tracker.current_question_id || null,
	    };
	    _appendTrackerEvent(tracker, {
	      type: 'run_completed',
	      questions_total: finalQuestions.length,
	      questions_validated: questionsValidated,
	      questions_no_signal: questionsNoSignal,
	      questions_provisional: questionsProvisional,
	    });
	    await _writeTrackerFile(trackerPath, tracker);
    await _writeJsonFile(statePath, {
      ...runState,
      last_run_at: new Date().toISOString(),
      preset: normalizedPreset,
      questions: runState.questions,
    });

    if (typeof onProgress === 'function') {
      await onProgress(_buildProgressEvent({
        eventType: 'batch_complete',
        question: questions[questions.length - 1] || null,
        questionIndex: questions.length,
        questionsTotal: questions.length,
        artifactPaths: {
          question_first_run_path: questionFirstRunPath,
          rollup_path: rollupPath,
          meta_result_path: metaPath,
          question_results_path: metaPath,
          transcript_path: transcriptPath,
          tracker_path: trackerPath,
          question_result_paths: questionPaths,
        },
      }));
    }

    return {
      ...rollupPayload,
	      rollup_path: rollupPath,
	      meta_result_path: metaPath,
	      question_result_paths: questionPaths,
	      question_results_path: metaPath,
	      transcript_path: transcriptPath,
	      question_first_run_path: questionFirstRunPath,
	      tracker_path: trackerPath,
	      state_path: statePath,
	    };
  } catch (error) {
    const diagnosticStdoutPath = await _writeFailureDiagnosticFile(
      failureStdoutPath,
      error && typeof error === 'object' && 'stdout' in error ? error.stdout : '',
    );
    const diagnosticStderrPath = await _writeFailureDiagnosticFile(
      failureStderrPath,
      error && typeof error === 'object' && 'stderr' in error ? error.stderr : '',
    );
    const failureDiagnostics = _summarizeOpencodeFailureDiagnostics({
      stdout: error && typeof error === 'object' && 'stdout' in error ? error.stdout : '',
      stderr: error && typeof error === 'object' && 'stderr' in error ? error.stderr : '',
    });
    tracker = {
      ...tracker,
      status: 'failed',
      run_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      state_path: statePath,
      diagnostic_stdout_path: diagnosticStdoutPath,
      diagnostic_stderr_path: diagnosticStderrPath,
      tool_progress_summary: failureDiagnostics.tool_progress_summary,
      brightdata_tool_call_count: failureDiagnostics.brightdata_tool_call_count,
      brightdata_source_count: failureDiagnostics.brightdata_source_count,
      failure_signature: failureDiagnostics.failure_signature,
    };
    _appendTrackerEvent(tracker, {
      type: 'run_failed',
      error: error instanceof Error ? error.message : String(error),
      current_question_id: tracker.current_question_id || null,
      current_question_text: tracker.current_question_text || null,
      state_path: statePath,
      diagnostic_stdout_path: diagnosticStdoutPath,
      diagnostic_stderr_path: diagnosticStderrPath,
      tool_progress_summary: failureDiagnostics.tool_progress_summary,
      brightdata_tool_call_count: failureDiagnostics.brightdata_tool_call_count,
      brightdata_source_count: failureDiagnostics.brightdata_source_count,
      failure_signature: failureDiagnostics.failure_signature,
    });
    try {
      await _writeTrackerFile(trackerPath, tracker);
    } catch {
      // Ignore tracker write failures on the error path.
    }
    throw error;
  } finally {
  }
}

export async function runOpenCodeQuestionSourceBatch({
  questionSourcePath,
  outputDir,
  worktreeRoot = WORKTREE_ROOT,
  opencodeTimeoutMs = 60000,
  questionRunner = runOpenCodeCliQuestion,
  directBrightDataRunner = runStandaloneDirectBrightDataFallback,
  resume = false,
  searchCredits,
  scrapeCredits,
  revisitCredits,
  confidenceThreshold,
  onProgress = null,
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

  const questions = await _normalizeQuestionSourceQuestions(sourcePayload);
  if (questions.length === 0) {
    throw new Error(`Question source ${JSON.stringify(questionSourcePath)} does not contain any questions`);
  }
  const sourceMetadata = sourcePayload.metadata && typeof sourcePayload.metadata === 'object' ? sourcePayload.metadata : {};
  const checkpoint = sourcePayload.question_first_checkpoint || sourceMetadata.question_first_checkpoint || null;
  if (checkpoint && typeof checkpoint === 'object') {
    questions.__question_first_checkpoint = checkpoint;
  }

  const entityName = String(sourcePayload.entity_name || sourcePayload.entityName || sourcePayload.entity_id || sourcePayload.entityId || 'entity').trim() || 'entity';
  const entityId = String(sourcePayload.entity_id || sourcePayload.entityId || _slugify(entityName)).trim() || _slugify(entityName);
  const entityType = String(sourcePayload.entity_type || sourcePayload.entityType || 'ENTITY').trim() || 'ENTITY';
  const preset = String(sourcePayload.preset || sourcePayload.question_source_label || entityId).trim() || entityId;

  return runOpenCodePresetBatch({
    outputDir,
    preset,
    worktreeRoot,
    opencodeTimeoutMs,
    questionRunner,
    directBrightDataRunner,
    resume,
    searchCredits,
    scrapeCredits,
    revisitCredits,
    confidenceThreshold,
    standaloneHarness: true,
    questionsOverride: questions,
    entityNameOverride: entityName,
    entityIdOverride: entityId,
    entityTypeOverride: entityType,
    questionSourcePath,
    onProgress,
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
  const progressWriter = async (event) => {
    process.stdout.write(`${OPENCODE_PROGRESS_EVENT_PREFIX}${JSON.stringify(event)}\n`);
  };
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
      onProgress: progressWriter,
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
      onProgress: progressWriter,
    });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stdout.write(`${OPENCODE_PROGRESS_EVENT_PREFIX}${JSON.stringify(_buildProgressEvent({
      eventType: 'batch_failed',
      error: error instanceof Error ? error.message : String(error),
    }))}\n`);
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
