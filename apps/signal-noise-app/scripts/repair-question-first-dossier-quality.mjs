#!/usr/bin/env node

import crypto from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'
import pg from 'pg'

import { normalizeQuestionFirstDossier } from '../src/lib/question-first-dossier.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

export function parseArgs(argv = process.argv.slice(2)) {
  const questionsArg = argv.find((arg) => arg.startsWith('--questions='))?.split('=')[1] || ''
  return {
    apply: argv.includes('--apply'),
    dryRun: argv.includes('--dry-run') || !argv.includes('--apply'),
    limit: Number(argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 500),
    entityId: argv.find((arg) => arg.startsWith('--entity-id='))?.split('=')[1] || null,
    questions: questionsArg.split(',').map((item) => item.trim()).filter(Boolean),
    rerunPlanOutput: argv.find((arg) => arg.startsWith('--rerun-plan-output='))?.split('=').slice(1).join('=') || null,
  }
}

export function createPgPool() {
  if (process.env.DATABASE_URL) {
    return new pg.Pool({ connectionString: process.env.DATABASE_URL })
  }
  return new pg.Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'signal_noise_app',
    user: process.env.PGUSER || process.env.USER,
    password: process.env.PGPASSWORD || undefined,
  })
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

const UPSTREAM_QUESTION_IDS = new Set([
  'q1_foundation',
  'q2_digital_stack',
  'q3_leadership',
  'q4_performance',
  'q5_league_context',
  'q6_launch_signal',
  'q7_procurement_signal',
  'q8_explicit_rfp',
  'q9_news_signal',
  'q10_hiring_signal',
])

const PRIORITY_RERUN_QUESTION_IDS = [
  'q1_foundation',
  'q2_digital_stack',
  'q3_leadership',
  'q6_launch_signal',
  'q9_news_signal',
]

const NON_SPORT_ENTITY_TYPES = new Set(['person', 'rfp', 'non_current_entity', 'non-current entity'])

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function contentHash(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex')
}

function toText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join('; ')
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nested]) => {
        const text = toText(nested)
        return text ? `${key}: ${text}` : ''
      })
      .filter(Boolean)
      .join('; ')
  }
  return ''
}

function hasMeaningfulCommercialText(value) {
  const text = toText(value)
  return Boolean(text)
    && !/(^no_signal$|^no signal$|source pending$|question execution failed|no deterministic answer was produced|no completed brightdata leads were recoverable|no brightdata-backed evidence|initial search returned only generic|follow-up search timed out|returned no results matching|no results matching|no hiring leads found|bounded retrieval|lead with a .* angle tied to the active signal|points to insufficient_signal|current dossier evidence points to insufficient[_ ]signal|searches? (for|across).* (returned|found) no|limited to unrelated|kind:\s*summary(\.|;|$)|kind:\s*summary;\s*value:\s*(;|null)|value:\s*null|summary:\s*null|raw structured output:\s*(;|null)|no web evidence found|insufficient signal|^\[object object\]$)/i.test(text)
}

function firstMeaningfulCommercialText(values) {
  return values.map(toText).find(hasMeaningfulCommercialText) || ''
}

function isConciseBuyerTargetText(value) {
  const text = toText(value)
  if (!hasMeaningfulCommercialText(text)) return false
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(text) || /^\d{4}$/.test(text)) return false
  const words = text.split(/\s+/).filter(Boolean)
  if (text.length > 90 || words.length > 8) return false
  return !/[.;:]|\b(leverages?|comprising|comprises|including|technology stack|partnership stack|website|wordpress|woocommerce|evidence|summary)\b/i.test(text)
}

function firstConciseBuyerTargetText(values) {
  return values.map(toText).find(isConciseBuyerTargetText) || ''
}

function normalizedEntityType(value) {
  return String(value || '').trim().toLowerCase().replace(/-/g, '_')
}

function checkedSource(record, rationale) {
  return {
    source: toText(record?.evidence_url) || 'bounded_question_retrieval',
    rationale,
  }
}

