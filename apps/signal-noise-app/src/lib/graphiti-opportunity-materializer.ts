import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { getEntityBrowserDossierHref } from '@/lib/entity-routing'
import { linkOpportunityToCanonicalEntity } from '@/lib/opportunity-entity-linking'
import { normalizeOpportunityTaxonomy } from '@/lib/opportunity-taxonomy.mjs'
import {
  buildGraphitiOpportunityId,
  buildGraphitiOpportunityStateHash,
} from '@/lib/graphiti-opportunity-identity'
import type {
  GraphitiOpportunityCard,
  GraphitiOpportunitySourceRow,
  GraphitiOpportunityTaxonomy,
} from '@/lib/graphiti-opportunity-contract'

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function toTextArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean)
  const text = toText(value)
  return text ? [text] : []
}

function uniqueTextValues(values: Array<unknown>): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const value of values) {
    if (Array.isArray(value)) {
      for (const nested of value) {
        const text = toText(nested)
        if (!text || seen.has(text.toLowerCase())) continue
        seen.add(text.toLowerCase())
        output.push(text)
      }
      continue
    }
    const text = toText(value)
    if (!text || seen.has(text.toLowerCase())) continue
    seen.add(text.toLowerCase())
    output.push(text)
  }

  return output
}

function toConfidenceScore(confidence: number): number {
  if (confidence > 1) {
    return Math.max(0, Math.min(1, confidence / 100))
  }

  return Math.max(0, Math.min(1, confidence))
}

function normalizePriority(priorityScore: number, confidenceScore: number): 'high' | 'medium' | 'low' {
  if (priorityScore >= 8 || confidenceScore >= 0.8) return 'high'
  if (priorityScore >= 6 || confidenceScore >= 0.6) return 'medium'
  return 'low'
}

