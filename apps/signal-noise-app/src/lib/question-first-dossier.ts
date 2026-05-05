import { existsSync, readdirSync, statSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'

import { getDossierRoots } from './dossier-paths.ts'
import { buildDossierTabs } from './dossier-tabs.ts'
import { matchesEntityUuid, resolveEntityUuid } from './entity-public-id.ts'
import { VALIDATION_ROLLOUT_PROOF_SET } from './rollout-proof-set.ts'
import { allowDemoFallbacks } from './runtime-env.ts'

type EntityLike = {
  id?: unknown
  uuid?: unknown
  entity_uuid?: unknown
  neo4j_id?: unknown
  labels?: unknown
  properties?: Record<string, unknown> | null
}

type ArtifactMatch = {
  path: string
  payload: Record<string, any>
  mtimeMs: number
}

type CanonicalArtifactSource = 'question_first_dossier' | 'question_first_run'

const QUALITY_PRIORITY: Record<string, number> = {
  missing: 0,
  partial: 1,
  blocked: 2,
  complete: 3,
  client_ready: 4,
}

const FULL_QUESTION_FIRST_PACK_SIZE = 15
const REQUIRED_QUESTION_IDS = ['q7_procurement_signal', 'q8_explicit_rfp', 'q13_capability_gap', 'q14_yp_fit']
function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value).trim()
    }
  }
  return String(value).trim()
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stripTrailingNumericSuffix(value: string): string {
  return value.replace(/[-_]\d+$/, '')
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => toText(value)).filter(Boolean)))
}

function getEntityType(entity: EntityLike | null | undefined, dossier?: Record<string, any> | null): string {
  return (
    toText(dossier?.entity_type) ||
    toText(entity?.properties?.type) ||
    (Array.isArray(entity?.labels) ? toText(entity?.labels[0]) : '') ||
    'entity'
  )
}

function getEntityName(entity: EntityLike | null | undefined, dossier?: Record<string, any> | null): string {
  return toText(dossier?.entity_name) || toText(entity?.properties?.name) || 'Unknown entity'
}

function getEntityCandidates(entityId: string, entity?: EntityLike | null): string[] {
  const name = toText(entity?.properties?.name)
  const strippedEntityId = stripTrailingNumericSuffix(entityId)
  const strippedNameSlug = stripTrailingNumericSuffix(slugify(name))
  return uniqueStrings([
    entityId,
    strippedEntityId,
    toText(entity?.uuid),
    toText(entity?.entity_uuid),
    toText(entity?.id),
    toText(entity?.neo4j_id),
    name,
    slugify(name),
    strippedNameSlug,
    name.replace(/\s+/g, '-'),
    name.replace(/\s+/g, '_'),
  ])
}

function normalizeComparableText(value: unknown): string {
  return toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function dossierMatchesEntityIdentity(
  dossier: Record<string, any>,
  entityId: string,
  entity?: EntityLike | null,
): boolean {
  const dossierEntityId = toText(dossier.entity_id)
  const dossierEntityName = toText(dossier.entity_name)
  const dossierEntityType = normalizeComparableText(dossier.entity_type)
  const entityName = toText(entity?.properties?.name)
  const entityType = normalizeComparableText(entity?.properties?.type || (Array.isArray(entity?.labels) ? entity?.labels[0] : ''))
  const entityUuid = resolveEntityUuid(entity ?? null)

  if (entityUuid && dossierEntityId && normalizeComparableText(dossierEntityId) === normalizeComparableText(entityUuid)) {
    return true
  }

  if (normalizeComparableText(dossierEntityName) && normalizeComparableText(entityName)) {
    if (normalizeComparableText(dossierEntityName) !== normalizeComparableText(entityName)) {
      return false
    }
  } else if (normalizeComparableText(dossierEntityId) && normalizeComparableText(entityId)) {
    if (normalizeComparableText(dossierEntityId) !== normalizeComparableText(entityId)) {
      return false
    }
  }

  if (entityType && dossierEntityType && dossierEntityType !== entityType) {
    return false
  }

  return true
}

function walkDirectory(root: string, maxDepth = 4): string[] {
  const files: string[] = []
  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || current.depth > maxDepth || !existsSync(current.dir)) {
      continue
    }

    for (const entry of readdirSync(current.dir, { withFileTypes: true })) {
      const entryPath = path.join(current.dir, entry.name)
      if (entry.isDirectory()) {
        stack.push({ dir: entryPath, depth: current.depth + 1 })
        continue
      }
      files.push(entryPath)
    }
  }

  return files
}

function getArtifactFiles(suffix: string): string[] {
  return getDossierRoots()
    .flatMap((root) => walkDirectory(root))
    .filter((filePath) => allowDemoFallbacks() || !filePath.includes(`${path.sep}demo${path.sep}`))
    .filter((filePath) => filePath.endsWith(suffix))
}

async function tryReadJson(filePath: string): Promise<Record<string, any> | null> {
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function matchesArtifactPayload(
  payload: Record<string, any>,
  candidates: string[],
  entity?: EntityLike | null,
): boolean {
  const payloadEntity = {
    id: payload.entity_id ?? payload.entity?.entity_id,
    uuid: payload.entity_uuid ?? payload.entity?.entity_uuid ?? payload.entity_id,
    entity_uuid: payload.entity_uuid ?? payload.entity?.entity_uuid,
    neo4j_id: payload.neo4j_id ?? payload.entity?.neo4j_id,
    properties: {
      name: payload.entity_name ?? payload.entity?.entity_name,
      type: payload.entity_type ?? payload.entity?.entity_type,
    },
  }

  const payloadNames = uniqueStrings([
    toText(payload.entity_id),
    toText(payload.entity_name),
    toText(payload.entity?.entity_id),
    toText(payload.entity?.entity_name),
  ]).map((value) => value.toLowerCase())

  const loweredCandidates = candidates.map((value) => value.toLowerCase())

  return (
    loweredCandidates.some((candidate) => payloadNames.includes(candidate)) ||
    loweredCandidates.some((candidate) => path.basename(candidate).toLowerCase() === candidate) ||
    matchesEntityUuid(payloadEntity, toText(entity?.uuid) || toText(entity?.entity_uuid) || null) ||
    matchesEntityUuid(payloadEntity, candidates[0] || null)
  )
}

async function findLatestArtifact(
  suffix: string,
  entityId: string,
  entity?: EntityLike | null,
): Promise<ArtifactMatch | null> {
  const candidates = getEntityCandidates(entityId, entity)
  const files = getArtifactFiles(suffix)
  let bestMatch: ArtifactMatch | null = null

  for (const filePath of files) {
    const filename = path.basename(filePath).toLowerCase()
    const filenameHit = candidates.some((candidate) => filename.includes(candidate.toLowerCase()))
    if (!filenameHit) {
      continue
    }

    const payload = await tryReadJson(filePath)
    if (!payload || !matchesArtifactPayload(payload, candidates, entity)) {
      continue
    }

    const mtimeMs = statSync(filePath).mtimeMs
    if (!bestMatch || mtimeMs > bestMatch.mtimeMs) {
      bestMatch = { path: filePath, payload, mtimeMs }
    }
  }

  return bestMatch
}

function ensureObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {}
}

function hasReadableValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

function toDisplayText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized === '[object Object]' ? '' : normalized
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value
      .map((entry) => toDisplayText(entry))
      .filter(Boolean)
      .join(', ')
  }
  if (typeof value === 'object') {
    const record = ensureObject(value)
    const namedValue = toText(record.url || record.href || record.title || record.label || record.answer || record.summary)
    if (namedValue) {
      return namedValue
    }
    const objectEntries = Object.entries(record).slice(0, 8)
    if (objectEntries.length > 0) {
      return objectEntries
        .map(([key, entry]) => `${key.replace(/_/g, ' ')}: ${toDisplayText(entry)}`)
        .join('; ')
    }
  }
  return toText(value)
}

function collectQuestionAnswerSources(answer: Record<string, any>, timeoutSalvage: Record<string, any>): string[] {
  const rawStructuredOutput = ensureObject(answer.raw_structured_output)
  const structuredSources = Array.isArray(rawStructuredOutput.sources) ? rawStructuredOutput.sources : []
  const salvageSources = Array.isArray(timeoutSalvage.candidate_evidence_urls) ? timeoutSalvage.candidate_evidence_urls : []
  return uniqueStrings(
    [...structuredSources, ...salvageSources]
      .map((value) => toDisplayText(value))
      .filter(Boolean),
  )
}

function getQuestionTerminalState(question: Record<string, any>): string {
  return toText(
    question.terminal_state
      ?? question.question_first_answer?.terminal_state
      ?? question.answer?.terminal_state,
  ).toLowerCase()
}

function isAnsweredQuestionState(state: string): boolean {
  return state === 'validated' || state === 'provisional'
}

function isNonBlockingQuestion(question: Record<string, any>): boolean {
  const summary = toText(
    question.terminal_summary
      ?? question.question_first_answer?.terminal_summary
      ?? question.answer?.summary,
  ).toLowerCase()
  return summary.includes('entity type') && summary.includes('is outside')
}

function deriveQuestionTerminalState(input: {
  questionSpec?: Record<string, any>
  answerRecord: Record<string, any>
  answer: Record<string, any>
  rawStructuredOutput: Record<string, any>
  timeoutSalvage: Record<string, any>
  rawAnswerValue: unknown
}): 'validated' | 'provisional' | 'no_signal' | 'blocked' | 'skipped' | 'failed' {
  const validationState = toText(input.answerRecord.validation_state).toLowerCase()
  const hasAnswerText = hasReadableValue(input.answer.summary)
    || hasReadableValue(input.answer.value)
    || hasReadableValue(input.rawStructuredOutput.answer)
    || hasReadableValue(input.rawAnswerValue)
  const blockedNote = toText(input.answerRecord.notes || input.rawStructuredOutput.notes || input.rawStructuredOutput.context).toLowerCase()
  const dependsOn = Array.isArray(input.questionSpec?.depends_on) ? input.questionSpec?.depends_on : []

  if (validationState === 'skipped' || toText(input.answerRecord.skip_reason)) {
    return 'skipped'
  }

  if (['failed', 'exhausted', 'tool_call_missing'].includes(validationState)) {
    return 'failed'
  }

  if (
    blockedNote.includes('question conditions were not met')
    || blockedNote.includes('no capability-gap inference')
    || blockedNote.includes('upstream signals are available yet')
    || blockedNote.includes('upstream signals are not available yet')
    || blockedNote.includes('upstream signals are not available')
    || (dependsOn.length > 0 && validationState === 'no_signal' && !hasAnswerText)
  ) {
    return 'blocked'
  }

  if (hasAnswerText && ['validated', 'partially_validated', 'deterministic_detected'].includes(validationState)) {
    return 'validated'
  }

  if (hasAnswerText && ['provisional', 'inferred', 'pending', 'partially_supported'].includes(validationState)) {
    return 'provisional'
  }

  return 'no_signal'
}