function normalizeUpstreamAnswer(record, adjacentAnswers = {}, entityInfo = {}) {
  if (!record || typeof record !== 'object') return null
  const questionId = String(record.question_id || record.id || '').trim()
  if (!UPSTREAM_QUESTION_IDS.has(questionId)) return null
  const entityType = normalizedEntityType(record.entity_type || entityInfo.entity_type)
  const currentStructuredSignal = asRecord(record.structured_signal || answerRaw(record).structured_signal)
  const normalized = {
    ...record,
    checked_sources: asArray(record.checked_sources),
    applicability: asRecord(record.applicability).status ? record.applicability : { status: 'applicable' },
    structured_signal: currentStructuredSignal,
    commercial_implication: toText(record.commercial_implication),
  }

  if (questionId === 'q1_foundation' && NON_SPORT_ENTITY_TYPES.has(entityType)) {
    const reason = `${entityType || 'this entity type'} is outside the canonical organisation foundation target shape.`
    return {
      ...normalized,
      validation_state: 'not_applicable',
      confidence: 0,
      applicability: { status: 'not_applicable', reason },
      checked_sources: [checkedSource(record, reason)],
      commercial_implication: 'Entity is outside the canonical organisation dossier target shape.',
      structured_signal: {
        ...currentStructuredSignal,
        entity_classification: entityType === 'person' ? 'person' : entityType,
      },
      force: true,
    }
  }

  if (['q4_performance', 'q5_league_context'].includes(questionId) && NON_SPORT_ENTITY_TYPES.has(entityType)) {
    const reason = `${questionId} applies to current sport organisations, not ${entityType || 'this entity type'}.`
    return {
      ...normalized,
      validation_state: 'not_applicable',
      confidence: 0,
      applicability: { status: 'not_applicable', reason },
      checked_sources: [checkedSource(record, reason)],
      commercial_implication: 'Question not applicable to this entity type.',
      structured_signal: {
        ...currentStructuredSignal,
        status: 'not_applicable',
      },
      force: true,
    }
  }

  if (questionId === 'q2_digital_stack') {
    const q6 = adjacentAnswers.q6_launch_signal
    const q6Evidence = recordCommercialEvidence(q6)
    if (hasMeaningfulCommercialText(q6Evidence)) {
      return {
        ...normalized,
        structured_signal: {
          ...currentStructuredSignal,
          digital_footprint_unknown: ['failed', 'no_signal', 'unknown', ''].includes(String(record.validation_state || '').toLowerCase()),
          adjacent_digital_hints: [{
            source_question_id: 'q6_launch_signal',
            summary: q6Evidence,
            evidence_url: toText(q6?.evidence_url),
          }],
        },
        commercial_implication: normalized.commercial_implication || 'Adjacent launch evidence suggests digital footprint worth verifying.',
        force: true,
      }
    }
  }

  const state = String(record.validation_state || '').trim().toLowerCase()
  const text = toText(record.answer || record.summary || record.commercial_implication)
  const checkedAbsent = state === 'no_signal'
    || /returned no relevant results|returned no results|no evidence|no hiring leads found|checked absence/i.test(text)
  if (checkedAbsent) {
    const rationale = text || 'Checked sources did not produce a relevant signal.'
    return {
      ...normalized,
      validation_state: 'no_signal',
      confidence: 0,
      checked_sources: normalized.checked_sources.length > 0 ? normalized.checked_sources : [checkedSource(record, rationale)],
      structured_signal: {
        ...currentStructuredSignal,
        status: 'checked_absent',
        checked_absence_rationale: rationale,
      },
      commercial_implication: normalized.commercial_implication || 'No current buying-motion evidence found in checked sources.',
      force: true,
    }
  }

  return null
}

function inferYellowPantherService(signalText, capabilityGapText = '') {
  const combined = `${signalText} ${capabilityGapText}`.toLowerCase()
  if (/\b(app|platform|digital|ott|product|launch|website|fan experience|ticketing|stack|analytics|video|web3)\b/.test(combined)) {
    return 'DIGITAL_TRANSFORMATION'
  }
  if (/\b(procurement|vendor|rfp|tender|commercial|partnership|sponsor|sponsorship|revenue)\b/.test(combined)) {
    return 'COMMERCIAL_PARTNERSHIPS'
  }
  if (/\b(hiring|recruitment|delivery|programme|program|project)\b/.test(combined)) {
    return 'PROJECT_DELIVERY'
  }
  if (/\b(strategy|growth|planning|positioning)\b/.test(combined)) {
    return 'STRATEGY'
  }
  return 'STAKEHOLDER_ENGAGEMENT'
}

function recordCommercialEvidence(record, fields = []) {
  if (!record || !validatedOrProvisional(record) || Number(record.confidence || 0) <= 0) return ''
  const raw = answerRaw(record)
  return firstMeaningfulCommercialText([
    ...fields.map((field) => raw[field]),
    raw.commercial_implication,
    raw.summary,
    raw.answer,
    record.summary,
    record.answer,
  ])
}

function questionAnswerMap(dossierData) {
  return Object.fromEntries(answerRecords(dossierData).map((answer) => [String(answer.question_id || '').trim(), answer]))
}

function makeStructuredAnswer(kind, summary, rawStructuredOutput) {
  return {
    kind,
    value: summary,
    summary,
    raw_structured_output: rawStructuredOutput,
  }
}

function makeInsufficientPatch(questionId, reason, sourceQuestions = []) {
  return {
    validation_state: 'no_signal',
    confidence: 0,
    answer: makeStructuredAnswer('scorecard', 'insufficient_signal', {
      answer: 'insufficient_signal',
      summary: reason,
      status: 'insufficient_signal',
      confidence_caveat: reason,
    }),
    evidence_url: '',
    primary_owner: null,
    source_questions: sourceQuestions.length > 0 ? sourceQuestions : [questionId],
    force: true,
  }
}

function answerRaw(record) {
  const answer = asRecord(record?.answer)
  return asRecord(answer.raw_structured_output || answer)
}

function validatedOrProvisional(record) {
  const state = String(record?.validation_state || '').trim().toLowerCase()
  return ['validated', 'confirmed', 'provisional'].includes(state)
}

function stalePositiveRecord(record) {
  return Boolean(record)
    && (validatedOrProvisional(record) || Number(record?.confidence || 0) > 0)
}

