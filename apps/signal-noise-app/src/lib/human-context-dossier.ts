export interface HumanContextSection<TContent = Record<string, any>> {
  status: 'filled' | 'partial' | 'missing'
  content: TContent
  confidence: number
  evidence_refs: string[]
}

export interface HumanContextDossier {
  entity_id: string
  entity_name: string
  entity_type: string
  sections: {
    overview: HumanContextSection<{
      who_they_are: string
      where_they_operate: string
      why_they_matter: string
    }>
    commercial_digital_context: HumanContextSection<{
      digital_maturity_summary: string
      commercial_motion: string
      fan_or_data_signals: string[]
      transformation_pressure: string[]
    }>
    leadership_decision_shape: HumanContextSection<{
      economic_buyer: string[]
      technical_buyer: string[]
      influencers: string[]
      decision_dynamics: string
    }>
    opportunity_narrative: HumanContextSection<{
      best_fit_problem: string
      why_now: string
      yellow_panther_angle: string
      likely_objections: string[]
    }>
    relationship_access: HumanContextSection<{
      warm_paths: string[]
      partner_paths: string[]
      gatekeepers: string[]
      best_entry_route: string
    }>
    temporal_relational_context: HumanContextSection<{
      freshness_summary: string
      timeline_anchors: string[]
      relationship_summary: string
      relationship_signals: string[]
      graph_source: string
    }>
    recommended_approach: HumanContextSection<{
      approach_strategy: string
      first_message_theme: string
      pilot_idea: string
      next_best_action: string
    }>
    evidence_confidence: HumanContextSection<{
      strongest_evidence: string[]
      open_questions: string[]
      stale_or_weak_points: string[]
    }>
  }
}

function toList(values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && String(value).trim())).map((value) => String(value).trim())
}

function toStatus(parts: unknown[]) {
  const populated = parts.filter((part) => {
    if (Array.isArray(part)) return part.length > 0
    return Boolean(part && String(part).trim())
  }).length

  if (populated === 0) return 'missing'
  if (populated === parts.length) return 'filled'
  return 'partial'
}

function toConfidence(value: unknown, fallback = 0.65) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return numeric <= 1 ? numeric : numeric / 100
}

function normalizeApproachSentence(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^Start with /i, 'Lead with ')
    .replace(/proof of concept/gi, 'proof of value')
}