function deriveQuestionTerminalSummary(input: {
  questionSpec?: Record<string, any>
  answerRecord: Record<string, any>
  answer: Record<string, any>
  rawStructuredOutput: Record<string, any>
  timeoutSalvage: Record<string, any>
  terminalState: 'validated' | 'provisional' | 'no_signal' | 'blocked' | 'skipped' | 'failed'
  rawAnswerValue: unknown
}): string {
  const commercialInterpretation = ensureObject(input.answer.commercial_interpretation)
  const displayAnswer = ensureObject(input.answerRecord.display_answer || input.answer.display_answer)
  const summaryCandidates = [
    toDisplayText(displayAnswer.headline),
    toDisplayText(input.answer.summary),
    toDisplayText(input.answer.value),
    typeof input.rawAnswerValue === 'string' || typeof input.rawAnswerValue === 'number' || typeof input.rawAnswerValue === 'boolean'
      ? input.rawAnswerValue
      : null,
    toDisplayText(input.rawStructuredOutput.summary),
    toDisplayText(input.rawStructuredOutput.answer),
    commercialInterpretation.summary,
    toDisplayText(input.rawStructuredOutput.context),
    toDisplayText(input.rawStructuredOutput.notes),
    toDisplayText(input.answerRecord.notes),
  ]
    .map((value) => toDisplayText(value))
    .filter(Boolean)

  if (summaryCandidates.length > 0) {
    return summaryCandidates[0]
  }

  const salvageSummary = toText(input.timeoutSalvage.candidate_summary)
  const salvageUrls = Array.isArray(input.timeoutSalvage.candidate_evidence_urls)
    ? input.timeoutSalvage.candidate_evidence_urls.map((value: unknown) => toDisplayText(value)).filter(Boolean)
    : []
  if (salvageSummary || salvageUrls.length > 0) {
    const salvageReason = salvageSummary || 'Procurement evidence was retained, but validation timed out before a safe summary could be promoted.'
    const sourceHint = salvageUrls.length > 0
      ? ` Retained evidence: ${salvageUrls.slice(0, 2).join(', ')}.`
      : ''
    return `Validation timed out after retaining procurement evidence. ${salvageReason}${sourceHint}`
  }

  if (input.terminalState === 'skipped') {
    const reason = toText(input.answerRecord.skip_reason)
    const note = toText(input.answerRecord.skip_note)
    if (reason && note) {
      return `Skipped: ${reason}. ${note}`
    }
    if (reason) {
      return `Skipped: ${reason}`
    }
    if (note) {
      return `Skipped: ${note}`
    }
  }

  if (input.terminalState === 'blocked') {
    const dependsOn = Array.isArray(input.questionSpec?.depends_on) ? input.questionSpec?.depends_on : []
    if (dependsOn.length > 0) {
      return `Blocked by upstream question state: ${dependsOn.join(', ')}`
    }
  }

  if (input.terminalState === 'failed') {
    const failureReason = toText(input.answerRecord.failure_reason || input.answerRecord.notes || input.rawStructuredOutput.context)
    if (failureReason) {
      return failureReason
    }
    return 'Question execution failed before a safe answer could be produced.'
  }

  return 'No deterministic answer was produced for this question.'
}

function normalizeQuestionAnswerRecord(
  answerRecord: Record<string, any>,
  questionSpec?: Record<string, any>,
): Record<string, any> {
  const answer = ensureObject(answerRecord.answer)
  const rawAnswerValue = answerRecord.answer
  const rawStructuredOutput = ensureObject(answer.raw_structured_output)
  const timeoutSalvage = ensureObject(answerRecord.timeout_salvage)
  const terminalState = deriveQuestionTerminalState({
    questionSpec,
    answerRecord,
    answer,
    rawStructuredOutput,
    timeoutSalvage,
    rawAnswerValue,
  })
  const terminalSummary = deriveQuestionTerminalSummary({
    questionSpec,
    answerRecord,
    answer,
    rawStructuredOutput,
    timeoutSalvage,
    terminalState,
    rawAnswerValue,
  })
  const sources = collectQuestionAnswerSources(answer, timeoutSalvage)
  const blockedBy = terminalState === 'blocked' && Array.isArray(questionSpec?.depends_on)
    ? questionSpec.depends_on.map((value: unknown) => toText(value)).filter(Boolean)
    : []

  return {
    ...answerRecord,
    notes: toText(answerRecord.notes) || terminalSummary,
    evidence_grade: toText(answerRecord.evidence_grade) || null,
    structured_signal: ensureObject(answerRecord.structured_signal).constructor === Object ? ensureObject(answerRecord.structured_signal) : null,
    procurement_model: toText(answerRecord.procurement_model) || null,
    commercial_implication: toText(answerRecord.commercial_implication) || null,
    signal_density: Number.isFinite(Number(answerRecord.signal_density)) ? Number(answerRecord.signal_density) : null,
    terminal_state: terminalState,
    terminal_summary: terminalSummary,
    blocked_by: blockedBy,
    answer: {
      ...answer,
      summary: toDisplayText(answer.summary)
        || (typeof rawAnswerValue === 'string' || typeof rawAnswerValue === 'number' || typeof rawAnswerValue === 'boolean' ? toDisplayText(rawAnswerValue) : '')
        || terminalSummary,
      value: answer.value ?? (typeof rawAnswerValue === 'string' || typeof rawAnswerValue === 'number' || typeof rawAnswerValue === 'boolean' ? rawAnswerValue : answer.value),
      raw_structured_output: {
        ...rawStructuredOutput,
        answer: rawStructuredOutput.answer ?? rawAnswerValue,
        summary: toDisplayText(rawStructuredOutput.summary)
          || (typeof rawAnswerValue === 'string' || typeof rawAnswerValue === 'number' || typeof rawAnswerValue === 'boolean' ? toDisplayText(rawAnswerValue) : '')
          || terminalSummary,
        context: toDisplayText(rawStructuredOutput.context) || terminalSummary,
        notes: toDisplayText(rawStructuredOutput.notes) || terminalSummary,
        validation_state: toText(rawStructuredOutput.validation_state) || toText(answerRecord.validation_state) || 'no_signal',
        sources,
      },
      terminal_state: terminalState,
      blocked_by: blockedBy,
    },
  }
}

function buildLegacyMergedQuestions(
  questionSpecs: Record<string, any>[],
  answerRecords: Record<string, any>[],
  questionTimings: Record<string, any>,
): Record<string, any>[] {
  const answerIndex = new Map<string, Record<string, any>>()
  for (const answer of answerRecords) {
    const questionId = toText(answer?.question_id)
    if (questionId && !answerIndex.has(questionId)) {
      answerIndex.set(questionId, ensureObject(answer))
    }
  }

  return questionSpecs.map((question) => {
    const questionId = toText(question.question_id)
    const rawAnswer = questionId ? answerIndex.get(questionId) : null
    const answer = rawAnswer ? normalizeQuestionAnswerRecord(rawAnswer, question) : null
    const timing = questionId ? ensureObject(questionTimings[questionId]) : {}
    const answerPayload = answer
      ? {
          question_id: answer.question_id,
          question_type: answer.question_type,
          answer: ensureObject(answer.answer).kind ? answer.answer : answer.answer ?? null,
          confidence: answer.confidence,
          validation_state: answer.validation_state,
          evidence_refs: Array.isArray(answer.evidence_refs) ? answer.evidence_refs : [],
          signal_type: answer.signal_type,
          evidence_grade: answer.evidence_grade ?? null,
          structured_signal: answer.structured_signal ?? null,
          procurement_model: answer.procurement_model ?? null,
          commercial_implication: answer.commercial_implication ?? null,
          signal_density: answer.signal_density ?? null,
          primary_owner: answer.primary_owner ?? null,
          supporting_candidates: Array.isArray(answer.supporting_candidates) ? answer.supporting_candidates : [],
          candidates: Array.isArray(answer.candidates) ? answer.candidates : [],
          trace_ref: answer.trace_ref ?? null,
          notes: answer.notes ?? null,
          terminal_state: answer.terminal_state ?? 'no_signal',
          terminal_summary: answer.terminal_summary ?? '',
          blocked_by: Array.isArray(answer.blocked_by) ? answer.blocked_by : [],
          timeout_salvage: ensureObject(answer.timeout_salvage),
        }
      : null

    return {
      ...question,
      ...timing,
      ...(answer
        ? {
            answer: ensureObject(answer.answer).kind ? answer.answer : answer.answer ?? null,
            confidence: answer.confidence,
            validation_state: answer.validation_state,
            signal_type: answer.signal_type,
            evidence_grade: answer.evidence_grade ?? null,
            structured_signal: answer.structured_signal ?? null,
            procurement_model: answer.procurement_model ?? null,
            commercial_implication: answer.commercial_implication ?? null,
            signal_density: answer.signal_density ?? null,
            evidence_refs: Array.isArray(answer.evidence_refs) ? answer.evidence_refs : [],
            question_first_answer: answerPayload,
            terminal_state: answer.terminal_state ?? 'no_signal',
            terminal_summary: answer.terminal_summary ?? '',
            blocked_by: Array.isArray(answer.blocked_by) ? answer.blocked_by : [],
          }
        : {}),
    }
  })
}

function getQuestionPromotionTarget(question: Record<string, any>): string | null {
  const questionId = toText(question.question_id).toLowerCase()
  const signalType = toText(question.signal_type).toLowerCase()

  if (['q2_digital_stack', 'q4_performance', 'q5_league_context'].includes(questionId) || ['digital_stack', 'performance', 'league_context'].includes(signalType)) {
    return 'digital_stack'
  }

  if (['q8_explicit_rfp', 'q9_news_signal'].includes(questionId) || ['tender_docs', 'news_signal'].includes(signalType)) {
    return 'timing_procurement_markers'
  }

  if (['q3_leadership', 'q11_decision_owner', 'q12_connections'].includes(questionId) || ['leadership', 'decision_owner', 'poi', 'connections'].includes(signalType)) {
    return 'decision_owners'
  }

  if (
    ['q7_procurement_signal', 'q10_hiring_signal', 'q13_capability_gap', 'q15_outreach_strategy'].includes(questionId)
    || ['procurement_signal', 'launch_signal', 'hiring_signal', 'capability_gap', 'outreach_strategy'].includes(signalType)
  ) {
    return 'opportunity_signals'
  }

  return null
}

function getQuestionAnswerRecord(question: Record<string, any>): Record<string, any> {
  return ensureObject(question.question_first_answer || question)
}

function getQuestionAnswerText(question: Record<string, any>): string {
  const answerRecord = getQuestionAnswerRecord(question)
  const answer = ensureObject(answerRecord.answer)
  const rawStructuredOutput = ensureObject(answer.raw_structured_output)
  const displayAnswer = ensureObject(answerRecord.display_answer || answer.display_answer)

  return [
    toDisplayText(displayAnswer.headline),
    toDisplayText(answer.summary),
    toDisplayText(answer.value),
    toDisplayText(answerRecord.terminal_summary),
    toDisplayText(rawStructuredOutput.answer),
    toDisplayText(rawStructuredOutput.summary),
    toDisplayText(rawStructuredOutput.context),
    toDisplayText(answerRecord.notes),
  ].find((value) => Boolean(value)) || ''
}

function getQuestionEvidenceUrls(question: Record<string, any>): string[] {
  const answerRecord = getQuestionAnswerRecord(question)
  const answer = ensureObject(answerRecord.answer)
  const rawStructuredOutput = ensureObject(answer.raw_structured_output)
  const displayAnswer = ensureObject(answerRecord.display_answer || answer.display_answer)
  const displayEvidence = Array.isArray(displayAnswer.evidence) ? displayAnswer.evidence : []
  const sources = Array.isArray(rawStructuredOutput.sources) ? rawStructuredOutput.sources : []
  const evidenceRefs = Array.isArray(answerRecord.evidence_refs) ? answerRecord.evidence_refs : []

  return uniqueStrings(
    [...displayEvidence, ...sources, ...evidenceRefs]
      .map((value) => toDisplayText(value))
      .filter(Boolean),
  )
}

function buildQuestionFirstPromotionEntry(question: Record<string, any>, promotionTarget: string): Record<string, any> | null {
  const answerRecord = getQuestionAnswerRecord(question)
  const answer = ensureObject(answerRecord.answer)
  const rawStructuredOutput = ensureObject(answer.raw_structured_output)
  const answerText = getQuestionAnswerText(question)
  const evidenceUrls = getQuestionEvidenceUrls(question)

  if ((!answerText || !isMeaningfulCommercialText(answerText)) && evidenceUrls.length === 0) {
    return null
  }

  const confidenceValue = Number(question.confidence ?? answerRecord.confidence ?? answer.validation_state?.confidence ?? 0)

  return {
    candidate_id: `${toText(question.question_id)}:${promotionTarget}`,
    question_id: toText(question.question_id),
    question_text: toText(question.question_text || question.question || ''),
    promotion_target: promotionTarget,
    signal_type: toText(question.signal_type || answerRecord.signal_type || ''),
    answer: answerText,
    confidence: Number.isFinite(confidenceValue) ? confidenceValue : 0,
    evidence_url: evidenceUrls[0] || '',
    evidence_urls: evidenceUrls,
    evidence_id: toText(answerRecord.evidence_id || question.evidence_id || ''),
    answer_kind: toText(answer.kind || answerRecord.answer_kind || ''),
    validation_state: toText(question.validation_state || answerRecord.validation_state || '').toLowerCase(),
    rollout_phase: toText(question.rollout_phase || answerRecord.rollout_phase || ''),
    execution_class: toText(question.execution_class || answerRecord.execution_class || ''),
    structured_output_schema: toText(question.structured_output_schema || answerRecord.structured_output_schema || rawStructuredOutput.schema_version || ''),
    commercial_implication: toText(answerRecord.commercial_implication || question.commercial_implication || ''),
  }
}

