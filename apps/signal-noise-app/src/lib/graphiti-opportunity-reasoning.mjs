const DEFAULT_STALE_WINDOW_HOURS = 168
const FRESH_WINDOW_HOURS = 72

function toText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') {
    const text = value.trim()
    return text === '[object Object]' ? '' : text
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(' · ')
  if (typeof value === 'object') {
    const record = value
    const candidate = [
      record.summary,
      record.answer,
      record.value,
      record.text,
      record.context,
      record.title,
      record.description,
      record.label,
      record.name,
    ].map(toText).find(Boolean)
    return candidate || ''
  }
  return String(value).trim()
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function parseTime(value) {
  const text = toText(value)
  if (!text) return null
  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? timestamp : null
}

function isoOrNull(value) {
  const timestamp = parseTime(value)
  return timestamp === null ? null : new Date(timestamp).toISOString()
}

function hoursSince(timestamp, now) {
  if (timestamp === null) return null
  return Math.max(0, (now - timestamp) / (60 * 60 * 1000))
}

function evidenceUrl(evidence) {
  return toText(evidence.url || evidence.source_url || evidence.href || evidence.source)
}

function evidenceText(evidence) {
  return toText(evidence.title || evidence.snippet || evidence.summary || evidence.description || evidence.source || evidence.url)
}

function evidenceTimestamp(evidence) {
  return parseTime(evidence.timestamp || evidence.observed_at || evidence.detected_at || evidence.published_at || evidence.date)
}

function readableDate(value) {
  const timestamp = parseTime(value)
  if (timestamp === null) return null
  return new Date(timestamp).toISOString()
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(toText(value))
}

function isQuestionIdLike(value) {
  return /^q\d+[_a-z0-9-]*$/i.test(toText(value)) || /^[a-z_]+_signal$/i.test(toText(value)) || /^[a-z_]+_docs$/i.test(toText(value))
}

function isPlaceholderSignal(value) {
  const text = toText(value).trim()
  if (!text) return true
  return (
    text === '[object Object]'
    || isQuestionIdLike(text)
    || text === 'no_signal'
    || /^\{.*\}$/s.test(text)
    || NEGATIVE_SIGNAL_PATTERNS.some((pattern) => pattern.test(text))
  )
}

