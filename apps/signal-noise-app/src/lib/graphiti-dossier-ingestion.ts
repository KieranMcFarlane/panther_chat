import crypto from 'node:crypto'
import { query as queryPostgres } from '@/lib/pg-client'
import { getNormalizedUniverseCount } from '@/lib/normalized-universe-count'

type JsonRecord = Record<string, unknown>

export type DossierIngestionStatus = 'pending' | 'ingested' | 'skipped_empty' | 'failed'
export type DossierIngestionQualityState = 'partial' | 'complete' | 'blocked' | 'failed' | 'empty' | 'client_ready'

export type CanonicalDossierRow = {
  id?: string | null
  entity_id?: string | null
  canonical_entity_id: string
  entity_name?: string | null
  entity_type?: string | null
  created_at?: string | null
  generated_at?: string | null
  dossier_data: JsonRecord
}

type NormalizedDossierIngestion = {
  status: DossierIngestionStatus
  quality_state: DossierIngestionQualityState
  answer_count: number
  evidence_count: number
  quality_metrics: DossierIngestionQualityMetrics
  question_facts: JsonRecord[]
  evidence_urls: string[]
  has_informative_content: boolean
  failed_only: boolean
  failure_reason: string | null
}

const OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR = 'OpenCodeProviderInsufficientBalanceError'
const MIN_COMPLETE_USEFUL_FACTS = 5
const MIN_COMPLETE_EVIDENCE_URLS = 3
const MIN_PARTIAL_USEFUL_FACTS = 2

