import crypto from 'node:crypto'

import {
  buildWideRfpResearchPrompt,
  getDefaultWideRfpSeedQuery,
  joinWideRfpResearchBatches,
  normalizeTargetYear,
  normalizeWideRfpExclusionNames,
  normalizeWideRfpResearchBatch,
} from './rfp-wide-research.mjs'

export const MERGED_WIDE_RFP_RUN_ID = 'manus-rfp-wide-research-merged'

export function buildMergedWideResearchImport({ rawBatch, existingMergedBatch = null }) {
  const importedBatch = normalizeImportedWideResearchBatch(rawBatch)
  const mergedBatch = joinWideRfpResearchBatches([
    existingMergedBatch,
    importedBatch,
  ])

  mergedBatch.run_id = MERGED_WIDE_RFP_RUN_ID
  mergedBatch.source = 'manus'
  mergedBatch.opportunities = dedupeOpportunities(mergedBatch.opportunities || [])
  mergedBatch.entity_actions = dedupeEntityActions(mergedBatch.entity_actions || [])
  mergedBatch.excluded_names = normalizeWideRfpExclusionNames([
    ...(existingMergedBatch?.excluded_names || []),
    ...(importedBatch.excluded_names || []),
    ...collectOpportunityTitles(mergedBatch.opportunities),
  ])
  mergedBatch.prompt = buildWideRfpResearchPrompt({
    seedQuery: importedBatch.seed_query || mergedBatch.seed_query || getDefaultWideRfpSeedQuery(importedBatch.focus_area),
    currentRfpPage: '/rfps',
    currentIntakePage: '/tenders',
    targetYear: importedBatch.target_year || mergedBatch.target_year,
    excludeTitles: mergedBatch.excluded_names,
  })

  return {
    importedBatch,
    mergedBatch,
    unifiedRows: buildUnifiedRowsFromBatch(mergedBatch),
  }
}

export function normalizeImportedWideResearchBatch(rawBatch) {
  const metadata = rawBatch?.prompt_execution_metadata || {}
  const targetYear = normalizeTargetYear(metadata.target_year)
  const seedQuery = toText(metadata.seed_query) || getDefaultWideRfpSeedQuery()
  const excludeTitles = normalizeWideRfpExclusionNames(metadata.excluded_known_organizations || [])
  const opportunities = (rawBatch?.opportunities || []).map((opportunity, index) => ({
    ...opportunity,
    metadata: {
      ...(opportunity?.metadata || {}),
      id: toText(opportunity?.metadata?.id) || stableOpportunityId(opportunity, index),
    },
  }))
  const entityActions = (rawBatch?.entity_actions || []).map((action) => ({
    ...action,
    organization: toText(action?.organization) || toText(action?.entity_name) || 'Unknown organization',
    canonical_entity_id: toText(action?.canonical_entity_id) || null,
    canonical_entity_name: toText(action?.canonical_entity_name) || null,
    source_url: toText(action?.source_url) || null,
    entity_name: toText(action?.entity_name) || null,
  }))

  return normalizeWideRfpResearchBatch({
    run_id: slugify(metadata.request_label || `manus-${metadata.seed_query || 'wide-research'}`),
    source: 'manus',
    prompt: buildWideRfpResearchPrompt({
      seedQuery: seedQuery || getDefaultWideRfpSeedQuery(),
      currentRfpPage: metadata.normalized_rfp_page || '/rfps',
      currentIntakePage: metadata.intake_page || '/tenders',
      targetYear,
      excludeTitles,
    }),
    generated_at: toIsoTimestamp(metadata.generated_at) || new Date().toISOString(),
    focusArea: 'web-platforms',
    lane_label: 'Web Platforms',
    seed_query: seedQuery || getDefaultWideRfpSeedQuery(),
    target_year: targetYear,
    excluded_names: excludeTitles,
    opportunities,
    entity_actions: entityActions,
  })
}