function isMeaningfulCommercialText(value: unknown): boolean {
  const text = toDisplayText(value)
  if (!text) {
    return false
  }
  return !/(^no_signal$|^no signal$|^insufficient_signal$|source pending$|question execution failed|no deterministic answer was produced|no completed brightdata leads were recoverable|no brightdata-backed evidence|initial search returned only generic|follow-up search timed out|returned no results matching|no results matching|no hiring leads found|bounded retrieval|points to insufficient_signal|current dossier evidence points to insufficient[_ ]signal|searches? (for|across).* (returned|found) no|limited to unrelated|kind:\s*summary(\.|;|$)|kind:\s*summary;\s*value:\s*(;|null)|\"kind\"\s*:\s*\"list\"|value:\s*null|\"value\"\s*:\s*null|summary:\s*null|\"summary\"\s*:\s*\"insufficient_signal\"|commercial interpretation:\s*themes:\s*;\s*summary:\s*;|raw structured output:\s*(;|null)|\"raw_structured_output\"\s*:|opportunity hypotheses:\s*;|no web evidence found|insufficient signal|^\[object object\]$)/i.test(text)
}

function firstMeaningfulCommercialText(values: unknown[]): string {
  return values.map((value) => toDisplayText(value)).find((value) => isMeaningfulCommercialText(value)) || ''
}

function isConciseBuyerTargetText(value: unknown): boolean {
  const text = toDisplayText(value)
  if (!isMeaningfulCommercialText(text)) {
    return false
  }
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(text) || /^\d{4}$/.test(text)) {
    return false
  }
  const words = text.split(/\s+/).filter(Boolean)
  if (text.length > 90 || words.length > 8) {
    return false
  }
  return !/[{}[\]".;:]|\b(leverages?|comprising|comprises|including|technology stack|partnership stack|website|wordpress|woocommerce|evidence|summary|raw_structured_output|insufficient_signal)\b/i.test(text)
}

function firstConciseBuyerTargetText(values: unknown[]): string {
  return values.map((value) => toDisplayText(value)).find((value) => isConciseBuyerTargetText(value)) || ''
}

function inferYellowPantherService(signalText: string, capabilityGapText: string): string {
  const combined = `${signalText} ${capabilityGapText}`.toLowerCase()
  if (/\b(app|platform|digital|ott|product|launch|website|fan experience|stack)\b/.test(combined)) {
    return 'DIGITAL_TRANSFORMATION'
  }
  if (/\b(procurement|vendor|rfp|tender|commercial|partnership|sponsor|revenue)\b/.test(combined)) {
    return 'COMMERCIAL_PARTNERSHIPS'
  }
  if (/\b(hiring|recruitment|delivery|programme|project)\b/.test(combined)) {
    return 'PROJECT_DELIVERY'
  }
  if (/\b(strategy|growth|planning|positioning)\b/.test(combined)) {
    return 'STRATEGY'
  }
  return 'STAKEHOLDER_ENGAGEMENT'
}

function buildSynthesizedYpFit(
  strongestSignalText: string,
  capabilityGapText: string,
  buyerName: string,
  buyerTitle: string,
): Record<string, any> {
  const evidenceBasis = uniqueStrings([strongestSignalText, capabilityGapText]).join(' ')
  if (!isMeaningfulCommercialText(evidenceBasis)) {
    return {
      best_service: '',
      service_fit: [],
      fit_rationale: 'insufficient_signal',
      buyer_context: buyerName || null,
      evidence_basis: [],
      confidence_caveat: 'Need at least one validated commercial trigger before fit can be recommended.',
      status: 'insufficient_signal',
    }
  }

  const bestService = inferYellowPantherService(strongestSignalText, capabilityGapText)
  return {
    best_service: bestService,
    service_fit: [bestService],
    fit_rationale: `${bestService.replace(/_/g, ' ')} is the strongest capability match because current dossier evidence points to ${toDisplayText(capabilityGapText || strongestSignalText).toLowerCase()}.`,
    buyer_context: uniqueStrings([buyerName, buyerTitle]).join(', ') || null,
    evidence_basis: uniqueStrings([strongestSignalText, capabilityGapText]),
    confidence_caveat: buyerName
      ? `Verify recency and confirm ${buyerName} is still the right route before outreach.`
      : 'Verify the current buyer route before outreach.',
    status: 'available',
  }
}

function buildSynthesizedOutreachStrategy(
  strongestSignalText: string,
  buyerName: string,
  connectionOwner: string,
  connectionPathType: string,
  ypFit: Record<string, any>,
): Record<string, any> {
  const bestService = toDisplayText(ypFit.best_service || ypFit.recommended_service)
  const hasMeaningfulEvidence = [
    strongestSignalText,
    ypFit.status === 'insufficient_signal' ? '' : toDisplayText(ypFit.fit_rationale),
  ].some((value) => isMeaningfulCommercialText(value))
  if (!buyerName) {
    return {
      recommended_target: null,
      recommended_route: null,
      recommended_angle: '',
      first_message_strategy: '',
      verification_needed: 'Need a clearer buyer hypothesis before outreach.',
      why_now: '',
      status: 'insufficient_signal',
    }
  }
  if (!hasMeaningfulEvidence) {
    return {
      recommended_target: buyerName,
      recommended_route: null,
      recommended_angle: '',
      first_message_strategy: '',
      verification_needed: `Need a stronger commercial trigger before outreach to ${buyerName}.`,
      why_now: '',
      status: 'insufficient_signal',
    }
  }

  const route = connectionPathType || (connectionOwner ? 'warm_intro' : 'cold')
  const angle = firstMeaningfulCommercialText([
    strongestSignalText,
    `Lead with a ${bestService ? bestService.replace(/_/g, ' ').toLowerCase() : 'current commercial trigger'} angle tied to the active signal.`,
  ])

  return {
    recommended_target: buyerName || null,
    recommended_route: route,
    recommended_angle: angle,
    first_message_strategy: buyerName
      ? `Open with the fresh trigger, connect it to ${bestService ? bestService.replace(/_/g, ' ').toLowerCase() : 'Yellow Panther capability'}, and ask for a short discovery call with ${buyerName}.`
      : 'Open with the fresh trigger, explain the relevant Yellow Panther capability, and verify the right owner before deeper outreach.',
    verification_needed: connectionOwner
      ? `Confirm ${connectionOwner} is still the best intro route and validate signal recency.`
      : 'Validate signal recency and confirm the right buyer route before outreach.',
    why_now: strongestSignalText || angle,
    status: 'available',
  }
}

function buildQuestionFirstDiscoverySummary(questions: Record<string, any>[], answers: Record<string, any>[]) {
  const promoted: Record<string, any>[] = []
  const seenPromotionKeys = new Set<string>()
  const evidenceCountKeys = new Set<string>()
  const grouped: Record<string, Record<string, any>[]> = {
    digital_stack: [],
    opportunity_signals: [],
    timing_procurement_markers: [],
    decision_owners: [],
  }

  const answerByQuestionId = new Map<string, Record<string, any>>()
  for (const answer of answers) {
    const questionId = toText(answer?.question_id)
    if (questionId && !answerByQuestionId.has(questionId)) {
      answerByQuestionId.set(questionId, ensureObject(answer))
    }
  }

  for (const question of questions) {
    const promotionTarget = getQuestionPromotionTarget(question)
    if (!promotionTarget) {
      continue
    }

    const entry = buildQuestionFirstPromotionEntry(question, promotionTarget)
    if (!entry) {
      continue
    }

    const promotionKey = [entry.question_id, entry.promotion_target, entry.answer].join('|').toLowerCase()
    if (seenPromotionKeys.has(promotionKey)) {
      continue
    }
    seenPromotionKeys.add(promotionKey)
    promoted.push(entry)
    if (!grouped[promotionTarget]) {
      grouped[promotionTarget] = []
    }
    grouped[promotionTarget].push(entry)

    const evidenceKey = entry.evidence_url || entry.evidence_id || entry.candidate_id
    if (evidenceKey) {
      evidenceCountKeys.add(evidenceKey)
    }
  }

  const decisionOwnerAnswer = answerByQuestionId.get('q11_decision_owner') || {}
  const connectionsAnswer = answerByQuestionId.get('q12_connections') || {}
  const capabilityGapAnswer = answerByQuestionId.get('q13_capability_gap') || {}
  const ypFitAnswer = answerByQuestionId.get('q14_yp_fit') || {}
  const outreachStrategyAnswer = answerByQuestionId.get('q15_outreach_strategy') || {}

  const decisionOwnerRecord = getQuestionAnswerRecord(ensureObject(questions.find((question) => toText(question.question_id) === 'q11_decision_owner') || answerByQuestionId.get('q11_decision_owner') || {}))
  const decisionOwnerAnswerRecord = ensureObject(decisionOwnerRecord.answer)
  const decisionOwnerRaw = ensureObject(decisionOwnerAnswerRecord.raw_structured_output)
  const decisionOwnerStructured = ensureObject(decisionOwnerAnswerRecord.structured_signal || decisionOwnerAnswer.structured_signal)
  const decisionOwnerRawPrimaryOwner = ensureObject(decisionOwnerRaw.primary_owner)
  const decisionOwnerName = firstConciseBuyerTargetText([
    decisionOwnerRawPrimaryOwner.name,
    ensureObject(decisionOwnerAnswer.primary_owner).name,
    decisionOwnerStructured.decision_owner_name,
    decisionOwnerStructured.name,
    decisionOwnerAnswerRecord.value,
    decisionOwnerAnswerRecord.summary,
    decisionOwnerAnswer.summary,
    decisionOwnerAnswer.value,
    decisionOwnerAnswer.answer,
  ])
  const decisionOwnerTitle = firstMeaningfulCommercialText([
    decisionOwnerRawPrimaryOwner.title,
    ensureObject(decisionOwnerAnswer.primary_owner).title,
    decisionOwnerStructured.decision_owner_title,
    decisionOwnerStructured.title,
    decisionOwnerStructured.role,
  ])

  const connectionsRecord = getQuestionAnswerRecord(ensureObject(questions.find((question) => toText(question.question_id) === 'q12_connections') || connectionsAnswer || {}))
  const connectionsRaw = ensureObject(ensureObject(connectionsRecord.answer).raw_structured_output)
  const connectionPaths = Array.isArray(connectionsRaw.candidate_paths) ? connectionsRaw.candidate_paths : []
  const bestPath = connectionPaths.find((item) => item && typeof item === 'object') as Record<string, any> | undefined

  const capabilityGapRecord = getQuestionAnswerRecord(ensureObject(questions.find((question) => toText(question.question_id) === 'q13_capability_gap') || capabilityGapAnswer || {}))
  const capabilityGapRaw = ensureObject(ensureObject(capabilityGapRecord.answer).raw_structured_output)

  const ypFitRecord = getQuestionAnswerRecord(ensureObject(questions.find((question) => toText(question.question_id) === 'q14_yp_fit') || ypFitAnswer || {}))
  const ypFitRaw = ensureObject(ensureObject(ypFitRecord.answer).raw_structured_output)
  const ypFitValidationState = toText(ypFitRecord.validation_state || ypFitAnswer.validation_state).toLowerCase()

  const outreachStrategyRecord = getQuestionAnswerRecord(ensureObject(questions.find((question) => toText(question.question_id) === 'q15_outreach_strategy') || outreachStrategyAnswer || {}))
  const outreachStrategyRaw = ensureObject(ensureObject(outreachStrategyRecord.answer).raw_structured_output)
  const outreachValidationState = toText(outreachStrategyRecord.validation_state || outreachStrategyAnswer.validation_state).toLowerCase()
  const launchSignalQuestion = ensureObject(questions.find((question) => toText(question.question_id) === 'q6_launch_signal') || answerByQuestionId.get('q6_launch_signal') || {})
  const procurementSignalQuestion = ensureObject(questions.find((question) => toText(question.question_id) === 'q7_procurement_signal') || answerByQuestionId.get('q7_procurement_signal') || {})
  const budgetSignalQuestion = ensureObject(questions.find((question) => toText(question.question_id) === 'q9_budget_signal') || answerByQuestionId.get('q9_budget_signal') || answerByQuestionId.get('q9_news_signal') || {})
  const timingSignalQuestion = ensureObject(questions.find((question) => toText(question.question_id) === 'q10_timing_window') || answerByQuestionId.get('q10_timing_window') || answerByQuestionId.get('q10_hiring_signal') || {})

  const strongestSignalText = firstMeaningfulCommercialText([
    getQuestionAnswerText(launchSignalQuestion),
    getQuestionAnswerText(procurementSignalQuestion),
    getQuestionAnswerText(budgetSignalQuestion),
    getQuestionAnswerText(timingSignalQuestion),
    capabilityGapRaw.answer,
    capabilityGapRaw.summary,
  ])
  const capabilityGapText = firstMeaningfulCommercialText([
    capabilityGapRaw.top_gap,
    capabilityGapRaw.gap_label,
    capabilityGapRaw.answer,
    capabilityGapRaw.summary,
  ])
  const synthesizedYpFit = buildSynthesizedYpFit(
    strongestSignalText,
    capabilityGapText,
    decisionOwnerName,
    decisionOwnerTitle,
  )
  const hasUsableRawYpFitEvidence = [
    ypFitRaw.fit_rationale,
    ypFitRaw.answer,
    ypFitRaw.summary,
    ...(Array.isArray(ypFitRaw.evidence_basis) ? ypFitRaw.evidence_basis : []),
  ].some((value) => isMeaningfulCommercialText(value))
  const resolvedYpFit = (ypFitValidationState && !['no_signal', 'failed', 'blocked'].includes(ypFitValidationState) && hasUsableRawYpFitEvidence)
    ? {
        ...synthesizedYpFit,
        best_service: toDisplayText(ypFitRaw.best_service || ypFitRaw.recommended_service) || synthesizedYpFit.best_service,
        service_fit: Array.isArray(ypFitRaw.service_fit) && ypFitRaw.service_fit.length > 0 ? ypFitRaw.service_fit : synthesizedYpFit.service_fit,
        fit_rationale: firstMeaningfulCommercialText([ypFitRaw.fit_rationale, ypFitRaw.answer, ypFitRaw.summary, synthesizedYpFit.fit_rationale]),
        buyer_context: firstMeaningfulCommercialText([ypFitRaw.buyer_context, synthesizedYpFit.buyer_context]) || null,
        evidence_basis: Array.isArray(ypFitRaw.evidence_basis) && ypFitRaw.evidence_basis.length > 0 ? ypFitRaw.evidence_basis : synthesizedYpFit.evidence_basis,
        confidence_caveat: firstMeaningfulCommercialText([ypFitRaw.confidence_caveat, synthesizedYpFit.confidence_caveat]),
        status: 'available',
      }
    : synthesizedYpFit
  const synthesizedOutreach = buildSynthesizedOutreachStrategy(
    strongestSignalText,
    decisionOwnerName,
    toText(bestPath?.best_yp_owner || bestPath?.recommended_yp_owner || ''),
    toText(bestPath?.path_type || ''),
    resolvedYpFit,
  )
  const resolvedOutreach = (outreachValidationState && !['no_signal', 'failed', 'blocked'].includes(outreachValidationState) && (
    firstMeaningfulCommercialText([
      outreachStrategyRaw.recommended_target,
      outreachStrategyRaw.recommended_angle,
      outreachStrategyRaw.first_message_strategy,
      outreachStrategyRaw.why_now,
      outreachStrategyRaw.summary,
    ])
  ))
    ? {
        ...synthesizedOutreach,
        recommended_target: firstConciseBuyerTargetText([outreachStrategyRaw.recommended_target, decisionOwnerName]) || synthesizedOutreach.recommended_target,
        recommended_route: toDisplayText(outreachStrategyRaw.recommended_route || bestPath?.path_type) || synthesizedOutreach.recommended_route,
        recommended_angle: firstMeaningfulCommercialText([outreachStrategyRaw.recommended_angle, outreachStrategyRaw.answer, outreachStrategyRaw.summary, synthesizedOutreach.recommended_angle]),
        first_message_strategy: firstMeaningfulCommercialText([outreachStrategyRaw.first_message_strategy, synthesizedOutreach.first_message_strategy]),
        verification_needed: firstMeaningfulCommercialText([outreachStrategyRaw.verification_needed, synthesizedOutreach.verification_needed]),
        why_now: firstMeaningfulCommercialText([outreachStrategyRaw.why_now, strongestSignalText, synthesizedOutreach.why_now]),
      }
    : synthesizedOutreach

  const strongestOpportunity = promoted
    .slice()
    .sort((left, right) => Number(right.confidence || 0) - Number(left.confidence || 0))[0] || null

  const graphitiSalesBrief = {
    status: decisionOwnerName ? 'available' : 'insufficient_signal',
    buyer_name: decisionOwnerName || null,
    buyer_title: decisionOwnerTitle || null,
    best_path_owner: toText(bestPath?.best_yp_owner || bestPath?.recommended_yp_owner || ''),
    path_type: toText(bestPath?.path_type || ''),
    capability_gap: toText(capabilityGapRaw.top_gap || capabilityGapRaw.gap_label || capabilityGapRaw.answer || ''),
    yp_fit_service: toText(resolvedYpFit.best_service || resolvedYpFit.recommended_service || ''),
    outreach_target: firstConciseBuyerTargetText([resolvedOutreach.recommended_target, decisionOwnerName]),
    outreach_route: toText(resolvedOutreach.recommended_route || bestPath?.path_type || ''),
    outreach_angle: firstMeaningfulCommercialText([resolvedOutreach.recommended_angle, strongestOpportunity?.answer, strongestSignalText]),
    source: 'question_first_normalizer',
  }
  const recommendedApproach = toText(
    graphitiSalesBrief.outreach_angle
    || graphitiSalesBrief.outreach_target
    || strongestOpportunity?.answer
    || decisionOwnerName
    || '',
  )

  const qualitySupportQuestions = questions.filter((question) => {
    const text = getQuestionAnswerText(question)
    return Boolean(text)
  })

  const sortPromotedEntries = (left: Record<string, any>, right: Record<string, any>) => {
    const confidenceDiff = Number(right.confidence || 0) - Number(left.confidence || 0)
    if (confidenceDiff !== 0) {
      return confidenceDiff
    }
    return toText(left.candidate_id).localeCompare(toText(right.candidate_id))
  }

  promoted.sort(sortPromotedEntries)
  for (const key of Object.keys(grouped)) {
    grouped[key].sort(sortPromotedEntries)
  }

  return {
    promoted_count: promoted.length,
    supporting_evidence_count: evidenceCountKeys.size,
    promotion_targets: Object.keys(grouped).filter((key) => grouped[key].length > 0),
    promotion_rollout_phase: 'phase_3_decision',
    client_ready: false,
    client_ready_blockers: [],
    graphiti_sales_brief: graphitiSalesBrief,
    recommended_approach: recommendedApproach || null,
    next_best_action: recommendedApproach || null,
    yellow_panther_opportunity: {
      estimated_probability: Number(strongestOpportunity?.confidence || 0),
      service_fit: uniqueStrings([
        ...(Array.isArray(resolvedYpFit.service_fit) ? resolvedYpFit.service_fit : [resolvedYpFit.service_fit]),
        graphitiSalesBrief.yp_fit_service,
      ]),
      entry_point: graphitiSalesBrief.outreach_target || decisionOwnerName || null,
      competitive_advantage: strongestOpportunity?.answer || graphitiSalesBrief.capability_gap || null,
      fit_feedback: firstMeaningfulCommercialText([resolvedYpFit.fit_rationale, strongestOpportunity?.answer, graphitiSalesBrief.outreach_angle]) || null,
    },
    yellow_panther_fit: resolvedYpFit,
    outreach_strategy: resolvedOutreach,
    ...grouped,
    evidence_items: qualitySupportQuestions
      .map((question) => ({
        question_id: toText(question.question_id),
        question_text: toText(question.question_text || question.question || ''),
        answer: getQuestionAnswerText(question),
        evidence_urls: getQuestionEvidenceUrls(question),
      }))
      .filter((item) => isMeaningfulCommercialText(item.answer) || item.evidence_urls.length > 0),
  }
}

function hasUsableYpFitArtifact(value: unknown): boolean {
  const fit = ensureObject(value)
  return toText(fit.status).toLowerCase() !== 'insufficient_signal'
    && isMeaningfulCommercialText(fit.fit_rationale || fit.fit_feedback || fit.competitive_advantage)
}

function hasUsableSalesBriefArtifact(value: unknown): boolean {
  const brief = ensureObject(value)
  return toText(brief.status).toLowerCase() === 'available'
    && Boolean(firstConciseBuyerTargetText([brief.buyer_name, brief.outreach_target]))
}

function hasUsableOutreachArtifact(value: unknown): boolean {
  const outreach = ensureObject(value)
  return toText(outreach.status).toLowerCase() !== 'insufficient_signal'
    && Boolean(firstConciseBuyerTargetText([outreach.recommended_target]))
    && isMeaningfulCommercialText(outreach.recommended_angle || outreach.first_message_strategy || outreach.why_now)
}

function getQuestionById(questions: Record<string, any>[], questionId: string): Record<string, any> | null {
  return questions.find((question) => toText(question?.question_id) === questionId) || null
}

function getQuestionSummary(question: Record<string, any> | null | undefined): string {
  if (!question) {
    return ''
  }

  return getQuestionAnswerText(question) || toText(question.terminal_summary || question.notes)
}

function buildQuestionFirstCoreInfo(
  entity: EntityLike | null | undefined,
  dossier: Record<string, any>,
  questions: Record<string, any>[],
): Record<string, any> {
  const foundationQuestion = getQuestionById(questions, 'q1_foundation')
  const foundationSummary = getQuestionSummary(foundationQuestion)
  const foundationAnswer = ensureObject(ensureObject(foundationQuestion?.question_first_answer).answer)
  const foundationRaw = ensureObject(foundationAnswer.raw_structured_output)
  const entityProperties = ensureObject(entity?.properties)

  return {
    name: getEntityName(entity, dossier),
    type: getEntityType(entity, dossier),
    league: toText(entityProperties.league || entityProperties.league_name || foundationRaw.league || foundationRaw.competition || ''),
    founded: toText(
      foundationRaw.founded_year
      || foundationRaw.year_founded
      || foundationRaw.founded
      || entityProperties.founded
      || entityProperties.founded_year
      || entityProperties.year_founded
      || 'Unknown',
    ),
    hq: toText(
      entityProperties.headquarters
      || entityProperties.hq
      || entityProperties.country
      || foundationRaw.headquarters
      || foundationRaw.location
      || '',
    ) || 'Unknown',
    stadium: toText(
      entityProperties.stadium
      || entityProperties.venue
      || foundationRaw.stadium
      || foundationRaw.ground
      || foundationRaw.home_ground
      || '',
    ) || 'Unknown',
    website: toText(
      entityProperties.website
      || entityProperties.url
      || foundationRaw.website
      || foundationRaw.url
      || foundationRaw.href
      || '',
    ) || 'No website available',
    employee_range: toText(
      entityProperties.employee_range
      || entityProperties.company_size
      || foundationRaw.employee_range
      || foundationRaw.employees
      || '',
    ) || 'Unknown',
    grounding_summary: foundationSummary || 'No grounding summary available yet.',
    source_questions: ['q1_foundation'],
  }
}

function buildQuestionFirstDigitalTransformation(
  questions: Record<string, any>[],
  discoverySummary: Record<string, any>,
): Record<string, any> {
  const digitalQuestions = ['q2_digital_stack', 'q4_performance', 'q5_league_context']
    .map((questionId) => getQuestionById(questions, questionId))
    .filter(Boolean) as Record<string, any>[]

  const discoveryDigitalStack = Array.isArray(discoverySummary.digital_stack) ? discoverySummary.digital_stack : []
  const stackHighlights = uniqueStrings([
    ...digitalQuestions.map((question) => getQuestionSummary(question)),
    ...discoveryDigitalStack.map((entry) => toDisplayText(entry.answer || entry.question_text || entry.candidate_id)),
  ])

  return {
    summary: stackHighlights[0] || 'Digital stack signals are still being assembled.',
    digital_maturity: toText(
      discoverySummary.digital_stack?.[0]?.score
      || discoverySummary.digital_stack?.[0]?.confidence
      || '',
    ) || null,
    current_tech_partners: uniqueStrings([
      ...discoveryDigitalStack.map((entry) => toDisplayText(entry.answer || entry.question_text || entry.candidate_id)),
    ]),
    strategic_opportunities: uniqueStrings([
      ...digitalQuestions.map((question) => getQuestionSummary(question)),
      ...discoveryDigitalStack.map((entry) => toDisplayText(entry.answer || entry.question_text || entry.candidate_id)),
    ]),
    highlights: stackHighlights,
    source_questions: ['q2_digital_stack', 'q4_performance', 'q5_league_context'],
  }
}

function buildQuestionFirstProcurementSignals(
  questions: Record<string, any>[],
  discoverySummary: Record<string, any>,
): Record<string, any> {
  const procurementQuestions = ['q7_procurement_signal', 'q8_explicit_rfp', 'q9_news_signal', 'q10_hiring_signal']
    .map((questionId) => getQuestionById(questions, questionId))
    .filter(Boolean) as Record<string, any>[]
  const decisionOwnerQuestions = ['q11_decision_owner', 'q12_connections', 'q13_capability_gap', 'q14_yp_fit', 'q15_outreach_strategy']
    .map((questionId) => getQuestionById(questions, questionId))
    .filter(Boolean) as Record<string, any>[]
  const opportunityEntries = Array.isArray(discoverySummary.opportunity_signals) ? discoverySummary.opportunity_signals : []
  const timingEntries = Array.isArray(discoverySummary.timing_procurement_markers)
    ? discoverySummary.timing_procurement_markers
    : Array.isArray(discoverySummary.timing_and_procurement)
      ? discoverySummary.timing_and_procurement
      : Array.isArray(discoverySummary.timing_markers)
        ? discoverySummary.timing_markers
        : []
  const decisionOwnerEntries = Array.isArray(discoverySummary.decision_owners) ? discoverySummary.decision_owners : []
  const evidenceItems = Array.isArray(discoverySummary.evidence_items) ? discoverySummary.evidence_items : []
  const procurementHighlights = uniqueStrings([
    ...procurementQuestions.map((question) => getQuestionSummary(question)),
    ...opportunityEntries.map((entry) => toDisplayText(entry.answer || entry.question_text || entry.candidate_id)),
    ...timingEntries.map((entry) => toDisplayText(entry.answer || entry.question_text || entry.candidate_id)),
  ])

  return {
    summary: procurementHighlights[0] || 'Procurement and ecosystem signals are still being assembled.',
    opportunity_signals: uniqueStrings([
      ...opportunityEntries.map((entry) => toDisplayText(entry.answer || entry.question_text || entry.candidate_id)),
      ...procurementQuestions.map((question) => getQuestionSummary(question)),
    ]),
    timing_markers: uniqueStrings([
      ...timingEntries.map((entry) => toDisplayText(entry.answer || entry.question_text || entry.candidate_id)),
    ]),
    decision_owners: uniqueStrings([
      ...decisionOwnerEntries.map((entry) => toDisplayText(entry.answer || entry.question_text || entry.candidate_id)),
      ...decisionOwnerQuestions.map((question) => getQuestionSummary(question)),
    ]),
    evidence_urls: uniqueStrings([
      ...evidenceItems.flatMap((entry) => Array.isArray(entry?.evidence_urls) ? entry.evidence_urls : []),
    ]),
    highlights: procurementHighlights,
    source_questions: ['q7_procurement_signal', 'q8_explicit_rfp', 'q9_news_signal', 'q10_hiring_signal', 'q11_decision_owner', 'q12_connections', 'q13_capability_gap', 'q14_yp_fit', 'q15_outreach_strategy'],
  }
}

function buildQuestionFirstTimingAnalysis(
  procurementSignals: Record<string, any>,
  discoverySummary: Record<string, any>,
): Record<string, any> {
  const timingMarkers = uniqueStrings([
    ...(Array.isArray(procurementSignals.timing_markers) ? procurementSignals.timing_markers : []),
    ...((Array.isArray(discoverySummary.timing_procurement_markers) ? discoverySummary.timing_procurement_markers : [])
      .map((entry) => toDisplayText(entry?.answer || entry?.question_text || entry?.candidate_id))),
  ])
  const procurementSummary = toText(procurementSignals.summary)
  const nextAction = toText(discoverySummary.next_best_action || discoverySummary.recommended_approach)

  return {
    summary: timingMarkers[0] || procurementSummary || 'Timing and procurement markers are still being assembled.',
    timing_markers: timingMarkers,
    next_best_action: nextAction || procurementSummary || null,
    source_questions: ['q7_procurement_signal', 'q8_explicit_rfp', 'q9_news_signal', 'q10_hiring_signal', 'q15_outreach_strategy'],
  }
}

function buildQuestionFirstConnectionsSummary(
  discoverySummary: Record<string, any>,
): Record<string, any> {
  const buyerBrief = ensureObject(discoverySummary.graphiti_sales_brief)
  const commercialPositioning = ensureObject(discoverySummary.yellow_panther_opportunity)
  const promotedDecisionOwners = Array.isArray(discoverySummary.decision_owners) ? discoverySummary.decision_owners : []
  const promotedOwnerTexts = uniqueStrings(
    promotedDecisionOwners.map((entry) => toDisplayText(entry?.answer || entry?.question_text || entry?.candidate_id)),
  )
  const decisionOwner = toText(buyerBrief.buyer_name) || null
  const decisionOwnerTitle = toText(buyerBrief.buyer_title) || null
  const recommendedOwner = toText(buyerBrief.best_path_owner) || null
  const pathType = toText(buyerBrief.path_type) || null
  const outreachTarget = toText(buyerBrief.outreach_target) || null
  const outreachRoute = toText(buyerBrief.outreach_route) || null
  const serviceFit = uniqueStrings(
    Array.isArray(commercialPositioning.service_fit)
      ? commercialPositioning.service_fit
      : [commercialPositioning.service_fit].filter(Boolean),
  )
  const summary =
    toText(buyerBrief.outreach_angle)
    || outreachTarget
    || promotedOwnerTexts[0]
    || ''

  if (!decisionOwner && !recommendedOwner && !pathType && serviceFit.length === 0 && promotedOwnerTexts.length === 0) {
    return {}
  }

  return {
    summary,
    decision_owner: decisionOwner,
    decision_owner_title: decisionOwnerTitle,
    recommended_owner: recommendedOwner,
    path_type: pathType,
    outreach_target: outreachTarget,
    outreach_route: outreachRoute,
    service_fit: serviceFit,
    promoted_decision_owners: promotedOwnerTexts,
    source_questions: ['q11_decision_owner', 'q12_connections', 'q14_yp_fit', 'q15_outreach_strategy'],
  }
}

function buildQuestionFirstExecutiveSummary(
  entityName: string,
  qualitySummary: string,
  coreInfo: Record<string, any>,
  digitalTransformation: Record<string, any>,
  procurementSignals: Record<string, any>,
  discoverySummary: Record<string, any>,
): Record<string, any> {
  const preferredSummary = [
    procurementSignals.summary,
    discoverySummary.recommended_approach,
    digitalTransformation.summary,
    qualitySummary,
    coreInfo.grounding_summary,
  ]
    .map((value) => toText(value))
    .find((value) => value && value.toLowerCase() !== 'no grounding summary available yet.')
  const highlights = uniqueStrings([
    coreInfo.grounding_summary,
    digitalTransformation.summary,
    procurementSignals.summary,
    discoverySummary.recommended_approach,
    qualitySummary,
  ])

  return {
    headline: `${entityName} question-first dossier`,
    summary: preferredSummary || highlights[0] || qualitySummary || `Question-first dossier for ${entityName}`,
    highlights,
    question_count: Array.isArray(coreInfo.source_questions) ? coreInfo.source_questions.length : 0,
    source: 'question_first_normalizer',
  }
}

function buildQuestionFirstStrategicAnalysis(
  qualitySummary: string,
  discoverySummary: Record<string, any>,
  digitalTransformation: Record<string, any>,
  procurementSignals: Record<string, any>,
  executiveSummary: Record<string, any>,
): Record<string, any> {
  return {
    overall_assessment: qualitySummary || 'Assessment not yet available',
    recommended_approach:
      toText(discoverySummary.recommended_approach)
      || toText(discoverySummary.next_best_action)
      || procurementSignals.summary
      || digitalTransformation.summary
      || executiveSummary.summary
      || 'Review the question-first answers and continue enrichment',
    procurement_signals: procurementSignals,
    digital_transformation: digitalTransformation,
    executive_summary: executiveSummary,
    buyer_brief: discoverySummary.graphiti_sales_brief || null,
    commercial_positioning: discoverySummary.yellow_panther_opportunity || null,
    source: 'question_first_normalizer',
  }
}

export function mergeQuestionFirstRunArtifactIntoDossier(
  dossierPayload: Record<string, any>,
  artifact: Record<string, any>,
): Record<string, any> {
  const payload = ensureObject(dossierPayload)
  const metadata = ensureObject(payload.metadata)
  const patch = ensureObject(artifact.merge_patch)
  const patchMetadata = ensureObject(patch.metadata)
  const questionFirstPatch = ensureObject(patch.question_first)
  const answerRecords = Array.isArray(artifact.answer_records) ? artifact.answer_records : Array.isArray(artifact.answers) ? artifact.answers : []
  const questionSpecs = Array.isArray(artifact.question_specs) ? artifact.question_specs : Array.isArray(artifact.questions) ? artifact.questions : []
  const artifactQuestionTimings = ensureObject(artifact.question_timings)
  const mergedQuestions = buildLegacyMergedQuestions(questionSpecs, answerRecords, artifactQuestionTimings)

  payload.metadata = {
    ...metadata,
    ...patchMetadata,
  }

  payload.question_first = {
    ...ensureObject(payload.question_first),
    ...questionFirstPatch,
    schema_version: toText(questionFirstPatch.schema_version) || toText(artifact.schema_version) || 'question_first_run_v2',
    generated_at: toText(questionFirstPatch.generated_at) || toText(artifact.generated_at),
    run_rollup: ensureObject(questionFirstPatch.run_rollup).questions_total ? questionFirstPatch.run_rollup : artifact.run_rollup ?? payload.run_rollup ?? {},
    categories: Array.isArray(questionFirstPatch.categories) ? questionFirstPatch.categories : artifact.categories ?? payload.categories ?? [],
    answers: answerRecords.length > 0 ? answerRecords : (Array.isArray(questionFirstPatch.answers) ? questionFirstPatch.answers : payload.answers ?? []),
    question_timings: ensureObject(questionFirstPatch.question_timings).constructor === Object
      ? { ...artifact.question_timings, ...questionFirstPatch.question_timings }
      : artifact.question_timings ?? payload.question_timings ?? {},
    evidence_items: Array.isArray(questionFirstPatch.evidence_items) ? questionFirstPatch.evidence_items : artifact.evidence_items ?? [],
    promotion_candidates: Array.isArray(questionFirstPatch.promotion_candidates)
      ? questionFirstPatch.promotion_candidates
      : artifact.promotion_candidates ?? [],
    poi_graph: ensureObject(questionFirstPatch.poi_graph).schema_version ? questionFirstPatch.poi_graph : artifact.poi_graph ?? {},
    questions_answered: Array.isArray(answerRecords) ? answerRecords.length : 0,
  }

  payload.questions = mergedQuestions.length > 0 ? mergedQuestions : Array.isArray(payload.questions) ? payload.questions : []
  payload.question_first_run = artifact

  return payload
}

export async function getLatestQuestionFirstDossierArtifact(
  entityId: string,
  entity?: EntityLike | null,
): Promise<ArtifactMatch | null> {
  return findLatestArtifact('_question_first_dossier.json', entityId, entity)
}

export async function getLatestQuestionFirstRunArtifact(
  entityId: string,
  entity?: EntityLike | null,
): Promise<ArtifactMatch | null> {
  return (await findLatestArtifact('_question_first_run_v2.json', entityId, entity))
    ?? findLatestArtifact('_question_first_run_v1.json', entityId, entity)
}

export async function getLatestQuestionFirstStateArtifact(
  entityId: string,
  entity?: EntityLike | null,
): Promise<ArtifactMatch | null> {
  return findLatestArtifact('_state.json', entityId, entity)
}

export function normalizeQuestionFirstDossier(
  dossierPayload: Record<string, any>,
  entityId: string,
  entity?: EntityLike | null,
) {
  const rawDossier = ensureObject(dossierPayload)
  const mergedDossier = rawDossier.merged_dossier && typeof rawDossier.merged_dossier === 'object'
    ? ensureObject(rawDossier.merged_dossier)
    : null
  const dossier = mergedDossier
    ? {
        ...rawDossier,
        ...mergedDossier,
        generated_at: toText(mergedDossier.generated_at) || toText(rawDossier.generated_at) || undefined,
        run_id: toText(mergedDossier.run_id) || toText(rawDossier.run_id) || undefined,
        publish_status: toText(mergedDossier.publish_status) || toText(rawDossier.publish_status) || undefined,
        question_first: {
          ...ensureObject(rawDossier.question_first),
          ...ensureObject(mergedDossier.question_first),
          generated_at: toText(ensureObject(mergedDossier.question_first).generated_at) || toText(ensureObject(rawDossier.question_first).generated_at) || undefined,
          run_id: toText(ensureObject(mergedDossier.question_first).run_id) || toText(ensureObject(rawDossier.question_first).run_id) || toText(rawDossier.run_id) || undefined,
          publish_status: toText(ensureObject(mergedDossier.question_first).publish_status) || toText(ensureObject(rawDossier.question_first).publish_status) || toText(rawDossier.publish_status) || undefined,
        },
        metadata: {
          ...ensureObject(rawDossier.metadata),
          ...ensureObject(mergedDossier.metadata),
          question_first: {
            ...ensureObject(ensureObject(rawDossier.metadata).question_first),
            ...ensureObject(ensureObject(mergedDossier.metadata).question_first),
            generated_at: toText(ensureObject(ensureObject(mergedDossier.metadata).question_first).generated_at)
              || toText(ensureObject(ensureObject(rawDossier.metadata).question_first).generated_at)
              || toText(rawDossier.generated_at)
              || undefined,
            run_id: toText(ensureObject(ensureObject(mergedDossier.metadata).question_first).run_id)
              || toText(ensureObject(ensureObject(rawDossier.metadata).question_first).run_id)
              || toText(rawDossier.run_id)
              || undefined,
            publish_status: toText(ensureObject(ensureObject(mergedDossier.metadata).question_first).publish_status)
              || toText(ensureObject(ensureObject(rawDossier.metadata).question_first).publish_status)
              || toText(rawDossier.publish_status)
              || undefined,
          },
        },
      }
    : rawDossier
  const entityUuid = resolveEntityUuid(entity ?? {
    id: dossier.entity_id || entityId,
    entity_uuid: dossier.entity_id,
    properties: {
      name: dossier.entity_name,
      type: dossier.entity_type,
    },
  }) || entityId
  const metadata = ensureObject(dossier.metadata)
  const questionFirst = ensureObject(dossier.question_first)
  const metadataQuestionFirst = ensureObject(metadata.question_first)
  const runId = toText(questionFirst.run_id || metadataQuestionFirst.run_id || dossier.run_id)
  const heartbeatAt = toText(questionFirst.heartbeat_at || metadataQuestionFirst.heartbeat_at || dossier.heartbeat_at)
  const lastCompletedQuestion = toText(questionFirst.last_completed_question || metadataQuestionFirst.last_completed_question || dossier.last_completed_question)
  const resumeFromQuestion = toText(questionFirst.resume_from_question || metadataQuestionFirst.resume_from_question || dossier.resume_from_question)
  const failureReason = toText(questionFirst.failure_reason || metadataQuestionFirst.failure_reason || dossier.failure_reason)
  const failureCategory = toText(questionFirst.failure_category || metadataQuestionFirst.failure_category || dossier.failure_category)
  const retryable = Boolean(questionFirst.retryable ?? metadataQuestionFirst.retryable ?? dossier.retryable)
  const rawCheckpointConsistent = questionFirst.checkpoint_consistent ?? metadataQuestionFirst.checkpoint_consistent ?? true
  const nonTerminalQuestionIds = Array.isArray(questionFirst.non_terminal_question_ids)
    ? questionFirst.non_terminal_question_ids.map((value: unknown) => toText(value)).filter(Boolean)
    : Array.isArray(metadataQuestionFirst.non_terminal_question_ids)
      ? metadataQuestionFirst.non_terminal_question_ids.map((value: unknown) => toText(value)).filter(Boolean)
      : []
  const checkpointConsistent = failureCategory.toLowerCase() === 'checkpoint_inconsistency'
    ? false
    : (Boolean(rawCheckpointConsistent) && nonTerminalQuestionIds.length === 0)
  const publishStatus = toText(questionFirst.publish_status || metadataQuestionFirst.publish_status || dossier.publish_status)
  const runRollup = ensureObject(questionFirst.run_rollup).questions_total
    ? questionFirst.run_rollup
    : ensureObject(dossier.run_rollup)
  const categories = Array.isArray(questionFirst.categories) ? questionFirst.categories : Array.isArray(dossier.categories) ? dossier.categories : []
  const rawAnswers = Array.isArray(questionFirst.answers) ? questionFirst.answers : Array.isArray(dossier.answers) ? dossier.answers : []
  const questionSpecs = Array.isArray(dossier.questions) ? dossier.questions : []
  const questionSpecIndex = new Map(
    questionSpecs
      .filter((question) => question && typeof question === 'object')
      .map((question) => [toText((question as Record<string, any>).question_id), question as Record<string, any>]),
  )
  const answers = rawAnswers.map((answer) => {
    const answerRecord = ensureObject(answer)
    return normalizeQuestionAnswerRecord(answerRecord, questionSpecIndex.get(toText(answerRecord.question_id)))
  })
  const questionTimings = Object.keys(ensureObject(questionFirst.question_timings)).length > 0
    ? ensureObject(questionFirst.question_timings)
    : ensureObject(metadataQuestionFirst.question_timings)
  const poiGraph = Object.keys(ensureObject(questionFirst.poi_graph)).length > 0
    ? ensureObject(questionFirst.poi_graph)
    : ensureObject(metadataQuestionFirst.poi_graph)
  const questions = Array.isArray(dossier.questions)
    ? buildLegacyMergedQuestions(
        dossier.questions.map((question) => ensureObject(question)),
        answers.map((answer) => ensureObject(answer)),
        questionTimings,
      )
    : []
  const questionsPresent = questions.length > 0 ? questions : answers
  const answeredQuestions = questionsPresent.filter((question) => isAnsweredQuestionState(getQuestionTerminalState(ensureObject(question))))
  const blockedQuestions = questionsPresent.filter((question) => getQuestionTerminalState(ensureObject(question)) === 'blocked')
  const skippedQuestions = questionsPresent.filter((question) => getQuestionTerminalState(ensureObject(question)) === 'skipped')
  const nonBlockingQuestions = blockedQuestions.filter((question) => isNonBlockingQuestion(ensureObject(question)))
  const blockingQuestions = blockedQuestions.filter((question) => !isNonBlockingQuestion(ensureObject(question)))
  const satisfiedQuestionsCount = answeredQuestions.length + nonBlockingQuestions.length + skippedQuestions.length
  const questionIdsPresent = new Set(
    questionsPresent
      .map((question) => toText(ensureObject(question).question_id))
      .filter(Boolean),
  )
  const syntheticDiscoverySummary = buildQuestionFirstDiscoverySummary(questionsPresent, answers)
  const existingDiscoverySummary = ensureObject(questionFirst.discovery_summary)
  const mergedDiscoverySummary = Object.keys(existingDiscoverySummary).length > 0
    ? {
        ...syntheticDiscoverySummary,
        ...existingDiscoverySummary,
        digital_stack: Array.isArray(existingDiscoverySummary.digital_stack) && existingDiscoverySummary.digital_stack.length > 0
          ? existingDiscoverySummary.digital_stack
          : syntheticDiscoverySummary.digital_stack,
        opportunity_signals: Array.isArray(existingDiscoverySummary.opportunity_signals) && existingDiscoverySummary.opportunity_signals.length > 0
          ? existingDiscoverySummary.opportunity_signals
          : syntheticDiscoverySummary.opportunity_signals,
        timing_procurement_markers: Array.isArray(existingDiscoverySummary.timing_procurement_markers) && existingDiscoverySummary.timing_procurement_markers.length > 0
          ? existingDiscoverySummary.timing_procurement_markers
          : syntheticDiscoverySummary.timing_procurement_markers,
        decision_owners: Array.isArray(existingDiscoverySummary.decision_owners) && existingDiscoverySummary.decision_owners.length > 0
          ? existingDiscoverySummary.decision_owners
          : syntheticDiscoverySummary.decision_owners,
        promotion_targets: Array.isArray(existingDiscoverySummary.promotion_targets) && existingDiscoverySummary.promotion_targets.length > 0
          ? existingDiscoverySummary.promotion_targets
          : syntheticDiscoverySummary.promotion_targets,
        evidence_items: Array.isArray(existingDiscoverySummary.evidence_items) && existingDiscoverySummary.evidence_items.length > 0
          ? existingDiscoverySummary.evidence_items
          : syntheticDiscoverySummary.evidence_items,
        graphiti_sales_brief: hasUsableSalesBriefArtifact(existingDiscoverySummary.graphiti_sales_brief)
          ? existingDiscoverySummary.graphiti_sales_brief
          : syntheticDiscoverySummary.graphiti_sales_brief,
        yellow_panther_opportunity: Object.keys(ensureObject(existingDiscoverySummary.yellow_panther_opportunity)).length > 0
          ? existingDiscoverySummary.yellow_panther_opportunity
          : syntheticDiscoverySummary.yellow_panther_opportunity,
        yellow_panther_fit: hasUsableYpFitArtifact(existingDiscoverySummary.yellow_panther_fit)
          ? existingDiscoverySummary.yellow_panther_fit
          : syntheticDiscoverySummary.yellow_panther_fit,
        outreach_strategy: hasUsableOutreachArtifact(existingDiscoverySummary.outreach_strategy)
          ? existingDiscoverySummary.outreach_strategy
          : syntheticDiscoverySummary.outreach_strategy,
      }
    : syntheticDiscoverySummary
  const promotedRows = [
    ...(Array.isArray(mergedDiscoverySummary?.digital_stack) ? mergedDiscoverySummary.digital_stack : []),
    ...(Array.isArray(mergedDiscoverySummary?.opportunity_signals) ? mergedDiscoverySummary.opportunity_signals : []),
    ...(Array.isArray(mergedDiscoverySummary?.timing_procurement_markers) ? mergedDiscoverySummary.timing_procurement_markers : []),
    ...(Array.isArray(mergedDiscoverySummary?.decision_owners) ? mergedDiscoverySummary.decision_owners : []),
  ]
  const dossierPromotions = promotedRows.length > 0
    ? promotedRows
    : Array.isArray(questionFirst.dossier_promotions) ? questionFirst.dossier_promotions : []
  const requiredQuestionBlockers = REQUIRED_QUESTION_IDS.flatMap((questionId) => {
    const question = questionsPresent.find((candidate) => toText(ensureObject(candidate).question_id) === questionId)
    if (!question) {
      return [`${questionId} is missing from the persisted dossier`]
    }

    const normalizedQuestion = ensureObject(question)
    const terminalState = getQuestionTerminalState(normalizedQuestion)
    if (isAnsweredQuestionState(terminalState) || terminalState === 'skipped') {
      return []
    }

    const summary = toText(
      normalizedQuestion.terminal_summary
        ?? normalizedQuestion.question_first_answer?.terminal_summary
        ?? normalizedQuestion.answer?.summary,
    )
    return [summary || `${questionId} is ${terminalState || 'unresolved'}`]
  })
  const missingQuestionCount = Math.max(FULL_QUESTION_FIRST_PACK_SIZE - questionsPresent.length, 0)
  const clientReady = mergedDiscoverySummary?.client_ready === true
  let qualityState: 'complete' | 'partial' | 'blocked' | 'client_ready' = 'partial'
  let qualitySummary = ''
  let qualityBlockers: string[] = []

  if (clientReady) {
    qualityState = 'client_ready'
    qualitySummary = 'Persisted dossier passed the question-first quality gate and is marked client-ready.'
  } else if (questionsPresent.length < FULL_QUESTION_FIRST_PACK_SIZE) {
    qualityState = 'partial'
    qualityBlockers = [
      `Only ${questionsPresent.length} of ${FULL_QUESTION_FIRST_PACK_SIZE} expected questions are present.`,
    ]
    qualitySummary = 'Partial dossier: this persisted artifact does not contain the full 15-question pack yet.'
  } else if (requiredQuestionBlockers.length > 0 || blockingQuestions.length > 0) {
    qualityState = 'blocked'
    qualityBlockers = requiredQuestionBlockers.length > 0
      ? requiredQuestionBlockers
      : blockingQuestions
          .map((question) => toText(ensureObject(question).terminal_summary))
          .filter(Boolean)
    qualitySummary = 'Blocked dossier: the persisted artifact exists, but downstream questions are still unresolved.'
  } else if (satisfiedQuestionsCount < FULL_QUESTION_FIRST_PACK_SIZE) {
    qualityState = 'partial'
    qualityBlockers = [
      `${FULL_QUESTION_FIRST_PACK_SIZE - satisfiedQuestionsCount} questions are present but still unresolved.`,
    ]
    qualitySummary = 'Partial dossier: some persisted questions are unresolved even after excluding non-applicable conditions.'
  } else {
    qualityState = 'complete'
    qualitySummary = 'Complete dossier: the full 15-question pack is present and persisted.'
  }

  if (qualityBlockers.length === 0 && missingQuestionCount > 0) {
    qualityBlockers = [`${missingQuestionCount} expected questions are still missing.`]
  }

  const coreInfo = buildQuestionFirstCoreInfo(entity, dossier, questionsPresent)
  const digitalTransformation = buildQuestionFirstDigitalTransformation(questionsPresent, mergedDiscoverySummary)
  const procurementSignals = buildQuestionFirstProcurementSignals(questionsPresent, mergedDiscoverySummary)
  const timingAnalysis = buildQuestionFirstTimingAnalysis(procurementSignals, mergedDiscoverySummary)
  const connectionsSummary = buildQuestionFirstConnectionsSummary(mergedDiscoverySummary)
  const executiveSummary = buildQuestionFirstExecutiveSummary(
    getEntityName(entity, dossier),
    qualitySummary,
    coreInfo,
    digitalTransformation,
    procurementSignals,
    mergedDiscoverySummary,
  )
  const strategicAnalysis = buildQuestionFirstStrategicAnalysis(
    qualitySummary,
    mergedDiscoverySummary,
    digitalTransformation,
    procurementSignals,
    executiveSummary,
  )
  const normalizedPublishStatus = (publishStatus.startsWith('published') && !dossierHasMeaningfulPublicationArtifacts({
    question_first: { discovery_summary: mergedDiscoverySummary },
    discovery_summary: mergedDiscoverySummary,
    executive_summary: executiveSummary,
    strategic_analysis: strategicAnalysis,
  })) ? 'published_partial' : (publishStatus || 'draft')

  const normalized = {
    ...dossier,
    entity_id: entityUuid,
    entity_name: getEntityName(entity, dossier),
    entity_type: getEntityType(entity, dossier),
    metadata: {
      ...metadata,
      question_first: {
        ...metadataQuestionFirst,
        publish_status: normalizedPublishStatus,
        publication_status: normalizedPublishStatus,
        run_rollup: metadataQuestionFirst.run_rollup ?? runRollup,
        categories: metadataQuestionFirst.categories ?? categories,
        question_timings: Object.keys(metadataQuestionFirst.question_timings ?? {}).length > 0
          ? metadataQuestionFirst.question_timings
          : questionTimings,
        poi_graph: Object.keys(metadataQuestionFirst.poi_graph ?? {}).length > 0
          ? metadataQuestionFirst.poi_graph
          : poiGraph,
      },
    },
    question_first: {
      ...questionFirst,
      publish_status: normalizedPublishStatus,
      publication_status: normalizedPublishStatus,
      discovery_summary: mergedDiscoverySummary,
      dossier_promotions: dossierPromotions,
      run_rollup: runRollup,
      categories,
      answers,
      question_timings: questionTimings,
      poi_graph: poiGraph,
    },
    core_info: coreInfo,
    digital_transformation: digitalTransformation,
    procurement_signals: procurementSignals,
    timing_analysis: timingAnalysis,
    connections_summary: connectionsSummary,
    executive_summary: executiveSummary,
    strategic_analysis: strategicAnalysis,
    recommended_approach: strategicAnalysis.recommended_approach,
    graphiti_sales_brief: mergedDiscoverySummary.graphiti_sales_brief || null,
    yellow_panther_fit: mergedDiscoverySummary.yellow_panther_fit || mergedDiscoverySummary.yellow_panther_opportunity || null,
    sections: {
      executive_summary: executiveSummary,
      strategic_analysis: strategicAnalysis,
      digital_transformation: digitalTransformation,
      procurement_signals: procurementSignals,
      connections_summary: connectionsSummary,
    },
    run_rollup: runRollup,
    categories,
    answers,
    questions,
    question_timings: questionTimings,
    poi_graph: poiGraph,
    discovery_summary: mergedDiscoverySummary,
    dossier_promotions: dossierPromotions,
    question_first_run_path: toText(dossier.question_first_run_path || rawDossier.question_first_run_path) || null,
    quality_state: qualityState,
    quality_summary: qualitySummary,
    quality_blockers: qualityBlockers,
    publish_status: normalizedPublishStatus,
    publication_status: normalizedPublishStatus,
    run_id: runId || null,
    last_completed_question: lastCompletedQuestion || null,
    resume_from_question: resumeFromQuestion || null,
    failure_reason: failureReason || null,
    failure_category: failureCategory || null,
    retryable,
    checkpoint_consistent: checkpointConsistent,
    non_terminal_question_ids: nonTerminalQuestionIds,
    heartbeat_at: heartbeatAt || null,
    validation_sample: false,
  } as Record<string, any>

  normalized.metadata.question_first = {
    ...ensureObject(normalized.metadata.question_first),
    discovery_summary: mergedDiscoverySummary,
    dossier_promotions: normalized.dossier_promotions,
    core_info: coreInfo,
    digital_transformation: digitalTransformation,
    procurement_signals: procurementSignals,
    timing_analysis: timingAnalysis,
    connections_summary: connectionsSummary,
    executive_summary: executiveSummary,
    strategic_analysis: strategicAnalysis,
    quality_state: qualityState,
    quality_summary: qualitySummary,
    quality_blockers: qualityBlockers,
    publish_status: normalized.publish_status,
    publication_status: normalized.publication_status,
    run_id: runId || null,
    last_completed_question: lastCompletedQuestion || null,
    resume_from_question: resumeFromQuestion || null,
    failure_reason: failureReason || null,
    failure_category: failureCategory || null,
    retryable,
    checkpoint_consistent: checkpointConsistent,
    non_terminal_question_ids: nonTerminalQuestionIds,
    heartbeat_at: heartbeatAt || null,
    validation_sample: false,
    expected_question_count: FULL_QUESTION_FIRST_PACK_SIZE,
    answered_question_count: answeredQuestions.length,
    question_first_run_path: normalized.question_first_run_path,
  }
  normalized.tabs = buildDossierTabs(normalized, { entityType: normalized.entity_type })
  return normalized
}

function dossierHasMeaningfulPublicationArtifacts(dossier: Record<string, any>): boolean {
  const discoverySummary = ensureObject(dossier.question_first?.discovery_summary || dossier.discovery_summary)
  const graphitiSalesBrief = ensureObject(discoverySummary.graphiti_sales_brief || dossier.graphiti_sales_brief)
  const yellowPantherFit = ensureObject(discoverySummary.yellow_panther_fit || discoverySummary.yellow_panther_opportunity || dossier.yellow_panther_fit)
  const executiveSummary = ensureObject(dossier.executive_summary)
  const strategicAnalysis = ensureObject(dossier.strategic_analysis)
  const promotedSignals = [
    ...(Array.isArray(discoverySummary.opportunity_signals) ? discoverySummary.opportunity_signals : []),
    ...(Array.isArray(discoverySummary.decision_owners) ? discoverySummary.decision_owners : []),
  ]

  return (
    toText(graphitiSalesBrief.status).toLowerCase() === 'available'
    && isMeaningfulCommercialText(graphitiSalesBrief.buyer_name || graphitiSalesBrief.outreach_angle || graphitiSalesBrief.outreach_target)
    && isMeaningfulCommercialText(yellowPantherFit.fit_rationale || yellowPantherFit.fit_feedback || yellowPantherFit.competitive_advantage)
    && isMeaningfulCommercialText(executiveSummary.summary || executiveSummary.headline)
    && isMeaningfulCommercialText(strategicAnalysis.recommended_approach || strategicAnalysis.overall_assessment)
    && promotedSignals.some((entry) => isMeaningfulCommercialText(entry?.answer || entry?.question_text || entry?.candidate_id))
  )
}

function getPersistedDossierQuestionCount(dossier: unknown): number {
  if (!dossier || typeof dossier !== 'object') {
    return 0
  }

  const payload = dossier as Record<string, unknown>
  const mergedDossier = payload.merged_dossier && typeof payload.merged_dossier === 'object'
    ? payload.merged_dossier as Record<string, unknown>
    : null
  const topLevelQuestions = Array.isArray(payload.questions) ? payload.questions.length : 0
  const mergedQuestions = Array.isArray(mergedDossier?.questions) ? mergedDossier.questions.length : 0
  const questionFirst = payload.question_first && typeof payload.question_first === 'object'
    ? payload.question_first as Record<string, unknown>
    : mergedDossier?.question_first && typeof mergedDossier.question_first === 'object'
      ? mergedDossier.question_first as Record<string, unknown>
      : null
  const questionFirstAnswers = Array.isArray(questionFirst?.answers) ? questionFirst.answers.length : 0

  return Math.max(topLevelQuestions, mergedQuestions, questionFirstAnswers)
}

function getPersistedDossierQualityState(dossier: unknown): string {
  if (!dossier || typeof dossier !== 'object') {
    return ''
  }

  const payload = dossier as Record<string, unknown>
  const mergedDossier = payload.merged_dossier && typeof payload.merged_dossier === 'object'
    ? payload.merged_dossier as Record<string, unknown>
    : null

  return toText(
    payload.quality_state
      ?? payload.question_first?.quality_state
      ?? payload.metadata?.question_first?.quality_state
      ?? mergedDossier?.quality_state
      ?? mergedDossier?.question_first?.quality_state,
  ).toLowerCase()
}

function getPersistedDossierPublishStatus(dossier: unknown): string {
  if (!dossier || typeof dossier !== 'object') {
    return ''
  }

  const payload = dossier as Record<string, unknown>
  const mergedDossier = payload.merged_dossier && typeof payload.merged_dossier === 'object'
    ? payload.merged_dossier as Record<string, unknown>
    : null

  return toText(
    payload.publish_status
      ?? payload.question_first?.publish_status
      ?? payload.metadata?.question_first?.publish_status
      ?? mergedDossier?.publish_status
      ?? mergedDossier?.question_first?.publish_status,
  ).toLowerCase()
}

export function scorePersistedDossierCandidate(dossier: unknown): number {
  const questionCount = getPersistedDossierQuestionCount(dossier)
  const qualityState = getPersistedDossierQualityState(dossier)
  const publishStatus = getPersistedDossierPublishStatus(dossier)
  const qualityPriority = QUALITY_PRIORITY[qualityState] ?? 0

  let score = questionCount
  score += qualityPriority * 100

  if (publishStatus.startsWith('published')) {
    score += 1000
  } else if (publishStatus === 'draft' || publishStatus === 'staged') {
    score -= 100
  }

  if (!qualityState) {
    score -= 500
  }

  if (questionCount === 0) {
    score -= 1000
  }

  return score
}

export function selectBestPersistedDossierCandidate<T extends { dossier_data?: unknown; created_at?: string | null; generated_at?: string | null }>(
  rows: T[] | null | undefined,
): T | null {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null
  }

  const candidates = rows.filter((row) => row?.dossier_data)
  if (candidates.length === 0) {
    return null
  }

  return candidates
    .slice()
    .sort((left, right) => {
      const scoreDiff = scorePersistedDossierCandidate(right.dossier_data) - scorePersistedDossierCandidate(left.dossier_data)
      if (scoreDiff !== 0) {
        return scoreDiff
      }

      const rightTime = Date.parse(String(right.created_at || right.generated_at || '')) || 0
      const leftTime = Date.parse(String(left.created_at || left.generated_at || '')) || 0
      return rightTime - leftTime
    })[0] ?? null
}

