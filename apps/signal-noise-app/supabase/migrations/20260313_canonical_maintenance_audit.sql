create table if not exists public.canonical_maintenance_audit (
  id uuid primary key default gen_random_uuid(),
  sync_run_id text not null,
  trigger text not null,
  status text not null check (status in ('passed', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  steps jsonb not null default '[]'::jsonb,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists canonical_maintenance_audit_sync_run_idx
  on public.canonical_maintenance_audit (sync_run_id, created_at desc);

create index if not exists canonical_maintenance_audit_trigger_idx
  on public.canonical_maintenance_audit (trigger, created_at desc);
