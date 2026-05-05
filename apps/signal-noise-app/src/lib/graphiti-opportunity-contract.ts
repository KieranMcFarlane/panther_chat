import type { HomeGraphitiInsightEvidence, HomeGraphitiInsightRelationship } from '@/lib/home-graphiti-contract'
import type { GraphitiOpportunityBriefing } from '@/lib/graphiti-opportunity-briefing'

export type GraphitiOpportunityStatus = 'ready' | 'degraded' | 'empty'

export type GraphitiOpportunityTaxonomy = {
  sport: string
  competition: string
  entity_role: string
  opportunity_kind: string
  theme: string
}

export type GraphitiOpportunityTemporalStatus =
  | 'emerging'
  | 'active'
  | 'accelerating'
  | 'stale'
  | 'expired'
  | 'unknown'

export type GraphitiOpportunityTemporalReasoning = {
  status: GraphitiOpportunityTemporalStatus
  reason: string
  recency_label: string
  first_seen_at: string | null
  last_seen_at: string | null
  detected_at: string | null
  deadline: string | null
}

export type GraphitiOpportunityPatternReasoning = {
  pattern_status: 'pattern_detected' | 'isolated_signal' | 'no_pattern'
  signal_type: string
  signal_count: number
  summary: string
  supporting_signals: string[]
}

export type GraphitiOpportunityFinding = {
  label: string
  finding: string
  source_url: string | null
  observed_at: string | null
  confidence: number | null
  signal_type: string
  source: string
}

export type GraphitiOpportunityTimelineEvent = {
  at: string
  label: string
  signal_type: string
  source_url: string | null
}

export type GraphitiOpportunityRelatedPattern = {
  entity_id: string | null
  entity_name: string
  relationship_type: string
  reason: string
}

export type GraphitiOpportunityStrategyBrief = {
  schema_version: 'yp_bd_strategy_v1'
  generated_at: string
  model: string
  source_profile: 'YELLOW-PANTHER-BUSINESS-PROFILE.md'
  signal_title: string
  signal_strength: 'High' | 'Medium' | 'Low'
  verification_status: 'Ready for outreach' | 'Needs verification' | 'Needs enrichment' | 'Ignore'
  service_wedge:
    | 'mobile_app'
    | 'fan_engagement'
    | 'digital_transformation'
    | 'analytics_ai'
    | 'backend_integration'
    | 'sports_platform'
    | 'consulting'
    | 'no_clear_fit'
  pursuit_recommendation: 'outreach_ready' | 'verify_now' | 'needs_enrichment' | 'ignore'
  decision_summary: string
  what_happened: string
  why_it_matters_now: string
  yellow_panther_angle: string
  suggested_route: string
  next_move: string
  outreach_opener: string
  verify_before_action: string[]
  disqualifiers: string[]
  evidence_used: string[]
  reasoning_notes: string
}

export type GraphitiOpportunityCard = {
  id: string
  title: string
  organization: string
  description: string
  why_this_is_an_opportunity?: string
  yellow_panther_fit_feedback?: string
  next_steps?: string[]
  supporting_signals?: string[]
  read_more_context?: string
  location: string | null
  value: string | null
  deadline: string | null
  category: string
  priority: string | null
  priority_score: number | null
  confidence: number | null
  confidence_score: number | null
  yellow_panther_fit: number | null
  entity_id: string | null
  entity_name: string | null
  canonical_entity_id?: string | null
  canonical_entity_name?: string | null
  entity_type: string | null
  sport?: string | null
  competition?: string | null
  entity_role?: string | null
  opportunity_kind?: string | null
  theme?: string | null
  taxonomy?: GraphitiOpportunityTaxonomy | null
  metadata?: Record<string, unknown> | null
  source_url: string | null
  tags: string[] | null
  detected_at: string | null
  status?: string | null
  evidence?: HomeGraphitiInsightEvidence[]
  relationships?: HomeGraphitiInsightRelationship[]
  temporal_reasoning?: GraphitiOpportunityTemporalReasoning | null
  pattern_reasoning?: GraphitiOpportunityPatternReasoning | null
  yp_fit_reasoning?: string | null
  recommended_action?: string | null
  findings?: GraphitiOpportunityFinding[]
  timeline?: GraphitiOpportunityTimelineEvent[]
  related_patterns?: GraphitiOpportunityRelatedPattern[]
  briefing?: GraphitiOpportunityBriefing | GraphitiOpportunityStrategyBrief
  strategy_brief?: GraphitiOpportunityStrategyBrief
  commercial_state?: 'outreach_ready' | 'verify_now' | 'watch' | 'context_only' | 'data_issue'
  commercial_confidence?: 'High' | 'Medium' | 'Low' | string
  commercial_confidence_score?: number
  yp_relevance?: number
  commercial_truth_reasons?: string[]
}

export type GraphitiOpportunitySourceRow = {
  insight_id: string
  entity_id: string
  entity_name: string
  entity_type: string
  insight_type?: string | null
  title: string
  summary: string
  why_it_matters: string
  suggested_action: string
  confidence: number
  freshness: 'new' | 'recent' | 'stale'
  evidence: HomeGraphitiInsightEvidence[]
  relationships: HomeGraphitiInsightRelationship[]
  priority?: 'high' | 'medium' | 'low'
  destination_url?: string
  detected_at: string
  materialized_at?: string
  source_run_id?: string | null
  source_signal_id?: string | null
  source_episode_id?: string | null
  source_objective?: string | null
  raw_payload?: Record<string, unknown> | null
}

export type GraphitiOpportunityResponse = {
  source: 'graphiti_opportunities' | 'graphiti_pipeline'
  status: GraphitiOpportunityStatus
  generated_at: string
  last_updated_at: string
  opportunities: GraphitiOpportunityCard[]
  snapshot: {
    opportunities_scanned: number
    opportunities_materialized: number
    active_opportunities: number
    freshness_window_hours: number
  }
  warnings?: string[]
}
