export const DEFAULT_WIDE_RFP_FOCUS_AREA = 'web-platforms'
export const DEFAULT_WIDE_RFP_RESEARCH_MODE = 'live'
export const DEFAULT_WIDE_RFP_RESEARCH_DEPTH = 'safe'

const WIDE_RFP_RESEARCH_DEPTHS = {
  safe: {
    label: 'safe',
    maxSourceChecks: 8,
    maxOpportunities: 5,
    returnThreshold: '3-5',
  },
  standard: {
    label: 'standard',
    maxSourceChecks: 20,
    maxOpportunities: 8,
    returnThreshold: '5-8',
  },
  deep: {
    label: 'deep',
    maxSourceChecks: 40,
    maxOpportunities: 12,
    returnThreshold: '8-12',
  },
}

export function buildWideRfpResearchPrompt(input) {
  const query = toText(input?.seedQuery) || getDefaultWideRfpSeedQuery(input?.focusArea)
  const targetYear = normalizeTargetYear(input?.targetYear || input?.target_year)
  const researchMode = normalizeResearchMode(input?.researchMode || input?.research_mode)
  const researchDepth = normalizeResearchDepth(input?.researchDepth || input?.research_depth)
  const depthConfig = WIDE_RFP_RESEARCH_DEPTHS[researchDepth]
  const excludeTitles = normalizeWideRfpExclusionNames(
    input?.excludeTitles || input?.exclude_titles || input?.excludeNames || input?.exclude_names,
  )
  const deltaMemory = normalizeWideRfpDeltaMemoryPack({
    ...(input?.deltaMemory || input?.delta_memory || {}),
    hardExcludedCanonicalEntityIds:
      input?.hardExcludedCanonicalEntityIds ||
      input?.hard_excluded_canonical_entity_ids ||
      input?.deltaMemory?.hard_excluded_canonical_entity_ids ||
      input?.delta_memory?.hard_excluded_canonical_entity_ids,
  })
  const maxKnownUrls = normalizePositiveInt(input?.maxKnownUrls || input?.max_known_urls, 75)

  return [
    'You are running a wide web research sweep to find Yellow Panther fit digital RFPs, tenders, procurement notices, and adjacent opportunity signals.',
    '',
    'Repository context:',
    buildPromptScope(input),
    '',
    buildDeltaMemorySection(deltaMemory, { maxKnownUrls }),
    '',
    'Discovery rules:',
    '- Search broadly across the web, official procurement pages, press releases, and relevant organizational announcements.',
    '- Prioritize digital opportunities: websites, apps, portals, UX/UI, CMS, content, CRM, martech, analytics, data, automation, digital transformation, fan engagement, and technology procurement.',
    '- Focus on sports, leagues, clubs, federations, venues, governing bodies, and adjacent organizations where Yellow Panther could credibly deliver digital work.',
    '- Rank each opportunity for Yellow Panther digital fit, not just generic procurement volume.',
    '- Keep signal and noise separate. Prefer source URLs and brief evidence over prose.',
    '- Avoid duplicates when the same opportunity appears on multiple pages.',
    '- Normalize entity identity against the canonical-first model before output.',
    '- Check the existing /rfps source list first. Do not return any source_url that already exists in the repository or already appears in the known-title exclusion list.',
    '- Same source_url means duplicate and must be discarded. Same canonical entity plus same or very similar title plus same target year/evidence window must be discarded.',
    '- Same canonical entity with a clearly different RFP, source, or evidence window is allowed; long-tail discovery should find new opportunities from known organizations when they are genuinely different.',
    `- Already found RFP titles (exclude these from the next sweep): ${excludeTitles.length ? excludeTitles.join(' | ') : 'None yet'}.`,
    buildTemporalRule({ targetYear, researchMode }),
    '- If a source URL is behind a login or session-gated procurement portal, prioritize finding the official press release or board minutes that confirm the opportunity.',
    '- Use the long-tail of the internet to find adjacent, under-discovered, and non-duplicated opportunities.',
    '',
    'Run posture:',
    `- Research depth: ${depthConfig.label}.`,
    `- Aim for ${depthConfig.returnThreshold} strong, non-duplicate opportunities if available.`,
    '- Prefer better evidence over more volume.',
    '',
    'Output contract:',
    '- Return normalized JSON only.',
    '- Include an opportunities array with title, organization, source_url, confidence, yellow_panther_fit, category, status, deadline, description, and metadata where possible.',
    '- Include entity_actions when you link, reuse, or create canonical organizations.',
    '- Include enough execution metadata to understand search mode, target year, checked sources, and duplicate handling.',
    '- When possible, prefer opportunities that map cleanly to web, app, platform, or data-led work.',
    '- The app will normalize your JSON into the UI schema after return, so prioritize accurate source-backed discoveries over perfect schema formatting.',
    '',
    `Seed query: ${query}`,
  ].join('\n')
}

