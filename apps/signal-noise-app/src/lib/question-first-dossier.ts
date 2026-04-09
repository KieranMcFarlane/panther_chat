import { existsSync, readdirSync, statSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'

import { getDossierRoots } from '@/lib/dossier-paths'
import { buildDossierTabs } from '@/lib/dossier-tabs'
import { matchesEntityUuid, resolveEntityUuid } from '@/lib/entity-public-id'
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

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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
  return uniqueStrings([
    entityId,
    toText(entity?.uuid),
    toText(entity?.entity_uuid),
    toText(entity?.id),
    toText(entity?.neo4j_id),
    name,
    slugify(name),
    name.replace(/\s+/g, '-'),
    name.replace(/\s+/g, '_'),
  ])
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

function buildLegacyMergedQuestions(
  questionSpecs: Record<string, any>[],
  answerRecords: Record<string, any>[],
  questionTimings: Record<string, any>,
): Record<string, any>[] {
  const answerIndex = new Map<string, Record<string, any>>()
  for (const answer of answerRecords) {
    const questionId = toText(answer?.question_id)
    if (questionId && !answerIndex.has(questionId)) {
      answerIndex.set(questionId, answer)
    }
  }

  return questionSpecs.map((question) => {
    const questionId = toText(question.question_id)
    const answer = questionId ? answerIndex.get(questionId) : null
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
    answers: Array.isArray(questionFirstPatch.answers) ? questionFirstPatch.answers : answerRecords ?? payload.answers ?? [],
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

export function normalizeQuestionFirstDossier(
  dossierPayload: Record<string, any>,
  entityId: string,
  entity?: EntityLike | null,
) {
  const rawDossier = ensureObject(dossierPayload)
  const dossier = rawDossier.merged_dossier && typeof rawDossier.merged_dossier === 'object'
    ? ensureObject(rawDossier.merged_dossier)
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
  const runRollup = ensureObject(questionFirst.run_rollup).questions_total
    ? questionFirst.run_rollup
    : ensureObject(dossier.run_rollup)
  const categories = Array.isArray(questionFirst.categories) ? questionFirst.categories : Array.isArray(dossier.categories) ? dossier.categories : []
  const answers = Array.isArray(questionFirst.answers) ? questionFirst.answers : Array.isArray(dossier.answers) ? dossier.answers : []
  const questionTimings = Object.keys(ensureObject(questionFirst.question_timings)).length > 0
    ? ensureObject(questionFirst.question_timings)
    : ensureObject(metadataQuestionFirst.question_timings)
  const poiGraph = Object.keys(ensureObject(questionFirst.poi_graph)).length > 0
    ? ensureObject(questionFirst.poi_graph)
    : ensureObject(metadataQuestionFirst.poi_graph)

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
    question_timings: questionTimings,
    poi_graph: poiGraph,
  } as Record<string, any>

  normalized.tabs = buildDossierTabs(normalized, { entityType: normalized.entity_type })
  return normalized
}

export async function resolveCanonicalQuestionFirstDossier(entityId: string, entity?: EntityLike | null) {
  const latestQuestionFirstDossier = await getLatestQuestionFirstDossierArtifact(entityId, entity)
  if (latestQuestionFirstDossier?.payload) {
    return {
      dossier: normalizeQuestionFirstDossier(latestQuestionFirstDossier.payload, entityId, entity),
      source: 'question_first_dossier' as const,
      artifactPath: latestQuestionFirstDossier.path,
    }
  }

  const latestQuestionFirstRun = await getLatestQuestionFirstRunArtifact(entityId, entity)
  if (latestQuestionFirstRun?.payload) {
    const promoted = mergeQuestionFirstRunArtifactIntoDossier({}, latestQuestionFirstRun.payload)
    return {
      dossier: normalizeQuestionFirstDossier(promoted, entityId, entity),
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