function insufficientSignalRecord(record) {
  const raw = answerRaw(record)
  return /(^|[\s:;])insufficient[_ ]signal([\s:;]|$)/i.test(toText([
    record?.answer,
    record?.summary,
    raw.answer,
    raw.summary,
    raw.status,
  ]))
}

function candidateRoleScore(candidate) {
  const haystack = [
    candidate?.title,
    candidate?.role,
    candidate?.function,
    candidate?.function_type,
    candidate?.department,
    candidate?.summary,
  ].map((value) => String(value || '').toLowerCase()).join(' ')
  if (/\b(chief commercial officer|cco|commercial director|head of commercial|commercial)\b/.test(haystack)) return 100
  if (/\b(partnerships?|sponsorship|business development|revenue)\b/.test(haystack)) return 90
  if (/\b(digital|product|technology|data|marketing|growth|strategy)\b/.test(haystack)) return 80
  if (/\b(chief executive|ceo|managing director|general manager)\b/.test(haystack)) return 70
  return 0
}

const BUYER_TITLE_PATTERN = '(Chief Commercial Officer|Commercial Director|Head of Commercial|Head of Partnerships|Partnerships Director|Sponsorship Director|Business Development Director|Chief Marketing Officer|Marketing Director|Chief Digital Officer|Digital Director|Chief Technology Officer|Technology Director|Product Director|Strategy Director|Chief Executive Officer|Managing Director|General Manager|CEO|CCO|CMO|CDO|CTO)'

function leadershipCandidatesFromText(value) {
  const text = toText(value)
  if (!hasMeaningfulCommercialText(text)) return []
  const candidates = []
  const patterns = [
    new RegExp(`\\b([A-Z][a-z]+(?:[-' ][A-Z][a-z]+){1,3})\\s*,\\s*${BUYER_TITLE_PATTERN}\\b`, 'g'),
    new RegExp(`\\b([A-Z][a-z]+(?:[-' ][A-Z][a-z]+){1,3})\\s+(?:is|as|serves as|acts as|was named|leads[^.]{0,60}as)\\s+(?:the\\s+)?${BUYER_TITLE_PATTERN}\\b`, 'g'),
  ]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      candidates.push({
        name: match[1],
        title: match[2],
        summary: text,
      })
    }
  }
  return candidates
}

function normalizeLeadershipCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') return null
  const name = firstConciseBuyerTargetText([
    candidate.name,
    candidate.full_name,
    candidate.person_name,
    candidate.label,
  ])
  const title = firstMeaningfulCommercialText([
    candidate.title,
    candidate.role,
    candidate.job_title,
    candidate.position,
  ])
  const score = candidateRoleScore(candidate)
  if (!name || score <= 0) return null
  return {
    name,
    title,
    function: firstMeaningfulCommercialText([candidate.function, candidate.function_type, candidate.department]),
    evidence_url: firstMeaningfulCommercialText([candidate.evidence_url, candidate.url, candidate.linkedin_url]),
    score,
  }
}

function leadershipBuyerCandidate(answers) {
  const q3 = answers.q3_leadership
  if (!validatedOrProvisional(q3)) return null
  const raw = answerRaw(q3)
  return [
    ...asArray(raw.candidates),
    ...asArray(raw.people),
    ...asArray(raw.leadership),
    ...asArray(raw.ranked_people),
    raw.primary_owner && typeof raw.primary_owner === 'object' ? raw.primary_owner : null,
    ...leadershipCandidatesFromText(q3.answer),
  ]
    .filter(Boolean)
    .map(normalizeLeadershipCandidate)
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)[0] || null
}

function decisionOwnerCandidate(record) {
  if (!validatedOrProvisional(record)) return null
  const raw = answerRaw(record)
  const primaryOwner = asRecord(raw.primary_owner || record?.primary_owner)
  const proseCandidates = leadershipCandidatesFromText(record?.answer)
  return [
    primaryOwner,
    ...proseCandidates,
    raw,
  ]
    .filter(Boolean)
    .map(normalizeLeadershipCandidate)
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)[0] || null
}

function shouldUsePatch(record, patch) {
  if (!patch) return false
  if (patch.force) return true
  const existingConfidence = Number(record?.confidence || 0)
  return Number(patch.confidence || 0) > existingConfidence
    || ['no_signal', 'failed', 'blocked', 'exhausted', 'unknown', ''].includes(String(record?.validation_state || '').trim().toLowerCase())
}

function patchAnswerArray(records, patchByQuestionId) {
  if (!Array.isArray(records)) return records
  return records.map((record) => {
    if (!record || typeof record !== 'object') return record
    const questionId = String(record.question_id || record.id || '').trim()
    const patch = patchByQuestionId[questionId]
    if (!shouldUsePatch(record, patch)) return record
    return {
      ...record,
      validation_state: patch.validation_state,
      confidence: patch.confidence,
      answer: patch.answer,
      checked_sources: patch.checked_sources || record.checked_sources,
      applicability: patch.applicability || record.applicability,
      structured_signal: patch.structured_signal || record.structured_signal,
      commercial_implication: patch.commercial_implication || record.commercial_implication,
      evidence_url: patch.evidence_url || record.evidence_url || '',
      primary_owner: Object.prototype.hasOwnProperty.call(patch, 'primary_owner') ? patch.primary_owner : record.primary_owner,
      reasoning: {
        ...(asRecord(record.reasoning)),
        structured_output: asRecord(patch.answer).raw_structured_output || patch.structured_signal || asRecord(record.reasoning).structured_output,
      },
      prompt_trace: {
        provider: 'deterministic_repair',
        source: 'repair-question-first-dossier-quality',
        source_questions: patch.source_questions,
      },
    }
  })
}

