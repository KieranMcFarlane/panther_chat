import { execFileSync } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export {
  DEFAULT_WIDE_RFP_FOCUS_AREA,
  buildWideRfpResearchPrompt,
  getDefaultWideRfpSeedQuery,
  getWideRfpLaneLabel,
  inferFocusAreaFromPrompt,
  inferTargetYearFromPrompt,
  normalizeFocusArea,
  normalizeTargetYear,
  normalizeWideRfpExclusionNames,
} from './rfp-wide-research-prompt.mjs'

import {
  DEFAULT_WIDE_RFP_FOCUS_AREA,
  buildWideRfpResearchPrompt,
  getDefaultWideRfpSeedQuery,
  getWideRfpLaneLabel,
  inferFocusAreaFromPrompt,
  inferTargetYearFromPrompt,
  normalizeFocusArea,
  normalizeTargetYear,
  normalizeWideRfpExclusionNames,
} from './rfp-wide-research-prompt.mjs'

export function normalizeWideRfpResearchBatch(input) {
  const prompt = toText(input?.prompt) || buildWideRfpResearchPrompt({ seedQuery: getDefaultWideRfpSeedQuery(DEFAULT_WIDE_RFP_FOCUS_AREA), focusArea: DEFAULT_WIDE_RFP_FOCUS_AREA })
  const source = typeof input?.source === 'string' && input.source.trim() ? input.source.trim() : 'manus'
  const generatedAt = toText(input?.generated_at) || new Date().toISOString()
  const focusArea = normalizeFocusArea(input?.focusArea || input?.focus_area || DEFAULT_WIDE_RFP_FOCUS_AREA)
  const laneLabel = getWideRfpLaneLabel(focusArea)
  const seedQuery = toText(input?.seedQuery) || toText(input?.seed_query) || getDefaultWideRfpSeedQuery(focusArea)
  const targetYear = normalizeTargetYear(input?.targetYear || input?.target_year || inferTargetYearFromPrompt(prompt))
  const excludedNames = normalizeWideRfpExclusionNames(input?.excludeNames || input?.excluded_names)
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
    target_year: targetYear,
    excluded_names: excludedNames,
    opportunities,
    entity_actions: entityActions,
    summary: {
      total_opportunities: opportunities.length,
      linked_entities: entityActions.filter((action) => action.action === 'link' || action.action === 'reuse').length,
      entities_to_create: entityActions.filter((action) => action.action === 'create').length,
    },
  }
}

export function joinWideRfpResearchBatches(batches) {
  const normalizedBatches = (batches || [])
    .filter(Boolean)
    .map((batch, index) => normalizeWideRfpResearchBatch({
      ...batch,
      run_id: toText(batch?.run_id) || `wide-rfp-merged-source-${index + 1}`,
    }))

  if (normalizedBatches.length === 0) {
    return normalizeWideRfpResearchBatch({
      run_id: 'manus-rfp-wide-research-merged',
      source: 'manus',
      prompt: buildWideRfpResearchPrompt({
        seedQuery: getDefaultWideRfpSeedQuery(DEFAULT_WIDE_RFP_FOCUS_AREA),
        focusArea: DEFAULT_WIDE_RFP_FOCUS_AREA,
      }),
      opportunities: [],
      entity_actions: [],
      generated_at: new Date().toISOString(),
    })
  }

  const prompt = normalizedBatches.find((batch) => toText(batch.prompt))?.prompt || normalizedBatches[0].prompt || ''
  const focusArea = normalizedBatches.find((batch) => toText(batch.focus_area))?.focus_area || normalizedBatches[0].focus_area || DEFAULT_WIDE_RFP_FOCUS_AREA
  const laneLabel = normalizedBatches.find((batch) => toText(batch.lane_label))?.lane_label || normalizedBatches[0].lane_label || getWideRfpLaneLabel(focusArea)
  const seedQuery = normalizedBatches.find((batch) => toText(batch.seed_query))?.seed_query || normalizedBatches[0].seed_query || getDefaultWideRfpSeedQuery(focusArea)
  const targetYear = normalizedBatches.find((batch) => normalizeTargetYear(batch.target_year) !== null)?.target_year ?? null
  const excludedNames = normalizeWideRfpExclusionNames(normalizedBatches.flatMap((batch) => batch.excluded_names || []))
  const generatedAt = normalizedBatches
    .map((batch) => toText(batch.generated_at))
    .filter(Boolean)
    .sort()
    .at(-1) || new Date().toISOString()

  const opportunities = normalizedBatches.flatMap((batch) => batch.opportunities || [])
  const entityActions = normalizedBatches.flatMap((batch) => batch.entity_actions || [])
  const mergedSource = normalizedBatches.some((batch) => toText(batch.source) === 'manus') ? 'manus' : normalizedBatches[0].source || 'manus'

  return normalizeWideRfpResearchBatch({
    run_id: 'manus-rfp-wide-research-merged',
    source: mergedSource,
    prompt,
    generated_at: generatedAt,
    focus_area: focusArea,
    lane_label: laneLabel,
    seed_query: seedQuery,
    target_year: targetYear,
    excluded_names: excludedNames,
    opportunities,
    entity_actions: entityActions,
  })
}

