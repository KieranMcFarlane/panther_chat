export const COMMERCIAL_STATES = ['outreach_ready', 'verify_now', 'watch', 'context_only', 'data_issue']

function text(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ')
  if (typeof value === 'object') {
    return Object.values(value).map(text).filter(Boolean).join(' ')
  }
  return String(value).trim()
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function collectText(row, rawPayload) {
  const qualification = asRecord(rawPayload.commercial_qualification)
  const strategy = asRecord(rawPayload.bd_strategy_brief)
  return [
    row.entity_name,
    row.canonical_entity_name,
    row.title,
    row.summary,
    row.why_it_matters,
    row.read_more_context,
    rawPayload.yp_fit_reasoning,
    rawPayload.capability_gap,
    rawPayload.data_quality_blockers,
    qualification.promotion_reason,
    qualification.blockers,
    strategy.signal_title,
    strategy.decision_summary,
    strategy.what_happened,
    strategy.why_it_matters_now,
    strategy.yellow_panther_angle,
    strategy.suggested_route,
    strategy.outreach_opener,
    strategy.disqualifiers,
  ].map(text).filter(Boolean).join(' ')
}

function strategyBrief(row, rawPayload) {
  return asRecord(rawPayload.bd_strategy_brief)
}

function hasStrategyBrief(rawPayload) {
  return strategyBrief({}, rawPayload).schema_version === 'yp_bd_strategy_v1'
}

function hasSportsContext(value) {
  const clean = String(value || '')
    .replace(/\bno sports? (?:club|organisation|organization|buyer|entity|federation|league|venue|tech|technology|mention|evidence)[^.]*\.?/gi, ' ')
    .replace(/\bnot a sports? (?:club|organisation|organization|buyer|entity|federation|league|venue)[^.]*\.?/gi, ' ')
  return /\b(?:club|fc\b|f\.c\.|rugby|football|hockey|basketball|baseball|cricket|federation|league|team|stadium|arena|athletic|sport|sports|braves|rovers|broncos|fifa|fiba|olympic|padel|ice hockey)\b/i.test(clean)
}

function hasGovernmentOrCivicContext(value) {
  return /\b(?:government|national|country|state government|civic|citizen|public services?|ministry|election|humanitarian|judiciary|military|health sectors?|transport|e-hailing|agricultural|digital identity|instant payments|trade agreements?)\b/i.test(value)
}

function hasSpecificYellowPantherAngle(rawPayload) {
  const strategy = strategyBrief({}, rawPayload)
  const angle = text(strategy.yellow_panther_angle || rawPayload.yp_fit_reasoning || rawPayload.capability_gap)
  return Boolean(angle)
    && !/no clear yellow panther angle/i.test(angle)
    && !/^position yellow panther around\s+(kind: summary|blocked by upstream|no evidence|search results)/i.test(angle)
    && !/\bkind:\s*summary\b/i.test(angle)
    && !/\bblocked by upstream question state\b/i.test(angle)
    && !/\bno evidence of any launched products/i.test(angle)
    && !/\bno proprietary product, app, or platform launch was found\b/i.test(angle)
    && !/\byellow panther relevance is plausible but not yet strong enough for direct pursuit\b/i.test(angle)
    && !/\blead with the .{0,40} buying trigger and validate the practical route to value\b/i.test(angle)
    && !/\byellow panther succeeds here by turning the .{0,40} trigger into a practical strategy\b/i.test(angle)
}

function hasUsableRoute(rawPayload) {
  const strategy = strategyBrief({}, rawPayload)
  const qualification = asRecord(rawPayload.commercial_qualification)
  const ypFit = asRecord(qualification.yp_fit_breakdown)
  const route = text(strategy.suggested_route || ypFit.buyer_route || rawPayload.best_path_owner || rawPayload.outreach_route)
  return Boolean(route)
    && !/^cold$/i.test(route)
    && !/buyer route unverified|unverified|unknown|identify the .*owner|blocked by upstream|verification required first/i.test(route)
}

function hasUsableOpener(rawPayload) {
  const strategy = strategyBrief({}, rawPayload)
  const opener = text(strategy.outreach_opener)
  return Boolean(opener)
    && !/not applicable|verification required first|do not use|use only after|verify .* before outreach/i.test(opener)
}

function hasCurrentTrigger(rawPayload) {
  const temporalStatus = text(asRecord(rawPayload.temporal_reasoning).status).toLowerCase()
  const qualification = asRecord(rawPayload.commercial_qualification)
  const triggers = Array.isArray(qualification.buying_triggers) ? qualification.buying_triggers : []
  return ['active', 'accelerating'].includes(temporalStatus) && triggers.length > 0
}

function hasDataIssue(row, rawPayload) {
  const haystack = collectText(row, rawPayload)
  const metrics = asRecord(rawPayload.quality_metrics)
  const wrongEntityCount = Number(metrics.wrong_entity_fact_count || rawPayload.wrong_entity_blocked || 0)
  const toolFailureCount = Number(metrics.tool_failure_fact_count || rawPayload.tool_failure_blocked || 0)
  const useful = Number(metrics.useful_fact_count ?? rawPayload.useful_fact_count ?? rawPayload.answer_count ?? 0)
  const evidence = Number(metrics.evidence_url_count ?? rawPayload.evidence_url_count ?? rawPayload.evidence_count ?? 0)
  const qualityState = text(rawPayload.quality_state).toLowerCase()
  const entityName = text(row.entity_name || row.canonical_entity_name)
  const hasUsableStrategy = hasStrategyBrief(rawPayload) && hasSpecificYellowPantherAngle(rawPayload)
  const hasKindSummaryLeak = /\bkind:\s*summary\b/i.test(haystack)

  return wrongEntityCount > 0
    || toolFailureCount > 0
    || qualityState === 'empty'
    || useful < 2
    || evidence <= 0
    || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(entityName)
    || /\bdossier-backed opportunity signal\b/i.test(haystack)
    || /wrong_entity|tool_failure|cold_verification/i.test(haystack)
    || /\bmisaligned entity\b|\bentity mismatch\b/i.test(haystack)
    || /\bSomalia\b/i.test(haystack) && !/\bSomalia\b/i.test(text(row.entity_name || row.canonical_entity_name))
    || /\bEswatini\b/i.test(haystack) && !/\bEswatini\b/i.test(text(row.entity_name || row.canonical_entity_name))
    || (hasKindSummaryLeak && !hasUsableStrategy)
    || /\bblocked by upstream question state\b/i.test(haystack)
    || /\bPreferred Supplier Lists?\b/i.test(haystack)
    || /\bno evidence of any launched products, apps, platforms, or fan experiences\b/i.test(haystack)
    || /\bno proprietary product, app, or platform launch was found\b/i.test(haystack)
    || /question execution failed before a safe answer could be produced/i.test(haystack)
    || /no deterministic answer was produced|No BrightData tool is available/i.test(haystack)
    || (hasStrategyBrief(rawPayload) && !hasSpecificYellowPantherAngle(rawPayload) && !hasGovernmentOrCivicContext(haystack))
}

function isBroadCivicContext(row, rawPayload) {
  const haystack = collectText(row, rawPayload)
  const strategy = strategyBrief(row, rawPayload)
  const noSportsContext = /\bno sports?\b|\bnot a sports?\b|\bno .*sports?.*(?:buyer|entity|organisation|organization|club|league|federation|venue)/i.test(haystack)
  return hasGovernmentOrCivicContext(haystack) && (noSportsContext || !hasSportsContext(haystack) || strategy.service_wedge === 'no_clear_fit')
}

export function classifyGraphitiCommercialState(row) {
  const rawPayload = asRecord(row.raw_payload)
  const qualification = asRecord(rawPayload.commercial_qualification)
  const existingStatus = text(qualification.status).toLowerCase()
  const fit = Number(row.yellow_panther_fit || 0)
  const metrics = asRecord(rawPayload.quality_metrics)
  const useful = Number(metrics.useful_fact_count ?? rawPayload.useful_fact_count ?? rawPayload.answer_count ?? 0)
  const evidence = Number(metrics.evidence_url_count ?? rawPayload.evidence_url_count ?? rawPayload.evidence_count ?? 0)
  const temporalStatus = text(asRecord(rawPayload.temporal_reasoning).status).toLowerCase()
  const strategy = strategyBrief(row, rawPayload)
  const recommendation = text(strategy.pursuit_recommendation).toLowerCase()

  if (hasDataIssue(row, rawPayload)) {
    return {
      commercial_state: 'data_issue',
      commercial_confidence: 'Low',
      commercial_confidence_score: 10,
      commercial_truth_reasons: ['Data quality issue'],
      yp_relevance: fit,
    }
  }

  if (isBroadCivicContext(row, rawPayload) || existingStatus === 'context_only' || rawPayload.force_context_only === true) {
    return {
      commercial_state: 'context_only',
      commercial_confidence: 'Low',
      commercial_confidence_score: 20,
      commercial_truth_reasons: ['Useful background, but no current sports commercial trigger'],
      yp_relevance: fit,
    }
  }

  const route = hasUsableRoute(rawPayload)
  const opener = hasUsableOpener(rawPayload)
  const trigger = hasCurrentTrigger(rawPayload)
  const wedge = hasSpecificYellowPantherAngle(rawPayload)
  const enoughEvidence = useful >= 5 && evidence >= 3
  const currentEnough = ['active', 'accelerating', 'emerging'].includes(temporalStatus)

  if (trigger && route && opener && wedge && enoughEvidence && fit >= 60 && recommendation === 'outreach_ready') {
    return {
      commercial_state: 'outreach_ready',
      commercial_confidence: 'High',
      commercial_confidence_score: 85,
      commercial_truth_reasons: ['Current trigger, usable route, and sendable opener'],
      yp_relevance: fit,
    }
  }

  if (wedge && enoughEvidence && fit >= 60 && currentEnough) {
    return {
      commercial_state: 'verify_now',
      commercial_confidence: route ? 'Medium' : 'Low',
      commercial_confidence_score: route ? 60 : 45,
      commercial_truth_reasons: ['Good commercial hypothesis, but verification is required before outreach'],
      yp_relevance: fit,
    }
  }

  return {
    commercial_state: existingStatus === 'active' ? 'verify_now' : 'watch',
    commercial_confidence: 'Low',
    commercial_confidence_score: 35,
    commercial_truth_reasons: ['Interesting but not actionable yet'],
    yp_relevance: fit,
  }
}

export function isOutreachReadyGraphitiRow(row) {
  return classifyGraphitiCommercialState(row).commercial_state === 'outreach_ready'
}
