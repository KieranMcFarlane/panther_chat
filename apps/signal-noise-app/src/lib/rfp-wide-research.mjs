import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const DEFAULT_WIDE_RFP_FOCUS_AREA = 'web-platforms'

export function buildWideRfpResearchPrompt(input) {
  const focusArea = normalizeFocusArea(input?.focusArea)
  const focusProfile = getFocusProfile(focusArea)
  const query = toText(input?.seedQuery) || getDefaultWideRfpSeedQuery(focusArea)

  return [
    `You are running a wide web research sweep to find Yellow Panther fit (${focusProfile.shortLabel}) RFPs, tenders, procurement notices, and adjacent opportunity signals.`,
    '',
    'Repository context:',
    buildPromptScope(input, focusProfile),
    '',
    'Discovery rules:',
    '- Search broadly across the web, official procurement pages, press releases, and relevant organizational announcements.',
    `- Narrow the hunt to ${focusProfile.shortLabel} opportunities instead of a generic digital sweep.`,
    `- Prioritize ${focusProfile.priorityLine}`,
    `- Look for ${focusProfile.examplesLine}`,
    '- Focus on sports, leagues, clubs, federations, venues, governing bodies, and adjacent organizations where Yellow Panther could credibly deliver digital work.',
    '- Rank each opportunity for Yellow Panther digital fit, not just generic procurement volume.',
    '- Keep signal and noise separate. Prefer source URLs and brief evidence over prose.',
    '- Avoid duplicates when the same opportunity appears on multiple pages.',
    '- Normalize entity identity against the canonical-first model before output.',
    '',
    'Output contract:',
    '- Return normalized JSON only.',
    '- Include opportunities with: title, organization, source_url, confidence, yellow_panther_fit, entity_name, canonical_entity_id, canonical_entity_name, category, status, deadline, description, metadata.',
    `- When possible, include a short ${focusProfile.metadataLabel} rationale in metadata and prefer opportunities that map cleanly to ${focusProfile.metadataTargets}.`,
    '- Include entity_actions for every organization you link, reuse, or create.',
    '- Include the prompt execution metadata needed to render the batch on the RFP page.',
    '',
    `Seed query: ${query}`,
    'Use the MANUS_API key with the Manus API to execute the research request.',
  ].join('\n')
}

export function normalizeWideRfpResearchBatch(input) {
  const prompt = toText(input?.prompt) || buildWideRfpResearchPrompt({ seedQuery: getDefaultWideRfpSeedQuery(DEFAULT_WIDE_RFP_FOCUS_AREA), focusArea: DEFAULT_WIDE_RFP_FOCUS_AREA })
  const source = typeof input?.source === 'string' && input.source.trim() ? input.source.trim() : 'manus'
  const generatedAt = toText(input?.generated_at) || new Date().toISOString()
  const focusArea = normalizeFocusArea(input?.focusArea || input?.focus_area || inferFocusAreaFromPrompt(prompt))
  const laneLabel = getWideRfpLaneLabel(focusArea)
  const seedQuery = toText(input?.seedQuery) || toText(input?.seed_query) || getDefaultWideRfpSeedQuery(focusArea)
  const opportunities = (input?.opportunities || []).map((opportunity, index) => normalizeOpportunity(opportunity, index))
  const entityActions = (input?.entity_actions || []).map((action) => ({
    ...action,
    organization: toText(action.organization) || 'Unknown organization',
    canonical_entity_id: toText(action.canonical_entity_id) || null,
    canonical_entity_name: toText(action.canonical_entity_name) || null,
    source_url: toText(action.source_url) || null,
  }))

  return {
    run_id: toText(input?.run_id) || `wide-rfp-${Date.now()}`,
    source,
    prompt,
    generated_at: generatedAt,
    focus_area: focusArea,
    lane_label: laneLabel,
    seed_query: seedQuery,
    opportunities,
    entity_actions: entityActions,
    summary: {
      total_opportunities: opportunities.length,
      linked_entities: entityActions.filter((action) => action.action === 'link' || action.action === 'reuse').length,
      entities_to_create: entityActions.filter((action) => action.action === 'create').length,
    },
  }
}

