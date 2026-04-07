create table if not exists public.graphiti_materialized_insights (
  insight_id text primary key,
  entity_id text not null,
  entity_name text not null default '',
  entity_type text not null default 'entity',
  title text not null default '',
  summary text not null default '',
  why_it_matters text not null default '',
  suggested_action text not null default '',
  confidence double precision not null default 0 check (confidence >= 0 and confidence <= 1),
  freshness text not null default 'recent' check (freshness in ('new', 'recent', 'stale')),
  insight_type text not null default 'watch_item' check (insight_type in ('opportunity', 'watch_item', 'operational')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  destination_url text not null default '/entity-browser',
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

create index if not exists graphiti_materialized_insights_active_idx
  on public.graphiti_materialized_insights (is_active, last_seen_at desc);

create index if not exists graphiti_materialized_insights_entity_idx
  on public.graphiti_materialized_insights (entity_id, is_active, materialized_at desc);

create table if not exists public.graphiti_notifications (
  id uuid primary key default gen_random_uuid(),
  insight_id text not null references public.graphiti_materialized_insights(insight_id) on delete cascade,
  entity_id text not null,
  title text not null,
  short_message text not null,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  destination_url text not null,
  created_at timestamptz not null default now(),
  sent_state text not null default 'pending' check (sent_state in ('pending', 'sent', 'failed', 'skipped')),
  read_state text not null default 'unread' check (read_state in ('unread', 'read')),
  sent_at timestamptz,
  read_at timestamptz,
  state_hash text not null,
  insight_type text,
  unique (insight_id, state_hash)
);

create index if not exists graphiti_notifications_created_idx
  on public.graphiti_notifications (created_at desc);

create index if not exists graphiti_notifications_unread_idx
  on public.graphiti_notifications (read_state, created_at desc);

create table if not exists public.entity_dossier_ops (
  entity_id text primary key,
  review_status text not null default 'resolved' check (review_status in ('needs_review', 'in_review', 'resolved')),
  review_note text,
  rerun_requested_at timestamptz,
  rerun_requested_by text,
  rerun_reason text,
  last_rerun_job_id text,
  missing_evidence_summary jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entity_dossier_ops_review_idx
  on public.entity_dossier_ops (review_status, updated_at desc);