function patchQuestionRecordContainers(dossier, patchByQuestionId) {
  const next = { ...dossier }
  next.answers = patchAnswerArray(next.answers, patchByQuestionId)
  next.questions = patchAnswerArray(next.questions, patchByQuestionId)
  next.question_first = {
    ...asRecord(next.question_first),
    answers: patchAnswerArray(asRecord(next.question_first).answers, patchByQuestionId),
    answer_records: patchAnswerArray(asRecord(next.question_first).answer_records, patchByQuestionId),
    questions: patchAnswerArray(asRecord(next.question_first).questions, patchByQuestionId),
  }
  const metadata = asRecord(next.metadata)
  const checkpoint = asRecord(next.question_first_checkpoint || metadata.question_first_checkpoint)
  const patchedCheckpoint = {
    ...checkpoint,
    answers: patchAnswerArray(checkpoint.answers, patchByQuestionId),
    answer_records: patchAnswerArray(checkpoint.answer_records, patchByQuestionId),
  }
  next.question_first_checkpoint = Object.keys(patchedCheckpoint).length > 0 ? patchedCheckpoint : next.question_first_checkpoint
  next.metadata = {
    ...metadata,
    question_first_checkpoint: Object.keys(patchedCheckpoint).length > 0 ? patchedCheckpoint : metadata.question_first_checkpoint,
  }
  return next
}

