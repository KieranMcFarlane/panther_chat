export type LegacyOpportunityRecoveryTier = 'recoverable_legacy' | 'legacy_context_only' | 'legacy_data_issue'

export interface LegacyOpportunityRecoveryScore {
  legacy_recovery_tier: LegacyOpportunityRecoveryTier
  legacy_recovery_score: number
  legacy_recovery_blockers: string[]
  recommended_recovery_action: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function numberValue(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function arrayTexts(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(text).filter(Boolean)
}

function joinedRowText(row: Record<string, unknown>, rawPayload: Record<string, unknown>) {
  const qualification = asRecord(rawPayload.commercial_qualification)
  const temporal = asRecord(rawPayload.temporal_reasoning)
  const strategyBrief = asRecord(rawPayload.bd_strategy_brief)
  const qualityMetrics = asRecord(rawPayload.quality_metrics)

  return [
    row.title,
    row.entity_name,
    row.canonical_entity_name,
    rawPayload.summary,
    rawPayload.why_it_matters,
    rawPayload.yellow_panther_fit_feedback,
    rawPayload.yp_fit_reasoning,
    rawPayload.best_path_owner,
    rawPayload.recommended_action,
    rawPayload.supporting_signals,
    rawPayload.evidence,
    rawPayload.raw_facts,
    rawPayload.answer,
    rawPayload.context,
    rawPayload.signal_title,
    qualification.status,
    qualification.promotion_reason,
    qualification.blockers,
    qualification.buying_triggers,
    qualification.trigger_evidence,
    temporal.status,
    strategyBrief.signal_title,
    strategyBrief.decision_summary,
    strategyBrief.what_happened,
    strategyBrief.why_it_matters_now,
    strategyBrief.yellow_panther_angle,
    strategyBrief.disqualifiers,
    qualityMetrics.failed_fact_count,
    qualityMetrics.no_signal_fact_count,
  ].map((value) => {
    if (Array.isArray(value)) return value.map((item) => typeof item === 'object' ? JSON.stringify(item) : text(item)).join(' ')
    if (value && typeof value === 'object') return JSON.stringify(value)
    return text(value)
  }).filter(Boolean).join(' ')
}

function evidenceCountFor(row: Record<string, unknown>, rawPayload: Record<string, unknown>) {
  const metrics = asRecord(rawPayload.quality_metrics)
  const explicitEvidence = Array.isArray(rawPayload.evidence) ? rawPayload.evidence.length : 0
  const evidenceUrls = arrayTexts(rawPayload.evidence_urls).length
  return Math.max(
    numberValue(row.evidence_count),
    numberValue(rawPayload.evidence_count),
    numberValue(rawPayload.evidence_url_count),
    numberValue(metrics.evidence_url_count),
    explicitEvidence,
    evidenceUrls,
  )
}

function usefulFactCountFor(row: Record<string, unknown>, rawPayload: Record<string, unknown>) {
  const metrics = asRecord(rawPayload.quality_metrics)
  return Math.max(
    numberValue(row.answer_count),
    numberValue(row.useful_fact_count),
    numberValue(rawPayload.answer_count),
    numberValue(rawPayload.useful_fact_count),
    numberValue(metrics.useful_fact_count),
  )
}

function hasSportsRelevantAccount(row: Record<string, unknown>, rawPayload: Record<string, unknown>, corpus: string) {
  const taxonomy = asRecord(rawPayload.taxonomy)
  const sport = text(row.sport || rawPayload.sport || taxonomy.sport)
  const competition = text(row.competition || rawPayload.competition || taxonomy.competition)
  const entityRole = text(row.entity_role || rawPayload.entity_role || taxonomy.entity_role)
  const entityName = text(row.entity_name || row.canonical_entity_name)
  const sportsRelevantPattern = /\b(club|fc|football|rugby|cricket|basketball|hockey|tennis|padel|federation|league|tour|team|stadium|arena|athletics|sport|sports|racing|olympic|paralympic|fifa|fiba|uefa|nhl|nfl|mlb|nba|mls|rfu|pcb|icc)\b/i

  return Boolean(sport || competition || entityRole)
    || sportsRelevantPattern.test(entityName)
    || sportsRelevantPattern.test(corpus)
}

function hasSpecificCommercialSignal(corpus: string) {
  return /\b(recruitment analyst|vacanc|hiring|rfp|tender|procurement|grant|funding|investment|launch|launched|platform|app|mobile|ott|streaming|broadcast|partnership|sponsor|digital transformation|analytics|fan engagement|ticketing|crm|data platform|academy|scouting)\b/i.test(corpus)
}

function hasPlausibleYellowPantherWedge(corpus: string) {
  return /\b(app|mobile|fan engagement|digital|platform|analytics|ai|data|backend|api|integration|sports tech|streaming|ott|ticketing|crm|academy|scouting|recruitment intelligence|market monitoring|consulting|transformation)\b/i.test(corpus)
}

function hasGenericContextOnlySignal(corpus: string) {
  return /\b(government|national digital|humanitarian|election|public procurement|civic|country-wide|ministry|political crisis|capability gaps|infrastructure gaps)\b/i.test(corpus)
    && !/\b(club|league|federation|team|stadium|sport|sports|fan|ticketing|athlete|academy)\b/i.test(corpus)
}

function hasDataIssue(corpus: string) {
  // Keep exact strings here for the contract and for operators scanning source:
  // wrong_entity, kind: summary, blocked by upstream question state, question execution failed.
  return /wrong_entity|wrong entity|entity mismatch|kind:\s*summary|blocked by upstream question state|question execution failed|tool execution failed|runtime failure|no deterministic answer was produced|No BrightData tool|failed-only|no public .*found|preferred supplier list|preferred supplier lists|\[object Object\]/i.test(corpus)
}

function hasNegativeSignalFramedAsOpportunity(corpus: string) {
  return /\b(no proprietary product|no evidence of any launched products|no public rfps|no procurement signal|no buying trigger|no clear fit|not a commercial opportunity)\b/i.test(corpus)
}

function recoveryActionFor(tier: LegacyOpportunityRecoveryTier, blockers: string[]) {
  if (tier === 'recoverable_legacy') {
    return 'Dry-run reprocess this row through the current classifier and GLM strategy synthesis before trusting it.'
  }
  if (tier === 'legacy_context_only') {
    return blockers.length > 0
      ? `Keep as legacy context until this is resolved: ${blockers[0]}.`
      : 'Keep as legacy context until a current trigger and buyer route are verified.'
  }
  return blockers.length > 0
    ? `Do not recover until the data issue is fixed: ${blockers[0]}.`
    : 'Do not recover until entity mapping, evidence, and pipeline leakage are cleaned.'
}

export function scoreLegacyOpportunityRecovery(row: Record<string, unknown>): LegacyOpportunityRecoveryScore {
  const rawPayload = asRecord(row.raw_payload)
  const corpus = joinedRowText(row, rawPayload)
  const blockers: string[] = []
  const evidenceCount = evidenceCountFor(row, rawPayload)
  const usefulFactCount = usefulFactCountFor(row, rawPayload)
  const yellowPantherFit = numberValue(row.yellow_panther_fit ?? rawPayload.yellow_panther_fit)
  const sportsRelevant = hasSportsRelevantAccount(row, rawPayload, corpus)
  const specificSignal = hasSpecificCommercialSignal(corpus)
  const plausibleWedge = hasPlausibleYellowPantherWedge(corpus)

  if (evidenceCount <= 0) blockers.push('No evidence URLs')
  if (!sportsRelevant) blockers.push('Not sports-relevant')
  if (!specificSignal) blockers.push('No specific commercial signal')
  if (!plausibleWedge) blockers.push('No clear Yellow Panther wedge')

  const dataIssue = hasDataIssue(corpus)
  const negativeSignal = hasNegativeSignalFramedAsOpportunity(corpus)
  const genericContext = hasGenericContextOnlySignal(corpus)

  if (dataIssue) blockers.push('Pipeline leakage, wrong-entity evidence, or failed execution text')
  if (negativeSignal) blockers.push('Negative or zero-evidence finding was framed as a signal')
  if (genericContext) blockers.push('Generic non-sports context')

  const rawScore = Math.round(
    Math.min(yellowPantherFit, 100)
    + Math.min(evidenceCount, 20) * 4
    + Math.min(usefulFactCount, 30) * 2
    + (sportsRelevant ? 20 : 0)
    + (specificSignal ? 20 : 0)
    + (plausibleWedge ? 20 : 0)
    - blockers.length * 25,
  )
  const legacy_recovery_score = Math.max(0, rawScore)

  let legacy_recovery_tier: LegacyOpportunityRecoveryTier = 'recoverable_legacy'
  if (dataIssue || negativeSignal || evidenceCount <= 0) {
    legacy_recovery_tier = 'legacy_data_issue'
  } else if (genericContext || !sportsRelevant || !specificSignal || !plausibleWedge) {
    legacy_recovery_tier = 'legacy_context_only'
  }

  return {
    legacy_recovery_tier,
    legacy_recovery_score,
    legacy_recovery_blockers: [...new Set(blockers)],
    recommended_recovery_action: recoveryActionFor(legacy_recovery_tier, blockers),
  }
}
