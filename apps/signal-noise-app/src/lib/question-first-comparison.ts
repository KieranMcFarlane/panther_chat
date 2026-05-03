import { mergeQuestionFirstRunArtifactIntoDossier, normalizeQuestionFirstDossier } from './question-first-dossier.ts'

type EntityLike = {
  id?: unknown
  uuid?: unknown
  entity_uuid?: unknown
  properties?: Record<string, unknown> | null
}

export type QuestionFirstComparisonLane = 'current-batch' | 'full-run' | 'smoke' | 'legacy'

export type QuestionFirstComparisonInput = {
  label: string
  lane: QuestionFirstComparisonLane
  payload: Record<string, any>
  entityId?: string
  entity?: EntityLike | null
  sourceType?: 'question_first_dossier' | 'question_first_run'
}

export type QuestionFirstComparisonItem = {
  label: string
  lane: QuestionFirstComparisonLane
  source_type: 'question_first_dossier' | 'question_first_run'
  entity_id: string
  entity_name: string
  questions_total: number
  answered_count: number
  validation_counts: {
    validated: number
    provisional: number
    no_signal: number
    blocked: number
    skipped: number
    failed: number
    other: number
  }
  promoted_sections: string[]
  synthesis: {
    has_core_info: boolean
    has_executive_summary: boolean
    has_digital_transformation: boolean
    has_procurement_signals: boolean
    has_timing_analysis: boolean
    has_connections_summary: boolean
    has_strategic_analysis: boolean
    has_recommended_approach: boolean
  }
  quality_state: string
  quality_summary: string
}

export type QuestionFirstComparisonReport = {
  generated_at: string
  summary: {
    total_items: number
    by_lane: Record<QuestionFirstComparisonLane, number>
  }
  items: QuestionFirstComparisonItem[]
}

function ensureObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {}
}

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

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).length > 0
  }
  return value !== null && value !== undefined && value !== ''
}

function normalizeComparisonPayload(input: QuestionFirstComparisonInput): Record<string, any> {
  const payload = ensureObject(input.payload)
  if (input.sourceType === 'question_first_run' || Array.isArray(payload.answer_records) || Array.isArray(payload.question_specs) || hasValue(payload.merge_patch)) {
    const merged = mergeQuestionFirstRunArtifactIntoDossier({}, payload)
    return normalizeQuestionFirstDossier(merged, input.entityId || toText(payload.entity_id) || input.label, input.entity)
  }

  return normalizeQuestionFirstDossier(payload, input.entityId || toText(payload.entity_id) || input.label, input.entity)
}

function countValidationStates(answers: Record<string, any>[]) {
  const counts = {
    validated: 0,
    provisional: 0,
    no_signal: 0,
    blocked: 0,
    skipped: 0,
    failed: 0,
    other: 0,
  }

  for (const answer of answers) {
    const validationState = toText(answer?.validation_state || answer?.terminal_state).toLowerCase()
    if (validationState in counts) {
      counts[validationState as keyof typeof counts] += 1
    } else {
      counts.other += 1
    }
  }

  return counts
}

function getPromotedSections(dossier: Record<string, any>): string[] {
  const sections: Array<[string, unknown]> = [
    ['core_info', dossier.core_info],
    ['digital_transformation', dossier.digital_transformation],
    ['procurement_signals', dossier.procurement_signals],
    ['timing_analysis', dossier.timing_analysis],
    ['connections_summary', dossier.connections_summary],
    ['executive_summary', dossier.executive_summary],
    ['strategic_analysis', dossier.strategic_analysis],
    ['recommended_approach', dossier.recommended_approach],
    ['question_first.discovery_summary', dossier.question_first?.discovery_summary],
    ['question_first.dossier_promotions', dossier.question_first?.dossier_promotions],
    ['question_first.evidence_items', dossier.question_first?.evidence_items],
  ]

  return sections.filter(([, value]) => hasValue(value)).map(([name]) => name)
}

function summarizeInput(input: QuestionFirstComparisonInput): QuestionFirstComparisonItem {
  const normalized = normalizeComparisonPayload(input)
  const answers = Array.isArray(normalized.answers)
    ? normalized.answers
    : Array.isArray(normalized.question_first?.answers)
      ? normalized.question_first.answers
      : []
  const validationCounts = countValidationStates(answers)
  const questionsTotal = Math.max(
    Array.isArray(normalized.questions) ? normalized.questions.length : 0,
    answers.length,
    Array.isArray(normalized.question_first?.answers) ? normalized.question_first.answers.length : 0,
  )

  return {
    label: input.label,
    lane: input.lane,
    source_type: input.sourceType
      || (Array.isArray(input.payload.answer_records) || Array.isArray(input.payload.question_specs) || hasValue(input.payload.merge_patch)
        ? 'question_first_run'
        : 'question_first_dossier'),
    entity_id: toText(normalized.entity_id || input.entityId || input.payload.entity_id || input.label),
    entity_name: toText(normalized.entity_name || input.payload.entity_name || input.label),
    questions_total: questionsTotal,
    answered_count: validationCounts.validated + validationCounts.provisional,
    validation_counts: validationCounts,
    promoted_sections: getPromotedSections(normalized),
    synthesis: {
      has_core_info: hasValue(normalized.core_info),
      has_executive_summary: hasValue(normalized.executive_summary),
      has_digital_transformation: hasValue(normalized.digital_transformation),
      has_procurement_signals: hasValue(normalized.procurement_signals),
      has_timing_analysis: hasValue(normalized.timing_analysis),
      has_connections_summary: hasValue(normalized.connections_summary),
      has_strategic_analysis: hasValue(normalized.strategic_analysis),
      has_recommended_approach: hasValue(normalized.recommended_approach),
    },
    quality_state: toText(normalized.quality_state),
    quality_summary: toText(normalized.quality_summary),
  }
}

export function buildQuestionFirstComparisonReport(inputs: QuestionFirstComparisonInput[]): QuestionFirstComparisonReport {
  const items = inputs.map((input) => summarizeInput(input))
  const byLane: Record<QuestionFirstComparisonLane, number> = {
    'current-batch': 0,
    'full-run': 0,
    smoke: 0,
    legacy: 0,
  }

  for (const item of items) {
    byLane[item.lane] += 1
  }

  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_items: items.length,
      by_lane: byLane,
    },
    items,
  }
}