export function buildHumanContextDossier(dossier: any, entity: any): HumanContextDossier {
  const coreInfo = dossier?.core_info || {}
  const digital = dossier?.digital_transformation || {}
  const strategic = dossier?.strategic_analysis || {}
  const roadmap = dossier?.implementation_roadmap || {}
  const linkedin = dossier?.linkedin_connection_analysis || {}
  const metadata = dossier?.metadata || {}
  const recommendations = linkedin?.recommendations || {}
  const opportunityScoring = strategic?.opportunity_scoring || {}
  const totalConnectionsFound = linkedin?.yellow_panther_uk_team?.total_connections_found
  const tier1PathCount = linkedin?.tier_1_analysis?.introduction_paths?.length
  const tier2PathCount = linkedin?.tier_2_analysis?.tier_2_introduction_paths?.length

  const entityName = String(coreInfo.name || entity?.properties?.name || 'Unknown entity')
  const entityType = String(coreInfo.type || entity?.properties?.type || 'Unknown')
  const entityId = String(entity?.id || entity?.neo4j_id || entityName)

  const immediateOpportunities = Array.isArray(opportunityScoring.immediate_launch) ? opportunityScoring.immediate_launch : []
  const strongestOpportunity = immediateOpportunities[0]
  const strongestOpportunityText = typeof strongestOpportunity === 'string'
    ? strongestOpportunity
    : String(strongestOpportunity?.opportunity || '')
  const strongestOpportunityLabel = strongestOpportunityText.trim()

  const digitalSignals = toList([
    typeof digital.digital_maturity === 'number' ? `Digital maturity ${digital.digital_maturity}/100` : null,
    typeof digital.transformation_score === 'number' ? `Transformation score ${digital.transformation_score}/100` : null,
    Array.isArray(digital.strategic_opportunities) ? digital.strategic_opportunities[0] : null,
    metadata.information_freshness,
  ])
  const timelineAnchors = toList([
    roadmap?.phase_1_engagement?.timeline ? `Phase 1: ${roadmap.phase_1_engagement.timeline}` : null,
    roadmap?.phase_2_pilot?.timeline ? `Phase 2: ${roadmap.phase_2_pilot.timeline}` : null,
    roadmap?.phase_3_partnership?.timeline ? `Phase 3: ${roadmap.phase_3_partnership.timeline}` : null,
    metadata.next_review_date ? `Next review: ${metadata.next_review_date}` : null,
  ])
  const relationshipSignals = toList([
    totalConnectionsFound != null ? `${totalConnectionsFound} Yellow Panther team connections found` : null,
    tier1PathCount != null ? `${tier1PathCount} tier 1 introduction paths` : null,
    tier2PathCount != null ? `${tier2PathCount} tier 2 introduction paths` : null,
    linkedin?.tier_1_analysis?.introduction_paths?.[0]?.introduction_strategy,
    recommendations.optimal_team_member ? `Recommended contact: ${recommendations.optimal_team_member}` : null,
  ])
  const freshnessSummary = String(
    metadata.information_freshness ||
      entity?.properties?.last_updated ||
      metadata.generated_date ||
      'Freshness has not yet been verified from the graph.',
  )

  const warmPaths = toList([
    linkedin?.tier_1_analysis?.introduction_paths?.[0]?.introduction_strategy,
    linkedin?.tier_2_analysis?.tier_2_introduction_paths?.[0]?.introduction_strategy,
  ])

  const technicalBuyers = toList([
    recommendations.optimal_team_member,
    'Chief Digital Officer / Head of Technology',
  ])

  const economicBuyers = toList([
    'Chief Commercial Officer',
    'Chief Financial Officer',
  ])

  const influencers = toList([
    linkedin?.recommendations?.optimal_team_member,
    'Commercial partnership team',
  ])

  const approachStrategy = String(
    normalizeApproachSentence(
      strategic.recommended_approach ||
        recommendations.recommended_approach ||
        'Lead with a small proof of value tied to a validated commercial or fan-engagement need.',
    ),
  )

  return {
    entity_id: entityId,
    entity_name: entityName,
    entity_type: entityType,
    sections: {
      overview: {
        status: toStatus([entityName, entityType, coreInfo.hq || entity?.properties?.country]),
        content: {
          who_they_are: `${entityName} is a ${entityType.toLowerCase()} operating in ${String(coreInfo.hq || entity?.properties?.country || 'its primary market')}.`,
          where_they_operate: String(coreInfo.hq || entity?.properties?.country || 'Location not yet verified'),
          why_they_matter: strongestOpportunityLabel
            ? `${entityName} matters because the current dossier already points to ${strongestOpportunityLabel} as the cleanest Yellow Panther angle.`
            : `${entityName} matters because it is being tracked for commercial and digital opportunity signals.`,
        },
        confidence: toConfidence(metadata.confidence_score, 0.7),
        evidence_refs: toList([coreInfo.website, metadata.generated_date]),
      },
      commercial_digital_context: {
        status: toStatus([digital.digital_maturity, digital.transformation_score, digitalSignals]),
        content: {
          digital_maturity_summary: digitalSignals[0] || 'Digital posture not yet fully established.',
          commercial_motion: strongestOpportunityText || 'Commercial motion not yet clearly evidenced.',
          fan_or_data_signals: digitalSignals,
          transformation_pressure: toList([
            strongestOpportunityText,
            Array.isArray(digital.strategic_opportunities) ? digital.strategic_opportunities[0] : null,
          ]),
        },
        confidence: toConfidence(metadata.confidence_score, 0.68),
        evidence_refs: toList([coreInfo.website]),
      },
      leadership_decision_shape: {
        status: toStatus([economicBuyers, technicalBuyers, influencers, recommendations.optimal_team_member]),
        content: {
          economic_buyer: economicBuyers,
          technical_buyer: technicalBuyers,
          influencers,
          decision_dynamics: String(
            recommendations.team_coordination ||
              'Commercial and technical stakeholders both need to be aligned for meaningful progress.',
          ),
        },
        confidence: toConfidence(metadata.confidence_score, 0.65),
        evidence_refs: toList([recommendations.optimal_team_member]),
      },
      opportunity_narrative: {
        status: toStatus([strategic.overall_assessment, strongestOpportunityText, approachStrategy]),
        content: {
          best_fit_problem: strongestOpportunityText || 'Best-fit problem not yet isolated.',
          why_now: String(strategic.overall_assessment || 'The current dossier points to active commercial and digital pressure.'),
          yellow_panther_angle: String(
            strongestOpportunityLabel
              ? `Yellow Panther can frame ${strongestOpportunityLabel} as a pilotable, revenue-adjacent initiative.`
              : 'Yellow Panther should frame its offer around a validated operational or fan-facing pain point.',
          ),
          likely_objections: toList([
            'Proof of value required before broader transformation',
            'Competing internal priorities and vendor incumbency',
          ]),
        },
        confidence: toConfidence(metadata.confidence_score, 0.72),
        evidence_refs: toList([strongestOpportunityText]),
      },
      relationship_access: {
        status: toStatus([warmPaths, recommendations.optimal_team_member]),
        content: {
          warm_paths: warmPaths,
          partner_paths: toList(['Innovation lab route', 'Commercial partnership route']),
          gatekeepers: toList([recommendations.optimal_team_member, 'Commercial leadership']),
          best_entry_route: warmPaths[0] || 'Direct outreach to the commercial and digital leadership cluster.',
        },
        confidence: toConfidence(metadata.confidence_score, 0.62),
        evidence_refs: toList(warmPaths),
      },
      temporal_relational_context: {
        status: toStatus([freshnessSummary, relationshipSignals, totalConnectionsFound != null || tier1PathCount != null || tier2PathCount != null || recommendations.optimal_team_member]),
        content: {
          freshness_summary: freshnessSummary,
          timeline_anchors: timelineAnchors,
          relationship_summary: relationshipSignals.length > 0
            ? relationshipSignals.join('; ')
            : 'No relationship summary has been derived from the graph-backed dossier yet.',
          relationship_signals: relationshipSignals,
          graph_source: totalConnectionsFound != null || tier1PathCount != null || tier2PathCount != null
            ? 'Graph-backed relationship signals from the persisted dossier and Falkor/Graphiti-enriched connection analysis.'
            : 'Persisted dossier metadata only.',
        },
        confidence: toConfidence(metadata.confidence_score, 0.7),
        evidence_refs: toList([
          metadata.information_freshness,
          metadata.generated_date,
          recommendations.optimal_team_member,
        ]),
      },
      recommended_approach: {
        status: toStatus([approachStrategy, strongestOpportunityText]),
        content: {
          approach_strategy: approachStrategy,
          first_message_theme: strongestOpportunityText
            ? `Lead with ${strongestOpportunityLabel} and the concrete evidence behind it.`
            : 'Lead with a concise evidence-backed problem statement.',
          pilot_idea: strongestOpportunityText || 'Small proof-of-value pilot around a validated need.',
          next_best_action: 'Validate one high-signal buying trigger, then align the outreach route to the most credible stakeholder path.',
        },
        confidence: toConfidence(metadata.confidence_score, 0.7),
        evidence_refs: toList([approachStrategy]),
      },
      evidence_confidence: {
        status: toStatus([metadata.confidence_score, metadata.information_freshness]),
        content: {
          strongest_evidence: toList([coreInfo.website, strongestOpportunityText, metadata.information_freshness]),
          open_questions: toList([
            digital.current_tech_partners?.[0] ? null : 'Primary technology vendors still need verification',
            roadmap?.phase_2_pilot?.timeline ? null : 'Pilot timing still needs validation',
          ]),
          stale_or_weak_points: toList([
            metadata.generated_date ? null : 'Generation timestamp missing',
          ]),
        },
        confidence: toConfidence(metadata.confidence_score, 0.7),
        evidence_refs: toList([metadata.generated_date, metadata.information_freshness]),
      },
    },
  }
}
