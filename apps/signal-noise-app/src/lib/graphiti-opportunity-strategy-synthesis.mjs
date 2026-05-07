import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = resolve(__dirname, '..', '..')
export const YELLOW_PANTHER_PROFILE_PATH = resolve(APP_ROOT, 'docs/archive/root/YELLOW-PANTHER-BUSINESS-PROFILE.md')
export const YELLOW_PANTHER_PROFILE_SOURCE = 'YELLOW-PANTHER-BUSINESS-PROFILE.md'
export const STRATEGY_BRIEF_SCHEMA_VERSION = 'yp_bd_strategy_v1'

export const SERVICE_WEDGES = [
  'mobile_app',
  'fan_engagement',
  'digital_transformation',
  'analytics_ai',
  'backend_integration',
  'sports_platform',
  'consulting',
  'no_clear_fit',
]

export const PURSUIT_RECOMMENDATIONS = ['outreach_ready', 'verify_now', 'needs_enrichment', 'ignore']

/**
 * @typedef {Object} GraphitiOpportunityStrategyBrief
 * @property {'yp_bd_strategy_v1'} schema_version
 * @property {string} generated_at
 * @property {string} model
 * @property {'YELLOW-PANTHER-BUSINESS-PROFILE.md'} source_profile
 * @property {string} signal_title
 * @property {'High'|'Medium'|'Low'} signal_strength
 * @property {'Ready for outreach'|'Needs verification'|'Needs enrichment'|'Ignore'} verification_status
 * @property {'mobile_app'|'fan_engagement'|'digital_transformation'|'analytics_ai'|'backend_integration'|'sports_platform'|'consulting'|'no_clear_fit'} service_wedge
 * @property {'outreach_ready'|'verify_now'|'needs_enrichment'|'ignore'} pursuit_recommendation
 * @property {string} decision_summary
 * @property {string} what_happened
 * @property {string} why_it_matters_now
 * @property {string} yellow_panther_angle
 * @property {string} suggested_route
 * @property {string} next_move
 * @property {string} outreach_opener
 * @property {string[]} verify_before_action
 * @property {string[]} disqualifiers
 * @property {string[]} evidence_used
 * @property {string} reasoning_notes
 */

export function loadYellowPantherBusinessProfile() {
  return readFileSync(YELLOW_PANTHER_PROFILE_PATH, 'utf8')
}

export function distillYellowPantherProfile(profileText = '') {
  const text = String(profileText || '')
  return [
    'Yellow Panther context:',
    '- Builds sports mobile apps, fan engagement products, digital transformation platforms, AI/analytics tools, backend/API integrations, and sports technology systems.',
    '- Best fit: sports clubs, leagues, federations, venues, and sports tech firms.',
    '- Project sweet spot: £80K-£500K, 3-12 months, clear CEO/MD/CTO/commercial/marketing/operations buyer.',
    '- Football recruitment-ops hiring signals can map to analytics_ai or consulting when they indicate investment in recruitment intelligence, scouting workflows, player identification, academy pathway analysis, or market monitoring.',
    '- Differentiators: sports-only focus, Team GB app, Premier Padel, LNB, ISU, FIBA 3x3, ISO/GDPR credibility.',
    text.includes('Team GB') ? '- Profile confirms Team GB, Premier Padel, LNB, ISU, and FIBA 3x3 as relevant proof points.' : '',
  ].filter(Boolean).join('\n')
}

function toText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim() === '[object Object]' ? '' : value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(' · ')
  if (typeof value === 'object') {
    return [
      value.summary,
      value.finding,
      value.answer,
      value.value,
      value.text,
      value.title,
      value.description,
      value.source,
      value.snippet,
      value.name,
    ].map(toText).find(Boolean) || ''
  }
  return String(value).trim()
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function concise(value, maxLength = 280) {
  const text = toText(value).replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= maxLength) return text
  const sentence = text.split(/(?<=[.!?])\s+/)[0]?.trim()
  if (sentence && sentence.length <= maxLength) return sentence
  return `${text.slice(0, maxLength - 1).trim()}…`
}