export function materializeGraphitiOpportunity(
  source: GraphitiOpportunitySourceRow,
  canonicalEntities: Awaited<ReturnType<typeof getCanonicalEntitiesSnapshot>> = [],
): GraphitiOpportunityCard & {
  opportunity_id: string
  insight_id: string
  summary: string
  why_it_matters: string
  suggested_action: string
  why_this_is_an_opportunity: string
  yellow_panther_fit_feedback: string
  next_steps: string[]
  supporting_signals: string[]
  read_more_context: string
  freshness: GraphitiOpportunitySourceRow['freshness']
  state_hash: string
  is_active: boolean
  raw_payload: Record<string, unknown>
  source_run_id?: string | null
  source_signal_id?: string | null
  source_episode_id?: string | null
  source_objective?: string | null
  detected_at: string
  materialized_at: string
  last_seen_at: string
} {
  const organization = toText(source.entity_name) || 'Unknown organization'
  const rawPayload = source.raw_payload && typeof source.raw_payload === 'object'
    ? (source.raw_payload as Record<string, unknown>)
    : {}
  const graphitiSalesBrief = asRecord(rawPayload.graphiti_sales_brief)
  const yellowPantherOpportunity = asRecord(rawPayload.yellow_panther_opportunity)
  const decisionOwners = toTextArray(rawPayload.decision_owners)
  const serviceFit = toTextArray(yellowPantherOpportunity.service_fit || graphitiSalesBrief.service_fit)
  const sourceUrl = toText(
    rawPayload['source_url'] ||
      rawPayload['destination_url'] ||
      source.destination_url ||
      getEntityBrowserDossierHref(source.entity_id, '1') ||
      '/entity-browser',
  )
  const linked = linkOpportunityToCanonicalEntity(
    {
      title: source.title,
      organization,
      description: source.summary || source.why_it_matters,
      source_url: sourceUrl,
    },
    canonicalEntities,
  )

  const enrichedTaxonomy = normalizeOpportunityTaxonomy(
    {
      title: source.title,
      organization,
      description: source.summary || source.why_it_matters,
      category: toText(rawPayload['category']) || source.entity_type || 'Graphiti',
      type: toText(rawPayload['type']) || toText(rawPayload['signal_basis']) || toText(rawPayload['opportunity_kind']) || 'Graphiti',
      sport: toText(rawPayload['sport']),
      competition: toText(rawPayload['competition']),
      entity_role: toText(rawPayload['entity_role']),
      opportunity_kind: toText(rawPayload['opportunity_kind']),
      theme: toText(rawPayload['theme']),
      metadata: rawPayload,
      canonical_entity_id: linked.canonical_entity_id || undefined,
      canonical_entity_name: linked.canonical_entity_name || undefined,
      canonical_entity_sport: toText(rawPayload['sport']) || undefined,
    },
    canonicalEntities,
  )

  const confidenceScore = toConfidenceScore(source.confidence)
  const confidence = Math.round(confidenceScore * 100)
  const priorityScore = Math.max(1, Math.min(10, Math.round(confidence / 10) || 1))
  const fitScore = Math.max(confidence, priorityScore * 10)
  const opportunityKind = enrichedTaxonomy.opportunity_kind || 'Other'
  const title = source.title || organization
  const summary = source.summary || source.why_it_matters || source.suggested_action || 'No summary available'
  const whyItMatters = source.why_it_matters || summary
  const suggestedAction = source.suggested_action || 'Review the dossier and progress the strongest aligned opportunity.'
  const whyThisIsAnOpportunity =
    toText(rawPayload.why_this_is_an_opportunity) ||
    toText(graphitiSalesBrief.capability_gap) ||
    toText(yellowPantherOpportunity.competitive_advantage) ||
    whyItMatters ||
    summary
  const yellowPantherFitFeedback =
    toText(rawPayload.yellow_panther_fit_feedback) ||
    toText(yellowPantherOpportunity.fit_feedback) ||
    (serviceFit.length > 0
      ? `Yellow Panther fit is strongest where the dossier maps to ${serviceFit.slice(0, 3).join(', ')}.`
      : 'Yellow Panther fit is inferred from the dossier-level commercial signal and current timing.')
  const nextSteps = uniqueTextValues([
    rawPayload.next_steps,
    graphitiSalesBrief.next_steps,
    graphitiSalesBrief.next_step,
    yellowPantherOpportunity.next_step,
    suggestedAction,
  ]).slice(0, 4)
  const supportingSignals = uniqueTextValues([
    rawPayload.supporting_signals,
    rawPayload.signals,
    graphitiSalesBrief.signals,
    yellowPantherOpportunity.signals,
    decisionOwners.length > 0 ? `Decision owners: ${decisionOwners.join(', ')}` : '',
    serviceFit.length > 0 ? `YP fit: ${serviceFit.join(', ')}` : '',
    source.summary,
    source.why_it_matters,
  ]).slice(0, 5)
  const readMoreContext = uniqueTextValues([
    whyThisIsAnOpportunity,
    yellowPantherFitFeedback,
    decisionOwners.length > 0 ? `Decision owners: ${decisionOwners.join(', ')}` : '',
    serviceFit.length > 0 ? `Service fit: ${serviceFit.join(', ')}` : '',
    `Score basis: ${confidence}% confidence, ${priorityScore}/10 priority, ${fitScore}% YP fit`,
  ]).join(' · ')
  const tags = uniqueTextValues([
    rawPayload['tag'],
    rawPayload['theme'],
    rawPayload['sport'],
    rawPayload['competition'],
    rawPayload['entity_role'],
    opportunityKind,
    enrichedTaxonomy.theme,
  ])

  const opportunity = {
    opportunity_id: buildGraphitiOpportunityId({
      canonical_entity_id: linked.canonical_entity_id,
      canonical_entity_name: linked.canonical_entity_name,
      entity_id: source.entity_id,
      entity_name: organization,
      title,
      opportunity_kind: opportunityKind,
    }),
    insight_id: source.insight_id,
    entity_id: linked.canonical_entity_id || source.entity_id,
    entity_name: linked.canonical_entity_name || source.entity_name || organization,
    entity_type: source.entity_type,
    canonical_entity_id: linked.canonical_entity_id || null,
    canonical_entity_name: linked.canonical_entity_name || null,
    organization: linked.canonical_entity_name || organization,
    title,
    summary,
    why_it_matters: whyItMatters,
    suggested_action: suggestedAction,
    why_this_is_an_opportunity: whyThisIsAnOpportunity,
    yellow_panther_fit_feedback: yellowPantherFitFeedback,
    next_steps: nextSteps,
    supporting_signals: supportingSignals,
    read_more_context: readMoreContext,
    confidence,
    confidence_score: confidenceScore,
    priority: normalizePriority(priorityScore, confidenceScore),
    priority_score: priorityScore,
    yellow_panther_fit: fitScore,
    category: toText(rawPayload['category']) || opportunityKind || 'Graphiti',
    status: 'qualified',
    location: toText(rawPayload['location']) || null,
    value: toText(rawPayload['value'] || rawPayload['budget']) || null,
    deadline: toText(rawPayload['deadline'] || rawPayload['due_date']) || null,
    sport: enrichedTaxonomy.sport || 'Unknown',
    competition: enrichedTaxonomy.competition || 'Unknown',
    entity_role: enrichedTaxonomy.entity_role || 'Organization',
    opportunity_kind: opportunityKind,
    theme: enrichedTaxonomy.theme || 'Other',
    taxonomy: enrichedTaxonomy,
    source_url: sourceUrl,
    tags,
    detected_at: source.detected_at,
    evidence: source.evidence,
    relationships: source.relationships,
    metadata: rawPayload,
  }

  const materialized_at = source.materialized_at || new Date().toISOString()
  return {
    ...opportunity,
    freshness: source.freshness,
    state_hash: buildGraphitiOpportunityStateHash({
      title: opportunity.title,
      organization: opportunity.organization,
      description: opportunity.description,
      why_this_is_an_opportunity: opportunity.why_this_is_an_opportunity,
      yellow_panther_fit_feedback: opportunity.yellow_panther_fit_feedback,
      next_steps: opportunity.next_steps || [],
      supporting_signals: opportunity.supporting_signals || [],
      read_more_context: opportunity.read_more_context,
      confidence: opportunity.confidence,
      confidence_score: opportunity.confidence_score,
      yellow_panther_fit: opportunity.yellow_panther_fit,
      priority_score: opportunity.priority_score,
      category: opportunity.category,
      status: opportunity.status,
      canonical_entity_id: opportunity.canonical_entity_id || null,
      canonical_entity_name: opportunity.canonical_entity_name || null,
      source_url: opportunity.source_url,
      tags: opportunity.tags || [],
      taxonomy: opportunity.taxonomy || {},
      metadata: rawPayload,
    }),
    is_active: true,
    raw_payload: rawPayload,
    source_run_id: source.source_run_id || null,
    source_signal_id: source.source_signal_id || null,
    source_episode_id: source.source_episode_id || null,
    source_objective: source.source_objective || null,
    detected_at: source.detected_at,
    materialized_at,
    last_seen_at: materialized_at,
  }
}

export function rankGraphitiOpportunities<T extends { priority_score?: number | null; confidence?: number | null; detected_at?: string | null }>(opportunities: T[]): T[] {
  return [...opportunities].sort((left, right) => {
    const leftPriority = Number(left.priority_score || 0)
    const rightPriority = Number(right.priority_score || 0)
    if (rightPriority !== leftPriority) return rightPriority - leftPriority

    const leftConfidence = Number(left.confidence || 0)
    const rightConfidence = Number(right.confidence || 0)
    if (rightConfidence !== leftConfidence) return rightConfidence - leftConfidence

    return (Date.parse(right.detected_at || '') || 0) - (Date.parse(left.detected_at || '') || 0)
  })
}