export async function writeWideRfpResearchArtifact(input) {
  const outputDir = toText(input?.outputDir) || join(process.cwd(), 'backend', 'data', 'discovery_lanes', 'wide_rfp_research')
  const batch = input?.batch || normalizeWideRfpResearchBatch({
    run_id: input?.run_id || `wide-rfp-${Date.now()}`,
    opportunities: [],
    entity_actions: [],
    source: 'manus',
    prompt: input?.prompt || '',
  })

  await mkdir(outputDir, { recursive: true })
  const filePath = join(outputDir, `wide_rfp_research_${batch.run_id}.json`)
  await writeFile(filePath, `${JSON.stringify(batch, null, 2)}\n`, 'utf8')
  return { filePath, batch }
}

export async function readLatestWideRfpResearchArtifact(input) {
  const outputDir = toText(input?.outputDir) || join(process.cwd(), 'backend', 'data', 'discovery_lanes', 'wide_rfp_research')

  try {
    const entries = await readdir(outputDir, { withFileTypes: true })
    const candidates = []

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.startsWith('wide_rfp_research_') || !entry.name.endsWith('.json')) continue
      const filePath = join(outputDir, entry.name)
      const fileStat = await readFile(filePath, 'utf8')
      candidates.push({
        filePath,
        generatedAt: extractGeneratedAt(fileStat),
        hasSignal: hasWideResearchSignal(parseJson(fileStat)),
      })
    }

    candidates.sort((left, right) => String(right.generatedAt || '').localeCompare(String(left.generatedAt || '')))
    let latest = candidates.find((candidate) => candidate.hasSignal)

    if (!latest) {
      latest = candidates[0]
    }
    if (!latest) return null

    const raw = await readFile(latest.filePath, 'utf8')
    const batch = parseJson(raw)
    return {
      filePath: latest.filePath,
      batch: enrichWideRfpResearchBatch(batch),
    }
  } catch {
    return null
  }
}

function hasWideResearchSignal(batch) {
  return Boolean((batch?.opportunities && batch.opportunities.length) || (batch?.entity_actions && batch.entity_actions.length))
}

function parseJson(rawJson) {
  try {
    return JSON.parse(rawJson)
  } catch {
    return null
  }
}

function enrichWideRfpResearchBatch(batch) {
  if (!batch || typeof batch !== 'object') return batch
  const prompt = toText(batch.prompt)
  const focusArea = normalizeFocusArea(batch.focus_area || inferFocusAreaFromPrompt(prompt))
  const source = typeof batch.source === 'string' && batch.source.trim() && batch.source.trim() !== '[object Object]'
    ? batch.source.trim()
    : 'manus'
  return {
    ...batch,
    source,
    focus_area: focusArea,
    lane_label: toText(batch.lane_label) || getWideRfpLaneLabel(focusArea),
    seed_query: toText(batch.seed_query) || getDefaultWideRfpSeedQuery(focusArea),
  }
}

function extractGeneratedAt(rawJson) {
  try {
    const parsed = JSON.parse(rawJson)
    return toText(parsed?.generated_at)
  } catch {
    return ''
  }
}

