import type { HomeGraphitiInsightEvidence, HomeGraphitiInsightRelationship } from '@/lib/home-graphiti-contract'

export type GraphitiOpportunityStatus = 'ready' | 'degraded' | 'empty'

export type GraphitiOpportunityTaxonomy = {
  sport: string
  competition: string
  entity_role: string
  opportunity_kind: string
  theme: string
}

export type GraphitiOpportunityCard = {
  id: string
  title: string
  organization: string
  description: string
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