function buildQuestionRecordPatches(repairedDossier) {
  const answers = questionAnswerMap(repairedDossier)
  const discoverySummary = asRecord(repairedDossier.discovery_summary || asRecord(repairedDossier.question_first).discovery_summary)
  const brief = asRecord(discoverySummary.graphiti_sales_brief || repairedDossier.graphiti_sales_brief)
  const fit = asRecord(discoverySummary.yellow_panther_fit || repairedDossier.yellow_panther_fit || discoverySummary.yellow_panther_opportunity)
  const outreach = asRecord(discoverySummary.outreach_strategy || repairedDossier.outreach_strategy)
  const patches = {}
  const leadershipBuyer = leadershipBuyerCandidate(answers)

  if (leadershipBuyer) {
    const confidence = Math.max(0.5, Math.min(0.72, (Number(answers.q3_leadership?.confidence || 0) || 0.65) - 0.12))
    const summary = `${leadershipBuyer.name}${leadershipBuyer.title ? ` (${leadershipBuyer.title})` : ''} is the strongest buyer hypothesis from leadership evidence.`
    patches.q11_decision_owner = {
      validation_state: 'provisional',
      confidence,
      answer: makeStructuredAnswer('person', summary, {
        answer: leadershipBuyer.name,
        summary,
        primary_owner: {
          name: leadershipBuyer.name,
          title: leadershipBuyer.title,
          function: leadershipBuyer.function,
          evidence_url: leadershipBuyer.evidence_url,
        },
        structured_signal: {
          decision_owner_name: leadershipBuyer.name,
          decision_owner_title: leadershipBuyer.title,
          buyer_function: leadershipBuyer.function || 'commercial',
        },
        verification_needed: `Confirm ${leadershipBuyer.name} still owns the commercial or digital buying motion before outreach.`,
      }),
      evidence_url: leadershipBuyer.evidence_url,
      source_questions: ['q3_leadership'],
    }
  }

  if (
    !patches.q11_decision_owner
    && stalePositiveRecord(answers.q11_decision_owner)
    && (insufficientSignalRecord(answers.q11_decision_owner) || !decisionOwnerCandidate(answers.q11_decision_owner))
  ) {
    patches.q11_decision_owner = makeInsufficientPatch(
      'q11_decision_owner',
      'Insufficient named buyer evidence for decision-owner synthesis.',
      ['q3_leadership'],
    )
  }

  const q11PatchRaw = asRecord(patches.q11_decision_owner?.answer?.raw_structured_output)
  const q11PatchOwner = asRecord(q11PatchRaw.primary_owner)
  const q11HasInsufficientSignal = insufficientSignalRecord(answers.q11_decision_owner)
  const existingDecisionOwner = q11HasInsufficientSignal
    ? null
    : decisionOwnerCandidate(answers.q11_decision_owner)
  const q12TargetSource = firstConciseBuyerTargetText([
    q11PatchOwner.name,
    existingDecisionOwner?.name,
    q11HasInsufficientSignal ? '' : brief.buyer_name,
    q11HasInsufficientSignal ? '' : brief.outreach_target,
  ])
  if (hasMeaningfulCommercialText(q12TargetSource)) {
    const target = q12TargetSource
    const route = firstMeaningfulCommercialText([brief.outreach_route, brief.path_type]) || 'cold_verification'
    const summary = `${target} is the buyer path to verify via ${route}.`
    const raw = {
      answer: summary,
      summary,
      target_person: target,
      target_role: toText(brief.buyer_title || q11PatchOwner.title || existingDecisionOwner?.title),
      best_yp_owner: toText(brief.best_path_owner || brief.recommended_owner),
      recommended_route: route,
      buyer_relevance: 'decision_owner',
      route_confidence: 0.52,
      verification_needed: `Confirm ${target} is still the right owner and verify the warmest current intro path.`,
    }
    patches.q12_connections = {
      validation_state: 'provisional',
      confidence: Math.max(0.45, Number(answers.q12_connections?.confidence || 0), 0.52),
      answer: makeStructuredAnswer('connections_path', summary, raw),
      source_questions: ['q11_decision_owner'],
    }
  }

  const q13Raw = asRecord(asRecord(answers.q13_capability_gap?.answer).raw_structured_output || answers.q13_capability_gap?.answer)
  const topGap = firstMeaningfulCommercialText([
    q13Raw.top_gap,
    q13Raw.gap_label,
    q13Raw.answer,
    q13Raw.summary,
    fit.fit_rationale,
    fit.best_service,
  ])
  if (topGap && hasMeaningfulCommercialText(topGap)) {
    const raw = {
      answer: topGap,
      summary: topGap,
      top_gap: topGap,
      gap_label: topGap,
      evidence_basis: asArray(fit.evidence_basis),
    }
    patches.q13_capability_gap = {
      validation_state: 'provisional',
      confidence: Math.max(0.45, Number(answers.q13_capability_gap?.confidence || 0), 0.55),
      answer: makeStructuredAnswer('scorecard', topGap, raw),
      source_questions: ['q2_digital_stack', 'q6_launch_signal', 'q7_procurement_signal', 'q9_news_signal', 'q10_hiring_signal'],
    }
  }

  if (!q11HasInsufficientSignal && String(fit.status || '').toLowerCase() === 'available' && hasMeaningfulCommercialText(fit.fit_rationale || fit.best_service)) {
    const summary = firstMeaningfulCommercialText([fit.fit_rationale, fit.best_service])
    const raw = {
      answer: summary,
      summary,
      best_service: toText(fit.best_service || fit.recommended_service),
      service_fit: asArray(fit.service_fit).length > 0 ? fit.service_fit : [toText(fit.best_service)].filter(Boolean),
      fit_rationale: summary,
      buyer_context: firstConciseBuyerTargetText([fit.buyer_context, q11HasInsufficientSignal ? '' : brief.buyer_name]) || null,
      evidence_basis: asArray(fit.evidence_basis),
      confidence_caveat: toText(fit.confidence_caveat) || 'Verify recency and buyer ownership before outreach.',
      status: 'available',
    }
    patches.q14_yp_fit = {
      validation_state: 'provisional',
      confidence: Math.max(0.5, Number(answers.q14_yp_fit?.confidence || 0), 0.58),
      answer: makeStructuredAnswer('scorecard', summary, raw),
      source_questions: ['q6_launch_signal', 'q11_decision_owner', 'q12_connections', 'q13_capability_gap'],
    }
  }

  if (!patches.q14_yp_fit) {
    const fallbackSignals = [
      ['q6_launch_signal', recordCommercialEvidence(answers.q6_launch_signal)],
      ['q2_digital_stack', recordCommercialEvidence(answers.q2_digital_stack)],
      ['q7_procurement_signal', recordCommercialEvidence(answers.q7_procurement_signal)],
      ['q9_news_signal', recordCommercialEvidence(answers.q9_news_signal)],
      ['q10_hiring_signal', recordCommercialEvidence(answers.q10_hiring_signal)],
      ['q13_capability_gap', recordCommercialEvidence(answers.q13_capability_gap, ['top_gap', 'gap_label'])],
    ].find(([, evidence]) => hasMeaningfulCommercialText(evidence))
    if (fallbackSignals) {
      const [sourceQuestion, evidenceText] = fallbackSignals
      const capabilityGap = sourceQuestion === 'q13_capability_gap' ? evidenceText : topGap
      const bestService = inferYellowPantherService(evidenceText, capabilityGap)
      const summary = `${bestService.replace(/_/g, ' ')} is the strongest capability match because current dossier evidence points to ${evidenceText.toLowerCase()}.`
      const raw = {
        answer: summary,
        summary,
        best_service: bestService,
        service_fit: [bestService],
        fit_rationale: summary,
        buyer_context: firstConciseBuyerTargetText([q11HasInsufficientSignal ? '' : brief.buyer_name, q12TargetSource]) || null,
        evidence_basis: [sourceQuestion, evidenceText].filter(Boolean),
        confidence_caveat: 'Verify recency and buyer ownership before outreach.',
        status: 'available',
      }
      patches.q14_yp_fit = {
        validation_state: 'provisional',
        confidence: Math.max(0.5, Number(answers.q14_yp_fit?.confidence || 0), 0.58),
        answer: makeStructuredAnswer('scorecard', summary, raw),
        source_questions: [sourceQuestion],
      }
    }
  }

  if (!q11HasInsufficientSignal && String(outreach.status || '').toLowerCase() === 'available' && hasMeaningfulCommercialText(outreach.recommended_target || outreach.recommended_angle || outreach.first_message_strategy)) {
    const q12Raw = asRecord(asRecord(answers.q12_connections?.answer).raw_structured_output || answers.q12_connections?.answer)
    const q11Raw = asRecord(asRecord(answers.q11_decision_owner?.answer).raw_structured_output || answers.q11_decision_owner?.answer)
    const q11Owner = asRecord(q11Raw.primary_owner)
    const currentQ15Raw = asRecord(asRecord(answers.q15_outreach_strategy?.answer).raw_structured_output || answers.q15_outreach_strategy?.answer)
    const target = firstConciseBuyerTargetText([outreach.recommended_target, brief.outreach_target, brief.buyer_name, q12Raw.target_person, q11Owner.name])
    const angle = firstMeaningfulCommercialText([outreach.recommended_angle, outreach.why_now, outreach.first_message_strategy])
    const summary = `${target || 'Verify the buyer'}: ${angle}`
    const raw = {
      answer: summary,
      summary,
      recommended_target: target || null,
      recommended_route: toText(outreach.recommended_route || brief.outreach_route) || 'cold_verification',
      recommended_angle: angle,
      first_message_strategy: toText(outreach.first_message_strategy),
      verification_needed: toText(outreach.verification_needed) || 'Validate signal recency and confirm the right buyer route before outreach.',
      why_now: toText(outreach.why_now || angle),
      status: 'available',
    }
    patches.q15_outreach_strategy = {
      validation_state: 'provisional',
      confidence: Math.max(0.48, Number(answers.q15_outreach_strategy?.confidence || 0), 0.56),
      answer: makeStructuredAnswer('scorecard', summary, raw),
      source_questions: ['q6_launch_signal', 'q11_decision_owner', 'q12_connections', 'q14_yp_fit'],
      force: Boolean(target && !firstMeaningfulCommercialText([currentQ15Raw.recommended_target])),
    }
  }

  if (!patches.q15_outreach_strategy) {
    const q12Raw = asRecord(asRecord(answers.q12_connections?.answer).raw_structured_output || answers.q12_connections?.answer)
    const currentQ15Raw = asRecord(asRecord(answers.q15_outreach_strategy?.answer).raw_structured_output || answers.q15_outreach_strategy?.answer)
    const target = firstConciseBuyerTargetText([q12Raw.target_person])
    const angle = firstMeaningfulCommercialText([
      currentQ15Raw.recommended_angle,
      currentQ15Raw.why_now,
      currentQ15Raw.first_message_strategy,
      String(fit.status || '').toLowerCase() === 'available' ? fit.fit_rationale : '',
    ])
    if (target && angle) {
      const summary = `${target}: ${angle}`
      const raw = {
        answer: summary,
        summary,
        recommended_target: target,
        recommended_route: toText(q12Raw.recommended_route || brief.outreach_route) || 'cold_verification',
        recommended_angle: angle,
        first_message_strategy: firstMeaningfulCommercialText([
          currentQ15Raw.first_message_strategy,
          `Open with the validated signal, connect it to the relevant Yellow Panther capability, and ask for a short discovery call with ${target}.`,
        ]),
        verification_needed: toText(currentQ15Raw.verification_needed) || `Confirm ${target} is still the right owner and validate signal recency before outreach.`,
        why_now: firstMeaningfulCommercialText([currentQ15Raw.why_now, angle]),
        status: 'available',
      }
      patches.q15_outreach_strategy = {
        validation_state: 'provisional',
        confidence: Math.max(0.48, Number(answers.q15_outreach_strategy?.confidence || 0), 0.56),
        answer: makeStructuredAnswer('scorecard', summary, raw),
        source_questions: ['q12_connections', 'q14_yp_fit'],
        force: true,
      }
    }
  }

  const currentQ14Text = toText(answers.q14_yp_fit?.answer)
  const q14PatchText = toText(patches.q14_yp_fit?.answer)
  if (stalePositiveRecord(answers.q14_yp_fit) && !hasMeaningfulCommercialText(currentQ14Text) && (!patches.q14_yp_fit || !hasMeaningfulCommercialText(q14PatchText))) {
    patches.q14_yp_fit = makeInsufficientPatch('q14_yp_fit', 'Insufficient commercial evidence for Yellow Panther fit.', ['q6_launch_signal', 'q13_capability_gap'])
  }
  const currentQ15Text = toText(answers.q15_outreach_strategy?.answer)
  const q15PatchText = toText(patches.q15_outreach_strategy?.answer)
  if (stalePositiveRecord(answers.q15_outreach_strategy) && !hasMeaningfulCommercialText(currentQ15Text) && (!patches.q15_outreach_strategy || !hasMeaningfulCommercialText(q15PatchText))) {
    patches.q15_outreach_strategy = makeInsufficientPatch('q15_outreach_strategy', 'Insufficient commercial evidence for outreach strategy.', ['q11_decision_owner', 'q12_connections', 'q14_yp_fit'])
  }

  return patches
}

