#!/usr/bin/env node

import crypto from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'
import pg from 'pg'

import { normalizeQuestionFirstDossier } from '../src/lib/question-first-dossier.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

export function parseArgs(argv = process.argv.slice(2)) {
  return {
    apply: argv.includes('--apply'),
    limit: Number(argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 500),
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
    && !/(^no_signal$|^no signal$|source pending$|question execution failed|no deterministic answer was produced|no completed brightdata leads were recoverable|no brightdata-backed evidence|initial search returned only generic|follow-up search timed out|returned no results matching|no results matching|no hiring leads found|bounded retrieval|points to insufficient_signal|current dossier evidence points to insufficient[_ ]signal|searches? (for|across).* (returned|found) no|limited to unrelated|kind:\s*summary(\.|;|$)|kind:\s*summary;\s*value:\s*(;|null)|value:\s*null|summary:\s*null|raw structured output:\s*(;|null)|no web evidence found|insufficient signal|^\[object object\]$)/i.test(text)
}

function firstMeaningfulCommercialText(values) {
  return values.map(toText).find(hasMeaningfulCommercialText) || ''
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

function answerRaw(record) {
  const answer = asRecord(record?.answer)
  return asRecord(answer.raw_structured_output || answer)
}

function validatedOrProvisional(record) {
  const state = String(record?.validation_state || '').trim().toLowerCase()
  return ['validated', 'confirmed', 'provisional'].includes(state)
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
  const name = firstMeaningfulCommercialText([
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

function shouldUsePatch(record, patch) {
  if (!patch) return false
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
      evidence_url: patch.evidence_url || record.evidence_url || '',
      reasoning: {
        ...(asRecord(record.reasoning)),
        structured_output: patch.answer.raw_structured_output,
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

  const q11PatchRaw = asRecord(patches.q11_decision_owner?.answer?.raw_structured_output)
  const q11PatchOwner = asRecord(q11PatchRaw.primary_owner)
  const q12TargetSource = firstMeaningfulCommercialText([brief.buyer_name, brief.outreach_target, q11PatchOwner.name])
  if ((String(brief.status || '').toLowerCase() === 'available' && hasMeaningfulCommercialText(brief.buyer_name || brief.outreach_target)) || hasMeaningfulCommercialText(q12TargetSource)) {
    const target = q12TargetSource
    const route = firstMeaningfulCommercialText([brief.outreach_route, brief.path_type]) || 'cold_verification'
    const summary = `${target} is the buyer path to verify via ${route}.`
    const raw = {
      answer: summary,
      summary,
      target_person: target,
      target_role: toText(brief.buyer_title || q11PatchOwner.title),
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

  if (String(fit.status || '').toLowerCase() === 'available' && hasMeaningfulCommercialText(fit.fit_rationale || fit.best_service)) {
    const summary = firstMeaningfulCommercialText([fit.fit_rationale, fit.best_service])
    const raw = {
      answer: summary,
      summary,
      best_service: toText(fit.best_service || fit.recommended_service),
      service_fit: asArray(fit.service_fit).length > 0 ? fit.service_fit : [toText(fit.best_service)].filter(Boolean),
      fit_rationale: summary,
      buyer_context: fit.buyer_context || brief.buyer_name || null,
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

  if (String(outreach.status || '').toLowerCase() === 'available' && hasMeaningfulCommercialText(outreach.recommended_target || outreach.recommended_angle || outreach.first_message_strategy)) {
    const target = firstMeaningfulCommercialText([outreach.recommended_target, brief.outreach_target, brief.buyer_name])
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
    }
  }

  return patches
}

function repairQuestionAnswerRecords(repairedDossier) {
  const patches = buildQuestionRecordPatches(repairedDossier)
  return Object.keys(patches).length > 0
    ? patchQuestionRecordContainers(repairedDossier, patches)
    : repairedDossier
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
    )
}

export function repairDossierPayload(dossierData, canonicalEntityId, entityInfo = {}) {
  const dossier = asRecord(dossierData)
  const entity = {
    id: canonicalEntityId || dossier.entity_id,
    entity_uuid: canonicalEntityId || dossier.entity_id,
    properties: {
      name: entityInfo.entity_name || dossier.entity_name,
      type: entityInfo.entity_type || dossier.entity_type,
    },
  }
  const normalized = repairQuestionAnswerRecords(
    normalizeQuestionFirstDossier(dossier, String(canonicalEntityId || dossier.entity_id || ''), entity),
  )
  return {
    changed: contentHash(dossier) !== contentHash(normalized),
    before_publish_status: dossier.publish_status || dossier.publication_status || null,
    after_publish_status: normalized.publish_status || normalized.publication_status || null,
    before_quality_state: dossier.quality_state || null,
    after_quality_state: normalized.quality_state || null,
    repaired_dossier: normalized,
  }
}

async function loadCandidateRows(pool, limit) {
  const result = await pool.query(`
    select
      id,
      canonical_entity_id::text as canonical_entity_id,
      entity_name,
      entity_type,
      dossier_data
    from entity_dossiers
    where canonical_entity_id is not null
    order by coalesce(generated_at, updated_at, created_at) desc nulls last
    limit $1
  `, [limit])
  return result.rows
}

async function main() {
  const { apply, limit } = parseArgs()
  const pool = createPgPool()
  const summary = {
    apply,
    limit,
    scanned: 0,
    eligible: 0,
    changed: 0,
    updated: 0,
    demoted_to_partial: 0,
  }

  try {
    const rows = await loadCandidateRows(pool, limit)
    for (const row of rows) {
      summary.scanned += 1
      if (!shouldRepairDossier(row.dossier_data)) {
        continue
      }
      summary.eligible += 1
      const repair = repairDossierPayload(row.dossier_data, row.canonical_entity_id, row)
      if (!repair.changed) {
        continue
      }
      summary.changed += 1
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