export function getDefaultWideRfpSeedQuery(focusArea) {
  void focusArea
  return 'Yellow Panther digital-fit RFP discovery'
}

export function getWideRfpLaneLabel(focusArea) {
  const normalizedFocusArea = normalizeFocusArea(focusArea)
  return {
    'web-platforms': 'Web Platforms',
    'fan-engagement': 'Fan Engagement',
    crm: 'CRM',
  }[normalizedFocusArea]
}

export function normalizeFocusArea(value) {
  const normalized = toText(value).toLowerCase()

  if (['web', 'web-platform', 'web-platforms', 'platform', 'platforms'].includes(normalized)) return 'web-platforms'
  if (['fan-engagement', 'fan engagement', 'engagement', 'fans'].includes(normalized)) return 'fan-engagement'
  if (['crm', 'customer-relationship-management', 'customer relationship management', 'lifecycle'].includes(normalized)) return 'crm'
  return DEFAULT_WIDE_RFP_FOCUS_AREA
}

export function inferFocusAreaFromPrompt(prompt) {
  const normalizedPrompt = toText(prompt).toLowerCase()
  if (normalizedPrompt.includes('fan-engagement') || normalizedPrompt.includes('fan engagement')) return 'fan-engagement'
  if (normalizedPrompt.includes('crm')) return 'crm'
  if (normalizedPrompt.includes('web-platform') || normalizedPrompt.includes('web platform') || normalizedPrompt.includes('website') || normalizedPrompt.includes('cms')) return 'web-platforms'
  return DEFAULT_WIDE_RFP_FOCUS_AREA
}

export function inferTargetYearFromPrompt(prompt) {
  const match = toText(prompt).match(/\bTarget year:\s*(\d{4})\b/i)
  if (!match) return null
  return normalizeTargetYear(match[1])
}

export function normalizeResearchMode(value) {
  const normalized = toText(value).toLowerCase()
  return normalized === 'backtest' ? 'backtest' : DEFAULT_WIDE_RFP_RESEARCH_MODE
}

export function normalizeResearchDepth(value) {
  const normalized = toText(value).toLowerCase()
  return normalized === 'standard' || normalized === 'deep' ? normalized : DEFAULT_WIDE_RFP_RESEARCH_DEPTH
}

export function normalizeTargetYear(value) {
  const text = toText(value)
  if (!text) return null
  const parsed = Number.parseInt(text, 10)
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) return null
  return parsed
}

export function normalizeWideRfpExclusionNames(values) {
  const raw = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values.split(/\r?\n|,|;/g)
      : []

  const names = []
  const seen = new Set()

  for (const value of raw) {
    const text = toText(value)
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(text)
  }

  return names
}

export function buildWideRfpDeltaMemoryPack(input = {}) {
  return normalizeWideRfpDeltaMemoryPack(input)
}