type DossierIngestionQualityMetrics = {
  raw_answer_count: number
  useful_fact_count: number
  failed_fact_count: number
  placeholder_fact_count: number
  no_signal_fact_count: number
  evidence_url_count: number
  wrong_entity_fact_count: number
  tool_failure_fact_count: number
  generic_context_fact_count: number
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
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
    const record = value as JsonRecord
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

function toIso(value: unknown): string | null {
  const text = toText(value)
  if (!text) return null
  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function isFailedOnlyText(value: unknown): boolean {
  const text = toText(value).toLowerCase()
  return Boolean(text) && (
    text.includes('question execution failed before a safe answer could be produced')
    || text.includes(OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR.toLowerCase())
    || text.includes('tool/runtime failure')
    || text.includes('failed before a safe answer')
    || text.includes('retry_exhausted')
    || text.includes('tool_call_missing')
  )
}

function isToolFailureText(value: unknown): boolean {
  const text = toText(value).toLowerCase()
  return Boolean(text) && (
    isFailedOnlyText(text)
    || text.includes('no brightdata tool is available')
    || text.includes('no brightdata tool or service is available')
    || text.includes('no deterministic answer was produced')
    || text.includes('tool_call_missing')
    || text.includes('runtime failure')
  )
}

function isProviderInfrastructureFailure(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') {
    const text = value.toLowerCase()
    return text.includes(OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR.toLowerCase())
      || text.includes('providerinsufficientbalance')
      || text.includes('insufficient balance')
  }
  if (typeof value === 'number' || typeof value === 'boolean') return false
  if (Array.isArray(value)) return value.some(isProviderInfrastructureFailure)
  if (typeof value !== 'object') return false

  const record = value as JsonRecord
  const failureName = toText(record.failure_name || record.error_name || record.name).toLowerCase()
  const errorType = toText(record.error_type || record.failure_type).toLowerCase()
  const message = toText(record.message || record.error_message || record.stderr || record.error).toLowerCase()
  return failureName.includes(OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR.toLowerCase())
    || errorType.includes('provider_infrastructure_failure')
    || message.includes(OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR.toLowerCase())
    || Object.values(record).some(isProviderInfrastructureFailure)
}

function isPlaceholderText(value: unknown): boolean {
  const text = toText(value).toLowerCase()
  return (
    !text
    || text === 'n/a'
    || text === 'unknown'
    || text === 'null'
    || text === 'no_signal'
    || text === 'skipped'
    || text === 'failed'
    || text === 'tool_call_missing'
    || text.includes('no deterministic answer was produced for this question')
    || text.includes('no brightdata tool or service is available')
    || text.includes('insufficient_signal')
    || text.includes('no substantive')
    || text.includes('no relevant results')
    || text.includes('no web evidence')
    || text.includes('returned no results')
    || isToolFailureText(text)
  )
}

function isFailedFact(fact: JsonRecord): boolean {
  const status = toText(fact.status).toLowerCase()
  return status === 'failed'
    || status === 'skipped'
    || status === 'tool_call_missing'
    || isFailedOnlyText(fact.summary)
}

function isNoSignalFact(fact: JsonRecord): boolean {
  const status = toText(fact.status).toLowerCase()
  const summary = toText(fact.summary).toLowerCase()
  return status === 'no_signal'
    || summary === 'no_signal'
    || summary.includes('insufficient_signal')
}

function normalizedNameTokens(values: string[]): string[] {
  return values
    .map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
    .filter((value) => value.length >= 3)
}

function entityNamesForDossier(dossier: JsonRecord, fallback: string[] = []): string[] {
  const questionFirst = asRecord(dossier.question_first)
  const metadata = asRecord(dossier.metadata)
  return [
    ...fallback,
    dossier.entity_name,
    dossier.canonical_entity_name,
    dossier.name,
    questionFirst.entity_name,
    questionFirst.canonical_entity_name,
    metadata.entity_name,
    metadata.canonical_entity_name,
  ].map(toText).filter(Boolean)
}

function isWrongEntityFact(fact: JsonRecord, entityNames: string[]): boolean {
  const expectedNames = normalizedNameTokens(entityNames)
  if (expectedNames.length === 0) return false

  const explicitNames = [
    fact.entity_name,
    fact.canonical_entity_name,
    fact.subject_entity,
    fact.organization,
  ].map(toText).filter(Boolean)
  const explicitTokens = normalizedNameTokens(explicitNames)
  if (explicitTokens.length > 0) {
    return explicitTokens.every((name) => !expectedNames.some((expected) => name === expected || name.includes(expected) || expected.includes(name)))
  }

  return false
}

function isGenericContextFact(fact: JsonRecord): boolean {
  const summary = toText(fact.summary).toLowerCase()
  return Boolean(summary) && (
    summary.includes('finished the 2025') && summary.includes('season')
    || summary.includes('competes in') && summary.includes('top tier')
    || summary.includes('official site') && summary.includes('runs on')
    || summary.startsWith('cms:')
    || summary.includes('technology stack')
    || summary.includes('multi-vendor digital stack')
  )
}

function hasUsefulFactContent(fact: JsonRecord, entityNames: string[] = []): boolean {
  const summary = toText(fact.summary)
  const evidenceUrls = asArray(fact.evidence_urls).map(toText).filter(Boolean)
  if (isFailedFact(fact) || isNoSignalFact(fact)) return false
  if (isToolFailureText(summary) || isWrongEntityFact(fact, entityNames) || isGenericContextFact(fact)) return false
  if (evidenceUrls.length > 0) return true
  if (isPlaceholderText(summary)) return false
  return summary.length >= 20
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const record = value as JsonRecord
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function contentHash(value: unknown): string {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex')
}

function collectAnswerRecords(dossier: JsonRecord): JsonRecord[] {
  const questionFirst = asRecord(dossier.question_first)
  const metadata = asRecord(dossier.metadata)
  const checkpoint = asRecord(dossier.question_first_checkpoint || metadata.question_first_checkpoint)
  const report = asRecord(dossier.question_first_report)

  return [
    questionFirst.answer_records,
    questionFirst.answers,
    questionFirst.questions,
    checkpoint.answer_records,
    checkpoint.answers,
    dossier.answers,
    dossier.questions,
    report.answers,
  ].flatMap((value) => asArray(value).filter((item) => item && typeof item === 'object') as JsonRecord[])
}

function collectEvidenceUrls(value: unknown, urls = new Set<string>()): Set<string> {
  if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) {
    urls.add(value.trim())
    return urls
  }
  if (Array.isArray(value)) {
    for (const item of value) collectEvidenceUrls(item, urls)
    return urls
  }
  if (!value || typeof value !== 'object') return urls

  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    if (/^(url|source_url|href)$/i.test(key)) {
      const text = toText(nested)
      if (/^https?:\/\//i.test(text)) urls.add(text)
    }
    if (/sources?|evidence|urls?/i.test(key)) {
      if (typeof nested === 'string' && /^https?:\/\//i.test(nested)) urls.add(nested)
    }
    collectEvidenceUrls(nested, urls)
  }

  return urls
}

function extractAnswerSummary(answer: JsonRecord): string {
  const answerBody = asRecord(answer.answer)
  const rawStructuredOutput = asRecord(answerBody.raw_structured_output)
  return [
    answer.summary,
    answer.value,
    answer.answer,
    answerBody.summary,
    answerBody.value,
    answerBody.answer,
    rawStructuredOutput.answer,
    rawStructuredOutput.summary,
    rawStructuredOutput.context,
  ].map(toText).find((value) => !isPlaceholderText(value)) || ''
}

function buildQuestionFacts(answerRecords: JsonRecord[]): JsonRecord[] {
  return answerRecords
    .map((answer) => {
      const answerBody = asRecord(answer.answer)
      const rawStructuredOutput = asRecord(answerBody.raw_structured_output)
      const summary = extractAnswerSummary(answer)
      const questionId = toText(answer.question_id || answer.id || rawStructuredOutput.question_id)
      const status = toText(answer.status || answer.validation_state || answer.terminal_state || answerBody.validation_state)
      const confidence = Number(answer.confidence ?? answerBody.confidence ?? rawStructuredOutput.confidence ?? 0)
      const evidenceUrls = Array.from(collectEvidenceUrls(answer))

      return {
        question_id: questionId,
        question_type: toText(answer.question_type || answer.type || answerBody.question_type),
        entity_name: toText(answer.entity_name || rawStructuredOutput.entity_name || answerBody.entity_name),
        canonical_entity_name: toText(answer.canonical_entity_name || rawStructuredOutput.canonical_entity_name || answerBody.canonical_entity_name),
        status,
        confidence: Number.isFinite(confidence) ? confidence : 0,
        summary,
        evidence_urls: evidenceUrls,
        observed_at: toIso(answer.completed_at || answer.updated_at || answer.generated_at),
      }
    })
    .filter((fact) => fact.question_id || fact.summary || (fact.evidence_urls as string[]).length > 0)
}

function computeDossierQualityMetrics(answerRecords: JsonRecord[], questionFacts: JsonRecord[], evidenceUrls: string[], entityNames: string[] = []): DossierIngestionQualityMetrics {
  const failedFactCount = questionFacts.filter(isFailedFact).length
  const noSignalFactCount = questionFacts.filter(isNoSignalFact).length
  const placeholderFactCount = questionFacts.filter((fact) => isPlaceholderText(fact.summary)).length
  const wrongEntityFactCount = questionFacts.filter((fact) => isWrongEntityFact(fact, entityNames)).length
  const toolFailureFactCount = questionFacts.filter((fact) => isToolFailureText(fact.summary)).length
  const genericContextFactCount = questionFacts.filter(isGenericContextFact).length
  const usefulFactCount = questionFacts.filter((fact) => hasUsefulFactContent(fact, entityNames)).length

  return {
    raw_answer_count: Number(answerRecords.length),
    useful_fact_count: usefulFactCount,
    failed_fact_count: failedFactCount,
    placeholder_fact_count: placeholderFactCount,
    no_signal_fact_count: noSignalFactCount,
    evidence_url_count: evidenceUrls.length,
    wrong_entity_fact_count: wrongEntityFactCount,
    tool_failure_fact_count: toolFailureFactCount,
    generic_context_fact_count: genericContextFactCount,
  }
}

function inferQualityState(dossier: JsonRecord, qualityMetrics: DossierIngestionQualityMetrics, failedOnly: boolean): DossierIngestionQualityState {
  const explicit = toText(dossier.quality_state).toLowerCase()
  const publicationStatus = toText(dossier.publication_status || dossier.publish_status).toLowerCase()
  if (failedOnly) return 'failed'
  if (explicit === 'blocked' || publicationStatus.includes('blocked')) return 'blocked'
  if (explicit === 'failed' || explicit === 'empty') return explicit as DossierIngestionQualityState
  if (
    qualityMetrics.useful_fact_count >= MIN_COMPLETE_USEFUL_FACTS
    && qualityMetrics.evidence_url_count >= MIN_COMPLETE_EVIDENCE_URLS
  ) {
    return explicit === 'client_ready' || publicationStatus.includes('client_ready') ? 'client_ready' : 'complete'
  }
  if (qualityMetrics.useful_fact_count >= MIN_PARTIAL_USEFUL_FACTS || qualityMetrics.evidence_url_count >= 1) return 'partial'
  return 'empty'
}

export function normalizeDossierIngestionState(dossier: JsonRecord, entityNames: string[] = []): NormalizedDossierIngestion {
  const answerRecords = collectAnswerRecords(dossier)
  const questionFacts = buildQuestionFacts(answerRecords)
  const evidenceUrls = Array.from(collectEvidenceUrls(dossier))
  const allEntityNames = entityNamesForDossier(dossier, entityNames)
  const qualityMetrics = computeDossierQualityMetrics(answerRecords, questionFacts, evidenceUrls, allEntityNames)
  const providerInfrastructureFailure = answerRecords.some(isProviderInfrastructureFailure) || isProviderInfrastructureFailure(dossier)
  const failedOnly = questionFacts.length > 0 && qualityMetrics.useful_fact_count === 0
  const discoverySummary = asRecord(asRecord(dossier.question_first).discovery_summary || dossier.discovery_summary)
  const graphitiSalesBrief = asRecord(discoverySummary.graphiti_sales_brief || dossier.graphiti_sales_brief)
  const yellowPanther = asRecord(discoverySummary.yellow_panther_opportunity || dossier.yellow_panther_opportunity)
  const hasCommercialContext = Object.keys(graphitiSalesBrief).length > 0 || Object.keys(yellowPanther).length > 0
  const hasInformativeContent = (
    qualityMetrics.useful_fact_count > 0
    || qualityMetrics.evidence_url_count > 0
    || hasCommercialContext
  ) && !failedOnly && !providerInfrastructureFailure
  const qualityState = inferQualityState(dossier, qualityMetrics, failedOnly)
  const qualityBlockers = [
    qualityMetrics.wrong_entity_fact_count > 0 ? 'wrong_entity_blocked' : '',
    qualityMetrics.tool_failure_fact_count > 0 ? 'tool_failure_blocked' : '',
    qualityMetrics.generic_context_fact_count > 0 && qualityMetrics.useful_fact_count === 0 ? 'generic_context_only' : '',
  ].filter(Boolean)

  return {
    status: providerInfrastructureFailure ? 'failed' : hasInformativeContent ? 'ingested' : 'skipped_empty',
    quality_state: providerInfrastructureFailure ? 'failed' : hasInformativeContent ? qualityState : 'empty',
    answer_count: qualityMetrics.useful_fact_count,
    evidence_count: qualityMetrics.evidence_url_count,
    quality_metrics: qualityMetrics,
    question_facts: questionFacts,
    evidence_urls: evidenceUrls,
    has_informative_content: hasInformativeContent,
    failed_only: failedOnly || providerInfrastructureFailure,
    failure_reason: providerInfrastructureFailure ? 'provider_infrastructure_failure' : qualityBlockers[0] || null,
  }
}

export function buildGraphitiDossierEpisode(row: CanonicalDossierRow) {
  const normalized = normalizeDossierIngestionState(row.dossier_data, [row.entity_name || '', row.canonical_entity_id || ''])
  const qualityMetrics = normalized.quality_metrics
  const discoverySummary = asRecord(asRecord(row.dossier_data.question_first).discovery_summary || row.dossier_data.discovery_summary)
  const referenceTime = toIso(row.generated_at || row.created_at) || new Date().toISOString()
  const episodeBody = {
    source_description: 'entity_dossiers',
    reference_time: referenceTime,
    entity: {
      entity_id: row.entity_id || row.canonical_entity_id,
      canonical_entity_id: row.canonical_entity_id,
      entity_name: row.entity_name || row.canonical_entity_id,
      entity_type: row.entity_type || 'ENTITY',
    },
    dossier: {
      dossier_id: row.id || null,
      quality_state: normalized.quality_state,
      raw_answer_count: qualityMetrics.raw_answer_count,
      useful_fact_count: qualityMetrics.useful_fact_count,
      evidence_url_count: qualityMetrics.evidence_url_count,
      source_created_at: toIso(row.created_at),
      source_generated_at: toIso(row.generated_at),
    },
    question_facts: normalized.question_facts,
    evidence_urls: normalized.evidence_urls,
    graphiti_sales_brief: discoverySummary.graphiti_sales_brief || row.dossier_data.graphiti_sales_brief || null,
    yellow_panther: discoverySummary.yellow_panther_opportunity || row.dossier_data.yellow_panther_opportunity || null,
    promoted_summary: discoverySummary.summary || row.dossier_data.executive_summary || row.dossier_data.recommended_approach || null,
  }

  return {
    ...normalized,
    source_description: 'entity_dossiers',
    reference_time: referenceTime,
    episode_body: episodeBody,
    content_hash: contentHash(episodeBody),
  }
}

export async function loadLatestCanonicalDossiers(limit = 5000): Promise<CanonicalDossierRow[]> {
  const result = await queryPostgres(
    `
      select distinct on (canonical_entity_id)
        id,
        entity_id,
        canonical_entity_id,
        entity_name,
        entity_type,
        created_at,
        generated_at,
        dossier_data
      from entity_dossiers
      where canonical_entity_id is not null
        and dossier_data is not null
      order by canonical_entity_id, created_at desc
      limit $1
    `,
    [limit],
  )

  return result.rows as CanonicalDossierRow[]
}

export async function upsertDossierIngestionLedger(row: CanonicalDossierRow, dryRun = false) {
  const episode = buildGraphitiDossierEpisode(row)
  const sourceCreatedAt = toIso(row.created_at)
  const sourceGeneratedAt = toIso(row.generated_at)
  const ingestedAt = episode.status === 'ingested' ? new Date().toISOString() : null
  const payload = {
    canonical_entity_id: row.canonical_entity_id,
    dossier_id: row.id || null,
    entity_id: row.entity_id || row.canonical_entity_id,
    entity_name: row.entity_name || row.canonical_entity_id,
    entity_type: row.entity_type || 'ENTITY',
    content_hash: episode.content_hash,
    status: episode.status,
    quality_state: episode.quality_state,
    answer_count: episode.answer_count,
    evidence_count: episode.evidence_count,
    source_created_at: sourceCreatedAt,
    source_generated_at: sourceGeneratedAt,
    ingested_at: ingestedAt,
    last_error: episode.failure_reason,
    source_description: episode.source_description,
    reference_time: episode.reference_time,
    episode_body: episode.episode_body,
    raw_metadata: {
      failed_only: episode.failed_only,
      has_informative_content: episode.has_informative_content,
      failure_reason: episode.failure_reason,
      quality_metrics: episode.quality_metrics,
      raw_answer_count: episode.quality_metrics.raw_answer_count,
      useful_fact_count: episode.quality_metrics.useful_fact_count,
      failed_fact_count: episode.quality_metrics.failed_fact_count,
      placeholder_fact_count: episode.quality_metrics.placeholder_fact_count,
      no_signal_fact_count: episode.quality_metrics.no_signal_fact_count,
      evidence_url_count: episode.quality_metrics.evidence_url_count,
      wrong_entity_fact_count: episode.quality_metrics.wrong_entity_fact_count,
      tool_failure_fact_count: episode.quality_metrics.tool_failure_fact_count,
      generic_context_fact_count: episode.quality_metrics.generic_context_fact_count,
      wrong_entity_blocked: episode.quality_metrics.wrong_entity_fact_count,
      tool_failure_blocked: episode.quality_metrics.tool_failure_fact_count,
      generic_context_only: episode.quality_metrics.generic_context_fact_count > 0 && episode.quality_metrics.useful_fact_count === 0,
    },
  }

  if (dryRun) return { action: 'dry_run' as const, payload }

  await queryPostgres(
    `
      insert into graphiti_dossier_ingestions (
        canonical_entity_id,
        dossier_id,
        entity_id,
        entity_name,
        entity_type,
        content_hash,
        status,
        quality_state,
        answer_count,
        evidence_count,
        source_created_at,
        source_generated_at,
        ingested_at,
        last_error,
        source_description,
        reference_time,
        episode_body,
        raw_metadata,
        updated_at
      ) values (
        $1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10,
        $11::timestamptz, $12::timestamptz, $13::timestamptz, $14,
        $15, $16::timestamptz, $17::jsonb, $18::jsonb, now()
      )
      on conflict (canonical_entity_id, content_hash)
      do update set
        dossier_id = excluded.dossier_id,
        entity_id = excluded.entity_id,
        entity_name = excluded.entity_name,
        entity_type = excluded.entity_type,
        status = excluded.status,
        quality_state = excluded.quality_state,
        answer_count = excluded.answer_count,
        evidence_count = excluded.evidence_count,
        source_created_at = excluded.source_created_at,
        source_generated_at = excluded.source_generated_at,
        ingested_at = excluded.ingested_at,
        last_error = excluded.last_error,
        source_description = excluded.source_description,
        reference_time = excluded.reference_time,
        episode_body = excluded.episode_body,
        raw_metadata = excluded.raw_metadata,
        updated_at = now()
    `,
    [
      payload.canonical_entity_id,
      payload.dossier_id,
      payload.entity_id,
      payload.entity_name,
      payload.entity_type,
      payload.content_hash,
      payload.status,
      payload.quality_state,
      payload.answer_count,
      payload.evidence_count,
      payload.source_created_at,
      payload.source_generated_at,
      payload.ingested_at,
      payload.last_error,
      payload.source_description,
      payload.reference_time,
      JSON.stringify(payload.episode_body),
      JSON.stringify(payload.raw_metadata),
    ],
  )

  await queryPostgres(
    `
      update graphiti_dossier_ingestions
      set status = 'skipped_empty',
          quality_state = 'empty',
          updated_at = now(),
          raw_metadata = coalesce(raw_metadata, '{}'::jsonb) || jsonb_build_object(
            'superseded_by_latest_quality_backfill',
            true,
            'superseded_by_content_hash',
            $2
          )
      where canonical_entity_id = $1
        and content_hash <> $2
        and status = 'ingested'
    `,
    [payload.canonical_entity_id, payload.content_hash],
  )

  return { action: 'upserted' as const, payload }
}

export async function materializeOpportunityFromIngestedDossier(row: CanonicalDossierRow, dryRun = false) {
  const episode = buildGraphitiDossierEpisode(row)
  return {
    eligible: episode.status === 'ingested',
    dry_run: dryRun,
    canonical_entity_id: row.canonical_entity_id,
    quality_state: episode.quality_state,
    answer_count: episode.answer_count,
    evidence_count: episode.evidence_count,
  }
}

export async function loadGraphitiDossierIngestionStats() {
  const [universeCount, dossierStats, ingestionStats, opportunityStats] = await Promise.all([
    getNormalizedUniverseCount().catch(() => null),
    queryPostgres(`
      select
        count(distinct canonical_entity_id)::int as dossiers_persisted_entities
      from entity_dossiers
      where canonical_entity_id is not null
    `),
        queryPostgres(`
          select
            count(distinct canonical_entity_id) filter (where status = 'ingested')::int as dossiers_ingested_entities,
            count(distinct canonical_entity_id) filter (where status = 'ingested' and quality_state = 'complete')::int as complete_dossiers_ingested,
            count(distinct canonical_entity_id) filter (where status = 'ingested' and quality_state = 'partial')::int as partial_dossiers_ingested,
            count(distinct canonical_entity_id) filter (where status = 'skipped_empty')::int as skipped_empty_entities,
            count(*) filter (where status = 'failed')::int as failed_ingestions,
            count(distinct canonical_entity_id) filter (where status = 'ingested' and quality_state = 'complete' and coalesce(evidence_count, 0) = 0)::int as sparse_complete_entities,
            count(distinct canonical_entity_id) filter (where status = 'ingested' and quality_state = 'partial' and coalesce(evidence_count, 0) = 0)::int as sparse_partial_entities,
            count(distinct canonical_entity_id) filter (where status = 'ingested' and coalesce(evidence_count, 0) = 0)::int as zero_evidence_entities,
            count(distinct canonical_entity_id) filter (where status = 'ingested' and (coalesce(answer_count, 0) >= 2 or coalesce(evidence_count, 0) >= 1))::int as useful_dossier_entities,
            count(distinct canonical_entity_id) filter (where status = 'ingested' and (coalesce(answer_count, 0) < 5 or coalesce(evidence_count, 0) < 3))::int as enrichment_required_entities,
            count(distinct canonical_entity_id) filter (where status = 'ingested' and coalesce(answer_count, 0) >= 5 and coalesce(evidence_count, 0) >= 3)::int as materializable_dossier_candidates,
            count(*) filter (where coalesce((raw_metadata->>'wrong_entity_blocked')::int, 0) > 0)::int as wrong_entity_blocked,
            count(*) filter (where coalesce((raw_metadata->>'tool_failure_blocked')::int, 0) > 0)::int as tool_failure_blocked,
            count(*) filter (where raw_metadata->>'generic_context_only' = 'true')::int as generic_context_only
          from graphiti_dossier_ingestions
        `).catch(() => ({ rows: [{}] })),
    queryPostgres(`
      select
        count(distinct canonical_entity_id) filter (
          where is_active and raw_payload->>'source' = 'entity_dossiers'
            and title not ilike 'Question execution failed before a safe answer could be produced%'
        )::int as opportunity_worthy_entities,
        count(*) filter (
          where is_active and raw_payload->>'source' = 'entity_dossiers'
        )::int as active_opportunities,
        count(*) filter (
          where is_active and raw_payload->>'source' = 'entity_dossiers'
            and raw_payload->'temporal_reasoning'->>'status' = 'accelerating'
        )::int as accelerating_opportunities,
        count(*) filter (
          where raw_payload->>'source' = 'entity_dossiers'
            and raw_payload->>'quality_state' = 'complete'
        )::int as complete_materialized_rows,
        count(*) filter (
          where is_active and raw_payload->>'source' = 'entity_dossiers'
            and raw_payload->>'quality_state' = 'complete'
        )::int as complete_active_opportunities,
        count(*) filter (
          where raw_payload->>'source' = 'entity_dossiers'
            and raw_payload->'commercial_qualification'->>'status' = 'no_buying_trigger'
        )::int as no_buying_trigger_rows,
        count(*) filter (
          where raw_payload->>'source' = 'entity_dossiers'
            and raw_payload->'temporal_reasoning'->>'status' = 'stale'
        )::int as stale_opportunity_rows,
        count(*) filter (
          where raw_payload->>'source' = 'entity_dossiers'
            and raw_payload->>'watch_item' = 'true'
        )::int as watch_items,
        count(*) filter (
          where is_active and raw_payload->>'source' = 'entity_dossiers'
            and title ilike 'Question execution failed before a safe answer could be produced%'
        )::int as failed_only_opportunities_active,
        max(last_seen_at) filter (
          where raw_payload->>'source' = 'entity_dossiers'
        ) as latest_dossier_opportunity_seen_at
      from graphiti_materialized_opportunities
    `).catch(() => ({ rows: [{}] })),
  ])
  const dossierRow = dossierStats.rows[0] || {}
  const ingestionRow = ingestionStats.rows[0] || {}
  const opportunityRow = opportunityStats.rows[0] || {}
  const dossiersIngestedEntities = Number(ingestionRow.dossiers_ingested_entities || 0)
  const opportunityWorthyEntities = Number(opportunityRow.opportunity_worthy_entities || 0)

  return {
    canonical_entities_total: universeCount ?? 0,
    dossiers_persisted_entities: Number(dossierRow.dossiers_persisted_entities || 0),
    dossiers_ingested_entities: dossiersIngestedEntities,
    complete_dossiers_ingested: Number(ingestionRow.complete_dossiers_ingested || 0),
      partial_dossiers_ingested: Number(ingestionRow.partial_dossiers_ingested || 0),
      skipped_empty_entities: Number(ingestionRow.skipped_empty_entities || 0),
      failed_ingestions: Number(ingestionRow.failed_ingestions || 0),
      sparse_complete_entities: Number(ingestionRow.sparse_complete_entities || 0),
      sparse_partial_entities: Number(ingestionRow.sparse_partial_entities || 0),
      zero_evidence_entities: Number(ingestionRow.zero_evidence_entities || 0),
      useful_dossier_entities: Number(ingestionRow.useful_dossier_entities || 0),
      enrichment_required_entities: Number(ingestionRow.enrichment_required_entities || 0),
      materializable_dossier_candidates: Number(ingestionRow.materializable_dossier_candidates || 0),
      wrong_entity_blocked: Number(ingestionRow.wrong_entity_blocked || 0),
      tool_failure_blocked: Number(ingestionRow.tool_failure_blocked || 0),
      generic_context_only: Number(ingestionRow.generic_context_only || 0),
      ingested_not_opportunity_worthy: Math.max(0, dossiersIngestedEntities - opportunityWorthyEntities),
    opportunity_worthy_entities: opportunityWorthyEntities,
    watch_items: Number(opportunityRow.watch_items || 0),
    active_opportunities: Number(opportunityRow.active_opportunities || 0),
    accelerating_opportunities: Number(opportunityRow.accelerating_opportunities || 0),
    complete_materialized_rows: Number(opportunityRow.complete_materialized_rows || 0),
    complete_active_opportunities: Number(opportunityRow.complete_active_opportunities || 0),
    no_buying_trigger_rows: Number(opportunityRow.no_buying_trigger_rows || 0),
    stale_opportunity_rows: Number(opportunityRow.stale_opportunity_rows || 0),
    failed_only_opportunities_active: Number(opportunityRow.failed_only_opportunities_active || 0),
    latest_dossier_opportunity_seen_at: opportunityRow.latest_dossier_opportunity_seen_at || null,
  }
}

export async function backfillGraphitiDossierIngestions(options: { limit?: number; dryRun?: boolean } = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit || 5000), 10000))
  const dryRun = options.dryRun !== false
  const rows = await loadLatestCanonicalDossiers(limit)
  const stats = {
    latest_canonical_dossiers: rows.length,
    would_ingest: 0,
    would_skip_empty: 0,
    ingested: 0,
    skipped_empty: 0,
    failed: 0,
  }

  for (const row of rows) {
    try {
      const result = await upsertDossierIngestionLedger(row, dryRun)
      if (result.payload.status === 'ingested') {
        stats.would_ingest += 1
        if (!dryRun) stats.ingested += 1
      } else if (result.payload.status === 'skipped_empty') {
        stats.would_skip_empty += 1
        if (!dryRun) stats.skipped_empty += 1
      } else if (result.payload.status === 'failed') {
        stats.failed += 1
      }
      await materializeOpportunityFromIngestedDossier(row, dryRun)
    } catch {
      stats.failed += 1
    }
  }

  return {
    dry_run: dryRun,
    stats,
  }
}
