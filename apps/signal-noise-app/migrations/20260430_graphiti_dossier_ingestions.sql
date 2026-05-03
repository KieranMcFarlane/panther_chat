create extension if not exists pgcrypto;

create table if not exists public.graphiti_dossier_ingestions (
  id uuid primary key default gen_random_uuid(),
  canonical_entity_id text not null,
  dossier_id uuid,
  entity_id text not null default '',
  entity_name text not null default '',
  entity_type text not null default 'ENTITY',
  content_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'ingested', 'skipped_empty', 'failed')),
  quality_state text not null default 'empty'
    check (quality_state in ('partial', 'complete', 'blocked', 'failed', 'empty', 'client_ready')),
  answer_count integer not null default 0,
  evidence_count integer not null default 0,
  source_created_at timestamptz,
  source_generated_at timestamptz,
  ingested_at timestamptz,
  last_error text,
  source_description text not null default 'entity_dossiers',
  reference_time timestamptz,
  episode_body jsonb not null default '{}'::jsonb,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canonical_entity_id, content_hash)
);

create index if not exists graphiti_dossier_ingestions_canonical_entity_idx
  on public.graphiti_dossier_ingestions (canonical_entity_id, updated_at desc);

create index if not exists graphiti_dossier_ingestions_status_idx
  on public.graphiti_dossier_ingestions (status, updated_at desc);

create index if not exists graphiti_dossier_ingestions_quality_idx
  on public.graphiti_dossier_ingestions (quality_state, updated_at desc);

create index if not exists graphiti_dossier_ingestions_generated_idx
  on public.graphiti_dossier_ingestions (source_generated_at desc nulls last);

create index if not exists graphiti_dossier_ingestions_hash_idx
  on public.graphiti_dossier_ingestions (content_hash);
