import { existsSync, readdirSync, statSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'

import { getDossierRoots } from '@/lib/dossier-paths'
import { buildDossierTabs } from '@/lib/dossier-tabs'
import { matchesEntityUuid, resolveEntityUuid } from '@/lib/entity-public-id'
import { VALIDATION_ROLLOUT_PROOF_SET } from '@/lib/rollout-proof-set'
import { allowDemoFallbacks } from '@/lib/runtime-env'

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
}): 'answered' | 'no_signal' | 'blocked' | 'skipped' {
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

  if (hasAnswerText && ['validated', 'partially_validated', 'deterministic_detected', 'provisional', 'inferred'].includes(validationState)) {
    return 'answered'
  }

  if (
    blockedNote.includes('question conditions were not met')
    || blockedNote.includes('no capability-gap inference')
    || blockedNote.includes('upstream signals are available yet')
    || (dependsOn.length > 0 && validationState === 'no_signal' && !hasAnswerText)
  ) {
    return 'blocked'
  }

  return 'no_signal'
}

function deriveQuestionTerminalSummary(input: {
  questionSpec?: Record<string, any>
  answerRecord: Record<string, any>
  answer: Record<string, any>
  rawStructuredOutput: Record<string, any>
  timeoutSalvage: Record<string, any>
  terminalState: 'answered' | 'no_signal' | 'blocked' | 'skipped'
  rawAnswerValue: unknown
}): string {
  const commercialInterpretation = ensureObject(input.answer.commercial_interpretation)
  const summaryCandidates = [
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
  const answeredQuestions = questionsPresent.filter((question) => getQuestionTerminalState(ensureObject(question)) === 'answered')
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
  const requiredQuestionBlockers = REQUIRED_QUESTION_IDS.flatMap((questionId) => {
    const question = questionsPresent.find((candidate) => toText(ensureObject(candidate).question_id) === questionId)
    if (!question) {
      return [`${questionId} is missing from the persisted dossier`]
    }

    const normalizedQuestion = ensureObject(question)
    const terminalState = getQuestionTerminalState(normalizedQuestion)
    if (terminalState === 'answered' || terminalState === 'skipped') {
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
  const clientReady = questionFirst.discovery_summary?.client_ready === true
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

  const normalized = {
    ...dossier,
    entity_id: entityUuid,
    entity_name: getEntityName(entity, dossier),
    entity_type: getEntityType(entity, dossier),
    metadata: {
      ...metadata,
      question_first: {
        ...metadataQuestionFirst,
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
      run_rollup: runRollup,
      categories,
      answers,
      question_timings: questionTimings,
      poi_graph: poiGraph,
    },
    run_rollup: runRollup,
    categories,
    answers,
    questions,
    question_timings: questionTimings,
    poi_graph: poiGraph,
    question_first_run_path: toText(dossier.question_first_run_path || rawDossier.question_first_run_path) || null,
    quality_state: qualityState,
    quality_summary: qualitySummary,
    quality_blockers: qualityBlockers,
    publish_status: publishStatus || 'draft',
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
    quality_state: qualityState,
    quality_summary: qualitySummary,
    quality_blockers: qualityBlockers,
    publish_status: publishStatus || 'draft',
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
  const publishStatus = (!checkpointConsistent || nonTerminalQuestionIds.length > 0) ? 'draft' : requestedPublishStatus

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
