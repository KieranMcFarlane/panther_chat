export type HomeGraphitiScope = 'homepage'

export interface HomeGraphitiInsightEvidence {
  type: 'episode' | 'entity' | 'relationship' | 'rfp' | 'note'
  id: string
  snippet: string
  source?: string
}

export interface HomeGraphitiInsightRelationship {
  type: string
  target_id: string
  target_name: string
  direction?: 'inbound' | 'outbound' | 'bidirectional'
}

export interface HomeGraphitiInsight {
  insight_id: string
  entity_id: string
  entity_name: string
  entity_type: string
  sport: string
  league?: string
  title: string
  summary: string
  why_it_matters: string
  confidence: number
  freshness: 'new' | 'recent' | 'stale'
  evidence: HomeGraphitiInsightEvidence[]
  relationships: HomeGraphitiInsightRelationship[]
  suggested_action: string
  detected_at: string
  source_run_id?: string
  source_signal_id?: string
  source_episode_id?: string
  source_objective?: string
  materialized_at?: string
}

export interface HomeGraphitiRelatedEntity {
  entity_id: string
  name: string
  entity_type: string
  reason: string
  insight_count: number
}

export interface HomeGraphitiQueryContext {
  scope: HomeGraphitiScope
  as_of: string
  entity_scope: string[]
  freshness_window_hours: number
}

export interface HomeGraphitiSnapshot {
  entities_scanned: number
  insights_found: number
  high_confidence_insights: number
  last_updated_at: string
  freshness_window_hours: number
}

export interface HomeGraphitiInsightsResponse {
  source: 'graphiti' | 'graphiti_pipeline'
  query_context: HomeGraphitiQueryContext
  snapshot: HomeGraphitiSnapshot
  highlights: HomeGraphitiInsight[]
  related_entities: HomeGraphitiRelatedEntity[]
  generated_at: string
  status: 'ready' | 'degraded' | 'empty'
  warnings?: string[]
}
