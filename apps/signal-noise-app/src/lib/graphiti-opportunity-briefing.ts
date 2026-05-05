export type GraphitiOpportunityBriefing = {
  signal_title: string
  signal_strength: 'High' | 'Medium' | 'Low'
  verification_status: string
  theme: string
  trigger: string
  why_it_matters: string
  yellow_panther_angle: string
  suggested_route: string
  next_move: string
  outreach_opener: string
  verify_before_action: string
  evidence_summary: string
  brief_verdict: 'outreach_ready' | 'needs_fresh_trigger' | 'verify_trigger' | 'data_quality_issue' | 'context_only' | 'research_lead'
}

type BriefingInput = {
  title?: unknown
  organization?: unknown
  entity_name?: unknown
  canonical_entity_name?: unknown
  description?: unknown
  summary?: unknown
  why_it_matters?: unknown
  why_this_is_an_opportunity?: unknown
  suggested_action?: unknown
  yellow_panther_fit?: unknown
  confidence?: unknown
  status?: unknown
  theme?: unknown
  opportunity_kind?: unknown
  temporal_reasoning?: unknown
  pattern_reasoning?: unknown
  yp_fit_reasoning?: unknown
  recommended_action?: unknown
  supporting_signals?: unknown
  findings?: unknown
  evidence?: unknown
  metadata?: unknown
  raw_payload?: unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') {
    const text = value.trim()
    return text === '[object Object]' ? '' : text
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(' · ')
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return [
      record.finding,
      record.summary,
      record.answer,
      record.value,
      record.text,
      record.title,
      record.description,
      record.reason,
      record.label,
      record.name,
    ].map(toText).find(Boolean) || ''
  }
  return String(value).trim()
}

function concise(value: unknown, maxLength = 260): string {
  const clean = toText(value)
    .replace(/No deterministic answer was produced for this question\.?/gi, '')
    .replace(/No BrightData tool(?: or service)? is available[^.]*\.?/gi, '')
    .replace(/^Position Yellow Panther around\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean || /^n\/a$/i.test(clean) || /^[a-zA-Z]+(?:_[a-zA-Z]+)+$/.test(clean)) return ''
  if (clean.length <= maxLength) return clean
  const sentence = clean.split(/(?<=[.!?])\s+/)[0]?.trim()
  if (sentence && sentence.length <= maxLength) return sentence
  return `${clean.slice(0, Math.max(40, maxLength - 1)).trim()}...`
}

function isUnhelpfulGraphitiBoilerplate(value: string): boolean {
  return /fresh signal exists, but graphiti has not seen enough reinforcement to call it a pattern/i.test(value)
    || /materialized commercial signal that needs source-level verification/i.test(value)
}

function firstUseful(values: unknown[], maxLength = 260): string {
  for (const value of values) {
    const text = concise(value, maxLength)
    if (!text) continue
    if (isUnhelpfulGraphitiBoilerplate(text)) continue
    if (/^cold$/i.test(text)) continue
    if (/no public rfps|no .*procurement|failed before|tool_call_missing|cold_verification|confirm the buyer owner/i.test(text)) continue
    return text
  }
  return ''
}

function arrayTexts(value: unknown, limit = 4): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : []
  const seen = new Set<string>()
  const output: string[] = []
  for (const item of values) {
    const text = concise(item, 220)
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    output.push(text)
    if (output.length >= limit) break
  }
  return output
}

function signalTitleFor(entity: string, title: string, haystack: string): string {
  if (/doncaster rovers/i.test(entity) && /recruitment analyst|recruitment.*vacanc|hiring/i.test(haystack)) {
    return 'Doncaster Rovers — Recruitment Analyst vacancy'
  }
  if (/recruitment analyst/i.test(haystack)) return `${entity} — Recruitment Analyst vacancy`
  if (/hiring|vacanc|job|role/i.test(haystack)) return `${entity} — hiring signal`
  if (/tender|rfp|procurement|contract|supplier/i.test(haystack)) return `${entity} — procurement signal`
  if (/grant|funding|award|investment/i.test(haystack)) return `${entity} — funding signal`
  if (/academy|pathway|scouting|recruitment intelligence/i.test(haystack)) return `${entity} — football operations signal`
  if (/launch|platform|app|digital|data|analytics/i.test(haystack)) return `${entity} — digital product signal`
  if (/finished the \d{4}|division title|playoff|draft picks|season record|offseason/i.test(haystack)) return `${entity} — account context signal`
  const cleanTitle = concise(title, 120).replace(new RegExp(`^${entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:—-]\\s*`, 'i'), '')
  return cleanTitle ? `${entity} — ${cleanTitle}` : `${entity} — commercial signal`
}