function buildUpstreamNormalizationPatches(repairedDossier, entityInfo = {}) {
  const answers = questionAnswerMap(repairedDossier)
  return Object.fromEntries(
    Object.values(answers)
      .map((record) => {
        const questionId = String(record?.question_id || record?.id || '').trim()
        if (!UPSTREAM_QUESTION_IDS.has(questionId)) return null
        const patch = normalizeUpstreamAnswer(record, answers, {
          entity_type: entityInfo.entity_type || repairedDossier.entity_type,
        })
        if (!patch) return null
        return [questionId, patch]
      })
      .filter(Boolean),
  )
}

function filterPatchQuestions(patches, questions = []) {
  const allowed = new Set(asArray(questions).filter(Boolean))
  if (allowed.size === 0) return patches
  return Object.fromEntries(Object.entries(patches).filter(([questionId]) => allowed.has(questionId)))
}

function repairQuestionAnswerRecords(repairedDossier, entityInfo = {}, options = {}) {
  const upstreamPatches = filterPatchQuestions(buildUpstreamNormalizationPatches(repairedDossier, entityInfo), options.questions)
  const upstreamRepaired = Object.keys(upstreamPatches).length > 0
    ? patchQuestionRecordContainers(repairedDossier, upstreamPatches)
    : repairedDossier
  const synthesisPatches = filterPatchQuestions(buildQuestionRecordPatches(upstreamRepaired), options.questions)
  return Object.keys(synthesisPatches).length > 0
    ? patchQuestionRecordContainers(upstreamRepaired, synthesisPatches)
    : upstreamRepaired
}

