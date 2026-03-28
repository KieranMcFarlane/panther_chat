create table if not exists public.graphiti_materialized_opportunities (
  opportunity_id text primary key,
  insight_id text not null references public.graphiti_materialized_insights(insight_id) on delete cascade,
  entity_id text not null,
  entity_name text not null default '',
  entity_type text not null default 'entity',
  canonical_entity_id text,
  canonical_entity_name text,
  organization text not null default '',
  title text not null default '',
  summary text not null default '',
  why_it_matters text not null default '',
  suggested_action text not null default '',
  confidence double precision not null default 0 check (confidence >= 0 and confidence <= 100),
  confidence_score double precision not null default 0 check (confidence_score >= 0 and confidence_score <= 1),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  priority_score double precision not null default 0 check (priority_score >= 0 and priority_score <= 10),
  yellow_panther_fit double precision not null default 0 check (yellow_panther_fit >= 0 and yellow_panther_fit <= 100),
  category text not null default '',
  status text not null default 'qualified',
  location text,
  value text,
  deadline text,
  sport text not null default 'Unknown',
  competition text not null default 'Unknown',
  entity_role text not null default 'Organization',
  opportunity_kind text not null default 'Other',
  theme text not null default 'Other',
  taxonomy jsonb not null default '{}'::jsonb,
  source_url text not null default '/entity-browser',
  tags jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  relationships jsonb not null default '[]'::jsonb,
  source_run_id text,
  source_signal_id text,
  source_episode_id text,
  source_objective text,
  detected_at timestamptz not null default now(),
  materialized_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  state_hash text not null,
  is_active boolean not null default true,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists graphiti_materialized_opportunities_active_idx
  on public.graphiti_materialized_opportunities (is_active, last_seen_at desc);

create index if not exists graphiti_materialized_opportunities_entity_idx
  on public.graphiti_materialized_opportunities (entity_id, is_active, materialized_at desc);

create index if not exists graphiti_materialized_opportunities_canonical_entity_idx
  on public.graphiti_materialized_opportunities (canonical_entity_id, is_active, materialized_at desc);