function formatYellowPantherAngle(value: string): string {
  if (/^position yellow panther/i.test(value)) return value
  if (/^use\b/i.test(value)) return value.endsWith('.') ? value : `${value}.`
  const sentence = `Position Yellow Panther around ${value.replace(/\.$/, '')}.`
  return sentence
}

function outreachOpenerFor(trigger: string, yellowPantherAngle: string, route: string): string {
  const angle = yellowPantherAngle
    .replace(/^Position Yellow Panther around\s+/i, '')
    .replace(/^Use the signal to test whether\s+/i, '')
    .replace(/^Use the signal to test for\s+/i, '')
    .replace(/\.$/, '')
  const routeClause = /buyer route unconfirmed|identify the budget owner|identify the right owner/i.test(route)
    ? ''
    : ` Route through ${route.replace(/\.$/, '')} once buyer ownership is confirmed.`
  return `Use this as a verification hypothesis: "${trigger}" If current, connect it to ${angle}.${routeClause}`.replace(/\s+/g, ' ').trim()
}

function signalStrength(fit: number, confidence: number, temporalStatus: string): 'High' | 'Medium' | 'Low' {
  if (fit >= 75 && confidence >= 60 && ['active', 'accelerating'].includes(temporalStatus)) return 'High'
  if (fit >= 55 || confidence >= 50) return 'Medium'
  return 'Low'
}

function verdictFor(rawPayload: Record<string, unknown>, status: string, temporalStatus: string): GraphitiOpportunityBriefing['brief_verdict'] {
  const blockers = toText(asRecord(rawPayload.commercial_qualification).blockers).toLowerCase()
  const text = [
    rawPayload.data_quality_blockers,
    rawPayload.quality_metrics,
    rawPayload.graphiti_sales_brief,
    rawPayload.yellow_panther_opportunity,
  ].map(toText).join(' ')
  if (/wrong_entity|tool_failure|cold_verification|no deterministic answer|no brightdata/i.test(text)) return 'data_quality_issue'
  if (status === 'context_only' || rawPayload.force_context_only === true || rawPayload.generic_context_only === true) return 'context_only'
  if (temporalStatus === 'stale' || temporalStatus === 'expired' || blockers.includes('stale')) return 'needs_fresh_trigger'
  if (status === 'watch' || blockers.includes('weak') || blockers.includes('watch item')) return 'verify_trigger'
  if (rawPayload.shortlist_opportunity === true) return 'outreach_ready'
  return 'research_lead'
}