export function buildUnifiedRowsFromBatch(batch) {
  const detectedAt = toIsoTimestamp(batch?.generated_at) || new Date().toISOString()
  const rows = []
  for (const opportunity of batch?.opportunities || []) {
    const confidence = normalizeConfidence(opportunity?.confidence, 0.75)
    const fit = normalizeFitScore(opportunity?.yellow_panther_fit, Math.round(confidence * 100))
    const sourceUrl = toText(opportunity?.source_url) || null
    rows.push({
      id: stableUnifiedRowId(opportunity, batch?.run_id),
      title: toText(opportunity?.title) || toText(opportunity?.organization) || 'Untitled RFP',
      organization: toText(opportunity?.organization) || toText(opportunity?.entity_name) || 'Unknown organization',
      description: toText(opportunity?.description) || null,
      yellow_panther_fit: fit,
      category: toText(opportunity?.category) || 'RFP',
      deadline: toText(opportunity?.deadline) || null,
      source_url: sourceUrl,
      entity_id: toText(opportunity?.canonical_entity_id || opportunity?.entity_id) || null,
      entity_name: toText(opportunity?.canonical_entity_name || opportunity?.entity_name || opportunity?.organization) || null,
      location: toText(opportunity?.location) || null,
      status: normalizeUnifiedStatus(opportunity?.status),
      source: batch?.source || 'manus',
      priority: fit >= 90 ? 'critical' : fit >= 75 ? 'high' : fit >= 60 ? 'medium' : 'low',
      detected_at: toText(opportunity?.detected_at) || detectedAt,
      published: toText(opportunity?.published) || detectedAt,
      batch_id: batch?.run_id || MERGED_WIDE_RFP_RUN_ID,
      created_at: detectedAt,
      updated_at: detectedAt,
      confidence_score: confidence,
      priority_score: Math.max(1, Math.round(fit / 10)),
      entity_type: inferEntityType(opportunity),
      metadata: {
        ...(opportunity?.metadata || {}),
        imported_from: batch?.run_id || MERGED_WIDE_RFP_RUN_ID,
      },
      tags: normalizeTags(opportunity?.metadata?.scope_tags),
      keywords: normalizeTags(opportunity?.metadata?.scope_tags),
      link_status: 'verified',
    })
  }

  return rows
}

function stableUnifiedRowId(opportunity, batchId) {
  const raw = [
    toText(batchId),
    toText(opportunity?.source_url),
    toText(opportunity?.title),
    toText(opportunity?.organization),
  ]
    .filter(Boolean)
    .join('|')

  return hashToUuid(crypto.createHash('sha1').update(raw || JSON.stringify(opportunity || {})).digest('hex'))
}

function stableOpportunityId(opportunity, index) {
  return `wide-rfp-${index + 1}-${crypto.createHash('sha1').update(JSON.stringify(opportunity || {})).digest('hex').slice(0, 8)}`
}

function hashToUuid(hash) {
  const hex = (hash || '').replace(/[^a-f0-9]/gi, '').padEnd(32, '0').slice(0, 32)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

function dedupeOpportunities(opportunities) {
  const seen = new Set()
  const result = []
  for (const opportunity of opportunities || []) {
    const key = [
      toText(opportunity?.source_url).toLowerCase(),
      toText(opportunity?.title).toLowerCase(),
      toText(opportunity?.organization).toLowerCase(),
    ]
      .filter(Boolean)
      .join('|')

    if (seen.has(key)) continue
    seen.add(key)
    result.push(opportunity)
  }
  return result
}

function dedupeEntityActions(actions) {
  const seen = new Set()
  const result = []
  for (const action of actions || []) {
    const key = [
      toText(action?.action).toLowerCase(),
      toText(action?.organization).toLowerCase(),
      toText(action?.canonical_entity_id).toLowerCase(),
      toText(action?.source_url).toLowerCase(),
    ]
      .filter(Boolean)
      .join('|')

    if (seen.has(key)) continue
    seen.add(key)
    result.push(action)
  }
  return result
}

function collectOpportunityTitles(opportunities) {
  const seen = new Set()
  const titles = []
  for (const opportunity of opportunities || []) {
    const title = toText(opportunity?.title)
    if (!title) continue
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    titles.push(title)
  }
  return titles
}

function normalizeTags(values) {
  return Array.isArray(values)
    ? values.map((value) => toText(value)).filter(Boolean)
    : []
}

function normalizeUnifiedStatus(value) {
  const status = toText(value).toLowerCase()
  if (!status) return 'new'
  return 'qualified'
}

function inferEntityType(opportunity) {
  const source = [
    opportunity?.entity_name,
    opportunity?.organization,
    opportunity?.category,
    opportunity?.title,
    opportunity?.description,
  ]
    .map(toText)
    .join(' ')
    .toLowerCase()

  if (source.includes('federation')) return 'federation'
  if (source.includes('league')) return 'league'
  if (source.includes('club') || source.includes('team')) return 'club'
  if (source.includes('government') || source.includes('council')) return 'government'
  return 'organization'
}

function normalizeConfidence(value, fallback) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return parsed > 1 ? Math.max(0, Math.min(1, parsed / 100)) : Math.max(0, Math.min(1, parsed))
}

function normalizeFitScore(value, fallback) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const score = parsed > 100 ? 100 : parsed < 0 ? 0 : parsed
  return Math.round(score)
}

function toIsoTimestamp(value) {
  const text = toText(value)
  if (!text) return null
  const parsed = Date.parse(text)
  if (!Number.isFinite(parsed)) return text
  return new Date(parsed).toISOString()
}

function slugify(value) {
  return toText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'wide-rfp'
}

function toText(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}