function toText(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function normalizeNumber(value, fallback) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function normalizeFitScore(value, fallback) {
  const score = normalizeNumber(value, fallback)
  if (score > 100) return 100
  if (score < 0) return 0
  return Math.round(score)
}

function normalizeConfidence(value, fallback) {
  const score = normalizeNumber(value, fallback)
  if (score > 1) return Math.max(0, Math.min(1, score / 100))
  return Math.max(0, Math.min(1, score))
}

export function getDefaultWideRfpSeedQuery(focusArea) {
  const normalizedFocusArea = normalizeFocusArea(focusArea)
  return {
    'web-platforms': 'Yellow Panther web-platform RFP discovery',
    'fan-engagement': 'Yellow Panther fan-engagement RFP discovery',
    crm: 'Yellow Panther CRM RFP discovery',
  }[normalizedFocusArea]
}

export function getWideRfpLaneLabel(focusArea) {
  const normalizedFocusArea = normalizeFocusArea(focusArea)
  return {
    'web-platforms': 'Web Platforms',
    'fan-engagement': 'Fan Engagement',
    crm: 'CRM',
  }[normalizedFocusArea]
}

function buildPromptScope(input, focusProfile) {
  return [
    `Current intake page: ${input?.currentIntakePage || '/tenders'}`,
    `Normalized RFP page: ${input?.currentRfpPage || '/rfps'}`,
    `Target outcome: discover Yellow Panther ${focusProfile.shortLabel} opportunities and normalize them into the RFP surface.`,
    `Requested sub-vertical: ${focusProfile.title}.`,
    'Canonical-first source of truth: check canonical_entities before creating anything new.',
    'If an entity exists, link to it and reuse its canonical identity.',
    'If no entity exists, create an entity with canonical-first fields and do not invent a parallel source of truth.',
    'Return normalized JSON only.',
  ].join('\n')
}

function normalizeFocusArea(value) {
  const normalized = toText(value).toLowerCase()

  if (['web', 'web-platform', 'web-platforms', 'platform', 'platforms'].includes(normalized)) return 'web-platforms'
  if (['fan-engagement', 'fan engagement', 'engagement', 'fans'].includes(normalized)) return 'fan-engagement'
  if (['crm', 'customer-relationship-management', 'customer relationship management', 'lifecycle'].includes(normalized)) return 'crm'
  return DEFAULT_WIDE_RFP_FOCUS_AREA
}

function inferFocusAreaFromPrompt(prompt) {
  const normalizedPrompt = toText(prompt).toLowerCase()
  if (normalizedPrompt.includes('fan-engagement') || normalizedPrompt.includes('fan engagement')) return 'fan-engagement'
  if (normalizedPrompt.includes('crm')) return 'crm'
  if (normalizedPrompt.includes('web-platform') || normalizedPrompt.includes('web platform') || normalizedPrompt.includes('website') || normalizedPrompt.includes('cms')) return 'web-platforms'
  return DEFAULT_WIDE_RFP_FOCUS_AREA
}

function getFocusProfile(focusArea) {
  const normalizedFocusArea = normalizeFocusArea(focusArea)

  return {
    'web-platforms': {
      title: 'Web Platforms',
      shortLabel: 'web-platform',
      priorityLine: 'website rebuilds, CMS programs, portals, app shells, frontend modernization, UX/UI redesign, design systems, and platform migrations.',
      examplesLine: 'website redesign tenders, CMS replacement, portal procurement, platform modernization, mobile-responsive rebuilds, and digital experience platforms.',
      metadataLabel: 'web-platform fit',
      metadataTargets: 'web, CMS, portal, frontend, platform, or app-shell work',
    },
    'fan-engagement': {
      title: 'Fan Engagement',
      shortLabel: 'fan-engagement',
      priorityLine: 'fan portals, loyalty and membership products, mobile engagement journeys, personalization, content programs, and second-screen experiences.',
      examplesLine: 'fan experience procurement, loyalty programs, engagement apps, membership activation platforms, community products, and audience growth initiatives.',
      metadataLabel: 'fan-engagement fit',
      metadataTargets: 'fan experience, loyalty, membership, community, mobile engagement, or personalized content work',
    },
    crm: {
      title: 'CRM',
      shortLabel: 'crm',
      priorityLine: 'CRM platforms, membership systems, ticketing CRM, lifecycle marketing, customer data platforms, segmentation, martech orchestration, and supporter databases.',
      examplesLine: 'CRM procurement, membership CRM, customer data modernization, marketing automation, supporter lifecycle tooling, and audience segmentation programs.',
      metadataLabel: 'crm fit',
      metadataTargets: 'CRM, membership, ticketing CRM, customer data, segmentation, or lifecycle marketing work',
    },
  }[normalizedFocusArea]
}

function normalizeOpportunity(opportunity, index) {
  const confidence = normalizeConfidence(opportunity?.confidence, 0.75)
  const fit = normalizeFitScore(opportunity?.yellow_panther_fit, Math.round(confidence * 100))

  return {
    id: toText(opportunity?.metadata?.id) || `wide-rfp-${index + 1}`,
    title: toText(opportunity?.title) || toText(opportunity?.organization) || 'Wide research opportunity',
    organization: toText(opportunity?.organization) || toText(opportunity?.entity_name) || 'Unknown organization',
    source_url: toText(opportunity?.source_url) || null,
    confidence,
    yellow_panther_fit: fit,
    entity_name: toText(opportunity?.entity_name) || toText(opportunity?.organization) || null,
    canonical_entity_id: toText(opportunity?.canonical_entity_id) || null,
    canonical_entity_name: toText(opportunity?.canonical_entity_name) || toText(opportunity?.entity_name) || toText(opportunity?.organization) || null,
    category: toText(opportunity?.category) || 'RFP',
    status: toText(opportunity?.status) || 'new',
    deadline: toText(opportunity?.deadline) || null,
    description: toText(opportunity?.description) || null,
    metadata: {
      ...(opportunity?.metadata || {}),
      normalized: true,
    },
  }
}