function normalizeWideRfpDeltaMemoryPack(input = {}) {
  const opportunities = Array.isArray(input?.opportunities) ? input.opportunities : []
  const knownSourceUrls = new Set()
  const knownFingerprints = new Set()
  const entityIndex = new Map()

  for (const value of input?.known_source_urls || input?.knownSourceUrls || []) {
    const normalizedUrl = normalizeSourceUrl(value)
    if (normalizedUrl) knownSourceUrls.add(normalizedUrl)
  }

  for (const value of input?.known_opportunity_fingerprints || input?.knownOpportunityFingerprints || []) {
    const fingerprint = toText(value).toLowerCase()
    if (fingerprint) knownFingerprints.add(fingerprint)
  }

  for (const opportunity of opportunities) {
    const sourceUrl = normalizeSourceUrl(opportunity?.source_url || opportunity?.sourceUrl || opportunity?.url)
    if (sourceUrl) knownSourceUrls.add(sourceUrl)

    const entityId = toText(opportunity?.canonical_entity_id || opportunity?.entity_id || opportunity?.canonicalEntityId)
    const entityName = toText(opportunity?.canonical_entity_name || opportunity?.entity_name || opportunity?.organization || opportunity?.canonicalEntityName)
    const title = toText(opportunity?.title)
    const year = normalizeTargetYear(opportunity?.target_year || opportunity?.targetYear || opportunity?.metadata?.target_year || opportunity?.deadline)
    const fingerprint = buildOpportunityFingerprint({ entityId, entityName, title, year })
    if (fingerprint) knownFingerprints.add(fingerprint)

    if (entityId || entityName) {
      const key = entityId || entityName.toLowerCase()
      if (!entityIndex.has(key)) {
        entityIndex.set(key, {
          canonical_entity_id: entityId || null,
          canonical_entity_name: entityName || null,
          rfps: [],
        })
      }
      const entry = entityIndex.get(key)
      const sourceHost = sourceUrl ? safeHost(sourceUrl) : ''
      const rfpKey = `${title.toLowerCase()}|${year || ''}|${sourceHost}`
      if (title && !entry.rfps.some((rfp) => rfp._key === rfpKey)) {
        entry.rfps.push({
          _key: rfpKey,
          title,
          target_year: year,
          source_host: sourceHost || null,
        })
      }
    }
  }

  for (const entity of input?.known_entity_existing_rfps || input?.knownEntityExistingRfps || []) {
    const entityId = toText(entity?.canonical_entity_id || entity?.canonicalEntityId)
    const entityName = toText(entity?.canonical_entity_name || entity?.canonicalEntityName)
    const key = entityId || entityName.toLowerCase()
    if (!key) continue
    if (!entityIndex.has(key)) {
      entityIndex.set(key, {
        canonical_entity_id: entityId || null,
        canonical_entity_name: entityName || null,
        rfps: [],
      })
    }
    const entry = entityIndex.get(key)
    for (const rfp of entity?.rfps || []) {
      const title = toText(rfp?.title)
      if (!title) continue
      const year = normalizeTargetYear(rfp?.target_year || rfp?.targetYear)
      const sourceHost = toText(rfp?.source_host || rfp?.sourceHost)
      const rfpKey = `${title.toLowerCase()}|${year || ''}|${sourceHost}`
      if (!entry.rfps.some((existing) => existing._key === rfpKey)) {
        entry.rfps.push({ _key: rfpKey, title, target_year: year, source_host: sourceHost || null })
      }
    }
  }

  const hardExcluded = normalizeIdList(input?.hard_excluded_canonical_entity_ids || input?.hardExcludedCanonicalEntityIds)

  return {
    known_source_urls: Array.from(knownSourceUrls).sort(),
    known_opportunity_fingerprints: Array.from(knownFingerprints),
    known_entity_existing_rfps: Array.from(entityIndex.values())
      .map((entity) => ({
        canonical_entity_id: entity.canonical_entity_id,
        canonical_entity_name: entity.canonical_entity_name,
        rfps: entity.rfps
          .slice(0, 10)
          .map(({ _key, ...rfp }) => rfp),
      }))
      .filter((entity) => entity.rfps.length > 0)
      .sort((a, b) => String(a.canonical_entity_name || a.canonical_entity_id).localeCompare(String(b.canonical_entity_name || b.canonical_entity_id))),
    hard_excluded_canonical_entity_ids: hardExcluded,
  }
}

function buildDeltaMemorySection(memory, options = {}) {
  const maxKnownUrls = normalizePositiveInt(options.maxKnownUrls, 75)
  const maxKnownFingerprints = normalizePositiveInt(options.maxKnownFingerprints, 30)
  const maxKnownEntities = normalizePositiveInt(options.maxKnownEntities, 12)
  const urlsAll = memory.known_source_urls || []
  const fingerprintsAll = memory.known_opportunity_fingerprints || []
  const entitiesAll = memory.known_entity_existing_rfps || []
  const urls = urlsAll.slice(0, maxKnownUrls)
  const fingerprints = fingerprintsAll.slice(0, maxKnownFingerprints)
  const entities = entitiesAll.slice(0, maxKnownEntities)
  const hardExclusions = memory.hard_excluded_canonical_entity_ids || []
  const compacted = [
    urlsAll.length > urls.length ? `${urlsAll.length - urls.length} known URLs omitted` : '',
    fingerprintsAll.length > fingerprints.length ? `${fingerprintsAll.length - fingerprints.length} fingerprints omitted` : '',
    entitiesAll.length > entities.length ? `${entitiesAll.length - entities.length} entity summaries omitted` : '',
  ].filter(Boolean).join('; ') || 'none'

  return [
    'Stateful memory (delta-only):',
    `Known URLs (first ${maxKnownUrls}): ${urls.length ? urls.join(' | ') : 'None provided'}`,
    `Known opportunity fingerprints (first ${maxKnownFingerprints}): ${fingerprints.length ? fingerprints.join(' | ') : 'None provided'}`,
    `Known entities with existing RFPs (first ${maxKnownEntities}): ${entities.length ? entities.map(formatEntityMemory).join(' || ') : 'None provided'}`,
    `Hard exclusions: ${hardExclusions.length ? hardExclusions.join(' | ') : 'None'}`,
    `Memory compacted: ${compacted}`,
    'Delta-only instruction: discard any discovery matching a Known URL or known opportunity fingerprint. Do not discard an entity by default; Same canonical entity with a clearly different RFP, source, or evidence window is allowed.',
  ].join('\n')
}

