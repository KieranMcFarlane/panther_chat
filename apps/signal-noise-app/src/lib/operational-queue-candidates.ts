export type OperationalQueueCandidate = {
  browser_entity_id: string
  entity_id: string
  entity_name: string
  entity_type: string
  source: 'rollout_proof_set' | 'incomplete_entity'
  label: string
  detail: string
}

type QueueDashboardLikePayload = {
  rollout_proof_set?: Array<{
    browser_entity_id: string
    entity_id: string
    entity_name: string
    expected_quality_state?: string | null
    actual_quality_state?: string | null
    summary?: string | null
  }>
  dossier_quality?: {
    incomplete_entities?: Array<{
      browser_entity_id: string
      entity_id: string
      entity_name: string
      entity_type: string
      quality_state?: string | null
      quality_summary?: string | null
      question_count?: number | null
    }>
  }
}

function toText(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function deriveOperationalQueueCandidates(payload: QueueDashboardLikePayload | null | undefined): OperationalQueueCandidate[] {
  const candidates: OperationalQueueCandidate[] = []
  const seen = new Set<string>()

  for (const item of payload?.rollout_proof_set || []) {
    const browserEntityId = toText(item.browser_entity_id || item.entity_id)
    if (!browserEntityId || seen.has(browserEntityId)) continue
    seen.add(browserEntityId)
    const quality = toText(item.actual_quality_state || item.expected_quality_state).replace(/_/g, '-')
    candidates.push({
      browser_entity_id: browserEntityId,
      entity_id: toText(item.entity_id || browserEntityId),
      entity_name: toText(item.entity_name) || browserEntityId,
      entity_type: 'entity',
      source: 'rollout_proof_set',
      label: toText(item.entity_name) || browserEntityId,
      detail: quality ? `${quality}` : 'Rollout proof set entity',
    })
  }

  for (const item of payload?.dossier_quality?.incomplete_entities || []) {
    const browserEntityId = toText(item.browser_entity_id || item.entity_id)
    if (!browserEntityId || seen.has(browserEntityId)) continue
    seen.add(browserEntityId)
    const questionCount = typeof item.question_count === 'number' ? ` • ${item.question_count} questions` : ''
    const quality = toText(item.quality_state).replace(/_/g, '-')
    candidates.push({
      browser_entity_id: browserEntityId,
      entity_id: toText(item.entity_id || browserEntityId),
      entity_name: toText(item.entity_name) || browserEntityId,
      entity_type: toText(item.entity_type) || 'entity',
      source: 'incomplete_entity',
      label: toText(item.entity_name) || browserEntityId,
      detail: `${quality || 'partial'}${questionCount}`,
    })
  }

  return candidates
}