function clearStaleBuyerArtifacts(dossier) {
  const discoverySummary = asRecord(dossier.discovery_summary)
  const questionFirst = asRecord(dossier.question_first)
  const questionFirstSummary = asRecord(questionFirst.discovery_summary)
  const clearSummary = (summary) => ({
    ...summary,
    graphiti_sales_brief: null,
    outreach_strategy: null,
  })
  return {
    ...dossier,
    graphiti_sales_brief: null,
    outreach_strategy: null,
    discovery_summary: clearSummary(discoverySummary),
    question_first: {
      ...questionFirst,
      discovery_summary: clearSummary(questionFirstSummary),
    },
  }
}

export function answerRecords(dossierData) {
  const dossier = asRecord(dossierData)
  const questionFirst = asRecord(dossier.question_first)
  const metadata = asRecord(dossier.metadata)
  const checkpoint = asRecord(dossier.question_first_checkpoint || metadata.question_first_checkpoint)
  const report = asRecord(dossier.question_first_report)
  const records = [
    questionFirst.answer_records,
    questionFirst.answers,
    questionFirst.questions,
    checkpoint.answer_records,
    checkpoint.answers,
    dossier.answers,
    dossier.questions,
    report.answers,
  ].flatMap((value) => asArray(value).filter((item) => item && typeof item === 'object'))
  const byQuestion = new Map()
  records.forEach((record, index) => {
    const questionId = String(record.question_id || record.id || '').trim()
    byQuestion.set(questionId || `unkeyed:${index}`, record)
  })
  return Array.from(byQuestion.values())
}

function hasRepairableBuyerRouteMiss(dossierData) {
  const answers = questionAnswerMap(dossierData)
  return answerRecords(dossierData).length >= 15
    && Boolean(decisionOwnerCandidate(answers.q11_decision_owner))
    && Number(answers.q12_connections?.confidence || 0) === 0
}

function isFailedUpstreamRecord(record) {
  if (!record) return false
  const state = String(record?.validation_state || '').trim().toLowerCase()
  return ['failed', 'tool_call_missing', 'unknown', 'blocked', ''].includes(state)
    || /provider infrastructure failure|insufficient balance|question execution failed|no deterministic answer was produced/i.test(toText(record?.answer || record?.commercial_implication))
}

function hasPromisingCommercialContext(answers) {
  return [
    recordCommercialEvidence(answers.q2_digital_stack),
    recordCommercialEvidence(answers.q6_launch_signal),
    recordCommercialEvidence(answers.q7_procurement_signal),
    recordCommercialEvidence(answers.q9_news_signal),
    recordCommercialEvidence(answers.q10_hiring_signal),
    recordCommercialEvidence(answers.q13_capability_gap, ['top_gap', 'gap_label']),
  ].some(hasMeaningfulCommercialText)
    || Boolean(leadershipBuyerCandidate(answers))
    || Boolean(decisionOwnerCandidate(answers.q11_decision_owner))
}

export function buildTargetedRerunRecommendations(dossierData, entityInfo = {}, options = {}) {
  const answers = questionAnswerMap(dossierData)
  const allowedQuestions = new Set(asArray(options.questions).filter(Boolean))
  if (!hasPromisingCommercialContext(answers)) return []

  return PRIORITY_RERUN_QUESTION_IDS
    .filter((questionId) => allowedQuestions.size === 0 || allowedQuestions.has(questionId))
    .filter((questionId) => isFailedUpstreamRecord(answers[questionId]))
    .map((questionId) => ({
      canonical_entity_id: String(entityInfo.canonicalEntityId || entityInfo.canonical_entity_id || dossierData?.entity_id || '').trim() || null,
      entity_name: String(entityInfo.entityName || entityInfo.entity_name || dossierData?.entity_name || '').trim() || null,
      question_id: questionId,
      reason: 'upstream_failed_blocks_commercial_synthesis',
      expected_unlock: 'Improves q1-q10 evidence quality and can unlock q11-q15 buyer/fit/outreach synthesis.',
    }))
}

