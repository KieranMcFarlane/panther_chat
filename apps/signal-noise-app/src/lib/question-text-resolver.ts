type QuestionLike = Record<string, unknown>

type QuestionTextSource = {
  question_id?: unknown
  question_text?: unknown
  question?: unknown
  prompt?: unknown
  title?: unknown
  label?: unknown
  summary?: unknown
  text?: unknown
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeQuestionId(value: unknown): string {
  return toText(value).toLowerCase()
}

function extractQuestionText(question: QuestionTextSource): string {
  return toText(
    question.question_text
    || question.question
    || question.prompt
    || question.title
    || question.label
    || question.summary
    || question.text,
  )
}

function addQuestionEntry(index: Map<string, string>, question: QuestionTextSource | null | undefined) {
  if (!question || typeof question !== 'object') return
  const questionId = normalizeQuestionId(question.question_id)
  if (!questionId) return
  const questionText = extractQuestionText(question)
  if (!questionText) return

  const existing = index.get(questionId)
  if (!existing || existing === questionId || questionText.length > existing.length) {
    index.set(questionId, questionText)
  }
}

function collectQuestionCollections(payload: QuestionLike): QuestionTextSource[][] {
  const questionFirst = payload.question_first && typeof payload.question_first === 'object'
    ? payload.question_first as QuestionLike
    : {}
  const mergedDossier = payload.merged_dossier && typeof payload.merged_dossier === 'object'
    ? payload.merged_dossier as QuestionLike
    : {}
  const mergedQuestionFirst = mergedDossier.question_first && typeof mergedDossier.question_first === 'object'
    ? mergedDossier.question_first as QuestionLike
    : {}
  const questionFirstRun = payload.question_first_run && typeof payload.question_first_run === 'object'
    ? payload.question_first_run as QuestionLike
    : {}

  return [
    Array.isArray(payload.questions) ? payload.questions as QuestionTextSource[] : [],
    Array.isArray(questionFirst.questions) ? questionFirst.questions as QuestionTextSource[] : [],
    Array.isArray(questionFirst.answers) ? questionFirst.answers as QuestionTextSource[] : [],
    Array.isArray(questionFirst.answer_records) ? questionFirst.answer_records as QuestionTextSource[] : [],
    Array.isArray(mergedDossier.questions) ? mergedDossier.questions as QuestionTextSource[] : [],
    Array.isArray(mergedQuestionFirst.questions) ? mergedQuestionFirst.questions as QuestionTextSource[] : [],
    Array.isArray(mergedQuestionFirst.answers) ? mergedQuestionFirst.answers as QuestionTextSource[] : [],
    Array.isArray(questionFirstRun.question_specs) ? questionFirstRun.question_specs as QuestionTextSource[] : [],
    Array.isArray(questionFirstRun.questions) ? questionFirstRun.questions as QuestionTextSource[] : [],
    Array.isArray(questionFirstRun.answer_records) ? questionFirstRun.answer_records as QuestionTextSource[] : [],
    Array.isArray(payload.answers) ? payload.answers as QuestionTextSource[] : [],
  ]
}

export function buildQuestionTextIndex(dossierData: unknown): Map<string, string> {
  const index = new Map<string, string>()
  if (!dossierData || typeof dossierData !== 'object') {
    return index
  }

  const payload = dossierData as QuestionLike
  for (const collection of collectQuestionCollections(payload)) {
    for (const question of collection) {
      addQuestionEntry(index, question)
    }
  }

  return index
}

export function resolveQuestionTextFromDossierData(dossierData: unknown, questionId: string | null | undefined): string | null {
  const normalizedQuestionId = normalizeQuestionId(questionId)
  if (!normalizedQuestionId) return null
  const index = buildQuestionTextIndex(dossierData)
  return index.get(normalizedQuestionId) || null
}