export async function writeWideRfpResearchArtifact(input) {
  const outputDir = toText(input?.outputDir) || resolvePrimaryWideRfpResearchOutputDir()
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
  try {
    const candidates = []
    const seen = new Set()

    for (const outputDir of resolveWideRfpResearchSearchDirs(input)) {
      let entries
      try {
        entries = await readdir(outputDir, { withFileTypes: true })
      } catch {
        continue
      }

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.startsWith('wide_rfp_research_') || !entry.name.endsWith('.json')) continue
        const filePath = join(outputDir, entry.name)
        if (seen.has(filePath)) continue
        seen.add(filePath)

        const fileStat = await readFile(filePath, 'utf8')
        candidates.push({
          filePath,
          generatedAt: extractGeneratedAt(fileStat),
          hasSignal: hasWideResearchSignal(parseJson(fileStat)),
        })
      }
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

function resolvePrimaryWideRfpResearchOutputDir() {
  const envDir = toText(process.env.RFP_WIDE_RESEARCH_CACHE_DIR)
  if (envDir) return envDir

  const gitCommonDir = resolveGitCommonDir()
  if (gitCommonDir) {
    return join(gitCommonDir, 'rfp-wide-research')
  }

  return join(process.cwd(), 'backend', 'data', 'discovery_lanes', 'wide_rfp_research')
}

function resolveWideRfpResearchSearchDirs(input) {
  const dirs = new Set()

  const explicitDir = toText(input?.outputDir)
  if (explicitDir) {
    dirs.add(explicitDir)
  }

  dirs.add(resolvePrimaryWideRfpResearchOutputDir())
  dirs.add(join(process.cwd(), 'backend', 'data', 'discovery_lanes', 'wide_rfp_research'))

  for (const worktreeRoot of resolveGitWorktreeRoots()) {
    dirs.add(join(worktreeRoot, 'apps', 'signal-noise-app', 'backend', 'data', 'discovery_lanes', 'wide_rfp_research'))
    dirs.add(join(worktreeRoot, 'backend', 'data', 'discovery_lanes', 'wide_rfp_research'))
  }

  return Array.from(dirs)
}

function resolveGitCommonDir() {
  try {
    const raw = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()

    if (!raw) return null
    return raw.startsWith('/') ? raw : join(process.cwd(), raw)
  } catch {
    return null
  }
}

function resolveGitWorktreeRoots() {
  try {
    const raw = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    const roots = []
    for (const line of raw.split('\n')) {
      if (!line.startsWith('worktree ')) continue
      const root = line.slice('worktree '.length).trim()
      if (root) roots.push(root)
    }

    return roots
  } catch {
    return []
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
  const focusArea = normalizeFocusArea(batch.focus_area || DEFAULT_WIDE_RFP_FOCUS_AREA)
  const source = typeof batch.source === 'string' && batch.source.trim() && batch.source.trim() !== '[object Object]'
    ? batch.source.trim()
    : 'manus'
  const targetYear = normalizeTargetYear(batch.target_year || inferTargetYearFromPrompt(prompt))
  const excludedNames = normalizeWideRfpExclusionNames(batch.excluded_names)
  return {
    ...batch,
    source,
    focus_area: focusArea,
    lane_label: toText(batch.lane_label) || getWideRfpLaneLabel(focusArea),
    seed_query: toText(batch.seed_query) || getDefaultWideRfpSeedQuery(focusArea),
    target_year: targetYear,
    excluded_names: excludedNames,
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