export function shouldRepairDossier(dossierData) {
  const dossier = asRecord(dossierData)
  const discoverySummary = asRecord(dossier.discovery_summary || asRecord(dossier.question_first).discovery_summary)
  const graphitiSalesBrief = asRecord(discoverySummary.graphiti_sales_brief || dossier.graphiti_sales_brief)
  const yellowPantherFit = asRecord(discoverySummary.yellow_panther_fit || discoverySummary.yellow_panther_opportunity || dossier.yellow_panther_fit)
  const publishStatus = String(dossier.publish_status || dossier.publication_status || '').toLowerCase()
  const answers = answerRecords(dossier)
  return answers.length >= 15
    && (
      publishStatus.startsWith('published')
      || String(graphitiSalesBrief.status || '').toLowerCase() !== 'available'
      || !String(yellowPantherFit.fit_rationale || yellowPantherFit.fit_feedback || '').trim()
      || hasRepairableBuyerRouteMiss(dossier)
    )
}

export function repairDossierPayload(dossierData, canonicalEntityId, entityInfo = {}, options = {}) {
  const dossier = asRecord(dossierData)
  const entity = {
    id: canonicalEntityId || dossier.entity_id,
    entity_uuid: canonicalEntityId || dossier.entity_id,
    properties: {
      name: entityInfo.entity_name || dossier.entity_name,
      type: entityInfo.entity_type || dossier.entity_type,
    },
  }
  const entityId = String(canonicalEntityId || dossier.entity_id || '')
  const repairedAnswers = repairQuestionAnswerRecords(
    normalizeQuestionFirstDossier(dossier, entityId, entity),
    entityInfo,
    options,
  )
  const normalizedInput = insufficientSignalRecord(questionAnswerMap(repairedAnswers).q11_decision_owner)
    ? clearStaleBuyerArtifacts(repairedAnswers)
    : repairedAnswers
  const normalized = normalizeQuestionFirstDossier(normalizedInput, entityId, entity)
  return {
    changed: contentHash(dossier) !== contentHash(normalized),
    before_publish_status: dossier.publish_status || dossier.publication_status || null,
    after_publish_status: normalized.publish_status || normalized.publication_status || null,
    before_quality_state: dossier.quality_state || null,
    after_quality_state: normalized.quality_state || null,
    repaired_dossier: normalized,
  }
}

async function loadCandidateRows(pool, limit, entityId = null) {
  const entityFilter = entityId
    ? 'and (canonical_entity_id::text = $2 or entity_name = $2)'
    : ''
  const params = entityId ? [limit, entityId] : [limit]
  const result = await pool.query(`
    select
      id,
      canonical_entity_id::text as canonical_entity_id,
      entity_name,
      entity_type,
      dossier_data
    from entity_dossiers
    where canonical_entity_id is not null
      ${entityFilter}
    order by coalesce(generated_at, updated_at, created_at) desc nulls last
    limit $1
  `, params)
  return result.rows
}

async function main() {
  const { apply, dryRun, limit, entityId, questions, rerunPlanOutput } = parseArgs()
  const pool = createPgPool()
  const summary = {
    apply,
    dry_run: dryRun,
    limit,
    entity_id: entityId,
    questions,
    scanned: 0,
    eligible: 0,
    changed: 0,
    updated: 0,
    demoted_to_partial: 0,
    q14_filled: 0,
    q15_filled: 0,
    rerun_recommendations: 0,
  }
  const rerunPlan = []

  try {
    const rows = await loadCandidateRows(pool, limit, entityId)
    for (const row of rows) {
      summary.scanned += 1
      const recommendations = buildTargetedRerunRecommendations(row.dossier_data, row, { questions })
      rerunPlan.push(...recommendations)
      if (!shouldRepairDossier(row.dossier_data)) {
        continue
      }
      summary.eligible += 1
      const repair = repairDossierPayload(row.dossier_data, row.canonical_entity_id, row, { questions })
      if (!repair.changed) {
        continue
      }
      summary.changed += 1
      const beforeAnswers = questionAnswerMap(row.dossier_data)
      const afterAnswers = questionAnswerMap(repair.repaired_dossier)
      if (Number(beforeAnswers.q14_yp_fit?.confidence || 0) === 0 && Number(afterAnswers.q14_yp_fit?.confidence || 0) > 0) {
        summary.q14_filled += 1
      }
      if (Number(beforeAnswers.q15_outreach_strategy?.confidence || 0) === 0 && Number(afterAnswers.q15_outreach_strategy?.confidence || 0) > 0) {
        summary.q15_filled += 1
      }
      if (String(repair.after_publish_status || '').toLowerCase() === 'published_partial') {
        summary.demoted_to_partial += 1
      }
      if (apply) {
        await pool.query(
          'update entity_dossiers set dossier_data = $1, updated_at = now() where id = $2',
          [repair.repaired_dossier, row.id],
        )
        summary.updated += 1
      }
    }
    summary.rerun_recommendations = rerunPlan.length
    if (rerunPlanOutput) {
      await writeFile(rerunPlanOutput, `${JSON.stringify({ generated_at: new Date().toISOString(), recommendations: rerunPlan }, null, 2)}\n`, 'utf8')
    }
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } finally {
    await pool.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`)
    process.exitCode = 1
  })
}