function formatEntityMemory(entity) {
  const label = [entity?.canonical_entity_id, entity?.canonical_entity_name].filter(Boolean).join(' / ') || 'unknown entity'
  const rfps = (entity?.rfps || [])
    .map((rfp) => `${toText(rfp?.title)}${rfp?.target_year ? ` (${rfp.target_year})` : ''}${rfp?.source_host ? ` @ ${rfp.source_host}` : ''}`)
    .filter(Boolean)
    .join('; ')
  return `${label}: ${rfps || 'existing RFP'}`
}

function buildTemporalRule({ targetYear, researchMode }) {
  const prefix = `- Research mode: ${researchMode}.`
  if (targetYear) {
    const targetRule = `Target year: ${targetYear}. Include items whose deadline, publication date, delivery period, award period, event year, or performance period overlaps ${targetYear}. Discard items where the actual document/content dates do not overlap ${targetYear}, even if the URL path contains ${targetYear}.`
    if (researchMode === 'backtest') {
      return `${prefix} Historical opportunities are valid for backtesting when the evidence window overlaps ${targetYear}. ${targetRule}`
    }
    return `${prefix} Prioritize opportunities with deadlines or performance periods in ${targetYear}. Prioritize open, current, or future opportunities highest in live mode. ${targetRule}`
  }
  if (researchMode === 'backtest') {
    return `${prefix} Historical opportunities are valid for backtesting only when their actual evidence window matches the requested period.`
  }
  return `${prefix} Prefer open, current, or future-dated opportunities and discard stale documents whose content date contradicts the page path.`
}

function buildOpportunityFingerprint({ entityId, entityName, title, year }) {
  const entityPart = toText(entityId || entityName).toLowerCase()
  const titlePart = normalizeTitleForFingerprint(title)
  if (!entityPart || !titlePart) return ''
  return `${entityPart} | ${titlePart} | ${year || 'unknown'}`
}

function normalizeTitleForFingerprint(value) {
  return toText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(rfp|request for proposal|request proposals|proposal)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSourceUrl(value) {
  const text = toText(value)
  if (!/^https?:\/\//i.test(text)) return ''
  try {
    const url = new URL(text)
    url.hash = ''
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(utm$|utm_|fbclid|gclid|mc_)/i.test(key)) {
        url.searchParams.delete(key)
      }
    }
    const serialized = url.toString()
    return serialized.endsWith('/') ? serialized.slice(0, -1) : serialized
  } catch {
    return text
  }
}

function safeHost(value) {
  try {
    return new URL(value).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

function normalizeIdList(values) {
  const seen = new Set()
  const result = []
  for (const value of Array.isArray(values) ? values : []) {
    const text = toText(value)
    if (!text || seen.has(text)) continue
    seen.add(text)
    result.push(text)
  }
  return result
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(toText(value), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, 250)
}

function buildPromptScope(input, focusProfile) {
  return [
    `Current intake page: ${normalizeRfpSurfacePath(input?.currentIntakePage)}`,
    `Normalized RFP page: ${normalizeRfpSurfacePath(input?.currentRfpPage)}`,
    'Target outcome: discover Yellow Panther digital-fit opportunities and normalize them into the RFP surface.',
    'Canonical-first source of truth: check canonical_entities before creating anything new.',
    'If an entity exists, link to it and reuse its canonical identity.',
    'If no entity exists, create an entity with canonical-first fields and do not invent a parallel source of truth.',
    'Return normalized JSON only.',
  ].join('\n')
}

function normalizeRfpSurfacePath(value) {
  const text = toText(value)
  return text && text !== '/tenders' ? text : '/rfps'
}

function toText(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}