function textSimilarity(a, b) {
  const left = new Set(String(a || '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3))
  const right = new Set(String(b || '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3))
  if (left.size === 0 || right.size === 0) return 0
  let overlap = 0
  for (const word of left) {
    if (right.has(word)) overlap += 1
  }
  return overlap / Math.min(left.size, right.size)
}

function isGenericRoute(value) {
  const text = toText(value).toLowerCase()
  return !text
    || ['cold', 'direct', 'warm intro', 'warm_intro', 'cold outreach', 'direct outreach', 'unknown', 'n/a'].includes(text)
    || /confirm the buyer owner|buyer route unconfirmed|blocked by upstream|identify the budget owner/i.test(text)
}

function normalizedArray(value, fallback) {
  const values = Array.isArray(value) ? value.map(toText).filter(Boolean) : []
  return values.length > 0 ? values.slice(0, 5) : fallback
}

export function strategyBriefSchema() {
  return {
    schema_version: STRATEGY_BRIEF_SCHEMA_VERSION,
    generated_at: 'ISO timestamp',
    model: 'model name',
    source_profile: YELLOW_PANTHER_PROFILE_SOURCE,
    signal_title: 'string',
    signal_strength: 'High | Medium | Low',
    verification_status: 'Ready for outreach | Needs verification | Needs enrichment | Ignore',
    service_wedge: SERVICE_WEDGES.join(' | '),
    pursuit_recommendation: PURSUIT_RECOMMENDATIONS.join(' | '),
    decision_summary: 'one concise BD decision sentence',
    what_happened: 'what changed, grounded in evidence',
    why_it_matters_now: 'why this creates or may create commercial urgency',
    yellow_panther_angle: 'specific Yellow Panther service wedge, not copied evidence',
    suggested_route: 'buyer or route; use Buyer route unverified if unknown',
    next_move: 'one recommended next action',
    outreach_opener: 'one sentence opener if verified',
    verify_before_action: ['specific checks before outreach'],
    disqualifiers: ['reasons to demote or ignore'],
    evidence_used: ['short evidence references used'],
    reasoning_notes: 'short internal explanation of service mapping',
  }
}

export function buildGraphitiOpportunityStrategyPrompt({ row, yellowPantherProfile }) {
  const rawPayload = asRecord(row.raw_payload || row.metadata)
  const qualification = asRecord(rawPayload.commercial_qualification)
  const ypFit = asRecord(qualification.yp_fit_breakdown)
  const evidence = [
    ...asArray(row.evidence).map((item) => ({
      source: item.source || item.source_url || null,
      snippet: item.snippet || item.finding || item.summary || null,
    })),
    ...asArray(rawPayload.findings).map((item) => ({
      source: item.source_url || item.source || null,
      snippet: item.finding || item.summary || null,
    })),
  ].slice(0, 10)
  const dossierFacts = [
    row.title,
    row.summary,
    row.why_it_matters,
    row.suggested_action,
    row.why_this_is_an_opportunity,
    row.yellow_panther_fit_feedback,
    rawPayload.capability_gap,
    rawPayload.outreach_route,
    rawPayload.best_path_owner,
    ypFit.capability_match,
    ypFit.outreach_angle,
    ypFit.buyer_route,
    qualification.promotion_reason,
    ...asArray(row.supporting_signals),
  ].map((item) => concise(item, 320)).filter(Boolean).slice(0, 16)

  return [
    'You are a senior BD strategist for Yellow Panther, a sports-focused digital studio.',
    '',
    'Your job is not to summarize evidence. Your job is to decide whether the signal creates a practical Yellow Panther commercial wedge.',
    '',
    distillYellowPantherProfile(yellowPantherProfile),
    '',
    'Rules:',
    '- Do not copy raw evidence into Yellow Panther angle.',
    '- Map the signal to a specific Yellow Panther service wedge, or say no clear fit.',
    '- Treat football recruitment-ops hiring as a possible analytics_ai or consulting wedge when evidence mentions recruitment intelligence, scouting workflows, player identification, academy pathway analysis, or market monitoring; keep it verify_now or needs_enrichment until role recency and buyer ownership are confirmed.',
    '- If route is "cold", "direct", "warm intro", unknown, or a blocked placeholder, treat route as unverified.',
    '- If what_happened and why_it_matters_now repeat the same idea, rewrite.',
    '- If the entity/signal appears wrong, generic, country-level, non-sports, failed, no-signal, or context-only, set pursuit_recommendation to needs_enrichment or ignore.',
    '- Use concise BD language. No model self-explanation.',
    '- Every claim must be grounded in the provided evidence. Do not invent contacts, budgets, or live status.',
    '',
    'Opportunity input:',
    JSON.stringify({
      entity_name: row.canonical_entity_name || row.entity_name || row.organization,
      title: row.title,
      status: row.status,
      yellow_panther_fit: row.yellow_panther_fit,
      temporal_status: asRecord(rawPayload.temporal_reasoning).status,
      commercial_status: qualification.status,
      blockers: qualification.blockers || rawPayload.data_quality_blockers || [],
      useful_fact_count: rawPayload.useful_fact_count || rawPayload.answer_count || asRecord(rawPayload.quality_metrics).useful_fact_count,
      evidence_count: rawPayload.evidence_count || asRecord(rawPayload.quality_metrics).evidence_url_count,
      dossier_facts: dossierFacts,
      evidence,
    }, null, 2),
    '',
    'Return one valid JSON object matching the schema. No markdown, no prose.',
    `JSON schema: ${JSON.stringify(strategyBriefSchema())}`,
  ].join('\n')
}

export function resolveGraphitiStrategyModelConfig(env = process.env) {
  const baseUrl = env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic/v1'
  const apiKey = env.ZAI_API_KEY || env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY || ''
  const model = env.ANTHROPIC_DEFAULT_OPUS_MODEL || env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'GLM-5.1'
  const timeoutMs = Number(env.GRAPHITI_STRATEGY_MODEL_TIMEOUT_MS || 60000)
  return {
    baseUrl,
    apiKey,
    model,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000,
  }
}

function messagesUrlForBaseUrl(rawBaseUrl) {
  const normalized = String(rawBaseUrl || '').replace(/\/$/, '')
  return normalized.endsWith('/v1') ? `${normalized}/messages` : `${normalized}/v1/messages`
}

function extractAnthropicText(body) {
  const content = Array.isArray(body?.content) ? body.content : []
  return content.map((part) => typeof part === 'string' ? part : part?.text).filter(Boolean).join('\n').trim()
}

function parseJsonObject(text) {
  const raw = String(text || '').trim()
  try {
    return JSON.parse(raw)
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
    if (fenced) return JSON.parse(fenced)
    const object = raw.match(/\{[\s\S]*\}/)?.[0]
    if (object) return JSON.parse(object)
    throw new Error('model_response_not_json')
  }
}

export async function callGraphitiStrategyModel(prompt, config = resolveGraphitiStrategyModelConfig()) {
  if (!config.apiKey) {
    throw new Error('missing_strategy_model_api_key')
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('strategy_model_timeout')), config.timeoutMs || 60000)
  let response
  try {
    response = await fetch(messagesUrlForBaseUrl(config.baseUrl), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1200,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('strategy_model_timeout')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
  const text = await response.text()
  let body = text
  try {
    body = JSON.parse(text)
  } catch {
    // Keep raw text for diagnostics.
  }
  if (!response.ok) {
    throw new Error(`strategy_model_http_${response.status}`)
  }
  return parseJsonObject(typeof body === 'string' ? body : extractAnthropicText(body))
}

function normalizeStrategyBriefShape(brief, model = 'GLM-5.1') {
  return {
    schema_version: STRATEGY_BRIEF_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    model,
    source_profile: YELLOW_PANTHER_PROFILE_SOURCE,
    signal_title: concise(brief.signal_title, 120) || 'Commercial signal',
    signal_strength: ['High', 'Medium', 'Low'].includes(brief.signal_strength) ? brief.signal_strength : 'Medium',
    verification_status: ['Ready for outreach', 'Needs verification', 'Needs enrichment', 'Ignore'].includes(brief.verification_status)
      ? brief.verification_status
      : 'Needs verification',
    service_wedge: SERVICE_WEDGES.includes(brief.service_wedge) ? brief.service_wedge : 'no_clear_fit',
    pursuit_recommendation: PURSUIT_RECOMMENDATIONS.includes(brief.pursuit_recommendation) ? brief.pursuit_recommendation : 'needs_enrichment',
    decision_summary: concise(brief.decision_summary, 220) || 'Needs enrichment: no clear Yellow Panther angle yet.',
    what_happened: concise(brief.what_happened, 300) || 'The dossier contains a possible signal, but it needs strategy synthesis before action.',
    why_it_matters_now: concise(brief.why_it_matters_now, 300) || 'Commercial urgency is not clear enough for outreach.',
    yellow_panther_angle: concise(brief.yellow_panther_angle, 320) || 'No clear Yellow Panther angle yet.',
    suggested_route: isGenericRoute(brief.suggested_route) ? 'Buyer route unverified.' : concise(brief.suggested_route, 180),
    next_move: concise(brief.next_move, 220) || 'Verify the source, buyer, and service wedge before outreach.',
    outreach_opener: concise(brief.outreach_opener, 260) || 'Use only after verifying the trigger and buyer route.',
    verify_before_action: normalizedArray(brief.verify_before_action, ['Verify source recency, buyer ownership, and whether there is a funded need.']),
    disqualifiers: normalizedArray(brief.disqualifiers, []),
    evidence_used: normalizedArray(brief.evidence_used, []),
    reasoning_notes: concise(brief.reasoning_notes, 260) || 'Strategy synthesis did not provide detailed reasoning.',
  }
}

export function validateStrategyBrief(input) {
  const brief = normalizeStrategyBriefShape(asRecord(input), toText(input?.model) || 'GLM-5.1')
  const reasons = []
  if (textSimilarity(brief.what_happened, brief.why_it_matters_now) >= 0.72) {
    reasons.push('what_happened repeats why_it_matters_now')
  }
  if (isGenericRoute(input?.suggested_route)) {
    reasons.push('route is generic or unverified')
  }
  if (brief.service_wedge === 'no_clear_fit') {
    reasons.push('no clear Yellow Panther service wedge')
  }
  if (
    brief.evidence_used.some((item) => textSimilarity(brief.yellow_panther_angle, item) >= 0.66)
    || /\bhas launched the following\b|\(1\).+\(2\)/i.test(brief.yellow_panther_angle)
  ) {
    reasons.push('yellow_panther_angle copied raw evidence')
  }
  if (/wrong_entity|tool_failure|no_signal|failed-only|context-only|generic context/i.test([
    ...brief.disqualifiers,
    brief.reasoning_notes,
    brief.decision_summary,
  ].join(' '))) {
    reasons.push('evidence is blocked or context-only')
  }
  return {
    valid: reasons.length === 0,
    reason: reasons.join('; '),
    brief,
  }
}

export function normalizeStrategyBriefForDisplay(input, validation = validateStrategyBrief(input)) {
  if (validation.valid) return validation.brief
  return {
    ...validation.brief,
    service_wedge: 'no_clear_fit',
    pursuit_recommendation: 'needs_enrichment',
    verification_status: 'Needs enrichment',
    decision_summary: 'Needs enrichment: no clear Yellow Panther angle yet.',
    yellow_panther_angle: 'No clear Yellow Panther angle yet. Re-check the dossier evidence against Yellow Panther services before outreach.',
    suggested_route: 'Buyer route unverified.',
    next_move: 'Enrich or verify the source, buyer, and service wedge before outreach.',
    outreach_opener: 'Do not use for outreach until a specific Yellow Panther service wedge is confirmed.',
    disqualifiers: Array.from(new Set([...validation.brief.disqualifiers, validation.reason].filter(Boolean))),
  }
}

export function strategyBriefToCardBrief(input) {
  const validation = validateStrategyBrief(input)
  const brief = normalizeStrategyBriefForDisplay(input, validation)
  const verdict = brief.pursuit_recommendation === 'outreach_ready'
    ? 'outreach_ready'
    : brief.pursuit_recommendation === 'verify_now'
      ? 'verify_trigger'
      : brief.pursuit_recommendation === 'ignore'
        ? 'data_quality_issue'
        : 'research_lead'
  return {
    ...brief,
    trigger: brief.what_happened,
    why_it_matters: brief.why_it_matters_now,
    suggested_route: brief.suggested_route,
    verify_before_action: brief.verify_before_action.join(' '),
    evidence_summary: brief.evidence_used.join(' · '),
    brief_verdict: verdict,
    strategy_synthesized: true,
  }
}

export async function synthesizeGraphitiOpportunityStrategyBrief(row, yellowPantherProfile = loadYellowPantherBusinessProfile(), options = {}) {
  const config = {
    ...resolveGraphitiStrategyModelConfig(options.env || process.env),
    ...(options.modelTimeoutMs ? { timeoutMs: options.modelTimeoutMs } : {}),
  }
  const prompt = buildGraphitiOpportunityStrategyPrompt({ row, yellowPantherProfile })
  const modelOutput = options.modelOutput || await callGraphitiStrategyModel(prompt, config)
  const normalized = normalizeStrategyBriefShape(modelOutput, config.model)
  const validation = validateStrategyBrief(normalized)
  return {
    brief: validation.valid ? normalized : normalizeStrategyBriefForDisplay(normalized, validation),
    validation,
    prompt,
  }
}

function candidateTier(row) {
  const rawPayload = asRecord(row.raw_payload)
  const qualification = asRecord(rawPayload.commercial_qualification)
  const status = toText(qualification.status)
  if (row.is_active || rawPayload.shortlist_opportunity === true) return 'active'
  if (status === 'watch') return 'watch'
  return 'skip'
}

function candidateScore(row) {
  const rawPayload = asRecord(row.raw_payload)
  const metrics = asRecord(rawPayload.quality_metrics)
  const fit = Number(row.yellow_panther_fit || 0)
  const evidence = Number(rawPayload.evidence_count || metrics.evidence_url_count || 0)
  const useful = Number(rawPayload.answer_count || metrics.useful_fact_count || 0)
  const recency = Date.parse(row.updated_at || row.last_seen_at || row.materialized_at || row.detected_at || '') || 0
  return fit * 1000000 + evidence * 10000 + useful * 100 + Math.floor(recency / 1000000000)
}

export async function selectStrategySynthesisCandidates({ supabase, limit = 50, canonicalEntityId = null, sourceLedgerId = null }) {
  const response = await supabase
    .from('graphiti_materialized_opportunities')
    .select('opportunity_id,title,organization,entity_name,canonical_entity_name,summary,why_it_matters,suggested_action,why_this_is_an_opportunity,yellow_panther_fit_feedback,supporting_signals,yellow_panther_fit,status,evidence,raw_payload,is_active,detected_at,materialized_at,last_seen_at,updated_at')
    .order('last_seen_at', { ascending: false })
    .limit(Math.max(limit * 4, 100))
  if (response.error) throw new Error(`strategy_candidate_query_failed:${response.error.message}`)
  const rows = (Array.isArray(response.data) ? response.data : [])
    .filter((row) => asRecord(row.raw_payload).source === 'entity_dossiers')
    .filter((row) => {
      const rawPayload = asRecord(row.raw_payload)
      if (canonicalEntityId && rawPayload.canonical_entity_id !== canonicalEntityId) return false
      if (sourceLedgerId && rawPayload.source_ledger_id !== sourceLedgerId) return false
      return true
    })
    .filter((row) => asRecord(row.raw_payload).bd_strategy_status !== 'ready')
  const active = rows.filter((row) => candidateTier(row) === 'active')
  const watch = rows
    .filter((row) => candidateTier(row) === 'watch')
    .sort((a, b) => candidateScore(b) - candidateScore(a))
    .slice(0, limit)
  const combinedCandidates = [...active, ...watch]
  return combinedCandidates.slice(0, limit)
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = []
  let index = 0
  async function next() {
    while (index < items.length) {
      const current = items[index++]
      results.push(await worker(current))
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, next))
  return results
}

/**
 * @param {{ supabase: any, limit?: number, dryRun?: boolean, concurrency?: number, modelTimeoutMs?: number, yellowPantherProfile?: string, canonicalEntityId?: string | null, sourceLedgerId?: string | null }} options
 */
export async function synthesizeAndPersistGraphitiOpportunityStrategyBriefs({
  supabase = null,
  limit = 50,
  dryRun = false,
  concurrency = 2,
  modelTimeoutMs = undefined,
  yellowPantherProfile = loadYellowPantherBusinessProfile(),
  canonicalEntityId = null,
  sourceLedgerId = null,
} = {}) {
  if (!supabase) throw new Error('missing_supabase_client')
  const candidates = await selectStrategySynthesisCandidates({ supabase, limit, canonicalEntityId, sourceLedgerId })
  if (dryRun) {
    return {
      candidate_count: candidates.length,
      synthesized_count: 0,
      updated_count: 0,
      failed_count: 0,
      dry_run: true,
    }
  }

  let synthesized = 0
  let updated = 0
  let failed = 0
  const errors = []
  await runWithConcurrency(candidates, concurrency, async (row) => {
    try {
      const { brief, validation } = await synthesizeGraphitiOpportunityStrategyBrief(row, yellowPantherProfile, {
        modelTimeoutMs,
      })
      synthesized += 1
      const rawPayload = asRecord(row.raw_payload)
      const payload = {
        ...rawPayload,
        bd_strategy_brief: brief,
        bd_strategy_status: validation.valid ? 'ready' : 'failed_quality_gate',
        bd_strategy_error: validation.valid ? null : validation.reason,
      }
      const response = await supabase
        .from('graphiti_materialized_opportunities')
        .update({ raw_payload: payload, updated_at: new Date().toISOString() })
        .eq('opportunity_id', row.opportunity_id)
      if (response.error) throw new Error(response.error.message)
      updated += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failed += 1
      errors.push({
        opportunity_id: row.opportunity_id,
        error: message,
      })
      const rawPayload = asRecord(row.raw_payload)
      const payload = {
        ...rawPayload,
        bd_strategy_status: 'failed_provider',
        bd_strategy_error: message,
        bd_strategy_failed_at: new Date().toISOString(),
      }
      const response = await supabase
        .from('graphiti_materialized_opportunities')
        .update({ raw_payload: payload, updated_at: new Date().toISOString() })
        .eq('opportunity_id', row.opportunity_id)
      if (response.error) {
        errors.push({
          opportunity_id: row.opportunity_id,
          error: `failed_to_persist_strategy_error:${response.error.message}`,
        })
      }
    }
  })

  return {
    candidate_count: candidates.length,
    synthesized_count: synthesized,
    updated_count: updated,
    failed_count: failed,
    errors,
    dry_run: false,
  }
}