function shouldMarkValidationSample(
  dossier: Record<string, any>,
  source: CanonicalArtifactSource,
): boolean {
  const questions = Array.isArray(dossier.questions) ? dossier.questions : []
  const tabs = Array.isArray(dossier.tabs) ? dossier.tabs : []
  const requiredSpecialistTabs = ['digital-stack', 'procurement-ecosystem', 'decision-owners-pois', 'evidence-sources']
  const hasAllSpecialistTabs = requiredSpecialistTabs.every((tabValue) =>
    tabs.some((tab) => tab?.value === tabValue && tab?.hasData !== false),
  )
  const qualityState = toText(dossier.quality_state).toLowerCase()
  const entityName = toText(dossier.entity_name)
  const entityId = toText(dossier.entity_id)
  const proofDefinition = VALIDATION_ROLLOUT_PROOF_SET.find((item) => {
    const aliases = [item.display_name, ...(item.aliases ?? [])].map((value) => value.trim().toLowerCase())
    return item.entity_uuid === entityId || aliases.includes(entityName.toLowerCase())
  })

  return Boolean(
    proofDefinition
      && source !== 'legacy_dossier'
      && questions.length >= Number(proofDefinition.expected_question_count || FULL_QUESTION_FIRST_PACK_SIZE)
      && qualityState === proofDefinition.expected_quality_state
      && hasAllSpecialistTabs,
  )
}

