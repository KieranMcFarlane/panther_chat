type CheckpointLike = {
  entity_name?: string | null
  current_section_label?: string | null
  current_question_index?: number | null
  current_question_total?: number | null
  current_question_text?: string | null
  current_execution_state?: string | null
  current_substep_label?: string | null
  current_substep?: string | null
  current_stage?: string | null
  current_action?: string | null
  phase?: string | null
  current_strategy_label?: string | null
  current_source_order?: string[] | null
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function formatCheckpointQuestionProgress(item: CheckpointLike | null | undefined) {
  if (!item) return null
  const index = Number(item.current_question_index)
  const total = Number(item.current_question_total)
  if (Number.isFinite(index) && Number.isFinite(total) && total > 0) {
    return `Q${index}/${total}`
  }
  return null
}

export function buildCheckpointSummary(item: CheckpointLike | null | undefined) {
  if (!item) return null
  const sectionLabel = toText(item.current_section_label)
  const questionProgress = formatCheckpointQuestionProgress(item)
  const questionText = toText(item.current_question_text)
  const executionState = toText(item.current_execution_state)
  const substepLabel = toText(item.current_substep_label || item.current_substep)
  const stageLabel = toText(item.current_stage || item.current_action || item.phase)

  if (sectionLabel && questionText) {
    return [sectionLabel, questionProgress, questionText].filter(Boolean).join(' • ')
  }
  if (sectionLabel && executionState) {
    return [sectionLabel, executionState].filter(Boolean).join(' • ')
  }
  if (sectionLabel && substepLabel) {
    return [sectionLabel, substepLabel].filter(Boolean).join(' • ')
  }
  return questionText || executionState || substepLabel || stageLabel || null
}

export function formatCheckpointCurrentRun(item: CheckpointLike | null | undefined) {
  if (!item) return 'None'
  const entityLabel = toText(item.entity_name)
  const checkpoint = buildCheckpointSummary(item)
  if (entityLabel && checkpoint) {
    return `${entityLabel} · ${checkpoint}`
  }
  return entityLabel || checkpoint || 'None'
}

export function formatCheckpointSourceOrder(sourceOrder: string[] | null | undefined) {
  if (!Array.isArray(sourceOrder) || sourceOrder.length === 0) return 'Unavailable'
  return sourceOrder.join(', ')
}