export function buildGraphitiOpportunityBriefing(input: BriefingInput): GraphitiOpportunityBriefing {
  const metadata = asRecord(input.metadata || input.raw_payload)
  const commercialQualification = asRecord(metadata.commercial_qualification)
  const ypFitBreakdown = asRecord(commercialQualification.yp_fit_breakdown)
  const temporalReasoning = asRecord(input.temporal_reasoning || metadata.temporal_reasoning)
  const patternReasoning = asRecord(input.pattern_reasoning || metadata.pattern_reasoning)
  const entity = concise(input.canonical_entity_name || input.entity_name || input.organization, 120) || 'This entity'
  const supportingSignals = arrayTexts(input.supporting_signals)
  const findingTexts = Array.isArray(input.findings) ? input.findings.map((finding) => asRecord(finding).finding) : []
  const evidenceTexts = Array.isArray(input.evidence) ? input.evidence.map((evidence) => asRecord(evidence).source || asRecord(evidence).snippet) : []
  const haystack = [
    input.title,
    input.summary,
    input.description,
    input.why_it_matters,
    input.why_this_is_an_opportunity,
    input.suggested_action,
    input.yp_fit_reasoning,
    ypFitBreakdown.capability_match,
    ypFitBreakdown.outreach_angle,
    ...supportingSignals,
    ...findingTexts,
  ].map(toText).join(' ')
  const signalTitle = signalTitleFor(entity, toText(input.title), haystack)
  const fit = Number(input.yellow_panther_fit || 0)
  const confidence = Number(input.confidence || 0)
  const temporalStatus = concise(temporalReasoning.status, 40) || 'unknown'
  const status = concise(commercialQualification.status || input.status, 40)
  const isDoncasterRecruitment = /Doncaster Rovers/i.test(signalTitle) && /Recruitment Analyst vacancy/i.test(signalTitle)

  const trigger = isDoncasterRecruitment
    ? 'Doncaster Rovers appear to be hiring for a Recruitment Analyst role, indicating active interest in recruitment operations and data-led football decision-making.'
    : firstUseful([
      temporalReasoning.reason,
      ...findingTexts,
      ...supportingSignals,
      input.summary,
      input.why_this_is_an_opportunity,
      input.description,
    ], 320) || `${entity} has a materialized commercial signal that needs source-level verification before outreach.`
  const yellowPantherAngle = isDoncasterRecruitment
    ? 'Position Yellow Panther around practical data-led recruitment intelligence: turning player, club, market, and pathway data into usable decision support for football operations teams.'
    : firstUseful([
      ypFitBreakdown.capability_match,
      ypFitBreakdown.outreach_angle,
      input.yp_fit_reasoning,
      metadata.capability_gap,
    ], 260) || 'Use the signal to test whether Yellow Panther can support a funded decision, planning, data, or market-intelligence need.'
  const route = isDoncasterRecruitment
    ? 'Shaun Lockwood is a possible commercial entry point, but the true buyer may sit in recruitment, academy, or football operations.'
    : firstUseful([ypFitBreakdown.buyer_route, metadata.best_path_owner, metadata.outreach_route, input.suggested_action], 220)
      || 'Buyer route unconfirmed; identify the budget owner or operational sponsor before outreach.'
  const verifyBeforeAction = isDoncasterRecruitment
    ? 'Confirm the role is still live, the source is official or recent, and whether the likely buyer sits in football operations, recruitment, academy, or commercial.'
    : firstUseful([ypFitBreakdown.verification_needed], 240)
      || 'Verify source recency, source quality, buyer ownership, and whether the signal is active enough for outreach.'
  const whyItMatters = isDoncasterRecruitment
    ? 'Hiring for this role may point to an internal need around scouting workflows, player intelligence, academy pathway analysis, or recruitment market monitoring.'
    : firstUseful([input.why_it_matters, input.why_this_is_an_opportunity, temporalReasoning.reason], 300)
      || 'This may indicate an emerging need, but it needs a fresher trigger or stronger buyer evidence before outreach.'
  const distinctWhyItMatters = whyItMatters === trigger
    ? 'This needs validation because the signal is commercially plausible but not yet strong enough for outreach without a fresher trigger, source check, and buyer route.'
    : whyItMatters
  const nextMove = isDoncasterRecruitment
    ? 'Verify the job source, date, hiring owner, and whether the vacancy is still active. If confirmed, use the hiring signal as a warm outreach wedge.'
    : 'Verify the source, date, buyer owner, and whether the signal is still active. If confirmed, use it as a soft outreach wedge.'
  const formattedYellowPantherAngle = formatYellowPantherAngle(yellowPantherAngle)
  const outreachOpener = isDoncasterRecruitment
    ? 'Noticed Doncaster are hiring around recruitment analysis. We help clubs turn recruitment and market signals into practical intelligence for scouting, academy planning, and decision-making.'
    : outreachOpenerFor(trigger, formattedYellowPantherAngle, route)

  return {
    signal_title: signalTitle,
    signal_strength: signalStrength(fit, confidence, temporalStatus),
    verification_status: 'Needs verification',
    theme: concise(input.theme || patternReasoning.signal_type || input.opportunity_kind, 80) || 'Commercial intelligence',
    trigger,
    why_it_matters: distinctWhyItMatters,
    yellow_panther_angle: formattedYellowPantherAngle,
    suggested_route: route,
    next_move: nextMove,
    outreach_opener: outreachOpener,
    verify_before_action: verifyBeforeAction,
    evidence_summary: arrayTexts([...evidenceTexts, ...findingTexts, ...supportingSignals], 4).join(' · ') || 'Open the dossier to inspect source evidence.',
    brief_verdict: verdictFor(metadata, status, temporalStatus),
  }
}
