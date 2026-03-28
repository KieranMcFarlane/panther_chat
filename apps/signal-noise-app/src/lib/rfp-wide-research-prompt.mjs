export const DEFAULT_WIDE_RFP_FOCUS_AREA = 'web-platforms'

export function buildWideRfpResearchPrompt(input) {
  const query = toText(input?.seedQuery) || getDefaultWideRfpSeedQuery(input?.focusArea)
  const targetYear = normalizeTargetYear(input?.targetYear || input?.target_year)
  const excludeTitles = normalizeWideRfpExclusionNames(
    input?.excludeTitles || input?.exclude_titles || input?.excludeNames || input?.exclude_names,
  )

  return [
    'You are running a wide web research sweep to find Yellow Panther fit digital RFPs, tenders, procurement notices, and adjacent opportunity signals.',
    '',
    'Repository context:',
    buildPromptScope(input),
    '',
    'Discovery rules:',
    '- Search broadly across the web, official procurement pages, press releases, and relevant organizational announcements.',
    '- Prioritize digital opportunities: websites, apps, portals, UX/UI, CMS, content, CRM, martech, analytics, data, automation, digital transformation, fan engagement, and technology procurement.',
    '- Focus on sports, leagues, clubs, federations, venues, governing bodies, and adjacent organizations where Yellow Panther could credibly deliver digital work.',
    '- Rank each opportunity for Yellow Panther digital fit, not just generic procurement volume.',
    '- Keep signal and noise separate. Prefer source URLs and brief evidence over prose.',
    '- Avoid duplicates when the same opportunity appears on multiple pages.',
    '- Normalize entity identity against the canonical-first model before output.',
    '- Iterate through the RFPS already found and add each title to the exclusion list before the next sweep.',
    `- Already found RFP titles (exclude these from the next sweep): ${excludeTitles.length ? excludeTitles.join(' | ') : 'None yet'}.`,
    `- Target year: ${targetYear || 'any year'}. Bias the sweep toward that calendar year while still using the long-tail of the internet to avoid duplicates.`,
    '- Use the long-tail of the internet to find adjacent, under-discovered, and non-duplicated opportunities.',
    '',
    'Output contract:',
    '- Return normalized JSON only.',
    '- Include opportunities with: title, organization, source_url, confidence, yellow_panther_fit, entity_name, canonical_entity_id, canonical_entity_name, category, status, deadline, description, metadata.',
    '- When possible, include a short digital-fit rationale in metadata and prefer opportunities that map cleanly to web, app, platform, or data-led work.',
    '- Include entity_actions for every organization you link, reuse, or create.',
    '- Include the prompt execution metadata needed to render the batch on the RFP page.',
    '',
    `Seed query: ${query}`,
    'Use the MANUS_API key with the Manus API to execute the research request.',
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

function buildPromptScope(input, focusProfile) {
  return [
    `Current intake page: ${input?.currentIntakePage || '/tenders'}`,
    `Normalized RFP page: ${input?.currentRfpPage || '/rfps'}`,
    'Target outcome: discover Yellow Panther digital-fit opportunities and normalize them into the RFP surface.',
    'Canonical-first source of truth: check canonical_entities before creating anything new.',
    'If an entity exists, link to it and reuse its canonical identity.',
    'If no entity exists, create an entity with canonical-first fields and do not invent a parallel source of truth.',
    'Return normalized JSON only.',
  ].join('\n')
}

function toText(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}