function applyValidationSamplePolicy(
  dossier: Record<string, any>,
  source: CanonicalArtifactSource,
): Record<string, any> {
  const validationSample = shouldMarkValidationSample(dossier, source)
  return {
    ...dossier,
    validation_sample: validationSample,
    metadata: {
      ...ensureObject(dossier.metadata),
      question_first: {
        ...ensureObject(dossier.metadata?.question_first),
        validation_sample: validationSample,
      },
    },
  }
}

function applyCheckpointMetadata(
  dossier: Record<string, any>,
  checkpoint: Record<string, any> | null,
  source: CanonicalArtifactSource,
): Record<string, any> {
  const metadataQuestionFirst = ensureObject(dossier.metadata?.question_first)
  const heartbeatAt = toText(checkpoint?.heartbeat_at || metadataQuestionFirst.heartbeat_at || dossier.heartbeat_at)
  const failureReason = toText(checkpoint?.failure_reason || metadataQuestionFirst.failure_reason || dossier.failure_reason)
  const failureCategory = toText(checkpoint?.failure_category || metadataQuestionFirst.failure_category || dossier.failure_category)
  const retryable = Boolean(checkpoint?.retryable ?? metadataQuestionFirst.retryable ?? dossier.retryable)
  const rawCheckpointConsistent = checkpoint?.checkpoint_consistent ?? metadataQuestionFirst.checkpoint_consistent ?? dossier.checkpoint_consistent ?? true
  const nonTerminalQuestionIds = Array.isArray(checkpoint?.non_terminal_question_ids)
    ? checkpoint.non_terminal_question_ids.map((value: unknown) => toText(value)).filter(Boolean)
    : Array.isArray(metadataQuestionFirst.non_terminal_question_ids)
      ? metadataQuestionFirst.non_terminal_question_ids.map((value: unknown) => toText(value)).filter(Boolean)
      : Array.isArray(dossier.non_terminal_question_ids)
        ? dossier.non_terminal_question_ids.map((value: unknown) => toText(value)).filter(Boolean)
        : []
  const checkpointConsistent = failureCategory.toLowerCase() === 'checkpoint_inconsistency'
    ? false
    : (Boolean(rawCheckpointConsistent) && nonTerminalQuestionIds.length === 0)
  const lastCompletedQuestion = toText(checkpoint?.last_completed_question || metadataQuestionFirst.last_completed_question || dossier.last_completed_question)
  const resumeFromQuestion = toText(checkpoint?.resume_from_question || metadataQuestionFirst.resume_from_question || dossier.resume_from_question)
  const runId = toText(checkpoint?.run_id || metadataQuestionFirst.run_id || dossier.run_id)
  const qualityState = toText(dossier.quality_state).toLowerCase()
  const requestedPublishStatus = toText(checkpoint?.publish_status || metadataQuestionFirst.publish_status || dossier.publish_status)
    || (
      source === 'question_first_dossier' && ['complete', 'blocked', 'client_ready'].includes(qualityState)
        ? 'published_valid'
        : source === 'question_first_dossier'
          ? 'published_shadow'
          : 'staged'
    )
  const hasMeaningfulArtifacts = dossierHasMeaningfulPublicationArtifacts(dossier)
  let publishStatus = (!checkpointConsistent || nonTerminalQuestionIds.length > 0) ? 'draft' : requestedPublishStatus
  if (publishStatus.startsWith('published') && !hasMeaningfulArtifacts) {
    publishStatus = qualityState === 'client_ready' ? 'published_partial' : 'published_partial'
  }
  if (publishStatus === 'draft' && hasMeaningfulArtifacts && qualityState === 'client_ready') {
    publishStatus = 'published'
  }

  return {
    ...dossier,
    publish_status: publishStatus,
    run_id: runId || dossier.run_id || null,
    last_completed_question: lastCompletedQuestion || dossier.last_completed_question || null,
    resume_from_question: resumeFromQuestion || dossier.resume_from_question || null,
    failure_reason: failureReason || dossier.failure_reason || null,
    failure_category: failureCategory || dossier.failure_category || null,
    retryable,
    checkpoint_consistent: checkpointConsistent,
    non_terminal_question_ids: nonTerminalQuestionIds,
    heartbeat_at: heartbeatAt || dossier.heartbeat_at || null,
    metadata: {
      ...ensureObject(dossier.metadata),
      question_first: {
        ...metadataQuestionFirst,
        publish_status: publishStatus,
        run_id: runId || metadataQuestionFirst.run_id || null,
        last_completed_question: lastCompletedQuestion || metadataQuestionFirst.last_completed_question || null,
        resume_from_question: resumeFromQuestion || metadataQuestionFirst.resume_from_question || null,
        failure_reason: failureReason || metadataQuestionFirst.failure_reason || null,
        failure_category: failureCategory || metadataQuestionFirst.failure_category || null,
        retryable,
        checkpoint_consistent: checkpointConsistent,
        non_terminal_question_ids: nonTerminalQuestionIds,
        heartbeat_at: heartbeatAt || metadataQuestionFirst.heartbeat_at || null,
      },
    },
  }
}

