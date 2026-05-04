function asRecord(value: any): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function toDisplayText(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(toDisplayText).filter(Boolean).join(', ')
  return ''
}

function formatService(value: any): string {
  return toDisplayText(value).replace(/_/g, ' ').trim().toUpperCase()
}

function discoverySummaryFrom(dossier: any): Record<string, any> {
  const root = asRecord(dossier)
  const questionFirst = asRecord(root.question_first)
  return asRecord(questionFirst.discovery_summary || root.discovery_summary)
}

export function buildYellowPantherOpportunityText(dossier: any, fallback: string): string {
  const summary = discoverySummaryFrom(dossier)
  const fit = asRecord(summary.yellow_panther_fit || summary.yellow_panther_opportunity || asRecord(dossier).yellow_panther_fit)
  const status = toDisplayText(fit.status).toLowerCase()
  const service = formatService(fit.best_service || fit.recommended_service)
  const rationale = toDisplayText(fit.fit_rationale || fit.fit_feedback || fit.summary || fit.answer)

  if (status === 'available' && service && rationale) {
    return `${service}: ${rationale}`
  }
  if (status === 'available' && rationale) {
    return rationale
  }
  if (status === 'available' && service) {
    return service
  }

  return fallback
}

export function buildRecommendedApproachText(dossier: any, fallback: string): string {
  const summary = discoverySummaryFrom(dossier)
  const outreach = asRecord(summary.outreach_strategy || asRecord(dossier).outreach_strategy)
  const status = toDisplayText(outreach.status).toLowerCase()

  if (status === 'available') {
    const target = toDisplayText(outreach.recommended_target)
    const angle = toDisplayText(outreach.recommended_angle || outreach.first_message_strategy || outreach.why_now)
    if (target && angle) return `${target}: ${angle}`
    if (angle) return angle
  }

  if (status === 'insufficient_signal') {
    return toDisplayText(outreach.verification_needed || outreach.confidence_caveat)
      || 'Outreach strategy needs a verified buyer route and commercial trigger before contact.'
  }

  return toDisplayText(summary.recommended_approach || summary.next_best_action) || fallback
}