function normalizeTriggerText(value) {
  return toText(value)
    .replace(/^[a-z0-9_]+:\s*(?:validated|provisional|answered|no_signal|failed|blocked):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasExplicitCurrentWindow(value) {
  const text = toText(value)
  return /\b(?:current|currently|active|new|fresh|recent|posted|announced|launch|launched|launching|opened|seeking|hiring|vacancy)\b.{0,80}\b(?:2025|2026|now|today|this season|current)\b/i.test(text)
    || /\b(?:2025|2026)\b.{0,80}\b(?:current|currently|active|new|fresh|recent|posted|announced|launch|launched|launching|opened|seeking|hiring|vacancy)\b/i.test(text)
    || /\bactive\s+(?:[a-z]+\s+){0,3}(?:vacancy|tender|rfp|procurement|search|recruitment)\b/i.test(text)
    || /\bposted\s+\d{1,2}\s+[A-Za-z]+\s+2026\b/i.test(text)
}

function inferredDateFromText(value) {
  const year = Number(toText(value).match(/\b(20\d{2})\b/)?.[1])
  if (!Number.isFinite(year)) return null
  return new Date(Date.UTC(year, 0, 1)).toISOString()
}

function inferredDateFromUrl(value) {
  const text = toText(value)
  const numeric = text.match(/\/(20\d{2})[/-](\d{1,2})[/-](\d{1,2})(?:\/|$)/)
  if (numeric) {
    const [, year, month, day] = numeric
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString()
  }
  const monthName = text.match(/\/(20\d{2})\/([a-z]+)\/(\d{1,2})(?:\/|$)/i)
  if (monthName) {
    const months = {
      january: 0,
      february: 1,
      march: 2,
      april: 3,
      may: 4,
      june: 5,
      july: 6,
      august: 7,
      september: 8,
      october: 9,
      november: 10,
      december: 11,
    }
    const month = months[monthName[2].toLowerCase()]
    if (month !== undefined) {
      return new Date(Date.UTC(Number(monthName[1]), month, Number(monthName[3]))).toISOString()
    }
  }
  return null
}

function collectRawSignals(rawPayload) {
  const graphitiSalesBrief = asRecord(rawPayload.graphiti_sales_brief)
  const yellowPantherOpportunity = asRecord(rawPayload.yellow_panther_opportunity)
  const episodeBody = asRecord(rawPayload.episode_body)
  const episodeGraphitiSalesBrief = asRecord(episodeBody.graphiti_sales_brief)
  const episodeYellowPanther = asRecord(episodeBody.yellow_panther)
  const questionFacts = asArray(episodeBody.question_facts).map((fact) => asRecord(fact))
  return [
    rawPayload.supporting_signals,
    rawPayload.signals,
    rawPayload.temporal_signals,
    questionFacts.map((fact) => [
      fact.question_type,
      fact.status,
      fact.summary,
    ].map(toText).filter(Boolean).join(': ')),
    graphitiSalesBrief.signals,
    graphitiSalesBrief.capability_gap,
    graphitiSalesBrief.outreach_angle,
    graphitiSalesBrief.outreach_route,
    yellowPantherOpportunity.signals,
    yellowPantherOpportunity.fit_feedback,
    yellowPantherOpportunity.competitive_advantage,
    episodeGraphitiSalesBrief.signals,
    episodeGraphitiSalesBrief.capability_gap,
    episodeGraphitiSalesBrief.outreach_angle,
    episodeGraphitiSalesBrief.outreach_route,
    episodeYellowPanther.signals,
    episodeYellowPanther.service_fit,
    episodeYellowPanther.fit_feedback,
    episodeYellowPanther.competitive_advantage,
    episodeBody.promoted_summary,
  ]
}

function flattenSignals(values) {
  const output = []
  for (const value of values) {
    if (Array.isArray(value)) {
      output.push(...flattenSignals(value))
      continue
    }
    if (value && typeof value === 'object') {
      output.push(toText(value.title || value.summary || value.description || value.value || value.label))
      continue
    }
    output.push(toText(value))
  }
  return output.filter(Boolean)
}

const SIGNAL_KEYWORDS = [
  ['hiring', ['hire', 'hiring', 'vacancy', 'job', 'recruitment', 'role', 'analyst', 'physiotherapist', 'executive']],
  ['procurement', ['procurement', 'rfp', 'tender', 'vendor', 'supplier', 'contract', 'bid']],
  ['digital', ['digital', 'app', 'website', 'platform', 'streaming', 'ott', 'crm', 'data', 'technology']],
  ['leadership', ['owner', 'ownership', 'chair', 'ceo', 'director', 'leadership', 'board', 'executive']],
  ['sponsorship', ['sponsor', 'partner', 'commercial', 'brand', 'rights', 'naming']],
  ['market', ['expansion', 'league', 'market', 'audience', 'fan', 'growth', 'launch']],
]

const BUYING_TRIGGER_PATTERNS = [
  ['hiring', /\b(?:hiring|vacancy|job opening|job advert|recruit(?:ment|ing)?|seeking|appointing|new role|staffing|analyst vacancy|physiotherapist vacancy)\b/i],
  ['procurement', /\b(?:procurement|rfp|tender|vendor|supplier|contract|bid|request for proposal|commercial partner|procurement notice)\b/i],
  ['digital', /\b(?:app launch|launch(?:ed|ing)? (?:an|a|the)? ?app|platform launch|streaming|ott|crm|digital product|website rebuild|technology partner|data platform)\b/i],
  ['leadership', /\b(?:appointed|named as|joins as|new (?:ceo|chief|director|chair|owner)|decision owner|chief commercial officer|commercial director|head of commercial)\b/i],
  ['sponsorship', /\b(?:(?:new|renewed|announced|signed|secured|launched).{0,50}(?:sponsor|sponsorship|commercial partner|brand partner|rights deal|naming rights)|partner announcement|sponsorship (?:deal|announcement|renewal)|commercial partnership (?:movement|announcement|mention|signal)|rights deal)\b/i],
  ['yp_fit', /\b(?:service fit|buyer hypothesis|outreach route|outreach angle|fit score|commercial fit)\b/i],
]

const NEGATIVE_SIGNAL_PATTERNS = [
  /\bno_signal\b/i,
  /\bno deterministic answer\b/i,
  /\bno (?:web )?evidence (?:was )?found\b/i,
  /\bno published (?:rfps?|tenders?|procurement)\b/i,
  /\bno relevant results\b/i,
  /\bno sources? reference\b/i,
  /\bno substantive\b/i,
  /\bno definitive\b/i,
  /\bcannot be (?:confirmed|determined)\b/i,
  /\breturned no results\b/i,
  /\bunrelated\b/i,
  /\bnot available in public web data\b/i,
  /\bnot an? organisational? procurement action\b/i,
  /\bbounded search\b/i,
  /\breturned 403\b/i,
  /\bno active (?:vacanc|job|role)/i,
  /\bnot a technology company\b/i,
]

const CONTEXT_ONLY_PATTERNS = [
  /\bfounded\b/i,
  /\bbased in\b/i,
  /\blocated in\b/i,
  /\bheadquartered\b/i,
  /\bcompetes? in\b/i,
  /\btop[- ]tier\b/i,
  /\bleague profile\b/i,
  /\bhistory\b/i,
  /\bhistoric(?:al)?\b/i,
  /\brelegat(?:ed|ion)\b/i,
  /\bfinished (?:bottom|top|[0-9]+(?:st|nd|rd|th))\b/i,
  /\bcoefficient rank\b/i,
  /\bestablished\b/i,
  /\bchampion(?:ship|s)?\b/i,
  /\bsquad\b/i,
  /\bmost successful\b/i,
  /\btournament profile\b/i,
  /\bseason\b/i,
]

const NON_CURRENT_ENTITY_PATTERNS = [
  /\bdefunct\b/i,
  /\bdissolved\b/i,
  /\bfolded\b/i,
  /\bceased (?:operations|trading|to exist)\b/i,
  /\bno longer (?:operates|operating|active|exists|competes)\b/i,
  /\binactive (?:club|team|franchise|organisation|organization|entity)\b/i,
  /\bformer (?:club|team|franchise)\b/i,
]

function classifySignalType(signals) {
  const joined = signals.join(' ').toLowerCase()
  let best = { type: 'market', score: 0 }
  for (const [type, keywords] of SIGNAL_KEYWORDS) {
    const score = keywords.reduce((sum, keyword) => sum + (joined.includes(keyword) ? 1 : 0), 0)
    if (score > best.score) best = { type, score }
  }
  return best
}

function uniqueStrings(values, limit = 8) {
  const seen = new Set()
  const output = []
  for (const value of values) {
    const text = toText(value)
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    output.push(text)
    if (output.length >= limit) break
  }
  return output
}

function isNonCurrentEntitySignal(value) {
  const text = toText(value)
  return Boolean(text && NON_CURRENT_ENTITY_PATTERNS.some((pattern) => pattern.test(text)))
}

function classifyBuyingTrigger(signal) {
  const text = normalizeTriggerText(signal)
  if (!text || isPlaceholderSignal(text) || isNonCurrentEntitySignal(text)) return null
  if (NEGATIVE_SIGNAL_PATTERNS.some((pattern) => pattern.test(text))) return null
  const contextOnly = CONTEXT_ONLY_PATTERNS.some((pattern) => pattern.test(text))
  for (const [family, pattern] of BUYING_TRIGGER_PATTERNS) {
    if (!pattern.test(text)) continue
    if (contextOnly && !hasExplicitCurrentWindow(text) && !/\b(?:announced|signed|secured|renewed|launched|posted|vacancy|tender|rfp|procurement notice)\b/i.test(text)) {
      return null
    }
    return { family, text }
  }
  return null
}

function isContextOnlySignal(signal) {
  const text = toText(signal)
  if (!text) return false
  if (classifyBuyingTrigger(text)) return false
  return CONTEXT_ONLY_PATTERNS.some((pattern) => pattern.test(text))
    || NEGATIVE_SIGNAL_PATTERNS.some((pattern) => pattern.test(text))
}

function countTriggerFamilies(values) {
  return flattenSignals(values).reduce((counts, value) => {
    const trigger = classifyBuyingTrigger(value)
    if (!trigger) return counts
    counts[trigger.family] = (counts[trigger.family] || 0) + 1
    return counts
  }, {})
}

function maxFamilyCount(...familyCountRecords) {
  const output = {}
  for (const record of familyCountRecords) {
    for (const [family, count] of Object.entries(record)) {
      output[family] = Math.max(output[family] || 0, Number(count || 0))
    }
  }
  return output
}

function evidenceToTriggerCandidate(item) {
  const record = asRecord(item)
  const text = normalizeTriggerText(evidenceText(record) || record.summary || record.title)
  const source = toText(record.source)
  const sourceUrl = isHttpUrl(evidenceUrl(record)) ? evidenceUrl(record) : null
  const explicitObservedAt = readableDate(record.timestamp || record.observed_at || record.detected_at || record.published_at || record.date)
  const urlObservedAt = inferredDateFromUrl(sourceUrl)
  const textObservedAt = inferredDateFromText(text)
  const observedAt = explicitObservedAt || urlObservedAt || textObservedAt
  return {
    text,
    question_id: isQuestionIdLike(source) ? source : null,
    source_url: sourceUrl,
    observed_at: observedAt,
    date_quality: explicitObservedAt ? 'explicit' : urlObservedAt ? 'url_path' : textObservedAt ? 'text_year' : 'missing',
    source,
  }
}

function supportingSignalToTriggerCandidate(signal) {
  const text = normalizeTriggerText(signal)
  return {
    text,
    question_id: null,
    source_url: null,
    observed_at: inferredDateFromText(text),
    date_quality: inferredDateFromText(text) ? 'text_year' : 'missing',
    source: 'supporting_signal',
  }
}

function isCurrentTriggerEvidence(candidate, now, staleHours) {
  if (hasExplicitCurrentWindow(candidate.text)) return true
  const timestamp = parseTime(candidate.observed_at)
  if (timestamp !== null) {
    return hoursSince(timestamp, now) <= staleHours
  }
  return false
}

function isContextishTriggerText(value) {
  const text = toText(value)
  if (!text) return true
  return CONTEXT_ONLY_PATTERNS.some((pattern) => pattern.test(text))
    || NEGATIVE_SIGNAL_PATTERNS.some((pattern) => pattern.test(text))
}

function isProvenCurrentTrigger(trigger) {
  if (!trigger?.is_current) return false
  if (trigger.date_quality === 'explicit' || trigger.date_quality === 'url_path') return true
  return Boolean(trigger.source_url && hasExplicitCurrentWindow(trigger.text) && !isContextishTriggerText(trigger.text))
}

function buildCommercialQualification({ signals, supportingSignals, evidenceRecords, ypFitScore, confidence, now, staleHours, ypFitBreakdown }) {
  const buyingTriggers = []
  const triggerEvidence = []
  const contextOnlySignals = []
  const blockers = []
  const seenTriggers = new Set()
  const seenContext = new Set()
  const currentNow = Number.isFinite(now) ? now : Date.now()
  const currentStaleHours = Number(staleHours || DEFAULT_STALE_WINDOW_HOURS)

  const candidates = [
    ...asArray(evidenceRecords).map(evidenceToTriggerCandidate),
    ...flattenSignals(supportingSignals).map(supportingSignalToTriggerCandidate),
    ...flattenSignals(signals).map(supportingSignalToTriggerCandidate),
  ]

  for (const candidate of candidates) {
    if (isPlaceholderSignal(candidate.text)) continue
    if (isNonCurrentEntitySignal(candidate.text)) {
      blockers.push('non_current_entity')
      continue
    }
    const trigger = classifyBuyingTrigger(candidate.text)
    if (trigger) {
      const dedupeText = normalizeTriggerText(trigger.text).toLowerCase()
      const key = `${trigger.family}|${dedupeText}`.toLowerCase()
      const existingIndex = triggerEvidence.findIndex((existing) => (
        existing.family === trigger.family
        && (
          existing.text.toLowerCase().includes(dedupeText)
          || dedupeText.includes(existing.text.toLowerCase())
        )
      ))
      if (existingIndex >= 0) {
        const existing = triggerEvidence[existingIndex]
        existing.source_url = existing.source_url || candidate.source_url
        existing.observed_at = existing.observed_at || candidate.observed_at
        existing.date_quality = existing.date_quality === 'explicit' ? existing.date_quality : candidate.date_quality
        existing.question_id = existing.question_id || candidate.question_id
        existing.is_current = existing.is_current || isCurrentTriggerEvidence(candidate, currentNow, currentStaleHours)
      } else if (!seenTriggers.has(key)) {
        seenTriggers.add(key)
        buyingTriggers.push(trigger)
        triggerEvidence.push({
          family: trigger.family,
          text: trigger.text,
          question_id: candidate.question_id,
          source_url: candidate.source_url,
          observed_at: candidate.observed_at,
          date_quality: candidate.date_quality,
          is_current: isCurrentTriggerEvidence(candidate, currentNow, currentStaleHours),
          dedupe_key: key,
        })
      }
      continue
    }
    if (isContextOnlySignal(candidate.text)) {
      const key = toText(candidate.text).toLowerCase()
      if (!seenContext.has(key)) {
        seenContext.add(key)
        contextOnlySignals.push(toText(candidate.text))
      }
    }
  }

  const currentTriggerEvidence = triggerEvidence.filter((trigger) => trigger.is_current)
  const currentProvenTriggerEvidence = currentTriggerEvidence.filter(isProvenCurrentTrigger)
  const currentFamilyCounts = currentProvenTriggerEvidence.reduce((counts, trigger) => {
    counts[trigger.family] = (counts[trigger.family] || 0) + 1
    return counts
  }, {})
  const repeatedFamily = Object.entries(currentFamilyCounts).find(([, count]) => count >= 2)?.[0] || null
  const triggerCount = buyingTriggers.length
  const currentTriggerCount = currentTriggerEvidence.length
  const currentProvenTriggerCount = currentProvenTriggerEvidence.length
  const fit = Number(ypFitScore || 0)
  const conf = Number(confidence || 0)
  let status = 'no_buying_trigger'
  let promotionReason = 'no_buying_trigger'
  let triggerStrength = 'none'

  if (blockers.length > 0) {
    status = 'blocked'
    promotionReason = blockers[0]
  } else if (currentProvenTriggerCount >= 2 && repeatedFamily) {
    status = 'accelerating'
    promotionReason = 'repeated_buying_triggers'
    triggerStrength = 'high'
  } else if (currentProvenTriggerCount >= 1 && (fit >= 70 || conf >= 70)) {
    status = 'active'
    promotionReason = 'fresh_buying_trigger'
    triggerStrength = 'medium'
  } else if (triggerCount >= 1) {
    status = 'watch'
    promotionReason = 'weak_buying_trigger'
    triggerStrength = 'low'
  } else if (contextOnlySignals.length > 0) {
    status = 'context_only'
    promotionReason = 'context_only'
  }

  const representativeSource = currentProvenTriggerEvidence.length > 0 ? currentProvenTriggerEvidence : buyingTriggers
  const representativeTriggers = repeatedFamily
    ? representativeSource.map((trigger) => ({ family: trigger.family, text: trigger.text }))
    : Object.values(representativeSource.reduce((byFamily, trigger) => {
      if (!byFamily[trigger.family]) byFamily[trigger.family] = trigger
      return byFamily
    }, {})).map((trigger) => ({ family: trigger.family, text: trigger.text }))

  return {
    status,
    promotion_reason: promotionReason,
    buying_triggers: representativeTriggers,
    trigger_evidence: triggerEvidence,
    context_only_signals: contextOnlySignals,
    blockers,
    trigger_strength: triggerStrength,
    yp_fit_breakdown: ypFitBreakdown,
  }
}

function buildFindings({ entityName, signals, evidence, confidence, signalType }) {
  const evidenceFindings = asArray(evidence)
    .map((item) => asRecord(item))
    .filter((item) => !isPlaceholderSignal(evidenceText(item)))
    .map((item) => ({
      label: evidenceText(item) || `${entityName || 'Entity'} evidence`,
      finding: evidenceText(item) || `${entityName || 'Entity'} has supporting evidence for this opportunity.`,
      source_url: isHttpUrl(evidenceUrl(item)) ? evidenceUrl(item) : null,
      observed_at: readableDate(item.timestamp || item.observed_at || item.detected_at || item.published_at || item.date),
      confidence: confidence ?? null,
      signal_type: signalType,
      source: isQuestionIdLike(item.source) ? 'dossier-derived, source pending' : toText(item.source || item.type || item.id) || 'evidence',
    }))
    .filter((finding) => finding.finding)

  const signalFindings = signals
    .filter((signal) => !isPlaceholderSignal(signal))
    .map((signal) => ({
    label: signalType,
    finding: signal,
    source_url: null,
    observed_at: null,
    confidence: confidence ?? null,
    signal_type: signalType,
    source: 'dossier-derived, source pending',
  }))

  const byFinding = new Map()
  for (const finding of [...evidenceFindings, ...signalFindings]) {
    const key = `${finding.finding}|${finding.source_url || ''}`.toLowerCase()
    if (!byFinding.has(key)) byFinding.set(key, finding)
  }
  return Array.from(byFinding.values()).slice(0, 6)
}

function buildTimeline({ detectedAt, lastSeenAt, materializedAt, deadline, evidence, signalType }) {
  const rows = [
    { at: isoOrNull(detectedAt), label: 'Opportunity detected', signal_type: signalType, source_url: null },
    { at: isoOrNull(materializedAt), label: 'Opportunity materialized', signal_type: signalType, source_url: null },
    { at: isoOrNull(lastSeenAt), label: 'Last reinforced by Graphiti', signal_type: signalType, source_url: null },
    { at: isoOrNull(deadline), label: 'Decision window closes', signal_type: signalType, source_url: null },
    ...asArray(evidence).map((item) => {
      const record = asRecord(item)
      if (isPlaceholderSignal(evidenceText(record))) return null
      return {
        at: isoOrNull(record.timestamp || record.observed_at || record.detected_at || record.published_at || record.date),
        label: evidenceText(record) || 'Evidence observed',
        signal_type: signalType,
        source_url: isHttpUrl(evidenceUrl(record)) ? evidenceUrl(record) : null,
      }
    }),
  ].filter((item) => item && item.at)

  const byKey = new Map()
  for (const row of rows) {
    const key = `${row.at}|${row.label}|${row.source_url || ''}`
    if (!byKey.has(key)) byKey.set(key, row)
  }
  return Array.from(byKey.values()).sort((left, right) => Date.parse(left.at) - Date.parse(right.at)).slice(-8)
}

function factToEvidence(fact) {
  const record = asRecord(fact)
  const evidenceUrls = asArray(record.evidence_urls).map(toText).filter(Boolean)
  if (evidenceUrls.length === 0) {
    return [{
      title: toText(record.summary) || toText(record.question_type) || toText(record.question_id) || 'Dossier fact',
      url: null,
      timestamp: record.observed_at || record.completed_at || record.updated_at || null,
      source: toText(record.question_id) || 'question_fact',
      summary: toText(record.summary),
    }]
  }
  return evidenceUrls.map((url) => ({
    title: toText(record.summary) || toText(record.question_type) || toText(record.question_id) || 'Dossier evidence',
    url,
    timestamp: record.observed_at || record.completed_at || record.updated_at || null,
    source: toText(record.question_id) || 'question_fact',
    summary: toText(record.summary),
  }))
}

function episodeEvidence(rawPayload) {
  const episodeBody = asRecord(rawPayload.episode_body)
  const questionEvidence = asArray(episodeBody.question_facts).flatMap(factToEvidence)
  const episodeUrlEvidence = asArray(episodeBody.evidence_urls).map((url) => ({
    title: 'Dossier evidence URL',
    url: toText(url),
    timestamp: null,
    source: 'episode_body',
  })).filter((item) => item.url)
  return [...questionEvidence, ...episodeUrlEvidence]
}

function episodeRelationships(rawPayload) {
  const episodeBody = asRecord(rawPayload.episode_body)
  return [
    ...asArray(episodeBody.relationships),
    ...asArray(episodeBody.related_patterns),
    ...asArray(rawPayload.related_patterns),
  ]
}

function fitScoreFromRawPayload(rawPayload) {
  const graphitiSalesBrief = asRecord(rawPayload.graphiti_sales_brief)
  const yellowPantherOpportunity = asRecord(rawPayload.yellow_panther_opportunity)
  const episodeBody = asRecord(rawPayload.episode_body)
  const episodeYellowPanther = asRecord(episodeBody.yellow_panther)
  const candidates = [
    rawPayload.yellow_panther_fit,
    rawPayload.yp_fit,
    yellowPantherOpportunity.estimated_probability,
    yellowPantherOpportunity.win_probability,
    graphitiSalesBrief.estimated_probability,
    graphitiSalesBrief.win_probability,
    episodeYellowPanther.estimated_probability,
    episodeYellowPanther.win_probability,
  ].map(Number).filter(Number.isFinite)
  const score = candidates.length ? Math.max(...candidates) : 0
  return score > 0 && score <= 1 ? score * 100 : score
}

function inferCapabilityMatch(signalType, signals) {
  const text = flattenSignals(signals).join(' ').toLowerCase()
  if (
    signalType === 'hiring'
    && /recruitment analyst|data[-\s]?led|data-informed|scouting|player recruitment|academy/.test(text)
  ) {
    return 'data-led recruitment intelligence and academy pathway prioritisation'
  }
  if (signalType === 'digital' && /app|ott|platform|fan experience|streaming|digital/.test(text)) {
    return 'fan-data, digital product, and platform growth prioritisation'
  }
  if (signalType === 'procurement' && /rfp|tender|procurement|vendor|supplier/.test(text)) {
    return 'procurement intelligence and vendor-route qualification'
  }
  if (signalType === 'sponsorship' && /sponsor|partner|commercial partnership|rights/.test(text)) {
    return 'sponsorship pipeline mapping and partner-fit qualification'
  }
  return `${signalType} opportunity support`
}

function buildYpFitBreakdown({ rawPayload, signalType, ypFitScore, signals }) {
  const graphitiSalesBrief = asRecord(rawPayload.graphiti_sales_brief)
  const yellowPantherOpportunity = asRecord(rawPayload.yellow_panther_opportunity)
  const episodeBody = asRecord(rawPayload.episode_body)
  const episodeGraphitiSalesBrief = asRecord(episodeBody.graphiti_sales_brief)
  const episodeYellowPanther = asRecord(episodeBody.yellow_panther)
  const serviceFit = uniqueStrings([
    ...asArray(yellowPantherOpportunity.service_fit),
    ...asArray(episodeYellowPanther.service_fit),
  ], 3)
  const capabilityMatch = serviceFit.length > 0
    ? serviceFit.join(', ')
    : inferCapabilityMatch(signalType, signals)
  const buyerRoute = toText(
    graphitiSalesBrief.outreach_route
      || graphitiSalesBrief.outreach_target
      || graphitiSalesBrief.best_path_owner
      || episodeGraphitiSalesBrief.outreach_route
      || episodeGraphitiSalesBrief.outreach_target
      || episodeGraphitiSalesBrief.best_path_owner
      || yellowPantherOpportunity.buyer_route
      || episodeYellowPanther.buyer_route,
  ) || 'Confirm the buyer owner in the dossier before outreach.'
  const rawOutreachAngle = toText(
    graphitiSalesBrief.outreach_angle
      || episodeGraphitiSalesBrief.outreach_angle
      || yellowPantherOpportunity.outreach_angle
      || episodeYellowPanther.outreach_angle,
  )
  const fallbackOutreachAngle = signalType === 'hiring'
    ? 'Position Yellow Panther around data-led recruitment intelligence, academy pathway prioritisation, and evidence-backed planning'
    : `Lead with the ${signalType} buying trigger and validate the practical route to value`
  const personTitleOnlyAngle = (
    rawOutreachAngle
    && /chief|officer|director|head of|manager|commercial/i.test(rawOutreachAngle)
    && !/\b(?:lead|position|frame|offer|support|validate|help|use|propose|map|prioriti[sz]e)\b/i.test(rawOutreachAngle)
  )
  const outreachAngle = rawOutreachAngle && !personTitleOnlyAngle
    ? rawOutreachAngle
    : fallbackOutreachAngle
  const verificationNeeded = `Verify recency, source evidence, and the buyer route before outreach.`

  return {
    capability_match: capabilityMatch,
    buyer_route: buyerRoute,
    outreach_angle: outreachAngle,
    verification_needed: verificationNeeded,
    fit_score: Math.round(Number(ypFitScore || 0)),
  }
}

function strategyVerbForSignal(signalType) {
  if (signalType === 'hiring') return 'Use the hiring signal'
  if (signalType === 'digital') return 'Use the digital platform signal'
  if (signalType === 'procurement') return 'Use the procurement signal'
  if (signalType === 'sponsorship') return 'Use the sponsorship movement'
  if (signalType === 'leadership') return 'Use the decision-owner signal'
  return 'Use the buying signal'
}

function buildStrategicYpFitReasoning({ signalType, ypFitScore, ypFitBreakdown }) {
  const fit = Math.round(Number(ypFitScore || 0))
  if (fit >= 70) {
    return [
      `Yellow Panther succeeds here by turning the ${signalType} trigger into a practical strategy.`,
      `Capability match: ${ypFitBreakdown.capability_match}.`,
      `Buyer route: ${ypFitBreakdown.buyer_route}.`,
      `Outreach angle: ${ypFitBreakdown.outreach_angle}.`,
      `Fit: ${fit}%.`,
      `Caveat: ${ypFitBreakdown.verification_needed}`,
    ].join(' ')
  }
  if (fit > 0) {
    return [
      `Yellow Panther relevance is plausible but not yet strong enough for direct pursuit.`,
      `Potential capability match: ${ypFitBreakdown.capability_match}.`,
      `Buyer route to verify: ${ypFitBreakdown.buyer_route}.`,
      `Current fit: ${fit}%.`,
      `Caveat: ${ypFitBreakdown.verification_needed}`,
    ].join(' ')
  }
  return `Yellow Panther fit needs manual confirmation. Start by validating the buyer route and whether ${ypFitBreakdown.capability_match} maps to a funded priority.`
}

function sentence(value) {
  const text = toText(value).replace(/[.\s]+$/g, '').trim()
  return text ? `${text}.` : ''
}

function buildStrategicRecommendedAction({ status, signalType, ypFitBreakdown }) {
  if (status === 'expired') return 'Archive this opportunity unless new dated evidence appears.'
  if (status === 'stale') return 'Revalidate the trigger date and buyer route before any outreach.'
  if (status === 'accelerating' || status === 'active') {
    return [
      `${strategyVerbForSignal(signalType)} as the outreach wedge.`,
      sentence(ypFitBreakdown.outreach_angle),
      `Route the first hypothesis through ${ypFitBreakdown.buyer_route}.`,
      `Verification: ${ypFitBreakdown.verification_needed}`,
    ].join(' ')
  }
  return `Keep this as a watch item until the trigger, buyer route, and Yellow Panther capability match are all verified.`
}

export function buildGraphitiOpportunityReasoning(input = {}) {
  const now = Number.isFinite(input.now) ? input.now : Date.now()
  const rawPayload = asRecord(input.rawPayload)
  const evidence = [...asArray(input.evidence), ...episodeEvidence(rawPayload)]
  const relationships = [...asArray(input.relationships), ...episodeRelationships(rawPayload)]
  const baseSignals = flattenSignals([
    input.supportingSignals,
    collectRawSignals(rawPayload),
    evidence.map((item) => evidenceText(asRecord(item))),
  ])
  const signals = uniqueStrings(baseSignals, 12)
  const signalClass = classifySignalType(signals)
  const signalType = signalClass.type
  const independentSignalCount = Math.max(
    asArray(input.supportingSignals).filter((value) => toText(value)).length,
    evidence.length,
  )
  const evidenceDates = evidence.map((item) => evidenceTimestamp(asRecord(item))).filter((value) => value !== null)
  const detectedAt = parseTime(input.detectedAt)
  const lastSeenAt = parseTime(input.lastSeenAt)
  const materializedAt = parseTime(input.materializedAt)
  const deadlineAt = parseTime(input.deadline)
  const latestEvidenceAt = evidenceDates.length ? Math.max(...evidenceDates) : null
  const latestSignalAt = Math.max(...[detectedAt, lastSeenAt, materializedAt, latestEvidenceAt].filter((value) => value !== null))
  const hasAnyTimestamp = [detectedAt, lastSeenAt, materializedAt, latestEvidenceAt].some((value) => value !== null)
  const recencyHours = hoursSince(latestSignalAt === -Infinity ? null : latestSignalAt, now)
  const staleHours = Number(input.staleWindowHours || DEFAULT_STALE_WINDOW_HOURS)
  const repeatedSignal = independentSignalCount >= 2 && signalClass.score >= 2
  const ypFitScore = Math.max(Number(input.yellowPantherFit || input.confidence || 0), fitScoreFromRawPayload(rawPayload))
  const ypFitBreakdown = buildYpFitBreakdown({ rawPayload, signalType, ypFitScore, signals })
  const commercialQualification = buildCommercialQualification({
    signals,
    supportingSignals: input.supportingSignals,
    evidenceRecords: evidence,
    ypFitScore,
    confidence: input.confidence,
    now,
    staleHours,
    ypFitBreakdown,
  })
  const triggerTimestamps = asArray(commercialQualification.trigger_evidence)
    .map((trigger) => parseTime(asRecord(trigger).observed_at))
    .filter((value) => value !== null)
  const latestTriggerAt = triggerTimestamps.length ? Math.max(...triggerTimestamps) : null
  const hasTriggerTimestamp = latestTriggerAt !== null
  const triggerRecencyHours = hoursSince(latestTriggerAt, now)
  const hasCurrentTrigger = asArray(commercialQualification.trigger_evidence).some((trigger) => asRecord(trigger).is_current === true)

  let status = 'unknown'
  let reason = 'No reliable timestamp was available, so Graphiti cannot determine timing strength.'

  if (deadlineAt !== null && deadlineAt < now) {
    status = 'expired'
    reason = 'The known decision window or deadline has passed.'
  } else if (commercialQualification.status === 'watch' && !hasCurrentTrigger && (
    (hasTriggerTimestamp && triggerRecencyHours !== null && triggerRecencyHours > staleHours)
    || (hoursSince(detectedAt, now) !== null && hoursSince(detectedAt, now) > staleHours)
  )) {
    status = 'stale'
    reason = 'The buying trigger evidence is outside the freshness window.'
  } else if (['no_buying_trigger', 'context_only'].includes(commercialQualification.status) && hoursSince(detectedAt, now) !== null && hoursSince(detectedAt, now) > staleHours) {
    status = 'stale'
    reason = 'The opportunity has not been reinforced within the freshness window.'
  } else if (!hasAnyTimestamp && !hasTriggerTimestamp) {
    status = 'unknown'
  } else if (commercialQualification.status === 'accelerating' && hasCurrentTrigger) {
    status = 'accelerating'
    reason = `Multiple fresh ${commercialQualification.buying_triggers[0]?.family || signalType} buying triggers point in the same direction.`
  } else if (commercialQualification.status === 'active' && hasCurrentTrigger) {
    status = 'active'
    reason = 'Fresh evidence and a concrete buying trigger indicate an actionable current opportunity.'
  } else if (hasTriggerTimestamp && triggerRecencyHours !== null && triggerRecencyHours > staleHours) {
    status = 'stale'
    reason = 'The opportunity has not been reinforced within the freshness window.'
  } else if (recencyHours !== null && recencyHours <= staleHours) {
    status = 'emerging'
    reason = commercialQualification.status === 'context_only'
      ? 'Fresh dossier context exists, but Graphiti has not found a concrete buying trigger.'
      : 'A fresh signal exists, but Graphiti has not seen enough reinforcement to call it a pattern.'
  }

  const repeatedCommercialSignal = asArray(commercialQualification.trigger_evidence).filter((trigger) => asRecord(trigger).is_current === true).length >= 2 && repeatedSignal
  const patternStatus = repeatedCommercialSignal ? 'pattern_detected' : signals.length > 0 ? 'isolated_signal' : 'no_pattern'
  const patternSummary = patternStatus === 'pattern_detected'
    ? `Graphiti sees repeated ${commercialQualification.buying_triggers[0]?.family || signalType} buying triggers across the dossier evidence.`
    : patternStatus === 'isolated_signal'
      ? `Graphiti sees an isolated ${signalType} signal; treat it as a prompt for review, not a trend.`
      : 'Graphiti does not have enough signal detail to infer a pattern.'
  const ypFitReasoning = buildStrategicYpFitReasoning({ signalType, ypFitScore, ypFitBreakdown })
  const recommendedAction = buildStrategicRecommendedAction({ status, signalType, ypFitBreakdown })

  const findings = buildFindings({
    entityName: input.entityName,
    signals,
    evidence,
    confidence: input.confidence ?? null,
    signalType,
  })
  const timeline = buildTimeline({
    detectedAt: input.detectedAt,
    lastSeenAt: input.lastSeenAt,
    materializedAt: input.materializedAt,
    deadline: input.deadline,
    evidence,
    signalType,
  })
  const relatedPatterns = relationships.slice(0, 5).map((relationship) => {
    const record = asRecord(relationship)
    return {
      entity_id: toText(record.target_id || record.entity_id) || null,
      entity_name: toText(record.target_name || record.entity_name) || 'Related entity',
      relationship_type: toText(record.type) || 'related',
      reason: `Related through ${toText(record.type) || 'Graphiti relationship'} evidence.`,
    }
  })
  let recencyLabel = recencyHours === null ? 'unknown' : recencyHours <= FRESH_WINDOW_HOURS ? 'fresh' : recencyHours <= staleHours ? 'recent' : 'stale'
  if ((status === 'active' || status === 'accelerating') && hasCurrentTrigger) {
    recencyLabel = triggerRecencyHours === null || triggerRecencyHours > staleHours
      ? 'fresh'
      : triggerRecencyHours <= FRESH_WINDOW_HOURS
        ? 'fresh'
        : 'recent'
  }

  return {
    temporal_reasoning: {
      status,
      reason,
      recency_label: recencyLabel,
      first_seen_at: isoOrNull(input.detectedAt) || isoOrNull(input.materializedAt),
      last_seen_at: isoOrNull(input.lastSeenAt) || isoOrNull(input.materializedAt) || isoOrNull(input.detectedAt),
      detected_at: isoOrNull(input.detectedAt),
      deadline: isoOrNull(input.deadline),
    },
    pattern_reasoning: {
      pattern_status: patternStatus,
      signal_type: signalType,
      signal_count: independentSignalCount,
      summary: patternSummary,
      supporting_signals: signals.slice(0, 5),
    },
    commercial_qualification: commercialQualification,
    yp_fit_reasoning: ypFitReasoning,
    recommended_action: recommendedAction,
    findings,
    timeline,
    related_patterns: relatedPatterns,
  }
}

export function assessDossierOpportunityPromotion(reasoning, context = {}) {
  const temporalStatus = toText(reasoning?.temporal_reasoning?.status)
  const patternStatus = toText(reasoning?.pattern_reasoning?.pattern_status)
  const evidenceCount = Number(context.evidenceCount || 0)
  const answerCount = Number(context.answerCount || 0)
  const qualityState = toText(context.qualityState).toLowerCase()
  const findingCount = asArray(reasoning?.findings).filter((finding) => toText(asRecord(finding).finding)).length
  const signalCount = Number(reasoning?.pattern_reasoning?.signal_count || 0)
  const ypFitScore = Number(String(reasoning?.yp_fit_reasoning || '').match(/(\d+)%/)?.[1] || context.yellowPantherFit || 0)
  const hasEvidence = evidenceCount > 0 || findingCount > 0
  const highFit = ypFitScore >= 70
  const multiSignal = signalCount >= 2 || patternStatus === 'pattern_detected'
  const freshEnough = ['active', 'accelerating'].includes(temporalStatus)
  const blockedOrEmpty = ['empty', 'failed'].includes(qualityState)
  const commercialQualification = asRecord(reasoning?.commercial_qualification)
  const commercialStatus = toText(commercialQualification.status)
  const viabilityText = [
    context.entityStatus,
    context.viabilityStatus,
    context.entityDescription,
    reasoning?.pattern_reasoning?.supporting_signals,
    asArray(reasoning?.findings).map((finding) => [
      asRecord(finding).finding,
      asRecord(finding).label,
    ]),
  ]
  const nonCurrentEntity = flattenSignals(viabilityText).some(isNonCurrentEntitySignal)

  if (blockedOrEmpty) {
    return {
      shortlist: false,
      watch_item: false,
      promotion_reason: 'not_informative',
    }
  }

  if (nonCurrentEntity) {
    return {
      shortlist: false,
      watch_item: false,
      promotion_reason: 'entity_not_current',
    }
  }

  if (commercialStatus === 'blocked') {
    return {
      shortlist: false,
      watch_item: false,
      promotion_reason: toText(commercialQualification.promotion_reason) || 'blocked',
    }
  }

  if (commercialStatus === 'context_only') {
    return {
      shortlist: false,
      watch_item: false,
      promotion_reason: 'context_only',
    }
  }

  if (temporalStatus === 'expired' || temporalStatus === 'stale') {
    return {
      shortlist: false,
      watch_item: false,
      promotion_reason: temporalStatus,
    }
  }

  if (freshEnough && hasEvidence && ['active', 'accelerating'].includes(commercialStatus) && (highFit || (multiSignal && ypFitScore >= 50))) {
    return {
      shortlist: true,
      watch_item: false,
      promotion_reason: toText(commercialQualification.promotion_reason) || (temporalStatus === 'accelerating' ? 'accelerating_evidence' : highFit ? 'high_fit_evidence' : 'active_evidence'),
    }
  }

  return {
    shortlist: false,
    watch_item: commercialStatus === 'watch' || temporalStatus === 'emerging' || Boolean(hasEvidence || signalCount > 0),
    promotion_reason: commercialStatus === 'no_buying_trigger' ? 'no_buying_trigger' : 'watch_item_only',
  }
}