function getNormalizedQuestionCount(dossier: Record<string, any> | null): number {
  return Array.isArray(dossier?.questions)
    ? dossier.questions.length
    : Array.isArray(dossier?.answers)
      ? dossier.answers.length
      : 0
}

function getQualityPriority(qualityState: unknown): number {
  return QUALITY_PRIORITY[toText(qualityState).toLowerCase()] ?? 0
}

function shouldHydrateCanonicalDossierWithRun(
  dossier: Record<string, any>,
  runPayload: Record<string, any>,
  entityId: string,
  entity?: EntityLike | null,
): boolean {
  const normalizedDossier = normalizeQuestionFirstDossier(dossier, entityId, entity)
  const normalizedRun = normalizeQuestionFirstDossier(
    mergeQuestionFirstRunArtifactIntoDossier({}, runPayload),
    entityId,
    entity,
  )
  const dossierQualityPriority = getQualityPriority(normalizedDossier.quality_state)
  const runQualityPriority = getQualityPriority(normalizedRun.quality_state)
  const dossierQuestionCount = getNormalizedQuestionCount(normalizedDossier)
  const runQuestionCount = getNormalizedQuestionCount(normalizedRun)

  if (runQuestionCount < dossierQuestionCount) {
    return false
  }
  if (runQualityPriority < dossierQualityPriority) {
    return false
  }
  return true
}

export async function resolveCanonicalQuestionFirstDossier(entityId: string, entity?: EntityLike | null) {
  const latestQuestionFirstDossier = await getLatestQuestionFirstDossierArtifact(entityId, entity)
  const latestQuestionFirstRun = await getLatestQuestionFirstRunArtifact(entityId, entity)
  const latestQuestionFirstState = await getLatestQuestionFirstStateArtifact(entityId, entity)

  if (
    latestQuestionFirstDossier?.path?.includes(`${path.sep}demo${path.sep}`)
    && latestQuestionFirstRun?.payload
  ) {
    const promoted = mergeQuestionFirstRunArtifactIntoDossier({}, latestQuestionFirstRun.payload)
    const normalized = applyCheckpointMetadata(
      normalizeQuestionFirstDossier(promoted, entityId, entity),
      latestQuestionFirstState?.payload || null,
      'question_first_run',
    )
    if (entity && !dossierMatchesEntityIdentity(normalized, entityId, entity)) {
      return {
        dossier: null,
        source: null,
        artifactPath: null,
      }
    }
    return {
      dossier: applyValidationSamplePolicy(normalized, 'question_first_run'),
      source: 'question_first_run' as const,
      artifactPath: latestQuestionFirstRun.path,
    }
  }

  if (latestQuestionFirstDossier?.payload) {
    const baseDossierPayload = ensureObject(latestQuestionFirstDossier.payload)
    const shouldHydrateWithRun = latestQuestionFirstRun?.payload
      ? shouldHydrateCanonicalDossierWithRun(baseDossierPayload, latestQuestionFirstRun.payload, entityId, entity)
      : false
    const hydratedDossier = shouldHydrateWithRun
      ? (
          baseDossierPayload.merged_dossier && typeof baseDossierPayload.merged_dossier === 'object'
            ? {
                ...baseDossierPayload,
                merged_dossier: mergeQuestionFirstRunArtifactIntoDossier(baseDossierPayload.merged_dossier as Record<string, any>, latestQuestionFirstRun.payload),
              }
            : mergeQuestionFirstRunArtifactIntoDossier(baseDossierPayload, latestQuestionFirstRun.payload)
        )
      : baseDossierPayload
    const normalized = applyCheckpointMetadata(
      normalizeQuestionFirstDossier(hydratedDossier, entityId, entity),
      latestQuestionFirstState?.payload || null,
      'question_first_dossier',
    )
    if (entity && !dossierMatchesEntityIdentity(normalized, entityId, entity)) {
      return {
        dossier: null,
        source: null,
        artifactPath: null,
      }
    }
    return {
      dossier: applyValidationSamplePolicy(normalized, 'question_first_dossier'),
      source: 'question_first_dossier' as const,
      artifactPath: latestQuestionFirstDossier.path,
    }
  }

  if (latestQuestionFirstRun?.payload) {
    const promoted = mergeQuestionFirstRunArtifactIntoDossier({}, latestQuestionFirstRun.payload)
    const normalized = applyCheckpointMetadata(
      normalizeQuestionFirstDossier(promoted, entityId, entity),
      latestQuestionFirstState?.payload || null,
      'question_first_run',
    )
    if (entity && !dossierMatchesEntityIdentity(normalized, entityId, entity)) {
      return {
        dossier: null,
        source: null,
        artifactPath: null,
      }
    }
    return {
      dossier: applyValidationSamplePolicy(normalized, 'question_first_run'),
      source: 'question_first_run' as const,
      artifactPath: latestQuestionFirstRun.path,
    }
  }

  return {
    dossier: null,
    source: null,
    artifactPath: null,
  }
}
